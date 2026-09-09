# Web app Dockerfile for FairPass
# Multi-stage build for optimal production image

# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

# Copy workspace manifest files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/api/package.json ./packages/api/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/evals/package.json ./packages/evals/
COPY packages/mcp-server/package.json ./packages/mcp-server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules

# Copy source code
COPY . .

# Build shared package first
RUN pnpm -F @fairpass/api build

# Build web app
RUN pnpm -F @fairpass/web build

# Stage 3: Production
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install pnpm
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

# Copy built application
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

# Copy package.json for the web app
COPY --from=builder /app/apps/web/package.json ./apps/web/

# Set working directory to web app
WORKDIR /app/apps/web

# Railway sets PORT env var; Next.js standalone respects it
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["node", "server.js"]
