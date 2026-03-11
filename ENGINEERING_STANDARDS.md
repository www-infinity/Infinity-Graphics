# Engineering Standards for Infinity Graphics

## Production-Ready Code Constraints

This document establishes the strict engineering standards that must be followed for all code changes and additions to the Infinity Graphics project.

###  1. No Placeholders
- **Never** use `// TODO`, `// logic goes here`, or `// ... rest of code`
- Write complete, functional implementation for every file
- All code must be production-ready from the first commit

### 2. No 'Lazy' Refactoring
- Do not summarize changes - provide entire updated files
- When updating a component, provide the complete file for copy-paste without merge errors
- No partial implementations or summaries

### 3. Strict Typing
**For Vanilla JavaScript (Current Stack):**
- Use JSDoc type annotations for all functions
- Define clear JSDoc typedef interfaces for all props and data structures
- Document parameter types, return types, and object shapes
- Zero implicit any types in documentation

**If migrating to TypeScript:**
- Use TypeScript with zero `any` types
- Define clear interfaces for all props and data structures
- Use strict mode configuration

###  4. Modern Stack Preferences
**Default for New Features (when applicable):**
- Consider modern frameworks: Next.js 15 (App Router), React, or Vue.js
- Use Tailwind CSS for styling consistency
- Use Lucide-react or similar icon libraries
- Use modern ES6+ syntax (optional chaining, destructuring, async/await)

**Current Stack (Vanilla JS):**
- Continue using vanilla JavaScript for existing features
- Use modern ES6+ features where possible
- Maintain zero external dependencies philosophy

### 5. Edge Case Logic
- **Never** code for the 'happy path' only
- Include loading states for all asynchronous operations
- Implement error handling (try/catch) for all operations that can fail
- Provide empty states for all data-driven components
- Handle network failures, timeouts, and edge cases
- Validate all user inputs

### 6. Responsive & Accessible
- Every layout must be mobile-first
- Include basic ARIA labels for accessibility
- Ensure keyboard navigation support
- Test on multiple screen sizes (mobile, tablet, desktop)
- Provide sufficient color contrast
- Add alt text for images and icons

## Code Quality Checklist

Before committing any code, verify:

- [ ] No TODO or placeholder comments
- [ ] Complete implementation with no summaries
- [ ] All functions have JSDoc type documentation
- [ ] Error handling implemented
- [ ] Loading states implemented
- [ ] Empty states implemented
- [ ] Mobile-responsive design
- [ ] ARIA labels added
- [ ] Keyboard navigation works
- [ ] Modern ES6+ syntax used
- [ ] Code follows existing project structure

## File Structure

Maintain the current architecture:
```
index.html          - Main application shell and UI layout
css/
  style.css         - Professional dark-theme design tool styling
js/
  layers.js         - Layer management + undo history stack
  effects.js        - Image filters (convolution, colour math)
  canvas2d.js       - 2D raster drawing engine (tools, zoom, pan)
  webgl.js          - WebGL 3D renderer (meshes, lighting, camera)
  svg.js            - SVG vector editor (shapes, selection, drag)
  ai.js             - AI assistant (palettes, enhance, suggestions)
  export.js         - Export to PNG / JPEG / WebP / SVG
  app.js            - Application coordinator + event binding
```

## Implementation Philosophy

1. **Zero External Dependencies**: Continue the tradition of vanilla HTML5, CSS3, and JavaScript
2. **Browser-Native**: No build step required, works directly in browsers
3. **Professional Quality**: Code should be production-ready, not prototype quality
4. **Complete Solutions**: Every feature is fully implemented, not partially done
5. **User Experience First**: Handle errors gracefully, provide feedback, be responsive

## When Adding New Features

1. **Plan First**: Understand the full scope before writing code
2. **Complete Implementation**: Write the entire feature, not just the core logic
3. **Test Edge Cases**: Try to break your own code before committing
4. **Document Interfaces**: Use JSDoc to document all function signatures and data structures
5. **Accessibility**: Add ARIA labels and ensure keyboard navigation works
6. **Responsive**: Test on mobile, tablet, and desktop viewports
7. **Error Handling**: Wrap risky operations in try-catch blocks
8. **User Feedback**: Provide loading states and error messages

## Examples

### Good JSDoc Type Documentation
```javascript
/**
 * Creates a new layer in the layer stack
 * @param {string} name - The name of the new layer
 * @returns {{id: number, name: string, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, visible: boolean, locked: boolean, opacity: number, blendMode: string}} The newly created layer object
 */
function addLayer(name) {
  // ... implementation
}

/**
 * @typedef {Object} LayerConfig
 * @property {number} id - Unique layer identifier
 * @property {string} name - Layer display name
 * @property {HTMLCanvasElement} canvas - Layer canvas element
 * @property {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @property {boolean} visible - Layer visibility state
 * @property {boolean} locked - Layer lock state
 * @property {number} opacity - Layer opacity (0-100)
 * @property {string} blendMode - Canvas composite operation mode
 */
```

### Error Handling Pattern
```javascript
async function loadImage(file) {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

    const img = await loadImageFromFile(file);

    if (!img.complete) {
      throw new Error('Image failed to load');
    }

    return img;
  } catch (error) {
    console.error('Failed to load image:', error);
    showToast(`Error: ${error.message}`, 'error');
    return null;
  }
}
```

### Responsive Design Pattern
```css
/* Mobile-first approach */
.toolbar {
  flex-direction: column;
  gap: 8px;
}

/* Tablet and up */
@media (min-width: 768px) {
  .toolbar {
    flex-direction: row;
    gap: 16px;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .toolbar {
    gap: 24px;
  }
}
```

## Commitment

By following these engineering standards, we ensure that Infinity Graphics maintains professional quality, is accessible to all users, handles errors gracefully, and provides a smooth experience across all devices.

All contributors and AI coding assistants must adhere to these standards for every commit.
