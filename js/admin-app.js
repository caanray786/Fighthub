/* ============================================
   FightHub — Admin CRM Application Scripts
   Handles auth checks, responsive sidebar toggle,
   navigation highlights, activity logs, and dashboard stats.
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Authenticate check: redirect to login if session missing/expired
  await dataStore.ready;
  checkAuthentication();

  // 2. Setup sidebar responsive toggle
  setupMobileToggle();

  // 3. Highlight current sidebar item
  highlightActiveNav();

  // 4. Bind logout action
  setupLogout();

  // 5. Dashboard Specific Logic (only runs if we are on index.html)
  const isDashboard = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/') || window.location.pathname.endsWith('/admin/');
  if (isDashboard) {
    await renderDashboardStats();
    await renderRecentActivity();
  }
});

// ---- Auth Verification ---- //
function checkAuthentication() {
  const session = dataStore.getAdminSession();
  const isLoginPage = window.location.pathname.endsWith('login.html');

  if (!session && !isLoginPage) {
    // Session is missing or expired, redirect to login page
    window.location.href = 'login.html';
  }
}

// ---- Setup Sidebar responsive mobile toggle ---- //
function setupMobileToggle() {
  const sidebar = document.querySelector('.admin-sidebar');
  if (!sidebar) return;

  // Add mobile toggle button dynamically if not present
  let toggleBtn = document.querySelector('.admin-mobile-toggle');
  if (!toggleBtn) {
    toggleBtn = document.createElement('button');
    toggleBtn.className = 'admin-mobile-toggle';
    toggleBtn.innerHTML = '☰';
    toggleBtn.setAttribute('aria-label', 'Toggle Admin Menu');
    document.body.appendChild(toggleBtn);
  }

  // Add overlay dynamically if not present
  let overlay = document.querySelector('.admin-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'admin-overlay';
    document.body.appendChild(overlay);
  }

  // Toggle events
  const toggleAction = () => {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
  };

  toggleBtn.addEventListener('click', toggleAction);
  overlay.addEventListener('click', toggleAction);
}

// ---- Highlight Active Sidebar Item ---- //
function highlightActiveNav() {
  const currentFile = window.location.pathname.split('/').pop() || 'index.html';
  const navMap = {
    'index.html': 'nav-dashboard',
    'fighters.html': 'nav-fighters',
    'articles.html': 'nav-articles',
    'events.html': 'nav-events',
    'rankings.html': 'nav-rankings',
    'gyms.html': 'nav-gyms',
    'martial-arts.html': 'nav-martial-arts',
    'training.html': 'nav-training',
    'settings.html': 'nav-settings'
  };

  const activeId = navMap[currentFile];
  if (activeId) {
    // Remove active from any other
    document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
    // Set active
    document.getElementById(activeId)?.classList.add('active');
  }
}

// ---- Setup Logout Action ---- //
function setupLogout() {
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      dataStore.clearAdminSession();
      window.location.href = 'login.html';
    });
  }
}

// ---- Render Dashboard Stats ---- //
async function renderDashboardStats() {
  // Get counts from stores
  const counts = {
    fighters: await dataStore.count('fighters'),
    articles: await dataStore.count('articles'),
    events: await dataStore.count('events'),
    gyms: await dataStore.count('gyms')
  };

  // Bind to cards
  const cardFighters = document.getElementById('stat-fighters');
  const cardArticles = document.getElementById('stat-articles');
  const cardEvents = document.getElementById('stat-events');
  const cardGyms = document.getElementById('stat-gyms');

  if (cardFighters) cardFighters.textContent = counts.fighters;
  if (cardArticles) cardArticles.textContent = counts.articles;
  if (cardEvents) cardEvents.textContent = counts.events;
  if (cardGyms) cardGyms.textContent = counts.gyms;

  // Render a simple mini-chart in the cards for aesthetic appeal
  renderMiniCharts();
}

// ---- Render Mini Aesthetic Charts for stats ---- //
function renderMiniCharts() {
  const charts = document.querySelectorAll('.mini-chart');
  charts.forEach(chart => {
    chart.innerHTML = '';
    // Generate 6 random bars to represent activity
    for (let i = 0; i < 7; i++) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      const heightPercent = Math.floor(Math.random() * 80) + 20; // 20% to 100%
      bar.style.height = `${heightPercent}%`;
      chart.appendChild(bar);
    }
  });
}

// ---- Render Activity Feed ---- //
async function renderRecentActivity() {
  const activityList = document.getElementById('recent-activity-list');
  if (!activityList) return;

  const logs = dataStore.getActivityLog();
  if (logs.length === 0) {
    activityList.innerHTML = `
      <li class="activity-item" style="justify-content: center; color: var(--admin-text-muted);">
        No recent activities logged.
      </li>
    `;
    return;
  }

  activityList.innerHTML = '';
  // Show top 10 items
  logs.slice(0, 10).forEach(log => {
    const li = document.createElement('li');
    li.className = 'activity-item';

    let iconText = '✏️';
    let iconClass = 'edit';
    if (log.action === 'add') {
      iconText = '➕';
      iconClass = 'add';
    } else if (log.action === 'delete') {
      iconText = '❌';
      iconClass = 'delete';
    }

    const timeString = formatRelativeTime(new Date(log.timestamp));
    const collectionFriendly = formatCollectionName(log.collection);

    li.innerHTML = `
      <div class="activity-icon ${iconClass}">${iconText}</div>
      <div class="activity-text">
        <strong>${log.action.toUpperCase()}</strong>: ${log.itemName} in <em>${collectionFriendly}</em>
        <div class="activity-time">${timeString}</div>
      </div>
    `;
    activityList.appendChild(li);
  });
}

// ---- Helper formatters ---- //
function formatCollectionName(collection) {
  const maps = {
    'fighters': 'Fighters',
    'articles': 'Articles',
    'events': 'Events',
    'gyms': 'Gyms',
    'martialArts': 'Martial Arts',
    'training': 'Training Workouts'
  };
  return maps[collection] || collection;
}

function formatRelativeTime(date) {
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
