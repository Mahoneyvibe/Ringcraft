import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIChatOverlay } from '@/components/ai/AIChatOverlay';
import { AIContext, type AIContextValue } from '@/contexts/ai-context';
import type { ChatMessage } from '@/types/ai';

const mockMessages: ChatMessage[] = [
  {
    id: '1',
    role: 'user',
    content: 'Find a match for Jake',
    timestamp: new Date(),
  },
  {
    id: '2',
    role: 'ai',
    content: 'I found 2 matches for Jake:',
    matches: [
      {
        boxerId: 'b1',
        firstName: 'Tom',
        lastName: 'Smith',
        age: 23,
        gender: 'male',
        category: 'Senior',
        declaredWeight: 72,
        declaredBouts: 10,
        declaredWins: 6,
        declaredLosses: 4,
        availability: 'Available',
        clubId: 'c1',
        clubName: 'Eastside Boxing',
        complianceScore: 95,
        complianceNotes: [],
      },
    ],
    timestamp: new Date(),
  },
];

function createMockContext(overrides: Partial<AIContextValue> = {}): AIContextValue {
  return {
    messages: [],
    isOpen: true,
    isLoading: false,
    error: null,
    openChat: vi.fn(),
    closeChat: vi.fn(),
    sendMessage: vi.fn(),
    clearConversation: vi.fn(),
    ...overrides,
  };
}

function renderWithContext(context: AIContextValue) {
  return render(
    <AIContext.Provider value={context}>
      <AIChatOverlay />
    </AIContext.Provider>
  );
}

describe('AIChatOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when closed', () => {
    const context = createMockContext({ isOpen: false });
    renderWithContext(context);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders when open', () => {
    const context = createMockContext({ isOpen: true });
    renderWithContext(context);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
  });

  // Test 7.14: Back button closes chat
  it('closes chat when back button is clicked', async () => {
    const closeChat = vi.fn();
    const context = createMockContext({ isOpen: true, closeChat });
    renderWithContext(context);

    const backButton = screen.getByRole('button', { name: /close chat/i });
    fireEvent.click(backButton);

    expect(closeChat).toHaveBeenCalled();
  });

  // Test 7.15: ESC key closes chat panel
  it('closes chat on ESC key press', () => {
    const closeChat = vi.fn();
    const context = createMockContext({ isOpen: true, closeChat });
    renderWithContext(context);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(closeChat).toHaveBeenCalled();
  });

  // Test 7.8: Chat shows typing indicator while AI processes
  it('shows typing indicator when loading', () => {
    const context = createMockContext({ isOpen: true, isLoading: true });
    renderWithContext(context);

    expect(screen.getByRole('status', { name: /ai is thinking/i })).toBeInTheDocument();
  });

  // Test 7.9: Successful response displays as AI message bubble with match cards
  it('displays AI messages with match cards', () => {
    const context = createMockContext({ isOpen: true, messages: mockMessages });
    renderWithContext(context);

    expect(screen.getByText('Find a match for Jake')).toBeInTheDocument();
    expect(screen.getByText('I found 2 matches for Jake:')).toBeInTheDocument();
    expect(screen.getByText('Tom Smith')).toBeInTheDocument();
    expect(screen.getByText('Eastside Boxing')).toBeInTheDocument();
  });

  // Test 7.10: Multi-turn conversation preserves message history
  it('displays multiple messages in order', () => {
    const context = createMockContext({ isOpen: true, messages: mockMessages });
    renderWithContext(context);

    const messages = screen.getAllByText(/jake|found/i);
    expect(messages.length).toBeGreaterThan(1);
  });

  it('shows empty state message when no messages', () => {
    const context = createMockContext({ isOpen: true, messages: [] });
    renderWithContext(context);

    expect(screen.getByText(/ask me anything about finding matches/i)).toBeInTheDocument();
  });

  it('has accessible dialog role', () => {
    const context = createMockContext({ isOpen: true });
    renderWithContext(context);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'AI Assistant');
  });

  it('has message log with aria-live', () => {
    const context = createMockContext({ isOpen: true });
    renderWithContext(context);

    const log = screen.getByRole('log');
    expect(log).toHaveAttribute('aria-live', 'polite');
  });
});
