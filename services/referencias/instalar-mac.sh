#!/bin/bash
# O leitor de referências do Instagram neste Mac (ver src/main.ts): instala e deixa rodando sempre.
#
#   bash services/referencias/instalar-mac.sh            instala, ou atualiza (rode de novo depois de um git pull)
#   bash services/referencias/instalar-mac.sh --remover  para o serviço e tira do Mac
#
# Usa a mesma chave service_role do serviço do WhatsApp (services/whatsapp/.env.local) e o Chrome deste Mac,
# com um perfil próprio. Antes de instalar, entre na conta do Instagram uma vez:
#   npm run referencias -- entrar
set -euo pipefail

LABEL="com.avencestudio.referencias"
DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/avence-referencias.log"
DOMAIN="gui/$(id -u)"

fail() { printf '\n\033[31m%s\033[0m\n' "$1" >&2; exit 1; }
[ "$(uname)" = "Darwin" ] || fail "Este instalador é para macOS."

if [ "${1:-}" = "--remover" ]; then
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Leitor de referências parado e removido deste Mac. A sessão do Instagram continua no perfil próprio (apague ~/Library/Application Support/avence-referencias se quiser)."
  exit 0
fi

NODE="$(command -v node 2>/dev/null || true)"
for p in /opt/homebrew/bin/node /usr/local/bin/node; do [ -z "$NODE" ] && [ -x "$p" ] && NODE="$p"; done
[ -n "$NODE" ] || fail "Falta o Node 22.18 ou mais novo."
[ -d "/Applications/Google Chrome.app" ] || fail "Falta o Google Chrome em /Applications."
for b in yt-dlp ffmpeg; do command -v "$b" >/dev/null 2>&1 || [ -x "/opt/homebrew/bin/$b" ] || echo "Aviso: falta o $b (brew install $b); sem ele os vídeos entram só com a capa."; done
[ -f "$DIR/../whatsapp/.env.local" ] || [ -f "$DIR/.env.local" ] || fail "Falta a chave do Supabase: instale antes o serviço do WhatsApp ou crie services/referencias/.env.local com SUPABASE_SERVICE_ROLE_KEY=…"

cd "$DIR"
"$(dirname "$NODE")/npm" ci --omit=dev --ignore-scripts --no-audit --no-fund

mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$NODE</string><string>$DIR/src/main.ts</string></array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$(dirname "$NODE"):/opt/homebrew/bin:$HOME/.local/bin:/usr/bin:/bin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST
plutil -lint "$PLIST" >/dev/null || fail "O arquivo do serviço saiu inválido: $PLIST"
launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
sleep 1
launchctl bootstrap "$DOMAIN" "$PLIST"
launchctl enable "$DOMAIN/$LABEL"
sleep 3
echo "Rodando. Log ao vivo: tail -f \"$LOG\""
echo "Atualizar: git pull && bash services/referencias/instalar-mac.sh   ·   Remover: bash services/referencias/instalar-mac.sh --remover"
