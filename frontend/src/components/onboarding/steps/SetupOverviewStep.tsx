import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Info, Loader2 } from 'lucide-react';
import { Broadcast, Download, CheckCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OnboardingContainer } from '../OnboardingContainer';
import { useOnboarding } from '@/contexts/OnboardingContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RemoteTranscriptConfig {
  provider: string;
  model: string;
  apiKey?: string | null;
  remoteEndpoint?: string | null;
  endpoint?: string | null;
}

const DEFAULT_REMOTE_ENDPOINT_PLACEHOLDER = 'http://dgx-spark:8004/v1';
const DEFAULT_REMOTE_MODEL = 'whisper-large-v3';

export function SetupOverviewStep() {
  const { goNext, completeOnboardingWithoutLocalModels } = useOnboarding();
  const [isMac, setIsMac] = useState(false);

  // Estado de la opción "Servidor Ternova (DGX)"
  const [checkingRemoteConfig, setCheckingRemoteConfig] = useState(true);
  const [bakedRemoteEndpoint, setBakedRemoteEndpoint] = useState<string | null>(null);
  const [bakedRemoteModel, setBakedRemoteModel] = useState<string>(DEFAULT_REMOTE_MODEL);
  const [showManualRemoteForm, setShowManualRemoteForm] = useState(false);
  const [remoteEndpointInput, setRemoteEndpointInput] = useState('');
  const [remoteModelInput, setRemoteModelInput] = useState(DEFAULT_REMOTE_MODEL);
  const [isActivatingRemote, setIsActivatingRemote] = useState(false);

  useEffect(() => {
    const checkPlatform = async () => {
      try {
        const { platform } = await import('@tauri-apps/plugin-os');
        setIsMac(platform() === 'macos');
      } catch (e) {
        setIsMac(navigator.userAgent.includes('Mac'));
      }
    };
    checkPlatform();
  }, []);

  // Al montar, revisa si ya hay un endpoint remoto (horneado en el build corporativo
  // o guardado previamente por el usuario) para poder usarlo con un solo clic.
  useEffect(() => {
    const loadRemoteConfig = async () => {
      try {
        const config = await invoke<RemoteTranscriptConfig | null>('api_get_transcript_config');
        const endpoint = config?.remoteEndpoint || config?.endpoint || null;
        if (config?.provider === 'remote' && endpoint) {
          setBakedRemoteEndpoint(endpoint);
          setBakedRemoteModel(config.model || DEFAULT_REMOTE_MODEL);
        }
      } catch (error) {
        console.warn('[SetupOverviewStep] No se pudo leer la config de transcripción remota:', error);
      } finally {
        setCheckingRemoteConfig(false);
      }
    };
    loadRemoteConfig();
  }, []);

  const steps = [
    {
      number: 1,
      type: 'transcription',
      title: 'Download Transcription Engine',
    },
    {
      number: 2,
      type: 'summarization',
      title: 'Download Summarization Engine',
    },
  ];

  const handleContinue = () => {
    goNext();
  };

  // Activa el flujo "Servidor Ternova (DGX)": guarda (si hace falta) la config remota
  // de transcripción y resumen, y salta directo a completar el onboarding sin
  // descargar ningún modelo local.
  const activateRemoteServer = async (endpointOverride?: string, modelOverride?: string) => {
    setIsActivatingRemote(true);
    try {
      const endpoint = (endpointOverride ?? bakedRemoteEndpoint ?? '').trim();
      const model = (modelOverride ?? bakedRemoteModel ?? DEFAULT_REMOTE_MODEL).trim() || DEFAULT_REMOTE_MODEL;

      if (!endpoint) {
        toast.error('Ingresa el endpoint del Servidor Ternova (DGX) antes de continuar');
        setIsActivatingRemote(false);
        return;
      }

      // Guarda la config de transcripción remota si no venía ya horneada/guardada
      // con este mismo endpoint.
      if (!bakedRemoteEndpoint || endpointOverride) {
        await invoke('api_save_transcript_remote_config', {
          endpoint,
          model,
          apiKey: null,
        });
      }

      // Si el build trae horneado el endpoint de resumen de la DGX, actívalo también.
      const dgxSummaryEndpoint = process.env.NEXT_PUBLIC_TERNOVA_DGX_SUMMARY_ENDPOINT;
      if (dgxSummaryEndpoint) {
        const dgxSummaryModel = process.env.NEXT_PUBLIC_TERNOVA_DGX_SUMMARY_MODEL || 'qwen3.6-35b';
        try {
          await invoke('api_save_custom_openai_config', {
            endpoint: dgxSummaryEndpoint,
            apiKey: null,
            model: dgxSummaryModel,
            maxTokens: null,
            temperature: null,
            topP: null,
          });
        } catch (error) {
          console.warn('[SetupOverviewStep] No se pudo guardar la config de resumen remoto:', error);
        }
      }

      // Marca el onboarding como completado saltando la descarga de modelos locales
      // (no se invoca el complete_onboarding de Rust para no forzar provider=parakeet).
      await completeOnboardingWithoutLocalModels();
      await new Promise((resolve) => setTimeout(resolve, 100));
      window.location.reload();
    } catch (error) {
      console.error('[SetupOverviewStep] Falló la activación del Servidor Ternova:', error);
      const message = error instanceof Error ? error.message : String(error);
      toast.error('No se pudo activar el Servidor Ternova', { description: message });
      setIsActivatingRemote(false);
    }
  };

  const handleUseRemoteServer = () => {
    if (bakedRemoteEndpoint) {
      activateRemoteServer();
      return;
    }
    setShowManualRemoteForm(true);
  };

  const handleConfirmManualRemote = () => {
    activateRemoteServer(remoteEndpointInput, remoteModelInput);
  };

  return (
    <OnboardingContainer
      title="Setup Overview"
      description="Elige cómo quieres transcribir y resumir tus reuniones."
      step={2}
      totalSteps={isMac ? 4 : 3}
    >
      <div className="flex flex-col items-center space-y-6">
        {/* Opción recomendada: Servidor Ternova (DGX) */}
        <div className="w-full max-w-md rounded-lg border-2 border-gray-900 bg-gray-900 text-white p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <Broadcast size={22} weight="duotone" className="text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">🛰️ Usar Servidor Ternova (DGX)</h3>
                <span className="text-[10px] uppercase tracking-wide bg-white/15 text-white px-2 py-0.5 rounded-full">
                  Recomendado
                </span>
              </div>
              <p className="text-sm text-gray-300 mt-1">
                Sin descargas. La transcripción y el resumen corren en el servidor de la
                empresa (DGX Spark). Empieza a usar la app de inmediato.
              </p>
            </div>
          </div>

          {showManualRemoteForm && !bakedRemoteEndpoint && (
            <div className="space-y-3 bg-white/5 rounded-md p-3">
              <div className="space-y-1">
                <Label htmlFor="remote-endpoint" className="text-xs text-gray-300">
                  Endpoint del servidor
                </Label>
                <Input
                  id="remote-endpoint"
                  value={remoteEndpointInput}
                  onChange={(e) => setRemoteEndpointInput(e.target.value)}
                  placeholder={DEFAULT_REMOTE_ENDPOINT_PLACEHOLDER}
                  className="bg-white text-gray-900 h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="remote-model" className="text-xs text-gray-300">
                  Modelo
                </Label>
                <Input
                  id="remote-model"
                  value={remoteModelInput}
                  onChange={(e) => setRemoteModelInput(e.target.value)}
                  placeholder={DEFAULT_REMOTE_MODEL}
                  className="bg-white text-gray-900 h-9"
                />
              </div>
            </div>
          )}

          <Button
            onClick={showManualRemoteForm && !bakedRemoteEndpoint ? handleConfirmManualRemote : handleUseRemoteServer}
            disabled={checkingRemoteConfig || isActivatingRemote}
            className="w-full h-10 bg-white text-gray-900 hover:bg-gray-100 disabled:opacity-60"
          >
            {isActivatingRemote ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : (
              <CheckCircle size={16} weight="duotone" className="mr-2" />
            )}
            {bakedRemoteEndpoint
              ? 'Usar Servidor Ternova (DGX)'
              : showManualRemoteForm
              ? 'Confirmar y continuar'
              : 'Configurar y usar Servidor Ternova (DGX)'}
          </Button>
        </div>

        <div className="text-xs text-gray-500">
          — o bien —
        </div>

        {/* Opción alternativa: descargar modelos locales */}
        <div className="w-full max-w-md bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Download className="w-4 h-4 text-gray-500" weight="duotone" />
            <p className="text-sm font-medium text-gray-700">
              También puedes descargar modelos locales para trabajar sin red
            </p>
          </div>
          <div className="space-y-4">
            {steps.map((step) => {
              return (
                <div
                  key={step.number}
                  className={`flex items-start gap-4 p-1`}
                >
                  <div className="flex-1 ml-1">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                        Step {step.number} :  {step.title}

                        {step.type === "summarization" && (
                            <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                <button className="text-gray-400 hover:text-gray-600">
                                    <Info className="w-4 h-4" />
                                </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs text-sm">
                                You can also select external AI providers like OpenAI, Claude, or
                                Ollama for summary generation in settings.
                                </TooltipContent>
                            </Tooltip>
                            </TooltipProvider>
                        )}
                        </h3>
                  </div>
                </div>
              );
            })}
          </div>
        </div>


        {/* CTA Section */}
        <div className="w-full max-w-xs space-y-4">
          <Button
            onClick={handleContinue}
            variant="outline"
            className="w-full h-11"
          >
            Descargar modelos locales
          </Button>
          <div className="text-center">
            <a
              href="https://github.com/Zackriya-Solutions/meeting-minutes"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-600 hover:underline"
            >
              Report issues on GitHub
            </a>
          </div>
        </div>
      </div>
    </OnboardingContainer>
  );
}
