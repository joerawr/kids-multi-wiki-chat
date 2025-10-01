# CLAUDE_K8S.md

This file contains specific instructions for Claude Code when working with the **containerize branch** for Docker and Kubernetes deployment.

## Branch Context

You are working on the `containerize` branch, which is the **production deployment branch**. This branch:
- Contains Docker and Kubernetes configurations
- Is built into container images and deployed to production
- Should NOT be merged back to `main`
- Receives merges FROM `main` to incorporate new features

## Critical Pre-Build Step

**ALWAYS run `get_version.sh` before building any Docker images:**

```bash
./get_version.sh
```

This script:
- Authenticates to GitHub Container Registry (GHCR)
- Retrieves the current list of container versions
- Displays the latest semantic version

Use this information to properly increment the version number for your new build.

## Version Numbering

Follow semantic versioning (MAJOR.MINOR.PATCH):
- **MAJOR** (x.0.0): Breaking changes, API changes, major rewrites
- **MINOR** (x.y.0): New features that are backward compatible
- **PATCH** (x.y.z): Bug fixes and small improvements

Current version format: `v1.1.4`

## Kubernetes Deployment

### Current Configuration

- **Namespace**: `knowledge-quest`
- **Deployment**: `wiki-chat`
- **Image**: `ghcr.io/joerawr/kids-multi-wiki-chat:latest`
- **Registry**: GitHub Container Registry (GHCR)

### Image Tag Strategy

The Kubernetes deployment uses the `:latest` tag, which is updated with each deployment:
1. Build image with semantic version: `v1.x.x`
2. Tag same image as `:latest`
3. Push both tags to GHCR
4. Kubernetes automatically pulls new `:latest` on rollout restart

### Deployment Commands

```bash
# Check current deployment version
kubectl get deployment wiki-chat -n knowledge-quest -o jsonpath='{.spec.template.spec.containers[0].image}'

# Check running pod image
kubectl get pods -n knowledge-quest
kubectl describe pod <pod-name> -n knowledge-quest | grep "Image:"

# Update deployment image (if needed)
kubectl set image deployment/wiki-chat wiki-chat=ghcr.io/joerawr/kids-multi-wiki-chat:latest -n knowledge-quest

# Restart deployment to pull new image
kubectl rollout restart deployment/wiki-chat -n knowledge-quest

# Monitor rollout status
kubectl rollout status deployment/wiki-chat -n knowledge-quest

# Check pod logs
kubectl logs -f <pod-name> -n knowledge-quest

# Check for errors in logs
kubectl logs <pod-name> -n knowledge-quest | grep -i "error\|fail"
```

## Docker Build Requirements

### Architecture
- **Required**: x86_64/amd64
- **Why**: Kubernetes cluster runs on x86_64 architecture
- The Dockerfile includes an architecture safety check that will fail if built on ARM/M1

### Turbopack Compatibility
- **Local development** (`main` branch): Uses `--turbopack` flag for fast development
- **Container builds** (`containerize` branch): Removes `--turbopack` flag due to Linux build issues
- This intentional difference prevents Docker build failures on Linux

### Build Process

```bash
# ALWAYS check version first
./get_version.sh

# Build with semantic version tag
docker build -t ghcr.io/joerawr/kids-multi-wiki-chat:v1.x.x .

# Tag as latest
docker tag ghcr.io/joerawr/kids-multi-wiki-chat:v1.x.x ghcr.io/joerawr/kids-multi-wiki-chat:latest

# Test the image
./test-docker-image.sh v1.x.x

# Push both tags
docker push ghcr.io/joerawr/kids-multi-wiki-chat:v1.x.x
docker push ghcr.io/joerawr/kids-multi-wiki-chat:latest
```

## Automated Deployment

The preferred method is using the automated deployment script:

```bash
# ALWAYS check version first
./get_version.sh

# Deploy with automated workflow (builds, tests, pushes, deploys)
./deploy-image.sh v1.x.x

# Rollback if needed
./deploy-image.sh --rollback
```

The script handles:
- Docker image building (with version and latest tags)
- Comprehensive testing (8 automated tests)
- Pushing to GHCR
- Optional Kubernetes deployment

## Container User and Permissions

### User Configuration
- **User**: `node` (built-in to base image)
- **UID**: 1000
- **Group**: `node`
- **GID**: 1000

### Critical Permissions
The Dockerfile ensures proper ownership of:
- `/app` directory (entire application)
- `/app/.next/cache/images` (Next.js image cache)

**Why this matters**: Next.js image optimization requires write access to the cache directory. The container runs as non-root user `node` for security.

### Permission Issues
If you see errors like:
```
EACCES: permission denied, mkdir '/app/.next/cache/images/...'
```

Check:
1. Dockerfile ownership commands: `chown -R node:node /app`
2. User specification: `USER node`
3. Pod security context in Kubernetes

## Environment Variables

### Required Secrets (Kubernetes)

The deployment requires a secret named `wiki-chat-secrets` in the `knowledge-quest` namespace:

```bash
# Create or update secrets
kubectl create secret generic wiki-chat-secrets \
  --from-literal=google-generative-ai-api-key="your-key" \
  --from-literal=openai-api-key="your-key" \
  -n knowledge-quest \
  --dry-run=client -o yaml | kubectl apply -f -

# Verify secrets
kubectl get secret wiki-chat-secrets -n knowledge-quest
```

### Registry Access

GHCR authentication requires `ghcr-credentials` secret:

```bash
kubectl create secret docker-registry ghcr-credentials \
  --docker-server=ghcr.io \
  --docker-username=joerawr \
  --docker-password=$GH_PACKAGE_READ \
  -n knowledge-quest
```

## Testing

### Local Container Testing

```bash
# Test specific version
./test-docker-image.sh v1.x.x

# Tests include:
# - Image exists
# - Container startup
# - Health check endpoint
# - Homepage loading
# - Locked model configuration
# - MCP server switching
# - MCP server error handling
# - Container logs for errors
```

### Production Verification

After deployment:
1. Check pod status: `kubectl get pods -n knowledge-quest`
2. Verify image: `kubectl describe pod <pod-name> -n knowledge-quest | grep "Image ID"`
3. Check logs: `kubectl logs -f <pod-name> -n knowledge-quest`
4. Test health endpoint: Access via ingress
5. Verify no permission errors in logs

## Health Checks

### Container Health Check
- **Endpoint**: `http://localhost:3000/api/health`
- **Interval**: 30s
- **Timeout**: 3s
- **Start Period**: 5s
- **Retries**: 3

### Kubernetes Readiness/Liveness
Configured in `k8s/deployment.yaml` to use the same health endpoint.

## Common Issues

### Image Not Updating
**Problem**: Kubernetes pulls old image even after pushing new `:latest`

**Solution**:
```bash
# Force pull by restarting deployment
kubectl rollout restart deployment/wiki-chat -n knowledge-quest

# Verify new image ID
kubectl describe pod <pod-name> -n knowledge-quest | grep "Image ID"
```

### Permission Denied Errors
**Problem**: EACCES errors for `/app/.next/cache/images/`

**Solution**: Verify Dockerfile has:
```dockerfile
RUN mkdir -p /app/.next/cache/images && \
    chown -R node:node /app
USER node
```

### Build Failures on Linux
**Problem**: Turbopack causes build failures in Docker

**Solution**: Already fixed in `containerize` branch - `package.json` scripts don't use `--turbopack` flag

### UID Conflicts
**Problem**: `useradd: UID 1000 is not unique`

**Solution**: Use existing `node` user instead of creating new user

## File Locations

### Container-Specific Files
- `Dockerfile` - Multi-stage build configuration
- `docker-compose.yml` - Local container testing
- `.dockerignore` - Build exclusions
- `get_version.sh` - Version retrieval script
- `deploy-image.sh` - Automated deployment workflow
- `test-docker-image.sh` - Comprehensive test suite

### Kubernetes Manifests
- `k8s/deployment.yaml` - Main deployment configuration
- `k8s/service.yaml` - ClusterIP service
- `k8s/ingress.yaml` - Traefik ingress with TLS
- `k8s/secret.yaml` - Secret template (not committed)

## Workflow Summary

### Standard Deployment Process

1. **Check current version**:
   ```bash
   ./get_version.sh
   ```

2. **Merge from main** (if needed):
   ```bash
   git checkout containerize
   git merge main
   # Resolve any conflicts
   git commit
   ```

3. **Deploy new version**:
   ```bash
   ./deploy-image.sh v1.x.x
   ```

4. **Verify deployment**:
   ```bash
   kubectl get pods -n knowledge-quest
   kubectl logs -f <pod-name> -n knowledge-quest
   ```

5. **Commit and push**:
   ```bash
   git add <changed-files>
   git commit -m "your message"
   git push
   ```

### Emergency Rollback

```bash
# Quick rollback to previous version
./deploy-image.sh --rollback

# Or manual rollback
kubectl rollout undo deployment/wiki-chat -n knowledge-quest
```

## Important Reminders

1. **ALWAYS** run `./get_version.sh` before building images
2. **NEVER** merge `containerize` back to `main`
3. **ALWAYS** test images locally before pushing to production
4. **VERIFY** deployment in production logs before closing issues
5. **CHECK** architecture is x86_64 before building Docker images
6. Use semantic versioning for all releases
7. Update deployment documentation when making infrastructure changes
