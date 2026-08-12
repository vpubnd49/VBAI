# Build stage for backend proxy
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --omit=optional

# Copy modular runtime directories and entrypoints
COPY server.js ./
COPY bosung_metadata.json ./
COPY controllers ./controllers
COPY legal ./legal
COPY lib ./lib
COPY middleware ./middleware
COPY models ./models
COPY prompts ./prompts
COPY repositories ./repositories
COPY routers ./routers
COPY routes ./routes
COPY schemas ./schemas
COPY services ./services
COPY utils ./utils

# Production stage (run directly)
FROM node:24-alpine
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/server.js ./
COPY --from=build /app/bosung_metadata.json ./
COPY --from=build /app/controllers ./controllers
COPY --from=build /app/legal ./legal
COPY --from=build /app/lib ./lib
COPY --from=build /app/middleware ./middleware
COPY --from=build /app/models ./models
COPY --from=build /app/prompts ./prompts
COPY --from=build /app/repositories ./repositories
COPY --from=build /app/routers ./routers
COPY --from=build /app/routes ./routes
COPY --from=build /app/schemas ./schemas
COPY --from=build /app/services ./services
COPY --from=build /app/utils ./utils

# Use dumb-init to handle signals correctly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
