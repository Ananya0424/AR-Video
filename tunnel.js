/**
 * SSH Serveo Tunnel Manager
 * 
 * Programmatically spawns an SSH tunnel to serveo.net,
 * extracts the HTTPS URL, and writes it to tunnel.json so the 
 * Express server can serve it to the frontend for easy QR scanning.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const tunnelJsonPath = path.join(__dirname, 'tunnel.json');

// Clean up old tunnel config on startup
if (fs.existsSync(tunnelJsonPath)) {
  fs.unlinkSync(tunnelJsonPath);
}

console.log('🔄 Launching Serveo SSH Tunnel...');

// Spawn ssh command
const ssh = spawn('ssh', [
  '-o', 'StrictHostKeyChecking=no',
  '-o', 'ServerAliveInterval=60',
  '-R', '80:localhost:3000',
  'serveo.net'
]);

function parseUrl(text) {
  // Matches e.g. https://xxxx.serveousercontent.com or https://serveo.net/xxxx
  const match = text.match(/https:\/\/[a-zA-Z0-9.-]+\.serveo(?:usercontent)?\.com/);
  if (match) {
    const url = match[0];
    console.log(`\n🎉 Exposing server publicly at: \x1b[36m${url}\x1b[0m`);
    console.log(`📱 Scan the QR code in your browser pointing to this URL!\n`);
    
    fs.writeFileSync(tunnelJsonPath, JSON.stringify({ url }));
  }
}

ssh.stdout.on('data', (data) => {
  const str = data.toString();
  process.stdout.write(`[SSH] ${str}`);
  parseUrl(str);
});

ssh.stderr.on('data', (data) => {
  const str = data.toString();
  process.stderr.write(`[SSH STDERR] ${str}`);
  parseUrl(str);
});

ssh.on('close', (code) => {
  console.log(`\n🔴 SSH Tunnel process closed (code ${code})`);
  if (fs.existsSync(tunnelJsonPath)) {
    fs.unlinkSync(tunnelJsonPath);
  }
});

// Graceful cleanup
process.on('SIGINT', () => {
  ssh.kill();
  process.exit();
});
process.on('exit', () => {
  if (fs.existsSync(tunnelJsonPath)) {
    fs.unlinkSync(tunnelJsonPath);
  }
});
