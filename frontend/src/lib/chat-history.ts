// Nova — persistencia local (localStorage) del historial de chats.
//
// Cada sesión de chat efímero (useMeetingChat) se guarda aquí para que el
// usuario pueda volver a verla desde el apartado "Chats" del panel lateral.
// No hay backend involucrado: todo vive en el navegador/WebView del cliente.

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type ChatScope = 'current' | 'all';
export type ChatTarget = 'local' | 'ternova';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Reunión asociada al momento de crear la sesión (null si era alcance "todas"). */
  meetingId?: string | null;
  scope: ChatScope;
  target: ChatTarget;
  messages: ChatMessage[];
}

const STORAGE_KEY = 'tn-chat-sessions';
const MAX_SESSIONS = 100;
const TITLE_WORD_COUNT = 6;
const DEFAULT_TITLE = 'Nuevo chat';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function readRaw(): ChatSession[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSession);
  } catch {
    return [];
  }
}

function isValidSession(value: unknown): value is ChatSession {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    typeof v.createdAt === 'number' &&
    typeof v.updatedAt === 'number' &&
    Array.isArray(v.messages)
  );
}

function writeRaw(sessions: ChatSession[]): void {
  if (!isBrowser()) return;
  try {
    // Poda: conserva las MAX_SESSIONS más recientes (por updatedAt).
    const pruned = [...sessions]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_SESSIONS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
  } catch {
    // localStorage puede fallar en contextos restringidos; no es crítico.
  }
}

function generateId(): string {
  try {
    if (isBrowser() && 'crypto' in window && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
  } catch {
    // sigue al fallback
  }
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Título = primeras ~6 palabras del primer mensaje del usuario. */
export function deriveTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((m) => m.role === 'user' && m.content.trim());
  if (!firstUserMessage) return DEFAULT_TITLE;

  const words = firstUserMessage.content.trim().split(/\s+/);
  const truncated = words.slice(0, TITLE_WORD_COUNT).join(' ');
  return words.length > TITLE_WORD_COUNT ? `${truncated}…` : truncated;
}

/** Lista todas las sesiones guardadas, más recientes primero. */
export function listSessions(): ChatSession[] {
  return readRaw().sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Obtiene una sesión por id, o null si no existe. */
export function getSession(id: string): ChatSession | null {
  return readRaw().find((s) => s.id === id) ?? null;
}

/** Crea (o actualiza, si ya existe el id) una sesión y la persiste. */
export function saveSession(session: ChatSession): ChatSession {
  const sessions = readRaw();
  const index = sessions.findIndex((s) => s.id === session.id);
  const next = { ...session, updatedAt: Date.now() };

  if (index >= 0) {
    sessions[index] = next;
  } else {
    sessions.push(next);
  }

  writeRaw(sessions);
  return next;
}

/** Elimina una sesión por id. */
export function deleteSession(id: string): void {
  const sessions = readRaw().filter((s) => s.id !== id);
  writeRaw(sessions);
}

/** Construye (sin persistir) una nueva sesión vacía lista para usarse. */
export function newSession(params: {
  meetingId?: string | null;
  scope: ChatScope;
  target: ChatTarget;
}): ChatSession {
  const now = Date.now();
  return {
    id: generateId(),
    title: DEFAULT_TITLE,
    createdAt: now,
    updatedAt: now,
    meetingId: params.meetingId ?? null,
    scope: params.scope,
    target: params.target,
    messages: [],
  };
}
