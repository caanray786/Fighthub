/* ============================================
   FightHub — Fighters JS
   Handles fetching, live search, filtering, favorite toggle,
   and details modal popup for fighters.
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await dataStore.ready;
  
  // Element selections
  const searchInput = document.getElementById('fighter-search');
  const weightSelect = document.getElementById('filter-weight');
  const styleSelect = document.getElementById('filter-style');
  const countrySelect = document.getElementById('filter-country');
  const fightersGrid = document.getElementById('fighters-grid');
  
  const modal = document.getElementById('fighter-modal');
  const modalBackdrop = document.getElementById('fighter-modal-backdrop');
  const modalClose = document.getElementById('modal-fighter-close');

  let allFighters = [];

  // Generic stock photos were used as fighter images in early seed data. They show
  // the wrong person, so treat them as "no photo" until a real one is attached.
  function fighterPhoto(f) {
    return f.image && !/images\.unsplash\.com/.test(f.image) ? safeUrl(f.image) : '';
  }

  function initials(name) {
    return escapeHtml((name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase());
  }

  function photoOrInitials(f, fontSize) {
    const photo = fighterPhoto(f);
    return photo
      ? `<img src="${photo}" alt="${escapeHtml(f.name)}" loading="lazy" style="width:100%; height:100%; object-fit:cover; transition:transform 0.5s ease;">`
      : `<span style="font-family:var(--font-heading); font-size:${fontSize}; color:rgba(255,255,255,0.85); letter-spacing:0.05em;">${initials(f.name)}</span>`;
  }

  // 1. Fetch data: only the fields cards and filters need; the full profile
  //    is loaded when a fighter is opened
  const LIST_FIELDS = ['name', 'nickname', 'nationality', 'country', 'sport', 'weightClass', 'wins', 'losses', 'draws', 'ko', 'style', 'image', 'status', 'draft', 'addedFrom'];
  const PAGE_SIZE = 60;
  const TOP_COUNT = 30;

  // Sport "folders"
  const SPORTS = [
    { key: 'Boxing', label: 'Boxing', icon: '🥊' },
    { key: 'MMA', label: 'MMA', icon: '🏆' },
    { key: 'Muay Thai', label: 'Muay Thai & Kickboxing', icon: '🦵' },
    { key: 'Grappling', label: 'Grappling: BJJ, Wrestling & Judo', icon: '🤼' },
    { key: 'Martial Arts', label: 'Other Martial Arts', icon: '🥋' }
  ];

  let filteredFighters = [];
  let shown = 0;
  let topFighters = [];

  // Page structure: [home: top 30 + sport folders] or [list: heading + paged grid]
  const homeView = document.createElement('div');
  homeView.id = 'fighters-home';
  const listHead = document.createElement('div');
  listHead.id = 'fighters-list-head';
  listHead.style.cssText = 'display: none; margin-bottom: var(--space-lg);';
  fightersGrid.before(homeView, listHead);

  const showMoreWrap = document.createElement('div');
  showMoreWrap.className = 'text-center';
  showMoreWrap.style.cssText = 'margin-top: var(--space-xl); display: none;';
  showMoreWrap.innerHTML = '<button type="button" class="btn btn-secondary" id="fighters-show-more">Show more fighters</button><p id="fighters-count" style="color: var(--text-muted); font-size: 0.85rem; margin-top: 8px;"></p>';
  fightersGrid.after(showMoreWrap);
  showMoreWrap.querySelector('button').addEventListener('click', () => renderNextPage());

  try {
    const [summaries, rankings] = await Promise.all([
      dataStore.getSummaries('fighters', LIST_FIELDS),
      dataStore.getAll('rankings')
    ]);
    allFighters = summaries.filter(f => !f.draft && f.name);
    // Within a folder: fighters with a photo first, then by number of wins
    allFighters.sort((a, b) => (!!b.image - !!a.image) || ((b.wins || 0) - (a.wins || 0)) || a.name.localeCompare(b.name));
    topFighters = pickTopFighters(rankings);
    populateFilterDropdowns(allFighters);

    // Links like fighters.html?q=Name (from martial arts pages) or ?sport=Boxing
    const params = new URLSearchParams(location.search);
    if (params.get('q')) searchInput.value = params.get('q');
    if (params.get('sport')) styleSelect.value = params.get('sport');
    applyView();
  } catch (err) {
    console.error('Error fetching fighters:', err);
    fightersGrid.innerHTML = `<div class="text-center" style="grid-column:1/-1;"><p class="text-accent">Error loading fighters database.</p></div>`;
  }

  // Top fighters: the editorial all-time rankings first (pound-for-pound, then
  // each sport), topped up with Hall of Famers, then the best-known with photos
  function pickTopFighters(rankings) {
    const byId = new Map(allFighters.map(f => [f.id, f]));
    const ordered = [...rankings].sort((a, b) => (a.sport === 'All' ? -1 : b.sport === 'All' ? 1 : 0));
    const ids = [];
    ordered.forEach(r => (r.rankings || []).forEach(id => { if (byId.has(id) && !ids.includes(id)) ids.push(id); }));
    const top = ids.map(id => byId.get(id));
    const rest = allFighters.filter(f => !ids.includes(f.id) && f.image);
    const hallOfFame = rest.filter(f => /hall of fame/i.test(f.addedFrom || ''));
    const others = rest.filter(f => !/hall of fame/i.test(f.addedFrom || ''));
    return [...top, ...hallOfFame, ...others].slice(0, TOP_COUNT);
  }

  // 2. Populate dropdowns from the data
  function populateFilterDropdowns(fighters) {
    const count = key => fighters.reduce((m, f) => (f[key] ? m.set(f[key], (m.get(f[key]) || 0) + 1) : m), new Map());
    const fill = (select, entries) => entries.forEach(([value, label]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      select.appendChild(opt);
    });
    const sports = count('sport');
    fill(styleSelect, SPORTS.filter(s => sports.has(s.key)).map(s => [s.key, `${s.label} (${sports.get(s.key)})`]));
    // Weight classes are free text in older sources; only list ones used more than once
    fill(weightSelect, [...count('weightClass')].filter(([, n]) => n >= 2).map(([v]) => [v, v]).sort());
    fill(countrySelect, [...count('country')].map(([v]) => [v, v]).sort());
  }

  // 3. Views
  function isFiltering() {
    return searchInput.value.trim() || weightSelect.value || styleSelect.value || countrySelect.value;
  }

  function applyView() {
    if (isFiltering()) {
      renderListView();
    } else {
      renderHomeView();
    }
  }

  function renderHomeView() {
    homeView.style.display = '';
    listHead.style.display = 'none';
    fightersGrid.innerHTML = '';
    showMoreWrap.style.display = 'none';

    const counts = allFighters.reduce((m, f) => m.set(f.sport, (m.get(f.sport) || 0) + 1), new Map());
    homeView.innerHTML = `
      <h2 style="margin-bottom: var(--space-md);">Top <span class="text-accent">${topFighters.length}</span> Fighters</h2>
      <p style="color: var(--text-muted); margin-bottom: var(--space-lg);">The all-time greats from our rankings and the Halls of Fame.</p>
      <div class="grid grid-4" id="top-fighters-grid"></div>

      <h2 style="margin: var(--space-3xl) 0 var(--space-md);">Browse by <span class="text-accent">Sport</span></h2>
      <p style="color: var(--text-muted); margin-bottom: var(--space-lg);">${allFighters.length.toLocaleString()} fighters, from boxing history to today's champions.</p>
      <div class="grid grid-3" id="sport-folders">
        ${SPORTS.filter(s => counts.get(s.key)).map(s => {
          const faces = allFighters.filter(f => f.sport === s.key && fighterPhoto(f)).slice(0, 4);
          return `
          <button type="button" class="card card-glass sport-folder" data-sport="${escapeHtml(s.key)}">
            <div class="sport-folder-icon">${s.icon}</div>
            <div class="sport-folder-text">
              <h3>${escapeHtml(s.label)}</h3>
              <span>${counts.get(s.key).toLocaleString()} fighters →</span>
            </div>
            <div class="sport-folder-faces">${faces.map(f => `<img src="${fighterPhoto(f)}" alt="" loading="lazy">`).join('')}</div>
          </button>`;
        }).join('')}
      </div>`;

    const topGrid = homeView.querySelector('#top-fighters-grid');
    topFighters.forEach(f => topGrid.appendChild(buildCard(f)));
    homeView.querySelectorAll('.sport-folder').forEach(btn => btn.addEventListener('click', () => {
      styleSelect.value = btn.dataset.sport;
      onFiltersChanged();
      window.scrollTo({ top: homeView.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
    }));
    if (window.initScrollAnimations) window.initScrollAnimations();
  }

  function renderListView() {
    homeView.style.display = 'none';
    listHead.style.display = '';

    const query = searchInput.value.toLowerCase().trim();
    const filtered = allFighters.filter(f =>
      (!query || f.name.toLowerCase().includes(query) ||
        (f.nickname && f.nickname.toLowerCase().includes(query)) ||
        (f.style || '').toLowerCase().includes(query) ||
        (f.country || '').toLowerCase().includes(query)) &&
      (!weightSelect.value || f.weightClass === weightSelect.value) &&
      (!styleSelect.value || f.sport === styleSelect.value) &&
      (!countrySelect.value || f.country === countrySelect.value));

    const sport = SPORTS.find(s => s.key === styleSelect.value);
    const title = sport ? `${sport.icon} ${sport.label}` : query ? `Results for “${searchInput.value.trim()}”` : 'Filtered fighters';
    listHead.innerHTML = `
      <button type="button" class="btn btn-secondary btn-sm" id="fighters-back">← All fighters</button>
      <h2 style="margin: var(--space-md) 0 0;">${escapeHtml(title)} <span style="color: var(--text-muted); font-size: 1rem; font-weight: 400;">· ${filtered.length.toLocaleString()} fighters</span></h2>`;
    listHead.querySelector('#fighters-back').addEventListener('click', () => {
      searchInput.value = '';
      weightSelect.value = '';
      styleSelect.value = '';
      countrySelect.value = '';
      onFiltersChanged();
    });

    filteredFighters = filtered;
    shown = 0;
    fightersGrid.innerHTML = '';
    if (!filtered.length) {
      fightersGrid.innerHTML = `<div class="text-center" style="grid-column:1/-1; padding: 40px 0;"><p>No fighters match your search.</p></div>`;
      showMoreWrap.style.display = 'none';
      return;
    }
    renderNextPage();
  }

  function renderNextPage() {
    const page = filteredFighters.slice(shown, shown + PAGE_SIZE);
    shown += page.length;
    page.forEach(f => fightersGrid.appendChild(buildCard(f)));

    showMoreWrap.style.display = filteredFighters.length > shown ? '' : 'none';
    showMoreWrap.querySelector('#fighters-count').textContent = `Showing ${shown} of ${filteredFighters.length.toLocaleString()} fighters`;
    if (window.initScrollAnimations) window.initScrollAnimations();
  }

  function buildCard(f) {
    const isFav = dataStore.isFavorite(f.id);
    const card = document.createElement('div');
    card.className = 'fighter-card animate-on-scroll';
    card.setAttribute('data-id', f.id);
    const hasRecord = f.wins !== null && f.wins !== undefined;

    card.innerHTML = `
      <div class="fighter-card-image" style="display:flex; align-items:center; justify-content:center; font-size:4rem; background: linear-gradient(135deg, #161616 0%, #2a2a2a 100%); overflow:hidden; position:relative;">
        ${photoOrInitials(f, '3.5rem')}
        <span class="fighter-flag">${escapeHtml(f.nationality || '🌍')}</span>
        <button class="favorite-btn ${isFav ? 'active' : ''}" data-id="${escapeHtml(f.id)}" aria-label="Add to favorites" style="position: absolute; top: 15px; left: 15px; font-size: 1.5rem; color: ${isFav ? 'var(--accent)' : 'rgba(255,255,255,0.4)'}; background: rgba(0,0,0,0.4); border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; z-index: 10;">
          ${isFav ? '❤️' : '🤍'}
        </button>
      </div>
      <div class="fighter-card-body">
        <div class="fighter-weight-class">${escapeHtml([f.sport, f.weightClass].filter(Boolean).join(' · '))}</div>
        <h3>${escapeHtml(f.name)}</h3>
        <div class="fighter-nickname">${f.nickname ? `"${escapeHtml(f.nickname)}"` : '&nbsp;'}</div>

        <div class="fighter-record">
          ${hasRecord ? `
          <div class="record-item record-wins">
            <div class="record-number">${escapeHtml(f.wins)}</div>
            <div class="record-label">W</div>
          </div>
          <div class="record-item record-losses">
            <div class="record-number">${escapeHtml(f.losses ?? 0)}</div>
            <div class="record-label">L</div>
          </div>
          <div class="record-item record-draws">
            <div class="record-number">${escapeHtml(f.draws ?? 0)}</div>
            <div class="record-label">D</div>
          </div>` : `<div style="color: var(--text-muted); font-size: 0.85rem;">Record not listed</div>`}
        </div>

        <div style="margin-top: 15px; font-size: 0.8rem; color: var(--text-muted);">
          Style: <span class="text-accent">${escapeHtml(f.style || f.sport)}</span>
        </div>
      </div>
    `;
    card.querySelector('.fighter-card-body').addEventListener('click', () => openFighterModal(f.id));
    card.querySelector('.favorite-btn').addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent opening modal
      const btn = e.currentTarget;
      const isNowFav = dataStore.toggleFavorite(f.id);
      btn.classList.toggle('active', isNowFav);
      btn.innerHTML = isNowFav ? '❤️' : '🤍';
      btn.style.color = isNowFav ? 'var(--accent)' : 'rgba(255,255,255,0.4)';
    });
    return card;
  }

  // 4. Filters: keep the URL in sync so the back button and shared links work
  function onFiltersChanged() {
    const params = new URLSearchParams();
    if (searchInput.value.trim()) params.set('q', searchInput.value.trim());
    if (styleSelect.value) params.set('sport', styleSelect.value);
    history.replaceState(null, '', params.toString() ? `?${params}` : location.pathname);
    applyView();
  }

  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(onFiltersChanged, 200);
  });
  weightSelect.addEventListener('change', onFiltersChanged);
  styleSelect.addEventListener('change', onFiltersChanged);
  countrySelect.addEventListener('change', onFiltersChanged);

  // 5. Fighter Modal Logic
  // Tab switching helper for fighter modal
  window.switchFighterTab = (tabName) => {
    const tabs = document.querySelectorAll('.fighter-tab-content');
    const buttons = document.querySelectorAll('.tab-btn');
    
    tabs.forEach(tab => {
      tab.style.display = tab.id === `tab-${tabName}` ? 'block' : 'none';
    });
    
    buttons.forEach(btn => {
      const isActive = btn.getAttribute('onclick').includes(`'${tabName}'`);
      btn.style.color = isActive ? 'var(--text-primary)' : 'var(--text-muted)';
      btn.style.borderBottomColor = isActive ? 'var(--accent)' : 'transparent';
    });
  };

  // 5. Fighter Modal Logic
  window.openFighterModal = async (id) => {
    // The list only holds summary fields; load the full profile
    const f = await dataStore.getById('fighters', id);
    if (!f) return;

    const isFav = dataStore.isFavorite(f.id);
    document.getElementById('modal-fighter-name').innerText = f.name;

    let championshipsHtml = '';
    if (f.championships && f.championships.length > 0) {
      championshipsHtml = f.championships.map(c => `<span class="badge badge-success" style="margin-right: 5px; margin-bottom: 5px;">🏆 ${escapeHtml(c)}</span>`).join('');
    }

    let highlightsHtml = '';
    if (f.highlights && f.highlights.length > 0) {
      highlightsHtml = f.highlights.map(h => `<li>⚡ ${escapeHtml(h)}</li>`).join('');
    }

    // Build timeline HTML
    let timelineHtml = '<div style="display:flex; flex-direction:column; gap: 15px; padding-top: 10px;">';
    if (f.timeline && f.timeline.length > 0) {
      f.timeline.forEach(t => {
        const resultColor = t.result === 'Win' ? '#2ec4b6' : '#e63946';
        timelineHtml += `
          <div style="display:flex; align-items:flex-start; gap: 15px; border-left: 2px solid ${resultColor}; padding-left: 15px; position:relative;">
            <div style="position:absolute; left:-6px; top:4px; width:10px; height:10px; border-radius:50%; background:${resultColor};"></div>
            <div style="flex-grow:1;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <h5 style="font-family:var(--font-heading); font-size:1.1rem; color:var(--text-primary); margin:0;">${escapeHtml(t.event)}</h5>
                <span class="badge" style="background:${resultColor}1a; color:${resultColor}; border:1px solid ${resultColor}; font-size:0.75rem;">${escapeHtml(t.result)}</span>
              </div>
              <div style="font-size:0.9rem; color:var(--text-secondary); margin-top:3px;">
                vs. <strong>${escapeHtml(t.opponent)}</strong> &bull; ${escapeHtml(t.finishing)}
              </div>
              <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${escapeHtml(t.date)}</div>
            </div>
          </div>
        `;
      });
    } else {
      timelineHtml += `<p style="color:var(--text-muted); font-style:italic;">No fight timeline entries recorded.</p>`;
    }
    timelineHtml += '</div>';

    const modalBody = document.getElementById('modal-fighter-body');
    modalBody.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 2fr; gap: var(--space-xl);">
        <!-- Column 1: Picture, Quick stats, Favorite -->
        <div style="display: flex; flex-direction: column; gap: var(--space-md);">
          <div style="width: 100%; aspect-ratio: 1; background: linear-gradient(135deg, #111 0%, #3a0007 100%); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; font-size: 5rem; position: relative; overflow: hidden;">
            ${photoOrInitials(f, '5rem')}
            <span style="position: absolute; top: 10px; right: 10px; font-size: 2rem; background:rgba(0,0,0,0.6); padding: 2px 6px; border-radius:4px;">${escapeHtml(f.nationality || '🌍')}</span>
          </div>
          ${fighterPhoto(f) && f.imageCredit ? `
          <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: -8px; line-height: 1.4;">
            Photo: ${f.imageSourceUrl ? `<a href="${safeUrl(f.imageSourceUrl, '#')}" target="_blank" rel="noopener">${escapeHtml(f.imageCredit)}</a>` : escapeHtml(f.imageCredit)}
          </div>` : ''}
          
          <button id="modal-fav-btn" class="btn btn-secondary w-full ${isFav ? 'active' : ''}">
            ${isFav ? '❤️ Favorite' : '🤍 Add Favorite'}
          </button>
          
          <!-- Record box -->
          <div class="card card-glass" style="padding: 15px; text-align: center;">
            <div style="font-family: var(--font-heading); font-size: 1.8rem; color: var(--text-primary); margin-bottom: 8px;">
              ${escapeHtml(f.wins ?? '–')} - ${escapeHtml(f.losses ?? '–')} - ${escapeHtml(f.draws ?? '–')}
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">${escapeHtml(f.recordSport ? `${f.recordSport} record (W-L-D)` : 'Wins - Losses - Draws')}</div>

            <div style="margin-top: 15px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; font-size: 0.8rem; border-top: 1px solid var(--border-color); padding-top: 10px;">
              <div>KO: <strong class="text-accent">${escapeHtml(f.ko ?? '–')}</strong></div>
              <div>SUB: <strong class="text-accent">${escapeHtml(f.sub ?? '–')}</strong></div>
              <div>DEC: <strong class="text-accent">${escapeHtml(f.dec ?? '–')}</strong></div>
            </div>
          </div>
        </div>

        <!-- Column 2: Tabbed content -->
        <div style="display: flex; flex-direction: column; gap: var(--space-md);">
          <!-- Tabs Navigation -->
          <div style="display: flex; border-bottom: 1px solid var(--border-color); margin-bottom: 5px;">
            <button class="tab-btn" onclick="switchFighterTab('bio')" style="background:none; border:none; color:var(--text-primary); font-family:var(--font-heading); font-size:1.2rem; padding:10px 15px; border-bottom:3px solid var(--accent); cursor:pointer;">Bio-Data</button>
            <button class="tab-btn" onclick="switchFighterTab('highlights')" style="background:none; border:none; color:var(--text-muted); font-family:var(--font-heading); font-size:1.2rem; padding:10px 15px; border-bottom:3px solid transparent; cursor:pointer;">Highlights</button>
            <button class="tab-btn" onclick="switchFighterTab('timeline')" style="background:none; border:none; color:var(--text-muted); font-family:var(--font-heading); font-size:1.2rem; padding:10px 15px; border-bottom:3px solid transparent; cursor:pointer;">Fight Timeline</button>
          </div>

          <!-- Tab Contents -->
          <!-- Tab 1: Bio-Data -->
          <div id="tab-bio" class="fighter-tab-content" style="display: block;">
            <h4 style="font-size: 1.1rem; color: var(--text-muted); font-style: italic; margin-bottom: 15px;">${f.nickname ? `"${escapeHtml(f.nickname)}"` : ''}</h4>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 15px;">
              ${f.sport ? `<span class="badge badge-accent">${escapeHtml(f.sport)}</span>` : ''}
              <span class="badge badge-accent">${escapeHtml(f.weightClass)}</span>
              <span class="badge badge-info">${escapeHtml(f.style)}</span>
              <span class="badge badge-secondary">Status: ${escapeHtml(f.status)}</span>
            </div>

            <div style="margin-bottom: 15px;">
              <p style="font-size: 0.95rem; line-height: 1.6; color: var(--text-secondary); margin: 0;">${escapeHtml(f.bio || 'Biography not available.')}</p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border-color); font-size: 0.9rem; color: var(--text-secondary);">
              <div>Team: <strong>${escapeHtml(f.team || 'N/A')}</strong></div>
              <div>Country: <strong>${escapeHtml(f.country || 'N/A')}</strong></div>
              ${f.sourceUrl ? `<div style="grid-column: 1 / -1; font-size: 0.8rem;">Source: <a href="${safeUrl(f.sourceUrl, '#')}" target="_blank" rel="noopener">Wikipedia ↗</a></div>` : ''}
            </div>
          </div>

          <!-- Tab 2: Highlights -->
          <div id="tab-highlights" class="fighter-tab-content" style="display: none;">
            ${championshipsHtml ? `
              <div style="margin-bottom: 15px;">
                <h4 style="color: var(--accent); margin-bottom: 8px; font-size: 1.1rem;">Championships</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 5px;">${championshipsHtml}</div>
              </div>
            ` : ''}

            ${highlightsHtml ? `
              <div>
                <h4 style="color: var(--accent); margin-bottom: 8px; font-size: 1.1rem;">Highlights & Career Accomplishments</h4>
                <ul style="padding-left: 0; list-style: none; font-size: 0.95rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 8px;">
                  ${highlightsHtml}
                </ul>
              </div>
            ` : '<p style="color:var(--text-muted); font-style:italic;">No career highlights recorded.</p>'}
          </div>

          <!-- Tab 3: Timeline -->
          <div id="tab-timeline" class="fighter-tab-content" style="display: none; max-height: 300px; overflow-y: auto; padding-right: 5px;">
            ${timelineHtml}
          </div>
        </div>
      </div>
    `;

    // Modal Favorite click handler
    const modalFavBtn = document.getElementById('modal-fav-btn');
    modalFavBtn.addEventListener('click', () => {
      const isNowFav = dataStore.toggleFavorite(f.id);
      
      // Update modal button state
      modalFavBtn.classList.toggle('active', isNowFav);
      modalFavBtn.innerHTML = isNowFav ? '❤️ Favorite' : '🤍 Add Favorite';
      
      // Sync card favorite button state
      const cardBtn = document.querySelector(`.favorite-btn[data-id="${CSS.escape(f.id)}"]`);
      if (cardBtn) {
        cardBtn.classList.toggle('active', isNowFav);
        cardBtn.innerHTML = isNowFav ? '❤️' : '🤍';
        cardBtn.style.color = isNowFav ? 'var(--accent)' : 'rgba(255,255,255,0.4)';
      }
      
    });

    // Show modal
    modal.classList.add('active');
    modalBackdrop.classList.add('active');
  };

  const closeModal = () => {
    modal.classList.remove('active');
    modalBackdrop.classList.remove('active');
  };

  modalClose.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', closeModal);
});
