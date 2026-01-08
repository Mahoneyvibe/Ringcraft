import { useState, useCallback } from 'react';
import { FirebaseError } from 'firebase/app';
import { findMatchCallable } from '@/lib/functions';
import type { FindMatchRequest, FindMatchResponse, AIError, AIErrorCode } from '@/types/ai';

const REQUEST_TIMEOUT_MS = 15000;

const ERROR_MESSAGES: Record<AIErrorCode, string> = {
  unauthenticated: 'Please sign in to use AI matching.',
  'permission-denied': 'Join a club to use AI matching.',
  'invalid-argument': "I couldn't understand that. Try: 'Find a match for [boxer name]'",
  'not-found': "I couldn't find that boxer in your roster.",
  'resource-exhausted': 'Too many requests. Please wait a moment.',
  internal: 'Something went wrong. Please try again.',
  timeout: 'Request timed out. Please try again.',
  network: 'Unable to connect. Check your connection.',
};

function mapFirebaseErrorCode(code: string): AIErrorCode {
  const codeMap: Record<string, AIErrorCode> = {
    'functions/unauthenticated': 'unauthenticated',
    'functions/permission-denied': 'permission-denied',
    'functions/invalid-argument': 'invalid-argument',
    'functions/not-found': 'not-found',
    'functions/resource-exhausted': 'resource-exhausted',
    'functions/internal': 'internal',
  };
  return codeMap[code] || 'internal';
}

export interface UseFindMatchResult {
  findMatch: (request: FindMatchRequest) => Promise<FindMatchResponse>;
  isLoading: boolean;
  error: AIError | null;
  clearError: () => void;
}

export function useFindMatch(): UseFindMatchResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AIError | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const findMatch = useCallback(async (request: FindMatchRequest): Promise<FindMatchResponse> => {
    setIsLoading(true);
    setError(null);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('TIMEOUT'));
      }, REQUEST_TIMEOUT_MS);
    });

    try {
      const result = await Promise.race([
        findMatchCallable(request),
        timeoutPromise,
      ]);

      return result.data;
    } catch (err) {
      let aiError: AIError;

      if (err instanceof Error && err.message === 'TIMEOUT') {
        aiError = { code: 'timeout', message: ERROR_MESSAGES.timeout };
      } else if (err instanceof FirebaseError) {
        const code = mapFirebaseErrorCode(err.code);
        aiError = { code, message: ERROR_MESSAGES[code] };
      } else if (err instanceof TypeError && err.message.includes('fetch')) {
        aiError = { code: 'network', message: ERROR_MESSAGES.network };
      } else {
        aiError = { code: 'internal', message: ERROR_MESSAGES.internal };
      }

      setError(aiError);
      throw aiError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { findMatch, isLoading, error, clearError };
}
