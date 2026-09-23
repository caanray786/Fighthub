/* ============================================
   FightHub — Admin Fighters Script
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await dataStore.ready;

  // Variables for list, filter & pagination state
  let allFighters = [];
  let filteredFighters = [];
  let currentPage = 1;
  const itemsPerPage = 8;

  // DOM elements
  const listSection = document.getElementById('list-section');
  const formSection = document.getElementById('form-section');
  const tableBody = document.getElementById('fighters-table-body');
  const searchInput = document.getElementById('search-input');
  const filterWeight = document.getElementById('filter-weight');
  const filterStatus = document.getElementById('filter-status');
  const pagInfo = document.getElementById('pagination-info');
  const pagButtons = document.getElementById('pagination-buttons');
  
  // Form elements
  const fighterForm = document.getElementById('fighter-form');
  const formTitle = document.getElementById('form-title');
  const fighterIdInput = document.getElementById('fighter-id');
  const nameInput = document.getElementById('fighter-name');
  const nicknameInput = document.getElementById('fighter-nickname');
  const nationalityInput = document.getElementById('fighter-nationality');
  const countryInput = document.getElementById('fighter-country');
  const weightClassInput = document.getElementById('fighter-weight-class');
  const statusInput = document.getElementById('fighter-status-select');
  const winsInput = document.getElementById('fighter-wins');
  const lossesInput = document.getElementById('fighter-losses');
  const drawsInput = document.getElementById('fighter-draws');
  const koInput = document.getElementById('fighter-ko');
  const subInput = document.getElementById('fighter-sub');
  const decInput = document.getElementById('fighter-dec');
  const styleInput = document.getElementById('fighter-style');
  const teamInput = document.getElementById('fighter-team');
  const photoInput = document.getElementById('fighter-photo');
  const bioInput = document.getElementById('fighter-bio');
  const highlightsList = document.getElementById('highlights-list');
  const championshipsList = document.getElementById('championships-list');

  // Load fighters and render
  async function fetchAndRender() {
    allFighters = await dataStore.getAll('fighters');
    applyFilters();
  }

  function applyFilters() {
    const q = searchInput.value.toLowerCase().trim();
    const wt = filterWeight.value;
    const st = filterStatus.value;

    filteredFighters = allFighters.filter(f => {
      // Search term
      const matchesSearch = !q || 
        f.name.toLowerCase().includes(q) || 
        (f.nickname && f.nickname.toLowerCase().includes(q)) ||
        (f.style && f.style.toLowerCase().includes(q)) ||
        (f.team && f.team.toLowerCase().includes(q));

      // Weight Class
      const matchesWeight = !wt || f.weightClass === wt;

      // Status
      const matchesStatus = !st || f.status === st;

      return matchesSearch && matchesWeight && matchesStatus;
    });

    // Reset pagination to page 1 on filter
    currentPage = 1;
    renderTable();
  }

  function renderTable() {
    tableBody.innerHTML = '';
    
    if (filteredFighters.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--admin-text-muted); padding: 30px;">
            No fighters found matching the criteria.
          </td>
        </tr>
      `;
      pagInfo.textContent = 'Showing 0 of 0 entries';
      pagButtons.innerHTML = '';
      return;
    }

    // Pagination bounds
    const start = (currentPage - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, filteredFighters.length);
    const paginatedItems = filteredFighters.slice(start, end);

    pagInfo.textContent = `Showing ${start + 1}-${end} of ${filteredFighters.length} entries`;

    paginatedItems.forEach(f => {
      const tr = document.createElement('tr');
      
      const badgeClass = f.status === 'Active' ? 'status-active' : 'status-retired';
      const flag = f.nationality || '🏳️';
      
      tr.innerHTML = `
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="font-size: 1.5rem;">${flag}</div>
            <div>
              <strong>${f.name}</strong>
              ${f.nickname ? `<div style="font-size: 0.75rem; color: var(--admin-text-muted);">${f.nickname}</div>` : ''}
            </div>
          </div>
        </td>
        <td>${f.weightClass}</td>
        <td><strong>${f.wins}-${f.losses}-${f.draws}</strong></td>
        <td style="font-size: 0.8rem; color: var(--admin-text-muted);">
          KO: ${f.ko || 0} | SUB: ${f.sub || 0} | DEC: ${f.dec || 0}
        </td>
        <td>${f.style || 'N/A'}</td>
        <td><span class="status-badge ${badgeClass}">${f.status}</span></td>
        <td>
          <div class="table-actions">
            <button class="table-action btn-edit" data-id="${f.id}" title="Edit Fighter">✏️</button>
            <button class="table-action delete btn-delete" data-id="${f.id}" title="Delete Fighter">🗑️</button>
          </div>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    renderPaginationButtons();
  }

  function renderPaginationButtons() {
    pagButtons.innerHTML = '';
    const totalPages = Math.ceil(filteredFighters.length / itemsPerPage);
    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
      btn.textContent = i;
      btn.addEventListener('click', () => {
        currentPage = i;
        renderTable();
      });
      pagButtons.appendChild(btn);
    }
  }

  // ---- Dynamic Inputs Helpers ---- //
  function addDynamicInputRow(container, value = '') {
    const div = document.createElement('div');
    div.className = 'dynamic-list-item';
    div.innerHTML = `
      <input type="text" value="${value.replace(/"/g, '&quot;')}" placeholder="Type details here..." required>
      <button type="button" class="remove-item" title="Remove row">✖</button>
    `;
    div.querySelector('.remove-item').addEventListener('click', () => div.remove());
    container.appendChild(div);
  }

  function getDynamicValues(container) {
    const inputs = container.querySelectorAll('input');
    const values = [];
    inputs.forEach(input => {
      const val = input.value.trim();
      if (val) values.push(val);
    });
    return values;
  }

  // ---- Form Management ---- //
  function showForm(fighter = null) {
    // Reset Form
    fighterForm.reset();
    highlightsList.innerHTML = '';
    championshipsList.innerHTML = '';

    if (fighter) {
      // Edit Mode
      formTitle.textContent = `Edit Fighter: ${fighter.name}`;
      fighterIdInput.value = fighter.id;
      nameInput.value = fighter.name;
      nicknameInput.value = fighter.nickname || '';
      nationalityInput.value = fighter.nationality || '';
      countryInput.value = fighter.country || '';
      weightClassInput.value = fighter.weightClass;
      statusInput.value = fighter.status;
      winsInput.value = fighter.wins;
      lossesInput.value = fighter.losses;
      drawsInput.value = fighter.draws;
      koInput.value = fighter.ko || 0;
      subInput.value = fighter.sub || 0;
      decInput.value = fighter.dec || 0;
      styleInput.value = fighter.style || '';
      teamInput.value = fighter.team || '';
      photoInput.value = fighter.image || '';
      bioInput.value = fighter.bio || '';
      
      // Populate lists
      if (fighter.highlights && Array.isArray(fighter.highlights)) {
        fighter.highlights.forEach(h => addDynamicInputRow(highlightsList, h));
      }
      if (fighter.championships && Array.isArray(fighter.championships)) {
        fighter.championships.forEach(c => addDynamicInputRow(championshipsList, c));
      }
    } else {
      // Add Mode
      formTitle.textContent = 'Add New Fighter';
      fighterIdInput.value = '';
      // default 1 empty input row for lists
      addDynamicInputRow(highlightsList);
      addDynamicInputRow(championshipsList);
    }

    listSection.style.display = 'none';
    formSection.style.display = 'block';
  }

  function hideForm() {
    formSection.style.display = 'none';
    listSection.style.display = 'block';
  }

  // ---- Event Handlers ---- //
  document.getElementById('btn-add-fighter').addEventListener('click', () => showForm(null));
  document.getElementById('btn-back').addEventListener('click', hideForm);
  document.getElementById('btn-cancel').addEventListener('click', hideForm);

  document.getElementById('btn-add-highlight').addEventListener('click', () => {
    addDynamicInputRow(highlightsList);
  });

  document.getElementById('btn-add-championship').addEventListener('click', () => {
    addDynamicInputRow(championshipsList);
  });

  // Table buttons delegation
  tableBody.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.btn-edit');
    const deleteBtn = e.target.closest('.btn-delete');

    if (editBtn) {
      const id = editBtn.getAttribute('data-id');
      const fighter = await dataStore.getById('fighters', id);
      if (fighter) showForm(fighter);
    }

    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id');
      const fighter = await dataStore.getById('fighters', id);
      if (fighter && confirm(`Are you sure you want to delete ${fighter.name}?`)) {
        await dataStore.delete('fighters', id);
        showToast('Fighter profile deleted successfully', 'success');
        fetchAndRender();
      }
    }
  });

  // Filters trigger search
  searchInput.addEventListener('input', applyFilters);
  filterWeight.addEventListener('change', applyFilters);
  filterStatus.addEventListener('change', applyFilters);

  // Form Submit
  fighterForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = fighterIdInput.value;
    const wins = parseInt(winsInput.value) || 0;
    const losses = parseInt(lossesInput.value) || 0;
    const draws = parseInt(drawsInput.value) || 0;
    const ko = parseInt(koInput.value) || 0;
    const sub = parseInt(subInput.value) || 0;
    const dec = parseInt(decInput.value) || 0;

    // Validate methods match record (optional, but good practice)
    const sumMethods = ko + sub + dec;
    const sumRecord = wins; // KO + Sub + Dec = Wins usually
    
    const data = {
      name: nameInput.value.trim(),
      nickname: nicknameInput.value.trim(),
      nationality: nationalityInput.value.trim(),
      country: countryInput.value.trim(),
      weightClass: weightClassInput.value,
      status: statusInput.value,
      wins: wins,
      losses: losses,
      draws: draws,
      ko: ko,
      sub: sub,
      dec: dec,
      style: styleInput.value.trim(),
      team: teamInput.value.trim(),
      image: photoInput.value.trim(),
      bio: bioInput.value.trim(),
      highlights: getDynamicValues(highlightsList),
      championships: getDynamicValues(championshipsList)
    };

    if (id) {
      data.id = id;
      await dataStore.update('fighters', data);
      showToast('Fighter profile updated successfully', 'success');
    } else {
      await dataStore.add('fighters', data);
      showToast('New fighter profile added successfully', 'success');
    }

    hideForm();
    fetchAndRender();
  });

  // Check URL parameters for direct Add redirect from dashboard
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('new') === 'true') {
    showForm(null);
  }

  // Initial load
  fetchAndRender();
});
