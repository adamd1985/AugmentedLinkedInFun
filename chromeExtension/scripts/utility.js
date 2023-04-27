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
    this.dlg = null;
  } 
   

  /**
   * Augment the linkedin experience by adding info or visual cues.
   * All will happen async as they  call our classification server.
   * @param {*} profiles 
   */
  async augmentLinkedInExperience(profiles) {
      let promises = [];
      profiles.forEach(function(profile) {
        if (!profile)
          return

        const data = {
          'descriptions': (profile.posts?.join(' ') ?? ' ') + profile.titles,
        };

        promises.push(
          fetch('http://127.0.0.1:800/profile', {
            method: "POST", 
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(data), 
          })
          .then(response=>response.json())
          .then((data) => {
            let search = `^${profile.user}$`;
            let re = new RegExp(search, "g");
            $(`h1.text-heading-xlarge:contains("${profile.user}")`).each((index, element) => {
              let text = $(element).text().trim();
              if (text.match(re)){
                if (data['proba'] && data['proba'] >= 30){
                  $(element).text(`${text} [Fit: (${data['proba']}%), as: ${data['label']}]`);
                }
                else{
                  $(element).text(`${text} [No Fit]`);
                }
              }
            })
            $(`div:contains("${profile.user}")`).each((index, element) => {
              let text = $(element).text().trim();
              if (text.match(re)){
                if (data['proba'] && data['proba'] >= 30){
                  $(element).text(`${text} [Fit: (${data['proba']}%), as: ${data['label']}]`);
                }
                else{
                  $(element).text(`${text} [No Fit]`);
                }
              }
            })
            $(`a:contains("${profile.user}")`).each((index, element) => {
              let text = $(element).text().trim();
              if (text.match(re)){
                if (data['proba'] && data['proba'] >= 30){
                  $(element).text(`${text} [Fit: (${data['proba']}%), as: ${data['label']}]`);
                }
                else{
                  $(element).text(`${text} [No Fit]`);
                }
              }
            })            
            $(`img`).each(async (index, element) => {
              // TODO: Inefficient, will load all images for each profile.
              // Use tokens to discern if this image is related to the profile.
              let name = $(element).attr('alt')
              if (!name){
                return;
              }
              name = name.trim().toLocaleLowerCase();
              if (!name.includes("photo") && !name.includes("profile")){
                return;
              }
              const tokens = profile.user.toLocaleLowerCase().split(" ");
              for (const tok of tokens){
                if (name.includes(tok)){
                  const imgUrl = await chrome.runtime.getURL(`assets/${data['label']}.png`)
                  $(element).attr('href', imgUrl);
                  $(element).attr('src', imgUrl);
                  break;
                }
              }
            })
          }).catch ((error) => {
            console.log('Error: ', error);
          })
        );
    }); 
  }

  /**
   * Augment the linkedin experience by including how to message the person.
   * @param {*} profiles 
   */
  augmentWithMessages(profiles) {
    let promises = [];

    if (!document?.URL.startsWith("https://www.linkedin.com/in/")) {
        return;
    }
    const name = $(`h1.text-heading-xlarge`).text();
    const dlg = this.dlg;
    profiles.forEach(function(profile) {
      if (!profile || name.toLowerCase() !== profile.user.toLowerCase()){
        return
      }
      const data = {
        'profiles': profile.titles,
      };

      
      promises.push(
        fetch('http://127.0.0.1:800/messages', {
          method: "POST", 
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data), 
        })
        .then(response=>response.json())
        .then((data) => {
          $("#copilotmsg-content").text(data.messages ?? "Oops nothing was generated, contact your human copilot!")
          dlg.showModal();
        }).catch ((error) => {
            console.log('Error: ', error);
        })
      );
  }); 
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
    let profilesJson = JSON.stringify(profiles);
    
    await chrome.storage.local.set({ profiles: profilesJson }).catch(err => console.error(err));
  }

  async loadCache(){
    let profilesJson = []; 
    try{
      const rawProfilesJson = await chrome.storage.local.get(["profiles"]);
      if (rawProfilesJson){
        profilesJson = JSON.parse(rawProfilesJson['profiles'])
      }
    }
    catch (e){
      console.log(`Error pulling Cached objects: ${e}`);
    }
    
    return profilesJson;
  }

  /**
   * Given a collection of profile links, we collect relevant information.
   * @param {*} links Absolute links to profiles. If link is not for a profile (we use xpath), it will be ignored.
   * @returns Porfile object.
   */
  async getProfilesDetailsFromLinks(links, cachedProfiles) {
    function _scrape(profile){
      let lnName = $("main h1", profile).text()
      let profileObj = null;
      if (lnName !== null && lnName.length > 0) {
        lnName = lnName.trim();
        console.debug(`found name: ${lnName}`);
      }
      // TODO: Collect Job history also, and package it in an enumerable structure
      let posts = null;
      $("ul.pvs-list li", profile).each((index, element) => {
        let post = $("div.inline-show-more-text", element)?.text()?.trim();
        if (post) {
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
      if ((lnName !== null && lnName !== "") && (titles !== null && titles !== "")) {
        // TODO: create a shared object, representing the profile.
        profileObj = {
          user: lnName,
          posts: posts,
          titles: titles,
          link: ''
        }
      }
      return profileObj;
    }
    
    let profiles = []
    let calls = []
    let MAX_ITERS = 10
    for (const link of links) {
      let profile = null;

      if (cachedProfiles && cachedProfiles.length > 0){
        // If already scraped, we can skip it.
        for(let cp in cachedProfiles){
          if(cp.link == link){
            profile = cp; 
            break;
          }
        }
        if (profile){
          profiles.push(profile);
          continue;
        }
      }
      
      if (this.IS_TEST !== true) {
        // TODO: Avoid rate limit and allow dynamic content to load - can it be better?
        // Randomly wait for up to 2800ms.
        await new Promise(r => setTimeout(r, Math.floor(Math.random() * 3200)));
        let _link = link;
        let response = await fetch(link);
        profile = await response.text();
        let call = chrome.runtime.sendMessage({ link: link }).then(response => {
          let profile = response?.profile;
          let profileObj = null;
          if (profile) {
            profileObj = _scrape(profile);
            if (profileObj){
              profileObj.link = _link;
            }
          }
          return Promise.resolve(profileObj);
        });
        calls.push(call)
        if (MAX_ITERS <= 0){
          break; // TODO: Just to make things faster.
        }
        MAX_ITERS -= 1;
      }
      else {
        // Only in NodeJS env.
        const fs = require('fs').promises;
        profile = await fs.readFile("linkedInSampleProfile.html", 'utf8')
        profiles.push(_scrape(profile));
      }
      
    }
    if (this.IS_TEST !== true && calls.length>0) {
      profiles = profiles.concat(await Promise.all(calls));
    }
    return profiles;
  }

  /**
   * The start function that will initiate the scraping and perform the linkedIn augmentation.
   * @returns 
   */
  async start() {
    console.log(`The HREF our linkedIn Extension is succesfully running on: ${document?.URL}`);
    let profiles = this. loadCache();

    const dlgHtml = "<dialog close id=\"copilotmsg\"><div > \
                      <p> \
                        <h2>Copilot Sourcing Suggestion</h2> \
                        <p id=\"copilotmsg-content\"></p> \
                      </p> \
                      <form method=\"dialog\"> \
                        <button>OK</button> \
                      </form> \
                      </div></dialog>"


    if( document) {
        $('body').prepend(dlgHtml); 

        this.dlg = document.getElementById('copilotmsg');  
    }

    // User is scrolling the site, get all profile links.
    let links = this.getAllLinks()
    if (links.length <= 0) {
      return;
    }

    console.log(`We found these links: ${links}`)
    
    // Get profile information on which to classify the users.
    profiles = await this.getProfilesDetailsFromLinks(links, profiles)

    console.log(`We scraped this number of profiles: ${profiles.length}`)

    // cach in case of failure, we can just revert.
    this.cacheFindings(profiles)

    // Augment with classification.
    this.augmentLinkedInExperience(profiles);
    this.augmentWithMessages(profiles);
  }
}

// exports the variables and functions above so that other modules can use them
// Both for DOM and NodeJS.
const global = (typeof window === "undefined" ? module?.exports : window);
global.LinkedInCoPilot = LinkedInCoPilot;