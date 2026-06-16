/**
 * QR AR Video Experience — Main Application Logic
 *
 * Handles:
 *  • Loading → Welcome → AR screen transitions
 *  • Camera initialisation with rear-camera preference + fallback
 *  • Floating video overlay with one-finger drag & two-finger pinch
 *  • Comprehensive error handling with user-friendly messages
 *
 * No external dependencies — pure ES6+ vanilla JavaScript.
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   A-Frame Components & Shaders
   ═══════════════════════════════════════════════════════════════ */
if (typeof AFRAME !== 'undefined') {
  AFRAME.registerComponent('hologram-material', {
    init: function () {
      this.el.addEventListener('model-loaded', () => {
        const obj = this.el.getObject3D('mesh');
        if (!obj) return;
        obj.traverse((node) => {
          if (node.isMesh) {
            // Apply a blue transparent hologram material
            node.material = new THREE.MeshStandardMaterial({
              color: 0x4a90e2,
              emissive: 0x2a60b2,
              emissiveIntensity: 0.6,
              transparent: true,
              opacity: 0.85,
              wireframe: false,
              metalness: 0.6,
              roughness: 0.2
            });
          }
        });
      });
    }
  });

  // Custom shader to remove green/black background from videos
  AFRAME.registerShader('chromakey', {
    schema: {
      src: { type: 'map' },
      color: { type: 'color', is: 'uniform', default: '#00ff00' },
      similarity: { type: 'number', is: 'uniform', default: 0.4 },
      smoothness: { type: 'number', is: 'uniform', default: 0.12 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D src;
      uniform vec3 color;
      uniform float similarity;
      uniform float smoothness;
      varying vec2 vUv;
      void main() {
        vec4 texColor = texture2D(src, vUv);
        // For black background use distance(texColor.rgb, vec3(0.0))
        float diff = distance(texColor.rgb, color);
        float alpha = smoothstep(similarity, similarity + smoothness, diff);
        // Add subtle blue glow for hologram effect
        vec3 finalColor = texColor.rgb + vec3(0.0, 0.2, 0.4);
        gl_FragColor = vec4(finalColor, texColor.a * alpha);
      }
    `
  });
}

// Global error logging for debugging on mobile devices
window.addEventListener('error', (event) => {
  console.error('Global JS error:', event.error || event.message);
  try {
    if (typeof showError === 'function' && typeof screens !== 'undefined' && screens.error && !screens.error.classList.contains('active')) {
      showError('generic', event.message + ' (Line: ' + event.lineno + ':' + event.colno + ')');
    }
  } catch (e) {
    console.error('Failed to show error screen:', e);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', event.reason);
  try {
    if (typeof showError === 'function' && typeof screens !== 'undefined' && screens.error && !screens.error.classList.contains('active')) {
      showError('generic', String(event.reason?.message || event.reason));
    }
  } catch (e) {
    console.error('Failed to show error screen:', e);
  }
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
  progressFill:   $('progress-fill'),
  startBtn:       $('start-btn'),
  retryBtn:       $('retry-btn'),
  errorTitle:     $('error-title'),
  errorDesc:      $('error-desc'),
  errorSteps:     $('error-steps'),
  cameraFeed:     $('camera-feed'),
  overlayContainer: $('overlay-container'),
  overlayVideo:   $('overlay-video'),
  overlayPlaceholder: $('overlay-placeholder'),
  closeBtn:       $('close-btn'),
  switchCamBtn:   $('switch-cam-btn'),
  arHud:          $('ar-hud'),
  arToast:        $('ar-toast'),
  desktopQrCard:  $('desktop-qr-card'),
  closeQrBtn:     $('close-qr-btn'),
  qrImage:        $('qr-image'),
  qrUrlText:      $('qr-url-text'),
  chromaSimilarity: $('chroma-similarity'),
  chromaTuner:    $('chroma-tuner'),
};

/* ═══════════════════════════════════════════════════════════════
   State
   ═══════════════════════════════════════════════════════════════ */
let cameraStream = null;
let facingMode   = 'environment'; // preferred: rear camera
let hudTimeout   = null;
let toastTimeout = null;

/* ═══════════════════════════════════════════════════════════════
   Screen Manager
   ═══════════════════════════════════════════════════════════════ */

/**
 * Transition to a target screen with a smooth cross-fade.
 * @param {'loading'|'welcome'|'error'|'ar'} name
 */
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove('active'));
  screens[name].classList.add('active');
}

/* ═══════════════════════════════════════════════════════════════
   1. Loading Flow & Desktop QR Generation
   ═══════════════════════════════════════════════════════════════ */
function runLoadingSequence() {
  let progress = 0;
  
  // Initialize QR utility if on desktop
  initDesktopQR();

  const video = els.overlayVideo;
  if (video) {
    video.load(); // Start preloading the video asset
  }

  // Track if video metadata is ready
  let videoReady = false;
  const onVideoReady = () => {
    videoReady = true;
  };

  if (video) {
    if (video.readyState >= 1) {
      videoReady = true;
    } else {
      video.addEventListener('loadedmetadata', onVideoReady, { once: true });
      video.addEventListener('canplaythrough', onVideoReady, { once: true });
    }
  } else {
    videoReady = true;
  }

  // Safety fallback: continue after 5 seconds even if video metadata hasn't loaded
  setTimeout(() => {
    videoReady = true;
  }, 5000);

  const tick = () => {
    // Hold progress at 90% if video is not ready yet
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
      if (video) {
        video.removeEventListener('loadedmetadata', onVideoReady);
        video.removeEventListener('canplaythrough', onVideoReady);
      }
      // Brief pause then transition
      setTimeout(() => showScreen('welcome'), 350);
    }
  };
  tick();
}

/**
 * Detects if the current viewport is desktop and renders a QR code
 * pointing to the current application page.
 */
async function initDesktopQR() {
  const isDesktop = window.innerWidth > 768;
  if (!isDesktop || !els.desktopQrCard) return;

  let testUrl = window.location.href;

  // If testing on localhost/127.0.0.1, ask server for local network IP
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    try {
      const res = await fetch('/api/info');
      if (res.ok) {
        const info = await res.json();
        testUrl = info.url;
      }
    } catch (err) {
      console.warn('Could not fetch server local IP, fallback to window.location', err);
    }
  }

  els.qrUrlText.textContent = testUrl;

  // Generate QR code using Google/public QR server API
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

/**
 * Show the error screen with contextual messaging.
 * @param {'permission'|'no-camera'|'incompatible'|'autoplay'|'init'|'generic'} type
 * @param {string} [detail] — optional extra info
 */
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

  // Build step list
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

/**
 * Stop all tracks on the current stream.
 */
function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
  els.cameraFeed.srcObject = null;
}

/**
 * Start the camera with the current `facingMode`.
 * Falls back to any available camera if the preferred mode fails.
 */
async function startCamera() {
  // Feature detection
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showError('incompatible');
    return false;
  }

  // Preferred constraints — rear camera
  const preferred = {
    video: {
      facingMode: { ideal: facingMode },
      width:  { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  };

  // Fallback constraints — any camera
  const fallback = {
    video: true,
    audio: false,
  };

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
    // Try fallback
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

  // Set up promise to wait for metadata & play without hanging
  await new Promise((resolve) => {
    let resolved = false;
    const done = () => {
      if (!resolved) {
        resolved = true;
        els.cameraFeed.onloadedmetadata = null;
        els.cameraFeed.onplaying = null;
        resolve();
      }
    };

    // If metadata is already loaded
    if (els.cameraFeed.readyState >= 1) {
      els.cameraFeed.play().then(done).catch((e) => {
        console.warn('cameraFeed play failed:', e);
        done();
      });
    }

    els.cameraFeed.onloadedmetadata = () => {
      els.cameraFeed.play().then(done).catch((e) => {
        console.warn('cameraFeed play failed in event:', e);
        done();
      });
    };

    // Also listen to playing event
    els.cameraFeed.onplaying = done;

    // Safety timeout: 3 seconds
    setTimeout(() => {
      console.warn('Camera metadata timeout, forcing start');
      els.cameraFeed.play().then(done).catch(done);
    }, 3000);

    // Set srcObject to start loading
    els.cameraFeed.srcObject = cameraStream;
  });

  return true;
}

/**
 * Toggle between front and rear cameras.
 */
async function switchCamera() {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  stopCamera();
  const ok = await startCamera();
  if (!ok) {
    // Revert and try original
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    await startCamera();
  }
}

/* ═══════════════════════════════════════════════════════════════
   4. A-Frame AR Logic & Touch Gestures
   ═══════════════════════════════════════════════════════════════ */

let isARMode = false;
let robotEntity = null;

function initAFrameAR() {
  robotEntity = $('robot');
  
  // Touch Gestures for A-Frame Entity
  const container = els.overlayContainer;
  let startX, startY;
  let startDist = 0;
  let isDragging = false;
  let initialPosition = { x: 0, y: 0, z: -3 };
  let initialScale = { x: 0.5, y: 0.5, z: 0.5 };
  
  // Wait for A-Frame scene to be fully loaded
  const sceneEl = document.querySelector('a-scene');
  if (sceneEl && sceneEl.hasLoaded) {
    setupGestures();
  } else if (sceneEl) {
    sceneEl.addEventListener('loaded', setupGestures);
  }

  function setupGestures() {
    container.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (!robotEntity) return;

      if (e.touches.length === 1) {
        isDragging = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        const pos = robotEntity.getAttribute('position');
        initialPosition = { x: pos.x, y: pos.y, z: pos.z };
      } else if (e.touches.length === 2) {
        isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        startDist = Math.hypot(dx, dy);
        const scl = robotEntity.getAttribute('scale');
        initialScale = { x: scl.x, y: scl.y, z: scl.z };
      }
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!robotEntity) return;

      if (e.touches.length === 1 && isDragging) {
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        
        // Translate model in 3D space. Adjust sensitivity as needed.
        robotEntity.setAttribute('position', {
          x: initialPosition.x + (dx * 0.01),
          y: initialPosition.y - (dy * 0.01),
          z: initialPosition.z
        });
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);

        if (startDist > 0) {
          const scaleFactor = dist / startDist;
          // Clamp scale to reasonable bounds
          const newScale = Math.max(0.1, Math.min(3.0, initialScale.x * scaleFactor));
          robotEntity.setAttribute('scale', {
            x: newScale,
            y: newScale,
            z: newScale
          });
        }
      }
    }, { passive: false });

    container.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        isDragging = e.touches.length === 1;
        if (isDragging) {
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
          const pos = robotEntity.getAttribute('position');
          initialPosition = { x: pos.x, y: pos.y, z: pos.z };
        }
      }
    });
  }
}

/* ═══════════════════════════════════════════════════════════════
   5. HUD Auto-hide
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

function showToast() {
  els.arToast.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => els.arToast.classList.add('hidden'), 4000);
}

/* ═══════════════════════════════════════════════════════════════
   6. Unified Entry Point: A-Frame WebAR Launch
   ═══════════════════════════════════════════════════════════════ */
async function launchAR() {
  els.startBtn.disabled = true;
  els.startBtn.textContent = 'Starting…';

  try {
    const cameraOk = await startCamera();
    if (!cameraOk) {
      resetStartBtn();
      return;
    }

    isARMode = true;
    showScreen('ar');
    initAFrameAR();
    initHudAutoHide();
    showToast();

  } catch (err) {
    console.error('AR Launch failed:', err);
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

/* ═══════════════════════════════════════════════════════════════
   7. Event Bindings
   ═══════════════════════════════════════════════════════════════ */
els.startBtn.addEventListener('click', launchAR);

els.retryBtn.addEventListener('click', () => {
  stopCamera();
  showScreen('welcome');
});

els.closeBtn.addEventListener('click', () => {
  isARMode = false;
  stopCamera();
  showScreen('welcome');
});

els.switchCamBtn.addEventListener('click', switchCamera);

// Handle visibility change — pause/resume camera
document.addEventListener('visibilitychange', () => {
  if (!cameraStream) return;
  if (document.hidden) {
    cameraStream.getTracks().forEach((t) => (t.enabled = false));
  } else {
    cameraStream.getTracks().forEach((t) => (t.enabled = true));
  }
});

// Prevent pull-to-refresh and bounce on iOS
document.addEventListener('touchmove', (e) => {
  if (screens.ar.classList.contains('active')) {
    e.preventDefault();
  }
}, { passive: false });

/* ═══════════════════════════════════════════════════════════════
   8. Boot
   ═══════════════════════════════════════════════════════════════ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runLoadingSequence);
} else {
  runLoadingSequence();
}

