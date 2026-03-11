# ∞ Infinity Graphics

A fully operational, browser-native web design interface — no install, no dependencies, no server required.  
Open `index.html` and start creating.

---

## Features

### 🎨 2D Canvas Mode
Pixel-perfect raster editing with a full tool palette:

| Tool | Shortcut | Description |
|------|----------|-------------|
| Select | `V` | Marquee selection |
| Move | `M` | Pan canvas |
| Pencil | `P` | Freehand drawing |
| Brush | `B` | Soft-edge brush with hardness control |
| Eraser | `E` | Erase pixels |
| Rectangle | `R` | Filled / stroked rectangle |
| Ellipse | `O` | Filled / stroked ellipse |
| Line | `L` | Straight lines |
| Arrow | — | Arrows with arrowhead |
| Polygon | — | Regular polygon (configurable sides) |
| Star | — | Star shape |
| Text | `T` | Click-to-type text layer |
| Fill | `G` | Flood fill |
| Gradient | `G` | Linear / radial gradient fill |
| Eyedropper | `I` | Pick colour from canvas |
| Pen / Path | `N` | Multi-point polygon path |
| Crop | `C` | Crop canvas to selection |

### ✏️ SVG Vector Mode
Resolution-independent vector editing:
- Rectangle, Ellipse, Line, Polygon, Star, Text, Path
- Drag shapes, delete with Delete key
- Export as clean `.svg` file

### 🌐 3D WebGL Mode
Real-time 3D renderer powered by raw WebGL:
- Shapes: Cube, Sphere, Cylinder, Cone, Torus, Pyramid
- Phong lighting (ambient + diffuse + specular)
- Mouse-drag orbit, scroll-to-zoom
- Wireframe toggle
- Custom object colour

### 🖼️ Layer System
- Unlimited layers with thumbnails
- Per-layer opacity, blend mode, visibility & lock
- Add, delete, duplicate, reorder layers
- Merge Down & Flatten Image

### 🎞️ Image Filters
Apply non-destructive filters to any layer:
- Gaussian Blur, Sharpen, Emboss, Edge Detection
- Brightness / Contrast, Hue / Saturation
- Invert, Grayscale, Sepia
- Pixelate, Add Noise
- Vignette, Motion Blur

### 🤖 AI Assistant
- **Generate Color Palette** — algorithmic complementary / triadic / analogous / monochromatic palettes
- **Auto Enhance** — intelligent brightness & contrast correction + sharpening
- **Design Suggestions** — randomised expert design tips
- **Describe Design** — colour analysis of the current canvas
- Chat interface with contextual design Q&A

### 💾 Export
- PNG (lossless)
- JPEG (configurable quality)
- WebP
- SVG (vector layers)

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+S` | Export PNG |
| `Ctrl+G` | Toggle Grid |
| `Ctrl++` / `Ctrl+-` | Zoom In / Out |
| `Ctrl+0` | Fit to Window |
| `Ctrl+1` | 100% Zoom |
| `[` / `]` | Decrease / Increase Brush Size |
| `X` | Swap Foreground / Background |
| `D` | Reset to Black / White |
| `Space+Drag` | Pan canvas (hold Alt or middle-click) |

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/www-infinity/Infinity-Graphics.git
cd Infinity-Graphics

# Open in browser — no build step required!
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows
```

Or host with any static file server:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

---

## Architecture

```
index.html          Main application shell and UI layout
css/
  style.css         Professional dark-theme design tool styling
js/
  layers.js         Layer management + undo history stack
  effects.js        Image filters (convolution, colour math)
  canvas2d.js       2D raster drawing engine (tools, zoom, pan)
  webgl.js          WebGL 3D renderer (meshes, lighting, camera)
  svg.js            SVG vector editor (shapes, selection, drag)
  ai.js             AI assistant (palettes, enhance, suggestions)
  export.js         Export to PNG / JPEG / WebP / SVG
  app.js            Application coordinator + event binding
```

All files are vanilla HTML5, CSS3 and JavaScript — **zero external dependencies**.
