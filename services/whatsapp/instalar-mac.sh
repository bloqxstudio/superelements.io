#!/bin/bash
# O serviço do WhatsApp da equipe neste Mac (ver src/main.ts): instala e deixa rodando sempre.
# Sobe sozinho quando a conta entra no Mac e volta se cair; o Mac não dorme enquanto ele roda.
#
#   bash services/whatsapp/instalar-mac.sh            instala, ou atualiza (rode de novo depois de um git pull)
#   bash services/whatsapp/instalar-mac.sh --remover  para o serviço e tira do Mac
#
# Pede uma vez a chave service_role do Supabase e guarda em services/whatsapp/.env.local, que não vai
# para o git. O endereço do Supabase vem do .env da raiz do repositório.
set -euo pipefail

LABEL="com.avencestudio.whatsapp"
DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/avence-whatsapp.log"
ENV_FILE="$DIR/.env.local"
DOMAIN="gui/$(id -u)"

step() { printf '\n\033[1m%s\033[0m\n' "$1"; }
warn() { printf '\033[33m%s\033[0m\n' "$1"; }
fail() { printf '\n\033[31m%s\033[0m\n' "$1" >&2; exit 1; }

[ "$(uname)" = "Darwin" ] || fail "Este instalador é para macOS."

if [ "${1:-}" = "--remover" ]; then
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Serviço parado e removido deste Mac. A chave continua em $ENV_FILE (apague se quiser)."
  exit 0
fi

# ---------- 1. Node 22.18 ou mais novo ----------
step "1/5  Node"
node_ok() { "$1" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=18)?0:1)' 2>/dev/null; }
NODE="$(command -v node 2>/dev/null || true)"
# O PATH de um terminal recém-aberto pode ainda não ter o Homebrew
for p in /opt/homebrew/bin/node /usr/local/bin/node; do
  if [ -z "$NODE" ] && [ -x "$p" ]; then NODE="$p"; fi
done
if [ -z "$NODE" ] || ! node_ok "$NODE"; then
  BREW="$(command -v brew 2>/dev/null || true)"
  for p in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    if [ -z "$BREW" ] && [ -x "$p" ]; then BREW="$p"; fi
  done
  if [ -n "$BREW" ]; then
    echo "Instalando o Node pelo Homebrew…"
    if "$BREW" list node >/dev/null 2>&1; then "$BREW" upgrade node; else "$BREW" install node; fi
    NODE="$("$BREW" --prefix)/bin/node"
  else
    fail "Falta o Node 22.18 ou mais novo. Baixe o instalador LTS em https://nodejs.org, instale e rode este script de novo."
  fi
fi
node_ok "$NODE" || fail "O Node em $NODE é antigo ($("$NODE" -v)). Atualize para 22.18 ou mais novo e rode de novo."
# O npm chama o node pelo PATH
export PATH="$(dirname "$NODE"):$PATH"
echo "Node $("$NODE" -v) em $NODE"

# ---------- 2. Dependências ----------
step "2/5  Dependências"
cd "$DIR"
"$(dirname "$NODE")/npm" ci --omit=dev --ignore-scripts --no-audit --no-fund

# ---------- 3. A chave do Supabase ----------
step "3/5  Chave do Supabase"
if grep -q '^SUPABASE_SERVICE_ROLE_KEY=.' "$ENV_FILE" 2>/dev/null; then
  echo "Já guardada em $ENV_FILE"
else
  echo "Cole a chave service_role do Supabase (Project Settings › API Keys; é a SUPABASE_SERVICE_ROLE_KEY"
  echo "do .env.local do outro computador). Ela não aparece enquanto você cola; depois aperte Enter."
  read -r -s -p "Chave: " KEY
  echo
  [ -n "$KEY" ] || fail "Sem a chave o serviço não fala com o Supabase."
  (umask 077 && printf 'SUPABASE_SERVICE_ROLE_KEY=%s\n' "$KEY" > "$ENV_FILE")
  echo "Guardada em $ENV_FILE"
fi

# ---------- 4. Conferir ----------
step "4/5  Conferindo o Supabase"
set +e
"$NODE" src/main.ts --check
CHECK=$?
set -e
if [ "$CHECK" -eq 2 ]; then
  warn "Instalo mesmo assim: assim que a migração for aplicada, o serviço começa a atender sozinho."
elif [ "$CHECK" -ne 0 ]; then
  fail "Não deu para falar com o Supabase (mensagem acima). Se a chave estiver errada, apague $ENV_FILE e rode de novo."
fi

# ---------- 5. Rodando sempre (launchd) ----------
step "5/5  Deixando rodando sempre"
mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$DIR/src/main.ts</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$(dirname "$NODE"):/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>$LOG</string>
  <key>StandardErrorPath</key>
  <string>$LOG</string>
</dict>
</plist>
PLIST
plutil -lint "$PLIST" >/dev/null || fail "O arquivo do serviço saiu inválido: $PLIST"

# Para a versão anterior antes de subir esta (duas cópias com o mesmo número se derrubam)
launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
sleep 1
launchctl bootstrap "$DOMAIN" "$PLIST"
launchctl enable "$DOMAIN/$LABEL"
sleep 4

STATE="$(launchctl print "$DOMAIN/$LABEL" 2>/dev/null || true)"
if [[ "$STATE" == *"state = running"* ]]; then
  echo "Rodando. Últimas linhas do log:"
  tail -n 5 "$LOG" 2>/dev/null || true
else
  tail -n 20 "$LOG" 2>/dev/null || true
  fail "O serviço não ficou de pé. Veja o log acima ou em $LOG"
fi

cat <<FIM

Pronto. Agora abra CRM › WhatsApp no app, clique em "Conectar o WhatsApp" e leia o QR code com o celular.

- O serviço volta sozinho se cair e quando o Mac reiniciar, depois que a sua conta entrar.
  Para entrar sem ninguém digitar a senha: Ajustes do Sistema › Usuários e Grupos › Iniciar sessão
  automaticamente (com o FileVault ligado o macOS não deixa).
- Deixe o MacBook na tomada e com a tampa aberta: fechado, ele dorme mesmo assim.
- Não rode "npm run whatsapp" neste Mac nem em outro computador: duas cópias derrubam o número.
- Log ao vivo:  tail -f "$LOG"
- Atualizar:    git pull && bash services/whatsapp/instalar-mac.sh
- Remover:      bash services/whatsapp/instalar-mac.sh --remover
FIM
