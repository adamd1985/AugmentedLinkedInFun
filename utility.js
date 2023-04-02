const { constrainedMemory } = require('process');

// This section is not required for the final plugin
const fs = require('fs').promises;

class LinkedInCoPilot{
  constructor(site, localTest) {
    let jsdom = require('jsdom')
    let dom = new jsdom.JSDOM(site)

    global.$ = require('jquery')(dom.window)

    this.IS_TEST = localTest;
  } 
   

  replaceText(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      Object.keys(replacements).forEach(function (key) {
        var regex = new RegExp(key, "gi");
        node.textContent = node.textContent.replace(regex, "NPC");
      });
    }
  }

  traverse(node) {
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

  getAllLinks() {
    var links = [];
    var elements = $('a[href*="/in/"]').each((index, element) => {
      links.push($(element).attr('href'));
    })

    return links;
  }


  async getProfilesDetailsFromLinks(links) {
    
    let profiles = []
    for (const link of links) {
      let profile;
      if (this.IS_TEST !== true) {
        const response = await fetch(link);
        profile = await response.text();
      }
      else {
        profile = await fs.readFile("linkedInSampleProfile.html", 'utf8')
      }
      
      let lnName = $("h1.top-card-layout__title", profile).text()
      if (lnName !== null && lnName.length > 0) {
        lnName = lnName.trim();
        console.debug(`found name: ${lnName}`);
      }

      let posts = null;
      $("section[data-section='posts'] h3.base-main-card__title", profile).each((index, element) => {
        let post = element.textContent.trim();
        if (posts === null) {
          posts = new Array();
        }
        posts.push(post)
  
      })
    
      let titles = $("h2.top-card-layout__headline", profile).text()
      if (titles !== null && titles.length > 0) {
        titles = titles.trim();
      }
      
      if (lnName !== null || posts !== null || titles !== null) {
        let obj = {
          user: lnName,
          posts: posts,
          titles: titles,
        }

        profiles.push(obj)
      }
    }
    
    return profiles;
  }

  async start() {
    let links = this.getAllLinks()
    if (links.length <= 0) {
      return;
    }
    
    let profiles = await this.getProfilesDetailsFromLinks(links)
    console.log(JSON.stringify(profiles))
  }
}

fs.readFile('./linkedInSamplePost.html', 'utf8').then(f => {
  let lIcoPilot = new LinkedInCoPilot(f, true);

  var theHref = $("a[href^='http']").eq(0).attr("href");
  console.log(`The HREF our linkedIn Extension is running on: ${theHref}`);

  lIcoPilot.start();
})


