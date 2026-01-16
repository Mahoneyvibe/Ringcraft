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

// Mock useSpeechRecognition hook for voice input tests
const mockStartListening = vi.fn();
const mockStopListening = vi.fn();
const mockSpeechRecognition = {
  isListening: false,
  interimTranscript: '',
  error: null,
  isSupported: true,
  startListening: mockStartListening,
  stopListening: mockStopListening,
  clearError: vi.fn(),
};

vi.mock('@/hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: () => mockSpeechRecognition,
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
    // Reset mock state
    mockSpeechRecognition.isListening = false;
    mockSpeechRecognition.interimTranscript = '';
    mockSpeechRecognition.error = null;
    mockSpeechRecognition.isSupported = true;
  });

  // Test: AI Bar accepts text input
  it('accepts text input', async () => {
    const user = userEvent.setup();
    render(<AIBarWithProvider />);

    const input = screen.getByRole('textbox', { name: /ask ai assistant/i });
    expect(input).toBeInTheDocument();

    await user.type(input, 'Find a match for Jake');
    expect(input).toHaveValue('Find a match for Jake');
  });

  // Test 7.5: Mic button starts speech recognition on click
  it('renders voice input button in idle state', () => {
    render(<AIBarWithProvider />);

    const micButton = screen.getByRole('button', { name: /start voice input/i });
    expect(micButton).toBeInTheDocument();
    expect(micButton).not.toBeDisabled();
  });

  it('calls startListening when voice button clicked', async () => {
    const user = userEvent.setup();
    render(<AIBarWithProvider />);

    const micButton = screen.getByRole('button', { name: /start voice input/i });
    await user.click(micButton);

    expect(mockStartListening).toHaveBeenCalledTimes(1);
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

  // Test 7.14: Unsupported browser shows disabled button
  it('shows disabled voice button when speech not supported', () => {
    mockSpeechRecognition.isSupported = false;
    render(<AIBarWithProvider />);

    const micButton = screen.getByRole('button', {
      name: /voice input not supported on this browser/i,
    });
    expect(micButton).toBeDisabled();
  });

  // Test 7.17: Voice input works in AIBar
  it('shows listening placeholder when listening', () => {
    mockSpeechRecognition.isListening = true;
    render(<AIBarWithProvider />);

    const input = screen.getByRole('textbox', { name: /ask ai assistant/i });
    expect(input).toHaveAttribute('placeholder', 'Listening...');
  });
});
