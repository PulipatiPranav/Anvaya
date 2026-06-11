"""
PyTorch FaceMeshTransformer — Flask Service (model/)

STATUS: THIS MODEL HAS 35% TEST ACCURACY (majority-class collapse).
        It predicts 'Happy' for virtually every input and should NOT be
        used in production.  The TFLite server in model2/ is the correct
        production endpoint.

This file is kept for research/retraining purposes.  The /predict endpoint
is intentionally disabled and returns a 503 with a clear message so that
accidental mis-configuration is caught immediately rather than silently
degrading detection quality.

To enable this server after retraining with a better dataset:
  1. Achieve > 70% balanced test accuracy across all classes.
  2. Remove the NOT_READY guard below.
  3. Update label_classes.json if class set changes.
"""

from flask import Flask, request, jsonify
import torch
import numpy as np
from model import FaceMeshTransformer
import json

app = Flask(__name__)

# ── Training status guard ──────────────────────────────────────────────────────
NOT_READY = True
NOT_READY_MSG = (
    "This model (facemesh_transformer.pth) achieved only 34.9% test accuracy "
    "due to training collapse (loss plateaued at epoch 2, majority-class bias). "
    "Use the TFLite service in model2/ instead.  "
    "Retrain with a larger, balanced dataset before enabling this endpoint."
)

# ── Model loading (still loads so import errors surface early) ─────────────────
with open("label_classes.json", "r") as f:
    emotion_classes = json.load(f)

model = FaceMeshTransformer(num_classes=len(emotion_classes))
model.load_state_dict(
    torch.load("facemesh_transformer.pth", map_location=torch.device("cpu"))
)
model.eval()


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":   "degraded",
        "model":    "facemesh_transformer.pth",
        "classes":  emotion_classes,
        "ready":    not NOT_READY,
        "warning":  NOT_READY_MSG,
        "test_accuracy": 0.349,
    })


@app.route("/predict", methods=["POST"])
def predict():
    if NOT_READY:
        return jsonify({
            "error":   "model_not_ready",
            "message": NOT_READY_MSG,
        }), 503

    # ── Actual inference (only reached after NOT_READY is cleared) ─────────────
    data = request.json
    landmarks = np.array(data["landmarks"])

    # Expects 468×3 = 1404 floats (z-coordinate required)
    if len(landmarks) != 1404:
        return jsonify({
            "error": f"Invalid input size: got {len(landmarks)}, expected 1404 (468 landmarks × 3D)"
        }), 400

    landmarks = landmarks.reshape(468, 3)
    input_tensor = torch.tensor(landmarks, dtype=torch.float32).unsqueeze(0)

    with torch.no_grad():
        output = model(input_tensor)
        probs  = torch.softmax(output, dim=1)[0]
        pred   = torch.argmax(probs).item()
        emotion = emotion_classes[pred]

    return jsonify({
        "emotion":       emotion,
        "probabilities": probs.tolist(),
        "confidence":    float(probs[pred]),
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=False)  # different port to avoid collision
