# GeoAlert — AWS EC2 + GoDaddy Deployment Guide

---

## Phase 1: AWS Setup

### 1.1 Launch an EC2 Instance
1. Go to **AWS Console → EC2 → Launch Instance**
2. Choose **Ubuntu 24.04 LTS** (free tier eligible)
3. Instance type: **t3.medium** minimum (your stack runs Postgres + Redis + RabbitMQ + API)
4. **Key pair**: Create a new one, download the `.pem` file — keep it safe, you can't recover it
5. **Security Group** — open these ports:
   | Port | Protocol | Source | Why |
   |------|----------|--------|-----|
   | 22 | TCP | Your IP only | SSH |
   | 80 | TCP | 0.0.0.0/0 | HTTP / Certbot |
   | 443 | TCP | 0.0.0.0/0 | HTTPS |
6. Storage: **20GB minimum** (your images + Postgres data are heavy)
7. Launch the instance

### 1.2 Attach an Elastic IP
Without this, your EC2's public IP changes every reboot — breaking DNS.

1. EC2 → **Elastic IPs → Allocate Elastic IP**
2. Once allocated, click **Actions → Associate Elastic IP**
3. Associate it with your new instance
4. Copy the IP — you'll need it in the next phase

---

## Phase 2: Point GoDaddy to AWS

1. Log into **GoDaddy → My Products → DNS** for `geoalert.xyz`
2. Add an **A Record**:
   - **Name**: `api`
   - **Value**: `[Your Elastic IP]`
   - **TTL**: `600`
3. Wait 10–15 minutes, then verify:
   ```bash
   ping api.geoalert.xyz
   # Should return your Elastic IP
   ```

---

## Phase 3: Prepare Your EC2 Instance

### 3.1 SSH In
```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@api.geoalert.xyz
```

### 3.2 Install Docker
```bash
# Update & install dependencies
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repo
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker + Compose plugin
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Allow your user to run Docker without sudo
sudo usermod -aG docker ubuntu
newgrp docker
```

### 3.3 Set Up Project Directory
```bash
mkdir -p ~/geoalert-backend
cd ~/geoalert-backend
```

---

## Phase 4: Project Structure on EC2

Your repo structure on the server needs to look like this:

```
geoalert-backend/
├── backend/                  ← your backend source (git clone)
│   ├── src/
│   ├── package.json
│   ├── envs/
│   │   └── .env.production
│   └── secrets/              ← secret files (NOT in git — you create these)
│       ├── postgres_user
│       ├── postgres_password
│       ├── postgres_db
│       ├── redis_password
│       ├── rabbitmq_user
│       ├── rabbitmq_password
│       ├── jwt_access_token_secret
│       ├── jwt_refresh_token_secret
│       ├── jwt_2fa_token_secret
│       ├── jwt_verify_token_secret
│       ├── two_factor_encryption_key
│       ├── smtp_user
│       ├── smtp_client_id
│       ├── smtp_client_secret
│       ├── smtp_refresh_token
│       └── at_api_key_dev
├── docker/                   ← your docker folder (from git)
│   ├── compose/
│   │   └── docker-compose.yml
│   ├── backend_api/
│   ├── postgres/
│   ├── rabbitmq/
│   └── frontend/
└── nginx/                    ← NEW — you create this
    └── nginx.conf
```

### 4.1 Clone Your Repo
```bash
cd ~/geoalert-backend
git clone https://github.com/your-org/geoalert.git .
```

### 4.2 Create Your Secret Files
These replace Docker Compose secrets. Each file contains only the secret value — no quotes, no newlines.

```bash
cd backend/secrets

echo -n "geoalert_prod_user"        > postgres_user
echo -n "a_strong_password_here"    > postgres_password
echo -n "geoalert_production"       > postgres_db
echo -n "redis_strong_password"     > redis_password
echo -n "rabbitmq_admin"            > rabbitmq_user
echo -n "rabbitmq_strong_password"  > rabbitmq_password
echo -n "your_jwt_access_secret"    > jwt_access_token_secret
echo -n "your_jwt_refresh_secret"   > jwt_refresh_token_secret
echo -n "your_jwt_2fa_secret"       > jwt_2fa_token_secret
echo -n "your_jwt_verify_secret"    > jwt_verify_token_secret
echo -n "your_2fa_encryption_key"   > two_factor_encryption_key
echo -n "your@gmail.com"            > smtp_user
echo -n "your_smtp_client_id"       > smtp_client_id
echo -n "your_smtp_client_secret"   > smtp_client_secret
echo -n "your_smtp_refresh_token"   > smtp_refresh_token
echo -n "your_at_api_key"           > at_api_key_dev

# Lock down permissions
chmod 600 *
```

### 4.3 Create Your `.env.production`
```bash
nano backend/envs/.env.production
```
Fill in your production values (DB host = `postgres`, Redis host = `redis`, etc. — they resolve via Docker network).

---

## Phase 5: Add Nginx + Certbot to Your Stack

Create `nginx/nginx.conf` — **HTTP only first** (Phase A of the SSL Dance):

```nginx
events {
    worker_connections 1024;
}

http {
    server {
        listen 80;
        server_name api.geoalert.xyz;

        # Certbot domain verification
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$host$request_uri;
        }
    }
}
```

Create `docker-compose.production.yml` in the root — **extends your existing compose** by adding Nginx and Certbot:

```yaml
version: "3.8"

services:
  nginx:
    image: nginx:1.27-alpine
    container_name: geoalert-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - api-production
    networks:
      - backend

  certbot:
    image: certbot/certbot
    container_name: geoalert-certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot

networks:
  backend:
    external: true
    name: compose_backend
```

---

## Phase 6: The SSL Dance

### Step A — Start Nginx on HTTP only
```bash
docker compose -f docker-compose.production.yml up -d nginx
```

### Step B — Request Your Certificate
```bash
docker compose -f docker-compose.production.yml run --rm certbot \
  certonly --webroot --webroot-path /var/www/certbot \
  -d api.geoalert.xyz \
  --email your@email.com \
  --agree-tos --no-eff-email
```
You should see: `"Successfully received certificate"` ✅

### Step C — Update nginx.conf to Full HTTPS
Replace the contents of `nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

    server {
        listen 80;
        server_name api.geoalert.xyz;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$host$request_uri;
        }
    }

    server {
        listen 443 ssl;
        server_name api.geoalert.xyz;

        ssl_certificate     /etc/letsencrypt/live/api.geoalert.xyz/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/api.geoalert.xyz/privkey.pem;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN";
        add_header X-Content-Type-Options "nosniff";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        location / {
            limit_req zone=api burst=50 nodelay;

            proxy_pass http://geoalert-api:3000;

            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host              $host;
            proxy_set_header X-Real-IP         $remote_addr;
            proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;

            proxy_connect_timeout 60s;
            proxy_send_timeout    60s;
            proxy_read_timeout    60s;
        }
    }
}
```

### Step D — Reload Nginx
```bash
docker compose -f docker-compose.production.yml exec nginx nginx -s reload
```

---

## Phase 7: Launch Your Full Backend Stack

```bash
# From ~/geoalert-backend

# 1. Build and start backend services (postgres, redis, rabbitmq, migrator, api)
APP_ENV=production docker compose \
  -f docker/compose/docker-compose.yml \
  --profile production up --build -d

# 2. Run seeds (only needed on first deploy)
APP_ENV=production docker compose \
  -f docker/compose/docker-compose.yml \
  --profile production --profile seed \
  run --rm db-seeder

# 3. Nginx is already running from Phase 6 — just verify
docker ps
```

Your API is now live at **https://api.geoalert.xyz** 🎉

---

## Phase 8: Certificate Auto-Renewal

Let's Encrypt certs expire every 90 days. Set up a cron job to renew automatically:

```bash
crontab -e
```

Add this line:
```
0 3 * * * cd ~/geoalert-backend && docker compose -f docker-compose.production.yml run --rm certbot renew --quiet && docker compose -f docker-compose.production.yml exec nginx nginx -s reload
```

This runs at 3am daily, only renews when <30 days remain.

---

## Quick Reference — Useful Commands

```bash
# View logs
docker logs geoalert-api -f
docker logs geoalert-nginx -f
docker logs geoalert-postgres -f

# Restart a service
docker compose -f docker/compose/docker-compose.yml --profile production restart api-production

# Re-deploy after a code change
git pull
APP_ENV=production docker compose \
  -f docker/compose/docker-compose.yml \
  --profile production up --build -d api-production

# Check all running containers
docker ps

# Check health
curl https://api.geoalert.xyz/api/v1/health
```
