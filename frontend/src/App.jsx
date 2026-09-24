import { useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import DiagnosisForm from './pages/DiagnosisForm.jsx';
import Profile from './pages/Profile.jsx';

export default function App() {
  const { user } = useAuth();
  const [screen, setScreen] = useState(user ? 'dashboard' : 'login');
  const [authMode, setAuthMode] = useState('login');

  if (!user) {
    return authMode === 'login'
      ? <Login onSignup={() => setAuthMode('signup')} onSuccess={() => setScreen('dashboard')} />
      : <Signup onLogin={() => setAuthMode('login')} onSuccess={() => setScreen('dashboard')} />;
  }

  if (screen === 'diagnosis') return <DiagnosisForm onBack={() => setScreen('dashboard')} />;
  if (screen === 'profile') return <Profile onBack={() => setScreen('dashboard')} />;

  return <Dashboard
    onNewDiagnosis={() => setScreen('diagnosis')}
    onProfile={() => setScreen('profile')}
  />;
}
