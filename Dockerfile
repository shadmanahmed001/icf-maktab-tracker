# Multi-stage Dockerfile for Maktab Tracker

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Runtime Server
FROM node:20-alpine
WORKDIR /app

# Install build dependencies for sqlite3 native binding if needed
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --omit=dev

COPY server/ ./server/
COPY --from=frontend-builder /app/client/dist ./client/dist

ENV PORT=3000
ENV NODE_ENV=production
ENV DB_PATH=/app/data/maktab.db

VOLUME /app/data
EXPOSE 3000

CMD ["node", "server/index.js"]
