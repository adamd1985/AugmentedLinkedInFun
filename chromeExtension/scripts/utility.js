/**
 * A utility for any browser plugin that will Augment a linkedin page and scrape its data.
 */
class LinkedInCoPilot{

  /**
   * Constructor
   * @param {*} localTest If this is true, then it's running from a test NodeJs. 
   */
  constructor(localTest) {

    this.IS_TEST = localTest;
  } 
   

  /**
   * TODO: Augment the linkedin experience by adding info or visual cues.
   * @param {*} profiles 
   */
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

  /**
   * scrape all profile links.
   */
  getAllLinks() {
    const re = new RegExp("^(http|https)://", "i");;
    var links = [];

    $('a[href*="/in/"]').each((index, element) => {
      let link = $(element).attr('href');
      if (/^(http|https).*/i.test(link) === false) {
        // Linkedin may use relative links, we need to convert to absolutes.
        link = `https://www.linkedin.com${link}`
      }
      
      links.push(link);
    })

    return links;
  }

  /**
   * Utility function to store profiles in browser storage in case we need to recover from failures.
   * @param {*} profiles 
   */
  async cacheFindings(profiles) {
    console.log(JSON.stringify(profiles));
    const csvString = [
      [
        "user",
        "posts",
        "titles"
      ],
      ...profiles.map(item => [
        item.user?.replace(/(\r\n|\n|\r|,)/gm, ";"),
        item.posts?.join(';').replace(/(\r\n|\n|\r|,)/gm, ";"), // Comma seperated files, cannot have commas.
        item.titles?.replace(/(\r\n|\n|\r|,)/gm, ";"),
      ])
    ]
    .map(e => e.join(",")) 
    .join("\n");
    
    console.log(csvString);
    chrome.storage.local.set({ profiles: csvString })
      .catch(err => console.error(err));
  }

  /**
   * Given a collection of profile links, we collect relevant information.
   * @param {*} links Absolute links to profiles. If link is not for a profile (we use xpath), it will be ignored.
   * @returns Porfile object.
   */
  async getProfilesDetailsFromLinks(links) {
    let profiles = []
    for (const link of links) {
      let profile;
      if (this.IS_TEST !== true) {
        
        let response = await fetch(link);
        profile = await response.text();
        
        // TODO: Scale this to multithreaded by using promises.
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
        console.debug(`found name: ${lnName}`);
      }

      // TODO: Collect Job history also, and package it in an enumerable structure

      let posts = null;
      $("ul.pvs-list li", profile).each((index, element) => {
        let post = $("div.inline-show-more-text", element)?.text()?.trim();
        if (post){
        if (posts === null) {
          posts = new Array();
        }
        posts.push(post)
        }
      })
    
      let titles = $("main div.text-body-medium", profile).text()
      if (titles !== null && titles.length > 0) {
        titles = titles.trim();
      }
      
      // TODO: create a shared object, representing  
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

  /**
   * The start function that will initiate the scraping and perform the linkedIn augmentation.
   * @returns 
   */
  async start() {
    console.log(`The HREF our linkedIn Extension is succesfully running on: ${document?.URL}`);
    
    // TODO: This is not the right way to do it, but we have to make
    // sure all dynamic content is returned.
    await new Promise(r => setTimeout(r, 1600));

    // User is scrolling the site, get all profile links.
    let links = this.getAllLinks()
    if (links.length <= 0) {
      return;
    }

    console.log(`We found these links: ${links}`)
    
    // Get profile information on which to classify the users.
    let profiles = await this.getProfilesDetailsFromLinks(links)

    // cach in case of failure, we can just revert.
    this.cacheFindings(profiles)

    // Augment with classification.
    this.augmentLinkedInExperience(profiles);
  }
}

// exports the variables and functions above so that other modules can use them
// Both for DOM and NodeJS.
const global = (typeof window === "undefined" ? module?.exports : window);
global.LinkedInCoPilot = LinkedInCoPilot;