import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CONFIDENCE_BASIS,
  SYMPTOMS_NOT_RECOGNIZED_CODE,
  SYMPTOMS_NOT_RECOGNIZED_MESSAGE,
  NO_VALID_SYMPTOMS_MESSAGE,
  SYMPTOMS_NO_MATCH_MESSAGE
} from '../config/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const ML_TIMEOUT_MS = 3000;

// Kept in sync with SYMPTOM_ALIASES in ml-service/app.py so the Node bridge,
// the heuristic fallback and the Python service resolve synonyms identically.
const SYMPTOM_ALIASES = {
  fever: 'high_fever',
  'high fever': 'high_fever',
  'low fever': 'mild_fever',
  'mild fever': 'mild_fever',
  flu: 'high_fever',
  temperature: 'high_fever',
  'body fever': 'high_fever',
  feverish: 'high_fever',
  cough: 'cough',
  coughing: 'cough',
  sneeze: 'continuous_sneezing',
  sneezing: 'continuous_sneezing',
  nausea: 'nausea',
  nauseated: 'nausea',
  vomit: 'vomiting',
  vomiting: 'vomiting',
  diarrhea: 'diarrhoea',
  diarrhoea: 'diarrhoea',
  loose_motion: 'diarrhoea',
  loose_stools: 'diarrhoea',
  dizzy: 'dizziness',
  tired: 'fatigue',
  tiredness: 'fatigue',
  exhausted: 'fatigue',
  sleepy: 'fatigue',
  weak: 'fatigue',
  weakness: 'fatigue',
  no_energy: 'fatigue',
  low_energy: 'fatigue',
  cold: 'chills',
  shivering: 'chills',
  rash: 'skin_rash',
  itchy: 'itching',
  itch: 'itching',
  breathless: 'breathlessness',
  sob: 'breathlessness',
  shortness_of_breath: 'breathlessness',
  difficulty_breathing: 'breathlessness',
  yellow: 'yellowish_skin',
  jaundice: 'yellowish_skin',
  runny: 'runny_nose',
  blocked_nose: 'runny_nose',
  stuffy_nose: 'runny_nose',
  nasal_congestion: 'runny_nose',
  constipated: 'constipation',
  sweat: 'sweating',
  backache: 'back_pain',
  belly: 'stomach_pain',
  tummy: 'stomach_pain',
  stomach_ache: 'stomach_pain',
  stomach_aches: 'stomach_pain',
  tummy_pain: 'stomach_pain',
  belly_ache: 'stomach_pain',
  bloating: 'abdominal_pain',
  palpitation: 'palpitations',
  anxious: 'anxiety',
  depressed: 'depression',
  sore_throat: 'throat_irritation',
  throat_pain: 'throat_irritation',
  head_ache: 'headache',
  headaches: 'headache',
  head_pain: 'headache',
  chest_tightness: 'chest_pain',
  chest_pressure: 'chest_pain',
  body_aches: 'muscle_pain',
  body_pain: 'muscle_pain',
  body_ache: 'muscle_pain',
  aching_body: 'muscle_pain',
  leg_pain: 'joint_pain',
  leg_break: 'joint_pain',
  leg_ache: 'joint_pain',
  broken_leg: 'joint_pain',
  knee_pain: 'joint_pain',
  ankle_pain: 'joint_pain',
  arm_pain: 'joint_pain',
  shoulder_pain: 'joint_pain',
  hip_pain: 'joint_pain',
  fracture: 'joint_pain',
  sprain: 'joint_pain',
  stomach_problem: 'stomach_pain',
  chest_problem: 'chest_pain',
  back_problem: 'back_pain',
  throat_problem: 'throat_irritation',
  eye_pain: 'pain_behind_the_eyes',
  ear_pain: 'ear_ache'
};

export const MANDATORY_DISCLAIMER =
  'MedInsight provides preliminary, AI-assisted symptom triage guidance for informational purposes only. ' +
  'It is not a clinical medical diagnosis. In case of emergency or severe discomfort, please consult a certified doctor ' +
  'or contact your local emergency services immediately.';

// Reported orthopedic trauma wording gets a dedicated urgent-care pathway
// instead of a disease label (evidence-based rule on reported symptoms).
// Shared with geminiService.js for explanation content.
export const INJURY_PATTERN = /(fractur|broken|break|dislocat|sprain|tibia|fibula|femur|bone)/i;

// In-memory cache for symptoms and disease definitions
let cachedSymptoms = [];
let cachedDiseases = {};
let cachedCatalogIds = null;

// Load local reference datasets for caching and heuristic fallback
try {
  const symptomsPath = path.resolve(__dirname, '../data/symptoms.json');
  const diseasesPath = path.resolve(__dirname, '../data/diseases.json');

  if (fs.existsSync(symptomsPath)) {
    cachedSymptoms = JSON.parse(fs.readFileSync(symptomsPath, 'utf8'));
  }
  if (fs.existsSync(diseasesPath)) {
    cachedDiseases = JSON.parse(fs.readFileSync(diseasesPath, 'utf8'));
  }
} catch (err) {
  console.warn('[ML Service Bridge] Warning: Could not pre-load fallback dataset files:', err.message);
}

const normalizeSymptom = (raw) => {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return SYMPTOM_ALIASES[cleaned] || cleaned;
};

/**
 * Returns master list of symptoms (cached in Node memory)
 */
export const getSymptomsList = async () => {
  if (cachedSymptoms.length > 0) {
    return cachedSymptoms;
  }

  // Fallback to querying ML service
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);
    const response = await fetch(`${ML_SERVICE_URL}/symptoms`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      cachedSymptoms = await response.json();
      return cachedSymptoms;
    }
  } catch (_e) {
    // Return empty array if both fail
  }
  return [];
};

// ---------------------------------------------------------------------------
// Typo-tolerant catalog resolution (mirrors match_feature in ml-service/app.py)
// ---------------------------------------------------------------------------

const levenshtein = (a, b) => {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
};

const getCatalogIds = () => {
  if (cachedCatalogIds) return cachedCatalogIds;
  const ids = new Set();
  for (const symptom of cachedSymptoms) {
    if (symptom && typeof symptom.id === 'string') ids.add(symptom.id);
  }
  // Guarantee every symptom referenced by a disease profile is resolvable
  for (const meta of Object.values(cachedDiseases)) {
    for (const core of meta?.coreSymptoms || []) ids.add(String(core).toLowerCase().trim());
  }
  cachedCatalogIds = [...ids];
  return cachedCatalogIds;
};

/**
 * Resolve one normalized input to a single catalog symptom id.
 * Tier 1 exact → Tier 2 unique whole word → Tier 3 unique readable containment
 * → Tier 4 edit-distance fuzzy. Ambiguous or unrelated input returns null so
 * callers can ask the user to clarify instead of guessing.
 */
export const resolveSymptomId = (symptom) => {
  if (!symptom) return null;
  const ids = getCatalogIds();

  if (ids.includes(symptom)) return symptom;

  const words = symptom.split('_').filter(Boolean);
  if (words.length > 0) {
    const wordHits = new Set();
    for (const id of ids) {
      if (id.split('_').some((w) => words.includes(w))) wordHits.add(id);
    }
    if (wordHits.size === 1) return [...wordHits][0];
  }

  const readable = symptom.replace(/_/g, ' ');
  const tier3 = ids.filter((id) => {
    const idReadable = id.replace(/_/g, ' ');
    return readable.includes(idReadable) || idReadable.includes(readable);
  });
  if (tier3.length === 1) return tier3[0];

  if (symptom.length < 4) return null;
  const maxDistance = symptom.length >= 6 ? 2 : 1;
  let best = null;
  let bestDistance = maxDistance + 1;
  for (const id of ids) {
    const distance = levenshtein(symptom, id);
    if (distance < bestDistance) {
      best = id;
      bestDistance = distance;
    }
  }
  return bestDistance <= maxDistance ? best : null;
};

const resolveSymptomSet = (normalizedSymptoms) => {
  const recognized = [];
  const unrecognized = [];
  for (const symptom of normalizedSymptoms) {
    const match = resolveSymptomId(symptom);
    if (match) {
      if (!recognized.includes(match)) recognized.push(match);
    } else if (!unrecognized.includes(symptom)) {
      unrecognized.push(symptom);
    }
  }
  return { recognized, unrecognized };
};

/** Nearest catalog symptom ids for unrecognized input (clarification help). */
const nearestCatalogIds = (inputs, limit = 3) => {
  const ids = getCatalogIds();
  const suggestions = [];
  for (const input of inputs) {
    const scored = ids
      .map((id) => ({ id, distance: levenshtein(input, id) }))
      .sort((a, b) => a.distance - b.distance);
    for (const { id } of scored.slice(0, limit)) {
      if (!suggestions.includes(id)) suggestions.push(id);
    }
  }
  return suggestions.slice(0, 5);
};

/**
 * Clarification result: returned instead of a disease whenever the input
 * cannot be grounded in the symptom catalog. Never carries a condition.
 */
const buildClarificationResult = ({ message, recognized = [], unrecognized = [], isFallback = false, suggestions = [] }) => ({
  success: false,
  needs_clarification: true,
  code: SYMPTOMS_NOT_RECOGNIZED_CODE,
  clarification_message: message,
  primary_condition: '',
  confidence: 0,
  confidence_basis: CONFIDENCE_BASIS.NONE,
  severity: 'moderate',
  description: '',
  top_predictions: [],
  recognized_symptoms: recognized,
  unrecognized_symptoms: unrecognized,
  suggestions,
  disclaimer: MANDATORY_DISCLAIMER,
  isFallback
});

/**
 * Heuristic fallback triage engine used when the ML service times out or is
 * unreachable. Scores candidate conditions ONLY by symptom overlap between the
 * recognized symptoms and each disease profile's core symptoms — there is no
 * hardcoded default condition, so unrelated input yields a clarification
 * request instead of the same disease every time.
 *
 * The returned "confidence" is a symptom-coverage score labelled
 * `heuristic_overlap` — a preliminary assessment, never a probability.
 */
const runFallbackTriage = (recognized, unrecognized) => {
  const symptomSet = new Set(recognized);
  const diseaseScores = [];

  for (const [disease, meta] of Object.entries(cachedDiseases)) {
    const coreSymptoms = (meta.coreSymptoms || []).map((s) => s.toLowerCase().trim());
    const matchCount = coreSymptoms.filter((s) => symptomSet.has(s)).length;

    if (matchCount > 0) {
      const coreLength = Math.max(coreSymptoms.length, 1);
      diseaseScores.push({
        disease,
        matchCount,
        matchRatio: matchCount / coreLength,
        severity: meta.severity || 'moderate',
        description: meta.description || 'A medical condition characterized by the recorded symptoms.'
      });
    }
  }

  if (diseaseScores.length === 0) {
    // Symptom strings resolved, but no disease profile matches: ask for
    // different/additional symptoms rather than inventing a condition.
    return buildClarificationResult({
      message: SYMPTOMS_NO_MATCH_MESSAGE,
      recognized,
      unrecognized,
      isFallback: true
    });
  }

  // Sort by match count descending, then by coverage descending
  diseaseScores.sort((a, b) => b.matchCount - a.matchCount || b.matchRatio - a.matchRatio);

  const topPredictions = diseaseScores.slice(0, 3).map((item) => ({
    disease: item.disease,
    confidence: Math.round(item.matchRatio * 1000) / 10,
    severity: item.severity,
    description: item.description
  }));

  const primary = topPredictions[0];
  const isLowConfidence = primary.confidence < 30;

  const result = {
    success: true,
    primary_condition: primary.disease,
    confidence: primary.confidence,
    confidence_basis: CONFIDENCE_BASIS.HEURISTIC_OVERLAP,
    severity: primary.severity,
    description: primary.description,
    top_predictions: topPredictions,
    recognized_symptoms: recognized,
    unrecognized_symptoms: unrecognized,
    disclaimer: MANDATORY_DISCLAIMER,
    isFallback: true
  };

  if (isLowConfidence) {
    result.low_confidence = true;
    result.low_confidence_message =
      'Only a small portion of this condition’s core symptoms was reported — ' +
      'this is a preliminary estimate. Add more symptoms for a more useful assessment.';
  }

  return result;
};

/**
 * Predicts disease from the user-provided symptoms array.
 *
 * Flow: normalize (synonyms) → resolve against the symptom catalog (exact /
 * unique word / containment / typo-fuzzy) →
 *   - 0 recognized  → clarification request (no condition returned)
 *   - ≥1 recognized → Python ML service model prediction over the resolved
 *     symptom subset (single symptoms included); a 422 from the healthy
 *     service also maps to a clarification request (never a disease).
 * Only when the ML service itself is unreachable does the local heuristic
 * overlap engine run — and it too returns a clarification when nothing matches.
 *
 * @param {string[]} rawSymptoms
 * @returns {Promise<object>} prediction or clarification result
 */
export const predictDiagnosis = async (rawSymptoms) => {
  const cleanedInput = (Array.isArray(rawSymptoms) ? rawSymptoms : [])
    .filter((s) => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim());
  const normalized = cleanedInput.map(normalizeSymptom);

  if (normalized.length === 0) {
    return buildClarificationResult({ message: NO_VALID_SYMPTOMS_MESSAGE });
  }

  // Reported orthopedic trauma → dedicated urgent-care pathway (rule applied
  // to the user's own reported complaint, never a disease-name echo).
  const injuryText = cleanedInput.join(' ').toLowerCase();
  if (INJURY_PATTERN.test(injuryText)) {
    const { recognized, unrecognized } = resolveSymptomSet(normalized);
    return {
      success: true,
      primary_condition: 'Suspected Bone Fracture / Musculoskeletal Trauma',
      confidence: 0,
      confidence_basis: CONFIDENCE_BASIS.RULE_BASED,
      severity: 'severe',
      description:
        `Your reported complaint (${cleanedInput.join(', ')}) indicates possible acute physical trauma. ` +
        'This requires clinical evaluation and imaging (X-ray) to assess structural alignment. ' +
        'This is a preliminary injury triage assessment, not a confirmed diagnosis.',
      recommendation:
        'Seek urgent care or emergency evaluation immediately for imaging. Do not bear weight on or ' +
        'move the injured area, and keep it immobilized while arranging care.',
      top_predictions: [],
      recognized_symptoms: recognized,
      unrecognized_symptoms: unrecognized,
      disclaimer: MANDATORY_DISCLAIMER,
      isFallback: false
    };
  }

  const { recognized, unrecognized } = resolveSymptomSet(normalized);

  if (recognized.length === 0) {
    return buildClarificationResult({
      message: SYMPTOMS_NOT_RECOGNIZED_MESSAGE,
      unrecognized,
      suggestions: nearestCatalogIds(unrecognized)
    });
  }

  // Every recognized symptom count proceeds to the engine — including a
  // single symptom (the "limited assessment" rule was removed; only
  // unrecognized/empty input asks the user to clarify above).
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);

    const response = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symptoms: normalized }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return {
        ...data,
        confidence_basis: data.confidence_basis || CONFIDENCE_BASIS.MODEL_PROBABILITY,
        isFallback: false
      };
    }

    if (response.status === 422) {
      // The ML service is healthy but could not recognize the input:
      // ask the user to clarify instead of inventing a condition.
      let body = null;
      try {
        body = await response.json();
      } catch (_parseError) {
        body = null;
      }
      return buildClarificationResult({
        message: body?.detail || SYMPTOMS_NOT_RECOGNIZED_MESSAGE,
        recognized: body?.recognized_symptoms || [],
        unrecognized: body?.unrecognized_symptoms || unrecognized,
        suggestions: Array.isArray(body?.suggestions) ? body.suggestions : []
      });
    }

    console.warn(`[ML Service Bridge] ML service returned status ${response.status}. Engaging fallback.`);
  } catch (err) {
    console.warn(`[ML Service Bridge] ML service call failed (${err.name === 'AbortError' ? 'Timeout 3000ms' : err.message}). Engaging fallback.`);
  }

  // Gracefully fallback to the internal heuristic overlap engine
  return runFallbackTriage(recognized, unrecognized);
};

export default {
  getSymptomsList,
  predictDiagnosis,
  resolveSymptomId,
  MANDATORY_DISCLAIMER
};
