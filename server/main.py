import json
import os
import logging
import pandas as pd

from joblib import load
from flask import Flask, request

app = Flask(__name__)

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "3600",
}

MODELS_DIR = os.environ.get("MODELS_DIR")
MODELS_DIR = (
    MODELS_DIR if MODELS_DIR is not None else "./models"
)  # Default for cloudFunctions.
MODELS_RE = load(open(f"{MODELS_DIR}/realestate.sav", "rb"))


class MockRequest:
    def get_json(self):
        test = {
            "price": 100,
            "l_id": 1079,
            "pt_id": 0,
            "cnd_id": 2,
            "age": 57,
            "g_m2": 80,
            "l_m2": 1243,
            "rooms": 2,
            "floors": -1,
        }
        return test


def predict_re(profile_dict):

    p = MODELS_RE.predict([profile_dict["descriptions"]])[0]
    p = round(p, 2)

    return {
        "class": p,
    }


@app.route("/")
def heartbeat():
    return ("1", 200, CORS_HEADERS)


@app.route("/appraise", methods=["POST", "OPTIONS"])
def appraise(request):
    prop = request.get_json()

    if hasattr(request, "method") and request.method == "OPTIONS":
        logging.error(f"CORS request!")
        return ("", 200, CORS_HEADERS)
    if MODELS_RE is None:
        raise RuntimeError("RE MODEL cannot be None!")
    if (
        hasattr(request, "headers")
        and "content-type" in request.headers
        and request.headers["content-type"] != "application/json"
    ):
        ct = request.headers["content-type"]
        return (
            json.dumps({"error": f"Unknown content type: {ct}!"}),
            400,
            CORS_HEADERS,
        )

    if prop is None:
        return (json.dumps({"error": "No features passed!"}), 400, CORS_HEADERS)

    house_dict = {
        "c_id": prop["c_id"] if "c_id" in prop else -1,
        "l_id": prop["l_id"] if "l_id" in prop else -1,
        "ht_fts": prop["ht_fts"] if "ht_fts" in prop else -1,
        "am_fts": prop["am_fts"] if "am_fts" in prop else -1,
        "pt_id": prop["pt_id"] if "pt_id" in prop else -1,
        "cnd_id": prop["cnd_id"] if "cnd_id" in prop else -1,
        "age": prop["age"] if "age" in prop else -1,
        "g_m2": prop["g_m2"] if "g_m2" in prop else -1,
        "l_m2": prop["l_m2"] if "l_m2" in prop else -1,
        "r_n": prop["r_n"] if "r_n" in prop else -1,
        "f_n": prop["f_n"] if "f_n" in prop else -1,
    }
    p = predict_re(house_dict)
    return (json.dumps(p), 200, CORS_HEADERS)


@app.route("/mock_appraise", methods=["GET", "POST", "OPTIONS"])
def mock_appraise():
    return appraise(MockRequest())


if __name__ == "__main__":
    logging.info("Running from the command line...")
    mock_appraise()
