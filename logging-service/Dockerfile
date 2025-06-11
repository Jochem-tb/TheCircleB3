# Use official Node.js runtime image
FROM node:20

# Set working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json if you have them
# (If you don't have a package.json, just copy your code)
COPY package*.json ./

# Install dependencies (if you have any)
RUN npm install

# Copy the rest of your app's source code
COPY . .

# Expose the port your app listens on
EXPOSE 3000

# Start the app
CMD ["node", "index.js"]
