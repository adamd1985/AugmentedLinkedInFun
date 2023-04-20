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
import string
import pandas as pd
import nltk
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.base import TransformerMixin
from nltk.corpus import stopwords
from sklearn.base import TransformerMixin
from nltk.tokenize import sent_tokenize
from nltk.tokenize import ToktokTokenizer
from nltk.stem import WordNetLemmatizer
from nltk.corpus import wordnet 
from nltk import pos_tag

from flask_cors import CORS



# nltk.download('all')

NGRAMS = (2,2) # BGrams only
STOP_WORDS = stopwords.words('english')
SYMBOLS = " ".join(string.punctuation).split(" ") + ["-", "...", "”", "”", "|", "#"]
COMMON_WORDS = [] # to be populated later in our analysis
toktok = ToktokTokenizer()
wnl = WordNetLemmatizer()

from transformers import RobertaTokenizer, TFRobertaModel
import tensorflow as tf

app = Flask(__name__)
CORS(app)

# These functions will be referred to by the unpickled object.
def _get_wordnet_pos(word):
    tag = pos_tag([word])[0][1][0].upper()
    tag_dict = {"J": wordnet.ADJ,
                "N": wordnet.NOUN,
                "V": wordnet.VERB,
                "R": wordnet.ADV}

    return tag_dict.get(tag, wordnet.NOUN)

# Creating our tokenizer function. Can also use a TFIDF
def custom_tokenizer(sentence):
    # Let's use some speed here.
    tokens = [toktok.tokenize(sent) for sent in sent_tokenize(sentence)]
    tokens = [wnl.lemmatize(word, _get_wordnet_pos(word)) for word in tokens[0]]
    tokens = [word.lower().strip() for word in tokens]
    tokens = [tok for tok in tokens if (tok not in STOP_WORDS and tok not in SYMBOLS and tok not in COMMON_WORDS)]

    return tokens
def clean_text(text):
    if (type(text) == str):
        text = text.strip().replace("\n", " ").replace("\r", " ")
        text = text.lower()
    else:
        text = "NA"
    return text
class predictors(TransformerMixin):
    def transform(self, X, **transform_params):
        return [clean_text(text) for text in X]

    def fit(self, X, y=None, **fit_params):
        return self

    def get_params(self, deep=True):
        return {}
    
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

ROB_TOK = RobertaTokenizer.from_pretrained('roberta-base')
MASK_TOKEN = ROB_TOK.mask_token
ROB_MODEL = TFRobertaModel.from_pretrained(f"{MODELS_DIR}/roberta-retrained", from_pt=True)
import random
from transformers import pipeline
ROB_MODEL_CLF = pipeline("fill-mask", model=f"{MODELS_DIR}/roberta-retrained", tokenizer=ROB_TOK)


def predict_chat():
    try:
        chats = \
            f"Let’s talk about your {MASK_TOKEN}! I am looking for new {MASK_TOKEN} for the fintech company Blackrock to further increase its {MASK_TOKEN}.\
            Based on your {MASK_TOKEN}, I believe you, {MASK_TOKEN}, could be {MASK_TOKEN} in our {MASK_TOKEN}.\
            Find the details here: https://careers.blackrock.com/job/16845601/ {MASK_TOKEN}\
            If you're {MASK_TOKEN}, please let me know your {MASK_TOKEN} and your {MASK_TOKEN} for a {MASK_TOKEN}.\
            What {MASK_TOKEN} Blackrock {MASK_TOKEN} {MASK_TOKEN}?: {MASK_TOKEN}\
            {MASK_TOKEN}, {MASK_TOKEN}, and {MASK_TOKEN}."

        answer = ROB_MODEL_CLF(chats)
        new_chats = chats
        toks = []
        for ans in answer:
            toks.append(random.choice(ans)['token_str'])
        toks

        for tok in toks:
            new_chats = new_chats.replace(MASK_TOKEN, tok, 1)
        new_chats
        
        return {
            "messages": new_chats
        }
    except Exception as e:
       app.logger.error(f'We got this error: {e}')
       return None

def predict_profile(profile_dict):
    try:
        prediction = MODEL.predict([profile_dict["descriptions"]])
        label = ENCODER.inverse_transform(prediction)
        pp = MODEL.predict_proba([profile_dict["descriptions"]])

        position = ''
        if label[0] == "o":
            position = "Engineering"
        elif label[0] == "c":
            position =  "CFA"
        elif label[0] == "s":
            position =  "HR"
        elif label[0] == "f":
            position =  "Product Management"
        elif label[0] == "w":
            position =  "Managing Director"
        else:
            position = "Analyst"

        proba = round(pp[0][prediction][0]*100, 2)
        return {
            "label": position,
            "proba": proba
        }
    except Exception as e:
       app.logger.error(f'We got this error: {e}')
       return None

@app.route("/")
def heartbeat():
    return ("1", 200, CORS_HEADERS)


@app.route("/profile", methods=["POST"])
def profile():
    prop = request.get_json()

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
    prediction = predict_profile(titles)
    return (json.dumps(prediction), 200, CORS_HEADERS) if (prediction != None) else (
        json.dumps({"error": f"Unknown error in prediction!"}),
        503,
        CORS_HEADERS,
    )

@app.route("/messages", methods=["POST"])
def messages():
    prop = request.get_json()

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

    profile = {
        "profiles": prop["profiles"] if "profiles" in prop else -1,
    }
    prediction = predict_chat()
    return (json.dumps(prediction), 200, CORS_HEADERS) if (prediction != None) else (
        json.dumps({"error": f"Unknown error in prediction!"}),
        503,
        CORS_HEADERS,
    )


@app.route("/mock_profile", methods=["GET", "POST", "OPTIONS"])
def mock_profile():
    test = {
            "descriptions": "IT recruitment Consultant at SNFHL I'm an IT/SAP/CRYPTO recruiter, who likes to learn new stuff and tries some basic coding with web3 and SQL in my free time. Crypto-bro for life!"
        }
    prediction = predict_profile(test)
    return (json.dumps(prediction), 200) if (prediction != None) else (
        json.dumps({"error": f"Unknown error in prediction!"}),
        503,
        CORS_HEADERS,
    )


@app.route("/mock_messages", methods=["GET", "POST", "OPTIONS"])
def mock_messages():
    test = {
            "descriptions": "IT recruitment Consultant at SNFHL I'm an IT/SAP/CRYPTO recruiter, who likes to learn new stuff and tries some basic coding with web3 and SQL in my free time. Crypto-bro for life!"
        }
    prediction = predict_chat()
    return (json.dumps(prediction), 200,) if (prediction != None) else (
        json.dumps({"error": f"Unknown error in prediction!"}),
        503,
        CORS_HEADERS,
    )



if __name__ == "__main__":
    app.logger.info("Running from the command line")
    app.run(host="0.0.0.0", port=800)
    mock_profile()
