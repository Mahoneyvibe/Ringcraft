import { useContext } from 'react';
import { AIContext, type AIContextValue } from '@/contexts/ai-context';

export function useAI(): AIContextValue {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
}
