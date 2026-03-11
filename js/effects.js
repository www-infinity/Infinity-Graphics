/**
 * effects.js — Image filters and effects for Infinity Graphics
 */

const Effects = (() => {

  /* ── Convolution helper ── */
  function convolve(imageData, kernel, kernelSize) {
    const src  = imageData.data;
    const w    = imageData.width;
    const h    = imageData.height;
    const dst  = new Uint8ClampedArray(src.length);
    const half = Math.floor(kernelSize / 2);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0;
        for (let ky = 0; ky < kernelSize; ky++) {
          for (let kx = 0; kx < kernelSize; kx++) {
            const px = Math.min(w - 1, Math.max(0, x + kx - half));
            const py = Math.min(h - 1, Math.max(0, y + ky - half));
            const i = (py * w + px) * 4;
            const k = kernel[ky * kernelSize + kx];
            r += src[i]     * k;
            g += src[i + 1] * k;
            b += src[i + 2] * k;
          }
        }
        const i = (y * w + x) * 4;
        dst[i]     = Math.min(255, Math.max(0, r));
        dst[i + 1] = Math.min(255, Math.max(0, g));
        dst[i + 2] = Math.min(255, Math.max(0, b));
        dst[i + 3] = src[i + 3];
      }
    }
    return new ImageData(dst, w, h);
  }

  /* ── Box blur (fast) ── */
  function boxBlur(imageData, radius) {
    radius = Math.max(1, Math.round(radius));
    const size = radius * 2 + 1;
    const k = new Array(size * size).fill(1 / (size * size));
    let res = convolve(imageData, k, size);
    // Apply twice for smoother result
    return convolve(res, k, size);
  }

  /* ── Gaussian blur (3-pass box) ── */
  function gaussianBlur(imageData, sigma) {
    let res = imageData;
    const radius = Math.max(1, Math.round(sigma * 2));
    const size   = radius * 2 + 1;
    const kernel = buildGaussianKernel(size, sigma);
    res = convolve(res, kernel, size);
    return res;
  }

  function buildGaussianKernel(size, sigma) {
    const half = Math.floor(size / 2);
    const k = [];
    let sum = 0;
    for (let y = -half; y <= half; y++) {
      for (let x = -half; x <= half; x++) {
        const val = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
        k.push(val); sum += val;
      }
    }
    return k.map(v => v / sum);
  }

  /* ── Brightness / Contrast ── */
  function brightnessContrast(imageData, brightness, contrast) {
    const d  = imageData.data;
    const fc = (259 * (contrast + 255)) / (255 * (259 - contrast));
    for (let i = 0; i < d.length; i += 4) {
      d[i]     = clamp(fc * (d[i]     + brightness - 128) + 128);
      d[i + 1] = clamp(fc * (d[i + 1] + brightness - 128) + 128);
      d[i + 2] = clamp(fc * (d[i + 2] + brightness - 128) + 128);
    }
    return imageData;
  }

  /* ── Hue / Saturation / Lightness ── */
  function hueSaturation(imageData, hShift, sMultiplier, lShift) {
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
      const nh = (h + hShift / 360 + 1) % 1;
      const ns = Math.max(0, Math.min(1, s * sMultiplier));
      const nl = Math.max(0, Math.min(1, l + lShift / 100));
      const [r, g, b] = hslToRgb(nh, ns, nl);
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
    return imageData;
  }

  /* ── Invert ── */
  function invert(imageData) {
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2];
    }
    return imageData;
  }

  /* ── Grayscale ── */
  function grayscale(imageData) {
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = g;
    }
    return imageData;
  }

  /* ── Sepia ── */
  function sepia(imageData, amount = 1) {
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const tr = clamp(0.393 * r + 0.769 * g + 0.189 * b);
      const tg = clamp(0.349 * r + 0.686 * g + 0.168 * b);
      const tb = clamp(0.272 * r + 0.534 * g + 0.131 * b);
      d[i]     = r + (tr - r) * amount;
      d[i + 1] = g + (tg - g) * amount;
      d[i + 2] = b + (tb - b) * amount;
    }
    return imageData;
  }

  /* ── Sharpen ── */
  function sharpen(imageData, amount = 1) {
    const a = -amount;
    const c = 1 + 4 * amount;
    const kernel = [0, a, 0, a, c, a, 0, a, 0];
    return convolve(imageData, kernel, 3);
  }

  /* ── Emboss ── */
  function emboss(imageData) {
    const kernel = [-2, -1, 0, -1, 1, 1, 0, 1, 2];
    const res = convolve(imageData, kernel, 3);
    const d = res.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i]     += 128;
      d[i + 1] += 128;
      d[i + 2] += 128;
    }
    return res;
  }

  /* ── Edge Detection ── */
  function edgeDetect(imageData) {
    const gray = grayscale(new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height));
    const kernel = [-1, -1, -1, -1, 8, -1, -1, -1, -1];
    return convolve(gray, kernel, 3);
  }

  /* ── Pixelate ── */
  function pixelate(imageData, size) {
    size = Math.max(2, Math.round(size));
    const d = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        const i = (y * w + x) * 4;
        const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
        for (let dy = 0; dy < size && y + dy < h; dy++) {
          for (let dx = 0; dx < size && x + dx < w; dx++) {
            const j = ((y + dy) * w + (x + dx)) * 4;
            d[j] = r; d[j + 1] = g; d[j + 2] = b; d[j + 3] = a;
          }
        }
      }
    }
    return imageData;
  }

  /* ── Noise ── */
  function addNoise(imageData, amount) {
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * amount * 2;
      d[i]     = clamp(d[i]     + n);
      d[i + 1] = clamp(d[i + 1] + n);
      d[i + 2] = clamp(d[i + 2] + n);
    }
    return imageData;
  }

  /* ── Vignette ── */
  function vignette(ctx, w, h, amount = 0.5) {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.9);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, `rgba(0,0,0,${amount})`);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /* ── Flip ── */
  function flip(ctx, w, h, horizontal) {
    const temp = document.createElement('canvas');
    temp.width = w; temp.height = h;
    const tc = temp.getContext('2d');
    tc.drawImage(ctx.canvas, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    if (horizontal) { ctx.translate(w, 0); ctx.scale(-1, 1); }
    else            { ctx.translate(0, h); ctx.scale(1, -1); }
    ctx.drawImage(temp, 0, 0);
    ctx.restore();
  }

  /* ── Motion Blur ── */
  function motionBlur(imageData, distance, angle) {
    const rad   = angle * Math.PI / 180;
    const dx    = Math.round(Math.cos(rad) * distance);
    const dy    = Math.round(Math.sin(rad) * distance);
    const src   = imageData.data;
    const w     = imageData.width;
    const h     = imageData.height;
    const dst   = new Uint8ClampedArray(src.length);
    const steps = Math.max(1, Math.abs(dx) + Math.abs(dy));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let s = 0; s < steps; s++) {
          const sx = Math.min(w - 1, Math.max(0, x + Math.round(dx * s / steps)));
          const sy = Math.min(h - 1, Math.max(0, y + Math.round(dy * s / steps)));
          const i = (sy * w + sx) * 4;
          r += src[i]; g += src[i + 1]; b += src[i + 2]; a += src[i + 3];
        }
        const oi = (y * w + x) * 4;
        dst[oi] = r / steps; dst[oi + 1] = g / steps;
        dst[oi + 2] = b / steps; dst[oi + 3] = a / steps;
      }
    }
    return new ImageData(dst, w, h);
  }

  /* ── Apply filter to canvas ── */
  function applyToCanvas(ctx, filterName, params = {}) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    let imageData = ctx.getImageData(0, 0, w, h);

    switch (filterName) {
      case 'blur':
        imageData = gaussianBlur(imageData, params.sigma || 3);
        break;
      case 'sharpen':
        imageData = sharpen(imageData, params.amount || 1);
        break;
      case 'brightness':
        imageData = brightnessContrast(imageData, params.brightness || 0, params.contrast || 0);
        break;
      case 'hue':
        imageData = hueSaturation(imageData, params.hue || 0, params.saturation || 1, params.lightness || 0);
        break;
      case 'invert':
        imageData = invert(imageData);
        break;
      case 'grayscale':
        imageData = grayscale(imageData);
        break;
      case 'sepia':
        imageData = sepia(imageData, params.amount || 1);
        break;
      case 'emboss':
        imageData = emboss(imageData);
        break;
      case 'pixelate':
        imageData = pixelate(imageData, params.size || 10);
        break;
      case 'noise':
        imageData = addNoise(imageData, params.amount || 50);
        break;
      case 'edge':
        imageData = edgeDetect(imageData);
        break;
      case 'vignette':
        ctx.putImageData(imageData, 0, 0);
        vignette(ctx, w, h, params.amount || 0.5);
        return;
      case 'motion-blur':
        imageData = motionBlur(imageData, params.distance || 15, params.angle || 0);
        break;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  /* ── Color conversion helpers ── */
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s;
    const l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        default: h = ((r - g) / d + 4) / 6;
      }
    }
    return [h, s, l];
  }

  function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  function hue2rgb(p, q, t) {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  }

  function clamp(v) { return Math.min(255, Math.max(0, Math.round(v))); }

  /* ── Expose color utilities ── */
  return {
    applyToCanvas,
    gaussianBlur, boxBlur, sharpen, emboss, edgeDetect,
    brightnessContrast, hueSaturation,
    invert, grayscale, sepia, pixelate, addNoise, vignette, motionBlur,
    flip,
    rgbToHsl, hslToRgb, clamp
  };
})();
