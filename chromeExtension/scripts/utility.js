class LinkedInCoPilot{
  constructor(localTest) {

    this.IS_TEST = localTest;
  } 
   

  augmentLinkedInExperience(profiles) {
    for (let profile of profiles) {
      $(`span:contains("${profile.user}")`).each((index, element) => {
        $(element).text('NPC');
      })
      $(`a:contains("${profile.user}")`).each((index, element) => {
        $(element).text('NPC');
      })
      $(`div:contains("${profile.user}")`).each((index, element) => {
        $(element).text('NPC');
      })
    }
  }

  getAllLinks() {
    const re = new RegExp("^(http|https)://", "i");;
    var links = [];

    $('a[href*="/in/"]').each((index, element) => {
      let link = $(element).attr('href');
      if (/^(http|https).*/i.test(link)) {
        // Linkedin uses ones own profile as relative URL, the rest as an absolute.
        links.push(link);
      }

    })

    return links;
  }


  async getProfilesDetailsFromLinks(links) {
    let profiles = []
    for (const link of links) {
      let profile;
      if (this.IS_TEST !== true) {
        
        let response = await fetch(link);
        profile = await response.text();
        
        response = await chrome.runtime.sendMessage({link: link});
        profile = response?.profile;
      }
      else {
        // Only in NodeJS env.
        const fs = require('fs').promises;
        profile = await fs.readFile("linkedInSampleProfile.html", 'utf8')
      }
      
      if (!profile) {
        // Nothing to process, skip to next.
        continue;  
      }

      let lnName = $("main h1", profile).text()
      if (lnName !== null && lnName.length > 0) {
        lnName = lnName.trim();
        console.log(`found name: ${lnName}`);
      }

      let posts = null;
      $("ul.pvs-list li", profile).each((index, element) => {
        let post = $("div.inline-show-more-text", element)?.text()?.trim();
        if (post){
        if (posts === null) {
          posts = new Array();
        }
        posts.push(post)
        console.log(`found these posts: ${posts}`);}
      })
    
      let titles = $("main div.text-body-medium", profile).text()
      if (titles !== null && titles.length > 0) {
        titles = titles.trim();
        console.log(`found these titles: ${titles}`);
      }
      
      if ((lnName !== null && lnName !=="") && (titles !== null && titles !== "")) {
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
    const theHref = $("a[href^='http']").eq(0).attr("href");
    console.log(`The HREF our linkedIn Extension is succesfully running on: ${theHref}`);
    
    // User is scrolling the site, get all profile links.
    let links = this.getAllLinks()
    if (links.length <= 0) {
      return;
    }

    console.log(`We found these links: ${links}`)
    
    // Get profile information on which to classify the users.
    let profiles = await this.getProfilesDetailsFromLinks(links)

    // Augment with classification.
    this.augmentLinkedInExperience(profiles);
  }
}

// exports the variables and functions above so that other modules can use them
// Both for DOM and NodeJS.
const global = (typeof window === "undefined" ? module?.exports : window);
global.LinkedInCoPilot = LinkedInCoPilot;