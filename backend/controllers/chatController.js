import { processChatMessage } from '../services/chatEngine.js';
import { MANDATORY_DISCLAIMER } from '../services/mlService.js';
import { generateGeminiChatReply } from '../services/geminiService.js';
import { runPrediction } from '../services/predictionService.js';
import Diagnosis from '../models/Diagnosis.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { CARE_RECOMMENDATIONS, DEFAULT_SYMPTOM_DURATION } from '../config/constants.js';

/**
 * POST /api/chat/message
 * Processes conversational user messages, extracts clinical symptoms,
 * provides empathetic responses, and optionally runs the prediction flow
 * (Gemini-first with ML/heuristic fallback).
 */
export const handleChatMessage = async (req, res, next) => {
  try {
    const { message, conversationHistory = [], currentSymptoms = [], action, duration, notes } = req.body;

    if (!message && action !== 'evaluate') {
      return sendError(res, 400, 'Message text or evaluate action is required', { field: 'message' });
    }

    const chatResult = await processChatMessage({
      message: message || '',
      conversationHistory,
      currentSymptoms
    });

    let diagnosisResult = null;

    // Run inference if requested by user or triggered by chat engine
    const shouldEvaluate = action === 'evaluate' || chatResult.shouldRunInference;
    const symptomsToEvaluate = chatResult.detectedSymptoms.length > 0 ? chatResult.detectedSymptoms : currentSymptoms;

    if (shouldEvaluate && symptomsToEvaluate.length > 0) {
      // Symptom-grounded prediction (ML engine first; Gemini only explains)
      const { provider, prediction, insights, fallbackReason } = await runPrediction({
        symptoms: symptomsToEvaluate,
        duration: duration || DEFAULT_SYMPTOM_DURATION
      });

      // Unrecognized input → ask the user to clarify, never invent a disease
      if (prediction.needs_clarification) {
        chatResult.reply += `\n\n🤔 **I need a bit more clarity:** ${prediction.clarification_message}`;
        return sendSuccess(res, 200, 'Message processed successfully', {
          reply: chatResult.reply,
          detectedSymptoms: chatResult.detectedSymptoms,
          suggestedSymptoms: chatResult.suggestedSymptoms,
          isEmergency: chatResult.isEmergency,
          diagnosisResult: null,
          clarification: {
            code: 'SYMPTOMS_NOT_RECOGNIZED',
            unrecognized_symptoms: prediction.unrecognized_symptoms || [],
            suggestions: prediction.suggestions || []
          },
          disclaimer: MANDATORY_DISCLAIMER
        });
      }

      let severity = prediction.severity || 'moderate';
      if (insights?.urgencyAssessment === 'high') {
        severity = 'severe';
      }

      const recommendation =
        (insights?.whenToSeeDoctor ? `${insights.whenToSeeDoctor} ` : '') +
        (prediction.recommendation || CARE_RECOMMENDATIONS[severity] || CARE_RECOMMENDATIONS.moderate);

      diagnosisResult = {
        predictedDisease: prediction.primary_condition,
        primary_condition: prediction.primary_condition,
        confidence: prediction.confidence,
        confidenceBasis: prediction.confidence_basis || 'none',
        severity,
        topPredictions: prediction.top_predictions || [],
        description: prediction.description || '',
        symptoms: symptomsToEvaluate,
        recognized_symptoms: prediction.recognized_symptoms || symptomsToEvaluate,
        unrecognized_symptoms: prediction.unrecognized_symptoms || [],
        recommendation,
        disclaimer: prediction.disclaimer || MANDATORY_DISCLAIMER,
        isFallback: prediction.isFallback || false,
        predictionProvider: provider,
        providerFallbackReason: fallbackReason || null,
        geminiInsights: insights || null,
        geminiEnriched: insights?.geminiEnriched === true,
        combinedPrediction: insights?.combinedPrediction || {
          predictedDisease: prediction.primary_condition,
          confidence: prediction.confidence,
          method: (prediction.confidence_basis === 'model_probability')
            ? 'SymptomDiseaseClassifier probability'
            : 'Preliminary symptom assessment (no validated probability available)'
        },
        accuracyMetrics: insights?.accuracyMetrics || null
      };

      // Persist to MongoDB if authenticated
      if (req.user) {
        const record = await Diagnosis.create({
          user: req.user._id,
          symptoms: symptomsToEvaluate,
          predictedDisease: prediction.primary_condition,
          confidence: Number.isFinite(Number(prediction.confidence)) ? Number(prediction.confidence) : 0,
          confidenceBasis: prediction.confidence_basis || 'none',
          severity,
          topPredictions: prediction.top_predictions || [],
          description: prediction.description || '',
          duration: duration || DEFAULT_SYMPTOM_DURATION,
          notes: notes || 'Generated via AI Chatbot Triage assessment',
          recommendation,
          disclaimer: prediction.disclaimer || MANDATORY_DISCLAIMER,
          isFallback: prediction.isFallback || false,
          unrecognizedSymptoms: prediction.unrecognized_symptoms || [],
          status: 'completed',
          predictionProvider: provider,
          providerFallbackReason: fallbackReason || null,
          geminiInsights: insights || null,
          geminiEnriched: insights?.geminiEnriched === true
        });
        diagnosisResult.id = record._id;
        diagnosisResult._id = record._id;
      }

      const confidenceLabel = prediction.confidence_basis === 'model_probability'
        ? `${prediction.confidence}% model probability`
        : `${prediction.confidence}% preliminary score`;
      chatResult.reply +=
        `\n\n🎯 **Diagnostic Triage Result:**\n` +
        `• **Primary Condition:** ${prediction.primary_condition} (${confidenceLabel})\n` +
        `• **Triage Severity:** ${severity.toUpperCase()}\n` +
        `• **Care Advice:** ${recommendation}`;

      if (insights?.clinicalExplanation) {
        chatResult.reply += `\n\n💡 **Clinical Insight:** ${insights.clinicalExplanation}`;
      }
    } else if (!chatResult.isEmergency && chatResult.isHealthRelated && message) {
      // Natural Gemini conversational enhancement when not evaluating and not emergency
      const geminiReply = await generateGeminiChatReply({
        userMessage: message,
        detectedSymptoms: chatResult.detectedSymptoms,
        conversationHistory,
        isEmergency: chatResult.isEmergency
      });
      if (geminiReply) {
        chatResult.reply = geminiReply;
      }
    }

    return sendSuccess(res, 200, 'Message processed successfully', {
      reply: chatResult.reply,
      detectedSymptoms: chatResult.detectedSymptoms,
      suggestedSymptoms: chatResult.suggestedSymptoms,
      isEmergency: chatResult.isEmergency,
      diagnosisResult,
      disclaimer: MANDATORY_DISCLAIMER
    });
  } catch (error) {
    return next(error);
  }
};
