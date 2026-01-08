import { X, Download } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { cn } from '@/lib/utils';

interface InstallPromptProps {
  className?: string;
}

export function InstallPrompt({ className }: InstallPromptProps) {
  const { shouldShowPrompt, promptInstall, dismissPrompt } = usePWAInstall();

  if (!shouldShowPrompt) {
    return null;
  }

  const handleInstall = async () => {
    await promptInstall();
  };

  return (
    <div
      className={cn(
        'fixed bottom-20 left-4 right-4 z-50 flex items-center gap-3 rounded-lg bg-primary p-4 text-primary-foreground shadow-lg',
        'lg:bottom-4 lg:left-auto lg:right-4 lg:max-w-sm',
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <Download className="h-6 w-6 flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold">Install FirstBell</p>
        <p className="text-sm opacity-90">Add to your home screen for quick access</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleInstall}
          className="touch-target rounded-md bg-white px-3 py-1.5 text-sm font-medium text-primary hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary"
          aria-label="Install FirstBell app"
        >
          Install
        </button>
        <button
          onClick={dismissPrompt}
          className="touch-target rounded-md p-1.5 hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-white"
          aria-label="Dismiss install prompt"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
