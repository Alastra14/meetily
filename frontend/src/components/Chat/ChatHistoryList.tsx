"use client";

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChatCircleDots, Plus, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
  deleteSession,
  listSessions,
  type ChatSession,
} from '@/lib/chat-history';

export interface ChatHistoryListProps {
  /** Sesión actualmente cargada en el panel (se resalta en la lista). */
  activeSessionId?: string | null;
  onSelectSession: (id: string) => void;
  onStartNewChat: () => void;
}

/**
 * Vista de "Chats guardados" dentro del ChatPanel: lista las sesiones
 * persistidas en localStorage (ver src/lib/chat-history.ts), permite
 * reabrirlas, borrarlas o empezar un chat nuevo.
 */
export function ChatHistoryList({ activeSessionId, onSelectSession, onStartNewChat }: ChatHistoryListProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  useEffect(() => {
    setSessions(listSessions());
  }, []);

  const handleDelete = (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    toast.success('Chat eliminado');
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onStartNewChat}
        className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed
          border-gray-300 dark:border-border text-sm font-medium text-gray-600 dark:text-muted-foreground
          px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-secondary transition-colors"
      >
        <Plus size={16} weight="duotone" />
        Nuevo chat
      </button>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center px-2 py-10">
          <ChatCircleDots size={36} weight="duotone" className="text-gray-300 dark:text-muted-foreground/50 mb-3" />
          <p className="text-sm text-gray-500 dark:text-muted-foreground">
            Todavía no hay chats guardados.
          </p>
          <p className="text-xs text-gray-400 dark:text-muted-foreground mt-1">
            Tus conversaciones aparecerán aquí automáticamente.
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <li key={session.id}>
                <button
                  type="button"
                  onClick={() => onSelectSession(session.id)}
                  className={`w-full flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors group ${
                    isActive
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-500'
                      : 'border-gray-200 dark:border-border hover:border-gray-300 dark:hover:border-muted-foreground hover:bg-gray-50 dark:hover:bg-secondary'
                  }`}
                >
                  <ChatCircleDots
                    size={18}
                    weight="duotone"
                    className={`mt-0.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400 dark:text-muted-foreground'}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-gray-900 dark:text-foreground truncate">
                      {session.title}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-muted-foreground mt-0.5">
                      {formatDistanceToNow(session.updatedAt, { addSuffix: true, locale: es })}
                    </span>
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleDelete(e, session.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleDelete(e as unknown as React.MouseEvent, session.id);
                    }}
                    aria-label="Eliminar chat"
                    title="Eliminar chat"
                    className="shrink-0 rounded-md p-1 opacity-0 group-hover:opacity-100 focus:opacity-100
                      text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-opacity"
                  >
                    <Trash size={16} weight="duotone" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
