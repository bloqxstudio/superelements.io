# O serviço do WhatsApp da equipe (ver src/main.ts). Só sai para a internet: não expõe porta.
FROM node:24-slim
WORKDIR /app
# ffmpeg converte a mensagem de voz gravada na plataforma
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY src ./src
USER node
CMD ["node", "src/main.ts"]
