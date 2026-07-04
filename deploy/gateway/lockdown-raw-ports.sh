#!/bin/bash
# Ternova Meet — CIERRA la exposición sin auth de los modelos crudos en la DGX.
# EJECUTAR EN LA DGX. Deja como ÚNICO punto de red al gateway autenticado (tn-gateway).
# Revierte los binds 0.0.0.0 que se usaron en el piloto (postura NO conforme para producción).
#
# Ejecútalo APENAS puedas (aunque el gateway aún no esté), para no dejar 8003/8004/8005
# abiertos sin autenticación en la LAN corporativa.
set -euo pipefail

echo "== deteniendo proxies socat de modelos crudos (los reemplaza el gateway) =="
sudo systemctl disable --now vllm-lan-proxy.service parakeet-lan-proxy.service 2>/dev/null || true

echo "== whisper-asr: sacarlo de la red, dejarlo solo en localhost + bridge docker =="
# El gateway (contenedor) lo alcanza por 172.17.0.1; deja de escuchar en la LAN/tailscale.
sudo sed -i 's|--host 0.0.0.0|--host 172.17.0.1|' /etc/systemd/system/whisper-asr.service
sudo systemctl daemon-reload
sudo systemctl restart whisper-asr.service 2>/dev/null || true

echo "== estado: NO debe quedar 8003/8004/8005 en 0.0.0.0 ni en la IP de LAN =="
ss -ltn | grep -E ':(8003|8004|8005)' || echo '(sin binds de modelos crudos en la red — correcto)'
echo "== el único punto de red debe ser el gateway :8088 =="
ss -ltn | grep -E ':8088' || echo '(gateway aún no desplegado)'
