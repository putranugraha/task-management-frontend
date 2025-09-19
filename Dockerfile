# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

WORKDIR /app

ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0

RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm install

COPY . .
RUN chown -R node:node /app

USER node

EXPOSE 3000

CMD ["npm", "run", "dev"]
