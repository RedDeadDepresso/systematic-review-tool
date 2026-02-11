# Stage 1: Get the React dist files
FROM ghcr.io/2739548r/slrt-react:latest AS react-dist

# Stage 2: Build the final nginx image
FROM nginx:1.29.4-alpine

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Copy the React dist files from the react image
COPY --from=react-dist /dist /usr/share/nginx/html

# Copy the entrypoint script
COPY boot.sh /home/docker/scripts/boot.sh

# Normalize line endings and make the boot script executable
RUN sed -i 's/\r$//' /home/docker/scripts/boot.sh && \
    chmod +x /home/docker/scripts/boot.sh

# Use the entrypoint script
ENTRYPOINT ["/home/docker/scripts/boot.sh"]