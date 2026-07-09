// Ternova Meet — chat con las transcripciones de reuniones.
//
// Comando `chat_with_meetings`: arma contexto desde la reunión actual (guardada
// o transcript en vivo) o desde TODAS las reuniones (RAG-lite: recuperación por
// LIKE sobre `transcripts` + `transcript_chunks`, sin embeddings en esta fase) y
// responde reutilizando el cliente LLM del resumen (`summary::llm_client`).
// Motor conmutable: "local" (config de resumen guardada: Ollama/BuiltInAI/…) o
// "ternova" (Servidor Ternova / DGX vía config CustomOpenAI).

use crate::database::repositories::setting::SettingsRepository;
use crate::state::AppState;
use crate::summary::llm_client::{generate_summary, LLMProvider};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::{AppHandle, Manager, Runtime};

const MAX_CONTEXT_CHARS: usize = 24_000;
const MAX_SEGMENTS_ALL: i64 = 60;

#[derive(Debug, Deserialize)]
pub struct ChatHistoryMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct ChatMeetingRef {
    pub id: String,
    pub title: String,
}

#[derive(Debug, Serialize)]
pub struct ChatAnswer {
    pub answer: String,
    pub provider_label: String,
    pub used_meetings: Vec<ChatMeetingRef>,
}

fn truncate_context(mut s: String, max: usize) -> String {
    if s.len() > max {
        // conservar el final (lo más reciente suele ser lo más relevante en vivo)
        let cut = s.len() - max;
        s = format!("…(contexto truncado)…\n{}", &s[cut..]);
    }
    s
}

/// Palabras de la pregunta usadas para la recuperación LIKE (RAG-lite).
fn keywords(question: &str) -> Vec<String> {
    let mut kws: Vec<String> = question
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| w.chars().count() > 3)
        .map(|w| w.to_lowercase())
        .collect();
    kws.sort();
    kws.dedup();
    kws.truncate(8);
    kws
}

async fn context_for_meeting(
    pool: &sqlx::SqlitePool,
    meeting_id: &str,
) -> Result<(String, Option<ChatMeetingRef>), String> {
    let meeting = sqlx::query("SELECT id, title FROM meetings WHERE id = ?")
        .bind(meeting_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("DB error: {}", e))?;
    let Some(meeting) = meeting else {
        return Err("Reunión no encontrada".to_string());
    };
    let title: String = meeting.get("title");

    // Preferir el texto completo con hablantes si existe (transcript_chunks)
    let chunk: Option<String> = sqlx::query_scalar(
        "SELECT transcript_text FROM transcript_chunks WHERE meeting_id = ? LIMIT 1",
    )
    .bind(meeting_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("DB error: {}", e))?;

    let text = if let Some(t) = chunk.filter(|t| !t.trim().is_empty()) {
        t
    } else {
        let rows = sqlx::query(
            "SELECT transcript, timestamp FROM transcripts WHERE meeting_id = ? ORDER BY audio_start_time, timestamp",
        )
        .bind(meeting_id)
        .fetch_all(pool)
        .await
        .map_err(|e| format!("DB error: {}", e))?;
        rows.iter()
            .map(|r| {
                let ts: String = r.get("timestamp");
                let tx: String = r.get("transcript");
                format!("[{}] {}", ts, tx)
            })
            .collect::<Vec<_>>()
            .join("\n")
    };

    Ok((
        format!("## Reunión: {}\n{}", title, text),
        Some(ChatMeetingRef {
            id: meeting_id.to_string(),
            title,
        }),
    ))
}

async fn context_for_all(
    pool: &sqlx::SqlitePool,
    question: &str,
) -> Result<(String, Vec<ChatMeetingRef>), String> {
    let kws = keywords(question);
    let mut blocks: Vec<String> = Vec::new();
    let mut used: Vec<ChatMeetingRef> = Vec::new();

    if !kws.is_empty() {
        // Recuperación por término, agrupada por reunión (RAG-lite)
        let mut seen_segments: std::collections::HashSet<String> = Default::default();
        for kw in &kws {
            let rows = sqlx::query(
                "SELECT m.id as mid, m.title as title, t.transcript as tx, t.timestamp as ts
                 FROM meetings m JOIN transcripts t ON m.id = t.meeting_id
                 WHERE LOWER(t.transcript) LIKE ?
                 ORDER BY m.created_at DESC LIMIT ?",
            )
            .bind(format!("%{}%", kw))
            .bind(MAX_SEGMENTS_ALL / kws.len().max(1) as i64)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("DB error: {}", e))?;
            for r in rows {
                let mid: String = r.get("mid");
                let title: String = r.get("title");
                let tx: String = r.get("tx");
                let ts: String = r.get("ts");
                let key = format!("{}|{}|{}", mid, ts, &tx.chars().take(40).collect::<String>());
                if seen_segments.insert(key) {
                    blocks.push(format!("[{} — {}] {}", title, ts, tx));
                }
                if !used.iter().any(|u| u.id == mid) {
                    used.push(ChatMeetingRef { id: mid, title });
                }
            }
        }
    }

    // Si la búsqueda no dio nada, dar al menos el índice de reuniones recientes
    if blocks.is_empty() {
        let rows = sqlx::query(
            "SELECT id, title, created_at FROM meetings ORDER BY created_at DESC LIMIT 20",
        )
        .fetch_all(pool)
        .await
        .map_err(|e| format!("DB error: {}", e))?;
        for r in rows {
            let id: String = r.get("id");
            let title: String = r.get("title");
            blocks.push(format!("- {}", title));
            used.push(ChatMeetingRef { id, title });
        }
        return Ok((
            format!(
                "No se hallaron fragmentos que coincidan con la pregunta. Índice de reuniones recientes:\n{}",
                blocks.join("\n")
            ),
            used,
        ));
    }

    Ok((
        format!("Fragmentos relevantes de tus reuniones:\n{}", blocks.join("\n")),
        used,
    ))
}

#[tauri::command]
pub async fn chat_with_meetings<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, AppState>,
    question: String,
    scope: String,
    meeting_id: Option<String>,
    live_transcript: Option<String>,
    history: Vec<ChatHistoryMessage>,
    target: String,
) -> Result<ChatAnswer, String> {
    let pool = state.db_manager.pool();

    // ---- 1) Contexto según alcance ----
    let (context, used_meetings) = if scope == "current" {
        if let Some(live) = live_transcript.filter(|t| !t.trim().is_empty()) {
            (
                format!("## Reunión en curso (transcript en vivo)\n{}", live),
                meeting_id
                    .as_deref()
                    .map(|id| vec![ChatMeetingRef { id: id.to_string(), title: "Reunión en curso".into() }])
                    .unwrap_or_default(),
            )
        } else if let Some(id) = meeting_id.as_deref() {
            let (ctx, m) = context_for_meeting(pool, id).await?;
            (ctx, m.into_iter().collect())
        } else {
            return Err("No hay reunión activa: cambia el alcance a 'Todas las reuniones'".to_string());
        }
    } else {
        context_for_all(pool, &question).await?
    };
    let context = truncate_context(context, MAX_CONTEXT_CHARS);

    // ---- 2) Resolver el motor (local | ternova) ----
    let (provider, model, api_key, ollama_endpoint, custom_endpoint, provider_label) =
        if target == "ternova" {
            let cfg = SettingsRepository::get_custom_openai_config(pool)
                .await
                .map_err(|e| format!("DB error: {}", e))?
                .ok_or_else(|| {
                    "Servidor Ternova sin configurar: en Ajustes → Summary elige 'Servidor Ternova (DGX)' y define endpoint y modelo".to_string()
                })?;
            let endpoint = cfg.endpoint.clone();
            if endpoint.trim().is_empty() {
                return Err("El Servidor Ternova no tiene endpoint configurado".to_string());
            }
            let model = if cfg.model.trim().is_empty() {
                "gpt-oss:20b".to_string()
            } else {
                cfg.model.clone()
            };
            let label = format!("Servidor Ternova · {}", model);
            (
                LLMProvider::CustomOpenAI,
                model,
                cfg.api_key.clone().unwrap_or_default(),
                None,
                Some(endpoint),
                label,
            )
        } else {
            let cfg = SettingsRepository::get_model_config(pool)
                .await
                .map_err(|e| format!("DB error: {}", e))?
                .ok_or_else(|| "No hay motor local configurado (Ajustes → Summary)".to_string())?;
            let provider = LLMProvider::from_str(&cfg.provider)?;
            let api_key = match provider {
                LLMProvider::Ollama | LLMProvider::BuiltInAI | LLMProvider::CustomOpenAI => String::new(),
                _ => SettingsRepository::get_api_key(pool, &cfg.provider)
                    .await
                    .map_err(|e| format!("DB error: {}", e))?
                    .unwrap_or_default(),
            };
            let custom_endpoint = if provider == LLMProvider::CustomOpenAI {
                SettingsRepository::get_custom_openai_config(pool)
                    .await
                    .ok()
                    .flatten()
                    .map(|c| c.endpoint)
            } else {
                None
            };
            let label = format!("{} · {} (local)", cfg.provider, cfg.model);
            (
                provider,
                cfg.model.clone(),
                api_key,
                cfg.ollama_endpoint.clone(),
                custom_endpoint,
                label,
            )
        };

    // ---- 3) Prompt ----
    let system_prompt = "Eres el asistente de reuniones de Ternova Meet. Respondes en el idioma de la pregunta (normalmente español), de forma concisa y accionable, usando EXCLUSIVAMENTE el contexto de reuniones proporcionado. Si la respuesta no está en el contexto, dilo claramente. Cuando cites algo, menciona la reunión (y hora si está disponible). Formatea con Markdown ligero.";

    let mut convo = String::new();
    for h in history.iter().rev().take(8).collect::<Vec<_>>().into_iter().rev() {
        let who = if h.role == "user" { "Usuario" } else { "Asistente" };
        convo.push_str(&format!("{}: {}\n", who, h.content));
    }

    let mut user_prompt = format!(
        "CONTEXTO DE REUNIONES:\n{}\n\n{}Pregunta del usuario: {}",
        context,
        if convo.is_empty() { String::new() } else { format!("CONVERSACIÓN PREVIA:\n{}\n", convo) },
        question
    );
    // El vLLM de la DGX corre Qwen3.x: sin esta señal el modelo vuelca su
    // razonamiento ("thinking") en la respuesta. Convención Qwen: /no_think.
    if target == "ternova" {
        user_prompt.push_str("\n/no_think");
    }

    // ---- 4) LLM (reutiliza el cliente del resumen) ----
    let client = reqwest::Client::new();
    let app_data_dir = app.path().app_data_dir().ok();
    let answer = generate_summary(
        &client,
        &provider,
        &model,
        &api_key,
        system_prompt,
        &user_prompt,
        ollama_endpoint.as_deref(),
        custom_endpoint.as_deref(),
        Some(1024),
        Some(0.3),
        None,
        app_data_dir.as_ref(),
        None,
    )
    .await?;

    Ok(ChatAnswer {
        answer,
        provider_label,
        used_meetings,
    })
}
