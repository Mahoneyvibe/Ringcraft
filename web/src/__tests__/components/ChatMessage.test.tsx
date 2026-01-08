import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ChatMessage } from '@/components/ai/ChatMessage';
import type { ChatMessage as ChatMessageType, MatchCandidate } from '@/types/ai';

const mockMatch: MatchCandidate = {
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
};

const mockMatchWithWarnings: MatchCandidate = {
  ...mockMatch,
  boxerId: 'b2',
  complianceScore: 70,
  complianceNotes: ['Weight difference exceeds 3kg'],
};

describe('ChatMessage', () => {
  it('renders user message right-aligned', () => {
    const message: ChatMessageType = {
      id: '1',
      role: 'user',
      content: 'Find a match for Jake',
      timestamp: new Date(),
    };

    render(<ChatMessage message={message} />);

    const container = screen.getByText('Find a match for Jake').closest('div[class*="justify"]');
    expect(container).toHaveClass('justify-end');
  });

  it('renders AI message left-aligned', () => {
    const message: ChatMessageType = {
      id: '1',
      role: 'ai',
      content: 'I found a match',
      timestamp: new Date(),
    };

    render(<ChatMessage message={message} />);

    const container = screen.getByText('I found a match').closest('div[class*="justify"]');
    expect(container).toHaveClass('justify-start');
  });

  // Test 7.11: Error response displays error message in chat
  it('renders error message with error styling', () => {
    const message: ChatMessageType = {
      id: '1',
      role: 'ai',
      content: 'Something went wrong. Please try again.',
      timestamp: new Date(),
      isError: true,
    };

    render(<ChatMessage message={message} />);

    const bubble = screen.getByText('Something went wrong. Please try again.').closest('div[class*="rounded-lg"]');
    expect(bubble).toHaveClass('bg-error/10', 'text-error');
  });

  // Test 7.9: Successful response displays as AI message bubble with match cards
  it('renders AI message with match cards', () => {
    const message: ChatMessageType = {
      id: '1',
      role: 'ai',
      content: 'I found 1 match:',
      matches: [mockMatch],
      timestamp: new Date(),
    };

    render(<ChatMessage message={message} />);

    expect(screen.getByText('Tom Smith')).toBeInTheDocument();
    expect(screen.getByText('Eastside Boxing')).toBeInTheDocument();
    expect(screen.getByText('72kg')).toBeInTheDocument();
    expect(screen.getByText('6W-4L')).toBeInTheDocument();
    expect(screen.getByText('Age 23')).toBeInTheDocument();
  });

  // Test 7.13: Action buttons are disabled with tooltips
  it('renders disabled Send Proposal button with tooltip', () => {
    const message: ChatMessageType = {
      id: '1',
      role: 'ai',
      content: 'I found a match:',
      matches: [mockMatch],
      timestamp: new Date(),
    };

    render(<ChatMessage message={message} />);

    const button = screen.getByRole('button', { name: /send proposal/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Coming in a future update');
  });

  it('renders Compare button for multiple matches', () => {
    const message: ChatMessageType = {
      id: '1',
      role: 'ai',
      content: 'I found 2 matches:',
      matches: [mockMatch, mockMatchWithWarnings],
      timestamp: new Date(),
    };

    render(<ChatMessage message={message} />);

    const compareButton = screen.getByRole('button', { name: /compare all 2/i });
    expect(compareButton).toBeDisabled();
    expect(compareButton).toHaveAttribute('title', 'Coming in a future update');
  });

  it('shows compliance warning indicators', () => {
    const message: ChatMessageType = {
      id: '1',
      role: 'ai',
      content: 'Match found with warnings:',
      matches: [mockMatchWithWarnings],
      timestamp: new Date(),
    };

    render(<ChatMessage message={message} />);

    expect(screen.getByText(/weight difference exceeds 3kg/i)).toBeInTheDocument();
  });

  it('does not show Compare button for single match', () => {
    const message: ChatMessageType = {
      id: '1',
      role: 'ai',
      content: 'I found 1 match:',
      matches: [mockMatch],
      timestamp: new Date(),
    };

    render(<ChatMessage message={message} />);

    expect(screen.queryByRole('button', { name: /compare/i })).not.toBeInTheDocument();
  });

  it('has accessible aria-label', () => {
    const userMessage: ChatMessageType = {
      id: '1',
      role: 'user',
      content: 'Test',
      timestamp: new Date(),
    };

    const aiMessage: ChatMessageType = {
      id: '2',
      role: 'ai',
      content: 'Response',
      timestamp: new Date(),
    };

    const { rerender } = render(<ChatMessage message={userMessage} />);
    expect(screen.getByLabelText(/you said/i)).toBeInTheDocument();

    rerender(<ChatMessage message={aiMessage} />);
    expect(screen.getByLabelText(/ai assistant said/i)).toBeInTheDocument();
  });
});
