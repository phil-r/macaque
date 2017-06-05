const url = require('url');

const queue = require('async/queue');

const macaqueTask = require('./phantomTask');

interface TaskErrors {
  javaScriptErrors: Array<Object>,
  resourceErrors: Array<Object>
}

interface TaskResult {
  url: string,
  redirect?: string,
  errors: TaskErrors,
  title: string,
  status: string,
  links: Array<string>
}

interface DrainFunc {
  (error?: any, result?: TaskResult): any
}

function macaque(urls: Array<string>, workers: number): Promise<Object> {
  return new Promise(resolve => {
    const results: any = {};
    const q = queue(macaqueTask, workers);
    q.drain = () => {
      console.log('All finished');
      resolve({ results });
    };
    const itemDrain: DrainFunc = (error, result: TaskResult) => {
      if (error) {
        console.error('itemDrain ERROR!', error);
        if (error.url) {
          results[error.url] = { status: 'failure', ...error };
        }
        return;
      }
      console.log('itemDrain', result);
      const resultURLHostname = new url.URL(result.url).hostname;
      if (result.redirect) {
        const redirectURLHostname = new url.URL(result.redirect).hostname;
        if (redirectURLHostname !== resultURLHostname) {
          return;
        }
      }
      results[result.url] = result;
      console.log('RESULTS', Object.keys(results));
      const newLinks = result.links
        .map(link => {
          // remove hashes from the links
          const linkObj = new url.URL(link);
          return linkObj.href.replace(linkObj.hash, '');
        })
        .filter(link => {
          // check if same domain
          const sameDomain = new url.URL(link).hostname === resultURLHostname;
          // check if already in the list
          const exists = !!results[link];
          return !exists && sameDomain;
        });
      // add dummy objects to results. It will ber replaced after check.
      newLinks.forEach(link => (results[link] = { status: 'pending' }));
      const newTasks = newLinks.map(link => ({ url: link }));
      if (newTasks.length){
        q.push(newTasks, itemDrain);
      }
    };
    q.push(urls.map(url => ({ url })), itemDrain);
  });
}

module.exports = macaque;
