# Universal Dockerfile (Root Level)
# This file is used if your hosting provider (like Back4App) looks for a Dockerfile in the root folder instead of the backend folder.

FROM node:22-slim

# Create and change to the app directory
WORKDIR /usr/src/app/backend

# Copy application dependency manifests to the container image
COPY backend/package*.json ./

# Install production dependencies
RUN npm install

# Copy local code to the container image
COPY backend/ ./

# Build the TypeScript code
RUN npm run build

# Run the web service on container startup
CMD [ "npm", "start" ]
