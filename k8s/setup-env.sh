#!/bin/bash

# Environment variables for k8s SSL setup
# Copy this file to setup-env.local.sh and replace with your actual values

export EMAIL="your-email@example.com"
export DOMAIN="your-domain.com"

echo "Environment variables set:"
echo "EMAIL: $EMAIL"
echo "DOMAIN: $DOMAIN"
echo ""
echo "IMPORTANT: Copy this file to setup-env.local.sh and update with your actual values!"
echo ""
echo "Then you can run:"
echo "  source k8s/setup-env.local.sh"
echo "  cat k8s/letsencrypt-prod.yaml | envsubst | kubectl apply -f -"
echo "  cat k8s/traefik-https-redirect-middleware.yaml | envsubst | kubectl apply -f -"
echo "  cat k8s/whoami/whoami-ingress-tls.yaml | envsubst | kubectl apply -f -"