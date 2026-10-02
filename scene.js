import * as THREE from "three";

const canvas = document.getElementById("webgl");
const isMobile = window.matchMedia("(max-width: 860px)").matches;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Renderer / camera ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 8);

// ---------- Lights ----------
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
keyLight.position.set(4, 5, 6);
scene.add(keyLight);
const purpleLight = new THREE.PointLight(0x7c5cff, 40, 30);
purpleLight.position.set(-4, -2, 3);
scene.add(purpleLight);
const cyanLight = new THREE.PointLight(0x00d4ff, 40, 30);
cyanLight.position.set(4, 2, -2);
scene.add(cyanLight);

// ---------- Core: noise-displaced iridescent orb ----------
const noiseGLSL = /* glsl */ `
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
`;

const coreUniforms = {
  uTime: { value: 0 },
  uDistort: { value: 0.35 },
  uFreq: { value: 1.3 },
  uC1: { value: new THREE.Color("#7c5cff") },
  uC2: { value: new THREE.Color("#00d4ff") },
  uC3: { value: new THREE.Color("#ff5c8a") },
};

const coreMaterial = new THREE.ShaderMaterial({
  uniforms: coreUniforms,
  vertexShader: /* glsl */ `
    uniform float uTime; uniform float uDistort; uniform float uFreq;
    varying vec3 vNormal; varying vec3 vView; varying float vNoise;
    ${noiseGLSL}
    void main(){
      float n = snoise(normal * uFreq + uTime * 0.25);
      n += 0.5 * snoise(normal * uFreq * 2.3 - uTime * 0.15);
      vec3 p = position + normal * n * uDistort;
      vNoise = n;
      vNormal = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform float uTime;
    varying vec3 vNormal; varying vec3 vView; varying float vNoise;
    void main(){
      float fres = pow(1.0 - max(dot(normalize(vNormal), vView), 0.0), 2.2);
      vec3 col = mix(uC1, uC2, smoothstep(-0.8, 0.8, vNoise));
      col += 0.06 * sin(vNoise * 18.0 + uTime);
      col = mix(col, uC3, fres * 0.8);
      col += fres * 0.35;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});

const world = new THREE.Group();
scene.add(world);

const coreGroup = new THREE.Group();
world.add(coreGroup);

const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, isMobile ? 48 : 96), coreMaterial);
coreGroup.add(core);

const shell = new THREE.Mesh(
  new THREE.IcosahedronGeometry(2.1, 1),
  new THREE.MeshBasicMaterial({ color: 0x7c5cff, wireframe: true, transparent: true, opacity: 0.18 })
);
coreGroup.add(shell);

function makeRing(radius, color, tiltX, tiltY) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.012, 16, 200),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 })
  );
  ring.rotation.set(tiltX, tiltY, 0);
  coreGroup.add(ring);
  return ring;
}
const ring1 = makeRing(2.6, 0x00d4ff, Math.PI / 2.3, 0.3);
const ring2 = makeRing(3.0, 0x7c5cff, Math.PI / 1.8, -0.5);

// Small satellites riding the rings
const satGeo = new THREE.SphereGeometry(0.07, 16, 16);
const sat1 = new THREE.Mesh(satGeo, new THREE.MeshBasicMaterial({ color: 0x00d4ff }));
const sat2 = new THREE.Mesh(satGeo, new THREE.MeshBasicMaterial({ color: 0xff5c8a }));
ring1.add(sat1);
ring2.add(sat2);

// ---------- Floating geometric shapes ----------
const shapeGeos = [
  new THREE.OctahedronGeometry(0.35),
  new THREE.TorusGeometry(0.28, 0.1, 16, 48),
  new THREE.BoxGeometry(0.45, 0.45, 0.45),
  new THREE.TetrahedronGeometry(0.4),
  new THREE.TorusKnotGeometry(0.22, 0.07, 80, 12),
  new THREE.IcosahedronGeometry(0.3, 0),
];
const shapeColors = [0x7c5cff, 0x00d4ff, 0xff5c8a, 0xffb15c, 0x00c896];
const shapes = [];
const shapeCount = isMobile ? 10 : 18;
for (let i = 0; i < shapeCount; i++) {
  const mat = new THREE.MeshStandardMaterial({
    color: shapeColors[i % shapeColors.length],
    metalness: 0.55,
    roughness: 0.25,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(shapeGeos[i % shapeGeos.length], mat);
  // spread around the edges and keep them behind the content plane
  const side = i % 2 === 0 ? 1 : -1;
  mesh.position.set(side * (3.5 + Math.random() * 5), (Math.random() - 0.5) * 10, -3 - Math.random() * 7);
  mesh.userData = {
    baseY: mesh.position.y,
    speed: 0.3 + Math.random() * 0.6,
    phase: Math.random() * Math.PI * 2,
    spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(0.01),
  };
  mesh.scale.setScalar(0.6 + Math.random() * 0.6);
  world.add(mesh);
  shapes.push(mesh);
}

// ---------- Particle starfield ----------
const particleCount = isMobile ? 900 : 2200;
const positions = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) {
  const r = 6 + Math.random() * 18;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  positions[i * 3 + 2] = r * Math.cos(phi) - 6;
}
const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
const particleMat = new THREE.PointsMaterial({
  size: 0.035,
  color: 0xbfb4ff,
  transparent: true,
  opacity: 0.8,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const particles = new THREE.Points(particleGeo, particleMat);
scene.add(particles);

// ---------- Theme sync ----------
function applyTheme() {
  const light = document.documentElement.dataset.theme === "light";
  particleMat.color.set(light ? 0x5a3cff : 0xbfb4ff);
  particleMat.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
  particleMat.opacity = light ? 0.45 : 0.8;
  particleMat.needsUpdate = true;
  shell.material.opacity = light ? 0.3 : 0.18;
}
applyTheme();
new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

// ---------- Scroll-driven choreography ----------
// Each key is where the core sits while that section is in view.
const state = { x: isMobile ? 0 : 2.6, y: isMobile ? 1.6 : 0, z: 0, scale: isMobile ? 0.7 : 1.2, rotY: 0, rotX: 0, distort: 0.35, camZ: 8 };
const keys = isMobile
  ? [
      { x: 0, y: 1.6, scale: 0.7, rotY: 0, distort: 0.35 },
      { x: 1.2, y: 0, scale: 0.55, rotY: Math.PI * 0.6, distort: 0.5 },
      { x: -1.2, y: 0.5, scale: 0.6, rotY: Math.PI * 1.2, distort: 0.25 },
      { x: 0, y: -0.5, scale: 0.5, rotY: Math.PI * 1.8, distort: 0.6 },
      { x: 1.2, y: 0, scale: 0.55, rotY: Math.PI * 2.4, distort: 0.3 },
      { x: 0, y: 0, scale: 0.8, rotY: Math.PI * 3, distort: 0.45 },
    ]
  : [
      { x: 2.6, y: 0, scale: 1.2, rotY: 0, rotX: 0, distort: 0.35, camZ: 8 },
      { x: -3.4, y: 0.3, scale: 0.75, rotY: Math.PI * 0.6, rotX: 0.3, distort: 0.55, camZ: 8.5 },
      { x: 3.6, y: -0.2, scale: 0.7, rotY: Math.PI * 1.2, rotX: -0.2, distort: 0.25, camZ: 9 },
      { x: 0, y: 2.6, scale: 0.6, rotY: Math.PI * 1.8, rotX: 0.4, distort: 0.7, camZ: 10 },
      { x: -3.4, y: -0.4, scale: 0.75, rotY: Math.PI * 2.4, rotX: 0, distort: 0.3, camZ: 8.5 },
      { x: 2.8, y: 0, scale: 0.9, rotY: Math.PI * 3, rotX: 0.2, distort: 0.45, camZ: 8 },
    ];

function buildScrollTimeline() {
  if (!window.gsap || !window.ScrollTrigger) return;
  const sectionEls = ["#home", "#journey", "#skills", "#projects", "#faq", "#contact"].map((s) => document.querySelector(s));
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const stops = sectionEls.map((el) => Math.min(Math.max(el.offsetTop / maxScroll, 0), 1));

  const tl = gsap.timeline({
    scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 1.2 },
  });
  for (let i = 1; i < keys.length; i++) {
    tl.to(state, { ...keys[i], duration: Math.max(stops[i] - stops[i - 1], 0.001), ease: "power1.inOut" }, stops[i - 1]);
  }
  // pad the timeline so positions map 1:1 to scroll progress
  tl.set({}, {}, 1);
}

// ---------- Pointer parallax ----------
const pointer = { x: 0, y: 0 };
const smoothPointer = { x: 0, y: 0 };
window.addEventListener("pointermove", (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
});

// ---------- Resize ----------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// ---------- Render loop ----------
const clock = new THREE.Clock();
const speed = reduceMotion ? 0.2 : 1;
let intro = 0; // 0 → 1 entrance scale-up after the loader

function render() {
  const t = clock.getElapsedTime() * speed;
  intro += (1 - intro) * 0.04;

  coreUniforms.uTime.value = t;
  coreUniforms.uDistort.value = state.distort;

  smoothPointer.x += (pointer.x - smoothPointer.x) * 0.05;
  smoothPointer.y += (pointer.y - smoothPointer.y) * 0.05;

  coreGroup.position.set(state.x, state.y + Math.sin(t * 0.8) * 0.12, state.z);
  coreGroup.scale.setScalar(state.scale * intro);
  coreGroup.rotation.y = state.rotY + t * 0.15 + smoothPointer.x * 0.4;
  coreGroup.rotation.x = state.rotX + smoothPointer.y * 0.3;

  shell.rotation.x = t * 0.1;
  shell.rotation.z = -t * 0.08;
  ring1.rotation.z = t * 0.4;
  ring2.rotation.z = -t * 0.3;
  sat1.position.set(Math.cos(t * 1.2) * 2.6, Math.sin(t * 1.2) * 2.6, 0);
  sat2.position.set(Math.cos(-t * 0.9) * 3.0, Math.sin(-t * 0.9) * 3.0, 0);

  shapes.forEach((m) => {
    const d = m.userData;
    m.position.y = d.baseY + Math.sin(t * d.speed + d.phase) * 0.4;
    m.rotation.x += d.spin.x * speed;
    m.rotation.y += d.spin.y * speed;
    m.rotation.z += d.spin.z * speed;
  });

  // whole world drifts against the pointer for depth
  world.rotation.y = smoothPointer.x * 0.12;
  world.rotation.x = smoothPointer.y * 0.06;
  world.position.y = (window.scrollY / window.innerHeight) * 0.15;

  particles.rotation.y = t * 0.02 + smoothPointer.x * 0.05;
  particles.rotation.x = smoothPointer.y * 0.03;

  camera.position.z += (state.camZ - camera.position.z) * 0.08;
  camera.position.x += (smoothPointer.x * 0.4 - camera.position.x) * 0.05;
  camera.position.y += (-smoothPointer.y * 0.3 - camera.position.y) * 0.05;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

// ---------- Smooth scroll (Lenis) + GSAP ----------
function initMotion() {
  if (!window.gsap) return;
  gsap.registerPlugin(ScrollTrigger);

  if (window.Lenis && !reduceMotion) {
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    window.lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]').forEach((a) =>
      a.addEventListener("click", (e) => {
        const target = document.querySelector(a.getAttribute("href"));
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: a.classList.contains("skip-link") ? 0 : -70 });
      })
    );
  }

  buildScrollTimeline();

  // Hero headline: letters flip in on a 3D axis
  const h1 = document.querySelector(".hero h1");
  if (h1 && !reduceMotion) {
    splitLetters(h1);
    gsap.from(h1.querySelectorAll(".char"), {
      yPercent: 110,
      rotateX: -90,
      opacity: 0,
      stagger: 0.035,
      duration: 0.9,
      ease: "back.out(1.6)",
      delay: 1.5,
    });
  }

  // Section headings rise with depth
  gsap.utils.toArray(".section-head h2").forEach((el) => {
    gsap.from(el, {
      rotateX: -50,
      y: 40,
      opacity: 0,
      transformPerspective: 800,
      transformOrigin: "50% 100%",
      duration: 1,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 85%" },
    });
  });

  window.addEventListener("load", () => ScrollTrigger.refresh());
}

// Wrap each letter in a span while keeping the gradient span intact.
function splitLetters(el) {
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        [...child.textContent].forEach((ch) => {
          const span = document.createElement("span");
          span.className = "char";
          span.textContent = ch === " " ? " " : ch;
          frag.appendChild(span);
        });
        child.replaceWith(frag);
      } else {
        walk(child);
      }
    });
  };
  walk(el);
}

// ---------- 3D tilt on cards ----------
function initTilt() {
  if (reduceMotion || window.matchMedia("(hover: none)").matches) return;
  document.querySelectorAll(".tilt").forEach((card) => {
    card.addEventListener("pointerenter", () => {
      card.style.transition = "transform 0.15s ease-out, border-color 0.3s, box-shadow 0.3s";
    });
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.transform = `perspective(1000px) rotateX(${(0.5 - py) * 12}deg) rotateY(${(px - 0.5) * 14}deg) translateZ(10px)`;
      card.style.setProperty("--gx", `${px * 100}%`);
      card.style.setProperty("--gy", `${py * 100}%`);
    });
    card.addEventListener("pointerleave", () => {
      card.style.transition = "transform 0.6s cubic-bezier(.2,.8,.2,1), border-color 0.3s, box-shadow 0.3s";
      card.style.transform = "";
    });
  });
}

initMotion();
initTilt();
render();
