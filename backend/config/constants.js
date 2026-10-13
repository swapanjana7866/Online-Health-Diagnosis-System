export const JWT_EXPIRES_IN = '7d';
export const BCRYPT_SALT_ROUNDS = 12;

export const PASSWORD_REGEX = /^(?=.*\d).{8,}$/;
export const PASSWORD_ERROR_MESSAGE = 'Password must be at least 8 characters long and contain at least one number';

export const RATE_LIMIT_AUTH_WINDOW_MS = 50 * 60 * 1000; // 50 minutes
export const RATE_LIMIT_AUTH_MAX = 50; // Max 50 attempts per window

export const RATE_LIMIT_GLOBAL_WINDOW_MS = 50 * 60 * 1000;
export const RATE_LIMIT_GLOBAL_MAX = 200;

export const CHAT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const CHAT_RATE_LIMIT_MAX = 30;
export const CHAT_MAX_MESSAGE_LENGTH = 1000;
export const CHAT_MAX_HISTORY_ENTRIES = 10;
export const CHAT_MAX_SYMPTOMS = 30;

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;

export const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];
export const DEFAULT_DOCTOR_AVAILABILITY_SLOTS = ['09:00', '10:30', '14:00', '16:30'];
export const DEFAULT_DOCTOR_CONSULTATION_FEE = 49;

// ---------------------------------------------------------------------------
// Prediction provider configuration (Gemini preliminary prediction with
// symptom-grounded ML/heuristic fallback; Gemini also supplies explanations)
// ---------------------------------------------------------------------------
// 'gemini' (default): Gemini generates a preliminary top-3 differential for
//   ANY submitted symptom(s) — including a single symptom or unusual entries
//   the taxonomy cannot resolve. Any Gemini failure (or the orthopedic-trauma
//   safety rule) falls back to the Python ML engine / local heuristic rules,
//   which also explain candidates via Gemini or local clinical rules.
// 'ml': symptom-engine predictions with local rule-based explanations only —
//   no external Gemini calls.
export const PREDICTION_PROVIDER_GEMINI = 'gemini';
export const PREDICTION_PROVIDER_ML = 'ml';
export const PREDICTION_PROVIDER_HEURISTIC = 'heuristic';
export const PREDICTION_PROVIDER_ENV_DEFAULT = PREDICTION_PROVIDER_GEMINI;

// What a displayed confidence number actually represents. Probabilities are
// only shown for the validated model basis; the Gemini basis is a preliminary
// AI estimate, and every other basis is labelled as a preliminary assessment
// in the UI.
export const CONFIDENCE_BASIS = {
  MODEL_PROBABILITY: 'model_probability',
  HEURISTIC_OVERLAP: 'heuristic_overlap',
  RULE_BASED: 'rule_based',
  GEMINI_ESTIMATE: 'gemini_estimate',
  NONE: 'none'
};

// Returned when none of the submitted inputs resolve to known symptoms.
export const SYMPTOMS_NOT_RECOGNIZED_CODE = 'SYMPTOMS_NOT_RECOGNIZED';
export const SYMPTOMS_NOT_RECOGNIZED_MESSAGE =
  'We could not recognize those entries as symptoms. Please select symptoms from the symptom list or describe what you are feeling (for example: headache, cough, fever).';
export const NO_VALID_SYMPTOMS_MESSAGE =
  'No valid symptoms were submitted. Please enter at least one symptom before requesting an assessment.';
export const SYMPTOMS_NO_MATCH_MESSAGE =
  'The provided symptoms do not match any condition profile in the reference dataset, so no reliable assessment can be made yet. Please add a few different or additional symptoms, or select them from the symptom list.';

// Current stable Gemini Flash model verified against the live Gemini API and
// docs (https://ai.google.dev/gemini-api/docs/models). Note: gemini-2.5-flash
// now returns 404 for new API keys, and gemini-3.8-flash can return 503 during
// demand spikes — override per environment with the GEMINI_MODEL env var.
export const GEMINI_DEFAULT_MODEL = 'gemini-3.6-flash';
export const GEMINI_PREDICTION_TIMEOUT_MS = 12000;
export const GEMINI_ENRICHMENT_TIMEOUT_MS = 6500;
export const GEMINI_MAX_OUTPUT_TOKENS = 1024;
export const GEMINI_TEMPERATURE = 0.2;
export const GEMINI_CHAT_MAX_OUTPUT_TOKENS = 350;
export const GEMINI_CHAT_TEMPERATURE = 0.4;
export const GEMINI_CHAT_TIMEOUT_MS = 5000;
export const GEMINI_CHAT_HISTORY_TURNS = 10;

// Generative models never produce clinical probabilities; Gemini output is
// used for explanations only and must not carry confidence values at all.
// Kept limits for top-candidate selection & output sanitization.
export const GEMINI_MAX_TOP_PREDICTIONS = 3;
export const GEMINI_MAX_ARRAY_ITEMS = 5;

// Output sanitization limits for model responses
export const GEMINI_MAX_CONDITION_LENGTH = 120;
export const GEMINI_MAX_TEXT_LENGTH = 800;
export const GEMINI_MAX_SHORT_TEXT_LENGTH = 400;
export const GEMINI_MAX_ARRAY_ITEM_LENGTH = 200;

export const URGENCY_LEVELS = ['low', 'moderate', 'high'];
export const SEVERITY_LEVELS = ['mild', 'moderate', 'severe'];
export const DEFAULT_SYMPTOM_DURATION = '1–3 days';
export const LOW_CONFIDENCE_SYMPTOM_THRESHOLD = 2;
export const LOW_CONFIDENCE_MESSAGE =
  'Only one symptom was provided — this is a preliminary estimate. Add any other symptoms you are experiencing for a more useful assessment.';

export const GEMINI_API_KEY_DOCS_URL = 'https://aistudio.google.com/apikey';

export const CARE_RECOMMENDATIONS = {
  mild: 'Rest, hydrate, and monitor your symptoms. Consider over-the-counter support if appropriate, and consult a doctor if symptoms worsen or persist past a few days.',
  moderate: 'Consider scheduling a consultation with a healthcare professional within 24 to 48 hours for clinical evaluation and targeted therapy.',
  severe: 'Please seek prompt clinical or emergency medical evaluation. If experiencing difficulty breathing, high unyielding fever, or intense chest pain, contact emergency medical services immediately.'
};

export const GEMINI_ERROR_CODES = {
  NOT_CONFIGURED: 'GEMINI_NOT_CONFIGURED',
  AUTH_FAILED: 'GEMINI_AUTH_FAILED',
  INVALID_REQUEST: 'GEMINI_INVALID_REQUEST',
  RATE_LIMITED: 'GEMINI_RATE_LIMITED',
  TIMEOUT: 'GEMINI_TIMEOUT',
  UNAVAILABLE: 'GEMINI_UNAVAILABLE',
  INVALID_RESPONSE: 'GEMINI_INVALID_RESPONSE'
};
