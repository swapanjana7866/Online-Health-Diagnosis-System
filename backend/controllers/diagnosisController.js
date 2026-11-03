import mongoose from 'mongoose';
import Diagnosis from '../models/Diagnosis.js';
import { getSymptomsList, MANDATORY_DISCLAIMER } from '../services/mlService.js';
import { runPrediction } from '../services/predictionService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { isValidUserId } from '../utils/userId.js';
import {
  CARE_RECOMMENDATIONS,
  DEFAULT_SYMPTOM_DURATION,
  LOW_CONFIDENCE_MESSAGE,
  SYMPTOMS_NOT_RECOGNIZED_CODE,
  CONFIDENCE_BASIS
} from '../config/constants.js';


export const getSymptoms = async (_req, res, next) => {
  try {
    const symptoms = await getSymptomsList();
    return sendSuccess(res, 200, 'Symptoms retrieved successfully', { symptoms });
  } catch (error) {
    return next(error);
  }
};






export const createDiagnosis = async (req, res, next) => {
  try {
    const { symptoms, duration, severity: clientSeverity, notes } = req.body;

    if (!Array.isArray(symptoms) || symptoms.length === 0) {
      return sendError(res, 400, 'At least one symptom must be provided in the symptoms array', {
        field: 'symptoms',
        code: 'EMPTY_SYMPTOMS'
      });
    }

    // 1. Run the symptom-grounded prediction engine (validated ML model, local
    //    heuristic fallback). Gemini only explains candidate conditions.
    const { provider, prediction, insights, fallbackReason } = await runPrediction({
      symptoms,
      duration: duration || DEFAULT_SYMPTOM_DURATION,
      severity: clientSeverity || ''
    });

    // Unrecognized input: ask the user to clarify instead of returning a disease
    if (prediction.needs_clarification) {
      return sendError(res, 400, prediction.clarification_message, {
        code: SYMPTOMS_NOT_RECOGNIZED_CODE,
        unrecognized_symptoms: prediction.unrecognized_symptoms || [],
        suggestions: prediction.suggestions || []
      });
    }

    // 2. Clinical severity and care recommendation alignment
    let severity = clientSeverity || prediction.severity || 'moderate';
    if (insights?.urgencyAssessment === 'high') {
      severity = 'severe';
    }

    const primaryDisease =
      prediction.primary_condition || insights?.geminiPredictedDisease || 'Preliminary Symptom Evaluation';
    const parsedConfidence = Number(prediction.confidence);
    const confidence = Number.isFinite(parsedConfidence)
      ? Math.min(100, Math.max(0, parsedConfidence))
      : 0;
    const confidenceBasis = prediction.confidence_basis || CONFIDENCE_BASIS.NONE;
    const description = prediction.description || insights?.clinicalExplanation || '';
    const recommendation =
      (insights?.whenToSeeDoctor ? `${insights.whenToSeeDoctor} ` : '') +
      (prediction.recommendation || CARE_RECOMMENDATIONS[severity] || CARE_RECOMMENDATIONS.moderate);

    // Advisory only for engine-flagged low-confidence results — a 1-symptom
    // submission is no longer blocked or auto-flagged (Gemini/ML still
    // produce a real prediction for it).
    const isLowConfidence = prediction.low_confidence === true;

    // 3. Persist diagnosis records only for users with database ObjectIds.
    const diagnosisFields = {
      symptoms,
      predictedDisease: primaryDisease,
      confidence,
      confidenceBasis,
      
      severity,
      topPredictions: prediction.top_predictions?.length > 0 ? prediction.top_predictions : (insights?.geminiTopPredictions || []),
      description,
      duration: duration || DEFAULT_SYMPTOM_DURATION,
      notes: notes || '',
      recommendation,
      disclaimer: prediction.disclaimer || MANDATORY_DISCLAIMER,
      isFallback: prediction.isFallback || false,
      unrecognizedSymptoms: prediction.unrecognized_symptoms || [],
      status: 'completed',
      predictionProvider: provider,
      providerFallbackReason: fallbackReason,
      geminiInsights: insights || null,
      geminiEnriched: insights?.geminiEnriched === true
    };
    const diagnosis = isValidUserId(req.user?._id)
      ? await Diagnosis.create({ user: req.user._id, ...diagnosisFields })
      : null;
    const result = diagnosis || { ...diagnosisFields, _id: null, user: null };

    return sendSuccess(res, diagnosis ? 201 : 200,
      diagnosis ? 'Diagnosis evaluated and saved successfully' : 'Diagnosis evaluated successfully', {
      id: result._id,
      _id: result._id,
      user: result.user,
      symptoms: result.symptoms,
      recognized_symptoms: prediction.recognized_symptoms || result.symptoms,
      unrecognized_symptoms: prediction.unrecognized_symptoms || [],
      predictedDisease: result.predictedDisease,
      primary_condition: result.predictedDisease,   // alias for frontend compatibility
      confidence: result.confidence,
      confidenceBasis: result.confidenceBasis,
      severity: result.severity,
      topPredictions: result.topPredictions,
      description: result.description,
      duration: result.duration,
      notes: result.notes,
      recommendation: result.recommendation,
      disclaimer: result.disclaimer,
      isFallback: result.isFallback,
      predictionProvider: result.predictionProvider,
      providerFallbackReason: result.providerFallbackReason || null,
      low_confidence: isLowConfidence,
      low_confidence_message: isLowConfidence
        ? (prediction.low_confidence_message || LOW_CONFIDENCE_MESSAGE)
        : null,
      createdAt: result.createdAt || diagnosis?.createdAt || new Date(),
      // Gemini insights (candidate explanations; local rules when unavailable)
      geminiInsights: result.geminiInsights || null,
      geminiEnriched: result.geminiEnriched || false,
      combinedPrediction: insights?.combinedPrediction || {
        predictedDisease: result.predictedDisease,
        confidence: result.confidence,
        method: confidenceBasis === CONFIDENCE_BASIS.MODEL_PROBABILITY
          ? 'SymptomDiseaseClassifier probability'
          : 'Preliminary symptom assessment (no validated probability available)'
      },
      accuracyMetrics: insights?.accuracyMetrics || null
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/diagnoses
 * GET /api/diagnoses/history
 * Returns paginated diagnosis history for the authenticated user.
 */
export const getDiagnoses = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    if (!isValidUserId(req.user?._id)) {
      return sendSuccess(res, 200, 'Diagnoses retrieved successfully', {
        diagnoses: [],
        pagination: { total: 0, page, limit, totalPages: 1 }
      });
    }

    const filter = { user: req.user._id };

    const [diagnoses, total] = await Promise.all([
      Diagnosis.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Diagnosis.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return sendSuccess(res, 200, 'Diagnoses retrieved successfully', {
      diagnoses,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const getDiagnosis = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, 'Invalid diagnosis ID format', { code: 'INVALID_ID' });
    }
    if (!isValidUserId(req.user?._id)) {
      return sendError(res, 404, 'Diagnosis record not found', { code: 'NOT_FOUND' });
    }

    const diagnosis = await Diagnosis.findOne({ _id: id, user: req.user._id }).lean();
    if (!diagnosis) {
      return sendError(res, 404, 'Diagnosis record not found', { code: 'NOT_FOUND' });
    }

    return sendSuccess(res, 200, 'Diagnosis retrieved successfully', { diagnosis });
  } catch (error) {
    return next(error);
  }
};


export const deleteDiagnosis = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, 'Invalid diagnosis ID format', { code: 'INVALID_ID' });
    }
    if (!isValidUserId(req.user?._id)) {
      return sendError(res, 404, 'Diagnosis record not found or unauthorized', { code: 'NOT_FOUND' });
    }

    const deleted = await Diagnosis.findOneAndDelete({ _id: id, user: req.user._id });
    if (!deleted) {
      return sendError(res, 404, 'Diagnosis record not found or unauthorized', { code: 'NOT_FOUND' });
    }

    return sendSuccess(res, 200, 'Diagnosis deleted successfully', { id });
  } catch (error) {
    return next(error);
  }
};
