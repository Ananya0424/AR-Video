/**
 * QR AR Video Experience — Main Application Logic
 *
 * Handles:
 *  • Loading → Welcome → AR screen transitions
 *  • Camera initialisation with rear-camera preference + fallback
 *  • A-Frame scene creation with chromakey shader for transparent video overlay
 *  • Floating video overlay with one-finger drag & two-finger pinch
 *  • Comprehensive error handling with user-friendly messages
 *
 * No external dependencies — pure ES6+ vanilla JavaScript.
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   Remote Diagnostic Logger & On-screen Debugger
   ═══════════════════════════════════════════════════════════════ */
const isDebugMode = window.location.search.includes('debug=true');

function sendRemoteLog(type, message) {
  fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, message })
  }).catch(() => {});
}

function logToScreen(type, message) {
  if (!isDebugMode) return;
  const consoleEl = document.getElementById('debug-console');
  const listEl = document.getElementById('debug-log-list');
  if (consoleEl && listEl) {
    consoleEl.style.display = 'block';
    const item = document.createElement('div');
    let color = '#00ff00';
    if (type === 'warn') color = '#ffaa00';
    if (type === 'error') color = '#ff3333';
    item.style.color = color;
    item.style.marginBottom = '2px';
    item.style.borderBottom = '1px dashed rgba(0, 255, 0, 0.1)';
    item.style.paddingBottom = '2px';
    item.textContent = `[${type.toUpperCase()}] ${message}`;
    listEl.appendChild(item);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }
}

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = (...args) => {
  originalLog.apply(console, args);
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  sendRemoteLog('log', msg);
  logToScreen('log', msg);
};
console.warn = (...args) => {
  originalWarn.apply(console, args);
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  sendRemoteLog('warn', msg);
  logToScreen('warn', msg);
};
console.error = (...args) => {
  originalError.apply(console, args);
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  sendRemoteLog('error', msg);
  logToScreen('error', msg);
};

console.log('Remote logger initialized. User Agent: ' + navigator.userAgent);

/* ═══════════════════════════════════════════════════════════════
   A-Frame Component Registration
   ═══════════════════════════════════════════════════════════════
   CRITICAL: A-Frame is loaded in <head>, so AFRAME is guaranteed
   to exist by the time this <body> script executes. We register
   the hologram-video component HERE, before any <a-scene> is
   created, so the component is available when the scene parses.
   ═══════════════════════════════════════════════════════════════ */

if (typeof AFRAME === 'undefined') {
  console.error('FATAL: AFRAME is not defined. A-Frame script failed to load.');
} else {
  console.log('A-Frame loaded successfully, version:', AFRAME.version);

  AFRAME.registerComponent('hologram-video', {
    schema: {
      src:        { type: 'selector' },
      color:      { type: 'color', default: '#00d4ff' },
      similarity: { type: 'number', default: 0.45 },
      smoothness: { type: 'number', default: 0.15 }
    },

    init: function () {
      const video = this.data.src;
      if (!video) {
        console.error('hologram-video: No video element found for selector');
        return;
      }

      console.log('hologram-video: Initializing with video element', video.id);

      // Create VideoTexture from the hidden <video> element
      this.videoTexture = new THREE.VideoTexture(video);
      this.videoTexture.minFilter = THREE.LinearFilter;
      this.videoTexture.magFilter = THREE.LinearFilter;
      this.videoTexture.format = THREE.RGBAFormat;
      this.videoTexture.generateMipmaps = false;

      // Chromakey Shader — removes the background color from the video
      const vertexShader = `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `;

      const fragmentShader = `
        uniform sampler2D src;
        uniform vec3 color;
        uniform float similarity;
        uniform float smoothness;
        varying vec2 vUv;
        void main() {
          vec4 texColor = texture2D(src, vUv);
          float diff = distance(texColor.rgb, color);
          float alpha = smoothstep(similarity, similarity + smoothness, diff);
          gl_FragColor = vec4(texColor.rgb, texColor.a * alpha);
        }
      `;

      const keyColor = new THREE.Color(this.data.color);

      this.material = new THREE.ShaderMaterial({
        uniforms: {
          src:        { value: this.videoTexture },
          color:      { value: keyColor },
          similarity: { value: this.data.similarity },
          smoothness: { value: this.data.smoothness }
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false
      });

      // Create a 1×1 plane; scale is set dynamically below
      const geometry = new THREE.PlaneGeometry(1, 1);
      const mesh = new THREE.Mesh(geometry, this.material);
      this.el.setObject3D('mesh', mesh);

      console.log('hologram-video: Mesh created and added to entity');

      // Scale entity to match video aspect ratio
      const updateScale = () => {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (w && h) {
          const aspect = w / h;
          const targetHeight = 1.8;
          const targetWidth = targetHeight * aspect;
          this.el.setAttribute('scale', `${targetWidth} ${targetHeight} 1`);
          console.log(`hologram-video: Scale set to ${targetWidth.toFixed(2)} x ${targetHeight} (video ${w}x${h})`);
        }
      };

      if (video.readyState >= 1) {
        updateScale();
      } else {
        video.addEventListener('loadedmetadata', updateScale, { once: true });
      }
    },

    update: function () {
      if (this.material && this.material.uniforms) {
        this.material.uniforms.color.value = new THREE.Color(this.data.color);
        this.material.uniforms.similarity.value = this.data.similarity;
        this.material.uniforms.smoothness.value = this.data.smoothness;
      }
    },

    tick: function () {
      // Force the video texture to update every frame
      if (this.videoTexture) {
        this.videoTexture.needsUpdate = true;
      }
    }
  });

  console.log('hologram-video component registered successfully');
}

// Global error handlers
window.addEventListener('error', (event) => {
  console.error('Global JS error:', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', event.reason);
});

/* ═══════════════════════════════════════════════════════════════
   DOM References
   ═══════════════════════════════════════════════════════════════ */
const $ = (id) => document.getElementById(id);

const screens = {
  loading:  $('loading-screen'),
  welcome:  $('welcome-screen'),
  error:    $('error-screen'),
  ar:       $('ar-screen'),
};

const els = {
  progressFill:     $('progress-fill'),
  startBtn:         $('start-btn'),
  retryBtn:         $('retry-btn'),
  errorTitle:       $('error-title'),
  errorDesc:        $('error-desc'),
  errorSteps:       $('error-steps'),
  cameraFeed:       $('camera-feed'),
  overlayContainer: $('overlay-container'),
  hologramVideo:    $('hologramVideo'),       // FIXED: was 'overlay-video' which doesn't exist
  closeBtn:         $('close-btn'),
  switchCamBtn:     $('switch-cam-btn'),
  resetPosBtn:      $('reset-pos-btn'),
  arHud:            $('ar-hud'),
  arToast:          $('ar-toast'),
  desktopQrCard:    $('desktop-qr-card'),
  closeQrBtn:       $('close-qr-btn'),
  qrImage:          $('qr-image'),
  qrUrlText:        $('qr-url-text'),
  chromaSimilarity: $('chroma-similarity'),
  chromaColor:      $('chroma-color'),
  chromaTuner:      $('chroma-tuner'),
};

/* ═══════════════════════════════════════════════════════════════
   State
   ═══════════════════════════════════════════════════════════════ */
let cameraStream = null;
let facingMode   = 'environment';
let hudTimeout   = null;
let toastTimeout = null;
let isARMode     = false;
let hologramEntity = null;
let aframeSceneCreated = false;
let isVideoLocked = false;
let hasMoved     = false;

/* ═══════════════════════════════════════════════════════════════
   Screen Manager
   ═══════════════════════════════════════════════════════════════ */
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove('active'));
  screens[name].classList.add('active');
}

/* ═══════════════════════════════════════════════════════════════
   1. Loading Flow & Desktop QR Generation
   ═══════════════════════════════════════════════════════════════ */
async function runLoadingSequence() {
  let progress = 0;
  initDesktopQR();

  const video = els.hologramVideo;
  let videoReady = false;

  // 1. Read QR ID from query parameter (?id=X), defaulting to "1"
  const urlParams = new URLSearchParams(window.location.search);
  let qrId = urlParams.get('id');
  if (!qrId) {
    qrId = "1";
    console.log('runLoadingSequence: No ?id query param found. Defaulting to QR ID "1"');
  }

  // 2. Fetch video URL from MongoDB-backed backend
  let videoUrl = 'assets/video.mp4'; // Default local fallback
  let videoTitle = 'AR Video Experience';

  try {
    console.log(`runLoadingSequence: Fetching video URL from backend API for QR ID "${qrId}"...`);
    const apiRes = await fetch(`/api/videos/${qrId}`);
    if (!apiRes.ok) {
      throw new Error(`API returned status ${apiRes.status}`);
    }
    const data = await apiRes.json();
    if (data && data.videoUrl) {
      videoUrl = data.videoUrl;
      videoTitle = data.title || videoTitle;
      console.log(`runLoadingSequence: Resolved video URL from DB: "${videoUrl}", Title: "${videoTitle}"`);

      // Dynamically update the UI titles to match the DB record
      const welcomeTitleEl = document.querySelector('.welcome-title');
      if (welcomeTitleEl) {
        welcomeTitleEl.textContent = videoTitle;
      }
      const welcomeDescEl = document.querySelector('.welcome-desc');
      if (welcomeDescEl) {
        welcomeDescEl.innerHTML = `Watch the <strong>${videoTitle}</strong> come to life. <br>Drag to move &bull; Pinch to resize.`;
      }
    }
  } catch (err) {
    console.warn(`runLoadingSequence: Failed to fetch from API for QR ID "${qrId}". Falling back to default video.`, err.message);
  }

  // 3. Fetch the video file as a Blob for CORS & local WebGL texture loading robustness (especially Safari/iOS)
  if (video) {
    console.log(`runLoadingSequence: Pre-fetching video from "${videoUrl}" as Blob...`);
    try {
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error(`HTTP status ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      video.removeAttribute('crossorigin'); // Not needed for Blob URLs
      video.src = blobUrl;
      video.load();
      videoReady = true;
      console.log('runLoadingSequence: Video loaded as Blob URL successfully');
    } catch (err) {
      console.error('runLoadingSequence: Blob pre-fetch failed, falling back to direct URL:', err);
      video.src = videoUrl;
      video.load();
      // Use fallback event listeners
      if (video.readyState >= 1) {
        videoReady = true;
      } else {
        const onReady = () => { videoReady = true; };
        video.addEventListener('loadedmetadata', onReady, { once: true });
        video.addEventListener('canplaythrough', onReady, { once: true });
      }
    }
  } else {
    videoReady = true;
  }

  // Safety fallback for loading screen transition
  setTimeout(() => { 
    if (!videoReady) {
      console.warn('runLoadingSequence: Video loading timed out, forcing safety fallback');
      videoReady = true; 
    }
  }, 12000);

  const tick = () => {
    if (progress < 90) {
      progress += Math.random() * 12 + 4;
      if (progress >= 90) progress = 90;
    } else if (progress >= 90 && videoReady) {
      progress = 100;
    }

    els.progressFill.style.width = `${progress}%`;

    if (progress < 100) {
      setTimeout(tick, 80);
    } else {
      setTimeout(() => showScreen('welcome'), 350);
    }
  };
  tick();
}

async function initDesktopQR() {
  const isDesktop = window.innerWidth > 768;
  if (!isDesktop || !els.desktopQrCard) return;

  let testUrl = window.location.href;
  const hostname = window.location.hostname;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    try {
      const res = await fetch('/api/info');
      if (res.ok) {
        const info = await res.json();
        testUrl = info.url;
      }
    } catch (err) {
      console.warn('Could not fetch server local IP', err);
    }
  }

  els.qrUrlText.textContent = testUrl;

  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(testUrl)}&color=0a0a1a&bgcolor=ffffff&margin=10`;
  els.qrImage.src = qrApiUrl;
  els.qrImage.onload = () => {
    const spinner = els.desktopQrCard.querySelector('.qr-loading-spinner');
    if (spinner) spinner.style.display = 'none';
  };

  els.closeQrBtn.addEventListener('click', () => {
    els.desktopQrCard.classList.add('hidden');
  });
}

/* ═══════════════════════════════════════════════════════════════
   2. Error Display
   ═══════════════════════════════════════════════════════════════ */
function showError(type, detail) {
  const cfg = {
    permission: {
      title: 'Camera Access Denied',
      desc:  'We need camera permission to create your AR experience.',
      steps: [
        'Tap the lock / info icon in the address bar',
        'Find "Camera" in site settings',
        'Change permission to "Allow"',
        'Reload this page',
      ],
    },
    'no-camera': {
      title: 'No Camera Found',
      desc:  "We couldn't detect a camera on this device.",
      steps: [
        'Make sure your device has a camera',
        'Close any other apps using the camera',
        'Try again',
      ],
    },
    incompatible: {
      title: 'Browser Not Supported',
      desc:  "Your browser doesn't support the camera features we need.",
      steps: [
        'Open this page in Chrome, Safari, or Samsung Internet',
        'Make sure you\'re using HTTPS',
        'Update your browser to the latest version',
      ],
    },
    autoplay: {
      title: 'Video Autoplay Blocked',
      desc:  'Your browser prevented the AR video from playing automatically.',
      steps: [
        'Tap anywhere on the screen to start the video',
        "If that doesn't work, check your browser autoplay settings",
      ],
    },
    init: {
      title: 'Camera Initialisation Failed',
      desc:  detail || 'Something went wrong while starting the camera.',
      steps: [
        'Make sure no other app is using the camera',
        'Try switching between front and rear cameras',
        'Restart your browser and try again',
      ],
    },
    generic: {
      title: 'Something Went Wrong',
      desc:  detail || 'An unexpected error occurred.',
      steps: ['Reload the page and try again'],
    },
  };

  const c = cfg[type] || cfg.generic;
  els.errorTitle.textContent = c.title;
  els.errorDesc.textContent  = c.desc;

  if (c.steps && c.steps.length) {
    els.errorSteps.innerHTML = `<ol>${c.steps.map((s) => `<li>${s}</li>`).join('')}</ol>`;
  } else {
    els.errorSteps.innerHTML = '';
  }

  showScreen('error');
}

/* ═══════════════════════════════════════════════════════════════
   3. Camera
   ═══════════════════════════════════════════════════════════════ */
function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
  els.cameraFeed.srcObject = null;
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showError('incompatible');
    return false;
  }

  const preferred = {
    video: {
      facingMode: { ideal: facingMode },
      width:  { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  };

  const fallback = { video: true, audio: false };

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia(preferred);
  } catch (err) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      showError('permission');
      return false;
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      showError('no-camera');
      return false;
    }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia(fallback);
    } catch (err2) {
      if (err2.name === 'NotAllowedError' || err2.name === 'PermissionDeniedError') {
        showError('permission');
      } else if (err2.name === 'NotFoundError' || err2.name === 'DevicesNotFoundError') {
        showError('no-camera');
      } else {
        showError('init', err2.message);
      }
      return false;
    }
  }

  // Attach stream and wait for it to play
  await new Promise((resolve) => {
    let resolved = false;
    const done = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    els.cameraFeed.onloadedmetadata = () => {
      els.cameraFeed.play().then(done).catch((e) => {
        console.warn('cameraFeed play failed:', e);
        done();
      });
    };
    els.cameraFeed.onplaying = done;

    // Safety timeout
    setTimeout(() => {
      console.warn('Camera metadata timeout, forcing start');
      els.cameraFeed.play().then(done).catch(done);
    }, 3000);

    els.cameraFeed.srcObject = cameraStream;
  });

  console.log('Camera started successfully');
  return true;
}

async function switchCamera() {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  stopCamera();
  const ok = await startCamera();
  if (!ok) {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    await startCamera();
  }
}

/* ═══════════════════════════════════════════════════════════════
   4. A-Frame Scene Creation (Dynamic)
   ═══════════════════════════════════════════════════════════════
   We create the <a-scene> DYNAMICALLY so that:
   1. The hologram-video component is guaranteed to be registered first
   2. We can set all attributes properly
   3. The scene doesn't auto-init before everything is ready
   ═══════════════════════════════════════════════════════════════ */

function createAFrameScene() {
  if (aframeSceneCreated) return;
  aframeSceneCreated = true;

  console.log('Creating A-Frame scene dynamically...');

  const container = els.overlayContainer;

  // Build the scene HTML
  // CRITICAL: look-controls with magicWindowTrackingEnabled uses gyroscope/accelerometer
  // to rotate the 3D camera as the user moves their phone. This makes the video
  // stay anchored in world space (true AR). touchEnabled/mouseEnabled are disabled
  // so those inputs go to our custom drag/pinch gesture handlers instead.
  container.innerHTML = `
    <a-scene
      embedded
      vr-mode-ui="enabled: false"
      device-orientation-permission-ui="enabled: false"
      renderer="alpha: true; antialias: true; colorManagement: true; sortObjects: true"
      background="transparent: true"
      cursor="rayOrigin: mouse"
      raycaster="objects: .raycastable"
      style="width: 100%; height: 100%; position: absolute; top: 0; left: 0;">

      <a-entity
        camera
        position="0 0 0"
        look-controls="magicWindowTrackingEnabled: true; touchEnabled: false; mouseEnabled: false"
        wasd-controls="enabled: false">
      </a-entity>

      <a-light type="ambient" color="#ffffff" intensity="0.8"></a-light>

      <a-entity
        id="hologram-plane"
        class="raycastable"
        hologram-video="src: #hologramVideo; color: #00d4ff; similarity: 0.45; smoothness: 0.15"
        position="0 0 -2"
        scale="1.6 0.9 1">
      </a-entity>
    </a-scene>
  `;

  console.log('A-Frame scene HTML injected with look-controls enabled');

  // Wait for scene to load, then verify
  const sceneEl = container.querySelector('a-scene');
  if (sceneEl) {
    const onSceneLoaded = () => {
      console.log('A-Frame scene fully loaded');

      // Force the renderer to have transparent clear color
      if (sceneEl.renderer) {
        sceneEl.renderer.setClearColor(0x000000, 0);
        console.log('Renderer clear color set to transparent (alpha=0)');
      }

      hologramEntity = document.getElementById('hologram-plane');
      if (hologramEntity) {
        console.log('hologram-plane entity found in world space');
        
        // Tap to lock/unlock video position
        hologramEntity.addEventListener('click', () => {
          if (hasMoved) {
            console.log('Click ignored because touch moved (drag/pinch)');
            return;
          }
          toggleVideoLock();
        });
      } else {
        console.error('hologram-plane entity NOT found after scene load');
      }

      // Verify look-controls are active
      const cam = sceneEl.querySelector('[camera]');
      if (cam) {
        const lc = cam.getAttribute('look-controls');
        console.log('look-controls config:', JSON.stringify(lc));
      }

      setupGestures();
      setupChromaTuner();
    };

    if (sceneEl.hasLoaded) {
      onSceneLoaded();
    } else {
      sceneEl.addEventListener('loaded', onSceneLoaded);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   5. Touch Gestures (Drag & Pinch)
   ═══════════════════════════════════════════════════════════════ */

function setupGestures() {
  const container = els.overlayContainer;
  let startX, startY;
  let startDist = 0;
  let isDragging = false;
  let initialPosition = { x: 0, y: 0, z: -2 };
  let initialScale = { x: 1.6, y: 0.9, z: 1 };

  container.addEventListener('touchstart', (e) => {
    // Play video on user touch gesture in case autoplay is blocked (e.g. iOS Low Power Mode)
    const video = els.hologramVideo;
    if (video && video.paused && isARMode) {
      video.play().catch((err) => console.log('Touchstart play failed:', err));
    }

    if (!hologramEntity) return;

    hasMoved = false; // Reset on touch start

    if (e.touches.length === 1) {
      isDragging = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      const pos = hologramEntity.getAttribute('position');
      initialPosition = { x: pos.x, y: pos.y, z: pos.z };
    } else if (e.touches.length === 2) {
      isDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      startDist = Math.hypot(dx, dy);
      const scl = hologramEntity.getAttribute('scale');
      initialScale = { x: scl.x, y: scl.y, z: scl.z };
    }
  }, { passive: false });

  container.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!hologramEntity) return;

    // Check if touch moved significantly to avoid accidental drag status on simple tap
    let moveThreshold = 8;
    let dx = 0, dy = 0;
    if (e.touches.length === 1) {
      dx = e.touches[0].clientX - startX;
      dy = e.touches[0].clientY - startY;
    }
    if (Math.hypot(dx, dy) > moveThreshold || e.touches.length === 2) {
      hasMoved = true;
    }

    // If position is locked, prevent drag and pinch scaling!
    if (isVideoLocked) return;

    if (e.touches.length === 1 && isDragging) {
      hologramEntity.setAttribute('position', {
        x: initialPosition.x + (dx * 0.01),
        y: initialPosition.y - (dy * 0.01),
        z: initialPosition.z
      });
    } else if (e.touches.length === 2) {
      const dx2 = e.touches[0].clientX - e.touches[1].clientX;
      const dy2 = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx2, dy2);

      if (startDist > 0) {
        const scaleFactor = dist / startDist;
        const newScaleX = Math.max(0.5, Math.min(10.0, initialScale.x * scaleFactor));
        const newScaleY = Math.max(0.5, Math.min(10.0, initialScale.y * scaleFactor));
        hologramEntity.setAttribute('scale', { x: newScaleX, y: newScaleY, z: 1 });
      }
    }
  }, { passive: false });

  container.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
      isDragging = e.touches.length === 1;
      if (isDragging) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        const pos = hologramEntity.getAttribute('position');
        initialPosition = { x: pos.x, y: pos.y, z: pos.z };
      }
    }
  });

  console.log('Touch gestures initialized');
}

/* ═══════════════════════════════════════════════════════════════
   6. Chroma Tuner
   ═══════════════════════════════════════════════════════════════ */
function setupChromaTuner() {
  const tuner = els.chromaSimilarity;
  const colorPicker = els.chromaColor;

  if (tuner && hologramEntity) {
    tuner.addEventListener('input', (e) => {
      hologramEntity.setAttribute('hologram-video', 'similarity', e.target.value);
    });
  }
  if (colorPicker && hologramEntity) {
    colorPicker.addEventListener('input', (e) => {
      hologramEntity.setAttribute('hologram-video', 'color', e.target.value);
    });
  }
}

/* ═══════════════════════════════════════════════════════════════
   7. HUD Auto-hide
   ═══════════════════════════════════════════════════════════════ */
function initHudAutoHide() {
  const show = () => {
    els.arHud.classList.remove('hidden');
    clearTimeout(hudTimeout);
    hudTimeout = setTimeout(() => els.arHud.classList.add('hidden'), 4000);
  };

  document.addEventListener('touchstart', show, { passive: true });
  document.addEventListener('mousemove', show, { passive: true });
  hudTimeout = setTimeout(() => els.arHud.classList.add('hidden'), 4000);
}

function showToast(message) {
  if (message) {
    els.arToast.innerHTML = message;
  } else {
    els.arToast.innerHTML = 'Drag to move&nbsp;&bull;&nbsp;Pinch to resize';
  }
  els.arToast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => els.arToast.classList.remove('show'), 4000);
}

/* ═══════════════════════════════════════════════════════════════
   8. Unified Entry Point: Launch AR
   ═══════════════════════════════════════════════════════════════ */
async function launchAR() {
  els.startBtn.disabled = true;
  els.startBtn.textContent = 'Starting…';

  console.log('launchAR: Starting AR experience...');

  // 1. Request DeviceOrientation permission (iOS 13+ requires explicit permission)
  // Must be called from a user gesture handler (click)
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      console.log('launchAR: Requesting DeviceOrientation permission (iOS)...');
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== 'granted') {
        console.warn('launchAR: DeviceOrientation permission denied');
        showError('generic', 'Motion sensor permission is required for AR. Please allow motion access and try again.');
        resetStartBtn();
        return;
      }
      console.log('launchAR: DeviceOrientation permission granted');
    }
  } catch (e) {
    console.warn('launchAR: DeviceOrientation permission request failed:', e);
    // Continue anyway — non-iOS devices don't need this
  }

  // 2. Switch to AR screen immediately (user gesture context)
  isARMode = true;
  showScreen('ar');

  // 3. Play hologram video immediately (requires user gesture context)
  const video = els.hologramVideo;
  if (video) {
    try {
      await video.play();
      console.log('launchAR: Hologram video playing');
    } catch (e) {
      console.warn('launchAR: Video autoplay failed, will retry:', e);
    }
  }

  try {
    // 4. Start camera
    const cameraOk = await startCamera();
    if (!cameraOk) {
      isARMode = false;
      showScreen('welcome');
      resetStartBtn();
      return;
    }

    // 5. Create A-Frame scene dynamically (component is already registered)
    createAFrameScene();

    // 6. Initialize HUD and toast
    initHudAutoHide();
    showToast();

    // 7. Ensure video is playing (retry after camera init)
    if (video && video.paused) {
      video.play().catch(e => console.warn('AR video retry play failed:', e));
    }

    console.log('launchAR: AR experience fully initialized — video is world-anchored');

  } catch (err) {
    console.error('AR Launch failed:', err);
    isARMode = false;
    showScreen('welcome');
    showError('generic', err.message);
  } finally {
    resetStartBtn();
  }
}

function resetStartBtn() {
  els.startBtn.disabled = false;
  els.startBtn.innerHTML = `
    <span class="btn-primary__icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
    </span>
    Start AR Experience`;
}

function toggleVideoLock() {
  isVideoLocked = !isVideoLocked;
  console.log('toggleVideoLock: Locked state is now', isVideoLocked);
  
  if (isVideoLocked) {
    showToast('🔒 Video Position Locked. Tap Reset to unlock.');
  } else {
    showToast('🔓 Video Position Unlocked. Drag to move.');
  }
}

function resetVideoPosition() {
  if (!hologramEntity) return;
  
  isVideoLocked = false;
  
  // Reset position to default z=-2
  hologramEntity.setAttribute('position', { x: 0, y: 0, z: -2 });
  
  // Reset scale to default or aspect-ratio scale
  const video = els.hologramVideo;
  if (video) {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w && h) {
      const aspect = w / h;
      const targetHeight = 1.8;
      const targetWidth = targetHeight * aspect;
      hologramEntity.setAttribute('scale', { x: targetWidth, y: targetHeight, z: 1 });
    } else {
      hologramEntity.setAttribute('scale', { x: 1.6, y: 0.9, z: 1 });
    }
  }
  
  showToast('🔄 Position Reset. Drag to move & Pinch to resize.');
}

/* ═══════════════════════════════════════════════════════════════
   9. Cleanup on Close
   ═══════════════════════════════════════════════════════════════ */
function closeAR() {
  isARMode = false;
  stopCamera();

  // Pause hologram video
  const video = els.hologramVideo;
  if (video) {
    video.pause();
  }

  // Destroy A-Frame scene to free resources
  const sceneEl = els.overlayContainer.querySelector('a-scene');
  if (sceneEl) {
    sceneEl.parentNode.removeChild(sceneEl);
  }
  aframeSceneCreated = false;
  hologramEntity = null;
  isVideoLocked = false; // Reset lock state

  showScreen('welcome');
}

/* ═══════════════════════════════════════════════════════════════
   10. Event Bindings
   ═══════════════════════════════════════════════════════════════ */
els.startBtn.addEventListener('click', launchAR);

els.retryBtn.addEventListener('click', () => {
  stopCamera();
  showScreen('welcome');
});

els.closeBtn.addEventListener('click', closeAR);

els.switchCamBtn.addEventListener('click', switchCamera);

if (els.resetPosBtn) {
  els.resetPosBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetVideoPosition();
  });
}

// Handle visibility change — pause/resume camera
document.addEventListener('visibilitychange', () => {
  if (!cameraStream) return;
  if (document.hidden) {
    cameraStream.getTracks().forEach((t) => (t.enabled = false));
  } else {
    cameraStream.getTracks().forEach((t) => (t.enabled = true));
    // Resume video playback
    const video = els.hologramVideo;
    if (video && video.paused && isARMode) {
      video.play().catch(() => {});
    }
  }
});

// Prevent pull-to-refresh and bounce on iOS
document.addEventListener('touchmove', (e) => {
  if (screens.ar.classList.contains('active')) {
    e.preventDefault();
  }
}, { passive: false });

// Tap anywhere on AR screen to play video if blocked
document.addEventListener('click', () => {
  if (isARMode) {
    const video = els.hologramVideo;
    if (video && video.paused) {
      video.play().catch(() => {});
    }
  }
});

/* ═══════════════════════════════════════════════════════════════
   11. Boot
   ═══════════════════════════════════════════════════════════════ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runLoadingSequence);
} else {
  runLoadingSequence();
}
