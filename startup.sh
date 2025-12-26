#!/bin/bash

# Install dependencies if not present
if [ ! -d "node_modules" ]; then
  npm install --production=false
fi

# Build the Next.js app
npm run build

# Start the application
npm run start
