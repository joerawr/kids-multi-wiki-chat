# Update Container Image and Deploy

This guide documents the complete process for updating the containerized Knowledge Quest application with changes from the main branch.

**Note**: The `containerize` branch is a long-lived branch specifically for home lab deployment. It will never merge back to `main` but regularly pulls in changes from `main` to stay up to date.

## Prerequisites

- Docker installed and running
- kubectl configured with access to your Kubernetes cluster
- GitHub CLI (`gh`) installed and authenticated, OR Docker logged into GHCR
- Current branch: `containerize` (long-lived home lab branch)

## Environment Setup

**⚠️ IMPORTANT - Architecture Check:**
```bash
# Check your current architecture
echo "Current architecture: $(uname -m)"
if [[ "$(uname -m)" != "x86_64" && "$(uname -m)" != "amd64" ]]; then
    echo "❌ WARNING: You are NOT on x86-64 architecture!"
    echo "   Current: $(uname -m)"
    echo "   Required: x86_64/amd64 for K8s compatibility"
    echo ""
    echo "🔄 REQUIRED ACTION:"
    echo "   Switch to an x86-64 server before building Docker images"
    echo "   (K8s cluster runs on x86-64 - image must match)"
    echo ""
    echo "   Press Ctrl+C to stop, or any key to continue anyway..."
    read -n 1 -s
else
    echo "✅ Good: Running on x86-64 architecture ($(uname -m))"
fi
```

Ensure these environment variables are set or substitute them in the commands:

```bash
export GITHUB_USERNAME="joerawr"
export IMAGE_NAME="kids-multi-wiki-chat"
export IMAGE_TAG="latest"  # Or use version tags like "v1.2.0"
```

## Step-by-Step Process

### 1. Pull Changes from Main Branch

The `containerize` branch is a long-lived home lab branch that stays up to date with `main` but never merges back:

```bash
# Ensure you're on the containerize branch
git checkout containerize

# Fetch the latest changes from remote
git fetch origin

# Merge changes from main into containerize (one-way only)
git merge origin/main

# If there are conflicts, resolve them and commit:
# git add .
# git commit -m "merge: pull latest changes from main for home lab deployment"

# Push the updated containerize branch (home lab deployment branch)
git push origin containerize
```

### 2. Build Docker Image

Build the Docker image with the updated code:

```bash
# Build the image (this will use the Dockerfile in the project root)
docker build -t ghcr.io/${GITHUB_USERNAME}/${IMAGE_NAME}:${IMAGE_TAG} .

# Optional: Tag with a specific version
# docker tag ghcr.io/${GITHUB_USERNAME}/${IMAGE_NAME}:latest ghcr.io/${GITHUB_USERNAME}/${IMAGE_NAME}:v1.2.0
```

### 3. Push to GitHub Container Registry (GHCR)

```bash
# Push the image
docker push ghcr.io/${GITHUB_USERNAME}/${IMAGE_NAME}:${IMAGE_TAG}
```

### 4. Update Kubernetes Deployment

#### Option A: Restart Deployment (if using :latest tag)
```bash
# Restart the deployment to pull the new image
kubectl rollout restart deployment/wiki-chat -n knowledge-quest

# Wait for rollout to complete
kubectl rollout status deployment/wiki-chat -n knowledge-quest
```

#### Option B: Update Image Tag (if using version tags)
```bash
# Update the deployment with the new image tag
kubectl set image deployment/wiki-chat -n knowledge-quest=ghcr.io/${GITHUB_USERNAME}/${IMAGE_NAME}:v1.2.0 -n default

# Wait for rollout to complete
kubectl rollout status deployment/wiki-chat -n knowledge-quest
```

### 5. Verify Deployment

Check that the application is running with the updated code:

```bash
# Check pod status
kubectl get pods -n knowledge-quest

# Check deployment status
kubectl get deployment wiki-chat -n knowledge-quest

# View recent logs
PODNAME=$(kubectl get pods -n knowledge-quest -o jsonpath='{.items[0].metadata.name}')
kubectl logs $PODNAME -n knowledge-quest --tail=50

# Check if the service is accessible
kubectl get service wiki-chat-service -n knowledge-quest

```

## Troubleshooting

### Common Issues and Solutions

#### Image Pull Errors
```bash
# Check if the image exists in GHCR
docker pull ghcr.io/${GITHUB_USERNAME}/${IMAGE_NAME}:${IMAGE_TAG}

# Verify GHCR authentication
docker login ghcr.io

# Check Kubernetes secret for image pulling (if using private registry)
kubectl get secret regcred -n default -o yaml
```

#### Pod Startup Issues
```bash
# Describe pod to see detailed error messages
kubectl describe pod -l app=kids-multi-wiki-chat -n default

# Check pod logs for application errors
kubectl logs -l app=kids-multi-wiki-chat -n default --previous

# Check resource constraints
kubectl top pod -l app=kids-multi-wiki-chat -n default
```

#### Deployment Rollback
If the new version has issues, rollback to the previous version:

```bash
# Rollback to previous deployment
kubectl rollout undo deployment/kids-multi-wiki-chat -n default

# Check rollout status
kubectl rollout status deployment/kids-multi-wiki-chat -n default
```

### Health Checks

Verify the application is working correctly:

```bash
# If using a LoadBalancer or NodePort service
kubectl get service kids-multi-wiki-chat -n default

# Port forward to test locally
kubectl port-forward service/kids-multi-wiki-chat 3000:3000 -n default &

# Test the application (in another terminal)
curl http://localhost:3000
curl http://localhost:3000/api/health  # if health endpoint exists

# Kill port-forward when done
pkill -f "kubectl port-forward"
```

## Quick Reference Commands

```bash
# IMPORTANT: Run architecture check FIRST!
echo "Current architecture: $(uname -m)"
[[ "$(uname -m)" == "aarch64" || "$(uname -m)" == "arm64" ]] || echo "⚠️  Switch to ARM64 server before building!"

# Complete update workflow for home lab deployment
git checkout containerize
git fetch origin
git merge origin/main  # One-way merge: main -> containerize (never the reverse)
git push origin containerize
docker build -t ghcr.io/${GITHUB_USERNAME}/${IMAGE_NAME}:latest .
docker push ghcr.io/${GITHUB_USERNAME}/${IMAGE_NAME}:latest
kubectl rollout restart deployment/kids-multi-wiki-chat -n default
kubectl rollout status deployment/kids-multi-wiki-chat -n default
```

## Notes

- **Branch Strategy**: `containerize` is a long-lived home lab branch that only receives changes from `main`, never merges back
- Always test the Docker image locally before pushing to production
- Consider using semantic versioning for image tags instead of `:latest`
- Monitor the application logs after deployment to ensure everything is working
- Keep environment variables and secrets up to date in Kubernetes
- This workflow is specifically designed for home lab deployment, not production CI/CD

## Security Considerations

- Ensure GITHUB_TOKEN or PAT has appropriate permissions for GHCR
- Use Kubernetes secrets for sensitive environment variables
- Regularly update base images for security patches
- Scan images for vulnerabilities before deployment