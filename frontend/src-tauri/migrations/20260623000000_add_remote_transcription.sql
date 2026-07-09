-- Ternova Meet — transcripción remota (DGX / endpoint ASR OpenAI-compatible).
-- Permite que la transcripción corra en un servidor central (p. ej. DGX Spark)
-- en vez de on-device, para despliegue empresarial sin fricción.
ALTER TABLE transcript_settings ADD COLUMN remoteEndpoint TEXT;
ALTER TABLE transcript_settings ADD COLUMN remoteApiKey TEXT;
