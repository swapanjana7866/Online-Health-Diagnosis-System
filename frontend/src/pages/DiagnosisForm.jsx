import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { diagnosisService } from '../services/api.js';

// Fallback symptom taxonomy in case network is disconnected
const defaultPopularSymptoms = [
  { id: 'headache', name: 'Headache' },
  { id: 'high_fever', name: 'High Fever' },
  { id: 'cough', name: 'Cough' },
  { id: 'fatigue', name: 'Fatigue' },
  { id: 'chills', name: 'Chills' },
  { id: 'nausea', name: 'Nausea' },
  { id: 'breathlessness', name: 'Shortness of Breath' },
  { id: 'joint_pain', name: 'Joint Pain' },
  { id: 'chest_pain', name: 'Chest Pain' },
  { id: 'dizziness', name: 'Dizziness' },
  { id: 'skin_rash', name: 'Skin Rash' },
  { id: 'throat_irritation', name: 'Sore / Irritated Throat' },
  { id: 'stomach_pain', name: 'Stomach Pain' },
  { id: 'muscle_pain', name: 'Muscle Pain' }
];

export default function DiagnosisForm({ onBack, onBookAppointment }) {
  const { user } = useAuth();

  const [availableSymptoms, setAvailableSymptoms] = useState(defaultPopularSymptoms);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [form, setForm] = useState({
    duration: '1–3 days',
    severity: 'moderate',
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [prediction, setPrediction] = useState(null);

  const searchContainerRef = useRef(null);

  // Fetch full 130+ symptoms master catalog from API
  useEffect(() => {
    let isMounted = true;
    const loadSymptoms = async () => {
      try {
        const response = await diagnosisService.getSymptoms();
        const symptomsList = response?.data?.symptoms;
        if (isMounted && Array.isArray(symptomsList) && symptomsList.length > 0) {
          setAvailableSymptoms(symptomsList);
        }
      } catch (_e) {
        // Retain default popular list if offline
      }
    };
    loadSymptoms();
    return () => {
      isMounted = false;
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fuzzy/partial search: matches if any word in query starts with any word in the symptom name
  // This allows "heand" to match "headache", "sto" to match "stomach pain", etc.
  const fuzzyMatch = (symptomName, symptomId, query) => {
    const name = symptomName.toLowerCase();
    const id = symptomId.toLowerCase().replace(/_/g, ' ');
    // Exact substring match first (fast path)
    if (name.includes(query) || id.includes(query)) return true;
    // Word-start prefix match: each query word must be a prefix of some word in the symptom name
    const queryWords = query.split(/\s+/).filter(Boolean);
    const nameWords = (name + ' ' + id).split(/\s+/);
    return queryWords.every((qw) => nameWords.some((nw) => nw.startsWith(qw)));
  };

  const filteredSymptoms = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return availableSymptoms
      .filter((s) => !selectedSymptoms.includes(s.id))
      .filter((s) => fuzzyMatch(s.name, s.id, query))
      .slice(0, 8);
  }, [availableSymptoms, selectedSymptoms, searchQuery]);

  // Converts free-text into a symptom-id style key and adds it to selected symptoms
  const handleAddFreeText = (rawText) => {
    const text = rawText.trim();
    if (!text) return;
    // Convert to underscore-id: "leg break" → "leg_break"
    const id = text.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (id && !selectedSymptoms.includes(id)) {
      setSelectedSymptoms((current) => [...current, id]);
    }
    setSearchQuery('');
    setDropdownOpen(false);
    setError('');
  };

  const toggleSymptom = (symptomId) => {
    setError('');
    setSelectedSymptoms((current) =>
      current.includes(symptomId)
        ? current.filter((id) => id !== symptomId)
        : [...current, symptomId]
    );
  };

  const handleSelectFromSearch = (symptomId) => {
    if (!selectedSymptoms.includes(symptomId)) {
      setSelectedSymptoms((current) => [...current, symptomId]);
    }
    setSearchQuery('');
    setDropdownOpen(false);
  };

  const removeSymptom = (symptomId) => {
    setSelectedSymptoms((current) => current.filter((id) => id !== symptomId));
  };

  const clearAllSymptoms = () => {
    setSelectedSymptoms([]);
    setError('');
  };

  const formatSymptomName = (id) => {
    const found = availableSymptoms.find((s) => s.id === id);
    if (found) return found.name;
    // For free-text custom symptoms, format nicely: "leg_break" → "Leg Break"
    return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let symptomsToSubmit = [...selectedSymptoms];

    // If user typed into the input (e.g. "leg break") and didn't manually click the dropdown, auto-include it!
    if (searchQuery.trim()) {
      const cleanId = searchQuery.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      if (cleanId && !symptomsToSubmit.includes(cleanId)) {
        symptomsToSubmit.push(cleanId);
        setSelectedSymptoms(symptomsToSubmit);
      }
      setSearchQuery('');
      setDropdownOpen(false);
    }

    if (symptomsToSubmit.length === 0) {
      setError('Please type or select at least one symptom or health problem before submitting.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        symptoms: symptomsToSubmit,
        duration: form.duration,
        severity: form.severity,
        notes: form.notes
      };

      const response = await diagnosisService.predict(payload);
      if (response?.data) {
        setPrediction(response.data);
      } else {
        throw new Error(response?.message || 'Inference engine did not return diagnostic data.');
      }
    } catch (err) {
      setError(
        err.message ||
          'Diagnostic evaluation encountered an unexpected error. Please check your network and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const resetAssessment = () => {
    setPrediction(null);
    setSelectedSymptoms([]);
    setForm({ duration: '1–3 days', severity: 'moderate', notes: '' });
    setError('');
  };

  // --------------------------------------------------------------------------
  // RENDER: PREDICTION RESULT VIEW
  // --------------------------------------------------------------------------
  if (prediction) {
    const topPredictions = prediction.topPredictions || [];
    const primaryConfidence = prediction.confidence || 0;
    const severity = prediction.severity || 'moderate';
    // Use the low_confidence flag from the ML service (set when only 1 symptom is recognized)
    const isLowConfidence = prediction.low_confidence === true;
    // The predicted condition is always grounded by the ML/heuristic engine;
    // Gemini only supplies the candidate explanations rendered below.
    const isGeminiPrimary = prediction.predictionProvider === 'gemini';
    // What the displayed confidence number is: a validated model probability
    // vs a preliminary (non-probability) score — controls the text labels.
    const isModelProbability = prediction.confidenceBasis === 'model_probability';

    return (
      <main className="app-shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">+</span> carepath
          </div>
          <button className="signout" onClick={onBack} type="button">
            &larr; Back to overview
          </button>
        </header>

        <section className="dashboard-content" style={{ maxWidth: '820px', paddingBlock: '48px' }}>
          <div className="section-heading" style={{ marginBottom: '24px' }}>
            <div>
              <p className="eyebrow">DIAGNOSTIC TRIAGE ANALYSIS</p>
              <h1 style={{ font: '600 42px/1.1 Fraunces, serif', margin: 0 }}>
                Health Prediction Report
              </h1>
            </div>
            <button className="text-button" onClick={resetAssessment} type="button">
              + New check-in
            </button>
          </div>

          <div className="prediction-result-wrapper">
            {/* Low-confidence advisory banner (shown for single-symptom results) */}
            {isLowConfidence && prediction.low_confidence_message && (
              <div style={{
                padding: '12px 16px',
                background: '#fffbea',
                border: '1px solid #f0d060',
                borderRadius: '10px',
                color: '#7a6000',
                fontSize: '13px',
                marginBottom: '16px',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start'
              }}>
                <span style={{ fontSize: '16px' }}>⚠️</span>
                <span>{prediction.low_confidence_message}</span>
              </div>
            )}

            {/* Dual AI ensemble consensus card — shown only in ML-primary (dual) mode */}
            {prediction.geminiInsights && !isGeminiPrimary && (
              <section
                style={{
                  background: 'linear-gradient(135deg, #f7faf8 0%, #edf5f0 100%)',
                  border: '1px solid #c2decb',
                  borderRadius: '14px',
                  padding: '24px',
                  marginBottom: '20px',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>✨</span>
                    <strong style={{ fontSize: '14px', color: '#1d543e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {prediction.accuracyMetrics
                        ? `Dual AI Clinical Consensus (ML + ${prediction.geminiInsights?.poweredBy || 'Gemini'})`
                        : `ML Prediction + ${prediction.geminiInsights?.poweredBy || 'Gemini'} Clinical Explanation`}
                    </strong>
                  </div>
                  <span
                    style={{
                      background: '#1d543e',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '20px',
                      letterSpacing: '0.04em'
                    }}
                  >
                    {prediction.accuracyMetrics?.validationStatus || 'Symptom-Grounded Assessment'}
                  </span>
                </div>

                {/* Combined Consensus Banner */}
                {prediction.combinedPrediction && (
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid #d4e8da',
                      borderRadius: '10px',
                      padding: '16px',
                      marginBottom: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <small style={{ color: '#688273', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700 }}>
                        Synthesized Consensus Prediction
                      </small>
                      <h3 style={{ margin: '2px 0 0', fontSize: '20px', color: '#163f2f', fontFamily: 'Fraunces, serif' }}>
                        {prediction.combinedPrediction.predictedDisease}
                      </h3>
                      <small style={{ color: '#4d6959', fontSize: '12px' }}>
                        {prediction.combinedPrediction.method}
                      </small>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '24px', fontWeight: 700, color: '#1d543e' }}>
                        {prediction.combinedPrediction.confidence > 0 ? `${prediction.combinedPrediction.confidence}%` : '—'}
                      </span>
                      <small style={{ display: 'block', fontSize: '10px', color: '#688273', textTransform: 'uppercase' }}>
                        {isModelProbability ? 'Model Probability' : 'Preliminary Score'}
                      </small>
                    </div>
                  </div>
                )}

                {/* Dual Model Side-by-Side Comparison */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                  {/* ML Model Card */}
                  <div style={{ background: '#ffffff', border: '1px solid #e1ebe4', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <small style={{ fontWeight: 700, color: '#426854', textTransform: 'uppercase', fontSize: '11px' }}>
                        📊 ML Classifier
                      </small>
                      <span style={{ fontWeight: 700, color: '#1d543e', fontSize: '13px' }}>
                        {prediction.confidence > 0 ? `${prediction.confidence}%` : '—'}
                      </span>
                    </div>
                    <strong style={{ display: 'block', fontSize: '16px', color: '#163f2f', marginBottom: '4px' }}>
                      {prediction.predictedDisease}
                    </strong>
                    <small style={{ color: '#748b7d', fontSize: '11px' }}>
                      {prediction.isFallback
                        ? 'Heuristic Rule Fallback'
                        : isModelProbability
                        ? 'Trained Probabilistic Classifier'
                        : 'Awaiting More Symptoms'}
                    </small>
                  </div>

                  {/* Gemini model card (dual mode) */}
                  <div style={{ background: '#ffffff', border: '1px solid #e1ebe4', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <small style={{ fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', fontSize: '11px' }}>
                        ✨ {prediction.geminiInsights?.poweredBy || 'Gemini'}
                      </small>
                      <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '13px' }}>
                        {prediction.geminiInsights.geminiConfidence > 0 ? `${prediction.geminiInsights.geminiConfidence}%` : '—'}
                      </span>
                    </div>
                    <strong style={{ display: 'block', fontSize: '16px', color: '#1e293b', marginBottom: '4px' }}>
                      {prediction.geminiInsights.geminiPredictedDisease}
                    </strong>
                    <small style={{ color: '#64748b', fontSize: '11px' }}>
                      {prediction.accuracyMetrics?.modelAgreement
                        ? '✓ Agreed with ML model'
                        : prediction.geminiEnriched
                        ? 'Explains supporting & missing symptoms for ML candidates'
                        : 'Local rule-based explanation of ML candidates'}
                    </small>
                  </div>
                </div>

                {/* Accuracy Metrics Bar */}
                {prediction.accuracyMetrics && (
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.7)',
                      border: '1px solid #d4e8da',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-around',
                      flexWrap: 'wrap',
                      gap: '12px',
                      textAlign: 'center'
                    }}
                  >
                    <div>
                      <small style={{ display: 'block', fontSize: '10px', color: '#688273', textTransform: 'uppercase' }}>
                        Agreement Concordance
                      </small>
                      <strong style={{ color: '#1d543e', fontSize: '14px' }}>
                        {prediction.accuracyMetrics.agreementScore}%
                      </strong>
                    </div>
                    <div>
                      <small style={{ display: 'block', fontSize: '10px', color: '#688273', textTransform: 'uppercase' }}>
                        Core Symptom Coverage
                      </small>
                      <strong style={{ color: '#1d543e', fontSize: '14px' }}>
                        {prediction.accuracyMetrics.symptomCoverageRatio}%
                      </strong>
                    </div>
                    <div>
                      <small style={{ display: 'block', fontSize: '10px', color: '#688273', textTransform: 'uppercase' }}>
                        Consensus Level
                      </small>
                      <strong style={{ color: '#1d543e', fontSize: '14px', textTransform: 'capitalize' }}>
                        {prediction.accuracyMetrics.consensusLevel}
                      </strong>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Hero Condition Card */}
            <article className="prediction-hero">
              <div className="prediction-hero-header">
                <div className="condition-title-group">
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className={`severity-pill ${severity}`}>
                      {severity === 'severe'
                        ? '⚠️ Needs Medical Attention'
                        : severity === 'moderate'
                        ? '⚡ Moderate Impact'
                        : '✓ Mild Condition'}
                    </span>
                    {prediction.geminiInsights?.urgencyAssessment && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background:
                            prediction.geminiInsights.urgencyAssessment === 'high'
                              ? '#fee2e2'
                              : prediction.geminiInsights.urgencyAssessment === 'low'
                              ? '#dcfce7'
                              : '#fef3c7',
                          color:
                            prediction.geminiInsights.urgencyAssessment === 'high'
                              ? '#b91c1c'
                              : prediction.geminiInsights.urgencyAssessment === 'low'
                              ? '#15803d'
                              : '#b45309'
                        }}
                      >
                        Urgency: {prediction.geminiInsights.urgencyAssessment}
                      </span>
                    )}
                  </div>
                  <h2>{prediction.primary_condition || prediction.predictedDisease || 'Unknown Condition'}</h2>
                  <p className="eyebrow" style={{ color: '#8a9c92', margin: '4px 0 0' }}>
                    Primary Condition Identified
                  </p>
                </div>

                <div className="confidence-score-badge">
                  <span className="score">
                    {primaryConfidence > 0 ? `${primaryConfidence}%` : '—'}
                  </span>
                  <span className="score-label">
                    {isModelProbability ? 'Model Probability' : primaryConfidence > 0 ? 'Preliminary Score' : 'Preliminary Assessment'}
                  </span>
                </div>
              </div>

              <p className="condition-summary-text">
                {prediction.description ||
                  'The diagnostic model analyzed your symptom pattern and matched clinical markers associated with this condition.'}
              </p>

              {/* Analyzed Symptoms — API returns 'recognized_symptoms' array */}
              <div style={{ marginTop: '14px', borderTop: '1px solid var(--line)', paddingTop: '14px' }}>
                <span className="detail-label">Analyzed Symptoms:</span>
                <div className="selected-chips-grid" style={{ marginTop: '8px' }}>
                  {(prediction.recognized_symptoms || prediction.symptoms || []).map((s) => (
                    <span className="selected-chip" key={s}>
                      ✓ {formatSymptomName(s)}
                    </span>
                  ))}
                </div>
              </div>
            </article>

            {/* Gemini Clinical Explanation & Pattern Insights */}
            {prediction.geminiInsights && (
              <section
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--line)',
                  borderRadius: '12px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '18px' }}>🩺</span>
                    <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--ink)' }}>
                      Clinical AI Explanation & Pattern Analysis
                    </h3>
                  </div>
                  <p style={{ margin: '0 0 12px', color: 'var(--ink)', lineHeight: '1.6', fontSize: '14px' }}>
                    {prediction.geminiInsights.clinicalExplanation}
                  </p>
                </div>

                {prediction.geminiInsights.symptomPatternInsight && (
                  <div style={{ background: '#f8faf9', borderLeft: '4px solid #236b58', padding: '12px 16px', borderRadius: '4px' }}>
                    <strong style={{ display: 'block', fontSize: '12px', color: '#236b58', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Symptom Pattern Insight
                    </strong>
                    <span style={{ fontSize: '13px', color: '#2e493b', lineHeight: '1.5' }}>
                      {prediction.geminiInsights.symptomPatternInsight}
                    </span>
                  </div>
                )}

                {prediction.geminiInsights.differentialReasoning && (
                  <div style={{ background: '#f8faf9', borderLeft: '4px solid #4a7a8c', padding: '12px 16px', borderRadius: '4px' }}>
                    <strong style={{ display: 'block', fontSize: '12px', color: '#2b5768', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Differential Reasoning
                    </strong>
                    <span style={{ fontSize: '13px', color: '#2b4754', lineHeight: '1.5' }}>
                      {prediction.geminiInsights.differentialReasoning}
                    </span>
                  </div>
                )}

                {prediction.geminiInsights.confidenceInterpretation && (
                  <small style={{ color: 'var(--muted)', fontSize: '12px', fontStyle: 'italic' }}>
                    💡 {prediction.geminiInsights.confidenceInterpretation}
                  </small>
                )}
              </section>
            )}

            {/* Differential Diagnosis (Top-3 Predictions) */}
            {topPredictions.length > 0 && (
              <section className="differential-section">
                <h3>Differential Diagnostic Possibilities (Top 3 Candidates)</h3>
                <div className="diff-list">
                  {topPredictions.map((candidate, idx) => (
                    <div className="diff-row" key={candidate.disease || idx}>
                      <div className="diff-meta">
                        <strong>
                          {idx + 1}. {candidate.disease}
                        </strong>
                        <span>
                          {candidate.confidence}% {isModelProbability ? 'probability' : 'preliminary score'}
                        </span>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.min(100, Math.max(5, candidate.confidence))}%`,
                            background:
                              idx === 0
                                ? 'linear-gradient(90deg, #236b58, #3baa84)'
                                : '#8ea99d'
                          }}
                        />
                      </div>
                      {candidate.description && (
                        <small style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '2px' }}>
                          {candidate.description}
                        </small>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Gemini Guided Self-Care & Red Flags */}
            {prediction.geminiInsights && (prediction.geminiInsights.selfCareSteps?.length > 0 || prediction.geminiInsights.warningSignsToWatch?.length > 0) && (
              <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {prediction.geminiInsights.selfCareSteps?.length > 0 && (
                  <div style={{ background: '#f4f9f6', border: '1px solid #d1e7da', borderRadius: '12px', padding: '18px' }}>
                    <h4 style={{ margin: '0 0 10px', color: '#1e5942', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      🌱 Supportive Self-Care Steps
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#274b39', lineHeight: '1.6' }}>
                      {prediction.geminiInsights.selfCareSteps.map((step, idx) => (
                        <li key={idx} style={{ marginBottom: '6px' }}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {prediction.geminiInsights.warningSignsToWatch?.length > 0 && (
                  <div style={{ background: '#fdf6f5', border: '1px solid #f6cfc9', borderRadius: '12px', padding: '18px' }}>
                    <h4 style={{ margin: '0 0 10px', color: '#991b1b', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      ⚠️ Warning Signs to Watch
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#7f1d1d', lineHeight: '1.6' }}>
                      {prediction.geminiInsights.warningSignsToWatch.map((sign, idx) => (
                        <li key={idx} style={{ marginBottom: '6px' }}>{sign}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {/* Clinical Recommendation Box */}
            <aside className="recommendation-panel">
              <h4>Recommended Care Steps</h4>
              <p>
                {prediction.recommendation ||
                  'Monitor your condition carefully. Maintain proper hydration and rest, and consult a qualified healthcare professional if your discomfort continues.'}
              </p>
            </aside>

            {/* Non-dismissible Mandatory Medical Disclaimer */}
            <aside className="medical-disclaimer-box" role="alert">
              <span className="disclaimer-icon">ℹ️</span>
              <p className="disclaimer-text">
                <strong>Mandatory Medical Disclaimer: </strong>
                {prediction.disclaimer ||
                  'MedInsight provides preliminary, AI-assisted symptom triage guidance for informational purposes only. It is not a clinical medical diagnosis. In case of emergency or severe discomfort, please consult a certified doctor or contact your local emergency services immediately.'}
              </p>
            </aside>

            {/* Action Buttons */}
            <div className="prediction-button-row">
              <button
                className="primary"
                type="button"
                onClick={() => {
                  if (onBookAppointment) {
                    const diseaseName = prediction.primary_condition || prediction.predictedDisease || 'health condition';
                    const conf = prediction.confidence || 0;
                    onBookAppointment({
                      reason: `Follow-up for AI health triage: ${diseaseName} (${conf}% confidence)`
                    });
                  } else {
                    onBack();
                  }
                }}
              >
                Book Specialist Consultation &rarr;
              </button>

              <button className="secondary-action-btn" onClick={resetAssessment} type="button">
                Start Another Check-In
              </button>

              {isLowConfidence && (
                <button
                  className="secondary-action-btn"
                  onClick={() => {
                    setPrediction(null);
                    setError('');
                  }}
                  type="button"
                >
                  Add More Symptoms
                </button>
              )}

              <button className="secondary-action-btn" onClick={onBack} type="button">
                Return to Overview
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: LOADING STATE (INFERENCE ANALYSIS IN PROGRESS)
  // --------------------------------------------------------------------------
  if (loading) {
    return (
      <main className="app-shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">+</span> carepath
          </div>
        </header>

        <section className="form-page" style={{ maxWidth: '640px', paddingBlock: '80px' }}>
          <div className="analysis-loader-card">
            <div className="pulse-spinner" />
            <h2 style={{ font: '600 32px/1.2 Fraunces, serif', margin: '0 0 8px' }}>
              Evaluating Health Prediction...
            </h2>
            <p className="muted" style={{ maxWidth: '440px', margin: '0 auto' }}>
              Our probabilistic classifier is analyzing your symptom pattern and cross-referencing
              differential diagnosis models.
            </p>

            <div className="analysis-steps">
              <span>✓ Vectorizing multi-hot symptom indicators...</span>
              <span>✓ Running calibrated Bayesian classification...</span>
              <span>⚡ Generating clinical triage guidance...</span>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: SYMPTOM SELECTION FORM
  // --------------------------------------------------------------------------
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">+</span> carepath
        </div>
        <button className="signout" onClick={onBack} type="button">
          Cancel
        </button>
      </header>

      <section className="form-page" style={{ maxWidth: '720px' }}>
        <div className="form-intro">
          <p className="eyebrow">AI HEALTH PREDICTION & TRIAGE</p>
          <h1>Find your health prediction.</h1>
          <p className="muted">
            Search or select the symptoms you are currently experiencing to run our diagnostic inference
            engine. This provides supportive triage guidance, not a medical diagnosis.
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '14px 16px',
              background: '#fdf2f0',
              border: '1px solid #f6cfc9',
              borderRadius: '8px',
              color: '#a83c30',
              fontSize: '13px',
              marginBottom: '20px'
            }}
          >
            {error}
          </div>
        )}

        <form className="checkin-form" onSubmit={handleSubmit}>
          {/* SYMPTOM PICKER SECTION */}
          <fieldset>
            <legend style={{ fontSize: '18px', marginBottom: '4px' }}>
              What symptoms are you experiencing?
            </legend>
            <p className="field-hint">
              Search across 130+ symptoms or select common indicators below.
            </p>

            {/* Live Autocomplete Search Input */}
            <div className="symptom-search-container" ref={searchContainerRef}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div className="symptom-search-box" style={{ flex: 1, position: 'relative' }}>
                  <span className="symptom-search-icon">🔍</span>
                  <input
                    type="text"
                    className="symptom-search-input"
                    placeholder="Type any symptom, injury, or problem (e.g. leg break, headache, vomiting)..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setDropdownOpen(true);
                    }}
                    onFocus={() => setDropdownOpen(true)}
                    onKeyDown={(e) => {
                      // Press Enter to add the typed text as a symptom (even if no dropdown match)
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (searchQuery.trim()) {
                          handleAddFreeText(searchQuery);
                        }
                      }
                    }}
                    aria-label="Search symptoms"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="symptom-search-clear"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>
                {searchQuery.trim() && (
                  <button
                    type="button"
                    className="primary"
                    style={{
                      padding: '10px 16px',
                      whiteSpace: 'nowrap',
                      fontSize: '13px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      height: '44px'
                    }}
                    onClick={() => handleAddFreeText(searchQuery)}
                  >
                    + Add to Assessment
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {dropdownOpen && searchQuery.trim() && (
                <div className="symptom-dropdown" role="listbox">
                  {filteredSymptoms.length > 0 ? (
                    filteredSymptoms.map((symptom) => (
                      <button
                        type="button"
                        key={symptom.id}
                        className="symptom-dropdown-item"
                        onClick={() => handleSelectFromSearch(symptom.id)}
                        role="option"
                        aria-selected="false"
                      >
                        <span>{symptom.name}</span>
                        <small style={{ color: 'var(--muted)' }}>+ Add</small>
                      </button>
                    ))
                  ) : (
                    /* No match found — allow adding as free-text symptom */
                    <button
                      type="button"
                      className="symptom-dropdown-item"
                      onClick={() => handleAddFreeText(searchQuery)}
                      role="option"
                      aria-selected="false"
                      style={{ borderTop: 'none' }}
                    >
                      <span>
                        <span style={{ opacity: 0.5, marginRight: '6px' }}>🔎</span>
                        Add <strong>&ldquo;{searchQuery.trim()}&rdquo;</strong> as symptom
                      </span>
                      <small style={{ color: 'var(--muted)' }}>Press Enter or click</small>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Selected Symptoms Chips Bar */}
            {selectedSymptoms.length > 0 && (
              <div className="selected-tags-section">
                <div className="selected-tags-header">
                  <span>
                    Selected Symptoms (<strong>{selectedSymptoms.length}</strong>)
                  </span>
                  <button type="button" className="clear-all-link" onClick={clearAllSymptoms}>
                    Clear all
                  </button>
                </div>
                <div className="selected-chips-grid">
                  {selectedSymptoms.map((id) => (
                    <span className="selected-chip" key={id}>
                      ✓ {formatSymptomName(id)}
                      <button
                        type="button"
                        className="chip-remove-btn"
                        onClick={() => removeSymptom(id)}
                        aria-label={`Remove ${formatSymptomName(id)}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Quick-Pick Popular Symptoms */}
            <div className="quick-suggestions">
              <p className="quick-title">Common Symptoms (Quick Select):</p>
              <div className="quick-pills">
                {defaultPopularSymptoms.map((symptom) => {
                  const isSelected = selectedSymptoms.includes(symptom.id);
                  return (
                    <button
                      type="button"
                      key={symptom.id}
                      className={`quick-pill ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleSymptom(symptom.id)}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {symptom.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </fieldset>

          {/* DURATION */}
          <label>
            How long have you felt these symptoms?
            <select
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
            >
              <option>Less than 24 hours</option>
              <option>1–3 days</option>
              <option>4–7 days</option>
              <option>More than a week</option>
            </select>
          </label>

          {/* PERCEIVED SEVERITY */}
          <fieldset>
            <legend>How would you describe your overall discomfort?</legend>
            <div className="severity-options">
              {[
                { level: 'mild', label: 'Mild', sub: 'Noticeable but manageable' },
                { level: 'moderate', label: 'Moderate', sub: 'Impacting daily activities' },
                { level: 'severe', label: 'Severe', sub: 'Significant or distressing' }
              ].map(({ level, label, sub }) => (
                <label
                  className={`severity ${form.severity === level ? 'selected' : ''}`}
                  key={level}
                >
                  <input
                    type="radio"
                    name="severity"
                    value={level}
                    checked={form.severity === level}
                    onChange={(e) => setForm({ ...form, severity: e.target.value })}
                  />
                  <span>
                    <strong>{label}</strong>
                    <small>{sub}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* CLINICAL NOTES */}
          <label>
            Additional context or notes
            <span className="optional">Optional</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="E.g., Started after working outside, worse in the morning, accompanied by chills..."
            />
          </label>

          {/* SUBMIT BUTTON */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <button
              className="primary submit-button"
              type="submit"
              disabled={selectedSymptoms.length === 0 && !searchQuery.trim()}
            >
              Analyze & Find Health Prediction <span>&rarr;</span>
            </button>
            {selectedSymptoms.length === 0 && !searchQuery.trim() && (
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                Type your symptom or health problem above to analyze
              </span>
            )}
            {selectedSymptoms.length === 0 && searchQuery.trim() && (
              <span style={{ fontSize: '13px', color: '#1d543e', fontWeight: 600 }}>
                ✓ Ready to analyze: &ldquo;{searchQuery.trim()}&rdquo;
              </span>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
