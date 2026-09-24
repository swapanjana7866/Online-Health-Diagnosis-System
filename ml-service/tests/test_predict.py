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

def test_predict_empty_symptoms(client):
    payload = {
        "symptoms": []
    }
    response = client.post('/predict', json=payload)
    assert response.status_code == 422
