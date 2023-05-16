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
import SavedClassifier from '../../notebooks/models/tfjs/model.json'

const DEFAULT_MODEL_PATH='./model.json'

/**
 * Async loads a USE and our Custom models on construction.  
 * 
 * Classifies a linkedin profile to the content.js to manipulate the DOM.
 */
class ProfileClassifier {
    constructor(path=null) {
      this.loadModel(savedClassifier);

      this.savedClassifier =  savedClassifier;
    }
  
    /**
     * Loads USE and custom Models, warms the models up.
     */
    async loadModel() {
      console.log('Loading model...');
      
      try {
        // Chrome will have a different path setup for extensions.
        const modelJsonUrl = await chrome.runtime.getURL(`model.json`);
        this.model = await tf.loadLayersModel(this.savedClassifier);
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
        console.error('Unable to load models', e);
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

        const embeddings = await this.useModel.embed([message.titles]);
        const t = await this.model.predict(embeddings);
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

/**
 * Async scrapes a LinkedIn profile in another tab.  
 * 
 * Returns DOM to the content.js to do alterations to the feed.
 */
class ProfileScrapper {
    constructor() {
      this.loadModel();
    }

    /**
     * Triggers our models to make a prediction.
     * @param {descriptions} string Profile title and descriptions.
     * @param {sendResponse} function messaging callback to reply to the content script.
     */
    async scrapeProfile(descriptions, sendResponse) {
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
}

// Global variables.
let PROFILE_CLASSIFIER = null;
let PROFILE_SCRAPPER = null;

/**
 * Extension load.
 */
chrome.runtime.onInstalled.addListener(async function () {
    console.log("CoPilot loaded, models loading and initializing.");

    PROFILE_CLASSIFIER = new ProfileClassifier(SavedClassifier);
    PROFILE_SCRAPPER = new  ProfileScrapper();
});

/**
 * Keyboard commnad call.
 */
chrome.commands.onCommand.addListener((command) => {
    console.log(`Command: ${command}, sending message to scrape.`);
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        // Get the current TAB.
        chrome.tabs.sendMessage(tabs[0].id,{ cmd: "run" });  
    });
});

/**
 * Message handler.
 * If we return TRUE, we are informing chrome that the result of the call will happen asynch.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log(`Message from ${sender}: ${JSON.stringify(message)}`)
    if (message?.link) {
        PROFILE_SCRAPPER.scrapeProfile(message.link, sendResponse);
    }
    else if (message?.descriptions) {
        PROFILE_CLASSIFIER.classifyProfile(message.descriptions, sendResponse);
    }
    else{
        console.warn(`An unknown message ${message} was received.`);
        return false;
    }
    return true;
});

/**
 * Unload
 */
chrome.runtime.onSuspend.addListener(function() {
    console.log("Unloading.");
});