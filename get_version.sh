#!/bin/bash
# Script to retrieve the latest container version from GitHub Container Registry
# Usage: ./get_version.sh [--all]
#   --all: Show all versions (default: show latest 10)

set -e

# Colors for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo -e "${RED}Error: .env.local not found${NC}"
    echo "Please create .env.local with GH_PACKAGE_READ token"
    exit 1
fi

# Load GH_PACKAGE_READ from .env.local
GH_PACKAGE_READ=$(grep "^GH_PACKAGE_READ=" .env.local | cut -d '=' -f2)

if [ -z "$GH_PACKAGE_READ" ]; then
    echo -e "${RED}Error: GH_PACKAGE_READ not found in .env.local${NC}"
    exit 1
fi

# GitHub username (hardcoded for this repo)
GITHUB_USERNAME="joerawr"
REPO_NAME="kids-multi-wiki-chat"

echo -e "${BLUE}Fetching container versions from GHCR...${NC}"

# Step 1: Base64 encode credentials
CREDENTIALS=$(echo -n "${GITHUB_USERNAME}:${GH_PACKAGE_READ}" | base64)

# Step 2: Get authentication token
TOKEN_RESPONSE=$(curl -s -H "Authorization: Basic ${CREDENTIALS}" \
    "https://ghcr.io/token?service=ghcr.io&scope=repository:${GITHUB_USERNAME}/${REPO_NAME}:pull")

TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo -e "${RED}Error: Failed to get authentication token${NC}"
    echo "Response: $TOKEN_RESPONSE"
    exit 1
fi

# Step 3: Get tags list
TAGS_RESPONSE=$(curl -s -H "Authorization: Bearer ${TOKEN}" \
    "https://ghcr.io/v2/${GITHUB_USERNAME}/${REPO_NAME}/tags/list")

# Check if request was successful
if ! echo "$TAGS_RESPONSE" | jq -e '.tags' > /dev/null 2>&1; then
    echo -e "${RED}Error: Failed to get tags${NC}"
    echo "Response: $TAGS_RESPONSE"
    exit 1
fi

# Parse and display versions
echo -e "\n${GREEN}Available container versions:${NC}"

if [ "$1" = "--all" ]; then
    # Show all versions
    echo "$TAGS_RESPONSE" | jq -r '.tags | sort_by(.) | reverse | .[]'
else
    # Show latest 10 versions
    echo "$TAGS_RESPONSE" | jq -r '.tags | sort_by(.) | reverse | .[0:10] | .[]'
fi

# Extract and display latest semantic version
echo -e "\n${BLUE}Latest semantic version:${NC}"
LATEST_VERSION=$(echo "$TAGS_RESPONSE" | jq -r '.tags | map(select(startswith("v"))) | sort_by(.) | reverse | .[0]')
echo -e "${GREEN}${LATEST_VERSION}${NC}"
