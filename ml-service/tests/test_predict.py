import pytest
import sys
import os

# Add parent directory to path so app can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import app, is_loaded

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_health_endpoint(client):
    response = client.get('/health')
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "ok"
    assert data["model_loaded"] is True
    assert data["features_count"] >= 130

def test_get_symptoms(client):
    response = client.get('/symptoms')
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) >= 130
    assert "id" in data[0]
    assert "name" in data[0]

def test_predict_common_cold(client):
    payload = {
        "symptoms": ["chills", "continuous_sneezing", "cough", "runny_nose"]
    }
    response = client.post('/predict', json=payload)
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert "Common Cold" in [p["disease"] for p in data["top_predictions"]]
    assert data["confidence"] > 0
    assert len(data["top_predictions"]) == 3
    assert "not a clinical medical diagnosis" in data["disclaimer"]


def test_predict_single_symptom_returns_model_prediction(client):
    payload = {"symptoms": ["fever"]}
    response = client.post('/predict', json=payload)
    assert response.status_code == 200
    data = response.get_json()
    assert data["primary_condition"] != "Limited symptom assessment"
    assert data["confidence"] > 0
    assert data["confidence_basis"] == "model_probability"
    assert len(data["top_predictions"]) == 3
    assert data["recognized_symptoms"] == ["high_fever"]
    assert "not a clinical medical diagnosis" in data["disclaimer"]


def test_predict_with_unrecognized_symptoms(client):
    payload = {
        "symptoms": ["chills", "cough", "fictional_alien_symptom"]
    }
    response = client.post('/predict', json=payload)
    assert response.status_code == 200
    data = response.get_json()
    assert "fictional_alien_symptom" in data["unrecognized_symptoms"]
    assert "chills" in data["recognized_symptoms"]
    assert len(data["top_predictions"]) == 3

def test_predict_all_unrecognized(client):
    payload = {
        "symptoms": ["completely_invented_symptom_123"]
    }
    response = client.post('/predict', json=payload)
    assert response.status_code == 422

def test_predict_unrecognized_body_includes_code_and_suggestions(client):
    payload = {"symptoms": ["best_pizza_place", "stock_market"]}
    response = client.post('/predict', json=payload)
    assert response.status_code == 422
    data = response.get_json()
    assert data["code"] == "UNRECOGNIZED_SYMPTOMS"
    assert data["unrecognized_symptoms"] == ["best_pizza_place", "stock_market"]
    assert len(data["suggestions"]) > 0


def test_predict_ambiguous_bare_word_is_not_silently_matched(client):
    # "pain" touches every *_pain feature — it must clarify, not guess.
    payload = {"symptoms": ["pain"]}
    response = client.post('/predict', json=payload)
    assert response.status_code == 422


def test_predict_misspelled_symptoms_are_resolved(client):
    payload = {"symptoms": ["hedache", "hig fever"]}
    response = client.post('/predict', json=payload)
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["recognized_symptoms"] == ["headache", "high_fever"]
    assert data["unrecognized_symptoms"] == []


def test_predict_returns_confidence_basis_and_validation_metrics(client):
    payload = {"symptoms": ["chills", "continuous_sneezing", "cough", "runny_nose"]}
    response = client.post('/predict', json=payload)
    assert response.status_code == 200
    data = response.get_json()
    assert data["confidence_basis"] == "model_probability"
    assert "validation" in data
    assert data["validation"]["n_test"] > 0
    assert data["validation"]["accuracy_top1_pct"] > 0
    assert "ece_10bin" in data["validation"]


def test_predict_single_symptom_uses_model_probability_basis(client):
    payload = {"symptoms": ["fever"]}
    response = client.post('/predict', json=payload)
    assert response.status_code == 200
    data = response.get_json()
    assert data["confidence_basis"] == "model_probability"


def test_predict_empty_symptoms(client):
    payload = {
        "symptoms": []
    }
    response = client.post('/predict', json=payload)
    assert response.status_code == 422
