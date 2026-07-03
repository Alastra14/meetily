// Ternova Meet — niveles de audio REALES durante la grabación.
//
// El pipeline de captura publica RMS/peak por dispositivo en statics atómicos
// (lock-free, costo ~0 cuando está apagado) y una tarea emisora los manda al
// frontend como evento `audio-levels` (~16 fps), con el mismo payload que
// simple_level_monitor. Sustituye los datos simulados (sin()) cuando hay una
// grabación activa, para que el indicador se mueva con el sonido de verdad.

use serde::Serialize;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use tauri::{AppHandle, Emitter, Runtime};

static ENABLED: AtomicBool = AtomicBool::new(false);

static MIC_RMS: AtomicU32 = AtomicU32::new(0);
static MIC_PEAK: AtomicU32 = AtomicU32::new(0);
static MIC_LAST_MS: AtomicU64 = AtomicU64::new(0);

static SYS_RMS: AtomicU32 = AtomicU32::new(0);
static SYS_PEAK: AtomicU32 = AtomicU32::new(0);
static SYS_LAST_MS: AtomicU64 = AtomicU64::new(0);

/// Ventana tras la cual un lado sin muestras nuevas se considera en silencio
/// (p. ej. grabación en pausa): las barras deben caer, no congelarse.
const STALE_MS: u64 = 300;

fn now_ms() -> u64 {
    chrono::Utc::now().timestamp_millis() as u64
}

#[inline]
pub fn enabled() -> bool {
    ENABLED.load(Ordering::Relaxed)
}

/// Llamado desde el pipeline de audio con las muestras reales del chunk.
/// Barato: no hace nada si el emisor está apagado.
pub fn publish(is_microphone: bool, samples: &[f32]) {
    if !enabled() || samples.is_empty() {
        return;
    }
    let rms = (samples.iter().map(|&x| x * x).sum::<f32>() / samples.len() as f32).sqrt();
    let peak = samples.iter().map(|&x| x.abs()).fold(0.0f32, f32::max);
    let (r, p, t) = if is_microphone {
        (&MIC_RMS, &MIC_PEAK, &MIC_LAST_MS)
    } else {
        (&SYS_RMS, &SYS_PEAK, &SYS_LAST_MS)
    };
    r.store(rms.to_bits(), Ordering::Relaxed);
    p.store(peak.to_bits(), Ordering::Relaxed);
    t.store(now_ms(), Ordering::Relaxed);
}

#[derive(Serialize, Clone)]
struct AudioLevelData {
    device_name: String,
    device_type: String,
    rms_level: f32,
    peak_level: f32,
    is_active: bool,
}

#[derive(Serialize, Clone)]
struct AudioLevelUpdate {
    timestamp: u64,
    levels: Vec<AudioLevelData>,
}

fn side(device_type: &str, r: &AtomicU32, p: &AtomicU32, t: &AtomicU64) -> AudioLevelData {
    let fresh = now_ms().saturating_sub(t.load(Ordering::Relaxed)) < STALE_MS;
    let rms = if fresh { f32::from_bits(r.load(Ordering::Relaxed)) } else { 0.0 };
    let peak = if fresh { f32::from_bits(p.load(Ordering::Relaxed)) } else { 0.0 };
    AudioLevelData {
        device_name: device_type.to_string(),
        device_type: device_type.to_string(),
        rms_level: rms.clamp(0.0, 1.0),
        peak_level: peak.clamp(0.0, 1.0),
        is_active: rms > 0.01,
    }
}

/// Arranca la tarea emisora (idempotente).
pub fn start<R: Runtime>(app: AppHandle<R>) {
    if ENABLED.swap(true, Ordering::SeqCst) {
        return; // ya corriendo
    }
    tauri::async_runtime::spawn(async move {
        while ENABLED.load(Ordering::SeqCst) {
            let update = AudioLevelUpdate {
                timestamp: now_ms(),
                levels: vec![
                    side("microphone", &MIC_RMS, &MIC_PEAK, &MIC_LAST_MS),
                    side("system", &SYS_RMS, &SYS_PEAK, &SYS_LAST_MS),
                ],
            };
            let _ = app.emit("audio-levels", &update);
            tokio::time::sleep(std::time::Duration::from_millis(60)).await;
        }
    });
}

pub fn stop() {
    ENABLED.store(false, Ordering::SeqCst);
    MIC_RMS.store(0, Ordering::Relaxed);
    MIC_PEAK.store(0, Ordering::Relaxed);
    SYS_RMS.store(0, Ordering::Relaxed);
    SYS_PEAK.store(0, Ordering::Relaxed);
}
