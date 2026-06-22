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

Stream/SharePoint suele requerir la sesión del usuario (cookies). El backend
directo no las tiene, así que para esos enlaces se mantiene el **flujo asistido**
(skills `teams-download-today` / `meetily-import` con `yt-dlp`), que deja un
archivo local; luego se importa por la pestaña **Archivo**. El pipeline externo
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

## Continuidad

El identifier de la app sigue siendo `com.meetily.ai`, por lo que la BD, los
scripts de `~/.meetily-auto`, el MCP de lectura y las skills existentes funcionan
sin cambios tras el rebrand.
