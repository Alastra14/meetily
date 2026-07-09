#!/bin/bash
# Ternova Meet — backup del Postgres del gateway (keys, consumo/log de auditoría).
# Criterio de David: on-prem los cortes de luz SÍ pasan; sin persistencia+backup se
# pierden las API keys y el histórico de consumo → se pierde la gobernanza.
# Programar en cron (ej. diario 02:00). EJECUTAR EN LA DGX.
set -euo pipefail

OUT_DIR="${OUT_DIR:-$HOME/backups/tn-gateway}"
KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"

docker exec tn-postgres pg_dump -U litellm litellm | gzip > "$OUT_DIR/litellm-$STAMP.sql.gz"
echo "backup: $OUT_DIR/litellm-$STAMP.sql.gz"

# retención
find "$OUT_DIR" -name 'litellm-*.sql.gz' -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true

# cron sugerido (crontab -e):
#   0 2 * * * /home/alastra/meetily-deploy/backup-postgres.sh >> /home/alastra/backups/tn-gateway/backup.log 2>&1
