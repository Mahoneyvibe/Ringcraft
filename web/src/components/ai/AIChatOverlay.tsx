import { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAI } from '@/hooks/useAI';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';

interface AIChatOverlayProps {
  className?: string;
}

export function AIChatOverlay({ className }: AIChatOverlayProps) {
  const { messages, isOpen, isLoading, closeChat, sendMessage } = useAI();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeChat();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeChat]);

  // Focus trap
  useEffect(() => {
    if (isOpen && overlayRef.current) {
      const focusableElements = overlayRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      const handleTab = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      };

      document.addEventListener('keydown', handleTab);
      firstElement?.focus();

      return () => document.removeEventListener('keydown', handleTab);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className={cn(
        'fixed inset-0 z-50 flex flex-col bg-white',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-200',
        className
      )}
      role="dialog"
      aria-modal="true"
      aria-label="AI Assistant"
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-4 h-14 border-b border-neutral-300 bg-white">
        <button
          onClick={closeChat}
          className="touch-target p-2 -ml-2 rounded-md hover:bg-muted"
          aria-label="Close chat"
          type="button"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-lg font-semibold">AI Assistant</h1>
      </header>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages.length === 0 && (
          <div className="text-center text-neutral-500 py-8">
            <p>Ask me anything about finding matches!</p>
            <p className="text-sm mt-1">
              Try: "Find a match for Jake, 72kg"
            </p>
          </div>
        )}

        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {isLoading && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSubmit={sendMessage}
        isLoading={isLoading}
        placeholder="Type a message..."
        autoFocus
      />
    </div>
  );
}
