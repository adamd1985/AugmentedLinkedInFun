import "./tfjs.js";
// import "./tfjs-node.js";
// import * as use from './universal-sentence-encoder.js';

let MODEL = null;
let USE_MODEL = null;
let use = null;
chrome.runtime.onInstalled.addListener(async function () {
    console.log("CoPilot loaded.");

    use = await tf.loadGraphModel('https://tfhub.dev/tensorflow/tfjs-model/universal-sentence-encoder-lite/1/default/1', { fromTFHub: true })
});


chrome.commands.onCommand.addListener((command) => {
    console.log(`Command: ${command}, sending message to scrape.`);
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        // Get the current TAB.
        chrome.tabs.sendMessage(tabs[0].id,{ cmd: "run" });  
    });
});


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