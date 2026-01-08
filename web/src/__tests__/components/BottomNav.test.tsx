import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { BottomNav } from '@/components/layout/BottomNav'

// Helper to render with router
function renderWithRouter(ui: React.ReactElement, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {ui}
    </MemoryRouter>
  )
}

describe('BottomNav', () => {
  // Test 8.8: Bottom nav renders 3 tabs (Inbox, Club, Browse)
  it('renders three navigation tabs', () => {
    renderWithRouter(<BottomNav />)

    expect(screen.getByRole('link', { name: /inbox/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /club/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /browse/i })).toBeInTheDocument()
  })

  it('renders correct labels for each tab', () => {
    renderWithRouter(<BottomNav />)

    expect(screen.getByText('Inbox')).toBeInTheDocument()
    expect(screen.getByText('Club')).toBeInTheDocument()
    expect(screen.getByText('Browse')).toBeInTheDocument()
  })

  // Test 8.9: Navigation highlights active tab
  it('highlights Inbox tab when on root route', () => {
    renderWithRouter(<BottomNav />, { route: '/' })

    const inboxLink = screen.getByRole('link', { name: /inbox/i })
    expect(inboxLink).toHaveClass('text-primary')
  })

  it('highlights Club tab when on /club route', () => {
    renderWithRouter(<BottomNav />, { route: '/club' })

    const clubLink = screen.getByRole('link', { name: /club/i })
    expect(clubLink).toHaveClass('text-primary')
  })

  it('highlights Browse tab when on /browse route', () => {
    renderWithRouter(<BottomNav />, { route: '/browse' })

    const browseLink = screen.getByRole('link', { name: /browse/i })
    expect(browseLink).toHaveClass('text-primary')
  })

  it('has correct link destinations', () => {
    renderWithRouter(<BottomNav />)

    expect(screen.getByRole('link', { name: /inbox/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /club/i })).toHaveAttribute('href', '/club')
    expect(screen.getByRole('link', { name: /browse/i })).toHaveAttribute('href', '/browse')
  })

  it('has aria-label for main navigation', () => {
    renderWithRouter(<BottomNav />)

    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
  })

  it('is hidden on large screens via CSS class', () => {
    renderWithRouter(<BottomNav />)

    const nav = screen.getByRole('navigation')
    expect(nav).toHaveClass('lg:hidden')
  })
})
