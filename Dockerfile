# Dockerfile (fixed)
FROM node:20-bookworm-slim
WORKDIR /app

# 1) Prisma needs OpenSSL in Debian images
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# 2) Copy lockfile + schema BEFORE npm ci so postinstall can see it
COPY package*.json ./
COPY prisma ./prisma

# 3) Install deps (postinstall runs `prisma generate`)
RUN npm ci

# 4) Now copy the rest of the source
COPY src ./src

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# 5) Push schema at runtime, then start
CMD ["sh", "-c", "npm run prisma:push && npm run start"]
