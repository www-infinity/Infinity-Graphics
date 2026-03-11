/**
 * app.js — Main application coordinator for Infinity Graphics
 */

/* global LayerManager, HistoryManager, Canvas2D, WebGLRenderer, SVGEditor, Effects, AIAssistant, ExportManager */

const App = (() => {
  // Current state
  let mode        = '2d'; // '2d' | 'svg' | '3d'
  let fgColor     = '#000000';
  let bgColor     = '#ffffff';
  let canvasWidth  = 800;
  let canvasHeight = 600;

  // Active filter for modal
  let pendingFilter = null;

  // Colour panel state
  let colorTarget = 'fg'; // 'fg' | 'bg'

  /* ── Bootstrap ── */
  function init() {
    // Init layer manager
    LayerManager.init(
      document.getElementById('canvas-container'),
      document.getElementById('layers-list'),
      canvasWidth, canvasHeight
    );

    // Size grid / temp canvases
    document.getElementById('canvas-grid').width  = canvasWidth;
    document.getElementById('canvas-grid').height = canvasHeight;
    document.getElementById('canvas-temp').width  = canvasWidth;
    document.getElementById('canvas-temp').height = canvasHeight;

    // Set container dimensions (CSS handles stacking)
    const container = document.getElementById('canvas-container');
    container.style.width  = canvasWidth  + 'px';
    container.style.height = canvasHeight + 'px';

    // SVG overlay
    const svgOverlay = document.getElementById('svg-overlay');
    svgOverlay.setAttribute('width',   canvasWidth);
    svgOverlay.setAttribute('height',  canvasHeight);
    SVGEditor.init(svgOverlay, canvasWidth, canvasHeight);

    // Init 2D engine
    Canvas2D.init({ onColorPick: setFgColor });

    // Init WebGL
    WebGLRenderer.init();

    // Init AI panel
    AIAssistant.init(document.getElementById('ai-chat-log'));

    // Draw color UI
    drawColorWheel();
    drawLightnessSlider();
    drawAlphaSlider();
    populateSwatches();
    drawGradientPreview();

    // Status
    document.getElementById('status-size').textContent = `Canvas: ${canvasWidth} × ${canvasHeight}`;

    bindEvents();

    // Init zoom and center
    requestAnimationFrame(() => {
      Canvas2D.setSize(canvasWidth, canvasHeight);
      Canvas2D.zoomFit();
    });

    showToast('Infinity Graphics ready ∞');
  }

  /* ── Event Binding ── */
  function bindEvents() {
    // Mobile menu toggle for Android/mobile
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    if (mobileMenuToggle) {
      mobileMenuToggle.addEventListener('click', () => {
        const toolbar = document.getElementById('toolbar');
        if (toolbar) {
          toolbar.classList.toggle('mobile-hidden');
        }
      });
    }

    // Tool buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tool = btn.dataset.tool;
        Canvas2D.setTool(tool);
        SVGEditor.setTool(tool);
        updateToolOptions(tool);
        updateStatusMode();
        document.getElementById('current-tool-name').textContent = btn.title.replace(/ \(.*\)/, '');
      });
    });

    // Mode tabs
    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        setMode(tab.dataset.mode);
      });
    });

    // Panel tabs
    document.querySelectorAll('.panel-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('panel-' + tab.dataset.panel).classList.add('active');
      });
    });

    // Color wells
    document.getElementById('fg-color-well').addEventListener('click', () => {
      colorTarget = 'fg';
      openColorPanel();
    });
    document.getElementById('bg-color-well').addEventListener('click', () => {
      colorTarget = 'bg';
      openColorPanel();
    });
    document.getElementById('swap-colors').addEventListener('click', () => {
      [fgColor, bgColor] = [bgColor, fgColor];
      updateColorWells();
      broadcastColors();
    });
    document.getElementById('reset-colors').addEventListener('click', () => {
      fgColor = '#000000'; bgColor = '#ffffff';
      updateColorWells();
      broadcastColors();
    });

    // Properties panel
    const sizeSlider    = document.getElementById('prop-size');
    const opacitySlider = document.getElementById('prop-opacity');
    const hardnessSlider = document.getElementById('prop-hardness');
    const blendSel      = document.getElementById('prop-blend');
    const fillChk       = document.getElementById('prop-fill');
    const strokeChk     = document.getElementById('prop-stroke');
    const strokeWEl     = document.getElementById('prop-stroke-width');
    const sidesEl       = document.getElementById('prop-sides');
    const fontSel       = document.getElementById('prop-font');
    const fontSizeEl    = document.getElementById('prop-font-size');
    const boldChk       = document.getElementById('prop-bold');
    const italicChk     = document.getElementById('prop-italic');
    const gradStart     = document.getElementById('prop-grad-start');
    const gradEnd       = document.getElementById('prop-grad-end');
    const gradType      = document.getElementById('prop-grad-type');

    sizeSlider.addEventListener('input', () => {
      document.getElementById('prop-size-val').textContent = sizeSlider.value;
      Canvas2D.setBrushSize(+sizeSlider.value);
    });
    opacitySlider.addEventListener('input', () => {
      document.getElementById('prop-opacity-val').textContent = opacitySlider.value + '%';
      Canvas2D.setBrushOpacity(opacitySlider.value / 100);
      SVGEditor.setOpacity(opacitySlider.value / 100);
    });
    hardnessSlider.addEventListener('input', () => {
      document.getElementById('prop-hardness-val').textContent = hardnessSlider.value + '%';
      Canvas2D.setBrushHardness(hardnessSlider.value / 100);
    });
    blendSel.addEventListener('change', () => {
      Canvas2D.setBlendMode(blendSel.value);
    });
    fillChk.addEventListener('change', () => { Canvas2D.setFill(fillChk.checked); SVGEditor.setFill(fillChk.checked); });
    strokeChk.addEventListener('change', () => { Canvas2D.setStroke(strokeChk.checked); SVGEditor.setStroke(strokeChk.checked); });
    strokeWEl.addEventListener('change', () => { Canvas2D.setStrokeWidth(+strokeWEl.value); SVGEditor.setStrokeWidth(+strokeWEl.value); });
    sidesEl.addEventListener('change', () => Canvas2D.setPolygonSides(+sidesEl.value));
    fontSel.addEventListener('change', () => Canvas2D.setFont(fontSel.value));
    fontSizeEl.addEventListener('change', () => Canvas2D.setFontSize(+fontSizeEl.value));
    boldChk.addEventListener('change', () => Canvas2D.setFontBold(boldChk.checked));
    italicChk.addEventListener('change', () => Canvas2D.setFontItalic(italicChk.checked));
    gradStart.addEventListener('input', () => {
      Canvas2D.setGradStartColor(gradStart.value);
      drawGradientPreview();
    });
    gradEnd.addEventListener('input', () => {
      Canvas2D.setGradEndColor(gradEnd.value);
      drawGradientPreview();
    });
    gradType.addEventListener('change', () => Canvas2D.setGradType(gradType.value));

    // Layers
    document.getElementById('btn-add-layer').addEventListener('click', () => LayerManager.addLayer());
    document.getElementById('btn-delete-layer').addEventListener('click', () => LayerManager.removeLayer(LayerManager.activeIndex));
    document.getElementById('btn-duplicate-layer').addEventListener('click', () => LayerManager.duplicateLayer(LayerManager.activeIndex));

    // Zoom
    document.getElementById('zoom-in-btn').addEventListener('click',  () => { Canvas2D.zoomIn(); });
    document.getElementById('zoom-out-btn').addEventListener('click', () => { Canvas2D.zoomOut(); });

    // Menu items
    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', e => { e.stopPropagation(); openMenu(item.dataset.menu); });
    });
    document.addEventListener('click', closeAllMenus);

    // Dropdown actions
    document.querySelectorAll('.dropdown-item[data-action]').forEach(el => {
      el.addEventListener('click', e => { e.stopPropagation(); handleAction(el.dataset.action); closeAllMenus(); });
    });
    document.querySelectorAll('.dropdown-item[data-mode]').forEach(el => {
      el.addEventListener('click', e => { e.stopPropagation(); setMode(el.dataset.mode); closeAllMenus(); });
    });
    document.querySelectorAll('.dropdown-item[data-filter]').forEach(el => {
      el.addEventListener('click', e => { e.stopPropagation(); openFilterModal(el.dataset.filter); closeAllMenus(); });
    });

    // Menu items for new/open/export
    document.getElementById('menu-new-doc').addEventListener('click', () => { openModal('modal-new-doc'); closeAllMenus(); });
    document.getElementById('menu-open').addEventListener('click',    () => { document.getElementById('open-file-input').click(); closeAllMenus(); });
    document.getElementById('menu-save-png').addEventListener('click', () => { ExportManager.exportAs('png', 1, 'infinity-design'); closeAllMenus(); });
    document.getElementById('menu-save-jpg').addEventListener('click', () => { ExportManager.exportAs('jpeg', 0.92, 'infinity-design'); closeAllMenus(); });
    document.getElementById('menu-save-svg').addEventListener('click', () => { ExportManager.exportAs('svg', 1, 'infinity-design'); closeAllMenus(); });
    document.getElementById('menu-save-webp').addEventListener('click', () => { ExportManager.exportAs('webp', 0.9, 'infinity-design'); closeAllMenus(); });

    // AI menu items
    document.querySelectorAll('.dropdown-item[data-action^="ai-"]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        if (el.dataset.action === 'toggle-ai-panel') { switchPanel('ai'); }
        else { AIAssistant.handleAction(el.dataset.action); switchPanel('ai'); }
        closeAllMenus();
      });
    });

    // Header buttons
    document.getElementById('btn-undo').addEventListener('click', () => HistoryManager.undo());
    document.getElementById('btn-redo').addEventListener('click', () => HistoryManager.redo());
    document.getElementById('btn-export').addEventListener('click', () => openModal('modal-export'));
    document.getElementById('btn-new').addEventListener('click',   () => openModal('modal-new-doc'));

    // New doc modal
    document.getElementById('new-preset').addEventListener('change', e => {
      const val = e.target.value;
      if (!val) return;
      const presets = {
        '800x600':    [800, 600],
        '1920x1080':  [1920, 1080],
        '1280x720':   [1280, 720],
        '3840x2160':  [3840, 2160],
        '1080x1080':  [1080, 1080],
        '1200x628':   [1200, 628],
        '1500x500':   [1500, 500],
        '210x297':    [794, 1123],
      };
      if (presets[val]) {
        document.getElementById('new-width').value  = presets[val][0];
        document.getElementById('new-height').value = presets[val][1];
      }
    });
    document.getElementById('btn-create-doc').addEventListener('click', () => {
      const w = parseInt(document.getElementById('new-width').value, 10);
      const h = parseInt(document.getElementById('new-height').value, 10);
      const bg = document.getElementById('new-background').value;
      if (!w || !h || w < 1 || h < 1) { showToast('Invalid dimensions'); return; }
      createNewDocument(w, h, bg);
      closeModal('modal-new-doc');
    });

    // Export modal
    document.getElementById('export-quality').addEventListener('input', e => {
      document.getElementById('export-quality-val').textContent = Math.round(e.target.value * 100) + '%';
    });
    document.getElementById('export-format').addEventListener('change', e => {
      document.getElementById('export-quality-row').style.display = e.target.value === 'png' ? 'none' : 'flex';
    });
    document.getElementById('btn-do-export').addEventListener('click', () => {
      const fmt  = document.getElementById('export-format').value;
      const qual = parseFloat(document.getElementById('export-quality').value);
      const name = document.getElementById('export-filename').value;
      ExportManager.exportAs(fmt, qual, name);
      closeModal('modal-export');
    });

    // Filter modal
    document.getElementById('btn-apply-filter').addEventListener('click', applyFilter);

    // Open file
    document.getElementById('open-file-input').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      ExportManager.importImage(file, img => {
        createNewDocument(img.width, img.height, 'transparent');
        requestAnimationFrame(() => {
          const layer = LayerManager.getActiveLayer();
          layer.ctx.drawImage(img, 0, 0);
          LayerManager.renderLayerList();
          Canvas2D.zoomFit();
          showToast(`Opened ${file.name}`);
        });
      });
      e.target.value = '';
    });

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal.visible').forEach(m => m.classList.remove('visible'));
      });
    });
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('visible'); });
    });

    // Color mode tabs
    document.querySelectorAll('.color-mode-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.color-mode-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        ['wheel','rgb','hsl','hex'].forEach(m => {
          document.getElementById('color-' + m + '-container').style.display = m === tab.dataset.colormode ? '' : 'none';
        });
      });
    });

    // Color wheel
    document.getElementById('color-wheel').addEventListener('click', onColorWheelClick);
    document.getElementById('lightness-slider').addEventListener('click', onLightnessClick);
    document.getElementById('color-alpha-bar').addEventListener('click', onAlphaClick);

    // RGB sliders
    ['r','g','b','a'].forEach(ch => {
      const slider = document.getElementById('ch-' + ch);
      const num    = document.getElementById('ch-' + ch + '-num');
      slider.addEventListener('input', () => { num.value = slider.value; rgbChannelChanged(); });
      num.addEventListener('change', () => { slider.value = num.value; rgbChannelChanged(); });
    });

    // HSL sliders
    ['h','s','l'].forEach(ch => {
      const slider = document.getElementById('ch-' + ch);
      const num    = document.getElementById('ch-' + ch + '-num');
      slider.addEventListener('input', () => { num.value = slider.value; hslChannelChanged(); });
      num.addEventListener('change', () => { slider.value = num.value; hslChannelChanged(); });
    });

    // Hex input
    document.getElementById('ch-hex').addEventListener('change', e => {
      const hex = e.target.value.trim();
      if (/^#?[0-9a-f]{6}$/i.test(hex)) {
        setColorTarget(hex.startsWith('#') ? hex : '#' + hex);
      }
    });

    // Gradient preview canvas
    document.getElementById('gradient-preview').addEventListener('click', drawGradientPreview);

    // AI panel
    document.getElementById('ai-send-btn').addEventListener('click', sendAIMessage);
    document.getElementById('ai-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendAIMessage(); });
    document.querySelectorAll('.ai-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        AIAssistant.handleAction(btn.dataset.action);
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', onKeyDown);

    // 3D shape selector (dynamically built below)
  }

  /* ── Mode switching ── */
  function setMode(m) {
    mode = m;
    const area     = document.getElementById('canvas-area');
    const canvas3d = document.getElementById('canvas-3d');
    const viewport = document.getElementById('canvas-viewport');
    const svgEl    = document.getElementById('svg-overlay');

    if (m === '3d') {
      viewport.style.display = 'none';
      canvas3d.style.display = 'block';
      WebGLRenderer.start();
      SVGEditor.deactivate();
      buildGLControls();
    } else {
      viewport.style.display = '';
      canvas3d.style.display = 'none';
      WebGLRenderer.stop();
      if (m === 'svg') { SVGEditor.activate(); }
      else             { SVGEditor.deactivate(); }
    }

    document.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === m));
    document.getElementById('status-mode').textContent = `Mode: ${m === '2d' ? '2D Canvas' : m === 'svg' ? 'SVG Vector' : '3D WebGL'}`;
    showToast(`Switched to ${m === '2d' ? '2D Canvas' : m === 'svg' ? 'SVG Vector' : '3D WebGL'} mode`);
  }

  function buildGLControls() {
    const canvas3d = document.getElementById('canvas-3d');
    if (document.getElementById('gl-controls')) return; // already built
    const panel = document.createElement('div');
    panel.id = 'gl-controls';
    panel.className = 'gl-controls';

    const shapeLabel = document.createElement('label');
    shapeLabel.textContent = '3D Shape';
    shapeLabel.style.cssText = 'color:#aaa;font-size:0.75rem;';

    const shapeSel = document.createElement('select');
    shapeSel.style.cssText = 'background:#1a1a2e;color:#e0e0f0;border:1px solid #444;padding:4px;border-radius:4px;';
    WebGLRenderer.getShapes().forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s.charAt(0).toUpperCase() + s.slice(1);
      shapeSel.appendChild(opt);
    });
    shapeSel.addEventListener('change', () => WebGLRenderer.setShape(shapeSel.value));

    const wireBtn = document.createElement('button');
    wireBtn.textContent = 'Wireframe: OFF';
    wireBtn.style.cssText = 'background:#16213e;color:#a0a0c0;border:1px solid #444;padding:5px 10px;border-radius:4px;cursor:pointer;font-size:0.75rem;';
    let wire = false;
    wireBtn.addEventListener('click', () => {
      wire = !wire;
      WebGLRenderer.setWireframe(wire);
      wireBtn.textContent = `Wireframe: ${wire ? 'ON' : 'OFF'}`;
    });

    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Object Color';
    colorLabel.style.cssText = 'color:#aaa;font-size:0.75rem;';

    const colorInput = document.createElement('input');
    colorInput.type = 'color'; colorInput.value = '#e94560';
    colorInput.style.cssText = 'width:40px;height:28px;border:none;cursor:pointer;';
    colorInput.addEventListener('input', () => {
      const hex = colorInput.value;
      const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
      WebGLRenderer.setObjColor([r, g, b, 1]);
    });

    const hint = document.createElement('div');
    hint.textContent = '🖱 Drag to rotate • Scroll to zoom';
    hint.style.cssText = 'color:#606080;font-size:0.7rem;text-align:center;';

    [shapeLabel, shapeSel, wireBtn, colorLabel, colorInput, hint].forEach(el => panel.appendChild(el));
    canvas3d.parentNode.appendChild(panel);
  }

  /* ── New Document ── */
  function createNewDocument(w, h, bg) {
    canvasWidth = w; canvasHeight = h;

    // Clear existing layers and create fresh
    const container = document.getElementById('canvas-container');
    container.style.width  = w + 'px';
    container.style.height = h + 'px';

    // Remove all existing layer canvases
    const existing = container.querySelectorAll('.canvas-layer:not(#canvas-grid):not(#canvas-temp):not(#svg-overlay)');
    existing.forEach(c => c.parentNode.removeChild(c));

    // Re-init
    LayerManager.init(container, document.getElementById('layers-list'), w, h);
    Canvas2D.setSize(w, h);
    SVGEditor.setSize(w, h);
    SVGEditor.clearAll();
    HistoryManager.clear();

    // Set background
    if (bg !== 'transparent') {
      const layer = LayerManager.getActiveLayer();
      layer.ctx.fillStyle = bg;
      layer.ctx.fillRect(0, 0, w, h);
    }

    document.getElementById('status-size').textContent = `Canvas: ${w} × ${h}`;
    Canvas2D.zoomFit();
    showToast(`New document ${w}×${h}`);
  }

  /* ── Actions ── */
  function handleAction(action) {
    switch (action) {
      case 'undo': HistoryManager.undo(); break;
      case 'redo': HistoryManager.redo(); break;
      case 'select-all': showToast('Select All — draw a selection with the Select tool'); break;
      case 'deselect':   Canvas2D.clearSelection(); showToast('Deselected'); break;
      case 'clear-canvas':
        LayerManager.pushHistory();
        LayerManager.clearActive();
        showToast('Layer cleared');
        break;
      case 'flip-h': {
        const layer = LayerManager.getActiveLayer();
        LayerManager.pushHistory();
        Effects.flip(layer.ctx, canvasWidth, canvasHeight, true);
        LayerManager.renderLayerList();
        break;
      }
      case 'flip-v': {
        const layer = LayerManager.getActiveLayer();
        LayerManager.pushHistory();
        Effects.flip(layer.ctx, canvasWidth, canvasHeight, false);
        LayerManager.renderLayerList();
        break;
      }
      case 'zoom-in':   Canvas2D.zoomIn();  break;
      case 'zoom-out':  Canvas2D.zoomOut(); break;
      case 'zoom-fit':  Canvas2D.zoomFit(); break;
      case 'zoom-100':  Canvas2D.zoom100(); break;
      case 'toggle-grid':    Canvas2D.toggleGrid(); break;
      case 'toggle-rulers':  toggleRulers(); break;
      case 'add-layer':       LayerManager.addLayer(); break;
      case 'duplicate-layer': LayerManager.duplicateLayer(LayerManager.activeIndex); break;
      case 'merge-down':      LayerManager.mergeDown(LayerManager.activeIndex); break;
      case 'flatten':         LayerManager.flattenAll(); break;
      case 'layer-up':        LayerManager.moveLayer(LayerManager.activeIndex, -1); break;
      case 'layer-down':      LayerManager.moveLayer(LayerManager.activeIndex, 1); break;
      case 'shortcuts':  openModal('modal-shortcuts'); break;
      case 'about':      openModal('modal-about'); break;
      case 'ai-palette':
      case 'ai-enhance':
      case 'ai-suggest':
      case 'ai-describe':
        AIAssistant.handleAction(action);
        switchPanel('ai');
        break;
    }
  }

  function toggleRulers() {
    document.getElementById('canvas-area').classList.toggle('rulers-visible');
    const visible = document.getElementById('canvas-area').classList.contains('rulers-visible');
    showToast(visible ? 'Rulers on' : 'Rulers off');
  }

  /* ── Keyboard shortcuts ── */
  function onKeyDown(e) {
    // Don't fire when typing in inputs
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
    if (e.target.contentEditable === 'true') return;

    const key = e.key.toLowerCase();

    if (e.ctrlKey || e.metaKey) {
      switch (key) {
        case 'z': e.preventDefault(); HistoryManager.undo(); return;
        case 'y': e.preventDefault(); HistoryManager.redo(); return;
        case 's': e.preventDefault(); ExportManager.exportAs('png', 1, 'infinity-design'); return;
        case 'a': e.preventDefault(); handleAction('select-all'); return;
        case 'g': e.preventDefault(); Canvas2D.toggleGrid(); return;
        case '=': case '+': e.preventDefault(); Canvas2D.zoomIn(); return;
        case '-': e.preventDefault(); Canvas2D.zoomOut(); return;
        case '0': e.preventDefault(); Canvas2D.zoomFit(); return;
        case '1': e.preventDefault(); Canvas2D.zoom100(); return;
      }
      if (e.shiftKey && key === 'n') { e.preventDefault(); LayerManager.addLayer(); return; }
      return;
    }

    // Tool shortcuts
    const toolMap = { v:'select', m:'move', p:'pencil', b:'brush', e:'eraser', r:'rect', o:'ellipse', l:'line', t:'text', g:'gradient', i:'eyedropper', n:'path', c:'crop' };
    if (toolMap[key]) {
      selectTool(toolMap[key]);
      return;
    }

    switch (key) {
      case 'x':
        [fgColor, bgColor] = [bgColor, fgColor];
        updateColorWells(); broadcastColors();
        break;
      case 'd':
        fgColor = '#000000'; bgColor = '#ffffff';
        updateColorWells(); broadcastColors();
        break;
      case '[':
        Canvas2D.setBrushSize(Math.max(1, +document.getElementById('prop-size').value - 5));
        document.getElementById('prop-size').value = Math.max(1, +document.getElementById('prop-size').value - 5);
        document.getElementById('prop-size-val').textContent = document.getElementById('prop-size').value;
        break;
      case ']':
        Canvas2D.setBrushSize(Math.min(200, +document.getElementById('prop-size').value + 5));
        document.getElementById('prop-size').value = Math.min(200, +document.getElementById('prop-size').value + 5);
        document.getElementById('prop-size-val').textContent = document.getElementById('prop-size').value;
        break;
      case 'escape':
        Canvas2D.clearSelection();
        Canvas2D.commitPath && Canvas2D.commitPath();
        break;
      case 'delete':
        if (mode === 'svg') {
          // handled by SVGEditor
        } else {
          LayerManager.pushHistory();
          LayerManager.clearActive();
          showToast('Layer cleared');
        }
        break;
      case 'enter':
        if (mode === 'svg') SVGEditor.setTool && null; // commit path handled by svg.js
        break;
    }
  }

  function selectTool(tool) {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
    if (btn) btn.classList.add('active');
    Canvas2D.setTool(tool);
    SVGEditor.setTool(tool);
    updateToolOptions(tool);
    const label = btn ? btn.title.replace(/ \(.*\)/, '') : tool;
    document.getElementById('current-tool-name').textContent = label;
  }

  /* ── Tool options bar ── */
  function updateToolOptions(tool) {
    const shapeTools = ['rect','ellipse','line','polygon','star','arrow','path'];
    const polyTools  = ['polygon','star'];
    const textTools  = ['text'];
    const gradTools  = ['gradient'];

    document.getElementById('shape-props').style.display = shapeTools.includes(tool) ? 'flex' : 'none';
    document.getElementById('poly-props').style.display  = polyTools.includes(tool)  ? 'flex' : 'none';
    document.getElementById('text-props').style.display  = textTools.includes(tool)  ? 'flex' : 'none';
    document.getElementById('text-size-props').style.display = textTools.includes(tool) ? 'flex' : 'none';
    document.getElementById('grad-props').style.display  = gradTools.includes(tool)  ? 'flex' : 'none';
  }

  function updateStatusMode() {
    document.getElementById('status-mode').textContent = `Mode: ${mode === '2d' ? '2D Canvas' : mode === 'svg' ? 'SVG Vector' : '3D WebGL'}`;
  }

  /* ── Color management ── */
  function setFgColor(hex) {
    fgColor = hex;
    document.getElementById('fg-color-well').style.background = hex;
    Canvas2D.setFgColor(hex);
    SVGEditor.setFgColor(hex);
    document.getElementById('status-color').textContent = `FG: ${hex}`;
    syncColorPanel(hex);
  }

  function setBgColor(hex) {
    bgColor = hex;
    document.getElementById('bg-color-well').style.background = hex;
    Canvas2D.setBgColor(hex);
    SVGEditor.setBgColor(hex);
  }

  function setColorTarget(hex) {
    if (colorTarget === 'fg') setFgColor(hex);
    else setBgColor(hex);
    updateColorPreview();
  }

  function updateColorWells() {
    document.getElementById('fg-color-well').style.background = fgColor;
    document.getElementById('bg-color-well').style.background = bgColor;
  }

  function broadcastColors() {
    Canvas2D.setFgColor(fgColor);
    Canvas2D.setBgColor(bgColor);
    SVGEditor.setFgColor(fgColor);
    SVGEditor.setBgColor(bgColor);
    document.getElementById('status-color').textContent = `FG: ${fgColor}`;
  }

  function openColorPanel() {
    switchPanel('colors');
    const current = colorTarget === 'fg' ? fgColor : bgColor;
    syncColorPanel(current);
  }

  function syncColorPanel(hex) {
    document.getElementById('ch-hex').value = hex;
    const [r, g, b] = hexToRgb(hex);
    ['r','g','b'].forEach((ch, i) => {
      const v = [r, g, b][i];
      document.getElementById('ch-' + ch).value = v;
      document.getElementById('ch-' + ch + '-num').value = v;
    });
    const [h, s, l] = Effects.rgbToHsl(r, g, b);
    document.getElementById('ch-h').value = document.getElementById('ch-h-num').value = Math.round(h * 360);
    document.getElementById('ch-s').value = document.getElementById('ch-s-num').value = Math.round(s * 100);
    document.getElementById('ch-l').value = document.getElementById('ch-l-num').value = Math.round(l * 100);
    updateColorPreview();
  }

  function updateColorPreview() {
    const current = colorTarget === 'fg' ? fgColor : bgColor;
    document.getElementById('new-color-preview').style.background = current;
    const other   = colorTarget === 'fg' ? bgColor : fgColor;
    document.getElementById('old-color-preview').style.background = other;
  }

  function rgbChannelChanged() {
    const r = +document.getElementById('ch-r').value;
    const g = +document.getElementById('ch-g').value;
    const b = +document.getElementById('ch-b').value;
    const hex = rgbToHex(r, g, b);
    document.getElementById('ch-hex').value = hex;
    setColorTarget(hex);
    const [h, s, l] = Effects.rgbToHsl(r, g, b);
    document.getElementById('ch-h').value = Math.round(h * 360);
    document.getElementById('ch-s').value = Math.round(s * 100);
    document.getElementById('ch-l').value = Math.round(l * 100);
    document.getElementById('ch-h-num').value = document.getElementById('ch-h').value;
    document.getElementById('ch-s-num').value = document.getElementById('ch-s').value;
    document.getElementById('ch-l-num').value = document.getElementById('ch-l').value;
  }

  function hslChannelChanged() {
    const h = +document.getElementById('ch-h').value / 360;
    const s = +document.getElementById('ch-s').value / 100;
    const l = +document.getElementById('ch-l').value / 100;
    const [r, g, b] = Effects.hslToRgb(h, s, l);
    const hex = rgbToHex(r, g, b);
    document.getElementById('ch-hex').value = hex;
    setColorTarget(hex);
    ['r','g','b'].forEach((ch, i) => {
      const v = [r, g, b][i];
      document.getElementById('ch-' + ch).value = v;
      document.getElementById('ch-' + ch + '-num').value = v;
    });
  }

  /* ── Color Wheel ── */
  function drawColorWheel() {
    const canvas = document.getElementById('color-wheel');
    const ctx    = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2, r = Math.min(cx, cy) - 2;

    ctx.clearRect(0, 0, w, h);
    for (let deg = 0; deg < 360; deg += 1) {
      const start = (deg - 1) * Math.PI / 180;
      const end   = (deg + 1) * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      gradient.addColorStop(0,   `hsl(${deg}, 0%, 100%)`);
      gradient.addColorStop(0.5, `hsl(${deg}, 100%, 50%)`);
      gradient.addColorStop(1,   `hsl(${deg}, 100%, 20%)`);
      ctx.fillStyle = gradient;
      ctx.fill();
    }
    // Center white dot
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  function onColorWheelClick(e) {
    const canvas = document.getElementById('color-wheel');
    const rect   = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    const px  = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    const hex = rgbToHex(px[0], px[1], px[2]);
    setColorTarget(hex);
    syncColorPanel(hex);
    drawLightnessSlider();
  }

  function drawLightnessSlider() {
    const canvas = document.getElementById('lightness-slider');
    const ctx    = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const hex = colorTarget === 'fg' ? fgColor : bgColor;
    const [hue] = Effects.rgbToHsl(...hexToRgb(hex));
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0,   `hsl(${hue * 360}, 100%, 0%)`);
    grad.addColorStop(0.5, `hsl(${hue * 360}, 100%, 50%)`);
    grad.addColorStop(1,   `hsl(${hue * 360}, 100%, 100%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  function onLightnessClick(e) {
    const canvas = document.getElementById('lightness-slider');
    const rect   = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ctx = canvas.getContext('2d');
    const px  = ctx.getImageData(Math.round(x), 10, 1, 1).data;
    const hex = rgbToHex(px[0], px[1], px[2]);
    setColorTarget(hex);
    syncColorPanel(hex);
  }

  function drawAlphaSlider() {
    const canvas = document.getElementById('color-alpha-bar');
    const ctx    = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    // Checkerboard
    for (let x = 0; x < w; x += 10) {
      for (let row = 0; row < 2; row++) {
        ctx.fillStyle = ((x / 10 + row) % 2 === 0) ? '#aaa' : '#eee';
        ctx.fillRect(x, row * h / 2, 10, h / 2);
      }
    }
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, fgColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  function onAlphaClick(e) {
    const canvas = document.getElementById('color-alpha-bar');
    const rect   = canvas.getBoundingClientRect();
    const alpha  = Math.round(255 * (e.clientX - rect.left) / canvas.width);
    document.getElementById('ch-a').value = alpha;
    document.getElementById('ch-a-num').value = alpha;
    Canvas2D.setBrushOpacity(alpha / 255);
    SVGEditor.setOpacity(alpha / 255);
  }

  /* ── Swatches ── */
  function populateSwatches() {
    const el = document.getElementById('color-swatches');
    const colors = [
      '#000000','#ffffff','#808080','#c0c0c0',
      '#e94560','#ff8c00','#ffd700','#00c853',
      '#00bcd4','#2196f3','#9c27b0','#795548',
      '#ff5252','#ffab40','#ffff00','#69f0ae',
      '#40c4ff','#448aff','#e040fb','#a1887f',
    ];
    colors.forEach(c => {
      const swatch = document.createElement('div');
      swatch.className = 'swatch';
      swatch.style.background = c;
      swatch.title = c;
      swatch.addEventListener('click', () => {
        setColorTarget(c);
        syncColorPanel(c);
      });
      el.appendChild(swatch);
    });
  }

  /* ── Gradient preview ── */
  function drawGradientPreview() {
    const canvas = document.getElementById('gradient-preview');
    const ctx    = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const start = document.getElementById('prop-grad-start').value;
    const end   = document.getElementById('prop-grad-end').value;
    const grad  = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, start);
    grad.addColorStop(1, end);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  /* ── Filter modal ── */
  function openFilterModal(filterName) {
    pendingFilter = filterName;
    const titleEl    = document.getElementById('filter-modal-title');
    const controlsEl = document.getElementById('filter-controls');
    const previewEl  = document.getElementById('filter-preview-canvas');

    controlsEl.innerHTML = '';
    titleEl.textContent  = filterName.charAt(0).toUpperCase() + filterName.slice(1).replace(/-/g, ' ');

    const presets = {
      blur:       [{ label: 'Sigma', id: 'f-sigma', min: 0.5, max: 20, step: 0.5, value: 3 }],
      sharpen:    [{ label: 'Amount', id: 'f-amount', min: 0.1, max: 3, step: 0.1, value: 1 }],
      brightness: [
        { label: 'Brightness', id: 'f-brightness', min: -100, max: 100, step: 1, value: 0 },
        { label: 'Contrast',   id: 'f-contrast',   min: -100, max: 100, step: 1, value: 0 },
      ],
      hue: [
        { label: 'Hue Shift',   id: 'f-hue',        min: -180, max: 180, step: 1, value: 0 },
        { label: 'Saturation',  id: 'f-saturation',  min: 0,   max: 3,   step: 0.1, value: 1 },
        { label: 'Lightness',   id: 'f-lightness',   min: -50, max: 50,  step: 1, value: 0 },
      ],
      pixelate:   [{ label: 'Size', id: 'f-size', min: 2, max: 80, step: 1, value: 10 }],
      noise:      [{ label: 'Amount', id: 'f-amount', min: 1, max: 150, step: 1, value: 30 }],
      vignette:   [{ label: 'Amount', id: 'f-amount', min: 0, max: 1, step: 0.05, value: 0.5 }],
      sepia:      [{ label: 'Amount', id: 'f-amount', min: 0, max: 1, step: 0.05, value: 1 }],
    };

    const controls = presets[filterName] || [];
    controls.forEach(c => {
      const row = document.createElement('div');
      row.className = 'filter-row';
      const label = document.createElement('label');
      label.textContent = c.label;
      const slider = document.createElement('input');
      slider.type = 'range'; slider.id = c.id; slider.min = c.min; slider.max = c.max; slider.step = c.step; slider.value = c.value;
      const val = document.createElement('span');
      val.textContent = c.value;
      slider.addEventListener('input', () => { val.textContent = slider.value; updateFilterPreview(filterName); });
      row.appendChild(label); row.appendChild(slider); row.appendChild(val);
      controlsEl.appendChild(row);
    });

    updateFilterPreview(filterName);
    openModal('modal-filter');
  }

  function getFilterParams() {
    const params = {};
    ['f-sigma','f-amount','f-size','f-brightness','f-contrast','f-hue','f-saturation','f-lightness'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const key = id.replace('f-', '');
        params[key] = +el.value;
      }
    });
    return params;
  }

  function updateFilterPreview(filterName) {
    const previewCanvas = document.getElementById('filter-preview-canvas');
    const previewCtx    = previewCanvas.getContext('2d');
    const layer         = LayerManager.getActiveLayer();
    const w = previewCanvas.width, h = previewCanvas.height;
    previewCtx.clearRect(0, 0, w, h);
    previewCtx.drawImage(layer.canvas, 0, 0, w, h);
    const params = getFilterParams();
    if (!['invert','grayscale','sepia','emboss','edge'].includes(filterName)) {
      if (!Object.keys(params).length && filterName !== 'vignette') return;
    }
    Effects.applyToCanvas(previewCtx, filterName, params);
  }

  function applyFilter() {
    if (!pendingFilter) return;
    const layer = LayerManager.getActiveLayer();
    if (layer.locked) { showToast('Layer is locked'); return; }
    LayerManager.pushHistory();
    const params = getFilterParams();
    Effects.applyToCanvas(layer.ctx, pendingFilter, params);
    LayerManager.renderLayerList();
    closeModal('modal-filter');
    showToast(`Filter applied: ${pendingFilter}`);
  }

  /* ── AI ── */
  function sendAIMessage() {
    const input = document.getElementById('ai-input');
    const text  = input.value.trim();
    if (!text) return;
    AIAssistant.handleChat(text);
    input.value = '';
  }

  /* ── Modals ── */
  function openModal(id) {
    document.getElementById(id).classList.add('visible');
  }
  function closeModal(id) {
    document.getElementById(id).classList.remove('visible');
  }
  function openMenu(menuName) {
    closeAllMenus();
    const dropdown = document.getElementById('menu-' + menuName);
    if (!dropdown) return;
    const trigger = document.querySelector(`.menu-item[data-menu="${menuName}"]`);
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    dropdown.style.top  = rect.bottom + 'px';
    dropdown.style.left = rect.left   + 'px';
    dropdown.classList.add('visible');
    trigger.classList.add('active');
  }
  function closeAllMenus() {
    document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('visible'));
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
  }

  function switchPanel(name) {
    document.querySelectorAll('.panel-tab').forEach(t => t.classList.toggle('active', t.dataset.panel === name));
    document.querySelectorAll('.panel-content').forEach(c => c.classList.toggle('active', c.id === 'panel-' + name));
  }

  /* ── Color utilities ── */
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [parseInt(result[1],16), parseInt(result[2],16), parseInt(result[3],16)] : [0,0,0];
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  }

  return { init, setFgColor, setBgColor, setMode };
})();

/* ── Toast helper (global) ── */
function showToast(msg, duration = 2000) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('visible'), duration);
}

/* ── Start the app ── */
document.addEventListener('DOMContentLoaded', () => App.init());
