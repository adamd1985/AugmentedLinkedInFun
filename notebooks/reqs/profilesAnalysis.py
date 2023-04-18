#!/usr/bin/env python
# coding: utf-8

# # LinkedIn Profile Analysis
#
# We will build a supervised pipeline to classify a profile depending on a subset of tagged data.
# Beyond the standard word cleanupfor an NLP pipeline, we should:
# - remove hashtag, both word and symbol.
# - remove email addresses.
# - Symbols.

# In[66]:


from nltk.corpus import wordnet
import sys
from joblib import dump, load
from sklearn.model_selection import GridSearchCV
from sklearn.feature_extraction.text import TfidfTransformer
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC
from sklearn import metrics
from sklearn.utils.class_weight import compute_class_weight
from sklearn.feature_selection import chi2
import seaborn as sns
from sklearn import preprocessing
from sklearn.model_selection import train_test_split
from nltk import pos_tag
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import ToktokTokenizer
from nltk.tokenize import sent_tokenize
from nltk.corpus import stopwords
from sklearn.base import TransformerMixin
from sklearn.feature_extraction.text import CountVectorizer
import string
from tqdm.notebook import tqdm
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

tqdm.pandas()


# In[67]:


DATA = "./anonLinkedInProfiles.csv"
data = pd.concat([chunk for chunk in tqdm(
    pd.read_csv(DATA, chunksize=1000), desc=f'Loadin {DATA}')])
print(f'Shape: {data.shape}, does it have NAs:\n{data.isna().any()}')

data = data.dropna()
data = data.drop(data[(data['descriptions'] == '')
                 | (data['titles'] == '')].index)

print(f'Post fill NAs:\n{data.isna().any()}')
data['class'] = data['class'].apply(lambda x: x.lower())

# For this exercise, keep it small.
data = data.sample(500)
data = data.reset_index()  # Reset index, since we will do operations on it!
print(f'Resampled Shape: {data.shape}')

data.head()


# In[68]:


nltk.download('wordnet')

NGRAMS = (2, 2)  # BGrams only
STOP_WORDS = stopwords.words('english')
SYMBOLS = " ".join(string.punctuation).split(
    " ") + ["-", "...", "”", "”", "|", "#"]
COMMON_WORDS = []  # to be populated later in our analysis
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
    tokens = [wnl.lemmatize(word, _get_wordnet_pos(word))
              for word in tokens[0]]
    tokens = [word.lower().strip() for word in tokens]
    tokens = [tok for tok in tokens if (
        tok not in STOP_WORDS and tok not in SYMBOLS and tok not in COMMON_WORDS)]

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


# In[69]:


le = preprocessing.LabelEncoder()

# Combine features for NLP.
X = data['titles'].astype(str) + ' ' + data['descriptions'].astype(str)
ylabels = le.fit_transform(data['class'])

# no need for strat, doesn't reflect reality.
X_train, X_test, y_train, y_test = train_test_split(X, ylabels, test_size=0.3)


# Let's look at the word frequencies by label, using our vectorizer - this is a slow process, but we want to see if the material for embeddings makes sense for the given class.
#
# Anything that is too common, and irrelavant will be added to the COMMONWORDS list, and will be dropped in the vectorization step when building the model.

# In[70]:


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
        ngrams = [(feature_names[idx], features_chi2[0][idx])
                  for idx in feature_rev_indices]
        ngrams_dict[label] = ngrams

    # while we are at it, let's return top N counts also
    sum_words = bow_vect.sum(axis=0)
    bottom_words_counts = [(word, sum_words[0, idx])
                           for word, idx in tqdm(_vect.vocabulary_.items())]
    top_words_counts = sorted(
        bottom_words_counts, key=lambda x: x[1], reverse=True)
    top_words_counts = top_words_counts[:n]
    bottom_words_counts = bottom_words_counts[:n]

    return {'labels_freq': ngrams_dict,
            'top_corpus_freq': top_words_counts,
            'bottom_corpus_freq': bottom_words_counts}


TOP_N_WORDS = 10

common_bigrams_label_dict = get_top_n_dependant_ngrams(
    X, ylabels, ngram=1, n=TOP_N_WORDS)

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


# In[71]:


print(common_bigrams_label_dict['top_corpus_freq'])
print(common_bigrams_label_dict['bottom_corpus_freq'])


# These most frequent or least frequent words don't have relevance to the individual classes, and are available in all text. We check if they these don't have high chi2 score though, as we don't want to alter the text's classification by removing a highly correlated but low frequency word.

# In[72]:


common_label_freq = [word for label in labels for word,
                     count in common_bigrams_label_dict['labels_freq'][label]]
print(f'Highest frequency of ngrames in labels: {common_label_freq}')

COMMON_WORDS = np.append([word for word, count in common_bigrams_label_dict['top_corpus_freq'] if word not in common_label_freq],
                         [word for word, count in common_bigrams_label_dict['bottom_corpus_freq'] if word not in common_label_freq])
COMMON_WORDS


# In[73]:


plt.figure(figsize=(4, 2))
sns.countplot(x=y_train)
plt.show


# Since our training dataset is unbalanced, we need to resample to least common class, or use weights. The former is the easiest for this exercise.

# In[74]:


# Either class weights


keys = np.unique(y_train)
values = compute_class_weight(class_weight='balanced', classes=keys, y=y_train)

class_weights = dict(zip(keys, values))
print(f'Use these wieghts: {class_weights}')

# Or undersmaple.

min_size = np.array([len(data[data['class'] == 's']), len(data[data['class'] == 'o']), len(
    data[data['class'] == 'c']), len(data[data['class'] == 'f']), len(data[data['class'] == 'w'])]).min()
print(f'Least sampled class of size {min_size}')

data4 = data[data['class'] == 's'].sample(n=min_size, random_state=101)
data3 = data[data['class'] == 'o'].sample(n=min_size, random_state=101)
data2 = data[data['class'] == 'c'].sample(n=min_size, random_state=101)
data1 = data[data['class'] == 'f'].sample(n=min_size, random_state=101)
data0 = data[data['class'] == 'w'].sample(n=min_size, random_state=101)

data_under = pd.concat([data0, data1, data2, data3, data4], axis=0)

print(
    f'Undersampled shapes: {data0.shape}, {data1.shape}, {data2.shape}, {data3.shape}, {data4.shape}')


# We train the model here. We will use a pipeline, we a preselected classifier (in this case an SVM case the best results in previous tests), and cross validate the best hyperparams. We then save the model for reuse later on.

# In[79]:


# If we want to use an ensemle in case of weak models:
#
# from sklearn.linear_model import SGDClassifier
# from sklearn.naive_bayes import MultinomialNB
# from sklearn.linear_model import LogisticRegression
# from sklearn.ensemble import StackingClassifier
# estimators = [ ('lsv', LinearSVC()), ('sgdc', SGDClassifier())]
# sclf = StackingClassifier(estimators=estimators,
#                          final_estimator=LogisticRegression(),
#                          passthrough=True)

text_clf = Pipeline([
    ("cleaner", predictors()),
    ('vect', bow_vector),
    ('tfidf', TfidfTransformer()),
    ('clf', LinearSVC()),
],
    verbose=False)  # Add verbose to see progress, note that we run x2 for each param combination.
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

predicted = model.predict(X_test)


# Scoring and analysing our model. We look at the best hyperparams our CV has supplied, for the next model build.

# In[80]:


# Model Accuracy
print("F1:", metrics.f1_score(y_test, predicted, average='weighted'))
print("Accuracy:", metrics.accuracy_score(y_test, predicted))
print("Precision:", metrics.precision_score(
    y_test, predicted, average='weighted'))
print("Recall:", metrics.recall_score(y_test, predicted, average='weighted'))

# see: model.cv_results_ for more reuslts
print(f'The best estimator: {model.best_estimator_}\n')
print(f'The best score: {model.best_score_}\n')
print(f'The best parameters: {model.best_params_}\n')

#Ploting the confusion matrix
plt.figure(figsize=(2, 2))
cm = metrics.confusion_matrix(y_test, predicted)
disp = metrics.ConfusionMatrixDisplay(confusion_matrix=cm,
                                      display_labels=model.classes_)

disp.plot()


# Save and test the model. This pickled model will be used with a server. We do the same for the label encoder. Remember to copy these to the server.
#
# We can look into quantization for reduced model size.

# In[85]:


print(sys.executable)
print(sys.version)
print(sys.version_info)

pickled_le = dump(le, './models/labelencoder.joblib')
validate_pickled_le = load('./models/labelencoder.joblib')
pickled_model = dump(model, './models/model.joblib')
validate_pickled_model = load('./models/model.joblib')

xx_test = ["IT recruitment Consultant at SNFHL I'm an IT/SAP/CRYPTO recruiter, who likes to learn new stuff and tries some basic coding with web3 and SQL in my free time. Crypto-bro for life!"]

yy_resultt = validate_pickled_model.predict(xx_test)
validate_pickled_le.inverse_transform(yy_resultt)
