import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';

export type ResizableSide = 'left' | 'right';

export interface UseResizableOptions {
  /**
   * Borde del panel donde vive el handle de arrastre.
   * - 'left': el panel está anclado a la derecha de la ventana (p.ej. ChatPanel).
   *   El handle está en su borde izquierdo; arrastrar hacia la izquierda agranda.
   * - 'right': el panel está anclado a la izquierda de la ventana (p.ej. Sidebar).
   *   El handle está en su borde derecho; arrastrar hacia la derecha agranda.
   */
  side: ResizableSide;
  /** Ancho mínimo permitido, en px. */
  min: number;
  /** Ancho máximo permitido, en px. */
  max: number;
  /** Ancho inicial (antes de leer localStorage), en px. */
  defaultWidth: number;
  /** Clave de localStorage donde persistir el ancho elegido por el usuario. */
  storageKey: string;
  /** Paso (px) al redimensionar con las flechas del teclado sobre el handle. Default: 16. */
  keyboardStep?: number;
}

export interface ResizableHandleProps {
  role: 'separator';
  'aria-orientation': 'vertical';
  'aria-valuemin': number;
  'aria-valuemax': number;
  'aria-valuenow': number;
  tabIndex: number;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

export interface UseResizableResult {
  /** Ancho actual, en px (ya clamped a [min, max]). */
  width: number;
  /** true mientras el usuario arrastra el handle. Útil para desactivar transiciones CSS. */
  isResizing: boolean;
  /** Props para spread directo sobre el elemento que actúa de handle (div/button). */
  handleProps: ResizableHandleProps;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readStoredWidth(storageKey: string, min: number, max: number, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return clamp(parsed, min, max);
  } catch {
    return fallback;
  }
}

function writeStoredWidth(storageKey: string, value: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, String(Math.round(value)));
  } catch {
    // Cuota excedida / contexto restringido: preferencia cosmética, no crítica.
  }
}

/**
 * Hook reutilizable para paneles laterales redimensionables por arrastre (pointer events).
 *
 * - Arrastre: pointerdown en el handle devuelto en `handleProps` → escucha pointermove/pointerup
 *   en `window` mientras dura el arrastre (así el cursor puede salir del handle sin perder el drag).
 * - Clamp: el ancho siempre queda en [min, max].
 * - Persistencia: el ancho final se guarda en `localStorage[storageKey]`; al montar, se lee ese
 *   valor (si existe y es válido) en lugar de `defaultWidth`.
 * - Teclado: con foco en el handle, flechas izquierda/derecha ajustan el ancho en `keyboardStep`px
 *   (la dirección efectiva depende de `side`, igual que el arrastre).
 */
export function useResizable({
  side,
  min,
  max,
  defaultWidth,
  storageKey,
  keyboardStep = 16,
}: UseResizableOptions): UseResizableResult {
  const [width, setWidth] = useState<number>(() =>
    readStoredWidth(storageKey, min, max, clamp(defaultWidth, min, max))
  );
  const [isResizing, setIsResizing] = useState(false);

  // Refs para el cálculo del drag en curso (evitan closures obsoletas en los
  // listeners de window, que se registran una sola vez por gesto).
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);
  const widthRef = useRef(width);
  widthRef.current = width;

  // Si min/max cambian en caliente, re-clamp el ancho actual.
  useEffect(() => {
    setWidth((prev) => clamp(prev, min, max));
  }, [min, max]);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const deltaX = event.clientX - startXRef.current;
      // side==='left': el handle está a la izquierda del panel, así que mover el
      // mouse a la izquierda (deltaX negativo) debe agrandar → se invierte el signo.
      // side==='right': el handle está a la derecha del panel, mover a la derecha
      // (deltaX positivo) agranda → signo tal cual.
      const signedDelta = side === 'left' ? -deltaX : deltaX;
      const next = clamp(startWidthRef.current + signedDelta, min, max);
      setWidth(next);
    },
    [side, min, max]
  );

  // Referencias estables (identidad fija a lo largo de todo el ciclo de vida
  // del hook, vía useRef) para poder añadir/quitar exactamente el mismo
  // listener de window sin depender de que las closures memoizadas
  // mantengan su identidad durante todo el gesto de arrastre (p.ej. si
  // side/min/max cambiaran a mitad de un drag).
  const handlePointerMoveRef = useRef(handlePointerMove);
  handlePointerMoveRef.current = handlePointerMove;
  const stablePointerMove = useRef((event: PointerEvent) => handlePointerMoveRef.current(event)).current;

  const stopResizingImplRef = useRef<() => void>(() => {});
  const stableStopResizing = useRef(() => stopResizingImplRef.current()).current;

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    writeStoredWidth(storageKey, widthRef.current);
    window.removeEventListener('pointermove', stablePointerMove);
    window.removeEventListener('pointerup', stableStopResizing);
    window.removeEventListener('pointercancel', stableStopResizing);
  }, [stablePointerMove, stableStopResizing, storageKey]);
  stopResizingImplRef.current = stopResizing;

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      // Solo el botón principal (o touch/pen sin botones) inicia el arrastre.
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      startXRef.current = event.clientX;
      startWidthRef.current = widthRef.current;
      setIsResizing(true);
      window.addEventListener('pointermove', stablePointerMove);
      window.addEventListener('pointerup', stableStopResizing);
      window.addEventListener('pointercancel', stableStopResizing);
    },
    [stablePointerMove, stableStopResizing]
  );

  // Limpieza si el componente se desmonta a mitad de un arrastre.
  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', stablePointerMove);
      window.removeEventListener('pointerup', stableStopResizing);
      window.removeEventListener('pointercancel', stableStopResizing);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      const isGrow = side === 'left' ? event.key === 'ArrowLeft' : event.key === 'ArrowRight';
      const isShrink = side === 'left' ? event.key === 'ArrowRight' : event.key === 'ArrowLeft';
      if (!isGrow && !isShrink) return;
      event.preventDefault();
      setWidth((prev) => {
        const next = clamp(prev + (isGrow ? keyboardStep : -keyboardStep), min, max);
        writeStoredWidth(storageKey, next);
        return next;
      });
    },
    [side, min, max, keyboardStep, storageKey]
  );

  const handleProps: ResizableHandleProps = {
    role: 'separator',
    'aria-orientation': 'vertical',
    'aria-valuemin': min,
    'aria-valuemax': max,
    'aria-valuenow': Math.round(width),
    tabIndex: 0,
    onPointerDown: handlePointerDown,
    onKeyDown: handleKeyDown,
  };

  return { width, isResizing, handleProps };
}
