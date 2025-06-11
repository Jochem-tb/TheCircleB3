# --- Build Stage ---
FROM node:20 AS builder

ARG APP_NAME
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build the specific Angular project
RUN npm run build -- --configuration production --project $APP_NAME

# --- Serve Stage ---
FROM nginx:alpine

ARG APP_NAME

# Remove default static files
RUN rm -rf /usr/share/nginx/html/*

# Copy built files from builder
COPY --from=builder /app/dist/${APP_NAME}/browser /usr/share/nginx/html

# Optional: use a custom Nginx config to support Angular routes
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
