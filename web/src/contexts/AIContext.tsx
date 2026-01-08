import { useState, useCallback, useMemo, type ReactNode } from 'react';
import { useFindMatch } from '@/hooks/useFindMatch';
import { AIContext, type AIContextValue } from './ai-context';
import type { ChatMessage, AIError } from '@/types/ai';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface AIProviderProps {
  children: ReactNode;
}

export function AIProvider({ children }: AIProviderProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { findMatch, isLoading, error } = useFindMatch();

  const openChat = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const clearConversation = useCallback(() => {
    setMessages([]);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmedContent = content.trim();
      if (!trimmedContent) return;

      // Add user message
      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: trimmedContent,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const response = await findMatch({ naturalLanguageQuery: trimmedContent });

        // Add AI response
        const aiMessage: ChatMessage = {
          id: generateId(),
          role: 'ai',
          content: response.explanation,
          matches: response.matches,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
      } catch (err) {
        // Add error message
        const errorMessage = err as AIError;
        const aiMessage: ChatMessage = {
          id: generateId(),
          role: 'ai',
          content: errorMessage.message,
          timestamp: new Date(),
          isError: true,
        };
        setMessages((prev) => [...prev, aiMessage]);
      }
    },
    [findMatch]
  );

  const value = useMemo<AIContextValue>(
    () => ({
      messages,
      isOpen,
      isLoading,
      error,
      openChat,
      closeChat,
      sendMessage,
      clearConversation,
    }),
    [messages, isOpen, isLoading, error, openChat, closeChat, sendMessage, clearConversation]
  );

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}
