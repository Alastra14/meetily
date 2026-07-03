'use client';

import React, { useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChatPanel, ChatToggleButton } from './ChatPanel';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { useTranscripts } from '@/contexts/TranscriptContext';
import { useRecordingState } from '@/contexts/RecordingStateContext';

/**
 * Ternova Meet — dock global del chat con las reuniones.
 * Vive dentro del árbol de providers (layout) y resuelve el contexto activo:
 * - Grabación en vivo: usa el transcript que va llegando (TranscriptContext).
 * - Página de detalle: usa el meetingId de la URL (?id=...).
 * - Home sin grabación: alcance "todas las reuniones".
 */
export function ChatDock() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { currentMeeting, meetings } = useSidebar();
  const { transcripts } = useTranscripts();
  const { isRecording } = useRecordingState();

  // Reunión abierta en meeting-details (?id=...)
  const detailsMeetingId = pathname?.startsWith('/meeting-details')
    ? searchParams?.get('id')
    : null;

  const meetingId = detailsMeetingId
    ?? (currentMeeting && currentMeeting.id !== 'intro-call' ? currentMeeting.id : null);

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

  return (
    <>
      <ChatToggleButton onClick={() => setOpen(true)} visible={!open} />
      <ChatPanel
        open={open}
        onOpenChange={setOpen}
        meetingId={meetingId}
        meetingTitle={meetingTitle}
        liveTranscript={liveTranscript}
      />
    </>
  );
}

export default ChatDock;
