import json
import os
import logging

from joblib import load
from flask import Flask, request

from scipy.sparse import csr_matrix
import string
import pandas as pd
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.base import TransformerMixin
from nltk.corpus import stopwords
from sklearn.base import TransformerMixin
from nltk.tokenize import sent_tokenize
from nltk.tokenize import ToktokTokenizer
from nltk.stem import WordNetLemmatizer
from nltk.corpus import wordnet
from nltk import pos_tag
from sklearn import preprocessing
from sklearn import metrics
from sklearn.svm import LinearSVC
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfTransformer
from sklearn.model_selection import GridSearchCV


app = Flask(__name__)


class MockRequest:
    def get_json(self):
        test = {
            "descriptions": "IT recruitment Consultant at SNFHL I'm an IT/SAP/CRYPTO recruiter, who likes to learn new stuff and tries some basic coding with web3 and SQL in my free time. Crypto-bro for life!"
        }
        return test


def predict_re(profile_dict):
    try:
        prediction = MODEL.predict([profile_dict["descriptions"]])
        label = ENCODER.inverse_transform(prediction)

        return {
            "label": label,
        }
    except:
        return None


@app.route("/")
def heartbeat():
    return ("1", 200, CORS_HEADERS)


@app.route("/profile", methods=["POST", "OPTIONS"])
def profile(request):
    prop = request.get_json()

    if hasattr(request, "method") and request.method == "OPTIONS":
        logging.error(f"CORS request!")
        return ("", 200, CORS_HEADERS)
    if MODEL is None:
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

    titles = {
        "descriptions": prop["descriptions"] if "descriptions" in prop else -1,
    }
    prediction = predict_re(titles)
    return (json.dumps(prediction), 200, CORS_HEADERS) if (prediction != None) else (
        json.dumps({"error": f"Unknown error in prediction!"}),
        503,
        CORS_HEADERS,
    )


@app.route("/mock_profile", methods=["GET", "POST", "OPTIONS"])
def mock_profile():
    return profile(MockRequest())


if __name__ == "__main__":
    def _get_wordnet_pos(word):
        return None

    def custom_tokenizer(sentence):
        return None

    class predictors(TransformerMixin):
        def transform(self, X, **transform_params):
            return None

        def fit(self, X, y=None, **fit_params):
            return None

        def get_params(self, deep=True):
            return None

    CORS_HEADERS = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "3600",
    }

    MODELS_DIR = os.environ.get("MODELS_DIR")
    MODELS_DIR = (
        MODELS_DIR if MODELS_DIR is not None else "./notebooks/models"
    )  # Default for cloudFunctions.
    ENCODER = load(open(f"{MODELS_DIR}/labelencoder.joblib", "rb"))
    MODEL = load(open(f"{MODELS_DIR}/model.joblib", "rb"))

    logging.info("Running from the command line...")
    app.run(host="0.0.0.0", port=800)
    mock_profile()
