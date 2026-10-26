# O serviço do WhatsApp da equipe (ver src/main.ts). Só sai para a internet: não expõe porta.
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY src ./src
USER node
CMD ["node", "src/main.ts"]
