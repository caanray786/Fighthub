/* ============================================
   FightHub — Admin Rankings Script
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await dataStore.ready;

  const selectWeightClass = document.getElementById('select-weight-class');
  const dragContainer = document.getElementById('rankings-drag-container');
  const selectUnranked = document.getElementById('select-unranked-fighter');
  const btnAdd = document.getElementById('btn-add-to-rankings');
  const btnSave = document.getElementById('btn-save-rankings');

  // Map ranking ID to weight class name
  const rankingsMap = {
    'r-pfp': 'Pound-for-Pound',
    'r-hw': 'Heavyweight',
    'r-lhw': 'Light Heavyweight',
    'r-mw': 'Middleweight',
    'r-ww': 'Welterweight',
    'r-lw': 'Lightweight',
    'r-fw': 'Featherweight',
    'r-bw': 'Bantamweight',
    'r-flw': 'Flyweight',
    'r-sw': 'Strawweight'
  };

  let allFighters = [];
  let currentRanking = null;

  async function init() {
    allFighters = await dataStore.getAll('fighters');
    
    // Load division
    await loadDivision(selectWeightClass.value);

    // Event listeners
    selectWeightClass.addEventListener('change', async (e) => {
      await loadDivision(e.target.value);
    });

    btnAdd.addEventListener('click', addSelectedFighter);
    btnSave.addEventListener('click', saveRankings);
    
    // Setup drag over container
    setupDragOver();
  }

  // ---- Load Division ---- //
  async function loadDivision(rankingId) {
    dragContainer.innerHTML = '';
    
    // Fetch rankings list for this id
    const rankings = await dataStore.getAll('rankings');
    currentRanking = rankings.find(r => r.id === rankingId);

    // If it doesn't exist, create an empty one
    if (!currentRanking) {
      currentRanking = {
        id: rankingId,
        weightClass: rankingsMap[rankingId],
        rankings: [],
        champion: null,
        lastUpdated: new Date().toISOString().substring(0, 10)
      };
    }

    // Render ranked fighters
    if (currentRanking.rankings && currentRanking.rankings.length > 0) {
      currentRanking.rankings.forEach((fighterId, index) => {
        const fighter = allFighters.find(f => f.id === fighterId);
        if (fighter) {
          const isChamp = currentRanking.champion === fighterId;
          renderFighterCard(fighter, index + 1, isChamp);
        }
      });
    } else {
      dragContainer.innerHTML = `
        <div id="empty-state" style="text-align: center; color: var(--admin-text-muted); padding: 30px; border: 1px dashed var(--admin-border); border-radius: var(--radius-sm);">
          No fighters currently ranked in this division.
        </div>
      `;
    }

    updateUnrankedDropdown();
  }

  // ---- Render Draggable Fighter Card ---- //
  function renderFighterCard(fighter, rank, isChamp) {
    // Remove empty state if present
    const emptyState = document.getElementById('empty-state');
    if (emptyState) emptyState.remove();

    const card = document.createElement('div');
    card.className = 'ranking-drag-item';
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-fighter-id', fighter.id);

    const flag = fighter.nationality || '🏳️';
    const isPfp = selectWeightClass.value === 'r-pfp';

    card.innerHTML = `
      <span class="drag-handle" style="font-size: 1.2rem; user-select: none;">☰</span>
      <span class="rank-num" style="font-weight: 800; font-family: monospace;">#${rank}</span>
      <div class="fighter-info">
        <span style="font-size: 1.4rem;">${flag}</span>
        <div>
          <strong>${fighter.name}</strong>
          ${fighter.nickname ? `<span style="font-size: 0.75rem; color: var(--admin-text-muted); margin-left: 5px;">"${fighter.nickname}"</span>` : ''}
          <div style="font-size: 0.75rem; color: var(--admin-text-muted); margin-top: 2px;">
            ${fighter.weightClass} &bull; ${fighter.wins}-${fighter.losses}-${fighter.draws}
          </div>
        </div>
      </div>
      
      <!-- Disable champion badge for PFP -->
      ${isPfp ? '' : `<button type="button" class="champion-toggle ${isChamp ? 'active' : ''}">👑 Champion</button>`}
      
      <button type="button" class="remove-ranking-btn" style="background: transparent; border: none; color: var(--admin-error); cursor: pointer; font-size: 1.1rem; margin-left: 10px;" title="Remove from Rankings">✖</button>
    `;

    // Bind card drag events
    setupDragEvents(card);

    // Bind Champion toggle click
    const toggleBtn = card.querySelector('.champion-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasActive = toggleBtn.classList.contains('active');
        // Clear all others
        dragContainer.querySelectorAll('.champion-toggle').forEach(btn => btn.classList.remove('active'));
        
        if (!wasActive) {
          toggleBtn.classList.add('active');
        }
      });
    }

    // Bind Remove click
    card.querySelector('.remove-ranking-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      card.remove();
      updateRankNumbers();
      updateUnrankedDropdown();
      
      // If list is empty, show empty state
      if (dragContainer.children.length === 0) {
        dragContainer.innerHTML = `
          <div id="empty-state" style="text-align: center; color: var(--admin-text-muted); padding: 30px; border: 1px dashed var(--admin-border); border-radius: var(--radius-sm);">
            No fighters currently ranked in this division.
          </div>
        `;
      }
    });

    dragContainer.appendChild(card);
  }

  // ---- Drag & Drop Event Listeners ---- //
  function setupDragEvents(element) {
    element.addEventListener('dragstart', (e) => {
      element.classList.add('dragging');
    });

    element.addEventListener('dragend', () => {
      element.classList.remove('dragging');
      updateRankNumbers();
    });
  }

  function setupDragOver() {
    dragContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      const afterElement = getDragAfterElement(dragContainer, e.clientY);
      const dragging = document.querySelector('.dragging');
      if (!dragging) return;

      if (afterElement == null) {
        dragContainer.appendChild(dragging);
      } else {
        dragContainer.insertBefore(dragging, afterElement);
      }
    });
  }

  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.ranking-drag-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  // Update numbers after sorting
  function updateRankNumbers() {
    const cards = dragContainer.querySelectorAll('.ranking-drag-item');
    cards.forEach((card, index) => {
      const rankNumSpan = card.querySelector('.rank-num');
      if (rankNumSpan) {
        rankNumSpan.textContent = `#${index + 1}`;
      }
    });
  }

  // ---- Manage Unranked Fighters Dropdown ---- //
  function updateUnrankedDropdown() {
    selectUnranked.innerHTML = '';
    
    // Find all currently ranked IDs
    const cards = dragContainer.querySelectorAll('.ranking-drag-item');
    const rankedIds = Array.from(cards).map(c => c.getAttribute('data-fighter-id'));

    const activeRankingId = selectWeightClass.value;
    const divisionName = rankingsMap[activeRankingId];

    let available = [];
    if (activeRankingId === 'r-pfp') {
      // PFP can contain any fighter
      available = allFighters.filter(f => !rankedIds.includes(f.id));
    } else {
      // Must match weight class
      available = allFighters.filter(f => f.weightClass === divisionName && !rankedIds.includes(f.id));
    }

    if (available.length === 0) {
      selectUnranked.innerHTML = `<option value="">No other unranked fighters</option>`;
      btnAdd.disabled = true;
    } else {
      btnAdd.disabled = false;
      // Sort alphabetically by name
      available.sort((a, b) => a.name.localeCompare(b.name));
      available.forEach(f => {
        selectUnranked.innerHTML += `<option value="${f.id}">${f.name} (${f.weightClass})</option>`;
      });
    }
  }

  function addSelectedFighter() {
    const id = selectUnranked.value;
    if (!id) return;

    const fighter = allFighters.find(f => f.id === id);
    if (!fighter) return;

    const currentRankCount = dragContainer.querySelectorAll('.ranking-drag-item').length;
    renderFighterCard(fighter, currentRankCount + 1, false);
    
    updateRankNumbers();
    updateUnrankedDropdown();
  }

  // ---- Save Rankings ---- //
  async function saveRankings() {
    const rankingId = selectWeightClass.value;
    const cards = dragContainer.querySelectorAll('.ranking-drag-item');
    
    const rankingsArray = Array.from(cards).map(c => c.getAttribute('data-fighter-id'));
    
    let championId = null;
    const activeChampCard = dragContainer.querySelector('.champion-toggle.active');
    if (activeChampCard) {
      championId = activeChampCard.closest('.ranking-drag-item').getAttribute('data-fighter-id');
    }

    const rankingData = {
      id: rankingId,
      weightClass: rankingsMap[rankingId],
      rankings: rankingsArray,
      champion: championId,
      lastUpdated: new Date().toISOString().substring(0, 10)
    };

    try {
      await dataStore.update('rankings', rankingData);
      showToast(`${rankingsMap[rankingId]} rankings saved successfully!`, 'success');
      loadDivision(rankingId);
    } catch (e) {
      console.error(e);
      showToast('Failed to save rankings', 'error');
    }
  }

  // Load database and start
  init();
});
