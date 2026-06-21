# ============================================================
# Stage 1: Build the React app
# ============================================================
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy source code and build
COPY . .
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
RUN npm run build

# ============================================================
# Stage 2: Serve the built app with nginx (production)
# ============================================================
FROM nginx:alpine

# Copy built files from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Ship config as a template; envsubst materialises BACKEND_URL at container start.
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# Default backend URL matches the docker-compose service name.
ENV BACKEND_URL=http://backend:8001

EXPOSE 3001

CMD ["/bin/sh", "-c", \
  "envsubst '${BACKEND_URL}' < /etc/nginx/conf.d/default.conf.template \
   > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
