# Ternova Meet — Integración con Microsoft Teams

Ternova Meet centraliza las transcripciones de reuniones de Teams junto a las
grabaciones nativas, todo en la misma base local (SQLite `com.meetily.ai`).

## Estado actual (Fase B — híbrido)

La app reutiliza el pipeline de importación nativo (`audio/import.rs` +
`whisper_engine`) y lo expone en la UI con dos modos:

- **Archivo:** seleccionar/soltar un `.mp4/.m4a/...` local → transcribe e inserta
  como reunión (`source = 'import'`).
- **URL / Teams:** pegar una URL directa de Teams / Stream / SharePoint →
  `import.rs` la descarga por streaming (`reqwest`) a un temporal y la procesa
  igual que un archivo (`source = 'teams'`).

Las reuniones quedan etiquetadas con la columna `meetings.source`
(`'teams' | 'import' | 'live' | NULL`), lo que habilita el **badge "Teams"** y el
**filtro "Todas / Teams / Grabadas"** en la barra lateral.

### URLs autenticadas (cookies de sesión)

Stream/SharePoint suele requerir la sesión del usuario (cookies). Desde la
iteración 2 la app lo resuelve **integrado**: al pegar un enlace de
`teams.microsoft.com` / `*.sharepoint.com` / Stream en la pestaña URL, el backend
lo descarga con **yt-dlp + cookies del navegador** (Chrome → Edge → Safari en
macOS; Chrome → Edge en Windows) y sigue el pipeline normal. Requiere yt-dlp
instalado (`brew install yt-dlp` / `winget install yt-dlp`); si falta, el diálogo
muestra el error con instrucciones. El flujo asistido por skills sigue disponible
como plan B. El pipeline externo
de Python que escribe directo al SQLite sigue funcionando y sus reuniones se
marcan como `'teams'` mediante la migración `20260616000000_add_meeting_source.sql`.

## Seam `TeamsSource` (contrato para Fase C — Graph nativo)

La integración se diseña detrás de un contrato conceptual `TeamsSource` para que
una implementación nativa con Microsoft Graph se enchufe sin reescribir la UI:

| Operación            | AssistedImport (hoy)                          | GraphApi (Fase C, futuro)                    |
|----------------------|-----------------------------------------------|----------------------------------------------|
| `list_meetings()`    | Manual / conector MCP Microsoft 365           | `GET /me/onlineMeetings` (Graph)             |
| `get_transcript(id)` | JSON de Teams → SRT/VTT (script) o URL directa| `.../transcripts/{id}/content` (Graph)       |
| `get_recording(id)`  | yt-dlp con cookies / URL directa              | `callRecordings` / Stream (Graph)            |

**Fase C (no construida):** registrar la app en Azure AD (permisos
`OnlineMeetings.Read`, `OnlineMeetingTranscript.Read.All`), OAuth dentro de la
app y `TeamsSource::GraphApi`. Requiere aprobación de admin de Ternova. Diseñar
respetando las políticas internas (Zero Trust, infra Azure aprobada, nada
sensible a terceros).

## Despliegue empresarial sin fricción (build corporativo → DGX)

Para que las máquinas cliente (incluidas las que no tienen GPU) usen la DGX **sin que
cada usuario configure nada**, se compila un build corporativo con el endpoint horneado:

```bash
# Transcripción por defecto → DGX (ASR OpenAI-compatible)
TERNOVA_DGX_TRANSCRIBE_ENDPOINT=http://<dgx-host>:8000/v1 pnpm tauri:build
```

Con esa variable, al no haber config previa la app arranca en provider `remote`
apuntando a la DGX (`src/config.rs::DEFAULT_DGX_TRANSCRIBE_ENDPOINT`,
`api_get_transcript_config`). Sin la variable, el build se comporta local
(whisper/parakeet) — sin regresión. El usuario siempre puede cambiarlo en
Ajustes → Transcripción.

- **Resumen → DGX:** hoy se configura con el proveedor `CustomOpenAI`
  (base URL `http://<dgx-host>:8000/v1`, modelo del vLLM). Un default horneado
  equivalente para el resumen queda como follow-up.

## Continuidad

El identifier de la app sigue siendo `com.meetily.ai`, por lo que la BD, los
scripts de `~/.meetily-auto`, el MCP de lectura y las skills existentes funcionan
sin cambios tras el rebrand.

## Servidor Ternova (DGX Spark) — aprovisionamiento

La DGX sirve los dos motores remotos de la app (sin tocar el contenedor vLLM
existente, que es el cerebro del agente corporativo):

| Servicio (systemd) | Puerto | Qué hace |
|---|---|---|
| `vllm-lan-proxy.service` | `:8003` | Expone el vLLM local (`127.0.0.1:8000`) en LAN/tailnet vía socat. Usa **el modelo que esté de turno** (`GET /v1/models`). |
| `whisper-asr.service` | `:8004` | whisper.cpp (build CUDA nativo) sirviendo **large-v3** con endpoint OpenAI-compatible `/v1/audio/transcriptions`. |

Ambos con `Restart=always` + `enable` → sobreviven reboot. Fuente: `~/whisper.cpp`
(modelo en `models/ggml-large-v3.bin`). Rendimiento medido: ~1.4 s por clip corto
(Mac → tailnet → DGX → texto).

**Build corporativo preconfigurado** (onboarding ofrece "Servidor Ternova (DGX)"
con un clic, sin descargar modelos):

```bash
TERNOVA_DGX_TRANSCRIBE_ENDPOINT=http://<dgx-host>:8004/v1 \
TERNOVA_DGX_SUMMARY_ENDPOINT=http://<dgx-host>:8003/v1 \
NEXT_PUBLIC_TERNOVA_DGX_SUMMARY_ENDPOINT=http://<dgx-host>:8003/v1 \
NEXT_PUBLIC_TERNOVA_DGX_SUMMARY_MODEL=qwen3.6-35b \
pnpm tauri:build
```

> Pendiente Fase C (org-wide): autenticación en ambos endpoints (hoy abiertos en
> LAN/tailnet) y DNS interno `dgx-spark` en lugar de IP.
