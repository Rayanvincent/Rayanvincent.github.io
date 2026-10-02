// Loader
document.body.classList.add("loading");
window.addEventListener("load", () => {
  setTimeout(() => {
    document.getElementById("loader").classList.add("done");
    document.body.classList.remove("loading");
  }, 1300);
});

// Theme toggle (remembered per browser)
const root = document.documentElement;
try {
  const saved = localStorage.getItem("theme");
  if (saved) root.dataset.theme = saved;
} catch (e) {}
document.getElementById("themeToggle").addEventListener("click", () => {
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
});

// Nav: scrolled state + mobile menu
const nav = document.getElementById("nav");
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");
window.addEventListener("scroll", () => nav.classList.toggle("scrolled", window.scrollY > 20));
menuBtn.addEventListener("click", () => {
  menuBtn.classList.toggle("open");
  navLinks.classList.toggle("open");
});
navLinks.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    menuBtn.classList.remove("open");
    navLinks.classList.remove("open");
  })
);

// Active nav link on scroll
const sections = document.querySelectorAll("main section[id]");
const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.querySelectorAll("a").forEach((a) =>
        a.classList.toggle("active", a.getAttribute("href") === `#${entry.target.id}`)
      );
    });
  },
  { rootMargin: "-50% 0px -50% 0px" }
);
sections.forEach((s) => sectionObserver.observe(s));

// Typing effect
const roles = ["Software Engineer", "Full Stack Developer", "Frontend Specialist", "Problem Solver"];
const typed = document.getElementById("typed");
let roleIdx = 0, charIdx = roles[0].length, deleting = true;
function type() {
  const word = roles[roleIdx];
  typed.textContent = word.slice(0, charIdx);
  if (deleting) {
    charIdx--;
    if (charIdx < 0) { deleting = false; roleIdx = (roleIdx + 1) % roles.length; charIdx = 0; }
  } else {
    charIdx++;
    if (charIdx > roles[roleIdx].length) { deleting = true; setTimeout(type, 1800); return; }
  }
  setTimeout(type, deleting ? 45 : 90);
}
setTimeout(type, 3000);

// Count-up stats
function countUp(el) {
  const target = +el.dataset.count;
  const start = performance.now();
  const duration = 1600;
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// Reveal on scroll
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible");
      entry.target.querySelectorAll("[data-count]").forEach(countUp);
      revealObserver.unobserve(entry.target);
    });
  },
  { threshold: 0.15 }
);
document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

// FAQ filter tabs
document.querySelectorAll(".tab").forEach((tab) =>
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const filter = tab.dataset.filter;
    document.querySelectorAll(".faq").forEach((f) =>
      f.classList.toggle("hidden", filter !== "all" && f.dataset.cat !== filter)
    );
  })
);

// Contact form: opens the visitor's email client (no backend needed)
document.getElementById("contactForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  const subject = encodeURIComponent(data.get("subject") || `Message from ${data.get("name")}`);
  const body = encodeURIComponent(`${data.get("message")}\n\n— ${data.get("name")} (${data.get("email")})`);
  window.location.href = `mailto:rayan@example.com?subject=${subject}&body=${body}`;
  document.getElementById("formNote").textContent = "Opening your email client…";
});

document.getElementById("year").textContent = new Date().getFullYear();
