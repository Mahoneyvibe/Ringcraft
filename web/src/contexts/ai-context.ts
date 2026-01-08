import { createContext } from 'react';
import type { ChatMessage, AIError } from '@/types/ai';

export interface AIContextValue {
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  error: AIError | null;
  openChat: () => void;
  closeChat: () => void;
  sendMessage: (content: string) => Promise<void>;
  clearConversation: () => void;
}

export const AIContext = createContext<AIContextValue | null>(null);
