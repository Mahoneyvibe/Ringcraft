import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  className?: string;
}

export function TypingIndicator({ className }: TypingIndicatorProps) {
  return (
    <div
      className={cn('flex justify-start', className)}
      role="status"
      aria-label="AI is thinking"
    >
      <div className="bg-muted rounded-lg rounded-bl-sm px-4 py-3">
        <div className="flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  );
}
