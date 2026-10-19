import fs from "fs";
import path from "path";

const ROOT = path.resolve("C:\\Users\\Пользователь\\Desktop\\site-cheat-base");
const OUT = path.resolve("C:\\Users\\Пользователь\\Desktop\\site-cheat-base-upload");
const EXPORT_CSS = path.join(ROOT, "out", "_next", "static", "chunks", "6389f605cfe977a5.css");
const EXPORT_MEDIA = path.join(ROOT, "out", "_next", "static", "media");
const PUBLIC = path.join(ROOT, "public");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function write(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content, "utf8");
}

function readCompiledCss() {
  let css = fs.readFileSync(EXPORT_CSS, "utf8");
  css = css.replace(/url\(\.\.\/media\//g, "url(assets/fonts/");
  css = css.replace(/url\(\/bg\.gif\)/g, "url(assets/bg.gif)");
  return css;
}

function splitCss(fullCss) {
  const animationPatterns = [
    /@keyframes[\s\S]*?\}/g,
    /\.animate-spin[\s\S]*?\}/g,
    /\.reveal[\s\S]*?\}/g,
    /\.reveal-visible[\s\S]*?\}/g,
    /\.loader[\s\S]*?\}/g,
    /\.cursor-ring[\s\S]*?\}/g,
    /\.cursor-dot[\s\S]*?\}/g,
    /\.fade-in[\s\S]*?\}/g,
    /\.tilt-card[\s\S]*?\}/g,
  ];

  let animationCss = `/* Animations & motion */\n`;
  for (const pattern of animationPatterns) {
    const matches = fullCss.match(pattern);
    if (matches) animationCss += matches.join("\n") + "\n";
  }

  animationCss += `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(40px); filter: blur(6px); }
  to { opacity: 1; transform: translateY(0); filter: blur(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes loaderSpin {
  to { transform: rotate(360deg); }
}
.reveal {
  opacity: 0;
  transform: translateY(40px);
  filter: blur(6px);
  transition: opacity 0.7s ease, transform 0.7s ease, filter 0.7s ease;
}
.reveal-scale {
  opacity: 0;
  transform: scale(0.9);
  transition: opacity 0.8s ease, transform 0.8s ease;
}
.reveal-visible,
.reveal-scale.reveal-visible {
  opacity: 1;
  transform: none;
  filter: none;
}
.loader-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  transition: opacity 0.5s ease;
}
.loader-overlay.hidden {
  opacity: 0;
  pointer-events: none;
}
.loader-spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 4px solid rgba(255, 255, 255, 0.2);
  border-top-color: #fff;
  border-radius: 9999px;
  animation: loaderSpin 1.2s linear infinite;
}
.cursor-wrap {
  pointer-events: none;
  position: fixed;
  inset: 0;
  z-index: 9999;
}
.cursor-ring,
.cursor-dot {
  position: absolute;
  top: 0;
  left: 0;
  translate: -50% -50%;
  transition: width 0.2s, height 0.2s, border-color 0.2s, transform 0.15s;
}
.cursor-ring {
  border: 1px solid rgba(255, 255, 255, 0.45);
  border-radius: 9999px;
  width: 34px;
  height: 34px;
}
.cursor-ring.hover {
  width: 52px;
  height: 52px;
  border-color: rgba(196, 160, 255, 0.9);
}
.cursor-ring.pressed { transform: scale(0.8); }
.cursor-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: #fff;
}
.cursor-dot.hover { transform: scale(0); }
.cursor-dot.pressed { transform: scale(1.6); }
.tilt-card {
  transition: transform 0.2s ease;
  transform-style: preserve-3d;
}
`;

  const styleCss = fullCss.replace(/@keyframes[\s\S]*?\}/g, "").replace(/\.animate-spin[\s\S]*?\}/g, "");
  return { styleCss, animationCss };
}

function head(title) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — Stellar Client</title>
  <meta name="description" content="Stellar Client" />
  <link rel="icon" href="assets/favicon.ico" />
  <link rel="stylesheet" href="style.css" />
  <link rel="stylesheet" href="animation.css" />
</head>`;
}

function header(active = "") {
  const cls = (page) => (active === page ? "text-white" : "");
  return `
  <header class="site-header fixed top-0 left-0 z-[25] h-20 w-full px-10 backdrop-blur-xl bg-black/60 border-b border-white/10">
    <div class="mx-auto flex w-full max-w-6xl items-center justify-center gap-24 py-4">
      <div class="flex items-center gap-16">
        <a href="index.html" class="flex items-center gap-3 transition hover:opacity-100">
          <img src="assets/icon.png" alt="Stellar Client" width="45" height="45" />
        </a>
        <nav class="flex items-center gap-12 text-white/85">
          <a href="index.html" class="flex items-center gap-2 group ${cls("home")}">
            <span class="text-sm group-hover:text-white transition">Главная</span>
          </a>
          <a href="pricing.html" class="flex items-center gap-2 group ${cls("pricing")}">
            <span class="text-sm group-hover:text-white transition">Купить</span>
          </a>
          <a href="faq.html" class="flex items-center gap-2 group ${cls("faq")}">
            <span class="text-sm group-hover:text-white transition">FAQ</span>
          </a>
        </nav>
      </div>
      <a href="login.html" class="text-white text-sm font-medium px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-xl">Вход</a>
    </div>
  </header>`;
}

function footer() {
  const year = new Date().getFullYear();
  return `
  <footer class="w-full relative bg-black/50 backdrop-blur-md border-t border-white/10 overflow-hidden">
    <div class="relative z-10 px-48 py-20 flex justify-between items-start text-white/70">
      <div class="flex flex-col gap-3 max-w-xs">
        <h3 class="text-xl font-semibold text-white">Stellar Client</h3>
        <p class="text-sm text-white/50 leading-relaxed">© ${year} Stellar Client.<br />Все права защищены.</p>
      </div>
      <div class="flex gap-20">
        <div class="flex flex-col gap-3">
          <h4 class="text-lg font-semibold text-white">Платформа</h4>
          <a href="index.html" class="text-white/60 hover:text-purple-300 transition">Главная</a>
          <a href="pricing.html" class="text-white/60 hover:text-purple-300 transition">Покупка</a>
          <a href="faq.html" class="text-white/60 hover:text-purple-300 transition">FAQ</a>
        </div>
        <div class="flex flex-col gap-3">
          <h4 class="text-lg font-semibold text-white">Аккаунт</h4>
          <a href="login.html" class="text-white/60 hover:text-purple-300 transition">Вход</a>
          <a href="register.html" class="text-white/60 hover:text-purple-300 transition">Регистрация</a>
        </div>
        <div class="flex flex-col gap-3">
          <h4 class="text-lg font-semibold text-white">Контакты</h4>
          <a href="https://t.me/Stellar1DLC" target="_blank" rel="noopener noreferrer" class="text-white/60 hover:text-purple-300 transition">Telegram</a>
          <a href="https://discord.gg/8dkVx9FfH" target="_blank" rel="noopener noreferrer" class="text-white/60 hover:text-purple-300 transition">Discord</a>
        </div>
        <div class="flex flex-col gap-3">
          <h4 class="text-lg font-semibold text-white">Правовое</h4>
          <a href="#" class="text-white/60 hover:text-purple-300 transition">Лицензионное соглашение</a>
        </div>
      </div>
    </div>
  </footer>`;
}

function loader() {
  return `
  <div id="loader" class="loader-overlay">
    <img src="assets/icon.png" alt="Icon" width="140" height="140" class="mb-6" />
    <div class="loader-spinner"></div>
  </div>`;
}

function cursor() {
  return `
  <div id="cursor-wrap" class="cursor-wrap hidden">
    <div id="cursor-ring" class="cursor-ring"></div>
    <div id="cursor-dot" class="cursor-dot"></div>
  </div>`;
}

function gridBg() {
  return `
  <div class="absolute inset-0 z-0 [background-size:40px_40px] [background-image:linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)]"></div>
  <div class="pointer-events-none absolute inset-0 z-[1] bg-black/60 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>`;
}

function featureCard(title, desc) {
  return `
  <div class="tilt-card w-full max-w-md">
    <div class="group relative border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] rounded-2xl p-6 overflow-hidden transition-colors">
      <div class="flex items-center gap-3 mb-3 text-white">
        <span class="grid place-items-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white/80 group-hover:text-purple-300 group-hover:scale-110 transition-transform">★</span>
        <h3 class="text-xl font-semibold">${title}</h3>
      </div>
      <p class="text-white/70 leading-relaxed text-sm">${desc}</p>
    </div>
  </div>`;
}

function indexHtml() {
  return `${head("Главная")}
<body class="antialiased">
${loader()}${cursor()}${header("home")}
<main id="main-content" class="text-white relative z-10 hidden">
  <section class="min-h-screen px-48 flex items-center relative">
    ${gridBg()}
    <div class="relative z-[2] w-full flex items-center gap-20">
      <div class="reveal w-1/2 pr-8">
        <h1 class="text-7xl font-extrabold leading-tight mb-6">О нас</h1>
        <p class="text-xl text-white/60 max-w-md mb-12">Мы создаём игровой клиент нового поколения, ориентированный на скорость, стабильность и премиальный пользовательский опыт. Больше FPS. Современные модули. Ноль отвлекающих факторов.</p>
        <div class="grid grid-cols-2 gap-6 mb-14">
          <div><p class="text-4xl font-bold">50+</p><p class="text-white/50">Активные пользователи</p></div>
          <div><p class="text-4xl font-bold">30%+</p><p class="text-white/50">Больше FPS</p></div>
          <div><p class="text-4xl font-bold">24/7</p><p class="text-white/50">Поддержка</p></div>
        </div>
      </div>
      <div class="reveal-scale w-1/2 flex justify-end">
        <img src="assets/icon.png" alt="Hero" width="650" height="650" class="drop-shadow-[0_0_70px_rgba(255,40,150,0.45)] select-none" />
      </div>
    </div>
  </section>
  <section class="min-h-screen flex items-center px-48 relative">
    <div class="reveal-scale w-1/2 flex justify-start relative">
      <div class="-ml-24 rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/20">
        <img src="assets/chat.jpg" width="840" height="840" alt="Chat Screenshot" class="rounded-2xl" />
      </div>
    </div>
    <div class="reveal w-1/2 pl-20">
      <h1 class="text-6xl font-extrabold mb-10">Наши преимущества</h1>
      <div class="grid grid-cols-2 gap-8">
        ${featureCard("Beautiful Visuals", "Чистые эффекты, отточенный интерфейс и современный стиль.")}
        ${featureCard("Fully Customizable", "Настраивай модули, визуалы, интерфейс и эффекты именно так, как хочешь.")}
        ${featureCard("High Performance", "Плавный геймплей, оптимизированный FPS, стабильная работа.")}
        ${featureCard("Frequent Updates", "Новые функции, улучшения и исправления багов на постоянной основе.")}
      </div>
    </div>
  </section>
  <section class="min-h-screen flex items-center justify-center px-48 relative">
    <div class="reveal w-full flex flex-col items-center justify-center">
      <h1 class="text-6xl font-extrabold mb-12 text-center">Демонстрация геймплея</h1>
      <div class="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
        <iframe class="rounded-2xl w-full h-[450px]" src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Gameplay Video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      </div>
    </div>
  </section>
  ${footer()}
</main>
<script src="script.js"></script>
</body></html>`;
}

function pricingHtml() {
  const card = (title, price) => `
  <div class="tilt-card w-[300px]">
    <div class="group bg-[#1a1a1a]/60 backdrop-blur-xl rounded-3xl p-6 w-full flex flex-col shadow-xl shadow-black/40 border border-white/10 hover:border-purple-400/40 transition-colors">
      <div class="rounded-2xl overflow-hidden mb-5">
        <img src="assets/pricing.jpg" alt="${title}" width="400" height="400" class="rounded-2xl transition-transform duration-500 group-hover:scale-105" />
      </div>
      <h2 class="text-xl font-semibold text-white mb-1">${title}</h2>
      <p class="text-sm text-white/60 mb-6">Цена: ${price}</p>
      <button class="w-full py-3 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-500 transition-colors">Купить</button>
    </div>
  </div>`;

  return `${head("Купить")}
<body class="antialiased">${cursor()}${header("pricing")}
<main class="text-white min-h-screen relative overflow-hidden">
  <section class="relative z-10 pt-48 pb-40 flex flex-col items-center px-6">
    <h1 class="reveal text-6xl font-extrabold mb-20 text-center">Купить</h1>
    <div class="flex flex-wrap gap-14 justify-center">
      ${card("30 дней", "109 rubles")}
      ${card("Half year", "169 rubles")}
      ${card("Forever", "299 rubles")}
    </div>
  </section>
  ${footer()}
</main>
<script src="script.js"></script>
</body></html>`;
}

function faqHtml() {
  const item = (q, a) => `
  <div class="reveal w-full max-w-4xl p-8 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/10 text-white mb-10">
    <h2 class="text-2xl font-bold mb-4">${q}</h2>
    <p class="text-white/80 leading-relaxed">${a}</p>
  </div>`;

  return `${head("FAQ")}
<body class="antialiased">${cursor()}${header("faq")}
<main class="relative min-h-screen text-white overflow-hidden">
  <div class="absolute inset-0 -z-20 opacity-40"><img src="assets/fluid1.png" alt="" class="w-full h-full object-cover" /></div>
  <div class="absolute inset-0 -z-30 opacity-30"><img src="assets/fluid2.png" alt="" class="w-full h-full object-cover" /></div>
  <section class="relative z-10 pt-40 pb-32 flex flex-col items-center px-6">
    <h1 class="reveal text-6xl font-extrabold mb-16 text-center">FAQ</h1>
    ${item("Как запустить клиент?", "Сначала скачайте лаунчер и откройте его. В появившемся окне вы увидите поле, где можно задать выделение оперативной памяти. Рекомендуем выделять не больше 8 ГБ. После этого нажмите кнопку «Старт» и дождитесь загрузки клиента.")}
    ${item("Как загрузить конфиг в клиент?", "Чтобы загрузить конфиг, сначала запустите клиент хотя бы один раз. Затем перейдите в директорию: C:\\StellarClient\\beta\\client\\configs и поместите ваш файл конфига .euphoria в эту папку.")}
    ${item("Как создать собственный скрипт для клиента?", "Чтобы создать свой скрипт, сначала нужно прочитать документацию. В ней есть примеры использования, хуки событий и описание API. Обязательно следуйте рекомендациям по разработке, чтобы обеспечить совместимость.")}
    ${item("Как связаться с техподдержкой?", "Есть два способа связаться с поддержкой. Первый — открыть тикет на нашем Discord-сервере в канале Support. Второй — написать в нашу группу VK. Поддержка обычно отвечает в течение 24 часов.")}
  </section>
  ${footer()}
</main>
<script src="script.js"></script>
</body></html>`;
}

function authFormHtml(title, subtitle, fields, submit, altText, altHref) {
  const inputs = fields
    .map(
      (f) => `<input type="${f.type}" name="${f.name}" placeholder="${f.placeholder}" required class="bg-black/40 px-5 py-4 rounded-xl border border-white/10 focus:border-purple-500 outline-none" />`
    )
    .join("\n");

  return `${head(title)}
<body class="antialiased">${cursor()}${header()}
<main class="min-h-screen w-full text-white relative overflow-hidden flex items-center justify-center px-6 pt-32">
  ${gridBg()}
  <div class="absolute inset-0 z-10 bg-gradient-to-b from-black/40 via-black/70 to-black/90 pointer-events-none"></div>
  <div class="relative z-20 w-full max-w-lg bg-black/30 backdrop-blur-xl rounded-3xl border border-white/10 p-10 shadow-2xl">
    <h1 class="text-4xl font-bold text-center mb-3">${title}</h1>
    <p class="text-center text-white/60 mb-10">${subtitle}</p>
    <form id="auth-form" class="flex flex-col gap-5" data-static-message="Форма работает только на сервере с backend API. Для демо используйте исходный Next.js проект.">
      ${inputs}
      <p id="form-error" class="text-red-400 text-sm text-center hidden"></p>
      <button type="submit" class="mt-4 py-4 rounded-xl font-semibold transition bg-purple-600 hover:bg-purple-700">${submit}</button>
      <p class="text-center mt-3 text-white/50">${altText} <a href="${altHref}" class="text-purple-400 hover:text-purple-300">${altHref.includes('register') ? 'Регистрация' : 'Войти'}</a></p>
    </form>
  </div>
  ${footer()}
</main>
<script src="script.js"></script>
</body></html>`;
}

const scriptJs = `(() => {
  const loader = document.getElementById('loader');
  const main = document.getElementById('main-content');
  if (loader && main) {
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      loader.classList.add('hidden');
      main.classList.remove('hidden');
      document.body.style.overflow = '';
      setTimeout(() => loader.remove(), 500);
    }, 1000);
  }

  const wrap = document.getElementById('cursor-wrap');
  const ring = document.getElementById('cursor-ring');
  const dot = document.getElementById('cursor-dot');
  if (wrap && ring && dot && !window.matchMedia('(pointer: coarse)').matches) {
    wrap.classList.remove('hidden');
    document.body.classList.add('custom-cursor');
    let mx = -100, my = -100, rx = -100, ry = -100, dx = -100, dy = -100;
    const lerp = (a, b, t) => a + (b - a) * t;
    const move = (e) => {
      mx = e.clientX; my = e.clientY;
      const el = e.target;
      const hover = !!(el && el.closest && el.closest('a, button, input, [role="button"], .cursor-pointer'));
      ring.classList.toggle('hover', hover);
      dot.classList.toggle('hover', hover);
    };
    const down = () => { ring.classList.add('pressed'); dot.classList.add('pressed'); };
    const up = () => { ring.classList.remove('pressed'); dot.classList.remove('pressed'); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mousedown', down);
    window.addEventListener('mouseup', up);
    const tick = () => {
      rx = lerp(rx, mx, 0.35); ry = lerp(ry, my, 0.35);
      dx = lerp(dx, mx, 0.85); dy = lerp(dy, my, 0.85);
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px)';
      dot.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      requestAnimationFrame(tick);
    };
    tick();
  }

  const revealEls = document.querySelectorAll('.reveal, .reveal-scale');
  if (revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach((el) => io.observe(el));
  }

  document.querySelectorAll('.tilt-card').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = 'perspective(1000px) rotateX(' + (-py * 8) + 'deg) rotateY(' + (px * 8) + 'deg) scale(1.03) translateY(-6px)';
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });

  const authForm = document.getElementById('auth-form');
  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const err = document.getElementById('form-error');
      if (err) {
        err.textContent = authForm.dataset.staticMessage || 'Статическая версия: backend недоступен.';
        err.classList.remove('hidden');
      }
    });
  }
})();`;

function mainBuild() {
  if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
  ensureDir(OUT);
  ensureDir(path.join(OUT, "assets", "fonts"));

  const fullCss = readCompiledCss();
  const { styleCss, animationCss } = splitCss(fullCss);
  write(path.join(OUT, "style.css"), styleCss);
  write(path.join(OUT, "animation.css"), animationCss);
  write(path.join(OUT, "script.js"), scriptJs);

  write(path.join(OUT, "index.html"), indexHtml());
  write(path.join(OUT, "pricing.html"), pricingHtml());
  write(path.join(OUT, "faq.html"), faqHtml());
  write(
    path.join(OUT, "login.html"),
    authFormHtml("Вход", "Войдите в аккаунт", [
      { type: "text", name: "login", placeholder: "Email или имя пользователя" },
      { type: "password", name: "password", placeholder: "Пароль" },
    ], "Войти", "Нет аккаунта?", "register.html")
  );
  write(
    path.join(OUT, "register.html"),
    authFormHtml("Регистрация", "Создайте новый аккаунт", [
      { type: "email", name: "email", placeholder: "Email" },
      { type: "text", name: "username", placeholder: "Имя пользователя" },
      { type: "password", name: "password", placeholder: "Пароль" },
    ], "Создать аккаунт", "Уже есть аккаунт?", "login.html")
  );

  const assetFiles = ["bg.gif", "chat.jpg", "fluid1.png", "fluid2.png", "icon.png", "pricing.jpg"];
  for (const file of assetFiles) {
    copyFile(path.join(PUBLIC, file), path.join(OUT, "assets", file));
  }
  copyFile(path.join(ROOT, "out", "favicon.ico"), path.join(OUT, "assets", "favicon.ico"));

  if (fs.existsSync(EXPORT_MEDIA)) {
    for (const file of fs.readdirSync(EXPORT_MEDIA)) {
      if (file.endsWith(".woff2")) {
        copyFile(path.join(EXPORT_MEDIA, file), path.join(OUT, "assets", "fonts", file));
      }
    }
  }

  const files = [];
  const walk = (dir, base = "") => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = base ? base + "/" + entry.name : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, rel);
      else files.push({ rel, size: fs.statSync(full).size });
    }
  };
  walk(OUT);
  const totalSize = files.reduce((s, f) => s + f.size, 0);
  console.log(JSON.stringify({ out: OUT, fileCount: files.length, totalSize, files }, null, 2));
}

mainBuild();
