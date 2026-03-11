/**
 * ai.js — AI Assistant panel for Infinity Graphics
 * Uses browser-native APIs and algorithmic approaches for design assistance.
 */

const AIAssistant = (() => {
  let log = null;
  let isTyping = false;

  /* ── Color palette generation ── */

  function generatePalette(baseHex) {
    const base = baseHex || randomHex();
    const [h, s, l] = hexToHsl(base);

    const palettes = {
      complementary: [
        hslToHex(h, s, l),
        hslToHex((h + 180) % 360, s, l),
        hslToHex(h, s * 0.6, l * 1.2),
        hslToHex((h + 180) % 360, s * 0.6, l * 1.2),
        hslToHex(h, s * 0.3, 0.95),
      ],
      triadic: [
        hslToHex(h, s, l),
        hslToHex((h + 120) % 360, s, l),
        hslToHex((h + 240) % 360, s, l),
        hslToHex(h, s, l * 1.3),
        hslToHex(h, s * 0.4, 0.9),
      ],
      analogous: [
        hslToHex((h - 40 + 360) % 360, s, l),
        hslToHex((h - 20 + 360) % 360, s * 1.1, l),
        hslToHex(h, s, l),
        hslToHex((h + 20) % 360, s * 1.1, l),
        hslToHex((h + 40) % 360, s, l),
      ],
      monochromatic: [
        hslToHex(h, s, 0.2),
        hslToHex(h, s, 0.35),
        hslToHex(h, s, 0.5),
        hslToHex(h, s, 0.7),
        hslToHex(h, s, 0.9),
      ],
      splitComplementary: [
        hslToHex(h, s, l),
        hslToHex((h + 150) % 360, s, l),
        hslToHex((h + 210) % 360, s, l),
        hslToHex(h, s * 0.5, l * 1.4),
        hslToHex((h + 180) % 360, s * 0.3, 0.9),
      ],
    };

    const types = Object.keys(palettes);
    const chosen = types[Math.floor(Math.random() * types.length)];
    return { type: chosen, colors: palettes[chosen], base };
  }

  /* ── Design suggestions ── */
  const suggestions = [
    '💡 Try a dark background with a vivid accent color for better contrast.',
    '🎨 Limit your palette to 3-5 colors for a cohesive design.',
    '📐 Use a grid to align elements and create visual harmony.',
    '✨ Add subtle shadows to give depth to flat designs.',
    '🔤 Mix font weights (light + bold) to create typographic hierarchy.',
    '⚖️ Balance dense areas with white space to guide the eye.',
    '🌈 Complementary colors (opposite on the wheel) create high contrast.',
    '🎯 Align important elements to the rule of thirds for dynamic composition.',
    '🌊 Use gradients sparingly — one dominant gradient works better than many.',
    '🔲 Rounded corners feel friendlier; sharp corners feel more formal.',
    '📏 Consistent spacing (8px grid system) makes designs feel polished.',
    '🖼️ Crop images to show faces close-up for more emotional impact.',
    '🌙 Dark mode designs reduce eye strain in low-light environments.',
    '💬 Left-align body text for better readability in Latin scripts.',
    '🔴 Red grabs attention — use sparingly for critical calls-to-action.',
    '🌿 Organic shapes (blobs, curves) add warmth to geometric layouts.',
  ];

  function getSuggestion() {
    return suggestions[Math.floor(Math.random() * suggestions.length)];
  }

  /* ── Auto enhance ── */
  function autoEnhance(ctx) {
    // 1. Measure average brightness
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    let totalBrightness = 0;
    for (let i = 0; i < d.length; i += 4) {
      totalBrightness += (0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2]);
    }
    const avgBrightness = totalBrightness / (d.length / 4);
    const brightnessAdj = 128 - avgBrightness; // target mid-tone

    // 2. Apply brightness/contrast enhancement
    Effects.applyToCanvas(ctx, 'brightness', {
      brightness: brightnessAdj * 0.5,
      contrast: 20
    });

    // 3. Slight sharpen
    Effects.applyToCanvas(ctx, 'sharpen', { amount: 0.3 });

    return {
      brightness: Math.round(brightnessAdj * 0.5),
      contrast: 20,
      message: `Applied auto-enhance: brightness ${brightnessAdj > 0 ? '+' : ''}${Math.round(brightnessAdj * 0.5)}, contrast +20, slight sharpen.`
    };
  }

  /* ── Describe design ── */
  function describeDesign(ctx) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;

    let r = 0, g = 0, b = 0, pixels = 0;
    let darkPixels = 0, lightPixels = 0, coloredPixels = 0;
    let sampledColors = [];

    for (let i = 0; i < d.length; i += 4 * 16) {
      const pr = d[i], pg = d[i+1], pb = d[i+2], pa = d[i+3];
      if (pa < 10) continue;
      r += pr; g += pg; b += pb; pixels++;
      const brightness = 0.299 * pr + 0.587 * pg + 0.114 * pb;
      if (brightness < 64) darkPixels++;
      else if (brightness > 192) lightPixels++;
      const saturation = (Math.max(pr,pg,pb) - Math.min(pr,pg,pb)) / 255;
      if (saturation > 0.2) coloredPixels++;
      if (sampledColors.length < 8) sampledColors.push([pr, pg, pb]);
    }

    if (pixels === 0) return '🖼️ The canvas appears to be empty. Start drawing to see AI insights!';

    r = Math.round(r / pixels);
    g = Math.round(g / pixels);
    b = Math.round(b / pixels);
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
    const darkRatio   = darkPixels / pixels;
    const lightRatio  = lightPixels / pixels;
    const colorRatio  = coloredPixels / pixels;

    const [dh, ds] = Effects.rgbToHsl(r, g, b);
    const hueName = getHueName(dh * 360);

    const mood = brightness < 80 ? 'dark and moody' : brightness > 180 ? 'bright and airy' : 'balanced in tone';
    const style = colorRatio > 0.4 ? 'vibrant and colorful' : ds < 0.1 ? 'minimalist monochromatic' : 'tastefully muted';
    const dominantHue = ds > 0.15 ? `with a dominant ${hueName} palette` : 'in greyscale tones';

    return `🎨 Your design appears ${mood} and ${style} ${dominantHue}. ` +
           `Average color: rgb(${r},${g},${b}). ` +
           `${Math.round(darkRatio*100)}% dark tones, ${Math.round(lightRatio*100)}% highlights. ` +
           `Canvas size: ${w}×${h}px.`;
  }

  function getHueName(h) {
    if (h < 15 || h >= 345) return 'red';
    if (h < 45) return 'orange';
    if (h < 75) return 'yellow';
    if (h < 150) return 'green';
    if (h < 195) return 'cyan';
    if (h < 255) return 'blue';
    if (h < 285) return 'violet';
    if (h < 345) return 'magenta';
    return 'red';
  }

  /* ── AI chat ── */
  const CANNED_RESPONSES = {
    color:    ['Consider using complementary colors for maximum contrast.', 'A monochromatic palette with varying lightness feels elegant.', 'The 60-30-10 rule: 60% dominant, 30% secondary, 10% accent.'],
    font:     ['Pair a serif with a sans-serif for classic contrast.', 'Limit to 2 typefaces per design — more feels cluttered.', 'Font size hierarchy: headline ×2.5 body size.'],
    layout:   ['Use a 12-column grid for flexible responsive layouts.', 'Negative space (whitespace) is just as important as content.', 'Visual weight: balance dark/large elements with lighter ones.'],
    icon:     ['Consistent icon style (outline vs filled) strengthens brand identity.', 'Icons at 24px or 48px for clearest rendering at screen resolutions.'],
    contrast: ['WCAG AA requires a contrast ratio of 4.5:1 for body text.', 'Dark text on light background is generally easier to read.'],
    help:     ['Ask me about colors, fonts, layout, composition, or design principles.'],
  };

  function respond(userText) {
    const lower = userText.toLowerCase();
    let responses = CANNED_RESPONSES.help;
    if (/colou?r|palette|hue|tint|shade/.test(lower)) responses = CANNED_RESPONSES.color;
    else if (/font|type|text|letter/.test(lower)) responses = CANNED_RESPONSES.font;
    else if (/layout|grid|spacing|margin|padding|align/.test(lower)) responses = CANNED_RESPONSES.layout;
    else if (/icon|symbol/.test(lower)) responses = CANNED_RESPONSES.icon;
    else if (/contrast|accessibility|readable/.test(lower)) responses = CANNED_RESPONSES.contrast;
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /* ── UI ── */
  function init(logEl) {
    log = logEl;
    appendMessage('ai', '👋 Hi! I\'m the Infinity AI assistant. Try asking about colors, fonts, or layout — or use the quick buttons above.');
  }

  function appendMessage(role, text) {
    if (!log) return;
    const div = document.createElement('div');
    div.className = `ai-message ${role}`;
    const label = document.createElement('div');
    label.className = 'ai-label';
    label.textContent = role === 'ai' ? '🤖 Infinity AI' : '🙋 You';
    div.appendChild(label);
    const body = document.createElement('div');
    body.innerHTML = text;
    div.appendChild(body);
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function appendPalette(palette) {
    if (!log) return;
    const div = document.createElement('div');
    div.className = 'ai-message ai';
    const label = document.createElement('div');
    label.className = 'ai-label';
    label.textContent = '🤖 Infinity AI';
    div.appendChild(label);
    const body = document.createElement('div');
    body.innerHTML = `<b>${palette.type.charAt(0).toUpperCase() + palette.type.slice(1)} palette</b> based on ${palette.base}:`;
    const row = document.createElement('div');
    row.className = 'ai-palette';
    palette.colors.forEach(c => {
      const swatch = document.createElement('div');
      swatch.className = 'ai-palette-swatch';
      swatch.style.background = c;
      swatch.title = c;
      swatch.addEventListener('click', () => {
        if (window.App) App.setFgColor(c);
        showToast(`Color set to ${c}`);
      });
      row.appendChild(swatch);
    });
    body.appendChild(row);
    div.appendChild(body);
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function handleAction(action) {
    switch (action) {
      case 'ai-palette': {
        const layer = LayerManager.getActiveLayer();
        const palette = generatePalette();
        appendMessage('ai', '🎨 Generating a color palette for you…');
        appendPalette(palette);
        break;
      }
      case 'ai-enhance': {
        const layer = LayerManager.getActiveLayer();
        if (layer.locked) { appendMessage('ai', '⚠️ The active layer is locked.'); return; }
        LayerManager.pushHistory();
        const result = autoEnhance(layer.ctx);
        appendMessage('ai', `✨ ${result.message}`);
        LayerManager.renderLayerList();
        showToast('Auto-enhanced');
        break;
      }
      case 'ai-suggest':
        appendMessage('ai', getSuggestion());
        break;
      case 'ai-describe': {
        const layer = LayerManager.getActiveLayer();
        const desc = describeDesign(layer.ctx);
        appendMessage('ai', desc);
        break;
      }
    }
  }

  function handleChat(text) {
    if (!text.trim()) return;
    appendMessage('user', text);
    const reply = respond(text);
    setTimeout(() => appendMessage('ai', reply), 400);
  }

  /* ── Color utils ── */
  function randomHex() {
    return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  }

  function hexToHsl(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return [0, 0, 0.5];
    return Effects.rgbToHsl(parseInt(result[1],16), parseInt(result[2],16), parseInt(result[3],16));
  }

  function hslToHex(h, s, l) {
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));
    const [r, g, b] = Effects.hslToRgb(h / 360, s, l);
    return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  }

  return { init, handleAction, handleChat, generatePalette };
})();
