# TensorFlowJS Helps Sesame Street make a Presence on LinkedIn

![Canva generated image of bigbird using a computer](./articleImages/aiGenBBBanner2.PNG)

Got you there! Google's large language model Bard inspired that title. No way a childrens' show would use such a network for their young audience when they can do better.

A continuation of our previous article: [Make Linkedin Fun — with NLP and Sesame Street](./articleImages/https://medium.com/call-for-atlas/make-linkedin-fun-with-nlp-and-sesame-street-6713d95d567a). We built a scikit-learn python model to joyously convert our network into the Sesame Street crowd. But - we were inefficient with the delivery of the model and predictions.

In this article, we will show you how to construct a Python model using Keras and TensorFlow to replicate an Scikit-learn Python model and prepare it for the web. 

# Build it with Tensorflow

To deliver the web experience we want, we need to use TensorFlowJS. TensorFlowJS is a JavaScript library that makes it easy to use TensorFlow buily AI models on the web.

Given that in the previous article we used scikit, we need to reconstruct a similar model in Tensorflow. Our challenge here is to use APIs that are common to both the python and javascript variant of this powerfull AI framework.

Start by installing Tensorflow and its supporting libraries:

`pip install tensorflow tensorflow_addons tensorflow_hub`

We are assuming that you have the same environment from the previous article, which means you also have `string`, and various `nltk` components ready.

## Use USE

In our previous article we used a bag of words (BoW) with individual bi-grams, which was good for a usecase of low words-to-samples ratio. This time, we will use word sequences instead, through the USE pretrained model.

**Universal Sentence Encoder** (USE) is a pretrained model within the tensforflow HUB, that can generate 512 dimensioned embeddings. These embeddings are recommended for short paragraphs, which is what most linkedin titles and descriptions are made of. Unlike our previous attempt with the BoW, this model comes with its own vabulary (which we can train with our datasets' vocabulary).

Let's load up again our corpus of synthetic linkedin titles:

```python
DATA = "./data/anonLinkedInProfiles.csv"
DATA_LEN = 1400
LABEL_DICT = dict()

data = pd.concat([chunk for chunk in tqdm(pd.read_csv(DATA, chunksize=1000), desc=f'Loadin {DATA}')])
print(f'Shape: {data.shape}, does it have NAs:\n{data.isna().any()}')

data = data.sample(DATA_LEN, random_state=200)
data = data.reset_index() # Reset index, since we will do operations on it!
print(f'Resampled Shape: {data.shape}')
data.head()
```

Do the standard cleaning routine of:
1. Drop **STOP** words, whitespaces or symbols (e.g. ['he', 'ah', '!'])
2. **Tokenize** words (e.g. 'today is raining' to ['today', 'raining']).
3. Reduce words to their **lemmas** (e.g. 'raining' reduced to 'rain').
4. Convert labels to ordinals.

Note that we are using the tqdm library for both pandas and dataset processes (in *progress_apply*), to give a visual cue on the progress.

```python
import string
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from nltk.corpus import wordnet 
from nltk import pos_tag

def _get_or_set_label(x):
    if x not in LABEL_DICT:
        LABEL_DICT[x] = len(LABEL_DICT)
    return LABEL_DICT[x]

X = data['titles'].astype(str) +  ' ' + data['descriptions'].astype(str)
Y = data['class'].apply(lambda x: _get_or_set_label(x)).astype(int)

WNL = WordNetLemmatizer()
STOP_WORDS = stopwords.words('english')

def clean_sentence(original_text):
  def _get_wordnet_pos(word):
    tag = pos_tag([word])[0][1][0].upper()
    tag_dict = {"J": wordnet.ADJ,
                "N": wordnet.NOUN,
                "V": wordnet.VERB,
                "R": wordnet.ADV}

    return tag_dict.get(tag, wordnet.NOUN)
  
  cleaned_text = original_text.strip()
  cleaned_text = original_text.translate(str.maketrans(' ', ' ', string.punctuation))
  cleaned_text = cleaned_text.translate(str.maketrans(' ', ' ', '\n')) # Remove newlines
  cleaned_text = cleaned_text.translate(str.maketrans(' ', ' ', string.digits)) # Remove digits
  cleaned_text = cleaned_text.lower() # Convert to lowercase
  cleaned_text = cleaned_text.split() # Split each sentence using delimiter

  lemmatized_list=[]
  for y in cleaned_text:
    if y in STOP_WORDS:
      continue
    z=WNL.lemmatize(y, _get_wordnet_pos(y))
    lemmatized_list.append(z)

  lemmatized_sentence = ' '.join(lemmatized_list)
  return lemmatized_sentence

X_cleaned = X.progress_apply(lambda text: clean_sentence(text))
```

Split the dataset into *train*, *validation* and *test* while converting text to embeddings:

```python
import tensorflow as tf
from tensorflow.data import Dataset, AUTOTUNE
import tensorflow_hub as hub

EMBED = hub.load("https://tfhub.dev/google/universal-sentence-encoder/4")

def text_to_dataset(texts,labels):
    return Dataset.from_tensor_slices((EMBED(texts), labels.tolist())).cache().batch(hparams['batch_size'],drop_remainder=True).prefetch(AUTOTUNE)

VAL_SIZE = int(len(X)*0.3)


x_train = X_cleaned[VAL_SIZE:]
y_train = Y[VAL_SIZE:]

x_val = X_cleaned[:VAL_SIZE]
y_val = Y[:VAL_SIZE]

TEST_SIZE = int(len(x_val)*0.3)

x_test = x_val[TEST_SIZE:]
y_test = y_val[TEST_SIZE:]
x_val = x_val[:TEST_SIZE]
y_val = y_val[:TEST_SIZE]

print(f'Sizes for TEST: {TEST_SIZE}, validation: {VAL_SIZE} and train: {len(X) - VAL_SIZE}')

train_ds = text_to_dataset(x_train, y_train)
val_ds = text_to_dataset(x_test, y_test)
test_ds = text_to_dataset(x_val, y_val)

list(test_ds.take(1))[0]
```

Now we buid the our first text classifying Neural Network (NN), exciting!

![alt](./articleImages/aiGenCharactersCoding.PNG)

Our NN will have the following layers:

- The input layer for the NN will be the USE model embeddings previously generated. The input shape of this layer is 512DIM word embeddings and the batchsize configured.
- A hidden layer in the middle will help us reduce dimensionality to 1/2 and uses a sigmoid activation function. The sigmoid is analogous to the linear regression applied in the previous article with Scikit-learn.
- We apply a normalization function after the previous activation, to reduce shifts in our weights with every training epoch.
- Finally, we map the NN's outputs to the 5 classes we set up in the previous article, and output the probability through a softmax activation function.

```python
model = keras.Sequential(
    [
        layers.InputLayer(input_shape=(512,),batch_size=hparams['batch_size'], name="in_embeddings"),
        layers.Dense(int(hparams['embedding_dim']/4),batch_size=hparams['batch_size'], activation="sigmoid", name="layer1"),
        layers.Dropout(hparams['dropout_rate'],batch_size=hparams['batch_size'], name="drop"),
        layers.BatchNormalization(batch_size=hparams['batch_size']),
        layers.Dense(len(LABEL_DICT),batch_size=hparams['batch_size'], activation="softmax", name="out")
    ]
)

# Load the model and view a summary.
model.compile(
    loss = tf.losses.SparseCategoricalCrossentropy(from_logits=True),
    optimizer=tf.optimizers.Adam(learning_rate=hparams['learning_rate']), 
    metrics = [keras.metrics.SparseCategoricalAccuracy(name="accuracy"),
               keras.metrics.MeanAbsoluteError(name='mean_absolute_error')
            ])

model.summary()
```

Compiling the model give us:

![alt](./articleImages/image.png)

## Fit for the Street

With the model and data prepared, it's time to fit and test our model. We only use 4 epochs, as the dataset is small and after 2 epochs the NN is good enough:

```python
import tensorflow_addons as tfa

tqdm_callback = tfa.callbacks.TQDMProgressBar()

history = model.fit(train_ds, 
                    epochs=10, 
                    verbose = 10,
                    validation_data = val_ds,
                    callbacks=[tqdm_callback]
                    )

history.history
```

Note the use of the TQDM progress bar, there is a lot of utility in that addon. With every epoch you can see the model improving:

![alt](./articleImages/epochs.PNG)

We need to test the NN with the prepared test dataset from the previous section, and if good enough we should test it with a never seem LinkedIn description:

```python
from math import floor

print("Evaluating test data")
print(model.evaluate(test_ds, batch_size=hparams['batch_size']))

# Remember all our imputs need to be embedded first!
job_titles = EMBED(["IT Consultant at Sesame Street, lord of Java Code, who likes to learn new stuff and tries some machine learning in my free engineering time."])

print("\nEvaluating new Description")
probas = model.predict(job_titles)[0]
print(LABEL_DICT)
print(probas)

max_proba_idx = np.argmax(probas)
print(f'\nPredicted character: [{list(LABEL_DICT)[max_proba_idx]}] with probability of: [{floor(probas[max_proba_idx]*100.0)}%]')
```

Gives us:

![alt](./articleImages/modelTest.PNG)

This new description is the same one used in the previous article with scikit-learn, the output was Grover at a substantial probability. The output is the same for this NN, therefore we have validated that this will give the same output as the previous model.

With everything validated, let's save the model in the full tensorflow format, and reload it to validate it works:
```python
MODEL_PATH = 'models/tf'

model.save(MODEL_PATH)

model = keras.models.load_model(MODEL_PATH)
model.predict(job_titles)
```

You'll have to install some dependencies, namely: `pip install pyyaml h5py` to allow tensorflow to save the model or raw weights.

# From Python to Javascript

Enough with the snake, let's do some webapps.

Install the required packages for the convertor:
`pip install tensorflowjs[convertor]`

Run the convertion script (remember the paths from the save in the previous section):
```bash
tensorflowjs_converter \
    --skip_op_check \
    --input_format=tf_saved_model \
    --output_format=tfjs_graph_model \
    --signature_name=serving_default \
    --saved_model_tags=serve \
    models/tf \
    models/tfjs
```

Using nodejs, we will test the model by loading it and running a prediction. 

Install the required modules: `npm install @tensorflow/tfjs @tensorflow/tfjs-node @tensorflow-models/universal-sentence-encoder`

Your package.json should be similar to this:
```json
{
  "dependencies": {
    "@tensorflow-models/universal-sentence-encoder": "^1.3.3",
    "@tensorflow/tfjs": "^4.5.0",
    "@tensorflow/tfjs-node": "^4.5.0",
    "jquery": "^3.6.4",
    "jsdom": "^21.1.1",
    "xpath": "^0.0.32"
  }
}
```

In a javascript test file, we load the USE model to create embeddings (this will be the java variant of the model) and test the same linkedin title from the python notebook:

```javascript
const tf = require("@tensorflow/tfjs");
const tfn = require("@tensorflow/tfjs-node");
const use = require('@tensorflow-models/universal-sentence-encoder');

const handler = tfn.io.fileSystem('./notebooks/models/tfjs/model.json');

async function testModel(){
    const model = await tf.loadLayersModel(handler);

    const useModel = await use.load();
    const embeddings = await useModel.embed(["IT Consultant at Sesame Street, lord of Java Code, who likes to learn new stuff and tries some machine learning in my free engineering time."])

    const t = await model.predict(embeddings);

    // {'bigbird': 0, 'count': 1, 'grover': 2, 'grouch': 3, 'erniebert': 4}
    // [0.00236707 0.00669724 0.9246539  0.06278326 0.00349861]
    console.log(`Prediction from JS vs PY: \nJS - ${t.dataSync()}\nPY - 0.00236707, 0.00669724, 0.9246539, 0.06278326, 0.00349861`);
}

testModel();
```

Which when run with node, will print the following:

![alt](./articleImages/modeJSTest.PNG)

The probabilities might not be precisely the same, but the correct class was selected. Not bad! Count Von Count will be satisfied with these numbers.

![alt](./articleImages/cvc.png)

## Extending the Extension

The model needs to be plugged within the extensions background script. We will be building on the chrome extension done in the previous article.

To do this, we have to download the minified tensorflow libraries and the USE model used in the previous section, you can find them in these URLs:
- https://cdn.jsdelivr.net/npm/@tensorflow/tfjs
- https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-node
- https://cdn.jsdelivr.net/npm/@tensorflow-models/universal-sentence-encoder

And update the manifest.json file to include the tensorflow scripts and the model.json with our model's definitions to be loaded again:
```json
"content_scripts": [
    {
        "matches": [
            "*://www.linkedin.com/*"
        ],
        "js": [
            "scripts/tfjs.js",
            "scripts/tfjs-node.js",
            "scripts/universal-sentence-encoder.js",
            "scripts/jquery-3.6.4.slim.min.js",
            "scripts/jquery-ui.min.js",
            "scripts/utility.js",
            "scripts/content.js",
            "scripts/popup.js"
        ]
    }
    ...
    "web_accessible_resources": [{
        "resources": [ "assets/bigbird.png", "assets/count.png","assets/erniebert.png", "assets/grouch.png", "assets/grover.png", "assets/model.json" ],
        "matches": [  "*://www.linkedin.com/*" ],
        "use_dynamic_url": true
    }],
],
```


https://github.com/tensorflow/tfjs/issues/7554 

https://stackoverflow.com/questions/20435528/chrome-extension-sendresponse-does-not-work

https://developer.chrome.com/docs/extensions/reference/runtime/#method-sendMessage
https://hpssjellis.github.io/beginner-tensorflowjs-examples-in-javascript/tfjs-models/universal-sentence-encoder/index.html

# Conclusion

We learned how to create an extension and how to use NLP to make our linkedin more fun!

The extension scrapes linked in, but up to a maximum of 5 profiles. Linkedin will ban your account if you abuse the site, so be a good citizen when you do scraping.

## References

- https://tfhub.dev/google/universal-sentence-encoder/4 
- https://js.tensorflow.org/api/latest/
- https://bard.google.com/ 
- https://www.kaggle.com/
- https://www.tensorflow.org/js/guide/conversiontensorflowjs_converter 
- https://www.npmjs.com/package/@tensorflow/tfjs-converter 

## Github

Article here is also available on [Github](https://github.com/adamd1985/AugmentedLinkedInFun)

Kaggle notebook available [here](https://www.kaggle.com/code/addarm/linkedin-profiles-as-sesame-street-characters)


## Media

All media used (in the form of code or images) are either solely owned by me, acquired through licensing, or part of the Public Domain and granted use through Creative Commons License.

All PNGs are either created by me or generated by Canva's text to image generator.

Sesame Street is copywrited and all characters are owned by its company.

## CC Licensing and Use

<a rel="license" href="http://creativecommons.org/licenses/by-nc/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-nc/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-nc/4.0/">Creative Commons Attribution-NonCommercial 4.0 International License</a>.

#

<div align="right">Made with :heartpulse: by <b>Adam</b></div>