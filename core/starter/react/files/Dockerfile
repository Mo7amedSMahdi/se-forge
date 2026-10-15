# One Dockerfile, two targets. `dev`: Node, the browsers Playwright needs, dependencies and source, for
# Compose (the source is mounted over /app; Vite's dev server reloads on change) and for CI (the gate and
# the end-to-end tests run in it). The last stage is the production image: the static app built, served
# by Caddy as an unprivileged user; Caddy also proxies /v1 to the API.
FROM mcr.microsoft.com/playwright:v1.63.0-noble AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY . .
EXPOSE 5173
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY . .
RUN npm run build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
ENV XDG_CONFIG_HOME=/tmp/caddy XDG_DATA_HOME=/tmp/caddy
USER 65534
EXPOSE 8080
