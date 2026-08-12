FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG GIT_SHA
ARG SOURCE_TREE_HASH
ARG SOURCE_TREE_DIRTY=false
ARG REQUIRE_CLEAN_BUILD=true
ENV GIT_SHA=${GIT_SHA} \
    SOURCE_TREE_HASH=${SOURCE_TREE_HASH} \
    SOURCE_TREE_DIRTY=${SOURCE_TREE_DIRTY} \
    REQUIRE_CLEAN_BUILD=${REQUIRE_CLEAN_BUILD} \
    APP_ENV=production \
    NODE_ENV=production

RUN npm run build

FROM nginx:alpine
RUN apk add --no-cache gettext
COPY --from=build /app/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/config.template
COPY runtime-config.template.js /etc/vbai/runtime-config.template.js
COPY docker-entrypoint.sh /usr/local/bin/vbai-entrypoint

RUN sed -i 's/\r$//' /usr/local/bin/vbai-entrypoint \
    && chmod +x /usr/local/bin/vbai-entrypoint

CMD ["/usr/local/bin/vbai-entrypoint"]
