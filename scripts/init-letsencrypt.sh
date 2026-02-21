#!/bin/bash

# init-letsencrypt.sh — One-time SSL certificate setup for VLPRS
# Usage: ssh to Droplet → cd /opt/vlprs → chmod +x scripts/init-letsencrypt.sh → ./scripts/init-letsencrypt.sh

set -e

DOMAIN="oyocarloan.com.ng"
EMAIL="admin@oyocarloan.com.ng"  # Change to your actual email
DATA_PATH="./certbot"
RSA_KEY_SIZE=4096
STAGING=0  # Set to 1 to test against Let's Encrypt staging (avoids rate limits)

if [ -d "$DATA_PATH/conf/live/$DOMAIN" ]; then
  echo "Existing certificates found for $DOMAIN."
  read -p "Replace existing certificates? (y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    exit
  fi
fi

echo "### Creating directories..."
mkdir -p "$DATA_PATH/conf"
mkdir -p "$DATA_PATH/www"

echo "### Downloading recommended TLS parameters..."
if [ ! -e "$DATA_PATH/conf/options-ssl-nginx.conf" ]; then
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$DATA_PATH/conf/options-ssl-nginx.conf"
fi
if [ ! -e "$DATA_PATH/conf/ssl-dhparams.pem" ]; then
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$DATA_PATH/conf/ssl-dhparams.pem"
fi

echo "### Creating dummy certificate for $DOMAIN..."
CERT_PATH="/etc/letsencrypt/live/$DOMAIN"
mkdir -p "$DATA_PATH/conf/live/$DOMAIN"
openssl req -x509 -nodes -newkey rsa:$RSA_KEY_SIZE -days 1 \
  -keyout "$DATA_PATH/conf/live/$DOMAIN/privkey.pem" \
  -out "$DATA_PATH/conf/live/$DOMAIN/fullchain.pem" \
  -subj "/CN=localhost"

echo "### Starting nginx with dummy certificate..."
docker compose -f compose.prod.yaml up -d client

echo "### Waiting for nginx to start..."
sleep 5

echo "### Deleting dummy certificate..."
rm -rf "$DATA_PATH/conf/live/$DOMAIN"

echo "### Requesting Let's Encrypt certificate for $DOMAIN..."

if [ $STAGING != "0" ]; then STAGING_ARG="--staging"; fi

docker compose -f compose.prod.yaml run --rm --entrypoint "certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d $DOMAIN \
  --email $EMAIL \
  --agree-tos \
  --no-eff-email \
  --force-renewal \
  $STAGING_ARG" certbot

echo "### Reloading nginx with real certificate..."
docker compose -f compose.prod.yaml exec client nginx -s reload

echo ""
echo "### SSL setup complete!"
echo "### Your site should now be accessible at https://$DOMAIN"
echo ""
echo "### Certificate auto-renewal is handled by the certbot service."
echo "### To test renewal: docker compose -f compose.prod.yaml run --rm certbot renew --dry-run"
