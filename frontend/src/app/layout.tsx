'use client'

import './globals.css'
import localFont from 'next/font/local'
import Sidebar from '@/components/Sidebar'
import { SidebarProvider } from '@/components/Sidebar/SidebarProvider'
import MainContent from '@/components/MainContent'
import AnalyticsProvider from '@/components/AnalyticsProvider'
import { Toaster, toast } from 'sonner'
import "sonner/dist/styles.css"
import { useState, useEffect, useCallback, Suspense } from 'react'
import { ChatDock } from '@/components/Chat/ChatDock'
import { ChatUIProvider } from '@/contexts/ChatUIContext'
import { applyThemeMode, getThemeMode, THEME_CHANGE_EVENT } from '@/lib/theme'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { TooltipProvider } from '@/components/ui/tooltip'
import { RecordingStateProvider } from '@/contexts/RecordingStateContext'
import { OllamaDownloadProvider } from '@/contexts/OllamaDownloadContext'
import { TranscriptProvider } from '@/contexts/TranscriptContext'
import { ConfigProvider, useConfig } from '@/contexts/ConfigContext'
import { OnboardingProvider } from '@/contexts/OnboardingContext'
import { OnboardingFlow } from '@/components/onboarding'
import { loadBetaFeatures } from '@/types/betaFeatures'
import { DownloadProgressToastProvider } from '@/components/shared/DownloadProgressToast'
import { UpdateCheckProvider } from '@/components/UpdateCheckProvider'
import { RecordingPostProcessingProvider } from '@/contexts/RecordingPostProcessingProvider'
import { ImportAudioDialog, ImportDropOverlay } from '@/components/ImportAudio'
import { ImportDialogProvider } from '@/contexts/ImportDialogContext'
import { isAudioExtension, getAudioFormatsDisplayList } from '@/constants/audioFormats'
import { WelcomeIntro } from '@/components/WelcomeIntro'


// Nova — tipografías de marca, cargadas en local para funcionar 100%
// offline (sin Google Fonts). Spec: Gosha Sans = títulos (display),
// Space Grotesk = subtítulos, Montserrat = cuerpo/UI.
const montserrat = localFont({
  src: [
    { path: '../../public/fonts/Montserrat-VariableFont_wght.ttf', weight: '100 900', style: 'normal' },
  ],
  variable: '--font-body',
  display: 'swap',
})

const spaceGrotesk = localFont({
  src: [
    { path: '../../public/fonts/SpaceGrotesk-VariableFont_wght.ttf', weight: '300 700', style: 'normal' },
  ],
  variable: '--font-subtitle',
  display: 'swap',
})

const goshaSans = localFont({
  src: [
    { path: '../../public/fonts/GoshaSansRegular.otf', weight: '400', style: 'normal' },
    { path: '../../public/fonts/GoshaSansBold.otf', weight: '700', style: 'normal' },
  ],
  variable: '--font-display',
  display: 'swap',
})

// Nova — aplica el tema elegido (claro/oscuro/sistema, ver lib/theme)
// togglendo la clase `dark` en <html>. Reacciona al cambio del sistema y al
// toggle de la UI (evento tn-theme-change).
function SystemThemeWatcher() {
  useEffect(() => {
    applyThemeMode(getThemeMode())
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystem = () => applyThemeMode(getThemeMode())
    const onManual = () => applyThemeMode(getThemeMode())
    mq.addEventListener('change', onSystem)
    window.addEventListener(THEME_CHANGE_EVENT, onManual)
    return () => {
      mq.removeEventListener('change', onSystem)
      window.removeEventListener(THEME_CHANGE_EVENT, onManual)
    }
  }, [])
  return null
}

// Module-level component — stable reference across RootLayout re-renders.
// Defined here (not inside RootLayout) so React never sees a new function type
// on re-render, which would cause unmount/remount and break initialization logic.
function ConditionalImportDialog({
  showImportDialog,
  handleImportDialogClose,
  importFilePath,
}: {
  showImportDialog: boolean;
  handleImportDialogClose: (open: boolean) => void;
  importFilePath: string | null;
}) {
  const { betaFeatures } = useConfig();

  // Only mount ImportAudioDialog (and its hooks/listeners) when feature is enabled
  if (!betaFeatures.importAndRetranscribe) {
    return null;
  }

  return (
    <ImportAudioDialog
      open={showImportDialog}
      onOpenChange={handleImportDialogClose}
      preselectedFile={importFilePath}
    />
  );
}

// export { metadata } from './metadata'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)

  // Import audio state
  const [showDropOverlay, setShowDropOverlay] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importFilePath, setImportFilePath] = useState<string | null>(null)

  useEffect(() => {
    // Check onboarding status first
    invoke<{ completed: boolean } | null>('get_onboarding_status')
      .then((status) => {
        const isComplete = status?.completed ?? false
        setOnboardingCompleted(isComplete)

        if (!isComplete) {
          console.log('[Layout] Onboarding not completed, showing onboarding flow')
          setShowOnboarding(true)
        } else {
          console.log('[Layout] Onboarding completed, showing main app')
        }
      })
      .catch((error) => {
        console.error('[Layout] Failed to check onboarding status:', error)
        // Default to showing onboarding if we can't check
        setShowOnboarding(true)
        setOnboardingCompleted(false)
      })
  }, [])

  // Disable context menu in production
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      const handleContextMenu = (e: MouseEvent) => e.preventDefault();
      document.addEventListener('contextmenu', handleContextMenu);
      return () => document.removeEventListener('contextmenu', handleContextMenu);
    }
  }, []);
  useEffect(() => {
    // Listen for tray recording toggle request
    const unlisten = listen('request-recording-toggle', () => {
      console.log('[Layout] Received request-recording-toggle from tray');

      if (showOnboarding) {
        toast.error("Please complete setup first", {
          description: "You need to finish onboarding before you can start recording."
        });
      } else {
        // If in main app, forward to useRecordingStart via window event
        console.log('[Layout] Forwarding to start-recording-from-sidebar');
        window.dispatchEvent(new CustomEvent('start-recording-from-sidebar'));
      }
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [showOnboarding]);

  // Handle file drop for audio import
  const handleFileDrop = useCallback((paths: string[]) => {
    // Check if beta features are enabled (read from localStorage directly since we're outside ConfigProvider)
    const betaFeatures = loadBetaFeatures();

    if (!betaFeatures.importAndRetranscribe) {
      toast.error('Beta feature disabled', {
        description: 'Enable "Import Audio & Retranscribe" in Settings > Beta to use this feature.'
      });
      return;
    }

    // Find the first audio file
    const audioFile = paths.find(p => {
      const ext = p.split('.').pop()?.toLowerCase();
      return !!ext && isAudioExtension(ext);
    });

    if (audioFile) {
      console.log('[Layout] Audio file dropped:', audioFile);
      setImportFilePath(audioFile);
      setShowImportDialog(true);
    } else if (paths.length > 0) {
      toast.error('Please drop an audio file', {
        description: `Supported formats: ${getAudioFormatsDisplayList()}`
      });
    }
  }, []);

  // Listen for drag-drop events
  useEffect(() => {
    if (showOnboarding) return; // Don't handle drops during onboarding

    const unlisteners: UnlistenFn[] = [];
    const cleanedUpRef = { current: false };

    const setupListeners = async () => {
      // Drag enter/over - show overlay only if beta feature is enabled
      const unlistenDragEnter = await listen('tauri://drag-enter', () => {
        if (loadBetaFeatures().importAndRetranscribe) {
          setShowDropOverlay(true);
        }
      });
      if (cleanedUpRef.current) {
        unlistenDragEnter();
        return;
      }
      unlisteners.push(unlistenDragEnter);

      // Drag leave - hide overlay
      const unlistenDragLeave = await listen('tauri://drag-leave', () => {
        setShowDropOverlay(false);
      });
      if (cleanedUpRef.current) {
        unlistenDragLeave();
        unlisteners.forEach(u => u());
        return;
      }
      unlisteners.push(unlistenDragLeave);

      // Drop - process files
      const unlistenDrop = await listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
        setShowDropOverlay(false);
        handleFileDrop(event.payload.paths);
      });
      if (cleanedUpRef.current) {
        unlistenDrop();
        unlisteners.forEach(u => u());
        return;
      }
      unlisteners.push(unlistenDrop);
    };

    setupListeners();

    return () => {
      cleanedUpRef.current = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [showOnboarding, handleFileDrop]);

  // Handle import dialog close
  const handleImportDialogClose = useCallback((open: boolean) => {
    setShowImportDialog(open);
    if (!open) {
      setImportFilePath(null);
    }
  }, []);

  // Handler for ImportDialogProvider - opens import dialog from any child component
  const handleOpenImportDialog = useCallback((filePath?: string | null) => {
    setImportFilePath(filePath ?? null);
    setShowImportDialog(true);
  }, []);

  const handleOnboardingComplete = () => {
    console.log('[Layout] Onboarding completed, reloading app')
    setShowOnboarding(false)
    setOnboardingCompleted(true)
    // Optionally reload the window to ensure all state is fresh
    window.location.reload()
  }

  // Nova — la intro de bienvenida (WelcomeIntro) llama a esto cuando el
  // usuario elige "Descargar modelos locales". Reutilizamos el mismo mecanismo
  // de onboarding que ya existe (setShowOnboarding), en vez de duplicar el flujo
  // de descarga: esto monta <OnboardingFlow> empezando en WelcomeStep (paso 1),
  // que avanza hasta DownloadProgressStep.
  const handleRequestLocalDownload = () => {
    console.log('[Layout] WelcomeIntro solicitó descarga de modelos locales, mostrando onboarding')
    setShowOnboarding(true)
  }

  // No-op intencional: al "Entrar a la app", WelcomeIntro simplemente se oculta
  // a sí mismo (su propio estado showIntro) y deja ver lo que showOnboarding ya
  // decida mostrar debajo (OnboardingFlow o la app principal).
  const handleEnterApp = () => {
    console.log('[Layout] Usuario entró a la app desde WelcomeIntro')
  }

  return (
    <html lang="en">
      <body className={`${montserrat.variable} ${spaceGrotesk.variable} ${goshaSans.variable} font-sans antialiased`}>
        <AnalyticsProvider>
          <RecordingStateProvider>
            <TranscriptProvider>
              <ConfigProvider>
                <OllamaDownloadProvider>
                  <OnboardingProvider>
                    <UpdateCheckProvider>
                      <SidebarProvider>
                        <TooltipProvider>
                          <RecordingPostProcessingProvider>
                            <ImportDialogProvider onOpen={handleOpenImportDialog}>
                              {/* Download progress toast provider - listens for background downloads */}
                              <DownloadProgressToastProvider />

                              <SystemThemeWatcher />
                              {/* Nova: pantalla de bienvenida en CADA arranque (no solo
                                  la primera vez). Se muestra encima de lo que sea que showOnboarding
                                  decida renderizar debajo (onboarding o app principal). */}
                              <WelcomeIntro
                                onRequestLocalDownload={handleRequestLocalDownload}
                                onEnterApp={handleEnterApp}
                              />
                              {/* Show onboarding or main app */}
                              {showOnboarding ? (
                                <OnboardingFlow onComplete={handleOnboardingComplete} />
                              ) : (
                                <ChatUIProvider>
                                  <div className="flex">
                                    <Sidebar />
                                    <MainContent>{children}</MainContent>
                                    {/* Nova: chat acoplado (ocupa espacio, no tapa) */}
                                    <Suspense fallback={null}>
                                      <ChatDock />
                                    </Suspense>
                                  </div>
                                </ChatUIProvider>
                              )}
                              {/* Import audio overlay and dialog */}
                              <ImportDropOverlay visible={showDropOverlay} />
                              <ConditionalImportDialog
                                showImportDialog={showImportDialog}
                                handleImportDialogClose={handleImportDialogClose}
                                importFilePath={importFilePath}
                              />
                            </ImportDialogProvider>
                          </RecordingPostProcessingProvider>
                        </TooltipProvider>
                      </SidebarProvider>
                    </UpdateCheckProvider>
                  </OnboardingProvider>

                </OllamaDownloadProvider>
              </ConfigProvider>
            </TranscriptProvider>
          </RecordingStateProvider>
        </AnalyticsProvider>

        <Toaster position="bottom-center" richColors closeButton />
      </body>
    </html>
  )
}
