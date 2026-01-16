import { Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export type VoiceButtonState = 'idle' | 'listening' | 'error' | 'unsupported';

interface VoiceInputButtonProps {
  state: VoiceButtonState;
  onClick: () => void;
  className?: string;
}

/**
 * Voice input button with visual states for speech recognition
 *
 * States:
 * - idle: Mic icon, ready to start listening
 * - listening: Pulsing mic with accent color glow
 * - error: Mic-off icon, click to retry
 * - unsupported: Disabled mic with tooltip
 */
export function VoiceInputButton({ state, onClick, className }: VoiceInputButtonProps) {
  const isDisabled = state === 'unsupported';
  const isListening = state === 'listening';
  const isError = state === 'error';

  const getAriaLabel = () => {
    switch (state) {
      case 'listening':
        return 'Stop listening';
      case 'error':
        return 'Voice input error - tap to retry';
      case 'unsupported':
        return 'Voice input not supported on this browser';
      default:
        return 'Start voice input';
    }
  };

  const getTitle = () => {
    switch (state) {
      case 'listening':
        return 'Listening...';
      case 'error':
        return 'Tap to retry';
      case 'unsupported':
        return 'Voice input not supported on this browser';
      default:
        return 'Start voice input';
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        'touch-target flex-shrink-0 p-2 rounded-md transition-all',
        // Base states
        isDisabled && 'text-muted-foreground opacity-50 cursor-not-allowed',
        !isDisabled && !isListening && !isError && 'text-accent hover:bg-muted',
        // Listening state - pulsing animation with accent ring
        isListening && [
          'text-accent bg-accent/10',
          'animate-pulse',
          'ring-2 ring-accent/50',
          'motion-reduce:animate-none motion-reduce:ring-4 motion-reduce:ring-accent/30',
        ],
        // Error state
        isError && 'text-destructive hover:bg-destructive/10',
        className
      )}
      aria-label={getAriaLabel()}
      aria-pressed={isListening}
      title={getTitle()}
    >
      {isError ? (
        <MicOff className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Mic className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}
