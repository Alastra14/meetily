"use client";

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChatTeardropText,
  ClockCounterClockwise,
  GearSix,
  Plus,
  X,
} from '@phosphor-icons/react';
import { useChatSession } from '@/contexts/ChatSessionProvider';
import { useResizable } from '@/hooks/useResizable';
import { ChatSettings } from './ChatSettings';
import { ChatHistoryList } from './ChatHistoryList';
import { ChatConversation } from './ChatConversation';

/** Evento global para abrir el panel de chat directamente en la vista de historial. */
export const OPEN_CHAT_HISTORY_EVENT = 'tn-open-chat-history';

export interface ChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Panel de chat acoplado a la derecha de la ventana (ocupa espacio real, no
 * tapa el contenido). Lee el estado GLOBAL de la conversación (useChatSession):
 * la MISMA conversación que se ve a pantalla completa en /chats. El contexto
 * (reunión abierta / transcript en vivo) lo inyecta ChatDock vía setChatContext.
 */
export function ChatPanel({ open, onOpenChange }: ChatPanelProps) {
  const {
    scope,
    target,
    setTarget,
    sessionId,
    loadSession,
    startNewChat,
    currentMeetingTitle,
  } = useChatSession();

  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Ancho arrastrable: el handle vive en el borde izquierdo del panel (anclado
  // a la derecha de la ventana), así que arrastrar hacia la izquierda agranda.
  const { width: panelWidth, isResizing, handleProps: resizeHandleProps } = useResizable({
    side: 'left',
    min: 320,
    max: 720,
    defaultWidth: 380,
    storageKey: 'tn-chat-width',
  });

  // Permite que otras partes de la UI (p.ej. el botón "Chats" del Sidebar)
  // abran este panel directamente en la vista de historial.
  useEffect(() => {
    const handleOpenHistory = () => {
      setShowSettings(false);
      setShowHistory(true);
      onOpenChange(true);
    };
    window.addEventListener(OPEN_CHAT_HISTORY_EVENT, handleOpenHistory);
    return () => window.removeEventListener(OPEN_CHAT_HISTORY_EVENT, handleOpenHistory);
  }, [onOpenChange]);

  const handleSelectSession = (id: string) => {
    loadSession(id);
    setShowHistory(false);
  };

  const handleStartNewChat = () => {
    startNewChat();
    setShowHistory(false);
  };

  const headerTitle = showHistory
    ? 'Chats guardados'
    : scope === 'current' && currentMeetingTitle
      ? currentMeetingTitle
      : 'Chat con tus reuniones';

  const showBackButton = showSettings || showHistory;
  const handleBack = () => {
    setShowSettings(false);
    setShowHistory(false);
  };

  const asideWidth = open ? panelWidth : 0;

  return (
    // Acoplado al layout: ocupa espacio real en la ventana (empuja el contenido,
    // no tapa el resumen). La animación es de ancho, no de translate.
    <aside
      className={`h-screen shrink-0 z-30 flex flex-col overflow-hidden relative
        bg-white dark:bg-card border-l border-gray-200 dark:border-border
        ${isResizing ? '' : 'transition-[width] duration-300 ease-in-out'}
        ${open ? '' : 'border-l-0'}`}
      style={{ width: asideWidth }}
      role="complementary"
      aria-label="Chat con tus reuniones"
      aria-hidden={!open}
    >
      {open && (
        <div
          {...resizeHandleProps}
          aria-label="Redimensionar panel de chat"
          className={`absolute top-0 left-0 h-full w-1.5 cursor-col-resize z-40
            touch-none select-none
            hover:bg-blue-500/40 dark:hover:bg-blue-400/40
            ${isResizing ? 'bg-blue-500/50 dark:bg-blue-400/50' : 'bg-transparent'}`}
        />
      )}
      <div className="h-full flex flex-col" style={{ width: panelWidth }}>
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 dark:border-border">
          <div className="flex items-center gap-2 min-w-0">
            {showBackButton ? (
              <button
                type="button"
                onClick={handleBack}
                aria-label="Volver al chat"
                className="shrink-0 rounded-md p-1 -ml-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-secondary dark:text-muted-foreground"
              >
                <ArrowLeft size={18} />
              </button>
            ) : (
              <ChatTeardropText size={22} weight="duotone" className="text-blue-600 shrink-0" />
            )}
            <h2 className="text-sm font-semibold text-gray-900 dark:text-foreground truncate">
              {headerTitle}
            </h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!showSettings && !showHistory && (
              <>
                <button
                  type="button"
                  onClick={handleStartNewChat}
                  aria-label="Nuevo chat"
                  title="Nuevo chat"
                  className="rounded-md p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-secondary dark:text-muted-foreground"
                >
                  <Plus size={18} weight="duotone" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowHistory(true)}
                  aria-label="Ver chats guardados"
                  title="Chats guardados"
                  className="rounded-md p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-secondary dark:text-muted-foreground"
                >
                  <ClockCounterClockwise size={18} weight="duotone" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  aria-label="Ajustes del chat"
                  className="rounded-md p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-secondary dark:text-muted-foreground"
                >
                  <GearSix size={18} weight="duotone" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Cerrar chat"
              className="rounded-md p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-secondary dark:text-muted-foreground"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body: historial, ajustes o la conversación compartida */}
        {showHistory ? (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <ChatHistoryList
              activeSessionId={sessionId}
              onSelectSession={handleSelectSession}
              onStartNewChat={handleStartNewChat}
            />
          </div>
        ) : showSettings ? (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <ChatSettings target={target} onTargetChange={setTarget} />
          </div>
        ) : (
          <ChatConversation size="panel" onOpenSettings={() => setShowSettings(true)} />
        )}
      </div>
    </aside>
  );
}

export interface ChatToggleButtonProps {
  onClick: () => void;
  visible?: boolean;
}

export function ChatToggleButton({ onClick, visible = true }: ChatToggleButtonProps) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Abrir chat"
      className="fixed right-4 bottom-24 z-40 rounded-full p-3 shadow-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
    >
      <ChatTeardropText size={22} weight="duotone" />
    </button>
  );
}
