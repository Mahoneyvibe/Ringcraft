import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LoginPage } from '@/pages/LoginPage'
import { AuthProvider } from '@/contexts/AuthContext'

// Mock Firebase auth
const mockOnAuthStateChanged = vi.fn()
const mockSignInWithEmailAndPassword = vi.fn()
const mockSignInWithPopup = vi.fn()

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    mockOnAuthStateChanged(callback)
    return vi.fn()
  },
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
  signInWithPopup: () => mockSignInWithPopup(),
  GoogleAuthProvider: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/lib/firebase', () => ({
  auth: {},
}))

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    mockOnAuthStateChanged.mockReset()
    mockSignInWithEmailAndPassword.mockReset()
    mockSignInWithPopup.mockReset()
    // Default: not authenticated
    mockOnAuthStateChanged.mockImplementation((callback) => {
      callback(null)
    })
  })

  it('renders login form with email and password fields', () => {
    renderLoginPage()

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders Google sign-in button', () => {
    renderLoginPage()

    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
  })

  it('renders FirstBell branding', () => {
    renderLoginPage()

    expect(screen.getByText('FirstBell')).toBeInTheDocument()
    expect(screen.getByText(/sign in to access your club/i)).toBeInTheDocument()
  })

  // Test 8.15: Login form displays error on invalid credentials
  it('displays error message on invalid credentials', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValueOnce({
      code: 'auth/invalid-credential',
      message: 'Invalid credentials',
    })

    renderLoginPage()

    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpassword')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument()
    })
  })

  // Test 8.16: Login form displays network error message
  it('displays network error message', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValueOnce({
      code: 'auth/network-request-failed',
      message: 'Network error',
    })

    renderLoginPage()

    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/unable to connect/i)).toBeInTheDocument()
    })
  })

  // Test 8.17: Error message clears when user types
  it('clears error message when user types', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValueOnce({
      code: 'auth/invalid-credential',
      message: 'Invalid credentials',
    })

    renderLoginPage()

    // Trigger error
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument()
    })

    // Type again to clear error
    await userEvent.type(screen.getByLabelText(/email/i), 'a')

    await waitFor(() => {
      expect(screen.queryByText(/invalid email or password/i)).not.toBeInTheDocument()
    })
  })

  it('shows loading state while authenticating', async () => {
    // Make sign in take some time
    mockSignInWithEmailAndPassword.mockImplementation(() => new Promise(() => {}))

    renderLoginPage()

    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'password123')

    // Get submit button before clicking
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    await userEvent.click(submitButton)

    // Button should be disabled while loading (but content might change)
    await waitFor(() => {
      expect(submitButton).toBeDisabled()
    })
  })

  it('disables submit button when fields are empty', () => {
    renderLoginPage()

    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled()
  })

  it('enables submit button when both fields have values', async () => {
    renderLoginPage()

    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'password123')

    expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled()
  })

  it('displays error for user not found', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValueOnce({
      code: 'auth/user-not-found',
      message: 'User not found',
    })

    renderLoginPage()

    await userEvent.type(screen.getByLabelText(/email/i), 'notfound@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/no account found with this email/i)).toBeInTheDocument()
    })
  })
})
