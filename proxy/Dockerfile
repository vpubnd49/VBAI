# Build stage for backend proxy
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY server.js ./
COPY lib ./lib
COPY bosung_metadata.json ./

# Production stage (run directly)
FROM node:20-alpine
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/server.js ./
COPY --from=build /app/lib ./lib
COPY --from=build /app/bosung_metadata.json ./

# Use dumb-init to handle signals correctly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
