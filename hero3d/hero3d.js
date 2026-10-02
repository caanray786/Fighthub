/* FightHub 3D hero: one scroll-driven camera journey.
   The visitor starts in a dark, empty arena with a single spotlit ring, steps
   through the ropes, dives through the FightHub logo on the canvas into a
   portal, then travels through three chapters: FOLLOW (the fight world, with
   live data), LEARN (every discipline) and TRAIN (the app). Everything then
   converges on FIGHT HUB and the call to action, and the normal homepage
   carries on below.
   Scrolling sets a target progress (0 to 1); the camera eases towards it, so
   motion feels heavy and smooth, and scrolling back plays it in reverse.
   Readable text is HTML (.h3d-copy, shown by data-from / data-to progress).
   Falls back to a still hero for reduced motion or when WebGL is missing. */
import * as THREE from 'three';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const root = document.getElementById('hero3d');
if (root) start();

function start() {
  const BASE = root.dataset.base || '';
  const RED = 0xe63946;
  const canvas = root.querySelector('.h3d-canvas');
  const stage = root.querySelector('.h3d-stage');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer = null;
  if (!reduce) {
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch { renderer = null; }
  }
  if (!renderer) { root.classList.add('h3d-static'); return; }

  const narrow = () => innerWidth < 700 || innerWidth / innerHeight < 0.8;
  let mobile = narrow();
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050506);
  scene.fog = new THREE.Fog(0x050506, 22, 105);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);

  // ---- Loading screen ----
  const loaderText = root.querySelector('.h3d-loader-pct');
  const loaderBar = root.querySelector('.h3d-loader-bar i');
  let loaded = 0;
  const NEEDED = 2; // font and logo
  const step = () => {
    loaded++;
    const pct = Math.round((loaded / NEEDED) * 100);
    if (loaderText) loaderText.textContent = `${pct}%`;
    if (loaderBar) loaderBar.style.width = `${pct}%`;
  };

  // ---- Reflections: a dark studio with white and red light panels ----
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: 0x0b0b0d, side: THREE.BackSide })));
  const panel = (w, h, color, power, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); envScene.add(m);
  };
  panel(14, 3, 0xffffff, 3.2, [0, 10, 1]);
  panel(3, 16, RED, 2.6, [-10, 0, 2]);
  panel(3, 16, RED, 1.6, [10, 0, -3]);
  panel(12, 2.2, 0xffffff, 1.3, [0, -3, 10]);
  const envMap = pmrem.fromScene(envScene, 0.03).texture;

  const chrome = new THREE.MeshStandardMaterial({ color: 0xd4d5db, metalness: 1, roughness: 0.2, envMap, envMapIntensity: 1.15 });
  const redMetal = new THREE.MeshStandardMaterial({ color: RED, metalness: 0.65, roughness: 0.28, envMap, envMapIntensity: 0.9, emissive: RED, emissiveIntensity: 0.12 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x18181c, metalness: 0.85, roughness: 0.32, envMap, envMapIntensity: 0.8 });

  // ---- Small helpers ----
  const smooth = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  const canvasTexture = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };
  const glowTexture = (inner, outer) => canvasTexture(128, 128, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, inner); r.addColorStop(1, outer); g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  const loadImage = src => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = BASE + src; });
  const faceTowards = (obj, from) => { obj.rotation.y = Math.atan2(from.x - obj.position.x, from.z - obj.position.z); };

  /* ================= SCENE 1: THE ARENA ================= */
  const arena = new THREE.Group();
  scene.add(arena);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.55, metalness: 0.25, envMap, envMapIntensity: 0.12 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; arena.add(floor);

  // The ring: platform, canvas with the logo, corner posts, pads and ropes
  const MAT_Y = 1.4, HALF = 6.7;
  const apron = canvasTexture(1024, 128, (g, w, h) => {
    g.fillStyle = '#0b0b0d'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e63946'; g.fillRect(0, 0, w, 7);
    g.font = '64px "Bebas Neue", Impact, sans-serif'; g.fillStyle = '#26262c'; g.textBaseline = 'middle';
    for (let x = 30; x < w; x += 330) g.fillText('FIGHT HUB', x, h / 2 + 6);
  });
  const matCanvas = document.createElement('canvas'); matCanvas.width = matCanvas.height = 1024;
  const drawMat = logo => {
    const g = matCanvas.getContext('2d'), w = 1024;
    g.fillStyle = '#1d1d21'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`; g.fillRect(Math.random() * w, Math.random() * w, 2, 2); }
    g.strokeStyle = '#141417'; g.lineWidth = 70; g.strokeRect(35, 35, w - 70, w - 70);
    g.strokeStyle = '#e63946'; g.lineWidth = 5; g.strokeRect(74, 74, w - 148, w - 148);
    g.beginPath(); g.arc(w / 2, w / 2, 300, 0, Math.PI * 2); g.lineWidth = 6; g.stroke();
    if (logo) g.drawImage(logo, w / 2 - 260, w / 2 - 260, 520, 520);
    matTexture.needsUpdate = true;
  };
  const matTexture = new THREE.CanvasTexture(matCanvas); matTexture.colorSpace = THREE.SRGBColorSpace; matTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  drawMat(null);
  loadImage('images/logo-500.png').then(drawMat).catch(() => {}).finally(step);
  const apronMat = new THREE.MeshStandardMaterial({ map: apron, roughness: 0.7 });
  const platform = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 0.6, MAT_Y, HALF * 2 + 0.6), [
    apronMat, apronMat, new THREE.MeshStandardMaterial({ map: matTexture, roughness: 0.85 }), apronMat, apronMat, apronMat
  ]);
  platform.position.y = MAT_Y / 2; platform.castShadow = platform.receiveShadow = true; arena.add(platform);
  const posts = new THREE.CylinderGeometry(0.17, 0.17, 5, 18);
  const pad = new THREE.CylinderGeometry(0.34, 0.34, 2.8, 24);
  const padRed = new THREE.MeshStandardMaterial({ color: RED, roughness: 0.5 });
  const padDark = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.55 });
  [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz], i) => {
    const p = new THREE.Mesh(posts, chrome); p.position.set(sx * HALF, MAT_Y + 2.5, sz * HALF); p.castShadow = true; arena.add(p);
    const c = new THREE.Mesh(pad, i === 0 || i === 3 ? padRed : padDark); c.position.set(sx * HALF, MAT_Y + 2.15, sz * HALF); c.castShadow = true; arena.add(c);
  });
  const ropeGeo = new THREE.CylinderGeometry(0.055, 0.055, HALF * 2, 10);
  const ropeWhite = new THREE.MeshStandardMaterial({ color: 0xd8d8dd, roughness: 0.45 });
  const ropeRed = new THREE.MeshStandardMaterial({ color: RED, roughness: 0.4, emissive: RED, emissiveIntensity: 0.15 });
  [1, 2, 3].forEach(level => {
    const y = MAT_Y + level;
    for (const side of [0, 1, 2, 3]) {
      const r = new THREE.Mesh(ropeGeo, level === 3 ? ropeRed : ropeWhite);
      r.castShadow = true;
      if (side < 2) { r.rotation.z = Math.PI / 2; r.position.set(0, y, side ? HALF : -HALF); } else { r.rotation.x = Math.PI / 2; r.position.set(side === 2 ? HALF : -HALF, y, 0); }
      arena.add(r);
    }
  });

  // Empty seating in the dark, rising in tiers, with a thin red light strip
  const tiers = mobile ? 5 : 9;
  const seatSpots = [];
  for (let k = 0; k < tiers; k++) {
    const r = 21 + k * 2.1, n = Math.floor((Math.PI * 2 * r) / 1.35);
    for (let i = 0; i < n; i++) if (i % 14 !== 0) seatSpots.push([r, (i / n) * Math.PI * 2, 0.45 + k * 1.05]);
  }
  const seats = new THREE.InstancedMesh(new THREE.BoxGeometry(1.05, 0.9, 1.0), new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: 0.8 }), seatSpots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1);
  seatSpots.forEach(([r, a, y], i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a + Math.PI / 2);
    seats.setMatrixAt(i, m4.compose(v.set(Math.cos(a) * r, y, Math.sin(a) * r), q, s1));
  });
  arena.add(seats);
  const strip = new THREE.Mesh(new THREE.TorusGeometry(19.6, 0.03, 6, 160), new THREE.MeshBasicMaterial({ color: 0x6e1a22 }));
  strip.rotation.x = Math.PI / 2; strip.position.y = 0.05; arena.add(strip);

  // The spotlight, its visible beam and dust in the light
  const spot = new THREE.SpotLight(0xfff4ea, 13, 0, 0.42, 0.6, 0);
  spot.position.set(0, 32, 0); spot.target.position.set(0, 0, 0);
  spot.castShadow = !mobile; spot.shadow.mapSize.set(1024, 1024); spot.shadow.camera.near = 12; spot.shadow.camera.far = 40; spot.shadow.bias = -0.0004;
  arena.add(spot, spot.target);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(12.5, 31, 64, 1, true), new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0xfff1e6) }, uOpacity: { value: 0.13 } },
    vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float edge = pow(abs(dot(vN, vV)), 2.2); float fade = smoothstep(1.0, 0.82, vY) * smoothstep(0.0, 0.12, vY); gl_FragColor = vec4(uColor, uOpacity * edge * fade * (0.55 + 0.45 * vY)); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  }));
  beam.position.y = 32 - 15.5; arena.add(beam);
  const dot = glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  const dustCount = mobile ? 350 : 1100;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    const r = Math.sqrt(Math.random()) * 9, a = Math.random() * Math.PI * 2;
    dustPos.set([Math.cos(a) * r, 1.6 + Math.random() * 24, Math.sin(a) * r], i * 3);
  }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.09, map: dot, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xfff1e6 }));
  arena.add(dust);
  const hemi = new THREE.HemisphereLight(0x9aa0b4, 0x050505, 0.35);
  scene.add(hemi);

  /* ================= SCENE 2: THE PORTAL ================= */
  // Glowing ring squares (like the ring itself) lead from the canvas down into the fight world
  const tunnel = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(0, -5, -1), new THREE.Vector3(0, -11, -6),
    new THREE.Vector3(0, -14.5, -16), new THREE.Vector3(0, -14.5, -32)
  ]);
  const roundedSquare = (half, r) => {
    const s = new THREE.Shape();
    s.moveTo(-half + r, -half); s.lineTo(half - r, -half); s.quadraticCurveTo(half, -half, half, -half + r);
    s.lineTo(half, half - r); s.quadraticCurveTo(half, half, half - r, half); s.lineTo(-half + r, half);
    s.quadraticCurveTo(-half, half, -half, half - r); s.lineTo(-half, -half + r); s.quadraticCurveTo(-half, -half, -half + r, -half);
    return s;
  };
  const frameShape = roundedSquare(3.6, 0.9); frameShape.holes.push(roundedSquare(3.42, 0.8));
  const frameGeo = new THREE.ShapeGeometry(frameShape, 8);
  const frameRed = new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const frameWhite = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const portal = new THREE.Group(); scene.add(portal);
  for (let i = 0; i < 24; i++) {
    const t = 0.1 + (i / 23) * 0.88;
    const f = new THREE.Mesh(frameGeo, i % 3 === 1 ? frameWhite : frameRed);
    f.position.copy(tunnel.getPointAt(t));
    f.lookAt(f.position.clone().add(tunnel.getTangentAt(t)));
    f.rotation.z += i * 0.06;
    f.scale.setScalar(1 + t * 0.7);
    portal.add(f);
  }
  const sparkCount = mobile ? 250 : 700;
  const sparkPos = new Float32Array(sparkCount * 3);
  for (let i = 0; i < sparkCount; i++) {
    const p = tunnel.getPointAt(Math.random()), r = 2 + Math.random() * 4, a = Math.random() * Math.PI * 2;
    sparkPos.set([p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.8, p.z + (Math.random() - 0.5) * 3], i * 3);
  }
  const sparkGeo = new THREE.BufferGeometry(); sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  portal.add(new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: 0.12, map: dot, color: 0xff6b78, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })));

  /* ================= THE WORLDS (built once the font is in) ================= */
  const worlds = new THREE.Group(); scene.add(worlds);
  const worldLights = [];
  const addLight = (light, base) => { light.userData.base = base; light.intensity = 0; worldLights.push(light); worlds.add(light); return light; };
  const key = addLight(new THREE.DirectionalLight(0xffffff, 1), 1.4); key.position.set(12, 8, 30); key.target.position.set(0, -15, -170); worlds.add(key.target);
  addLight(new THREE.PointLight(RED, 1, 70, 1.1), 90).position.set(-8, -6, -48);
  addLight(new THREE.PointLight(RED, 1, 70, 1.1), 70).position.set(10, -8, -130);
  addLight(new THREE.PointLight(RED, 1, 70, 1.1), 80).position.set(-4, -6, -236);
  addLight(new THREE.PointLight(0xffffff, 1, 60, 1.1), 50).position.set(0, -6, -290);

  const grid = new THREE.GridHelper(560, mobile ? 70 : 140, RED, RED);
  grid.material.transparent = true; grid.material.opacity = 0.22; grid.material.depthWrite = false;
  grid.position.set(0, -23, -170); worlds.add(grid);

  // Drifting dark cubes for depth
  const cubeCount = mobile ? 40 : 100;
  const cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), darkMetal, cubeCount);
  const cubeData = [];
  for (let i = 0; i < cubeCount; i++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    cubeData.push({ p: new THREE.Vector3(side * (5 + Math.random() * 20), -22 + Math.random() * 16, -24 - Math.random() * 300), r: new THREE.Euler(Math.random() * 3, Math.random() * 3, 0), s: 0.4 + Math.random() * 1.2, w: (Math.random() - 0.5) * 0.6 });
  }
  worlds.add(cubes);

  let font = null;
  const words = {};
  const makeWord = (text, size, material, depth = 0.2, spacing = 0.03) => {
    const group = new THREE.Group();
    const scale = size / font.data.resolution;
    let x = 0; const letters = [];
    for (const ch of text) {
      const g = font.data.glyphs[ch];
      if (!g) continue;
      if (ch !== ' ') {
        const shapes = font.generateShapes(ch, size);
        const geo = new THREE.ExtrudeGeometry(shapes, { depth: size * depth, curveSegments: mobile ? 5 : 8, bevelEnabled: true, bevelThickness: size * 0.018, bevelSize: size * 0.012, bevelSegments: 2 });
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.x = x; group.add(mesh);
        letters.push({ ch, mesh, shapes });
      }
      x += g.ha * scale + size * spacing;
    }
    const width = x - size * spacing;
    for (const l of letters) l.mesh.position.x -= width / 2;
    return { group, letters, width, cap: size * 0.7 };
  };

  // Gallery: every discipline, women and men alternating
  const ARTS = [['boxing', 'Boxing'], ['muay-thai', 'Muay Thai'], ['mma', 'MMA'], ['bjj', 'BJJ'], ['kickboxing', 'Kickboxing'], ['wrestling', 'Wrestling'], ['karate', 'Karate'], ['taekwondo', 'Taekwondo'], ['kung-fu', 'Kung fu'], ['self-defence', 'Self-defence']];
  const gallery = [];
  const phones = [];
  const PHONES = ['images/app/hero-today.webp', 'images/app/hero-fight.webp', 'images/app/hero-coach.webp', 'images/app/app-exercise.webp'];
  const movers = []; // gallery panels and phones, which converge at the end
  const panelGeo = new RoundedBoxGeometry(4.5, 3.1, 0.14, 2, 0.08);
  const picGeo = new THREE.PlaneGeometry(4.3, 2.9);
  ARTS.forEach(([slug, name], i) => {
    for (const female of [i % 2 === 0, i % 2 !== 0]) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(panelGeo, darkMetal));
      const pic = new THREE.Mesh(picGeo, new THREE.MeshBasicMaterial({ color: 0x1a1a1e }));
      pic.position.z = 0.075; g.add(pic);
      g.userData = { src: `app/assets/arts/${slug}${female ? '-f' : ''}.webp`, name, pic };
      worlds.add(g); gallery.push(g); movers.push(g);
    }
  });
  const phoneGeo = new RoundedBoxGeometry(2.3, 4.85, 0.24, 4, 0.3);
  const screenGeo = new THREE.PlaneGeometry(2.1, 4.55);
  PHONES.forEach(src => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(phoneGeo, darkMetal));
    const screen = new THREE.Mesh(screenGeo, new THREE.MeshBasicMaterial({ color: 0x111114, toneMapped: false }));
    screen.position.z = 0.125; g.add(screen);
    g.userData = { src, screen };
    worlds.add(g); phones.push(g); movers.push(g);
  });

  // Speed lines on the final approach
  const lineCount = mobile ? 90 : 220;
  const linePos = new Float32Array(lineCount * 6);
  for (let i = 0; i < lineCount; i++) {
    const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 16, z = -250 - Math.random() * 60, len = 2 + Math.random() * 6;
    const x = Math.cos(a) * r, y = -13.5 + Math.sin(a) * r * 0.75;
    linePos.set([x, y, z, x, y, z - len], i * 6);
  }
  const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  const speedLines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  worlds.add(speedLines);
  const finaleGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(230,57,70,0.9)', 'rgba(230,57,70,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
  finaleGlow.position.set(0, -13.5, -318); finaleGlow.scale.set(46, 46, 1); worlds.add(finaleGlow);

  /* ================= CAMERA PATH ================= */
  // [progress, camera position, look-at point]; mobile overrides where framing differs
  const O = new THREE.Vector3(0, -14, -60); // centre of the O in FOLLOW (the word is placed to match)
  const KEYS = [
    [0.000, [-3, 9.5, 31], [-10.5, 2.6, 0], [0, 14, 40], [0, -3.5, 0]],
    [0.075, [2.5, 6.8, 20], [0, 3.2, 0], [1.5, 8, 26], [0, 3, 0]],
    [0.135, [0.6, 3.9, 10.5], [0, 3.9, 0]],
    [0.175, [0, 3.9, 4.0], [0, 2.6, -3]],
    [0.215, [0, 10.5, 0.9], [0, 1.4, 0], [0, 13.5, 1.0], [0, 1.4, 0]],
    [0.255, [0, 2.2, 0.15], [0, -8, -0.6]],
    [0.290, [0, -5, -1], [0, -12, -6]],
    [0.320, [0, -11, -6], [0, -15, -18]],
    [0.345, [-3, -14.5, -16], [-8, -14, -60], [0, -14.5, -16], [0, -14, -60]],
    [0.385, [-2, O.y, -44], [0, O.y, -60]],
    [0.415, [0, O.y, -63], [0, O.y - 0.5, -80]],
    [0.450, [-3, -14, -80], [7, -15, -94], [-1.5, -14, -80], [5, -15, -95]],
    [0.485, [2, -14, -100], [-7, -15, -114], [1, -14, -100], [-5, -15, -115]],
    [0.520, [0, -15.5, -120], [0, -8, -142]],
    [0.555, [0, -15, -146], [0, -15, -168]],
    [0.600, [0.8, -15, -170], [-1, -15, -192]],
    [0.650, [-0.8, -14.6, -200], [0, -15, -224]],
    [0.690, [2.5, -14, -222], [-8, -14, -242], [1.5, -14, -218], [-4, -14, -242]],
    [0.730, [4, -14, -236], [9, -14, -252], [2, -14, -234], [5, -14, -252]],
    [0.780, [3, -13.6, -247], [10, -14, -266], [1.5, -13.6, -247], [5, -13.4, -268]],
    [0.830, [0, -13.5, -268], [0, -13.5, -300]],
    [0.900, [0, -13.8, -276], [0, -15.6, -305]],
    [1.000, [0, -14, -271], [0, -15.9, -305], [0, -14, -277], [0, -16, -305]]
  ];
  let posCurve, tgtCurve;
  const P = KEYS.map(k => k[0]);
  const buildPath = () => {
    const pick = (k, i) => (mobile && k[i + 2] ? k[i + 2] : k[i]);
    posCurve = new THREE.CatmullRomCurve3(KEYS.map(k => new THREE.Vector3(...pick(k, 1))), false, 'centripetal');
    tgtCurve = new THREE.CatmullRomCurve3(KEYS.map(k => new THREE.Vector3(...pick(k, 2))), false, 'centripetal');
  };
  const curveT = p => {
    let i = 0;
    while (i < P.length - 2 && p > P[i + 1]) i++;
    const local = Math.min(1, Math.max(0, (p - P[i]) / (P[i + 1] - P[i])));
    return (i + local) / (P.length - 1);
  };
  const keyPos = i => new THREE.Vector3(...(mobile && KEYS[i][3] ? KEYS[i][3] : KEYS[i][1]));

  /* ================= LAYOUT (desktop or phone) ================= */
  const homes = new Map();
  const layout = () => {
    buildPath();
    camera.fov = mobile ? 56 : 40;
    // Gallery corridor after LEARN
    gallery.forEach((g, i) => {
      const side = i % 2 ? 1 : -1;
      const x = side * ((mobile ? 3.4 : 5.4) + (i % 4 < 2 ? 0 : mobile ? 0.8 : 1.7));
      g.position.set(x, -15 + (((i * 37) % 5) - 2) * 0.8, -152 - i * 3.1);
      g.rotation.set(0, -side * 0.62, 0);
      g.scale.setScalar(mobile ? 0.7 : 1);
    });
    // Phones on the right in TRAIN, turned towards the camera
    const look = keyPos(19);
    const spots = mobile ? [[4.4, -12.6, -252], [5.0, -14.0, -259], [4.6, -12.6, -266], [5.2, -14.0, -273]] : [[8.6, -13.2, -250], [9.4, -14.8, -257], [8.8, -13.0, -264], [9.6, -14.6, -271]];
    phones.forEach((g, i) => { g.position.set(...spots[i]); faceTowards(g, look); g.scale.setScalar(mobile ? 0.85 : 1.2); });
    for (const m of movers) homes.set(m, { p: m.position.clone(), q: m.quaternion.clone(), s: m.scale.x });
    if (font) placeWords();
  };

  const placeWords = () => {
    const f = words.follow;
    // Put the centre of the first O exactly on the camera path
    const o = f.letters.find(l => l.ch === 'O');
    const box = new THREE.Box2();
    o.shapes[0].holes[0].getPoints().forEach(pt => box.expandByPoint(pt));
    const c = box.getCenter(new THREE.Vector2());
    f.group.position.set(O.x - (o.mesh.position.x + c.x), O.y - c.y, O.z);
    const l = words.learn;
    l.group.position.set(0, -9, -142); l.group.rotation.x = 0.34;
    const t = words.train;
    t.group.position.set(mobile ? -8 : -16, -19.5, -244); t.group.scale.setScalar(mobile ? 0.6 : 1); faceTowards(t.group, keyPos(17));
    const fin = words.finale;
    fin.group.position.set(0, -13.5, -305);
    fin.group.scale.setScalar(mobile ? 0.62 : 1);
    for (const mon of monuments) mon.place();
  };

  // Big numbers standing in the world (only real figures, once the data is in)
  const monuments = [];
  const monument = (big, label, at, faceKey) => {
    const n = makeWord(big, mobile ? 5 : 7, chrome, 0.22), lab = makeWord(label, mobile ? 1.3 : 1.8, redMetal, 0.25, 0.06);
    lab.group.position.y = -(mobile ? 2.1 : 2.8);
    const g = new THREE.Group(); g.add(n.group, lab.group); worlds.add(g);
    const m = { g, place: () => { g.position.set(...(mobile ? at.map((v, i) => (i === 0 ? v * 0.75 : v)) : at)); faceTowards(g, keyPos(faceKey)); } };
    m.place(); monuments.push(m);
  };

  const buildWords = () => {
    words.follow = makeWord('FOLLOW', 16, chrome);
    words.learn = makeWord('LEARN', 12, chrome);
    words.train = makeWord('TRAIN', 13, chrome);
    const FS = 6.5, fight = makeWord('FIGHT', FS, chrome, 0.22), hub = makeWord('HUB', FS, redMetal, 0.22);
    fight.group.position.y = 0.06 * FS; hub.group.position.y = -0.76 * FS;
    const fin = new THREE.Group(); fin.add(fight.group, hub.group);
    words.finale = { group: fin };
    for (const w of ['follow', 'learn', 'train', 'finale']) worlds.add(words[w].group);
    placeWords();
    if (pendingFacts) addFactMonuments(pendingFacts);
  };

  /* ================= LIVE FACTS FROM THE PAGE ================= */
  let pendingFacts = window.fightHubFacts || null, factsShown = false;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const addFactMonuments = f => {
    if (factsShown || !font) return;
    factsShown = true;
    if (f.fighters > 0) monument(f.fighters.toLocaleString('en-GB'), 'FIGHTERS', [12, -17.5, -93], 11);
    if (f.events > 0) monument(String(f.events), f.events === 1 ? 'FIGHT NIGHT AHEAD' : 'FIGHT NIGHTS AHEAD', [-12, -17, -114], 12);
  };
  const showFacts = f => {
    pendingFacts = f;
    const set = (sel, html) => { const el = root.querySelector(sel); if (el) el.innerHTML = html; };
    if (f.next) {
      set('[data-fact="next"]', `<span class="h3d-eyebrow">Next fight night${f.next.promotion ? ` · ${esc(f.next.promotion)}` : ''}</span><strong>${esc(f.next.name)}</strong><small>${esc(f.next.when)}</small><a href="events.html">Full fight calendar <span aria-hidden="true">→</span></a>`);
    }
    if (f.story) {
      set('[data-fact="story"]', `<span class="h3d-eyebrow">Latest · ${esc(f.story.category || 'News')}</span><strong>${esc(f.story.title)}</strong><a href="${esc(f.story.href)}">Read the story <span aria-hidden="true">→</span></a>`);
    }
    root.querySelectorAll('[data-fact]').forEach(el => { el.hidden = !el.innerHTML.trim(); });
    const styles = root.querySelector('[data-fact-count="styles"]');
    if (styles && f.styles > 0) styles.textContent = String(f.styles);
    addFactMonuments(f);
  };
  if (pendingFacts) showFacts(pendingFacts);
  window.addEventListener('fighthub:facts', e => showFacts(e.detail));

  /* ================= TEXTURES THAT CAN WAIT ================= */
  const coverFit = (g, img, w, h) => {
    const s = Math.max(w / img.width, h / img.height);
    g.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
  };
  const loadLater = async () => {
    try { await document.fonts.load('64px "Bebas Neue"'); } catch { /* fallback font */ }
    for (const g of gallery) {
      loadImage(g.userData.src).then(img => {
        const tex = canvasTexture(768, 518, (c, w, h) => {
          coverFit(c, img, w, h);
          const grad = c.createLinearGradient(0, h * 0.55, 0, h); grad.addColorStop(0, 'rgba(5,5,6,0)'); grad.addColorStop(1, 'rgba(5,5,6,0.92)');
          c.fillStyle = grad; c.fillRect(0, 0, w, h);
          c.fillStyle = '#e63946'; c.fillRect(34, h - 46, 60, 6);
          c.font = '68px "Bebas Neue", Impact, sans-serif'; c.fillStyle = '#ffffff'; c.fillText(g.userData.name.toUpperCase(), 34, h - 62);
        });
        g.userData.pic.material = new THREE.MeshBasicMaterial({ map: tex });
      }).catch(() => {});
    }
    for (const g of phones) {
      loadImage(g.userData.src).then(img => {
        const tex = canvasTexture(600, 1300, (c, w, h) => {
          c.beginPath(); c.roundRect(0, 0, w, h, 54); c.clip(); coverFit(c, img, w, h);
        });
        g.userData.screen.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true });
      }).catch(() => {});
    }
  };

  /* ================= SCROLL, OVERLAYS, CHAPTERS ================= */
  const copies = [...root.querySelectorAll('.h3d-copy')].map(el => ({ el, a: +el.dataset.from, b: +el.dataset.to, last: -1 }));
  const flash = root.querySelector('.h3d-flash');
  const chapters = [...root.querySelectorAll('.h3d-chapters [data-p]')];
  const chapterBar = root.querySelector('.h3d-chapters-bar i');
  const windowAlpha = (p, a, b, fade = 0.022) => {
    const fin = a <= 0 ? 1 : smooth((p - (a - fade)) / fade);
    const fout = b >= 1 ? 1 : smooth((b + fade - p) / fade);
    return Math.min(fin, fout);
  };
  const scrollRange = () => Math.max(1, root.offsetHeight - stage.offsetHeight);
  const scrollProgress = () => Math.min(1, Math.max(0, -root.getBoundingClientRect().top / scrollRange()));
  let target = scrollProgress(), current = target;

  const lenis = window.Lenis && !matchMedia('(pointer: coarse)').matches ? new window.Lenis({ lerp: 0.09, wheelMultiplier: 0.9, anchors: true }) : null;
  const jump = (p, instant = false) => {
    const y = root.getBoundingClientRect().top + scrollY + p * scrollRange();
    if (instant) { window.scrollTo(0, y); lenis?.scrollTo(y, { immediate: true }); target = current = p; return; }
    if (lenis) lenis.scrollTo(y, { duration: 2.4 }); else window.scrollTo({ top: y, behavior: 'smooth' });
  };
  chapters.forEach(b => b.addEventListener('click', () => jump(+b.dataset.p)));

  const updateOverlays = p => {
    for (const c of copies) {
      const alpha = Math.round(windowAlpha(p, c.a, c.b) * 100) / 100;
      if (alpha === c.last) continue;
      c.last = alpha;
      c.el.style.opacity = alpha;
      c.el.style.transform = `translate3d(0, ${(1 - alpha) * 24}px, 0)`;
      c.el.style.visibility = alpha > 0 ? 'visible' : 'hidden';
      c.el.classList.toggle('is-live', alpha > 0.5);
    }
    if (flash) flash.style.opacity = windowAlpha(p, 0.249, 0.262, 0.014).toFixed(3);
    let active = 0;
    chapters.forEach((b, i) => { if (p >= +b.dataset.p - 0.02) active = i; });
    chapters.forEach((b, i) => b.classList.toggle('is-active', i === active));
    if (chapterBar) chapterBar.style.transform = `scaleX(${p.toFixed(4)})`;
  };

  /* ================= FRAME LOOP ================= */
  const pos = new THREE.Vector3(), tgt = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), faceCam = new THREE.Quaternion();
  const ringCentre = new THREE.Vector3(0, -13.5, -311);
  let visible = true, last = performance.now(), time = 0;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(root);

  const frame = now => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    lenis?.raf(now);
    if (!visible || document.hidden) return;
    time += dt;
    target = scrollProgress();
    current += (target - current) * (1 - Math.exp(-dt * 3.4));
    if (Math.abs(target - current) < 0.00005) current = target;
    const p = current;

    const t = curveT(p);
    posCurve.getPoint(t, pos); tgtCurve.getPoint(t, tgt);
    camera.position.copy(pos);
    camera.position.y += Math.sin(time * 0.6) * 0.04; // a breath of handheld drift
    camera.lookAt(tgt);

    // Arena above the canvas, worlds below it
    const below = pos.y < MAT_Y - 0.05;
    arena.visible = pos.y > -6;
    portal.visible = p > 0.2 && p < 0.345;
    const worldOn = smooth((-pos.y - 2) / 8);
    for (const l of worldLights) l.intensity = l.userData.base * worldOn;
    spot.intensity = below ? 0 : 13 * (1 + smooth((p - 0.17) / 0.06) * 0.35);
    beam.material.uniforms.uOpacity.value = 0.13 * (1 - smooth((p - 0.2) / 0.05) * 0.5);
    dust.rotation.y = time * 0.02;
    hemi.intensity = below ? 0.18 : 0.26;

    // Cubes drift, phones float
    cubeData.forEach((c, i) => {
      c.r.x += c.w * dt; c.r.y += c.w * 0.7 * dt;
      q.setFromEuler(c.r); v.set(c.s, c.s, c.s);
      cubes.setMatrixAt(i, m4.compose(c.p, q, v));
    });
    cubes.instanceMatrix.needsUpdate = true;

    // Final convergence: gallery panels and phones fly into a ring around FIGHT HUB
    const F = smooth((p - 0.835) / 0.115);
    const rx = mobile ? 5.2 : 13.5, ry = mobile ? 10.5 : 7.6;
    faceCam.identity();
    movers.forEach((m, i) => {
      const h = homes.get(m);
      if (!h) return;
      const k = smooth((F - 0.3 * (i / movers.length)) / 0.7);
      const bob = m.userData.screen && k < 1 ? Math.sin(time * 1.2 + i) * 0.12 : 0;
      if (k <= 0) { m.position.copy(h.p); m.position.y += bob; m.quaternion.copy(h.q); m.scale.setScalar(h.s); return; }
      const a = (i / movers.length) * Math.PI * 2 + Math.PI / 2;
      const end = v.set(Math.cos(a) * rx, Math.sin(a) * ry, -Math.abs(Math.sin(a * 2)) * 2).add(ringCentre);
      const arc = Math.sin(Math.PI * k) * 7;
      m.position.lerpVectors(h.p, end, k);
      m.position.x += Math.cos(a) * arc; m.position.y += Math.sin(a) * arc;
      tmpQ.copy(h.q).slerp(faceCam, k); m.quaternion.copy(tmpQ);
      m.scale.setScalar(h.s * (1 - 0.3 * k));
    });
    speedLines.material.opacity = 0.4 * smooth((p - 0.8) / 0.05) * (1 - smooth((p - 0.93) / 0.05));
    finaleGlow.material.opacity = 0.25 + 0.55 * F;
    // The finale only appears on the final approach, so it does not crowd TRAIN
    const finaleOn = p > 0.79;
    finaleGlow.visible = finaleOn;
    if (words.finale) { words.finale.group.visible = finaleOn; words.finale.group.rotation.y = Math.sin(time * 0.4) * 0.06 * (1 - F * 0.5); }

    updateOverlays(p);
    renderer.render(scene, camera);
  };

  /* ================= SIZE ================= */
  const resize = () => {
    const was = mobile;
    mobile = narrow();
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (was !== mobile || !posCurve) layout();
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);

  /* ================= GO ================= */
  fetch(BASE + 'hero3d/bebas-neue.json').then(r => r.json()).then(json => {
    font = new Font(json);
    buildWords();
  }).catch(() => {}).finally(() => {
    step();
    resize();
    root.classList.add('h3d-ready');
    requestAnimationFrame(frame);
    if (window.requestIdleCallback) requestIdleCallback(loadLater, { timeout: 1500 }); else setTimeout(loadLater, 400);
  });
  resize();

  window.fightHubHero = { jump, progress: () => current };
}
