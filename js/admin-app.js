/* ============================================
   FightHub — Admin CRM Application Scripts
   Handles auth checks, responsive sidebar toggle,
   navigation highlights, activity logs, and dashboard stats.
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Authenticate check: redirect to login if session missing/expired
  await dataStore.ready;
  if (!(await checkAuthentication())) return;
  showSignedInUser();

  // 2. Setup sidebar responsive toggle
  setupMobileToggle();

  // 3. Highlight current sidebar item
  highlightActiveNav();

  // 4. Bind logout action
  setupLogout();

  // 4b. Clicking anywhere on a table row opens that record's editor
  setupRowClickToEdit();

  // 5. Dashboard Specific Logic (only runs if we are on index.html)
  const isDashboard = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/') || window.location.pathname.endsWith('/admin/');
  if (isDashboard) {
    await renderDashboardStats();
    await renderRecentActivity();
    await renderReviewQueue();
  }
});

// ---- Auth Verification ---- //
async function checkAuthentication() {
  const isLoginPage = window.location.pathname.endsWith('login.html');
  const signedIn = await dataStore.isAdminSignedIn();

  if (!signedIn && !isLoginPage) {
    // Session is missing, expired or not an admin: back to login
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

async function showSignedInUser() {
  const email = await dataStore.getAdminEmail();
  const nameEl = document.querySelector('.admin-user-name');
  const avatarEl = document.querySelector('.admin-user-avatar');
  if (email && nameEl) {
    nameEl.textContent = email;
    if (avatarEl) avatarEl.textContent = email.substring(0, 2).toUpperCase();
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
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await dataStore.signOutAdmin();
      window.location.href = 'login.html';
    });
  }
}

// ---- Row click opens the editor ---- //
function setupRowClickToEdit() {
  document.addEventListener('click', (e) => {
    const row = e.target.closest('.admin-table tbody tr');
    if (!row || e.target.closest('button, a, input, select, label')) return;
    const editBtn = row.querySelector('.btn-edit');
    if (editBtn) editBtn.click();
  });

  // Mark rows that have an editor so CSS can show a pointer cursor
  new MutationObserver(() => {
    document.querySelectorAll('.admin-table tbody tr').forEach(row => {
      if (row.querySelector('.btn-edit')) row.setAttribute('data-editable', '');
    });
  }).observe(document.body, { childList: true, subtree: true });
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
        <strong>${log.action.toUpperCase()}</strong>: ${escapeHtml(log.itemName)} in <em>${collectionFriendly}</em>
        <div class="activity-time">${timeString}</div>
      </div>
    `;
    activityList.appendChild(li);
  });
}

// ---- AI Review Queue ---- //
// Records the AI worker saved as drafts (new fighter profiles) wait here until approved.
async function renderReviewQueue() {
  const container = document.getElementById('review-queue');
  if (!container) return;

  const sources = [
    { store: 'fighters', label: 'Fighter', page: 'fighters.html', name: f => f.name },
    { store: 'articles', label: 'Article', page: 'articles.html', name: a => a.title }
  ];
  const drafts = [];
  for (const src of sources) {
    (await dataStore.getAll(src.store)).filter(item => item.draft && !item.duplicate).forEach(item => drafts.push({ src, item }));
  }

  if (!drafts.length) {
    container.innerHTML = '<p style="color: var(--admin-text-muted); margin: 0;">Nothing to review. New AI-drafted fighter profiles will appear here.</p>';
    return;
  }

  container.innerHTML = `
    <p style="color: var(--admin-text-muted); font-size: 0.85rem; margin-top: 0;">
      These were drafted by the AI from Wikipedia and are hidden from visitors. Check the details (open the source), then approve.
    </p>
    <div class="admin-table-wrapper"><table class="admin-table">
      <thead><tr><th>Type</th><th>Name</th><th>Details</th><th>Source</th><th>Actions</th></tr></thead>
      <tbody>${drafts.map(({ src, item }, i) => `
        <tr>
          <td>${src.label}</td>
          <td><strong>${escapeHtml(src.name(item))}</strong></td>
          <td style="white-space: normal; max-width: 360px; font-size: 0.8rem; color: var(--admin-text-muted);">
            ${src.store === 'fighters'
              ? `${escapeHtml([item.sport, item.weightClass, item.country].filter(Boolean).join(' · '))}<br>Record: ${escapeHtml(item.wins ?? '?')}-${escapeHtml(item.losses ?? '?')}-${escapeHtml(item.draws ?? '?')}${item.image ? ' · 📷 photo' : ''}`
              : escapeHtml(item.excerpt || '')}
          </td>
          <td>${item.sourceUrl ? `<a href="${safeUrl(item.sourceUrl, '#')}" target="_blank" rel="noopener">Open ↗</a>` : '-'}</td>
          <td>
            <div class="table-actions">
              <button class="table-action js-approve" data-i="${i}">✅ Approve</button>
              <a class="table-action" href="${src.page}?edit=${encodeURIComponent(item.id)}">✏️ Edit</a>
              <button class="table-action delete js-reject" data-i="${i}">🗑️</button>
            </div>
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;

  container.querySelectorAll('.js-approve').forEach(btn => btn.addEventListener('click', async () => {
    const { src, item } = drafts[btn.dataset.i];
    await dataStore.update(src.store, { id: item.id, draft: false });
    showToast(`${src.name(item)} is now live`, 'success');
    renderReviewQueue();
  }));
  container.querySelectorAll('.js-reject').forEach(btn => btn.addEventListener('click', async () => {
    const { src, item } = drafts[btn.dataset.i];
    if (!confirm(`Delete the draft "${src.name(item)}"?`)) return;
    await dataStore.delete(src.store, item.id);
    showToast('Draft deleted', 'info');
    renderReviewQueue();
  }));
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
