FROM node:20

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

RUN mkdir -p recordings

EXPOSE 8090
CMD ["npm", "start"]
