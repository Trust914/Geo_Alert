# GeoAlert — AWS EC2 + GoDaddy Deployment Guide

---

## Phase 1: AWS Setup

### 1.1 Launch an EC2 Instance
1. Go to **AWS Console → EC2 → Launch Instance**
2. Choose **Ubuntu 24.04 LTS**
3. Instance type: **t3.medium** minimum (stack runs Postgres + Redis + RabbitMQ + API)
4. **Key pair**: Create a new one, download the `.pem` file — keep it safe, you cannot recover it
5. **Security Group** — open these ports:

   | Port | Protocol | Source | Why |
   |------|----------|--------|-----|
   | 22 | TCP | Your IP only | SSH |
   | 80 | TCP | 0.0.0.0/0 | HTTP / Certbot |
   | 443 | TCP | 0.0.0.0/0 | HTTPS |
   | All ICMP - IPv4 | ICMP | 0.0.0.0/0 | Ping/debug |

6. Storage: **20GB minimum**
7. Launch the instance

> ⚠️ If SSH fails with "Connection refused" after launch, the Security Group is the cause — verify all inbound rules are saved, especially port 22.

### 1.2 Attach an Elastic IP
Without this, your EC2's public IP changes every reboot, breaking DNS.

1. EC2 → **Elastic IPs → Allocate Elastic IP**
2. Click **Actions → Associate Elastic IP**
3. Associate it with your new instance
4. Copy the IP

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

## Phase 3: Prepare Your Local Repo Before Deploying

Do these on your **local machine** before touching the server.

### 3.1 Commit Prisma Migrations
Migration files are the source of truth for your database schema. They must be in git — never in `.gitignore`.

```bash
# Check they exist locally
ls backend/src/prisma/prisma/migrations/

# Commit them
git add backend/src/prisma/prisma/migrations/
git commit -m "chore: add prisma migrations"
git push origin main
```

> ⚠️ Only generated files should be gitignored (`node_modules`, `src/prisma/prisma/generated/`). Migration files must always be committed.

### 3.2 Add APP_ENV and NODE_ENV to Your Env Files
Docker containers get a clean environment — they don't inherit shell variables. Add these explicitly to your env files:

```bash
# In backend/envs/.env.production
NODE_ENV=production
APP_ENV=production

# In backend/envs/.env.staging
NODE_ENV=staging
APP_ENV=staging
```

Commit and push:
```bash
git add backend/envs/
git commit -m "chore: add NODE_ENV and APP_ENV to env files"
git push origin main
```

---

## Phase 4: Prepare Your EC2 Instance

### 4.1 SSH In
```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@api.geoalert.xyz
```

### 4.2 Install Docker
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

sudo usermod -aG docker ubuntu
newgrp docker
```

### 4.3 Install Git LFS
Your repo uses Git LFS for large geojson seed files. Install before cloning:

```bash
sudo apt-get install -y git-lfs
git lfs install
```

### 4.4 Create Project Directory
```bash
mkdir -p ~/geoalert-backend
cd ~/geoalert-backend
```

---

## Phase 5: Clone the Repo (Private)

Use a **GitHub Deploy Key** — gives EC2 read-only access to one specific repo.

### 5.1 Generate a Deploy Key on EC2
```bash
ssh-keygen -t ed25519 -C "geoalert-ec2" -f ~/.ssh/github_deploy_key
# Press Enter for all prompts

cat ~/.ssh/github_deploy_key.pub
# Copy this output
```

### 5.2 Add the Key to GitHub
1. Go to your repo → **Settings → Deploy keys → Add deploy key**
2. Title: `GeoAlert EC2`
3. Paste the public key
4. Leave "Allow write access" **unchecked**
5. Click **Add key**

### 5.3 Configure SSH
```bash
# Use heredoc — do NOT use nano/vim (invisible bad characters break SSH config)
cat > ~/.ssh/config << 'EOF'
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_deploy_key
EOF

chmod 600 ~/.ssh/config
```

### 5.4 Test and Clone
```bash
ssh -T git@github.com
# Should print: Hi Trust914! You've successfully authenticated...

cd ~/geoalert-backend
git clone git@github.com:Trust914/Geo_Alert.git .
```

### 5.5 Pull Git LFS Files
After cloning, large geojson files will be LFS pointers. Pull the actual data:

```bash
cd ~/geoalert-backend/Geo_Alert
git lfs pull
```

Verify:
```bash
ls -lh backend/src/seed/data/
# Files should be MB-sized

head -c 20 backend/src/seed/data/population.geojson
# Should start with { or [ not "version"
```

---

## Phase 6: Project Structure on EC2

After cloning, your structure should look like this:

```
geoalert-backend/
└── Geo_Alert/
    ├── backend/
    │   ├── src/
    │   │   ├── prisma/
    │   │   │   └── prisma/
    │   │   │       └── migrations/     ← must be in git
    │   │   └── seed/
    │   │       └── data/               ← LFS files land here after git lfs pull
    │   │           ├── population.geojson
    │   │           ├── lga.geojson
    │   │           ├── states.geojson
    │   │           └── wards.geojson
    │   ├── envs/
    │   │   └── .env.production         ← you create this
    │   └── secrets/                    ← you create this (NOT in git)
    └── docker/
        ├── compose/
        │   ├── api-docker-compose.yml
        │   ├── nginx/
        │   │   └── nginx.conf          ← you create this
        │   └── certbot/
        │       ├── conf/               ← auto-populated by certbot
        │       └── www/               ← auto-populated by certbot
        ├── backend_api/
        ├── postgres/
        └── rabbitmq/
```

---

## Phase 7: Create Secrets and Env File

### 7.1 Create Secret Files
Run the secrets generator script:
```bash
cd ~/geoalert-backend/Geo_Alert
bash create-secrets.sh
```

After creating, set permissions to `644` — Docker containers run as different users and need read access:
```bash
chmod 644 ~/geoalert-backend/Geo_Alert/backend/secrets/*
```

> ⚠️ `chmod 600` causes `Permission denied` errors inside containers. Always use `644` for secret files.

### 7.2 Create `.env.production`
```bash
nano backend/envs/.env.production
```

Must include at minimum:
```env
NODE_ENV=production
APP_ENV=production
# All other app-specific variables...
```

---

## Phase 8: Nginx Config + Certbot Directories

### 8.1 Create directories
```bash
cd ~/geoalert-backend/Geo_Alert

mkdir -p docker/compose/nginx
mkdir -p docker/compose/certbot/conf
mkdir -p docker/compose/certbot/www
```

### 8.2 Write HTTP-only nginx.conf (temporary — for SSL dance only)
```bash
nano docker/compose/nginx/nginx.conf
```

```nginx
events {
    worker_connections 1024;
}

http {
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
}
```

---

## Phase 9: The SSL Dance

> ⚠️ Nginx crashes at startup if `proxy_pass` references a hostname (`geoalert-api`) that doesn't exist yet. You must get the SSL cert first with the HTTP-only config, then switch to HTTPS only after the full stack is running.

### Step A — Comment out nginx `depends_on` temporarily
In `docker/compose/api-docker-compose.yml`:
```yaml
nginx:
  # depends_on:
  #   - api-production
```

### Step B — Start Nginx (HTTP only)
```bash
cd ~/geoalert-backend/Geo_Alert/docker/compose

APP_ENV=production docker compose -f api-docker-compose.yml --profile production up -d nginx
```

Verify:
```bash
docker ps | grep nginx         # STATUS must be "Up" not "Restarting"
curl http://api.geoalert.xyz   # Must return 301
```

If nginx is `Restarting`, check logs:
```bash
docker logs geoalert-nginx
```
The most common cause is the nginx.conf still has the HTTPS/proxy_pass block — make sure you're using the HTTP-only config from Step 8.2.

### Step C — Run Certbot
```bash
docker compose -f api-docker-compose.yml --profile production run --rm certbot \
  certonly --webroot --webroot-path /var/www/certbot \
  -d api.geoalert.xyz \
  --email donotreplygeoalert@gmail.com \
  --agree-tos --no-eff-email
```

Success output:
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/api.geoalert.xyz/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/api.geoalert.xyz/privkey.pem
This certificate expires on 2026-06-02.
```

### Step D — Update nginx.conf to Full HTTPS
```bash
nano docker/compose/nginx/nginx.conf
```

```nginx
events {
    worker_connections 1024;
}

http {
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

---

## Phase 10: Launch the Full Stack

```bash
cd ~/geoalert-backend/Geo_Alert/docker/compose

APP_ENV=production docker compose -f api-docker-compose.yml --profile production up --build -d
```

Watch logs:
```bash
docker compose -f api-docker-compose.yml --profile production logs -f
```

Verify all containers are healthy:
```bash
docker ps
# All containers should show "Up" or "healthy" — none should show "Restarting"
```

Check migrations applied:
```bash
docker logs geoalert-db-migrator
# Should show: "Applying migration..." or "No pending migrations to apply."
# Should NOT show: "No migration found in prisma/migrations"
```

---

## Phase 11: Run Database Seeds (First Deploy Only)

```bash
cd ~/geoalert-backend/Geo_Alert/docker/compose

APP_ENV=production docker compose -f api-docker-compose.yml \
  --profile production --profile seed run --rm db-seeder
```

Expected output:
```
Running Population Seeds... ✓
Running Geo Seeds...        ✓
Running Admin Seed...       ✓
```

Then verify the API is live:
```bash
curl https://api.geoalert.xyz/api/v1/health
```

Your API is now live at **https://api.geoalert.xyz** 🎉

---

## Phase 12: Certificate Auto-Renewal

Let's Encrypt certs expire every 90 days. Set up a cron job to renew automatically:

```bash
crontab -e
```

Add:
```
0 3 * * * cd ~/geoalert-backend/Geo_Alert/docker/compose && docker compose -f api-docker-compose.yml --profile production run --rm certbot renew --quiet && docker compose -f api-docker-compose.yml --profile production exec nginx nginx -s reload
```

**Verify the cron job was saved:**
```bash
crontab -l
# Should print the line you just added
```

**Test renewal setup** (run from `docker/compose` directory):
```bash
cd ~/geoalert-backend/Geo_Alert/docker/compose

docker compose -f api-docker-compose.yml --profile production run --rm certbot certificates
```

You should see:
```
Found the following certs:
  Certificate Name: api.geoalert.xyz
  Expiry Date: 2026-06-02
  Certificate Path: /etc/letsencrypt/live/api.geoalert.xyz/fullchain.pem
```

> ⚠️ Do NOT use `--dry-run` to test renewal. It produces a false `No such authorization` error because the dry-run staging server doesn't know about your real certificate. This is a known Let's Encrypt quirk with the webroot method and does not mean your actual renewal will fail. Use `certbot certificates` instead to confirm your setup is correct.

---

## Quick Reference

```bash
# View logs
docker logs geoalert-api -f
docker logs geoalert-nginx -f
docker logs geoalert-postgres -f
docker logs geoalert-db-migrator

# Restart a single service
docker compose -f api-docker-compose.yml --profile production restart api-production

# Redeploy after a code change
cd ~/geoalert-backend/Geo_Alert
git pull
git lfs pull        # only needed if seed data or LFS files changed
cd docker/compose
APP_ENV=production docker compose -f api-docker-compose.yml --profile production up --build -d api-production

# Take everything down
docker compose -f api-docker-compose.yml --profile production down

# Check all running containers
docker ps

# Health check
curl https://api.geoalert.xyz/api/v1/health
```

---

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Permission denied` on secrets | `chmod 600` too restrictive for Docker | `chmod 644 backend/secrets/*` |
| `host not found in upstream "geoalert-api"` | HTTPS nginx.conf loaded before API is running | Use HTTP-only config during SSL dance |
| `No migration found in prisma/migrations` | Migrations not committed to git | Commit `prisma/migrations/` folder and push |
| `node: envs/.env.development not found` | `APP_ENV` not set inside container | Add `APP_ENV=production` to `.env.production` |
| `Bad configuration option: identityonly` | SSH config written with bad characters | Recreate with `cat > ~/.ssh/config << 'EOF'` heredoc |
| LFS pointer files instead of real data | `git lfs` not installed before clone | `sudo apt-get install git-lfs && git lfs pull` |
| SSH "Connection refused" | Security Group missing port 22 rule | Add inbound rule for port 22 in AWS console |
