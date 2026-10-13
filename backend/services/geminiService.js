import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { INJURY_PATTERN, MANDATORY_DISCLAIMER, resolveSymptomId } from './mlService.js';
import {
  GEMINI_DEFAULT_MODEL,
  GEMINI_ENRICHMENT_TIMEOUT_MS,
  GEMINI_PREDICTION_TIMEOUT_MS,
  GEMINI_MAX_OUTPUT_TOKENS,
  GEMINI_TEMPERATURE,
  GEMINI_CHAT_MAX_OUTPUT_TOKENS,
  GEMINI_CHAT_TEMPERATURE,
  GEMINI_CHAT_TIMEOUT_MS,
  GEMINI_CHAT_HISTORY_TURNS,
  GEMINI_MAX_TOP_PREDICTIONS,
  GEMINI_MAX_ARRAY_ITEMS,
  GEMINI_MAX_CONDITION_LENGTH,
  GEMINI_MAX_TEXT_LENGTH,
  GEMINI_MAX_SHORT_TEXT_LENGTH,
  GEMINI_MAX_ARRAY_ITEM_LENGTH,
  GEMINI_ERROR_CODES,
  URGENCY_LEVELS,
  CONFIDENCE_BASIS,
  DEFAULT_SYMPTOM_DURATION
} from '../config/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Gemini plays two roles, both server-side only (the API key never reaches
 * the frontend):
 * 1. PRELIMINARY PREDICTION (default 'gemini' provider mode): Gemini returns
 *    a top-3 differential with preliminary probability estimates for ANY
 *    submitted symptom(s) — including a single symptom or unusual entries the
 *    taxonomy cannot resolve. Every estimate is labelled with the
 *    'gemini_estimate' confidence basis (never a validated probability), and
 *    any Gemini failure falls back to the symptom-grounded engine.
 * 2. EXPLANATION: on the fallback path Gemini explains the symptom engine's
 *    candidate conditions (supporting / missing symptoms, self-care, warning
 *    signs); it never re-chooses the engine's condition there.
 */

/**
 * Typed Gemini provider failure. `code` is always one of GEMINI_ERROR_CODES and
 * is safe to log or surface — it never contains API keys or patient data.
 */
export class GeminiProviderError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GeminiProviderError';
    this.code = code;
  }
}

/**
 * Maps Gemini SDK / HTTP failures onto safe, actionable error codes.
 */
export const classifyGeminiError = (error) => {
  if (error instanceof GeminiProviderError) return error.code;

  const status = Number(error?.status ?? error?.statusCode ?? 0);
  const message = String(error?.message || '').toLowerCase();

  if (error?.name === 'AbortError' || message.includes('timeout') || message.includes('timed out')) {
    return GEMINI_ERROR_CODES.TIMEOUT;
  }
  if (status === 429 || message.includes('429') || message.includes('resource_exhausted') || message.includes('rate limit')) {
    return GEMINI_ERROR_CODES.RATE_LIMITED;
  }
  if (status === 401 || status === 403 || message.includes('api key') || message.includes('unauthenticated') || message.includes('permission_denied')) {
    return GEMINI_ERROR_CODES.AUTH_FAILED;
  }
  if (status === 400 || status === 422 || message.includes('invalid_argument')) {
    return GEMINI_ERROR_CODES.INVALID_REQUEST;
  }
  return GEMINI_ERROR_CODES.UNAVAILABLE;
};

/**
 * Resolves Gemini configuration from server-side environment variables only.
 * The API key must never be exposed to the frontend (no VITE_ prefix).
 */
export const resolveGeminiConfig = (env = process.env) => {
  const apiKey = String(env.GEMINI_API_KEY || '').trim();
  const model = String(env.GEMINI_MODEL || '').trim() || GEMINI_DEFAULT_MODEL;
  return { apiKey, model, isConfigured: apiKey.length > 0 };
};

export const isGeminiConfigured = (env = process.env) => resolveGeminiConfig(env).isConfigured;

const getGeminiClient = () => {
  const { apiKey, isConfigured } = resolveGeminiConfig();
  if (!isConfigured) return null;
  return new GoogleGenAI({ apiKey });
};

const extractResponseText = (response) => {
  if (!response) return '';
  if (typeof response.text === 'function') return response.text() || '';
  if (typeof response.text === 'string') return response.text;
  return '';
};

/**
 * Builds the shared Gemini request config. Thinking is disabled so the Flash
 * model returns structured triage JSON quickly and within the request timeout.
 */
const buildGeminiConfig = ({
  temperature = GEMINI_TEMPERATURE,
  maxOutputTokens = GEMINI_MAX_OUTPUT_TOKENS,
  systemInstruction = null,
  responseMimeType = null,
  responseSchema = null
} = {}) => {
  const config = {
    temperature,
    maxOutputTokens,
    thinkingConfig: { thinkingBudget: 0 }
  };
  if (systemInstruction) config.systemInstruction = systemInstruction;
  if (responseMimeType) config.responseMimeType = responseMimeType;
  if (responseSchema) config.responseSchema = responseSchema;
  return config;
};

// Load project disease & symptom taxonomies once at startup
let cachedDiseases = {};
let cachedSymptoms = [];

try {
  const diseasesPath = path.resolve(__dirname, '../data/diseases.json');
  const symptomsPath = path.resolve(__dirname, '../data/symptoms.json');
  if (fs.existsSync(diseasesPath)) {
    cachedDiseases = JSON.parse(fs.readFileSync(diseasesPath, 'utf8'));
  }
  if (fs.existsSync(symptomsPath)) {
    cachedSymptoms = JSON.parse(fs.readFileSync(symptomsPath, 'utf8'));
  }
} catch (err) {
  console.warn('[Gemini Service] Warning: Failed to load taxonomy data:', err.message);
}

export const resolveSymptomName = (symptomId) => {
  const found = cachedSymptoms.find((s) => s.id === symptomId);
  if (found) return found.name;
  return symptomId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export const getDiseaseMetaFromCatalog = (diseaseName) => {
  const normalized = diseaseName?.toLowerCase().trim();
  for (const [name, meta] of Object.entries(cachedDiseases)) {
    if (name.toLowerCase() === normalized) {
      return { name, ...meta };
    }
  }
  return null;
};

export const computeSymptomCoverage = (symptoms = [], diseaseName = '') => {
  const meta = getDiseaseMetaFromCatalog(diseaseName);
  if (!meta || !Array.isArray(meta.coreSymptoms) || meta.coreSymptoms.length === 0) {
    return { matchingCount: 0, totalCore: 0, coverageRatio: 0 };
  }
  const symptomSet = new Set(symptoms.map((s) => s.toLowerCase().trim()));
  const matches = meta.coreSymptoms.filter((cs) => symptomSet.has(cs.toLowerCase().trim()));
  const coverageRatio = Math.round((matches.length / meta.coreSymptoms.length) * 100);
  return {
    matchingCount: matches.length,
    totalCore: meta.coreSymptoms.length,
    coverageRatio
  };
};

// ---------------------------------------------------------------------------
// Output validation & sanitization — model output is never trusted.
// Note: there is deliberately NO confidence sanitizer; Gemini output must not
// carry probability values at all (see CONFIDENCE_BASIS usage instead).
// ---------------------------------------------------------------------------
const sanitizeText = (value, maxLength) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';

const sanitizeStringArray = (value, maxItems = GEMINI_MAX_ARRAY_ITEMS, maxItemLength = GEMINI_MAX_ARRAY_ITEM_LENGTH) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string' && item.trim().length > 0)
    .slice(0, maxItems)
    .map((item) => item.trim().replace(/\s+/g, ' ').slice(0, maxItemLength));
};

const sanitizeUrgency = (value) => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return URGENCY_LEVELS.includes(normalized) ? normalized : 'moderate';
};

// ---------------------------------------------------------------------------
// Confidence labelling — every displayed number is tied to what it actually is
// ---------------------------------------------------------------------------

/**
 * Human-readable interpretation of the confidence attached to an ML/heuristic
 * result, including measured validation metrics when the model provided them.
 */
export const buildConfidenceInterpretation = (mlResult = {}) => {
  const confidence = Number(mlResult.confidence ?? 0);
  const validation = mlResult.validation || null;
  const basis = mlResult.confidence_basis || CONFIDENCE_BASIS.NONE;

  if (basis === CONFIDENCE_BASIS.MODEL_PROBABILITY) {
    const heldOut = validation
      ? ` Held-out validation (n=${validation.n_test}): accuracy ${validation.accuracy_top1_pct}%, expected calibration error ${validation.ece_10bin} on the project's reference dataset.`
      : '';
    return `${confidence}% is the model's top-1 probability from the validated SymptomDiseaseClassifier.${heldOut} It is a model estimate, not a clinical probability or a confirmed diagnosis.`;
  }

  if (basis === CONFIDENCE_BASIS.HEURISTIC_OVERLAP) {
    return `${confidence}% is the share of this condition's core symptoms that you reported (heuristic symptom-overlap score) — a preliminary assessment, not a probability or a confirmed diagnosis.`;
  }

  if (basis === CONFIDENCE_BASIS.RULE_BASED) {
    return 'This result comes from a symptom-based rule, so no probability is available — treat it as a preliminary assessment only.';
  }

  if (basis === CONFIDENCE_BASIS.GEMINI_ESTIMATE) {
    return `${confidence}% is Gemini's preliminary AI estimate for the reported symptoms — a triage indication only, not a validated clinical probability or a confirmed diagnosis.`;
  }

  return 'No probability is available yet — more symptoms are needed before a reliable estimate can be made.';
};

/** Short method label shown next to the combined prediction. */
export const buildConfidenceMethod = (mlResult = {}) => {
  const basis = mlResult.confidence_basis || CONFIDENCE_BASIS.NONE;
  const validation = mlResult.validation || null;

  if (basis === CONFIDENCE_BASIS.MODEL_PROBABILITY) {
    return validation
      ? `SymptomDiseaseClassifier probability (held-out accuracy ${validation.accuracy_top1_pct}%)`
      : 'SymptomDiseaseClassifier probability';
  }
  if (basis === CONFIDENCE_BASIS.HEURISTIC_OVERLAP) {
    return 'Heuristic symptom-overlap score (preliminary — not a calibrated probability)';
  }
  if (basis === CONFIDENCE_BASIS.RULE_BASED) {
    return 'Rule-based preliminary assessment (no probability)';
  }
  if (basis === CONFIDENCE_BASIS.GEMINI_ESTIMATE) {
    return 'Gemini AI preliminary estimate (top-3 differential — not a validated probability)';
  }
  return 'Preliminary symptom assessment (insufficient evidence for a probability)';
};

/**
 * Parses and validates the JSON explanation payload returned by Gemini.
 * The schema contains NO confidence/probability fields by design — Gemini
 * explains the engine's candidate conditions, it never scores or chooses them.
 * Throws a typed GEMINI_INVALID_RESPONSE so callers can fall back to local
 * explanations instead of trusting junk.
 */
export const parseGeminiExplanationResponse = (rawText) => {
  if (typeof rawText !== 'string' || rawText.trim().length === 0) {
    throw new GeminiProviderError(GEMINI_ERROR_CODES.INVALID_RESPONSE, 'Gemini returned an empty response');
  }

  const cleanedText = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleanedText);
  } catch (_error) {
    throw new GeminiProviderError(GEMINI_ERROR_CODES.INVALID_RESPONSE, 'Gemini returned a malformed JSON payload');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new GeminiProviderError(GEMINI_ERROR_CODES.INVALID_RESPONSE, 'Gemini returned an unexpected payload shape');
  }

  const clinicalExplanation = sanitizeText(parsed.clinicalExplanation, GEMINI_MAX_TEXT_LENGTH);
  if (!clinicalExplanation) {
    throw new GeminiProviderError(GEMINI_ERROR_CODES.INVALID_RESPONSE, 'Gemini response did not include a clinical explanation');
  }

  const candidateAnalyses = (Array.isArray(parsed.candidateAnalyses) ? parsed.candidateAnalyses : [])
    .filter((item) => item && typeof item === 'object' && typeof item.condition === 'string' && item.condition.trim().length > 0)
    .slice(0, GEMINI_MAX_TOP_PREDICTIONS)
    .map((item) => ({
      condition: sanitizeText(item.condition, GEMINI_MAX_CONDITION_LENGTH),
      supportingSymptoms: sanitizeStringArray(item.supportingSymptoms),
      missingSymptoms: sanitizeStringArray(item.missingSymptoms),
      summary: sanitizeText(item.summary, GEMINI_MAX_SHORT_TEXT_LENGTH)
    }));

  return {
    clinicalExplanation,
    symptomPatternInsight: sanitizeText(parsed.symptomPatternInsight, GEMINI_MAX_SHORT_TEXT_LENGTH),
    differentialReasoning: sanitizeText(parsed.differentialReasoning, GEMINI_MAX_SHORT_TEXT_LENGTH),
    urgency: sanitizeUrgency(parsed.urgency),
    urgencyRationale: sanitizeText(parsed.urgencyRationale, GEMINI_MAX_SHORT_TEXT_LENGTH),
    selfCareSteps: sanitizeStringArray(parsed.selfCareSteps),
    warningSigns: sanitizeStringArray(parsed.warningSigns),
    whenToSeeDoctor: sanitizeText(parsed.whenToSeeDoctor, GEMINI_MAX_SHORT_TEXT_LENGTH),
    clarificationQuestion: sanitizeText(parsed.clarificationQuestion, GEMINI_MAX_SHORT_TEXT_LENGTH),
    candidateAnalyses
  };
};

/**
 * Structured-output schema constraining the shape of the model response at the
 * API level (in addition to our own server-side validation). No confidence
 * field exists in this schema on purpose.
 */
const buildExplanationResponseSchema = () => ({
  type: 'OBJECT',
  properties: {
    clinicalExplanation: {
      type: 'STRING',
      description: '2-3 plain-language sentences explaining the candidate conditions against the reported symptoms'
    },
    symptomPatternInsight: {
      type: 'STRING',
      description: '1 sentence on the reported symptom pattern'
    },
    differentialReasoning: {
      type: 'STRING',
      description: '1-2 sentences comparing the candidate conditions'
    },
    urgency: {
      type: 'STRING',
      enum: URGENCY_LEVELS,
      description: 'How urgently professional medical care is needed'
    },
    urgencyRationale: {
      type: 'STRING',
      description: '1 sentence explaining the urgency level'
    },
    selfCareSteps: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Up to 5 supportive self-care steps'
    },
    warningSigns: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Up to 5 red-flag warning signs that require medical attention'
    },
    whenToSeeDoctor: {
      type: 'STRING',
      description: 'Clear guidance on when to seek professional or emergency care'
    },
    clarificationQuestion: {
      type: 'STRING',
      description: 'Optional question to ask the user when symptom evidence is weak; empty string otherwise'
    },
    candidateAnalyses: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          condition: { type: 'STRING', description: 'One of the provided candidate conditions — never a new one' },
          supportingSymptoms: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Reported symptoms supporting this candidate' },
          missingSymptoms: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Core symptoms of this candidate that were NOT reported' },
          summary: { type: 'STRING', description: '1-2 sentence explanation for this candidate' }
        },
        required: ['condition', 'supportingSymptoms', 'missingSymptoms', 'summary']
      },
      description: 'Per-candidate supporting / missing symptom analysis'
    }
  },
  required: ['clinicalExplanation', 'urgency', 'whenToSeeDoctor', 'candidateAnalyses']
});

const buildExplanationSystemInstruction = () =>
  `You are MedInsight's clinical explanation assistant. You explain candidate conditions produced by a symptom-based model; you never choose or invent a diagnosis yourself. ` +
  `You never confirm a clinical diagnosis and never claim certainty, and you never output confidence or probability numbers. ` +
  `If the reported symptoms suggest a medical emergency (for example severe chest pain, difficulty breathing, uncontrolled bleeding, ` +
  `sudden neurological confusion, or signs of anaphylaxis), set urgency to "high" and advise contacting local emergency services immediately. ` +
  `Keep language plain, compassionate, and actionable. Respond with JSON only, matching the requested schema.`
;

// Privacy: only symptom names, duration, and the engine's candidate conditions
// (with their core symptoms) are ever sent to the Gemini API — no names,
// contact details, demographics, notes, or diagnosis history.

/**
 * Builds the candidate-explanation prompt. Each candidate already comes from
 * the symptom engine; supporting/missing core symptoms are computed server-side
 * so Gemini's job is strictly to explain, not to reason from scratch.
 */
const buildExplanationPrompt = ({ reportedNames, unrecognizedNames, duration, severity, candidates }) => {
  const candidateLines = candidates.map((candidate, idx) => {
    const lines = [
      `${idx + 1}. ${candidate.condition} — supporting symptoms reported: ${candidate.supporting.length > 0 ? candidate.supporting.join(', ') : 'none of its core symptoms were reported'}.`
    ];
    if (candidate.missing.length > 0) {
      lines.push(`   Core symptoms NOT reported: ${candidate.missing.join(', ')}.`);
    }
    return lines.join('\n');
  });

  return `
CANDIDATE CONDITION EXPLANATION — MedInsight
Reported symptoms: ${reportedNames.join(', ')}
${unrecognizedNames.length > 0 ? `Entries that were not recognized as symptoms: ${unrecognizedNames.join(', ')}\n` : ''}Duration: ${duration || DEFAULT_SYMPTOM_DURATION}
Self-reported discomfort level: ${severity || 'unspecified'}

Candidate conditions from the symptom engine (already computed — do NOT add, replace, or re-rank them):
${candidateLines.join('\n')}

TASK:
Explain each candidate condition against the reported symptoms:
- clinicalExplanation: 2-3 sentences explaining the overall picture — which reported symptoms support the leading candidate and which of its core symptoms are missing.
- For EVERY candidate above, fill candidateAnalyses with its supportingSymptoms, missingSymptoms, and a 1-2 sentence summary. Use only the symptoms listed above.
- symptomPatternInsight: 1 sentence on the reported symptom pattern.
- differentialReasoning: 1-2 sentences comparing the candidates and what would distinguish them.
- urgency / urgencyRationale / selfCareSteps / warningSigns / whenToSeeDoctor: preliminary triage guidance (emergency-services advice when urgency is high).
- clarificationQuestion: if the reported symptoms are too weak to distinguish the candidates, ask one short question to collect the most useful missing symptom; otherwise use an empty string.

RULES:
- Explain ONLY the listed candidates. Never introduce a new diagnosis or condition name.
- Never output a confidence, probability, or percentage value.
- Frame everything as preliminary — never a confirmed diagnosis.

Return JSON only matching this shape:
{
  "clinicalExplanation": "2-3 sentences",
  "symptomPatternInsight": "1 sentence",
  "differentialReasoning": "1-2 sentences",
  "urgency": "low | moderate | high",
  "urgencyRationale": "1 sentence",
  "selfCareSteps": ["step", "step"],
  "warningSigns": ["red flag", "red flag"],
  "whenToSeeDoctor": "clear guidance, including emergency services advice when urgency is high",
  "clarificationQuestion": "optional short question, or empty string",
  "candidateAnalyses": [
    { "condition": "candidate name", "supportingSymptoms": ["symptom"], "missingSymptoms": ["symptom"], "summary": "1-2 sentences" }
  ]
}
`.trim();
};

/**
 * Builds the geminiInsights sub-document for an explanation of the engine's
 * candidates. The primary condition and confidence are ALWAYS taken from the
 * ML/heuristic result — Gemini contributes explanation text only.
 */
const buildExplanationInsights = ({ parsed, mlResult, model }) => ({
  clinicalExplanation: parsed.clinicalExplanation,
  symptomPatternInsight: parsed.symptomPatternInsight,
  differentialReasoning: parsed.differentialReasoning,
  urgencyAssessment: parsed.urgency,
  urgencyRationale: parsed.urgencyRationale || `Care urgency explained as ${parsed.urgency.toUpperCase()} for the reported symptom pattern.`,
  selfCareSteps: parsed.selfCareSteps,
  warningSignsToWatch: parsed.warningSigns,
  whenToSeeDoctor: parsed.whenToSeeDoctor,
  clarificationQuestion: parsed.clarificationQuestion,
  confidenceInterpretation: buildConfidenceInterpretation(mlResult),
  historicalContext: 'Preliminary AI-assisted explanation of symptom-model candidates.',
  geminiPredictedDisease: mlResult.primary_condition,
  geminiConfidence: mlResult.confidence,
  geminiTopPredictions: mlResult.top_predictions || [],
  candidateAnalyses: parsed.candidateAnalyses,
  accuracyMetrics: null,
  combinedPrediction: {
    predictedDisease: mlResult.primary_condition,
    confidence: mlResult.confidence,
    method: buildConfidenceMethod(mlResult)
  },
  poweredBy: model,
  geminiEnriched: true,
  generatedAt: new Date().toISOString()
});

/**
 * Explains the symptom engine's candidate conditions via Gemini.
 *
 * Contract:
 * - Never predicts or rewrites the condition (mlResult.primary_condition wins).
 * - Never returns a Gemini-generated confidence number.
 * - Limited / clarification / injury results (no candidates) and any Gemini
 *   failure degrade to local rule-based explanations — never to a Gemini guess.
 *
 * @returns {Promise<object>} geminiInsights-compatible sub-document
 */
export const enrichDiagnosisWithGemini = async ({
  symptoms = [],
  mlResult = {},
  duration = DEFAULT_SYMPTOM_DURATION
}) => {
  const localFallback = { ...buildLocalClinicalInsights(symptoms, mlResult), geminiEnriched: false };

  const candidates = Array.isArray(mlResult.top_predictions) ? mlResult.top_predictions : [];
  if (mlResult.needs_clarification || candidates.length === 0) {
    // Nothing to explain (insufficient symptoms / clarification / injury rule)
    return localFallback;
  }

  const { model, isConfigured } = resolveGeminiConfig();
  const client = getGeminiClient();
  if (!client || !isConfigured) {
    return { ...localFallback, enrichmentErrorCode: GEMINI_ERROR_CODES.NOT_CONFIGURED };
  }

  const reportedIds = (mlResult.recognized_symptoms || symptoms).map((s) => String(s).toLowerCase().trim());
  const reportedSet = new Set(reportedIds);
  const reportedNames = reportedIds.map(resolveSymptomName);
  const unrecognizedNames = (mlResult.unrecognized_symptoms || []).map(resolveSymptomName);

  const candidateDetails = candidates.slice(0, GEMINI_MAX_TOP_PREDICTIONS).map((candidate) => {
    const meta = getDiseaseMetaFromCatalog(candidate.disease);
    const core = Array.isArray(meta?.coreSymptoms) ? meta.coreSymptoms : [];
    const supporting = core.filter((id) => reportedSet.has(String(id).toLowerCase().trim())).map(resolveSymptomName);
    const missing = core.filter((id) => !reportedSet.has(String(id).toLowerCase().trim())).map(resolveSymptomName);
    return { condition: candidate.disease, supporting, missing };
  });

  const prompt = buildExplanationPrompt({
    reportedNames,
    unrecognizedNames,
    duration,
    severity: mlResult.severity || '',
    candidates: candidateDetails
  });

  let timeoutId;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new GeminiProviderError(GEMINI_ERROR_CODES.TIMEOUT, 'Gemini request timed out')),
        GEMINI_ENRICHMENT_TIMEOUT_MS
      );
    });

    const callPromise = client.models.generateContent({
      model,
      contents: prompt,
      config: buildGeminiConfig({
        systemInstruction: buildExplanationSystemInstruction(),
        temperature: GEMINI_TEMPERATURE,
        maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
        responseSchema: buildExplanationResponseSchema()
      })
    });

    let response = await Promise.race([callPromise, timeoutPromise]);
    const parsed = parseGeminiExplanationResponse(extractResponseText(response));
    return buildExplanationInsights({ parsed, mlResult, model });
  } catch (error) {
    const code = classifyGeminiError(error);
    // Log the safe code only — never the raw SDK message, API key, or prompt.
    console.warn(`[Gemini Service] Candidate explanation failed (${code}). Using local explanations.`);
    return { ...localFallback, enrichmentErrorCode: code };
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Local (rule-based) clinical explanations used when Gemini is unavailable or
 * when there are no model candidates to explain (limited / clarification /
 * injury results). Purely derived from the project's own disease/symptom
 * taxonomy — no remote call, no invented conditions, no invented confidences:
 * the condition and confidence always come from mlResult.
 */
export const buildLocalClinicalInsights = (symptoms = [], mlResult = {}) => {
  const symptomNames = symptoms.map(resolveSymptomName);
  const lowerSymptoms = symptoms.map((s) => String(s).toLowerCase()).join(' ');

  const primaryDisease = mlResult.primary_condition || 'Preliminary Symptom Evaluation';
  const severity = mlResult.severity || 'moderate';
  let urgency = severity === 'severe' ? 'high' : severity === 'mild' ? 'low' : 'moderate';

  let selfCareSteps = [
    'Ensure adequate hydration and restful recovery.',
    'Monitor symptom trajectory closely over the next 24 to 48 hours.',
    'Avoid strenuous exertion and maintain a comfortable environment.'
  ];
  let warningSigns = [
    'Sudden onset of severe shortness of breath or acute chest pressure',
    'Uncontrolled high fever resistant to supportive measures',
    'Sudden neurological symptoms such as severe dizziness or confusion'
  ];
  let doctorAdvice = 'Consult a qualified physician if symptoms do not improve within 48 hours or if warning signs develop.';
  let explanation = '';

  if (mlResult.needs_clarification) {
    explanation = mlResult.clarification_message ||
      'The provided input could not be matched to known symptoms, so no assessment can be made yet.';
    doctorAdvice = 'Select your symptoms from the symptom list (or rephrase them) and run the assessment again.';
  } else if (INJURY_PATTERN.test(lowerSymptoms)) {
    urgency = 'high';
    explanation =
      `Your reported complaint (${symptomNames.join(', ')}) indicates possible acute physical trauma or suspected bone fracture. ` +
      'This requires radiographic X-ray imaging and clinical immobilization to assess structural alignment and prevent further injury.';
    selfCareSteps = [
      'Do NOT bear weight or put pressure on the injured limb.',
      'Immobilize and support the limb in a comfortable, neutral position.',
      'Apply an ice pack wrapped in a clean cloth for 15 minutes to reduce swelling.',
      'Keep the limb elevated above heart level if possible.'
    ];
    warningSigns = [
      'Visible bone deformity, unnatural angle, or bone piercing skin',
      'Loss of sensation, severe numbness, or cold pale toes/fingers',
      'Inability to move adjacent joints or severe unrelenting pain'
    ];
    doctorAdvice = 'Go to an urgent care clinic or emergency room immediately for X-ray imaging and orthopedic splinting.';
  } else if (primaryDisease === 'Limited symptom assessment') {
    explanation =
      'Your reported symptoms have been recorded, but a single symptom can have many causes. ' +
      'Add any other symptoms you are experiencing for a more useful preliminary assessment.';
    doctorAdvice =
      'Add more symptoms and run the assessment again. If this symptom is severe, worsening, or concerning, ' +
      'contact a healthcare professional; for an emergency, contact local emergency services immediately.';
  } else {
    const meta = getDiseaseMetaFromCatalog(primaryDisease);
    explanation = meta?.description
      ? `Based on clinical patterns in our reference taxonomy, ${primaryDisease} is associated with your reported symptoms (${symptomNames.join(', ')}). ${meta.description}`
      : `Your reported symptoms (${symptomNames.join(', ')}) were assessed against the project's reference taxonomy for ${primaryDisease}.`;
  }

  return {
    clinicalExplanation: explanation,
    symptomPatternInsight: `The observed presentation (${symptomNames.join(', ') || 'no symptoms listed'}) represents a preliminary clinical indication requiring targeted evaluation.`,
    differentialReasoning: `Candidate conditions were ranked by symptom overlap with the reference taxonomy; primary focus is directed at ${primaryDisease}.`,
    urgencyAssessment: urgency,
    urgencyRationale: `Urgency is evaluated as ${urgency.toUpperCase()} based on presenting symptom severity and physical risk indicators.`,
    selfCareSteps,
    warningSignsToWatch: warningSigns,
    whenToSeeDoctor: doctorAdvice,
    clarificationQuestion: '',
    confidenceInterpretation: buildConfidenceInterpretation(mlResult),
    historicalContext: 'Preliminary rule-based triage assessment.',
    geminiPredictedDisease: primaryDisease,
    geminiConfidence: Number(mlResult.confidence ?? 0),
    geminiTopPredictions: mlResult.top_predictions || [],
    candidateAnalyses: [],
    accuracyMetrics: null,
    combinedPrediction: {
      predictedDisease: primaryDisease,
      confidence: Number(mlResult.confidence ?? 0),
      method: buildConfidenceMethod(mlResult)
    },
    poweredBy: 'MedInsight Local Clinical Rules',
    geminiEnriched: false,
    generatedAt: new Date().toISOString()
  };
};

// ---------------------------------------------------------------------------
// Preliminary Gemini prediction — a real top-3 differential for ANY symptoms
// ---------------------------------------------------------------------------

const ASSESSMENT_LEVELS = ['low', 'moderate', 'high'];
const SEVERITY_BY_LEVEL = { low: 'mild', moderate: 'moderate', high: 'severe' };

const sanitizeProbability = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, Math.round(numeric * 10) / 10));
};

const sanitizeAssessmentLevel = (value) => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ASSESSMENT_LEVELS.includes(normalized) ? normalized : 'moderate';
};

/**
 * Parses and validates the preliminary prediction JSON returned by Gemini.
 * Strips ``` fences, parses inside try/catch, clamps probabilities to 0-100
 * and coerces urgency/impact onto the allow-list. Throws a typed
 * GEMINI_INVALID_RESPONSE so callers can fall back to the symptom engine
 * instead of trusting junk or crashing.
 */
export const parseGeminiPredictionResponse = (rawText) => {
  if (typeof rawText !== 'string' || rawText.trim().length === 0) {
    throw new GeminiProviderError(GEMINI_ERROR_CODES.INVALID_RESPONSE, 'Gemini returned an empty prediction response');
  }

  const cleanedText = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleanedText);
  } catch (_error) {
    throw new GeminiProviderError(GEMINI_ERROR_CODES.INVALID_RESPONSE, 'Gemini returned a malformed prediction payload');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new GeminiProviderError(GEMINI_ERROR_CODES.INVALID_RESPONSE, 'Gemini returned an unexpected prediction shape');
  }
  if (typeof parsed.valid !== 'boolean') {
    throw new GeminiProviderError(GEMINI_ERROR_CODES.INVALID_RESPONSE, 'Gemini prediction did not include a valid flag');
  }

  const topPredictions = (Array.isArray(parsed.top_predictions) ? parsed.top_predictions : [])
    .filter((item) => item && typeof item === 'object' && typeof item.condition === 'string' && item.condition.trim().length > 0)
    .slice(0, GEMINI_MAX_TOP_PREDICTIONS)
    .map((item) => ({
      condition: sanitizeText(item.condition, GEMINI_MAX_CONDITION_LENGTH),
      probability: sanitizeProbability(item.probability),
      reason: sanitizeText(item.reason, GEMINI_MAX_SHORT_TEXT_LENGTH)
    }));

  if (topPredictions.length === 0) {
    throw new GeminiProviderError(GEMINI_ERROR_CODES.INVALID_RESPONSE, 'Gemini prediction did not include any top predictions');
  }

  const explanation = sanitizeText(parsed.explanation, GEMINI_MAX_TEXT_LENGTH);
  if (!explanation) {
    throw new GeminiProviderError(GEMINI_ERROR_CODES.INVALID_RESPONSE, 'Gemini prediction did not include an explanation');
  }

  return {
    valid: parsed.valid,
    top_predictions: topPredictions,
    urgency: sanitizeAssessmentLevel(parsed.urgency),
    impact: sanitizeAssessmentLevel(parsed.impact),
    explanation,
    recommended_actions: sanitizeStringArray(parsed.recommended_actions)
  };
};

/** Structured-output schema constraining the prediction JSON at the API level. */
const buildPredictionResponseSchema = () => ({
  type: 'OBJECT',
  properties: {
    valid: { type: 'BOOLEAN', description: 'False only when the input is random letters with no plausible health meaning' },
    top_predictions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          condition: { type: 'STRING', description: 'Most likely condition name' },
          probability: { type: 'NUMBER', description: 'Estimated probability from 0 to 100; keep values low when symptom evidence is thin' },
          reason: { type: 'STRING', description: 'One sentence linking this condition to the reported symptoms' }
        },
        required: ['condition', 'probability', 'reason']
      },
      description: 'Exactly the top 3 most likely conditions, most likely first'
    },
    urgency: { type: 'STRING', enum: ['Low', 'Moderate', 'High'], description: 'How urgently professional medical care is needed' },
    impact: { type: 'STRING', enum: ['Low', 'Moderate', 'High'], description: 'Expected impact on daily life' },
    explanation: { type: 'STRING', description: '2-3 sentence short clinical explanation of the overall picture' },
    recommended_actions: { type: 'ARRAY', items: { type: 'STRING' }, description: '3-5 concrete self-care and next-step actions' }
  },
  required: ['valid', 'top_predictions', 'urgency', 'impact', 'explanation', 'recommended_actions']
});

const buildPredictionSystemInstruction = () =>
  `You are MedInsight's preliminary triage assistant. You provide careful, preliminary assessments of reported symptoms — never confirmed clinical diagnoses. ` +
  `You keep language plain, compassionate, and actionable, you stay conservative with urgency, and safety comes first: when reported symptoms suggest a medical emergency ` +
  `(severe chest pain, difficulty breathing, uncontrolled bleeding, sudden neurological confusion), set urgency to "High" and advise contacting local emergency services immediately. ` +
  `With few symptoms you stay humble: probabilities stay low and common conditions lead the list. ` +
  `You always respond with JSON only, matching the requested schema.`;

/**
 * Privacy: only the reported symptom entries (and their catalog display
 * names), duration, and self-reported severity are ever sent to the Gemini
 * API — no names, contact details, demographics, notes, or history.
 */
const buildPredictionPrompt = ({ submitted, duration, severity }) => {
  const symptomLines = submitted.map((entry) => {
    const resolvedId = resolveSymptomId(entry);
    return resolvedId
      ? `- "${entry}" → known symptom "${resolveSymptomName(resolvedId)}"`
      : `- "${entry}" (not in the reference taxonomy — interpret it as best you can)`;
  }).join('\n');

  return `
PRELIMINARY SYMPTOM ASSESSMENT — MedInsight
Reported symptoms (${submitted.length}):
${symptomLines}
Duration: ${duration || DEFAULT_SYMPTOM_DURATION}
Self-reported discomfort level: ${severity || 'unspecified'}

TASK:
Based only on the reported symptoms, return your best preliminary differential assessment:
- top_predictions: exactly the TOP 3 most likely conditions, each with condition (name), probability (0-100) and reason (one sentence tying it to the reported symptoms).
- valid: false only if every entry is random letters with no plausible health meaning; health terms, disease names, injuries, and misspellings are valid.
- With few symptoms (1-2) or unusual/unrecognized entries, keep every probability LOW and prefer COMMON conditions; state the uncertainty in each reason.
- urgency: how urgently professional care is needed (Low | Moderate | High).
- impact: expected impact on daily life (Low | Moderate | High).
- explanation: 2-3 sentence short clinical explanation of the overall picture.
- recommended_actions: 3-5 concrete self-care / next-step actions.

RULES:
- This is preliminary triage guidance, NOT a clinical diagnosis; never claim certainty.
- Return ONLY valid JSON matching this shape (no extra text):
{
  "valid": true,
  "top_predictions": [ { "condition": "...", "probability": 0-100, "reason": "..." } ],
  "urgency": "Low | Moderate | High",
  "impact": "Low | Moderate | High",
  "explanation": "short clinical explanation",
  "recommended_actions": ["...", "..."]
}
`.trim();
};

/**
 * Maps a sanitized Gemini prediction onto the exact field shapes the rest of
 * the pipeline (controllers, persistence, UI) already consumes: an
 * mlResult-style prediction plus a geminiInsights-compatible insights
 * document. The mandatory medical disclaimer travels with every result.
 */
export const buildGeminiPredictionResult = ({ parsed, symptoms = [] }) => {
  const submitted = (Array.isArray(symptoms) ? symptoms : [])
    .filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim());

  const recognized = [];
  const unrecognized = [];
  for (const entry of submitted) {
    const resolvedId = resolveSymptomId(entry);
    if (resolvedId) {
      if (!recognized.includes(resolvedId)) recognized.push(resolvedId);
    } else {
      const lowerEntry = entry.toLowerCase();
      if (!unrecognized.includes(lowerEntry)) unrecognized.push(lowerEntry);
    }
  }

  // Severity (the UI's "impact" label) reflects the WORSE of urgency/impact.
  const severityRank = { low: 0, moderate: 1, high: 2 };
  const worstLevel = severityRank[parsed.urgency] >= severityRank[parsed.impact] ? parsed.urgency : parsed.impact;
  const severity = SEVERITY_BY_LEVEL[worstLevel] || 'moderate';

  const topPredictions = parsed.top_predictions.map((candidate) => ({
    disease: candidate.condition,
    condition: candidate.condition,
    confidence: candidate.probability,
    severity,
    description: candidate.reason,
    reason: candidate.reason
  }));
  const primary = topPredictions[0];

  const prediction = {
    success: true,
    primary_condition: primary.condition,
    confidence: primary.confidence,
    confidence_basis: CONFIDENCE_BASIS.GEMINI_ESTIMATE,
    severity,
    description: parsed.explanation,
    recommendation: parsed.recommended_actions.join(' '),
    top_predictions: topPredictions,
    recognized_symptoms: recognized,
    unrecognized_symptoms: unrecognized,
    disclaimer: MANDATORY_DISCLAIMER,
    isFallback: false
  };

  const insights = {
    clinicalExplanation: parsed.explanation,
    symptomPatternInsight: `Reported pattern (${submitted.map((entry) => resolveSymptomName(resolveSymptomId(entry) || entry.toLowerCase())).join(', ')}) assessed preliminarily by Gemini.`,
    differentialReasoning: topPredictions.map((candidate) => `${candidate.condition}: ${candidate.reason}`).join(' | '),
    urgencyAssessment: parsed.urgency,
    urgencyRationale: `Care urgency assessed as ${parsed.urgency.toUpperCase()} and impact as ${parsed.impact.toUpperCase()} for the reported symptom pattern.`,
    selfCareSteps: parsed.recommended_actions,
    warningSignsToWatch: [],
    whenToSeeDoctor: parsed.recommended_actions.join(' '),
    clarificationQuestion: '',
    confidenceInterpretation: buildConfidenceInterpretation(prediction),
    historicalContext: 'Preliminary Gemini AI estimate of the reported symptom pattern.',
    geminiPredictedDisease: primary.condition,
    geminiConfidence: primary.confidence,
    geminiTopPredictions: topPredictions,
    candidateAnalyses: topPredictions.map((candidate) => ({
      condition: candidate.condition,
      supportingSymptoms: recognized.map((id) => resolveSymptomName(id)),
      missingSymptoms: [],
      summary: candidate.reason
    })),
    accuracyMetrics: null,
    combinedPrediction: {
      predictedDisease: primary.condition,
      confidence: primary.confidence,
      method: 'Gemini AI preliminary estimate (top-3 differential — not a validated probability)'
    },
    poweredBy: 'Gemini',
    geminiEnriched: true,
    generatedAt: new Date().toISOString()
  };

  return { prediction, insights };
};

/**
 * Generates a preliminary top-3 differential via Gemini for 1+ submitted
 * symptoms. Returns null when Gemini is not configured (caller falls back
 * silently); throws a typed GeminiProviderError on any call/parse failure so
 * runPrediction can fall back to the symptom-grounded engine without
 * crashing.
 */
export const generateGeminiPrediction = async ({
  symptoms = [],
  duration = DEFAULT_SYMPTOM_DURATION,
  severity = ''
}) => {
  const submitted = (Array.isArray(symptoms) ? symptoms : [])
    .filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim());
  if (submitted.length === 0) return null;

  const { model, isConfigured } = resolveGeminiConfig();
  const client = getGeminiClient();
  if (!client || !isConfigured) return null;

  const prompt = buildPredictionPrompt({ submitted, duration, severity });

  let timeoutId;
  try {
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new GeminiProviderError(GEMINI_ERROR_CODES.TIMEOUT, 'Gemini prediction request timed out')),
            GEMINI_PREDICTION_TIMEOUT_MS
          );
        });
        const callPromise = client.models.generateContent({
          model,
          contents: attempt === 0 ? prompt : `${prompt}\n\nReturn valid:true for any plausible symptom, injury, or disease name. valid:false is only for random letters.`,
          config: buildGeminiConfig({
            systemInstruction: buildPredictionSystemInstruction(),
            temperature: GEMINI_TEMPERATURE,
            maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
            responseMimeType: 'application/json',
            responseSchema: buildPredictionResponseSchema()
          })
        });
        const response = await Promise.race([callPromise, timeoutPromise]);
        const parsed = parseGeminiPredictionResponse(extractResponseText(response));
        if (parsed.valid === false) {
          throw new GeminiProviderError(GEMINI_ERROR_CODES.INVALID_RESPONSE, 'Gemini identified non-health random input');
        }
        return buildGeminiPredictionResult({ parsed, symptoms: submitted });
      } catch (error) {
        lastError = error;
        if (attempt === 1) throw error;
      }
    }
    throw lastError;
  } finally {
    clearTimeout(timeoutId);
  }
};

const CHAT_DISCLAIMER = 'This is not a medical diagnosis; please consult a doctor.';

const buildChatFallback = () => `Rest, drink fluids, and contact a doctor if symptoms worsen or do not improve.\n\n${CHAT_DISCLAIMER}`;

/** Conversational health guidance. Retries once and always returns a safe reply. */
export const generateGeminiChatReply = async ({
  userMessage,
  detectedSymptoms = [],
  conversationHistory = [],
  isEmergency = false
}) => {
  const fallback = buildChatFallback();
  if (isEmergency) return fallback;
  try {
    const { model, isConfigured } = resolveGeminiConfig();
    const client = getGeminiClient();
    if (!client || !isConfigured) return fallback;

    const symptomNames = detectedSymptoms.map(resolveSymptomName);
    const historyContents = conversationHistory.slice(-GEMINI_CHAT_HISTORY_TURNS).map((turn) => ({
      role: turn.role === 'assistant' || turn.role === 'bot' ? 'model' : 'user',
      parts: [{ text: turn.content || turn.text || '' }]
    }));
    const prompt = `User message: "${userMessage}". Detected symptoms: ${symptomNames.join(', ') || 'None yet'}.\nFor any disease or symptom, include: a short explanation; simple home care; relevant diet/lifestyle tips; warning signs for a doctor or emergency care; and which type of doctor to consult. If this is not health-related, politely say you can only help with health questions. Do not diagnose. End with a short note that this is not a medical diagnosis and to consult a doctor.`;
    const systemInstruction = 'You are a careful health assistant. Give general educational guidance only. Do not prescribe medicine names or doses. Keep the answer short, clear and in simple language. Always reply in simple English, whatever language the user writes in. Understand Bengali and Banglish input, but answer only in English.';

    for (let attempt = 0; attempt < 2; attempt += 1) {
      let timeoutId;
      try {
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new GeminiProviderError(GEMINI_ERROR_CODES.TIMEOUT, 'Gemini chat request timed out')),
            GEMINI_CHAT_TIMEOUT_MS
          );
        });
        const callPromise = client.models.generateContent({
          model,
          contents: [...historyContents, { role: 'user', parts: [{ text: prompt }] }],
          config: buildGeminiConfig({
            systemInstruction,
            temperature: GEMINI_CHAT_TEMPERATURE,
            maxOutputTokens: GEMINI_CHAT_MAX_OUTPUT_TOKENS
          })
        });
        const response = await Promise.race([callPromise, timeoutPromise]);
        const reply = extractResponseText(response).trim();
        if (reply) {
          const disclaimerPresent = /not a medical diagnosis/i.test(reply);
          const disclaimer = disclaimerPresent ? '' : `\n\n${CHAT_DISCLAIMER}`;
          return `${reply}${disclaimer}`;
        }
      } catch (_error) {
        // Retry once; preserve a safe generic answer after the second failure.
      } finally {
        clearTimeout(timeoutId);
      }
    }
    return fallback;
  } catch (_error) {
    return fallback;
  } finally {
    // No caller should receive an empty reply, even if provider setup fails.
  }
};

export default {
  GeminiProviderError,
  classifyGeminiError,
  resolveGeminiConfig,
  isGeminiConfigured,
  parseGeminiExplanationResponse,
  enrichDiagnosisWithGemini,
  generateGeminiChatReply,
  resolveSymptomName,
  getDiseaseMetaFromCatalog,
  computeSymptomCoverage,
  buildConfidenceInterpretation,
  buildConfidenceMethod,
  buildLocalClinicalInsights
};
