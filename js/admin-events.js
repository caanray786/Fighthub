/* ============================================
   FightHub — Admin Events Script
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await dataStore.ready;

  let allEvents = [];
  let filteredEvents = [];
  let currentPage = 1;
  const itemsPerPage = 8;

  // DOM elements
  const listSection = document.getElementById('list-section');
  const formSection = document.getElementById('form-section');
  const tableBody = document.getElementById('events-table-body');
  const searchInput = document.getElementById('search-input');
  const filterPromotion = document.getElementById('filter-promotion');
  const filterStatus = document.getElementById('filter-status');
  const pagInfo = document.getElementById('pagination-info');
  const pagButtons = document.getElementById('pagination-buttons');
  
  // Form elements
  const eventForm = document.getElementById('event-form');
  const formTitle = document.getElementById('form-title');
  const eventIdInput = document.getElementById('event-id');
  const nameInput = document.getElementById('event-name');
  const promotionInput = document.getElementById('event-promotion');
  const dateInput = document.getElementById('event-date');
  const timeInput = document.getElementById('event-time');
  const venueInput = document.getElementById('event-venue');
  const cityInput = document.getElementById('event-city');
  const countryInput = document.getElementById('event-country');
  const statusInput = document.getElementById('event-status-select');
  const ticketInput = document.getElementById('event-ticket');
  const descriptionInput = document.getElementById('event-description');
  const fightsList = document.getElementById('fights-list');

  // Load events
  async function fetchAndRender() {
    allEvents = await dataStore.getAll('events');
    // Sort events by date descending
    allEvents.sort((a, b) => new Date(b.date) - new Date(a.date));
    applyFilters();
  }

  function applyFilters() {
    const q = searchInput.value.toLowerCase().trim();
    const promo = filterPromotion.value;
    const st = filterStatus.value;

    filteredEvents = allEvents.filter(evt => {
      // Search matches event name, venue, city, or country
      const matchesSearch = !q || 
        evt.name.toLowerCase().includes(q) || 
        evt.venue.toLowerCase().includes(q) ||
        evt.city.toLowerCase().includes(q) ||
        evt.country.toLowerCase().includes(q);

      // Promotion filter
      const matchesPromotion = !promo || evt.promotion === promo;

      // Status filter
      const matchesStatus = !st || evt.status === st;

      return matchesSearch && matchesPromotion && matchesStatus;
    });

    currentPage = 1;
    renderTable();
  }

  function renderTable() {
    tableBody.innerHTML = '';

    if (filteredEvents.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--admin-text-muted); padding: 30px;">
            No events found matching the criteria.
          </td>
        </tr>
      `;
      pagInfo.textContent = 'Showing 0 of 0 entries';
      pagButtons.innerHTML = '';
      return;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, filteredEvents.length);
    const paginatedItems = filteredEvents.slice(start, end);

    pagInfo.textContent = `Showing ${start + 1}-${end} of ${filteredEvents.length} entries`;

    paginatedItems.forEach(evt => {
      const tr = document.createElement('tr');
      
      let badgeClass = 'status-upcoming';
      if (evt.status === 'live') badgeClass = 'status-live';
      if (evt.status === 'completed') badgeClass = 'status-completed';

      let promoBadge = 'badge-accent';
      if (evt.promotion === 'Boxing') promoBadge = 'badge-info';
      if (evt.promotion === 'ONE') promoBadge = 'badge-warning';
      if (evt.promotion === 'PFL') promoBadge = 'badge-success';

      const fightsCount = evt.fights ? evt.fights.length : 0;

      tr.innerHTML = `
        <td><strong>${escapeHtml(evt.name)}</strong></td>
        <td><span class="badge ${promoBadge}" style="font-weight:600; padding:2px 6px; border-radius:4px;">${escapeHtml(evt.promotion)}</span></td>
        <td>
          <div>${escapeHtml(evt.date)}</div>
          <div style="font-size: 0.75rem; color: var(--admin-text-muted);">${escapeHtml(evt.time)}</div>
        </td>
        <td>${escapeHtml(evt.venue)}, ${escapeHtml(evt.city)}</td>
        <td><strong>${fightsCount}</strong> bouts</td>
        <td><span class="status-badge ${badgeClass}">${escapeHtml((evt.status || 'upcoming').toUpperCase())}</span></td>
        <td>
          <div class="table-actions">
            <button class="table-action btn-edit" data-id="${escapeHtml(evt.id)}" title="Edit Event">✏️ Edit</button>
            <button class="table-action delete btn-delete" data-id="${escapeHtml(evt.id)}" title="Delete Event">🗑️</button>
          </div>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    renderPaginationButtons();
  }

  function renderPaginationButtons() {
    pagButtons.innerHTML = '';
    const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
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

  // ---- Dynamic Matchup Rows ---- //
  function addFightRow(value = '') {
    const div = document.createElement('div');
    div.className = 'dynamic-list-item';
    div.innerHTML = `
      <input type="text" value="${value.replace(/"/g, '&quot;')}" placeholder="e.g. Khabib Nurmagomedov vs. Conor McGregor" required>
      <button type="button" class="remove-item">✖</button>
    `;
    div.querySelector('.remove-item').addEventListener('click', () => div.remove());
    fightsList.appendChild(div);
  }

  function getFights() {
    const inputs = fightsList.querySelectorAll('input');
    const list = [];
    inputs.forEach(input => {
      const val = input.value.trim();
      if (val) list.push(val);
    });
    return list;
  }

  // ---- Form Toggle ---- //
  function showForm(evt = null) {
    eventForm.reset();
    fightsList.innerHTML = '';

    if (evt) {
      formTitle.textContent = 'Edit Scheduled Event';
      eventIdInput.value = evt.id;
      nameInput.value = evt.name;
      promotionInput.value = evt.promotion;
      dateInput.value = evt.date;
      timeInput.value = evt.time;
      venueInput.value = evt.venue;
      cityInput.value = evt.city;
      countryInput.value = evt.country;
      statusInput.value = evt.status;
      ticketInput.value = evt.ticketUrl || '';
      descriptionInput.value = evt.description || '';
      
      if (evt.fights && Array.isArray(evt.fights)) {
        evt.fights.forEach(f => addFightRow(f));
      }
    } else {
      formTitle.textContent = 'Schedule New Event';
      eventIdInput.value = '';
      dateInput.value = new Date().toISOString().substring(0, 10);
      timeInput.value = '10:00 PM ET';
      // Default to 1 empty fight row
      addFightRow();
    }

    listSection.style.display = 'none';
    formSection.style.display = 'block';
  }

  function hideForm() {
    formSection.style.display = 'none';
    listSection.style.display = 'block';
  }

  // Event Handlers
  document.getElementById('btn-add-event').addEventListener('click', () => showForm(null));
  document.getElementById('btn-back').addEventListener('click', hideForm);
  document.getElementById('btn-cancel').addEventListener('click', hideForm);
  document.getElementById('btn-add-fight').addEventListener('click', () => addFightRow());

  // Table buttons delegation
  tableBody.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.btn-edit');
    const deleteBtn = e.target.closest('.btn-delete');

    if (editBtn) {
      const id = editBtn.getAttribute('data-id');
      const evt = await dataStore.getById('events', id);
      if (evt) showForm(evt);
    }

    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id');
      const evt = await dataStore.getById('events', id);
      if (evt && confirm(`Are you sure you want to cancel and delete "${evt.name}"?`)) {
        await dataStore.delete('events', id);
        showToast('Event deleted successfully', 'success');
        fetchAndRender();
      }
    }
  });

  // Filter triggers
  searchInput.addEventListener('input', applyFilters);
  filterPromotion.addEventListener('change', applyFilters);
  filterStatus.addEventListener('change', applyFilters);

  // Form Submit
  eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = eventIdInput.value;
    const fights = getFights();

    if (fights.length === 0) {
      alert('Please add at least one matchup bout to the fight card.');
      return;
    }

    const data = {
      name: nameInput.value.trim(),
      promotion: promotionInput.value,
      date: dateInput.value,
      time: timeInput.value.trim(),
      venue: venueInput.value.trim(),
      city: cityInput.value.trim(),
      country: countryInput.value.trim(),
      status: statusInput.value,
      ticketUrl: ticketInput.value.trim() || '#',
      description: descriptionInput.value.trim(),
      fights: fights
    };

    if (id) {
      data.id = id;
      await dataStore.update('events', data);
      showToast('Event updated successfully', 'success');
    } else {
      await dataStore.add('events', data);
      showToast('New event scheduled successfully', 'success');
    }

    hideForm();
    fetchAndRender();
  });

  // Redirect from dashboard shortcut check
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('new') === 'true') {
    showForm(null);
  }

  fetchAndRender();
});
