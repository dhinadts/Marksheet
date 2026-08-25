FROM node:20-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
# Cap the build heap so V8 garbage-collects earlier instead of growing past
# physical RAM on small deploy hosts, which otherwise thrashes swap or gets
# OOM-killed mid-build.
ENV NODE_OPTIONS=--max-old-space-size=512
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate && npm run build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY package.json package-lock.json ./
COPY docker-entrypoint.sh ./docker-entrypoint.sh
EXPOSE 3001
USER node
CMD ["sh", "docker-entrypoint.sh"]
