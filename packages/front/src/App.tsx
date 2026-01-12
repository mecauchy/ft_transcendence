import {useState, useEffect, useRef} from 'react'
import Login from './login.tsx'
import Home from './home.tsx'
import OAuthCallback from './OAuthCallback.tsx'
import { PrivacyPolicy, TermsOfService } from './legal'
import './styles/index.css'
import {AuthProvider, useAuth} from './contexts/AuthContext'
import {useTranslation} from 'react-i18next'

function AppContent() {
  const {user, isLoading, isAuthenticated, logout} = useAuth();
  const {t} = useTranslation();
  const [legalPage, setLegalPage] = useState<string | null>(null);
  const [showOAuth2FA, setShowOAuth2FA] = useState(false);
  const wasAuthenticated = useRef(false);

  // Check for OAuth 2FA requirement on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const require2fa = params.get('require2fa');
    const pendingUserId = localStorage.getItem('pending2FAUserId');
    
    if (require2fa === 'true' && pendingUserId) {
      setShowOAuth2FA(true);
      // clean url without a reload
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Reset 2FA state only when user actually logs out (was authenticated, now isn't)
  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated) {
      setShowOAuth2FA(false);
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  // Check if we're on the OAuth callback route
  if (window.location.pathname === '/auth/callback') {
    return <OAuthCallback />;
  }

  if (isLoading) {
    return <div className="loading">{t('common.loading')}</div>;
 }

  const handleLogout = async () => {
    await logout();
 };

  const handleNavigateToLegal = (page: string) => {
    setLegalPage(page);
  };


  if (!isAuthenticated && legalPage) {
    return (
      <div className="min-h-screen bg-slate-900">
        <button 
          onClick={() => setLegalPage(null)}
          className="fixed top-4 left-4 z-50 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-md transition"
        >
          ← {t('common.back', 'Back')}
        </button>
        {legalPage === 'privacy' && <PrivacyPolicy />}
        {legalPage === 'terms' && <TermsOfService />}
      </div>
    );
  }

  return (
    <>
      {!isAuthenticated ? (
        <Login 
          onLogin={() => {/* auth context handles this */}} 
          onNavigateToLegal={handleNavigateToLegal}
          initialShow2FA={showOAuth2FA}
          onClose2FA={() => setShowOAuth2FA(false)}
        />
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
