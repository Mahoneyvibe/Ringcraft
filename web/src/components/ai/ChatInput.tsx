import { useState, useRef, useEffect, useCallback, type FormEvent, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { VoiceInputButton, type VoiceButtonState } from '@/components/ai/VoiceInputButton';

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

  // Handle final transcript from speech recognition
  const handleFinalTranscript = useCallback((transcript: string) => {
    setValue(transcript);
    // Focus input after transcript is received
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const {
    isListening,
    interimTranscript,
    error: speechError,
    isSupported: isSpeechSupported,
    startListening,
    stopListening,
  } = useSpeechRecognition({ onFinalTranscript: handleFinalTranscript });

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Determine voice button state
  const getVoiceButtonState = (): VoiceButtonState => {
    if (!isSpeechSupported) return 'unsupported';
    if (speechError) return 'error';
    if (isListening) return 'listening';
    return 'idle';
  };

  const handleVoiceClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

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
    // ESC cancels voice input
    if (e.key === 'Escape' && isListening) {
      stopListening();
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
        value={isListening && interimTranscript ? interimTranscript : value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isListening ? 'Listening...' : placeholder}
        disabled={isLoading || isListening}
        className={cn(
          'flex-1 h-10 px-3 rounded-md bg-muted text-sm border-0 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50',
          // Interim transcript styling - lighter opacity
          isListening && interimTranscript && 'text-muted-foreground'
        )}
        aria-label="Message input"
      />

      {/* Voice input button */}
      <VoiceInputButton
        state={getVoiceButtonState()}
        onClick={handleVoiceClick}
      />

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
