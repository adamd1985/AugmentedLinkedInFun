/**
 * @license
 * Attribution-NonCommercial-NoDerivatives 4.0 Internation
 *
 * https://creativecommons.org/licenses/by-nc-nd/4.0/
 *
 * @author adamd
 * =============================================================================
 */
import * as use from '@tensorflow-models/universal-sentence-encoder';
import * as tf from '@tensorflow/tfjs';

let PROFILE_CLASSIFIER = null;

chrome.runtime.onInstalled.addListener(async function () {
    console.log("CoPilot loaded, models initializing.");

    PROFILE_CLASSIFIER = new ProfileClassifier()
});


chrome.commands.onCommand.addListener((command) => {
    console.log(`Command: ${command}, sending message to scrape.`);
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        // Get the current TAB.
        chrome.tabs.sendMessage(tabs[0].id,{ cmd: "run" });  
    });
});

/**
 * Async loads a USE and our Custom models on construction.  
 * 
 * Classifies a linkedin profile to the content.js to manipulate the DOM.
 */
class ProfileClassifier {
    constructor() {
      this.loadModel();
    }
  
    /**
     * Loads USE and custom Models, warms the models up.
     */
    async loadModel() {
      console.log('Loading model...');
      
      try {
        this.useModel = await use.load();
        
        tf.tidy(async () => {
            // Warms up the models by causing intermediate tensor values to be built.
            const startTime = performance.now();
            this.useModel.embed(["Test descriptions"])
                .then((embeddings) => {
                    return this.model.predict(embeddings)
            })
            .then((result) => {
                const totalTime = Math.floor(performance.now() - startTime);
                console.log(`Model loaded with ${result}, initialized in ${totalTime} ms...`);
            })
        });
      } catch (e) {
        console.error('Unable to load model', e);
      }
    }
  
    /**
     * Triggers our models to make a prediction.
     * @param {descriptions} string Profile title and descriptions.
     * @param {sendResponse} function messaging callback to reply to the content script.
     */
    async classifyProfile(descriptions, sendResponse) {
        if (!descriptions) {
            console.error('No descriptions.  No prediction.');
            return;
        }
        if (!this.model || !this.useModel) {
            console.log('Waiting for models to load...');
            setTimeout(
            () => { this.classifyProfile(descriptions, sendResponse) }, 2000);
            return;
        }
        console.log('Predicting...');
        const startTime = performance.now();

        const embeddings = await USE_MODEL.embed([message.titles]);
        const t = await MODEL.predict(embeddings);
        const predictions = t.dataSync();

        const totalTime = performance.now() - startTime;
        console.log(`Done in ${totalTime.toFixed(1)} ms `);

        const LABELS = ["bigbird", "count", "grover", "grouch", "erniebert"];
        const idx = predictions.reduce((iMax, x, i, arr) => x > arr[iMax] ? i : iMax, 0);   

        sendResponse({ 'proba': predictions[idx], 'label': (LABELS[idx] ?? "N/A")});
    }
}

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
                    console.log(`injectionResults: ${profile}`)
                    return sendResponse({ profile: profile});
                })
                .then(() => chrome.tabs.remove(tabID))
                .catch((error) => {
                    console.error(error.message);
                    sendResponse("BAD");
                })
            })
    }
    else if (message?.descriptions) {
        (async () => {
                if (!USE_MODEL || !MODEL){
                    // Load and cache for the first time.
                    const modelJsonUrl = await chrome.runtime.getURL(`model.json`);
                    const path='./model'
                    USE_MODEL = await use.load();
                    MODEL = await tf.loadLayersModel(path);
                }
                
                const embeddings = await USE_MODEL.embed([message.titles]);

                const t = await MODEL.predict(embeddings);
                const predictions = t.dataSync();

                const LABELS = ["bigbird", "count", "grover", "grouch", "erniebert"];
                const idx = predictions.reduce((iMax, x, i, arr) => x > arr[iMax] ? i : iMax, 0);   

                sendResponse({ 'proba': predictions[idx], 'label': (LABELS[idx] ?? "N/A")});
            }
        )();
    }
    return true;
});

chrome.runtime.onSuspend.addListener(function() {
    console.log("Unloading.");
});