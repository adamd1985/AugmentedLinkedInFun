const { LinkedInCoPilot } = require("./chromeExtension/scripts/utility")
const { assert } = require('console');
const { contains } = require('jquery');


const fs = require('fs').promises;


fs.readFile('./linkedInSamplePost.html', 'utf8').then(f => {
  let jsdom = require('jsdom')

  this.dom = new jsdom.JSDOM(f)
  global.$ = require('jquery')(this.dom.window)
  
  let lIcoPilot = new LinkedInCoPilot(true);
  lIcoPilot.start();
})


