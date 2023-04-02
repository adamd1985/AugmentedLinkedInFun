chrome.runtime.onInstalled.addListener(function () {
  console.log("CoPilot loaded.")
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

                    console.log(JSON.stringify(profile))
                    return sendResponse({ profile: profile});
                })
                .then(() => chrome.tabs.remove(tabID))
                .catch(error => console.error(error.message))
            })
    } 

    return true;
});

chrome.runtime.onSuspend.addListener(function() {
  console.log("Unloading.");
});