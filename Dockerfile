FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add openssl
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate
COPY . .
RUN npm run build


FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add openssl
ENV NODE_ENV=production
ENV PORT=3000
USER node
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/package*.json ./
EXPOSE 3000
CMD ["node", "dist/server.js"]