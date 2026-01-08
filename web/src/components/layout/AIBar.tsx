import { useState, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { Bot, Mic, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAI } from '@/hooks/useAI';

interface AIBarProps {
  className?: string;
}

export function AIBar({ className }: AIBarProps) {
  const [value, setValue] = useState('');
  const { isLoading, openChat, sendMessage } = useAI();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;

    openChat();
    setValue('');
    await sendMessage(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputFocus = () => {
    // Open chat when user focuses on input (for quick access)
    if (value.trim()) {
      openChat();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-neutral-300 px-4',
        'flex items-center gap-3',
        className
      )}
    >
      {/* Bot icon */}
      <div className="flex-shrink-0 text-primary">
        <Bot className="h-6 w-6" aria-hidden="true" />
      </div>

      {/* Input field */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={handleInputFocus}
        placeholder="Ask anything..."
        disabled={isLoading}
        className={cn(
          'flex-1 h-9 px-3 rounded-md bg-muted text-sm border-0',
          'focus:outline-none focus:ring-2 focus:ring-primary/20',
          'disabled:opacity-50'
        )}
        aria-label="Ask AI assistant"
      />

      {/* Mic button (disabled for Story 11.3) */}
      <button
        type="button"
        className="touch-target flex-shrink-0 p-2 rounded-md text-primary opacity-50 cursor-not-allowed hover:bg-muted"
        disabled
        title="Voice input coming soon"
        aria-label="Voice input - coming soon"
      >
        <Mic className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Send button */}
      <button
        type="submit"
        disabled={!value.trim() || isLoading}
        className={cn(
          'touch-target flex-shrink-0 p-2 rounded-md',
          value.trim() && !isLoading
            ? 'text-primary hover:bg-muted'
            : 'text-primary opacity-50 cursor-not-allowed'
        )}
        aria-label="Send message"
      >
        {isLoading ? (
          <span className="flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        ) : (
          <Send className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
    </form>
  );
}
