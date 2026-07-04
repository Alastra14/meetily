'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChatPanel, ChatToggleButton } from './ChatPanel';
import { useChatUI } from '@/contexts/ChatUIContext';
import { useChatSession } from '@/contexts/ChatSessionProvider';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { useTranscripts } from '@/contexts/TranscriptContext';
import { useRecordingState } from '@/contexts/RecordingStateContext';

/**
 * Nova — dock global del chat con las reuniones.
 *
 * Vive dentro del árbol de providers (layout) y es el ÚNICO escritor del
 * contexto/alcance del chat: resuelve, según la ruta activa, qué reunión y qué
 * transcript en vivo alimentan la conversación GLOBAL (useChatSession) y los
 * inyecta con setChatContext. La conversación en sí nunca se reinicia aquí.
 *
 * - Grabación en vivo (Home): usa el transcript que va llegando (TranscriptContext).
 * - Página de detalle (/meeting-details?id=): usa el meetingId de la URL.
 * - /chats: pantalla completa (la página monta la conversación) → aquí no se
 *   renderiza el panel acoplado ni el botón flotante.
 * - Resto de vistas: sin contexto "current" → alcance "todas las reuniones".
 */
export function ChatDock() {
  const { chatOpen: open, setChatOpen: setOpen } = useChatUI();
  const { setChatContext } = useChatSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { currentMeeting, meetings } = useSidebar();
  const { transcripts } = useTranscripts();
  const { isRecording } = useRecordingState();

  const isChatsPage = pathname === '/chats';

  // El contexto de "llamada" se ata a la reunión ABIERTA en meeting-details
  // (?id=...), no al último currentMeeting del sidebar: así, al volver a Home
  // el alcance "esta llamada" deja de estar activo (no arrastra contexto viejo).
  const meetingId = pathname?.startsWith('/meeting-details')
    ? (searchParams?.get('id') ?? null)
    : null;

  const meetingTitle = useMemo(() => {
    if (!meetingId) return null;
    return meetings.find(m => m.id === meetingId)?.title
      ?? (currentMeeting?.id === meetingId ? currentMeeting.title : null);
  }, [meetingId, meetings, currentMeeting]);

  // Transcript en vivo (solo mientras se graba): "[hh:mm:ss] texto" por segmento.
  const liveTranscript = useMemo(() => {
    if (!isRecording || transcripts.length === 0) return null;
    return transcripts
      .map(t => `[${t.timestamp}] ${t.text}`)
      .join('\n');
  }, [isRecording, transcripts]);

  // En /chats el contexto lo controla la propia página (alcance 'all'); no
  // pisamos meetingId aquí para evitar peleas de estado.
  useEffect(() => {
    if (isChatsPage) return;
    setChatContext({
      currentMeetingId: meetingId,
      currentMeetingTitle: meetingTitle,
      currentLiveTranscript: liveTranscript,
    });
  }, [isChatsPage, meetingId, meetingTitle, liveTranscript, setChatContext]);

  // Al ENTRAR a una llamada nueva, acoplamos el chat a la derecha por defecto
  // (una sola vez por reunión). La conversación no se reinicia; solo se abre el
  // panel con el alcance ya puesto en 'current' por el provider.
  const autoOpenedMeetingRef = useRef<string | null>(null);
  useEffect(() => {
    if (isChatsPage) return;
    if (meetingId && autoOpenedMeetingRef.current !== meetingId) {
      autoOpenedMeetingRef.current = meetingId;
      setOpen(true);
    }
    if (!meetingId) {
      autoOpenedMeetingRef.current = null;
    }
  }, [isChatsPage, meetingId, setOpen]);

  // El panel acoplado y el botón flotante NO aparecen en /chats (pantalla
  // completa). En Home '/' el botón vive junto a los controles de grabación.
  if (isChatsPage) return null;

  const showFloatingButton = pathname !== '/';

  return (
    <>
      {showFloatingButton && (
        <ChatToggleButton onClick={() => setOpen(true)} visible={!open} />
      )}
      <ChatPanel open={open} onOpenChange={setOpen} />
    </>
  );
}

export default ChatDock;
