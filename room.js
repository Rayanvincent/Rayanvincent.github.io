import * as THREE from "three";
import { CSS3DRenderer, CSS3DObject } from "three/addons/renderers/CSS3DRenderer.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/*
  How it works
  ------------
  - WebGL canvas (top layer, transparent) renders the 3D room.
  - CSS3D layer (behind it) renders real HTML panels for every screen.
  - Each screen in WebGL is a "hole" mesh that writes transparent pixels,
    so the HTML shows through exactly where the screen is, and anything in
    front of it (chair, papers…) still correctly covers it.
  - Page scroll drives the camera between waypoints (one per section).
*/

const SECTIONS = ["home", "experience", "skills", "projects", "blog", "faq", "contact"];
const LABELS = ["HOME", "EXPERIENCE", "SKILLS", "PROJECTS", "BLOG", "FAQ", "CONTACT"];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------- renderers
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const cssRenderer = new CSS3DRenderer();
cssRenderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById("css-layer").appendChild(cssRenderer.domElement);

const scene = new THREE.Scene();
const cssScene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b0807, 12, 30);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 100);

// ---------------------------------------------------------------- helpers
const TOP = 0.78; // desk surface height

function stdMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1, ...opts });
}
function add(parent, geo, material, pos = [0, 0, 0], rot = [0, 0, 0], shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
function glowTex(inner) {
  return canvasTex(256, 256, (g) => {
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, inner);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
  });
}
const glowMat = (tex, opacity = 1) =>
  new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });

// Transparent "hole" that lets the CSS3D layer show through.
const holeMat = new THREE.MeshBasicMaterial({
  color: 0x000000, opacity: 0, blending: THREE.NoBlending, side: THREE.DoubleSide, fog: false, toneMapped: false,
});

// ---------------------------------------------------------------- lights
scene.add(new THREE.HemisphereLight(0xffe8d6, 0x1a0c0a, 0.55));

const deskLight = new THREE.SpotLight(0xfff0e0, 90, 14, Math.PI / 4.5, 0.6, 1.4);
deskLight.position.set(1.6, 5.2, 3.2);
deskLight.target.position.set(0, TOP, -0.2);
deskLight.castShadow = true;
deskLight.shadow.mapSize.set(2048, 2048);
deskLight.shadow.bias = -0.0004;
scene.add(deskLight, deskLight.target);

const carLight = new THREE.SpotLight(0xffffff, 140, 16, Math.PI / 7, 0.7, 1.4);
carLight.position.set(0, 7, -4.5);
carLight.target.position.set(0, 0, -6.5);
carLight.castShadow = true;
carLight.shadow.mapSize.set(1024, 1024);
scene.add(carLight, carLight.target);

const redLight = new THREE.PointLight(0xff1a33, 18, 7, 1.6);
redLight.position.set(0, 0.5, -6.5);
scene.add(redLight);

const warmFill = new THREE.PointLight(0xffa060, 14, 22, 1.5);
warmFill.position.set(-5, 3.5, 2);
scene.add(warmFill);

// ---------------------------------------------------------------- room
const hexTex = canvasTex(384, 444, (g, w, h) => {
  g.fillStyle = "#4a4847";
  g.fillRect(0, 0, w, h);
  g.strokeStyle = "#3a3837";
  g.lineWidth = 3;
  const r = 32;
  const vs = Math.sqrt(3) * r;
  for (let c = -1; c <= w / (1.5 * r) + 1; c++) {
    for (let row = -1; row <= h / vs + 1; row++) {
      const cx = c * 1.5 * r;
      const cy = row * vs + (Math.abs(c) % 2 ? vs / 2 : 0);
      g.beginPath();
      for (let k = 0; k < 6; k++) g.lineTo(cx + r * Math.cos((Math.PI / 3) * k), cy + r * Math.sin((Math.PI / 3) * k));
      g.closePath();
      g.stroke();
    }
  }
});
hexTex.wrapS = hexTex.wrapT = THREE.RepeatWrapping;
hexTex.repeat.set(12, 12);

const floor = add(scene, new THREE.CircleGeometry(15, 96), stdMat(0xffffff, { map: hexTex, roughness: 0.42, metalness: 0.25 }), [0, 0, 0], [-Math.PI / 2, 0, 0], false);
floor.material.userData.env = 0.5;

add(scene, new THREE.CylinderGeometry(15, 15, 10, 96, 1, true), stdMat(0x1c1412, { roughness: 0.95, side: THREE.BackSide }), [0, 5, 0], [0, 0, 0], false);
add(scene, new THREE.CircleGeometry(15, 64), stdMat(0x0c0908, { roughness: 1 }), [0, 10, 0], [Math.PI / 2, 0, 0], false);

// LED strip around the floor edge + soft glow on the wall
add(scene, new THREE.TorusGeometry(14.9, 0.04, 8, 300), new THREE.MeshBasicMaterial({ color: 0xffe2c4, fog: false }), [0, 0.05, 0], [Math.PI / 2, 0, 0], false);
const bandTex = canvasTex(8, 256, (g) => {
  const gr = g.createLinearGradient(0, 256, 0, 0);
  gr.addColorStop(0, "rgba(255,200,150,0.9)");
  gr.addColorStop(0.25, "rgba(255,140,90,0.3)");
  gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 8, 256);
});
add(scene, new THREE.CylinderGeometry(14.85, 14.85, 1.6, 96, 1, true), new THREE.MeshBasicMaterial({ map: bandTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide, fog: false }), [0, 0.8, 0], [0, 0, 0], false);

// ---------------------------------------------------------------- neon sign
async function buildNeon() {
  try { await document.fonts.load('200px "Yellowtail"'); } catch (e) {}
  const draw = (g, w, h) => {
    g.font = '230px "Yellowtail", cursive';
    g.textAlign = "center";
    g.textBaseline = "middle";
    const text = "Keep Building";
    g.shadowColor = "#ff2d55";
    for (const blur of [80, 40, 20]) {
      g.shadowBlur = blur;
      g.fillStyle = "#ff3d65";
      g.fillText(text, w / 2, h / 2);
    }
    g.shadowBlur = 8;
    g.shadowColor = "#ffffff";
    g.fillStyle = "#ffe0e8";
    g.fillText(text, w / 2, h / 2);
  };
  const tex = canvasTex(2048, 512, draw);
  const sign = add(scene, new THREE.PlaneGeometry(7, 1.75), new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }), [0, 4.2, -14.2], [0, 0, 0], false);
  const halo = add(scene, new THREE.PlaneGeometry(10, 4), glowMat(glowTex("rgba(255,40,80,0.35)")), [0, 4.2, -14.3], [0, 0, 0], false);
  neon = { sign, halo };
}
let neon = null;
buildNeon();

// ---------------------------------------------------------------- showcase car
const showcase = new THREE.Group();
showcase.position.set(0, 0, -6.8);
scene.add(showcase);

add(showcase, new THREE.CylinderGeometry(2.2, 2.3, 0.2, 80), stdMat(0x121212, { metalness: 0.85, roughness: 0.28 }), [0, 0.1, 0]);
add(showcase, new THREE.TorusGeometry(2.25, 0.025, 8, 160), new THREE.MeshBasicMaterial({ color: 0xff2040 }), [0, 0.2, 0], [Math.PI / 2, 0, 0], false);
{
  const count = 56;
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 10, 10), new THREE.MeshBasicMaterial({ color: 0xff3048 }), count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    m.setPosition(Math.cos(a) * 2.05, 0.21, Math.sin(a) * 2.05);
    dots.setMatrixAt(i, m);
  }
  showcase.add(dots);
}
add(showcase, new THREE.PlaneGeometry(8, 8), glowMat(glowTex("rgba(255,30,60,0.55)")), [0, 0.02, 0], [-Math.PI / 2, 0, 0], false);

function buildCar() {
  const car = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x08080a, metalness: 0.75, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06 });
  paint.userData.env = 1.4;
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0c0f14, metalness: 0.9, roughness: 0.05, side: THREE.DoubleSide });
  glass.userData.env = 1.6;

  const s = new THREE.Shape();
  s.moveTo(-2.2, 0.36);
  s.lineTo(-2.27, 0.78);
  s.quadraticCurveTo(-2.2, 0.93, -1.7, 0.97);
  s.lineTo(-0.95, 1.02);
  s.quadraticCurveTo(-0.55, 1.42, 0.05, 1.46);
  s.lineTo(0.7, 1.43);
  s.quadraticCurveTo(1.15, 1.22, 1.5, 1.02);
  s.lineTo(2.15, 0.93);
  s.quadraticCurveTo(2.33, 0.86, 2.32, 0.6);
  s.lineTo(2.25, 0.36);
  s.lineTo(1.88, 0.36);
  s.absarc(1.42, 0.4, 0.46, 0, Math.PI, false);
  s.lineTo(-0.96, 0.36);
  s.absarc(-1.42, 0.4, 0.46, 0, Math.PI, false);
  s.lineTo(-2.2, 0.36);
  const bodyGeo = new THREE.ExtrudeGeometry(s, { depth: 1.7, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.07, bevelSegments: 5, curveSegments: 28 });
  bodyGeo.translate(0, 0, -0.85);
  add(car, bodyGeo, paint);

  const win = new THREE.Shape();
  win.moveTo(-0.78, 1.05);
  win.quadraticCurveTo(-0.45, 1.36, 0.08, 1.39);
  win.lineTo(0.66, 1.37);
  win.quadraticCurveTo(1.0, 1.2, 1.28, 1.05);
  win.closePath();
  const winGeo = new THREE.ShapeGeometry(win);
  add(car, winGeo, glass, [0, 0, 0.945], [0, 0, 0], false);
  add(car, winGeo, glass, [0, 0, -0.945], [0, 0, 0], false);
  // windshield + rear glass
  add(car, new THREE.PlaneGeometry(0.55, 1.5), glass, [1.12, 1.24, 0], [0, Math.PI / 2, -0.95], false).rotation.order = "YXZ";
  add(car, new THREE.BoxGeometry(0.6, 0.02, 1.45), glass, [-0.6, 1.27, 0], [0, 0, 0.75], false);

  const tire = stdMat(0x0b0b0b, { roughness: 0.9 });
  const rim = stdMat(0x1c1c1e, { metalness: 1, roughness: 0.25 });
  const caliper = new THREE.MeshStandardMaterial({ color: 0xff1030, emissive: 0x880010, roughness: 0.4 });
  for (const x of [-1.42, 1.42]) {
    for (const z of [-0.82, 0.82]) {
      const side = Math.sign(z);
      add(car, new THREE.CylinderGeometry(0.4, 0.4, 0.3, 36), tire, [x, 0.4, z], [Math.PI / 2, 0, 0]);
      add(car, new THREE.CylinderGeometry(0.28, 0.28, 0.31, 6), rim, [x, 0.4, z], [Math.PI / 2, 0, 0], false);
      add(car, new THREE.BoxGeometry(0.16, 0.2, 0.04), caliper, [x + 0.12, 0.48, z + side * 0.13], [0, 0, 0.4], false);
    }
  }
  const head = new THREE.MeshBasicMaterial({ color: 0xf4f8ff });
  add(car, new THREE.BoxGeometry(0.06, 0.06, 0.38), head, [2.31, 0.76, 0.55], [0, 0, 0], false);
  add(car, new THREE.BoxGeometry(0.06, 0.06, 0.38), head, [2.31, 0.76, -0.55], [0, 0, 0], false);
  add(car, new THREE.BoxGeometry(0.05, 0.07, 1.6), new THREE.MeshBasicMaterial({ color: 0xff1030 }), [-2.29, 0.82, 0], [0, 0, 0], false);
  add(car, new THREE.PlaneGeometry(5.2, 2.6), glowMat(glowTex("rgba(255,20,50,0.7)")), [0, 0.03, 0], [-Math.PI / 2, 0, 0], false);
  return car;
}
const carPivot = new THREE.Group();
carPivot.position.y = 0.2;
showcase.add(carPivot);
const car = buildCar();
car.scale.setScalar(0.62);
carPivot.add(car);

// ---------------------------------------------------------------- desk setup
const screens = {};
const tmpScale = new THREE.Vector3();

function makeScreen(name, parent, w, h, pxW, pos, rot = [0, 0, 0]) {
  const anchor = new THREE.Object3D();
  anchor.position.set(...pos);
  anchor.rotation.set(...rot);
  parent.add(anchor);
  anchor.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), holeMat));
  const el = document.getElementById(`panel-${name}`);
  el.style.width = `${pxW}px`;
  el.style.height = `${Math.round((pxW * h) / w)}px`;
  const css = new CSS3DObject(el);
  cssScene.add(css);
  screens[name] = { anchor, w, h, pxW, css };
  return anchor;
}

const desk = new THREE.Group();
scene.add(desk);
const black = stdMat(0x101010, { roughness: 0.35, metalness: 0.3 });
const white = stdMat(0xecebea, { roughness: 0.35 });
const darkMetal = stdMat(0x1d1d1f, { metalness: 0.8, roughness: 0.3 });

add(desk, new RoundedBoxGeometry(3.3, 0.06, 1.35, 4, 0.02), black, [0, TOP - 0.03, 0]);
add(desk, new THREE.BoxGeometry(0.07, TOP - 0.06, 1.15), black, [-1.55, (TOP - 0.06) / 2, 0]);
add(desk, new THREE.BoxGeometry(0.07, TOP - 0.06, 1.15), black, [1.55, (TOP - 0.06) / 2, 0]);
add(desk, new THREE.BoxGeometry(1.5, 0.004, 0.52), stdMat(0x232325, { roughness: 0.9 }), [0, TOP + 0.002, 0.27]);

// Curved monitor
{
  const mon = new THREE.Group();
  mon.position.set(0, TOP, -0.42);
  desk.add(mon);
  add(mon, new RoundedBoxGeometry(0.42, 0.025, 0.26, 3, 0.01), white, [0, 0.013, -0.04]);
  add(mon, new THREE.BoxGeometry(0.07, 0.42, 0.04), white, [0, 0.22, -0.1], [-0.08, 0, 0]);
  const R = 2.4;
  const arc = 1.52 / R;
  const shell = new THREE.CylinderGeometry(R + 0.03, R + 0.03, 0.68, 48, 1, true, Math.PI - arc / 2, arc);
  const inner = new THREE.CylinderGeometry(R, R, 0.66, 48, 1, true, Math.PI - arc / 2, arc);
  add(mon, shell, stdMat(0xe8e7e5, { roughness: 0.35, side: THREE.DoubleSide }), [0, 0.47, R]);
  add(mon, inner, stdMat(0x050505, { roughness: 0.2, side: THREE.DoubleSide }), [0, 0.47, R], [0, 0, 0], false);
  // LED glow strip on the back
  add(mon, new THREE.BoxGeometry(1.1, 0.012, 0.01), new THREE.MeshBasicMaterial({ color: 0xffffff }), [0, 0.62, -0.035], [0, 0, 0], false);
  makeScreen("monitor", mon, 1.44, 0.61, 1500, [0, 0.47, 0.115]);
}

// Laptop
{
  const lap = new THREE.Group();
  lap.position.set(0.95, TOP, 0.14);
  lap.rotation.y = -0.4;
  desk.add(lap);
  const alu = stdMat(0xc8c9cc, { metalness: 0.7, roughness: 0.3 });
  add(lap, new RoundedBoxGeometry(0.5, 0.02, 0.34, 3, 0.006), alu, [0, 0.01, 0]);
  add(lap, new THREE.BoxGeometry(0.44, 0.002, 0.15), stdMat(0x18181a), [0, 0.021, -0.06], [0, 0, 0], false);
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.02, -0.17);
  hinge.rotation.x = -0.26;
  lap.add(hinge);
  add(hinge, new RoundedBoxGeometry(0.5, 0.33, 0.012, 3, 0.005), alu, [0, 0.165, -0.006]);
  add(hinge, new THREE.PlaneGeometry(0.49, 0.32), stdMat(0x050505), [0, 0.165, 0.0005], [0, 0, 0], false);
  makeScreen("laptop", hinge, 0.46, 0.29, 1200, [0, 0.167, 0.001]);
}

// Vertical monitor
{
  const vm = new THREE.Group();
  vm.position.set(1.36, TOP, -0.32);
  vm.rotation.y = -0.5;
  desk.add(vm);
  add(vm, new RoundedBoxGeometry(0.28, 0.02, 0.2, 3, 0.008), black, [0, 0.01, 0]);
  add(vm, new THREE.BoxGeometry(0.05, 0.4, 0.03), darkMetal, [0, 0.2, -0.05]);
  add(vm, new RoundedBoxGeometry(0.42, 0.72, 0.03, 3, 0.01), black, [0, 0.75, -0.02]);
  makeScreen("vertical", vm, 0.385, 0.685, 420, [0, 0.75, -0.004]);
}

// Phone on a stand
{
  const ph = new THREE.Group();
  ph.position.set(-0.55, TOP, 0.32);
  ph.rotation.y = 0.15;
  desk.add(ph);
  add(ph, new THREE.BoxGeometry(0.11, 0.02, 0.1), darkMetal, [0, 0.01, 0]);
  add(ph, new THREE.BoxGeometry(0.1, 0.07, 0.01), darkMetal, [0, 0.05, -0.03], [-0.3, 0, 0]);
  const body = new THREE.Group();
  body.position.set(0, 0.11, -0.01);
  body.rotation.x = -0.3;
  ph.add(body);
  add(body, new RoundedBoxGeometry(0.092, 0.188, 0.01, 4, 0.012), stdMat(0x151517, { metalness: 0.6, roughness: 0.3 }));
  makeScreen("phone", body, 0.084, 0.174, 380, [0, 0, 0.0056]);
}

// PC tower with glowing fans
{
  const pc = new THREE.Group();
  pc.position.set(-1.32, TOP, -0.3);
  desk.add(pc);
  add(pc, new RoundedBoxGeometry(0.3, 0.62, 0.55, 3, 0.02), white, [0, 0.31, 0]);
  add(pc, new THREE.PlaneGeometry(0.5, 0.56), new THREE.MeshPhysicalMaterial({ color: 0x0a0a0a, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.35 }), [0.151, 0.31, 0], [0, Math.PI / 2, 0], false);
  add(pc, new THREE.BoxGeometry(0.26, 0.58, 0.51), stdMat(0x0c0c0c), [-0.005, 0.31, 0], [0, 0, 0], false);
  const fanMat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff });
  for (const [y, z] of [[0.46, 0.12], [0.46, -0.12], [0.2, 0.12]]) {
    add(pc, new THREE.TorusGeometry(0.08, 0.008, 8, 40), fanMat, [0.13, y, z], [0, Math.PI / 2, 0], false);
  }
  add(pc, new THREE.BoxGeometry(0.02, 0.06, 0.18), new THREE.MeshBasicMaterial({ color: 0xff2040 }), [0.13, 0.12, -0.12], [0, 0, 0], false);
  const pcGlow = new THREE.PointLight(0x7fdcff, 1.2, 1.4, 2);
  pcGlow.position.set(0.3, 0.4, 0);
  pc.add(pcGlow);
}

// Keyboard + mouse
{
  const keysTex = canvasTex(1024, 320, (g, w, h) => {
    g.fillStyle = "#0e0e0e";
    g.fillRect(0, 0, w, h);
    const cols = 15, rows = 5, pad = 8;
    const kw = (w - pad * (cols + 1)) / cols, kh = (h - pad * (rows + 1)) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        g.fillStyle = (r + c) % 7 === 0 ? "#bdbdbd" : "#e6e6e6";
        g.beginPath();
        g.roundRect(pad + c * (kw + pad), pad + r * (kh + pad), kw, kh, 8);
        g.fill();
      }
    }
  });
  add(desk, new RoundedBoxGeometry(0.72, 0.025, 0.22, 3, 0.008), black, [0, TOP + 0.0125, 0.2]);
  add(desk, new THREE.PlaneGeometry(0.69, 0.2), new THREE.MeshStandardMaterial({ map: keysTex, roughness: 0.6 }), [0, TOP + 0.0255, 0.2], [-Math.PI / 2, 0, 0], false);
  const mouse = add(desk, new THREE.SphereGeometry(0.04, 24, 16), white, [0.5, TOP + 0.015, 0.22]);
  mouse.scale.set(0.8, 0.45, 1.3);
}

// Gaming chair
function buildChair() {
  const chair = new THREE.Group();
  const red = stdMat(0xa50f1d, { roughness: 0.55 });
  const blk = stdMat(0x111111, { roughness: 0.6 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = add(chair, new THREE.BoxGeometry(0.34, 0.035, 0.05).translate(0.17, 0, 0), darkMetal, [0, 0.08, 0]);
    leg.rotation.y = a;
    add(chair, new THREE.SphereGeometry(0.035, 12, 12), blk, [Math.cos(a) * 0.33, 0.035, -Math.sin(a) * 0.33]);
  }
  add(chair, new THREE.CylinderGeometry(0.03, 0.04, 0.36, 16), darkMetal, [0, 0.27, 0]);
  add(chair, new RoundedBoxGeometry(0.54, 0.1, 0.52, 3, 0.04), red, [0, 0.5, 0]);
  add(chair, new RoundedBoxGeometry(0.52, 0.8, 0.09, 3, 0.04), red, [0, 0.97, -0.25], [-0.12, 0, 0]);
  add(chair, new THREE.BoxGeometry(0.14, 0.62, 0.1), blk, [0, 0.95, -0.25], [-0.12, 0, 0], false);
  add(chair, new RoundedBoxGeometry(0.26, 0.12, 0.07, 3, 0.03), blk, [0, 1.22, -0.2], [-0.12, 0, 0]);
  for (const x of [-0.31, 0.31]) {
    add(chair, new THREE.BoxGeometry(0.04, 0.2, 0.04), blk, [x, 0.62, 0]);
    add(chair, new RoundedBoxGeometry(0.07, 0.03, 0.3, 2, 0.01), blk, [x, 0.73, 0.02]);
  }
  return chair;
}
const chair = buildChair();
chair.position.set(0.3, 0, 1.2);
chair.rotation.y = Math.PI + 0.35;
scene.add(chair);

// Floating papers (blog)
const papersGroup = new THREE.Group();
papersGroup.position.set(-1.28, 2.08, -0.1);
scene.add(papersGroup);
const papers = [];
[-0.36, 0, 0.36].forEach((x, i) => {
  const holder = new THREE.Group();
  holder.position.set(x, 0, Math.abs(x) * 0.15);
  holder.rotation.set(0, -x * 0.35, [-0.07, 0.03, 0.08][i]);
  papersGroup.add(holder);
  makeScreen(`paper-${i}`, holder, 0.3, 0.42, 360, [0, 0, 0]);
  papers.push({ holder, baseY: 0, phase: i * 1.7 });
});
const papersFocus = { anchor: papersGroup, w: 1.25, h: 0.55 };

// Small environment tweak: softer reflections everywhere except where set explicitly.
scene.traverse((o) => {
  if (o.material && o.material.isMeshStandardMaterial) {
    o.material.envMapIntensity = o.material.userData.env ?? 0.35;
  }
});

// ---------------------------------------------------------------- camera waypoints
const HERO = { pos: new THREE.Vector3(2.7, 2.35, 3.9), target: new THREE.Vector3(-0.2, 1.05, -2.6) };
let waypoints = [];

function focusPose(s, fill = 0.88) {
  const center = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  s.anchor.updateWorldMatrix(true, false);
  s.anchor.getWorldPosition(center);
  s.anchor.getWorldQuaternion(quat);
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
  const vHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const hHalf = vHalf * camera.aspect;
  const d = Math.max(s.w / (2 * hHalf * fill), s.h / (2 * vHalf * fill));
  return { pos: center.clone().addScaledVector(normal, d), target: center };
}

function heroPose() {
  const k = Math.min(Math.max(1.5 / camera.aspect, 1), 1.9);
  const pos = HERO.target.clone().add(HERO.pos.clone().sub(HERO.target).multiplyScalar(k));
  return { pos, target: HERO.target.clone() };
}

function buildWaypoints() {
  const monitor = focusPose(screens.monitor, 0.76);
  waypoints = [
    heroPose(),
    monitor,
    focusPose(screens.laptop, 0.72),
    monitor,
    focusPose(papersFocus, 0.84),
    focusPose(screens.vertical, 0.82),
    focusPose(screens.phone, 0.78),
  ];
}
buildWaypoints();

// ---------------------------------------------------------------- scroll + HUD
const track = document.getElementById("track");
track.style.height = `${(SECTIONS.length - 1) * 130 + 100}vh`;

let lenis = null;
if (window.Lenis && !reduceMotion) {
  lenis = new Lenis({ duration: 1.4, smoothWheel: true, wheelMultiplier: 0.8 });
  lenis.stop();
}

function maxScroll() {
  return document.documentElement.scrollHeight - window.innerHeight;
}
function scrollToSection(i) {
  const y = (i / (SECTIONS.length - 1)) * maxScroll();
  if (lenis) lenis.scrollTo(y, { duration: 1.8 });
  else window.scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" });
}

const dotsEl = document.getElementById("dots");
const dotBtns = SECTIONS.map((s, i) => {
  const b = document.createElement("button");
  b.className = "dot-btn";
  b.innerHTML = `<span class="label">${LABELS[i]}</span><i></i>`;
  b.setAttribute("aria-label", LABELS[i]);
  b.addEventListener("click", () => scrollToSection(i));
  dotsEl.appendChild(b);
  return b;
});
document.querySelector(".brand").addEventListener("click", (e) => {
  e.preventDefault();
  scrollToSection(0);
});

let activeIndex = -1;
function setActive(i) {
  if (i === activeIndex) return;
  activeIndex = i;
  document.body.dataset.section = SECTIONS[i];
  dotBtns.forEach((b, j) => b.classList.toggle("active", j === i));
}
setActive(0);

// ---------------------------------------------------------------- pointer
const pointer = new THREE.Vector2();
const smoothPointer = new THREE.Vector2();
window.addEventListener("pointermove", (e) => {
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
});

// ---------------------------------------------------------------- loader
const loaderBar = document.getElementById("loaderBar");
const loaderPct = document.getElementById("loaderPct");
const enterBtn = document.getElementById("enterBtn");
let started = false;
let forcedProgress = null; // only used by the ?s=N dev shortcut
window.addEventListener("wheel", () => (forcedProgress = null), { passive: true });
{
  let p = 0;
  const tick = () => {
    p = Math.min(100, p + 2 + Math.random() * 6);
    loaderBar.style.width = `${p}%`;
    loaderPct.textContent = `${Math.round(p)}%`;
    if (p < 100) setTimeout(tick, 60);
    else {
      enterBtn.disabled = false;
      enterBtn.classList.add("ready");
    }
  };
  tick();
}
enterBtn.addEventListener("click", () => {
  document.getElementById("loader").classList.add("hide");
  document.documentElement.classList.remove("is-loading");
  if (lenis) lenis.start();
  started = true;
});

// Dev shortcut: ?skip bypasses the loader, ?s=N jumps straight to section N.
{
  const params = new URLSearchParams(location.search);
  if (params.has("skip") || params.has("s")) {
    enterBtn.disabled = false;
    enterBtn.click();
    const s = Number(params.get("s") || 0);
    const jump = () => {
      if (s > 0) forcedProgress = s / (SECTIONS.length - 1);
      const wp = waypoints[s];
      camPos.copy(wp.pos);
      camTarget.copy(wp.target);
    };
    requestAnimationFrame(() => requestAnimationFrame(jump));
  }
}

// ---------------------------------------------------------------- music (generated ambient pad, no audio files)
let audio = null;
const musicBtn = document.getElementById("musicBtn");
musicBtn.addEventListener("click", () => {
  if (!audio) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 800;
    filter.Q.value = 0.7;
    filter.connect(master);
    master.connect(ctx.destination);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 350;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    const chords = [
      [220.0, 261.63, 329.63, 392.0],
      [174.61, 220.0, 261.63, 329.63],
      [196.0, 246.94, 293.66, 392.0],
      [164.81, 207.65, 246.94, 329.63],
    ];
    const voices = chords[0].map((f) => {
      const g = ctx.createGain();
      g.gain.value = 0.06;
      g.connect(filter);
      const oscs = [-6, 6].map((detune) => {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f;
        o.detune.value = detune;
        o.connect(g);
        o.start();
        return o;
      });
      return oscs;
    });
    let c = 0;
    setInterval(() => {
      c = (c + 1) % chords.length;
      voices.forEach((oscs, v) => oscs.forEach((o) => o.frequency.setTargetAtTime(chords[c][v], ctx.currentTime, 0.8)));
    }, 6000);
    audio = { ctx, master, on: false };
  }
  audio.on = !audio.on;
  audio.ctx.resume();
  audio.master.gain.cancelScheduledValues(audio.ctx.currentTime);
  audio.master.gain.setTargetAtTime(audio.on ? 0.22 : 0, audio.ctx.currentTime, 0.6);
  musicBtn.classList.toggle("on", audio.on);
});

// ---------------------------------------------------------------- bell toast + phone clock
const toast = document.getElementById("toast");
document.getElementById("bellBtn").addEventListener("click", () => toast.classList.toggle("show"));
function updateClock() {
  const now = new Date();
  document.getElementById("lockTime").textContent = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M/i, "");
  document.getElementById("lockDate").textContent = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}
updateClock();
setInterval(updateClock, 30000);

// ---------------------------------------------------------------- resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  cssRenderer.setSize(window.innerWidth, window.innerHeight);
  buildWaypoints();
});

// ---------------------------------------------------------------- render loop
const camPos = waypoints[0].pos.clone().add(new THREE.Vector3(3, 2.5, 5));
const camTarget = waypoints[0].target.clone();
const goalPos = new THREE.Vector3();
const goalTarget = new THREE.Vector3();
const clock = new THREE.Clock();
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function syncScreens() {
  for (const s of Object.values(screens)) {
    s.anchor.updateWorldMatrix(true, false);
    s.anchor.matrixWorld.decompose(s.css.position, s.css.quaternion, tmpScale);
    s.css.scale.setScalar(s.w / s.pxW);
  }
}

function frame(time) {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (lenis) lenis.raf(time);

  // scroll progress → waypoint pair (with a "hold" at each stop so screens can be read)
  const max = maxScroll();
  const progress = forcedProgress ?? (max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0);
  const f = progress * (waypoints.length - 1);
  const i = Math.min(Math.floor(f), waypoints.length - 2);
  const local = f - i;
  const e = easeInOut(Math.min(Math.max((local - 0.2) / 0.6, 0), 1));
  const a = waypoints[i];
  const b = waypoints[i + 1];
  goalPos.lerpVectors(a.pos, b.pos, e);
  goalTarget.lerpVectors(a.target, b.target, e);
  goalPos.y += Math.sin(e * Math.PI) * 0.18; // small arc between stops
  setActive(Math.round(f));

  // pointer parallax, scaled to how far the camera is from what it looks at
  smoothPointer.lerp(pointer, 0.05);
  const dist = goalPos.distanceTo(goalTarget);
  const right = new THREE.Vector3().subVectors(goalTarget, goalPos).cross(camera.up).normalize();
  goalPos.addScaledVector(right, smoothPointer.x * dist * 0.03);
  goalPos.y -= smoothPointer.y * dist * 0.02;

  const k = started ? 1 - Math.exp(-dt * (reduceMotion ? 20 : 4.5)) : 0;
  camPos.lerp(goalPos, k);
  camTarget.lerp(goalTarget, k);
  camera.position.copy(camPos);
  camera.lookAt(camTarget);

  // ambient animation
  carPivot.rotation.y = t * 0.25;
  redLight.intensity = 16 + Math.sin(t * 2) * 3;
  if (neon) {
    const flick = Math.random() > 0.985 ? 0.55 : 1;
    neon.sign.material.opacity = flick;
    neon.halo.material.opacity = 0.8 + Math.sin(t * 1.5) * 0.15;
  }
  papers.forEach((p) => {
    p.holder.position.y = Math.sin(t * 1.1 + p.phase) * (reduceMotion ? 0 : 0.03);
  });

  syncScreens();
  renderer.render(scene, camera);
  cssRenderer.render(cssScene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
