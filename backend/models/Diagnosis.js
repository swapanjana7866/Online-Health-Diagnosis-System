import mongoose from 'mongoose';

const topPredictionSchema = new mongoose.Schema(
  {
    disease: { type: String, required: true },
    confidence: { type: Number, required: true },
    severity: { type: String, enum: ['mild', 'moderate', 'severe'], default: 'moderate' },
    description: { type: String, default: '' }
  },
  { _id: false }
);

// Accuracy and dual-model validation metrics schema
const accuracyMetricsSchema = new mongoose.Schema(
  {
    consensusLevel: { type: String, default: 'moderate' },
    agreementScore: { type: Number, default: 0 },
    symptomCoverageRatio: { type: Number, default: 0 },
    modelAgreement: { type: Boolean, default: false },
    validationStatus: { type: String, default: '' },
    mlConfidence: { type: Number, default: 0 },
    geminiConfidence: { type: Number, default: 0 },
    combinedConfidence: { type: Number, default: 0 }
  },
  { _id: false }
);

// Per-candidate supporting/missing symptom analysis produced by Gemini
// explanations (never a diagnosis choice — the model grounds candidates).
const candidateAnalysisSchema = new mongoose.Schema(
  {
    condition: { type: String, default: '' },
    supportingSymptoms: { type: [String], default: [] },
    missingSymptoms: { type: [String], default: [] },
    summary: { type: String, default: '' }
  },
  { _id: false }
);

// Gemini AI enrichment sub-document schema
const geminiInsightsSchema = new mongoose.Schema(
  {
    clinicalExplanation: { type: String, default: '' },
    symptomPatternInsight: { type: String, default: '' },
    differentialReasoning: { type: String, default: '' },
    urgencyAssessment: { type: String, enum: ['low', 'moderate', 'high'], default: 'moderate' },
    urgencyRationale: { type: String, default: '' },
    selfCareSteps: { type: [String], default: [] },
    warningSignsToWatch: { type: [String], default: [] },
    whenToSeeDoctor: { type: String, default: '' },
    clarificationQuestion: { type: String, default: '' },
    confidenceInterpretation: { type: String, default: '' },
    historicalContext: { type: String, default: '' },
    geminiPredictedDisease: { type: String, default: '' },
    geminiConfidence: { type: Number, default: 0 },
    geminiTopPredictions: { type: [topPredictionSchema], default: [] },
    candidateAnalyses: { type: [candidateAnalysisSchema], default: [] },
    accuracyMetrics: { type: accuracyMetricsSchema, default: null },
    combinedPrediction: {
      predictedDisease: { type: String, default: '' },
      confidence: { type: Number, default: 0 },
      method: { type: String, default: 'Preliminary symptom assessment' }
    },
    poweredBy: { type: String, default: 'Gemini' },
    generatedAt: { type: Date, default: null }
  },
  { _id: false }
);

const diagnosisSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    symptoms: [
      {
        type: String,
        required: true,
        trim: true
      }
    ],
    predictedDisease: {
      type: String,
      required: true,
      trim: true
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    // What the confidence number represents: 'model_probability' (validated
    // classifier), 'gemini_estimate' (preliminary Gemini AI estimate),
    // 'heuristic_overlap' (symptom coverage score), 'rule_based' or 'none'.
    confidenceBasis: {
      type: String,
      enum: ['model_probability', 'gemini_estimate', 'heuristic_overlap', 'rule_based', 'none'],
      default: 'none'
    },
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe'],
      default: 'moderate'
    },
    topPredictions: {
      type: [topPredictionSchema],
      default: []
    },
    description: {
      type: String,
      default: ''
    },
    duration: {
      type: String,
      default: '1–3 days'
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    },
    recommendation: {
      type: String,
      default: ''
    },
    disclaimer: {
      type: String,
      default:
        'MedInsight provides preliminary, AI-assisted symptom triage guidance for informational purposes only. ' +
        'It is not a clinical medical diagnosis. In case of emergency or severe discomfort, please consult a certified doctor ' +
        'or contact your local emergency services immediately.'
    },
    isFallback: {
      type: Boolean,
      default: false
    },
    unrecognizedSymptoms: {
      type: [String],
      default: []
    },
    predictionProvider: {
      type: String,
      enum: ['gemini', 'ml', 'heuristic'],
      default: null
    },
    providerFallbackReason: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['completed', 'reviewing'],
      default: 'completed'
    },
    geminiInsights: {
      type: geminiInsightsSchema,
      default: null
    },
    geminiEnriched: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound index for fast paginated history queries per user
diagnosisSchema.index({ user: 1, createdAt: -1 });

// Virtual for alias `userId`
diagnosisSchema.virtual('userId').get(function () {
  return this.user;
});

// Backward compatibility virtual for `possibleConditions`
diagnosisSchema.virtual('possibleConditions').get(function () {
  if (this.topPredictions && this.topPredictions.length > 0) {
    return this.topPredictions.map((tp) => ({
      name: tp.disease,
      likelihood: `${tp.confidence}%`
    }));
  }
  return [{ name: this.predictedDisease, likelihood: `${this.confidence}%` }];
});

export default mongoose.model('Diagnosis', diagnosisSchema);
