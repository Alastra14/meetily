'use client';

// Ternova Meet — conmutador de tema claro / oscuro / sistema.
// Cicla entre los tres modos; persiste en localStorage (lib/theme).

import React, { useEffect, useState } from 'react';
import { Sun, Moon, Desktop } from '@phosphor-icons/react';
import { getThemeMode, nextThemeMode, setThemeMode, ThemeMode } from '@/lib/theme';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const LABELS: Record<ThemeMode, string> = {
  light: 'Tema: claro',
  dark: 'Tema: oscuro',
  system: 'Tema: según el sistema',
};

export function ThemeToggle({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const [mode, setMode] = useState<ThemeMode>('system');

  useEffect(() => {
    setMode(getThemeMode());
  }, []);

  const cycle = () => {
    const next = nextThemeMode(mode);
    setMode(next);
    setThemeMode(next);
  };

  const icon =
    mode === 'light' ? (
      <Sun weight="duotone" className="w-4 h-4 text-gray-600" />
    ) : mode === 'dark' ? (
      <Moon weight="duotone" className="w-4 h-4 text-gray-600" />
    ) : (
      <Desktop weight="duotone" className="w-4 h-4 text-gray-600" />
    );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={cycle}
          aria-label={LABELS[mode]}
          className={`flex items-center justify-center cursor-pointer border-none transition-colors ${
            isCollapsed
              ? 'bg-transparent p-2 hover:bg-gray-100 rounded-lg'
              : 'w-full px-3 py-1.5 mt-1 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-200 rounded-lg shadow-sm'
          }`}
        >
          {icon}
          {!isCollapsed && (
            <span className="ml-2 text-sm text-gray-700">
              {mode === 'light' ? 'Claro' : mode === 'dark' ? 'Oscuro' : 'Sistema'}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>{LABELS[mode]} — clic para cambiar</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default ThemeToggle;
