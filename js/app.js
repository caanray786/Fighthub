/* ============================================
   FightHub — Core App Logic
   Handles global page initialization, navigation,
   mobile menu, dark/light mode, and animations.
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize data store
  if (window.dataStore) {
    try {
      await window.dataStore.ready;
    } catch (err) {
      console.error('Failed to initialize dataStore:', err);
    }
  }


  // 2. Initialize Theme (Dark/Light Mode)
  initTheme();

  // 3. Initialize Navigation & Header behaviors
  initNavbar();

  // 4. Initialize Scroll Animations
  initScrollAnimations();

  // 4b. Initialize Scroll-Driven Hero Animation
  initHeroScrollAnimation();

  // 5. Global Toast helper
  window.showToast = showToast;
});

// ---- Scroll-Driven Hero Animation ---- //
function initHeroScrollAnimation() {
  const wrapper = document.getElementById('hero-scroll-wrapper');
  const hero = document.querySelector('.hero');
  const canvas = document.getElementById('hero-scrub-canvas');
  const heroContent = document.querySelector('.hero-content');
  
  if (!wrapper || !hero || !canvas) return;

  const ctx = canvas.getContext('2d');
  const totalFrames = 76;
  const images = new Array(totalFrames);
  let currentFrameIndex = -1;

  // Visitors who ask for less motion or less data get a still first frame
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;
  const animate = !reduceMotion && !saveData;

  function loadFrame(i) {
    const img = new Image();
    img.decoding = 'async';
    img.src = `images/hero/frame-${String(i).padStart(3, '0')}.jpg`;
    img.onerror = () => console.warn(`Failed to load hero frame ${i}`);
    images[i - 1] = img;
    return img;
  }

  // First frame straight away, the rest once the page has finished loading
  loadFrame(1).onload = () => drawFrame(1);
  if (animate) {
    const loadRest = () => { for (let i = 2; i <= totalFrames; i++) loadFrame(i); };
    if (document.readyState === 'complete') loadRest();
    else window.addEventListener('load', loadRest, { once: true });
  }

  // Draw image on canvas with cover scaling
  function drawFrame(frameIndex) {
    if (frameIndex === currentFrameIndex) return;

    // Fall back to the nearest earlier frame that has finished loading
    let img = images[frameIndex - 1];
    while ((!img || !img.complete || img.naturalWidth === 0) && frameIndex > 1) {
      frameIndex--;
      img = images[frameIndex - 1];
    }
    if (!img || !img.complete || img.naturalWidth === 0) return;
    
    currentFrameIndex = frameIndex;

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    
    // Support high DPI screens
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const imgRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = width / height;
    
    let drawWidth = width;
    let drawHeight = height;
    let drawX = 0;
    let drawY = 0;

    if (imgRatio > canvasRatio) {
      drawWidth = height * imgRatio;
      drawX = (width - drawWidth) / 2;
    } else {
      drawHeight = width / imgRatio;
      drawY = (height - drawHeight) / 2;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
  }

  // Handle window scroll with pinning
  window.addEventListener('scroll', () => {
    if (!animate) return;
    const scrollPos = window.scrollY;
    const wrapperHeight = wrapper.offsetHeight;
    const windowHeight = window.innerHeight;
    
    // The scrollable range of the wrapper
    const animScrollRange = wrapperHeight - windowHeight;

    if (scrollPos <= animScrollRange) {
      // Calculate progress from 0 to 1 while pinned
      const progress = scrollPos / animScrollRange;

      // Scrub through frames: map progress [0, 1] to frame [1, 151]
      const targetFrame = Math.min(
        totalFrames,
        Math.max(1, Math.floor(progress * (totalFrames - 1)) + 1)
      );
      
      requestAnimationFrame(() => drawFrame(targetFrame));

      // Parallax text content
      if (heroContent) {
        // Fade out during the last 30% of the pinned scroll
        const fadeStart = 0.7;
        let contentOpacity = 1;
        if (progress > fadeStart) {
          contentOpacity = 1 - (progress - fadeStart) / (1 - fadeStart);
        }
        
        heroContent.style.opacity = `${contentOpacity}`;
        heroContent.style.transform = `translateY(${scrollPos * 0.2}px)`;
      }
    }
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    if (currentFrameIndex !== -1) {
      drawFrame(currentFrameIndex);
    }
  });
}



// ---- Theme Control ---- //
function initTheme() {
  const currentTheme = window.dataStore ? window.dataStore.getTheme() : 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  
  const themeToggleBtns = document.querySelectorAll('.theme-toggle');
  themeToggleBtns.forEach(btn => {
    // Set initial icon
    updateThemeIcon(btn, currentTheme);
    
    btn.addEventListener('click', () => {
      const activeTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = activeTheme === 'dark' ? 'light' : 'dark';
      
      if (window.dataStore) {
        window.dataStore.setTheme(newTheme);
      } else {
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('fighthub_theme', newTheme);
      }
      
      themeToggleBtns.forEach(b => updateThemeIcon(b, newTheme));
    });
  });
}

function updateThemeIcon(btn, theme) {
  if (theme === 'dark') {
    btn.innerHTML = '☀️'; // Sun icon for switching to light mode
    btn.setAttribute('title', 'Switch to Light Mode');
  } else {
    btn.innerHTML = '🌙'; // Moon icon for switching to dark mode
    btn.setAttribute('title', 'Switch to Dark Mode');
  }
}

// ---- Navbar & Responsive Navigation ---- //
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  const mobileToggle = document.querySelector('.mobile-toggle');
  const navLinks = document.querySelector('.navbar-links');

  // Handle sticky header on scroll
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar?.classList.add('scrolled');
    } else {
      navbar?.classList.remove('scrolled');
    }
  });

  // Mobile menu toggle
  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      mobileToggle.classList.toggle('active');
      navLinks.classList.toggle('active');
    });

    // Close mobile menu when clicking outside or on a link
    document.addEventListener('click', (e) => {
      if (!navLinks.contains(e.target) && !mobileToggle.contains(e.target)) {
        mobileToggle.classList.remove('active');
        navLinks.classList.remove('active');
      }
    });

    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileToggle.classList.remove('active');
        navLinks.classList.remove('active');
      });
    });
  }

  // Highlight active page link
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const links = document.querySelectorAll('.navbar-links a');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath === 'index.html' && href === '#')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// ---- Scroll Triggered Animations ---- //
function initScrollAnimations() {
  const animatedElements = document.querySelectorAll('.animate-on-scroll');
  
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animated');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    animatedElements.forEach(el => observer.observe(el));
  } else {
    // Fallback: animate all immediately if observer is not supported
    animatedElements.forEach(el => el.classList.add('animated'));
  }
}

// ---- Toast Notification System ---- //
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  // Only one toast at a time: a new message replaces the current one
  container.querySelectorAll('.toast').forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'warning') icon = '⚠️';

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message"></span>
  `;
  toast.querySelector('.toast-message').textContent = message;

  container.appendChild(toast);

  // Auto remove toast
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.4s ease forwards';
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3000);
}
