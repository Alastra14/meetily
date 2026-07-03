"use client";

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { Cpu, HardDrive } from '@phosphor-icons/react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { ChatTarget } from '@/hooks/useMeetingChat';

const TARGET_STORAGE_KEY = 'tn-chat-target';

function readStoredTarget(): ChatTarget {
  if (typeof window === 'undefined') return 'local';
  try {
    const stored = window.localStorage.getItem(TARGET_STORAGE_KEY);
    return stored === 'ternova' ? 'ternova' : 'local';
  } catch {
    return 'local';
  }
}

function writeStoredTarget(target: ChatTarget) {
  try {
    window.localStorage.setItem(TARGET_STORAGE_KEY, target);
  } catch {
    // localStorage puede fallar en contextos restringidos; no es crítico.
  }
}

interface CustomOpenAIConfig {
  endpoint?: string | null;
  model?: string | null;
  apiKey?: string | null;
  maxTokens?: number | null;
  temperature?: number | null;
  topP?: number | null;
}

export interface ChatSettingsProps {
  /** Motor activo, controlado externamente (p.ej. desde useMeetingChat). */
  target?: ChatTarget;
  /** Callback cuando cambia el motor. Si no se provee, el componente maneja su propio estado vía localStorage. */
  onTargetChange?: (target: ChatTarget) => void;
}

const ENGINE_OPTIONS: { value: ChatTarget; label: string; description: string; icon: typeof HardDrive }[] = [
  {
    value: 'local',
    label: 'Local (config del resumen)',
    description: 'Usa el mismo proveedor configurado para generar resúmenes en este equipo.',
    icon: HardDrive,
  },
  {
    value: 'ternova',
    label: 'Servidor Ternova (DGX)',
    description: 'Envía las preguntas al servidor OpenAI-compatible de la DGX de Ternova.',
    icon: Cpu,
  },
];

export function ChatSettings({ target: targetProp, onTargetChange }: ChatSettingsProps) {
  const [internalTarget, setInternalTarget] = useState<ChatTarget>('local');
  const target = targetProp ?? internalTarget;

  const [endpoint, setEndpoint] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasLoadedConfig, setHasLoadedConfig] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Si no hay control externo, cargamos/persistimos el target localmente.
  useEffect(() => {
    if (targetProp === undefined) {
      setInternalTarget(readStoredTarget());
    }
  }, [targetProp]);

  const handleTargetChange = (next: ChatTarget) => {
    if (onTargetChange) {
      onTargetChange(next);
    } else {
      setInternalTarget(next);
      writeStoredTarget(next);
    }
  };

  // Precarga la config existente del Servidor Ternova, si el comando de lectura existe.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const config = (await invoke('api_get_custom_openai_config')) as CustomOpenAIConfig | null;
        if (mounted && config) {
          setEndpoint(config.endpoint || '');
          setModel(config.model || '');
          setApiKey(config.apiKey || '');
        }
      } catch (err) {
        console.error('No se pudo precargar la configuración del Servidor Ternova:', err);
      } finally {
        if (mounted) setHasLoadedConfig(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleTestConnection = async () => {
    if (!endpoint.trim() || !model.trim()) {
      toast.error('Ingresa el endpoint y el modelo antes de probar la conexión');
      return;
    }
    setIsTestingConnection(true);
    try {
      const result = await invoke<{ status: string; message: string }>('api_test_custom_openai_connection', {
        endpoint: endpoint.trim(),
        apiKey: apiKey.trim() || null,
        model: model.trim(),
      });
      toast.success(result.message || 'Conexión exitosa');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('No se pudo conectar con el Servidor Ternova', { description: message });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!endpoint.trim() || !model.trim()) {
      toast.error('El endpoint y el modelo son obligatorios');
      return;
    }
    setIsSaving(true);
    try {
      await invoke('api_save_custom_openai_config', {
        endpoint: endpoint.trim(),
        apiKey: apiKey.trim() || null,
        model: model.trim(),
        maxTokens: null,
        temperature: null,
        topP: null,
      });
      toast.success('Configuración del Servidor Ternova guardada');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('No se pudo guardar la configuración', { description: message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Selector de motor */}
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-foreground mb-2">Motor del chat</p>
        <div className="space-y-2" role="radiogroup" aria-label="Motor del chat">
          {ENGINE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = target === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => handleTargetChange(option.value)}
                className={`w-full flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  selected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-500'
                    : 'border-gray-200 dark:border-border hover:border-gray-300 dark:hover:border-muted-foreground'
                }`}
              >
                <Icon
                  size={18}
                  weight="duotone"
                  className={`mt-0.5 shrink-0 ${selected ? 'text-blue-600' : 'text-gray-400 dark:text-muted-foreground'}`}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900 dark:text-foreground">
                    {option.label}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-muted-foreground mt-0.5">
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sección Servidor Ternova */}
      <div className="border-t border-gray-200 dark:border-border pt-4 space-y-3">
        <p className="text-sm font-medium text-gray-900 dark:text-foreground">Servidor Ternova</p>
        {!hasLoadedConfig && (
          <p className="text-xs text-gray-400 dark:text-muted-foreground">Cargando configuración…</p>
        )}

        <div>
          <label htmlFor="chat-settings-endpoint" className="text-sm font-medium text-gray-700 dark:text-foreground">
            Endpoint
          </label>
          <Input
            id="chat-settings-endpoint"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="http://dgx-spark.local:8000/v1"
            className="mt-1"
          />
          <p className="text-xs text-gray-400 dark:text-muted-foreground mt-1">
            URL base de la API compatible con OpenAI de la DGX.
          </p>
        </div>

        <div>
          <label htmlFor="chat-settings-model" className="text-sm font-medium text-gray-700 dark:text-foreground">
            Modelo
          </label>
          <Input
            id="chat-settings-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-oss:20b"
            className="mt-1"
          />
        </div>

        <div>
          <label htmlFor="chat-settings-apikey" className="text-sm font-medium text-gray-700 dark:text-foreground">
            API key (opcional)
          </label>
          <Input
            id="chat-settings-apikey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Déjalo vacío si no se requiere"
            className="mt-1"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={isTestingConnection || !endpoint.trim() || !model.trim()}
            className="flex-1"
          >
            {isTestingConnection ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Probando…
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Probar conexión
              </>
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSaveConfig}
            disabled={isSaving || !endpoint.trim() || !model.trim()}
            className="flex-1"
          >
            {isSaving ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Guardando…
              </>
            ) : (
              'Guardar'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
