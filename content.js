// Replace all instances of user names with 'NPC'
var replacements = {
  "User Name 1": "NPC",
  "User Name 2": "NPC",
  "User Name 3": "NPC",
  // Add as many user names and corresponding 'NPC' replacements as you'd like
};

// Helper function to replace text
function replaceText(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    Object.keys(replacements).forEach(function(key) {
      var regex = new RegExp(key, "gi");
      node.textContent = node.textContent.replace(regex, replacements[key]);
    });
  }
}

// Recursive function to replace text in all nodes
function traverse(node) {
  var child, next;
  switch (node.nodeType) {
    case Node.ELEMENT_NODE:
      if (node.tagName.toLowerCase() !== "script") {
        for (child = node.firstChild; child; child = next) {
          next = child.nextSibling;
          traverse(child);
        }
      }
      break;
    case Node.TEXT_NODE:
      replaceText(node);
      break;
  }
}

function getAllLinks() {
  var links = [];
  var elements = document.querySelectorAll("a");

  for (var i = 0; i < elements.length; i++) {
    var element = elements[i];

    if (element.href.startsWith("http")) {
      links.push(element.href);
    }
  }

  return links;
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action == "getLinks") {
    var links = getAllLinks();
    sendResponse(links);
  }
});

// Call the traverse function on the entire document
// traverse(document.body);

links = getAllLinks()
alert(links); 