import { Bot, Mic, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface AIBarProps {
  className?: string;
}

export function AIBar({ className }: AIBarProps) {
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleInputClick = () => {
    showToast('AI assistant coming in the next update');
  };

  const handleMicClick = () => {
    showToast('Voice input coming soon');
  };

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-neutral-300 px-4',
        'flex items-center gap-3',
        className
      )}
    >
      {/* Bot icon */}
      <div className="flex-shrink-0 text-primary opacity-60">
        <Bot className="h-6 w-6" aria-hidden="true" />
      </div>

      {/* Input field (placeholder, non-functional) */}
      <button
        onClick={handleInputClick}
        className="flex-1 h-9 px-3 rounded-md bg-muted text-left text-muted-foreground text-sm cursor-not-allowed opacity-60 border-0"
        aria-label="AI assistant - coming soon"
        type="button"
      >
        Ask anything...
      </button>

      {/* Mic button */}
      <button
        onClick={handleMicClick}
        className="touch-target flex-shrink-0 p-2 rounded-md text-primary opacity-60 cursor-not-allowed hover:bg-muted"
        aria-label="Voice input - coming soon"
        type="button"
      >
        <Mic className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Send button */}
      <button
        className="touch-target flex-shrink-0 p-2 rounded-md text-primary opacity-60 cursor-not-allowed hover:bg-muted"
        aria-label="Send message - coming soon"
        disabled
        type="button"
      >
        <Send className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Toast notification */}
      {toast && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-neutral-900 text-white text-sm rounded-md shadow-lg"
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
