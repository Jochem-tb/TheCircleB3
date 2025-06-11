# ingest-server/Dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --production

COPY . .
# ensure recordings folder exists
RUN mkdir -p recordings

EXPOSE 4000

CMD ["node", "index.js"]
