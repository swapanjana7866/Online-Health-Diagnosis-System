import Diagnosis from '../models/Diagnosis.js';

const recommendations = {
  mild: 'Rest, hydrate, and monitor your symptoms. Schedule a consultation if they persist.',
  moderate: 'Consider speaking with a healthcare professional within the next 24 to 48 hours.',
  severe: 'Please seek urgent medical care now. If this is an emergency, call your local emergency number.'
};

export const createDiagnosis = async (req, res) => {
  try {
    const { symptoms, duration, severity, notes } = req.body;
    if (!Array.isArray(symptoms) || symptoms.length === 0 || !duration || !severity) return res.status(400).json({ message: 'Symptoms, duration, and severity are required' });
    const diagnosis = await Diagnosis.create({ user: req.user._id, symptoms, duration, severity, notes, recommendation: recommendations[severity], possibleConditions: [{ name: 'General symptom pattern', likelihood: 'Needs review' }] });
    res.status(201).json({ diagnosis });
  } catch (error) { res.status(400).json({ message: error.message }); }
};

export const getDiagnoses = async (req, res) => res.json({ diagnoses: await Diagnosis.find({ user: req.user._id }).sort({ createdAt: -1 }) });
export const getDiagnosis = async (req, res) => {
  const diagnosis = await Diagnosis.findOne({ _id: req.params.id, user: req.user._id });
  if (!diagnosis) return res.status(404).json({ message: 'Diagnosis not found' });
  res.json({ diagnosis });
};
