# Runbook — Gateway DGX para Ternova Meet (rollout conforme)

Orden de ejecución para servir los modelos de la DGX a la organización cumpliendo
POL-TIC-001 + PT-ARQ-004. Ver ADR `docs/adrs/ADR-MEET-001-dgx-gateway.md` y el checklist
`docs/security/POL-TIC-001-checklist.md`.

## 0. Gobernanza (bloquea el rollout org-wide)
1. Presentar el **ADR** al Architecture Board y solicitar **Waiver** (Legacy/Técnica) por DGX on-prem.
2. Correr el **checklist** con el **oficial de seguridad**; obtener su **firma** antes de exponer a nadie fuera del piloto.
3. Registrar DGX + servicios en el **inventario de activos**; clasificar datos (Confidencial → SharePoint).

## 1. Cerrar la exposición insegura (HACER YA — no requiere sign-off)
En la DGX:
```
bash deploy/gateway/lockdown-raw-ports.sh
```
Deja de exponer 8003/8004/8005 sin auth. (Mientras tanto, no distribuir el .dmg de piloto ampliamente.)

## 2. Prerrequisitos de TI (👤)
- **Entra:** App Registration para el gateway (OAuth2/JWT) + asignar el **grupo VPN** a los usuarios.
- **Key Vault:** guardar `LITELLM_MASTER_KEY` y virtual keys (resguardo del CISO).
- **Redes:** DNS interno `dgx-gateway.ternova.group → 172.16.1.135` + **reserva DHCP** de esa IP.
- **PKI:** cert TLS de **CA interna** para `dgx-gateway.ternova.group` (para Caddy).

## 3. Desplegar el gateway (tras OK de seguridad)
En la DGX (con `LITELLM_MASTER_KEY` exportada desde Key Vault):
```
cp deploy/gateway/config.yaml ~/litellm/config.yaml
export LITELLM_MASTER_KEY='...'          # desde Key Vault, NO del repo
bash deploy/gateway/deploy-gateway.sh
```
Verifica: `/v1/models` con key = 200, sin key = 401.

## 4. TLS (Caddy delante) — antes de datos reales
`caddy` como reverse-proxy con el cert de CA interna, terminando HTTPS en
`https://dgx-gateway.ternova.group` → `127.0.0.1:8088`. (Config Caddy: pendiente, requiere el cert.)

## 5. Virtual key por usuario
```
curl -s https://dgx-gateway.ternova.group/key/generate \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" -H "Content-Type: application/json" \
  -d '{"key_alias":"jefe","max_parallel_requests":2,"rpm_limit":60}'
```

## 6. Build de la app apuntando al gateway
```
cd frontend
TERNOVA_DGX_TRANSCRIBE_ENDPOINT=https://dgx-gateway.ternova.group/v1 \
TERNOVA_DGX_SUMMARY_ENDPOINT=https://dgx-gateway.ternova.group/v1 \
NEXT_PUBLIC_TERNOVA_DGX_SUMMARY_ENDPOINT=https://dgx-gateway.ternova.group/v1 \
NEXT_PUBLIC_TERNOVA_DGX_SUMMARY_MODEL=qwen3.6-35b \
pnpm tauri:build
```
El usuario pega su **API key** en Ajustes → Transcripción / Chat (campo "API key" ya existe).
Modelos: transcripción `parakeet` (o `whisper-large-v3`), resumen/chat `qwen3.6-35b`.

## 7. Hardening del prototipo (criterio de David — [[Criterio de David]])
Barato y alto valor, hacer esta semana:
- **Secretos fuera de git:** `LITELLM_MASTER_KEY` y `DATABASE_URL` por `.env`/Key Vault (nunca en repo).
- **Backup del Postgres:** `deploy/gateway/backup-postgres.sh` en cron diario (keys + histórico de consumo).
- **Red cerrada:** `lockdown-raw-ports.sh` — que vLLM `:8000` y el Postgres NO sean alcanzables por
  fuera del gateway.
- **Log de auditoría/FinOps:** por virtual key queda quién/modelo/cuándo; exportar consumo por
  centro de costo (LiteLLM `/spend`).
- **GPU:** dejar `--gpu-memory-utilization 0.30` (script `~/lower-vllm-030.sh`) — memoria unificada, si se satura reinicia.
- **Bus-factor:** este runbook + un segundo responsable del despliegue (que no quede solo en una cabeza).
- **Contrato versionado `/v1`** desde ya (la app de toda la org depende de él).
- **Dato sensible:** transcripciones = Confidencial → TDR firmado con dueño del dato antes de producción.

## 8. Fase 2 (modernización Azure, documentada)
Migrar/**envolver** con un **BFF/gateway** (Entra/OAuth2-JWT; Spring Cloud Gateway candidato si
Ternova va a JVM) sobre LiteLLM (que queda como anti-corruption layer a los modelos) + **Azure APIM
+ Key Vault + App Insights**; IaC en Terraform. Cierra el Waiver. Confirmar con Gerson/Rojas/Pedro/Carlos.
