"use client";

// Nova — estado GLOBAL y persistente del chat con las reuniones.
//
// La conversación es UNA sola: sigue al usuario por toda la app y NUNCA se
// reinicia al navegar. Lo único que cambia es el *contexto/alcance accesible*:
//   - En /chats: la conversación se ve a pantalla completa (alcance 'all').
//   - En una llamada (meeting-details): la MISMA conversación se acopla a la
//     derecha y el alcance 'current' pasa a estar disponible ("Esta llamada").
//   - En Home grabando: el transcript en vivo alimenta el alcance 'current'.
//
// El contexto (meeting abierto / transcript en vivo) lo inyecta quien esté
// montado en la ruta vía `setChatContext(...)`. El estado de la conversación
// (mensajes, loading, scope, target, sesión) vive aquí, por encima del router,
// para que cambiar de ruta NO lo destruya.
//
// Persistencia de sesiones: src/lib/chat-history.ts (localStorage).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import {
  deriveTitle,
  getSession,
  newSession,
  saveSession,
  type ChatSession,
} from '@/lib/chat-history';

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

/** Contexto/alcance activo, inyectado por la ruta montada (ChatDock). */
export interface ChatContext {
  /** Reunión abierta actualmente (null si estamos en Home / Chats). */
  currentMeetingId: string | null;
  /** Título de la reunión abierta (para el encabezado del panel). */
  currentMeetingTitle: string | null;
  /** Transcript en vivo (null si no se está grabando). */
  currentLiveTranscript: string | null;
}

interface ChatResponse {
  answer: string;
  provider_label: string;
  used_meetings: ChatScopeMeeting[];
}

export interface ChatSessionContextValue {
  // Estado de la conversación (global).
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  scope: ChatScope;
  target: ChatTarget;
  sessionId: string | null;
  providerLabel: string | null;
  usedMeetings: ChatScopeMeeting[];

  // Contexto/alcance activo.
  currentMeetingId: string | null;
  currentMeetingTitle: string | null;
  currentLiveTranscript: string | null;
  /** true si hay un contexto "current" disponible (reunión abierta o grabación). */
  hasCurrentContext: boolean;

  // Acciones.
  setChatContext: (ctx: Partial<ChatContext>) => void;
  setScope: (scope: ChatScope) => void;
  setTarget: (target: ChatTarget) => void;
  sendMessage: (question: string) => Promise<void>;
  startNewChat: () => void;
  loadSession: (id: string) => void;
  clearChat: () => void;
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

const ChatSessionContext = createContext<ChatSessionContextValue | null>(null);

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  // --- Conversación (global, persistente) ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScopeState] = useState<ChatScope>('all');
  const [target, setTargetState] = useState<ChatTarget>('local');
  const [usedMeetings, setUsedMeetings] = useState<ChatScopeMeeting[]>([]);
  const [providerLabel, setProviderLabel] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // --- Contexto/alcance activo (inyectado por la ruta) ---
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [currentMeetingTitle, setCurrentMeetingTitle] = useState<string | null>(null);
  const [currentLiveTranscript, setCurrentLiveTranscript] = useState<string | null>(null);

  const hasCurrentContext = Boolean(currentMeetingId) || Boolean(currentLiveTranscript);

  // Espejo del meetingId actual para decidir, dentro de setChatContext, si llegó
  // una reunión NUEVA (sin anidar setters ni depender de closures obsoletas).
  const currentMeetingIdRef = useRef<string | null>(currentMeetingId);
  currentMeetingIdRef.current = currentMeetingId;

  // Evita persistir de nuevo justo después de un loadSession/startNewChat.
  const skipNextPersistRef = useRef(false);

  // Cargar el target persistido una vez montado (evita mismatches de SSR/hydration).
  useEffect(() => {
    setTargetState(readStoredTarget());
  }, []);

  // Si deja de haber contexto "current" (p.ej. se sale de la reunión / para la
  // grabación), regresa el scope a 'all' para no quedar en un estado inválido.
  // NUNCA toca los mensajes: la conversación se conserva.
  useEffect(() => {
    if (!hasCurrentContext && scope === 'current') {
      setScopeState('all');
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

  // El scope 'current' solo es válido si hay contexto actual; si no, se fuerza 'all'.
  const setScope = useCallback(
    (next: ChatScope) => {
      if (next === 'current' && !hasCurrentContext) {
        setScopeState('all');
        return;
      }
      setScopeState(next);
    },
    [hasCurrentContext]
  );

  // Inyecta/actualiza el contexto activo (merge parcial). Al ENTRAR a una
  // llamada (llega un meetingId nuevo), el alcance pasa a 'current' por defecto
  // —pero SIN borrar la conversación—. Nunca reinicia mensajes.
  const setChatContext = useCallback((ctx: Partial<ChatContext>) => {
    if ('currentMeetingId' in ctx) {
      const nextMeetingId = ctx.currentMeetingId ?? null;
      const isNewMeeting = Boolean(nextMeetingId) && nextMeetingId !== currentMeetingIdRef.current;
      currentMeetingIdRef.current = nextMeetingId;
      setCurrentMeetingId(nextMeetingId);
      // Al aparecer una reunión NUEVA, por defecto acoplamos el alcance a ella
      // (sin tocar los mensajes: la conversación se conserva).
      if (isNewMeeting) {
        setScopeState('current');
      }
    }
    if ('currentMeetingTitle' in ctx) {
      setCurrentMeetingTitle(ctx.currentMeetingTitle ?? null);
    }
    if ('currentLiveTranscript' in ctx) {
      setCurrentLiveTranscript(ctx.currentLiveTranscript ?? null);
    }
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setUsedMeetings([]);
    setProviderLabel(null);
  }, []);

  // Persiste la sesión actual cada vez que cambian los mensajes: crea una sesión
  // nueva al primer intercambio y la actualiza en los siguientes. Se salta la
  // persistencia justo después de loadSession/startNewChat.
  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    if (messages.length === 0) return;

    const existing = sessionId ? getSession(sessionId) : null;
    const base: ChatSession =
      existing ?? newSession({ meetingId: currentMeetingId, scope, target });

    const next: ChatSession = {
      ...base,
      meetingId: base.meetingId ?? currentMeetingId ?? null,
      scope,
      target,
      messages,
      title:
        existing?.title && existing.title !== 'Nuevo chat'
          ? existing.title
          : deriveTitle(messages),
    };

    saveSession(next);
    if (!sessionId) setSessionId(next.id);
  }, [messages, scope, target, currentMeetingId, sessionId]);

  /** Carga una sesión guardada: reemplaza messages, scope y target actuales. */
  const loadSession = useCallback(
    (id: string) => {
      const session = getSession(id);
      if (!session) {
        toast.error('No se encontró ese chat guardado');
        return;
      }
      skipNextPersistRef.current = true;
      setSessionId(session.id);
      setMessages(session.messages);
      // El scope guardado solo se respeta si sigue siendo válido en el contexto actual.
      setScopeState(session.scope === 'current' && !hasCurrentContext ? 'all' : session.scope);
      setTargetState(session.target);
      setError(null);
      setUsedMeetings([]);
      setProviderLabel(null);
    },
    [hasCurrentContext]
  );

  /** Empieza un chat en blanco, desligado de cualquier sesión guardada previa. */
  const startNewChat = useCallback(() => {
    skipNextPersistRef.current = true;
    setSessionId(null);
    setMessages([]);
    setError(null);
    setUsedMeetings([]);
    setProviderLabel(null);
    setScopeState(hasCurrentContext ? 'current' : 'all');
  }, [hasCurrentContext]);

  const sendMessage = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || loading) return;

      const userMessage: ChatMessage = { role: 'user', content: trimmed };
      const historyForRequest = messages.slice(-8);
      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);
      setError(null);

      // El contexto de la llamada solo se envía cuando el alcance es 'current'.
      const effectiveMeetingId = scope === 'current' ? currentMeetingId ?? null : null;

      try {
        const res = await invoke<ChatResponse>('chat_with_meetings', {
          question: trimmed,
          scope,
          meetingId: effectiveMeetingId,
          liveTranscript: currentLiveTranscript ?? null,
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
    [loading, messages, scope, currentMeetingId, currentLiveTranscript, target]
  );

  const value = useMemo<ChatSessionContextValue>(
    () => ({
      messages,
      loading,
      error,
      scope,
      target,
      sessionId,
      providerLabel,
      usedMeetings,
      currentMeetingId,
      currentMeetingTitle,
      currentLiveTranscript,
      hasCurrentContext,
      setChatContext,
      setScope,
      setTarget,
      sendMessage,
      startNewChat,
      loadSession,
      clearChat,
    }),
    [
      messages,
      loading,
      error,
      scope,
      target,
      sessionId,
      providerLabel,
      usedMeetings,
      currentMeetingId,
      currentMeetingTitle,
      currentLiveTranscript,
      hasCurrentContext,
      setChatContext,
      setScope,
      setTarget,
      sendMessage,
      startNewChat,
      loadSession,
      clearChat,
    ]
  );

  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>;
}

export function useChatSession(): ChatSessionContextValue {
  const ctx = useContext(ChatSessionContext);
  if (!ctx) {
    throw new Error('useChatSession must be used within a ChatSessionProvider');
  }
  return ctx;
}
