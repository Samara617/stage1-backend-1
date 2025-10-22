FROM node:20-bookworm-slim
WORKDIR /app

# Prisma engine depends on OpenSSL in Debian
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy lockfile and Prisma schema BEFORE install (postinstall runs prisma generate)
COPY package*.json ./
COPY prisma ./prisma

# Install deps (runs "postinstall": "prisma generate")
RUN npm ci

# Copy application source
COPY src ./src

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Push schema on boot, then start
CMD ["sh", "-c", "npm run prisma:push && npm run start"]
