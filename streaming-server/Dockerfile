# streaming-server/Dockerfile
FROM alfg/nginx-rtmp:latest

# Copy your custom nginx.conf
COPY nginx.conf /etc/nginx/nginx.conf

# Create data dirs for HLS + recordings
RUN mkdir -p /var/www/hls /var/www/recordings

VOLUME [ "/var/www/hls", "/var/www/recordings" ]

EXPOSE 1935 80

