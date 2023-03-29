const jsdom = require('jsdom')
const fs = require('fs');

fs.readFile('./linkedInSamplePost.html', 'utf8', (err, data) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(data);
});

const liFeedSample = 

  
const dom = new jsdom.JSDOM("")
const $ = require('jquery')(dom.window)

// Helper function to replace text
function replaceText(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    Object.keys(replacements).forEach(function(key) {
      var regex = new RegExp(key, "gi");
      node.textContent = node.textContent.replace(regex, "NPC");
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

function getAllLinks(document) {
  var links = [];
  var elements = $('a[href^="https://www.linkedin.com"]', document).each(link => {
    if (link.href.startsWith("http")) {
      links.push(element.href);
    }
  })

  return links;
}


async function getNamesFrom(links) {
  let lnName = null;
  
  for (link in links) {
    html = await (await fetch(link)).text();
    lnName = $(html).find(".pv-text-details__left-panel").find("h1").text()
    if (lnName !== null && lnName.length > 0) {
      console.log(`found name: ${lnName}`);
      break;
    }
  }
  
  return lnName;
}


// Call the traverse function on the entire document
// traverse(document.body);
async function main() {
  links = getAllLinks(dom)
  names =  await getNamesFrom(links)
}

var theHref = $("a[href^='http']").eq(0).attr("href");
console.log(`The HREF our linkedIn Extension is running on: ${theHref}`);
main();
