import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppShell } from '@/components/layout/AppShell'
import { AuthProvider } from '@/contexts/AuthContext'

// Mock Firebase auth
vi.mock('@/lib/firebase', () => ({
  auth: {
    onAuthStateChanged: vi.fn((callback) => {
      callback({ uid: 'test-user', email: 'test@example.com' })
      return vi.fn()
    }),
  },
}))

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        {ui}
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('AppShell', () => {
  beforeEach(() => {
    // Reset navigator.onLine
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
  })

  it('renders children content', () => {
    renderWithProviders(
      <AppShell>
        <div data-testid="child-content">Test Content</div>
      </AppShell>
    )

    expect(screen.getByTestId('child-content')).toBeInTheDocument()
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('renders AI Bar at top', () => {
    renderWithProviders(
      <AppShell>
        <div>Content</div>
      </AppShell>
    )

    // AI Bar should have the "Ask anything..." placeholder
    expect(screen.getByText('Ask anything...')).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    renderWithProviders(
      <AppShell>
        <div>Content</div>
      </AppShell>
    )

    // Should have navigation with Inbox, Club, Browse (might have duplicates for desktop/mobile)
    expect(screen.getAllByRole('link', { name: /inbox/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /club/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /browse/i }).length).toBeGreaterThan(0)
  })

  // Test 8.20: App shell displays offline banner when network unavailable
  it('shows offline banner when network is unavailable', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })

    renderWithProviders(
      <AppShell>
        <div>Content</div>
      </AppShell>
    )

    // Trigger offline event
    await act(async () => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(screen.getByText(/you're offline/i)).toBeInTheDocument()
  })

  it('hides offline banner when network is available', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })

    renderWithProviders(
      <AppShell>
        <div>Content</div>
      </AppShell>
    )

    // Should not show offline banner when online
    expect(screen.queryByText(/you're offline/i)).not.toBeInTheDocument()
  })

  // Test 8.14: Responsive layout switches at breakpoint
  it('has responsive classes for desktop sidebar', () => {
    renderWithProviders(
      <AppShell>
        <div>Content</div>
      </AppShell>
    )

    // There are two navigations - one for bottom, one for side
    const navigations = screen.getAllByRole('navigation', { name: /main navigation/i })
    const sideNavElement = navigations.find(nav => nav.classList.contains('lg:flex'))

    expect(sideNavElement).toHaveClass('hidden', 'lg:flex')
  })
})
