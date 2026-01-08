import { type ReactNode, useState, useEffect } from 'react';
import { AIBar } from './AIBar';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';
import { InstallPrompt } from '@/components/ui/InstallPrompt';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: ReactNode;
  className?: string;
}

export function AppShell({ children, className }: AppShellProps) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* AI Bar - always at top */}
      <AIBar />

      {/* Offline banner */}
      {isOffline && (
        <div
          className="fixed top-14 left-0 right-0 z-30 bg-warning text-white text-center py-2 text-sm font-medium"
          role="alert"
          aria-live="polite"
        >
          You're offline. Some features may be unavailable.
        </div>
      )}

      {/* Main layout */}
      <div className="flex pt-14">
        {/* Side nav - desktop only */}
        <SideNav />

        {/* Main content area */}
        <main
          className={cn(
            'flex-1 min-h-[calc(100vh-3.5rem)]',
            'pb-16 lg:pb-0', // Bottom padding for mobile nav
            isOffline && 'pt-10', // Extra padding when offline banner is shown
            className
          )}
        >
          {children}
        </main>
      </div>

      {/* Bottom nav - mobile only */}
      <BottomNav />

      {/* PWA install prompt */}
      <InstallPrompt />
    </div>
  );
}
