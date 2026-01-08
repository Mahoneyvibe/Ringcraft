import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { InboxPage } from '@/pages/InboxPage';
import { ClubPage } from '@/pages/ClubPage';
import { BrowsePage } from '@/pages/BrowsePage';
import { LoginPage } from '@/pages/LoginPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes with app shell */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell>
                  <InboxPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/club"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ClubPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/browse"
            element={
              <ProtectedRoute>
                <AppShell>
                  <BrowsePage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* Catch-all redirect to inbox */}
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <AppShell>
                  <InboxPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
