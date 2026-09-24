import os
import csv
import json
import pickle
import random
import sys

# Ensure local imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from classifier import SymptomDiseaseClassifier

def load_data(csv_path):
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)
        features = header[:-1]
        
        X = []
        y = []
        for row in reader:
            if not row:
                continue
            X.append([int(v) for v in row[:-1]])
            y.append(row[-1].strip('"'))
            
    return X, y, features

def train():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(current_dir, '..', 'data', 'dataset.csv')
    model_output_path = os.path.join(current_dir, 'model.pkl')
    features_output_path = os.path.join(current_dir, 'features.json')

    print(f"[Training] Loading dataset from: {data_path}")
    X, y, feature_cols = load_data(data_path)
    print(f"[Training] Loaded {len(X)} samples with {len(feature_cols)} features and {len(set(y))} unique conditions.")

    # Stratified 80/20 train/test split
    data = list(zip(X, y))
    random.seed(42)
    random.shuffle(data)
    
    split_idx = int(len(data) * 0.8)
    train_data = data[:split_idx]
    test_data = data[split_idx:]

    X_train, y_train = zip(*train_data)
    X_test, y_test = zip(*test_data)

    print("[Training] Fitting SymptomDiseaseClassifier...")
    clf = SymptomDiseaseClassifier(alpha=0.5)
    clf.fit(list(X_train), list(y_train), feature_cols)

    acc = clf.score(list(X_test), list(y_test))
    print(f"\n[Training] Evaluation Accuracy: {acc * 100:.2f}%")

    if acc < 0.90:
        raise ValueError(f"Model accuracy {acc * 100:.2f}% is below the 90% threshold.")

    # Save model.pkl
    with open(model_output_path, 'wb') as f:
        pickle.dump(clf, f)
    print(f"[Training] Saved model to: {model_output_path}")

    # Save feature names list for inference vectorization
    with open(features_output_path, 'w', encoding='utf-8') as f:
        json.dump(feature_cols, f, indent=2)
    print(f"[Training] Saved feature ordering to: {features_output_path}")

    print("\n[Training] Training and artifact serialization completed successfully!")

if __name__ == '__main__':
    train()
