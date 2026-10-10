document.addEventListener('DOMContentLoaded', () => {
  /* Shared utilities */
  function easeOutQuintic(t) { return 1 - Math.pow(1 - t, 5); }
  function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }

  function getNavHeight() {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h') || '64');
  }

  function smoothScrollTo(target, duration, extraOffset = 0) {
    const navH = getNavHeight();
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

  /* "Last updated" stamp — guarded since not every page has this element */
  const lastUpdatedEl = document.getElementById('lastUpdated');
  if (lastUpdatedEl) lastUpdatedEl.textContent = 'October 10, 2026'; /* --------------------------- Update this!! */

  /* Index page scripts */
  if (document.body.classList.contains('index-page')) {
    const scrollCue = document.querySelector('.scroll-cue');
    if (scrollCue) {
      const updateScrollCue = () => {
        if (window.scrollY > 24) {
          scrollCue.classList.remove('is-visible');
          scrollCue.classList.add('is-hidden');
        }
      };
      updateScrollCue();
      window.addEventListener('scroll', updateScrollCue, { passive: true });
      setTimeout(() => {
        if (window.scrollY <= 24) scrollCue.classList.add('is-visible');
      }, 5000);
    }

    /* Intercept same-page anchor clicks */
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', function(e) {
        const el = document.getElementById(this.getAttribute('href').slice(1));
        if (el) { e.preventDefault(); smoothScrollTo(el, 1900); }
      });
    });

    /* If arriving from a project page, prevent nav fade and jump to target section */
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
        window.scrollTo(0, getOffsetTop(targetEl) - getNavHeight() - 16);
      }
    }

    /* Touch: pop the project card when its center is near viewport center */
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
      const cards = document.querySelectorAll('.project-card');
      let ticking = false;

      function updateCenteredCard() {
        const viewportCenter = window.innerHeight / 2;
        // how close a card's center must be to viewport center to "pop" (px)
        const threshold = 100;

        cards.forEach(card => {
          const rect = card.getBoundingClientRect();
          const cardCenter = rect.top + rect.height / 2;
          const distance = Math.abs(viewportCenter - cardCenter);
          card.classList.toggle('in-view', distance < threshold);
        });

        ticking = false;
      }

      window.addEventListener('scroll', () => {
        if (!ticking) {
          requestAnimationFrame(updateCenteredCard);
          ticking = true;
        }
      }, { passive: true });

      updateCenteredCard(); // run once on load
    }
  }

  /* Project page scripts */
  if (document.body.classList.contains('project-page')) {
    /* Lightbox — tap an inline figure to expand, pinch/scroll to zoom, drag to pan */
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxClose = document.getElementById('lightboxClose');

    let scale = 1, panX = 0, panY = 0;
    let isDragging = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;
    let pinchStartDist = 0, pinchStartScale = 1;

    function applyTransform(animate) {
      lightboxImg.style.transition = animate ? 'transform 0.2s ease' : 'none';
      lightboxImg.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    }

    /* Change the zoom while keeping the image point under (x, y) in place */
    function zoomAt(newScale, x, y) {
      newScale = clamp(newScale, 1, 6);
      if (newScale === 1) {
        scale = 1; panX = 0; panY = 0;
        return;
      }
      const rect = lightboxImg.getBoundingClientRect();
      const dx = x - (rect.left + rect.width / 2);
      const dy = y - (rect.top + rect.height / 2);
      const k = newScale / scale;
      panX += dx * (1 - k);
      panY += dy * (1 - k);
      scale = newScale;
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

    /* Inline figures open in the lightbox */
    document.querySelectorAll('.story-photo img').forEach(img => {
      img.addEventListener('click', () => openLightbox(img.currentSrc || img.src));
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

    /* Mouse wheel zoom, centered on the cursor */
    lightbox.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      zoomAt(scale * factor, e.clientX, e.clientY);
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
        /* Pinch zoom, centered between the two fingers */
        zoomAt(pinchStartScale * (dist / pinchStartDist), (a.x + b.x) / 2, (a.y + b.y) / 2);
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