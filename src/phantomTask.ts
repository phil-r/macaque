const asyncify = require('async/asyncify');
const Phantom = require('phantom');

async function phantomTask({ url }: { url: string }) {
  return new Promise(async resolve => {
    console.log(`🐵  macaqueTask started with ${url}`);
    const phantom = await Phantom.create([
      '--cookies-file=./.phantom/cookies.txt'
    ]);
    const resourceWait = 300;
    const maxRenderWait = 10000;

    let count = 0;
    let forcedRenderTimeout: any;
    let renderTimeout: any;

    const page = await phantom.createPage();
    // await page.setting('resourceTimeout', 5000);
    await page.property('viewportSize', { width: 1024, height: 720 });
    await page.setting('loadImages', true);
    await page.setting(
      'userAgent',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.3029.110 Safari/537.36'
    );
    // await page.property('customHeaders', {
    //   'Host': 'getgrover.com',
    //   'Origin': 'getgrover.com'
    // });

    const result: TaskResult = {
      url,
      title: '',
      status: 'pending',
      links: [],
      errors: { javaScriptErrors: [], resourceErrors: [] }
    };

    async function doExit() {
      console.log('!!! doExit !!!');
      clearTimeout(renderTimeout);
      clearTimeout(forcedRenderTimeout);
      await page.render('./.phantom/screenshot.jpeg', {
        format: 'jpeg',
        quality: '90'
      });
      await phantom.exit();
      resolve(result);
    }
    await page.on('onResourceRequested', function({ id, url }: any) {
      count += 1;
      // console.log(`> ${id} - ${url}`);
      clearTimeout(renderTimeout);
    });

    await page.on('onResourceReceived', function({
      stage,
      status,
      id,
      url
    }: any) {
      if (!stage || stage === 'end') {
        count -= 1;
        // console.log(`< ${id}/${count} ${status} ${url}`);
        if (count === 0) {
          renderTimeout = setTimeout(doExit, resourceWait);
        }
      }
    });

    // Error codes can be found here: http://doc.qt.io/qt-4.8/qnetworkreply.html#NetworkError-enum
    await page.on('onResourceError', function({
      id,
      url,
      errorCode,
      errorString
    }: any) {
      console.info('onResourceError', { id, url, errorCode, errorString });
    });

    await page.on('onResourceTimeout', function({
      id,
      method,
      url,
      time,
      headers,
      errorCode,
      errorString
    }: any) {
      console.info('onResourceTimeout', { id, url, errorCode, errorString });
    });

    await page.on('onError', function(msg: string, trace: Array<string>) {
      console.info('onError', { msg, trace });
    });

    result.status = await page.open(url);

    const {
      title,
      location,
      links
    }: {
      title: string,
      location: string,
      links: Array<string>
    } = await page.evaluate(function() {
      var title = document.title;
      var location = document.location.toString();
      var links = [];
      for (var i = 0; i < document.links.length; i++)
        if (document.links[i].hostname === document.location.hostname) {
          links.push(document.links[i].href);
        }
      return { links: links, title: title, location: location };
    });

    // console.log({ title, location, links });
    result.title = title;
    result.links = Array.from(new Set(links)); // TODO: uncomment
    if (result.url !== location) {
      result.redirect = location;
    }
    result.status = 'completed';

    forcedRenderTimeout = setTimeout(function() {
      console.log(`Unfinished requests: ${count}`); // TODO: how to get them?
      doExit();
    }, maxRenderWait);
    // await phantom.exit();
    // return result;

    // const content = await page.property('content');
    // console.log(content);
  });
}

module.exports = asyncify(phantomTask);
