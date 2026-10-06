#!/usr/bin/env bash
set -euo pipefail

# ---------------- CONFIG ----------------

DEV_CONTAINER="mariadb"
DEV_DB_MODE="docker" # docker | local
DEV_DB="GTS"
DEV_DB_USER="jeroen"
DEV_DB_PASSWORD="dev9046"
DEV_DB_HOST="127.0.0.1"
DEV_DB_PORT="3306"

PROD_HOST="piweb"
PROD_USER="jeroen"

PROD_DB="GTS"
PROD_DB_USER="gts"
PROD_DB_PASSWORD="xJ0t@9046!"

DEV_API_DIR="/home/jeroen/devellocal/vue-projects/golfapps/golftoernooi"
PROD_API_DIR="/home/jeroen/apps/golf-api"

DEV_WEB_DIR="$DEV_API_DIR"
DEV_WEB_DIST_DIR="$DEV_WEB_DIR/dist/"
PROD_WEB_DIR="/var/www/gts"
PROD_WEB_DIST_DIR="$PROD_WEB_DIR/"

DEV_UPLOADS_DIR="$DEV_API_DIR/public/uploads/"
PROD_UPLOADS_DIR="/srv/gts/uploads/"

PROD_PM2_NAME="gts-api"
PROD_PM2_ECOSYSTEM="ecosystem.config.cjs"
PROD_ENV_FILE="$PROD_API_DIR/.env"

DATE=$(date +"%Y%m%d_%H%M")

TMP_DUMP="/tmp/gts_dev.sql.gz"
PROD_IMPORT="/tmp/gts_import.sql.gz"
PROD_BACKUP="/tmp/gts_backup_${DATE}.sql.gz"

LOG_FILE="./deploy-gts.log"

# ---------------- COLORS ----------------

RED="\033[0;31m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
NC="\033[0m"

# ---------------- LOG ----------------

log() {
  echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"
}

ok() {
  echo -e "${GREEN}✔${NC} $*"
}

fail() {
  echo -e "${RED}✖ $*${NC}"
  exit 1
}

# ---------------- CHECK DEPENDENCIES ----------------

check_base_dependencies() {

  log "Checking dependencies..."

  for cmd in rsync ssh gzip; do
    command -v $cmd > /dev/null || fail "$cmd not installed"
  done

  ok "Base dependencies OK"

}

check_frontend_dependencies() {

  log "Checking frontend dependencies..."

  command -v npm > /dev/null || fail "npm not installed"
  [ -f "$DEV_WEB_DIR/package.json" ] || fail "No package.json found in $DEV_WEB_DIR"

  ok "Frontend dependencies OK"

}

check_db_dependencies() {

  log "Checking database dependencies..."

  case "$DEV_DB_MODE" in
    docker)
      command -v docker > /dev/null || fail "docker not installed"
      if ! docker ps | grep -q "$DEV_CONTAINER"; then
        fail "Docker container $DEV_CONTAINER not running"
      fi
      ;;
    local)
      command -v mariadb-dump > /dev/null || fail "mariadb-dump not installed"
      ;;
    *)
      fail "Invalid DEV_DB_MODE: $DEV_DB_MODE (use docker or local)"
      ;;
  esac

  ok "Database dependencies OK"

}

preflight_prod_db() {

  log "Running PROD DB preflight on $PROD_HOST..."

  ssh "$PROD_USER@$PROD_HOST" 'bash -se' << 'EOF'
if command -v mariadb-dump > /dev/null 2>&1 || command -v mysqldump > /dev/null 2>&1; then
  :
else
  echo "Neither mariadb-dump nor mysqldump found on prod host"
  exit 1
fi

if command -v mariadb > /dev/null 2>&1 || command -v mysql > /dev/null 2>&1; then
  :
else
  echo "Neither mariadb nor mysql found on prod host"
  exit 1
fi

command -v gzip > /dev/null 2>&1 || { echo "gzip not installed on prod host"; exit 1; }
command -v gunzip > /dev/null 2>&1 || { echo "gunzip not installed on prod host"; exit 1; }
EOF

  ok "PROD DB preflight OK"

}

preflight_prod_api() {

  log "Running PROD API preflight on $PROD_HOST..."

  ssh "$PROD_USER@$PROD_HOST" \
    PROD_API_DIR="$PROD_API_DIR" \
    PROD_UPLOADS_DIR="$PROD_UPLOADS_DIR" \
    PROD_ENV_FILE="$PROD_ENV_FILE" \
    'bash -se' << 'EOF'
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
  nvm use default > /dev/null 2>&1 || true
fi

command -v npm > /dev/null 2>&1 || { echo "npm not installed on prod host"; exit 1; }
command -v pm2 > /dev/null 2>&1 || { echo "pm2 not installed on prod host"; exit 1; }

if ! [ -f "$PROD_ENV_FILE" ]; then
  echo "Missing env file: $PROD_ENV_FILE"
  echo "Create this file on prod with DB_HOST, DB_USER, DB_NAME, UPLOADS_DIR and other API settings before deploy."
  exit 1
fi

for key in DB_HOST DB_USER DB_NAME UPLOADS_DIR; do
  grep -Eq "^${key}=" "$PROD_ENV_FILE" || {
    echo "Missing ${key}=... in $PROD_ENV_FILE"
    exit 1
  }
done

for key in GTS_PUBLIC_APP_URL GTS_PUBLIC_API_BASE_URL SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER SMTP_PASSWORD SMTP_FROM; do
  grep -Eq "^${key}=" "$PROD_ENV_FILE" || {
    echo "Missing ${key}=... in $PROD_ENV_FILE (required for e-mail verification)"
    exit 1
  }
done

if command -v curl > /dev/null 2>&1 || command -v wget > /dev/null 2>&1; then
  :
else
  echo "Neither curl nor wget found on prod host (required for health check)"
  exit 1
fi

mkdir -p "$PROD_API_DIR"
mkdir -p "$PROD_UPLOADS_DIR"
EOF

  ok "PROD API preflight OK"

}

preflight_prod_frontend() {

  log "Running PROD frontend preflight on $PROD_HOST..."

  ssh "$PROD_USER@$PROD_HOST" \
    PROD_WEB_DIR="$PROD_WEB_DIR" \
    PROD_WEB_DIST_DIR="$PROD_WEB_DIST_DIR" \
    'bash -se' << 'EOF'
mkdir -p "$PROD_WEB_DIR"
mkdir -p "$PROD_WEB_DIST_DIR"

if ! [ -w "$PROD_WEB_DIST_DIR" ]; then
  echo "No write permission on $PROD_WEB_DIST_DIR for current user"
  echo "Grant write access (chown/chgrp/setfacl) or choose a deploy path owned by the deploy user."
  exit 1
fi
EOF

  ok "PROD frontend preflight OK"

}

# ---------------- DUMP DEV DB ----------------

dump_dev_db() {

  log "Dumping DEV database..."

  local dump_cmd

  case "$DEV_DB_MODE" in
    docker)
      dump_cmd=(docker exec "$DEV_CONTAINER" mariadb-dump -u"$DEV_DB_USER" -p"$DEV_DB_PASSWORD" "$DEV_DB")
      ;;
    local)
      dump_cmd=(mariadb-dump -h "$DEV_DB_HOST" -P "$DEV_DB_PORT" -u"$DEV_DB_USER" -p"$DEV_DB_PASSWORD" "$DEV_DB")
      ;;
    *)
      fail "Invalid DEV_DB_MODE: $DEV_DB_MODE"
      ;;
  esac

  if command -v pv > /dev/null; then
    "${dump_cmd[@]}" | gzip | pv > "$TMP_DUMP"
  else
    "${dump_cmd[@]}" | gzip > "$TMP_DUMP"
  fi

  [ -s "$TMP_DUMP" ] || fail "Dump failed"

  ok "DEV dump created"

}

# ---------------- BACKUP PROD DB ----------------

backup_prod_db() {

  log "Creating PROD backup..."

  ssh "$PROD_USER@$PROD_HOST" \
    PROD_ENV_FILE="$PROD_ENV_FILE" \
    PROD_DB_USER="$PROD_DB_USER" \
    PROD_DB_PASSWORD="$PROD_DB_PASSWORD" \
    PROD_DB="$PROD_DB" \
    PROD_BACKUP="$PROD_BACKUP" \
    'bash -se' << 'EOF'
set -o pipefail

extract_env_value() {
  local key="$1"
  local file="$2"

  sed -nE "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*['\"]?([^'\"]*)['\"]?[[:space:]]*$/\1/p" "$file" | head -n 1
}

if [ -f "$PROD_ENV_FILE" ]; then
  env_db_user="$(extract_env_value "DB_USER" "$PROD_ENV_FILE")"
  env_db_password="$(extract_env_value "DB_PASSWORD" "$PROD_ENV_FILE")"
  env_db_name="$(extract_env_value "DB_NAME" "$PROD_ENV_FILE")"

  [ -n "$env_db_user" ] && PROD_DB_USER="$env_db_user"
  [ -n "$env_db_password" ] && PROD_DB_PASSWORD="$env_db_password"
  [ -n "$env_db_name" ] && PROD_DB="$env_db_name"
fi

if [ -z "${PROD_DB_USER:-}" ] || [ -z "${PROD_DB:-}" ]; then
  echo "Missing PROD_DB_USER/PROD_DB and no usable DB_USER/DB_NAME in $PROD_ENV_FILE"
  exit 1
fi

if command -v mariadb-dump > /dev/null 2>&1; then
  DB_DUMP_BIN="mariadb-dump"
elif command -v mysqldump > /dev/null 2>&1; then
  DB_DUMP_BIN="mysqldump"
else
  echo "Neither mariadb-dump nor mysqldump found on prod host"
  exit 1
fi

"$DB_DUMP_BIN" -u "$PROD_DB_USER" -p"$PROD_DB_PASSWORD" "$PROD_DB" \
  | gzip > "$PROD_BACKUP"
EOF

  ok "PROD backup stored: $PROD_BACKUP"

}

# ---------------- IMPORT DB ----------------

import_db() {

  log "Uploading dump..."

  rsync -ah --progress "$TMP_DUMP" "$PROD_USER@$PROD_HOST:$PROD_IMPORT"

  log "Importing database..."

  ssh "$PROD_USER@$PROD_HOST" \
    PROD_ENV_FILE="$PROD_ENV_FILE" \
    PROD_IMPORT="$PROD_IMPORT" \
    PROD_DB_USER="$PROD_DB_USER" \
    PROD_DB_PASSWORD="$PROD_DB_PASSWORD" \
    PROD_DB="$PROD_DB" \
    'bash -se' << 'EOF'
set -o pipefail

extract_env_value() {
  local key="$1"
  local file="$2"

  sed -nE "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*['\"]?([^'\"]*)['\"]?[[:space:]]*$/\1/p" "$file" | head -n 1
}

if [ -f "$PROD_ENV_FILE" ]; then
  env_db_user="$(extract_env_value "DB_USER" "$PROD_ENV_FILE")"
  env_db_password="$(extract_env_value "DB_PASSWORD" "$PROD_ENV_FILE")"
  env_db_name="$(extract_env_value "DB_NAME" "$PROD_ENV_FILE")"

  [ -n "$env_db_user" ] && PROD_DB_USER="$env_db_user"
  [ -n "$env_db_password" ] && PROD_DB_PASSWORD="$env_db_password"
  [ -n "$env_db_name" ] && PROD_DB="$env_db_name"
fi

if [ -z "${PROD_DB_USER:-}" ] || [ -z "${PROD_DB:-}" ]; then
  echo "Missing PROD_DB_USER/PROD_DB and no usable DB_USER/DB_NAME in $PROD_ENV_FILE"
  exit 1
fi

if command -v mariadb > /dev/null 2>&1; then
  DB_CLIENT_BIN="mariadb"
elif command -v mysql > /dev/null 2>&1; then
  DB_CLIENT_BIN="mysql"
else
  echo "Neither mariadb nor mysql found on prod host"
  exit 1
fi

gunzip -c "$PROD_IMPORT" | "$DB_CLIENT_BIN" -u "$PROD_DB_USER" -p"$PROD_DB_PASSWORD" "$PROD_DB"
EOF

  ok "Database imported"

}

# ---------------- SYNC UPLOADS ----------------

sync_uploads() {

  log "Syncing uploads..."

  rsync -az --delete --progress \
    "$DEV_UPLOADS_DIR" \
    "$PROD_USER@$PROD_HOST:$PROD_UPLOADS_DIR"

  ok "Uploads synced"

}

# ---------------- SYNC API ----------------

sync_api() {

  log "Syncing API..."

  rsync -az --delete \
    --exclude node_modules \
    --exclude .env \
    --exclude .env.development \
    --exclude .env.production \
    --exclude public/uploads \
    --exclude .git \
    "$DEV_API_DIR/" \
    "$PROD_USER@$PROD_HOST:$PROD_API_DIR/"

  log "Restarting API..."

  ssh "$PROD_USER@$PROD_HOST" \
    PROD_API_DIR="$PROD_API_DIR" \
    PROD_PM2_NAME="$PROD_PM2_NAME" \
    PROD_PM2_ECOSYSTEM="$PROD_PM2_ECOSYSTEM" \
    'bash -se' << 'EOF'

cd "$PROD_API_DIR" || exit 1

export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
  nvm use default > /dev/null 2>&1 || true
fi

command -v npm > /dev/null 2>&1 || { echo "npm not installed on target"; exit 1; }
command -v pm2 > /dev/null 2>&1 || { echo "pm2 not installed on target"; exit 1; }

npm install --omit=dev

if [ -f "$PROD_PM2_ECOSYSTEM" ]; then
 if pm2 describe "$PROD_PM2_NAME" > /dev/null 2>&1; then
  pm2 startOrRestart "$PROD_PM2_ECOSYSTEM" --only "$PROD_PM2_NAME" --env production
 else
  pm2 start "$PROD_PM2_ECOSYSTEM" --only "$PROD_PM2_NAME" --env production
 fi
else
 if pm2 describe "$PROD_PM2_NAME" > /dev/null 2>&1; then
  pm2 restart "$PROD_PM2_NAME" --update-env
 else
  pm2 start server/index.js --name "$PROD_PM2_NAME" --cwd "$PROD_API_DIR"
 fi
fi

health_ok=0
health_output=""
for _attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if command -v curl > /dev/null 2>&1; then
    health_output=$(curl -fsS "http://127.0.0.1:3001/api/health" 2>/dev/null || true)
    if [ -n "$health_output" ]; then
      health_ok=1
      break
    fi
  else
    health_output=$(wget -qO- "http://127.0.0.1:3001/api/health" 2>/dev/null || true)
    if [ -n "$health_output" ]; then
      health_ok=1
      break
    fi
  fi

  sleep 2
done

if [ "$health_ok" -ne 1 ]; then
  echo "API health check failed after restart"
  echo "Last health probe output: ${health_output:-<empty>}"
  exit 1
fi

EOF

  ok "API deployed"

}

# ---------------- FRONTEND BUILD + SYNC ----------------

build_frontend() {

  log "Building frontend..."

  (
    cd "$DEV_WEB_DIR"
    npm run build
  )

  [ -d "$DEV_WEB_DIST_DIR" ] || fail "Frontend dist directory missing: $DEV_WEB_DIST_DIR"

  ok "Frontend build completed"

}

sync_frontend() {

  log "Syncing frontend build..."

  rsync -rltz --delete --no-perms --no-owner --no-group \
    "$DEV_WEB_DIST_DIR" \
    "$PROD_USER@$PROD_HOST:$PROD_WEB_DIST_DIR"

  ok "Frontend deployed"

}

# ---------------- CLEANUP ----------------

cleanup() {

  log "Cleaning temp files..."

  rm -f "$TMP_DUMP"

  ssh "$PROD_USER@$PROD_HOST" \
    PROD_IMPORT="$PROD_IMPORT" \
    'bash -se' << 'EOF'
rm -f "$PROD_IMPORT"
EOF

  ok "Cleanup done"

}

# ---------------- DATABASE SYNC ----------------

sync_db() {

  dump_dev_db
  backup_prod_db
  import_db

}

# ---------------- MENU ----------------

echo
echo "GTS DEPLOY"
echo "--------------------------------"
echo "1) Database & Uploads"
echo "2) API only"
echo "3) Frontend only"
echo "4) Everything"
echo "5) Full Stack (DB + Uploads + API + Frontend)"
echo

read -rp "Choice: " choice

case "$choice" in

  1)
    check_base_dependencies
    check_db_dependencies
    preflight_prod_db
    preflight_prod_api
    sync_db
    sync_uploads
    cleanup
    ;;

  2)
    check_base_dependencies
    preflight_prod_api
    sync_api
    ;;

  3)
    check_base_dependencies
    check_frontend_dependencies
    preflight_prod_frontend
    build_frontend
    sync_frontend
    ;;

  4)
    check_base_dependencies
    check_db_dependencies
    preflight_prod_db
    preflight_prod_api
    sync_db
    sync_uploads
    sync_api
    cleanup
    ;;

  5)
    check_base_dependencies
    check_db_dependencies
    check_frontend_dependencies
    preflight_prod_db
    preflight_prod_api
    preflight_prod_frontend
    sync_db
    sync_uploads
    sync_api
    build_frontend
    sync_frontend
    cleanup
    ;;

  *)
    fail "Invalid option"
    ;;

esac

ok "Deploy complete"
