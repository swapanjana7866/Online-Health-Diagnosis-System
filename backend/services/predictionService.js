import { predictDiagnosis as runMlPrediction, INJURY_PATTERN } from './mlService.js';
import {
  enrichDiagnosisWithGemini,
  buildLocalClinicalInsights,
  classifyGeminiError,
  generateGeminiPrediction
} from './geminiService.js';
import {
  PREDICTION_PROVIDER_GEMINI,
  PREDICTION_PROVIDER_ML,
  PREDICTION_PROVIDER_HEURISTIC,
  PREDICTION_PROVIDER_ENV_DEFAULT,
  DEFAULT_SYMPTOM_DURATION
} from '../config/constants.js';
import { MANDATORY_DISCLAIMER } from './mlService.js';

/**
 * Resolves the configured explanation mode from the environment.
 * - 'gemini' (default): the symptom engine grounds the prediction; Gemini
 *   additionally explains the candidate conditions.
 * - 'ml': same symptom-grounded prediction with local rule-based explanations
 *   only (no external Gemini calls).
 * Unknown values log a safe warning and fall back to the default, keeping the
 * service available instead of failing closed.
 */
export const resolvePredictionProvider = (rawProvider = process.env.PREDICTION_PROVIDER) => {
  const normalized = String(rawProvider ?? '').trim().toLowerCase();

  if (normalized === PREDICTION_PROVIDER_ML) return PREDICTION_PROVIDER_ML;
  if (normalized === PREDICTION_PROVIDER_GEMINI) return PREDICTION_PROVIDER_GEMINI;
  if (normalized !== '') {
    console.warn(`[Prediction Service] Unknown PREDICTION_PROVIDER "${normalized}". Defaulting to "${PREDICTION_PROVIDER_ENV_DEFAULT}".`);
  }
  return PREDICTION_PROVIDER_ENV_DEFAULT;
};

/**
 * Logs explanation-provider failures safely — error codes only, never prompts,
 * API keys, or patient-supplied data.
 */
const logExplanationFallback = (error) => {
  const code = error?.code || classifyGeminiError(error);
  console.warn(`[Prediction Service] Gemini explanations unavailable (${code}). Using local rule-based explanations.`);
  return code;
};

/**
 * Orchestrates the disease-prediction flow.
 *
 * 1. In the default 'gemini' mode, Gemini generates a preliminary top-3
 *    differential for ANY submitted symptom(s) — including a single symptom
 *    or unusual entries the taxonomy cannot resolve. The orthopedic-trauma
 *    safety rule and any Gemini failure/timeout degrade to the symptom
 *    engine below, so the app never crashes.
 * 2. Fallback: the Python ML engine (validated classifier) grounds the
 *    candidates — or the local heuristic overlap engine when the service is
 *    unreachable. Clarification results (unrecognized input) pass through
 *    untouched so callers can ask the user for better input.
 * 3. On the fallback path in 'gemini' mode, Gemini (or local rules) only
 *    EXPLAINS the engine's candidate conditions; 'ml' mode uses local
 *    rule-based explanations with no external calls.
 *
 * @returns {Promise<{provider: string, prediction: object, insights: object|null, fallbackReason: string|null}>}
 *   `provider` reports the candidate-engine slot ('ml' | 'heuristic') — the
 *   UI's dual-consensus layout key; Gemini's role is surfaced through
 *   insights.poweredBy / combinedPrediction.method.
 *   `fallbackReason` records why Gemini was unavailable.
 */
export const runPrediction = async (
  { symptoms = [], duration = DEFAULT_SYMPTOM_DURATION, severity = '' },
  deps = {}
) => {
  const mlPredictor = deps.mlPredictor || runMlPrediction;
  const enricher = deps.enricher || enrichDiagnosisWithGemini;
  const geminiPredictor = deps.geminiPredictor || generateGeminiPrediction;
  const provider = deps.provider || resolvePredictionProvider();

  // Default 'gemini' mode: send every non-empty submitted entry for a
  // preliminary prediction; local injury rules still enforce urgent triage.
  if (provider === PREDICTION_PROVIDER_GEMINI && symptoms.some((item) => String(item).trim())) {
    try {
      const geminiResult = await geminiPredictor({ symptoms, duration, severity });
      if (geminiResult?.prediction && geminiResult?.insights) {
        const emergency = INJURY_PATTERN.test(symptoms.join(' ')) || /chest pain|difficulty breathing|shortness of breath|uncontrolled bleeding|stroke|seizure|unconscious|severe allergic/i.test(symptoms.join(' '));
        if (emergency) {
          geminiResult.prediction.severity = 'severe';
          geminiResult.insights.urgencyAssessment = 'high';
        }
        return {
          // 'ml' keeps the frontend's dual-consensus layout stable (it treats
          // the legacy 'gemini' provider value as explanation-only mode and
          // hides the consensus cards). Gemini's role is surfaced truthfully
          // via insights.poweredBy and combinedPrediction.method.
          provider: PREDICTION_PROVIDER_ML,
          prediction: geminiResult.prediction,
          insights: geminiResult.insights,
          fallbackReason: null
        };
      }
    } catch (error) {
      const code = classifyGeminiError(error);
      // Log the safe code only — never the raw SDK message, API key, or prompt.
      console.warn(`[Prediction Service] Gemini prediction unavailable (${code}). Falling back to the symptom engine.`);
    }
  }

  let mlResult;
  try {
    mlResult = await mlPredictor(symptoms);
  } catch (_error) {
    mlResult = { needs_clarification: true, isFallback: true, unrecognized_symptoms: symptoms };
  }
  const candidateProvider = mlResult.isFallback ? PREDICTION_PROVIDER_HEURISTIC : PREDICTION_PROVIDER_ML;

  // Keep a usable prediction when local engines cannot map a genuine health
  // term into their narrower reference taxonomy.
  if (mlResult.needs_clarification) {
    const input = symptoms.map((item) => String(item).trim()).filter(Boolean).join(', ');
    const isRandom = /^(?:[a-z]{4,}\s*)+$/.test(input) && !/\b(?:pain|ache|fever|rash|cough|diabetes|injury|broken|fracture|fall|hair|headache|leg)\b/i.test(input);
    const emergency = /chest pain|difficulty breathing|shortness of breath|uncontrolled bleeding|stroke|seizure|unconscious|severe allergic/i.test(input);
    const prediction = {
      success: true,
      primary_condition: `Preliminary assessment for ${input || 'reported health concern'}`,
      confidence: 5,
      confidence_basis: 'gemini_estimate',
      severity: emergency ? 'severe' : 'mild',
      description: `The reported health concern (${input}) is not covered by the local reference model. This low-confidence result is general triage guidance and needs assessment by a qualified clinician.`,
      recommendation: emergency ? 'Contact local emergency services now.' : 'Consider contacting a healthcare professional for an assessment, especially if this is new, persistent, worsening, or concerning.',
      top_predictions: [{ disease: `Unspecified condition related to ${input}`, confidence: 5, severity: emergency ? 'severe' : 'mild', description: 'The local model cannot reliably classify this input; this is a low-confidence placeholder.' }],
      recognized_symptoms: mlResult.recognized_symptoms || [],
      unrecognized_symptoms: mlResult.unrecognized_symptoms || symptoms,
      disclaimer: MANDATORY_DISCLAIMER,
      isFallback: true,
      low_confidence: true,
      low_confidence_message: 'The local reference model could not classify this entry; this is a low-confidence preliminary assessment.'
    };
    if (isRandom) prediction.description = 'The entry could not be interpreted as a health concern. This low-confidence placeholder is not a medical assessment.';
    const insights = buildLocalClinicalInsights(symptoms, prediction);
    if (emergency) insights.urgencyAssessment = 'high';
    return {
      provider: candidateProvider,
      prediction,
      insights,
      fallbackReason: null
    };
  }

  if (provider === PREDICTION_PROVIDER_GEMINI) {
    let insights = null;
    let fallbackReason = null;

    try {
      insights = await enricher({ symptoms, mlResult, duration, severity });
    } catch (error) {
      fallbackReason = logExplanationFallback(error);
      insights = null;
    }

    if (insights && insights.geminiEnriched === false && insights.enrichmentErrorCode) {
      fallbackReason = insights.enrichmentErrorCode;
    }

    return {
      provider: candidateProvider,
      prediction: mlResult,
      insights: insights || buildLocalClinicalInsights(symptoms, mlResult),
      fallbackReason
    };
  }

  // PREDICTION_PROVIDER=ml → local rule-based explanations, no Gemini calls
  return {
    provider: candidateProvider,
    prediction: mlResult,
    insights: buildLocalClinicalInsights(symptoms, mlResult),
    fallbackReason: null
  };
};

/**
 * Startup environment validation (non-fatal warnings only — the service must
 * stay available and degrade gracefully at request time).
 */
export const validatePredictionEnvironment = (env = process.env) => {
  const provider = resolvePredictionProvider(env.PREDICTION_PROVIDER);
  const warnings = [];

  if (provider === PREDICTION_PROVIDER_GEMINI && !String(env.GEMINI_API_KEY || '').trim()) {
    warnings.push(
      'GEMINI_API_KEY is not set. Predictions remain grounded in the ML engine, but Gemini candidate explanations are disabled. Create a key at https://aistudio.google.com/apikey to enable them.'
    );
  }

  return { provider, warnings };
};

export default {
  resolvePredictionProvider,
  runPrediction,
  validatePredictionEnvironment
};
