import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIBar } from '@/components/layout/AIBar';
import { AIProvider } from '@/contexts/AIContext';

// Mock useFindMatch hook
vi.mock('@/hooks/useFindMatch', () => ({
  useFindMatch: () => ({
    findMatch: vi.fn().mockResolvedValue({
      success: true,
      matches: [],
      explanation: 'No matches found',
      parsedIntent: {},
    }),
    isLoading: false,
    error: null,
    clearError: vi.fn(),
  }),
}));

// Wrapper component for AIBar with context
function AIBarWithProvider() {
  return (
    <AIProvider>
      <AIBar />
    </AIProvider>
  );
}

describe('AIBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 7.6: AI Bar accepts text input and shows mic icon (disabled)
  it('accepts text input', async () => {
    const user = userEvent.setup();
    render(<AIBarWithProvider />);

    const input = screen.getByRole('textbox', { name: /ask ai assistant/i });
    expect(input).toBeInTheDocument();

    await user.type(input, 'Find a match for Jake');
    expect(input).toHaveValue('Find a match for Jake');
  });

  it('renders disabled mic icon with tooltip', () => {
    render(<AIBarWithProvider />);

    const micButton = screen.getByRole('button', { name: /voice input - coming soon/i });
    expect(micButton).toBeInTheDocument();
    expect(micButton).toBeDisabled();
    expect(micButton).toHaveAttribute('title', 'Voice input coming soon');
  });

  it('enables send button when input has text', async () => {
    const user = userEvent.setup();
    render(<AIBarWithProvider />);

    const input = screen.getByRole('textbox', { name: /ask ai assistant/i });
    const sendButton = screen.getByRole('button', { name: /send message/i });

    // Initially disabled
    expect(sendButton).toHaveClass('cursor-not-allowed');

    // Type something
    await user.type(input, 'test');
    expect(sendButton).not.toHaveClass('cursor-not-allowed');
  });

  it('submits on Enter key press', async () => {
    const user = userEvent.setup();
    render(<AIBarWithProvider />);

    const input = screen.getByRole('textbox', { name: /ask ai assistant/i });
    await user.type(input, 'Find a match{enter}');

    // Input should be cleared after submission
    expect(input).toHaveValue('');
  });

  it('submits on send button click', async () => {
    const user = userEvent.setup();
    render(<AIBarWithProvider />);

    const input = screen.getByRole('textbox', { name: /ask ai assistant/i });
    const sendButton = screen.getByRole('button', { name: /send message/i });

    await user.type(input, 'Find a match');
    await user.click(sendButton);

    // Input should be cleared after submission
    expect(input).toHaveValue('');
  });

  it('has fixed position at top', () => {
    render(<AIBarWithProvider />);

    const form = screen.getByRole('textbox', { name: /ask ai assistant/i }).closest('form');
    expect(form).toHaveClass('fixed', 'top-0');
  });

  it('renders bot icon', () => {
    render(<AIBarWithProvider />);

    // Bot icon should be in the AI Bar
    const icons = document.querySelectorAll('[aria-hidden="true"]');
    expect(icons.length).toBeGreaterThan(0);
  });
});
