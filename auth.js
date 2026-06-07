(function () {
  'use strict';

  // 1. Firebase Initialization (using global firebase object from Compat CDN)
  const firebaseConfig = {
    apiKey: "AIzaSyBJ1XvASsCXL78rMJAs25K6oKCr393ixbM",
    authDomain: "awesome--interiors.firebaseapp.com",
    projectId: "awesome--interiors",
    storageBucket: "awesome--interiors.firebasestorage.app",
    messagingSenderId: "113132383610",
    appId: "1:113132383610:web:bbe63676b415f7a4f7bac3"
  };

  // Check if firebase compat library is loaded
  if (typeof firebase === 'undefined') {
    console.error("Firebase SDK is not loaded. Please check your internet connection and CDN scripts.");
    return;
  }

  // Initialize Firebase (if not already initialized)
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  let auth = firebase.auth();

  // Backdoor/Mocking for testing admin dashboard locally without real Google Auth
  const isMockAdmin = window.location.search.includes("mockAdmin=true");
  if (isMockAdmin) {
    const mockUser = {
      email: "awesomeinteriorshyd@gmail.com",
      displayName: "Mock Admin",
      photoURL: "",
      uid: "mock-admin-uid"
    };
    auth = {
      currentUser: mockUser,
      onAuthStateChanged: function (callback) {
        setTimeout(() => callback(mockUser), 100);
        return () => {};
      },
      signOut: function () {
        window.location.href = window.location.pathname; // remove query param
        return Promise.resolve();
      },
      signInWithPopup: function () {
        return Promise.resolve({ user: mockUser });
      },
      isSignInWithEmailLink: () => false
    };
  }

  const googleProvider = new firebase.auth.GoogleAuthProvider();

  // 2. Inject Auth Modal UI
  function initAuthUI() {
    if (!document.getElementById("authModal")) {
      const modalDiv = document.createElement("div");
      modalDiv.id = "authModal";
      modalDiv.className = "auth-modal";
      modalDiv.innerHTML = `
        <div class="auth-modal-overlay"></div>
        <div class="auth-modal-content">
          <button class="auth-modal-close" aria-label="Close modal">&times;</button>
          <div class="auth-modal-header">
            <h2 class="noe-heading">AWESOME Interiors</h2>
            <p class="auth-modal-subtitle">Access your premium design portal</p>
          </div>
          <button class="google-signin-btn" id="googleSignInBtn">
            <svg class="google-icon" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69c-.29 1.5-.1.85-1.11 2.52l3.23 2.5c1.89-1.73 2.93-4.3 2.93-7.3s-.18.45-.74.45z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.23-2.5c-.9.6-2.06.96-3.32.96-3.13 0-5.78-2.11-6.73-4.96L3.34 17.52C5.32 21.46 9.4 24 12 24z"/>
              <path fill="#FBBC05" d="M5.27 14.59c-.25-.75-.39-1.55-.39-2.39s.14-1.64.39-2.39L1.97 7.27C1.19 8.83 1 10.45 1 12s.19 3.17.97 4.73l3.3-2.14z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.96 1.19 15.24 0 12 0 9.4 0 5.32 2.54 3.34 6.48l3.3 2.14c.95-2.85 3.6-4.96 6.73-4.96z"/>
            </svg>
            <span>Sign in with Google</span>
          </button>
          <div class="auth-divider">
            <span>or</span>
          </div>
          <form class="auth-email-form" id="authEmailForm">
            <input type="email" id="authEmailInput" placeholder="YOUR EMAIL ADDRESS *" required autocomplete="off"/>
            <button type="submit" class="auth-submit-btn">
              <span>SEND MAGIC LINK</span>
            </button>
          </form>
          <button class="guest-signin-btn" id="guestSignInBtn">Continue as Guest</button>
          <div class="auth-status-msg" id="authStatusMsg"></div>
        </div>
      `;
      document.body.appendChild(modalDiv);
      
      const closeBtn = modalDiv.querySelector(".auth-modal-close");
      const overlay = modalDiv.querySelector(".auth-modal-overlay");
      const guestBtn = modalDiv.querySelector("#guestSignInBtn");
      
      const closeModal = () => modalDiv.classList.remove("active");
      closeBtn.addEventListener("click", closeModal);
      overlay.addEventListener("click", closeModal);
      
      guestBtn.addEventListener("click", () => {
        localStorage.setItem("firstTimeVisit", "done");
        closeModal();
      });
      
      // Google Auth handler
      const googleBtn = modalDiv.querySelector("#googleSignInBtn");
      googleBtn.addEventListener("click", function () {
        const statusMsg = document.getElementById("authStatusMsg");
        statusMsg.style.display = "none";
        auth.signInWithPopup(googleProvider)
          .then(() => {
            localStorage.setItem("firstTimeVisit", "done");
            closeModal();
          })
          .catch((err) => {
            console.error(err);
            statusMsg.innerText = "Error signing in with Google: " + err.message;
            statusMsg.className = "auth-status-msg error";
          });
      });

      // Email Link Auth handler
      const emailForm = modalDiv.querySelector("#authEmailForm");
      emailForm.addEventListener("submit", function (e) {
        e.preventDefault();
        const emailInput = document.getElementById("authEmailInput");
        const statusMsg = document.getElementById("authStatusMsg");
        statusMsg.style.display = "none";
        
        const email = emailInput.value.trim();
        const cleanHref = window.location.href.split('?')[0].split('#')[0];
        const actionCodeSettings = {
          url: cleanHref,
          handleCodeInApp: true
        };

        auth.sendSignInLinkToEmail(email, actionCodeSettings)
          .then(() => {
            window.localStorage.setItem("emailForSignIn", email);
            localStorage.setItem("firstTimeVisit", "done");
            statusMsg.innerText = "Magic sign-in link sent! Please check your inbox.";
            statusMsg.className = "auth-status-msg success";
            emailInput.value = "";
          })
          .catch((err) => {
            console.error(err);
            statusMsg.innerText = "Error sending link: " + err.message;
            statusMsg.className = "auth-status-msg error";
          });
      });
    }
    
    injectNavLinks();
  }

  // 3. Inject Navigation Triggers
  function injectNavLinks() {
    const desktopNavUl = document.querySelector(".desktop-nav ul");
    const mobileNavUl = document.querySelector(".mobile-menu nav ul");

    document.querySelectorAll(".auth-nav-item").forEach(item => item.remove());

    if (desktopNavUl) {
      const desktopLi = document.createElement("li");
      desktopLi.className = "auth-nav-item";
      desktopLi.innerHTML = `
        <button class="user-profile-btn" id="desktopAuthLink" title="User Profile"></button>
        <div class="auth-dropdown" id="desktopAuthDropdown"></div>
      `;
      desktopNavUl.appendChild(desktopLi);
      
      const btn = desktopLi.querySelector("#desktopAuthLink");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleDropdown("desktopAuthDropdown");
      });
    }

    if (mobileNavUl) {
      const mobileLi = document.createElement("li");
      mobileLi.className = "auth-nav-item";
      mobileLi.innerHTML = `
        <button class="user-profile-btn" id="mobileAuthLink" title="User Profile"></button>
        <div class="auth-dropdown" id="mobileAuthDropdown"></div>
      `;
      mobileNavUl.appendChild(mobileLi);
      
      const btn = mobileLi.querySelector("#mobileAuthLink");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleDropdown("mobileAuthDropdown");
      });
    }

    updateNavState(auth.currentUser);
  }

  function toggleDropdown(id) {
    const dropdown = document.getElementById(id);
    const active = dropdown.classList.contains("active");
    
    // Close other dropdowns
    document.querySelectorAll(".auth-dropdown").forEach(d => d.classList.remove("active"));
    
    if (!active) {
      dropdown.classList.add("active");
    }
  }

  // Close dropdowns on outside click
  document.addEventListener("click", () => {
    document.querySelectorAll(".auth-dropdown").forEach(d => d.classList.remove("active"));
  });

  function updateNavState(user) {
    const getAvatarContent = (user) => {
      if (user) {
        if (user.photoURL) {
          return `<img src="${user.photoURL}" alt="User Profile"/>`;
        }
        const initial = (user.displayName || user.email || "U").charAt(0).toUpperCase();
        return `<div class="user-monogram">${initial}</div>`;
      }
      return `<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
    };

    const getDropdownContent = (user) => {
      if (user) {
        const name = user.displayName || user.email.split("@")[0];
        return `
          <span class="auth-dropdown-greeting">Greetings, <span>${name}</span></span>
          <button class="auth-dropdown-btn" id="signOutBtn">Sign Out</button>
        `;
      }
      return `
        <span class="auth-dropdown-greeting">Greetings, <span>Guest</span></span>
        <button class="auth-dropdown-btn" id="signInBtn">Sign In</button>
      `;
    };

    const desktopBtn = document.getElementById("desktopAuthLink");
    const mobileBtn = document.getElementById("mobileAuthLink");
    if (desktopBtn) desktopBtn.innerHTML = getAvatarContent(user);
    if (mobileBtn) mobileBtn.innerHTML = getAvatarContent(user);

    const desktopDropdown = document.getElementById("desktopAuthDropdown");
    const mobileDropdown = document.getElementById("mobileAuthDropdown");

    if (desktopDropdown) {
      desktopDropdown.innerHTML = getDropdownContent(user);
      const actionBtn = desktopDropdown.querySelector(".auth-dropdown-btn");
      actionBtn.addEventListener("click", handleDropdownAction);
    }
    if (mobileDropdown) {
      mobileDropdown.innerHTML = getDropdownContent(user);
      const actionBtn = mobileDropdown.querySelector(".auth-dropdown-btn");
      actionBtn.addEventListener("click", handleDropdownAction);
    }
  }

  function handleDropdownAction(e) {
    e.stopPropagation();
    document.querySelectorAll(".auth-dropdown").forEach(d => d.classList.remove("active"));
    
    if (auth.currentUser) {
      auth.signOut()
        .then(() => console.log("Logged out successfully"))
        .catch(err => console.error(err));
    } else {
      const modal = document.getElementById("authModal");
      if (modal) modal.classList.add("active");
    }
  }

  // 4. Contact Form Blocker overlay logic
  function updateContactBlocker() {
    const isContactPage = window.location.pathname.indexOf("contact.html") !== -1 || 
                          (document.getElementById("page-contact") && document.getElementById("page-contact").classList.contains("active"));

    if (!isContactPage) return;

    const formWraps = document.querySelectorAll(".contact-form-wrap");
    const user = auth.currentUser;

    formWraps.forEach(wrap => {
      let blocker = wrap.querySelector(".contact-form-blocker");

      if (!user) {
        // Obscure the form behind the translucent block
        if (!blocker) {
          blocker = document.createElement("div");
          blocker.className = "contact-form-blocker";
          blocker.innerHTML = `
            <div class="blocker-text">Sign in to get a direct estimation</div>
            <button class="blocker-btn" id="blockerSignInBtn">SIGN IN</button>
          `;
          wrap.appendChild(blocker);
          
          blocker.querySelector("#blockerSignInBtn").addEventListener("click", () => {
            const modal = document.getElementById("authModal");
            if (modal) modal.classList.add("active");
          });
        }
      } else {
        // Unblock form
        if (blocker) {
          blocker.remove();
        }
      }
    });
  }

  function updateAdminNav(user) {
    document.querySelectorAll(".admin-only-link-item").forEach(el => el.remove());

    if (user && user.email === "awesomeinteriorshyd@gmail.com") {
      const desktopNavUl = document.querySelector(".desktop-nav ul");
      if (desktopNavUl) {
        const adminLi = document.createElement("li");
        adminLi.className = "admin-only-link-item";
        adminLi.innerHTML = `<a class="nav-link" href="index.html#admin" data-page="admin">Admin Dashboard</a>`;
        const authItem = desktopNavUl.querySelector(".auth-nav-item");
        if (authItem) {
          desktopNavUl.insertBefore(adminLi, authItem);
        } else {
          desktopNavUl.appendChild(adminLi);
        }
      }

      const mobileNavUl = document.querySelector(".mobile-menu nav ul");
      if (mobileNavUl) {
        const adminLi = document.createElement("li");
        adminLi.className = "admin-only-link-item";
        adminLi.innerHTML = `<a href="index.html#admin" data-page="admin">Admin Dashboard</a>`;
        const authItem = mobileNavUl.querySelector(".auth-nav-item");
        if (authItem) {
          mobileNavUl.insertBefore(adminLi, authItem);
        } else {
          mobileNavUl.appendChild(adminLi);
        }
      }
    }
  }

  // Hook into SPA router changes in script.js if navigation happens dynamically
  const originalNavigateTo = window.navigateTo;
  if (typeof originalNavigateTo === 'function') {
    window.navigateTo = function (page, push) {
      if (page === 'admin') {
        const user = auth.currentUser;
        if (!user || user.email !== "awesomeinteriorshyd@gmail.com") {
          alert("Access Denied: You must be signed in as the admin to view the dashboard.");
          return;
        }
      }
      originalNavigateTo(page, push);
      setTimeout(updateContactBlocker, 650); // wait for dynamic slide transitions
    };
  }

  // 5. Listen to Auth Changes
  auth.onAuthStateChanged((user) => {
    updateNavState(user);
    updateAdminNav(user);
    updateContactBlocker();

    const hash = window.location.hash.replace('#', '');
    if (hash === 'admin') {
      if (!user || user.email !== "awesomeinteriorshyd@gmail.com") {
        alert("Access Denied: You must be signed in as the admin to view the dashboard.");
        window.location.hash = "#home";
      }
    }
  });

  // 6. Complete Passwordless Sign-In if returning from email link
  function checkEmailLinkRedirection() {
    if (auth.isSignInWithEmailLink(window.location.href)) {
      let email = window.localStorage.getItem("emailForSignIn");
      if (!email) {
        email = window.prompt("Please enter your email to complete sign in:");
      }
      if (email) {
        auth.signInWithEmailLink(email, window.location.href)
          .then((result) => {
            window.localStorage.removeItem("emailForSignIn");
            localStorage.setItem("firstTimeVisit", "done");
            console.log("Successfully logged in:", result.user.email);
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.hash;
            window.history.replaceState({}, null, cleanUrl);
          })
          .catch((err) => {
            console.error("Failed completing email sign in link:", err);
            alert("Sign-in failed: " + err.message);
          });
      }
    }
  }

  // 7. Auto-trigger modal on first-time visit for guest/logged-out users
  function checkFirstTimeVisit() {
    const isHomePage = window.location.pathname.endsWith("index.html") || 
                       window.location.pathname.endsWith("/") || 
                       window.location.pathname === "";

    if (isHomePage && !localStorage.getItem("firstTimeVisit")) {
      // Small timeout to allow auth initialization
      setTimeout(() => {
        if (!auth.currentUser && !localStorage.getItem("firstTimeVisit")) {
          const modal = document.getElementById("authModal");
          if (modal) modal.classList.add("active");
        }
      }, 1500);
    }
  }

  // Initialize UI on load
  function bootstrap() {
    initAuthUI();
    checkEmailLinkRedirection();
    checkFirstTimeVisit();
    setTimeout(updateContactBlocker, 200); // Check blocker shortly after DOM is ready
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }

  // Expose hooks for SPA router overlays
  window.authBootstrap = bootstrap;
  window.authUIReset = injectNavLinks;

})();
