#!/usr/bin/env bash
set -euo pipefail

# Deploy van Tourpool (API + admin) naar piweb.
# Er staan bewust geen wachtwoorden in dit script:
#   - dev-database: gelezen uit apps/api/.env
#   - prod-database: gelezen uit $PROD_API_DIR/.env op de server (aangemaakt via optie 1)

# ---------------- CONFIG ----------------

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DEV_API_DIR="$ROOT_DIR/apps/api"
DEV_ADMIN_DIR="$ROOT_DIR/apps/admin"
DEV_ENV_FILE="$DEV_API_DIR/.env"
DEV_DB_MODE="docker" # docker | local
DEV_CONTAINER="mariadb"

PROD_HOST="piweb"
PROD_USER="jeroen"
PROD_SSH="$PROD_USER@$PROD_HOST"

PROD_API_DIR="/home/jeroen/apps/tourpool-api"
PROD_ENV_FILE="$PROD_API_DIR/.env"
PROD_API_PORT="3002"
PROD_PM2_NAME="tourpool-api"

PROD_WEB_DIR="/var/www/tourpool"
PROD_BASE_PATH="/tourpool" # moet overeenkomen met apps/admin/.env.production

PROD_DB="tourpool"
PROD_DB_USER="tourpool"

PROD_NGINX_SNIPPET="/etc/nginx/snippets/tourpool.conf"
PROD_NGINX_SITE="/etc/nginx/sites-enabled/jota.conf"
PROD_HTPASSWD="/etc/nginx/.htpasswd-tourpool"

DATE=$(date +"%Y%m%d_%H%M")
TMP_DUMP="/tmp/tourpool_dev.sql.gz"
PROD_IMPORT="/tmp/tourpool_import.sql.gz"
PROD_BACKUP_DIR="/home/jeroen/apps/backups"
PROD_BACKUP="$PROD_BACKUP_DIR/tourpool_${DATE}.sql.gz"

LOG_FILE="$ROOT_DIR/deploy-tourpool.log"

# ---------------- COLORS / LOG ----------------

RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
BLUE="\033[0;34m"
NC="\033[0m"

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"; }
ok() { echo -e "${GREEN}✔${NC} $*" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}!${NC} $*" | tee -a "$LOG_FILE"; }
fail() { echo -e "${RED}✖ $*${NC}" | tee -a "$LOG_FILE"; exit 1; }

env_value() {
  # env_value KEY FILE -> waarde zonder quotes
  sed -nE "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*['\"]?([^'\"]*)['\"]?[[:space:]]*$/\1/p" "$2" | head -n 1
}

# ---------------- CHECKS ----------------

check_base_dependencies() {
  log "Lokale tools controleren..."
  for cmd in rsync ssh gzip npm; do
    command -v "$cmd" > /dev/null || fail "$cmd niet geïnstalleerd"
  done
  ssh -o BatchMode=yes -o ConnectTimeout=5 "$PROD_SSH" true || fail "Geen ssh-verbinding met $PROD_SSH"
  ok "Lokale tools en ssh OK"
}

check_db_dependencies() {
  log "Dev-database controleren..."
  [ -f "$DEV_ENV_FILE" ] || fail "Ontbreekt: $DEV_ENV_FILE"
  case "$DEV_DB_MODE" in
    docker)
      command -v docker > /dev/null || fail "docker niet geïnstalleerd"
      docker ps --format '{{.Names}}' | grep -qx "$DEV_CONTAINER" || fail "Docker container $DEV_CONTAINER draait niet"
      ;;
    local)
      command -v mariadb-dump > /dev/null || fail "mariadb-dump niet geïnstalleerd"
      ;;
    *)
      fail "Ongeldige DEV_DB_MODE: $DEV_DB_MODE (docker of local)"
      ;;
  esac
  ok "Dev-database OK"
}

preflight_prod() {
  log "Server $PROD_HOST controleren..."
  ssh "$PROD_SSH" \
    PROD_API_DIR="$PROD_API_DIR" PROD_WEB_DIR="$PROD_WEB_DIR" PROD_ENV_FILE="$PROD_ENV_FILE" \
    'bash -se' << 'EOF'
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use default > /dev/null 2>&1 || true

command -v npm > /dev/null 2>&1 || { echo "npm niet geïnstalleerd op server"; exit 1; }
command -v pm2 > /dev/null 2>&1 || { echo "pm2 niet geïnstalleerd op server"; exit 1; }
command -v curl > /dev/null 2>&1 || { echo "curl niet geïnstalleerd op server"; exit 1; }
command -v mariadb > /dev/null 2>&1 || { echo "mariadb-client niet geïnstalleerd op server"; exit 1; }

[ -f "$PROD_ENV_FILE" ] || { echo "Ontbreekt: $PROD_ENV_FILE  -> voer eerst optie 1 (server inrichten) uit"; exit 1; }
for key in PORT DB_HOST DB_USER DB_PASSWORD DB_NAME; do
  grep -Eq "^${key}=" "$PROD_ENV_FILE" || { echo "Ontbreekt ${key}=... in $PROD_ENV_FILE"; exit 1; }
done
for dir in "$PROD_API_DIR" "$PROD_WEB_DIR"; do
  [ -w "$dir" ] || { echo "Geen schrijfrechten op $dir -> voer eerst optie 1 (server inrichten) uit"; exit 1; }
done
EOF
  ok "Server OK"
}

# ---------------- SETUP (EENMALIG) ----------------

setup_server() {
  log "Server inrichten (mappen, database, .env, nginx)..."

  local htpasswd_line=""
  read -rp "Admin tijdelijk afschermen met nginx basic auth (zolang er nog geen autorisatie is)? [J/n] " use_basic
  if [[ ! "$use_basic" =~ ^[nN] ]]; then
    command -v openssl > /dev/null || fail "openssl niet geïnstalleerd (nodig voor basic auth)"
    read -rp "  Gebruikersnaam: " basic_user
    read -rsp "  Wachtwoord (leeg = bestaande behouden): " basic_pw; echo
    if [ -n "$basic_pw" ]; then
      # base64: de hash bevat '$' en zou anders door de remote shell worden geëxpandeerd
      htpasswd_line="$(printf '%s:%s' "$basic_user" "$(openssl passwd -apr1 "$basic_pw")" | base64 -w0)"
    fi
    use_basic="ja"
  else
    use_basic="nee"
  fi

  ssh "$PROD_SSH" \
    PROD_USER="$PROD_USER" PROD_API_DIR="$PROD_API_DIR" PROD_WEB_DIR="$PROD_WEB_DIR" \
    PROD_ENV_FILE="$PROD_ENV_FILE" PROD_API_PORT="$PROD_API_PORT" PROD_BASE_PATH="$PROD_BASE_PATH" \
    PROD_DB="$PROD_DB" PROD_DB_USER="$PROD_DB_USER" PROD_BACKUP_DIR="$PROD_BACKUP_DIR" \
    PROD_NGINX_SNIPPET="$PROD_NGINX_SNIPPET" PROD_NGINX_SITE="$PROD_NGINX_SITE" \
    PROD_HTPASSWD="$PROD_HTPASSWD" USE_BASIC="$use_basic" HTPASSWD_LINE="$htpasswd_line" \
    'bash -se' << 'EOF'
set -euo pipefail

sudo -n true 2>/dev/null || { echo "sudo zonder wachtwoord is nodig voor de inrichting"; exit 1; }

# --- mappen ---
sudo mkdir -p "$PROD_API_DIR" "$PROD_WEB_DIR" "$PROD_BACKUP_DIR"
sudo chown -R "$PROD_USER:$PROD_USER" "$PROD_API_DIR" "$PROD_WEB_DIR"
echo "Mappen OK: $PROD_API_DIR, $PROD_WEB_DIR"

# --- database + gebruiker ---
if [ -f "$PROD_ENV_FILE" ]; then
  DB_PASSWORD="$(sed -nE "s/^DB_PASSWORD=['\"]?([^'\"]*)['\"]?$/\1/p" "$PROD_ENV_FILE" | head -n 1)"
fi
if [ -z "${DB_PASSWORD:-}" ]; then
  DB_PASSWORD="$(openssl rand -hex 24)"
fi

sudo mariadb << SQL
CREATE DATABASE IF NOT EXISTS \`${PROD_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${PROD_DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${PROD_DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${PROD_DB}\`.* TO '${PROD_DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
echo "Database '$PROD_DB' en gebruiker '$PROD_DB_USER'@'localhost' OK"

# --- .env ---
if [ ! -f "$PROD_ENV_FILE" ]; then
  umask 077
  cat > "$PROD_ENV_FILE" << ENV
NODE_ENV=production
PORT=${PROD_API_PORT}
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=${PROD_DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${PROD_DB}
ENV
  echo ".env aangemaakt: $PROD_ENV_FILE"
else
  echo ".env bestaat al, niet overschreven: $PROD_ENV_FILE"
fi
chmod 600 "$PROD_ENV_FILE"

# --- nginx ---
AUTH_LINES=""
if [ "$USE_BASIC" = "ja" ]; then
  if [ -n "$HTPASSWD_LINE" ]; then
    echo "$HTPASSWD_LINE" | base64 -d | sudo tee "$PROD_HTPASSWD" > /dev/null
    echo | sudo tee -a "$PROD_HTPASSWD" > /dev/null
    sudo chown root:www-data "$PROD_HTPASSWD"
    sudo chmod 640 "$PROD_HTPASSWD"
  fi
  sudo grep -Eq '^[^:]+:\$apr1\$' "$PROD_HTPASSWD" 2>/dev/null || { echo "Basic auth gekozen maar $PROD_HTPASSWD ontbreekt of bevat geen geldige hash (geef een wachtwoord op)"; exit 1; }
  AUTH_LINES="    auth_basic \"Tourpool beheer\";
    auth_basic_user_file ${PROD_HTPASSWD};"
fi

WEB_PARENT="$(dirname "$PROD_WEB_DIR")"
sudo tee "$PROD_NGINX_SNIPPET" > /dev/null << NGINX
# Tourpool - gegenereerd door deploy_tourpool.sh
location = ${PROD_BASE_PATH} { return 301 ${PROD_BASE_PATH}/; }

location ^~ ${PROD_BASE_PATH}/ {
${AUTH_LINES}
    root ${WEB_PARENT};
    try_files \$uri \$uri/ ${PROD_BASE_PATH}/index.html;
}

location ^~ ${PROD_BASE_PATH}/api/ {
${AUTH_LINES}
    proxy_pass http://127.0.0.1:${PROD_API_PORT}/api/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_redirect off;
}
NGINX
echo "Nginx-snippet geschreven: $PROD_NGINX_SNIPPET"

if grep -q "include $PROD_NGINX_SNIPPET;" "$PROD_NGINX_SITE"; then
  if sudo nginx -t 2>&1; then
    sudo systemctl reload nginx
    echo "Nginx herladen"
  else
    echo "nginx -t faalt, nginx NIET herladen"
    exit 1
  fi
else
  echo
  echo "LET OP: voeg eenmalig deze regel toe BINNEN het 'server { listen 443 ... }'-blok"
  echo "van $PROD_NGINX_SITE, dus vóór de afsluitende '}' van dat blok"
  echo "(niet onderaan het bestand: daar mag geen 'location' staan):"
  echo
  echo "    include $PROD_NGINX_SNIPPET;"
  echo
  echo "en voer daarna uit: sudo nginx -t && sudo systemctl reload nginx"
fi
EOF

  ok "Server ingericht"
  warn "Vul de lege database daarna met optie 2 (database dev → prod)"
}

# ---------------- DATABASE ----------------

dump_dev_db() {
  log "Dev-database dumpen..."

  local dev_user dev_pw dev_db
  dev_user="$(env_value DB_USER "$DEV_ENV_FILE")"
  dev_pw="$(env_value DB_PASSWORD "$DEV_ENV_FILE")"
  dev_db="$(env_value DB_NAME "$DEV_ENV_FILE")"
  [ -n "$dev_user" ] && [ -n "$dev_db" ] || fail "DB_USER/DB_NAME ontbreken in $DEV_ENV_FILE"

  local dump_cmd
  case "$DEV_DB_MODE" in
    docker)
      dump_cmd=(docker exec -e MYSQL_PWD="$dev_pw" "$DEV_CONTAINER" mariadb-dump -u"$dev_user")
      ;;
    local)
      dump_cmd=(mariadb-dump
        --defaults-file=<(printf '[client]\npassword="%s"\n' "$dev_pw")
        -h "$(env_value DB_HOST "$DEV_ENV_FILE")" -P "$(env_value DB_PORT "$DEV_ENV_FILE")" -u"$dev_user")
      ;;
  esac

  # Aanpassingen voor prod (MariaDB 10.11):
  # - sandbox-regel van mariadb-dump 11.x weghalen
  # - DEFINER weghalen (view wordt eigendom van de importerende gebruiker)
  # - collatie uca1400 (MariaDB 11) bestaat niet in 10.11 -> unicode_ci
  "${dump_cmd[@]}" --single-transaction --routines --triggers "$dev_db" \
    | sed -E \
        -e '1{/enable the sandbox mode/d}' \
        -e 's/DEFINER=`[^`]+`@`[^`]+`//g' \
        -e 's/utf8mb4_uca1400_ai_ci/utf8mb4_unicode_ci/g' \
    | gzip > "$TMP_DUMP"

  [ -s "$TMP_DUMP" ] || fail "Dump mislukt"
  ok "Dev-dump gemaakt ($(du -h "$TMP_DUMP" | cut -f1))"
}

backup_and_import_prod_db() {
  log "Dump uploaden..."
  rsync -ah "$TMP_DUMP" "$PROD_SSH:$PROD_IMPORT"

  log "Prod-backup maken en importeren..."
  ssh "$PROD_SSH" \
    PROD_ENV_FILE="$PROD_ENV_FILE" PROD_IMPORT="$PROD_IMPORT" \
    PROD_BACKUP="$PROD_BACKUP" PROD_BACKUP_DIR="$PROD_BACKUP_DIR" \
    'bash -se' << 'EOF'
set -euo pipefail

val() { sed -nE "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*['\"]?([^'\"]*)['\"]?[[:space:]]*$/\1/p" "$PROD_ENV_FILE" | head -n 1; }
DB_USER="$(val DB_USER)"
DB_NAME="$(val DB_NAME)"

# Eigen optiebestand: ~/.my.cnf van de server-gebruiker zou anders het wachtwoord overschrijven.
CNF="$(mktemp)"
trap 'rm -f "$CNF"' EXIT
chmod 600 "$CNF"
printf '[client]\nuser=%s\npassword="%s"\nhost=%s\nport=%s\n' \
  "$DB_USER" "$(val DB_PASSWORD)" "$(val DB_HOST)" "$(val DB_PORT)" > "$CNF"
db() { mariadb --defaults-file="$CNF" "$@"; }
db_dump() { mariadb-dump --defaults-file="$CNF" "$@"; }

tables=$(db -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME'")
if [ "$tables" -gt 0 ]; then
  mkdir -p "$PROD_BACKUP_DIR"
  db_dump --single-transaction --routines --triggers "$DB_NAME" | gzip > "$PROD_BACKUP"
  echo "Backup: $PROD_BACKUP"
else
  echo "Prod-database is leeg, geen backup nodig"
fi

gunzip -c "$PROD_IMPORT" | db "$DB_NAME"
rm -f "$PROD_IMPORT"
echo "Import klaar: $(db -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME'") tabellen/views"
EOF

  rm -f "$TMP_DUMP"
  ok "Database geïmporteerd"
}

confirm_db_overwrite() {
  warn "Dit OVERSCHRIJFT de productiedatabase '$PROD_DB' met de dev-database (er wordt eerst een backup gemaakt)."
  read -rp "Typ '$PROD_DB' om door te gaan: " answer
  [ "$answer" = "$PROD_DB" ] || fail "Afgebroken"
}

sync_db() {
  dump_dev_db
  backup_and_import_prod_db
}

# ---------------- API ----------------

build_api() {
  log "API bouwen..."
  (cd "$ROOT_DIR" && npm run build:api)
  [ -f "$DEV_API_DIR/dist/server.js" ] || fail "Build mislukt: $DEV_API_DIR/dist/server.js ontbreekt"
  ok "API gebouwd"
}

sync_api() {
  log "API uploaden..."
  rsync -az --delete \
    --exclude node_modules \
    --exclude .env \
    "$DEV_API_DIR/dist" \
    "$DEV_API_DIR/migrations" \
    "$DEV_API_DIR/package.json" \
    "$PROD_SSH:$PROD_API_DIR/"

  log "API installeren en (her)starten..."
  ssh "$PROD_SSH" \
    PROD_API_DIR="$PROD_API_DIR" PROD_ENV_FILE="$PROD_ENV_FILE" PROD_PM2_NAME="$PROD_PM2_NAME" \
    'bash -se' << 'EOF'
set -euo pipefail
cd "$PROD_API_DIR"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use default > /dev/null 2>&1 || true

npm install --omit=dev --no-audit --no-fund

if pm2 describe "$PROD_PM2_NAME" > /dev/null 2>&1; then
  pm2 restart "$PROD_PM2_NAME" --update-env
else
  pm2 start dist/server.js --name "$PROD_PM2_NAME" --cwd "$PROD_API_DIR" --time
fi
pm2 save > /dev/null

port="$(sed -nE "s/^PORT=['\"]?([0-9]+)['\"]?$/\1/p" "$PROD_ENV_FILE" | head -n 1)"
for _ in $(seq 1 12); do
  if curl -fsS "http://127.0.0.1:${port}/health" > /dev/null 2>&1 \
    && curl -fsS "http://127.0.0.1:${port}/api/pools" > /dev/null 2>&1; then
    echo "Health check OK (poort $port)"
    exit 0
  fi
  sleep 2
done

echo "API health check mislukt. Laatste logregels:"
pm2 logs "$PROD_PM2_NAME" --lines 30 --nostream || true
exit 1
EOF

  ok "API gedeployed"
}

# ---------------- ADMIN ----------------

build_admin() {
  log "Admin bouwen..."
  (cd "$ROOT_DIR" && npm run build:admin)
  [ -f "$DEV_ADMIN_DIR/dist/index.html" ] || fail "Build mislukt: $DEV_ADMIN_DIR/dist/index.html ontbreekt"
  ok "Admin gebouwd"
}

sync_admin() {
  log "Admin uploaden..."
  rsync -rltz --delete --no-perms --no-owner --no-group \
    "$DEV_ADMIN_DIR/dist/" \
    "$PROD_SSH:$PROD_WEB_DIR/"
  ok "Admin gedeployed: https://jota.nl${PROD_BASE_PATH}/"
}

# ---------------- MENU ----------------

echo
echo "TOURPOOL DEPLOY → $PROD_HOST"
echo "--------------------------------"
echo "1) Server inrichten (eenmalig: mappen, database, .env, nginx)"
echo "2) Database (dev → prod, overschrijft prod!)"
echo "3) API"
echo "4) Admin"
echo "5) API + Admin"
echo "6) Alles (Database + API + Admin)"
echo

read -rp "Keuze: " choice
echo "=== $(date '+%Y-%m-%d %H:%M:%S') keuze $choice ===" >> "$LOG_FILE"

case "$choice" in
  1)
    check_base_dependencies
    setup_server
    ;;
  2)
    check_base_dependencies
    check_db_dependencies
    preflight_prod
    confirm_db_overwrite
    sync_db
    ;;
  3)
    check_base_dependencies
    preflight_prod
    build_api
    sync_api
    ;;
  4)
    check_base_dependencies
    preflight_prod
    build_admin
    sync_admin
    ;;
  5)
    check_base_dependencies
    preflight_prod
    build_api
    build_admin
    sync_api
    sync_admin
    ;;
  6)
    check_base_dependencies
    check_db_dependencies
    preflight_prod
    confirm_db_overwrite
    build_api
    build_admin
    sync_db
    sync_api
    sync_admin
    ;;
  *)
    fail "Ongeldige keuze"
    ;;
esac

ok "Deploy klaar"
