# Dockerfile
FROM node:20-alpine

# Needed by Prisma engines & OpenSSL
RUN apk add --no-cache openssl

WORKDIR /app

# Install deps first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy the rest (including prisma/)
COPY . .

# Build Prisma client ahead of time (no-op if not using Prisma)
RUN npm run prisma:generate || true

# Default envs; the real values come from runtime
ENV PORT=8080
EXPOSE 8080

# If you use SQLite (Mode A) we’ll run prisma:push at start via compose or override
CMD ["npm","start"]
