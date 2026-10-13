import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { predictDiagnosis, resolveSymptomId } from '../services/mlService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const diseaseCatalog = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../data/diseases.json'), 'utf8')
);
const catalogDiseaseNames = new Set(Object.keys(diseaseCatalog));

const okResponse = (data) => ({ ok: true, status: 200, json: async () => data });
const errorResponse = (status, data) => ({ ok: false, status, json: async () => data });

/** Replaces global fetch for the duration of a test (restored automatically). */
const mockFetch = (t, impl) => {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  t.after(() => {
    globalThis.fetch = original;
  });
};

// ---------------------------------------------------------------------------
// Symptom resolution (synonyms + misspellings + unrelated input)
// ---------------------------------------------------------------------------

test('resolveSymptomId resolves exact, misspelled and unrelated inputs', () => {
  assert.equal(resolveSymptomId('headache'), 'headache');
  assert.equal(resolveSymptomId('hedache'), 'headache', 'typo within edit distance 1');
  assert.equal(resolveSymptomId('hig_fever'), 'high_fever', 'typo within edit distance 1');
  assert.equal(resolveSymptomId('best_pizza_place'), null, 'unrelated input must not resolve');
  assert.equal(resolveSymptomId('pain'), null, 'ambiguous bare word must not silently map to one condition');
});

// ---------------------------------------------------------------------------
// Clarification paths — no disease is ever invented
// ---------------------------------------------------------------------------

test('predictDiagnosis returns a clarification for whitespace-only input without calling the ML service', async (t) => {
  mockFetch(t, async () => {
    throw new Error('ML service must not be called');
  });

  const result = await predictDiagnosis(['   ', '']);
  assert.equal(result.needs_clarification, true);
  assert.equal(result.primary_condition, '');
  assert.equal(result.top_predictions.length, 0);
  assert.match(result.clarification_message, /at least one symptom/i);
});

test('predictDiagnosis returns a clarification (not a disease) for unrelated input without touching the model', async (t) => {
  let fetchCalled = false;
  mockFetch(t, async () => {
    fetchCalled = true;
    return errorResponse(422, {
      success: false,
      code: 'UNRECOGNIZED_SYMPTOMS',
      detail: 'not found in the diagnostic dataset',
      unrecognized_symptoms: ['best_pizza_place', 'stock_market'],
      suggestions: ['headache', 'chest_pain']
    });
  });

  const result = await predictDiagnosis(['best_pizza_place', 'stock_market']);
  assert.equal(fetchCalled, false, 'unrelated input is rejected locally before any model call');
  assert.equal(result.needs_clarification, true);
  assert.equal(result.primary_condition, '', 'no condition may be returned for unrelated input');
  assert.equal(result.top_predictions.length, 0);
  assert.deepEqual(result.unrecognized_symptoms, ['best_pizza_place', 'stock_market']);
  assert.ok(result.suggestions.length > 0, 'nearest catalog suggestions help the user rephrase');
  // Regression guard: the old hardcoded trio must never come back
  assert.ok(!catalogDiseaseNames.has('Unspecified Viral Syndrome'));
  assert.notEqual(result.primary_condition, 'Unspecified Viral Syndrome');
});

test('predictDiagnosis returns a clarification when the ML service is down and input is unrelated', async (t) => {
  mockFetch(t, async () => {
    throw new Error('connect ECONNREFUSED 127.0.0.1:8000');
  });

  const result = await predictDiagnosis(['best_pizza_place', 'stock_market']);
  assert.equal(result.needs_clarification, true);
  assert.equal(result.primary_condition, '');
  assert.equal(result.top_predictions.length, 0, 'heuristic fallback must not invent a default disease');
});

test('predictDiagnosis forwards a single recognized symptom to the ML service (no limited-assessment gate)', async (t) => {
  let requestBody = null;
  mockFetch(t, async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return okResponse({
      success: true,
      primary_condition: 'Migraine',
      confidence: 62.5,
      confidence_basis: 'model_probability',
      severity: 'moderate',
      description: 'model output',
      top_predictions: [{ disease: 'Migraine', confidence: 62.5, severity: 'moderate', description: '' }],
      recognized_symptoms: ['high_fever'],
      unrecognized_symptoms: [],
      disclaimer: 'd'
    });
  });

  const result = await predictDiagnosis(['fever']);
  assert.deepEqual(requestBody.symptoms, ['high_fever'], 'alias resolution still applies');
  assert.equal(result.primary_condition, 'Migraine');
  assert.equal(result.confidence_basis, 'model_probability');
  assert.equal(result.isFallback, false);
});

// ---------------------------------------------------------------------------
// Symptom-grounded predictions (ML pass-through and heuristic fallback)
// ---------------------------------------------------------------------------

test('predictDiagnosis resolves misspellings and forwards them to the ML service', async (t) => {
  let requestBody = null;
  mockFetch(t, async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return okResponse({
      success: true,
      primary_condition: 'Migraine',
      confidence: 91.2,
      confidence_basis: 'model_probability',
      validation: { n_test: 960, accuracy_top1_pct: 99.69, ece_10bin: 0.003 },
      severity: 'moderate',
      description: 'model output',
      top_predictions: [{ disease: 'Migraine', confidence: 91.2, severity: 'moderate', description: '' }],
      recognized_symptoms: ['headache', 'high_fever'],
      unrecognized_symptoms: [],
      disclaimer: 'd'
    });
  });

  const result = await predictDiagnosis(['hedache', 'hig fever']);
  assert.deepEqual(requestBody.symptoms, ['hedache', 'hig_fever'], 'raw normalized input is sent; both engines resolve it');
  assert.equal(result.primary_condition, 'Migraine');
  assert.equal(result.confidence_basis, 'model_probability');
  assert.equal(result.isFallback, false);
  assert.ok(result.validation && result.validation.accuracy_top1_pct, 'validation metrics travel with the probability');
});

test('predictDiagnosis falls back to symptom-overlap scoring (never a hardcoded disease) when the ML service is down', async (t) => {
  mockFetch(t, async () => {
    throw new Error('connect ECONNREFUSED 127.0.0.1:8000');
  });

  const result = await predictDiagnosis(['cough', 'high_fever']);
  assert.equal(result.isFallback, true);
  assert.equal(result.confidence_basis, 'heuristic_overlap');
  assert.ok(result.top_predictions.length > 0 && result.top_predictions.length <= 3);
  for (const candidate of result.top_predictions) {
    assert.ok(catalogDiseaseNames.has(candidate.disease), `${candidate.disease} must come from the disease catalog`);
    assert.ok(candidate.confidence >= 0 && candidate.confidence <= 100);
  }
  assert.deepEqual(result.recognized_symptoms, ['cough', 'high_fever']);
});

test('predictDiagnosis uses the urgent-care rule for reported orthopedic trauma without calling the ML service', async (t) => {
  mockFetch(t, async () => {
    throw new Error('ML service must not be called for the injury rule');
  });

  const result = await predictDiagnosis(['leg break']);
  assert.equal(result.primary_condition, 'Suspected Bone Fracture / Musculoskeletal Trauma');
  assert.equal(result.confidence_basis, 'rule_based');
  assert.equal(result.confidence, 0, 'rule-based results never claim a probability');
  assert.equal(result.severity, 'severe');
  assert.match(result.recommendation, /urgent care|emergency/i);
});
