"use client";

// Nova — sección "Chats" a pantalla completa.
//
// Panel-lista de sesiones guardadas (izquierda) + la conversación activa GRANDE
// (derecha), ambas leyendo el MISMO estado global (useChatSession). Es la misma
// conversación que se acopla a la derecha dentro de una llamada: aquí solo se
// muestra a pantalla completa con alcance "todas las reuniones" por defecto.

import { useEffect, useState } from 'react';
import { ChatTeardropText, GearSix, Plus, ArrowLeft } from '@phosphor-icons/react';
import { useChatSession } from '@/contexts/ChatSessionProvider';
import { ChatConversation } from '@/components/Chat/ChatConversation';
import { ChatHistoryList } from '@/components/Chat/ChatHistoryList';
import { ChatSettings } from '@/components/Chat/ChatSettings';

export default function ChatsPage() {
  const {
    sessionId,
    loadSession,
    startNewChat,
    setChatContext,
    setScope,
    target,
    setTarget,
    currentMeetingTitle,
    scope,
  } = useChatSession();

  const [showSettings, setShowSettings] = useState(false);

  // Al entrar a Chats: sin contexto de llamada y alcance "todas las reuniones".
  // No se toca la conversación (mensajes/sesión): sigue siendo la misma global.
  useEffect(() => {
    setChatContext({ currentMeetingId: null, currentMeetingTitle: null, currentLiveTranscript: null });
    setScope('all');
    // Solo al montar la vista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const headerTitle = scope === 'current' && currentMeetingTitle ? currentMeetingTitle : 'Chats';

  return (
    <div className="h-screen flex flex-col pr-8 py-6">
      <div className="flex-1 min-h-0 flex rounded-2xl border border-gray-200 dark:border-border overflow-hidden bg-white dark:bg-card">
        {/* Columna izquierda: sesiones guardadas */}
        <aside className="w-72 shrink-0 flex flex-col border-r border-gray-200 dark:border-border">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 dark:border-border">
            <div className="flex items-center gap-2 min-w-0">
              <ChatTeardropText size={20} weight="duotone" className="text-blue-600 shrink-0" />
              <h1 className="text-sm font-semibold text-gray-900 dark:text-foreground truncate">
                Chats guardados
              </h1>
            </div>
            <button
              type="button"
              onClick={() => {
                startNewChat();
                setShowSettings(false);
              }}
              aria-label="Nuevo chat"
              title="Nuevo chat"
              className="shrink-0 rounded-md p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-secondary dark:text-muted-foreground"
            >
              <Plus size={18} weight="duotone" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <ChatHistoryList
              activeSessionId={sessionId}
              onSelectSession={(id) => {
                loadSession(id);
                setShowSettings(false);
              }}
              onStartNewChat={() => {
                startNewChat();
                setShowSettings(false);
              }}
            />
          </div>
        </aside>

        {/* Columna derecha: la conversación activa a lo grande */}
        <section className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 dark:border-border">
            <div className="flex items-center gap-2 min-w-0">
              {showSettings && (
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  aria-label="Volver al chat"
                  className="shrink-0 rounded-md p-1 -ml-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-secondary dark:text-muted-foreground"
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <h2 className="text-sm font-semibold text-gray-900 dark:text-foreground truncate">
                {showSettings ? 'Ajustes del chat' : headerTitle}
              </h2>
            </div>
            {!showSettings && (
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                aria-label="Ajustes del chat"
                title="Ajustes del chat"
                className="shrink-0 rounded-md p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-secondary dark:text-muted-foreground"
              >
                <GearSix size={18} weight="duotone" />
              </button>
            )}
          </div>

          {showSettings ? (
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="mx-auto w-full max-w-2xl">
                <ChatSettings target={target} onTargetChange={setTarget} />
              </div>
            </div>
          ) : (
            <ChatConversation size="full" onOpenSettings={() => setShowSettings(true)} />
          )}
        </section>
      </div>
    </div>
  );
}
