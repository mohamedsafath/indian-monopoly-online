# Step 1: Build stage
FROM node:20-alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .
# Run production build
RUN npm run build

# Step 2: Serve stage
FROM nginx:alpine

# Copy built assets from build stage to Nginx web root
COPY --from=build /usr/src/app/dist /usr/share/nginx/html

# Copy custom nginx config to handle client-side routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
