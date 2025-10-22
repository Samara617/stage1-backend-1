FROM node:20-alpine
WORKDIR /app


COPY package*.json ./
RUN npm ci


COPY prisma ./prisma
RUN npx prisma generate


COPY src ./src


ENV PORT=8080
EXPOSE 8080


CMD ["sh", "-c", "npm run prisma:push && npm start"]# Dockerfile for String Analyzer Service
