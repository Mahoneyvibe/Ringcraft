import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAI } from '@/hooks/useAI';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';

interface AIChatPanelProps {
  className?: string;
}

export function AIChatPanel({ className }: AIChatPanelProps) {
  const { messages, isOpen, isLoading, closeChat, sendMessage } = useAI();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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

  // Focus panel on open
  useEffect(() => {
    if (isOpen && panelRef.current) {
      const firstFocusable = panelRef.current.querySelector<HTMLElement>(
        'button, input'
      );
      firstFocusable?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={closeChat}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'fixed top-0 right-0 bottom-0 z-50 w-[400px] max-w-full flex flex-col bg-white shadow-xl',
          'motion-safe:animate-in motion-safe:slide-in-from-right motion-safe:duration-250',
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-label="AI Assistant"
      >
        {/* Header */}
        <header className="flex items-center justify-between px-4 h-14 border-b border-neutral-300 bg-white">
          <h1 className="text-lg font-semibold">AI Assistant</h1>
          <button
            onClick={closeChat}
            className="touch-target p-2 -mr-2 rounded-md hover:bg-muted"
            aria-label="Close chat"
            type="button"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
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
    </>
  );
}
