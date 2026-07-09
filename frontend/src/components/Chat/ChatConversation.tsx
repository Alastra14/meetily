"use client";

// Nova — render compartido de la conversación de chat (mensajes + footer con
// alcance + input). Lo consume tanto el panel acoplado (ChatPanel) como la
// vista a pantalla completa (/chats). Lee SIEMPRE el estado global
// (useChatSession): no crea instancias nuevas de conversación.

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatTeardropText, PaperPlaneRight } from '@phosphor-icons/react';
import { Loader2 } from 'lucide-react';
import { useChatSession } from '@/contexts/ChatSessionProvider';

const EXAMPLE_QUESTIONS = [
  '¿Cuáles fueron los acuerdos principales?',
  '¿Qué tareas quedaron pendientes y para quién?',
  'Resume esta reunión en 3 puntos.',
];

export interface ChatConversationProps {
  /** Abre los ajustes del chat (el host decide cómo mostrarlos). */
  onOpenSettings?: () => void;
  /** Tamaño del render. 'full' usa una columna centrada más ancha (vista /chats). */
  size?: 'panel' | 'full';
}

/**
 * Cuerpo + footer de la conversación. El encabezado (título, botones de
 * nuevo/historial/ajustes/cerrar) lo pone cada host, porque difiere entre el
 * panel acoplado y la pantalla completa.
 */
export function ChatConversation({ onOpenSettings, size = 'panel' }: ChatConversationProps) {
  const {
    messages,
    loading,
    scope,
    setScope,
    target,
    sendMessage,
    hasCurrentContext,
  } = useChatSession();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const targetLabel = target === 'ternova' ? 'Servidor Ternova' : 'Local';
  const isFull = size === 'full';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

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

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div className={isFull ? 'mx-auto w-full max-w-3xl space-y-3' : 'space-y-3'}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-2 py-10">
              <ChatTeardropText size={40} weight="duotone" className="text-blue-400 mb-3" />
              <p className="text-sm font-medium text-gray-700 dark:text-foreground mb-1">
                Pregúntale a tus reuniones
              </p>
              <p className="text-xs text-gray-500 dark:text-muted-foreground mb-4">
                Escribe una pregunta sobre el contenido de tus transcripciones.
              </p>
              <div className="space-y-1.5 w-full max-w-md">
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
                  className={`${isFull ? 'max-w-[80%]' : 'max-w-[85%]'} rounded-lg px-3 py-2 text-sm leading-relaxed ${
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
      </div>

      {/* Footer: alcance + motor + input */}
      <div className="border-t border-gray-200 dark:border-border px-4 py-3">
        <div className={isFull ? 'mx-auto w-full max-w-3xl space-y-2.5' : 'space-y-2.5'}>
          {/* Alcance */}
          <div className="flex items-center gap-2" role="group" aria-label="Alcance del chat">
            <button
              type="button"
              disabled={!hasCurrentContext}
              title={
                !hasCurrentContext
                  ? 'Abre una llamada o inicia una grabación para usar este alcance'
                  : undefined
              }
              aria-label="Alcance: esta llamada"
              onClick={() => setScope('current')}
              className={`text-xs rounded-full px-3 py-1 border transition-colors ${
                scope === 'current'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-transparent text-gray-600 dark:text-muted-foreground border-gray-200 dark:border-border'
              } ${!hasCurrentContext ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400'}`}
            >
              Esta llamada
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

          {/* Motor activo (abre ajustes si el host lo permite) */}
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label={`Motor activo: ${targetLabel}. Abrir ajustes del chat`}
              className="text-xs text-gray-500 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground hover:underline transition-colors"
            >
              Motor: {targetLabel}
            </button>
          )}

          {/* Input */}
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Escribe tu pregunta…"
              aria-label="Mensaje para el chat"
              className="flex-1 resize-none rounded-lg border border-gray-200 dark:border-border
                bg-white dark:bg-background text-sm text-gray-900 dark:text-foreground
                px-3 py-2 min-h-[38px] max-h-[120px] focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      </div>
    </div>
  );
}

export default ChatConversation;
