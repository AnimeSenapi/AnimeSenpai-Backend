# Multi-stage build for AnimeSenpai Backend
FROM oven/bun:1.0.0-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    postgresql-client \
    curl \
    tini

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Development stage
FROM base AS development
RUN bun install --frozen-lockfile
COPY . .
EXPOSE 3004
CMD ["bun", "run", "dev"]

# Build stage
FROM base AS builder
COPY . .
RUN bun run build

# Production stage
FROM oven/bun:1.0.0-alpine AS production

# Install system dependencies
RUN apk add --no-cache \
    postgresql-client \
    curl \
    tini \
    dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S animesenpai -u 1001

# Set working directory
WORKDIR /app

# Copy package files and install production dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Copy scripts
COPY scripts/ ./scripts/

# Set ownership
RUN chown -R animesenpai:nodejs /app
USER animesenpai

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3004/api/health || exit 1

# Expose port
EXPOSE 3004

# Use tini as init system
ENTRYPOINT ["tini", "--"]

# Start the application
CMD ["bun", "run", "start"]
