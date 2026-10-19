const fs = require("fs");
const path = require("path");

const SRC = __dirname;
const OUT = path.join(SRC, "..", "site-cheat-base-upload");
const ASSETS = path.join(OUT, "assets");

const REFERENCED_ASSETS = [
  "icon.png",
  "bg.gif",
  "chat.jpg",
  "pricing.jpg",
  "fluid1.png",
  "fluid2.png",
];

const ICONS = {
  house: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256"><path d="M224,115.55V208a16,16,0,0,1-16,16H168a16,16,0,0,1-16-16V168a8,8,0,0,0-8-8H112a8,8,0,0,0-8,8v40a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V115.55a16,16,0,0,1,5.17-11.78l80-75.48.11-.11a16,16,0,0,1,21.53,0l1.08,1,80,75.48A16,16,0,0,1,224,115.55Z"/></svg>`,
  cart: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256"><path d="M239.89,198.12l-14.26-120a16,16,0,0,0-16-14.12H116.16L104.66,34.8A16,16,0,0,0,88.69,24H32A16,16,0,0,0,16,40a16,16,0,0,0,16,16h48.44l11.51,68.8a16,16,0,0,0,16,13.2h92.49l12.51,105.64a8,8,0,0,1-7.94,8.91H64a8,8,0,0,1,0-16H208a16,16,0,0,0,15.89-17.88Z"/></svg>`,
  question: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z"/></svg>`,
  eye: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="currentColor" viewBox="0 0 256 256"><path d="M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.84,141.46,192.43,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z"/></svg>`,
  sliders: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="currentColor" viewBox="0 0 256 256"><path d="M200,112a32,32,0,1,1-32-32A32,32,0,0,1,200,112Zm-32-16a16,16,0,1,0,16,16A16,16,0,0,0,168,96ZM88,64A32,32,0,1,0,120,96,32,32,0,0,0,88,64Zm0,48a16,16,0,1,1,16-16A16,16,0,0,1,88,112Zm104,48a32,32,0,1,0,32,32A32,32,0,0,0,192,160Zm0,48a16,16,0,1,1,16-16A16,16,0,0,1,192,208ZM88,160a32,32,0,1,0,32,32A32,32,0,0,0,88,160Zm0,48a16,16,0,1,1,16-16A16,16,0,0,1,88,208Z"/></svg>`,
  gauge: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="currentColor" viewBox="0 0 256 256"><path d="M128,56a72,72,0,1,0,72,72A72.08,72.08,0,0,0,128,56Zm0,128a56,56,0,1,1,56-56A56.06,56.06,0,0,1,128,184Zm40-56a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,128Z"/></svg>`,
  refresh: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="currentColor" viewBox="0 0 256 256"><path d="M240,56v48a8,8,0,0,1-8,8H184a8,8,0,0,1,0-16H211.4L184.77,71.39A88,88,0,0,0,48,96a8,8,0,0,1-16,0,104,104,0,0,1,177.29-72.59L224,56H184a8,8,0,0,1,0-16h48A8,8,0,0,1,240,56Zm-8,96a8,8,0,0,1,16,0,104,104,0,0,1-177.29,72.59L32,200h40a8,8,0,0,1,0,16H24a8,8,0,0,1-8-8V160a8,8,0,0,1,16,0v38.63l26.63-26.64A88,88,0,0,0,208,160Z"/></svg>`,
};

function header(active = "home") {
  const nav = [
    { id: "home", href: "index.html", icon: ICONS.house, label: "Главная" },
    { id: "pricing", href: "pricing.html", icon: ICONS.cart, label: "Купить" },
    { id: "faq", href: "faq.html", icon: ICONS.question, label: "FAQ" },
  ];
  return `<header class="site-header">
  <div class="header-inner">
    <div class="header-left">
      <a href="index.html" class="logo-link"><img src="assets/icon.png" alt="Stellar Client" width="45" height="45"></a>
      <nav class="header-nav">
        ${nav
          .map(
            (n) => `<a href="${n.href}" class="nav-link${active === n.id ? " active" : ""}">${n.icon}<span>${n.label}</span></a>`
          )
          .join("\n        ")}
      </nav>
    </div>
    <a href="login.html" class="login-btn">Вход</a>
  </div>
</header>`;
}

function footer() {
  const year = new Date().getFullYear();
  return `<footer class="site-footer">
  <div class="footer-inner">
    <div class="footer-brand">
      <h3>Stellar Client</h3>
      <p>© ${year} Stellar Client.<br>Все права защищены.</p>
    </div>
    <div class="footer-columns">
      <div class="footer-col"><h4>Платформа</h4><a href="index.html">Главная</a><a href="pricing.html">Покупка</a><a href="faq.html">FAQ</a></div>
      <div class="footer-col"><h4>Аккаунт</h4><a href="login.html">Вход</a><a href="register.html">Регистрация</a></div>
      <div class="footer-col"><h4>Контакты</h4><a href="https://t.me/Stellar1DLC" target="_blank" rel="noopener">Telegram</a><a href="https://discord.gg/8dkVx9FfH" target="_blank" rel="noopener">Discord</a></div>
      <div class="footer-col"><h4>Правовое</h4><a href="#">Лицензионное соглашение</a></div>
    </div>
  </div>
</footer>`;
}

function page(title, body, active = "home", extraHead = "") {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Stellar Client</title>
  <link rel="icon" href="assets/icon.png" type="image/png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
  <link rel="stylesheet" href="animation.css">
  ${extraHead}
</head>
<body>
  <div id="loader" class="loader">
    <img src="assets/icon.png" alt="Loading" width="140" height="140" class="loader-icon">
    <div class="loader-spinner"></div>
  </div>
  <div id="cursor-root" class="cursor-root" aria-hidden="true">
    <div class="cursor-ring"></div>
    <div class="cursor-dot"></div>
  </div>
  ${header(active)}
  ${body}
  ${footer()}
  <script src="script.js"></script>
</body>
</html>`;
}

function featureCard(icon, title, desc) {
  return `<div class="feature-card tilt-card reveal">
  <div class="feature-card-inner">
    <div class="feature-card-head"><span class="feature-icon">${icon}</span><h3>${title}</h3></div>
    <p>${desc}</p>
  </div>
</div>`;
}

function pricingCard(title, price) {
  return `<div class="pricing-card tilt-card reveal">
  <div class="pricing-card-inner">
    <div class="pricing-image"><img src="assets/pricing.jpg" alt="${title}"></div>
    <h2>${title}</h2>
    <p class="pricing-price">Цена: ${price}</p>
    <button class="btn-primary" type="button">Купить</button>
  </div>
</div>`;
}

function faqCard(q, a) {
  return `<div class="faq-card reveal"><h2>${q}</h2><p>${a}</p></div>`;
}

const pages = {
  "index.html": page(
    "Главная",
    `<main class="page-main">
  <section class="hero-section">
    <div class="grid-bg"></div>
    <div class="hero-content reveal">
      <div class="hero-text">
        <h1>О нас</h1>
        <p class="hero-lead">Мы создаём игровой клиент нового поколения, ориентированный на скорость, стабильность и премиальный пользовательский опыт. Больше FPS. Современные модули. Ноль отвлекающих факторов.</p>
        <div class="stats-grid">
          <div><p class="stat-value">50+</p><p class="stat-label">Активные пользователи</p></div>
          <div><p class="stat-value">30%+</p><p class="stat-label">Больше FPS</p></div>
          <div><p class="stat-value">24/7</p><p class="stat-label">Поддержка</p></div>
        </div>
      </div>
      <div class="hero-image reveal"><img src="assets/icon.png" alt="Hero" width="650" height="650"></div>
    </div>
  </section>
  <section class="features-section">
    <div class="features-image reveal"><img src="assets/chat.jpg" alt="Chat Screenshot" width="840" height="840"></div>
    <div class="features-text reveal">
      <h1>Наши преимущества</h1>
      <div class="features-grid">
        ${featureCard(ICONS.eye, "Beautiful Visuals", "Чистые эффекты, отточенный интерфейс и современный стиль.")}
        ${featureCard(ICONS.sliders, "Fully Customizable", "Настраивай модули, визуалы, интерфейс и эффекты именно так, как хочешь.")}
        ${featureCard(ICONS.gauge, "High Performance", "Плавный геймплей, оптимизированный FPS, стабильная работа.")}
        ${featureCard(ICONS.refresh, "Frequent Updates", "Новые функции, улучшения и исправления багов на постоянной основе.")}
      </div>
    </div>
  </section>
  <section class="video-section reveal">
    <h1>Демонстрация геймплея</h1>
    <div class="video-wrap">
      <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Gameplay Video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    </div>
  </section>
</main>`,
    "home"
  ),
  "pricing.html": page(
    "Купить",
    `<main class="page-main pricing-page">
  <section class="pricing-section">
    <h1 class="reveal">Купить</h1>
    <div class="pricing-grid">
      ${pricingCard("30 дней", "109 rubles")}
      ${pricingCard("Half year", "169 rubles")}
      ${pricingCard("Forever", "299 rubles")}
    </div>
  </section>
</main>`,
    "pricing"
  ),
  "faq.html": page(
    "FAQ",
    `<main class="page-main faq-page">
  <div class="faq-bg faq-bg-1"><img src="assets/fluid1.png" alt=""></div>
  <div class="faq-bg faq-bg-2"><img src="assets/fluid2.png" alt=""></div>
  <section class="faq-section">
    <h1 class="reveal">FAQ</h1>
    ${faqCard("Как запустить клиент?", "Сначала скачайте лаунчер и откройте его. В появившемся окне вы увидите поле, где можно задать выделение оперативной памяти. Рекомендуем выделять не больше 8 ГБ. После этого нажмите кнопку «Старт» и дождитесь загрузки клиента.")}
    ${faqCard("Как загрузить конфиг в клиент?", "Чтобы загрузить конфиг, сначала запустите клиент хотя бы один раз. Затем перейдите в директорию: C:\\StellarClient\\beta\\client\\configs и поместите ваш файл конфига .euphoria в эту папку.")}
    ${faqCard("Как создать собственный скрипт для клиента?", "Чтобы создать свой скрипт, сначала нужно прочитать документацию. В ней есть примеры использования, хуки событий и описание API. Обязательно следуйте рекомендациям по разработке, чтобы обеспечить совместимость.")}
    ${faqCard("Как связаться с техподдержкой?", "Есть два способа связаться с поддержкой. Первый — открыть тикет на нашем Discord-сервере в канале Support. Второй — написать в нашу группу VK. Поддержка обычно отвечает в течение 24 часов.")}
  </section>
</main>`,
    "faq"
  ),
  "login.html": page(
    "Вход",
    `<main class="page-main auth-page">
  <div class="grid-bg auth-grid"></div>
  <div class="auth-overlay"></div>
  <div class="auth-card reveal">
    <h1>Вход</h1>
    <p class="auth-sub">Войдите в аккаунт</p>
    <form class="auth-form" data-static-auth="login">
      <input type="text" name="login" placeholder="Email или имя пользователя" required>
      <input type="password" name="password" placeholder="Пароль" required>
      <p class="auth-error" hidden>Авторизация доступна только на серверной версии сайта.</p>
      <button type="submit" class="btn-primary">Войти</button>
      <p class="auth-switch">Нет аккаунта? <a href="register.html">Регистрация</a></p>
    </form>
  </div>
</main>`,
    "home"
  ),
  "register.html": page(
    "Регистрация",
    `<main class="page-main auth-page">
  <div class="grid-bg auth-grid"></div>
  <div class="auth-overlay"></div>
  <div class="auth-card reveal">
    <h1>Регистрация</h1>
    <p class="auth-sub">Создайте новый аккаунт</p>
    <form class="auth-form" data-static-auth="register">
      <input type="email" name="email" placeholder="Email" required>
      <input type="text" name="username" placeholder="Имя пользователя" required>
      <input type="password" name="password" placeholder="Пароль" required>
      <p class="auth-error" hidden>Регистрация доступна только на серверной версии сайта.</p>
      <button type="submit" class="btn-primary">Создать аккаунт</button>
      <p class="auth-switch">Уже есть аккаунт? <a href="login.html">Войти</a></p>
    </form>
  </div>
</main>`,
    "home"
  ),
};

const animationCss = `/* Loader */
.loader {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  transition: opacity 0.5s ease, visibility 0.5s ease;
}
.loader.hidden { opacity: 0; visibility: hidden; pointer-events: none; }
.loader-icon { margin-bottom: 1.5rem; animation: loaderPop 0.5s ease; }
.loader-spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 4px solid rgba(255,255,255,0.2);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1.2s linear infinite;
}

/* Custom cursor */
body.custom-cursor, body.custom-cursor * { cursor: none !important; }
.cursor-root { pointer-events: none; position: fixed; inset: 0; z-index: 9999; display: none; }
.cursor-root.active { display: block; }
.cursor-ring, .cursor-dot { position: absolute; top: 0; left: 0; transform: translate(-50%, -50%); transition: width 0.2s, height 0.2s, border-color 0.2s, transform 0.15s; }
.cursor-ring { width: 34px; height: 34px; border: 1px solid rgba(255,255,255,0.45); border-radius: 50%; }
.cursor-dot { width: 6px; height: 6px; background: #fff; border-radius: 50%; }
.cursor-root.hovering .cursor-ring { width: 52px; height: 52px; border-color: rgba(196,160,255,0.9); }
.cursor-root.hovering .cursor-dot { transform: translate(-50%, -50%) scale(0); }
.cursor-root.pressed .cursor-ring { transform: translate(-50%, -50%) scale(0.8); }
.cursor-root.pressed .cursor-dot { transform: translate(-50%, -50%) scale(1.6); }

/* Scroll reveal */
.reveal { opacity: 0; transform: translateY(40px); filter: blur(6px); transition: opacity 0.7s ease, transform 0.7s ease, filter 0.7s ease; }
.reveal.visible { opacity: 1; transform: none; filter: none; }

/* Tilt cards */
.tilt-card { transform-style: preserve-3d; transition: transform 0.25s ease; will-change: transform; }
.tilt-card:hover { transform: scale(1.03) translateY(-6px); }

/* Header / nav hover */
.nav-link, .login-btn, .btn-primary, .footer-col a { transition: color 0.2s, background 0.2s, transform 0.2s; }
.nav-link:hover { transform: translateY(-2px); color: #fff; }
.nav-link:hover svg { color: #d8b4fe; }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes loaderPop { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
`;

const scriptJs = `(() => {
  const loader = document.getElementById('loader');
  const cursorRoot = document.getElementById('cursor-root');
  const ring = cursorRoot?.querySelector('.cursor-ring');
  const dot = cursorRoot?.querySelector('.cursor-dot');

  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    loader?.classList.add('hidden');
    document.body.style.overflow = '';
  }, 1000);

  if (window.matchMedia('(pointer: fine)').matches && cursorRoot && ring && dot) {
    cursorRoot.classList.add('active');
    document.body.classList.add('custom-cursor');
    let rx = -100, ry = -100, dx = -100, dy = -100;
    const lerp = (a, b, t) => a + (b - a) * t;

    const move = (e) => {
      rx = e.clientX; ry = e.clientY;
      const hover = !!e.target.closest('a, button, input, [role="button"], .cursor-pointer');
      cursorRoot.classList.toggle('hovering', hover);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mousedown', () => cursorRoot.classList.add('pressed'));
    window.addEventListener('mouseup', () => cursorRoot.classList.remove('pressed'));

    const tick = () => {
      dx = lerp(dx, rx, 0.35); dy = lerp(dy, ry, 0.35);
      ring.style.left = dx + 'px'; ring.style.top = dy + 'px';
      dot.style.left = rx + 'px'; dot.style.top = ry + 'px';
      requestAnimationFrame(tick);
    };
    tick();
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  document.querySelectorAll('.tilt-card').forEach((card) => {
    const max = card.classList.contains('pricing-card') ? 9 : 6;
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = \`perspective(1000px) rotateX(\${-py * max}deg) rotateY(\${px * max}deg) scale(1.03) translateY(-6px)\`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });

  document.querySelectorAll('[data-static-auth]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const err = form.querySelector('.auth-error');
      if (err) err.hidden = false;
    });
  });
})();
`;

const extraStyle = `
/* Site layout (static layer on top of compiled Tailwind) */
:root { color-scheme: dark; }
body { color: #ededed; font-family: Unbounded, sans-serif; min-height: 100vh; }
body::before { content: ""; position: fixed; inset: 0; z-index: -2; background: url("assets/bg.gif") center/cover no-repeat fixed; }
body::after { content: ""; position: fixed; inset: 0; z-index: -1; background: rgba(0,0,0,0.55); }
a { text-decoration: none; color: inherit; }
img { max-width: 100%; height: auto; display: block; }
button { font: inherit; border: none; cursor: pointer; }

.site-header { position: fixed; top: 0; left: 0; z-index: 25; width: 100%; height: 5rem; padding: 0 2.5rem; backdrop-filter: blur(24px); background: rgba(0,0,0,0.6); border-bottom: 1px solid rgba(255,255,255,0.1); animation: fadeIn 0.5s ease; }
.header-inner { max-width: 72rem; margin: 0 auto; height: 100%; display: flex; align-items: center; justify-content: center; gap: 6rem; }
.header-left { display: flex; align-items: center; gap: 4rem; }
.header-nav { display: flex; align-items: center; gap: 3rem; color: rgba(255,255,255,0.85); }
.nav-link { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
.login-btn { font-size: 0.875rem; font-weight: 500; padding: 0.5rem 1.25rem; border-radius: 0.75rem; background: rgba(255,255,255,0.1); }
.login-btn:hover { background: rgba(255,255,255,0.2); }

.page-main { position: relative; z-index: 10; color: #fff; padding-top: 5rem; }
.hero-section { min-height: 100vh; padding: 0 12rem; display: flex; align-items: center; position: relative; }
.grid-bg { position: absolute; inset: 0; background-size: 40px 40px; background-image: linear-gradient(to right,rgba(255,255,255,0.05) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.05) 1px,transparent 1px); mask-image: radial-gradient(ellipse at center, transparent 20%, black); }
.hero-content { position: relative; z-index: 2; width: 100%; display: flex; align-items: center; gap: 5rem; }
.hero-text { width: 50%; padding-right: 2rem; }
.hero-text h1 { font-size: 4.5rem; font-weight: 800; line-height: 1.1; margin-bottom: 1.5rem; }
.hero-lead { font-size: 1.25rem; color: rgba(255,255,255,0.6); max-width: 28rem; margin-bottom: 3rem; }
.stats-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 1.5rem; }
.stat-value { font-size: 2.25rem; font-weight: 700; }
.stat-label { color: rgba(255,255,255,0.5); }
.hero-image { width: 50%; display: flex; justify-content: flex-end; }
.hero-image img { filter: drop-shadow(0 0 70px rgba(255,40,150,0.45)); }

.features-section { min-height: 100vh; display: flex; align-items: center; padding: 0 12rem; gap: 5rem; }
.features-image { width: 50%; }
.features-image img { border-radius: 1rem; box-shadow: 0 25px 50px rgba(168,85,247,0.2); margin-left: -6rem; }
.features-text { width: 50%; padding-left: 5rem; }
.features-text h1 { font-size: 3.75rem; font-weight: 800; margin-bottom: 2.5rem; }
.features-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 2rem; }
.feature-card-inner { border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); border-radius: 1rem; padding: 1.5rem; }
.feature-card-head { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; }
.feature-icon { display: grid; place-items: center; width: 2.5rem; height: 2.5rem; border-radius: 0.75rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.8); }
.feature-card p { color: rgba(255,255,255,0.7); font-size: 0.875rem; line-height: 1.6; }

.video-section { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 12rem; }
.video-section h1 { font-size: 3.75rem; font-weight: 800; margin-bottom: 3rem; text-align: center; }
.video-wrap { width: 100%; max-width: 56rem; border-radius: 1rem; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.5); }
.video-wrap iframe { width: 100%; height: 450px; border: 0; border-radius: 1rem; }

.pricing-section { padding: 12rem 1.5rem 10rem; display: flex; flex-direction: column; align-items: center; }
.pricing-section h1 { font-size: 3.75rem; font-weight: 800; margin-bottom: 5rem; text-align: center; }
.pricing-grid { display: flex; flex-wrap: wrap; gap: 3.5rem; justify-content: center; }
.pricing-card { width: 300px; }
.pricing-card-inner { background: rgba(26,26,26,0.6); backdrop-filter: blur(24px); border-radius: 1.5rem; padding: 1.5rem; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 25px rgba(0,0,0,0.4); }
.pricing-image { border-radius: 1rem; overflow: hidden; margin-bottom: 1.25rem; }
.pricing-card h2 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.25rem; }
.pricing-price { font-size: 0.875rem; color: rgba(255,255,255,0.6); margin-bottom: 1.5rem; }
.btn-primary { width: 100%; padding: 0.75rem; border-radius: 0.75rem; background: #9333ea; color: #fff; font-weight: 500; }
.btn-primary:hover { background: #a855f7; }

.faq-page { position: relative; overflow: hidden; min-height: 100vh; }
.faq-bg { position: absolute; inset: 0; pointer-events: none; }
.faq-bg img { width: 100%; height: 100%; object-fit: cover; }
.faq-bg-1 { z-index: -20; opacity: 0.4; }
.faq-bg-2 { z-index: -30; opacity: 0.3; }
.faq-section { position: relative; z-index: 10; padding: 10rem 1.5rem 8rem; display: flex; flex-direction: column; align-items: center; }
.faq-section h1 { font-size: 3.75rem; font-weight: 800; margin-bottom: 4rem; text-align: center; }
.faq-card { width: 100%; max-width: 56rem; padding: 2rem; border-radius: 1.5rem; background: rgba(255,255,255,0.1); backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.1); margin-bottom: 2.5rem; }
.faq-card h2 { font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; }
.faq-card p { color: rgba(255,255,255,0.8); line-height: 1.7; }

.auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 8rem 1.5rem 4rem; position: relative; overflow: hidden; }
.auth-grid { position: absolute; inset: 0; z-index: 0; }
.auth-overlay { position: absolute; inset: 0; z-index: 10; background: linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.7), rgba(0,0,0,0.9)); pointer-events: none; }
.auth-card { position: relative; z-index: 20; width: 100%; max-width: 32rem; background: rgba(0,0,0,0.3); backdrop-filter: blur(24px); border-radius: 1.5rem; border: 1px solid rgba(255,255,255,0.1); padding: 2.5rem; box-shadow: 0 25px 50px rgba(0,0,0,0.5); }
.auth-card h1 { font-size: 2.25rem; font-weight: 700; text-align: center; margin-bottom: 0.75rem; }
.auth-sub { text-align: center; color: rgba(255,255,255,0.6); margin-bottom: 2.5rem; }
.auth-form { display: flex; flex-direction: column; gap: 1.25rem; }
.auth-form input { background: rgba(0,0,0,0.4); padding: 1rem 1.25rem; border-radius: 0.75rem; border: 1px solid rgba(255,255,255,0.1); color: #fff; outline: none; }
.auth-form input:focus { border-color: #9333ea; }
.auth-error { color: #f87171; font-size: 0.875rem; text-align: center; }
.auth-switch { text-align: center; margin-top: 0.75rem; color: rgba(255,255,255,0.5); }
.auth-switch a { color: #c084fc; }

.site-footer { width: 100%; position: relative; background: rgba(0,0,0,0.5); backdrop-filter: blur(12px); border-top: 1px solid rgba(255,255,255,0.1); overflow: hidden; }
.footer-inner { position: relative; z-index: 10; padding: 5rem 12rem; display: flex; justify-content: space-between; align-items: flex-start; color: rgba(255,255,255,0.7); }
.footer-brand h3 { font-size: 1.25rem; font-weight: 600; color: #fff; margin-bottom: 0.75rem; }
.footer-brand p { font-size: 0.875rem; color: rgba(255,255,255,0.5); line-height: 1.6; }
.footer-columns { display: flex; gap: 5rem; }
.footer-col { display: flex; flex-direction: column; gap: 0.75rem; }
.footer-col h4 { font-size: 1.125rem; font-weight: 600; color: #fff; }
.footer-col a { color: rgba(255,255,255,0.6); font-size: 0.95rem; }
.footer-col a:hover { color: #d8b4fe; }

@media (max-width: 1200px) {
  .hero-section, .features-section, .video-section, .footer-inner { padding-left: 2rem; padding-right: 2rem; }
  .hero-content, .features-section { flex-direction: column; }
  .hero-text, .hero-image, .features-image, .features-text { width: 100%; padding: 0; }
  .features-image img { margin-left: 0; }
  .footer-inner { flex-direction: column; gap: 2rem; }
  .footer-columns { flex-wrap: wrap; gap: 2rem; }
}
`;

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyAssets() {
  ensureDir(ASSETS);
  for (const name of REFERENCED_ASSETS) {
    fs.copyFileSync(path.join(SRC, "public", name), path.join(ASSETS, name));
  }
}

function build() {
  if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
  ensureDir(OUT);
  ensureDir(ASSETS);

  copyAssets();

  let tailwindCss = fs.readFileSync(path.join(SRC, "static-export-temp.css"), "utf8");
  tailwindCss = tailwindCss.replace(/url\("\/bg\.gif"\)/g, 'url("assets/bg.gif")');
  fs.writeFileSync(path.join(OUT, "style.css"), tailwindCss + "\n" + extraStyle);
  fs.writeFileSync(path.join(OUT, "animation.css"), animationCss);
  fs.writeFileSync(path.join(OUT, "script.js"), scriptJs);

  for (const [name, html] of Object.entries(pages)) {
    fs.writeFileSync(path.join(OUT, name), html);
  }

  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(full);
    }
  }
  walk(OUT);
  const totalSize = files.reduce((s, f) => s + fs.statSync(f).size, 0);
  console.log(JSON.stringify({ out: OUT, fileCount: files.length, totalSizeBytes: totalSize, files: files.map((f) => ({ path: path.relative(OUT, f), size: fs.statSync(f).size })) }, null, 2));
}

build();
