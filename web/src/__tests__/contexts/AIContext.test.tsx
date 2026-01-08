import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIProvider } from '@/contexts/AIContext';
import { useAI } from '@/hooks/useAI';
import type { ReactNode } from 'react';

// Mock useFindMatch hook
const mockFindMatch = vi.fn();

vi.mock('@/hooks/useFindMatch', () => ({
  useFindMatch: () => ({
    findMatch: mockFindMatch,
    isLoading: false,
    error: null,
    clearError: vi.fn(),
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <AIProvider>{children}</AIProvider>;
}

describe('AIContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMatch.mockResolvedValue({
      success: true,
      matches: [],
      explanation: 'No matches found',
      parsedIntent: {},
    });
  });

  it('provides initial state', () => {
    const { result } = renderHook(() => useAI(), { wrapper });

    expect(result.current.messages).toEqual([]);
    expect(result.current.isOpen).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('opens and closes chat', () => {
    const { result } = renderHook(() => useAI(), { wrapper });

    act(() => {
      result.current.openChat();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.closeChat();
    });
    expect(result.current.isOpen).toBe(false);
  });

  // Test 7.10: Multi-turn conversation preserves message history
  it('preserves message history across multiple sends', async () => {
    const { result } = renderHook(() => useAI(), { wrapper });

    await act(async () => {
      await result.current.sendMessage('First query');
    });

    await act(async () => {
      await result.current.sendMessage('Second query');
    });

    expect(result.current.messages).toHaveLength(4); // 2 user + 2 AI messages
    expect(result.current.messages[0].content).toBe('First query');
    expect(result.current.messages[2].content).toBe('Second query');
  });

  it('adds user message immediately', async () => {
    const { result } = renderHook(() => useAI(), { wrapper });

    // Start sending but don't wait
    act(() => {
      result.current.sendMessage('Test query');
    });

    // User message should be added immediately
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[0].content).toBe('Test query');
  });

  it('adds AI response after findMatch resolves', async () => {
    mockFindMatch.mockResolvedValue({
      success: true,
      matches: [{ boxerId: 'b1', firstName: 'Test', lastName: 'Boxer' }],
      explanation: 'Found 1 match',
      parsedIntent: {},
    });

    const { result } = renderHook(() => useAI(), { wrapper });

    await act(async () => {
      await result.current.sendMessage('Find a match');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].role).toBe('ai');
    expect(result.current.messages[1].content).toBe('Found 1 match');
    expect(result.current.messages[1].matches).toHaveLength(1);
  });

  // Test 7.11: Error response displays error message in chat
  it('adds error message when findMatch fails', async () => {
    mockFindMatch.mockRejectedValue({
      code: 'internal',
      message: 'Something went wrong. Please try again.',
    });

    const { result } = renderHook(() => useAI(), { wrapper });

    await act(async () => {
      await result.current.sendMessage('Test query');
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].role).toBe('ai');
    expect(result.current.messages[1].isError).toBe(true);
    expect(result.current.messages[1].content).toBe('Something went wrong. Please try again.');
  });

  it('clears conversation', async () => {
    const { result } = renderHook(() => useAI(), { wrapper });

    await act(async () => {
      await result.current.sendMessage('Test');
    });

    expect(result.current.messages.length).toBeGreaterThan(0);

    act(() => {
      result.current.clearConversation();
    });

    expect(result.current.messages).toEqual([]);
  });

  it('ignores empty messages', async () => {
    const { result } = renderHook(() => useAI(), { wrapper });

    await act(async () => {
      await result.current.sendMessage('');
      await result.current.sendMessage('   ');
    });

    expect(result.current.messages).toEqual([]);
    expect(mockFindMatch).not.toHaveBeenCalled();
  });

  it('throws error when used outside provider', () => {
    expect(() => {
      renderHook(() => useAI());
    }).toThrow('useAI must be used within an AIProvider');
  });

  // Test 7.12: Empty results displays no-matches message
  it('displays explanation when no matches found', async () => {
    mockFindMatch.mockResolvedValue({
      success: true,
      matches: [],
      explanation: 'No matches found. Try adjusting weight range.',
      parsedIntent: {},
    });

    const { result } = renderHook(() => useAI(), { wrapper });

    await act(async () => {
      await result.current.sendMessage('Find a match');
    });

    expect(result.current.messages[1].content).toBe('No matches found. Try adjusting weight range.');
    expect(result.current.messages[1].matches).toEqual([]);
  });
});
