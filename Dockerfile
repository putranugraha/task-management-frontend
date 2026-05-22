# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_USE_SANCTUM=0
ARG NEXT_PUBLIC_PROXY_API=0
ARG NEXT_PUBLIC_USE_SERVER_AUTH=0
ARG NEXT_PUBLIC_AUTO_LOGIN=false

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_USE_SANCTUM=$NEXT_PUBLIC_USE_SANCTUM \
    NEXT_PUBLIC_PROXY_API=$NEXT_PUBLIC_PROXY_API \
    NEXT_PUBLIC_USE_SERVER_AUTH=$NEXT_PUBLIC_USE_SERVER_AUTH \
    NEXT_PUBLIC_AUTO_LOGIN=$NEXT_PUBLIC_AUTO_LOGIN

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
