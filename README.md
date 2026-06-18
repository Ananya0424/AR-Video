# 📱 WebAR Campaign Manager & Floating Video Experience

An interactive, browser-based WebAR (Web Augmented Reality) application that triggers a premium, floating video overlay upon scanning a QR code. It features a desktop campaign dashboard and a fully optimized mobile AR viewport with modern controls.

🌐 **Live Deployment Link:** [https://ar-video-kle5.onrender.com/](https://ar-video-kle5.onrender.com/)

---

## 🚀 Key Features

### 1. Apple Vision Pro Style Floating Control Panel
The mobile AR viewport features a floating, vertically aligned glassmorphic control panel on the right side of the screen. Designed with high-contrast, premium styling for outdoor readability:
*   **Circular Buttons (56–64px):** Frosted glass background (`backdrop-filter: blur(20px)`), thin semi-transparent white border, and soft drop shadows.
*   **Tactile Feedback:** Smooth CSS transition scaling and visual press feedback for a native-like feel.
*   **Interactive Toolbar:**
    *   🔒 **Lock / Unlock:** Programmatically detaches the AR video overlay from the camera feed, locking it in place at its current 3D real-world coordinates. Tapping again unlocks it to follow the camera.
    *   🎯 **Recenter:** Snaps the video back to the center of the camera viewport (`z = -2`) and resets its rotation and follow status.
    *   🔊 **Audio Toggle:** Seamlessly unmutes/mutes video audio on mobile devices without interrupting playback.

### 2. Multi-Campaign QR Dashboard (Desktop)
When accessed on a desktop browser, the application loads a dashboard featuring **10 dynamic marketing campaigns**:
*   Generates QR codes for each campaign pointing to the live URL with query parameters (e.g., `?id=1` to `?id=10`).
*   Includes an inline **Edit Modal** to dynamically update video URLs in real-time in the database.
*   Each QR card is scannable to directly load that specific video on any mobile device.

### 3. Advanced Technical Integration
*   **Chroma Key Transparency:** Custom WebGL fragment shader built on top of Three.js removes the green/cyan backgrounds from standard MP4 videos on the fly, enabling seamless transparency.
*   **Mobile-Optimized Touch Gestures:**
    *   **One-finger drag:** Moves the video across X and Y dimensions.
    *   **Two-finger pinch:** Dynamically scales/resizes the 3D plane.
*   **Camera Fallback System:** Prioritizes the high-quality rear camera, falling back to the front camera or showing troubleshooting steps if permissions are denied.
*   **Mobile Debug Logging:** Append `?debug=true` to any campaign URL to display a real-time console overlay on mobile for easier troubleshooting.

---

## 🛠️ Technology Stack

*   **Front-end:**
    *   [A-Frame](https://aframe.io/) (WebXR/Three.js framework)
    *   [Three.js](https://threejs.org/) (Custom shader materials, Vector math, and projection matrices)
    *   Vanilla CSS3 (Glassmorphism, CSS Grid, Custom Transitions)
*   **Back-end:**
    *   [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/) (REST APIs, static hosting)
    *   [Helmet](https://helmetjs.github.io/) (Configured for relaxed CSP headers to support AR camera feeds and CDN assets)
    *   [Compression](https://github.com/expressjs/compression) (Gzip middleware for fast asset delivery)
*   **Database & Storage:**
    *   [MongoDB Atlas](https://www.mongodb.com/atlas) (Mongoose ODM for persistent campaign and URL storage)
    *   [Cloudinary](https://cloudinary.com/) (CDN hosting for optimized video assets)

---

## 📂 Project Structure

```
AR-Video/
├── models/
│   └── Video.js            # Mongoose schema for Campaigns/Videos
├── public/
│   ├── js/
│   │   ├── aframe.min.js
│   │   └── aframe-extras.min.js
│   ├── index.html          # Main layout (Dashboard, Loader, WebAR Viewport)
│   ├── styles.css          # Glassmorphic controls, layouts, and cards
│   └── script.js           # A-Frame component, gesture math, and API bindings
├── seed.js                 # Automatic DB seeding for the 10 default campaigns
├── server.js               # Node.js/Express server config & REST API
├── package.json            # Node dependencies and scripts
└── README.md               # Documentation
```

---

## ⚙️ Quick Start (Local Setup)

### 1. Prerequisites
*   Node.js (version 18+)
*   MongoDB Instance (Local or MongoDB Atlas URI)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/Ananya0424/AR-Video.git
cd AR-Video

# Install dependencies
npm install
```

### 3. Environment Variables
To connect your own MongoDB database, create a `.env` file or set the environment variable:
```bash
MONGODB_URI="mongodb+srv://<username>:<password>@cluster0.mongodb.net/dbname"
```
*Note: If no URI is provided, the application defaults to a pre-configured MongoDB Atlas cluster connection.*

### 4. Run the Server
```bash
# Start development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Deployment to Render

This repository is pre-configured for seamless deployment on **Render**:

1.  Create a new **Web Service** on Render and link your GitHub repository.
2.  Use the following settings:
    *   **Runtime:** `Node`
    *   **Build Command:** `npm install`
    *   **Start Command:** `npm start`
3.  Add an environment variable `MONGODB_URI` pointing to your MongoDB Atlas database.
4.  Once deployed, access the dashboard at your custom Render subdomain (e.g. `https://ar-video-kle5.onrender.com/`).

---

## 🔧 REST API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/videos` | `GET` | Retrieve list of all 10 campaigns |
| `/api/videos/:id` | `GET` | Retrieve details for a single campaign QR ID |
| `/api/videos/:id` | `PUT` | Update the video URL for a campaign |
| `/api/log` | `POST` | Receive client logs on the server for remote debugging |

---

## 📄 License

This project is licensed under the MIT License.
