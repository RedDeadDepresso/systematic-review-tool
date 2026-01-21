FROM nginx:1.29.4-alpine

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Copy the entrypoint script
COPY boot.sh /home/docker/scripts/boot.sh

# Normalize line endings in the boot script (if copied from a Windows environment)
# Make the boot script executable
RUN sed -i 's/\r$//' /home/docker/scripts/boot.sh  && \
    chmod +x /home/docker/scripts/boot.sh

# Use the entrypoint script
ENTRYPOINT /home/docker/scripts/boot.sh
