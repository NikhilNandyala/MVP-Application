#!/bin/bash

echo "Running post-deployment script..."

# Navigate to the app directory
cd /home/site/wwwroot

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the Next.js application
echo "Building Next.js application..."
npm run build

echo "Post-deployment script completed."
