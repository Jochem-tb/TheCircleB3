# Use Node 18 for better native module compatibility (Node 20 can break mediasoup)
FROM node:18

# Install Python 3, pip, ffmpeg, and build tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install dependencies
COPY package*.json ./
RUN npm install

# Copy rest of the code
COPY . .

# Ensure recordings directory exists
RUN mkdir -p recordings

# Expose necessary ports
EXPOSE 1935 8000 8090

# Start the server
CMD ["node", "src/server.js"]
