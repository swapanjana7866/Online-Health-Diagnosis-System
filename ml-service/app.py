import os
import sys
import json
import pickle
import re
from flask import Flask, request, jsonify

# Ensure classifier class is resolvable during unpickling
base_dir = os.path.dirname(os.path.abspath(__file__))
model_dir = os.path.join(base_dir, 'model')
sys.path.insert(0, model_dir)
from classifier import SymptomDiseaseClassifier  # noqa: E402

app = Flask(__name__)

# Model and metadata holders
model = None
features = []
feature_index_map = {}
symptoms_metadata = []
diseases_metadata = {}
validation_metrics = {}
is_loaded = False

MANDATORY_DISCLAIMER = (
    "MedInsight provides preliminary, AI-assisted symptom triage guidance for informational purposes only. "
    "It is not a clinical medical diagnosis. In case of emergency or severe discomfort, please consult a certified doctor "
    "or contact your local emergency services immediately."
)

SYMPTOM_ALIASES = {
    "fever": "high_fever",
    "high_fever": "high_fever",
    "high_fever_": "high_fever",
    "low_fever": "mild_fever",
    "mild_fever": "mild_fever",
    "flu": "high_fever",
    "temperature": "high_fever",
    "feverish": "high_fever",
    "coughing": "cough",
    "sneeze": "continuous_sneezing",
    "sneezing": "continuous_sneezing",
    "nauseated": "nausea",
    "vomit": "vomiting",
    "diarrhea": "diarrhoea",
    # --- extended common words ---
    "dizzy": "dizziness",
    "tired": "fatigue",
    "tiredness": "fatigue",
    "exhausted": "fatigue",
    "sleepy": "fatigue",
    "weak": "fatigue",
    "cold": "chills",
    "shivering": "chills",
    "rash": "skin_rash",
    "itchy": "itching",
    "itch": "itching",
    "breathless": "breathlessness",
    "sob": "breathlessness",
    "shortness_of_breath": "breathlessness",
    "difficulty_breathing": "breathlessness",
    "yellow": "yellowish_skin",
    "jaundice": "yellowish_skin",
    "runny": "runny_nose",
    "constipated": "constipation",
    "sweat": "sweating",
    "backache": "back_pain",
    "belly": "stomach_pain",
    "tummy": "stomach_pain",
    "stomach_ache": "stomach_pain",
    "stomach_aches": "stomach_pain",
    "tummy_pain": "stomach_pain",
    "belly_ache": "stomach_pain",
    "bloating": "abdominal_pain",
    "palpitation": "palpitations",
    "anxious": "anxiety",
    "depressed": "depression",
    "loss_of_smell": "loss_of_smell",
    "no_smell": "loss_of_smell",
    "no_taste": "loss_of_taste",
    "sore_throat": "throat_irritation",
    "throat_pain": "throat_irritation",
    "head_ache": "headache",
    "headaches": "headache",
    "head_pain": "headache",
    "chest_tightness": "chest_pain",
    "chest_pressure": "chest_pain",
    "body_aches": "muscle_pain",
    "aching_body": "muscle_pain",
    "loose_motion": "diarrhoea",
    "loose_stools": "diarrhoea",
    "blocked_nose": "runny_nose",
    "stuffy_nose": "runny_nose",
    "nasal_congestion": "runny_nose",
    # --- body part / injury aliases ---
    "leg_pain": "joint_pain",
    "leg_break": "joint_pain",
    "leg_ache": "joint_pain",
    "broken_leg": "joint_pain",
    "knee_pain": "joint_pain",
    "ankle_pain": "joint_pain",
    "arm_pain": "joint_pain",
    "shoulder_pain": "joint_pain",
    "hip_pain": "joint_pain",
    "leg": "joint_pain",
    "arm": "muscle_pain",
    "fracture": "joint_pain",
    "sprain": "joint_pain",
    "swollen": "swelling_joints",
    "stomach_problem": "stomach_pain",
    "chest_problem": "chest_pain",
    "back_problem": "back_pain",
    "throat_problem": "throat_irritation",
    "eye_pain": "pain_behind_the_eyes",
    "ear_pain": "ear_ache",
    "body_pain": "muscle_pain",
    "weakness": "fatigue",
    "no_energy": "fatigue",
    "low_energy": "fatigue",
}


def normalize_symptom(raw_symptom):
    cleaned = raw_symptom.strip().lower()
    cleaned = re.sub(r"[^a-z0-9]+", "_", cleaned)
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    return SYMPTOM_ALIASES.get(cleaned, cleaned)


def levenshtein(a, b):
    """Classic edit-distance (iterative two-row implementation)."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def match_feature(symptom, features, feature_index_map):
    """
    Resolve a normalized symptom string to exactly one dataset feature.

    Tier 1: exact feature match.
    Tier 2: whole-word match — the symptom must equal one word of exactly one
            feature (ambiguous words like bare "pain" stay unresolved instead
            of silently mapping to an arbitrary condition).
    Tier 3: readable display-name containment, only when unique.
    Tier 4: typo-tolerant fuzzy match (edit distance within length-scaled bound).

    Returns the matched feature name or None.
    """
    # Tier 1
    if symptom in feature_index_map:
        return symptom

    # Tier 2: unique whole-word match (multiple hits are ambiguous, e.g. a
    # bare "pain" touching every *_pain feature, and stay unresolved here)
    symptom_words = [w for w in symptom.split("_") if w]
    if symptom_words:
        word_hits = set()
        for feat in features:
            if any(w == fw for w in symptom_words for fw in feat.split("_")):
                word_hits.add(feat)
        if len(word_hits) == 1:
            return next(iter(word_hits))

    # Tier 3: readable containment, only when unique
    readable = symptom.replace("_", " ")
    tier3_hits = [
        f for f in features
        if readable in f.replace("_", " ") or f.replace("_", " ") in readable
    ]
    if len(tier3_hits) == 1:
        return tier3_hits[0]

    # Tier 4: typo tolerance (edit distance). Skips very short inputs so that
    # random short words cannot collide with dataset features.
    if len(symptom) < 4:
        return None
    max_distance = 2 if len(symptom) >= 6 else 1
    best, best_distance = None, max_distance + 1
    for feat in features:
        distance = levenshtein(symptom, feat)
        if distance < best_distance:
            best, best_distance = feat, distance
    if best is not None and best_distance <= max_distance:
        return best
    return None


def nearest_features(symptom, features, limit=3):
    """Closest dataset feature names for an unrecognized input (clarification help)."""
    if not symptom:
        return []
    scored = sorted(
        ((levenshtein(symptom, feat), feat) for feat in features),
        key=lambda item: item[0]
    )
    return [feat for _, feat in scored[:limit]]


def score_disease_overlap(disease_name, recognized_symptoms):
    disease_entry = diseases_metadata.get(disease_name, {})
    core_symptoms = disease_entry.get('coreSymptoms', [])
    if not core_symptoms:
        return 0.0

    normalized_core = {normalize_symptom(symptom) for symptom in core_symptoms}
    overlap = sum(1 for symptom in recognized_symptoms if symptom in normalized_core)
    return overlap / max(len(core_symptoms), 1)


def select_primary_prediction(top_predictions, recognized_symptoms):
    if not top_predictions:
        return None

    scored = []
    for candidate in top_predictions:
        disease_name = candidate["disease"]
        overlap_score = score_disease_overlap(disease_name, recognized_symptoms)
        confidence = candidate["confidence"]
        severity_boost = 5 if candidate.get("severity") == "severe" else 0
        scored.append({
            **candidate,
            "overlap_score": overlap_score,
            "final_score": (confidence * 0.7) + (overlap_score * 100 * 0.3) + severity_boost
        })

    scored.sort(key=lambda item: item["final_score"], reverse=True)
    return scored[0]


def load_artifacts():
    global model, features, feature_index_map, symptoms_metadata, diseases_metadata, validation_metrics, is_loaded

    model_path = os.path.join(model_dir, 'model.pkl')
    features_path = os.path.join(model_dir, 'features.json')
    symptoms_path = os.path.join(model_dir, 'symptoms.json')
    diseases_path = os.path.join(model_dir, 'diseases.json')
    validation_path = os.path.join(model_dir, 'validation_metrics.json')

    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found at {model_path}. Run train.py first.")

    with open(model_path, 'rb') as f:
        model = pickle.load(f)

    with open(features_path, 'r', encoding='utf-8') as f:
        features = json.load(f)

    feature_index_map = {feat: idx for idx, feat in enumerate(features)}

    if os.path.exists(symptoms_path):
        with open(symptoms_path, 'r', encoding='utf-8') as f:
            symptoms_metadata = json.load(f)

    if os.path.exists(diseases_path):
        with open(diseases_path, 'r', encoding='utf-8') as f:
            diseases_metadata = json.load(f)

    # Held-out validation metrics produced at training time (evaluate.py /
    # train.py). Served with each prediction so confidence values are always
    # reported together with their measured accuracy and calibration.
    if os.path.exists(validation_path):
        try:
            with open(validation_path, 'r', encoding='utf-8') as f:
                validation_metrics = json.load(f)
        except (OSError, ValueError):
            validation_metrics = {}
    else:
        validation_metrics = {}

    is_loaded = True
    print(f"[ML Service] Loaded model with {len(features)} features and {len(model.classes_)} classes.")

# Load on module import
try:
    load_artifacts()
except Exception as e:
    print(f"[ML Service] Warning: Failed to load model on startup: {e}")

@app.route('/health', methods=['GET'])
def health_check():
    """Liveness probe reporting model status and feature counts."""
    return jsonify({
        "status": "ok",
        "service": "ml-inference-microservice",
        "model_loaded": is_loaded,
        "features_count": len(features),
        "classes_count": len(model.classes_) if model else 0
    }), 200

@app.route('/symptoms', methods=['GET'])
def get_symptoms():
    """Returns all available symptoms for frontend multi-select."""
    if symptoms_metadata:
        return jsonify(symptoms_metadata), 200
    
    formatted = [
        {"id": feat, "name": feat.replace('_', ' ').title()}
        for feat in features
    ]
    return jsonify(formatted), 200

@app.route('/predict', methods=['POST'])
def predict_diagnosis():
    """
    Ingests patient symptoms and runs inference against the trained model.

    Contract:
    - 422 when NO input resolves to a known symptom (caller must ask the user
      to clarify — never invent a condition for unrelated input).
    - 200 model prediction for any recognized symptom count (single symptom
      included), with `confidence_basis` describing what the confidence
      number actually is (validated model probability).
    """
    if not is_loaded or model is None:
        return jsonify({"detail": "Model is not loaded or unavailable."}), 503

    data = request.get_json(silent=True) or {}
    raw_symptoms = data.get('symptoms')

    if not raw_symptoms or not isinstance(raw_symptoms, list) or len(raw_symptoms) == 0:
        return jsonify({"detail": "At least one symptom must be provided in 'symptoms' array."}), 422

    # Step 1: Normalize + alias resolution
    normalized = []
    for symptom in raw_symptoms:
        if not isinstance(symptom, str) or not symptom.strip():
            continue
        normalized.append(normalize_symptom(symptom))

    # Step 2: Resolve each symptom to a dataset feature (exact → unique word →
    # readable containment → typo-tolerant fuzzy match)
    recognized = []
    unrecognized = []
    vector = [0] * len(features)

    for symptom in normalized:
        match = match_feature(symptom, features, feature_index_map)
        if match:
            vector[feature_index_map[match]] = 1
            if match not in recognized:
                recognized.append(match)
        else:
            unrecognized.append(symptom)

    # Nothing resolved: ask the caller to clarify instead of guessing.
    if not recognized:
        suggestions = []
        for symptom in unrecognized:
            for candidate in nearest_features(symptom, features):
                if candidate not in suggestions:
                    suggestions.append(candidate)
        return jsonify({
            "success": False,
            "code": "UNRECOGNIZED_SYMPTOMS",
            "detail": (
                "The symptom(s) you entered were not found in the diagnostic dataset. "
                "Please try selecting from the symptom list, or rephrase your symptom."
            ),
            "unrecognized_symptoms": unrecognized,
            "suggestions": suggestions[:5]
        }), 422

    # Step 3: Run model inference
    probas = model.predict_proba([vector])[0]
    classes = model.classes_

    top_indices = sorted(range(len(probas)), key=lambda i: probas[i], reverse=True)[:3]

    top_predictions = []
    for idx in top_indices:
        disease_name = classes[idx]
        conf = float(probas[idx] * 100)
        info = diseases_metadata.get(disease_name, {})
        top_predictions.append({
            "disease": disease_name,
            "confidence": round(conf, 1),
            "severity": info.get('severity', 'moderate'),
            "description": info.get('description', 'A medical condition matching the recorded symptoms.')
        })

    # Step 4: Select primary — absolute fallback ensures we always get one
    primary = select_primary_prediction(top_predictions, recognized)
    if primary is None:
        best_idx = top_indices[0]
        disease_name = classes[best_idx]
        info = diseases_metadata.get(disease_name, {})
        primary = {
            "disease": disease_name,
            "confidence": round(float(probas[best_idx] * 100), 1),
            "severity": info.get('severity', 'moderate'),
            "description": info.get('description', 'A medical condition matching the recorded symptoms.'),
            "overlap_score": 0.0
        }

    # Step 5: Determine if low-confidence advisory should be shown
    is_low_confidence = (
        primary["confidence"] < 30 or
        (primary.get("overlap_score", 1.0) < 0.15 and len(recognized) <= 2)
    )

    response = {
        "success": True,
        "primary_condition": primary["disease"],
        "confidence": primary["confidence"],
        "confidence_basis": "model_probability",
        "validation": validation_metrics,
        "severity": primary.get("severity", "moderate"),
        "description": primary.get("description", "A medical condition matching the recorded symptoms."),
        "top_predictions": top_predictions,
        "recognized_symptoms": recognized,
        "unrecognized_symptoms": unrecognized,
        "disclaimer": MANDATORY_DISCLAIMER
    }

    if is_low_confidence:
        response["low_confidence"] = True
        response["low_confidence_message"] = (
            f"{len(recognized)} symptom(s) provided — "
            "this is a preliminary estimate. Add more symptoms for a more accurate assessment."
        )

    return jsonify(response), 200


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    print(f"[ML Service] Running Flask server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)
