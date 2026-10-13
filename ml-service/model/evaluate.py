"""Held-out evaluation of the shipped SymptomDiseaseClassifier artifact.

Reproduces the exact train/test split used by train.py (seed 42, 80/20) and
computes discrimination and calibration metrics on the held-out 20% that the
model never saw during fitting. Also measures the effect of the /predict
endpoint's primary-selection re-ranking on accuracy.

Usage:
    python evaluate.py
"""
import csv
import json
import math
import os
import pickle
import random
import sys

base_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, base_dir)
from classifier import SymptomDiseaseClassifier  # noqa: E402

data_path = os.path.join(base_dir, '..', 'data', 'dataset.csv')
model_path = os.path.join(base_dir, 'model.pkl')
diseases_path = os.path.join(base_dir, 'diseases.json')

N_BINS = 10


def load_data(csv_path):
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)
        features = header[:-1]
        X, y = [], []
        for row in reader:
            if not row:
                continue
            X.append([int(v) for v in row[:-1]])
            y.append(row[-1].strip('"'))
    return X, y, features


def expected_calibration_error(probas, labels, n_bins=N_BINS):
    """Standard equal-width-bin ECE over top-1 probabilities."""
    bins = [[] for _ in range(n_bins)]
    for conf, label in zip(probas, labels):
        idx = min(int(conf * n_bins), n_bins - 1)
        bins[idx].append((conf, label))
    ece = 0.0
    total = len(probas)
    for bucket in bins:
        if not bucket:
            continue
        acc = sum(1 for c, l in bucket if l) / len(bucket)
        avg_conf = sum(c for c, _ in bucket) / len(bucket)
        ece += (len(bucket) / total) * abs(acc - avg_conf)
    return ece


def compute_metrics(clf, X_test, y_test, feature_cols, diseases_metadata=None):
    """
    Held-out discrimination + calibration metrics for a fitted classifier.

    Returns a JSON-serializable dict; used by evaluate.py (artifact audit) and
    train.py (metrics written next to the model at training time).
    """
    probas = clf.predict_proba(X_test)
    classes = clf.classes_

    top1_correct = 0
    top3_correct = 0
    top1_probs = []
    top1_correct_flags = []
    nll = 0.0
    for row, truth, p_row in zip(X_test, y_test, probas):
        ranked = sorted(range(len(p_row)), key=lambda i: p_row[i], reverse=True)
        pred = classes[ranked[0]]
        if pred == truth:
            top1_correct += 1
        if truth in [classes[i] for i in ranked[:3]]:
            top3_correct += 1
        top1_probs.append(p_row[ranked[0]])
        top1_correct_flags.append(1 if pred == truth else 0)
        p_truth = p_row[classes.index(truth)]
        nll -= math.log(max(p_truth, 1e-12))

    n = len(y_test)
    accuracy = top1_correct / n
    top3_accuracy = top3_correct / n
    mean_nll = nll / n
    ece = expected_calibration_error(top1_probs, top1_correct_flags)
    brier = sum((p - f) ** 2 for p, f in zip(top1_probs, top1_correct_flags)) / n

    metrics = {
        'n_test': n,
        'n_classes': len(classes),
        'accuracy_top1': round(accuracy, 4),
        'accuracy_top3': round(top3_accuracy, 4),
        'accuracy_top1_pct': round(accuracy * 100, 2),
        'accuracy_top3_pct': round(top3_accuracy * 100, 2),
        'nll': round(mean_nll, 4),
        'brier_score': round(brier, 4),
        'ece_10bin': round(ece, 4),
        'mean_top1_probability': round(sum(top1_probs) / n, 4)
    }

    # --- Effect of app.py's select_primary_prediction re-ranking ---
    if diseases_metadata is not None:
        sys.path.insert(0, os.path.join(base_dir, '..'))
        from app import score_disease_overlap  # noqa: E402

        rerank_correct = 0
        rerank_flips_better = 0
        rerank_flips_worse = 0
        for row, truth, p_row in zip(X_test, y_test, probas):
            ranked = sorted(range(len(p_row)), key=lambda i: p_row[i], reverse=True)[:3]
            candidates = []
            for idx in ranked:
                name = classes[idx]
                info = diseases_metadata.get(name, {})
                overlap = score_disease_overlap(
                    name, [feature_cols[i] for i, v in enumerate(row) if v == 1]
                )
                candidates.append({
                    'name': name,
                    'final': (p_row[idx] * 100) * 0.7 + overlap * 100 * 0.3
                             + (5 if info.get('severity') == 'severe' else 0)
                })
            candidates.sort(key=lambda c: c['final'], reverse=True)
            best_before = classes[ranked[0]]
            after = candidates[0]['name']
            if after == truth:
                rerank_correct += 1
            if after != best_before:
                if after == truth:
                    rerank_flips_better += 1
                elif best_before == truth:
                    rerank_flips_worse += 1

        metrics['rerank_accuracy_pct'] = round((rerank_correct / n) * 100, 2)
        metrics['rerank_flips_better'] = rerank_flips_better
        metrics['rerank_flips_worse'] = rerank_flips_worse

    return metrics


def main():
    X, y, feature_cols = load_data(data_path)
    with open(model_path, 'rb') as f:
        clf = pickle.load(f)

    # Exact split replication from train.py
    data = list(zip(X, y))
    random.seed(42)
    random.shuffle(data)
    split_idx = int(len(data) * 0.8)
    test_data = data[split_idx:]
    X_test, y_test = zip(*test_data)
    X_test, y_test = list(X_test), list(y_test)

    with open(diseases_path, 'r', encoding='utf-8') as f:
        diseases_metadata = json.load(f)

    metrics = compute_metrics(clf, X_test, y_test, feature_cols, diseases_metadata)
    metrics['n_total'] = len(y_test) + int(split_idx)
    print(json.dumps(metrics, indent=2))

    out_path = os.path.join(base_dir, 'validation_metrics.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(metrics, f, indent=2)
    print(f'[Evaluate] Wrote {out_path}')


if __name__ == '__main__':
    main()