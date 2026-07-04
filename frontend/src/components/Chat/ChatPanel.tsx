"use client";

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft,
  ChatTeardropText,
  ClockCounterClockwise,
  GearSix,
  PaperPlaneRight,
  Plus,
  X,
} from '@phosphor-icons/react';
import { Loader2 } from 'lucide-react';
import { useMeetingChat } from '@/hooks/useMeetingChat';
import { useResizable } from '@/hooks/useResizable';
import { ChatSettings } from './ChatSettings';
import { ChatHistoryList } from './ChatHistoryList';

/** Evento global para abrir el panel de chat directamente en la vista de historial. */
export const OPEN_CHAT_HISTORY_EVENT = 'tn-open-chat-history';

export interface ChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId?: string | null;
  meetingTitle?: string | null;
  liveTranscript?: string | null;
}

const EXAMPLE_QUESTIONS = [
  '¿Cuáles fueron los acuerdos principales?',
  '¿Qué tareas quedaron pendientes y para quién?',
  'Resume esta reunión en 3 puntos.',
];

export function ChatPanel({
  open,
  onOpenChange,
  meetingId = null,
  meetingTitle = null,
  liveTranscript = null,
}: ChatPanelProps) {
  const {
    messages,
    loading,
    scope,
    setScope,
    target,
    setTarget,
    sendMessage,
    hasCurrentContext,
    sessionId,
    loadSession,
    startNewChat,
  } = useMeetingChat({ meetingId, liveTranscript });

  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Ancho arrastrable: el handle vive en el borde izquierdo del panel (anclado
  // a la derecha de la ventana), así que arrastrar hacia la izquierda agranda.
  const { width: panelWidth, isResizing, handleProps: resizeHandleProps } = useResizable({
    side: 'left',
    min: 320,
    max: 720,
    defaultWidth: 380,
    storageKey: 'tn-chat-width',
  });

  const targetLabel = target === 'ternova' ? 'Servidor Ternova' : 'Local';

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open, loading]);

  // Permite que otras partes de la UI (p.ej. el botón "Chats" del Sidebar)
  // abran este panel directamente en la vista de historial, sin depender
  // de ChatUIContext (que no expone ese detalle).
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

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setInput('');
    await sendMessage(question);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const headerTitle = showHistory
    ? 'Chats guardados'
    : scope === 'current' && meetingTitle
      ? meetingTitle
      : 'Chat con tus reuniones';

  const showBackButton = showSettings || showHistory;
  const handleBack = () => {
    setShowSettings(false);
    setShowHistory(false);
  };

  const asideWidth = open ? panelWidth : 0;

  return (
    // Acoplado al layout: ocupa espacio real en la ventana (empuja el contenido,
    // no tapa el resumen). La animación es de ancho, no de translate. Se
    // desactiva la transición mientras se arrastra el handle (isResizing) para
    // que el ancho siga al puntero sin lag/rebote.
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
            <button
              type="button"
              onClick={handleStartNewChat}
              aria-label="Nuevo chat"
              title="Nuevo chat"
              className="rounded-md p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-secondary dark:text-muted-foreground"
            >
              <Plus size={18} weight="duotone" />
            </button>
          )}
          {!showSettings && !showHistory && (
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              aria-label="Ver chats guardados"
              title="Chats guardados"
              className="rounded-md p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-secondary dark:text-muted-foreground"
            >
              <ClockCounterClockwise size={18} weight="duotone" />
            </button>
          )}
          {!showSettings && !showHistory && (
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              aria-label="Ajustes del chat"
              className="rounded-md p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-secondary dark:text-muted-foreground"
            >
              <GearSix size={18} weight="duotone" />
            </button>
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

      {/* Body: mensajes, ajustes o historial de chats */}
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
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-2">
            <ChatTeardropText size={40} weight="duotone" className="text-blue-400 mb-3" />
            <p className="text-sm font-medium text-gray-700 dark:text-foreground mb-1">
              Pregúntale a tus reuniones
            </p>
            <p className="text-xs text-gray-500 dark:text-muted-foreground mb-4">
              Escribe una pregunta sobre el contenido de tus transcripciones.
            </p>
            <div className="space-y-1.5 w-full">
              {EXAMPLE_QUESTIONS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setInput(example)}
                  className="w-full text-left text-xs rounded-lg border border-gray-200 dark:border-border
                    bg-gray-50 dark:bg-secondary text-gray-600 dark:text-muted-foreground
                    px-3 py-2 hover:bg-gray-100 dark:hover:bg-secondary/70 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-secondary text-gray-900 dark:text-foreground'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  <span className="whitespace-pre-wrap">{message.content}</span>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-lg px-3 py-2 bg-gray-100 dark:bg-secondary flex items-center gap-1">
              <Loader2 size={14} className="animate-spin text-gray-500 dark:text-muted-foreground" />
              <span className="text-xs text-gray-500 dark:text-muted-foreground">Pensando…</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
      )}

      {/* Footer */}
      {!showSettings && !showHistory && (
      <div className="border-t border-gray-200 dark:border-border px-4 py-3 space-y-2.5">
        {/* Alcance */}
        <div className="flex items-center gap-2" role="group" aria-label="Alcance del chat">
          <button
            type="button"
            disabled={!hasCurrentContext}
            title={
              !hasCurrentContext
                ? 'Abre una reunión o inicia una grabación para usar este alcance'
                : undefined
            }
            aria-label="Alcance: esta reunión"
            onClick={() => setScope('current')}
            className={`text-xs rounded-full px-3 py-1 border transition-colors ${
              scope === 'current'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-transparent text-gray-600 dark:text-muted-foreground border-gray-200 dark:border-border'
            } ${!hasCurrentContext ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400'}`}
          >
            Esta reunión
          </button>
          <button
            type="button"
            aria-label="Alcance: todas las reuniones"
            onClick={() => setScope('all')}
            className={`text-xs rounded-full px-3 py-1 border transition-colors ${
              scope === 'all'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-transparent text-gray-600 dark:text-muted-foreground border-gray-200 dark:border-border hover:border-blue-400'
            }`}
          >
            Todas las reuniones
          </button>
        </div>

        {/* Motor activo (abre ajustes) */}
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          aria-label={`Motor activo: ${targetLabel}. Abrir ajustes del chat`}
          className="text-xs text-gray-500 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground hover:underline transition-colors"
        >
          Motor: {targetLabel}
        </button>

        {/* Input */}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Escribe tu pregunta…"
            aria-label="Mensaje para el chat"
            className="flex-1 resize-none rounded-lg border border-gray-200 dark:border-border
              bg-white dark:bg-background text-sm text-gray-900 dark:text-foreground
              px-3 py-2 min-h-[38px] max-h-[76px] focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!input.trim() || loading}
            aria-label="Enviar mensaje"
            className="shrink-0 rounded-lg p-2.5 bg-blue-600 text-white hover:bg-blue-700
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <PaperPlaneRight size={18} weight="duotone" />
          </button>
        </div>
      </div>
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
