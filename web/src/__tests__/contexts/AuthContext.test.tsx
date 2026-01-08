import { render, screen, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'

// Mock Firebase auth
const mockOnAuthStateChanged = vi.fn()
const mockSignInWithEmailAndPassword = vi.fn()
const mockSignOut = vi.fn()
const mockSignInWithPopup = vi.fn()

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    mockOnAuthStateChanged(callback)
    return vi.fn()
  },
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
  signOut: () => mockSignOut(),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: () => mockSignInWithPopup(),
}))

vi.mock('@/lib/firebase', () => ({
  auth: {},
}))

// Test component that uses the auth context
function TestComponent() {
  const { user, loading, error, clearError } = useAuth()

  return (
    <div>
      {loading && <span>Loading...</span>}
      {user && <span>User: {user.email}</span>}
      {error && <span>Error: {error}</span>}
      <button onClick={clearError}>Clear Error</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    mockOnAuthStateChanged.mockReset()
    mockSignInWithEmailAndPassword.mockReset()
    mockSignOut.mockReset()
    mockSignInWithPopup.mockReset()
  })

  // Test 8.13: Auth context provides user state
  it('provides user state when authenticated', async () => {
    mockOnAuthStateChanged.mockImplementation((callback) => {
      callback({ uid: 'test-uid', email: 'test@example.com' })
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('User: test@example.com')).toBeInTheDocument()
    })
  })

  it('provides null user state when not authenticated', async () => {
    mockOnAuthStateChanged.mockImplementation((callback) => {
      callback(null)
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.queryByText(/User:/)).not.toBeInTheDocument()
    })
  })

  it('shows loading state initially', () => {
    // Don't call the callback to simulate loading
    mockOnAuthStateChanged.mockImplementation(() => {})

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('throws error when useAuth is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<TestComponent />)
    }).toThrow('useAuth must be used within an AuthProvider')

    consoleSpy.mockRestore()
  })

  it('clears error when clearError is called', async () => {
    mockOnAuthStateChanged.mockImplementation((callback) => {
      callback(null)
    })

    mockSignInWithEmailAndPassword.mockRejectedValueOnce({
      code: 'auth/invalid-credential',
      message: 'Invalid credentials',
    })

    function TestComponentWithSignIn() {
      const { error, signIn, clearError } = useAuth()

      const handleSignIn = async () => {
        try {
          await signIn('test@example.com', 'wrong')
        } catch {
          // Error is expected and handled by context
        }
      }

      return (
        <div>
          {error && <span>Error: {error}</span>}
          <button onClick={handleSignIn}>Sign In</button>
          <button onClick={clearError}>Clear Error</button>
        </div>
      )
    }

    render(
      <AuthProvider>
        <TestComponentWithSignIn />
      </AuthProvider>
    )

    // Click sign in to trigger error
    await act(async () => {
      screen.getByText('Sign In').click()
    })

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument()
    })

    // Clear the error
    await act(async () => {
      screen.getByText('Clear Error').click()
    })

    expect(screen.queryByText(/Error:/)).not.toBeInTheDocument()
  })
})
