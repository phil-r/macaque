const Nightmare = require('nightmare');

module.exports = function macaqueTask({ url }: { url: string }, cb: DrainFunc) {
  console.log(`macaqueTask started with ${url}`);
  const nightmare = Nightmare();
  const result: TaskResult = {
    url,
    title: '',
    status: 'pending',
    links: [],
    errors: { javaScriptErrors: [], resourceErrors: [] }
  };

  const errorHandler = (type: string, message: string, stack: any) => {
    // console.log('javaScriptError', { type, message, stack });
    result.errors.javaScriptErrors.push({ type, message, stack });
  };

  // https://electron.atom.io/docs/api/web-contents/#event-did-get-response-details
  const responseDetailsHandler = (
    event: Event,
    status: boolean,
    newURL: string,
    originalURL: string,
    httpResponseCode: number,
    requestMethod: string,
    referrer: string,
    headers: Object,
    resourceType: string
  ) => {
    if (httpResponseCode >= 400) {
      const error = {
        // event,
        status,
        newURL,
        originalURL,
        httpResponseCode,
        requestMethod,
        referrer,
        headers,
        resourceType
      };
      // console.log('resourceError', error);
      result.errors.resourceErrors.push(error);
    }
  };

  // https://github.com/segmentio/nightmare/issues/1070
  function workAround(nightmare: any) {
    return nightmare.evaluate(function() {
      const title = document.title;
      const location = document.location.toString();
      const links = [];
      for (let i = 0; i < document.links.length; i++)
        if (document.links[i].hostname === document.location.hostname) {
          links.push(document.links[i].href);
        }
      return { links, title, location };
    });
  }

  nightmare
    .on('page', errorHandler)
    .on('did-get-response-details', responseDetailsHandler)
    .goto(url)
    .evaluate(() => {})
    .then(() => {
      return workAround(nightmare);
    })
    .catch((error: Error) => {
      console.log('using workaround');
      return workAround(nightmare);
    })
    .then(
      ({
        title,
        links,
        location
      }: {
        title: string,
        links: Array<string>,
        location: string
      }) => {
        result.title = title;
        result.links = Array.from(new Set(links));
        if (result.url !== location) {
          result.redirect = location;
        }
        result.status = 'completed';
        nightmare.removeListener('page', errorHandler);
        nightmare.removeListener(
          'did-get-response-details',
          responseDetailsHandler
        );
        cb(undefined, result);
      }
    )
    .catch((err: Error) => {
      nightmare.removeListener('page', errorHandler);
      nightmare.removeListener(
        'did-get-response-details',
        responseDetailsHandler
      );
      cb(err);
    });
};
