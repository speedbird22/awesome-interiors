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

  // Convert and compress an image file to Base64 (max width 1200px, quality 0.75)
  // This keeps the image size small (typically under 100KB) to stay well under the 1MB Firestore document limit.
  function compressAndToBase64(file, maxWidth = 1200, maxHeight = 900, quality = 0.75) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Resize keeping aspect ratio
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to Base64 JPEG
          const base64Url = canvas.toDataURL('image/jpeg', quality);
          resolve(base64Url);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  }

  /* ──────────────────────────────────────────────────────────
     STATE & FIREBASE INITIALIZATION (NO FALLBACKS)
  ────────────────────────────────────────────────────────── */
  let currentPage = 'home';
  let isTransitioning = false;



  let db = null;

  let lastFirebaseError = null;

  function recordFirebaseError(context, err) {
    lastFirebaseError = {
      context: context,
      message: err.message || String(err),
      code: err.code || 'unknown',
      timestamp: new Date().toLocaleTimeString(),
      stack: err.stack || ''
    };
    console.error(`[Firebase Error Log - ${context}]:`, err);
    
    // Refresh status indicator if user is currently viewing the admin dashboard
    if (currentPage === 'admin' && typeof updateAdminStatusBox === 'function') {
      updateAdminStatusBox();
    }
  }

  // Define global firebase mock if not loaded (for serverTimestamp compatibility in forms)
  if (typeof firebase === 'undefined') {
    window.firebase = {
      firestore: {
        FieldValue: {
          serverTimestamp: () => ({ mockTimestamp: true })
        }
      }
    };
  }

  // Initialize
  let initError = null;
  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
    try {
      db = firebase.firestore();
      
      // Enable Firestore offline persistence for instant loading on mobile/reloads
      db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
        console.warn("Firestore offline persistence could not be enabled:", err.code);
      });
    } catch (e) {
      initError = e;
      recordFirebaseError("Firebase Initialization", e);
    }
  } else {
    const errorMsg = typeof firebase === 'undefined'
      ? "Firebase SDK failed to load. The CDN script connections are blocked (possibly by an adblocker/firewall) or you are offline."
      : "Firebase apps are not initialized.";
    initError = new Error(errorMsg);
    recordFirebaseError("Firebase Initialization", initError);
  }



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
    if (!loadingScreen) {
      if (siteHeader) siteHeader.classList.add('visible');
      return;
    }
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

    // Clean up previous canvas animation if navigating away from home
    if (window._canvasCleanup) {
      window._canvasCleanup();
      window._canvasCleanup = null;
    }

    let targetPage = pageName;
    let projectId = '';
    if (pageName.startsWith('project-detail-')) {
      targetPage = 'project-detail';
      projectId = pageName.replace('project-detail-', '');
    }

    const nextPage = $(`#page-${targetPage}`);
    if (!nextPage) {
      window.location.href = `index.html#${pageName}`;
      return;
    }

    isTransitioning = true;

    // Update browser URL hash
    if (pushState) {
      const hash = pageName === 'home' ? '#' : `#${pageName}`;
      history.pushState({ page: pageName }, '', hash);
    }

    // 1. Flash overlay in
    if (pageOverlay) pageOverlay.classList.add('active');

    setTimeout(() => {
      // 2. Hide current page, show new page
      $$('.page').forEach(p => p.classList.remove('active'));
      if (nextPage) {
        nextPage.classList.add('active');
        window.scrollTo(0, 0);
      }

      // 3. Update nav active states
      updateNavActive(targetPage);

      // 4. Update page title
      updateTitle(pageName);

      // 5. Scroll to top on page change
      window.scrollTo(0, 0);

      // 6. Fade overlay out
      setTimeout(() => {
        if (pageOverlay) pageOverlay.classList.remove('active');
        isTransitioning = false;
        currentPage = pageName;

        // 7. Run entry animations for new page
        triggerPageEntryAnimations(targetPage);

        // 8. Init page-specific features
        if (['home', 'projects', 'foundation', 'contact', 'project-detail'].includes(targetPage)) initHeroCanvas();
        if (targetPage === 'projects') loadPublicProjects();
        if (targetPage === 'project-detail') renderProjectDetail(projectId);
        if (targetPage === 'admin') loadAdminDashboard();
      }, 600);

    }, 600);
  }

  function updateNavActive(pageName) {
    let activePage = pageName;
    if (pageName.startsWith('project-detail-')) {
      activePage = 'projects';
    }
    $$('.nav-link').forEach(link => {
      const isPage = link.dataset.page === activePage || 
                     (link.getAttribute('href') && link.getAttribute('href').includes(activePage + '.html'));
      link.classList.toggle('active-page', !!isPage);
    });
  }

  function updateTitle(pageName) {
    const titles = {
      home:       'Luxury Interior Designers | Awesome Interiors | By Pallavi Reddy',
      projects:   'Projects | Interior Design Studio | Awesome Interiors',
      foundation: 'The Foundation | Awesome Interiors',
      contact:    'Contact Us | Awesome Interiors',
      admin:      'Admin Dashboard | Awesome Interiors',
    };
    
    if (pageName.startsWith('project-detail-')) {
      document.title = 'Project Details | Awesome Interiors';
    } else {
      document.title = titles[pageName] || titles.home;
    }
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

    window.navigateTo(page);
  });

  /* ──────────────────────────────────────────────────────────
     4. BROWSER BACK/FORWARD
  ────────────────────────────────────────────────────────── */
  window.addEventListener('popstate', function (e) {
    const page = e.state?.page || 'home';
    window.navigateTo(page, false);
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


  /* ──────────────────────────────────────────────────────────
     9. PROJECTS FILTER - Obsoleted (Replaced with Firebase Dynamic Grid Loading)
     ────────────────────────────────────────────────────────── */

  /* ──────────────────────────────────────────────────────────
     10. CONTACT FORM
  ────────────────────────────────────────────────────────── */
  const contactForm = $('#contactForm');
  if (contactForm) {
    // Always use custom mock reCAPTCHA (avoids Google test-key red warning text)
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
            responseInput.value = 'mock-token';
          } else {
            checkbox.style.borderColor = '#c1c1c1';
            checkmark.style.display = 'none';
            responseInput.value = '';
          }
        });
      }
    }


    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();

      // Enforce reCAPTCHA verification (always use mock)
      const responseInput = $('#g-recaptcha-response', contactForm);
      if (!responseInput || !responseInput.value) {
        alert("Please complete the 'I am not a robot' verification.");
        return;
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

        // Reset mock reCAPTCHA
        const checkbox = $('#mockCheckbox', contactForm);
        const checkmark = $('#mockCheckmark', contactForm);
        const responseInput = $('#g-recaptcha-response', contactForm);
        if (checkbox && checkmark && responseInput) {
          checkbox.style.borderColor = '#c1c1c1';
          checkmark.style.display = 'none';
          responseInput.value = '';
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
    const rawHash = window.location.hash.replace('#', '');
    let hash = rawHash;
    let projectId = '';
    
    if (rawHash.startsWith('project-detail-')) {
      hash = 'project-detail';
      projectId = rawHash.replace('project-detail-', '');
    }

    const validPages = ['home', 'projects', 'foundation', 'contact', 'admin', 'project-detail'];

    if (!loadingScreen) {
      if (siteHeader) siteHeader.classList.add('visible');
      
      let pageName = 'home';
      const path = window.location.pathname;
      if (hash && validPages.includes(hash)) {
        pageName = hash;
      } else if (path.includes('projects.html')) {
        pageName = 'projects';
      } else if (path.includes('foundation.html')) {
        pageName = 'foundation';
      } else if (path.includes('contact.html')) {
        pageName = 'contact';
      }
      
      currentPage = pageName === 'project-detail' ? `project-detail-${projectId}` : pageName;
      updateNavActive(pageName);
      updateTitle(currentPage);

      if (pageName === 'projects') loadPublicProjects();
      if (pageName === 'project-detail') renderProjectDetail(projectId);
      if (pageName === 'admin') loadAdminDashboard();
      triggerPageEntryAnimations(pageName);
      return;
    }

    if (hash && validPages.includes(hash)) {
      loadingScreen.style.display = 'none';
      loadingScreen.classList.add('done');
      siteHeader.classList.add('visible');

      $$('.page').forEach(p => p.classList.remove('active'));
      const target = $(`#page-${hash}`);
      if (target) target.classList.add('active');
      currentPage = hash === 'project-detail' ? `project-detail-${projectId}` : hash;
      updateNavActive(hash);
      updateTitle(currentPage);

      if (hash === 'projects') loadPublicProjects();
      if (hash === 'project-detail') renderProjectDetail(projectId);
      if (hash === 'admin') loadAdminDashboard();
      triggerPageEntryAnimations(hash);
    } else {
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
     20. FIREBASE CONTENT INTEGRATION
     ────────────────────────────────────────────────────────── */
  function loadHomeFeaturedProjects() {
    if (!db) return;
    db.collection('projects').orderBy('createdAt', 'desc').get().then(snapshot => {
      const projects = [];
      snapshot.forEach(doc => {
        const p = doc.data();
        if (p.featuredImageIndex !== undefined && p.featuredImageIndex !== null && p.featuredImageIndex >= 0) {
          projects.push(p);
        }
      });
      
      const featured = projects.slice(0, 4);
      
      for (let i = 0; i < 4; i++) {
        const panel = $(`#hero-panel-${i + 4}`);
        if (!panel) continue;
        
        const proj = featured[i];
        const link = panel.querySelector('.hero-panel-link');
        const img = panel.querySelector('img');
        
        if (proj) {
          const featuredImgUrl = proj.images[proj.featuredImageIndex] || proj.images[0];
          img.src = featuredImgUrl;
          img.alt = proj.name;
          
          link.href = `#project-detail-${proj.id}`;
          link.dataset.page = `project-detail-${proj.id}`;
          
          let overlay = panel.querySelector('.panel-featured-info');
          if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'panel-featured-info';
            overlay.style.position = 'absolute';
            overlay.style.bottom = '40px';
            overlay.style.left = '40px';
            overlay.style.zIndex = '5';
            overlay.style.color = '#fff';
            overlay.style.textShadow = '0 2px 4px rgba(0,0,0,0.5)';
            panel.querySelector('.hero-frame').appendChild(overlay);
          }
          overlay.innerHTML = `
            <span style="font-family: var(--font-sans); font-size: 10px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.8; display: block; margin-bottom: 4px;">Featured Project</span>
            <h3 class="noe-heading" style="font-size: clamp(20px, 3vw, 32px); margin: 0; font-style: italic;">${proj.name}</h3>
            <span style="font-family: var(--font-sans); font-size: 11px; letter-spacing: 1px; opacity: 0.8;">${proj.location}</span>
          `;
        } else {
          link.href = 'projects.html';
          link.dataset.page = 'projects';
          img.src = `images/image-main-${i + 4}.png`;
          img.alt = "Awesome Interiors project";
          const overlay = panel.querySelector('.panel-featured-info');
          if (overlay) overlay.remove();
        }
      }
    }).catch(err => {
      recordFirebaseError("Featured Projects Loader", err);
    });
  }

  function loadPublicProjects() {
    const grid = $('#projectsGrid');
    if (!grid || !db) return;
    
    db.collection('projects').orderBy('createdAt', 'desc').get().then(snapshot => {
      grid.innerHTML = '';
      
      if (snapshot.empty) {
        grid.innerHTML = `<p style="font-family: var(--font-sans); font-size: 13px; opacity: 0.6; text-align: center; grid-column: 1 / -1; padding: 60px 0;">No projects uploaded yet.</p>`;
        return;
      }
      
      snapshot.forEach(doc => {
        const proj = doc.data();
        const coverImgUrl = (proj.coverImageIndex !== undefined && proj.coverImageIndex !== null && proj.coverImageIndex >= 0)
          ? (proj.images[proj.coverImageIndex] || proj.images[0])
          : (proj.images[proj.featuredImageIndex] || proj.images[0]);
        
        const card = document.createElement('a');
        card.className = 'project-item';
        card.href = `#project-detail-${proj.id}`;
        card.dataset.page = `project-detail-${proj.id}`;
        
        card.innerHTML = `
          <div class="project-img-wrap hover-zoom" style="aspect-ratio: 4/3; overflow: hidden; background: #ccc; margin-bottom: 16px;">
            <img src="${coverImgUrl}" alt="${proj.name}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease;"/>
          </div>
          <div class="project-info" style="padding: 0 4px; display: flex; flex-direction: column; align-items: flex-start;">
            <p class="project-name" style="font-family: var(--font-serif); font-size: 16px; font-weight: 400; font-style: italic; margin-bottom: 4px; line-height: 1.3; color: var(--black);">${proj.name}</p>
            <p class="project-cat" style="font-family: var(--font-sans); font-size: 10.5px; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.6; color: var(--black);">${proj.location} &nbsp;&middot;&nbsp; ${proj.category}</p>
            <span class="project-view-btn" style="color: var(--black);">View Project &rarr;</span>
          </div>
        `;
        
        grid.appendChild(card);
      });
    }).catch(err => {
      recordFirebaseError("Public Projects Grid", err);
      grid.innerHTML = `<p style="font-family: var(--font-sans); font-size: 13px; opacity: 0.6; text-align: center; grid-column: 1 / -1; padding: 60px 0; color: #b00020;">Failed to load projects: ${err.message}</p>`;
    });
  }

  function renderProjectDetail(projectId) {
    const container = $('#projectDetailContent');
    if (!container || !db) return;
    
    container.innerHTML = `<p style="font-family: var(--font-sans); font-size: 13px; opacity: 0.6;">Loading project details...</p>`;
    
    db.collection('projects').doc(projectId).get().then(doc => {
      if (!doc.exists) {
        container.innerHTML = `<p style="font-family: var(--font-sans); font-size: 13px; opacity: 0.6; color: #b00020;">Project not found.</p>`;
        return;
      }
      
      const proj = doc.data();
      
      let imagesHtml = '';
      proj.images.forEach((imgUrl, idx) => {
        if (idx === 0) {
          imagesHtml += `
            <div class="ripple-container" style="grid-column: 1 / -1; aspect-ratio: 16/9; overflow: hidden; background: #ddd; margin-bottom: 20px; position: relative;">
              <img class="ripple-bg" src="${imgUrl}" alt="${proj.name}" style="width: 100%; height: 100%; object-fit: cover; display: block;"/>
            </div>
          `;
        } else {
          imagesHtml += `
            <div class="hover-zoom" style="aspect-ratio: 4/3; overflow: hidden; background: #ddd;">
              <img src="${imgUrl}" alt="${proj.name}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease;" loading="lazy"/>
            </div>
          `;
        }
      });
      
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <h2 class="noe-heading" style="font-size: clamp(28px, 4.5vw, 48px); margin: 0; font-style: italic; line-height: 1.2;">${proj.name}</h2>
          
          <div style="display: flex; flex-wrap: wrap; gap: 32px 64px; border-top: 1px solid rgba(0,0,0,0.1); border-bottom: 1px solid rgba(0,0,0,0.1); padding: 24px 0;">
            <div>
              <span style="font-family: var(--font-sans); font-size: 9px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.5; display: block; margin-bottom: 6px;">Location</span>
              <span style="font-family: var(--font-sans); font-size: 13px; font-weight: 400; letter-spacing: 0.5px;">${proj.location}</span>
            </div>
            <div>
              <span style="font-family: var(--font-sans); font-size: 9px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.5; display: block; margin-bottom: 6px;">Completed Date</span>
              <span style="font-family: var(--font-sans); font-size: 13px; font-weight: 400; letter-spacing: 0.5px;">${proj.date}</span>
            </div>
            <div>
              <span style="font-family: var(--font-sans); font-size: 9px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.5; display: block; margin-bottom: 6px;">Category</span>
              <span style="font-family: var(--font-sans); font-size: 13px; font-weight: 400; letter-spacing: 0.5px;">${proj.category}</span>
            </div>
          </div>
        </div>
        
        <div class="project-detail-images-grid">
          ${imagesHtml}
        </div>
      `;
      
      $$('.hover-zoom', container).forEach(hz => {
        const img = hz.querySelector('img');
        if (img) {
          hz.addEventListener('mouseenter', () => img.style.transform = 'scale(1.03)');
          hz.addEventListener('mouseleave', () => img.style.transform = 'scale(1.00)');
        }
      });
      
    }).catch(err => {
      recordFirebaseError("Project Detail View", err);
      container.innerHTML = `<p style="font-family: var(--font-sans); font-size: 13px; opacity: 0.6; color: #b00020; text-align: center;">Failed to load project details: ${err.message}</p>`;
    });
  }

  let selectedFiles = [];
  let coverIndex = 0;
  let featuredIndex = -1;
  let isUploading = false;

  function updateAdminStatusBox() {
    const adminPageContainer = $('#page-admin > div') || $('.page-admin > div');
    if (!adminPageContainer) return;

    let statusBox = $('#db-connection-status');
    if (!statusBox) {
      statusBox = document.createElement('div');
      statusBox.id = 'db-connection-status';
      statusBox.style.padding = '24px';
      statusBox.style.fontSize = '13px';
      statusBox.style.fontFamily = 'var(--font-sans)';
      statusBox.style.marginBottom = '30px';
      statusBox.style.border = '1px solid';
      statusBox.style.borderRadius = '4px';
      statusBox.style.display = 'flex';
      statusBox.style.flexDirection = 'column';
      statusBox.style.gap = '16px';
      
      const heading = adminPageContainer.querySelector('h1');
      if (heading) {
        heading.parentNode.insertBefore(statusBox, heading.nextSibling);
      } else {
        adminPageContainer.insertBefore(statusBox, adminPageContainer.firstChild);
      }
    }

    const hasInitError = (db === null);
    const isError = hasInitError || lastFirebaseError !== null;

    if (isError) {
      statusBox.style.background = '#fff8f8';
      statusBox.style.color = '#c62828';
      statusBox.style.borderColor = '#ffcdd2';
    } else {
      statusBox.style.background = '#e8f5e9';
      statusBox.style.color = '#2e7d32';
      statusBox.style.borderColor = '#c8e6c9';
    }

    const titleIcon = isError ? '🔴' : '🟢';
    const modeTitle = isError ? 'Database Mode: Disconnected / Error' : 'Database Mode: Live Production (Cloud Firebase)';
    const modeDesc = isError 
      ? 'The cloud Firebase database connection has failed or was blocked. Local database fallbacks have been removed.' 
      : 'Successfully connected to your live Firebase Cloud Firestore. All operations write to the cloud in real-time.';

    const sdkStatus = (typeof firebase !== 'undefined') ? 'Loaded successfully' : 'Not Loaded (Missing SDK Script)';
    const appsStatus = (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) ? 'Initialized' : 'Not Initialized';
    const networkStatus = navigator.onLine ? 'Online' : 'Offline (No Internet Connection)';

    let configInfo = 'Unavailable';
    if (typeof firebaseConfig !== 'undefined') {
      const maskedKey = firebaseConfig.apiKey 
        ? firebaseConfig.apiKey.substring(0, 8) + '...' + firebaseConfig.apiKey.substring(firebaseConfig.apiKey.length - 4) 
        : 'None';
      configInfo = `Project ID: <code>${firebaseConfig.projectId || 'None'}</code> | API Key: <code>${maskedKey}</code>`;
    }

    let lastErrorHtml = '';
    if (lastFirebaseError) {
      lastErrorHtml = `
        <div style="background: rgba(198, 40, 40, 0.05); border-left: 3px solid #c62828; padding: 12px; margin-top: 8px; font-family: monospace; font-size: 11.5px; line-height: 1.4; overflow-x: auto; color: #b71c1c;">
          <strong>Last Firebase Error:</strong><br/>
          Context: ${lastFirebaseError.context}<br/>
          Code: ${lastFirebaseError.code}<br/>
          Message: ${lastFirebaseError.message}<br/>
          Time: ${lastFirebaseError.timestamp}
        </div>
      `;
    }

    let solutionsHtml = '';
    if (isError) {
      let solutions = [];
      if (typeof firebase === 'undefined') {
        solutions.push("<strong>Adblocker Blocked Script:</strong> Your web browser or adblocker (e.g. uBlock Origin) may be blocking the Google CDN scripts (<code>gstatic.com</code>). Try disabling your adblocker for this site.");
      }
      if (!navigator.onLine) {
        solutions.push("<strong>Network Offline:</strong> Check your local internet connectivity.");
      }
      if (lastFirebaseError) {
        if (lastFirebaseError.code === 'permission-denied') {
          solutions.push("<strong>Security Rules Blocked Action:</strong> The Security Rules in your Firebase Console for Cloud Firestore do not permit this read/write. Make sure they are set to allow access.");
        } else if (lastFirebaseError.code === 'failed-precondition') {
          solutions.push("<strong>Missing Index:</strong> Firestore requires a composite index for this query. Check the developer console log for the custom link to create it automatically.");
        } else if (lastFirebaseError.message && lastFirebaseError.message.includes('Cloud Firestore API')) {
          solutions.push("<strong>API Disabled:</strong> Verify that the 'Cloud Firestore API' is enabled in the Google Cloud Console for project <code>awesome--interiors</code>.");
        }
      }
      if (solutions.length === 0) {
        solutions.push("Ensure that your Firebase project configuration (<code>firebase-config.js</code>) matches your Firebase dashboard values and that Firestore is initialized in 'Production' or 'Test' mode.");
      }

      solutionsHtml = `
        <div style="margin-top: 12px; font-size: 12px; border-top: 1px solid rgba(198, 40, 40, 0.15); padding-top: 12px;">
          <strong style="text-transform: uppercase; font-size: 10.5px; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">Possible Resolutions:</strong>
          <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
            ${solutions.map(s => `<li style="line-height: 1.4;">${s}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    statusBox.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <span style="font-size: 20px; line-height: 1; margin-top: 2px;">${titleIcon}</span>
        <div style="flex: 1;">
          <strong style="font-size: 14px;">${modeTitle}</strong>
          <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.85; line-height: 1.4;">${modeDesc}</p>
        </div>
      </div>
      
      <div style="border-top: 1px solid ${isError ? 'rgba(198,40,40,0.15)' : 'rgba(46,125,50,0.15)'}; padding-top: 12px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; flex-wrap: wrap; gap: 8px 24px; font-size: 11.5px; opacity: 0.9;">
          <span><strong>Firebase SDK:</strong> ${sdkStatus}</span>
          <span><strong>Apps State:</strong> ${appsStatus}</span>
          <span><strong>Network:</strong> ${networkStatus}</span>
        </div>
        <div style="font-size: 11.5px; opacity: 0.9;">
          <strong>Config Check:</strong> ${configInfo}
        </div>
        
        ${lastErrorHtml}
        ${solutionsHtml}

        <div style="display: flex; gap: 10px; margin-top: 6px;">
          <button type="button" id="btn-run-diagnostics" style="
            background: ${isError ? '#c62828' : '#2e7d32'};
            color: #fff;
            border: none;
            padding: 8px 16px;
            font-size: 10.5px;
            font-family: var(--font-sans);
            letter-spacing: 0.5px;
            text-transform: uppercase;
            cursor: pointer;
            border-radius: 3px;
            font-weight: 500;
            transition: opacity 0.2s ease;
          ">Run Diagnostic Self-Test</button>
          
          <button type="button" id="btn-clear-error-log" style="
            background: transparent;
            color: ${isError ? '#c62828' : '#2e7d32'};
            border: 1px solid ${isError ? 'rgba(198,40,40,0.3)' : 'rgba(46,125,50,0.3)'};
            padding: 7px 15px;
            font-size: 10.5px;
            font-family: var(--font-sans);
            letter-spacing: 0.5px;
            text-transform: uppercase;
            cursor: pointer;
            border-radius: 3px;
            font-weight: 500;
            transition: all 0.2s ease;
          ">Clear Log</button>
        </div>

        <div id="diagnostics-test-output" style="
          display: none;
          background: #1e1e1e;
          color: #d4d4d4;
          font-family: monospace;
          font-size: 11px;
          padding: 12px;
          border-radius: 3px;
          margin-top: 10px;
          white-space: pre-wrap;
          line-height: 1.4;
          max-height: 200px;
          overflow-y: auto;
          border: 1px solid #333;
        "></div>
      </div>
    `;

    // Bind event handlers
    const btnTest = statusBox.querySelector('#btn-run-diagnostics');
    if (btnTest) {
      btnTest.addEventListener('click', runConnectionSelfTest);
    }
    
    const btnClear = statusBox.querySelector('#btn-clear-error-log');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        lastFirebaseError = null;
        updateAdminStatusBox();
      });
    }
  }

  function runConnectionSelfTest() {
    const outputBox = $('#diagnostics-test-output');
    if (!outputBox) return;

    outputBox.style.display = 'block';
    outputBox.innerHTML = `[${new Date().toLocaleTimeString()}] Starting Connection Diagnostics...\n`;

    const log = (msg) => {
      outputBox.innerHTML += `[${new Date().toLocaleTimeString()}] ${msg}\n`;
      outputBox.scrollTop = outputBox.scrollHeight;
    };

    log("Checking Firebase Core SDK...");
    if (typeof firebase === 'undefined') {
      log("❌ FAILURE: 'firebase' is undefined. Script tag for Firebase app compat SDK is missing or was blocked by browser/network.");
      log("Suggestion: Check if your browser adblocker (e.g. uBlock) or firewall is blocking gstatic.com.");
      return;
    }
    log("✅ SUCCESS: Firebase Core SDK loaded.");

    log("Checking Firestore service module...");
    if (typeof firebase.firestore !== 'function') {
      log("❌ FAILURE: 'firebase.firestore' is not a function. The Firestore SDK compat library was not loaded or is blocked.");
      return;
    }
    log("✅ SUCCESS: Firestore module available.");



    log("Checking project configurations...");
    if (typeof firebaseConfig === 'undefined') {
      log("❌ FAILURE: 'firebaseConfig' object is not defined. Ensure firebase-config.js is correctly loaded.");
      return;
    }
    log(`Config found: projectId='${firebaseConfig.projectId}'`);

    log("Checking active Firebase instance...");
    if (!firebase.apps || firebase.apps.length === 0) {
      log("❌ FAILURE: No initialized Firebase apps found.");
      return;
    }
    log(`✅ SUCCESS: Active Firebase App Count = ${firebase.apps.length}`);

    log("Attempting test query from Cloud Firestore ('projects' collection)...");
    
    try {
      const testDb = firebase.firestore();
      testDb.collection('projects').limit(1).get()
        .then(snapshot => {
          log("✅ SUCCESS: Successfully read from Cloud Firestore database!");
          log(`Snapshot count retrieved: ${snapshot.size}`);
          log("Database connection is healthy.");
        })
        .catch(err => {
          log(`❌ FAILURE: Query failed. Error Details:`);
          log(`  - Error Code: '${err.code}'`);
          log(`  - Message: '${err.message}'`);
          
          if (err.code === 'permission-denied') {
            log("\n💡 SOLUTION: Firestore Security Rules block reads on 'projects' collection. Update rules in Firebase Console.");
          } else if (err.code === 'unavailable') {
            log("\n💡 SOLUTION: Firestore service is offline or unreachable. Check your network or the Firestore console.");
          } else if (err.message && err.message.includes('Cloud Firestore API')) {
            log("\n💡 SOLUTION: Ensure that the Cloud Firestore API is enabled in your Google Cloud API Console.");
          }
          
          recordFirebaseError("Diagnostic Self-Test Query", err);
        });
    } catch (e) {
      log(`❌ FAILURE: Exception thrown while attempting read test. Error: ${e.message}`);
      recordFirebaseError("Diagnostic Self-Test Exception", e);
    }
  }

  function loadAdminDashboard() {
    // Render Database Connection Status Indicator
    updateAdminStatusBox();
    
    const form = $('#adminProjectForm');
    const fileInput = $('#projImages');
    const previewsContainer = $('#previewsContainer');
    
    if (form && !form.dataset.bound) {
      form.dataset.bound = "true";
      
      fileInput.addEventListener('change', function(e) {
        const files = [...e.target.files];
        if (files.length > 8) {
          alert("You can select up to 8 images only.");
          fileInput.value = '';
          selectedFiles = [];
          if (previewsContainer) previewsContainer.innerHTML = '';
          return;
        }
        selectedFiles = files;
        coverIndex = 0;
        featuredIndex = -1;
        renderAdminPreviews();
      });
      
      form.addEventListener('submit', async function(e) {
        e.preventDefault();
        if (isUploading) return;
        if (selectedFiles.length === 0) {
          alert("Please select at least one image file.");
          return;
        }
        
        isUploading = true;
        const submitBtnText = $('#formSubmitBtnText');
        const progressContainer = $('#uploadProgressContainer');
        const progressBar = $('#uploadProgressBar');
        const percentText = $('#uploadPercentText');
        const statusText = $('#uploadStatusText');
        
        submitBtnText.innerText = "UPLOADING...";
        form.querySelectorAll('input').forEach(i => i.disabled = true);
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        percentText.innerText = '0%';
        statusText.innerText = 'Initializing upload...';
        
        const projectId = db.collection('projects').doc().id;
        const imageUrls = [];
        
        try {
          for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            statusText.innerText = `Processing image ${i + 1} of ${selectedFiles.length}...`;
            const base64Data = await compressAndToBase64(file);
            imageUrls.push(base64Data);
            
            const totalPercent = Math.round(((i + 1) * 100) / selectedFiles.length);
            percentText.innerText = `${totalPercent}%`;
            progressBar.style.width = `${totalPercent}%`;
          }
          
          const projectData = {
            id: projectId,
            name: $('#projName').value.trim(),
            location: $('#projLocation').value.trim(),
            date: $('#projDate').value.trim(),
            category: $('#projCategory').value.trim(),
            images: imageUrls,
            coverImageIndex: coverIndex,
            featuredImageIndex: featuredIndex,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          };
          
          await db.collection('projects').doc(projectId).set(projectData);
          
          alert("Project created successfully!");
          form.reset();
          selectedFiles = [];
          coverIndex = 0;
          featuredIndex = -1;
          if (previewsContainer) previewsContainer.innerHTML = '';
          progressContainer.style.display = 'none';
          
          renderAdminProjectsList();
          loadHomeFeaturedProjects();
          
        } catch (err) {
          recordFirebaseError("Project Creation Form", err);
          alert("Error creating project: " + err.message);
        } finally {
          isUploading = false;
          submitBtnText.innerText = "CREATE PROJECT";
          form.querySelectorAll('input').forEach(i => i.disabled = false);
        }
      });
    }
    
    renderAdminProjectsList();
  }

  function renderAdminPreviews() {
    const container = $('#previewsContainer');
    if (!container) return;
    container.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const item = document.createElement('div');
        item.style.position = 'relative';
        item.style.border = '1px solid rgba(0,0,0,0.15)';
        item.style.padding = '4px';
        item.style.background = '#fff';
        item.style.display = 'flex';
        item.style.flexDirection = 'column';
        item.style.gap = '4px';
        
        const isCover = index === coverIndex;
        const isHighlighted = index === featuredIndex;
        
        if (isCover) {
          item.style.borderColor = '#2e7d32';
          item.style.borderWidth = '2px';
          item.style.padding = '3px';
        } else if (isHighlighted) {
          item.style.borderColor = '#d29b02';
          item.style.borderWidth = '2px';
          item.style.padding = '3px';
        }
        
        const img = document.createElement('img');
        img.src = e.target.result;
        img.style.width = '100%';
        img.style.height = '85px';
        img.style.objectFit = 'cover';
        img.style.display = 'block';
        
        const star = document.createElement('button');
        star.type = 'button';
        star.style.position = 'absolute';
        star.style.top = '8px';
        star.style.right = '8px';
        star.style.background = 'rgba(255,255,255,0.95)';
        star.style.border = '1px solid rgba(0,0,0,0.15)';
        star.style.borderRadius = '50%';
        star.style.width = '26px';
        star.style.height = '26px';
        star.style.cursor = 'pointer';
        star.style.display = 'flex';
        star.style.alignItems = 'center';
        star.style.justifyContent = 'center';
        star.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
        star.style.transition = 'all 0.2s ease';
        star.title = isHighlighted ? "Remove Highlight from Homepage" : "Highlight Project on Homepage";

        star.style.color = isHighlighted ? '#d29b02' : '#888';
        star.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="${isHighlighted ? '#d29b02' : 'none'}" stroke="${isHighlighted ? '#d29b02' : '#888'}" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        `;
        
        star.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          featuredIndex = isHighlighted ? -1 : index;
          renderAdminPreviews();
        });
        
        const coverBtn = document.createElement('button');
        coverBtn.type = 'button';
        coverBtn.style.width = '100%';
        coverBtn.style.padding = '5px 0';
        coverBtn.style.fontSize = '9px';
        coverBtn.style.fontFamily = 'var(--font-sans)';
        coverBtn.style.letterSpacing = '0.5px';
        coverBtn.style.textTransform = 'uppercase';
        coverBtn.style.cursor = 'pointer';
        coverBtn.style.border = '1px solid';
        coverBtn.style.transition = 'all 0.2s ease';
        
        if (isCover) {
          coverBtn.style.background = '#2e7d32';
          coverBtn.style.color = '#fff';
          coverBtn.style.borderColor = '#2e7d32';
          coverBtn.innerText = '✓ Cover';
        } else {
          coverBtn.style.background = '#f5f5f5';
          coverBtn.style.color = '#555';
          coverBtn.style.borderColor = '#ccc';
          coverBtn.innerText = 'Set Cover';
          
          coverBtn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            coverIndex = index;
            renderAdminPreviews();
          });
        }
        
        item.appendChild(img);
        item.appendChild(star);
        item.appendChild(coverBtn);
        container.appendChild(item);
      }
      reader.readAsDataURL(file);
    });
  }

  function renderAdminProjectsList() {
    const listContainer = $('#adminProjectsList');
    if (!listContainer || !db) return;
    
    db.collection('projects').orderBy('createdAt', 'desc').get().then(snapshot => {
      listContainer.innerHTML = '';
      
      if (snapshot.empty) {
        listContainer.innerHTML = `<p style="font-family: var(--font-sans); font-size: 13px; opacity: 0.6;">No projects uploaded yet.</p>`;
        return;
      }
      
      snapshot.forEach(doc => {
        const proj = doc.data();
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.flexDirection = 'column';
        item.style.gap = '16px';
        item.style.padding = '20px';
        item.style.border = '1px solid rgba(0,0,0,0.08)';
        item.style.background = '#fff';
        
        let thumbsHtml = '';
        proj.images.forEach((imgUrl, idx) => {
          const isCover = idx === (proj.coverImageIndex !== undefined ? proj.coverImageIndex : 0);
          const isFeatured = idx === proj.featuredImageIndex;
          
          let borderStyle = '1px solid rgba(0,0,0,0.1)';
          if (isCover) borderStyle = '2px solid #2e7d32'; // green border for cover
          else if (isFeatured) borderStyle = '2px solid #d29b02'; // gold border for featured
          
          thumbsHtml += `
            <div style="position: relative; width: 60px; height: 60px; border: ${borderStyle}; padding: 2px;">
              <img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover;"/>
              ${isCover ? `
                <div style="position: absolute; top: 2px; left: 2px; background: #2e7d32; border-radius: 3px; padding: 1px 3px; color: white; font-size: 6px; font-weight: bold; line-height: 1;">
                  COVER
                </div>
              ` : ''}
              ${isFeatured ? `
                <div style="position: absolute; bottom: 2px; right: 2px; background: #d29b02; border-radius: 50%; width: 12px; height: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 8px;">
                  ★
                </div>
              ` : ''}
            </div>
          `;
        });
        
        item.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
            <div>
              <h3 class="noe-heading" style="font-size: 18px; margin: 0 0 6px 0; font-style: italic;">${proj.name}</h3>
              <p style="font-family: var(--font-sans); font-size: 11px; opacity: 0.6; margin: 0;">
                Location: <strong>${proj.location}</strong> &nbsp;|&nbsp; 
                Date: <strong>${proj.date}</strong> &nbsp;|&nbsp; 
                Category: <strong>${proj.category}</strong>
              </p>
            </div>
            <button class="blocker-btn delete-proj-btn" data-id="${proj.id}" style="background: #b00020; border-color: #b00020; color: white; padding: 8px 18px; font-size: 9px; min-width: auto;">
              DELETE
            </button>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${thumbsHtml}
          </div>
        `;
        
        const deleteBtn = item.querySelector('.delete-proj-btn');
        deleteBtn.addEventListener('click', () => {
          if (confirm(`Are you sure you want to delete the project "${proj.name}"?`)) {
            deleteBtn.disabled = true;
            deleteBtn.innerText = "DELETING...";
            
            db.collection('projects').doc(proj.id).delete().then(() => {
              alert("Project deleted successfully.");
              renderAdminProjectsList();
              loadHomeFeaturedProjects();
            }).catch(err => {
              alert("Error deleting: " + err.message);
              deleteBtn.disabled = false;
              deleteBtn.innerText = "DELETE";
            });
          }
        });
        
        listContainer.appendChild(item);
      });
    }).catch(err => {
      recordFirebaseError("Admin Projects List", err);
      listContainer.innerHTML = `<p style="font-family: var(--font-sans); font-size: 13px; opacity: 0.6; color: #b00020;">Failed to load projects: ${err.message}</p>`;
    });
  }

  /* ──────────────────────────────────────────────────────────
     21. INTERACTIVE CANVAS BACKGROUND FOR HERO PANEL 1 (WATER PHYSICS RIPPLES)
  ────────────────────────────────────────────────────────── */
  /* ──────────────────────────────────────────────────────────
     21. INTERACTIVE CANVAS BACKGROUND FOR HERO PANEL 1 (WATER PHYSICS RIPPLES)
  ────────────────────────────────────────────────────────── */
  function initHeroCanvas() {
    if (window._canvasCleanup) {
      window._canvasCleanup();
      window._canvasCleanup = null;
    }
    const canvas = $('#heroCanvas');
    const feImage = $('#fe-image');
    if (!canvas || !feImage) return;

    const ctx = canvas.getContext('2d');
    let animationId = null;
    
    // Wave physics resolution (downscaled for high performance)
    const width = 128;
    const height = 128;
    
    canvas.width = width;
    canvas.height = height;
    
    const size = width * height;
    let buffer1 = new Float32Array(size);
    let buffer2 = new Float32Array(size);
    
    // ImageData structure to hold displacement map values
    const dispImgData = ctx.createImageData(width, height);
    const dispData = dispImgData.data;

    // Trigger ripple function dynamically targeting the passed container
    function triggerRipple(cx, cy, container, strength = 250) {
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const gx = Math.round(((cx - rect.left) / rect.width) * width);
      const gy = Math.round(((cy - rect.top) / rect.height) * height);
      
      if (gx > 1 && gx < width - 1 && gy > 1 && gy < height - 1) {
        const idx = gx + gy * width;
        buffer1[idx] = strength;
        buffer1[idx - 1] = strength / 2;
        buffer1[idx + 1] = strength / 2;
        buffer1[idx - width] = strength / 2;
        buffer1[idx + width] = strength / 2;
      }
    }

    // Input handlers bound globally to target active page container dynamically
    let lastX = 0;
    let lastY = 0;
    
    const handleMove = (clientX, clientY, container) => {
      const dist = Math.hypot(clientX - lastX, clientY - lastY);
      if (dist > 8) {
        triggerRipple(clientX, clientY, container, 250);
        lastX = clientX;
        lastY = clientY;
      }
    };

    const onMouseMove = (e) => {
      const container = e.target.closest('.ripple-container');
      if (container && container.closest('.page.active')) {
        handleMove(e.clientX, e.clientY, container);
      }
    };
    
    const onTouchMove = (e) => {
      if (e.touches.length > 0) {
        const target = e.touches[0].target;
        const container = target.closest('.ripple-container');
        if (container && container.closest('.page.active')) {
          handleMove(e.touches[0].clientX, e.touches[0].clientY, container);
        }
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    // Automatic slow random ripples at faster intervals across all containers
    let timeoutId = null;
    function autoRipple() {
      const activePage = $('.page.active');
      if (activePage) {
        const containers = [];
        if (activePage.classList.contains('ripple-container')) {
          containers.push(activePage);
        }
        containers.push(...activePage.querySelectorAll('.ripple-container'));
        
        if (containers.length > 0) {
          const container = containers[Math.floor(Math.random() * containers.length)];
          const rect = container.getBoundingClientRect();
          const rx = rect.left + Math.random() * rect.width;
          const ry = rect.top + Math.random() * rect.height;
          triggerRipple(rx, ry, container, Math.random() * 100 + 150);
        }
      }
      timeoutId = setTimeout(autoRipple, Math.random() * 800 + 600);
    }
    
    // Start auto ripples
    timeoutId = setTimeout(autoRipple, 800);

    // Simulation loop
    function animate() {
      // 1. Physics wave solver
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const i = x + y * width;
          buffer2[i] = (
            buffer1[i - 1] +
            buffer1[i + 1] +
            buffer1[i - width] +
            buffer1[i + width]
          ) / 2 - buffer2[i];
          buffer2[i] *= 0.98; // damping
        }
      }
      
      const temp = buffer1;
      buffer1 = buffer2;
      buffer2 = temp;

      // 2. Generate displacement map (Red/Green refraction channels)
      let i = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let r = 127;
          let g = 127;

          if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
            const idx = x + y * width;
            const dx = buffer1[idx - 1] - buffer1[idx + 1];
            const dy = buffer1[idx - width] - buffer1[idx + width];
            
            // Map values to R and G channels
            r = Math.max(0, Math.min(255, Math.round(127 + dx * 1.5)));
            g = Math.max(0, Math.min(255, Math.round(127 + dy * 1.5)));
          }

          dispData[i]     = r;
          dispData[i + 1] = g;
          dispData[i + 2] = 127;
          dispData[i + 3] = 255;
          i += 4;
        }
      }

      ctx.putImageData(dispImgData, 0, 0);
      
      try {
        const dataUrl = canvas.toDataURL();
        feImage.setAttribute('href', dataUrl);
      } catch (e) {
        console.error("Failed to generate data URL for SVG water displacement filter:", e);
      }

      animationId = requestAnimationFrame(animate);
    }

    animate();

    // Cleanup removing global event listeners safely
    window._canvasCleanup = () => {
      cancelAnimationFrame(animationId);
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }

  // Bind scroll down indicator click event
  function initScrollIndicator() {
    const indicator = $('.hero-panel .scroll-down-indicator');
    if (indicator) {
      indicator.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.scrollTo({
          top: window.innerHeight - 57,
          behavior: 'smooth'
        });
      });
    }
  }

  /* ──────────────────────────────────────────────────────────
     INIT
  ────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    loadHomeFeaturedProjects();
    handleInitialRoute();
    initHeroCanvas();
    initScrollIndicator();
  });

  if (document.readyState !== 'loading') {
    loadHomeFeaturedProjects();
    handleInitialRoute();
    initHeroCanvas();
    initScrollIndicator();
  }

})();
