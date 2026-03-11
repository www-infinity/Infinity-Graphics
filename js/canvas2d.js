/**
 * canvas2d.js — 2D raster drawing tools for Infinity Graphics
 */

const Canvas2D = (() => {
  let viewport    = null;
  let container   = null;
  let tempCanvas  = null;
  let tempCtx     = null;
  let gridCanvas  = null;

  // Drawing state
  let isDrawing  = false;
  let isPanning  = false;
  let startX = 0, startY = 0;
  let lastX  = 0, lastY  = 0;
  let panStartX = 0, panStartY = 0;
  let panOffsetX = 0, panOffsetY = 0;
  let zoom = 1;
  let gridVisible = false;
  let rulersVisible = false;

  // Tool settings (synced with App)
  let currentTool  = 'pencil';
  let brushSize    = 10;
  let brushOpacity = 1;
  let brushHardness = 0.8;
  let fgColor      = '#000000';
  let bgColor      = '#ffffff';
  let blendMode    = 'source-over';
  let fillEnabled  = true;
  let strokeEnabled = true;
  let strokeWidth  = 2;
  let polygonSides = 5;
  let fontFamily   = 'Arial';
  let fontSize     = 24;
  let fontBold     = false;
  let fontItalic   = false;
  let gradStartColor = '#000000';
  let gradEndColor   = '#ffffff';
  let gradType       = 'linear';

  // Path tool state
  let pathPoints = [];
  let isPathMode = false;

  // Selection state
  let selection = null; // { x, y, w, h }
  let selectionActive = false;

  // Text state
  let textOverlayInput = null;

  // Eyedropper callback
  let onColorPick = null;

  function init(params) {
    viewport   = document.getElementById('canvas-viewport');
    container  = document.getElementById('canvas-container');
    tempCanvas = document.getElementById('canvas-temp');
    gridCanvas = document.getElementById('canvas-grid');
    tempCtx    = tempCanvas.getContext('2d');

    onColorPick = params.onColorPick || (() => {});

    viewport.addEventListener('mousedown', onMouseDown);
    viewport.addEventListener('mousemove', onMouseMove);
    viewport.addEventListener('mouseup',   onMouseUp);
    viewport.addEventListener('mouseleave', onMouseLeave);
    viewport.addEventListener('wheel',     onWheel, { passive: false });

    // Touch support
    viewport.addEventListener('touchstart', onTouchStart, { passive: false });
    viewport.addEventListener('touchmove',  onTouchMove,  { passive: false });
    viewport.addEventListener('touchend',   onTouchEnd);
  }

  function setSize(w, h) {
    tempCanvas.width  = w; tempCanvas.height  = h;
    gridCanvas.width  = w; gridCanvas.height  = h;
    if (gridVisible) drawGrid();
    centerCanvas();
  }

  function centerCanvas() {
    if (!viewport) return;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const cw = container.offsetWidth  * zoom;
    const ch = container.offsetHeight * zoom;
    panOffsetX = Math.max(0, (vw - cw) / 2);
    panOffsetY = Math.max(0, (vh - ch) / 2);
    applyTransform();
  }

  function applyTransform() {
    container.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px) scale(${zoom})`;
  }

  function getCanvasPos(e) {
    const rect = viewport.getBoundingClientRect();
    const mx = (e.clientX - rect.left - panOffsetX) / zoom;
    const my = (e.clientY - rect.top  - panOffsetY) / zoom;
    return { x: mx, y: my };
  }

  function updateCoords(e) {
    const pos = getCanvasPos(e);
    const el = document.getElementById('status-coords');
    if (el) el.textContent = `X: ${Math.round(pos.x)}, Y: ${Math.round(pos.y)}`;
  }

  /* ─── Mouse Events ─── */
  function onMouseDown(e) {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle-click or Alt+drag = pan
      isPanning = true;
      panStartX = e.clientX - panOffsetX;
      panStartY = e.clientY - panOffsetY;
      viewport.style.cursor = 'grabbing';
      return;
    }
    if (e.button !== 0) return;

    const pos = getCanvasPos(e);
    startX = pos.x; startY = pos.y;
    lastX  = pos.x; lastY  = pos.y;

    const layer = LayerManager.getActiveLayer();
    if (!layer || layer.locked) { showToast('Layer is locked'); return; }
    if (!layer.visible) { showToast('Layer is hidden'); return; }

    LayerManager.pushHistory();

    if (currentTool === 'eyedropper') {
      pickColor(pos.x, pos.y);
      return;
    }
    if (currentTool === 'fill') {
      floodFill(layer.ctx, Math.round(pos.x), Math.round(pos.y), hexToRgba(fgColor));
      return;
    }
    if (currentTool === 'gradient') {
      isDrawing = true;
      return;
    }
    if (currentTool === 'text') {
      placeTextInput(pos.x, pos.y);
      return;
    }
    if (currentTool === 'path') {
      handlePathClick(pos.x, pos.y, e);
      return;
    }
    if (currentTool === 'crop') {
      isDrawing = true;
      selection = { x: pos.x, y: pos.y, w: 0, h: 0 };
      return;
    }
    if (currentTool === 'select') {
      isDrawing = true;
      selectionActive = false;
      selection = { x: pos.x, y: pos.y, w: 0, h: 0 };
      return;
    }

    isDrawing = true;

    if (currentTool === 'pencil' || currentTool === 'brush' || currentTool === 'eraser') {
      const ctx = layer.ctx;
      ctx.save();
      configureContext(ctx);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.restore();
    }
  }

  function onMouseMove(e) {
    updateCoords(e);

    if (isPanning) {
      panOffsetX = e.clientX - panStartX;
      panOffsetY = e.clientY - panStartY;
      applyTransform();
      return;
    }
    if (!isDrawing) return;

    const pos = getCanvasPos(e);
    const layer = LayerManager.getActiveLayer();
    if (!layer) return;

    switch (currentTool) {
      case 'pencil':
      case 'brush':
      case 'eraser':
        drawFreehand(layer.ctx, lastX, lastY, pos.x, pos.y);
        break;
      case 'rect':
      case 'ellipse':
      case 'line':
      case 'polygon':
      case 'star':
      case 'arrow':
        drawShapePreview(pos.x, pos.y);
        break;
      case 'select':
        selection.w = pos.x - startX;
        selection.h = pos.y - startY;
        drawSelectionPreview();
        break;
      case 'crop':
        selection.w = pos.x - startX;
        selection.h = pos.y - startY;
        drawSelectionPreview();
        break;
      case 'gradient':
        drawGradientPreview(pos.x, pos.y);
        break;
    }
    lastX = pos.x; lastY = pos.y;
  }

  function onMouseUp(e) {
    if (isPanning) { isPanning = false; viewport.style.cursor = ''; return; }
    if (!isDrawing) return;
    isDrawing = false;

    const pos = getCanvasPos(e);
    const layer = LayerManager.getActiveLayer();
    if (!layer) return;

    switch (currentTool) {
      case 'rect': case 'ellipse': case 'line': case 'polygon': case 'star': case 'arrow':
        commitShape(layer.ctx, pos.x, pos.y);
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        break;
      case 'gradient':
        applyGradient(layer.ctx, startX, startY, pos.x, pos.y);
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        break;
      case 'crop':
        applyCrop();
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        break;
      case 'select':
        selectionActive = (Math.abs(selection.w) > 2 && Math.abs(selection.h) > 2);
        break;
    }
    LayerManager.renderLayerList();
  }

  function onMouseLeave() {
    if (isDrawing && (currentTool === 'pencil' || currentTool === 'brush' || currentTool === 'eraser')) {
      isDrawing = false;
    }
  }

  /* ─── Touch Events ─── */
  function onTouchStart(e) {
    e.preventDefault();
    const t = e.touches[0];
    onMouseDown({ button: 0, clientX: t.clientX, clientY: t.clientY, altKey: false });
  }
  function onTouchMove(e) {
    e.preventDefault();
    const t = e.touches[0];
    onMouseMove({ clientX: t.clientX, clientY: t.clientY });
  }
  function onTouchEnd(e) {
    const t = e.changedTouches[0];
    onMouseUp({ clientX: t.clientX, clientY: t.clientY });
  }

  /* ─── Wheel (zoom) ─── */
  function onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.05, Math.min(20, zoom * delta));
    // Zoom toward cursor
    const rect = viewport.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    panOffsetX = mx - (mx - panOffsetX) * (newZoom / zoom);
    panOffsetY = my - (my - panOffsetY) * (newZoom / zoom);
    zoom = newZoom;
    applyTransform();
    updateZoomLabel();
  }

  /* ─── Drawing functions ─── */
  function configureContext(ctx, tool) {
    tool = tool || currentTool;
    ctx.globalAlpha = brushOpacity;
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : blendMode;
    ctx.strokeStyle = fgColor;
    ctx.fillStyle   = fgColor;
    ctx.lineWidth   = brushSize;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    // Brush softness via shadow
    if ((tool === 'brush') && brushHardness < 1) {
      const blur = brushSize * (1 - brushHardness) * 0.5;
      ctx.shadowColor = fgColor;
      ctx.shadowBlur  = blur;
    } else {
      ctx.shadowBlur = 0;
    }
  }

  function drawFreehand(ctx, x1, y1, x2, y2) {
    ctx.save();
    configureContext(ctx);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawShapePreview(x2, y2) {
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.save();
    configureShape(tempCtx);
    drawShape(tempCtx, startX, startY, x2, y2);
    tempCtx.restore();
  }

  function commitShape(ctx, x2, y2) {
    ctx.save();
    configureShape(ctx);
    drawShape(ctx, startX, startY, x2, y2);
    ctx.restore();
  }

  function configureShape(ctx) {
    ctx.globalAlpha = brushOpacity;
    ctx.globalCompositeOperation = blendMode;
    ctx.strokeStyle = fgColor;
    ctx.fillStyle   = bgColor;
    ctx.lineWidth   = strokeWidth;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
  }

  function drawShape(ctx, x1, y1, x2, y2) {
    const w = x2 - x1, h = y2 - y1;
    ctx.beginPath();
    switch (currentTool) {
      case 'rect':
        ctx.rect(x1, y1, w, h);
        break;
      case 'ellipse':
        ctx.ellipse(x1 + w / 2, y1 + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
        break;
      case 'line':
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        break;
      case 'arrow': {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = Math.min(30, Math.hypot(w, h) * 0.3);
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
        break;
      }
      case 'polygon':
        drawPolygon(ctx, x1 + w / 2, y1 + h / 2, Math.min(Math.abs(w), Math.abs(h)) / 2, polygonSides);
        break;
      case 'star':
        drawStar(ctx, x1 + w / 2, y1 + h / 2, Math.min(Math.abs(w), Math.abs(h)) / 2, Math.min(Math.abs(w), Math.abs(h)) / 4, polygonSides);
        break;
    }
    if (fillEnabled && currentTool !== 'line' && currentTool !== 'arrow') ctx.fill();
    if (strokeEnabled) ctx.stroke();
  }

  function drawPolygon(ctx, cx, cy, r, sides) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawStar(ctx, cx, cy, outerR, innerR, points) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  /* ─── Gradient ─── */
  function drawGradientPreview(x2, y2) {
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    const grad = buildGradient(tempCtx, startX, startY, x2, y2);
    tempCtx.fillStyle = grad;
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  }

  function applyGradient(ctx, x1, y1, x2, y2) {
    ctx.save();
    ctx.globalAlpha = brushOpacity;
    ctx.globalCompositeOperation = blendMode;
    const grad = buildGradient(ctx, x1, y1, x2, y2);
    ctx.fillStyle = grad;
    if (selectionActive && selection) {
      const { x, y, w, h } = normalizeRect(selection);
      ctx.fillRect(x, y, w, h);
    } else {
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
    ctx.restore();
  }

  function buildGradient(ctx, x1, y1, x2, y2) {
    let grad;
    if (gradType === 'radial') {
      const r = Math.hypot(x2 - x1, y2 - y1);
      grad = ctx.createRadialGradient(x1, y1, 0, x1, y1, r);
    } else {
      grad = ctx.createLinearGradient(x1, y1, x2, y2);
    }
    grad.addColorStop(0, gradStartColor);
    grad.addColorStop(1, gradEndColor);
    return grad;
  }

  /* ─── Flood Fill ─── */
  function floodFill(ctx, sx, sy, fillColor) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const i0 = (sy * w + sx) * 4;
    const targetColor = [data[i0], data[i0+1], data[i0+2], data[i0+3]];
    const [fr, fg, fb, fa] = fillColor;
    if (colorsMatch(targetColor, [fr, fg, fb, fa])) return;

    const queue = [sx + sy * w];
    const visited = new Uint8Array(w * h);
    visited[sx + sy * w] = 1;

    while (queue.length) {
      const idx = queue.pop();
      const x = idx % w, y = Math.floor(idx / w);
      const pi = idx * 4;
      data[pi] = fr; data[pi+1] = fg; data[pi+2] = fb; data[pi+3] = fa;

      for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const ni = ny * w + nx;
        if (visited[ni]) continue;
        const npi = ni * 4;
        if (colorsMatch([data[npi], data[npi+1], data[npi+2], data[npi+3]], targetColor)) {
          visited[ni] = 1;
          queue.push(ni);
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  function colorsMatch(a, b, tolerance = 20) {
    return Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]) + Math.abs(a[3]-b[3]) <= tolerance;
  }

  /* ─── Color Picker ─── */
  function pickColor(x, y) {
    const flat = LayerManager.getFlattenedCanvas();
    const ctx  = flat.getContext('2d');
    const px   = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    const hex  = rgbaToHex(px[0], px[1], px[2]);
    onColorPick(hex);
  }

  /* ─── Selection Preview ─── */
  function drawSelectionPreview() {
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    const { x, y, w, h } = normalizeRect(selection);
    tempCtx.save();
    tempCtx.setLineDash([6, 4]);
    tempCtx.strokeStyle = '#fff';
    tempCtx.lineWidth = 1;
    tempCtx.shadowColor = 'rgba(0,0,0,0.5)';
    tempCtx.shadowBlur = 2;
    tempCtx.strokeRect(x, y, w, h);
    tempCtx.restore();
  }

  /* ─── Crop ─── */
  function applyCrop() {
    if (!selection) return;
    const { x, y, w, h } = normalizeRect(selection);
    if (w < 2 || h < 2) return;
    const layers = LayerManager.getLayers();
    layers.forEach(layer => {
      const tmp = document.createElement('canvas');
      tmp.width = w; tmp.height = h;
      const tc = tmp.getContext('2d');
      tc.drawImage(layer.canvas, -x, -y);
      layer.canvas.width  = w;
      layer.canvas.height = h;
      layer.ctx.drawImage(tmp, 0, 0);
    });
    tempCanvas.width  = w; tempCanvas.height  = h;
    gridCanvas.width  = w; gridCanvas.height  = h;
    if (gridVisible) drawGrid();
    document.getElementById('status-size').textContent = `Canvas: ${w} × ${h}`;
    selection = null; selectionActive = false;
    showToast(`Cropped to ${w} × ${h}`);
  }

  /* ─── Path / Pen Tool ─── */
  function handlePathClick(x, y, e) {
    if (e.shiftKey && pathPoints.length > 0) {
      // Close path
      commitPath();
      return;
    }
    pathPoints.push({ x, y });
    drawPathPreview();
  }

  function drawPathPreview() {
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    if (pathPoints.length < 1) return;
    tempCtx.save();
    tempCtx.strokeStyle = fgColor;
    tempCtx.lineWidth = strokeWidth;
    tempCtx.lineCap = 'round';
    tempCtx.lineJoin = 'round';
    tempCtx.setLineDash([4, 3]);
    tempCtx.beginPath();
    tempCtx.moveTo(pathPoints[0].x, pathPoints[0].y);
    pathPoints.slice(1).forEach(p => tempCtx.lineTo(p.x, p.y));
    tempCtx.stroke();
    pathPoints.forEach(p => {
      tempCtx.beginPath();
      tempCtx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      tempCtx.fillStyle = '#fff';
      tempCtx.fill();
      tempCtx.strokeStyle = fgColor;
      tempCtx.setLineDash([]);
      tempCtx.lineWidth = 1;
      tempCtx.stroke();
    });
    tempCtx.restore();
  }

  function commitPath() {
    if (pathPoints.length < 2) { pathPoints = []; tempCtx.clearRect(0,0,tempCanvas.width,tempCanvas.height); return; }
    const layer = LayerManager.getActiveLayer();
    const ctx   = layer.ctx;
    ctx.save();
    ctx.globalAlpha = brushOpacity;
    ctx.globalCompositeOperation = blendMode;
    ctx.strokeStyle = fgColor;
    ctx.fillStyle   = bgColor;
    ctx.lineWidth   = strokeWidth;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    pathPoints.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    if (fillEnabled) ctx.fill();
    if (strokeEnabled) ctx.stroke();
    ctx.restore();
    pathPoints = [];
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    LayerManager.renderLayerList();
  }

  /* ─── Text Tool ─── */
  function placeTextInput(x, y) {
    removeTextInput();
    const fontStr = `${fontItalic?'italic ':''} ${fontBold?'bold ':''} ${fontSize}px ${fontFamily}`;
    textOverlayInput = document.createElement('div');
    textOverlayInput.id = 'text-overlay-input';
    textOverlayInput.contentEditable = true;
    textOverlayInput.style.left     = `${x * zoom + panOffsetX}px`;
    textOverlayInput.style.top      = `${y * zoom + panOffsetY}px`;
    textOverlayInput.style.font     = fontStr;
    textOverlayInput.style.color    = fgColor;
    textOverlayInput.style.fontSize = `${fontSize * zoom}px`;
    textOverlayInput.style.fontFamily = fontFamily;
    textOverlayInput.style.fontWeight  = fontBold ? 'bold' : 'normal';
    textOverlayInput.style.fontStyle   = fontItalic ? 'italic' : 'normal';
    viewport.appendChild(textOverlayInput);
    textOverlayInput.focus();

    textOverlayInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') { removeTextInput(); e.preventDefault(); }
      if (e.key === 'Enter' && !e.shiftKey) {
        commitText(x, y);
        e.preventDefault();
      }
      e.stopPropagation();
    });

    textOverlayInput.addEventListener('blur', () => {
      if (textOverlayInput && textOverlayInput.textContent.trim()) commitText(x, y);
      else removeTextInput();
    });
  }

  function commitText(x, y) {
    if (!textOverlayInput) return;
    const text = textOverlayInput.textContent;
    removeTextInput();
    if (!text.trim()) return;
    const layer = LayerManager.getActiveLayer();
    const ctx   = layer.ctx;
    ctx.save();
    ctx.globalAlpha = brushOpacity;
    ctx.globalCompositeOperation = blendMode;
    ctx.fillStyle = fgColor;
    const fontStr = `${fontItalic?'italic ':''} ${fontBold?'bold ':''} ${fontSize}px ${fontFamily}`;
    ctx.font = fontStr;
    ctx.fillText(text, x, y + fontSize);
    ctx.restore();
    LayerManager.renderLayerList();
  }

  function removeTextInput() {
    if (textOverlayInput && textOverlayInput.parentNode) {
      textOverlayInput.parentNode.removeChild(textOverlayInput);
    }
    textOverlayInput = null;
  }

  /* ─── Grid ─── */
  function drawGrid() {
    const ctx = gridCanvas.getContext('2d');
    const w = gridCanvas.width, h = gridCanvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(100,100,200,0.4)';
    ctx.lineWidth = 1;
    const step = 20;
    for (let x = 0; x <= w; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  }

  function toggleGrid() {
    gridVisible = !gridVisible;
    if (gridVisible) drawGrid();
    else gridCanvas.getContext('2d').clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    showToast(gridVisible ? 'Grid on' : 'Grid off');
  }

  /* ─── Zoom ─── */
  function zoomIn()  { setZoom(zoom * 1.25); }
  function zoomOut() { setZoom(zoom / 1.25); }
  function zoomFit() {
    const vw = viewport.clientWidth, vh = viewport.clientHeight;
    const cw = container.offsetWidth, ch = container.offsetHeight;
    zoom = Math.min(vw / (cw + 40), vh / (ch + 40));
    centerCanvas();
    updateZoomLabel();
  }
  function zoom100() { zoom = 1; centerCanvas(); updateZoomLabel(); }
  function setZoom(z) {
    zoom = Math.max(0.05, Math.min(20, z));
    applyTransform();
    updateZoomLabel();
  }
  function updateZoomLabel() {
    const el = document.getElementById('zoom-level');
    if (el) el.textContent = `${Math.round(zoom * 100)}%`;
    const statusEl = document.getElementById('status-mode');
    // just keep current mode text unchanged
  }

  /* ─── Helpers ─── */
  function normalizeRect(r) {
    return {
      x: r.w < 0 ? r.x + r.w : r.x,
      y: r.h < 0 ? r.y + r.h : r.y,
      w: Math.abs(r.w),
      h: Math.abs(r.h)
    };
  }

  function hexToRgba(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [parseInt(result[1],16), parseInt(result[2],16), parseInt(result[3],16), 255] : [0,0,0,255];
  }

  function rgbaToHex(r, g, b) {
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  /* ─── Setters ─── */
  function setTool(t)    { currentTool = t; if (t !== 'path') { pathPoints = []; tempCtx && tempCtx.clearRect(0,0,tempCanvas.width, tempCanvas.height); } }
  function setFgColor(c) { fgColor = c; }
  function setBgColor(c) { bgColor = c; }
  function setBrushSize(s)    { brushSize = s; }
  function setBrushOpacity(o) { brushOpacity = o; }
  function setBrushHardness(h) { brushHardness = h; }
  function setBlendMode(m)    { blendMode = m; }
  function setFill(v)         { fillEnabled = v; }
  function setStroke(v)       { strokeEnabled = v; }
  function setStrokeWidth(v)  { strokeWidth = v; }
  function setPolygonSides(v) { polygonSides = v; }
  function setFont(f)         { fontFamily = f; }
  function setFontSize(s)     { fontSize = s; }
  function setFontBold(v)     { fontBold = v; }
  function setFontItalic(v)   { fontItalic = v; }
  function setGradStartColor(c) { gradStartColor = c; }
  function setGradEndColor(c)   { gradEndColor = c; }
  function setGradType(t)       { gradType = t; }
  function getZoom()            { return zoom; }
  function getSelection()       { return selectionActive ? normalizeRect(selection) : null; }
  function clearSelection()     { selectionActive = false; selection = null; tempCtx.clearRect(0,0,tempCanvas.width,tempCanvas.height); }

  return {
    init, setSize, centerCanvas, zoomIn, zoomOut, zoomFit, zoom100, setZoom, getZoom,
    toggleGrid, commitPath,
    setTool, setFgColor, setBgColor, setBrushSize, setBrushOpacity, setBrushHardness,
    setBlendMode, setFill, setStroke, setStrokeWidth, setPolygonSides,
    setFont, setFontSize, setFontBold, setFontItalic,
    setGradStartColor, setGradEndColor, setGradType,
    getSelection, clearSelection
  };
})();
