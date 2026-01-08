import { cn } from '@/lib/utils';
import { MatchCard } from './MatchCard';
import type { ChatMessage as ChatMessageType } from '@/types/ai';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const hasMatches = message.matches && message.matches.length > 0;
  const hasMultipleMatches = message.matches && message.matches.length > 1;

  return (
    <div
      className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}
      aria-label={isUser ? 'You said' : 'AI assistant said'}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-4 py-3',
          isUser
            ? 'bg-primary text-white rounded-br-sm'
            : message.isError
              ? 'bg-error/10 text-error rounded-bl-sm'
              : 'bg-muted text-neutral-900 rounded-bl-sm'
        )}
      >
        {/* Message content */}
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>

        {/* Match cards (AI messages only) */}
        {hasMatches && (
          <div className="mt-3 space-y-2">
            {message.matches!.map((match) => (
              <MatchCard key={match.boxerId} match={match} />
            ))}

            {/* Compare button for multiple matches */}
            {hasMultipleMatches && (
              <button
                className="w-full px-3 py-2 text-sm font-medium rounded-md border border-primary/30 text-primary opacity-50 cursor-not-allowed"
                disabled
                title="Coming in a future update"
                type="button"
              >
                Compare all {message.matches!.length}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
