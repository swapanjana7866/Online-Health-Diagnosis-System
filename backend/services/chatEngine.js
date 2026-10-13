 import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load symptoms catalog & disease definitions
let symptomsData = [];
let diseasesData = {};

try {
  const symptomsPath = path.resolve(__dirname, '../data/symptoms.json');
  const diseasesPath = path.resolve(__dirname, '../data/diseases.json');
  if (fs.existsSync(symptomsPath)) {
    symptomsData = JSON.parse(fs.readFileSync(symptomsPath, 'utf8'));
  }
  if (fs.existsSync(diseasesPath)) {
    diseasesData = JSON.parse(fs.readFileSync(diseasesPath, 'utf8'));
  }
} catch (err) {
  console.warn('[Chat Engine] Warning: Failed to load taxonomy for chat engine:', err.message);
}

// Comprehensive synonym mapping to multi-hot symptom IDs
const SYMPTOM_SYNONYMS = {
  high_fever: ['fever', 'high fever', 'high temperature', 'burning up', 'hot forehead', 'febrile', 'pyrexia'],
  mild_fever: ['mild fever', 'low grade fever', 'warm forehead', 'slight temperature'],
  headache: ['headache', 'head ache', 'migraine', 'throbbing head', 'head hurts', 'pain in head'],
  cough: ['cough', 'coughing', 'dry cough', 'wet cough', 'hacking cough', 'hacking'],
  fatigue: ['fatigue', 'tired', 'tiredness', 'exhausted', 'exhaustion', 'worn out', 'weak', 'weakness', 'low energy', 'lethargic', 'sluggish'],
  chills: ['chills', 'feeling cold', 'shivering', 'goosebumps', 'cold sweats', 'teeth chattering'],
  nausea: ['nausea', 'nauseous', 'feel sick', 'sick to stomach', 'queasy'],
  vomiting: ['vomit', 'vomiting', 'throwing up', 'puking', 'threw up'],
  breathlessness: ['breathless', 'shortness of breath', 'short of breath', 'hard to breathe', 'difficulty breathing', 'wheezing', 'can’t breathe', 'cant breathe', 'gasping'],
  chest_pain: ['chest pain', 'tight chest', 'chest pressure', 'chest ache', 'pain in chest', 'chest discomfort'],
  throat_irritation: ['sore throat', 'scratchy throat', 'throat hurts', 'throat irritation', 'throat pain', 'swollen throat'],
  stomach_pain: ['stomach pain', 'belly ache', 'abdominal pain', 'tummy ache', 'gut pain', 'cramps in stomach', 'pain in stomach'],
  joint_pain: ['joint pain', 'aching joints', 'joints hurt', 'pain in joints', 'swollen joints'],
  muscle_pain: ['muscle pain', 'body ache', 'muscle ache', 'aching muscles', 'myalgia'],
  dizziness: ['dizziness', 'dizzy', 'lightheaded', 'feeling faint', 'spinning head', 'vertigo'],
  skin_rash: ['skin rash', 'rash', 'itchy rash', 'red spots', 'breakout', 'hives'],
  itching: ['itching', 'itchy', 'scratching', 'pruritus'],
  continuous_sneezing: ['sneezing', 'sneezes', 'continuous sneezing', 'frequent sneezing'],
  diarrhoea: ['diarrhea', 'diarrhoea', 'loose stools', 'watery stool'],
  acidity: ['acidity', 'acid reflux', 'heartburn', 'sour stomach', 'burning chest'],
  loss_of_appetite: ['loss of appetite', 'no appetite', 'not hungry', 'don’t want to eat', 'cant eat'],
  sweating: ['sweating', 'excessive sweating', 'night sweats', 'perspiration'],
  back_pain: ['back pain', 'backache', 'aching back', 'lower back pain'],
  neck_pain: ['neck pain', 'stiff neck', 'neck stiffness', 'pain in neck'],
  yellowish_skin: ['yellow skin', 'yellowish skin', 'jaundice'],
  runny_nose: ['runny nose', 'congested', 'nasal congestion', 'stuffy nose', 'blocked nose'],
  ulcers_on_tongue: ['mouth ulcers', 'ulcers on tongue', 'canker sores'],
  hair_loss: ['hair fall', 'hair loss', 'hair shedding']
};

// Emergency red flags
const EMERGENCY_KEYWORDS = [
  'chest pain', 'difficulty breathing', 'severe bleeding', 'unconsciousness',
  'fracture', 'suicidal thoughts', 'suicidal', 'want to kill myself',
  'crushing chest pain',
  'heart attack',
  'cannot breathe',
  'can not breathe',
  'cant breathe',
  'choking',
  'coughing blood',
  'vomiting blood',
  'unconscious',
  'passed out',
  'seizure',
  'severe allergic reaction',
  'anaphylaxis',
  'slurred speech',
  'stroke'
];

/**
 * Extracts recognized symptoms from user message text
 */
export const extractSymptomsFromText = (text, existingSymptoms = []) => {
  const normalizedText = text.toLowerCase();
  const detected = new Set(existingSymptoms);

  // Check synonym map
  for (const [symptomId, phrases] of Object.entries(SYMPTOM_SYNONYMS)) {
    for (const phrase of phrases) {
      // Word boundary match
      const regex = new RegExp(`\\b${phrase}\\b`, 'i');
      if (regex.test(normalizedText)) {
        detected.add(symptomId);
        break;
      }
    }
  }

  // Check all official symptoms
  for (const s of symptomsData) {
    const rawName = s.name.toLowerCase();
    const idName = s.id.replace(/_/g, ' ').toLowerCase();
    const regex1 = new RegExp(`\\b${rawName}\\b`, 'i');
    const regex2 = new RegExp(`\\b${idName}\\b`, 'i');
    if (regex1.test(normalizedText) || regex2.test(normalizedText)) {
      detected.add(s.id);
    }
  }

  return Array.from(detected);
};

/**
 * Checks for critical emergency red flags
 */
export const checkEmergencySigns = (text) => {
  const normalized = text.toLowerCase();
  return EMERGENCY_KEYWORDS.some((kw) => normalized.includes(kw)) ||
    /বুকে ব্যথা|শ্বাস নিতে কষ্ট|অনেক রক্তপাত|অজ্ঞান|হাড় ভাঙা|আত্মহত্যা/.test(normalized);
};

const isBengaliMessage = (text) => /[\u0980-\u09FF]/.test(text) ||
  /\b(jor|matha betha|buk betha|shash kosto|rokto porche|osustho)\b/i.test(text);

const isHealthRelatedMessage = (text, detectedSymptoms) => {
  if (detectedSymptoms.length > 0 || isBengaliMessage(text)) return true;
  const normalized = text.toLowerCase();
  const knownDisease = Object.keys(diseasesData).some((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(normalized);
  });
  return knownDisease || /\b(diabetes|typhoid|dengue|hair fall|hair loss|fever|pain|infection|disease|illness|symptom|sick|health|rash|vomit|cough)\b/i.test(normalized);
};

/**
 * Finds suggested related symptoms based on co-occurrence in diseases
 */
export const getRelatedSymptomSuggestions = (currentSymptoms = []) => {
  if (currentSymptoms.length === 0) {
    return [
      { id: 'high_fever', name: 'High Fever' },
      { id: 'headache', name: 'Headache' },
      { id: 'cough', name: 'Cough' },
      { id: 'fatigue', name: 'Fatigue' }
    ];
  }

  const currentSet = new Set(currentSymptoms);
  const candidateCounts = {};

  for (const disease of Object.values(diseasesData)) {
    const coreSymptoms = disease.coreSymptoms || [];
    const hasOverlap = coreSymptoms.some((s) => currentSet.has(s.toLowerCase()));

    if (hasOverlap) {
      for (const s of coreSymptoms) {
        const cleanS = s.toLowerCase();
        if (!currentSet.has(cleanS)) {
          candidateCounts[cleanS] = (candidateCounts[cleanS] || 0) + 1;
        }
      }
    }
  }

  // Sort candidate symptoms by frequency
  const sorted = Object.entries(candidateCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => {
      const found = symptomsData.find((item) => item.id === id);
      return {
        id,
        name: found ? found.name : id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      };
    })
    .slice(0, 5);

  return sorted;
};

/**
 * Formats a list of symptom names nicely for chat replies
 */
const formatSymptomNames = (symptomIds) => {
  return symptomIds.map((id) => {
    const found = symptomsData.find((s) => s.id === id);
    return found ? found.name : id.replace(/_/g, ' ');
  });
};

/**
 * Generates an empathetic and clinically structured response
 */
export const processChatMessage = async ({ message, conversationHistory = [], currentSymptoms = [] }) => {
  const isEmergency = checkEmergencySigns(message);
  const updatedSymptoms = extractSymptomsFromText(message, currentSymptoms);
  const newlyDetected = updatedSymptoms.filter((s) => !currentSymptoms.includes(s));
  const isHealthRelated = isHealthRelatedMessage(message, updatedSymptoms);

  // Determine intent
  const lowerMsg = message.toLowerCase().trim();
  const isGreeting = /^(hi|hello|hey|greetings|good morning|good afternoon|good evening)\b/i.test(lowerMsg) && updatedSymptoms.length === 0;
  const isRequestingDiagnosis = /(diagnos|what do i have|predict|check my|evaluat|analyze|results|what is wrong)/i.test(lowerMsg);
  const isAffirmative = /^(yes|yeah|yep|i do|correct|sure|definitely)\b/i.test(lowerMsg);
  const isNegative = /^(no|nope|neither|none|negative)\b/i.test(lowerMsg);

  // Suggestions for next turn
  const suggestions = getRelatedSymptomSuggestions(updatedSymptoms);

  let replyText = '';
  let shouldRunInference = false;

  if (isEmergency) {
    replyText = '⚠️ **Emergency:** Seek emergency care now. Call your local emergency number or go to the nearest emergency department. Do not wait for an online assessment.\n\nThis is not a medical diagnosis; please consult a doctor.';
    return {
      reply: replyText,
      detectedSymptoms: updatedSymptoms,
      suggestedSymptoms: [],
      isEmergency: true,
      isHealthRelated: true,
      shouldRunInference: false
    };
  }

  if (!isHealthRelated) {
    return {
      reply: 'I can only help with health questions. Tell me about a symptom or condition, and I’ll share general guidance. This is not a medical diagnosis; please consult a doctor.',
      detectedSymptoms: updatedSymptoms,
      suggestedSymptoms: [],
      isEmergency: false,
      isHealthRelated: false,
      shouldRunInference: false
    };
  }

  if (isGreeting) {
    replyText =
      'Hello! I am **MedInsight**, your AI Health Triage Assistant. 👋\n\n' +
      'I am here to help you understand your symptoms, evaluate potential health conditions, and provide supportive care guidance.\n\n' +
      'Tell me, **what symptoms or discomfort are you experiencing today?** You can describe how you feel in your own natural words.';
    return {
      reply: replyText,
      detectedSymptoms: updatedSymptoms,
      suggestedSymptoms: suggestions,
      isEmergency: false,
      isHealthRelated: true,
      shouldRunInference: false
    };
  }

  if (isRequestingDiagnosis) {
    if (updatedSymptoms.length === 0) {
      replyText =
        'Before I can evaluate potential conditions, please share at least one or two symptoms you are experiencing (e.g. fever, headache, cough, stomach pain).';
    } else {
      replyText = `Understood. Analyzing your recorded symptoms: **${formatSymptomNames(updatedSymptoms).join(', ')}** with our diagnostic classifier...`;
      shouldRunInference = true;
    }
    return {
      reply: replyText,
      detectedSymptoms: updatedSymptoms,
      suggestedSymptoms: suggestions,
      isEmergency: false,
      isHealthRelated: true,
      shouldRunInference
    };
  }

  // Symptom intake handling
  if (newlyDetected.length > 0) {
    const formattedNew = formatSymptomNames(newlyDetected);
    const allFormatted = formatSymptomNames(updatedSymptoms);

    if (updatedSymptoms.length >= 3) {
      replyText =
        `I’ve noted your symptoms: **${allFormatted.join(', ')}**.\n\n` +
        `We now have sufficient clinical indicators to evaluate potential differential diagnoses. ` +
        `Would you like me to run the **diagnostic evaluation** now, or do you have additional symptoms like **${suggestions.slice(0, 2).map((s) => s.name).join('** or **')}**?`;
    } else {
      replyText =
        `I’ve recorded **${formattedNew.join('**, **')}** in your current assessment.\n\n` +
        `To help narrow down the diagnosis:\n` +
        `• How long have you felt this way (e.g., today, 1–3 days, or over a week)?\n` +
        `• Are you also experiencing any of these common accompanying symptoms: **${suggestions.slice(0, 3).map((s) => s.name).join('**, **')}**?`;
    }
  } else if (isAffirmative && suggestions.length > 0) {
    replyText =
      `Thanks for clarifying. You can tap on any of the suggested symptom pills below to add them to your assessment, ` +
      `or say **"Evaluate my symptoms"** when you are ready for diagnostic analysis.`;
  } else if (isNegative) {
    if (updatedSymptoms.length > 0) {
      replyText =
        `Understood, no additional symptoms noted. You currently have: **${formatSymptomNames(updatedSymptoms).join(', ')}** recorded.\n\n` +
        `Would you like me to evaluate your health prediction now?`;
    } else {
      replyText = `Okay. Please tell me about any other discomfort or symptoms you’d like to check today.`;
    }
  } else {
    // General conversational turn
    if (updatedSymptoms.length > 0) {
      replyText =
        `Thank you for providing that context. We currently have **${formatSymptomNames(updatedSymptoms).join(', ')}** recorded.\n\n` +
        `You can add any other symptoms by clicking the chips below, or click **"Run Diagnostic Evaluation"** whenever you’re ready.`;
    } else {
      replyText =
        `I hear you. Could you tell me more specifically about any physical symptoms you are having, such as fever, cough, aches, nausea, or headache?`;
    }
  }

  return {
    reply: replyText,
    detectedSymptoms: updatedSymptoms,
    suggestedSymptoms: suggestions,
    isEmergency: false,
    isHealthRelated: true,
    shouldRunInference: false
  };
};

export default {
  extractSymptomsFromText,
  checkEmergencySigns,
  getRelatedSymptomSuggestions,
  processChatMessage
};
