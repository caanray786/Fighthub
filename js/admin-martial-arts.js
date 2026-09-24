/* ============================================
   FightHub — Admin Martial Arts Script
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await dataStore.ready;

  let allMA = [];
  let filteredMA = [];
  let currentPage = 1;
  const itemsPerPage = 8;

  // DOM elements
  const listSection = document.getElementById('list-section');
  const formSection = document.getElementById('form-section');
  const tableBody = document.getElementById('ma-table-body');
  const searchInput = document.getElementById('search-input');
  const pagInfo = document.getElementById('pagination-info');
  const pagButtons = document.getElementById('pagination-buttons');
  
  // Form elements
  const maForm = document.getElementById('ma-form');
  const formTitle = document.getElementById('form-title');
  const maIdInput = document.getElementById('ma-id');
  const iconInput = document.getElementById('ma-icon');
  const nameInput = document.getElementById('ma-name');
  const originInput = document.getElementById('ma-origin');
  const fullNameInput = document.getElementById('ma-fullname');
  const foundedInput = document.getElementById('ma-founded');
  const descriptionInput = document.getElementById('ma-description');
  const historyInput = document.getElementById('ma-history');
  const rulesInput = document.getElementById('ma-rules');
  const guideInput = document.getElementById('ma-guide');
  const imageInput = document.getElementById('ma-image');
  
  const techList = document.getElementById('techniques-list');
  const equipList = document.getElementById('equipment-list');
  const fightersList = document.getElementById('fighters-list');
  const tipsList = document.getElementById('tips-list');

  // Load martial arts
  async function fetchAndRender() {
    allMA = await dataStore.getAll('martialArts');
    applyFilters();
  }

  function applyFilters() {
    const q = searchInput.value.toLowerCase().trim();

    filteredMA = allMA.filter(ma => {
      // Search matches short name, full name, origin, or founded period
      return !q || 
        ma.name.toLowerCase().includes(q) || 
        ma.fullName.toLowerCase().includes(q) ||
        ma.origin.toLowerCase().includes(q) ||
        ma.founded.toLowerCase().includes(q);
    });

    currentPage = 1;
    renderTable();
  }

  function renderTable() {
    tableBody.innerHTML = '';

    if (filteredMA.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--admin-text-muted); padding: 30px;">
            No martial arts profiles found.
          </td>
        </tr>
      `;
      pagInfo.textContent = 'Showing 0 of 0 entries';
      pagButtons.innerHTML = '';
      return;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, filteredMA.length);
    const paginatedItems = filteredMA.slice(start, end);

    pagInfo.textContent = `Showing ${start + 1}-${end} of ${filteredMA.length} entries`;

    paginatedItems.forEach(ma => {
      const tr = document.createElement('tr');
      const techCount = ma.techniques ? ma.techniques.length : 0;

      tr.innerHTML = `
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.5rem;">${escapeHtml(ma.icon || '🥋')}</span>
            <strong>${escapeHtml(ma.name)}</strong>
          </div>
        </td>
        <td>${escapeHtml(ma.fullName)}</td>
        <td>${escapeHtml(ma.origin)}</td>
        <td>${escapeHtml(ma.founded)}</td>
        <td><strong>${techCount}</strong> techniques</td>
        <td>
          <div class="table-actions">
            <button class="table-action btn-edit" data-id="${escapeHtml(ma.id)}" title="Edit Profile">✏️ Edit</button>
            <button class="table-action delete btn-delete" data-id="${escapeHtml(ma.id)}" title="Delete Profile">🗑️</button>
          </div>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    renderPaginationButtons();
  }

  function renderPaginationButtons() {
    pagButtons.innerHTML = '';
    const totalPages = Math.ceil(filteredMA.length / itemsPerPage);
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

  // ---- Dynamic Input Item Rows ---- //
  function addRow(container, value = '') {
    const div = document.createElement('div');
    div.className = 'dynamic-list-item';
    div.innerHTML = `
      <input type="text" value="${value.replace(/"/g, '&quot;')}" placeholder="Enter entry..." required>
      <button type="button" class="remove-item">✖</button>
    `;
    div.querySelector('.remove-item').addEventListener('click', () => div.remove());
    container.appendChild(div);
  }

  function getList(container) {
    const inputs = container.querySelectorAll('input');
    const values = [];
    inputs.forEach(input => {
      const val = input.value.trim();
      if (val) values.push(val);
    });
    return values;
  }

  // ---- Form Toggle ---- //
  function showForm(ma = null) {
    maForm.reset();
    techList.innerHTML = '';
    equipList.innerHTML = '';
    fightersList.innerHTML = '';
    tipsList.innerHTML = '';

    if (ma) {
      formTitle.textContent = `Edit Martial Art: ${ma.name}`;
      maIdInput.value = ma.id;
      iconInput.value = ma.icon || '🥋';
      nameInput.value = ma.name;
      originInput.value = ma.origin;
      fullNameInput.value = ma.fullName;
      foundedInput.value = ma.founded;
      descriptionInput.value = ma.description;
      historyInput.value = ma.history;
      rulesInput.value = ma.rules;
      guideInput.value = ma.beginnerGuide || '';
      imageInput.value = ma.image || '';
      
      if (ma.techniques && Array.isArray(ma.techniques)) ma.techniques.forEach(t => addRow(techList, t));
      if (ma.equipment && Array.isArray(ma.equipment)) ma.equipment.forEach(e => addRow(equipList, e));
      if (ma.famousFighters && Array.isArray(ma.famousFighters)) ma.famousFighters.forEach(f => addRow(fightersList, f));
      if (ma.tips && Array.isArray(ma.tips)) ma.tips.forEach(t => addRow(tipsList, t));
    } else {
      formTitle.textContent = 'Add Martial Art';
      maIdInput.value = '';
      iconInput.value = '🥋';
      imageInput.value = '';
      // Default to 1 empty row each
      addRow(techList);
      addRow(equipList);
      addRow(fightersList);
      addRow(tipsList);
    }

    listSection.style.display = 'none';
    formSection.style.display = 'block';
  }

  function hideForm() {
    formSection.style.display = 'none';
    listSection.style.display = 'block';
  }

  // Event Handlers
  document.getElementById('btn-add-ma').addEventListener('click', () => showForm(null));
  document.getElementById('btn-back').addEventListener('click', hideForm);
  document.getElementById('btn-cancel').addEventListener('click', hideForm);
  
  document.getElementById('btn-add-tech').addEventListener('click', () => addRow(techList));
  document.getElementById('btn-add-equip').addEventListener('click', () => addRow(equipList));
  document.getElementById('btn-add-fighter').addEventListener('click', () => addRow(fightersList));
  document.getElementById('btn-add-tip').addEventListener('click', () => addRow(tipsList));

  // Table buttons delegation
  tableBody.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.btn-edit');
    const deleteBtn = e.target.closest('.btn-delete');

    if (editBtn) {
      const id = editBtn.getAttribute('data-id');
      const ma = await dataStore.getById('martialArts', id);
      if (ma) showForm(ma);
    }

    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id');
      const ma = await dataStore.getById('martialArts', id);
      if (ma && confirm(`Are you sure you want to delete the martial art profile for "${ma.name}"?`)) {
        await dataStore.delete('martialArts', id);
        showToast('Martial art profile deleted successfully', 'success');
        fetchAndRender();
      }
    }
  });

  // Search input change
  searchInput.addEventListener('input', applyFilters);

  // Form Submit
  maForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = maIdInput.value;
    
    const data = {
      icon: iconInput.value.trim() || '🥋',
      name: nameInput.value.trim(),
      fullName: fullNameInput.value.trim(),
      origin: originInput.value.trim(),
      founded: foundedInput.value.trim(),
      description: descriptionInput.value.trim(),
      history: historyInput.value.trim(),
      rules: rulesInput.value.trim(),
      beginnerGuide: guideInput.value.trim(),
      image: imageInput.value.trim(),
      techniques: getList(techList),
      equipment: getList(equipList),
      famousFighters: getList(fightersList),
      tips: getList(tipsList)
    };

    if (id) {
      data.id = id;
      await dataStore.update('martialArts', data);
      showToast('Martial art updated successfully', 'success');
    } else {
      await dataStore.add('martialArts', data);
      showToast('New martial art profile added successfully', 'success');
    }

    hideForm();
    fetchAndRender();
  });

  fetchAndRender();
});
