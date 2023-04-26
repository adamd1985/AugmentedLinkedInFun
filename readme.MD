# Make Linkedin Fun - with some NLP

Using basic NLP constructs with sktlearn, we will be making our linkedin experience better by summarizing posts and replacing profiles with Seasame Street characters!

# The Browsing Extension

Our touch point will be a chrome extension.

## Build our Extension and Scrape

Either us ChatGPT to get the chrome extension boiler plate.
The extension will be made up of:
- manifest.json
- background.js
- content.js

The manifest tells chrome what rights and functionalities the extension has, in our case:
```json
{
    "manifest_version": 3,
    "name": "AugmentedLinkedInFun",
    "version": "1.0",
    "description": "Replaces LinkedIn user names with 'NPC'.",
    "permissions": [
        "tabs",
        "scripting",
        "activeTab",
        "notifications",
        "storage"
    ],
    "host_permissions": [
        "http://www.linkedin.com/*",
        "https://www.linkedin.com/*"
    ],
    "optional_host_permissions": [
        "https://*/*",
        "http://*/*"
    ],
    "content_scripts": [
        {
            "matches": [
                "*://www.linkedin.com/*"
            ],
            "js": [
                "scripts/jquery-3.6.4.slim.min.js",
                "scripts/content.js"
            ]
        }
    ],
    "background": {
        "service_worker": "scripts/background.js",
        "type": "module"
    },
```

**Permissions** tells the browser we will be injecting a script in the active tab, in this case contest.js.
**Host_permissions** signals were to run. **Content_script** is the material we will be using and where.
**background** defines what background script having access to the majority of chrome API is. We also include the 
slim version of the jQuery library for it's element selection and manipulation functionality.

## The script

Within the content script, we want to capture all links that direct us to a profile using the function below:

```js
/**
 * scrape all profile links.
 */
getAllLinks() {
    const re = new RegExp("^(http|https)://", "i");;
    var links = [];

    $('a[href*="/in/"]').each((index, element) => {
        let link = $(element).attr('href');
        if (/^(http|https).*/i.test(link) === false) {
        // Linkedin may use relative links, we need to convert to absolutes.
        link = `https://www.linkedin.com${link}`
        }
        
        links.push(link);
    })

    return links;
}
```

A user's profile is identified with the link regex: **/in/.*.**. We will scrape every link in our feed. From here we call the function to pull in all profile content:

```js
/**
   * Given a collection of profile links, we collect relevant information.
   * @param {*} links Absolute links to profiles. If link is not for a profile (we use xpath), it will be ignored.
   * @returns Porfile object.
   */
  async getProfilesDetailsFromLinks(links, cachedProfiles) {

    /**
     * Scraping internal function.
     */
    function _scrape(profile){
      let lnName = $("main h1", profile).text()
      let profileObj = null;
      if (lnName !== null && lnName.length > 0) {
        lnName = lnName.trim();
        console.debug(`found name: ${lnName}`);
      }

      let titles = $("main div.text-body-medium", profile).text()
      if (titles !== null && titles.length > 0) {
        titles = titles.trim();
      }

      if ((lnName !== null && lnName !== "") && (titles !== null && titles !== "")) {
        profileObj = {
          user: lnName,
          titles: titles,
          link: ''
        }
      }
      return profileObj;
    }
    
    let profiles = []
    let calls = []
    let MAX_ITERS = 5
    for (const link of links) {
        let profile = null;


        // Avoid rate limit and allow dynamic content to load
        // Randomly wait for up to 2sec.
        await new Promise(r => setTimeout(r, Math.floor(Math.random() * 2000)));

        let _link = link;
        let call = chrome.runtime.sendMessage({ link: link }).then(response => {
            let profile = response?.profile;
            let profileObj = null;
            if (profile) {
            profileObj = _scrape(profile);
            if (profileObj){
                profileObj.link = _link;
            }
            }
            return Promise.resolve(profileObj);
        });
        calls.push(call)
        if (MAX_ITERS <= 0){
            break; // Just to make things faster.
        }
        MAX_ITERS -= 1;
    
    }
   
    profiles = profiles.concat(await Promise.all(calls));
    
    return profiles;
  }
```

In the main function body, we will use jquery to scrape relevant profile info. `$("main h1", profile)` to capture the user's nam, while `$("main div.text-body-medium", profile)` 
to capture the user's title. Though screping a profile from a link is not straight forward, `chrome.runtime.sendMessage` is what allows us to do this by sending a message to a global script.

## Know your Background

LinkedIn generates dynamic content on the fly, which means when the page loads - not all info is available. So we will open the profile in a new tab, pull in the content, and close the tab. This is done in the global **background.js** script:

```js
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    console.log(`Message from ${sender}: ${JSON.stringify(message)}`)
    if (message?.link) {
        chrome.tabs
            .create({ url: message.link, active: false })
            .then(tab => {
                let tabID = tab.id
                chrome.scripting.executeScript({
                    func: getProfile,
                    target : {
                        tabId: tabID
                    },
                    injectImmediately: false
                })
                .then(injectionResults => {
                    // Should have 1 parent frame.
                    let profile = injectionResults[0]?.result;
                    return sendResponse({ profile: profile});
                })
                .then(() => chrome.tabs.remove(tabID))
                .catch(error => console.error(error.message))
            })
    } 

    return true;
});
```

`chrome.runtime.onMessage.addListener` lives in the **background.js** and will pick the message sent from our **content.js** and proceed to open a tab and inject the script below using `chrome.scripting.executeScript`:

```js
async function getProfile() {
    // Activities are loaded by a dynamic script and might not be available
    // when the script is loaded. We try to assert it, but cannot do anything.
    const el = document.querySelector(".pvs-list");
    if (el) {
        console.log("Has activity!")
    }
    else {
        // Delay the tab close.
        await new Promise(r => setTimeout(r, 400));
    }

    return document.body.innerHTML;
}
```

Get profile will open a tab, get the HTML and close it. Note the various timeouts, it's to allow the dynamic content to load and prevent LinkedIn from banning us for abusing their site through too much scraping. With the profile HTML in our hands, we will return it to the content.js script.

## What's in a Character

We have the profiles, now let's indentify them with a Seasame Street characters using the function below:

```js
/**
 * Augment the linkedin experience by adding info or visual cues.
 * All will happen async as they  call our classification server.
 * @param {*} profiles 
 */
augmentLinkedInExperience(profiles) {
    let promises = [];
    profiles.forEach(function(profile) {
    if (!profile)
        return

    const data = {
        'descriptions': profile.titles,
    };

    promises.push(
        fetch('http://127.0.0.1:800/profile', {
        method: "POST", 
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data), 
        })
        .then(response=>response.json())
        .then((data) => {
        let search = `^${profile.user}$`;
        let re = new RegExp(search, "g");
        $(`h1.text-heading-xlarge:contains("${profile.user}")`).each((index, element) => {
            let text = $(element).text().trim();
            if (text.match(re)){
            if (data['proba'] && data['proba'] >= 30){
                $(element).text(`${data['label']}`);
            }
            }
        })
        $(`div:contains("${profile.user}")`).each((index, element) => {
            let text = $(element).text().trim();
            if (text.match(re)){
            if (data['proba'] && data['proba'] >= 30){
                $(element).text(`${data['label']}`);
            }
            }
        })
        }).catch ((error) => {
            console.log('Error: ', error);
        })
    );
}); 
```
Note the `fetch('http://127.0.0.1:800/profile'`, this will call an API to a model we will train later. For the rest, we capture elements that link to the users using `$('h1.text-heading-xlarge:contains("${profile.user}")'')` or ` $('div:contains("${profile.user}")')`, and change their content to reflect the character we want.

# Modelling Characters

We have asked chatGPT to create mock LinkedIn profile of specific denominations: HR, crypto entusiasts, business gurus and standard engineers. 

Example csv generated by openAI are:

`Lawrence Dickerson, IT professional with skills in microsoft excel microsoft word microsoft outlook microsoft powerpoint IT business partner and so on, grover`

Lawrence, a generated name, was listed a hard working grover. We build a similar classification for various profiles.
Then we load it, and clean up missing rowS:

```py
DATA = "./data/anonLinkedInProfiles.csv"
data = pd.concat([chunk for chunk in tqdm(pd.read_csv(DATA, chunksize=1000), desc=f'Loadin {DATA}')])
print(f'Shape: {data.shape}, does it have NAs:\n{data.isna().any()}')

data = data.dropna()
data = data.drop(data[(data['descriptions'] == '') | (data['titles'] == '')].index)

print(f'Post fill NAs:\n{data.isna().any()}')
data['class'] = data['class'].apply(lambda x: x.lower())

# For this exercise, keep it small.
data = data.sample(800)
data = data.reset_index() # Reset index, since we will do operations on it!
print(f'Resampled Shape: {data.shape}')

data.head()
```

We build a tokenizer:

```py
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

nltk.download('all')

NGRAMS = (2,2) # BGrams only
STOP_WORDS = stopwords.words('english')
SYMBOLS = " ".join(string.punctuation).split(" ") + ["-", "...", "”", "”", "|", "#"]
COMMON_WORDS = [] # to be populated later in our analysis
toktok = ToktokTokenizer()
wnl = WordNetLemmatizer()

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

class predictors(TransformerMixin):
    def transform(self, X, **transform_params):
        return [clean_text(text) for text in X]

    def fit(self, X, y=None, **fit_params):
        return self

    def get_params(self, deep=True):
        return {}


def clean_text(text):
    if (type(text) == str):
        text = text.strip().replace("\n", " ").replace("\r", " ")
        text = text.lower()
    else:
        text = "NA"
    return text


# With the BoW, the model does a bit better.
bow_vector = CountVectorizer(
    tokenizer=custom_tokenizer, ngram_range=NGRAMS)
```

split training and test data:

```py
from sklearn.model_selection import train_test_split
from sklearn import preprocessing

le = preprocessing.LabelEncoder()

# Combine features for NLP.
X = data['titles'].astype(str) +  ' ' + data['descriptions'].astype(str)
ylabels = le.fit_transform(data['class'])

train_ratio = 0.75
validation_ratio = 0.15
test_ratio = 0.10

# train is now 75% of the entire data set
X_train, X_test, y_train, y_test = train_test_split(X, ylabels, test_size=1 - train_ratio)
X_val, X_test, y_val, y_test = train_test_split(X_test, y_test, test_size=test_ratio/(test_ratio + validation_ratio))
```

We check the ngrams that make up our selected profiles:

```py
import seaborn as sns
from sklearn.feature_selection import chi2

def get_top_n_dependant_ngrams(corpus, corpus_labels, ngram=1, n=3):
    # use a private vectorizer.
    _vect = CountVectorizer(tokenizer=custom_tokenizer,
                            ngram_range=(ngram, ngram))
    vect = _vect.fit(tqdm(corpus, "fn:fit"))
    bow_vect = vect.transform(tqdm(corpus, "fn:transform"))
    features = bow_vect.toarray()

    labels = np.unique(corpus_labels)
    ngrams_dict = {}
    for label in tqdm(labels, "fn:labels"):
        corpus_label_filtered = corpus_labels == label
        features_chi2 = chi2(features, corpus_label_filtered)
        feature_names = np.array(_vect.get_feature_names_out())

        feature_rev_indices = np.argsort(features_chi2[0])[::-1]
        feature_rev_indices = feature_rev_indices[:n]
        ngrams = [(feature_names[idx], features_chi2[0][idx]) for idx in feature_rev_indices]
        ngrams_dict[label] = ngrams

    # while we are at it, let's return top N counts also
    sum_words = bow_vect.sum(axis=0)
    bottom_words_counts = [(word, sum_words[0, idx])
                  for word, idx in tqdm(_vect.vocabulary_.items())]
    top_words_counts = sorted(
        bottom_words_counts, key=lambda x: x[1], reverse=True)
    top_words_counts = top_words_counts[:n]
    bottom_words_counts= bottom_words_counts[:n]
        
    return {'labels_freq': ngrams_dict,
            'top_corpus_freq': top_words_counts,
            'bottom_corpus_freq': bottom_words_counts}


TOP_N_WORDS = 10

common_bigrams_label_dict = get_top_n_dependant_ngrams(X, ylabels, ngram=1, n=TOP_N_WORDS)

fig, axes = plt.subplots(2, 3, figsize=(26, 12), sharey=False)
fig.suptitle('NGrams per Class')
fig.subplots_adjust(hspace=0.25, wspace=0.50)

x_plot = 0
y_plot = 0
labels = np.sort(np.unique(ylabels), axis=None)
for idx, label in tqdm(enumerate(labels), "Plot labels"):
    common_ngrams_df = pd.DataFrame(
        common_bigrams_label_dict['labels_freq'][label], columns=['ngram', 'chi2'])
    x1, y1 = common_ngrams_df['chi2'], common_ngrams_df['ngram']

    # Reverse it from the ordinal label we transformed it.
    axes[y_plot][x_plot].set_title(
        f'{le.inverse_transform([label])} ngram dependence', fontsize=6)
    axes[y_plot][x_plot].set_yticklabels(y1, rotation=0)
    sns.barplot(ax=axes[y_plot][x_plot], x=x1, y=y1)
    # Go to next plot.
    if idx > 0 and idx % 2 == 0:
        x_plot = 0
        y_plot += 1
    else:
        x_plot += 1

plt.show()
```

Check what the ngrams and filter out common and uncommon words:

```py
print(common_bigrams_label_dict['top_corpus_freq'])
print(common_bigrams_label_dict['bottom_corpus_freq'])

common_label_freq = [word for label in labels for word, count in common_bigrams_label_dict['labels_freq'][label]]
print(f'Highest frequency of ngrames in labels: {common_label_freq}')

COMMON_WORDS = np.append([word for word,count in common_bigrams_label_dict['top_corpus_freq'] if word not in common_label_freq], 
                         [word for word,count in common_bigrams_label_dict['bottom_corpus_freq'] if word not in common_label_freq ])
COMMON_WORDS

plt.figure(figsize=(4,2))
sns.countplot(x=y_train)
plt.show
```

In our count plot chart, we see that our training data is unbalanced, so let's downsample:

```py
# Either class weights
from sklearn.utils.class_weight import compute_class_weight


keys = np.unique(y_train)
values = compute_class_weight(class_weight='balanced', classes=keys, y=y_train)

class_weights = dict(zip(keys, values))
print(f'Use these wieghts: {class_weights}')

# Or undersmaple.

min_size = np.array([len(data[data['class'] == 's']), len(data[data['class'] == 'o']), len(data[data['class'] == 'c']), len(data[data['class'] == 'f']), len(data[data['class'] == 'w'])]).min()
print(f'Least sampled class of size {min_size}')

data4 = data[data['class'] == 's'].sample(n=min_size, random_state=101)
data3 = data[data['class'] == 'o'].sample(n=min_size, random_state=101)
data2 = data[data['class']=='c'].sample(n=min_size, random_state=101)
data1 = data[data['class']=='f'].sample(n=min_size, random_state=101)
data0 = data[data['class']=='w'].sample(n=min_size, random_state=101)

data_under = pd.concat([data0,data1,data2,data3,data4],axis=0)

print(f'Undersampled shapes: {data0.shape}, {data1.shape}, {data2.shape}, {data3.shape}, {data4.shape}')
```

Train the model:

```py
from sklearn import metrics
from sklearn.svm import LinearSVC
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfTransformer
from sklearn.model_selection import GridSearchCV
from sklearn.calibration import CalibratedClassifierCV

text_clf = Pipeline([
        ("cleaner", predictors()),
        ('vect', bow_vector),
        ('tfidf', TfidfTransformer()),
        ('clf', LinearSVC()),
    ],
    verbose=False) # Add verbose to see progress, note that we run x2 for each param combination.
parameters = {
    'vect__ngram_range': [(1, 2)],
    'tfidf__use_idf': [True],
    'tfidf__sublinear_tf': [True],
    'clf__penalty': ['l2'],
    'clf__loss':  ['squared_hinge'],
    'clf__C': [1],
    'clf__class_weight': ['balanced']
}
model_clf = GridSearchCV(text_clf,
                        param_grid=parameters,
                        refit=True,
                        cv=2,
                        error_score='raise')
model = model_clf.fit(X_train, y_train)

# see: model.cv_results_ for more reuslts
print(f'The best estimator: {model.best_estimator_}\n')
print(f'The best score: {model.best_score_}\n')
print(f'The best parameters: {model.best_params_}\n')

model = model.best_estimator_
model = CalibratedClassifierCV(model).fit(X_val, y_val)

predicted = model.predict(X_test)
```

Previously we used crossvalidators and an ensemble to find the best classifiers and hyperparameters, the code above is the result of that.

Check our model's accuracy:

```py
# Model Accuracy
print("F1:", metrics.f1_score(y_test, predicted, average='weighted'))
print("Accuracy:", metrics.accuracy_score(y_test, predicted))
print("Precision:", metrics.precision_score(
    y_test, predicted, average='weighted'))
print("Recall:", metrics.recall_score(y_test, predicted, average='weighted'))

#Ploting the confusion matrix
plt.figure(figsize=(2, 2))
cm = metrics.confusion_matrix(y_test, predicted)
disp = metrics.ConfusionMatrixDisplay(confusion_matrix=cm,
                                      display_labels=model.classes_)

disp.plot()
```

Save and have it run in a server:

```py
from joblib import dump, load
import sys
print(sys.executable)
print(sys.version)
print(sys.version_info)

pickled_le = dump(le, './models/labelencoder.joblib')
validate_pickled_le = load('./models/labelencoder.joblib')
pickled_model = dump(model, './models/model.joblib')
validate_pickled_model = load('./models/model.joblib')

xx_test = ["IT recruitment Consultant at SNFHL I'm an IT/SAP recruiter, who likes to learn new stuff and tries some basic coding with SQL in my free time."]

yy_result = validate_pickled_model.predict(xx_test)
yy_result_label = validate_pickled_le.inverse_transform(yy_result)
yy_result_proba = validate_pickled_model.predict_proba(xx_test)

print(f'Predicted: {yy_result_label} at confidece {yy_result_proba[0][yy_result]}\n \
    for features: {validate_pickled_le.inverse_transform(validate_pickled_model.classes_)}\n \
    and their probability: {yy_result_proba}')
```

# Serving Models

We will use a flask server to host the model and serve it as an API. First we important all relevant interfaces and the pickled model:

```py
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
```

Prepare our prediction API:

```py
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

```

and server it on a REST endpoint:

```py
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
```

Call the flask server, and try it out with a *curl* or postman:

```py
if __name__ == "__main__":
    app.logger.info("Running from the command line")
    app.run(host="0.0.0.0", port=800)
    mock_profile()

```

# Install and Have fun

We are almost there!

To run the extension, go to your chrome browser and type `chrome://extensions`. From here click on **Load Unpacked** and select the folder **chromeExtension**.
Go to your linkedIn, open browser tools console, and see the extension traverser your feed and pickup information.

It will replace the names of people in your network with their classifier as Sesame Street characters, showing that an extension can create an augmented experience.



# Conclusion

We learned how to create an extension and how to use NLP to make our linkedin more fun!

The extension scrapes linked in, but up to a maximum of 5 profiles. Linkedin will ban your account if you abuse the site, so be a good citizen when you do scraping.

## References

- https://scikit-learn.org/stable/
- https://developer.chrome.com/docs/extensions/

## Github

Article here is also available on [Github](https://github.com/adamd1985/AugmentedLinkedInFun)


## Media

All media used (in the form of code or images) are either solely owned by me, acquired through licensing, or part of the Public Domain and granted use through Creative Commons License.

All PNGs used are from https://www.pngegg.com/ 

Sesame Street is copywrited and all characters are owned by the company.

## CC Licensing and Use

<a rel="license" href="http://creativecommons.org/licenses/by-nc/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-nc/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-nc/4.0/">Creative Commons Attribution-NonCommercial 4.0 International License</a>.

#

<div align="right">Made with :heartpulse: by <b>Adam</b></div>