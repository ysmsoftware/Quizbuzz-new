# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts

RUN npm ci
RUN npx prisma generate

# Copy the rest of source and compile TypeScript
COPY . .
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Only install production dependencies
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts

RUN npm ci --omit=dev
RUN npx prisma generate

# Copy compiled output + prisma schema + generated client from builder
COPY --from=builder /app/dist ./dist

# Persistent storage for local file uploads
VOLUME ["/app/storage"]

EXPOSE 3005

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]