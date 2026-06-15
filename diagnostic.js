const localtunnel = require('localtunnel');
const fs = require('fs');

const logPath = 'diagnostic.log';
fs.writeFileSync(logPath, 'Starting localtunnel diagnostic...\n');

(async () => {
  try {
    fs.appendFileSync(logPath, 'Connecting to localtunnel on port 3000...\n');
    const tunnel = await localtunnel({ port: 3000 });
    fs.appendFileSync(logPath, `Tunnel created successfully! URL: ${tunnel.url}\n`);
    
    tunnel.on('close', () => {
      fs.appendFileSync(logPath, 'Tunnel closed event fired.\n');
    });

    // Close after 10s
    setTimeout(() => {
      tunnel.close();
      fs.appendFileSync(logPath, 'Tunnel closed by timeout.\n');
      process.exit(0);
    }, 10000);
  } catch (err) {
    fs.appendFileSync(logPath, `Tunnel failed! Error: ${err.message}\nStack: ${err.stack}\n`);
    process.exit(1);
  }
})();
