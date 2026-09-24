import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { authService } from '../services/api.js';
import { AuthShell } from './Login.jsx';

export default function Signup({ onLogin, onSuccess }) {
  const { signIn } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    age: '',
    gender: 'prefer_not_to_say'
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPasswordValid = form.password.length >= 8 && /\d/.test(form.password);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError('Please fill out all required fields');
      return;
    }

    if (!isPasswordValid) {
      setError('Password must be at least 8 characters long and contain at least one number');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        age: form.age ? Number(form.age) : undefined,
        gender: form.gender
      };

      const response = await authService.register(payload);
      signIn(response);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Could not create your account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Make space for better health habits."
      subtitle="A simple, private place to check in with yourself and find your next step."
    >
      <h1>Create your account</h1>
      <p className="muted">It takes less than a minute.</p>

      <form onSubmit={handleSubmit} className="form-stack">
        <label>
          Full name *
          <input
            required
            autoComplete="name"
            value={form.name}
            disabled={isSubmitting}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Jordan Lee"
          />
        </label>

        <label>
          Email address *
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <label>
            Age (optional)
            <input
              type="number"
              min="0"
              max="120"
              value={form.age}
              disabled={isSubmitting}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
              placeholder="e.g. 28"
            />
          </label>

          <label>
            Gender (optional)
            <select
              value={form.gender}
              disabled={isSubmitting}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                backgroundColor: '#fff',
                fontSize: '0.95rem'
              }}
            >
              <option value="prefer_not_to_say">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>

        <label>
          Password *
          <input
            type="password"
            required
            autoComplete="new-password"
            value={form.password}
            disabled={isSubmitting}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Min 8 chars, at least 1 number"
          />
        </label>

        {form.password && !isPasswordValid && (
          <p style={{ fontSize: '0.8rem', color: '#e11d48', marginTop: '-0.25rem' }}>
            Requires at least 8 characters and 1 number.
          </p>
        )}

        {error && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              backgroundColor: '#fee2e2',
              border: '1px solid #f87171',
              borderRadius: '6px',
              color: '#b91c1c',
              fontSize: '0.9rem',
              marginBottom: '1rem'
            }}
          >
            {error}
          </div>
        )}

        <button className="primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : (
            <>
              Get started <span>-&gt;</span>
            </>
          )}
        </button>
      </form>

      <p className="switch">
        Already have an account?{' '}
        <button type="button" onClick={onLogin} disabled={isSubmitting}>
          Sign in
        </button>
      </p>
    </AuthShell>
  );
}
