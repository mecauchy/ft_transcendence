import Login from './login.tsx'
import Home from './home.tsx'
import OAuthCallback from './OAuthCallback.tsx'
import './styles/index.css'
import {AuthProvider, useAuth} from './contexts/AuthContext'

function AppContent() {
  const {user, isLoading, isAuthenticated, logout} = useAuth();

  // Check if we're on the OAuth callback route
  if (window.location.pathname === '/auth/callback') {
    return <OAuthCallback />;
  }

  if (isLoading) {
    return <div className="loading">Chargement...</div>;
 }

  const handleLogout = async () => {
    await logout();
 };

  return (
    <>
      {!isAuthenticated ? (
        <Login onLogin={() => {/* auth context handles this */}} />
      ) : (
        <Home username={user?.username || ''} onLogout={handleLogout} />
      )}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App
