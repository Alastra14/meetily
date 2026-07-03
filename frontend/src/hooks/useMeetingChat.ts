"use client";

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatScopeMeeting {
  id: string;
  title: string;
}

export type ChatScope = 'current' | 'all';
export type ChatTarget = 'local' | 'ternova';

export interface UseMeetingChatOptions {
  /** Reunión abierta actualmente (null si estamos en Home). */
  meetingId?: string | null;
  /** Transcript en vivo (null si no se está grabando). */
  liveTranscript?: string | null;
}

interface ChatResponse {
  answer: string;
  provider_label: string;
  used_meetings: ChatScopeMeeting[];
}

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

export function useMeetingChat({ meetingId = null, liveTranscript = null }: UseMeetingChatOptions = {}) {
  const hasCurrentContext = Boolean(meetingId) || Boolean(liveTranscript);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<ChatScope>(hasCurrentContext ? 'current' : 'all');
  const [target, setTargetState] = useState<ChatTarget>('local');
  const [usedMeetings, setUsedMeetings] = useState<ChatScopeMeeting[]>([]);
  const [providerLabel, setProviderLabel] = useState<string | null>(null);

  // Cargar el target persistido una vez montado (evita mismatches de SSR/hydration).
  useEffect(() => {
    setTargetState(readStoredTarget());
  }, []);

  // Si deja de haber contexto "current" disponible (p.ej. se cierra la reunión),
  // regresamos el scope a 'all' para no quedar en un estado inválido.
  useEffect(() => {
    if (!hasCurrentContext && scope === 'current') {
      setScope('all');
    }
  }, [hasCurrentContext, scope]);

  const setTarget = useCallback((next: ChatTarget) => {
    setTargetState(next);
    try {
      window.localStorage.setItem(TARGET_STORAGE_KEY, next);
    } catch {
      // localStorage puede fallar en contextos restringidos; no es crítico.
    }
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setUsedMeetings([]);
    setProviderLabel(null);
  }, []);

  const sendMessage = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || loading) return;

      const userMessage: ChatMessage = { role: 'user', content: trimmed };
      const historyForRequest = messages.slice(-8);
      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);
      setError(null);

      try {
        const res = await invoke<ChatResponse>('chat_with_meetings', {
          question: trimmed,
          scope,
          meetingId: meetingId ?? null,
          liveTranscript: liveTranscript ?? null,
          history: historyForRequest,
          target,
        });

        setMessages((prev) => [...prev, { role: 'assistant', content: res.answer }]);
        setUsedMeetings(res.used_meetings ?? []);
        setProviderLabel(res.provider_label ?? null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        toast.error('No se pudo obtener respuesta del chat', {
          description: message,
        });
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, scope, meetingId, liveTranscript, target]
  );

  return {
    messages,
    loading,
    error,
    scope,
    setScope,
    target,
    setTarget,
    sendMessage,
    clearChat,
    hasCurrentContext,
    usedMeetings,
    providerLabel,
  };
}
