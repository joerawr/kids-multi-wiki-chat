#!/bin/bash

# Kids Multi-Wiki Chat - Kubernetes Deployment Script
# Usage: ./deploy.sh [build|deploy|update|status|logs|cleanup]

set -euo pipefail

NAMESPACE="knowledge-quest"
APP_NAME="kids-multi-wiki-chat"
IMAGE_REPO="ghcr.io/joerawr/kids-multi-wiki-chat"
IMAGE_TAG="${IMAGE_TAG:-latest}"
SECRET_MANIFEST="${SECRET_MANIFEST:-k8s/secret.local.yaml}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

check_prerequisites() {
    log "Checking prerequisites..."

    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed or not in PATH"
    fi

    if ! command -v docker &> /dev/null; then
        error "docker is not installed or not in PATH"
    fi

    # Check if kubectl can connect to cluster
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
    fi

    log "Prerequisites check passed"
}

build_image() {
    log "Building Docker image..."

    # Tag with both latest and git commit hash
    GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

    docker build -t ${IMAGE_REPO}:${IMAGE_TAG} .
    docker build -t ${IMAGE_REPO}:${GIT_HASH} .

    log "Image built successfully: ${IMAGE_REPO}:${IMAGE_TAG}"

    # Test the image locally
    info "Testing image locally..."
    docker run -d --name wiki-chat-test -p 3001:3000 \
        -e GOOGLE_GENERATIVE_AI_API_KEY="test-key" \
        ${IMAGE_REPO}:${IMAGE_TAG}

    sleep 5

    if curl -f http://localhost:3001/api/health &> /dev/null; then
        log "Health check passed"
    else
        warn "Health check failed, but continuing..."
    fi

    docker stop wiki-chat-test &> /dev/null || true
    docker rm wiki-chat-test &> /dev/null || true
}

push_image() {
    log "Pushing image to registry..."
    docker push ${IMAGE_REPO}:${IMAGE_TAG}

    GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    if [ "$GIT_HASH" != "unknown" ]; then
        docker push ${IMAGE_REPO}:${GIT_HASH}
    fi

    log "Image pushed successfully"
}

deploy_k8s() {
    log "Deploying to Kubernetes..."

    # Create namespace if it doesn't exist
    kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

    # Apply manifests
    kubectl apply -f k8s/namespace.yaml

    if [ -f "${SECRET_MANIFEST}" ]; then
        info "Applying secrets from ${SECRET_MANIFEST}"
        kubectl apply -f "${SECRET_MANIFEST}"
    else
        warn "Secret manifest ${SECRET_MANIFEST} not found. Create it from k8s/secret.yaml before deploying."
    fi

    kubectl apply -f k8s/service.yaml
    kubectl apply -f k8s/deployment.yaml
    kubectl apply -f k8s/ingress.yaml

    log "Waiting for deployment to be ready..."
    kubectl rollout status deployment/wiki-chat -n ${NAMESPACE} --timeout=300s

    log "Deployment completed successfully"
}

update_deployment() {
    log "Updating deployment with new image..."

    GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo ${IMAGE_TAG})
    NEW_IMAGE="${IMAGE_REPO}:${GIT_HASH}"

    kubectl set image deployment/wiki-chat wiki-chat=${NEW_IMAGE} -n ${NAMESPACE}
    kubectl rollout status deployment/wiki-chat -n ${NAMESPACE} --timeout=300s

    log "Deployment updated successfully with image: ${NEW_IMAGE}"
}

show_status() {
    info "Checking deployment status..."

    echo -e "\n${BLUE}Namespace:${NC}"
    kubectl get namespace ${NAMESPACE} 2>/dev/null || echo "Namespace not found"

    echo -e "\n${BLUE}Deployments:${NC}"
    kubectl get deployments -n ${NAMESPACE} 2>/dev/null || echo "No deployments found"

    echo -e "\n${BLUE}Pods:${NC}"
    kubectl get pods -n ${NAMESPACE} 2>/dev/null || echo "No pods found"

    echo -e "\n${BLUE}Services:${NC}"
    kubectl get services -n ${NAMESPACE} 2>/dev/null || echo "No services found"

    echo -e "\n${BLUE}Ingress:${NC}"
    kubectl get ingress -n ${NAMESPACE} 2>/dev/null || echo "No ingress found"

    # Show external access info
    echo -e "\n${BLUE}External Access:${NC}"
    kubectl get ingress wiki-chat-ingress -n ${NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[*].ip}' 2>/dev/null && echo
}

show_logs() {
    info "Showing application logs..."
    kubectl logs -f deployment/wiki-chat -n ${NAMESPACE}
}

cleanup() {
    warn "Cleaning up deployment..."

    read -p "Are you sure you want to delete the ${NAMESPACE} namespace and all resources? (y/N): " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kubectl delete namespace ${NAMESPACE}
        log "Cleanup completed"
    else
        info "Cleanup cancelled"
    fi
}

show_help() {
    echo "Kids Multi-Wiki Chat - Kubernetes Deployment Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  build     - Build Docker image locally"
    echo "  push      - Push image to registry"
    echo "  deploy    - Deploy to Kubernetes cluster"
    echo "  update    - Update existing deployment with new image"
    echo "  status    - Show deployment status"
    echo "  logs      - Show application logs"
    echo "  cleanup   - Remove all resources"
    echo "  help      - Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  IMAGE_TAG - Docker image tag (default: latest)"
    echo ""
    echo "Examples:"
    echo "  $0 build                    # Build image locally"
    echo "  $0 deploy                   # Full deployment"
    echo "  IMAGE_TAG=v1.0.1 $0 update  # Update with specific tag"
}

main() {
    case "${1:-help}" in
        build)
            check_prerequisites
            build_image
            ;;
        push)
            check_prerequisites
            push_image
            ;;
        deploy)
            check_prerequisites
            build_image
            push_image
            deploy_k8s
            show_status
            ;;
        update)
            check_prerequisites
            build_image
            push_image
            update_deployment
            ;;
        status)
            check_prerequisites
            show_status
            ;;
        logs)
            check_prerequisites
            show_logs
            ;;
        cleanup)
            check_prerequisites
            cleanup
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            error "Unknown command: $1. Use '$0 help' for usage information."
            ;;
    esac
}

main "$@"
