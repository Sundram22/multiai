"""
AI Chat Application Backend
Flask server with OpenRouter API integration and multi-model fallback.
Designed and Developed by Er. Sundram Tiwari
"""

import os
import requests
from flask import Flask, request, jsonify, render_template
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────

# OpenRouter API settings
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")

# Model fallback chain: try each in order until one succeeds
FALLBACK_MODELS = [
    "anthropic/claude-sonnet-4.6",
    "qwen/qwen-2.5-7b-instruct",
    "mistralai/mistral-7b-instruct-v0.1",
    "deepseek/deepseek-v3.2-speciale",
    "meta-llama/llama-3.2-3b-instruct:free",
    "google/gemma-4-31b-it:free"
]

# ─────────────────────────────────────────────
# Helper: Call OpenRouter for a specific model
# ─────────────────────────────────────────────

def call_openrouter(messages: list, model: str) -> str:
    """
    Send a chat request to OpenRouter for the given model.
    Returns the assistant's reply text.
    Raises an exception if the request fails.
    """
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5000",   # Required by OpenRouter
        "X-Title": "AI Chat App by Er. Sundram Tiwari",
    }

    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": 1024,
        "temperature": 0.7,
    }

    response = requests.post(
        OPENROUTER_API_URL,
        headers=headers,
        json=payload,
        timeout=30,
    )

    # Raise HTTPError for bad status codes
    response.raise_for_status()

    data = response.json()

    # Extract the assistant message from the response
    return data["choices"][0]["message"]["content"]


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.route("/")
def index():
    """Serve the main chat page."""
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    """
    POST /chat
    Body: { "messages": [ {"role": "user"|"assistant", "content": "..."}, ... ] }
    Returns: { "model": "model_name", "response": "text" }
    """
    body = request.get_json(silent=True)

    if not body or "messages" not in body:
        return jsonify({"error": "Request body must contain a 'messages' array."}), 400

    messages = body["messages"]

    if not OPENROUTER_API_KEY:
        return jsonify({"error": "OPENROUTER_API_KEY is not set on the server."}), 500

    # Try each model in the fallback chain
    last_error = None
    for model in FALLBACK_MODELS:
        try:
            print(f"[INFO] Trying model: {model}")
            reply = call_openrouter(messages, model)

            # Success — return the response with the model that worked
            return jsonify({
                "model": model,
                "response": reply,
            })

        except Exception as exc:
            print(f"[WARN] Model {model} failed: {exc}")
            last_error = str(exc)
            continue  # Try the next model

    # All models failed
    return jsonify({
        "error": f"All models failed. Last error: {last_error}"
    }), 502


# ─────────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 55)
    print("  AI Chat App — Designed by Er. Sundram Tiwari")
    print("  Running at: http://localhost:5000")
    print("=" * 55)
    app.run(debug=True, port=5000)
