#!/bin/sh
# Stage 1 DevOps — Automated Deployment (POSIX sh)
# Deploy a Dockerized app to a remote Ubuntu server behind Nginx.
# Features: prompts, validation, logging, idempotent redeploy, optional --cleanup.
# Run locally (macOS/Linux/Git Bash/WSL).

set -eu

# ---------- Globals & logging ----------
TS="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="deploy_${TS}.log"
WORKDIR="$(pwd)"
LOCAL_CLONE_DIR="$WORKDIR/_build_repo"
REMOTE_BASE_DIR_DEFAULT="\$HOME/apps"
APP_NAME=""
CLEANUP_ONLY=0

log() { printf '%s %s\n' "$(date +'%F %T')" "$*" | tee -a "$LOG_FILE"; }
fail() { log "ERROR: $*"; log "See log: $LOG_FILE"; exit 1; }

# ---------- Trap ----------
cleanup_tmp() {
  # nothing to clean locally beyond build dir; preserve for debugging
  :
}
trap cleanup_tmp EXIT INT

# ---------- Helpers ----------
prompt_req() {
  v=""
  while [ -z "${v:-}" ]; do
    printf "%s: " "$1"
    IFS= read -r v || true
    [ -n "$v" ] || log "Value required."
  done
  printf "%s" "$v"
}

prompt_opt() {
  # $1 label, $2 default
  printf "%s (default: %s): " "$1" "$2"
  IFS= read -r v || true
  if [ -z "${v:-}" ]; then printf "%s" "$2"; else printf "%s" "$v"; fi
}

remote_run() {
  # $1 cmd
  ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "$SSH_USER@$SERVER_IP" "$1"
}

have_cmd() { command -v "$1" >/dev/null 2>&1; }

# ---------- Flags ----------
# Only supported flag: --cleanup  (remove deployed resources and exit)
if [ "${1:-}" = "--cleanup" ]; then
  CLEANUP_ONLY=1
fi

# ---------- Collect parameters (interactive) ----------
log "=== Stage 1 DevOps — Deploy Script ==="
REPO_URL="$(prompt_req 'Git Repository URL (HTTPS, e.g., https://github.com/user/app.git)')"
GIT_PAT="$(prompt_req 'GitHub Personal Access Token (PAT with repo read access)')"
BRANCH="$(prompt_opt 'Branch name' 'main')"
SSH_USER="$(prompt_opt 'Remote SSH username' 'ubuntu')"
SERVER_IP="$(prompt_req 'Remote server IP address')"
SSH_KEY_PATH="$(prompt_opt 'Path to SSH private key' "$HOME/.ssh/id_rsa")"
APP_PORT_INTERNAL="$(prompt_req 'Application internal (container) port (e.g., 8080)')"
REMOTE_BASE_DIR_INPUT="$(prompt_opt 'Remote base dir for apps' "$REMOTE_BASE_DIR_DEFAULT")"

# Normalize and derive names
[ -f "$SSH_KEY_PATH" ] || fail "SSH key not found at $SSH_KEY_PATH"
chmod 600 "$SSH_KEY_PATH" 2>/dev/null || true
APP_NAME="$(basename "$REPO_URL" .git)"
REMOTE_BASE_DIR="$(remote_run "eval echo $REMOTE_BASE_DIR_INPUT" 2>/dev/null || printf "%s" "$REMOTE_BASE_DIR_INPUT")"
REMOTE_APP_DIR="$REMOTE_BASE_DIR/$APP_NAME"

log "Repo:        $REPO_URL (branch $BRANCH)"
log "Server:      $SSH_USER@$SERVER_IP"
log "App name:    $APP_NAME"
log "Remote dir:  $REMOTE_APP_DIR"
log "Internal port: $APP_PORT_INTERNAL"

# ---------- SSH preflight ----------
log "=== Preflight: SSH ==="
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no -o BatchMode=yes "$SSH_USER@$SERVER_IP" "echo ok" >/dev/null 2>&1 \
  || fail "Cannot SSH to $SSH_USER@$SERVER_IP. Check IP/user/key perms."

# ---------- Cleanup mode ----------
if [ "$CLEANUP_ONLY" -eq 1 ]; then
  log "=== Cleanup mode: removing app, containers, and nginx site ==="
  remote_run "
    set -eu
    APP='$APP_NAME'
    DIR='$REMOTE_APP_DIR'
    # stop compose or single container
    if [ -d \"\$DIR\" ]; then
      cd \"\$DIR\"
      if [ -f docker-compose.yml ]; then
        if command -v docker compose >/dev/null 2>&1; then
          docker compose down || true
        else
          docker-compose down || true
        fi
      else
        docker rm -f \${APP}_ctr >/dev/null 2>&1 || true
      fi
    fi
    # remove nginx site
    if [ -f /etc/nginx/sites-enabled/\${APP}.conf ]; then sudo rm -f /etc/nginx/sites-enabled/\${APP}.conf; fi
    if [ -f /etc/nginx/sites-available/\${APP}.conf ]; then sudo rm -f /etc/nginx/sites-available/\${APP}.conf; fi
    sudo nginx -t >/dev/null 2>&1 && sudo systemctl reload nginx || true
    # remove code
    rm -rf \"\$DIR\"
  "
  log "Cleanup complete."
  exit 0
fi

# ---------- Local clone (with PAT) ----------
log "=== Clone app repo locally ==="
rm -rf "$LOCAL_CLONE_DIR"
mkdir -p "$LOCAL_CLONE_DIR"
# inject PAT into https URL
AUTH_REPO_URL="$(printf '%s' "$REPO_URL" | sed "s#https://#https://${GIT_PAT}@#")"

( cd "$LOCAL_CLONE_DIR" && git clone --branch "$BRANCH" --depth 1 "$AUTH_REPO_URL" ) \
  || fail "Git clone failed (branch? PAT?)."
PROJECT_DIR="$LOCAL_CLONE_DIR/$APP_NAME"
[ -d "$PROJECT_DIR" ] || fail "Project directory not found after clone."

HAS_COMPOSE=0; [ -f "$PROJECT_DIR/docker-compose.yml" ] && HAS_COMPOSE=1
HAS_DOCKERFILE=0; [ -f "$PROJECT_DIR/Dockerfile" ] && HAS_DOCKERFILE=1
[ "$HAS_COMPOSE" -eq 1 ] || [ "$HAS_DOCKERFILE" -eq 1 ] || fail "Need a Dockerfile or docker-compose.yml in the repo."

log "compose=$HAS_COMPOSE dockerfile=$HAS_DOCKERFILE"

# ---------- Prepare remote (Docker + Nginx) ----------
log "=== Prepare remote (Docker, Nginx) ==="
remote_run "
  set -eu
  mkdir -p $REMOTE_BASE_DIR
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates curl gnupg lsb-release rsync || true
  if ! command -v docker >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $SSH_USER || true
    sudo systemctl enable docker --now
  fi
  if ! command -v nginx >/dev/null 2>&1; then
    sudo apt-get install -y nginx
    sudo systemctl enable nginx --now
  fi
  docker --version || true
  nginx -v || true
"

# ---------- Ship project (rsync preferred; fallback to scp) ----------
log "=== Transfer project to remote ==="
if have_cmd rsync; then
  rsync -az -e "ssh -i $SSH_KEY_PATH" --delete \
    --exclude ".git" --exclude "_build_repo" \
    "$PROJECT_DIR/" "$SSH_USER@$SERVER_IP:$REMOTE_APP_DIR/"
else
  # fallback (scp -r)
  remote_run "rm -rf '$REMOTE_APP_DIR' && mkdir -p '$REMOTE_APP_DIR'"
  scp -i "$SSH_KEY_PATH" -r "$PROJECT_DIR"/* "$SSH_USER@$SERVER_IP:$REMOTE_APP_DIR/"
fi

# ---------- Deploy on remote ----------
log "=== Deploy containers on remote ==="
REMOTE_DEPLOY="
  set -eu
  cd $REMOTE_APP_DIR
  if [ -f docker-compose.yml ]; then
    if command -v docker compose >/dev/null 2>&1; then
      docker compose down || true
      docker compose up -d --build
    else
      docker-compose down || true
      docker-compose up -d --build
    fi
  elif [ -f Dockerfile ]; then
    IMG=${APP_NAME}:latest
    CON=${APP_NAME}_ctr
    docker rm -f \$CON >/dev/null 2>&1 || true
    docker build -t \$IMG .
    # Bind to loopback to keep port private; Nginx will proxy from :80
    docker run -d --name \$CON -p 127.0.0.1:${APP_PORT_INTERNAL}:${APP_PORT_INTERNAL} -e PORT=${APP_PORT_INTERNAL} \$IMG
  else
    echo 'No Dockerfile or docker-compose.yml'; exit 1
  fi
  sleep 3
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
"
remote_run "$REMOTE_DEPLOY"

# ---------- Nginx reverse proxy ----------
log "=== Configure Nginx reverse proxy (80 -> ${APP_PORT_INTERNAL}) ==="
NGINX_CONF_PATH="/etc/nginx/sites-available/${APP_NAME}.conf"
REMOTE_NGINX="
  set -eu
  sudo bash -c 'cat > $NGINX_CONF_PATH' <<'NGX'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT_INTERNAL};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
    }
}
NGX
  sudo ln -sf $NGINX_CONF_PATH /etc/nginx/sites-enabled/${APP_NAME}.conf
  if [ -f /etc/nginx/sites-enabled/default ]; then sudo rm -f /etc/nginx/sites-enabled/default; fi
  sudo nginx -t
  sudo systemctl reload nginx
"
remote_run "$REMOTE_NGINX"

# ---------- Validation ----------
log "=== Validate ==="
if curl -sSf "http://$SERVER_IP/health" >/dev/null 2>&1; then
  log "Health endpoint OK at http://$SERVER_IP/health"
else
  if curl -sSf "http://$SERVER_IP" >/dev/null 2>&1; then
    log "Root endpoint reachable at http://$SERVER_IP"
  else
    log "WARN: Could not reach http://$SERVER_IP (check firewall/security group)."
  fi
fi

remote_run "
  set -eu
  echo '--- Remote service statuses ---'
  systemctl is-active --quiet docker && echo 'Docker: active' || echo 'Docker: not active'
  systemctl is-active --quiet nginx  && echo 'Nginx: active'  || echo 'Nginx: not active'
  echo '--- Local container HTTP code ---'
  curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:${APP_PORT_INTERNAL} || true
" | tee -a "$LOG_FILE"

log "=== Done. Log file: $LOG_FILE ==="
