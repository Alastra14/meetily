"use client";

// Nova — compatibilidad hacia atrás.
//
// El estado del chat dejó de vivir por-montaje aquí y ahora es GLOBAL y
// persistente en ChatSessionProvider (src/contexts/ChatSessionProvider.tsx).
// Este archivo delega para no romper a los consumidores existentes: expone
// `useMeetingChat` (= useChatSession) y re-exporta los tipos que otros módulos
// (p.ej. ChatSettings) importan desde aquí.
//
// El contexto (reunión abierta / transcript en vivo) ya NO se pasa como
// argumento: lo inyecta la ruta activa vía setChatContext(...). El parámetro
// opcional se conserva solo por compatibilidad de firma y se ignora.

import { useChatSession } from '@/contexts/ChatSessionProvider';
import type {
  ChatMessage,
  ChatScope,
  ChatScopeMeeting,
  ChatTarget,
} from '@/contexts/ChatSessionProvider';

export type { ChatMessage, ChatScope, ChatScopeMeeting, ChatTarget };

export interface UseMeetingChatOptions {
  /** @deprecated El contexto ahora se inyecta vía setChatContext. Ignorado. */
  meetingId?: string | null;
  /** @deprecated El contexto ahora se inyecta vía setChatContext. Ignorado. */
  liveTranscript?: string | null;
}

/**
 * @deprecated Usa `useChatSession` de `@/contexts/ChatSessionProvider`.
 * Se mantiene como alias para consumidores existentes. Cualquier opción que
 * se le pase se ignora: el contexto es global.
 */
export function useMeetingChat(_options: UseMeetingChatOptions = {}) {
  return useChatSession();
}
