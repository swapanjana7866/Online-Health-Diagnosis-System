import os
import sys
import json
import pickle
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
is_loaded = False

MANDATORY_DISCLAIMER = (
    "MedInsight provides preliminary, AI-assisted symptom triage guidance for informational purposes only. "
    "It is not a clinical medical diagnosis. In case of emergency or severe discomfort, please consult a certified doctor "
    "or contact your local emergency services immediately."
)

def load_artifacts():
    global model, features, feature_index_map, symptoms_metadata, diseases_metadata, is_loaded

    model_path = os.path.join(model_dir, 'model.pkl')
    features_path = os.path.join(model_dir, 'features.json')
    symptoms_path = os.path.join(model_dir, 'symptoms.json')
    diseases_path = os.path.join(model_dir, 'diseases.json')

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
    Ingests patient symptoms, runs inference using the trained classifier,
    and returns top 3 predictions with calibrated confidence scores.
    """
    if not is_loaded or model is None:
        return jsonify({"detail": "Model is not loaded or unavailable."}), 503

    data = request.get_json(silent=True) or {}
    raw_symptoms = data.get('symptoms')

    if not raw_symptoms or not isinstance(raw_symptoms, list) or len(raw_symptoms) == 0:
        return jsonify({"detail": "At least one symptom must be provided in 'symptoms' array."}), 422

    # Normalize inputs
    normalized = [s.strip().lower().replace(' ', '_') for s in raw_symptoms if isinstance(s, str) and s.strip()]

    recognized = []
    unrecognized = []
    vector = [0] * len(features)

    for symptom in normalized:
        if symptom in feature_index_map:
            idx = feature_index_map[symptom]
            vector[idx] = 1
            recognized.append(symptom)
        else:
            unrecognized.append(symptom)

    if not recognized:
        return jsonify({
            "detail": "None of the provided symptoms could be recognized by the diagnostic model.",
            "unrecognized_symptoms": unrecognized
        }), 422

    # Predict probabilities
    probas = model.predict_proba([vector])[0]
    classes = model.classes_

    # Top 3 predictions sorted by probability descending
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

    primary = top_predictions[0]

    return jsonify({
        "success": True,
        "primary_condition": primary["disease"],
        "confidence": primary["confidence"],
        "severity": primary["severity"],
        "description": primary["description"],
        "top_predictions": top_predictions,
        "recognized_symptoms": recognized,
        "unrecognized_symptoms": unrecognized,
        "disclaimer": MANDATORY_DISCLAIMER
    }), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    print(f"[ML Service] Running Flask server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)
