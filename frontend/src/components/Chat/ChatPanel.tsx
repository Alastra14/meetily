"use client";

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatTeardropText, PaperPlaneRight, X } from '@phosphor-icons/react';
import { Loader2 } from 'lucide-react';
import { useMeetingChat } from '@/hooks/useMeetingChat';
import type { ChatTarget } from '@/hooks/useMeetingChat';

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
  } = useMeetingChat({ meetingId, liveTranscript });

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open, loading]);

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

  const headerTitle =
    scope === 'current' && meetingTitle ? meetingTitle : 'Chat con tus reuniones';

  return (
    <aside
      className={`fixed top-0 right-0 h-full w-[380px] max-w-[90vw] z-50 flex flex-col
        bg-white dark:bg-card border-l border-gray-200 dark:border-border shadow-2xl
        transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : 'translate-x-full'}`}
      role="dialog"
      aria-label="Chat con tus reuniones"
      aria-hidden={!open}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 dark:border-border">
        <div className="flex items-center gap-2 min-w-0">
          <ChatTeardropText size={22} weight="duotone" className="text-blue-600 shrink-0" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-foreground truncate">
            {headerTitle}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Cerrar chat"
          className="shrink-0 rounded-md p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-secondary dark:text-muted-foreground"
        >
          <X size={18} />
        </button>
      </div>

      {/* Body: mensajes */}
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

      {/* Footer */}
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

        {/* Motor */}
        <div className="flex items-center gap-2" role="group" aria-label="Motor de chat">
          <span className="text-xs text-gray-500 dark:text-muted-foreground">Motor:</span>
          {(
            [
              { value: 'local' as ChatTarget, label: 'Local' },
              { value: 'ternova' as ChatTarget, label: 'Servidor Ternova' },
            ]
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-label={`Usar motor ${option.label}`}
              onClick={() => setTarget(option.value)}
              className={`text-xs rounded-full px-3 py-1 border transition-colors ${
                target === option.value
                  ? 'bg-gray-900 text-white border-gray-900 dark:bg-primary dark:text-primary-foreground dark:border-primary'
                  : 'bg-white dark:bg-transparent text-gray-600 dark:text-muted-foreground border-gray-200 dark:border-border hover:border-gray-400'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

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
