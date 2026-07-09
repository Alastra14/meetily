'use client';

// Nova — estado de apertura del panel de chat, compartido entre el
// panel acoplado (ChatDock, en el layout) y los botones que lo abren
// (RecordingControls en Home, header de meeting-details, etc.).

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ChatUIContextType {
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  toggleChat: () => void;
}

const ChatUIContext = createContext<ChatUIContextType | null>(null);

export function ChatUIProvider({ children }: { children: ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false);
  return (
    <ChatUIContext.Provider
      value={{ chatOpen, setChatOpen, toggleChat: () => setChatOpen(o => !o) }}
    >
      {children}
    </ChatUIContext.Provider>
  );
}

export function useChatUI(): ChatUIContextType {
  const ctx = useContext(ChatUIContext);
  if (!ctx) throw new Error('useChatUI must be used within ChatUIProvider');
  return ctx;
}
