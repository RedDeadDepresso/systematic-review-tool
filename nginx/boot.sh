#!/bin/sh

# Directory where Certbot stores the certificates
CERTBOT_DIR="/etc/letsencrypt/live/$SITE_DOMAIN"

# Function to check if the domain has a valid certificate
check_ssl_authorized() {
    # Check if the Certbot directory exists and contains the cert.pem file
    if [ -f "$CERTBOT_DIR/cert.pem" ]; then
        return 0  # Authorized if the cert.pem exists
    else
        return 1  # Not authorized if cert.pem doesn't exist
    fi
}

# Check if the domain is authorized (has a valid certificate)
if check_ssl_authorized; then
    # If authorized, substitute the SITE_DOMAIN in the default template and create default.conf
    echo "Domain authorized. Creating default.conf from https.template."
    envsubst '$SITE_DOMAIN' < /etc/nginx/conf.d/https.template > /etc/nginx/conf.d/default.conf
else
    # If not authorized, use start.conf as the configuration
    echo "Domain not authorized. Creating default.conf from http.template."
    envsubst '$SITE_DOMAIN' < /etc/nginx/conf.d/http.template > /etc/nginx/conf.d/default.conf
fi

# Start the Nginx service in the background
nginx -g 'daemon off;' &

# Infinite loop to reload Nginx every 6 hours
while :; do
    sleep 6h
    nginx -s reload
done
