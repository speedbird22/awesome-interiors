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
     STATE & FIREBASE MOCK FALLBACK
  ────────────────────────────────────────────────────────── */
  let currentPage = 'home';
  let isTransitioning = false;
  let isFirestoreDisabled = false;

  // LocalStorage Database Mock
  class LocalStorageFirestoreMock {
    collection(name) {
      return {
        orderBy: (field, direction) => {
          return {
            get: () => {
              return new Promise((resolve) => {
                const list = JSON.parse(localStorage.getItem(`mock_db_${name}`) || '[]');
                list.sort((a, b) => {
                  const valA = a[field];
                  const valB = b[field];
                  if (direction === 'desc') {
                    return valA < valB ? 1 : valA > valB ? -1 : 0;
                  }
                  return valA > valB ? 1 : valA < valB ? -1 : 0;
                });
                const snapshot = {
                  empty: list.length === 0,
                  forEach: (callback) => {
                    list.forEach(item => {
                      callback({
                        data: () => item,
                        id: item.id,
                        exists: true
                      });
                    });
                  }
                };
                resolve(snapshot);
              });
            }
          };
        },
        doc: (id) => {
          return {
            id: id,
            get: () => {
              return new Promise((resolve) => {
                const list = JSON.parse(localStorage.getItem(`mock_db_${name}`) || '[]');
                const item = list.find(x => x.id === id);
                resolve({
                  exists: !!item,
                  data: () => item
                });
              });
            },
            set: (data) => {
              return new Promise((resolve) => {
                const list = JSON.parse(localStorage.getItem(`mock_db_${name}`) || '[]');
                const dataCopy = { ...data };
                if (dataCopy.createdAt && typeof dataCopy.createdAt === 'object') {
                  dataCopy.createdAt = new Date().toISOString();
                }
                const idx = list.findIndex(x => x.id === id);
                if (idx !== -1) {
                  list[idx] = { ...list[idx], ...dataCopy };
                } else {
                  list.push(dataCopy);
                }
                localStorage.setItem(`mock_db_${name}`, JSON.stringify(list));
                resolve();
              });
            },
            delete: () => {
              return new Promise((resolve) => {
                let list = JSON.parse(localStorage.getItem(`mock_db_${name}`) || '[]');
                list = list.filter(x => x.id !== id);
                localStorage.setItem(`mock_db_${name}`, JSON.stringify(list));
                resolve();
              });
            }
          };
        }
      };
    }
  }

  // LocalStorage Storage Mock
  class LocalStorageStorageMock {
    ref(path) {
      return {
        put: (file) => {
          let downloadUrl = '';
          const task = {
            on: (event, progress, error, complete) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                downloadUrl = e.target.result;
                progress({ bytesTransferred: 50, totalBytes: 100 });
                setTimeout(() => {
                  progress({ bytesTransferred: 100, totalBytes: 100 });
                  complete();
                }, 100);
              };
              reader.onerror = (err) => error(err);
              reader.readAsDataURL(file);
            },
            snapshot: {
              ref: {
                getDownloadURL: () => {
                  return Promise.resolve(downloadUrl);
                }
              }
            }
          };
          return task;
        }
      };
    }
    refFromURL(url) {
      return {
        delete: () => Promise.resolve()
      };
    }
  }

  let db = null;
  let storage = null;

  function switchToFallback() {
    if (isFirestoreDisabled) return;
    isFirestoreDisabled = true;
    db = new LocalStorageFirestoreMock();
    storage = new LocalStorageStorageMock();
    console.warn("Using LocalStorage fallback database and storage.");
    // Show a user-friendly unobtrusive message on page if admin
    const listContainer = $('#adminProjectsList');
    if (listContainer && currentPage === 'admin') {
      const banner = document.createElement('div');
      banner.id = "fallback-warning-banner";
      banner.style.background = '#ffebee';
      banner.style.color = '#c62828';
      banner.style.padding = '12px';
      banner.style.fontSize = '12px';
      banner.style.marginBottom = '20px';
      banner.style.border = '1px solid #ffcdd2';
      banner.style.fontFamily = 'var(--font-sans)';
      banner.innerText = "⚠️ Cloud Firestore is disabled in your Firebase console. The website has automatically enabled a LocalStorage database fallback, allowing you to add, view, and test projects locally.";
      listContainer.parentNode.insertBefore(banner, listContainer);
    }
  }

  // Define global firebase mock if not loaded (for serverTimestamp compatibility)
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
  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
    try {
      db = firebase.firestore();
      storage = firebase.storage();
    } catch (e) {
      console.warn("Failed to initialize Firebase services, switching to fallback:", e);
      switchToFallback();
    }
  } else {
    switchToFallback();
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
      currentPage = pageName === 'project-detail' ? `project-detail-${projectId}` : hash;
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
      console.error("Error loading featured projects:", err);
      if (!isFirestoreDisabled && (err.code === 'permission-denied' || (err.message && err.message.includes('Cloud Firestore API')))) {
        switchToFallback();
        loadHomeFeaturedProjects();
      }
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
        const featuredImgUrl = proj.images[proj.featuredImageIndex] || proj.images[0];
        
        const card = document.createElement('a');
        card.className = 'project-item';
        card.href = `#project-detail-${proj.id}`;
        card.dataset.page = `project-detail-${proj.id}`;
        
        card.innerHTML = `
          <div class="project-img-wrap hover-zoom" style="aspect-ratio: 4/3; overflow: hidden; background: #ccc; margin-bottom: 16px;">
            <img src="${featuredImgUrl}" alt="${proj.name}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease;"/>
          </div>
          <div class="project-info" style="padding: 0 4px;">
            <p class="project-name" style="font-family: var(--font-serif); font-size: 16px; font-weight: 400; font-style: italic; margin-bottom: 4px; line-height: 1.3;">${proj.name}</p>
            <p class="project-cat" style="font-family: var(--font-sans); font-size: 10.5px; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.6;">${proj.location} &nbsp;&middot;&nbsp; ${proj.category}</p>
          </div>
        `;
        
        grid.appendChild(card);
      });
    }).catch(err => {
      console.error("Error loading public projects:", err);
      if (!isFirestoreDisabled && (err.code === 'permission-denied' || (err.message && err.message.includes('Cloud Firestore API')))) {
        switchToFallback();
        loadPublicProjects();
      } else {
        grid.innerHTML = `<p style="font-family: var(--font-sans); font-size: 13px; opacity: 0.6; text-align: center; grid-column: 1 / -1; padding: 60px 0; color: #b00020;">Failed to load projects: ${err.message}</p>`;
      }
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
            <div class="hover-zoom" style="grid-column: 1 / -1; aspect-ratio: 16/9; overflow: hidden; background: #ddd; margin-bottom: 20px;">
              <img src="${imgUrl}" alt="${proj.name}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.8s ease;"/>
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
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 20px;">
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
      console.error("Error rendering project details:", err);
      if (!isFirestoreDisabled && (err.code === 'permission-denied' || (err.message && err.message.includes('Cloud Firestore API')))) {
        switchToFallback();
        renderProjectDetail(projectId);
      } else {
        container.innerHTML = `<p style="font-family: var(--font-sans); font-size: 13px; opacity: 0.6; color: #b00020; text-align: center;">Failed to load project details: ${err.message}</p>`;
      }
    });
  }

  let selectedFiles = [];
  let featuredIndex = 0;
  let isUploading = false;

  function loadAdminDashboard() {
    if (!db || !storage) return;
    
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
        featuredIndex = 0;
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
            const fileId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${file.name}`;
            const storageRef = storage.ref(`projects/${projectId}/${fileId}`);
            const uploadTask = storageRef.put(file);
            
            const url = await new Promise((resolve, reject) => {
              uploadTask.on('state_changed', 
                (snapshot) => {
                  const filePercent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                  const totalPercent = Math.round(((i * 100) + filePercent) / selectedFiles.length);
                  percentText.innerText = `${totalPercent}%`;
                  progressBar.style.width = `${totalPercent}%`;
                  statusText.innerText = `Uploading image ${i + 1} of ${selectedFiles.length}...`;
                }, 
                (err) => reject(err), 
                () => {
                  uploadTask.snapshot.ref.getDownloadURL().then(resolve);
                }
              );
            });
            imageUrls.push(url);
          }
          
          const projectData = {
            id: projectId,
            name: $('#projName').value.trim(),
            location: $('#projLocation').value.trim(),
            date: $('#projDate').value.trim(),
            category: $('#projCategory').value.trim(),
            images: imageUrls,
            featuredImageIndex: featuredIndex,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          };
          
          await db.collection('projects').doc(projectId).set(projectData);
          
          alert("Project created successfully!");
          form.reset();
          selectedFiles = [];
          featuredIndex = 0;
          if (previewsContainer) previewsContainer.innerHTML = '';
          progressContainer.style.display = 'none';
          
          renderAdminProjectsList();
          loadHomeFeaturedProjects();
          
        } catch (err) {
          console.error("Upload failed:", err);
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
        
        const img = document.createElement('img');
        img.src = e.target.result;
        img.style.width = '100%';
        img.style.height = '80px';
        img.style.objectFit = 'cover';
        
        const star = document.createElement('button');
        star.type = 'button';
        star.style.position = 'absolute';
        star.style.bottom = '8px';
        star.style.left = '50%';
        star.style.transform = 'translateX(-50%)';
        star.style.background = 'rgba(255,255,255,0.9)';
        star.style.border = '1px solid rgba(0,0,0,0.2)';
        star.style.borderRadius = '50%';
        star.style.width = '24px';
        star.style.height = '24px';
        star.style.cursor = 'pointer';
        star.style.display = 'flex';
        star.style.alignItems = 'center';
        star.style.justifyContent = 'center';
        star.style.color = index === featuredIndex ? '#d29b02' : '#888';
        star.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="${index === featuredIndex ? '#d29b02' : 'none'}" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        `;
        
        star.addEventListener('click', (ev) => {
          ev.preventDefault();
          featuredIndex = index;
          renderAdminPreviews();
        });
        
        item.appendChild(img);
        item.appendChild(star);
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
          const isFeatured = idx === proj.featuredImageIndex;
          thumbsHtml += `
            <div style="position: relative; width: 60px; height: 60px; border: 1px solid ${isFeatured ? '#d29b02' : 'rgba(0,0,0,0.1)'}; padding: 2px;">
              <img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover;"/>
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
              const deletePromises = proj.images.map(url => {
                return storage.refFromURL(url).delete().catch(e => console.error("Storage delete fail:", e));
              });
              
              Promise.all(deletePromises).then(() => {
                alert("Project deleted successfully.");
                renderAdminProjectsList();
                loadHomeFeaturedProjects();
              });
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
      console.error("Error loading admin projects list:", err);
      if (!isFirestoreDisabled && (err.code === 'permission-denied' || (err.message && err.message.includes('Cloud Firestore API')))) {
        switchToFallback();
        renderAdminProjectsList();
      } else {
        listContainer.innerHTML = `<p style="font-family: var(--font-sans); font-size: 13px; opacity: 0.6; color: #b00020;">Failed to load projects: ${err.message}</p>`;
      }
    });
  }

  /* ──────────────────────────────────────────────────────────
     INIT
  ────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    loadHomeFeaturedProjects();
    handleInitialRoute();
  });

  if (document.readyState !== 'loading') {
    loadHomeFeaturedProjects();
    handleInitialRoute();
  }

})();
