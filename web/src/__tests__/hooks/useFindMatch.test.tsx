import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useFindMatch } from '@/hooks/useFindMatch';
import { FirebaseError } from 'firebase/app';

// Mock Firebase Functions
const mockFindMatchCallable = vi.fn();

vi.mock('@/lib/functions', () => ({
  findMatchCallable: (request: unknown) => mockFindMatchCallable(request),
}));

describe('useFindMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useFindMatch());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.findMatch).toBe('function');
  });

  it('sets loading state while fetching', async () => {
    mockFindMatchCallable.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useFindMatch());

    act(() => {
      result.current.findMatch({ naturalLanguageQuery: 'test' });
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('returns successful response', async () => {
    const mockResponse = {
      data: {
        success: true,
        matches: [],
        explanation: 'No matches found',
        parsedIntent: {},
      },
    };
    mockFindMatchCallable.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useFindMatch());

    let response;
    await act(async () => {
      response = await result.current.findMatch({ naturalLanguageQuery: 'Find a match' });
    });

    expect(response).toEqual(mockResponse.data);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  // Test 7.17: Rate limit error shows appropriate message
  it('handles rate limit error', async () => {
    const firebaseError = new FirebaseError('functions/resource-exhausted', 'Rate limited');
    mockFindMatchCallable.mockRejectedValue(firebaseError);

    const { result } = renderHook(() => useFindMatch());

    await act(async () => {
      try {
        await result.current.findMatch({ naturalLanguageQuery: 'test' });
      } catch {
        // Expected to throw
      }
    });

    expect(result.current.error).toEqual({
      code: 'resource-exhausted',
      message: 'Too many requests. Please wait a moment.',
    });
  });

  // Test 7.18: Network error shows connection message
  it('handles network error', async () => {
    const networkError = new TypeError('Failed to fetch');
    mockFindMatchCallable.mockRejectedValue(networkError);

    const { result } = renderHook(() => useFindMatch());

    await act(async () => {
      try {
        await result.current.findMatch({ naturalLanguageQuery: 'test' });
      } catch {
        // Expected to throw
      }
    });

    expect(result.current.error).toEqual({
      code: 'network',
      message: 'Unable to connect. Check your connection.',
    });
  });

  // Test 7.19: Request timeout after 15s displays timeout message
  it('handles timeout after 15s', async () => {
    mockFindMatchCallable.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useFindMatch());

    // Start the request
    let rejected = false;
    act(() => {
      result.current.findMatch({ naturalLanguageQuery: 'test' }).catch(() => {
        rejected = true;
      });
    });

    // Advance timers by 15 seconds to trigger timeout
    await act(async () => {
      vi.advanceTimersByTime(15000);
      // Allow microtasks to process
      await Promise.resolve();
    });

    expect(rejected).toBe(true);
    expect(result.current.error).toEqual({
      code: 'timeout',
      message: 'Request timed out. Please try again.',
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('handles unauthenticated error', async () => {
    const firebaseError = new FirebaseError('functions/unauthenticated', 'Not authenticated');
    mockFindMatchCallable.mockRejectedValue(firebaseError);

    const { result } = renderHook(() => useFindMatch());

    await act(async () => {
      try {
        await result.current.findMatch({ naturalLanguageQuery: 'test' });
      } catch {
        // Expected to throw
      }
    });

    expect(result.current.error).toEqual({
      code: 'unauthenticated',
      message: 'Please sign in to use AI matching.',
    });
  });

  it('handles permission denied error', async () => {
    const firebaseError = new FirebaseError('functions/permission-denied', 'No club');
    mockFindMatchCallable.mockRejectedValue(firebaseError);

    const { result } = renderHook(() => useFindMatch());

    await act(async () => {
      try {
        await result.current.findMatch({ naturalLanguageQuery: 'test' });
      } catch {
        // Expected to throw
      }
    });

    expect(result.current.error).toEqual({
      code: 'permission-denied',
      message: 'Join a club to use AI matching.',
    });
  });

  it('handles invalid argument error', async () => {
    const firebaseError = new FirebaseError('functions/invalid-argument', 'Bad query');
    mockFindMatchCallable.mockRejectedValue(firebaseError);

    const { result } = renderHook(() => useFindMatch());

    await act(async () => {
      try {
        await result.current.findMatch({ naturalLanguageQuery: 'test' });
      } catch {
        // Expected to throw
      }
    });

    expect(result.current.error).toEqual({
      code: 'invalid-argument',
      message: "I couldn't understand that. Try: 'Find a match for [boxer name]'",
    });
  });

  it('handles not found error', async () => {
    const firebaseError = new FirebaseError('functions/not-found', 'Boxer not found');
    mockFindMatchCallable.mockRejectedValue(firebaseError);

    const { result } = renderHook(() => useFindMatch());

    await act(async () => {
      try {
        await result.current.findMatch({ naturalLanguageQuery: 'test' });
      } catch {
        // Expected to throw
      }
    });

    expect(result.current.error).toEqual({
      code: 'not-found',
      message: "I couldn't find that boxer in your roster.",
    });
  });

  it('clears error', async () => {
    const firebaseError = new FirebaseError('functions/internal', 'Server error');
    mockFindMatchCallable.mockRejectedValue(firebaseError);

    const { result } = renderHook(() => useFindMatch());

    await act(async () => {
      try {
        await result.current.findMatch({ naturalLanguageQuery: 'test' });
      } catch {
        // Expected to throw
      }
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});
