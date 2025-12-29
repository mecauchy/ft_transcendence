import Login from './login.tsx'
import Home from './home.tsx'
import './styles/index.css'
import {AuthProvider, useAuth} from './contexts/AuthContext'
import {useTranslation} from 'react-i18next'

function AppContent() {
  const {user, isLoading, isAuthenticated, logout} = useAuth();
  const {t} = useTranslation();

  if (isLoading) {
    return <div className="loading">{t('common.loading')}</div>;
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
