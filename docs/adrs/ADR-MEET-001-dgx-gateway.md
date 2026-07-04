# ADR-MEET-001 — Acceso org-wide a los modelos de la DGX Spark para Ternova Meet

- **Estado:** **Aprobado como PROTOTIPO** por A. Lastra (TI/Arquitectura) el 2026-07-04.
  Producción org-wide sigue pendiente de: firma del **oficial de seguridad** (checklist) + **Waiver** del Architecture Board.
- **Fecha:** 2026-07-04
- **Dominio:** Ternova Meet (asistente de reuniones) · **Autor:** A. Lastra
- **Marco:** PT-ARQ-004 (arquitectura) + POL-TIC-001 (seguridad) + PT-IA-003 (IA).

## Excepción de prototipo (EXC-U-2026 — Urgencia/POC)
- **Alcance:** piloto controlado en la red interna (VPN/Tailscale), gateway **autenticado**,
  usuarios limitados (arranca con 1: el jefe), **sin datos confidenciales de producción** hasta la
  firma del CISO. Es un prototipo dentro del protocolo, aprobado por el responsable del proceso (TI).
- **Expiración:** 30 días (regla de Waiver tipo Urgencia) o hasta el visto bueno formal del oficial
  de seguridad, lo que ocurra primero. Al vencer: cerrar o migrar a la ruta conforme completa.
- **Mitigaciones activas durante el prototipo:** modelos crudos fuera de la red (solo gateway),
  auth por API key + rate-limit + log, acceso solo por VPN/Tailscale, secreto fuera del repo.
- **Pendiente para producción (no cubierto por esta aprobación de prototipo):** OAuth2/JWT con Entra,
  TLS con CA interna, Key Vault, DNS interno, inventario de activos, Waiver del Board, firma del CISO.

## Contexto
Ternova Meet (app de escritorio) necesita transcripción y resumen/chat servidos por la **DGX
Spark** (on-prem, GB10) para toda la organización. La app habla protocolo OpenAI. Hoy los
modelos corren en la Spark (vLLM `:8000`, parakeet `:8002`, whisper `:8004`) y en el piloto se
expusieron por proxies socat sin autenticación — postura no conforme para producción.

## Decisión
Anteponer un **API Gateway** (LiteLLM, contenedor Docker) como **único punto de red
autenticado** delante de los modelos, alcanzable **solo por la VPN corporativa** (perímetro
Entra ID + MFA). La app apunta al gateway (`/api/v1`, OpenAI-compatible) con credencial por
usuario. Los modelos crudos dejan de exponerse a la red (solo localhost + bridge docker).

## Alternativas consideradas
1. **Túnel público (Cloudflare/Tailscale Funnel) con API key** — *RECHAZADA*. Viola PT-ARQ-004
   (exposición pública no justificada; identidad debe ser Entra ID/MFA/OAuth2, no una key suelta)
   y POL-TIC-001 ("prohibida la navegación a internet desde servidores"; OpenSource solo local,
   no hacia internet; software crítico → EntraID + Microsoft Identity).
2. **P2P: la app pega directo a los puertos de los modelos** — *RECHAZADA*. PT-ARQ-004 prohíbe
   integración P2P directa; sin auth/rate-limit/log; es la postura insegura del piloto.
3. **API Gateway interno (LiteLLM) tras la VPN** — *ELEGIDA*. Cumple API-Gateway, auth por key
   (→ OAuth2/JWT Entra en fase 2), rate-limit, logging, TLS (Caddy), sin exposición pública.

## Consecuencias
- **Positivas:** endpoint único versionado, autenticación + rate-limit + logs por usuario, modelos
  fuera de la red, datos de reuniones no salen de Ternova (alinea PT-IA-003).
- **Deuda / divergencia:** el gateway y los modelos son **on-prem**, no el estándar Azure
  (APIM/AKS/Entra/Key Vault) → requiere **Waiver (Legacy/Técnica)** con plan de modernización a
  Azure (Fase 2). Identidad por API key es interina hasta OAuth2/JWT con Entra.
- **Prerrequisitos bloqueantes:** checklist + firma del oficial de seguridad antes de exponer;
  Entra App Registration; Key Vault para el master key; DNS interno + reserva IP; cert TLS de CA interna.

## Cumplimiento (resumen; detalle en docs/security/POL-TIC-001-checklist.md)
API Gateway ✅ · No P2P ✅ · Auth key→OAuth2 ⚠️ · TLS ⚠️(Caddy, pend. cert) · Rate-limit ✅ ·
Log ✅ · Sin exposición pública ✅ · Entra/MFA (perímetro VPN) ✅ / (app) ⚠️ · Contenedor ✅ ·
IaC ⚠️(compose, migrar a Terraform) · Observabilidad ⚠️(logs; falta App Insights) · Waiver ❌ pendiente.
