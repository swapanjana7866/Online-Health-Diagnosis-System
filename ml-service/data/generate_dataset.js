import fs from 'fs';
import path from 'path';

// Standard 132 Symptoms from the Kaggle Disease Prediction Benchmark
export const symptoms = [
  'itching', 'skin_rash', 'nodal_skin_eruptions', 'continuous_sneezing', 'shivering',
  'chills', 'joint_pain', 'stomach_pain', 'acidity', 'ulcers_on_tongue',
  'muscle_wasting', 'vomiting', 'burning_micturition', 'spotting_urination', 'fatigue',
  'weight_gain', 'anxiety', 'cold_hands_and_feets', 'mood_swings', 'weight_loss',
  'restlessness', 'lethargy', 'patches_in_throat', 'irregular_sugar_level', 'cough',
  'high_fever', 'sunken_eyes', 'breathlessness', 'sweating', 'dehydration',
  'indigestion', 'headache', 'yellowish_skin', 'dark_urine', 'nausea',
  'loss_of_appetite', 'pain_behind_the_eyes', 'back_pain', 'constipation', 'abdominal_pain',
  'diarrhoea', 'mild_fever', 'yellow_urine', 'yellowing_of_eyes', 'acute_liver_failure',
  'fluid_overload', 'swelling_of_stomach', 'swelled_lymph_nodes', 'malaise', 'blurred_and_distorted_vision',
  'phlegm', 'throat_irritation', 'redness_of_eyes', 'sinus_pressure', 'runny_nose',
  'congestion', 'chest_pain', 'weakness_in_limbs', 'fast_heart_rate', 'pain_during_bowel_movements',
  'pain_in_anal_region', 'bloody_stool', 'irritation_in_anus', 'neck_pain', 'dizziness',
  'cramps', 'bruising', 'obesity', 'swollen_legs', 'swollen_blood_vessels',
  'puffy_face_and_eyes', 'enlarged_thyroid', 'brittle_nails', 'swollen_extremeties', 'excessive_hunger',
  'extra_marital_contacts', 'drying_and_tingling_lips', 'slurred_speech', 'knee_pain', 'hip_joint_pain',
  'muscle_weakness', 'stiff_neck', 'swelling_joints', 'movement_stiffness', 'spinning_movements',
  'loss_of_balance', 'unsteadiness', 'weakness_of_one_body_side', 'loss_of_smell', 'bladder_discomfort',
  'foul_smell_of_urine', 'continuous_feel_of_urine', 'passage_of_gases', 'internal_itching', 'toxic_look_(typhos)',
  'depression', 'irritability', 'muscle_pain', 'altered_sensorium', 'red_spots_over_body',
  'belly_pain', 'abnormal_menstruation', 'dischromic_patches', 'watering_from_eyes', 'increased_appetite',
  'polyuria', 'family_history', 'mucoid_sputum', 'rusty_sputum', 'lack_of_concentration',
  'visual_disturbances', 'receiving_blood_transfusion', 'receiving_unsterile_injections', 'coma', 'stomach_bleeding',
  'distention_of_abdomen', 'history_of_alcohol_consumption', 'fluid_overload.1', 'blood_in_sputum', 'prominent_veins_on_calf',
  'palpitations', 'painful_walking', 'pus_filled_pimples', 'blackheads', 'scurring',
  'skin_peeling', 'silver_like_dusting', 'small_dents_in_nails', 'inflammatory_nails', 'blister',
  'red_sore_around_nose', 'yellow_crust_ooze'
];

// Disease Profiles with their characteristic symptom patterns and clinical summaries
export const diseaseProfiles = {
  'Fungal infection': {
    severity: 'mild',
    description: 'A fungal skin infection characterized by itching, rash, and localized discolored skin patches.',
    coreSymptoms: ['itching', 'skin_rash', 'nodal_skin_eruptions', 'dischromic_patches']
  },
  'Allergy': {
    severity: 'mild',
    description: 'An immune response causing continuous sneezing, shivering, chills, and watery eyes.',
    coreSymptoms: ['continuous_sneezing', 'shivering', 'chills', 'watering_from_eyes']
  },
  'GERD': {
    severity: 'moderate',
    description: 'Gastroesophageal reflux disease leading to stomach acidity, heartburn, ulcers on tongue, and chest discomfort.',
    coreSymptoms: ['stomach_pain', 'acidity', 'ulcers_on_tongue', 'vomiting', 'cough', 'chest_pain']
  },
  'Chronic cholestasis': {
    severity: 'moderate',
    description: 'Impairment of bile flow leading to itching, vomiting, yellowish skin, nausea, and yellowing of eyes.',
    coreSymptoms: ['itching', 'vomiting', 'yellowish_skin', 'nausea', 'loss_of_appetite', 'yellowing_of_eyes']
  },
  'Peptic ulcer disease': {
    severity: 'moderate',
    description: 'Sores on the inner stomach lining causing burning stomach pain, vomiting, indigestion, and passage of gases.',
    coreSymptoms: ['vomiting', 'indigestion', 'loss_of_appetite', 'abdominal_pain', 'passage_of_gases']
  },
  'AIDS': {
    severity: 'severe',
    description: 'Immune deficiency caused by HIV presenting with muscle wasting, patches in throat, and high fever.',
    coreSymptoms: ['muscle_wasting', 'patches_in_throat', 'high_fever', 'extra_marital_contacts']
  },
  'Diabetes': {
    severity: 'moderate',
    description: 'Metabolic disorder resulting in fatigue, weight loss, restlessness, irregular sugar levels, and polyuria.',
    coreSymptoms: ['fatigue', 'weight_loss', 'restlessness', 'irregular_sugar_level', 'increased_appetite', 'polyuria']
  },
  'Gastroenteritis': {
    severity: 'moderate',
    description: 'Inflammation of the digestive tract causing vomiting, sunken eyes, dehydration, and diarrhoea.',
    coreSymptoms: ['vomiting', 'sunken_eyes', 'dehydration', 'diarrhoea']
  },
  'Bronchial Asthma': {
    severity: 'severe',
    description: 'Chronic inflammatory airway disease presenting with fatigue, cough, high fever, breathlessness, and phlegm.',
    coreSymptoms: ['fatigue', 'cough', 'high_fever', 'breathlessness', 'mucoid_sputum']
  },
  'Hypertension': {
    severity: 'moderate',
    description: 'Persistently elevated arterial blood pressure presenting with headache, chest pain, dizziness, and lack of concentration.',
    coreSymptoms: ['headache', 'chest_pain', 'dizziness', 'loss_of_balance', 'lack_of_concentration']
  },
  'Migraine': {
    severity: 'moderate',
    description: 'Neurological headache condition causing severe throbbing headache, acidity, blurred vision, and visual disturbances.',
    coreSymptoms: ['acidity', 'indigestion', 'headache', 'blurred_and_distorted_vision', 'excessive_hunger', 'visual_disturbances']
  },
  'Cervical spondylosis': {
    severity: 'mild',
    description: 'Age-related wear and tear affecting spinal disks in the neck causing neck pain, dizziness, and loss of balance.',
    coreSymptoms: ['back_pain', 'neck_pain', 'dizziness', 'loss_of_balance']
  },
  'Paralysis (brain hemorrhage)': {
    severity: 'severe',
    description: 'Sudden neurological impairment resulting in vomiting, headache, weakness in limbs, and weakness of one body side.',
    coreSymptoms: ['vomiting', 'headache', 'weakness_in_limbs', 'altered_sensorium', 'weakness_of_one_body_side']
  },
  'Jaundice': {
    severity: 'moderate',
    description: 'Hyperbilirubinemia leading to yellowish skin, yellowing of eyes, dark urine, and vomiting.',
    coreSymptoms: ['itching', 'vomiting', 'fatigue', 'weight_loss', 'high_fever', 'yellowish_skin', 'dark_urine', 'yellowing_of_eyes']
  },
  'Malaria': {
    severity: 'severe',
    description: 'Mosquito-borne infectious illness characterized by chills, vomiting, high fever, sweating, and severe headache.',
    coreSymptoms: ['chills', 'vomiting', 'high_fever', 'sweating', 'headache', 'nausea', 'muscle_pain']
  },
  'Chicken pox': {
    severity: 'moderate',
    description: 'Viral varicella-zoster infection causing itching, skin rash, fatigue, high fever, and red spots over body.',
    coreSymptoms: ['itching', 'skin_rash', 'fatigue', 'lethargy', 'high_fever', 'headache', 'loss_of_appetite', 'mild_fever', 'red_spots_over_body']
  },
  'Dengue': {
    severity: 'severe',
    description: 'Vector-borne viral fever causing skin rash, chills, joint pain, vomiting, high fever, and pain behind the eyes.',
    coreSymptoms: ['skin_rash', 'chills', 'joint_pain', 'vomiting', 'fatigue', 'high_fever', 'headache', 'nausea', 'loss_of_appetite', 'pain_behind_the_eyes', 'back_pain', 'muscle_pain', 'red_spots_over_body']
  },
  'Typhoid': {
    severity: 'severe',
    description: 'Salmonella infection presenting with chills, vomiting, fatigue, high fever, headache, nausea, and toxic look.',
    coreSymptoms: ['chills', 'vomiting', 'fatigue', 'high_fever', 'headache', 'nausea', 'constipation', 'abdominal_pain', 'diarrhoea', 'toxic_look_(typhos)', 'belly_pain']
  },
  'hepatitis A': {
    severity: 'moderate',
    description: 'Acute viral hepatitis presenting with joint pain, vomiting, yellowish skin, dark urine, and loss of appetite.',
    coreSymptoms: ['joint_pain', 'vomiting', 'yellowish_skin', 'dark_urine', 'nausea', 'loss_of_appetite', 'abdominal_pain', 'diarrhoea', 'mild_fever', 'yellowing_of_eyes']
  },
  'Hepatitis B': {
    severity: 'severe',
    description: 'Chronic viral hepatitis causing itching, fatigue, yellowish skin, dark urine, yellow urine, and yellowing of eyes.',
    coreSymptoms: ['itching', 'fatigue', 'lethargy', 'yellowish_skin', 'dark_urine', 'loss_of_appetite', 'abdominal_pain', 'yellow_urine', 'yellowing_of_eyes', 'receiving_blood_transfusion', 'receiving_unsterile_injections']
  },
  'Hepatitis C': {
    severity: 'severe',
    description: 'Blood-borne viral hepatitis causing fatigue, yellowish skin, nausea, loss of appetite, and yellowing of eyes.',
    coreSymptoms: ['fatigue', 'yellowish_skin', 'nausea', 'loss_of_appetite', 'yellowing_of_eyes', 'family_history']
  },
  'Hepatitis D': {
    severity: 'severe',
    description: 'Serious co-infection causing joint pain, vomiting, fatigue, yellowish skin, dark urine, and abdominal pain.',
    coreSymptoms: ['joint_pain', 'vomiting', 'fatigue', 'yellowish_skin', 'dark_urine', 'nausea', 'loss_of_appetite', 'abdominal_pain', 'yellowing_of_eyes']
  },
  'Hepatitis E': {
    severity: 'moderate',
    description: 'Waterborne liver infection causing joint pain, vomiting, fatigue, high fever, yellowish skin, and dark urine.',
    coreSymptoms: ['joint_pain', 'vomiting', 'fatigue', 'high_fever', 'yellowish_skin', 'dark_urine', 'nausea', 'loss_of_appetite', 'abdominal_pain', 'yellowing_of_eyes', 'acute_liver_failure', 'coma', 'stomach_bleeding']
  },
  'Alcoholic hepatitis': {
    severity: 'severe',
    description: 'Liver inflammation caused by heavy alcohol consumption causing vomiting, yellowish skin, and abdominal distention.',
    coreSymptoms: ['vomiting', 'yellowish_skin', 'abdominal_pain', 'swelling_of_stomach', 'distention_of_abdomen', 'history_of_alcohol_consumption', 'fluid_overload']
  },
  'Tuberculosis': {
    severity: 'severe',
    description: 'Bacterial lung infection causing chills, vomiting, fatigue, weight loss, cough, high fever, breathlessness, and blood in sputum.',
    coreSymptoms: ['chills', 'vomiting', 'fatigue', 'weight_loss', 'cough', 'high_fever', 'breathlessness', 'sweating', 'loss_of_appetite', 'mild_fever', 'phlegm', 'chest_pain', 'blood_in_sputum']
  },
  'Common Cold': {
    severity: 'mild',
    description: 'Viral upper respiratory tract infection with continuous sneezing, chills, fatigue, cough, and runny nose.',
    coreSymptoms: ['continuous_sneezing', 'chills', 'fatigue', 'cough', 'high_fever', 'headache', 'swelled_lymph_nodes', 'malaise', 'phlegm', 'throat_irritation', 'redness_of_eyes', 'sinus_pressure', 'runny_nose', 'congestion', 'chest_pain', 'loss_of_smell', 'muscle_pain']
  },
  'Pneumonia': {
    severity: 'severe',
    description: 'Lung infection causing chills, fatigue, cough, high fever, breathlessness, sweating, chest pain, and fast heart rate.',
    coreSymptoms: ['chills', 'fatigue', 'cough', 'high_fever', 'breathlessness', 'sweating', 'malaise', 'phlegm', 'chest_pain', 'fast_heart_rate', 'rusty_sputum']
  },
  'Dimorphic hemmorhoids(piles)': {
    severity: 'moderate',
    description: 'Swollen veins in the lower rectum causing constipation, pain during bowel movements, bloody stool, and anal irritation.',
    coreSymptoms: ['constipation', 'pain_during_bowel_movements', 'pain_in_anal_region', 'bloody_stool', 'irritation_in_anus']
  },
  'Heart attack': {
    severity: 'severe',
    description: 'Critical cardiovascular event presenting with chest pain, vomiting, breathlessness, sweating, and palpitations.',
    coreSymptoms: ['vomiting', 'breathlessness', 'sweating', 'chest_pain']
  },
  'Varicose veins': {
    severity: 'mild',
    description: 'Enlarged, twisted veins in the legs causing cramps, bruising, obesity, swollen legs, and prominent veins on calves.',
    coreSymptoms: ['cramps', 'bruising', 'obesity', 'swollen_legs', 'swollen_blood_vessels', 'prominent_veins_on_calf']
  },
  'Hypothyroidism': {
    severity: 'moderate',
    description: 'Underactive thyroid gland causing fatigue, weight gain, cold hands/feet, mood swings, lethargy, and brittle nails.',
    coreSymptoms: ['fatigue', 'weight_gain', 'cold_hands_and_feets', 'mood_swings', 'lethargy', 'dizziness', 'puffy_face_and_eyes', 'enlarged_thyroid', 'brittle_nails', 'swollen_extremeties', 'depression', 'irritability', 'abnormal_menstruation']
  },
  'Hyperthyroidism': {
    severity: 'moderate',
    description: 'Overactive thyroid gland causing fatigue, mood swings, weight loss, restlessness, sweating, and fast heart rate.',
    coreSymptoms: ['fatigue', 'mood_swings', 'weight_loss', 'restlessness', 'sweating', 'diarrhoea', 'fast_heart_rate', 'excessive_hunger', 'muscle_weakness', 'irritability', 'abnormal_menstruation']
  },
  'Hypoglycemia': {
    severity: 'moderate',
    description: 'Low blood sugar presenting with vomiting, fatigue, anxiety, sweating, headache, nausea, and palpitations.',
    coreSymptoms: ['vomiting', 'fatigue', 'anxiety', 'sweating', 'headache', 'nausea', 'blurred_and_distorted_vision', 'excessive_hunger', 'drying_and_tingling_lips', 'slurred_speech', 'irritability', 'palpitations']
  },
  'Osteoarthristis': {
    severity: 'moderate',
    description: 'Degenerative joint disease leading to joint pain, neck pain, knee pain, hip joint pain, and painful walking.',
    coreSymptoms: ['joint_pain', 'neck_pain', 'knee_pain', 'hip_joint_pain', 'swelling_joints', 'painful_walking']
  },
  'Arthritis': {
    severity: 'moderate',
    description: 'Joint inflammation causing muscle weakness, stiff neck, swelling joints, and movement stiffness.',
    coreSymptoms: ['muscle_weakness', 'stiff_neck', 'swelling_joints', 'movement_stiffness', 'painful_walking']
  },
  '(vertigo) Paroymsal  Positional Vertigo': {
    severity: 'mild',
    description: 'Inner ear balance condition causing vomiting, headache, nausea, spinning movements, loss of balance, and unsteadiness.',
    coreSymptoms: ['vomiting', 'headache', 'nausea', 'spinning_movements', 'loss_of_balance', 'unsteadiness']
  },
  'Acne': {
    severity: 'mild',
    description: 'Common skin condition resulting in skin rash, pus-filled pimples, blackheads, and scarring.',
    coreSymptoms: ['skin_rash', 'pus_filled_pimples', 'blackheads', 'scurring']
  },
  'Urinary tract infection': {
    severity: 'moderate',
    description: 'Bacterial infection of the urinary system causing burning micturition, bladder discomfort, foul urine smell, and continuous urge.',
    coreSymptoms: ['burning_micturition', 'bladder_discomfort', 'foul_smell_of_urine', 'continuous_feel_of_urine']
  },
  'Psoriasis': {
    severity: 'moderate',
    description: 'Chronic skin disease causing skin rash, joint pain, skin peeling, silver-like dusting, and small dents in nails.',
    coreSymptoms: ['skin_rash', 'joint_pain', 'skin_peeling', 'silver_like_dusting', 'small_dents_in_nails', 'inflammatory_nails']
  },
  'Impetigo': {
    severity: 'mild',
    description: 'Contagious bacterial skin infection presenting with skin rash, high fever, blister, red sore around nose, and yellow crust ooze.',
    coreSymptoms: ['skin_rash', 'high_fever', 'blister', 'red_sore_around_nose', 'yellow_crust_ooze']
  }
};

export function generateDataset(samplesPerDisease = 120) {
  const rows = [];
  const header = [...symptoms, 'prognosis'].join(',');
  rows.push(header);

  for (const [disease, profile] of Object.entries(diseaseProfiles)) {
    const core = profile.coreSymptoms;

    for (let i = 0; i < samplesPerDisease; i++) {
      const vector = {};
      symptoms.forEach(s => vector[s] = 0);

      // Core symptoms are present with high probability (80% - 100%)
      core.forEach(s => {
        if (Math.random() > 0.15 || core.length <= 3) {
          vector[s] = 1;
        }
      });

      // Ensure at least 2 symptoms are present
      const activeCount = Object.values(vector).filter(v => v === 1).length;
      if (activeCount < 2) {
        core.slice(0, 2).forEach(s => vector[s] = 1);
      }

      // Add slight random noise (5% chance of 1 incidental symptom)
      if (Math.random() < 0.08) {
        const randomSymptom = symptoms[Math.floor(Math.random() * symptoms.length)];
        vector[randomSymptom] = 1;
      }

      const rowValues = symptoms.map(s => vector[s]);
      rowValues.push(`"${disease}"`);
      rows.push(rowValues.join(','));
    }
  }

  return rows.join('\n');
}

// Generate files
const dataDir = path.resolve('ml-service/data');
const modelDir = path.resolve('ml-service/model');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir, { recursive: true });

const csvContent = generateDataset(120);
fs.writeFileSync(path.join(dataDir, 'dataset.csv'), csvContent, 'utf8');
console.log(`Generated dataset.csv with ${Object.keys(diseaseProfiles).length * 120} rows and ${symptoms.length} symptom features.`);

// Also write metadata
const symptomMetadata = symptoms.map(s => ({
  id: s,
  name: s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}));
fs.writeFileSync(path.join(modelDir, 'symptoms.json'), JSON.stringify(symptomMetadata, null, 2), 'utf8');
fs.writeFileSync(path.join(modelDir, 'diseases.json'), JSON.stringify(diseaseProfiles, null, 2), 'utf8');
console.log('Saved symptoms.json and diseases.json metadata files.');
