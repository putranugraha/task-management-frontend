# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

WORKDIR /app

ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0

RUN apk add --no-cache libc6-compat

# Optional: allow skipping install at build (useful when mounting source with HMR)
ARG SKIP_INSTALL=false

COPY package*.json ./

# Tweak npm to be more resilient in CI/build environments
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-factor 2 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fund false \
 && npm config set audit false \
 && npm config set progress false \
 && npm config set prefer-offline true

RUN if [ "$SKIP_INSTALL" = "true" ]; then \
      echo "Skipping npm install at build time"; \
    else \
      npm install; \
    fi

COPY . .
RUN chown -R node:node /app

USER node

EXPOSE 3000

CMD ["npm", "run", "dev"]
