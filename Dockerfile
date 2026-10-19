FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add openssl
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
# O schema real mora no repositório `database`; prisma/schema.ci.prisma é a cópia
# dele (a mesma que o CI atualiza). Sem o `output` local, o client vai para node_modules.
RUN sed '/^ *output *=/d' prisma/schema.ci.prisma > prisma/schema.docker.prisma \
 && npx prisma generate --schema=prisma/schema.docker.prisma
COPY . .
RUN npm run build


FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add openssl
ENV NODE_ENV=production
ENV PORT=3000
ENV UPLOAD_DIR=/app/uploads
# Imagens enviadas ficam em disco: monte um volume em /app/uploads para não perdê-las ao recriar o container.
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/package*.json ./
EXPOSE 3000
CMD ["node", "dist/server.js"]
