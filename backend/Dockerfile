# Use official Node.js LTS light image
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm install --omit=dev --no-audit --no-fund

# Copy application source code
COPY . .

# Set Environment variables defaults (can be overridden at runtime)
ENV PORT=5001
ENV NODE_ENV=production

# Expose port
EXPOSE 5001

# Command to run the application
CMD ["node", "server.js"]
