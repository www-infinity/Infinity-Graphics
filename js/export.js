/**
 * export.js — Export functionality for Infinity Graphics
 */

const ExportManager = (() => {

  function exportAs(format, quality, filename) {
    const flatCanvas = LayerManager.getFlattenedCanvas();
    filename = (filename || 'infinity-design').replace(/[^a-zA-Z0-9_\-]/g, '_');

    if (format === 'svg') {
      exportSVG(filename);
      return;
    }

    const mimeTypes = {
      png:  'image/png',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
    };

    const mime = mimeTypes[format] || 'image/png';
    const ext  = format === 'jpeg' ? 'jpg' : format;
    const q    = (format === 'png') ? undefined : (quality || 0.92);

    const dataURL = flatCanvas.toDataURL(mime, q);
    triggerDownload(dataURL, `${filename}.${ext}`);
    showToast(`Exported as ${ext.toUpperCase()}`);
  }

  function exportSVG(filename) {
    const svgString = SVGEditor.getSVGString();
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    triggerDownload(url, `${filename}.svg`);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast('Exported as SVG');
  }

  function exportCurrentLayerAs(format, quality, filename) {
    const layer = LayerManager.getActiveLayer();
    const canvas = layer.canvas;
    filename = (filename || 'layer').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
    const ext  = format === 'jpeg' ? 'jpg' : format;
    const q    = format === 'png' ? undefined : (quality || 0.92);
    triggerDownload(canvas.toDataURL(mime, q), `${filename}.${ext}`);
    showToast(`Layer exported as ${ext.toUpperCase()}`);
  }

  function triggerDownload(urlOrData, filename) {
    const a = document.createElement('a');
    a.href     = urlOrData;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function importImage(file, onLoad) {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => onLoad(img);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  return { exportAs, exportCurrentLayerAs, importImage };
})();
