import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const sampleHistory = [{ date: 'Today, 9:42 AM', title: 'General wellness check', tag: 'Completed', tone: 'green', detail: '3 symptoms recorded' }, { date: 'Jun 18, 2024', title: 'Seasonal allergies', tag: 'Reviewed', tone: 'blue', detail: 'Follow-up recommended' }];

export default function Dashboard({ onNewDiagnosis, onProfile }) {
  const { user, signOut } = useAuth();
  const [selectedCheckin, setSelectedCheckin] = useState(null);

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">+</span> carepath</div>
      <nav>
        <button className="nav-active" type="button">Overview</button>
        <button type="button" onClick={onProfile}>Health profile</button>
      </nav>
      <div className="user-menu"><div className="avatar">{user?.name?.[0] || 'U'}</div><button className="signout" onClick={signOut} type="button">Sign out</button></div>
    </header>
    <section className="dashboard-content">
      <div className="welcome"><div><p className="eyebrow">HEALTH CHECK-IN</p><h1>Welcome, {user?.name?.split(' ')[0] || 'there'}.</h1><p className="muted">A small check-in can make a meaningful difference.</p></div><button className="primary large" onClick={onNewDiagnosis} type="button">+ Start a check-in</button></div>
      <div className="notice"><div className="notice-icon">i</div><div><strong>Carepath is here to support, not replace, your doctor.</strong><p>For urgent or life-threatening symptoms, contact emergency services immediately.</p></div></div>
      <div className="section-heading"><div><p className="eyebrow">YOUR ACTIVITY</p><h2>Recent check-ins</h2></div><button className="text-button" onClick={() => document.querySelector('.history-list')?.scrollIntoView({ behavior: 'smooth' })} type="button">View all <span>-&gt;</span></button></div>
      <div className="history-list">
        {sampleHistory.map((item) => <article className="history-item" key={item.date}>
          <div className="history-icon">+</div><div className="history-main"><p>{item.date}</p><h3>{item.title}</h3><span>{item.detail}</span></div><span className={`status ${item.tone}`}>{item.tag}</span><button className="arrow-button" aria-label={`Open ${item.title}`} onClick={() => setSelectedCheckin(item)} type="button">-&gt;</button>
        </article>)}
      </div>
      {selectedCheckin && <div className="selected-checkin" role="status"><strong>{selectedCheckin.title}</strong><span>{selectedCheckin.detail}</span><button className="text-button" onClick={() => setSelectedCheckin(null)} type="button">Dismiss</button></div>}
      <div className="dashboard-grid"><div className="soft-panel"><p className="eyebrow">YOUR CARE CIRCLE</p><h2>Keep your health story close.</h2><p className="muted">Complete your health profile so your future check-ins have more context.</p><button className="text-button" onClick={onProfile} type="button">Complete profile <span>-&gt;</span></button></div><div className="quote-panel"><span className="quote-mark">“</span><p>Health is not a destination. It is a way of travelling.</p><small>— Carepath</small></div></div>
    </section>
  </main>;
}
