import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AIBar } from '@/components/layout/AIBar'

describe('AIBar', () => {
  // Test 8.10: AI Bar placeholder renders at top with disabled mic icon
  it('renders AI Bar with placeholder text', () => {
    render(<AIBar />)

    expect(screen.getByText('Ask anything...')).toBeInTheDocument()
  })

  it('renders disabled mic icon', () => {
    render(<AIBar />)

    const micButton = screen.getByRole('button', { name: /voice input/i })
    expect(micButton).toBeInTheDocument()
    expect(micButton).toHaveClass('cursor-not-allowed')
  })

  it('renders disabled send button', () => {
    render(<AIBar />)

    const sendButton = screen.getByRole('button', { name: /send message/i })
    expect(sendButton).toBeDisabled()
    expect(sendButton).toHaveClass('cursor-not-allowed')
  })

  it('shows toast when clicking input', async () => {
    render(<AIBar />)

    const inputButton = screen.getByRole('button', { name: /ai assistant/i })
    fireEvent.click(inputButton)

    await waitFor(() => {
      expect(screen.getByText(/ai assistant coming in the next update/i)).toBeInTheDocument()
    })
  })

  it('shows toast when clicking mic button', async () => {
    render(<AIBar />)

    const micButton = screen.getByRole('button', { name: /voice input/i })
    fireEvent.click(micButton)

    await waitFor(() => {
      expect(screen.getByText(/voice input coming soon/i)).toBeInTheDocument()
    })
  })

  it('has fixed position at top', () => {
    render(<AIBar />)

    // Find the AI Bar container
    const aiBarContainer = screen.getByText('Ask anything...').closest('[class*="fixed"]')
    expect(aiBarContainer).toHaveClass('fixed', 'top-0')
  })

  it('renders bot icon', () => {
    render(<AIBar />)

    // Bot icon should be in the AI Bar (checking SVG presence)
    const botIconContainer = document.querySelector('[aria-hidden="true"]')
    expect(botIconContainer).toBeInTheDocument()
  })
})
