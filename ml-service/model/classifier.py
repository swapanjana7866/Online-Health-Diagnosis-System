import math
import json
import os

class SymptomDiseaseClassifier:
    """
    Interpretable Probabilistic Classifier for Multi-Hot Symptom Vectors.
    Employs Multivariate Bernoulli Naive Bayes with Laplace smoothing,
    designed to produce calibrated top-K differential diagnosis probabilities
    without relying on native C-extension LAPACK DLLs.
    """
    def __init__(self, alpha=1.0):
        self.alpha = alpha  # Laplace smoothing parameter
        self.classes_ = []
        self.feature_names_ = []
        self.class_priors_ = {}
        self.feature_probs_ = {}  # {class: {feature: P(feature=1 | class)}}

    def fit(self, X, y, feature_names):
        """
        Train the classifier.
        X: list of lists (binary 0/1 vectors)
        y: list of disease strings
        feature_names: list of feature name strings
        """
        self.feature_names_ = list(feature_names)
        self.classes_ = sorted(list(set(y)))
        n_samples = len(y)
        n_features = len(self.feature_names_)

        # Calculate class priors P(C)
        class_counts = {c: 0 for c in self.classes_}
        class_samples = {c: [] for c in self.classes_}

        for i, label in enumerate(y):
            class_counts[label] += 1
            class_samples[label].append(X[i])

        self.class_priors_ = {c: math.log(count / n_samples) for c, count in class_counts.items()}

        # Calculate feature probabilities P(x_i = 1 | C) with Laplace smoothing
        self.feature_probs_ = {}
        for c in self.classes_:
            samples = class_samples[c]
            n_c = len(samples)
            self.feature_probs_[c] = []

            for f_idx in range(n_features):
                # Count how many times this feature was active for class c
                count_active = sum(row[f_idx] for row in samples)
                # Smoothed probability
                p = (count_active + self.alpha) / (n_c + 2.0 * self.alpha)
                self.feature_probs_[c].append(p)

        return self

    def predict_proba(self, X):
        """
        Compute calibrated probability distributions across all classes.
        Returns: list of probability distributions (each sum to 1.0)
        """
        all_probas = []

        for row in X:
            log_scores = []
            for c in self.classes_:
                log_prob = self.class_priors_[c]
                probs_for_c = self.feature_probs_[c]

                for f_idx, val in enumerate(row):
                    p = probs_for_c[f_idx]
                    if val == 1:
                        log_prob += math.log(p)
                    else:
                        log_prob += math.log(1.0 - p)

                log_scores.append(log_prob)

            # Softmax normalization for numerical stability
            max_log = max(log_scores)
            exp_scores = [math.exp(s - max_log) for s in log_scores]
            total_exp = sum(exp_scores)
            probas = [s / total_exp for s in exp_scores]
            all_probas.append(probas)

        return all_probas

    def predict(self, X):
        """Returns the most probable class for each sample."""
        probas = self.predict_proba(X)
        predictions = []
        for p_row in probas:
            best_idx = max(range(len(p_row)), key=lambda i: p_row[i])
            predictions.append(self.classes_[best_idx])
        return predictions

    def score(self, X, y):
        """Computes prediction accuracy."""
        preds = self.predict(X)
        correct = sum(1 for true_val, pred_val in zip(y, preds) if true_val == pred_val)
        return correct / len(y) if y else 0.0
