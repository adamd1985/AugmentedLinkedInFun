// The CoPilot needs to be 'required' or included in the manifest before this file.
let lIcoPilot = new LinkedInCoPilot(false);


chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        console.log(sender.tab ?
            "from a content script:" + sender.tab.url :
            "from the extension");
        if (request.cmd === "run") {
            lIcoPilot.start();
            sendResponse({ farewell: "goodbye" });
        }
    }
);

if (document?.URL.startsWith("https://www.linkedin.com/in/")) {
    console.log(`Running from a profile page: ${document?.URL}`);
}