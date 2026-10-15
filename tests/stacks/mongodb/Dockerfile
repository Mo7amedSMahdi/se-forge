# The dev target only: this sample is the database layer (repository and migrate-mongo migrations) that a
# Node backend embeds; the backend's Dockerfile adds the server and the production image (stack-nestjs).
# For Compose (the source is mounted over /app) and for CI (the gate runs in it).
FROM node:24-bookworm AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY . .
CMD ["sleep", "infinity"]
