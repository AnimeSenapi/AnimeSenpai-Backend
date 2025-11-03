# Multi-stage Dockerfile for AnimeSenpai Backend
FROM oven/bun:1.2.23-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    curl \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY . .

# Generate Prisma client
RUN bun run db:generate

# Build the application
RUN bun run build

# Production stage
FROM oven/bun:1.2.23-alpine AS production

# Install system dependencies
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    curl \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bunuser -u 1001

# Set working directory
WORKDIR /app

# Copy built application from base stage
COPY --from=base --chown=bunuser:nodejs /app/dist ./dist
COPY --from=base --chown=bunuser:nodejs /app/node_modules ./node_modules
COPY --from=base --chown=bunuser:nodejs /app/package.json ./package.json
COPY --from=base --chown=bunuser:nodejs /app/prisma ./prisma

# Create necessary directories
RUN mkdir -p /app/logs /app/tmp && \
    chown -R bunuser:nodejs /app

# Switch to non-root user
USER bunuser

# Expose port
EXPOSE 3005

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3005/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3005
ENV BUN_ENV=production

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["bun", "run", "dist/index.js"]