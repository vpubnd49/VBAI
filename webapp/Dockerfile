FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/config.template
COPY runtime-config.template.js /etc/vbai/runtime-config.template.js
COPY docker-entrypoint.sh /usr/local/bin/vbai-entrypoint

RUN sed -i 's/\r$//' /usr/local/bin/vbai-entrypoint \
    && chmod +x /usr/local/bin/vbai-entrypoint

CMD ["/usr/local/bin/vbai-entrypoint"]
