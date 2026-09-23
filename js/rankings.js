/* ============================================
   FightHub — Rankings JS
   Handles division queries, Champion spotlight,
   and dynamic rankings table switcher.
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await dataStore.ready;

  const select = document.getElementById('rankings-select');
  const dateDisplay = document.getElementById('rankings-date');
  const tableBody = document.getElementById('rankings-table-body');
  const championContainer = document.getElementById('champion-spotlight-container');

  let allRankings = [];
  let allFighters = [];

  // 1. Fetch data
  try {
    allRankings = await dataStore.getAll('rankings');
    allFighters = await dataStore.getAll('fighters');
    
    // Initial render
    switchDivision(select.value);
  } catch (err) {
    console.error('Error fetching rankings data:', err);
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-accent">Error loading rankings.</td></tr>`;
  }

  // 2. Dropdown Change Handler
  select.addEventListener('change', (e) => {
    switchDivision(e.target.value);
    showToast(`Switched to ${e.target.value} rankings`, 'info');
  });

  // 3. Switch Division Rendering
  async function switchDivision(weightClass) {
    // Find division record
    const division = allRankings.find(r => r.weightClass === weightClass);
    
    if (!division) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center">No rankings found for this division.</td></tr>`;
      championContainer.innerHTML = '';
      return;
    }

    // Set date
    dateDisplay.innerText = formatDate(division.lastUpdated);

    // Setup Champion Spotlight
    renderChampionSpotlight(division.champion);

    // Setup Table rankings
    renderRankingsTable(division.rankings, division.champion);
  }

  // 4. Render Champion Spotlight Box
  function renderChampionSpotlight(championId) {
    championContainer.innerHTML = '';
    
    if (!championId) {
      return; // No champion in P4P or vacated divisions
    }

    const champ = allFighters.find(f => f.id === championId);
    if (!champ) return;

    championContainer.innerHTML = `
      <div style="background: linear-gradient(135deg, rgba(255, 215, 0, 0.05) 0%, rgba(230, 57, 70, 0.05) 100%); border: 1px solid rgba(255, 215, 0, 0.3); border-radius: var(--radius-lg); padding: var(--space-xl); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px;">
        <div style="display: flex; align-items: center; gap: var(--space-xl); flex-wrap: wrap;">
          <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%); border-radius: var(--radius-full); display: flex; align-items: center; justify-content: center; font-size: 2.5rem; color: #000; box-shadow: 0 0 20px rgba(255,215,0,0.2);">
            👑
          </div>
          <div>
            <div class="champion-badge" style="margin-bottom: 6px;">Divisional Champion</div>
            <h2 style="font-family: var(--font-body); font-weight: 800; font-size: 2rem; margin-bottom: 2px;">
              ${champ.name} <span style="font-size: 1.5rem;">${champ.nationality || ''}</span>
            </h2>
            <div style="font-size: 0.9rem; color: var(--text-muted); font-style: italic;">
              ${champ.nickname ? `"${champ.nickname}"` : ''} &nbsp;|&nbsp; Style: <span class="text-accent">${champ.style}</span>
            </div>
          </div>
        </div>
        
        <div style="text-align: right; min-width: 150px;">
          <div style="font-family: var(--font-heading); font-size: 2.2rem; color: var(--success); line-height: 1;">
            ${champ.wins} - ${champ.losses} - ${champ.draws}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 5px;">Championship Record</div>
        </div>
      </div>
    `;
  }

  // 5. Render Rankings Table body
  function renderRankingsTable(rankedIds, championId) {
    tableBody.innerHTML = '';

    if (!rankedIds || rankedIds.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center">No ranked fighters in this division.</td></tr>`;
      return;
    }

    let rankIndex = 1;

    // If division has champion, and they are listed in rankings list, we can handle it or list them separately.
    // Usually champions are at rank 0 ("C"). Let's check if the champion is included in the rankings list.
    // If champion is in the ranked list, we show them as "C". Otherwise, we start from "1".
    rankedIds.forEach(id => {
      const f = allFighters.find(fighter => fighter.id === id);
      if (!f) return;

      const isChamp = f.id === championId;
      const rankStr = isChamp ? 'C' : rankIndex++;
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>
          <span class="rank-number ${isChamp ? 'champion' : ''}">${rankStr}</span>
        </td>
        <td>
          <div class="rank-fighter">
            <div style="font-size: 1.5rem; background: var(--bg-tertiary); border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
              🥋
            </div>
            <div>
              <div style="font-weight: 700; color: var(--text-primary);">${f.name}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">${f.nickname ? `"${f.nickname}"` : ''}</div>
            </div>
          </div>
        </td>
        <td>
          <strong style="color: var(--text-secondary);">${f.wins} - ${f.losses} - ${f.draws}</strong>
          <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 5px;">(${f.ko} KO, ${f.sub} SUB)</span>
        </td>
        <td>
          <span class="badge badge-accent" style="font-size:0.7rem; font-weight:500; text-transform:none;">${f.style}</span>
        </td>
        <td>
          <span style="font-size:1.1rem; margin-right:5px;">${f.nationality || ''}</span> <span style="font-size: 0.85rem; color: var(--text-secondary);">${f.country || ''}</span>
        </td>
        <td>
          <span class="badge ${f.status === 'Active' ? 'badge-success' : 'badge-error'}">${f.status}</span>
        </td>
      `;
      
      tableBody.appendChild(row);
    });

    if (window.initScrollAnimations) {
      window.initScrollAnimations();
    }
  }

  // Date Formatter Helper
  function formatDate(dateStr) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString(undefined, options);
  }
});
