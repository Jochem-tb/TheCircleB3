# ingest-server/Dockerfile
FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

# ffmpeg needed for encoding
RUN apt-get update && apt-get install -y ffmpeg

COPY . .

RUN mkdir -p recordings

EXPOSE 1935 8000 8090 
CMD ["node", "src/server.js"]
