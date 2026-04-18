/* Dark mode initial state (device preference first, then saved override) */
const storedMode = localStorage.getItem('darkMode');
if (storedMode !== null) {
  if (storedMode === 'true') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

document.addEventListener('DOMContentLoaded', () => {
  /* Shared scroll utility */
  function easeOutQuintic(t) { return 1 - Math.pow(1 - t, 5); }

  function smoothScrollTo(target, duration, extraOffset = 0) {
    const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h') || '0');
    const start = window.scrollY;
    const end = target.getBoundingClientRect().top + window.scrollY - navH * 0.6 - extraOffset;
    const diff = end - start;
    let startTime = null;
    let cancelled = false;

    function cancel() { cancelled = true; }
    window.addEventListener('wheel', cancel, { once: true, passive: true });
    window.addEventListener('touchstart', cancel, { once: true, passive: true });
    window.addEventListener('keydown', cancel, { once: true });

    function step(timestamp) {
      if (cancelled) return;
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      window.scrollTo(0, start + diff * easeOutQuintic(progress));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* Dark mode toggle */
  document.getElementById('lastUpdated').textContent = 'April 17, 2026'; /* --------------------------- Update this!! */
  const root = document.documentElement;
  const toggle = document.getElementById('dmToggle');

  /* Replace the toggle pill with a clickable icon button */
  if (toggle) {
    const btn = document.createElement('button');
    btn.className = 'dm-icon-wrap' + (root.classList.contains('dark') ? ' is-dark' : '');
    btn.setAttribute('aria-label', 'Toggle dark mode');
    btn.innerHTML = `
      <svg class="dm-icon dm-icon--sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4"/>
        <line x1="12" y1="2"  x2="12" y2="5"/>
        <line x1="12" y1="19" x2="12" y2="22"/>
        <line x1="4.22" y1="4.22"  x2="6.34" y2="6.34"/>
        <line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/>
        <line x1="2"  y1="12" x2="5"  y2="12"/>
        <line x1="19" y1="12" x2="22" y2="12"/>
        <line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/>
        <line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/>
      </svg>
      <svg class="dm-icon dm-icon--moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>`;
    toggle.replaceWith(btn);

    btn.addEventListener('click', () => {
      root.classList.toggle('dark');
      localStorage.setItem('darkMode', root.classList.contains('dark'));
      btn.classList.toggle('is-dark', root.classList.contains('dark'));
    });
  }

  /* Index page scripts */
  if (document.body.classList.contains('index-page')) {
    /* Intercept same-page anchor clicks */
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', function(e) {
        const el = document.getElementById(this.getAttribute('href').slice(1));
        if (el) { e.preventDefault(); smoothScrollTo(el, 1900); }
      });
    });

    /* If arriving from a project page, prevent nav fade and smooth scroll to target section */
    const scrollTarget = sessionStorage.getItem('scrollTo');
    const scrollToCard = sessionStorage.getItem('scrollToCard');
    if (scrollTarget) {
      document.body.classList.add('no-nav-animation');
      sessionStorage.removeItem('scrollTo');
      sessionStorage.removeItem('scrollToCard');

      /* If a specific project card is stored, scroll to it; otherwise scroll to the section */
      let targetEl = null;
      if (scrollToCard) {
        targetEl = document.querySelector(`.project-card[href*="${scrollToCard}"]`);
      }
      if (!targetEl) {
        targetEl = document.getElementById(scrollTarget);
      }
      if (targetEl) {
        /* Use offsetTop to get absolute document position — immune to image load timing */
        function getOffsetTop(el) {
          let top = 0;
          while (el) { top += el.offsetTop; el = el.offsetParent; }
          return top;
        }
        const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h') || '64');
        const scrollY = getOffsetTop(targetEl) - navH - 16;
        window.scrollTo(0, scrollY);
      }
    }
  }

  /* Project page scripts */
  if (document.body.classList.contains('project-page')) {
    /* Thumbnail gallery */
    const mainImg = document.getElementById('galleryMainImg');
    const mainVideo = document.getElementById('galleryMainVideo');
    const caption = document.getElementById('galleryCaption');
    const thumbs = document.querySelectorAll('.gallery-thumb');
    thumbs.forEach(thumb => {
      thumb.addEventListener('click', () => {
        if (thumb.classList.contains('active')) return;
        thumbs.forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
        mainImg.classList.add('fade');
        setTimeout(() => {
          if (thumb.dataset.type === 'video') {
            mainImg.style.display = 'none';
            mainVideo.src = thumb.dataset.src;
            mainVideo.style.display = 'block';
          } else {
            mainVideo.style.display = 'none';
            mainVideo.src = ''; /* stop video playback when switching away */
            mainImg.src = thumb.dataset.src;
            mainImg.style.display = 'block';
          }
          caption.innerHTML = thumb.dataset.caption;
          mainImg.classList.remove('fade');
        }, 200);
      });
    });

    /* Lightbox — tap main gallery image to expand, pinch/scroll to zoom, drag to pan */
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxClose = document.getElementById('lightboxClose');
    const galleryMain = document.querySelector('.gallery-main');

    let scale = 1, panX = 0, panY = 0;
    let isDragging = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;
    let pinchStartDist = 0, pinchStartScale = 1;

    function applyTransform(animate) {
      lightboxImg.style.transition = animate ? 'transform 0.2s ease' : 'none';
      lightboxImg.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    }

    function resetTransform(animate) {
      scale = 1; panX = 0; panY = 0;
      applyTransform(animate);
    }

    function openLightbox(src) {
      lightboxImg.src = src;
      resetTransform(false);
      lightbox.classList.add('open');
      lightboxClose.classList.add('visible');
    }

    galleryMain.addEventListener('click', () => {
      if (mainVideo.style.display === 'block') return;
      openLightbox(mainImg.src);
    });

    function closeLightbox() {
      lightbox.classList.remove('open');
      lightboxClose.classList.remove('visible');
    }

    lightboxClose.addEventListener('click', (e) => { e.stopPropagation(); closeLightbox(); });
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

    /* Double-tap/click to reset */
    lightboxImg.addEventListener('dblclick', () => resetTransform(true));

    /* Mouse wheel zoom */
    lightbox.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      scale = Math.min(Math.max(scale * factor, 1), 6);
      if (scale === 1) { panX = 0; panY = 0; }
      applyTransform(false);
    }, { passive: false });

    /* Mouse drag */
    lightboxImg.addEventListener('mousedown', (e) => {
      if (scale <= 1) return;
      isDragging = true;
      dragStartX = e.clientX; dragStartY = e.clientY;
      panStartX = panX; panStartY = panY;
      lightboxImg.style.cursor = 'grabbing';
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      panX = panStartX + (e.clientX - dragStartX);
      panY = panStartY + (e.clientY - dragStartY);
      applyTransform(false);
    });
    window.addEventListener('mouseup', () => {
      isDragging = false;
      lightboxImg.style.cursor = scale > 1 ? 'grab' : 'default';
    });

    /* Touch handling */
    let t1 = null, t2 = null;

    lightbox.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        t1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        t2 = null;
        panStartX = panX; panStartY = panY;
        pinchStartScale = scale;
      } else if (e.touches.length === 2) {
        t1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        t2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
        pinchStartDist = Math.hypot(t2.x - t1.x, t2.y - t1.y);
        pinchStartScale = scale;
        panStartX = panX; panStartY = panY;
      }
    }, { passive: false });

    lightbox.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 2 && t1 && t2) {
        const a = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        const b = { x: e.touches[1].clientX, y: e.touches[1].clientY };
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        scale = Math.min(Math.max(pinchStartScale * (dist / pinchStartDist), 1), 6);
        if (scale === 1) { panX = 0; panY = 0; }
        applyTransform(false);
      } else if (e.touches.length === 1 && t1 && scale > 1) {
        panX = panStartX + (e.touches[0].clientX - t1.x);
        panY = panStartY + (e.touches[0].clientY - t1.y);
        applyTransform(false);
      }
    }, { passive: false });

    lightbox.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) { t1 = null; t2 = null; }
    }, { passive: false });

    /* Figure references — click to jump to gallery image */
    const figRefs = document.querySelectorAll('.fig-ref');
    figRefs.forEach(ref => {
      ref.addEventListener('click', () => {
        figRefs.forEach(r => r.classList.remove('active'));
        ref.classList.add('active');
        const figNum = ref.dataset.fig;
        const target = Array.from(thumbs).find(t => 
          t.dataset.caption.includes(`<b>Fig. ${figNum}.`)
        );
        if (target) {
          target.click();
          /* Scroll gallery into view — 1.6 s, extra offset to clear nav */
          const gallery = document.querySelector('.proj-gallery');
          if (gallery) smoothScrollTo(gallery, 1600, 28);
        }
      });
    });

    /* Back button — smooth scroll to the specific project card on return */
    document.getElementById('backBtn').addEventListener('click', function(e) {
      e.preventDefault();
      /* Get the folder name (e.g. "driftwood-pillow") from a URL like /driftwood-pillow/ */
      const parts = window.location.pathname.replace(/\/$/, '').split('/');
      const folderName = parts[parts.length - 1];
      sessionStorage.setItem('scrollTo', 'projects');
      sessionStorage.setItem('scrollToCard', folderName);
      window.location.href = '/';
    });
  }
});