# Checklist de seguridad — Ternova Meet + Gateway DGX (POL-TIC-001)

> Para el **oficial de seguridad / CISO**. Estado del cumplimiento del acceso org-wide a los
> modelos de la DGX vía Ternova Meet. Leyenda: ✅ hecho · ⚠️ parcial/interino · ❌ pendiente · 👤 requiere acción de TI/personas.
> **Regla:** ningún rollout org-wide hasta el visto bueno firmado del oficial de seguridad.

## Exposición y perímetro
- [✅] Modelos crudos fuera de la red (solo localhost + bridge docker) tras `lockdown-raw-ports.sh`.
- [✅] Único punto de red = API Gateway autenticado, **solo por VPN corporativa** (no público).
- [❌] 👤 Checklist de seguridad del proyecto corrido y **firmado** por el oficial de seguridad ANTES de exponer.
- [⚠️] Piloto actual dejó puertos 8003/8004/8005 en `0.0.0.0` sin auth → **cerrar ya** con el script de lockdown.

## APIs / Web services
- [✅] API Gateway OpenAI-compatible, versionable `/v1`.
- [⚠️] Autenticación: **API key por usuario** (interina) → objetivo **OAuth2/JWT con Entra ID**.
- [✅] Rate limiting (global + por virtual key).
- [✅] Log de solicitudes/respuestas (persistencia real a Postgres/App Insights: ❌ pendiente).
- [⚠️] HTTPS/TLS: se termina con **Caddy** delante del gateway → 👤 requiere **cert de CA interna**.
- [✅] Filtrado/aislamiento: la app no toca los modelos directo (sin P2P).

## Identidad y accesos
- [✅] Perímetro con **Entra ID + MFA** (VPN corporativa).
- [❌] 👤 App Registration en Entra para OAuth2/JWT del gateway (software crítico → EntraID + Microsoft Identity).
- [❌] 👤 Asignación del **grupo VPN** en Entra para los usuarios (hoy alastra@ternova.group bloqueado, AADSTS50105).
- [⚠️] RBAC: virtual keys por usuario con límites; roles finos → con Entra.

## Credenciales y cifrado
- [❌] 👤 `master_key` y virtual keys **resguardadas por el oficial de seguridad** / **Key Vault** (hoy en archivo temporal, NO en repo).
- [⚠️] Cifrado en tránsito: pendiente TLS (arriba). Datos de reuniones = **Confidencial**.
- [✅] Sin secretos en el repo (config usa `os.environ/LITELLM_MASTER_KEY`).

## Datos
- [❌] 👤 Clasificar transcripciones/resúmenes como **Confidencial**; docs del proyecto en **SharePoint**.
- [✅] Los datos NO salen de Ternova (inferencia local en la DGX; alinea PT-IA-003).

## Arquitectura / gobierno
- [❌] 👤 **Waiver** del Architecture Board (Legacy/Técnica) por DGX on-prem vs estándar Azure.
- [✅] ADR documentado (`docs/adrs/ADR-MEET-001-dgx-gateway.md`).
- [⚠️] IaC: `docker run`/compose → migrar a **Terraform/Bicep**.
- [❌] Observabilidad: App Insights / métricas por SLO.
- [❌] 👤 Registrar DGX + servicios en el **inventario de activos**.
- [⚠️] Zona gris preexistente (Tailscale, SSH admin, socat, SearXNG a internet, WhatsApp bridge)
  a declarar/waiverar con el oficial de seguridad.

## Continuidad
- [✅] Servicios systemd `Restart=always`, sobreviven reboot.
- [⚠️] `gpu-memory-utilization` del vLLM en 0.40 (subido sin registro) → bajar a 0.30 (script `~/lower-vllm-030.sh`) por el reboot por memoria unificada.
