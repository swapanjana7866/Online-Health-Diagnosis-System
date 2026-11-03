import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { adminService } from '../services/api.js';

const formatDate = (value) => {
  if (!value) return 'Date not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not available';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
};

export default function AdminPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [updating, setUpdating] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('doctors');
  const [doctorForm, setDoctorForm] = useState({ name: '', specialty: '' });

  const loadAppointments = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const [appointmentResponse, doctorResponse] = await Promise.all([
        adminService.getAppointments(),
        adminService.getDoctors()
      ]);
      setAppointments(appointmentResponse?.data?.appointments || []);
      setDoctors(doctorResponse?.data?.doctors || []);
    } catch (requestError) {
      setError(requestError?.message || 'Unable to load consultation bookings.');
    } finally {
      setLoading(false);
    }
  }, []);

  const changeDoctorAvailability = async (doctor) => {
    const available = !doctor.available;
    setUpdating(`doctor:${doctor.name}`);
    setError('');
    setDoctors((current) => current.map((item) =>
      item.name === doctor.name ? { ...item, available } : item
    ));
    try {
      await adminService.updateDoctorAvailability(doctor.name, available);
      await loadAppointments(false);
    } catch (requestError) {
      setDoctors((current) => current.map((item) =>
        item.name === doctor.name ? { ...item, available: doctor.available } : item
      ));
      setError(requestError?.message || 'Unable to update doctor availability.');
    } finally {
      setUpdating('');
    }
  };

  const addDoctor = async (event) => {
    event.preventDefault();
    setUpdating('doctor:add');
    setError('');
    try {
      await adminService.addDoctor(doctorForm);
      setDoctorForm({ name: '', specialty: '' });
      await loadAppointments(false);
    } catch (requestError) {
      setError(requestError?.message || 'Unable to add doctor.');
    } finally {
      setUpdating('');
    }
  };

  const removeDoctor = async (doctor) => {
    if (!window.confirm('Remove this doctor?')) return;

    setUpdating(`doctor:${doctor._id}`);
    setError('');
    try {
      await adminService.removeDoctor(doctor._id);
      await loadAppointments(false);
    } catch (requestError) {
      setError(requestError?.message || 'Unable to remove doctor.');
    } finally {
      setUpdating('');
    }
  };

  const changeBookingStatus = async (appointment) => {
    const status = appointment.status === 'approved' ? 'pending' : 'approved';
    setUpdating(`booking:${appointment._id}`);
    setError('');
    try {
      await adminService.updateBookingStatus(appointment._id, status);
      setAppointments((current) => current.map((item) =>
        item._id === appointment._id ? { ...item, status } : item
      ));
    } catch (requestError) {
      setError(requestError?.message || 'Unable to update booking status.');
    } finally {
      setUpdating('');
    }
  };

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">+</span> carepath</div>
        <button
          className="signout"
          type="button"
          onClick={() => {
            signOut();
            navigate('/login', { replace: true });
          }}
        >
          Sign out
        </button>
      </header>

      <section className="appointments-page">
        <div className="appointments-header">
          <div>
            <p className="eyebrow">CARE COORDINATION & DOCTOR MANAGEMENT</p>
            <h1>Consultation bookings</h1>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <button
            className={activeSection === 'doctors' ? 'primary' : 'secondary-action-btn'}
            type="button"
            aria-pressed={activeSection === 'doctors'}
            onClick={() => setActiveSection('doctors')}
          >
            Doctors
          </button>
          <button
            className={activeSection === 'bookings' ? 'primary' : 'secondary-action-btn'}
            type="button"
            aria-pressed={activeSection === 'bookings'}
            onClick={() => setActiveSection('bookings')}
          >
            Bookings
          </button>
        </div>

        {error && (
          <div className="error-banner" role="alert">
            <p>{error}</p>
            <button className="text-button" type="button" onClick={() => loadAppointments(false)}>Retry</button>
          </div>
        )}

        {activeSection === 'doctors' && (
          <section className="appointments-list" aria-labelledby="doctor-availability-heading">
            <h2 id="doctor-availability-heading">Doctor availability</h2>
            <form onSubmit={addDoctor} style={{ display: 'grid', gap: '10px', marginBottom: '12px' }}>
              <label>
                Name
                <input
                  required
                  value={doctorForm.name}
                  onChange={(event) => setDoctorForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                Specialty
                <input
                  required
                  value={doctorForm.specialty}
                  onChange={(event) => setDoctorForm((current) => ({ ...current, specialty: event.target.value }))}
                />
              </label>
              <button className="primary" type="submit" disabled={Boolean(updating)}>
                {updating === 'doctor:add' ? 'Adding...' : 'Add doctor'}
              </button>
            </form>
            {loading && <p className="muted" role="status">Loading doctors...</p>}
            {!loading && doctors.map((doctor) => (
              <article className="appointment-card" key={doctor._id || doctor.name}>
                <div className="appointment-meta">
                  <strong>{doctor.name}</strong>
                  <span className={`status ${doctor.available ? 'green' : 'blue'}`}>
                    {doctor.available ? 'Available' : 'Unavailable'}
                  </span>
                </div>
                <p>Specialty: {doctor.specialty}</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="primary"
                    type="button"
                    disabled={Boolean(updating)}
                    onClick={() => changeDoctorAvailability(doctor)}
                  >
                    {updating === `doctor:${doctor.name}`
                      ? 'Saving...'
                      : doctor.available ? 'Set Unavailable' : 'Set Available'}
                  </button>
                  <button
                    className="secondary-action-btn"
                    type="button"
                    disabled={Boolean(updating)}
                    onClick={() => removeDoctor(doctor)}
                  >
                    {updating === `doctor:${doctor._id}` ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}

        {activeSection === 'bookings' && (
          <section className="appointments-list" aria-labelledby="booking-control-heading">
            <h2 id="booking-control-heading">Booking control</h2>
            <h3 id="all-bookings-heading">All bookings</h3>
            {loading && <p className="muted" role="status">Loading consultation bookings...</p>}
            {!loading && appointments.length === 0 && (
              <p className="empty-appointments">No consultation bookings found.</p>
            )}
            {!loading && appointments.map((appointment) => (
              <article className="appointment-card" key={appointment._id}>
                <div className="appointment-meta">
                  <strong>{appointment.patientName}</strong>
                  <span className={`status ${appointment.status === 'approved' ? 'green' : 'blue'}`}>
                    {appointment.status}
                  </span>
                </div>
                <p>Doctor: {appointment.doctorName}</p>
                <p>Specialty: {appointment.specialty}</p>
                <p>Date: {formatDate(appointment.appointmentDate)}</p>
                <p>Time: {appointment.timeSlot || 'TBD'}</p>
                <p className="appointment-reason">Reason: {appointment.reason || 'Not provided'}</p>
                <button
                  className="primary"
                  type="button"
                  disabled={Boolean(updating)}
                  onClick={() => changeBookingStatus(appointment)}
                >
                  {updating === `booking:${appointment._id}`
                    ? 'Saving...'
                    : appointment.status === 'approved' ? 'Set Pending' : 'Approve'}
                </button>
              </article>
            ))}
          </section>
        )}
      </section>
    </main>
  );
}
