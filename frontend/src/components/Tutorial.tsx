'use client';

import React from 'react';
import {
  Microphone,
  VideoCamera,
  ChatCircleDots,
  Cloud,
  ClockCounterClockwise,
  X,
  type Icon,
} from '@phosphor-icons/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';

export interface TutorialProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TutorialStep {
  icon: Icon;
  title: string;
  description: string;
}

const STEPS: TutorialStep[] = [
  {
    icon: Microphone,
    title: 'Grabar una reunión',
    description:
      'Elige tu micrófono y el audio del sistema, ponle nombre a la reunión y pulsa Grabar. Nova transcribe en vivo mientras hablas.',
  },
  {
    icon: VideoCamera,
    title: 'Importar de Teams o una URL',
    description:
      'Ya tienes la grabación en Teams o SharePoint? Impórtala como archivo de audio/video (o pega el enlace) y Nova la transcribe y la agrega a tu lista de reuniones.',
  },
  {
    icon: ChatCircleDots,
    title: 'Chatear con tus reuniones',
    description:
      'Abre el panel de chat (a la derecha) para hacer preguntas sobre una reunión puntual o sobre todo tu historial: acuerdos, pendientes, quién dijo qué.',
  },
  {
    icon: Cloud,
    title: 'Elegir Local vs Servidor Ternova',
    description:
      'Puedes transcribir y resumir 100% en tu equipo (privado, sin red) o conectarte al Servidor Ternova para más velocidad. Cambia esto cuando quieras desde Ajustes o la pantalla de bienvenida.',
  },
  {
    icon: ClockCounterClockwise,
    title: 'Ver tus chats',
    description:
      'Todas tus conversaciones con el asistente quedan guardadas. Vuelve a ellas desde el panel de chat para retomar el contexto de una reunión anterior.',
  },
];

export function Tutorial({ open, onOpenChange }: TutorialProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[85vh] overflow-y-auto bg-white dark:bg-card dark:border-border"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-foreground">
            Cómo usar Nova
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-border bg-gray-50 dark:bg-muted/30 p-3"
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white dark:bg-card border border-gray-200 dark:border-border flex items-center justify-center">
                  <Icon size={18} weight="duotone" className="text-gray-700 dark:text-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-foreground">
                    <span className="text-gray-400 dark:text-muted-foreground mr-1">{index + 1}.</span>
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-muted-foreground mt-1 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <DialogClose asChild>
          <button
            type="button"
            className="mt-2 w-full h-10 rounded-md bg-gray-900 hover:bg-gray-800 dark:bg-primary dark:hover:bg-primary/90 text-white dark:text-primary-foreground text-sm font-medium transition-colors inline-flex items-center justify-center gap-2"
          >
            <X size={16} weight="duotone" />
            Entendido, cerrar
          </button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

export default Tutorial;
