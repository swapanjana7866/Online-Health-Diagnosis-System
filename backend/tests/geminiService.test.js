import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GeminiProviderError,
  classifyGeminiError,
  resolveGeminiConfig,
  isGeminiConfigured,
  parseGeminiExplanationResponse,
  parseGeminiPredictionResponse,
  buildConfidenceInterpretation,
  buildConfidenceMethod
} from '../services/geminiService.js';
import { GEMINI_DEFAULT_MODEL, GEMINI_ERROR_CODES, GEMINI_MAX_ARRAY_ITEMS, CONFIDENCE_BASIS } from '../config/constants.js';

// ---------------------------------------------------------------------------
// Preliminary prediction parsing (safe JSON, clamped probabilities)
// ---------------------------------------------------------------------------

test('parseGeminiPredictionResponse accepts a valid payload and clamps values', () => {
  const payload = JSON.stringify({
    valid: true,
    top_predictions: [
      { condition: 'Common Cold', probability: 42.55, reason: 'Cough and fever fit.' },
      { condition: 'Flu', probability: -5, reason: 'Fever fits.' },
      { condition: 'Allergy', probability: 250, reason: 'Less likely.' },
      { condition: 'Extra', probability: 5, reason: 'Ignored beyond top 3.' }
    ],
    urgency: 'Low',
    impact: 'moderate',
    explanation: 'Overall picture looks mild.',
    recommended_actions: ['Rest', 'Hydrate']
  });

  const parsed = parseGeminiPredictionResponse(payload);
  assert.equal(parsed.top_predictions.length, 3, 'capped at the top 3 candidates');
  assert.equal(parsed.top_predictions[0].probability, 42.6);
  assert.equal(parsed.top_predictions[1].probability, 0, 'probabilities clamp to 0-100');
  assert.equal(parsed.top_predictions[2].probability, 100);
  assert.equal(parsed.urgency, 'low', 'levels are normalized to lowercase');
  assert.equal(parsed.impact, 'moderate');
  assert.equal(parsed.explanation, 'Overall picture looks mild.');
  assert.deepEqual(parsed.recommended_actions, ['Rest', 'Hydrate']);
});

test('parseGeminiPredictionResponse strips markdown code fences', () => {
  const fenced = '```json\n{"valid":true,"top_predictions":[{"condition":"Migraine","probability":35,"reason":"Headache."}],"urgency":"Low","impact":"Low","explanation":"exp","recommended_actions":["Rest"]}\n```';
  const parsed = parseGeminiPredictionResponse(fenced);
  assert.equal(parsed.top_predictions[0].condition, 'Migraine');
});

test('parseGeminiPredictionResponse rejects malformed or empty payloads', () => {
  assert.throws(() => parseGeminiPredictionResponse(''), GeminiProviderError);
  assert.throws(() => parseGeminiPredictionResponse('{not json'), GeminiProviderError);
  assert.throws(
    () => parseGeminiPredictionResponse(JSON.stringify({ urgency: 'Low', explanation: 'x' })),
    GeminiProviderError
  );
  assert.throws(
    () => parseGeminiPredictionResponse(JSON.stringify({ top_predictions: [], explanation: 'x' })),
    GeminiProviderError
  );
});

test('buildConfidenceInterpretation labels Gemini estimates as preliminary', () => {
  const text = buildConfidenceInterpretation({ confidence: 40, confidence_basis: CONFIDENCE_BASIS.GEMINI_ESTIMATE });
  assert.match(text, /Gemini's preliminary AI estimate/);
  assert.match(text, /not a validated clinical probability/);
  const method = buildConfidenceMethod({ confidence_basis: CONFIDENCE_BASIS.GEMINI_ESTIMATE });
  assert.match(method, /Gemini AI preliminary estimate/);
});

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

test('resolveGeminiConfig defaults to the current stable Gemini Flash model', () => {
  const config = resolveGeminiConfig({ GEMINI_API_KEY: 'test-key' });
  assert.equal(config.model, GEMINI_DEFAULT_MODEL);
  assert.equal(config.isConfigured, true);
  assert.equal(config.apiKey, 'test-key');
});

test('resolveGeminiConfig honors GEMINI_MODEL override and trims whitespace', () => {
  const config = resolveGeminiConfig({ GEMINI_API_KEY: '  test-key  ', GEMINI_MODEL: ' gemini-custom-model ' });
  assert.equal(config.model, 'gemini-custom-model');
  assert.equal(config.isConfigured, true);
  assert.equal(config.apiKey, 'test-key');
});

test('resolveGeminiConfig reports unconfigured when the key is missing or blank', () => {
  assert.equal(resolveGeminiConfig({}).isConfigured, false);
  assert.equal(resolveGeminiConfig({ GEMINI_API_KEY: '   ' }).isConfigured, false);
  assert.equal(isGeminiConfigured({}), false);
});

// ---------------------------------------------------------------------------
// Error classification (safe, actionable failure codes)
// ---------------------------------------------------------------------------

test('classifyGeminiError maps rate limits to GEMINI_RATE_LIMITED', () => {
  assert.equal(classifyGeminiError({ status: 429, message: 'Too many requests' }), GEMINI_ERROR_CODES.RATE_LIMITED);
  assert.equal(classifyGeminiError({ message: 'RESOURCE_EXHAUSTED: quota exceeded' }), GEMINI_ERROR_CODES.RATE_LIMITED);
});

test('classifyGeminiError maps auth failures to GEMINI_AUTH_FAILED', () => {
  assert.equal(classifyGeminiError({ status: 401, message: 'Unauthorized' }), GEMINI_ERROR_CODES.AUTH_FAILED);
  assert.equal(classifyGeminiError({ status: 403, message: 'Forbidden' }), GEMINI_ERROR_CODES.AUTH_FAILED);
  assert.equal(classifyGeminiError({ message: 'API key not valid' }), GEMINI_ERROR_CODES.AUTH_FAILED);
});

test('classifyGeminiError maps invalid requests and timeouts', () => {
  assert.equal(classifyGeminiError({ status: 400, message: 'Bad request' }), GEMINI_ERROR_CODES.INVALID_REQUEST);
  assert.equal(classifyGeminiError({ name: 'AbortError', message: 'aborted' }), GEMINI_ERROR_CODES.TIMEOUT);
  assert.equal(classifyGeminiError({ message: 'request timed out' }), GEMINI_ERROR_CODES.TIMEOUT);
});

test('classifyGeminiError defaults outages to GEMINI_UNAVAILABLE and preserves typed codes', () => {
  assert.equal(classifyGeminiError({ status: 503, message: 'Service unavailable' }), GEMINI_ERROR_CODES.UNAVAILABLE);
  assert.equal(classifyGeminiError({ message: 'something odd' }), GEMINI_ERROR_CODES.UNAVAILABLE);
  const typed = new GeminiProviderError(GEMINI_ERROR_CODES.INVALID_RESPONSE, 'bad payload');
  assert.equal(classifyGeminiError(typed), GEMINI_ERROR_CODES.INVALID_RESPONSE);
});

// ---------------------------------------------------------------------------
// Explanation parsing & validation (Gemini explains — it never scores)
// ---------------------------------------------------------------------------

test('parseGeminiExplanationResponse accepts a valid payload', () => {
  const payload = JSON.stringify({
    clinicalExplanation: 'Reported cough, fever and chills support the Common Cold candidate.',
    symptomPatternInsight: 'Upper respiratory symptom pattern.',
    differentialReasoning: 'Allergy is less likely without sneezing or watery eyes.',
    urgency: 'low',
    urgencyRationale: 'Symptoms are mild and self-limiting.',
    selfCareSteps: ['Rest', 'Hydrate'],
    warningSigns: ['High fever'],
    whenToSeeDoctor: 'If symptoms worsen.',
    clarificationQuestion: '',
    candidateAnalyses: [
      { condition: 'Common Cold', supportingSymptoms: ['Cough', 'High Fever'], missingSymptoms: ['Runny Nose'], summary: 'Consistent.' }
    ]
  });

  const parsed = parseGeminiExplanationResponse(payload);
  assert.equal(parsed.urgency, 'low');
  assert.equal(parsed.candidateAnalyses.length, 1);
  assert.equal(parsed.candidateAnalyses[0].condition, 'Common Cold');
  assert.deepEqual(parsed.candidateAnalyses[0].supportingSymptoms, ['Cough', 'High Fever']);
});

test('parseGeminiExplanationResponse never extracts a confidence value from Gemini output', () => {
  const payload = JSON.stringify({
    clinicalExplanation: 'Explanation text.',
    urgency: 'moderate',
    whenToSeeDoctor: 'See a doctor.',
    // Model tried to sneak scores in — they must not survive parsing
    estimatedConfidence: 91,
    confidence: 91,
    geminiConfidence: 91
  });

  const parsed = parseGeminiExplanationResponse(payload);
  assert.equal(Object.hasOwn(parsed, 'estimatedConfidence'), false);
  assert.equal(Object.hasOwn(parsed, 'confidence'), false);
  assert.equal(Object.hasOwn(parsed, 'geminiConfidence'), false);
});

test('parseGeminiExplanationResponse strips markdown code fences', () => {
  const fenced = '```json\n{"clinicalExplanation": "text", "urgency": "low", "whenToSeeDoctor": "see a doctor"}\n```';
  const parsed = parseGeminiExplanationResponse(fenced);
  assert.equal(parsed.clinicalExplanation, 'text');
});

test('parseGeminiExplanationResponse coerces invalid urgency onto the safe allow-list', () => {
  const payload = JSON.stringify({ clinicalExplanation: 'text', urgency: 'CATASTROPHIC' });
  assert.equal(parseGeminiExplanationResponse(payload).urgency, 'moderate');
});

test('parseGeminiExplanationResponse sanitizes arrays and candidate analyses', () => {
  const payload = JSON.stringify({
    clinicalExplanation: 'text',
    selfCareSteps: ['a', 42, null, 'b', 'c', 'd', 'e', 'f', 'g'],
    candidateAnalyses: [
      { condition: 'Common Cold', supportingSymptoms: ['Cough'], missingSymptoms: [], summary: 'ok' },
      'not-an-object',
      { condition: '' }
    ]
  });
  const parsed = parseGeminiExplanationResponse(payload);
  assert.equal(parsed.selfCareSteps.length, GEMINI_MAX_ARRAY_ITEMS);
  assert.deepEqual(parsed.selfCareSteps, ['a', 'b', 'c', 'd', 'e']);
  assert.equal(parsed.candidateAnalyses.length, 1);
  assert.equal(parsed.candidateAnalyses[0].condition, 'Common Cold');
});

test('parseGeminiExplanationResponse rejects malformed, empty, or incomplete payloads', () => {
  assert.throws(
    () => parseGeminiExplanationResponse('I am feeling unwell, doctor'),
    (error) => error instanceof GeminiProviderError && error.code === GEMINI_ERROR_CODES.INVALID_RESPONSE
  );
  assert.throws(
    () => parseGeminiExplanationResponse(''),
    (error) => error.code === GEMINI_ERROR_CODES.INVALID_RESPONSE
  );
  assert.throws(
    () => parseGeminiExplanationResponse('["array"]'),
    (error) => error.code === GEMINI_ERROR_CODES.INVALID_RESPONSE
  );
  assert.throws(
    () => parseGeminiExplanationResponse(JSON.stringify({ urgency: 'high', whenToSeeDoctor: 'now' })),
    (error) => error.code === GEMINI_ERROR_CODES.INVALID_RESPONSE
  );
});

// ---------------------------------------------------------------------------
// Confidence labelling (probability only from the validated model)
// ---------------------------------------------------------------------------

test('buildConfidenceInterpretation reports measured validation for model probabilities', () => {
  const text = buildConfidenceInterpretation({
    confidence: 84.5,
    confidence_basis: CONFIDENCE_BASIS.MODEL_PROBABILITY,
    validation: { n_test: 960, accuracy_top1_pct: 99.69, ece_10bin: 0.003 }
  });
  assert.match(text, /84\.5%/);
  assert.match(text, /99\.69/);
  assert.match(text, /n=960/);
  assert.match(text, /not a clinical probability/);
});

test('buildConfidenceInterpretation labels heuristic scores as preliminary, not probabilities', () => {
  const text = buildConfidenceInterpretation({ confidence: 40, confidence_basis: CONFIDENCE_BASIS.HEURISTIC_OVERLAP });
  assert.match(text, /overlap/i);
  assert.match(text, /not a probability/);
});

test('buildConfidenceMethod never claims a probability without the validated model basis', () => {
  assert.match(buildConfidenceMethod({ confidence_basis: CONFIDENCE_BASIS.HEURISTIC_OVERLAP }), /not a calibrated probability/);
  assert.match(buildConfidenceMethod({ confidence_basis: CONFIDENCE_BASIS.NONE }), /insufficient evidence/);
  assert.doesNotMatch(buildConfidenceMethod({ confidence_basis: CONFIDENCE_BASIS.RULE_BASED }), /^SymptomDiseaseClassifier/);
  assert.match(
    buildConfidenceMethod({ confidence_basis: CONFIDENCE_BASIS.MODEL_PROBABILITY, validation: { accuracy_top1_pct: 99.69 } }),
    /99\.69/
  );
});
