import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { VoiceInputButton } from '@/components/ai/VoiceInputButton';

describe('VoiceInputButton', () => {
  // Test 7.5: Mic button starts speech recognition on click
  it('calls onClick when clicked in idle state', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<VoiceInputButton state="idle" onClick={handleClick} />);

    const button = screen.getByRole('button', { name: /start voice input/i });
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  // Test 7.6: Listening state shows visual indication
  it('shows listening state with aria-pressed and ring', () => {
    render(<VoiceInputButton state="listening" onClick={vi.fn()} />);

    const button = screen.getByRole('button', { name: /stop listening/i });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveClass('animate-pulse');
    expect(button).toHaveAttribute('title', 'Listening...');
  });

  // Test 7.10: Clicking mic again stops listening
  it('calls onClick when clicked in listening state', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<VoiceInputButton state="listening" onClick={handleClick} />);

    const button = screen.getByRole('button', { name: /stop listening/i });
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  // Test 7.12: Error state displays error indication
  it('shows error state with mic-off icon', () => {
    render(<VoiceInputButton state="error" onClick={vi.fn()} />);

    const button = screen.getByRole('button', { name: /voice input error - tap to retry/i });
    expect(button).toHaveClass('text-destructive');
    expect(button).toHaveAttribute('title', 'Tap to retry');
  });

  // Test 7.13: "Try again" button restarts recognition
  it('calls onClick when clicked in error state (retry)', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<VoiceInputButton state="error" onClick={handleClick} />);

    const button = screen.getByRole('button', { name: /voice input error - tap to retry/i });
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  // Test 7.14: Unsupported browser shows disabled button with tooltip
  it('shows unsupported state as disabled with tooltip', () => {
    render(<VoiceInputButton state="unsupported" onClick={vi.fn()} />);

    const button = screen.getByRole('button', {
      name: /voice input not supported on this browser/i,
    });
    expect(button).toBeDisabled();
    expect(button).toHaveClass('opacity-50', 'cursor-not-allowed');
    expect(button).toHaveAttribute('title', 'Voice input not supported on this browser');
  });

  it('does not call onClick when disabled (unsupported)', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<VoiceInputButton state="unsupported" onClick={handleClick} />);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(handleClick).not.toHaveBeenCalled();
  });

  // Test 7.15: prefers-reduced-motion handled via Tailwind classes
  it('has motion-reduce class for reduced motion support', () => {
    render(<VoiceInputButton state="listening" onClick={vi.fn()} />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('motion-reduce:animate-none');
  });

  it('has minimum touch target size', () => {
    render(<VoiceInputButton state="idle" onClick={vi.fn()} />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('touch-target');
  });

  it('shows idle state with correct aria-label', () => {
    render(<VoiceInputButton state="idle" onClick={vi.fn()} />);

    const button = screen.getByRole('button', { name: /start voice input/i });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAttribute('title', 'Start voice input');
  });
});
