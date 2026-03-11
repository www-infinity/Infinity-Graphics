/**
 * layers.js — Layer management system for Infinity Graphics
 */

const LayerManager = (() => {
  let layers = [];
  let activeLayerIndex = 0;
  let canvasWidth = 800;
  let canvasHeight = 600;
  let container = null;
  let listEl = null;
  let onChangeCallback = null;

  function init(containerEl, listElement, w, h) {
    container = containerEl;
    listEl    = listElement;
    canvasWidth  = w;
    canvasHeight = h;
    addLayer('Background');
  }

  function setSize(w, h) {
    canvasWidth  = w;
    canvasHeight = h;
    layers.forEach(l => {
      const tmp = document.createElement('canvas');
      tmp.width  = w; tmp.height = h;
      const tc = tmp.getContext('2d');
      tc.drawImage(l.canvas, 0, 0);
      l.canvas.width  = w;
      l.canvas.height = h;
      l.ctx.drawImage(tmp, 0, 0);
    });
    renderLayerList();
  }

  function addLayer(name) {
    const canvas = document.createElement('canvas');
    canvas.width  = canvasWidth;
    canvas.height = canvasHeight;
    canvas.className = 'canvas-layer';
    canvas.style.zIndex = layers.length + 1;

    // Insert before the temp canvas
    const tempCanvas = document.getElementById('canvas-temp');
    container.insertBefore(canvas, tempCanvas);

    const layer = {
      id: Date.now(),
      name: name || `Layer ${layers.length + 1}`,
      canvas,
      ctx: canvas.getContext('2d'),
      visible: true,
      locked: false,
      opacity: 100,
      blendMode: 'source-over',
    };
    layers.push(layer);
    activeLayerIndex = layers.length - 1;
    renderLayerList();
    if (onChangeCallback) onChangeCallback();
    return layer;
  }

  function removeLayer(index) {
    if (layers.length <= 1) { showToast('Cannot delete the last layer'); return; }
    const layer = layers[index];
    if (layer.canvas.parentNode) layer.canvas.parentNode.removeChild(layer.canvas);
    layers.splice(index, 1);
    if (activeLayerIndex >= layers.length) activeLayerIndex = layers.length - 1;
    renderLayerList();
    if (onChangeCallback) onChangeCallback();
  }

  function duplicateLayer(index) {
    const src = layers[index];
    const newLayer = addLayer(src.name + ' copy');
    newLayer.ctx.drawImage(src.canvas, 0, 0);
    newLayer.opacity   = src.opacity;
    newLayer.blendMode = src.blendMode;
    renderLayerList();
  }

  function mergeDown(index) {
    if (index === 0) { showToast('No layer below to merge into'); return; }
    const above = layers[index];
    const below = layers[index - 1];
    below.ctx.save();
    below.ctx.globalAlpha          = above.opacity / 100;
    below.ctx.globalCompositeOperation = above.blendMode;
    below.ctx.drawImage(above.canvas, 0, 0);
    below.ctx.restore();
    removeLayer(index);
  }

  function flattenAll() {
    const flat = document.createElement('canvas');
    flat.width = canvasWidth; flat.height = canvasHeight;
    const fc = flat.getContext('2d');
    layers.forEach(l => {
      if (!l.visible) return;
      fc.save();
      fc.globalAlpha = l.opacity / 100;
      fc.globalCompositeOperation = l.blendMode;
      fc.drawImage(l.canvas, 0, 0);
      fc.restore();
    });
    // Remove all layers
    layers.slice(1).forEach((_, i) => {
      if (layers[i + 1].canvas.parentNode)
        layers[i + 1].canvas.parentNode.removeChild(layers[i + 1].canvas);
    });
    layers.length = 1;
    layers[0].ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    layers[0].ctx.drawImage(flat, 0, 0);
    activeLayerIndex = 0;
    renderLayerList();
    if (onChangeCallback) onChangeCallback();
  }

  function moveLayer(fromIndex, direction) {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= layers.length) return;
    // Swap array entries
    [layers[fromIndex], layers[toIndex]] = [layers[toIndex], layers[fromIndex]];
    // Reorder DOM z-indices
    layers.forEach((l, i) => { l.canvas.style.zIndex = i + 1; });
    activeLayerIndex = toIndex;
    renderLayerList();
  }

  function getActiveLayer() { return layers[activeLayerIndex] || layers[0]; }
  function getLayers()      { return layers; }
  function getCount()       { return layers.length; }

  function setActiveLayer(index) {
    activeLayerIndex = index;
    renderLayerList();
    updateStatusLayer();
    if (onChangeCallback) onChangeCallback();
  }

  function setOpacity(index, val) {
    layers[index].opacity = val;
    layers[index].canvas.style.opacity = val / 100;
    renderLayerList();
  }

  function setBlendMode(index, mode) {
    layers[index].blendMode = mode;
    // Canvas blend modes don't apply to the DOM canvas element directly;
    // compositing is handled when flattening. For visual preview:
    layers[index].canvas.style.mixBlendMode = mode;
    renderLayerList();
  }

  function setVisibility(index, visible) {
    layers[index].visible = visible;
    layers[index].canvas.style.display = visible ? 'block' : 'none';
    renderLayerList();
  }

  function setLocked(index, locked) {
    layers[index].locked = locked;
    renderLayerList();
  }

  function renameLayer(index, name) {
    layers[index].name = name;
    renderLayerList();
  }

  function renderLayerList() {
    if (!listEl) return;
    listEl.innerHTML = '';
    // Show layers in reverse (top layers first)
    const reversed = layers.map((l, i) => ({ ...l, origIndex: i })).reverse();
    reversed.forEach(({ origIndex }) => {
      const layer = layers[origIndex];
      const div = document.createElement('div');
      div.className = 'layer-item' + (origIndex === activeLayerIndex ? ' active' : '');
      div.dataset.index = origIndex;

      // Thumbnail
      const thumb = document.createElement('div');
      thumb.className = 'layer-thumb';
      const tc = document.createElement('canvas');
      tc.width = 32; tc.height = 32;
      const tctx = tc.getContext('2d');
      tctx.drawImage(layer.canvas, 0, 0, 32, 32);
      thumb.appendChild(tc);

      // Info
      const info = document.createElement('div');
      info.className = 'layer-info';
      const nameEl = document.createElement('div');
      nameEl.className = 'layer-name';
      nameEl.textContent = layer.name;
      nameEl.addEventListener('dblclick', e => {
        e.stopPropagation();
        const newName = prompt('Rename layer:', layer.name);
        if (newName) { renameLayer(origIndex, newName); }
      });
      const metaEl = document.createElement('div');
      metaEl.className = 'layer-meta';

      const opInput = document.createElement('input');
      opInput.type = 'number'; opInput.min = 0; opInput.max = 100;
      opInput.value = layer.opacity;
      opInput.className = 'layer-opacity-input';
      opInput.title = 'Opacity %';
      opInput.addEventListener('change', e => {
        setOpacity(origIndex, Math.max(0, Math.min(100, +e.target.value)));
      });
      opInput.addEventListener('click', e => e.stopPropagation());
      metaEl.appendChild(opInput);

      const blendSel = document.createElement('select');
      blendSel.style.cssText = 'font-size:0.65rem;background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-secondary);border-radius:2px;';
      ['source-over','multiply','screen','overlay','darken','lighten','difference','exclusion'].forEach(m => {
        const opt = document.createElement('option');
        opt.value = m; opt.textContent = m;
        if (m === layer.blendMode) opt.selected = true;
        blendSel.appendChild(opt);
      });
      blendSel.addEventListener('change', e => {
        setBlendMode(origIndex, e.target.value);
        e.stopPropagation();
      });
      metaEl.appendChild(blendSel);

      info.appendChild(nameEl);
      info.appendChild(metaEl);

      // Visibility button
      const visBtn = document.createElement('button');
      visBtn.className = 'layer-vis-btn' + (layer.visible ? '' : ' hidden');
      visBtn.textContent = layer.visible ? '👁' : '🙈';
      visBtn.title = layer.visible ? 'Hide layer' : 'Show layer';
      visBtn.addEventListener('click', e => {
        e.stopPropagation();
        setVisibility(origIndex, !layer.visible);
      });

      // Lock button
      const lockBtn = document.createElement('button');
      lockBtn.className = 'layer-lock-btn';
      lockBtn.textContent = layer.locked ? '🔒' : '🔓';
      lockBtn.title = layer.locked ? 'Unlock layer' : 'Lock layer';
      lockBtn.addEventListener('click', e => {
        e.stopPropagation();
        setLocked(origIndex, !layer.locked);
      });

      div.appendChild(thumb);
      div.appendChild(info);
      div.appendChild(visBtn);
      div.appendChild(lockBtn);

      div.addEventListener('click', () => setActiveLayer(origIndex));
      listEl.appendChild(div);
    });
    updateStatusLayer();
  }

  function updateStatusLayer() {
    const el = document.getElementById('status-layer');
    if (el) el.textContent = `Layer: ${getActiveLayer().name}`;
  }

  function clearActive() {
    const layer = getActiveLayer();
    if (layer.locked) { showToast('Layer is locked'); return; }
    layer.ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    renderLayerList();
  }

  function pushHistory() {
    // Save snapshot of active layer for undo
    const layer = getActiveLayer();
    const snap = document.createElement('canvas');
    snap.width = canvasWidth; snap.height = canvasHeight;
    snap.getContext('2d').drawImage(layer.canvas, 0, 0);
    HistoryManager.push({ layerIndex: activeLayerIndex, snapshot: snap });
  }

  function restoreSnapshot(layerIndex, snapshotCanvas) {
    const layer = layers[layerIndex];
    if (!layer) return;
    layer.ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    layer.ctx.drawImage(snapshotCanvas, 0, 0);
    renderLayerList();
  }

  function getFlattenedCanvas() {
    const flat = document.createElement('canvas');
    flat.width = canvasWidth; flat.height = canvasHeight;
    const fc = flat.getContext('2d');
    layers.forEach(l => {
      if (!l.visible) return;
      fc.save();
      fc.globalAlpha = l.opacity / 100;
      fc.globalCompositeOperation = l.blendMode;
      fc.drawImage(l.canvas, 0, 0);
      fc.restore();
    });
    return flat;
  }

  function onChange(cb) { onChangeCallback = cb; }

  return {
    init, addLayer, removeLayer, duplicateLayer,
    mergeDown, flattenAll, moveLayer,
    getActiveLayer, getLayers, getCount,
    setActiveLayer, setOpacity, setBlendMode,
    setVisibility, setLocked, renameLayer,
    renderLayerList, clearActive, pushHistory,
    restoreSnapshot, getFlattenedCanvas, setSize,
    get activeIndex() { return activeLayerIndex; },
    onChange
  };
})();

/* ── History Manager ── */
const HistoryManager = (() => {
  const MAX = 50;
  let undoStack = [];
  let redoStack = [];

  function push(state) {
    undoStack.push(state);
    if (undoStack.length > MAX) undoStack.shift();
    redoStack = [];
  }

  function undo() {
    if (!undoStack.length) { showToast('Nothing to undo'); return; }
    const state = undoStack.pop();
    // Save current state to redo
    const layer = LayerManager.getLayers()[state.layerIndex];
    if (!layer) return;
    const redoSnap = document.createElement('canvas');
    redoSnap.width = layer.canvas.width; redoSnap.height = layer.canvas.height;
    redoSnap.getContext('2d').drawImage(layer.canvas, 0, 0);
    redoStack.push({ layerIndex: state.layerIndex, snapshot: redoSnap });
    LayerManager.restoreSnapshot(state.layerIndex, state.snapshot);
    showToast('Undo');
  }

  function redo() {
    if (!redoStack.length) { showToast('Nothing to redo'); return; }
    const state = redoStack.pop();
    const layer = LayerManager.getLayers()[state.layerIndex];
    if (!layer) return;
    const undoSnap = document.createElement('canvas');
    undoSnap.width = layer.canvas.width; undoSnap.height = layer.canvas.height;
    undoSnap.getContext('2d').drawImage(layer.canvas, 0, 0);
    undoStack.push({ layerIndex: state.layerIndex, snapshot: undoSnap });
    LayerManager.restoreSnapshot(state.layerIndex, state.snapshot);
    showToast('Redo');
  }

  function clear() { undoStack = []; redoStack = []; }

  return { push, undo, redo, clear };
})();
