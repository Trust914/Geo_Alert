# GeoAlert — Render Frontend Deployment Guide

---

## Prerequisites

Before deploying to Render, make sure these are done locally:

```bash
# Ensure all frontend files are committed
git add docker/frontend/
git commit -m "chore: update frontend docker config for Render"
git push origin main
```

Also confirm your `frontend/.env` is in `.gitignore` — it's for local dev only and must never be committed:
```bash
grep "frontend/.env" .gitignore
# or
grep "\.env" frontend/.gitignore
```

---

## Phase 1: Create the Web Service on Render

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your GitHub account if not already connected
3. Select the `Geo_Alert` repository
4. Configure the service:

   | Field | Value |
   |-------|-------|
   | **Name** | `geoalert-frontend` |
   | **Region** | Choose closest to your users |
   | **Branch** | `main` |
   | **Runtime** | `Docker` |
   | **Dockerfile Path** | `docker/frontend/Dockerfile` |
   | **Docker Build Context** | `.` (repo root) |
5. Scroll to **Environment Variables** and add:

   | Key | Value |
   |-----|-------|
   | `VITE_API_BASE_URL` | `https://api.geoalert.xyz/api/v1` |
   | `VITE_APP_NAME` | `GeoAlert System` |
   | `VITE_APP_ENV` | `production` |
   | `VITE_MAPBOX_PUBLIC_TOKEN` | `your mapbox token` |

   > `PORT` is automatically injected by Render — do NOT set it manually.

   > **Note on Docker Target Stage**: Render's UI has no "Docker Target Stage" field. You don't need it. Render builds the last stage in the Dockerfile by default — which is `production`. Docker's BuildKit is smart enough to build `builder`, skip `staging`, and output `production` automatically. Just set the Dockerfile Path and Build Context correctly and move on.

6. Click **Create Web Service**

The first build takes 3–5 minutes. You can watch the build logs in real time on the Render dashboard.

---

## Phase 2: Link Your Custom Domain

### 2.1 Add Domain on Render
1. Go to your web service → **Settings → Custom Domains**
2. Click **Add Custom Domain**
3. Enter `secure.geoalert.xyz`
4. Render will display the DNS record you need — copy it

### 2.2 Add DNS Records on GoDaddy
1. Go to **GoDaddy → DNS Management** for `geoalert.xyz`
2. Add the records. Your full DNS layout will be:

   | Type | Name | Value | TTL |
   |------|------|-------|-----|
   | CNAME | `secure` | `geoalert-frontend.onrender.com` | 600 |
   | A | `api` | `[Your EC2 Elastic IP]` | 600 |

3. Save and wait 10–15 minutes for propagation

### 2.3 SSL
Render automatically provisions a Let's Encrypt SSL certificate once DNS propagates. No action needed.

Verify:
```bash
curl https://secure.geoalert.xyz
# Should return your frontend HTML
```

---

## Phase 3: Verify End-to-End

```bash
# Backend health
curl https://api.geoalert.xyz/api/v1/health

# Frontend
curl https://secure.geoalert.xyz
```

Open `https://secure.geoalert.xyz` in a browser and confirm the app loads and API calls succeed.

---

## Redeployment

Render auto-deploys on every push to `main`. To trigger a manual redeploy:
- Render dashboard → your service → **Manual Deploy → Deploy latest commit**

---

## Adding More Subdomains (e.g. secure.geoalert.xyz)

1. Render → **Settings → Custom Domains → Add Custom Domain** → enter `secure.geoalert.xyz`
2. GoDaddy → add:

   | Type | Name | Value | TTL |
   |------|------|-------|-----|
   | CNAME | `secure` | `geoalert-frontend.onrender.com` | 600 |

Render handles SSL automatically.

---

## Domain Layout Summary

| Domain | Points To | Purpose |
|--------|-----------|---------|
| `secure.geoalert.xyz` | Render | Frontend app |
| `api.geoalert.xyz` | EC2 Elastic IP | Backend API |

---

## How Environment Variables Flow

| Stage | Where set | Value |
|-------|-----------|-------|
| Local dev | `frontend/.env` | `http://localhost:3000/api/v1` |
| Staging (Docker) | `docker-compose.frontend-staging.yml` | `/api/v1` (proxied via nginx) |
| Production (Render) | Render dashboard env vars | `https://api.geoalert.xyz/api/v1` |

At runtime, `entrypoint.sh` writes all `VITE_*` vars into `window.__ENV__` inside the container — so your frontend always reads the correct API URL without needing a rebuild when the URL changes.
