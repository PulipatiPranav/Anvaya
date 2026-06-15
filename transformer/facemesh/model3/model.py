from flask import Flask, request, jsonify
import numpy as np
import tensorflow as tf
import csv
from pathlib import Path
from flask_cors import CORS

MODEL_DIR = Path(__file__).resolve().parent

# Load TFLite model
interpreter = tf.lite.Interpreter(model_path=str(MODEL_DIR / "keypoint_classifier.tflite"))
interpreter.allocate_tensors()

# Get input and output tensors.
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

# Load labels
with open(MODEL_DIR / "keypoint_classifier_label.csv", encoding="utf-8-sig") as f:
    emotion_classes = [row[0] for row in csv.reader(f)]

app = Flask(__name__)
CORS(app)

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.json
        landmarks = data["landmarks"]  # Expecting a flat list of 956 floats
        
        # Validate input size
        if len(landmarks) != 956:
            return jsonify({"error": "Invalid landmark input size"}), 400

        input_array = np.array([landmarks], dtype=np.float32)
        interpreter.set_tensor(input_details[0]['index'], input_array)
        interpreter.invoke()
        output_data = interpreter.get_tensor(output_details[0]['index'])

        pred_class = int(np.argmax(output_data))
        emotion = emotion_classes[pred_class]

        return jsonify({
            "emotion": emotion,
            "probabilities": output_data[0].tolist()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
