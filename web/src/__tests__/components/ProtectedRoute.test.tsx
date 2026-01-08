import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AuthProvider } from '@/contexts/AuthContext'

// Mock Firebase auth
const mockOnAuthStateChanged = vi.fn()

vi.mock('@/lib/firebase', () => ({
  auth: {
    onAuthStateChanged: (callback: (user: unknown) => void) => {
      mockOnAuthStateChanged(callback)
      return vi.fn()
    },
  },
}))

function renderWithRouter(
  _ui: React.ReactElement,
  { route = '/protected' } = {}
) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockOnAuthStateChanged.mockReset()
  })

  // Test 8.11: ProtectedRoute redirects unauthenticated users
  it('redirects unauthenticated users to login', () => {
    // Simulate no user
    mockOnAuthStateChanged.mockImplementation((callback) => {
      callback(null)
    })

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    )

    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  // Test 8.12: ProtectedRoute allows authenticated users
  it('allows authenticated users to view protected content', () => {
    // Simulate authenticated user
    mockOnAuthStateChanged.mockImplementation((callback) => {
      callback({ uid: 'test-user', email: 'test@example.com' })
    })

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
  })

  it('shows loading spinner while auth initializes', () => {
    // Simulate loading state (callback not called yet)
    mockOnAuthStateChanged.mockImplementation(() => {
      // Don't call the callback to simulate loading
    })

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    )

    // Check for loading spinner (there might be multiple, so use query)
    expect(screen.getAllByText('Loading...').length).toBeGreaterThan(0)
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})
