# One Dockerfile, two targets. `dev`: the toolchain, dependencies and source, for Compose (the source is
# mounted over /app, `nest start --watch` rebuilds on change) and for CI (the gate runs in it). The last
# stage is the production image: the compiled app with production dependencies only, as the node user.
# The dev stage uses the full image: `nest start --watch` stops the old server with `ps`, which the slim
# image lacks (the old process then keeps the port: EADDRINUSE on every reload).
FROM node:24-bookworm AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY . .
EXPOSE 8080
CMD ["npm", "run", "start:dev"]

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
COPY migrate-mongo-config.js ./
COPY migrations ./migrations
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
# Migrations run from this image as their own step: npx migrate-mongo up
COPY --from=build --chown=node:node /app/migrate-mongo-config.js ./
COPY --from=build --chown=node:node /app/migrations ./migrations
USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]
