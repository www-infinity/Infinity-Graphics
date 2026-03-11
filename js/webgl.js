/**
 * webgl.js — WebGL 3D renderer for Infinity Graphics
 */

const WebGLRenderer = (() => {
  let canvas = null;
  let gl = null;
  let program = null;
  let animFrame = null;

  // Camera
  let rotX = 0.4, rotY = 0.4;
  let camDist = 4;
  let isDragging = false;
  let lastMX = 0, lastMY = 0;

  // Scene
  let currentShape = 'cube';
  let bgColor = [0.07, 0.07, 0.14, 1];
  let objColor = [0.9, 0.27, 0.37, 1]; // accent color
  let lightDir = [1, 2, 3];
  let wireframe = false;

  /* ── Shaders ── */
  const VS = `
    attribute vec3 aPos;
    attribute vec3 aNormal;
    uniform mat4 uMVP;
    uniform mat4 uModel;
    varying vec3 vNormal;
    varying vec3 vPos;
    void main() {
      gl_Position = uMVP * vec4(aPos, 1.0);
      vNormal = (uModel * vec4(aNormal, 0.0)).xyz;
      vPos    = (uModel * vec4(aPos,    1.0)).xyz;
    }
  `;

  const FS = `
    precision mediump float;
    varying vec3 vNormal;
    varying vec3 vPos;
    uniform vec3  uLightDir;
    uniform vec3  uColor;
    uniform vec3  uAmbient;
    void main() {
      vec3 n = normalize(vNormal);
      vec3 l = normalize(uLightDir);
      float diff = max(dot(n, l), 0.0);
      // Specular
      vec3 viewDir = normalize(-vPos);
      vec3 halfVec = normalize(l + viewDir);
      float spec = pow(max(dot(n, halfVec), 0.0), 64.0);
      vec3 col = uAmbient * uColor + diff * uColor + spec * vec3(1.0);
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  /* ── Init ── */
  function init() {
    canvas = document.getElementById('canvas-3d');
    gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) { console.warn('WebGL not supported'); return false; }

    program = buildProgram(VS, FS);
    gl.useProgram(program);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    canvas.addEventListener('mousedown', e => {
      isDragging = true; lastMX = e.clientX; lastMY = e.clientY;
    });
    canvas.addEventListener('mousemove', e => {
      if (!isDragging) return;
      rotY += (e.clientX - lastMX) * 0.01;
      rotX += (e.clientY - lastMY) * 0.01;
      rotX  = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, rotX));
      lastMX = e.clientX; lastMY = e.clientY;
    });
    canvas.addEventListener('mouseup',   () => isDragging = false);
    canvas.addEventListener('mouseleave', () => isDragging = false);
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      camDist = Math.max(1, Math.min(20, camDist + e.deltaY * 0.01));
    }, { passive: false });

    // Touch
    let tp = null;
    canvas.addEventListener('touchstart', e => { tp = e.touches[0]; lastMX = tp.clientX; lastMY = tp.clientY; });
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.touches[0];
      rotY += (t.clientX - lastMX) * 0.01;
      rotX += (t.clientY - lastMY) * 0.01;
      lastMX = t.clientX; lastMY = t.clientY;
    }, { passive: false });

    return true;
  }

  function start() {
    if (!gl) return;
    function frame() {
      resize();
      render();
      animFrame = requestAnimationFrame(frame);
    }
    if (animFrame) cancelAnimationFrame(animFrame);
    animFrame = requestAnimationFrame(frame);
  }

  function stop() {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  /* ── Render ── */
  function render() {
    gl.clearColor(...bgColor);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = canvas.width / canvas.height || 1;
    const proj = perspective(60 * Math.PI / 180, aspect, 0.1, 100);
    const view = lookAt([0, 0, camDist], [0, 0, 0], [0, 1, 0]);
    const model = matMul(rotateX(rotX), rotateY(rotY));
    const mvp  = matMul(proj, matMul(view, model));

    const mesh = getMesh(currentShape);

    const vBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.vertices), gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, 'aPos');
    const aNorm = gl.getAttribLocation(program, 'aNormal');
    const stride = 6 * 4;
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos,  3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aNorm);
    gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, stride, 3 * 4);

    setUniformMat4('uMVP',   mvp);
    setUniformMat4('uModel', model);
    setUniform3fv('uLightDir', normalize3(lightDir));
    setUniform3fv('uColor',    objColor);
    setUniform3fv('uAmbient',  [0.15, 0.15, 0.15]);

    if (wireframe) {
      gl.disable(gl.CULL_FACE);
      for (let i = 0; i < mesh.vertices.length / 6 / 3; i++) {
        gl.drawArrays(gl.LINE_LOOP, i * 3, 3);
      }
      gl.enable(gl.CULL_FACE);
    } else {
      gl.drawArrays(gl.TRIANGLES, 0, mesh.vertices.length / 6);
    }

    gl.deleteBuffer(vBuf);
  }

  /* ── Mesh builders ── */
  function getMesh(shape) {
    switch (shape) {
      case 'sphere':   return buildSphere(1, 32, 16);
      case 'cylinder': return buildCylinder(0.7, 1.5, 32);
      case 'cone':     return buildCone(0.7, 1.5, 32);
      case 'torus':    return buildTorus(0.6, 0.25, 32, 16);
      case 'pyramid':  return buildPyramid();
      default:         return buildCube();
    }
  }

  function buildCube() {
    const faces = [
      // pos,             normal
      [-1,-1, 1,  0, 0, 1], [ 1,-1, 1,  0, 0, 1], [ 1, 1, 1,  0, 0, 1],
      [-1,-1, 1,  0, 0, 1], [ 1, 1, 1,  0, 0, 1], [-1, 1, 1,  0, 0, 1],
      [ 1,-1,-1,  0, 0,-1], [-1,-1,-1,  0, 0,-1], [-1, 1,-1,  0, 0,-1],
      [ 1,-1,-1,  0, 0,-1], [-1, 1,-1,  0, 0,-1], [ 1, 1,-1,  0, 0,-1],
      [-1,-1,-1, -1, 0, 0], [-1,-1, 1, -1, 0, 0], [-1, 1, 1, -1, 0, 0],
      [-1,-1,-1, -1, 0, 0], [-1, 1, 1, -1, 0, 0], [-1, 1,-1, -1, 0, 0],
      [ 1,-1, 1,  1, 0, 0], [ 1,-1,-1,  1, 0, 0], [ 1, 1,-1,  1, 0, 0],
      [ 1,-1, 1,  1, 0, 0], [ 1, 1,-1,  1, 0, 0], [ 1, 1, 1,  1, 0, 0],
      [-1, 1, 1,  0, 1, 0], [ 1, 1, 1,  0, 1, 0], [ 1, 1,-1,  0, 1, 0],
      [-1, 1, 1,  0, 1, 0], [ 1, 1,-1,  0, 1, 0], [-1, 1,-1,  0, 1, 0],
      [-1,-1,-1,  0,-1, 0], [ 1,-1,-1,  0,-1, 0], [ 1,-1, 1,  0,-1, 0],
      [-1,-1,-1,  0,-1, 0], [ 1,-1, 1,  0,-1, 0], [-1,-1, 1,  0,-1, 0],
    ];
    return { vertices: faces.flat() };
  }

  function buildSphere(r, slices, stacks) {
    const verts = [];
    for (let i = 0; i < stacks; i++) {
      const a0 = Math.PI * i / stacks - Math.PI / 2;
      const a1 = Math.PI * (i + 1) / stacks - Math.PI / 2;
      for (let j = 0; j < slices; j++) {
        const b0 = 2 * Math.PI * j / slices;
        const b1 = 2 * Math.PI * (j + 1) / slices;
        const pts = [
          [r*Math.cos(a0)*Math.cos(b0), r*Math.sin(a0), r*Math.cos(a0)*Math.sin(b0)],
          [r*Math.cos(a0)*Math.cos(b1), r*Math.sin(a0), r*Math.cos(a0)*Math.sin(b1)],
          [r*Math.cos(a1)*Math.cos(b1), r*Math.sin(a1), r*Math.cos(a1)*Math.sin(b1)],
          [r*Math.cos(a1)*Math.cos(b0), r*Math.sin(a1), r*Math.cos(a1)*Math.sin(b0)],
        ];
        [[0,1,2],[0,2,3]].forEach(tri => {
          tri.forEach(k => { const p = pts[k]; const n = normalize3(p); verts.push(...p, ...n); });
        });
      }
    }
    return { vertices: verts };
  }

  function buildCylinder(r, h, slices) {
    const verts = [];
    const hh = h / 2;
    for (let i = 0; i < slices; i++) {
      const a0 = 2 * Math.PI * i / slices;
      const a1 = 2 * Math.PI * (i + 1) / slices;
      const c0 = Math.cos(a0), s0 = Math.sin(a0);
      const c1 = Math.cos(a1), s1 = Math.sin(a1);
      // Side
      [[r*c0,-hh,r*s0, c0,0,s0],[r*c1,-hh,r*s1, c1,0,s1],[r*c1, hh,r*s1, c1,0,s1],
       [r*c0,-hh,r*s0, c0,0,s0],[r*c1, hh,r*s1, c1,0,s1],[r*c0, hh,r*s0, c0,0,s0]]
        .forEach(v => verts.push(...v));
      // Caps
      [[-hh,-1],[hh,1]].forEach(([y,ny]) => {
        verts.push(0,y,0, 0,ny,0, r*c0,y,r*s0, 0,ny,0, r*c1,y,r*s1, 0,ny,0);
      });
    }
    return { vertices: verts };
  }

  function buildCone(r, h, slices) {
    const verts = [];
    const hh = h / 2;
    for (let i = 0; i < slices; i++) {
      const a0 = 2 * Math.PI * i / slices;
      const a1 = 2 * Math.PI * (i + 1) / slices;
      const c0 = Math.cos(a0), s0 = Math.sin(a0);
      const c1 = Math.cos(a1), s1 = Math.sin(a1);
      const apex = [0, hh, 0];
      const p0 = [r*c0, -hh, r*s0], p1 = [r*c1, -hh, r*s1];
      const n = normalize3(crossProduct(sub3(p1, p0), sub3(apex, p0)));
      [apex, p1, p0].forEach(p => verts.push(...p, ...n));
      // Base
      verts.push(0,-hh,0, 0,-1,0, r*c1,-hh,r*s1, 0,-1,0, r*c0,-hh,r*s0, 0,-1,0);
    }
    return { vertices: verts };
  }

  function buildTorus(R, r, slices, stacks) {
    const verts = [];
    for (let i = 0; i < stacks; i++) {
      const u0 = 2*Math.PI*i/stacks, u1 = 2*Math.PI*(i+1)/stacks;
      for (let j = 0; j < slices; j++) {
        const v0 = 2*Math.PI*j/slices, v1 = 2*Math.PI*(j+1)/slices;
        function pt(u,v) {
          const x = (R + r*Math.cos(v))*Math.cos(u);
          const y = r*Math.sin(v);
          const z = (R + r*Math.cos(v))*Math.sin(u);
          const nx = Math.cos(v)*Math.cos(u);
          const ny = Math.sin(v);
          const nz = Math.cos(v)*Math.sin(u);
          return [x,y,z,nx,ny,nz];
        }
        const p00=pt(u0,v0), p10=pt(u1,v0), p11=pt(u1,v1), p01=pt(u0,v1);
        [p00,p10,p11, p00,p11,p01].forEach(p => verts.push(...p));
      }
    }
    return { vertices: verts };
  }

  function buildPyramid() {
    const verts = [];
    const apex = [0, 1, 0];
    const base = [[1,-1,1],[1,-1,-1],[-1,-1,-1],[-1,-1,1]];
    // Sides
    for (let i = 0; i < 4; i++) {
      const b0 = base[i], b1 = base[(i+1)%4];
      const n = normalize3(crossProduct(sub3(b1,b0), sub3(apex,b0)));
      [apex,b0,b1].forEach(p => verts.push(...p,...n));
    }
    // Base
    [[0,1,2],[0,2,3]].forEach(tri => tri.forEach(k => verts.push(...base[k],0,-1,0)));
    return { vertices: verts };
  }

  /* ── Math utils ── */
  function perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    return [f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0];
  }

  function lookAt(eye, center, up) {
    const z = normalize3(sub3(eye, center));
    const x = normalize3(crossProduct(up, z));
    const y = crossProduct(z, x);
    return [
      x[0],y[0],z[0],0,
      x[1],y[1],z[1],0,
      x[2],y[2],z[2],0,
      -dot3(x,eye),-dot3(y,eye),-dot3(z,eye),1
    ];
  }

  function rotateX(a) {
    const c=Math.cos(a),s=Math.sin(a);
    return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1];
  }
  function rotateY(a) {
    const c=Math.cos(a),s=Math.sin(a);
    return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1];
  }

  function matMul(a, b) {
    const r = new Array(16).fill(0);
    for (let i=0;i<4;i++) for (let j=0;j<4;j++) for (let k=0;k<4;k++)
      r[j*4+i] += a[k*4+i] * b[j*4+k];
    return r;
  }

  function normalize3(v) {
    const l = Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]) || 1;
    return [v[0]/l,v[1]/l,v[2]/l];
  }
  function sub3(a,b) { return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]; }
  function dot3(a,b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
  function crossProduct(a,b) {
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  }

  /* ── WebGL helpers ── */
  function buildProgram(vs, fs) {
    const prog = gl.createProgram();
    gl.attachShader(prog, compileShader(gl.VERTEX_SHADER,   vs));
    gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    return prog;
  }

  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }

  function setUniformMat4(name, mat) {
    const loc = gl.getUniformLocation(program, name);
    gl.uniformMatrix4fv(loc, false, mat);
  }

  function setUniform3fv(name, v) {
    const loc = gl.getUniformLocation(program, name);
    gl.uniform3fv(loc, v);
  }

  /* ── Setters ── */
  function setShape(s)     { currentShape = s; }
  function setObjColor(c)  { objColor = c; }
  function setBgColor3D(c) { bgColor  = c; }
  function setWireframe(v) { wireframe = v; }
  function setLightDir(v)  { lightDir = v; }

  return {
    init, start, stop, render,
    setShape, setObjColor, setBgColor3D, setWireframe, setLightDir,
    getShapes: () => ['cube','sphere','cylinder','cone','torus','pyramid']
  };
})();
