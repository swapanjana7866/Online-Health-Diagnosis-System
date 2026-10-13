import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePredictionProvider, runPrediction, validatePredictionEnvironment } from '../services/predictionService.js';
import { GeminiProviderError } from '../services/geminiService.js';
import {
  GEMINI_ERROR_CODES,
  PREDICTION_PROVIDER_GEMINI,
  PREDICTION_PROVIDER_ML,
  PREDICTION_PROVIDER_HEURISTIC
} from '../config/constants.js';

// Symptom-grounded engine result (what the ML/heuristic engine returns)
const fakeMlPrediction = {
  success: true,
  primary_condition: 'Common Cold',
  confidence: 80,
  confidence_basis: 'model_probability',
  severity: 'mild',
  description: 'ML description',
  top_predictions: [
    { disease: 'Common Cold', confidence: 80, severity: 'mild', description: '' },
    { disease: 'Allergy', confidence: 12, severity: 'mild', description: '' },
    { disease: 'Bronchial Asthma', confidence: 8, severity: 'severe', description: '' }
  ],
  recognized_symptoms: ['cough', 'high_fever'],
  unrecognized_symptoms: [],
  disclaimer: 'Preliminary guidance only.',
  isFallback: false
};

const fakeClarification = {
  success: false,
  needs_clarification: true,
  clarification_message: 'We could not recognize those entries as symptoms.',
  primary_condition: '',
  confidence: 0,
  confidence_basis: 'none',
  top_predictions: [],
  recognized_symptoms: [],
  unrecognized_symptoms: ['best_pizza_place'],
  disclaimer: 'Preliminary guidance only.',
  isFallback: false
};

const fakeExplanationInsights = {
  clinicalExplanation: 'Reported cough and fever support Common Cold.',
  urgencyAssessment: 'low',
  accuracyMetrics: null,
  geminiEnriched: true,
  combinedPrediction: { predictedDisease: 'Common Cold', confidence: 80, method: 'SymptomDiseaseClassifier probability' }
};

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

test('resolvePredictionProvider defaults to gemini (explanation mode)', () => {
  assert.equal(resolvePredictionProvider(undefined), PREDICTION_PROVIDER_GEMINI);
  assert.equal(resolvePredictionProvider(''), PREDICTION_PROVIDER_GEMINI);
});

test('resolvePredictionProvider is case-insensitive and trims whitespace', () => {
  assert.equal(resolvePredictionProvider(' ML '), PREDICTION_PROVIDER_ML);
  assert.equal(resolvePredictionProvider('Gemini'), PREDICTION_PROVIDER_GEMINI);
});

test('resolvePredictionProvider falls back to gemini for unknown values', () => {
  assert.equal(resolvePredictionProvider('openai'), PREDICTION_PROVIDER_GEMINI);
});

// ---------------------------------------------------------------------------
// Orchestration: engine grounds the prediction, Gemini only explains
// ---------------------------------------------------------------------------

test('runPrediction grounds the condition in the ML engine and uses Gemini only to explain', async () => {
  let enricherInput = null;
  const result = await runPrediction(
    { symptoms: ['cough', 'high_fever'], duration: '1–3 days', severity: 'moderate' },
    {
      geminiPredictor: async () => null,
      mlPredictor: async () => fakeMlPrediction,
      enricher: async (input) => {
        enricherInput = input;
        return fakeExplanationInsights;
      }
    }
  );

  // The prediction object is the engine result — never a Gemini-chosen disease
  assert.equal(result.prediction, fakeMlPrediction);
  assert.equal(result.provider, PREDICTION_PROVIDER_ML);
  assert.equal(result.insights, fakeExplanationInsights);
  assert.equal(result.fallbackReason, null);
  // The enricher received the engine's result (to explain), not raw control
  assert.equal(enricherInput.mlResult, fakeMlPrediction);
});

test('runPrediction returns a low-confidence fallback for unrecognized input', async () => {
  let enricherCalled = false;
  const result = await runPrediction(
    { symptoms: ['best_pizza_place', 'stock_market'] },
    {
      geminiPredictor: async () => null,
      mlPredictor: async () => fakeClarification,
      enricher: async () => {
        enricherCalled = true;
        return fakeExplanationInsights;
      }
    }
  );

  assert.equal(result.prediction.needs_clarification, undefined);
  assert.match(result.prediction.primary_condition, /best_pizza_place/);
  assert.ok(result.insights);
  assert.equal(result.fallbackReason, null);
  assert.equal(enricherCalled, false);
});

test('health terms and random letters always produce a result when Gemini and ML cannot classify', async () => {
  for (const term of ['hair fall', 'diabetes', 'headache', 'leg break', 'asdfgh']) {
    const result = await runPrediction({ symptoms: [term] }, {
      geminiPredictor: async () => null,
      mlPredictor: async () => ({ ...fakeClarification, unrecognized_symptoms: [term] }),
      provider: PREDICTION_PROVIDER_ML
    });
    assert.ok(result.prediction.primary_condition, `${term} has a prediction`);
    assert.ok(result.prediction.top_predictions.length > 0, `${term} has a top prediction`);
    assert.ok(result.prediction.disclaimer);
  }
});

test('runPrediction degrades to local explanations when Gemini fails, recording the safe reason', async () => {
  const result = await runPrediction(
    { symptoms: ['cough', 'high_fever'] },
    {
      geminiPredictor: async () => null,
      mlPredictor: async () => fakeMlPrediction,
      enricher: async () => {
        throw new GeminiProviderError(GEMINI_ERROR_CODES.RATE_LIMITED, 'Gemini explanation failed (GEMINI_RATE_LIMITED)');
      }
    }
  );

  // Condition still comes from the engine even when explanations fail
  assert.equal(result.prediction.primary_condition, 'Common Cold');
  assert.equal(result.provider, PREDICTION_PROVIDER_ML);
  assert.equal(result.fallbackReason, GEMINI_ERROR_CODES.RATE_LIMITED);
  assert.ok(result.insights, 'local insights should be generated on the fallback path');
  assert.equal(result.insights.accuracyMetrics, null, 'no consensus metrics are invented on the fallback path');
  assert.equal(result.insights.geminiEnriched, false);
});

test('runPrediction picks up the safe reason when the enricher degrades gracefully', async () => {
  const result = await runPrediction(
    { symptoms: ['cough', 'high_fever'] },
    {
      geminiPredictor: async () => null,
      mlPredictor: async () => fakeMlPrediction,
      enricher: async () => ({
        ...fakeExplanationInsights,
        geminiEnriched: false,
        enrichmentErrorCode: GEMINI_ERROR_CODES.AUTH_FAILED
      })
    }
  );

  assert.equal(result.fallbackReason, GEMINI_ERROR_CODES.AUTH_FAILED);
  assert.equal(result.prediction.primary_condition, 'Common Cold');
});

test('runPrediction labels the candidate engine as heuristic when the ML service is also down', async () => {
  const result = await runPrediction(
    { symptoms: ['cough', 'high_fever'] },
    {
      geminiPredictor: async () => null,
      mlPredictor: async () => ({ ...fakeMlPrediction, isFallback: true, confidence_basis: 'heuristic_overlap' }),
      enricher: async () => fakeExplanationInsights
    }
  );

  assert.equal(result.provider, PREDICTION_PROVIDER_HEURISTIC);
  assert.equal(result.prediction.isFallback, true);
});

test('runPrediction in ml mode uses local explanations without calling the enricher', async () => {
  let enrichmentCalled = false;
  const result = await runPrediction(
    { symptoms: ['cough'] },
    {
      provider: PREDICTION_PROVIDER_ML,
      mlPredictor: async () => fakeMlPrediction,
      enricher: async () => {
        enrichmentCalled = true;
        return fakeExplanationInsights;
      }
    }
  );

  assert.equal(result.provider, PREDICTION_PROVIDER_ML);
  assert.equal(result.fallbackReason, null);
  assert.ok(result.insights, 'local rule-based insights are always produced');
  assert.equal(result.insights.accuracyMetrics, null);
  assert.equal(enrichmentCalled, false, 'ml mode never calls the external Gemini enricher');
});

// ---------------------------------------------------------------------------
// Gemini preliminary prediction (1+ symptoms, mapped to the UI fields)
// ---------------------------------------------------------------------------

test('runPrediction uses a Gemini preliminary prediction for any symptoms (1+) when available', async () => {
  const fakeGeminiPrediction = {
    success: true,
    primary_condition: 'Tension headache',
    confidence: 42,
    confidence_basis: 'gemini_estimate',
    severity: 'mild',
    top_predictions: [{ disease: 'Tension headache', condition: 'Tension headache', confidence: 42, severity: 'mild', description: 'r1' }],
    recognized_symptoms: ['headache'],
    unrecognized_symptoms: [],
    disclaimer: 'Preliminary guidance only.',
    isFallback: false
  };
  const fakeGeminiInsights = {
    clinicalExplanation: 'Single-symptom preliminary estimate.',
    urgencyAssessment: 'low',
    accuracyMetrics: null,
    geminiEnriched: true,
    combinedPrediction: { predictedDisease: 'Tension headache', confidence: 42, method: 'Gemini AI preliminary estimate' }
  };
  let mlCalled = false;
  let enricherCalled = false;
  const result = await runPrediction(
    { symptoms: ['headache'] },
    {
      geminiPredictor: async () => ({ prediction: fakeGeminiPrediction, insights: fakeGeminiInsights }),
      mlPredictor: async () => {
        mlCalled = true;
        return fakeMlPrediction;
      },
      enricher: async () => {
        enricherCalled = true;
        return fakeExplanationInsights;
      }
    }
  );

  assert.equal(result.prediction, fakeGeminiPrediction, 'a single symptom gets the Gemini prediction');
  assert.equal(result.insights, fakeGeminiInsights);
  assert.equal(mlCalled, false, 'the symptom engine is not consulted when Gemini succeeds');
  assert.equal(enricherCalled, false, 'no separate explanation pass is needed');
  assert.equal(result.provider, PREDICTION_PROVIDER_ML, 'provider keeps the UI dual-consensus layout');
  assert.equal(result.fallbackReason, null);
});

test('runPrediction falls back to the symptom engine when the Gemini prediction fails', async () => {
  const result = await runPrediction(
    { symptoms: ['headache'] },
    {
      geminiPredictor: async () => {
        throw new GeminiProviderError(GEMINI_ERROR_CODES.UNAVAILABLE, 'service unavailable');
      },
      mlPredictor: async () => fakeMlPrediction,
      enricher: async () => fakeExplanationInsights
    }
  );

  assert.equal(result.prediction.primary_condition, 'Common Cold', 'fallback still yields a real prediction');
  assert.equal(result.provider, PREDICTION_PROVIDER_ML);
  assert.equal(result.fallbackReason, null);
});

// ---------------------------------------------------------------------------
// Startup environment validation
// ---------------------------------------------------------------------------

test('validatePredictionEnvironment warns when the Gemini key is missing', () => {
  const result = validatePredictionEnvironment({ PREDICTION_PROVIDER: 'gemini' });
  assert.equal(result.provider, PREDICTION_PROVIDER_GEMINI);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /GEMINI_API_KEY/);
});

test('validatePredictionEnvironment reports no warnings when the key is set', () => {
  const result = validatePredictionEnvironment({ PREDICTION_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key' });
  assert.equal(result.warnings.length, 0);
});

test('validatePredictionEnvironment does not warn about a missing key in ml mode', () => {
  const result = validatePredictionEnvironment({ PREDICTION_PROVIDER: 'ml' });
  assert.equal(result.provider, PREDICTION_PROVIDER_ML);
  assert.equal(result.warnings.length, 0);
});
