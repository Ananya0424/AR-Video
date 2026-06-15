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

  const tick = () => {
    // Simulate a short load (500ms total)
    progress += Math.random() * 18 + 6;
    if (progress > 100) progress = 100;
    els.progressFill.style.width = `${progress}%`;

    if (progress < 100) {
      requestAnimationFrame(() => setTimeout(tick, 60));
    } else {
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

  els.cameraFeed.srcObject = cameraStream;

  // Wait until the video is actually playing
  await new Promise((resolve) => {
    els.cameraFeed.onloadedmetadata = () => {
      els.cameraFeed.play().then(resolve).catch(resolve);
    };
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
   4. Overlay Video
   ═══════════════════════════════════════════════════════════════ */

/**
 * Attempt to play the overlay video.
 * If the file is missing (404) or fails, show the animated placeholder instead.
 */
function initOverlayVideo() {
  const video = els.overlayVideo;

  // Handle video load error (e.g. 404 for video.webm)
  video.addEventListener('error', () => {
    video.classList.add('hidden');
    els.overlayPlaceholder.classList.add('visible');
  });

  // Try to play (handles autoplay restrictions)
  const playPromise = video.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      // Autoplay blocked — try on next user interaction
      const resumePlay = () => {
        video.play().catch(() => {});
        document.removeEventListener('touchstart', resumePlay);
        document.removeEventListener('click', resumePlay);
      };
      document.addEventListener('touchstart', resumePlay, { once: true });
      document.addEventListener('click', resumePlay, { once: true });
    });
  }
}

/* ═══════════════════════════════════════════════════════════════
   5. Touch Gestures (Drag & Pinch)
   ═══════════════════════════════════════════════════════════════ */

function initTouchGestures() {
  const el = els.overlayContainer;
  let posX = 0, posY = 0;
  let scale = 1;
  let startX, startY;
  let startDist = 0;
  let startScale = 1;
  let isDragging = false;
  let rafId = null;

  // Clamp helper
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  // Apply transform via rAF
  function applyTransform() {
    el.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
    rafId = null;
  }

  function scheduleUpdate() {
    if (!rafId) rafId = requestAnimationFrame(applyTransform);
  }

  // Distance between two touches
  function touchDist(t) {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.hypot(dx, dy);
  }

  // ── Pointer / Touch events ──
  el.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      isDragging = true;
      startX = e.touches[0].clientX - posX;
      startY = e.touches[0].clientY - posY;
    } else if (e.touches.length === 2) {
      isDragging = false;
      startDist  = touchDist(e.touches);
      startScale = scale;
    }
  }, { passive: false });

  el.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && isDragging) {
      posX = e.touches[0].clientX - startX;
      posY = e.touches[0].clientY - startY;

      // Keep within viewport bounds (roughly)
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const hw = el.offsetWidth * scale / 2;
      const hh = el.offsetHeight * scale / 2;
      posX = clamp(posX, -vw / 2 + hw * 0.3, vw / 2 - hw * 0.3);
      posY = clamp(posY, -vh / 2 + hh * 0.3, vh / 2 - hh * 0.3);

      scheduleUpdate();
    } else if (e.touches.length === 2) {
      const dist = touchDist(e.touches);
      scale = clamp(startScale * (dist / startDist), 0.3, 4);
      scheduleUpdate();
    }
  }, { passive: false });

  el.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
      isDragging = e.touches.length === 1;
      if (isDragging) {
        startX = e.touches[0].clientX - posX;
        startY = e.touches[0].clientY - posY;
      }
    }
  });

  // ── Mouse fallback (desktop testing) ──
  let mouseDown = false;

  el.addEventListener('mousedown', (e) => {
    mouseDown = true;
    startX = e.clientX - posX;
    startY = e.clientY - posY;
    el.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!mouseDown) return;
    posX = e.clientX - startX;
    posY = e.clientY - startY;
    scheduleUpdate();
  });

  window.addEventListener('mouseup', () => {
    mouseDown = false;
    el.style.cursor = 'grab';
  });

  // Mouse wheel for desktop pinch simulation
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    scale = clamp(scale * delta, 0.3, 4);
    scheduleUpdate();
  }, { passive: false });

  // Initialise centered position (translate 0,0 means CSS center)
  el.style.top = '50%';
  el.style.left = '50%';
  el.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
  // Override CSS translate(-50%,-50%) — we handle positioning ourselves
  el.style.marginTop  = `-${el.offsetHeight / 2}px`;
  el.style.marginLeft = `-${el.offsetWidth / 2}px`;
  el.style.top  = '50%';
  el.style.left = '50%';
}

/* ═══════════════════════════════════════════════════════════════
   6. HUD Auto-hide
   ═══════════════════════════════════════════════════════════════ */
function initHudAutoHide() {
  const show = () => {
    els.arHud.classList.remove('hidden');
    clearTimeout(hudTimeout);
    hudTimeout = setTimeout(() => els.arHud.classList.add('hidden'), 4000);
  };

  // Show HUD on any screen tap (except on the overlay)
  document.addEventListener('touchstart', show, { passive: true });
  document.addEventListener('mousemove', show, { passive: true });

  // Initial auto-hide after 4s
  hudTimeout = setTimeout(() => els.arHud.classList.add('hidden'), 4000);
}

function showToast() {
  els.arToast.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => els.arToast.classList.add('hidden'), 4000);
}

/* ═══════════════════════════════════════════════════════════════
   7. WebXR Immersive AR (Three.js) & Gesture Engine
   ═══════════════════════════════════════════════════════════════ */
let xrSession = null;
let xrRenderer = null;
let xrScene = null;
let xrCamera = null;
let xrVideoMesh = null;
let xrVideoTexture = null;
let isWebXRMode = false;

// WebXR mesh state
let xrScale = 1.0;
let xrPosition = { x: 0, y: 0.1, z: -1.2 }; // positioned slightly up, 1.2m in front

/**
 * Check if the browser supports immersive-ar WebXR session.
 * @returns {Promise<boolean>}
 */
async function checkWebXRSupport() {
  if (navigator.xr && typeof navigator.xr.isSessionSupported === 'function') {
    try {
      return await navigator.xr.isSessionSupported('immersive-ar');
    } catch (err) {
      console.warn('WebXR compatibility check failed:', err);
    }
  }
  return false;
}

/**
 * Starts an immersive-ar WebXR session.
 */
async function launchWebXR() {
  try {
    // 1. Create WebGLRenderer with transparency and XR enabled
    const canvas = document.createElement('canvas');
    canvas.id = 'webxr-canvas';
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '2';
    
    xrRenderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    xrRenderer.setSize(window.innerWidth, window.innerHeight);
    xrRenderer.setPixelRatio(window.devicePixelRatio);
    xrRenderer.xr.enabled = true;

    // 2. Request the WebXR immersive-ar session
    const session = await navigator.xr.requestSession('immersive-ar', {
      optionalFeatures: ['local-floor', 'bounded-floor']
    });
    
    xrSession = session;
    isWebXRMode = true;
    
    // Mount canvas inside AR screen container
    screens.ar.appendChild(canvas);
    
    // Hide standard camera-feed and overlay elements
    els.cameraFeed.style.display = 'none';
    els.overlayContainer.style.display = 'none';
    
    // Show HUD controls and AR screen
    showScreen('ar');
    els.switchCamBtn.style.display = 'none'; // WebXR manages cameras internally
    initHudAutoHide();
    showToast();

    // 3. Set up Three.js scene and camera
    xrScene = new THREE.Scene();
    xrCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    // 4. Create Video Mesh
    const video = els.overlayVideo;
    video.play().catch((err) => {
      console.warn('Video autoplay blocked in WebXR session, playing on touch:', err);
    });

    xrVideoTexture = new THREE.VideoTexture(video);
    xrVideoTexture.minFilter = THREE.LinearFilter;
    xrVideoTexture.magFilter = THREE.LinearFilter;
    xrVideoTexture.format = THREE.RGBAFormat;

    // Aspect ratio plane (width 0.8m, height adjusted for 16:9 or similar)
    const aspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
    const planeW = 0.8;
    const planeH = planeW / aspect;

    const geometry = new THREE.PlaneGeometry(planeW, planeH);
    const material = new THREE.MeshBasicMaterial({
      map: xrVideoTexture,
      side: THREE.DoubleSide
    });

    xrVideoMesh = new THREE.Mesh(geometry, material);
    xrVideoMesh.position.set(xrPosition.x, xrPosition.y, xrPosition.z);
    xrScene.add(xrVideoMesh);

    // 5. Connect renderer to WebXR session
    await xrRenderer.xr.setSession(session);

    // 6. Handle session end
    session.addEventListener('end', () => {
      cleanupWebXR();
      showScreen('welcome');
    });

    // 7. Touch controls inside WebXR Canvas
    initWebXRTouchControls(canvas);

    // 8. Animation Loop
    xrRenderer.setAnimationLoop(() => {
      if (xrVideoTexture) xrVideoTexture.needsUpdate = true;
      xrRenderer.render(xrScene, xrCamera);
    });

  } catch (err) {
    console.error('Failed to initialize WebXR session, falling back to camera mode:', err);
    cleanupWebXR();
    // Fall back immediately to normal camera/overlay view
    await launchStandardAR();
  }
}

/**
 * Set up touch listeners directly on the WebXR canvas for WebXR spatial drag & pinch.
 */
function initWebXRTouchControls(canvas) {
  let startX, startY;
  let startDist = 0;
  let startScale = 1;
  let startMeshPos = { x: 0, y: 0 };
  let isDragging = false;

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      isDragging = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startMeshPos.x = xrVideoMesh.position.x;
      startMeshPos.y = xrVideoMesh.position.y;
    } else if (e.touches.length === 2) {
      isDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      startDist = Math.hypot(dx, dy);
      startScale = xrScale;
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!xrVideoMesh) return;

    if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      // Map screen delta coordinates to spatial meters
      // dx is horizontal movement, dy is vertical movement
      xrVideoMesh.position.x = startMeshPos.x + (dx * 0.003);
      xrVideoMesh.position.y = startMeshPos.y - (dy * 0.003); // invert Y
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);

      if (startDist > 0) {
        xrScale = Math.max(0.3, Math.min(4.0, startScale * (dist / startDist)));
        xrVideoMesh.scale.set(xrScale, xrScale, 1.0);
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
      isDragging = e.touches.length === 1;
      if (isDragging) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startMeshPos.x = xrVideoMesh.position.x;
        startMeshPos.y = xrVideoMesh.position.y;
      }
    }
  });
}

/**
 * Shut down the WebXR session and release rendering resources.
 */
function cleanupWebXR() {
  isWebXRMode = false;
  
  if (xrRenderer) {
    xrRenderer.setAnimationLoop(null);
    xrRenderer.dispose();
    xrRenderer = null;
  }
  
  if (xrSession) {
    xrSession.end().catch(() => {});
    xrSession = null;
  }

  // Remove WebXR Canvas
  const canvas = $('webxr-canvas');
  if (canvas) canvas.remove();

  // Restore normal DOM elements
  els.cameraFeed.style.display = 'block';
  els.overlayContainer.style.display = 'block';
  els.switchCamBtn.style.display = 'flex';
  
  xrScene = null;
  xrCamera = null;
  xrVideoMesh = null;
  xrVideoTexture = null;
}

/* ═══════════════════════════════════════════════════════════════
   8. Standard AR Experience (Graceful Fallback Mode)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Fallback entry point. Opens 2D camera feed and floating video overlay.
 */
async function launchStandardAR() {
  const ok = await startCamera();
  if (!ok) {
    els.startBtn.disabled = false;
    els.startBtn.innerHTML = `
      <span class="btn-primary__icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      </span>
      Start AR Experience`;
    return;
  }

  showScreen('ar');
  initOverlayVideo();
  initTouchGestures();
  initHudAutoHide();
  showToast();
}

/**
 * Unified Entry Point: Decides between WebXR and standard camera fallback.
 */
async function launchAR() {
  els.startBtn.disabled = true;
  els.startBtn.textContent = 'Starting…';

  const webXRSupported = await checkWebXRSupport();
  if (webXRSupported) {
    // If WebXR is supported, launch immersive 3D scene
    await launchWebXR();
  } else {
    // Else, use browser HTML5 camera fallback
    await launchStandardAR();
  }
  
  // Re-enable button text in case they return
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
   8. Event Bindings
   ═══════════════════════════════════════════════════════════════ */
els.startBtn.addEventListener('click', launchAR);

els.retryBtn.addEventListener('click', () => {
  stopCamera();
  showScreen('welcome');
});

els.closeBtn.addEventListener('click', () => {
  if (isWebXRMode) {
    cleanupWebXR();
  } else {
    stopCamera();
  }
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
    // Allow scroll only inside overlay
    if (!els.overlayContainer.contains(e.target)) {
      e.preventDefault();
    }
  }
}, { passive: false });

/* ═══════════════════════════════════════════════════════════════
   9. Boot
   ═══════════════════════════════════════════════════════════════ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runLoadingSequence);
} else {
  runLoadingSequence();
}

