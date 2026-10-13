import { useEffect, useMemo, useState } from 'react';
import { appointmentService } from '../services/api.js';

const defaultReason = 'I would like to follow up on my recent symptom check-in';

const formatDisplayDate = (value) => {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};

const formatTimeLabel = (value) => (value ? value.replace(':', ':') : 'TBD');

export default function Appointments({ onBack, initialReason }) {
  const [activeTab, setActiveTab] = useState('booking');
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [reason, setReason] = useState(initialReason || defaultReason);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialReason) {
      setReason(initialReason);
    }
  }, [initialReason]);

  const selectedDoctor = useMemo(
    () => doctors.find((doctor) => doctor._id === selectedDoctorId) || null,
    [doctors, selectedDoctorId]
  );

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [doctorResponse, appointmentResponse] = await Promise.all([
        appointmentService.getDoctors(),
        appointmentService.getAppointments()
      ]);

      const nextDoctors = doctorResponse?.data?.doctors || [];
      const nextAppointments = appointmentResponse?.data?.appointments || [];

      setDoctors(nextDoctors);
      setAppointments(nextAppointments);
      if (nextDoctors[0] && !selectedDoctorId) {
        setSelectedDoctorId(nextDoctors[0]._id);
        setTimeSlot(nextDoctors[0].availabilitySlots?.[0] || '09:00');
      }
    } catch (loadError) {
      setError(loadError?.message || 'Unable to load doctors right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (!selectedDoctor) return;
    const nextTime = selectedDoctor.availabilitySlots?.[0] || '09:00';
    if (!timeSlot || !selectedDoctor.availabilitySlots?.includes(timeSlot)) {
      setTimeSlot(nextTime);
    }
  }, [selectedDoctor, timeSlot]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!selectedDoctorId || !date || !timeSlot) {
      setError('Please choose a doctor, date, and appointment time.');
      return;
    }

    if (selectedDoctor && selectedDoctor.available === false) {
      setError(`Dr. ${selectedDoctor.name} is currently marked as unavailable in the database. Please select an available doctor.`);
      return;
    }

    try {
      setLoading(true);
      const response = await appointmentService.bookAppointment({
        doctorId: selectedDoctorId,
        date,
        timeSlot,
        reason
      });

      const newAppointment = response?.data?.appointment;
      setAppointments((prev) =>
        [...prev, newAppointment].sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate))
      );
      setMessage('Appointment request sent successfully.');
      setReason(defaultReason);
      setDate('');
      if (selectedDoctor) {
        setTimeSlot(selectedDoctor.availabilitySlots?.[0] || '09:00');
      }
    } catch (submitError) {
      setError(submitError?.message || 'Unable to book this appointment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">+</span> carepath</div>
        <nav>
          <button type="button" onClick={onBack}>Overview</button>
          <button className="nav-active" type="button">Consultations</button>
        </nav>
      </header>

      <section className="appointments-page">
        <div className="appointments-header">
          <div>
            <p className="eyebrow">CARE COORDINATION & DOCTOR MANAGEMENT</p>
            <h1>Doctor Consultations</h1>
          </div>
          <button className="primary" onClick={onBack} type="button">Back to dashboard</button>
        </div>

        {/* Consultation tab */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '28px',
            borderBottom: '1px solid var(--line)',
            paddingBottom: '12px',
            flexWrap: 'wrap'
          }}
        >
          <button
            type="button"
            className={activeTab === 'booking' ? 'primary' : 'secondary-action-btn'}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              background: activeTab === 'booking' ? 'var(--green)' : '#ffffff',
              color: activeTab === 'booking' ? '#ffffff' : 'var(--ink)',
              border: activeTab === 'booking' ? 'none' : '1px solid var(--line)'
            }}
            onClick={() => setActiveTab('booking')}
          >
            📅 Book Consultation
          </button>
        </div>

        {message && (
          <div
            style={{
              padding: '14px 18px',
              background: '#e8f5ec',
              border: '1px solid #c2decb',
              borderRadius: '8px',
              color: '#1d543e',
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span>✓ {message}</span>
            <button
              type="button"
              onClick={() => setMessage('')}
              style={{ background: 'none', border: 'none', fontSize: '16px', color: '#1d543e', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '14px 18px',
              background: '#fdf2f0',
              border: '1px solid #f6cfc9',
              borderRadius: '8px',
              color: '#a83c30',
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '20px'
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* TAB 2: BOOKING CONSULTATION */}
        {activeTab === 'booking' && (
          <div className="appointments-grid">
            <form className="booking-form" onSubmit={handleSubmit}>
              <h2>Choose a specialist</h2>

              <label>
                Doctor
                <select
                  value={selectedDoctorId}
                  onChange={(event) => setSelectedDoctorId(event.target.value)}
                >
                  {doctors.map((doctor) => {
                    const isAvail = doctor.available !== false;
                    return (
                      <option key={doctor._id} value={doctor._id}>
                        {doctor.name} — {doctor.specialty} {isAvail ? '🟢 (Available)' : '🔴 [UNAVAILABLE]'}
                      </option>
                    );
                  })}
                </select>
              </label>

              {/* Selected Doctor Preview Card */}
              {selectedDoctor && (
                <div
                  className="doctor-card"
                  style={{
                    borderColor: selectedDoctor.available === false ? '#f6cfc9' : 'var(--line)',
                    background: selectedDoctor.available === false ? '#fff5f5' : '#f3f8f4'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{selectedDoctor.name}</strong>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: selectedDoctor.available === false ? '#fee2e2' : '#e2f1e5',
                        color: selectedDoctor.available === false ? '#b91c1c' : '#276943'
                      }}
                    >
                      {selectedDoctor.available === false ? '🔴 Marked Unavailable' : '🟢 Available'}
                    </span>
                  </div>
                  <span>{selectedDoctor.specialty}</span>
                  <p>{selectedDoctor.description}</p>
                  <small>
                    {selectedDoctor.consultationFee
                      ? `$${selectedDoctor.consultationFee} consultation fee`
                      : 'Consultation available'}
                  </small>

                  {/* Unavailable warning & quick toggle */}
                  {selectedDoctor.available === false && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '10px 12px',
                        background: '#fff',
                        border: '1px solid #f6cfc9',
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}
                    >
                      <span style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 600 }}>
                        ⚠️ This doctor is currently marked as unavailable in the database.
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="booking-row">
                <label>
                  Preferred date
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </label>
                <label>
                  Time
                  <select value={timeSlot} onChange={(event) => setTimeSlot(event.target.value)}>
                    {(selectedDoctor?.availabilitySlots || []).map((slot) => (
                      <option key={slot} value={slot}>{formatTimeLabel(slot)}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Reason for visit
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows="4" />
              </label>

              <button
                className="primary large"
                type="submit"
                disabled={loading || selectedDoctor?.available === false}
                style={{
                  opacity: selectedDoctor?.available === false ? 0.6 : 1,
                  cursor: selectedDoctor?.available === false ? 'not-allowed' : 'pointer'
                }}
              >
                {loading
                  ? 'Booking…'
                  : selectedDoctor?.available === false
                  ? 'Doctor Unavailable in Database'
                  : 'Book appointment'}
              </button>
            </form>

            <aside className="appointments-list">
              <h2>Upcoming requests</h2>
              {appointments.length === 0 ? (
                <div className="empty-appointments">
                  <p>No visits scheduled yet.</p>
                </div>
              ) : (
                appointments.map((item) => (
                  <article className="appointment-card" key={item._id || `${item.appointmentDate}-${item.doctorName}`}>
                    <div className="appointment-meta">
                      <span className="status green">{item.status}</span>
                      <strong>{item.doctorName}</strong>
                    </div>
                    <p>{item.specialty}</p>
                    <small>{formatDisplayDate(item.appointmentDate)} • {formatTimeLabel(item.timeSlot)}</small>
                    <span className="appointment-reason">{item.reason}</span>
                  </article>
                ))
              )}
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
