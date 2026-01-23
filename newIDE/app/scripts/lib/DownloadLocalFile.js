// @ts-check
const fs = require('fs');
const https = require('https');
const {default: axios} = require('axios');

// Create HTTPS agent that ignores SSL certificate errors (for corporate proxies)
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * @param {string} url
 * @param {string} outputPath
 * @returns {Promise<void>}
 */
const downloadLocalFile = async (url, outputPath) => {
  const writer = fs.createWriteStream(outputPath);
  const response = await axios.get(url, {
    responseType: 'stream',
    httpsAgent,
  });

  return new Promise((resolve, reject) => {
    response.data.pipe(writer);
    let error = null;
    writer.on('error', err => {
      error = err;
      writer.close();
      reject(err);
    });
    writer.on('close', () => {
      if (!error) {
        resolve();
      }

      // No need to call `reject` here, as it will have been called in the
      // 'error' callback.
    });
  });
};

module.exports = {
  downloadLocalFile,
};
