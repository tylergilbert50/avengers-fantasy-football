/**
 * Scroll-driven page curl, iOS-Books style.
 *
 * The sheet is a tessellated grid. A "curl line" sweeps across it; everything
 * behind that line is still lying flat, and everything past it is wrapped
 * around a cylinder of radius R sitting on top of the line. Past half a
 * rotation the paper comes off the cylinder and lies flat again, face down,
 * which is the part of the sheet you've already peeled up.
 *
 *      d <= 0        flat on the book
 *      0 < d < piR   on the cylinder  (the curl itself)
 *      d >= piR      flat, upside down, at height 2R (the peeled flap)
 *
 * Because the geometry is analytic we also get exact surface normals, which is
 * what makes the light slide along the curl and sell it as paper.
 */

const COLS = 200
const ROWS = 64

// Camera distance, in CSS pixels. Matches `perspective: 2000px`, so world
// units at z = 0 map 1:1 onto CSS pixels and the sheet lines up exactly with
// the DOM page underneath it.
const CAMERA_DISTANCE = 2000

const TILT = 0.16 // curl-line tilt; > 0 makes the bottom-right corner peel first
const SHADOW_PASSES = 5
// The sweep clears the book at roughly 0.78, so the sheet starts drifting away
// right as it comes free rather than hanging there for the last of the scroll.
const FADE_START = 0.78

const VERT = `
precision highp float;

attribute vec2 aUV;

uniform vec2 uPage;        // sheet size in px
uniform vec2 uDir;         // sweep direction, unit, in the plane of the sheet
uniform float uC;          // curl-line position along uDir
uniform float uR;          // curl radius
uniform float uDriftX;
uniform float uShadowPass;
uniform vec3 uLight;
uniform vec2 uJitter;
uniform vec2 uProjScale;
uniform float uD;
uniform vec2 uDepth;

varying vec2 vUV;
varying vec3 vN;
varying float vH;
varying vec2 vShadowXY;

const float PI = 3.141592653589793;

void main() {
  vUV = aUV;

  vec2 flat2 = vec2((aUV.x - 0.5) * uPage.x, (0.5 - aUV.y) * uPage.y);
  float d = uC - dot(flat2, uDir);
  vec2 e = -uDir; // direction the not-yet-flattened part extends in

  vec3 pos;
  vec3 n;

  if (d <= 0.0) {
    pos = vec3(flat2, 0.0);
    n = vec3(0.0, 0.0, 1.0);
  } else {
    vec2 foot = flat2 + uDir * d; // where this point meets the curl line
    float th = d / uR;
    if (th < PI) {
      pos = vec3(foot + e * (uR * sin(th)), uR * (1.0 - cos(th)));
      n = vec3(-e * sin(th), cos(th));
    } else {
      pos = vec3(foot - e * (d - PI * uR), 2.0 * uR);
      n = vec3(0.0, 0.0, -1.0);
    }
  }

  pos.x += uDriftX;
  vN = n;
  vH = pos.z;

  if (uShadowPass > 0.5) {
    // Drop the point straight down the light ray onto the page below.
    vec2 sxy = pos.xy - uLight.xy * (pos.z / uLight.z);
    // Jitter grows with height so the shadow softens as the paper lifts.
    sxy += uJitter * (0.3 + pos.z / uPage.x);
    vShadowXY = sxy;
    pos = vec3(sxy, 0.0);
  }

  vec3 cam = vec3(pos.x, pos.y, pos.z - uD);
  gl_Position = vec4(
    cam.x * uProjScale.x,
    cam.y * uProjScale.y,
    uDepth.x * cam.z + uDepth.y,
    -cam.z
  );
}
`

const FRAG = `
precision highp float;

uniform sampler2D uTex;
uniform float uShadowPass;
uniform vec3 uLight;
uniform float uAlpha;
uniform vec2 uPage;
uniform float uShadowStrength;

varying vec2 vUV;
varying vec3 vN;
varying float vH;
varying vec2 vShadowXY;

void main() {
  if (uShadowPass > 0.5) {
    // Clip the shadow to the sheet lying underneath — nothing else catches it.
    vec2 half2 = uPage * 0.5;
    if (abs(vShadowXY.x) > half2.x || abs(vShadowXY.y) > half2.y) discard;
    float ex = smoothstep(0.0, 14.0, half2.x - abs(vShadowXY.x));
    float ey = smoothstep(0.0, 14.0, half2.y - abs(vShadowXY.y));
    float a = uShadowStrength * exp(-vH / (uPage.x * 0.55)) * ex * ey * uAlpha;
    gl_FragColor = vec4(0.0, 0.0, 0.0, a);
    return;
  }

  vec3 n = normalize(vN);
  vec3 base;

  if (gl_FrontFacing) {
    base = texture2D(uTex, vUV).rgb;
  } else {
    n = -n;
    // Back of the sheet: paper stock with a trace of the ink showing through.
    vec3 ghost = texture2D(uTex, vec2(1.0 - vUV.x, vUV.y)).rgb;
    base = mix(vec3(0.937, 0.914, 0.855), ghost, 0.07);
  }

  vec3 L = normalize(uLight);
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float diff = max(dot(n, L), 0.0);
  float spec = pow(max(dot(n, H), 0.0), 26.0) * 0.18;

  vec3 col = base * (0.58 + 0.5 * diff) + spec;
  gl_FragColor = vec4(col * uAlpha, uAlpha); // premultiplied
}
`

function compile(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function buildProgram(gl) {
  const vs = compile(gl, gl.VERTEX_SHADER, VERT)
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
  if (!vs || !fs) return null

  const program = gl.createProgram()
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.deleteShader(vs)
  gl.deleteShader(fs)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program)
    return null
  }
  return program
}

function buildMesh(gl) {
  const uvs = new Float32Array((COLS + 1) * (ROWS + 1) * 2)
  let k = 0
  for (let j = 0; j <= ROWS; j++) {
    for (let i = 0; i <= COLS; i++) {
      uvs[k++] = i / COLS
      uvs[k++] = j / ROWS
    }
  }

  const indices = new Uint16Array(COLS * ROWS * 6)
  let m = 0
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const a = j * (COLS + 1) + i
      const b = a + 1
      const c = a + (COLS + 1)
      const d = c + 1
      // Counter-clockwise while the sheet is flat, so gl_FrontFacing marks the
      // printed side and flips on its own once the paper rolls over.
      indices[m++] = a; indices[m++] = c; indices[m++] = d
      indices[m++] = a; indices[m++] = d; indices[m++] = b
    }
  }

  const uvBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW)

  const indexBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)

  return { uvBuffer, indexBuffer, count: indices.length }
}

/**
 * @param {HTMLCanvasElement} canvas  overlays the stage
 * @param {HTMLImageElement}  image   fully decoded cover art
 * @param {() => {width:number,height:number,pageWidth:number,pageHeight:number}} measure
 */
export function createPageCurl(canvas, image, measure) {
  const attrs = { alpha: true, antialias: true, premultipliedAlpha: true, depth: true }
  const gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs)
  if (!gl) return null

  const program = buildProgram(gl)
  if (!program) return null

  const mesh = buildMesh(gl)

  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
  // Cover art is not power-of-two, so clamp and stay off mipmaps.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  const u = {}
  for (const name of [
    'uPage', 'uDir', 'uC', 'uR', 'uDriftX', 'uShadowPass', 'uLight', 'uJitter',
    'uProjScale', 'uD', 'uDepth', 'uTex', 'uAlpha', 'uShadowStrength',
  ]) {
    u[name] = gl.getUniformLocation(program, name)
  }
  const aUV = gl.getAttribLocation(program, 'aUV')

  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uvBuffer)
  gl.enableVertexAttribArray(aUV)
  gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer)

  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA) // premultiplied
  gl.depthFunc(gl.LEQUAL)
  gl.disable(gl.CULL_FACE) // both sides of the paper are visible

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.uniform1i(u.uTex, 0)

  const light = [-0.35, 0.55, 0.78]
  gl.uniform3f(u.uLight, light[0], light[1], light[2])
  gl.uniform1f(u.uD, CAMERA_DISTANCE)

  const near = 1
  const far = CAMERA_DISTANCE * 4
  gl.uniform2f(u.uDepth, (far + near) / (near - far), (2 * far * near) / (near - far))

  let page = { w: 0, h: 0 }
  let progress = 0
  let lastLayout = ''

  function resize() {
    const box = measure()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cw = Math.max(1, Math.round(box.width))
    const ch = Math.max(1, Math.round(box.height))

    // Mobile address bars fire a burst of resize events. Reallocating the
    // backing store clears the framebuffer, so only do it on a real change.
    const layout = `${cw}x${ch}@${dpr}:${Math.round(box.pageWidth)}x${Math.round(box.pageHeight)}`
    if (layout === lastLayout) return
    lastLayout = layout

    canvas.width = Math.round(cw * dpr)
    canvas.height = Math.round(ch * dpr)
    canvas.style.width = `${cw}px`
    canvas.style.height = `${ch}px`
    gl.viewport(0, 0, canvas.width, canvas.height)

    // 1:1 px mapping at z = 0, so the sheet sits exactly on the DOM page.
    gl.uniform2f(u.uProjScale, CAMERA_DISTANCE / (cw / 2), CAMERA_DISTANCE / (ch / 2))

    page = { w: Math.max(1, box.pageWidth), h: Math.max(1, box.pageHeight) }
    gl.uniform2f(u.uPage, page.w, page.h)

    draw()
  }

  function draw() {
    const t = Math.min(1, Math.max(0, progress))
    // A touch of ease so the turn settles instead of stopping dead.
    const smooth = t * t * (3 - 2 * t)
    const te = t * 0.65 + smooth * 0.35

    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    const { w, h } = page

    // Sweep direction, tilted so a corner leads rather than the whole edge.
    const dl = Math.hypot(1, TILT)
    const dir = [-1 / dl, TILT / dl]

    // Tight peel at the start, opening out through the middle of the turn.
    const radius = w * (0.07 + 0.06 * Math.sin(Math.PI * te))
    const maxRadius = w * 0.13

    // Sweep from "everything still flat" to "everything rolled over".
    let cMin = Infinity
    let cMax = -Infinity
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const p = (sx * w) / 2 * dir[0] + ((sy * h) / 2) * dir[1]
      if (p < cMin) cMin = p
      if (p > cMax) cMax = p
    }
    const c = cMin + (cMax - cMin + Math.PI * maxRadius) * te

    const fade = Math.max(0, (t - FADE_START) / (1 - FADE_START))
    const alpha = 1 - fade
    if (alpha <= 0) return

    gl.uniform2f(u.uDir, dir[0], dir[1])
    gl.uniform1f(u.uC, c)
    gl.uniform1f(u.uR, radius)
    gl.uniform1f(u.uDriftX, -fade * w * 0.35)
    gl.uniform1f(u.uAlpha, alpha)

    // Contact shadow: a few jittered projections stand in for a soft light.
    // Nothing casts one while the sheet is still lying flat on the book.
    if (t > 0.001) {
      gl.disable(gl.DEPTH_TEST)
      gl.depthMask(false)
      gl.uniform1f(u.uShadowPass, 1)
      gl.uniform1f(u.uShadowStrength, 0.5 / SHADOW_PASSES)
      const spread = w * 0.05
      for (let i = 0; i < SHADOW_PASSES; i++) {
        const a = (i / SHADOW_PASSES) * Math.PI * 2
        const r = i === 0 ? 0 : spread
        gl.uniform2f(u.uJitter, Math.cos(a) * r, Math.sin(a) * r)
        gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0)
      }
    }

    // The sheet itself, depth-tested against the part of it already flipped over.
    gl.enable(gl.DEPTH_TEST)
    gl.depthMask(true)
    gl.uniform1f(u.uShadowPass, 0)
    gl.uniform2f(u.uJitter, 0, 0)
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0)
  }

  function setProgress(next) {
    if (next === progress) return
    progress = next
    draw()
  }

  function destroy() {
    gl.deleteTexture(texture)
    gl.deleteBuffer(mesh.uvBuffer)
    gl.deleteBuffer(mesh.indexBuffer)
    gl.deleteProgram(program)
    const lose = gl.getExtension('WEBGL_lose_context')
    if (lose) lose.loseContext()
  }

  resize()
  return { setProgress, resize, destroy }
}
