# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:/tmp/lujie-build.db

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm \
  npm ci --prefer-offline --no-audit --fund=false

COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS production-deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci --omit=dev --ignore-scripts --prefer-offline --no-audit --fund=false

# Prisma Client is generated during the builder install. Production dependencies
# skip lifecycle scripts, so copy only the generated runtime into this clean tree.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

FROM node:20-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV DATABASE_URL=file:/data/dev.db

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data /runtime-config

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000

CMD ["node", "scripts/docker-runtime.mjs", "app"]
