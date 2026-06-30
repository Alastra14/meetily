# ADD — Plataforma Ternova Meet (Track B)

> **Tipo:** Architecture Definition Document (borrador para Architecture Board)
> **Marco:** PT-ARQ-004 (TOGAF 10 + ITIL 4 + Azure Well-Architected + ISO 27001 + CIS).
> **Aplica además:** PT-IA-003 (`ternova-ia`) y Gobernanza IA TE-005 (`ternova-gobernanza-ia`),
> POL-TIC-001 (`ternova-seguridad`) — hay IA (ASR + LLM) y datos sensibles (grabaciones).
> **Estado:** propuesta. Requiere RFC → revisión del Board. Score objetivo ≥80.

## 1. Contexto y objetivo
Ternova Meet hoy es una app de escritorio **local-first** (Tauri + SQLite por equipo, modelos en la
propia máquina). El objetivo empresarial es una **plataforma de conocimiento de reuniones** sin
fricción:
- **Login con Entra ID** (SSO corporativo).
- **Visibilidad por jerarquía organizacional top-down** (un jefe ve las reuniones de su gente, en
  cascada) **+** las reuniones de **Teams donde el usuario participó**.
- **Cómputo centralizado** (transcripción + resumen) para que **máquinas débiles y un futuro móvil**
  no necesiten GPU local.
- **Datos compartidos** entre clientes (escritorio + móvil) → base de conocimiento en Azure.

### Implicación arquitectónica raíz
La autorización **top-down por jerarquía es incompatible con el modelo local-first**: requiere un
**servicio central** con la información de todas las reuniones y una **capa de autorización** que
conozca el organigrama de Entra ID. → La plataforma central **es la columna vertebral**, no un extra.

## 2. Principios PT-ARQ-004 aplicados (y divergencias señaladas)
- **Integración solo vía API Gateway (APIM) + Event Bus (Service Bus)** — sin P2P. ✔ adoptado.
- **API-First** (`/api/v1/`, OpenAPI en repo, OAuth2/JWT). ✔
- **Cloud-Native / contenedores en AKS, ACR, IaC, CI/CD.** ✔ para el backend Azure.
- **Database per service** (sin BD compartida). ✔
- **Entra ID único IdP, MFA, Key Vault, RBAC mínimo privilegio, Zero Trust.** ✔
- **Observabilidad con App Insights + SLOs.** ✔
- ⚠️ **DIVERGENCIA 1 — Cómputo IA on-prem (DGX Spark):** los modelos (ASR + LLM) corren en la **DGX
  Spark on-prem**, no en Azure PaaS. Diverge de `P-T-01 Cloud-Native por defecto`. **Justificación:**
  privacidad (datos sensibles no salen a terceros — alinea con PT-IA-003), costo (sin pago por
  token/minuto), hardware ya adquirido. **Acción:** **Waiver tipo Técnica/Legacy** + exponer la DGX
  **detrás de APIM** mediante enlace híbrido (VPN/ExpressRoute + Private Endpoint); el AKS nunca llama
  la DGX P2P, siempre vía APIM. Plan de modernización: evaluar migración a Azure ML/AKS-GPU si cambia
  el costo/escala.
- ⚠️ **DIVERGENCIA 2 — Cliente móvil Expo/React Native:** alinea con el stack móvil actual de Ternova,
  pero diverge del estándar Azure. El frontend móvil no es compute Azure; consume la API. Documentar
  como Waiver/legacy del frontend, sin afectar el backend.
- ⚠️ **DIVERGENCIA 3 — Cliente escritorio Tauri (Rust):** el cliente actual es Tauri, no un servicio
  Azure. Es un cliente (no backend), aceptable; su lógica pesada migra al backend (strangler).

## 3. Arquitectura lógica (capas)
```
┌───────────────────────────────────────────────────────────────────────────┐
│ CLIENTES (delgados)                                                         │
│  Escritorio Tauri (Ternova Meet)   ·   Móvil Expo/RN (futuro)               │
│  - graban audio, muestran reuniones/resúmenes, NO corren modelos            │
└───────────────┬───────────────────────────────────────────────────────────┘
                │ HTTPS + OAuth2/JWT (token Entra ID)
        ┌───────▼─────────┐   Azure API Management (APIM)  ── único ingreso
        │  API Gateway    │   /api/v1/*  · valida JWT · rate-limit · OpenAPI
        └───────┬─────────┘
                │ (sync)                         ▲ (async: eventos)
   ┌────────────┼─────────────────────────┐     │ Azure Service Bus (Topics+DLQ)
   ▼            ▼            ▼              ▼     │
┌────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐│
│Meetings│ │Identity │ │Transcr.  │ │Summary   ││   Microservicios por dominio
│Service │ │/Org-graph│ │Worker    │ │Worker    ││   (Docker en AKS, BD propia)
└───┬────┘ └────┬────┘ └────┬─────┘ └────┬─────┘│
    │           │           │ (vía APIM) │ (vía APIM)
    │           │           ▼            ▼      │
    │           │     ┌─────────────────────────┴───┐
    │           │     │  DGX Spark (ON-PREM)         │  detrás de APIM + enlace híbrido
    │           │     │  ASR server (/v1/audio/...)  │  vLLM (/v1/chat/...) — modelos locales
    │           │     └─────────────────────────────┘
    ▼           ▼
 Azure SQL   (cache org-graph)        Blob Storage (grabaciones, cifradas)
 (1 BD/serv) Microsoft Graph ⇒ jerarquía + participantes      Azure AI Search (Azure KB)
```
**Seguridad/identidad transversal:** Entra ID (App Registrations, MFA), Key Vault (secretos),
Private Endpoints + VNet/NSG, Sentinel (SIEM), Defender. **Observabilidad:** App Insights + Log
Analytics + Trace IDs + alertas por SLO en cada servicio.

## 4. Identidad y autorización (núcleo del requisito)
- **Autenticación:** Entra ID SSO; los clientes obtienen un **JWT** que APIM valida en cada llamada.
- **Autorización (qué reuniones ve cada usuario):** unión de dos reglas, evaluada por el
  **Identity/Org-graph Service**:
  1. **Participación:** reuniones donde el usuario fue participante (de Graph / metadatos de la reunión).
  2. **Jerarquía top-down:** reuniones de cualquier usuario en su **subárbol de reportes**
     (transitive reports de `/me/directReports` recursivo, cacheado).
- **Fuente de la jerarquía:** Microsoft Graph (`/users/{id}/manager`, `/users/{id}/directReports`),
  sincronizada periódicamente a una **cache de organigrama** (no consultar Graph en cada request).
- **Implementación:** cada query de Meetings pasa por un filtro de autorización
  `visible_meetings(user) = participó(user) ∪ reuniones_de(subárbol(user))`. RBAC de mínimo privilegio;
  roles adicionales (Admin, Compliance) por grupos de Entra ID.

## 5. Dominios y datos (Database per Service)
| Servicio | Responsabilidad | Datos (BD propia) | Clasificación |
|---|---|---|---|
| **Meetings** | reuniones, metadatos, participantes | Azure SQL/PostgreSQL | Confidencial |
| **Transcripts** | segmentos de transcripción | Azure SQL/PostgreSQL | Confidencial |
| **Summary** | resúmenes/minutas | Azure SQL/PostgreSQL | Confidencial |
| **Recordings** | audio/video | **Blob Storage** (cifrado, SAS de corta vida) | **Confidencial/Restringido** |
| **Identity/Org-graph** | cache de jerarquía + roles | Azure SQL + Redis | Interno |
| **Knowledge (KB)** | índice semántico | **Azure AI Search** (embeddings) | Confidencial |
- **Data Owner/Steward** asignados; activos críticos en **Purview**. Retención y borrado según política.

## 6. Flujo end-to-end (grabar → ver con permisos)
1. Cliente (escritorio/móvil) graba y **sube el audio** vía APIM → **Recordings** (Blob) y publica
   evento `meeting.ingested` en Service Bus.
2. **Transcription Worker** consume el evento, llama al **ASR de la DGX** (vía APIM,
   `/v1/audio/transcriptions`), guarda en **Transcripts**, publica `transcript.ready`.
3. **Summary Worker** consume `transcript.ready`, llama al **LLM de la DGX** (vía APIM, vLLM
   `/v1/chat/completions`), guarda en **Summary**, publica `summary.ready`.
4. **Knowledge** indexa transcript+resumen en **Azure AI Search** (embeddings) para búsqueda semántica.
5. Cliente consulta `/api/v1/meetings` → **Meetings** aplica el filtro de autorización jerárquica →
   devuelve solo lo permitido. Audio se sirve con **SAS temporal** de Blob.

## 7. Cómputo IA (DGX Spark) — gobernanza
- **vLLM** (LLM/resumen) y un **servidor ASR** (faster-whisper/speaches, API OpenAI
  `/v1/audio/transcriptions`) en la DGX. **Modelos 100% locales** → cumple PT-IA-003 (no se envían
  datos sensibles a terceros). 
- **Restricción operativa:** `gpu-memory-utilization 0.30` (memoria unificada GB10) — al coexistir ASR
  + vLLM hay que dimensionar memoria o serializar cargas. 
- **Exposición:** detrás de **APIM** por enlace híbrido (sin P2P, sin exposición pública). Secretos en
  **Key Vault**. Observabilidad de las llamadas a la DGX en App Insights.

## 8. Encaje del cliente actual (Track A) — estrategia strangler
- El cliente Tauri actual (rebrand + import Teams, PR #1) sigue siendo el **cliente semilla**.
- **Etapa 1 (ya construible):** apuntar **resumen** (config `CustomOpenAI`→vLLM) y **transcripción**
  (nuevo `RemoteTranscriptionProvider`→ASR) a la DGX **a través de APIM** cuando exista; mientras tanto,
  directo a la DGX en LAN con waiver temporal. App **preconfigurada** (frictionless) + fallback local.
- A medida que el backend central exista, el cliente deja de escribir en SQLite local y pasa a
  consumir la **API** (`/api/v1/*`) — migración incremental (strangler), sin “big bang”.

## 9. ADRs derivados (a registrar en `/docs/adrs/`)
- **ADR-MEET-001** — Plataforma central vs. local-first (elegida central; alternativa: sync P2P de
  SQLite — descartada por imposibilidad de RBAC jerárquico y por seguridad).
- **ADR-MEET-002** — Inferencia IA on-prem en DGX detrás de APIM (Waiver Técnica) vs. Azure ML/AKS-GPU
  (alternativa futura por costo/escala).
- **ADR-MEET-003** — Autorización por jerarquía vía Graph + cache de organigrama vs. grupos estáticos
  de Entra ID (elegida jerarquía dinámica; grupos para roles administrativos).
- **ADR-MEET-004** — Cliente delgado: escritorio Tauri + móvil Expo/RN (Waiver de frontend) vs.
  reescritura web.

## 10. Roadmap
1. **Track A / Etapa 1 (semanas):** offload de transcripción + resumen a la DGX desde el cliente
   actual (frictionless, fallback local). No requiere backend central.
2. **Plataforma — MVP (build mayor):** Entra ID SSO + Meetings/Recordings/Transcripts/Summary services
   + APIM + Service Bus + ingest desde el cliente + autorización por participación.
3. **Jerarquía + KB:** Identity/Org-graph (Graph + cache) → visibilidad top-down; Azure AI Search.
4. **Móvil (Expo/RN)** consumiendo la misma API.
5. **Graph nativo de Teams** (Fase C) sustituye el import asistido.

## 11. Checklist de cumplimiento (estado propuesto)
- Integración APIM/Service Bus (no P2P) ✔ · API versionada + OAuth2/JWT ✔ · Docker/ACR/AKS/CI-CD ✔ ·
  IaC + tags ✔ · Key Vault + Entra ID + RBAC ✔ · BD por servicio ✔ · App Insights + SLOs ✔ ·
  **Waivers requeridos:** EXC-Técnica (DGX on-prem detrás de APIM), EXC-Legacy (frontends Tauri/Expo).
- **Pendiente para el Board:** RFC + este ADD + los 4 ADRs + score de cumplimiento + plan de waivers.
