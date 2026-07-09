// audio/transcription/remote_provider.rs
//
// Ternova Meet — proveedor de transcripción REMOTA.
// Envía el audio (16 kHz mono f32) a un servidor ASR compatible con la API de
// OpenAI (`POST {endpoint}/audio/transcriptions`, multipart) y devuelve el texto.
// Pensado para correr los modelos en la DGX Spark (faster-whisper-server / speaches /
// cualquier endpoint OpenAI-compatible), de modo que las máquinas cliente no
// necesiten GPU local (despliegue empresarial sin fricción).

use super::provider::{TranscriptionError, TranscriptResult, TranscriptionProvider};
use async_trait::async_trait;
use log::{info, warn};

/// Proveedor de transcripción contra un endpoint HTTP OpenAI-compatible.
pub struct RemoteTranscriptionProvider {
    /// Base URL, p. ej. `http://<dgx>:8000/v1` (sin `/audio/transcriptions`).
    endpoint: String,
    /// Nombre del modelo a pedir (p. ej. `whisper-large-v3`).
    model: String,
    /// API key opcional (Bearer) si el servidor la exige.
    api_key: Option<String>,
    client: reqwest::Client,
}

impl RemoteTranscriptionProvider {
    pub fn new(endpoint: String, model: String, api_key: Option<String>) -> Self {
        let client = reqwest::Client::builder()
            // Timeout amplio: la DGX puede tardar en cargas grandes; aún así acotado.
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());
        Self {
            endpoint: endpoint.trim_end_matches('/').to_string(),
            model,
            api_key,
            client,
        }
    }

    fn transcriptions_url(&self) -> String {
        format!("{}/audio/transcriptions", self.endpoint)
    }
}

/// Codifica muestras f32 (mono) a un WAV PCM 16-bit en memoria.
/// (Encoder mínimo propio — el proyecto ya evita la dependencia `hound`.)
fn f32_samples_to_wav(samples: &[f32], sample_rate: u32) -> Vec<u8> {
    let num_samples = samples.len() as u32;
    let bytes_per_sample = 2u32; // i16
    let channels = 1u16;
    let byte_rate = sample_rate * channels as u32 * bytes_per_sample;
    let block_align = channels * bytes_per_sample as u16;
    let data_len = num_samples * bytes_per_sample;
    let mut buf = Vec::with_capacity(44 + data_len as usize);

    // RIFF header
    buf.extend_from_slice(b"RIFF");
    buf.extend_from_slice(&(36 + data_len).to_le_bytes());
    buf.extend_from_slice(b"WAVE");
    // fmt chunk
    buf.extend_from_slice(b"fmt ");
    buf.extend_from_slice(&16u32.to_le_bytes()); // PCM fmt chunk size
    buf.extend_from_slice(&1u16.to_le_bytes()); // audio format = PCM
    buf.extend_from_slice(&channels.to_le_bytes());
    buf.extend_from_slice(&sample_rate.to_le_bytes());
    buf.extend_from_slice(&byte_rate.to_le_bytes());
    buf.extend_from_slice(&block_align.to_le_bytes());
    buf.extend_from_slice(&16u16.to_le_bytes()); // bits per sample
    // data chunk
    buf.extend_from_slice(b"data");
    buf.extend_from_slice(&data_len.to_le_bytes());
    for &s in samples {
        let clamped = s.clamp(-1.0, 1.0);
        let val = (clamped * i16::MAX as f32) as i16;
        buf.extend_from_slice(&val.to_le_bytes());
    }
    buf
}

#[async_trait]
impl TranscriptionProvider for RemoteTranscriptionProvider {
    async fn transcribe(
        &self,
        audio: Vec<f32>,
        language: Option<String>,
    ) -> std::result::Result<TranscriptResult, TranscriptionError> {
        // El pipeline entrega 16 kHz mono (ver worker.rs).
        const SAMPLE_RATE: u32 = 16000;
        const MIN_SAMPLES: usize = 1600; // 100 ms
        if audio.len() < MIN_SAMPLES {
            return Err(TranscriptionError::AudioTooShort {
                samples: audio.len(),
                minimum: MIN_SAMPLES,
            });
        }

        let wav = f32_samples_to_wav(&audio, SAMPLE_RATE);

        // Multipart estilo OpenAI: file + model (+ language opcional) + response_format.
        let part = reqwest::multipart::Part::bytes(wav)
            .file_name("audio.wav")
            .mime_str("audio/wav")
            .map_err(|e| TranscriptionError::EngineFailed(format!("mime: {}", e)))?;
        let mut form = reqwest::multipart::Form::new()
            .part("file", part)
            .text("model", self.model.clone())
            .text("response_format", "json");
        if let Some(lang) = language {
            if !lang.is_empty() && lang != "auto" {
                form = form.text("language", lang);
            }
        }

        let mut req = self.client.post(self.transcriptions_url()).multipart(form);
        if let Some(key) = &self.api_key {
            if !key.is_empty() {
                req = req.bearer_auth(key);
            }
        }

        let resp = req
            .send()
            .await
            .map_err(|e| TranscriptionError::EngineFailed(format!("request a la DGX falló: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            warn!("Remote ASR HTTP {}: {}", status, body);
            return Err(TranscriptionError::EngineFailed(format!(
                "ASR remoto devolvió HTTP {}",
                status
            )));
        }

        // Respuesta OpenAI: { "text": "..." }
        let json: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| TranscriptionError::EngineFailed(format!("respuesta no-JSON: {}", e)))?;
        let text = json
            .get("text")
            .and_then(|t| t.as_str())
            .unwrap_or("")
            .trim()
            .to_string();

        // Confianza opcional si el servidor la provee (no estándar en OpenAI).
        let confidence = json.get("confidence").and_then(|c| c.as_f64()).map(|c| c as f32);

        info!("Remote ASR ({}) → '{}'", self.model, text);
        Ok(TranscriptResult {
            text,
            confidence,
            is_partial: false,
        })
    }

    async fn is_model_loaded(&self) -> bool {
        // El servidor remoto gestiona la carga del modelo; lo damos por listo.
        true
    }

    async fn get_current_model(&self) -> Option<String> {
        Some(self.model.clone())
    }

    fn provider_name(&self) -> &'static str {
        "Remote ASR (DGX)"
    }
}
