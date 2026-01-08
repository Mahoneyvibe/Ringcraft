import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIChatPanel } from '@/components/ai/AIChatPanel';
import { AIContext, type AIContextValue } from '@/contexts/ai-context';

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
      <AIChatPanel />
    </AIContext.Provider>
  );
}

describe('AIChatPanel', () => {
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

  // Test 7.14: Close button closes chat (desktop)
  it('closes chat when close button is clicked', () => {
    const closeChat = vi.fn();
    const context = createMockContext({ isOpen: true, closeChat });
    renderWithContext(context);

    const closeButton = screen.getByRole('button', { name: /close chat/i });
    fireEvent.click(closeButton);

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

  it('closes when clicking backdrop', () => {
    const closeChat = vi.fn();
    const context = createMockContext({ isOpen: true, closeChat });
    renderWithContext(context);

    // Find backdrop (div with bg-black/20)
    const backdrop = document.querySelector('[aria-hidden="true"]');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(closeChat).toHaveBeenCalled();
    }
  });

  it('has accessible dialog role', () => {
    const context = createMockContext({ isOpen: true });
    renderWithContext(context);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'AI Assistant');
  });

  it('shows typing indicator when loading', () => {
    const context = createMockContext({ isOpen: true, isLoading: true });
    renderWithContext(context);

    expect(screen.getByRole('status', { name: /ai is thinking/i })).toBeInTheDocument();
  });

  it('has message log with aria-live', () => {
    const context = createMockContext({ isOpen: true });
    renderWithContext(context);

    const log = screen.getByRole('log');
    expect(log).toHaveAttribute('aria-live', 'polite');
  });

  it('renders with slide-out panel width', () => {
    const context = createMockContext({ isOpen: true });
    renderWithContext(context);

    const panel = screen.getByRole('dialog');
    expect(panel).toHaveClass('w-[400px]');
  });
});
