const fs = require('fs');
const path = require('path');
const https = require('https');

const jsDir = path.join(__dirname, 'public', 'js');
if (!fs.existsSync(jsDir)) {
  fs.mkdirSync(jsDir, { recursive: true });
}

const downloads = [
  {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/aframe/1.4.2/aframe.min.js',
    dest: path.join(jsDir, 'aframe.min.js')
  },
  {
    url: 'https://cdn.jsdelivr.net/gh/c-frame/aframe-extras@7.0.0/dist/aframe-extras.min.js',
    dest: path.join(jsDir, 'aframe-extras.min.js')
  }
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url} to ${dest}...`);
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      // Handle redirects (GitHub raw/cdn redirects can occur)
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: Status code ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Successfully downloaded ${dest}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

(async () => {
  try {
    for (const dl of downloads) {
      await downloadFile(dl.url, dl.dest);
    }
    console.log('All libraries downloaded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Download failed:', err.message);
    process.exit(1);
  }
})();
