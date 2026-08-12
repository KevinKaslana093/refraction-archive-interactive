const loader = document.querySelector('[data-loader]');
const progress = document.querySelector('[data-progress]');
const percent = document.querySelector('[data-percent]');
const status = document.querySelector('[data-status]');
const skip = document.querySelector('[data-skip]');
const mode = document.querySelector('[data-mode]');
const modeLabel = document.querySelector('[data-mode-label]');
const distance = document.querySelector('[data-distance]');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let loaderTimer;
let value = 0;
const returning = sessionStorage.getItem('refraction-visited') === 'yes';
const duration = returning ? 650 : 2700;
const statuses = ['校准观察距离', '收集表面光线', '建立空间关系', '准备显影'];

function finishLoader() {
  clearInterval(loaderTimer);
  progress.style.width = '100%';
  percent.textContent = '100';
  status.textContent = '观察窗口已开启';
  setTimeout(() => {
    loader.classList.add('is-gone');
    document.body.classList.add('entered');
    sessionStorage.setItem('refraction-visited', 'yes');
  }, reducedMotion ? 0 : 260);
}

function startLoader() {
  loader.classList.remove('is-gone');
  value = 0;
  progress.style.width = '0';
  const started = performance.now();
  loaderTimer = setInterval(() => {
    const elapsed = performance.now() - started;
    value = Math.min(100, Math.round((elapsed / duration) * 100));
    progress.style.width = `${value}%`;
    percent.textContent = String(value).padStart(2, '0');
    status.textContent = statuses[Math.min(3, Math.floor(value / 25))];
    if (value >= 100) finishLoader();
  }, 34);
}

skip.addEventListener('click', finishLoader);
document.querySelector('[data-replay]').addEventListener('click', () => {
  scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  setTimeout(startLoader, reducedMotion ? 0 : 500);
});

mode.addEventListener('click', () => {
  const active = document.body.classList.toggle('revealed');
  mode.setAttribute('aria-pressed', String(active));
  modeLabel.textContent = active ? '观察模式' : '显影模式';
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add('is-visible');
  });
}, { threshold: 0.18 });

document.querySelectorAll('[data-scene]').forEach((scene) => observer.observe(scene));

let ticking = false;
addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const y = scrollY;
    const orbital = document.querySelector('.orbital');
    orbital.style.transform = `translate3d(0, ${y * .09}px, 0) rotate(${y * .012}deg)`;
    const manifesto = document.querySelector('.manifesto');
    const rect = manifesto.getBoundingClientRect();
    if (rect.top < innerHeight && rect.bottom > 0) {
      const amount = Math.max(0, Math.min(1, (innerHeight - rect.top) / (innerHeight + rect.height)));
      distance.textContent = String(Math.round(72 - amount * 51)).padStart(3, '0');
    }
    ticking = false;
  });
}, { passive: true });

startLoader();
