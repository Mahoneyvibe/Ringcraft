import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { Mic, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export function ChatInput({
  onSubmit,
  isLoading,
  placeholder = 'Type a message...',
  autoFocus = false,
  className,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim() && !isLoading) {
      onSubmit(value.trim());
      setValue('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('flex items-center gap-2 p-3 bg-white border-t border-neutral-300', className)}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isLoading}
        className="flex-1 h-10 px-3 rounded-md bg-muted text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
        aria-label="Message input"
      />

      {/* Mic button (disabled) */}
      <button
        type="button"
        className="touch-target flex-shrink-0 p-2 rounded-md text-primary opacity-50 cursor-not-allowed"
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
        <Send className="h-5 w-5" aria-hidden="true" />
      </button>
    </form>
  );
}
