/* ============================================
   FightHub — Admin Gyms Script
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await dataStore.ready;

  let allGyms = [];
  let filteredGyms = [];

  // DOM Elements
  const listSection = document.getElementById('list-section');
  const formSection = document.getElementById('form-section');
  const tableBody = document.getElementById('gyms-list-body');
  const searchInput = document.getElementById('search-input');
  const filterStyle = document.getElementById('filter-style');
  
  // Buttons
  const btnAddGym = document.getElementById('btn-add-gym');
  const btnCancel = document.getElementById('btn-cancel');
  const btnCancelForm = document.getElementById('btn-cancel-form');
  
  // Form Elements
  const gymForm = document.getElementById('gym-form');
  const formTitle = document.getElementById('form-title');
  const idInput = document.getElementById('gym-id');
  const nameInput = document.getElementById('gym-name');
  const phoneInput = document.getElementById('gym-phone');
  const emailInput = document.getElementById('gym-email');
  const websiteInput = document.getElementById('gym-website');
  const imageInput = document.getElementById('gym-image');
  const ratingInput = document.getElementById('gym-rating');
  const latInput = document.getElementById('gym-lat');
  const lngInput = document.getElementById('gym-lng');
  const descriptionInput = document.getElementById('gym-description');
  const addressInput = document.getElementById('gym-address');
  const cityInput = document.getElementById('gym-city');
  const stateInput = document.getElementById('gym-state');
  const zipInput = document.getElementById('gym-zip');
  const countryInput = document.getElementById('gym-country');

  // Load and Render List
  async function fetchAndRender() {
    allGyms = await dataStore.getAll('gyms');
    applyFilters();
  }

  function applyFilters() {
    const q = searchInput.value.toLowerCase().trim();
    const st = filterStyle.value;

    filteredGyms = allGyms.filter(gym => {
      const matchesSearch = !q || 
        gym.name.toLowerCase().includes(q) || 
        gym.city.toLowerCase().includes(q) || 
        gym.address.toLowerCase().includes(q) ||
        gym.description.toLowerCase().includes(q);

      const matchesStyle = !st || gym.styles.includes(st);

      return matchesSearch && matchesStyle;
    });

    renderTable();
  }

  function renderTable() {
    tableBody.innerHTML = '';
    
    if (filteredGyms.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--admin-text-muted); padding: 40px;">
            No gyms or clubs found matching the criteria.
          </td>
        </tr>
      `;
      return;
    }

    filteredGyms.forEach(gym => {
      const tr = document.createElement('tr');
      
      const ratingStars = '⭐'.repeat(Math.round(gym.rating)) + ` (${gym.rating})`;
      const stylesList = gym.styles.map(s => `<span class="badge badge-info" style="margin-right:2px; font-size:0.75rem;">${s}</span>`).join('');
      const websiteLink = gym.website ? `<a href="${gym.website}" target="_blank" style="color: var(--admin-accent); text-decoration: underline;">Visit Site</a>` : 'N/A';

      tr.innerHTML = `
        <td>
          <div style="display:flex; align-items:center; gap:10px;">
            <img src="${gym.image || 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=80&q=80'}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;">
            <div>
              <strong style="color:var(--admin-text-primary); font-size:0.95rem;">${gym.name}</strong>
              <div style="font-size:0.8rem; color:var(--admin-text-muted);">${gym.phone || 'No Phone'}</div>
            </div>
          </div>
        </td>
        <td>
          <div style="font-size:0.9rem;">${gym.address}</div>
          <div style="font-size:0.8rem; color:var(--admin-text-muted);">${gym.city}, ${gym.country}</div>
        </td>
        <td>
          <div style="font-size:0.85rem;">${gym.email || 'No Email'}</div>
          <div>${websiteLink}</div>
        </td>
        <td style="color:#ffd166; font-size:0.85rem;">${ratingStars}</td>
        <td>${stylesList}</td>
        <td style="text-align: right;">
          <button class="btn-action btn-edit btn-edit-gym" data-id="${gym.id}" style="background:var(--admin-bg-secondary); border:1px solid var(--admin-border-color); color:var(--admin-text-primary); padding:6px 12px; border-radius:4px; cursor:pointer; margin-right:5px;">Edit</button>
          <button class="btn-action btn-delete btn-delete-gym" data-id="${gym.id}" style="background:rgba(230,57,70,0.15); border:1px solid var(--accent); color:var(--accent); padding:6px 12px; border-radius:4px; cursor:pointer;">Delete</button>
        </td>
      `;

      tableBody.appendChild(tr);
    });

    // Bind edit and delete triggers
    document.querySelectorAll('.btn-edit-gym').forEach(btn => {
      btn.addEventListener('click', () => openEditForm(btn.getAttribute('data-id')));
    });

    document.querySelectorAll('.btn-delete-gym').forEach(btn => {
      btn.addEventListener('click', () => deleteGym(btn.getAttribute('data-id')));
    });
  }

  // Edit / Add Form Logic
  function openAddForm() {
    formTitle.textContent = 'Add New Gym Academy';
    gymForm.reset();
    idInput.value = '';
    
    // Clear all checkboxes
    document.querySelectorAll('input[name="gym-styles"]').forEach(cb => cb.checked = false);

    listSection.style.display = 'none';
    formSection.style.display = 'block';
  }

  function openEditForm(id) {
    const gym = allGyms.find(g => g.id === id);
    if (!gym) return;

    formTitle.textContent = `Edit: ${gym.name}`;
    idInput.value = gym.id;
    nameInput.value = gym.name;
    phoneInput.value = gym.phone || '';
    emailInput.value = gym.email || '';
    websiteInput.value = gym.website || '';
    imageInput.value = gym.image || '';
    ratingInput.value = gym.rating || 4.8;
    latInput.value = gym.lat || '';
    lngInput.value = gym.lng || '';
    descriptionInput.value = gym.description || '';
    addressInput.value = gym.address;
    cityInput.value = gym.city;
    stateInput.value = gym.state || '';
    zipInput.value = gym.zip || '';
    countryInput.value = gym.country;

    // Check correct checkboxes
    document.querySelectorAll('input[name="gym-styles"]').forEach(cb => {
      cb.checked = gym.styles.includes(cb.value);
    });

    listSection.style.display = 'none';
    formSection.style.display = 'block';
  }

  function closeForm() {
    listSection.style.display = 'block';
    formSection.style.display = 'none';
  }

  // Delete Action
  async function deleteGym(id) {
    const gym = allGyms.find(g => g.id === id);
    if (!gym) return;

    if (confirm(`Are you sure you want to delete "${gym.name}" from the clubs directory?`)) {
      try {
        await dataStore.delete('gyms', id);
        showToast('Gym deleted successfully!', 'success');
        fetchAndRender();
      } catch (err) {
        showToast('Error deleting gym.', 'error');
        console.error(err);
      }
    }
  }

  // Form Submission
  gymForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = idInput.value;
    const name = nameInput.value.trim();
    const address = addressInput.value.trim();
    const city = cityInput.value.trim();
    const state = stateInput.value.trim();
    const zip = zipInput.value.trim();
    const country = countryInput.value.trim();
    
    // Read checked styles
    const styles = [];
    document.querySelectorAll('input[name="gym-styles"]:checked').forEach(cb => {
      styles.push(cb.value);
    });

    if (styles.length === 0) {
      alert("Please select at least one style offered by this gym.");
      return;
    }

    const gymData = {
      name,
      address,
      city,
      state,
      zip,
      country,
      phone: phoneInput.value.trim(),
      email: emailInput.value.trim(),
      website: websiteInput.value.trim(),
      image: imageInput.value.trim(),
      rating: parseFloat(ratingInput.value) || 4.5,
      lat: parseFloat(latInput.value) || 0,
      lng: parseFloat(lngInput.value) || 0,
      description: descriptionInput.value.trim(),
      styles
    };

    if (id) {
      gymData.id = id;
    }

    try {
      if (id) {
        await dataStore.update('gyms', gymData);
        showToast('Gym updated successfully!', 'success');
      } else {
        await dataStore.add('gyms', gymData);
        showToast('Gym added successfully!', 'success');
      }
      closeForm();
      fetchAndRender();
    } catch (err) {
      showToast('Error saving gym data.', 'error');
      console.error(err);
    }
  });

  // Bind Events
  searchInput.addEventListener('input', applyFilters);
  filterStyle.addEventListener('change', applyFilters);
  btnAddGym.addEventListener('click', openAddForm);
  btnCancel.addEventListener('click', closeForm);
  btnCancelForm.addEventListener('click', closeForm);

  // Initial Fetch
  fetchAndRender();
});
