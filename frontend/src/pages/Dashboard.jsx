import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { appointmentService, diagnosisService } from '../services/api.js';

const formatHistoryDate = (timestamp) => {
  if (!timestamp) return 'Recent check-in';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;

  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (diffDays === 1) {
    return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const formatBookingDate = (value) => {
  if (!value) return 'Date not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not available';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};

const getBookingTimestamp = (booking) => {
  const timestamp = new Date(booking.appointmentDate || booking.date || 0).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export default function Dashboard({ onNewDiagnosis, onChatbot, onProfile, onAppointments }) {
  const { user, signOut } = useAuth();

  const [diagnoses, setDiagnoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDiagnosis, setSelectedDiagnosis] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showBookingDetails, setShowBookingDetails] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState('');

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await diagnosisService.getHistory(1, 10);
      const items = res?.data?.diagnoses || [];
      setDiagnoses(items);
    } catch (err) {
      setError(err?.message || 'Unable to load your check-in history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this check-in record?')) {
      return;
    }

    try {
      setDeletingId(id);
      await diagnosisService.delete(id);
      setDiagnoses((prev) => prev.filter((d) => (d._id || d.id) !== id));
      if ((selectedDiagnosis?._id || selectedDiagnosis?.id) === id) {
        setSelectedDiagnosis(null);
      }
    } catch (err) {
      alert(err?.message || 'Could not delete check-in record.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleBookingDetails = async () => {
    if (showBookingDetails) {
      setShowBookingDetails(false);
      return;
    }

    setShowBookingDetails(true);
    setBookingsLoading(true);
    setBookingsError('');
    try {
      const response = await appointmentService.getAppointments();
      const items = response?.data?.appointments || [];
      setBookings([...items].sort((a, b) => getBookingTimestamp(b) - getBookingTimestamp(a)));
    } catch (err) {
      setBookings([]);
      setBookingsError(err?.message || 'Unable to load your bookings.');
    } finally {
      setBookingsLoading(false);
    }
  };

  return (
    <main className="app-shell">
      {/* TOP NAVIGATION BAR */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">+</span> carepath
        </div>
        <nav>
          <button className="nav-active" type="button">
            Overview
          </button>
          <button type="button" onClick={onProfile}>
            Health profile
          </button>
          <button type="button" onClick={onAppointments}>
            Consultations
          </button>
          <button type="button" onClick={onChatbot}>
            AI chat
          </button>
        </nav>
        <div className="user-menu">
          <div className="avatar">{user?.name?.[0] || 'U'}</div>
          <button className="signout" onClick={signOut} type="button">
            Sign out
          </button>
        </div>
      </header>

      {/* DASHBOARD MAIN CONTENT */}
      <section className="dashboard-content">
        {/* Welcome Section */}
        <div className="welcome">
          <div>
            <p className="eyebrow">HEALTH CHECK-IN & PREDICTION</p>
            <h1>Welcome, {user?.name?.split(' ')[0] || 'there'}.</h1>
            <p className="muted">
              Record symptoms and get AI-assisted differential diagnosis and triage support.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="primary large" onClick={onNewDiagnosis} type="button">
              + Start a check-in
            </button>
            <button
              className="secondary-action-btn"
              onClick={handleBookingDetails}
              type="button"
              aria-expanded={showBookingDetails}
            >
              Booking Details
            </button>
          </div>
        </div>

        {showBookingDetails && (
          <section className="appointments-list" aria-live="polite">
            <h2>Booking Details</h2>
            {bookingsLoading ? (
              <p className="muted">Loading bookings...</p>
            ) : bookingsError ? (
              <p className="error">{bookingsError}</p>
            ) : bookings.length === 0 ? (
              <p className="muted">No bookings yet</p>
            ) : (
              bookings.map((booking, index) => {
                const status = booking.status === 'approved' ? 'approved' : 'pending';
                return (
                  <article className="appointment-card" key={booking._id || booking.bookingId || index}>
                    <div className="appointment-meta">
                      <strong>{booking.doctorName || 'Doctor'}</strong>
                      <span className="status green">{status}</span>
                    </div>
                    <p>{booking.specialty || 'Specialty not available'}</p>
                    <small>
                      {formatBookingDate(booking.appointmentDate || booking.date)} · {booking.timeSlot || booking.time || 'Time not available'}
                    </small>
                    <span className="appointment-reason">{booking.reason || 'No reason provided'}</span>
                  </article>
                );
              })
            )}
          </section>
        )}

        {/* Safety Disclaimer Banner */}
        <div className="notice">
          <div className="notice-icon">i</div>
          <div>
            <strong>Carepath is here to support, not replace, your doctor.</strong>
            <p>For urgent or life-threatening symptoms, contact emergency services immediately.</p>
          </div>
        </div>

        {/* Activity / Diagnoses Section */}
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR RECENT ASSESSMENTS</p>
            <h2>Diagnosis Check-Ins</h2>
          </div>
          {diagnoses.length > 0 && (
            <button className="text-button" onClick={onNewDiagnosis} type="button">
              + New check-in <span>&rarr;</span>
            </button>
          )}
        </div>

        {/* UI STATE TRIAD: Loading / Error / Empty / Data */}
        {loading && (
          <div style={{ padding: '36px 0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ height: '54px', background: '#eaf0eb', borderRadius: '8px' }} />
            <div style={{ height: '54px', background: '#eaf0eb', borderRadius: '8px', opacity: 0.6 }} />
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '16px 20px',
              background: '#fdf3f2',
              border: '1px solid #f8d2ce',
              borderRadius: '8px',
              color: '#a83c30',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span>{error}</span>
            <button className="text-button" onClick={fetchHistory} type="button">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && diagnoses.length === 0 && (
          <div
            style={{
              padding: '48px 24px',
              background: '#ffffff',
              border: '1px dashed var(--line)',
              borderRadius: '12px',
              textAlign: 'center',
              marginBottom: '32px'
            }}
          >
            <p className="eyebrow">NO CHECK-INS RECORDED</p>
            <h3 style={{ font: '600 24px Fraunces, serif', margin: '8px 0 10px' }}>
              You haven't run any health predictions yet.
            </h3>
            <p className="muted" style={{ maxWidth: '420px', margin: '0 auto 24px' }}>
              Select your current symptoms to evaluate potential conditions with our diagnostic
              classifier.
            </p>
            <button className="primary" onClick={onNewDiagnosis} type="button">
              Find Health Prediction Now &rarr;
            </button>
          </div>
        )}

        {!loading && diagnoses.length > 0 && (
          <div className="history-list">
            {diagnoses.map((item) => {
              const itemId = item._id || item.id;
              const dateLabel = formatHistoryDate(item.createdAt);
              const disease = item.predictedDisease || 'General symptom pattern';
              const symptomCount = item.symptoms?.length || 0;
              const confidence = item.confidence || 0;
              const severity = item.severity || 'moderate';

              return (
                <article
                  className="history-item"
                  key={itemId}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedDiagnosis(item)}
                >
                  <div className="history-icon">+</div>
                  <div className="history-main">
                    <p>{dateLabel}</p>
                    <h3>{disease}</h3>
                    <span>
                      {symptomCount} symptom{symptomCount !== 1 ? 's' : ''} evaluated &bull;{' '}
                      {confidence}% confidence
                    </span>
                  </div>
                  <span className={`status ${severity === 'mild' ? 'green' : 'blue'}`}>
                    {severity.toUpperCase()}
                  </span>
                  <button
                    className="arrow-button"
                    aria-label={`Open details for ${disease}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDiagnosis(item);
                    }}
                    type="button"
                  >
                    &rarr;
                  </button>
                </article>
              );
            })}
          </div>
        )}

        {/* MODAL DIALOG FOR INSPECTING A DIAGNOSIS */}
        {selectedDiagnosis && (
          <div
            className="modal-backdrop"
            onClick={() => setSelectedDiagnosis(null)}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <span className={`severity-pill ${selectedDiagnosis.severity || 'moderate'}`}>
                    {(selectedDiagnosis.severity || 'moderate').toUpperCase()}
                  </span>
                  <h2 style={{ marginTop: '6px' }}>{selectedDiagnosis.predictedDisease}</h2>
                  <p className="muted" style={{ fontSize: '13px', margin: '4px 0 0' }}>
                    Recorded {formatHistoryDate(selectedDiagnosis.createdAt)} &bull;{' '}
                    <strong>{selectedDiagnosis.confidence}%</strong> confidence
                  </p>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setSelectedDiagnosis(null)}
                  aria-label="Close dialog"
                >
                  &times;
                </button>
              </div>

              {/* Condition Summary */}
              {selectedDiagnosis.description && (
                <p style={{ fontSize: '14px', color: '#3d4f48', margin: 0, lineHeight: 1.6 }}>
                  {selectedDiagnosis.description}
                </p>
              )}

              {/* Evaluated Symptoms */}
              <div>
                <span className="detail-label">Evaluated Symptoms:</span>
                <div className="selected-chips-grid" style={{ marginTop: '8px' }}>
                  {selectedDiagnosis.symptoms?.map((s) => (
                    <span className="selected-chip" key={s}>
                      ✓ {s.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>

              {/* Differential Candidates */}
              {selectedDiagnosis.topPredictions?.length > 0 && (
                <div className="differential-section" style={{ padding: '16px' }}>
                  <h3 style={{ fontSize: '12px', marginBottom: '10px' }}>Differential Possibilities</h3>
                  <div className="diff-list">
                    {selectedDiagnosis.topPredictions.map((pred, i) => (
                      <div className="diff-row" key={pred.disease || i}>
                        <div className="diff-meta">
                          <span>{pred.disease}</span>
                          <strong>{pred.confidence}%</strong>
                        </div>
                        <div className="progress-track">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${Math.min(100, Math.max(5, pred.confidence))}%`
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Clinical Care Recommendation */}
              {selectedDiagnosis.recommendation && (
                <aside className="recommendation-panel" style={{ padding: '14px 16px' }}>
                  <h4 style={{ fontSize: '11px' }}>Care Recommendation</h4>
                  <p style={{ fontSize: '12px' }}>{selectedDiagnosis.recommendation}</p>
                </aside>
              )}

              {/* Medical Safety Disclaimer */}
              <div className="medical-disclaimer-box" style={{ padding: '12px' }}>
                <p className="disclaimer-text" style={{ fontSize: '11px' }}>
                  <strong>Disclaimer: </strong>
                  {selectedDiagnosis.disclaimer ||
                    'MedInsight provides preliminary, AI-assisted symptom triage guidance for informational purposes only. It is not a clinical medical diagnosis.'}
                </p>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                <button
                  type="button"
                  style={{ color: '#b24e43', fontSize: '12px', fontWeight: 600 }}
                  disabled={deletingId === (selectedDiagnosis._id || selectedDiagnosis.id)}
                  onClick={(e) => handleDelete(selectedDiagnosis._id || selectedDiagnosis.id, e)}
                >
                  {deletingId === (selectedDiagnosis._id || selectedDiagnosis.id) ? 'Deleting...' : '🗑️ Delete record'}
                </button>

                <button
                  className="primary"
                  type="button"
                  onClick={() => setSelectedDiagnosis(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Grid Panels */}
        <div className="dashboard-grid">
          <div className="soft-panel">
            <p className="eyebrow">YOUR CARE CIRCLE</p>
            <h2>Keep your health story close.</h2>
            <p className="muted">Complete your health profile so your future check-ins have more context.</p>
            <button className="text-button" onClick={onProfile} type="button">
              Complete profile <span>&rarr;</span>
            </button>
          </div>

          <div className="soft-panel accent-panel">
            <p className="eyebrow">FOLLOW-UP CARE</p>
            <h2>Need a doctor review?</h2>
            <p className="muted">Book a consultation with a specialist best matched to your recent symptom pattern.</p>
            <button className="text-button" onClick={onAppointments} type="button">
              Book a consultation <span>&rarr;</span>
            </button>
          </div>

          <div className="soft-panel">
            <p className="eyebrow">CONVERSATIONAL CHECK-IN</p>
            <h2>Talk through how you feel.</h2>
            <p className="muted">
              Share symptoms in your own words and get supportive triage guidance.
            </p>
            <button className="text-button" onClick={onChatbot} type="button">
              Start an AI chat <span>&rarr;</span>
            </button>
          </div>

          <div className="quote-panel">
            <span className="quote-mark">“</span>
            <p>Health is not a destination. It is a way of travelling.</p>
            <small>— Carepath</small>
          </div>
        </div>
      </section>
    </main>
  );
}
