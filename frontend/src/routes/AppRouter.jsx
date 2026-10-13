import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Login from '../pages/Login.jsx';
import Signup from '../pages/Signup.jsx';
import Dashboard from '../pages/Dashboard.jsx';
import DiagnosisForm from '../pages/DiagnosisForm.jsx';
import Profile from '../pages/Profile.jsx';
import Appointments from '../pages/Appointments.jsx';
import Chatbot from '../pages/Chatbot.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';

function RootRedirect() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
}

function AuthScreen({ mode = 'login' }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  if (mode === 'signup') {
    return (
      <Signup
        onLogin={() => navigate('/login')}
        onSuccess={() => navigate('/dashboard')}
      />
    );
  }

  return (
    <Login
      onSignup={() => navigate('/signup')}
      onSuccess={() => navigate('/dashboard')}
    />
  );
}

function ProtectedDashboard() {
  const navigate = useNavigate();

  return (
    <Dashboard
      onNewDiagnosis={() => navigate('/diagnosis')}
      onChatbot={() => navigate('/chatbot')}
      onProfile={() => navigate('/profile')}
      onAppointments={() => navigate('/appointments')}
    />
  );
}

function ProtectedDiagnosis() {
  const navigate = useNavigate();

  return (
    <DiagnosisForm
      onBack={() => navigate('/dashboard')}
      onBookAppointment={({ reason }) => {
        const appointmentReason = reason || 'Follow-up consultation';
        navigate('/appointments', { state: { reason: appointmentReason } });
      }}
    />
  );
}

function ProtectedProfile() {
  const navigate = useNavigate();

  return <Profile onBack={() => navigate('/dashboard')} />;
}

function ProtectedChatbot() {
  const navigate = useNavigate();

  return (
    <Chatbot
      onBack={() => navigate('/dashboard')}
      onBookAppointment={(result) => {
        const reason = `Follow-up for AI health triage: ${result.predictedDisease} (${result.confidence}% confidence)`;
        navigate('/appointments', { state: { reason } });
      }}
    />
  );
}

function ProtectedAppointments() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialReason = location.state?.reason || '';

  return (
    <Appointments
      onBack={() => navigate('/dashboard')}
      initialReason={initialReason}
    />
  );
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<AuthScreen mode="login" />} />
      <Route path="/signup" element={<AuthScreen mode="signup" />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <ProtectedDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/diagnosis"
        element={
          <ProtectedRoute>
            <ProtectedDiagnosis />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProtectedProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chatbot"
        element={
          <ProtectedRoute>
            <ProtectedChatbot />
          </ProtectedRoute>
        }
      />
      <Route
        path="/appointments"
        element={
          <ProtectedRoute>
            <ProtectedAppointments />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
