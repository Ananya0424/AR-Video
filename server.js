/**
 * QR AR Video Experience — Express Server
 * 
 * Production-ready static server with security headers,
 * gzip compression, and proper MIME types for WebM video.
 * Configured for deployment on Render.
 */

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const os = require('os');
const mongoose = require('mongoose');
const Video = require('./models/Video');
const seedDatabase = require('./seed');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ar-video';

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB successfully at:', MONGODB_URI);
    await seedDatabase();
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
  });

/* ──────────────────────────────────────────────
   Local IP Discovery (for easy mobile testing)
   ────────────────────────────────────────────── */
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Look for IPv4 addresses that aren't loopback
      // family can be 'IPv4' or 4 depending on Node version
      const isIPv4 = iface.family === 'IPv4' || iface.family === 4;
      if (isIPv4 && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

/* ──────────────────────────────────────────────
   Middleware
   ────────────────────────────────────────────── */

// Gzip / Brotli compression for all responses
app.use(compression());

// JSON body parser for remote diagnostic logging
app.use(express.json());

// Remote client logger API
app.post('/api/log', (req, res) => {
  const { type, message } = req.body;
  console.log(`[CLIENT ${type.toUpperCase()}] ${message}`);
  res.sendStatus(200);
});

// GET video by QR ID
app.get('/api/videos/:id', async (req, res) => {
  try {
    const video = await Video.findOne({ qrId: req.params.id });
    if (!video) {
      return res.status(404).json({ error: `Video with QR ID ${req.params.id} not found` });
    }
    res.json({
      qrId: video.qrId,
      title: video.title,
      videoUrl: video.videoUrl,
      active: video.active
    });
  } catch (err) {
    console.error('GET /api/videos/:id error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update video URL by QR ID
app.put('/api/videos/:id', async (req, res) => {
  try {
    const { videoUrl, title, active } = req.body;
    if (!videoUrl) {
      return res.status(400).json({ error: 'videoUrl is required' });
    }
    
    const updateData = { videoUrl };
    if (title !== undefined) updateData.title = title;
    if (active !== undefined) updateData.active = active;

    const video = await Video.findOneAndUpdate(
      { qrId: req.params.id },
      { $set: updateData },
      { new: true }
    );

    if (!video) {
      return res.status(404).json({ error: `Video with QR ID ${req.params.id} not found` });
    }

    res.json({
      qrId: video.qrId,
      title: video.title,
      videoUrl: video.videoUrl,
      active: video.active
    });
  } catch (err) {
    console.error('PUT /api/videos/:id error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Security headers — fully relaxed for AR camera + CDN + tunnel access
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
  })
);

// Explicit Permissions-Policy to allow camera usage
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=*, microphone=*');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

// Serve local IP information for QR generator
const fs = require('fs');

app.get('/api/info', (_req, res) => {
  const localIp = getLocalIpAddress();
  let url = localIp !== 'localhost' ? `http://${localIp}:${PORT}` : `http://localhost:${PORT}`;

  // If a public tunnel (like Serveo) is running, read its URL
  try {
    const tunnelJsonPath = path.join(__dirname, 'tunnel.json');
    if (fs.existsSync(tunnelJsonPath)) {
      const data = JSON.parse(fs.readFileSync(tunnelJsonPath, 'utf8'));
      if (data && data.url) {
        url = data.url;
      }
    }
  } catch (err) {
    console.warn('Error reading tunnel.json:', err.message);
  }

  res.json({
    localIp,
    port: PORT,
    url
  });
});

// Serve static files from /public with aggressive caching for assets

app.use(
  express.static(path.join(__dirname, 'public'), {
    etag: true,
    setHeaders(res, filePath) {
      // Ensure correct MIME for transparent WebM videos
      if (filePath.endsWith('.webm')) {
        res.setHeader('Content-Type', 'video/webm');
      }
      
      // Cache media assets, but not HTML/JS/CSS to avoid browser cache issues
      if (filePath.endsWith('.mp4') || filePath.endsWith('.webm') || filePath.match(/\.(jpg|jpeg|png|gif|svg|ico)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
      } else {
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      }
    },
  })
);

// SPA fallback — serve index.html for any unmatched route
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ──────────────────────────────────────────────
   Start
   ────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n🚀  QR AR Video Experience`);
  console.log(`   Running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
});
