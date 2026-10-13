import { Fragment, useState, useRef, useEffect, useCallback } from 'react';
import { chatService } from '../services/api';
import { CHAT_MAX_MESSAGE_LENGTH, MEDICAL_DISCLAIMER } from '../utils/constants.js';
import './Chatbot.css';

const WELCOME_MSG = {
  id: 'welcome',
  role: 'bot',
  text: "👋 Hi! I'm **Carepath AI**, your personal health assistant.\n\nDescribe your symptoms in plain language — for example, *\"I've had a fever and sore throat for 2 days\"* — and I'll help assess your condition and suggest next steps.\n\nHow are you feeling today?",
  time: new Date(),
  type: 'welcome',
};

const SEVERITY_CONFIG = {
  mild: { label: 'Mild', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', icon: '🟢' },
  moderate: { label: 'Moderate', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '🟡' },
  severe: { label: 'Severe', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: '🔴' },
};

let msgCounter = 0;
const uid = () => `msg-${++msgCounter}-${Date.now()}`;

/* ─────────────────────── markdown renderer ─────────────────────── */
function renderMarkdown(text) {
  if (!text) return null;
  return text.split('\n').map((line, lineIndex) => (
    <Fragment key={lineIndex}>
      {line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, partIndex) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={partIndex}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={partIndex}>{part.slice(1, -1)}</em>;
        }
        return part;
      })}
      {lineIndex < text.split('\n').length - 1 && <br />}
    </Fragment>
  ));
}

/* ─────────────────────── DiagnosisCard ────────────────────────── */
function DiagnosisCard({ result, onBookAppointment }) {
  if (!result) return null;
  const sev = SEVERITY_CONFIG[result.severity] || SEVERITY_CONFIG.moderate;
  return (
    <div className="chat-diag-card">
      <div className="chat-diag-header">
        <span className="chat-diag-icon">🩺</span>
        <div>
          <div className="chat-diag-title">AI Triage Result</div>
          <div className="chat-diag-disease">{result.predictedDisease}</div>
        </div>
        <div className="chat-diag-confidence">
          <svg viewBox="0 0 36 36" className="conf-ring">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.9" fill="none"
              stroke={sev.color} strokeWidth="3"
              strokeDasharray={`${result.confidence} ${100 - result.confidence}`}
              strokeLinecap="round"
              transform="rotate(-90 18 18)"
            />
          </svg>
          <span style={{ color: sev.color }}>{result.confidence}%</span>
        </div>
      </div>

      <div className="chat-diag-severity" style={{ background: sev.bg, borderColor: sev.color }}>
        {sev.icon} Severity: <strong style={{ color: sev.color }}>{sev.label}</strong>
      </div>

      {result.topPredictions?.length > 1 && (
        <div className="chat-diag-section">
          <div className="chat-diag-section-label">Differential Diagnoses</div>
          {result.topPredictions.slice(0, 3).map((p, i) => (
            <div key={i} className="chat-diag-bar-row">
              <span className="chat-diag-bar-label">{p.condition || p.disease}</span>
              <div className="chat-diag-bar-track">
                <div
                  className="chat-diag-bar-fill"
                  style={{
                    width: `${p.probability ?? p.confidence ?? 0}%`,
                    background: i === 0 ? sev.color : '#475569'
                  }}
                />
              </div>
              <span className="chat-diag-bar-pct">{p.probability ?? p.confidence ?? 0}%</span>
            </div>
          ))}
        </div>
      )}

      {result.geminiInsights && (
        <div style={{ marginTop: '10px', background: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.2)', borderRadius: '8px', padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ fontSize: '13px' }}>✨</span>
            <strong style={{ fontSize: '11px', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {result.geminiInsights?.poweredBy || 'Gemini'} Clinical Insight
            </strong>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#e2e8f0', lineHeight: '1.5' }}>
            {result.geminiInsights.clinicalExplanation}
          </p>
          {result.accuracyMetrics && (
            <div style={{ marginTop: '8px', display: 'flex', gap: '10px', fontSize: '10px', color: '#94a3b8' }}>
              <span>Agreement: <strong style={{ color: '#60a5fa' }}>{result.accuracyMetrics.agreementScore}%</strong></span>
              <span>Dataset Coverage: <strong style={{ color: '#34d399' }}>{result.accuracyMetrics.symptomCoverageRatio}%</strong></span>
            </div>
          )}
        </div>
      )}

      {result.recommendation && (
        <div className="chat-diag-rec">
          <strong>Care Advice:</strong> {result.recommendation}
        </div>
      )}

      {result.isFallback && (
        <div className="chat-diag-fallback">
          ℹ️ ML service is offline — result generated by fallback heuristic engine.
        </div>
      )}

      <div className="chat-diag-disclaimer">{MEDICAL_DISCLAIMER}</div>

      {onBookAppointment && (
        <button
          className="chat-book-btn"
          onClick={() => onBookAppointment(result)}
          id="chat-book-appointment-btn"
        >
          📅 Book Specialist Appointment
        </button>
      )}
    </div>
  );
}

/* ─────────────────────── SymptomPills ─────────────────────────── */
function SymptomPills({ symptoms, onAdd }) {
  if (!symptoms?.length) return null;
  return (
    <div className="chat-symptom-pills">
      <span className="chat-pills-label">Also experiencing?</span>
      {symptoms.map((s) => (
        <button
          key={s.id}
          className="chat-pill"
          onClick={() => onAdd(s)}
          id={`suggest-${s.id}`}
        >
          + {s.name}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────── Message Bubble ───────────────────────── */
function Message({ msg, onBookAppointment, onAddSymptom }) {
  const isBot = msg.role === 'bot';
  return (
    <div className={`chat-bubble-row ${isBot ? 'bot-row' : 'user-row'}`}>
      {isBot && (
        <div className="chat-avatar bot-avatar" aria-label="AI assistant">
          <span>🤖</span>
        </div>
      )}
      <div className={`chat-bubble ${isBot ? 'bot-bubble' : 'user-bubble'}`}>
        {msg.isTyping ? (
          <div className="typing-indicator">
            <span /><span /><span />
          </div>
        ) : (
          <>
            <div
              className="bubble-text"
            >
              {renderMarkdown(msg.text)}
            </div>
            {msg.isEmergency && (
              <div className="chat-emergency-banner">
                🚨 <strong>EMERGENCY WARNING:</strong> Your symptoms may require immediate medical attention. Call emergency services (112/108) now.
              </div>
            )}
            {msg.diagnosisResult && (
              <DiagnosisCard
                result={msg.diagnosisResult}
                onBookAppointment={onBookAppointment}
              />
            )}
            {msg.suggestedSymptoms?.length > 0 && (
              <SymptomPills symptoms={msg.suggestedSymptoms} onAdd={onAddSymptom} />
            )}
            <div className="bubble-time">
              {msg.time?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </>
        )}
      </div>
      {!isBot && (
        <div className="chat-avatar user-avatar" aria-label="You">
          <span>👤</span>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── Main Chatbot ─────────────────────────── */
export default function Chatbot({ onBack, onBookAppointment }) {
  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentSymptoms, setCurrentSymptoms] = useState([]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [sessionDone, setSessionDone] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, { id: uid(), time: new Date(), ...msg }]);
  }, []);

  const handleSend = useCallback(async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;

    setInput('');

    addMessage({ role: 'user', text: trimmed });
    const typingId = uid();
    setMessages((prev) => [
      ...prev,
      { id: typingId, role: 'bot', isTyping: true, time: new Date() }
    ]);
    setLoading(true);

    const newHistory = [...conversationHistory, { role: 'user', content: trimmed }];

    try {
      const resp = await chatService.sendMessage({
        message: trimmed,
        conversationHistory: newHistory,
        currentSymptoms
      });

      const data = resp.data;
      const updatedSymptoms = data.detectedSymptoms?.length > 0
        ? [...new Set([...currentSymptoms, ...data.detectedSymptoms])]
        : currentSymptoms;

      setCurrentSymptoms(updatedSymptoms);
      setConversationHistory([
        ...newHistory.slice(-40),
        { role: 'assistant', content: data.reply }
      ]);

      if (data.diagnosisResult) setSessionDone(true);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === typingId
            ? {
                ...m,
                isTyping: false,
                text: data.reply,
                diagnosisResult: data.diagnosisResult,
                suggestedSymptoms: data.suggestedSymptoms,
                isEmergency: data.isEmergency
              }
            : m
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === typingId
            ? {
                ...m,
                isTyping: false,
                text: `❌ ${err.message || 'Something went wrong. Please try again.'}`
              }
            : m
        )
      );
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, conversationHistory, currentSymptoms, addMessage]);

  const handleEvaluate = useCallback(async () => {
    if (loading || currentSymptoms.length === 0) return;
    setLoading(true);
    const typingId = uid();
    setMessages((prev) => [
      ...prev,
      { id: typingId, role: 'bot', isTyping: true, time: new Date() }
    ]);

    try {
      const resp = await chatService.sendMessage({
        message: '',
        action: 'evaluate',
        conversationHistory,
        currentSymptoms
      });
      const data = resp.data;
      if (data.diagnosisResult) setSessionDone(true);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === typingId
            ? {
                ...m,
                isTyping: false,
                text: data.reply,
                diagnosisResult: data.diagnosisResult,
                suggestedSymptoms: data.suggestedSymptoms,
                isEmergency: data.isEmergency
              }
            : m
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === typingId
            ? { ...m, isTyping: false, text: `❌ ${err.message}` }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }, [loading, currentSymptoms, conversationHistory]);

  const handleAddSymptom = useCallback((symptom) => {
    handleSend(`Yes, I also have ${symptom.name}`);
  }, [handleSend]);

  const handleReset = () => {
    setMessages([WELCOME_MSG]);
    setInput('');
    setCurrentSymptoms([]);
    setConversationHistory([]);
    setSessionDone(false);
    inputRef.current?.focus();
  };

  const quickPrompts = [
    'I have fever and headache',
    'Chest pain and shortness of breath',
    'Stomach ache and nausea',
    'Skin rash and itching',
  ];

  return (
    <div className="chatbot-page">
      {/* Header */}
      <header className="chatbot-header">
        <button className="chatbot-back-btn" onClick={onBack} id="chatbot-back-btn" aria-label="Go back">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7-7 7 7 7" />
          </svg>
        </button>
        <div className="chatbot-header-info">
          <div className="chatbot-avatar-ring">
            <span className="chatbot-header-avatar">🤖</span>
            <span className="chatbot-status-dot" />
          </div>
          <div>
            <div className="chatbot-header-name">Carepath AI</div>
            <div className="chatbot-header-sub">Health Assessment Assistant</div>
          </div>
        </div>
        <div className="chatbot-header-actions">
          {currentSymptoms.length > 0 && !sessionDone && (
            <button
              className="chat-eval-btn"
              onClick={handleEvaluate}
              disabled={loading}
              id="chat-run-evaluation-btn"
              title="Run full diagnosis with collected symptoms"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Evaluate ({currentSymptoms.length})
            </button>
          )}
          <button className="chat-reset-btn" onClick={handleReset} id="chat-reset-btn" title="Start new session">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </header>

      {/* Symptoms tracker bar */}
      {currentSymptoms.length > 0 && (
        <div className="chatbot-symptom-bar">
          <span className="symptom-bar-label">Tracking:</span>
          {currentSymptoms.slice(0, 6).map((s) => (
            <span key={s} className="symptom-bar-tag">
              {s.replace(/_/g, ' ')}
            </span>
          ))}
          {currentSymptoms.length > 6 && (
            <span className="symptom-bar-more">+{currentSymptoms.length - 6} more</span>
          )}
        </div>
      )}

      {/* Messages area */}
      <div className="chatbot-messages" id="chatbot-messages-area" role="log" aria-live="polite">
        {messages.map((msg) => (
          <Message
            key={msg.id}
            msg={msg}
            onBookAppointment={onBookAppointment}
            onAddSymptom={handleAddSymptom}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompt chips (only when fresh) */}
      {messages.length === 1 && !loading && (
        <div className="chatbot-quick-prompts">
          {quickPrompts.map((p) => (
            <button
              key={p}
              className="quick-prompt-chip"
              onClick={() => handleSend(p)}
              id={`quick-prompt-${p.replace(/\s+/g, '-').toLowerCase()}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="chatbot-input-area">
        <div className="chatbot-input-wrap">
          <textarea
            ref={inputRef}
            className="chatbot-input"
            id="chatbot-text-input"
            placeholder="Describe your symptoms…"
            value={input}
            rows={1}
            maxLength={CHAT_MAX_MESSAGE_LENGTH}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={loading}
            aria-label="Type your message"
          />
          <button
            className={`chatbot-send-btn ${loading ? 'loading' : ''}`}
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            id="chatbot-send-btn"
            aria-label="Send message"
          >
            {loading ? (
              <div className="send-spinner" />
            ) : (
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
        <p className="chatbot-footer-note">{MEDICAL_DISCLAIMER}</p>
      </div>
    </div>
  );
}
