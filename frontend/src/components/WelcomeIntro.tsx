'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import {
  Cloud,
  HardDrive,
  CheckCircle,
  ArrowRight,
  BookOpen,
  CircleNotch,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tutorial } from '@/components/Tutorial';

// Nova — pantalla de bienvenida que se muestra EN CADA arranque de la
// app (no solo la primera vez). Ofrece dos caminos: descargar modelos locales
// (reutiliza el flujo de onboarding existente vía `onRequestLocalDownload`,
// ver src/app/layout.tsx) o conectar al Servidor Ternova (guarda config remota
// de transcripción + resumen y deja entrar directo a la app).

const LAST_CHOICE_KEY = 'tn-welcome-last-choice';
const DEFAULT_ENDPOINT_PLACEHOLDER = 'http://172.16.1.135:8088/v1';
const DEFAULT_SUMMARY_MODEL = 'qwen3.6-35b';
const TRANSCRIPT_MODEL = 'parakeet';

type WelcomeChoice = 'local' | 'server';

interface RemoteTranscriptConfig {
  provider: string;
  model: string;
  apiKey?: string | null;
  remoteEndpoint?: string | null;
  endpoint?: string | null;
}

interface CustomOpenAIConfig {
  endpoint?: string | null;
  model?: string | null;
  apiKey?: string | null;
  maxTokens?: number | null;
  temperature?: number | null;
  topP?: number | null;
}

function readLastChoice(): WelcomeChoice | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(LAST_CHOICE_KEY);
    return stored === 'local' || stored === 'server' ? stored : null;
  } catch {
    return null;
  }
}

function writeLastChoice(choice: WelcomeChoice) {
  try {
    window.localStorage.setItem(LAST_CHOICE_KEY, choice);
  } catch {
    // localStorage puede fallar en contextos restringidos; no es crítico.
  }
}

export interface WelcomeIntroProps {
  /** Dispara el flujo de descarga de modelos locales (reutiliza el onboarding). */
  onRequestLocalDownload: () => void;
  /** Se llama cuando el usuario decide entrar a la app. */
  onEnterApp: () => void;
}

export function WelcomeIntro({ onRequestLocalDownload, onEnterApp }: WelcomeIntroProps) {
  const [showIntro, setShowIntro] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<WelcomeChoice>('local');

  // Estado actual del servidor (si ya hay config remota guardada)
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [isRemoteConfigured, setIsRemoteConfigured] = useState(false);

  // Formulario "Conectar al Servidor Ternova"
  const [showServerForm, setShowServerForm] = useState(false);
  const [endpoint, setEndpoint] = useState('');
  const [model, setModel] = useState(DEFAULT_SUMMARY_MODEL);
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Al montar: preselecciona la última elección guardada y carga la config
  // remota actual (si existe) para mostrar el estado y permitir precargar el
  // formulario.
  useEffect(() => {
    const lastChoice = readLastChoice();
    if (lastChoice) {
      setSelectedChoice(lastChoice);
      if (lastChoice === 'server') {
        setShowServerForm(true);
      }
    }

    let mounted = true;
    (async () => {
      try {
        const transcriptConfig = await invoke<RemoteTranscriptConfig | null>('api_get_transcript_config');
        const remoteEndpoint = transcriptConfig?.remoteEndpoint || transcriptConfig?.endpoint || null;
        if (mounted && transcriptConfig?.provider === 'remote' && remoteEndpoint) {
          setCurrentEndpoint(remoteEndpoint);
          setCurrentModel(transcriptConfig.model || TRANSCRIPT_MODEL);
          setIsRemoteConfigured(true);
          setEndpoint(remoteEndpoint);
        }
      } catch (error) {
        console.warn('[WelcomeIntro] No se pudo leer la config de transcripción remota:', error);
      }

      try {
        const summaryConfig = await invoke<CustomOpenAIConfig | null>('api_get_custom_openai_config');
        if (mounted && summaryConfig?.model) {
          setModel(summaryConfig.model);
        }
        if (mounted && summaryConfig?.apiKey) {
          setApiKey(summaryConfig.apiKey);
        }
      } catch (error) {
        console.warn('[WelcomeIntro] No se pudo leer la config del Servidor Ternova (resumen):', error);
      } finally {
        if (mounted) setCheckingConfig(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleChooseLocal = () => {
    setSelectedChoice('local');
    writeLastChoice('local');
    setShowIntro(false);
    onRequestLocalDownload();
  };

  const handleChooseServer = () => {
    setSelectedChoice('server');
    writeLastChoice('server');
    setShowServerForm(true);
  };

  const handleSaveServerConfig = async () => {
    const trimmedEndpoint = endpoint.trim();
    const trimmedModel = model.trim() || DEFAULT_SUMMARY_MODEL;

    if (!trimmedEndpoint) {
      toast.error('Ingresa el endpoint del Servidor Ternova antes de guardar');
      return;
    }

    setIsSaving(true);
    try {
      // Transcripción: siempre usa el modelo Parakeet remoto en el Servidor Ternova.
      await invoke('api_save_transcript_remote_config', {
        endpoint: trimmedEndpoint,
        model: TRANSCRIPT_MODEL,
        apiKey: apiKey.trim() || null,
      });

      // Resumen / chat: usa el modelo configurado (default qwen3.6-35b).
      await invoke('api_save_custom_openai_config', {
        endpoint: trimmedEndpoint,
        apiKey: apiKey.trim() || null,
        model: trimmedModel,
        maxTokens: null,
        temperature: null,
        topP: null,
      });

      setCurrentEndpoint(trimmedEndpoint);
      setCurrentModel(TRANSCRIPT_MODEL);
      setIsRemoteConfigured(true);
      writeLastChoice('server');
      toast.success('Conectado al Servidor Ternova', {
        description: `${trimmedEndpoint} · resumen: ${trimmedModel}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error('No se pudo guardar la configuración del Servidor Ternova', { description: message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnterApp = () => {
    setShowIntro(false);
    onEnterApp();
  };

  if (!showIntro) {
    return (
      <Tutorial open={showTutorial} onOpenChange={setShowTutorial} />
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-50 dark:bg-background overflow-y-auto">
        <div className="w-full max-w-2xl mx-auto px-6 py-10">
          {/* Header */}
          <div className="text-center space-y-3 mb-8">
            <div className="flex justify-center">
              <Image
                src="/icon_128x128.png"
                alt="Nova"
                width={56}
                height={56}
                className="rounded-xl"
              />
            </div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-foreground">
              Bienvenido a Nova
            </h1>
            <p className="text-sm text-gray-600 dark:text-muted-foreground max-w-md mx-auto">
              Elige cómo quieres transcribir y resumir tus reuniones hoy. Puedes cambiarlo cuando quieras.
            </p>
          </div>

          {/* Dos caminos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {/* Camino 1: Descargar modelos locales */}
            <button
              type="button"
              onClick={handleChooseLocal}
              className={`text-left rounded-xl border-2 p-5 transition-colors bg-white dark:bg-card ${
                selectedChoice === 'local'
                  ? 'border-gray-900 dark:border-primary'
                  : 'border-gray-200 dark:border-border hover:border-gray-300 dark:hover:border-muted-foreground'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-muted flex items-center justify-center mb-3">
                <HardDrive size={20} weight="duotone" className="text-gray-700 dark:text-foreground" />
              </div>
              <h2 className="font-semibold text-gray-900 dark:text-foreground text-sm mb-1">
                Descargar modelos locales
              </h2>
              <p className="text-xs text-gray-600 dark:text-muted-foreground leading-relaxed">
                Todo corre en tu equipo, sin red. Privado y sin depender de un servidor.
              </p>
            </button>

            {/* Camino 2: Conectar al Servidor Ternova */}
            <button
              type="button"
              onClick={handleChooseServer}
              className={`text-left rounded-xl border-2 p-5 transition-colors bg-white dark:bg-card ${
                selectedChoice === 'server'
                  ? 'border-gray-900 dark:border-primary'
                  : 'border-gray-200 dark:border-border hover:border-gray-300 dark:hover:border-muted-foreground'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-muted flex items-center justify-center mb-3">
                <Cloud size={20} weight="duotone" className="text-gray-700 dark:text-foreground" />
              </div>
              <h2 className="font-semibold text-gray-900 dark:text-foreground text-sm mb-1">
                Conectar al Servidor Ternova
              </h2>
              <p className="text-xs text-gray-600 dark:text-muted-foreground leading-relaxed">
                Sin descargas. Transcripción y resumen corren en el servidor de la empresa.
              </p>
            </button>
          </div>

          {/* Estado actual (si ya hay config remota) */}
          {!checkingConfig && isRemoteConfigured && !showServerForm && (
            <div className="flex items-start gap-3 rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/20 p-3 mb-6">
              <CheckCircle size={18} weight="duotone" className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  Ya conectado al Servidor Ternova
                </p>
                <p className="text-xs text-green-700 dark:text-green-400/80 mt-0.5 break-all">
                  {currentEndpoint} · modelo transcripción: {currentModel}
                </p>
              </div>
            </div>
          )}

          {/* Formulario Servidor Ternova */}
          {showServerForm && (
            <div className="rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-card p-5 space-y-4 mb-6">
              <h3 className="text-sm font-medium text-gray-900 dark:text-foreground">
                Configuración del Servidor Ternova
              </h3>

              <div className="space-y-1">
                <Label htmlFor="welcome-endpoint" className="text-xs text-gray-700 dark:text-foreground">
                  Endpoint
                </Label>
                <Input
                  id="welcome-endpoint"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder={DEFAULT_ENDPOINT_PLACEHOLDER}
                  className="h-9"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="welcome-model" className="text-xs text-gray-700 dark:text-foreground">
                  Modelo (chat / resumen)
                </Label>
                <Input
                  id="welcome-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={DEFAULT_SUMMARY_MODEL}
                  className="h-9"
                />
                <p className="text-[11px] text-gray-500 dark:text-muted-foreground">
                  La transcripción usa el modelo <code>parakeet</code> del servidor automáticamente.
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="welcome-apikey" className="text-xs text-gray-700 dark:text-foreground">
                  API key (opcional)
                </Label>
                <Input
                  id="welcome-apikey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Déjalo vacío si no se requiere"
                  className="h-9"
                />
              </div>

              <Button
                type="button"
                onClick={handleSaveServerConfig}
                disabled={isSaving || !endpoint.trim()}
                className="w-full h-10"
              >
                {isSaving ? (
                  <>
                    <CircleNotch size={16} weight="duotone" className="mr-2 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  'Guardar y conectar'
                )}
              </Button>
            </div>
          )}

          {/* Acciones finales */}
          <div className="flex flex-col items-center gap-3">
            <Button
              type="button"
              onClick={handleEnterApp}
              className="w-full max-w-xs h-11 bg-gray-900 hover:bg-gray-800 dark:bg-primary dark:hover:bg-primary/90 text-white dark:text-primary-foreground"
            >
              Entrar a la app
              <ArrowRight size={16} weight="bold" className="ml-2" />
            </Button>

            <button
              type="button"
              onClick={() => setShowTutorial(true)}
              className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground hover:underline"
            >
              <BookOpen size={14} weight="duotone" />
              Ver tutorial
            </button>
          </div>
        </div>
      </div>

      <Tutorial open={showTutorial} onOpenChange={setShowTutorial} />
    </>
  );
}

export default WelcomeIntro;
