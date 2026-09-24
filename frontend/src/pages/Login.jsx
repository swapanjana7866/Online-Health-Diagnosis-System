import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { authService } from '../services/api.js';

export default function Login({ onSignup, onSuccess }) {
  const { signIn } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.email || !form.password) {
      setError('Please provide both email and password');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authService.login(form);
      signIn(response);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Could not log in. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="A calmer way to understand your health."
      subtitle="Private guidance for the moments when you need a little more clarity."
    >
      <h1>Welcome back</h1>
      <p className="muted">Sign in to continue your health check-ins.</p>

      <form onSubmit={handleSubmit} className="form-stack">
        <label>
          Email address
          <input
            type="email"
            required
            autoComplete="email"
            value={form.email}
            disabled={isSubmitting}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={form.password}
            disabled={isSubmitting}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Your password"
          />
        </label>

        {error && (
          <div className="error-banner" role="alert" style={{
            padding: '10px 14px',
            backgroundColor: '#fee2e2',
            border: '1px solid #f87171',
            borderRadius: '6px',
            color: '#b91c1c',
            fontSize: '0.9rem',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        <button className="primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : (
            <>
              Sign in <span>-&gt;</span>
            </>
          )}
        </button>
      </form>

      <p className="switch">
        New to Carepath?{' '}
        <button type="button" onClick={onSignup} disabled={isSubmitting}>
          Create an account
        </button>
      </p>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }) {
  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-mark">+</span> carepath
        </div>
        <div className="story-copy">
          <p className="eyebrow">YOUR HEALTH, IN FOCUS</p>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="story-footer">
          Built around your wellbeing <span>2026</span>
        </div>
      </section>
      <section className="auth-panel">
        <div className="form-card">{children}</div>
      </section>
    </main>
  );
}
