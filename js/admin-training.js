/* ============================================
   FightHub — Admin Training Script
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await dataStore.ready;

  let allWorkouts = [];
  let filteredWorkouts = [];
  let currentPage = 1;
  const itemsPerPage = 8;

  // DOM elements
  const listSection = document.getElementById('list-section');
  const formSection = document.getElementById('form-section');
  const tableBody = document.getElementById('workouts-table-body');
  const searchInput = document.getElementById('search-input');
  const pagInfo = document.getElementById('pagination-info');
  const pagButtons = document.getElementById('pagination-buttons');
  
  // Form elements
  const workoutForm = document.getElementById('workout-form');
  const formTitle = document.getElementById('form-title');
  const workoutIdInput = document.getElementById('workout-id');
  const iconInput = document.getElementById('workout-icon');
  const titleInput = document.getElementById('workout-title');
  const categoryInput = document.getElementById('workout-category');
  const descriptionInput = document.getElementById('workout-description');
  const exercisesContainer = document.getElementById('exercises-container');
  const imageInput = document.getElementById('workout-image');

  // Load workouts
  async function fetchAndRender() {
    allWorkouts = await dataStore.getAll('training');
    applyFilters();
  }

  function applyFilters() {
    const q = searchInput.value.toLowerCase().trim();

    filteredWorkouts = allWorkouts.filter(w => {
      // Search matches title, category, or description
      return !q || 
        w.title.toLowerCase().includes(q) || 
        w.category.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q);
    });

    currentPage = 1;
    renderTable();
  }

  function renderTable() {
    tableBody.innerHTML = '';

    if (filteredWorkouts.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--admin-text-muted); padding: 30px;">
            No workout programs found matching the criteria.
          </td>
        </tr>
      `;
      pagInfo.textContent = 'Showing 0 of 0 entries';
      pagButtons.innerHTML = '';
      return;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, filteredWorkouts.length);
    const paginatedItems = filteredWorkouts.slice(start, end);

    pagInfo.textContent = `Showing ${start + 1}-${end} of ${filteredWorkouts.length} entries`;

    paginatedItems.forEach(w => {
      const tr = document.createElement('tr');
      const exercisesCount = w.exercises ? w.exercises.length : 0;

      tr.innerHTML = `
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.5rem;">${escapeHtml(w.icon || '🏋️')}</span>
            <strong>${escapeHtml(w.title)}</strong>
          </div>
        </td>
        <td><span class="badge" style="background: rgba(59,130,246,0.1); color: var(--admin-accent); font-weight:600; font-size:0.75rem; padding: 2px 6px; border-radius: 4px;">${escapeHtml(w.category)}</span></td>
        <td><strong>${exercisesCount}</strong> steps</td>
        <td>
          <div style="white-space: normal; max-width: 400px; font-size: 0.85rem; color: var(--admin-text-muted);">
            ${escapeHtml(w.description)}
          </div>
        </td>
        <td>
          <div class="table-actions">
            <button class="table-action btn-edit" data-id="${escapeHtml(w.id)}" title="Edit Program">✏️ Edit</button>
            <button class="table-action delete btn-delete" data-id="${escapeHtml(w.id)}" title="Delete Program">🗑️</button>
          </div>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    renderPaginationButtons();
  }

  function renderPaginationButtons() {
    pagButtons.innerHTML = '';
    const totalPages = Math.ceil(filteredWorkouts.length / itemsPerPage);
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

  // ---- Dynamic Exercise Subforms ---- //
  function addExerciseCard(ex = { name: '', sets: '', videoUrl: '', description: '' }) {
    const card = document.createElement('div');
    card.className = 'exercise-card-item';
    card.style = 'border: 1px solid var(--admin-border); padding: 15px; margin-bottom: 15px; border-radius: var(--radius-sm); background: rgba(255, 255, 255, 0.01); position: relative;';
    
    card.innerHTML = `
      <button type="button" class="btn-remove-ex" style="position: absolute; top: 10px; right: 10px; background: transparent; border: none; color: var(--admin-error); cursor: pointer; font-size: 0.85rem;" title="Remove this exercise step">✖ Remove</button>
      <div style="display: grid; grid-template-columns: 2fr 1fr 2fr; gap: var(--space-md); margin-top: 15px;">
        <div class="form-group" style="margin-bottom:0;">
          <label style="font-size:0.75rem;">Exercise/Step Name *</label>
          <input type="text" class="ex-name" value="${ex.name.replace(/"/g, '&quot;')}" placeholder="e.g. Turkish Get-Ups" required style="padding: 0.5rem 0.75rem;">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label style="font-size:0.75rem;">Sets / Duration *</label>
          <input type="text" class="ex-sets" value="${ex.sets.replace(/"/g, '&quot;')}" placeholder="e.g. 4 rounds" required style="padding: 0.5rem 0.75rem;">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label style="font-size:0.75rem;">Video Guide Link URL</label>
          <input type="url" class="ex-video" value="${ex.videoUrl ? ex.videoUrl.replace(/"/g, '&quot;') : ''}" placeholder="https://youtube.com/..." style="padding: 0.5rem 0.75rem;">
        </div>
      </div>
      <div class="form-group" style="margin-top: 10px; margin-bottom:0;">
        <label style="font-size:0.75rem;">Exercise Instructions / Details *</label>
        <textarea class="ex-desc" placeholder="Explain setup, form cues, rep instructions..." required style="min-height: 60px; padding: 0.5rem 0.75rem;"></textarea>
      </div>
    `;
    card.querySelector('.ex-desc').value = ex.description;
    
    card.querySelector('.btn-remove-ex').addEventListener('click', () => card.remove());
    exercisesContainer.appendChild(card);
  }

  function getExercises() {
    const cards = exercisesContainer.querySelectorAll('.exercise-card-item');
    const list = [];
    
    cards.forEach(card => {
      const name = card.querySelector('.ex-name').value.trim();
      const sets = card.querySelector('.ex-sets').value.trim();
      const videoUrl = card.querySelector('.ex-video').value.trim();
      const description = card.querySelector('.ex-desc').value.trim();

      if (name && sets && description) {
        list.push({ name, sets, videoUrl, description });
      }
    });
    return list;
  }

  // ---- Form Toggle ---- //
  function showForm(w = null) {
    workoutForm.reset();
    exercisesContainer.innerHTML = '';

    if (w) {
      formTitle.textContent = `Edit Program: ${w.title}`;
      workoutIdInput.value = w.id;
      iconInput.value = w.icon || '🏋️';
      titleInput.value = w.title;
      categoryInput.value = w.category;
      descriptionInput.value = w.description;
      imageInput.value = w.image || '';
      
      if (w.exercises && Array.isArray(w.exercises)) {
        w.exercises.forEach(ex => addExerciseCard(ex));
      }
    } else {
      formTitle.textContent = 'Create Workout Program';
      workoutIdInput.value = '';
      iconInput.value = '💪';
      imageInput.value = '';
      // Default to 1 empty exercise row
      addExerciseCard();
    }

    listSection.style.display = 'none';
    formSection.style.display = 'block';
  }

  function hideForm() {
    formSection.style.display = 'none';
    listSection.style.display = 'block';
  }

  // Event Handlers
  document.getElementById('btn-add-workout').addEventListener('click', () => showForm(null));
  document.getElementById('btn-back').addEventListener('click', hideForm);
  document.getElementById('btn-cancel').addEventListener('click', hideForm);
  document.getElementById('btn-add-exercise').addEventListener('click', () => addExerciseCard());

  // Table buttons delegation
  tableBody.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.btn-edit');
    const deleteBtn = e.target.closest('.btn-delete');

    if (editBtn) {
      const id = editBtn.getAttribute('data-id');
      const w = await dataStore.getById('training', id);
      if (w) showForm(w);
    }

    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id');
      const w = await dataStore.getById('training', id);
      if (w && confirm(`Are you sure you want to delete the workout program "${w.title}"?`)) {
        await dataStore.delete('training', id);
        showToast('Workout program deleted successfully', 'success');
        fetchAndRender();
      }
    }
  });

  // Search input trigger
  searchInput.addEventListener('input', applyFilters);

  // Form Submit
  workoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = workoutIdInput.value;
    const exercises = getExercises();

    if (exercises.length === 0) {
      alert('Please add at least one exercise or step to the program.');
      return;
    }

    const data = {
      icon: iconInput.value.trim() || '🏋️',
      title: titleInput.value.trim(),
      category: categoryInput.value,
      description: descriptionInput.value.trim(),
      image: imageInput.value.trim(),
      exercises: exercises
    };

    if (id) {
      data.id = id;
      await dataStore.update('training', data);
      showToast('Workout program updated successfully', 'success');
    } else {
      await dataStore.add('training', data);
      showToast('New workout program created successfully', 'success');
    }

    hideForm();
    fetchAndRender();
  });

  fetchAndRender();
});
