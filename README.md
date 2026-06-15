# QR AR Video Experience

A browser-based augmented-reality-style floating video overlay triggered by scanning a QR code. No native app required — works entirely in the mobile browser over HTTPS.

![Tech](https://img.shields.io/badge/Stack-HTML%20%7C%20CSS%20%7C%20JS%20%7C%20Node-6c5ce7)
![Deploy](https://img.shields.io/badge/Deploy-Render-00cec9)

---

## ✨ Features

| Feature | Details |
|---------|---------|
| **QR → Browser** | Scan a QR code pointing to the deployed URL |
| **Camera Feed** | Full-screen rear camera (auto-fallback to front) |
| **Floating Video** | Transparent WebM loops over the camera feed |
| **Touch Gestures** | One-finger drag · Two-finger pinch to resize |
| **Responsive** | Portrait & landscape on Android + iOS |
| **Error Handling** | Friendly screens for every failure mode |
| **Performance** | `requestAnimationFrame`, hardware acceleration, low memory |

---

## 🚀 Quick Start (Local)

### Prerequisites

- **Node.js** ≥ 18
- A device with a camera (or use Chrome DevTools mobile emulation)

### Install & Run

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd qr-ar-video-experience

# 2. Install dependencies
npm install

# 3. Start the server
npm start
```

Open **http://localhost:3000** in your browser.

> **Note:** Camera access requires HTTPS in production. For local testing,
> `localhost` is treated as a secure context by most browsers.

---

## 🎬 Replacing the Placeholder Video

The app is designed to work with a **transparent WebM** video overlay. When no video file is present, an animated 3D cube placeholder is shown instead.

### Steps to Add Your Video

1. **Prepare your video** — export as `.webm` with VP9 codec and alpha channel (transparency).
   - In **After Effects**: Render → WebM with alpha
   - In **Blender**: Render → FFmpeg → WebM, RGBA
   - In **FFmpeg**:
     ```bash
     ffmpeg -i input.mov -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 -b:v 2M output.webm
     ```

2. **Place the file** at:
   ```
   public/assets/video.webm
   ```

3. **Restart the server** (or just refresh the browser). The app automatically detects and plays the file.

### Video Tips

- Keep file size under **5 MB** for fast mobile loading.
- Use **VP9** codec for best transparency support.
- Aim for **720p** resolution — higher isn't needed for a floating overlay.
- Loop point should be seamless (the video loops forever).

---

## 🌐 Deploying to Render

### 1. Push to GitHub / GitLab

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Create a Render Web Service

1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your repository
3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `qr-ar-video` |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Plan** | Free (or Starter) |

4. Click **Deploy**

Render automatically detects `package.json`, installs dependencies, and starts the Express server on the correct port.

### 3. Generate a QR Code

Once deployed, take your Render URL (e.g., `https://qr-ar-video.onrender.com`) and generate a QR code using any free tool:

- [qr-code-generator.com](https://www.qr-code-generator.com/)
- [qrcode.tec-it.com](https://qrcode.tec-it.com/)

Print or display the QR code — scanning it opens the AR experience.

---

## 📁 Project Structure

```
project/
│
├── public/
│   ├── index.html          # Main HTML — all four screens
│   ├── styles.css           # Dark glassmorphism theme
│   ├── script.js            # Camera, gestures, state management
│   └── assets/
│       ├── video.webm       # ← Your transparent video goes here
│       └── icons/
│
├── server.js                # Express server (Helmet, compression)
├── package.json             # Dependencies & scripts
├── .gitignore
└── README.md
```

---

## 🔧 Browser Compatibility

| Browser | Camera | Transparent WebM | Touch Gestures |
|---------|--------|-----------------|----------------|
| Chrome Android | ✅ | ✅ | ✅ |
| Samsung Internet | ✅ | ✅ | ✅ |
| Safari iOS 15+ | ✅ | ⚠️ Partial* | ✅ |
| Firefox Android | ✅ | ✅ | ✅ |
| Chrome Desktop | ✅ | ✅ | Mouse drag + wheel |

> *Safari has limited WebM/VP9 support. On iOS, the placeholder animation is shown.
> For full iOS support, consider also providing an **HEVC with alpha** `.mov` file.

---

## 📄 License

MIT
