-- Ternova Meet — origen de la reunión (etiquetado Teams / import / live)
-- NULL = reuniones existentes (nativas/grabadas en vivo). Valores usados por la
-- app: 'teams' (importada desde Teams/Stream por URL), 'import' (archivo local),
-- 'live' (grabada en vivo). Nullable para no romper datos previos.
ALTER TABLE meetings ADD COLUMN source TEXT;

-- Puente con el pipeline externo de Python: marca como 'teams' las reuniones que
-- fueron importadas por los scripts (model = 'whisper-import' en transcript_chunks).
UPDATE meetings
SET source = 'teams'
WHERE source IS NULL
  AND id IN (
    SELECT meeting_id FROM transcript_chunks WHERE model = 'whisper-import'
  );
