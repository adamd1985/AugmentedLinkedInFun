document.addEventListener("DOMContentLoaded", function () {
    console.log(document.domain);//It outputs id of extension to console

    renderStatus('Search term: Google image search result: ');

    chrome.tabs.query({ //This method output active URL 
        "active": true,
        "currentWindow": true,
        "status": "complete",
        "windowType": "normal"
    }, function (tabs) {
        for (tab in tabs) {
            console.log(tabs[tab].url);
        }
    });
});


function renderStatus(statusText) {
    document.getElementById('status').textContent = statusText;
}