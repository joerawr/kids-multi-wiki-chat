#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_TAG="${1:-latest}"
IMAGE_NAME="ghcr.io/joerawr/kids-multi-wiki-chat:${IMAGE_TAG}"
CONTAINER_NAME="wiki-chat-test-$$"
TEST_PORT="3001"
LOCKED_MODEL="gemini-2.5-flash"

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

print_header() {
    echo -e "${BLUE}=================================${NC}"
    echo -e "${BLUE} Docker Image Testing Suite${NC}"
    echo -e "${BLUE}=================================${NC}"
    echo "Image: $IMAGE_NAME"
    echo "Container: $CONTAINER_NAME"
    echo "Port: $TEST_PORT"
    echo "Locked Model: $LOCKED_MODEL"
    echo ""
}

print_test() {
    echo -e "${YELLOW}Testing: $1${NC}"
}

pass_test() {
    echo -e "${GREEN}✅ PASS: $1${NC}"
    ((TESTS_PASSED++))
}

fail_test() {
    echo -e "${RED}❌ FAIL: $1${NC}"
    echo -e "${RED}   Error: $2${NC}"
    ((TESTS_FAILED++))
    FAILED_TESTS+=("$1")
}

cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true
}

wait_for_container() {
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s http://localhost:$TEST_PORT/api/health > /dev/null 2>&1; then
            return 0
        fi
        sleep 2
        ((attempt++))
    done
    return 1
}

test_image_exists() {
    print_test "Docker image exists"
    if docker image inspect $IMAGE_NAME > /dev/null 2>&1; then
        pass_test "Docker image exists"
        return 0
    else
        fail_test "Docker image exists" "Image $IMAGE_NAME not found"
        return 1
    fi
}

test_container_startup() {
    print_test "Container startup"

    # Start container (NEXT_PUBLIC_LOCKED_MODEL is baked into build)
    if docker run -d --name $CONTAINER_NAME \
        -p $TEST_PORT:3000 \
        $IMAGE_NAME > /dev/null 2>&1; then

        # Wait for container to be ready
        if wait_for_container; then
            pass_test "Container startup"
            return 0
        else
            fail_test "Container startup" "Container failed to respond within 60 seconds"
            docker logs $CONTAINER_NAME 2>&1 | tail -10
            return 1
        fi
    else
        fail_test "Container startup" "Failed to start container"
        return 1
    fi
}

test_health_check() {
    print_test "Health check endpoint"

    local response=$(curl -f -s http://localhost:$TEST_PORT/api/health 2>/dev/null)
    if [ $? -eq 0 ] && echo "$response" | grep -q "healthy"; then
        pass_test "Health check endpoint"
        return 0
    else
        fail_test "Health check endpoint" "Health endpoint not responding or unhealthy"
        return 1
    fi
}

test_homepage_loading() {
    print_test "Homepage loading"

    local response=$(curl -f -s http://localhost:$TEST_PORT/ 2>/dev/null)
    if [ $? -eq 0 ] && echo "$response" | grep -q "Knowledge Quest"; then
        pass_test "Homepage loading"
        return 0
    else
        fail_test "Homepage loading" "Homepage not loading or missing expected content"
        return 1
    fi
}

test_locked_model() {
    print_test "Locked model configuration"

    # Check that model selector is hidden when model is locked
    local response=$(curl -f -s http://localhost:$TEST_PORT/ 2>/dev/null)
    if [ $? -eq 0 ]; then
        # Model selector should NOT have multiple model options visible
        # Look for the presence of model selection UI (gemini-2.5-pro, gpt-5, etc.)
        if ! echo "$response" | grep -qi "gemini-2.5-pro" && ! echo "$response" | grep -qi "gpt-5"; then
            pass_test "Locked model configuration"
            return 0
        else
            fail_test "Locked model configuration" "Model selector appears to be visible (found multiple model options)"
            return 1
        fi
    else
        fail_test "Locked model configuration" "Could not access homepage to verify"
        return 1
    fi
}

test_mcp_server_switching() {
    print_test "MCP server switching"

    local response=$(curl -X POST http://localhost:$TEST_PORT/api/mcp/switch \
        -H "Content-Type: application/json" \
        -d '{"serverId": "minecraft"}' \
        -s 2>/dev/null)

    if echo "$response" | grep -q '"success":true' && echo "$response" | grep -q '"activeServer":"minecraft"'; then
        pass_test "MCP server switching"
        return 0
    else
        fail_test "MCP server switching" "MCP switch failed: $response"
        return 1
    fi
}

test_mcp_server_invalid() {
    print_test "MCP server error handling"

    local response=$(curl -X POST http://localhost:$TEST_PORT/api/mcp/switch \
        -H "Content-Type: application/json" \
        -d '{"serverId": "invalid-server"}' \
        -s 2>/dev/null)

    if echo "$response" | grep -q '"success":false' && echo "$response" | grep -q "Unknown server"; then
        pass_test "MCP server error handling"
        return 0
    else
        fail_test "MCP server error handling" "Expected error not returned: $response"
        return 1
    fi
}

test_container_logs() {
    print_test "Container logs for errors"

    local logs=$(docker logs $CONTAINER_NAME 2>&1)
    if echo "$logs" | grep -i "error\|fail\|exception" | grep -v "ENOENT.*sharp" | grep -v "telemetry" > /dev/null; then
        fail_test "Container logs for errors" "Found errors in container logs"
        echo "$logs" | grep -i "error\|fail\|exception" | head -5
        return 1
    else
        pass_test "Container logs for errors"
        return 0
    fi
}

print_summary() {
    echo -e "\n${BLUE}=================================${NC}"
    echo -e "${BLUE} Test Results Summary${NC}"
    echo -e "${BLUE}=================================${NC}"
    echo -e "Total tests: $((TESTS_PASSED + TESTS_FAILED))"
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"

    if [ $TESTS_FAILED -gt 0 ]; then
        echo -e "\n${RED}Failed tests:${NC}"
        for test in "${FAILED_TESTS[@]}"; do
            echo -e "${RED}- $test${NC}"
        done
        echo -e "\n${RED}❌ OVERALL: TESTS FAILED${NC}"
        echo -e "${RED}Do not push this image to production!${NC}"
        return 1
    else
        echo -e "\n${GREEN}✅ OVERALL: ALL TESTS PASSED${NC}"
        echo -e "${GREEN}Image is ready for production deployment!${NC}"
        echo ""
        echo "To push to GitHub Container Registry:"
        echo "  docker push $IMAGE_NAME"
        echo ""
        echo "To deploy to Kubernetes:"
        echo "  kubectl rollout restart deployment/wiki-chat -n knowledge-quest"
        return 0
    fi
}

# Main execution
main() {
    # Set up cleanup trap
    trap cleanup EXIT

    print_header

    # Run tests in order
    test_image_exists || exit 1
    test_container_startup || exit 1

    # Wait a moment for container to fully initialize
    sleep 3

    test_health_check
    test_homepage_loading
    test_locked_model
    test_mcp_server_switching
    test_mcp_server_invalid
    test_container_logs

    # Print summary and exit with appropriate code
    if print_summary; then
        exit 0
    else
        exit 1
    fi
}

# Check if docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed or not in PATH${NC}"
    exit 1
fi

# Check if curl is available
if ! command -v curl &> /dev/null; then
    echo -e "${RED}Error: curl is not installed or not in PATH${NC}"
    exit 1
fi

# Run main function
main "$@"