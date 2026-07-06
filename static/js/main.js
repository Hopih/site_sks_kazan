document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initThemeToggle();
    initHeroSlider();
    initReveal();
    initCounters();
    initBackToTop();
});

function initHeader() {
    const header = document.getElementById('header');
    const burger = document.getElementById('burgerBtn');
    const nav = document.getElementById('mainNav');

    window.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', window.scrollY > 20);
    });

    burger?.addEventListener('click', () => {
        burger.classList.toggle('active');
        nav?.classList.toggle('open');
    });
}

function initThemeToggle() {
    const btn = document.getElementById('themeToggle');
    const root = document.documentElement;

    btn?.addEventListener('click', () => {
        const isLight = root.classList.toggle('theme-light');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
}

function initHeroSlider() {
    const slides = document.querySelectorAll('[data-slide]');
    const dots = document.querySelectorAll('[data-dot]');
    const prev = document.getElementById('heroPrev');
    const next = document.getElementById('heroNext');

    if (!slides.length) return;

    let current = 0;
    let timer;

    function goTo(index) {
        slides[current].classList.remove('active');
        dots[current]?.classList.remove('active');
        current = (index + slides.length) % slides.length;
        slides[current].classList.add('active');
        dots[current]?.classList.add('active');
        requestAnimationFrame(() => window.refreshHeroMeshViewers?.());
    }

    function nextSlide() { goTo(current + 1); }
    function prevSlide() { goTo(current - 1); }

    function startAutoplay() {
        timer = setInterval(nextSlide, 6000);
    }

    function resetAutoplay() {
        clearInterval(timer);
        startAutoplay();
    }

    prev?.addEventListener('click', () => { prevSlide(); resetAutoplay(); });
    next?.addEventListener('click', () => { nextSlide(); resetAutoplay(); });

    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            goTo(parseInt(dot.dataset.dot, 10));
            resetAutoplay();
        });
    });

    startAutoplay();
}

function initReveal() {
    const elements = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        },
        { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    elements.forEach(el => observer.observe(el));
}

function initCounters() {
    const counters = document.querySelectorAll('[data-count]');
    const observer = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.5 }
    );
    counters.forEach(c => observer.observe(c));
}

function animateCounter(el) {
    const target = parseInt(el.dataset.count, 10);
    const duration = 2000;
    const start = performance.now();

    function update(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(eased * target).toLocaleString('ru-RU');
        if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
}

function initBackToTop() {
    const btn = document.getElementById('backToTop');
    if (!btn) return;

    const toggle = () => {
        btn.classList.toggle('is-visible', window.scrollY > 400);
    };

    window.addEventListener('scroll', toggle, { passive: true });
    toggle();

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

