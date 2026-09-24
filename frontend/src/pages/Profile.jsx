import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { userService } from '../services/api.js';

export default function Profile({ onBack }) {
  const { user, signOut, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    age: user?.age || '',
    gender: user?.gender || 'prefer_not_to_say'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ text: '', type: '' });

    try {
      const payload = {
        name: formData.name.trim(),
        age: formData.age ? Number(formData.age) : undefined,
        gender: formData.gender
      };

      const response = await userService.updateProfile(payload);
      if (response?.data?.user) {
        updateUser(response.data.user);
      }
      setMessage({ text: 'Profile updated successfully!', type: 'success' });
      setIsEditing(false);
    } catch (err) {
      setMessage({ text: err.message || 'Failed to update profile', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">+</span> carepath
        </div>
        <nav>
          <button type="button" onClick={onBack}>
            Overview
          </button>
          <button className="nav-active" type="button">
            Health profile
          </button>
        </nav>
        <div className="user-menu">
          <div className="avatar">{user?.name?.[0] || 'U'}</div>
          <button className="signout" onClick={signOut} type="button">
            Sign out
          </button>
        </div>
      </header>

      <section className="profile-page">
        <p className="eyebrow">YOUR CARE PROFILE</p>
        <h1>Health Profile</h1>
        <p className="muted">
          Keep your basic information updated to provide better context during symptom check-ins.
        </p>

        {message.text && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              borderRadius: '6px',
              marginBottom: '1.25rem',
              fontSize: '0.9rem',
              backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: message.type === 'success' ? '#15803d' : '#b91c1c',
              border: `1px solid ${message.type === 'success' ? '#86efac' : '#f87171'}`
            }}
          >
            {message.text}
          </div>
        )}

        {!isEditing ? (
          <div className="profile-details" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9' }}>
              <span className="detail-label" style={{ display: 'block', color: '#64748b', fontSize: '0.85rem' }}>Full name</span>
              <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{user?.name || 'Not provided'}</strong>
            </div>

            <div style={{ padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9' }}>
              <span className="detail-label" style={{ display: 'block', color: '#64748b', fontSize: '0.85rem' }}>Email address</span>
              <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{user?.email || 'Not provided'}</strong>
            </div>

            <div style={{ padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9' }}>
              <span className="detail-label" style={{ display: 'block', color: '#64748b', fontSize: '0.85rem' }}>Age</span>
              <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{user?.age ? `${user.age} years` : 'Not specified'}</strong>
            </div>

            <div style={{ padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9' }}>
              <span className="detail-label" style={{ display: 'block', color: '#64748b', fontSize: '0.85rem' }}>Gender</span>
              <strong style={{ fontSize: '1.1rem', color: '#0f172a', textTransform: 'capitalize' }}>
                {user?.gender ? user.gender.replace(/_/g, ' ') : 'Not specified'}
              </strong>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
              <button className="primary" onClick={() => setIsEditing(true)} type="button">
                Edit profile
              </button>
              <button className="text-button" onClick={onBack} type="button">
                Back to overview <span>-&gt;</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="form-stack" style={{ maxWidth: '480px' }}>
            <label>
              Full name
              <input
                type="text"
                required
                value={formData.name}
                disabled={isSaving}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <label>
                Age
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={formData.age}
                  disabled={isSaving}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  placeholder="e.g. 29"
                />
              </label>

              <label>
                Gender
                <select
                  value={formData.gender}
                  disabled={isSaving}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
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

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="primary" type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save changes'}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={isSaving}
                onClick={() => {
                  setFormData({
                    name: user?.name || '',
                    age: user?.age || '',
                    gender: user?.gender || 'prefer_not_to_say'
                  });
                  setIsEditing(false);
                }}
                style={{
                  padding: '0.75rem 1.25rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
