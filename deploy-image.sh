#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="ghcr.io/joerawr"
IMAGE_NAME="kids-multi-wiki-chat"
NAMESPACE="knowledge-quest"
DEPLOYMENT_NAME="wiki-chat"

print_usage() {
    echo "Usage: $0 <version> [options]"
    echo ""
    echo "Arguments:"
    echo "  version     Version tag (e.g., v1.2.3, 2024.01.15, build-123)"
    echo ""
    echo "Options:"
    echo "  --no-latest    Don't tag as latest"
    echo "  --test-only    Only run tests, don't push or deploy"
    echo "  --skip-tests   Skip tests (not recommended)"
    echo "  --rollback     Rollback to previous version"
    echo "  --dry-run      Show what would be done without executing"
    echo ""
    echo "Examples:"
    echo "  $0 v1.2.3                    # Build, test, push v1.2.3 and latest, deploy"
    echo "  $0 v1.2.4 --no-latest        # Build, test, push v1.2.4 only, deploy"
    echo "  $0 v1.2.3 --test-only        # Build and test v1.2.3, don't push"
    echo "  $0 --rollback                 # Rollback to previous deployment"
}

print_header() {
    echo -e "${BLUE}=================================${NC}"
    echo -e "${BLUE} Docker Image Deployment${NC}"
    echo -e "${BLUE}=================================${NC}"
}

log_info() {
    echo -e "${BLUE}INFO: $1${NC}"
}

log_success() {
    echo -e "${GREEN}SUCCESS: $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}WARNING: $1${NC}"
}

log_error() {
    echo -e "${RED}ERROR: $1${NC}"
}

get_current_deployment_image() {
    kubectl get deployment $DEPLOYMENT_NAME -n $NAMESPACE -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "none"
}

get_previous_deployment_image() {
    # Get from rollout history
    kubectl rollout history deployment/$DEPLOYMENT_NAME -n $NAMESPACE --revision=1 -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "none"
}

build_image() {
    local version=$1
    local versioned_tag="${REGISTRY}/${IMAGE_NAME}:${version}"

    log_info "Building Docker image with tag: $version"

    if [ "$DRY_RUN" = "true" ]; then
        echo "DRY RUN: Would build: $versioned_tag"
        return 0
    fi

    docker build \
        --build-arg NEXT_PUBLIC_LOCKED_MODEL=gemini-2.5-flash \
        -t "$versioned_tag" .

    if [ "$TAG_LATEST" = "true" ]; then
        log_info "Tagging as latest"
        docker tag "$versioned_tag" "${REGISTRY}/${IMAGE_NAME}:latest"
    fi

    log_success "Image built successfully"
}

test_image() {
    local version=$1

    log_info "Running comprehensive tests on version: $version"

    if [ "$DRY_RUN" = "true" ]; then
        echo "DRY RUN: Would test: $version"
        return 0
    fi

    if ./test-docker-image.sh "$version"; then
        log_success "All tests passed for version: $version"
        return 0
    else
        log_error "Tests failed for version: $version"
        return 1
    fi
}

push_image() {
    local version=$1
    local versioned_tag="${REGISTRY}/${IMAGE_NAME}:${version}"

    log_info "Pushing image to registry"

    if [ "$DRY_RUN" = "true" ]; then
        echo "DRY RUN: Would push: $versioned_tag"
        if [ "$TAG_LATEST" = "true" ]; then
            echo "DRY RUN: Would push: ${REGISTRY}/${IMAGE_NAME}:latest"
        fi
        return 0
    fi

    docker push "$versioned_tag"

    if [ "$TAG_LATEST" = "true" ]; then
        log_info "Pushing latest tag"
        docker push "${REGISTRY}/${IMAGE_NAME}:latest"
    fi

    log_success "Image pushed successfully"
}

deploy_to_k8s() {
    local version=$1

    log_info "Deploying to Kubernetes"

    if [ "$DRY_RUN" = "true" ]; then
        echo "DRY RUN: Would deploy version: $version"
        return 0
    fi

    # Update deployment to use new image
    kubectl set image deployment/$DEPLOYMENT_NAME -n $NAMESPACE \
        wiki-chat="${REGISTRY}/${IMAGE_NAME}:${version}"

    # Wait for rollout to complete
    log_info "Waiting for deployment to complete..."
    kubectl rollout status deployment/$DEPLOYMENT_NAME -n $NAMESPACE --timeout=300s

    # Verify health
    log_info "Verifying deployment health..."
    sleep 10

    # Get pod status
    local pod_status=$(kubectl get pods -n $NAMESPACE -l app=kids-multi-wiki-chat -o jsonpath='{.items[0].status.phase}')
    if [ "$pod_status" = "Running" ]; then
        log_success "Deployment successful - pod is running"

        # Test health endpoint
        log_info "Testing health endpoint via port-forward..."
        kubectl port-forward -n $NAMESPACE deployment/$DEPLOYMENT_NAME 8080:3000 &
        local pf_pid=$!
        sleep 5

        if curl -f -s http://localhost:8080/api/health > /dev/null; then
            log_success "Health check passed"
        else
            log_warning "Health check failed, but pod is running"
        fi

        kill $pf_pid 2>/dev/null || true

        return 0
    else
        log_error "Deployment failed - pod status: $pod_status"
        return 1
    fi
}

rollback_deployment() {
    log_info "Rolling back deployment"

    if [ "$DRY_RUN" = "true" ]; then
        echo "DRY RUN: Would rollback deployment"
        return 0
    fi

    kubectl rollout undo deployment/$DEPLOYMENT_NAME -n $NAMESPACE
    kubectl rollout status deployment/$DEPLOYMENT_NAME -n $NAMESPACE --timeout=300s

    local current_image=$(get_current_deployment_image)
    log_success "Rollback completed. Current image: $current_image"
}

show_deployment_info() {
    echo ""
    echo -e "${BLUE}Current Deployment Info:${NC}"
    echo "Namespace: $NAMESPACE"
    echo "Deployment: $DEPLOYMENT_NAME"
    echo "Current Image: $(get_current_deployment_image)"
    echo ""
    echo "Recent rollout history:"
    kubectl rollout history deployment/$DEPLOYMENT_NAME -n $NAMESPACE | head -5
    echo ""
}

# Parse arguments
VERSION=""
TAG_LATEST="true"
TEST_ONLY="false"
SKIP_TESTS="false"
ROLLBACK="false"
DRY_RUN="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        --no-latest)
            TAG_LATEST="false"
            shift
            ;;
        --test-only)
            TEST_ONLY="true"
            shift
            ;;
        --skip-tests)
            SKIP_TESTS="true"
            shift
            ;;
        --rollback)
            ROLLBACK="true"
            shift
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        -*)
            log_error "Unknown option: $1"
            print_usage
            exit 1
            ;;
        *)
            if [ -z "$VERSION" ]; then
                VERSION="$1"
            else
                log_error "Multiple versions specified"
                print_usage
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate inputs
if [ "$ROLLBACK" = "true" ]; then
    if [ -n "$VERSION" ]; then
        log_error "Cannot specify version with --rollback"
        exit 1
    fi
elif [ -z "$VERSION" ]; then
    log_error "Version is required (unless using --rollback)"
    print_usage
    exit 1
fi

# Check prerequisites
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed or not in PATH"
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    log_error "kubectl is not installed or not in PATH"
    exit 1
fi

# Main execution
main() {
    print_header

    if [ "$DRY_RUN" = "true" ]; then
        log_warning "DRY RUN MODE - No actual changes will be made"
        echo ""
    fi

    show_deployment_info

    if [ "$ROLLBACK" = "true" ]; then
        rollback_deployment
        return $?
    fi

    log_info "Starting deployment of version: $VERSION"
    echo "Tag as latest: $TAG_LATEST"
    echo "Test only: $TEST_ONLY"
    echo "Skip tests: $SKIP_TESTS"
    echo ""

    # Build image
    build_image "$VERSION" || exit 1

    # Run tests
    if [ "$SKIP_TESTS" = "false" ]; then
        test_image "$VERSION" || exit 1
    else
        log_warning "Skipping tests (not recommended for production)"
    fi

    # If test-only, stop here
    if [ "$TEST_ONLY" = "true" ]; then
        log_success "Test-only mode completed successfully"
        return 0
    fi

    # Push to registry
    push_image "$VERSION" || exit 1

    # Deploy to K8s
    deploy_to_k8s "$VERSION" || exit 1

    log_success "Deployment completed successfully!"
    echo ""
    echo "Version deployed: $VERSION"
    echo "Registry: ${REGISTRY}/${IMAGE_NAME}:${VERSION}"
    if [ "$TAG_LATEST" = "true" ]; then
        echo "Also tagged as: ${REGISTRY}/${IMAGE_NAME}:latest"
    fi
}

main "$@"