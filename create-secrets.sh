#!/bin/bash
# ─────────────────────────────────────────────────────────────
# GeoAlert — Secret Files Generator
# Run from repo root: bash create-secrets.sh
# ─────────────────────────────────────────────────────────────

set -e

SECRETS_DIR="./backend/secrets"
mkdir -p "$SECRETS_DIR"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     GeoAlert — Secret Files Generator    ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Enter values for each secret."
echo "Press Enter to skip (file will be left empty — fill it later)."
echo ""

prompt_secret() {
  local name=$1
  local label=$2
  local value=""

  read -rsp "  $label: " value
  echo ""
  echo -n "$value" > "$SECRETS_DIR/$name"
}

echo "── Postgres ─────────────────────────────────"
prompt_secret "postgres_user"     "Postgres username"
prompt_secret "postgres_password" "Postgres password"
prompt_secret "postgres_db"       "Postgres database name"

echo ""
echo "── Redis ────────────────────────────────────"
prompt_secret "redis_password" "Redis password"

echo ""
echo "── RabbitMQ ─────────────────────────────────"
prompt_secret "rabbitmq_user"     "RabbitMQ username"
prompt_secret "rabbitmq_password" "RabbitMQ password"

echo ""
echo "── JWT Secrets ──────────────────────────────"
prompt_secret "jwt_access_token_secret"  "JWT access token secret"
prompt_secret "jwt_refresh_token_secret" "JWT refresh token secret"
prompt_secret "jwt_2fa_token_secret"     "JWT 2FA token secret"
prompt_secret "jwt_verify_token_secret"  "JWT verify token secret"

echo ""
echo "── 2FA ──────────────────────────────────────"
prompt_secret "two_factor_encryption_key" "2FA encryption key"

echo ""
echo "── SMTP (Gmail OAuth) ───────────────────────"
prompt_secret "smtp_user"          "SMTP user (your Gmail address)"
prompt_secret "smtp_client_id"     "SMTP client ID"
prompt_secret "smtp_client_secret" "SMTP client secret"
prompt_secret "smtp_refresh_token" "SMTP refresh token"

echo ""
echo "── ArcGIS / AT API ──────────────────────────"
prompt_secret "at_api_key_dev" "AT API key (dev)"

# Lock down all permissions
chmod 600 "$SECRETS_DIR"/*

echo ""
echo "✅  Done! Secret files created in $SECRETS_DIR"
echo ""
echo "Files created:"
ls -la "$SECRETS_DIR"
echo ""
echo "⚠️  Make sure backend/secrets/ is in your .gitignore!"
