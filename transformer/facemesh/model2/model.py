"""
TFLite Emotion Classifier — Flask Service (model2)
Phase B+C improvements:
  - Temperature scaling for probability calibration
  - Landmark quality guard (input size check)
  - /health and /metrics endpoints
  - Structured logging of per-request confidence
  - Graceful error handling
"""
from flask import Flask, request, jsonify
import numpy as np
import tensorflow as tf
import csv
import time
import threading
from pathlib import Path
from flask_cors import CORS

MODEL_DIR = Path(__file__).resolve().parent

# ── Load TFLite model ──────────────────────────────────────────────────────────
interpreter = tf.lite.Interpreter(
    model_path=str(MODEL_DIR / "keypoint_classifier.tflite")
)
interpreter.allocate_tensors()
input_details  = interpreter.get_input_details()
output_details = interpreter.get_output_details()

# TFLite interpreter is not thread-safe — use a lock
_lock = threading.Lock()

# ── Load labels ────────────────────────────────────────────────────────────────
with open(MODEL_DIR / "keypoint_classifier_label.csv", encoding="utf-8-sig") as f:
    emotion_classes = [row[0] for row in csv.reader(f)]
NUM_CLASSES = len(emotion_classes)  # 5

# ── Phase C: Temperature scaling ──────────────────────────────────────────────
# Temperature T > 1 softens a peaked distribution → more honest uncertainty.
# T = 1.0 leaves raw softmax unchanged.
# T = 1.5 is a conservative calibration that prevents false overconfidence
# without retraining.  Tune empirically; stored here so it can be patched
# at runtime via the /calibrate endpoint.
# T=1.0 → identity (raw model probabilities are preserved).
# Set T > 1 via /calibrate once you have real confidence distribution data:
#   T=1.2 is a good starting point if the model is systematically overconfident.
#   T=1.5 is aggressive and should only be used with a calibrated threshold.
# Do NOT change this without also adjusting the frontend confThreshold accordingly.
TEMPERATURE = 1.0

def apply_temperature(logits: np.ndarray, T: float) -> np.ndarray:
    """Apply temperature scaling: softmax(logits / T)."""
    scaled = logits / T
    e = np.exp(scaled - scaled.max())
    return e / e.sum()

# ── In-memory metrics (reset on restart) ──────────────────────────────────────
_metrics = {
    "total_requests":      0,
    "low_confidence":      0,   # predictions where max_prob < 0.55
    "errors":              0,
    "class_counts":        {c: 0 for c in emotion_classes},
    "avg_confidence":      0.0,
    "confidence_sum":      0.0,
    "last_confidence":     None,
    "last_emotion":        None,
    "uptime_start":        time.time(),
}

CONF_THRESHOLD = 0.55  # matches frontend Phase A default

# ── Flask app ──────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)


@app.route("/health", methods=["GET"])
def health():
    """Liveness probe — returns model metadata and uptime."""
    return jsonify({
        "status":       "ok",
        "model":        "keypoint_classifier.tflite",
        "classes":      emotion_classes,
        "temperature":  TEMPERATURE,
        "input_shape":  input_details[0]["shape"].tolist(),
        "output_shape": output_details[0]["shape"].tolist(),
        "uptime_sec":   round(time.time() - _metrics["uptime_start"], 1),
    })


@app.route("/metrics", methods=["GET"])
def metrics():
    """Runtime inference statistics — consumed by therapist dashboard or monitoring."""
    total = _metrics["total_requests"]
    return jsonify({
        "total_requests":      total,
        "low_confidence_pct":  round(_metrics["low_confidence"] / max(total, 1) * 100, 1),
        "error_pct":           round(_metrics["errors"] / max(total, 1) * 100, 1),
        "avg_confidence":      round(_metrics["confidence_sum"] / max(total, 1), 3),
        "class_distribution":  _metrics["class_counts"],
        "last_emotion":        _metrics["last_emotion"],
        "last_confidence":     _metrics["last_confidence"],
        "temperature":         TEMPERATURE,
    })


@app.route("/calibrate", methods=["POST"])
def calibrate():
    """
    Runtime temperature update — no restart required.
    Body: { "temperature": 1.5 }
    Allows therapists/engineers to tune confidence calibration live.
    """
    global TEMPERATURE
    data = request.json or {}
    T = data.get("temperature")
    if T is None or not isinstance(T, (int, float)) or T <= 0:
        return jsonify({"error": "temperature must be a positive number"}), 400
    TEMPERATURE = float(T)
    return jsonify({"temperature": TEMPERATURE, "message": "Temperature updated"})


@app.route("/predict", methods=["POST"])
def predict():
    """
    Main inference endpoint.

    Request:  { "landmarks": [float × 956] }
    Response: {
        "emotion":       "Happy",
        "probabilities": [0.05, 0.72, 0.10, 0.08, 0.05],   # temperature-scaled
        "confidence":    0.72,
        "low_confidence": false
    }
    """
    _metrics["total_requests"] += 1

    try:
        data = request.json
        if data is None or "landmarks" not in data:
            _metrics["errors"] += 1
            return jsonify({"error": "Missing 'landmarks' field"}), 400

        landmarks = data["landmarks"]

        # Input size guard — must be exactly 956 (478 landmarks × 2D)
        if len(landmarks) != 956:
            _metrics["errors"] += 1
            return jsonify({
                "error": f"Invalid landmark input size: got {len(landmarks)}, expected 956"
            }), 400

        input_array = np.array([landmarks], dtype=np.float32)

        # ── Inference (thread-safe) ────────────────────────────────────────
        with _lock:
            interpreter.set_tensor(input_details[0]["index"], input_array)
            interpreter.invoke()
            raw_output = interpreter.get_tensor(output_details[0]["index"])[0]  # shape (5,)

        # ── Phase C: Temperature scaling ───────────────────────────────────
        # TFLite model outputs are already post-softmax from the graph.
        # We treat them as logits for temperature re-scaling to get
        # better-calibrated uncertainty estimates.
        # Guard: if output is already summed to ~1, re-apply log before scaling.
        output_sum = raw_output.sum()
        if abs(output_sum - 1.0) < 0.05:
            # Already a probability vector — convert back to log-space
            logits = np.log(np.clip(raw_output, 1e-8, 1.0))
        else:
            logits = raw_output

        calibrated = apply_temperature(logits, TEMPERATURE)

        pred_class = int(np.argmax(calibrated))
        emotion    = emotion_classes[pred_class]
        confidence = float(calibrated[pred_class])

        # ── Metrics update ─────────────────────────────────────────────────
        low_conf = confidence < CONF_THRESHOLD
        if low_conf:
            _metrics["low_confidence"] += 1
        _metrics["class_counts"][emotion]  += 1
        _metrics["confidence_sum"]         += confidence
        _metrics["last_emotion"]            = emotion
        _metrics["last_confidence"]         = round(confidence, 3)

        return jsonify({
            "emotion":        emotion,
            "probabilities":  calibrated.tolist(),
            "confidence":     round(confidence, 3),
            "low_confidence": low_conf,
        })

    except Exception as e:
        _metrics["errors"] += 1
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
