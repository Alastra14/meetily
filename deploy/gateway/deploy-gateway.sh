#!/bin/bash
# Ternova Meet — despliegue del API Gateway (LiteLLM) en la DGX Spark.
# EJECUTAR EN LA DGX, con OK del oficial de seguridad (ver docs/security/POL-TIC-001-checklist.md).
# Requiere: docker, la variable LITELLM_MASTER_KEY exportada (resguardada por el CISO).
#
# El gateway queda como ÚNICO punto de red autenticado; los modelos crudos NO se
# exponen a la red (ver lockdown-raw-ports.sh). TLS lo termina Caddy delante (runbook).
set -euo pipefail

: "${LITELLM_MASTER_KEY:?exporta LITELLM_MASTER_KEY (no lo pongas en el repo)}"
CFG="${CFG:-$HOME/litellm/config.yaml}"
LAN_IP="${LAN_IP:-172.16.1.135}"      # interfaz de la VPN corporativa
TS_IP="${TS_IP:-100.118.240.39}"      # tailscale (solo administración)
PORT="${PORT:-8088}"

mkdir -p "$(dirname "$CFG")"
[ -f "$CFG" ] || { echo "Falta $CFG (copia deploy/gateway/config.yaml)"; exit 1; }

docker rm -f tn-gateway 2>/dev/null || true
docker run -d --name tn-gateway --restart unless-stopped \
  -e LITELLM_MASTER_KEY="$LITELLM_MASTER_KEY" \
  -p "${LAN_IP}:${PORT}:4000" \
  -p "${TS_IP}:${PORT}:4000" \
  -p "127.0.0.1:${PORT}:4000" \
  -v "$CFG:/app/config.yaml" \
  ghcr.io/berriai/litellm:main-latest \
  --config /app/config.yaml --port 4000

echo "esperando arranque…"
for i in $(seq 1 30); do
  curl -s --max-time 3 "http://127.0.0.1:${PORT}/health/liveliness" >/dev/null 2>&1 && { echo "✅ gateway vivo"; break; }
  sleep 4
done

echo "== prueba con master key (debe 200) =="
curl -s -o /dev/null -w "auth OK: %{http_code}\n" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" "http://127.0.0.1:${PORT}/v1/models"
echo "== prueba SIN key (debe 401) =="
curl -s -o /dev/null -w "sin auth: %{http_code}\n" "http://127.0.0.1:${PORT}/v1/models"

cat <<'NEXT'

Siguiente:
  1) Crear virtual key por usuario (ej. el jefe), con rate-limit:
     curl -s http://127.0.0.1:8088/key/generate \
       -H "Authorization: Bearer $LITELLM_MASTER_KEY" -H "Content-Type: application/json" \
       -d '{"key_alias":"jefe","max_parallel_requests":2,"rpm_limit":60}'
  2) Correr lockdown-raw-ports.sh para sacar los modelos crudos de la red.
  3) Poner Caddy delante para TLS (ver runbook) antes de datos reales.
NEXT
