/* ============================================================
   AWESOME INTERIORS — SCRIPT.JS
   SPA Router | Animations | Interactions
   ============================================================ */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────
     UTILITIES
  ────────────────────────────────────────────────────────── */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  /* ──────────────────────────────────────────────────────────
     STATE
  ────────────────────────────────────────────────────────── */
  let currentPage = 'home';
  let isTransitioning = false;

  /* ──────────────────────────────────────────────────────────
     ELEMENTS
  ────────────────────────────────────────────────────────── */
  const loadingScreen = $('#loadingScreen');
  const siteHeader    = $('#siteHeader');
  const pageOverlay   = $('#pageOverlay');
  const hamburger     = $('#hamburger');
  const mobileMenu    = $('#mobileMenu');
  const mobileClose   = $('#mobileClose');
  const mainContent   = $('#mainContent');

  /* ──────────────────────────────────────────────────────────
     1. LOADING ANIMATION (homepage entry)
  ────────────────────────────────────────────────────────── */
  function runLoadingSequence() {
    // Show loading for ~1.8s then fade out
    setTimeout(() => {
      loadingScreen.classList.add('done');
      // After fade out, show header
      setTimeout(() => {
        loadingScreen.style.display = 'none';
        siteHeader.classList.add('visible');
        triggerPageEntryAnimations('home');
      }, 950);
    }, 1800);
  }

  /* ──────────────────────────────────────────────────────────
     2. SPA ROUTING
  ────────────────────────────────────────────────────────── */
  function navigateTo(pageName, pushState = true) {
    if (pageName === currentPage || isTransitioning) return;
    isTransitioning = true;

    // Update browser URL hash
    if (pushState) {
      const hash = pageName === 'home' ? '#' : `#${pageName}`;
      history.pushState({ page: pageName }, '', hash);
    }

    // 1. Flash overlay in
    pageOverlay.classList.add('active');

    setTimeout(() => {
      // 2. Hide current page, show new page
      $$('.page').forEach(p => p.classList.remove('active'));
      const nextPage = $(`#page-${pageName}`);
      if (nextPage) {
        nextPage.classList.add('active');
        window.scrollTo(0, 0);
      }

      // 3. Update nav active states
      updateNavActive(pageName);

      // 4. Update page title
      updateTitle(pageName);

      // 5. Scroll to top on page change
      window.scrollTo(0, 0);

      // 6. Fade overlay out
      setTimeout(() => {
        pageOverlay.classList.remove('active');
        isTransitioning = false;
        currentPage = pageName;

        // 7. Run entry animations for new page
        triggerPageEntryAnimations(pageName);

        // 8. Init page-specific features
        if (pageName === 'studio') initStudioTabs();
        if (pageName === 'projects') initProjectsFilter();
      }, 600);

    }, 600);
  }

  function updateNavActive(pageName) {
    $$('.nav-link').forEach(link => {
      link.classList.toggle('active-page', link.dataset.page === pageName);
    });
  }

  function updateTitle(pageName) {
    const titles = {
      home:       'Luxury Interior Designers | Awesome Interiors | By Pallavi Reddy',
      studio:     'Studio | Awesome Interiors',
      projects:   'Projects | Interior Design Studio | Awesome Interiors',
      foundation: 'The Foundation | Awesome Interiors',
      contact:    'Contact Us | Awesome Interiors',
    };
    document.title = titles[pageName] || titles.home;
  }

  /* ──────────────────────────────────────────────────────────
     3. LINK DELEGATION — intercept all [data-page] links
  ────────────────────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    const target = e.target.closest('[data-page]');
    if (!target) return;

    const page = target.dataset.page;
    if (!page) return;

    e.preventDefault();

    // Close mobile menu if open
    mobileMenu.classList.remove('open');

    navigateTo(page);
  });

  /* ──────────────────────────────────────────────────────────
     4. BROWSER BACK/FORWARD
  ────────────────────────────────────────────────────────── */
  window.addEventListener('popstate', function (e) {
    const page = e.state?.page || 'home';
    navigateTo(page, false);
  });

  /* ──────────────────────────────────────────────────────────
     5. HAMBURGER & MOBILE MENU
  ────────────────────────────────────────────────────────── */
  hamburger.addEventListener('click', () => {
    mobileMenu.classList.add('open');
  });

  mobileClose.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
  });

  // Close on ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
      mobileMenu.classList.remove('open');
    }
  });

  /* ──────────────────────────────────────────────────────────
     6. SCROLL ANIMATIONS — IntersectionObserver
  ────────────────────────────────────────────────────────── */
  const observerOpts = {
    rootMargin: '0px 0px -80px 0px',
    threshold: 0.1,
  };

  const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        scrollObserver.unobserve(entry.target);
      }
    });
  }, observerOpts);

  function observeAnimElements(scope = document) {
    $$('.fade-in-up, .fade-left', scope).forEach(el => {
      scrollObserver.observe(el);
    });
  }

  /* ──────────────────────────────────────────────────────────
     7. PAGE ENTRY ANIMATIONS
  ────────────────────────────────────────────────────────── */
  function triggerPageEntryAnimations(pageName) {
    const pageEl = $(`#page-${pageName}`);
    if (!pageEl) return;

    // Re-observe elements in the newly active page
    observeAnimElements(pageEl);

    // Trigger immediately-visible items
    setTimeout(() => {
      $$('.fade-in-up, .fade-left', pageEl).forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight) {
          el.classList.add('visible');
        }
      });
    }, 100);
  }

  /* ──────────────────────────────────────────────────────────
     8. STUDIO TABS
  ────────────────────────────────────────────────────────── */
  function initStudioTabs() {
    const tabs = $$('.studio-tab');
    const sections = {
      story:    $('#section-story'),
      team:     $('#section-team'),
      founders: $('#section-founders'),
      careers:  $('#section-careers'),
    };

    // Make sure all sections show (they're always in DOM)
    Object.values(sections).forEach(s => { if (s) s.style.display = 'block'; });

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const section = tab.dataset.section;
        const target = sections[section];
        if (!target) return;

        // Update all tab active states (sidebar + mobile)
        $$('.studio-tab').forEach(t => {
          t.classList.toggle('active', t.dataset.section === section);
        });

        // Smooth scroll to section
        const headerH = 57;
        const mobileTabsH = window.innerWidth < 768 ? 45 : 0;
        const targetTop = target.getBoundingClientRect().top + window.scrollY - headerH - mobileTabsH - 1;
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
      });
    });

    // Sync active tab on scroll
    const sectionIds = ['section-story', 'section-team', 'section-founders', 'section-careers'];
    const studioScrollHandler = throttle(() => {
      let active = 'story';
      sectionIds.forEach(id => {
        const el = $(`#${id}`);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.top <= 100) active = id.replace('section-', '');
      });
      $$('.studio-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.section === active);
      });
    }, 100);

    window.addEventListener('scroll', studioScrollHandler, { passive: true });

    // Cleanup when navigating away — stored on window
    window._studioScrollCleanup = () => {
      window.removeEventListener('scroll', studioScrollHandler);
    };
  }

  /* ──────────────────────────────────────────────────────────
     9. PROJECTS FILTER
  ────────────────────────────────────────────────────────── */
  function initProjectsFilter() {
    const filterBtns = $$('.filter-btn');
    const projectItems = $$('.project-item');

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;

        // Update active btn
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Filter items with a smooth fade
        projectItems.forEach(item => {
          const cat = item.dataset.category;
          const show = filter === 'all' || cat === filter;

          if (show) {
            item.classList.remove('hidden');
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px)';
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                item.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
              });
            });
          } else {
            item.style.transition = 'opacity 0.3s ease';
            item.style.opacity = '0';
            setTimeout(() => item.classList.add('hidden'), 300);
          }
        });
      });
    });
  }

  /* ──────────────────────────────────────────────────────────
     10. CONTACT FORM
  ────────────────────────────────────────────────────────── */
  const contactForm = $('#contactForm');
  if (contactForm) {
    // reCAPTCHA file:// Fallback
    if (window.location.protocol === 'file:') {
      const recaptchaContainer = contactForm.querySelector('.g-recaptcha');
      if (recaptchaContainer) {
        recaptchaContainer.outerHTML = `
          <div class="mock-recaptcha-box" style="
            width: 302px;
            height: 76px;
            background: #f9f9f9;
            border: 1px solid #d3d3d3;
            border-radius: 3px;
            box-shadow: 0 0 4px rgba(0,0,0,0.08);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 12px;
            font-family: var(--font-sans), sans-serif;
            box-sizing: border-box;
            user-select: none;
            margin: 0 auto;
          ">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div id="mockCheckbox" style="
                width: 28px;
                height: 28px;
                border: 2px solid #c1c1c1;
                border-radius: 2px;
                background: #fff;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
              ">
                <svg id="mockCheckmark" width="16" height="12" viewBox="0 0 16 12" fill="none" style="display: none;">
                  <path d="M1 5L5.5 9.5L14.5 1.5" stroke="#009a44" stroke-width="3" stroke-linecap="round"/>
                </svg>
              </div>
              <span style="font-size: 13px; color: #2b2b2b; font-weight: 400; letter-spacing: 0.5px;">I'm not a robot</span>
            </div>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; opacity: 0.85;">
              <img src="https://www.gstatic.com/recaptcha/api2/logo_48.png" style="width: 32px; height: 32px; object-fit: contain;" alt="reCAPTCHA logo"/>
              <span style="font-size: 8px; color: #555; letter-spacing: 0.2px;">Privacy - Terms</span>
            </div>
          </div>
          <input type="hidden" id="g-recaptcha-response" name="g-recaptcha-response" value=""/>
        `;

        const checkbox = $('#mockCheckbox', contactForm);
        const checkmark = $('#mockCheckmark', contactForm);
        const responseInput = $('#g-recaptcha-response', contactForm);

        if (checkbox) {
          checkbox.addEventListener('click', function () {
            if (checkmark.style.display === 'none') {
              checkbox.style.borderColor = '#009a44';
              checkmark.style.display = 'block';
              responseInput.value = 'mock-local-token';
            } else {
              checkbox.style.borderColor = '#c1c1c1';
              checkmark.style.display = 'none';
              responseInput.value = '';
            }
          });
        }
      }
    }

    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();

      // Enforce reCAPTCHA verification
      if (window.location.protocol === 'file:') {
        const responseInput = $('#g-recaptcha-response', contactForm);
        if (!responseInput || !responseInput.value) {
          alert("Please complete the 'I am not a robot' verification.");
          return;
        }
      } else if (typeof grecaptcha !== 'undefined') {
        const recaptchaResponse = grecaptcha.getResponse();
        if (!recaptchaResponse) {
          alert("Please complete the 'I am not a robot' verification.");
          return;
        }
      }

      // Extract form values before reset
      const fullname = contactForm.querySelector('[name="fullname"]').value;
      const phone = contactForm.querySelector('[name="phone"]').value;
      const email = contactForm.querySelector('[name="email"]').value;
      const topicSelect = contactForm.querySelector('[name="topic"]');
      const topicText = topicSelect.options[topicSelect.selectedIndex].text;
      const locationSelect = contactForm.querySelector('[name="location"]');
      const locationText = locationSelect.options[locationSelect.selectedIndex].text;
      const userMsg = contactForm.querySelector('[name="message"]').value;

      const successEl = $('#formSuccess');
      const submitBtn = contactForm.querySelector('.form-submit');

      submitBtn.style.opacity = '0.4';
      submitBtn.disabled = true;

      // Simulate API delay
      setTimeout(() => {
        successEl.classList.add('show');
        contactForm.reset();

        // Reset reCAPTCHA (hosted or local)
        if (window.location.protocol === 'file:') {
          const checkbox = $('#mockCheckbox', contactForm);
          const checkmark = $('#mockCheckmark', contactForm);
          const responseInput = $('#g-recaptcha-response', contactForm);
          if (checkbox && checkmark && responseInput) {
            checkbox.style.borderColor = '#c1c1c1';
            checkmark.style.display = 'none';
            responseInput.value = '';
          }
        } else if (typeof grecaptcha !== 'undefined') {
          grecaptcha.reset();
        }

        submitBtn.style.opacity = '1';
        submitBtn.disabled = false;
        setTimeout(() => successEl.classList.remove('show'), 5000);

        // Format a highly professional message for WhatsApp
        let contactDetails = `- Email: ${email}`;
        if (phone) {
          contactDetails += `\n- Mobile: ${phone}`;
        }

        const whatsappText = `Hello Awesome Interiors,

My name is ${fullname}, and I am reaching out from ${locationText}. I would like to make an enquiry regarding ${topicText}.

Details of my request:
"${userMsg}"

My contact information:
${contactDetails}

Looking forward to hearing from you.

Kind regards,
${fullname}`;

        // Construct official wa.me universal URL (strips + and spaces from number)
        const whatsappUrl = `https://wa.me/918008001743?text=${encodeURIComponent(whatsappText)}`;
        window.open(whatsappUrl, '_blank');
      }, 1000);
    });
  }

  /* ──────────────────────────────────────────────────────────
     11. HOME HERO — sticky scroll reveal
     The stacked panels are CSS sticky; JS just adds subtle
     parallax depth to images on scroll.
  ────────────────────────────────────────────────────────── */
  function initHeroParallax() {
    const heroPanels = $$('.hero-panel');
    if (!heroPanels.length) return;

    const parallaxHandler = throttle(() => {
      const scrollY = window.scrollY;

      heroPanels.forEach((panel, i) => {
        const img = panel.querySelector('img');
        if (!img) return;
        const panelTop = panel.offsetTop;
        const offset = (scrollY - panelTop) * 0.08;
        img.style.transform = `translateY(${Math.max(-20, Math.min(20, offset))}px)`;
      });
    }, 16);

    // Only attach when on home page
    window._heroParallaxHandler = parallaxHandler;
    window.addEventListener('scroll', parallaxHandler, { passive: true });
  }

  /* ──────────────────────────────────────────────────────────
     12. HEADER SCROLL BEHAVIOUR
     Fade nav links slightly when scrolled past hero
  ────────────────────────────────────────────────────────── */
  let lastScrollY = 0;
  window.addEventListener('scroll', throttle(() => {
    const y = window.scrollY;

    // Subtle shadow on scroll
    if (y > 10) {
      siteHeader.style.boxShadow = '0 1px 0 rgba(0,0,0,0.08)';
    } else {
      siteHeader.style.boxShadow = 'none';
    }

    lastScrollY = y;
  }, 100), { passive: true });

  /* ──────────────────────────────────────────────────────────
     13. CURSOR — subtle opacity fade effect on nav links
     (original site dims nav links on hover)
  ────────────────────────────────────────────────────────── */
  // Already handled by CSS hover:opacity-50

  /* ──────────────────────────────────────────────────────────
     14. HASH ROUTING on page load
  ────────────────────────────────────────────────────────── */
  function handleInitialRoute() {
    const hash = window.location.hash.replace('#', '');
    const validPages = ['home', 'studio', 'projects', 'foundation', 'contact'];

    if (hash && validPages.includes(hash)) {
      // Non-home page — skip loading animation
      loadingScreen.style.display = 'none';
      siteHeader.classList.add('visible');

      $$('.page').forEach(p => p.classList.remove('active'));
      const target = $(`#page-${hash}`);
      if (target) target.classList.add('active');
      currentPage = hash;
      updateNavActive(hash);
      updateTitle(hash);

      if (hash === 'studio') initStudioTabs();
      if (hash === 'projects') initProjectsFilter();
      triggerPageEntryAnimations(hash);
    } else {
      // Default: home with loading screen
      history.replaceState({ page: 'home' }, '', '#');
      runLoadingSequence();
    }
  }

  /* ──────────────────────────────────────────────────────────
     15. UTILITY: THROTTLE
  ────────────────────────────────────────────────────────── */
  function throttle(fn, wait) {
    let last = 0;
    return function (...args) {
      const now = Date.now();
      if (now - last >= wait) {
        last = now;
        fn.apply(this, args);
      }
    };
  }

  /* ──────────────────────────────────────────────────────────
     16. CLEANUP on page navigation
  ────────────────────────────────────────────────────────── */
  const _navigateBase = navigateTo;
  window.navigateTo = function (page, push) {
    // Clean up previous page listeners
    if (window._studioScrollCleanup) {
      window._studioScrollCleanup();
      window._studioScrollCleanup = null;
    }
    _navigateBase(page, push);
  };

  /* ──────────────────────────────────────────────────────────
     17. IMAGE LAZY LOAD OBSERVER (native + fallback)
  ────────────────────────────────────────────────────────── */
  if ('loading' in HTMLImageElement.prototype) {
    // Native lazy load — nothing extra needed
  } else {
    // Fallback polyfill: observe img[loading="lazy"]
    const lazyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
          }
          lazyObserver.unobserve(img);
        }
      });
    });
    $$('img[loading="lazy"]').forEach(img => lazyObserver.observe(img));
  }

  /* ──────────────────────────────────────────────────────────
     18. FOOTER REVEAL — slight slide-up when footer scrolls
     into view (mimics the original transition)
  ────────────────────────────────────────────────────────── */
  const footerObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      entry.target.style.transition = 'opacity 1.1s ease, transform 1.1s ease';
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.05 });

  $$('.site-footer').forEach(footer => {
    footer.style.opacity = '0';
    footer.style.transform = 'translateY(30px)';
    footerObserver.observe(footer);
  });

  /* ──────────────────────────────────────────────────────────
     19. SMOOTH HOVER on all internal CTAs
  ────────────────────────────────────────────────────────── */
  // Already done via CSS transition on opacity

  /* ──────────────────────────────────────────────────────────
     INIT
  ────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    handleInitialRoute();

    // Init projects filter on load if on projects page
    if (currentPage === 'projects') initProjectsFilter();
  });

  // Safety: if DOMContentLoaded already fired
  if (document.readyState !== 'loading') {
    handleInitialRoute();
  }

})();
