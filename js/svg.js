/**
 * svg.js — SVG Vector editing mode for Infinity Graphics
 */

const SVGEditor = (() => {
  let svg = null;
  let isActive = false;
  let shapes = [];
  let selectedShape = null;
  let currentTool = 'select';
  let fgColor = '#000000';
  let bgColor = '#ffffff';
  let strokeWidth = 2;
  let fillEnabled = true;
  let strokeEnabled = true;
  let brushOpacity = 1;

  // Interaction state
  let isDrawing = false;
  let startX = 0, startY = 0;
  let isDragging = false;
  let dragOffX = 0, dragOffY = 0;
  let pathPoints = [];
  let tempEl = null;
  let svgWidth = 800, svgHeight = 600;

  function init(svgEl, w, h) {
    svg = svgEl;
    svgWidth = w; svgHeight = h;
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }

  function setSize(w, h) {
    svgWidth = w; svgHeight = h;
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }

  function activate() {
    isActive = true;
    svg.classList.add('interactive');
    svg.style.pointerEvents = 'all';
    svg.addEventListener('mousedown',  onMouseDown);
    svg.addEventListener('mousemove',  onMouseMove);
    svg.addEventListener('mouseup',    onMouseUp);
    svg.addEventListener('dblclick',   onDblClick);
    svg.addEventListener('keydown',    onKeyDown);
    svg.tabIndex = 0;
  }

  function deactivate() {
    isActive = false;
    svg.classList.remove('interactive');
    svg.style.pointerEvents = 'none';
    svg.removeEventListener('mousedown',  onMouseDown);
    svg.removeEventListener('mousemove',  onMouseMove);
    svg.removeEventListener('mouseup',    onMouseUp);
    svg.removeEventListener('dblclick',   onDblClick);
    svg.removeEventListener('keydown',    onKeyDown);
    deselectAll();
  }

  /* ── Event handlers ── */
  function onMouseDown(e) {
    const pos = getSVGPos(e);
    startX = pos.x; startY = pos.y;

    if (currentTool === 'select') {
      const target = e.target;
      if (target !== svg) {
        const shape = shapes.find(s => s.el === target || s.el.contains(target));
        if (shape) { selectShape(shape); isDragging = true; dragOffX = pos.x - +shape.el.getAttribute('x')||0; dragOffY = pos.y - +shape.el.getAttribute('y')||0; }
        else deselectAll();
      } else {
        deselectAll();
      }
      return;
    }

    if (currentTool === 'path') {
      pathPoints.push({ x: pos.x, y: pos.y });
      updatePathPreview();
      return;
    }

    isDrawing = true;
    tempEl = createTempElement(pos.x, pos.y);
    if (tempEl) svg.appendChild(tempEl);
  }

  function onMouseMove(e) {
    const pos = getSVGPos(e);

    if (isDragging && selectedShape) {
      moveShape(selectedShape, pos.x - dragOffX, pos.y - dragOffY);
      return;
    }
    if (!isDrawing || !tempEl) return;
    updateTempElement(tempEl, startX, startY, pos.x, pos.y);
  }

  function onMouseUp(e) {
    isDragging = false;
    if (!isDrawing) return;
    isDrawing = false;

    const pos = getSVGPos(e);
    if (tempEl) {
      updateTempElement(tempEl, startX, startY, pos.x, pos.y);
      const shapeData = { el: tempEl, type: currentTool };
      shapes.push(shapeData);
      makeDraggable(shapeData);
      selectShape(shapeData);
      tempEl = null;
    }
  }

  function onDblClick(e) {
    if (currentTool === 'path' && pathPoints.length >= 2) {
      commitPath();
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedShape) { deleteShape(selectedShape); e.preventDefault(); }
    }
    if (e.key === 'Escape') {
      if (pathPoints.length > 0) { pathPoints = []; if (tempEl) { svg.removeChild(tempEl); tempEl = null; } }
      deselectAll();
    }
  }

  /* ── Element creation ── */
  function createTempElement(x, y) {
    const attr = buildStyleAttrs();
    switch (currentTool) {
      case 'rect': {
        const el = svgEl('rect', { x, y, width: 0, height: 0, ...attr });
        return el;
      }
      case 'ellipse': {
        const el = svgEl('ellipse', { cx: x, cy: y, rx: 0, ry: 0, ...attr });
        return el;
      }
      case 'line': {
        const el = svgEl('line', { x1: x, y1: y, x2: x, y2: y, stroke: fgColor, 'stroke-width': strokeWidth, fill: 'none', opacity: brushOpacity });
        return el;
      }
      case 'polygon':
      case 'star': {
        const el = svgEl('polygon', { points: `${x},${y}`, ...attr });
        return el;
      }
      case 'text': {
        const el = svgEl('text', { x, y, fill: fgColor, 'font-size': 24, 'font-family': 'Arial', opacity: brushOpacity });
        el.textContent = 'Text';
        return el;
      }
    }
    return null;
  }

  function updateTempElement(el, x1, y1, x2, y2) {
    const w = x2 - x1, h = y2 - y1;
    switch (el.tagName) {
      case 'rect':
        if (w < 0) { el.setAttribute('x', x2); el.setAttribute('width', -w); }
        else { el.setAttribute('x', x1); el.setAttribute('width', w); }
        if (h < 0) { el.setAttribute('y', y2); el.setAttribute('height', -h); }
        else { el.setAttribute('y', y1); el.setAttribute('height', h); }
        break;
      case 'ellipse':
        el.setAttribute('cx', x1 + w / 2);
        el.setAttribute('cy', y1 + h / 2);
        el.setAttribute('rx', Math.abs(w / 2));
        el.setAttribute('ry', Math.abs(h / 2));
        break;
      case 'line':
        el.setAttribute('x2', x2); el.setAttribute('y2', y2);
        break;
      case 'polygon': {
        const cx = x1 + w/2, cy = y1 + h/2;
        const r = Math.min(Math.abs(w), Math.abs(h)) / 2;
        const sides = currentTool === 'star' ? 10 : 5;
        const pts = buildPolyPoints(cx, cy, r, currentTool === 'star' ? r/2 : null, sides);
        el.setAttribute('points', pts);
        break;
      }
    }
  }

  function buildPolyPoints(cx, cy, r, innerR, sides) {
    const pts = [];
    const total = innerR ? sides * 2 : sides;
    for (let i = 0; i < total; i++) {
      const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
      const radius = (innerR && i % 2 === 1) ? innerR : r;
      pts.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
    }
    return pts.join(' ');
  }

  /* ── Path tool ── */
  function updatePathPreview() {
    if (tempEl && tempEl.tagName === 'polyline') svg.removeChild(tempEl);
    if (pathPoints.length < 1) return;
    const pts = pathPoints.map(p => `${p.x},${p.y}`).join(' ');
    tempEl = svgEl('polyline', {
      points: pts,
      stroke: fgColor,
      'stroke-width': strokeWidth,
      fill: 'none',
      'stroke-dasharray': '5,3',
      opacity: brushOpacity
    });
    svg.appendChild(tempEl);
  }

  function commitPath() {
    if (pathPoints.length < 2) { pathPoints = []; return; }
    if (tempEl) svg.removeChild(tempEl);
    const pts = pathPoints.map(p => `${p.x},${p.y}`).join(' ');
    const attr = buildStyleAttrs();
    const el = svgEl('polygon', { points: pts, ...attr });
    svg.appendChild(el);
    const shapeData = { el, type: 'path' };
    shapes.push(shapeData);
    makeDraggable(shapeData);
    selectShape(shapeData);
    pathPoints = [];
    tempEl = null;
  }

  /* ── Selection ── */
  function selectShape(shape) {
    deselectAll();
    selectedShape = shape;
    shape.el.style.outline = '2px dashed var(--accent, #e94560)';
    shape.el.classList.add('svg-shape-selected');
  }

  function deselectAll() {
    shapes.forEach(s => {
      s.el.style.outline = '';
      s.el.classList.remove('svg-shape-selected');
    });
    selectedShape = null;
  }

  function deleteShape(shape) {
    if (shape.el.parentNode) shape.el.parentNode.removeChild(shape.el);
    shapes = shapes.filter(s => s !== shape);
    if (selectedShape === shape) selectedShape = null;
  }

  /* ── Move ── */
  function moveShape(shape, nx, ny) {
    const el = shape.el;
    switch (el.tagName) {
      case 'rect':  el.setAttribute('x', nx); el.setAttribute('y', ny); break;
      case 'ellipse': el.setAttribute('cx', nx + +el.getAttribute('rx')); el.setAttribute('cy', ny + +el.getAttribute('ry')); break;
      case 'line': {
        const dx = nx - +el.getAttribute('x1'); const dy = ny - +el.getAttribute('y1');
        el.setAttribute('x1', nx); el.setAttribute('y1', ny);
        el.setAttribute('x2', +el.getAttribute('x2') + dx); el.setAttribute('y2', +el.getAttribute('y2') + dy);
        break;
      }
      case 'text': el.setAttribute('x', nx); el.setAttribute('y', ny); break;
      default: {
        // Move polygon by translating all points
        const pts = el.getAttribute('points').split(' ').map(p => {
          const [px, py] = p.split(',').map(Number);
          return `${px + (nx - dragOffX)},${py + (ny - dragOffY)}`;
        });
        el.setAttribute('points', pts.join(' '));
        dragOffX = nx; dragOffY = ny;
      }
    }
  }

  function makeDraggable(shape) {
    shape.el.style.cursor = 'move';
    shape.el.addEventListener('mousedown', e => {
      e.stopPropagation();
      if (currentTool !== 'select') return;
      selectShape(shape);
      isDragging = true;
      const pos = getSVGPos(e);
      dragOffX = pos.x; dragOffY = pos.y;
    });
  }

  /* ── Style helpers ── */
  function buildStyleAttrs() {
    return {
      fill:   fillEnabled   ? bgColor    : 'none',
      stroke: strokeEnabled ? fgColor    : 'none',
      'stroke-width': strokeWidth,
      opacity: brushOpacity
    };
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  /* ── Coordinate conversion ── */
  function getSVGPos(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: svgP.x, y: svgP.y };
  }

  /* ── Export SVG ── */
  function getSVGString() {
    const clone = svg.cloneNode(true);
    // Remove interaction artifacts
    clone.querySelectorAll('.svg-shape-selected').forEach(el => el.classList.remove('svg-shape-selected'));
    return new XMLSerializer().serializeToString(clone);
  }

  function clearAll() {
    shapes.forEach(s => { if (s.el.parentNode) s.el.parentNode.removeChild(s.el); });
    shapes = [];
    selectedShape = null;
  }

  /* ── Setters ── */
  function setTool(t)   { currentTool = t; }
  function setFgColor(c) { fgColor = c; }
  function setBgColor(c) { bgColor = c; }
  function setStrokeWidth(v) { strokeWidth = v; }
  function setFill(v)        { fillEnabled = v; }
  function setStroke(v)      { strokeEnabled = v; }
  function setOpacity(v)     { brushOpacity = v; }
  function updateSelectedStyle() {
    if (!selectedShape) return;
    const el = selectedShape.el;
    if (fillEnabled)   el.setAttribute('fill',   bgColor);
    if (strokeEnabled) el.setAttribute('stroke', fgColor);
    el.setAttribute('stroke-width', strokeWidth);
    el.setAttribute('opacity', brushOpacity);
  }

  return {
    init, setSize, activate, deactivate,
    getSVGString, clearAll, deleteShape,
    setTool, setFgColor, setBgColor, setStrokeWidth,
    setFill, setStroke, setOpacity, updateSelectedStyle
  };
})();
