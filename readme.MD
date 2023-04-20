# LinkedIn CoPilot

Making the linkedin experience better by summarizing fluff and flagging profiles worthy of interest or an unfollow.

ID: eebigbbojdlmbdpdnkmbdglgfegdejaj

## Build and Install

The extension is made up of a NodeJS outer script and the actual chrome extension.

```bash
cd <root dir>
yarn install
```

Will install the nodejs variant of JQuery and outer helper libraries.

```bash
node testUtility.js
```

will run the test and console out some output from the sample profile and posts. 
We use this iterate and experiment on the extension, instead of installing to chrome and probably causing side-effects and we build the extension.

To run the extension, go to your chrome browser and type `chrome://extensions`.
From here click on **Load Unpacked** and select the folder **chromeExtension**.
Go to your linkedIn, open browser tools console, and see the extension traverser your feed and pickup information.

It will replace the names of people in your network with their classifier, showing that an extension can create an augmented experience.

## versions

For easy freezing of environments:
```
pip install pipreqs
pip install nbconvert
```

```
jupyter nbconvert --output-dir="./reqs" --to script my\ nb.ipynb
cd reqs
pipreqs --encoding utf-8
```

It will generate a good requirements.txt. Then just import it.

# Training the MLM for Message Recommendations

```
python ./notebooks/run_mlm.py \
--model_name_or_path distilbert-base-cased \
--output_dir ./notebooks/data/output \
--train_file ./notebooks/data/messagesForX.txt
--line_by_line
```

```
python ./notebooks/run_mlm.py \
--model_name_or_path roberta-base \
--train_file ./notebooks/data/messagesForX.txt \
--per_device_train_batch_size 8 \
--per_device_eval_batch_size 8 \
--do_train \
--do_eval \
--line_by_line \
--output_dir ./notebooks/data/output
```

# Troubleshooting

## Nothing Happens!

Reload the page or the extension from the extension page.

# Usage and Licenses

## Code and Media

All media used (in the form of code or images) are either solely owned by me, acquired through licensing, or part of the Public Domain and granted use through Creative Commons License.

All PNGs used are from https://www.pngegg.com/ and 

## CC Licensing and Use

<a rel="license" href="http://creativecommons.org/licenses/by-nc/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-nc/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-nc/4.0/">Creative Commons Attribution-NonCommercial 4.0 International License</a>.