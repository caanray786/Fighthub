/* ============================================
   FightHub — Admin Articles Script
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await dataStore.ready;

  let allArticles = [];
  let filteredArticles = [];
  let currentPage = 1;
  const itemsPerPage = 8;
  let isEditing = false;

  // DOM elements
  const listSection = document.getElementById('list-section');
  const formSection = document.getElementById('form-section');
  const tableBody = document.getElementById('articles-table-body');
  const searchInput = document.getElementById('search-input');
  const filterCategory = document.getElementById('filter-category');
  const filterStatus = document.getElementById('filter-status');
  const pagInfo = document.getElementById('pagination-info');
  const pagButtons = document.getElementById('pagination-buttons');
  
  // Form elements
  const articleForm = document.getElementById('article-form');
  const formTitle = document.getElementById('form-title');
  const articleIdInput = document.getElementById('article-id');
  const titleInput = document.getElementById('article-title');
  const slugInput = document.getElementById('article-slug');
  const categoryInput = document.getElementById('article-category');
  const authorInput = document.getElementById('article-author');
  const dateInput = document.getElementById('article-date');
  const statusInput = document.getElementById('article-status-select');
  const tagsInput = document.getElementById('article-tags');
  const imageInput = document.getElementById('article-image');
  const excerptInput = document.getElementById('article-excerpt');
  const bodyInput = document.getElementById('article-body');

  // Load articles
  async function fetchAndRender() {
    allArticles = await dataStore.getAll('articles');
    // Sort articles by date descending
    allArticles.sort((a, b) => new Date(b.date) - new Date(a.date));
    applyFilters();
  }

  function applyFilters() {
    const q = searchInput.value.toLowerCase().trim();
    const cat = filterCategory.value;
    const st = filterStatus.value;

    filteredArticles = allArticles.filter(art => {
      // Search matches title, excerpt, author, or tags
      const matchesSearch = !q || 
        art.title.toLowerCase().includes(q) || 
        art.excerpt.toLowerCase().includes(q) ||
        art.author.toLowerCase().includes(q) ||
        (art.tags && art.tags.some(t => t.toLowerCase().includes(q)));

      // Category filter
      const matchesCategory = !cat || art.category === cat;

      // Status filter
      const matchesStatus = !st || art.status === st;

      return matchesSearch && matchesCategory && matchesStatus;
    });

    currentPage = 1;
    renderTable();
  }

  function renderTable() {
    tableBody.innerHTML = '';

    if (filteredArticles.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--admin-text-muted); padding: 30px;">
            No articles found matching the criteria.
          </td>
        </tr>
      `;
      pagInfo.textContent = 'Showing 0 of 0 entries';
      pagButtons.innerHTML = '';
      return;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, filteredArticles.length);
    const paginatedItems = filteredArticles.slice(start, end);

    pagInfo.textContent = `Showing ${start + 1}-${end} of ${filteredArticles.length} entries`;

    paginatedItems.forEach(art => {
      const tr = document.createElement('tr');
      
      let badgeClass = 'status-draft';
      if (art.status === 'published') badgeClass = 'status-published';
      if (art.status === 'archived') badgeClass = 'status-archived';

      tr.innerHTML = `
        <td>
          <div style="font-weight: 700; white-space: normal; max-width: 320px;">
            ${escapeHtml(art.title)}
          </div>
          <div style="font-size: 0.75rem; color: var(--admin-text-muted); font-family: monospace;">
            slug: ${escapeHtml(art.slug)}
          </div>
        </td>
        <td>${escapeHtml(art.author)}</td>
        <td><span class="badge" style="background: rgba(59,130,246,0.1); color: var(--admin-accent); font-weight:600; font-size:0.75rem; padding: 2px 6px; border-radius: 4px;">${escapeHtml(art.category)}</span></td>
        <td>${escapeHtml(art.date)}</td>
        <td style="font-size: 0.8rem; color: var(--admin-text-muted);">
          ❤️ ${art.likes || 0} Likes | 💬 ${art.comments || 0} Comments
        </td>
        <td><span class="status-badge ${badgeClass}">${art.status.toUpperCase()}</span></td>
        <td>
          <div class="table-actions">
            <button class="table-action btn-edit" data-id="${escapeHtml(art.id)}" title="Edit Article">✏️ Edit</button>
            <button class="table-action delete btn-delete" data-id="${escapeHtml(art.id)}" title="Delete Article">🗑️</button>
          </div>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    renderPaginationButtons();
  }

  function renderPaginationButtons() {
    pagButtons.innerHTML = '';
    const totalPages = Math.ceil(filteredArticles.length / itemsPerPage);
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

  // Slugify Helper
  function slugify(text) {
    return text.toString().toLowerCase()
      .replace(/\s+/g, '-')           // Replace spaces with -
      .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
      .replace(/\-\-+/g, '-')         // Replace multiple - with single -
      .replace(/^-+/, '')             // Trim - from start of text
      .replace(/-+$/, '');            // Trim - from end of text
  }

  // Slug Auto-generation
  titleInput.addEventListener('input', () => {
    if (!isEditing) {
      slugInput.value = slugify(titleInput.value);
    }
  });

  // Form toggle
  function showForm(art = null) {
    articleForm.reset();
    
    if (art) {
      isEditing = true;
      formTitle.textContent = 'Edit Article';
      articleIdInput.value = art.id;
      titleInput.value = art.title;
      slugInput.value = art.slug;
      categoryInput.value = art.category;
      authorInput.value = art.author;
      dateInput.value = art.date;
      statusInput.value = art.status;
      tagsInput.value = art.tags ? art.tags.join(', ') : '';
      imageInput.value = art.image || '';
      excerptInput.value = art.excerpt || '';
      bodyInput.value = art.content || '';
    } else {
      isEditing = false;
      formTitle.textContent = 'Write New Article';
      articleIdInput.value = '';
      // Default date to today
      dateInput.value = new Date().toISOString().substring(0, 10);
      authorInput.value = 'Admin Editor';
    }

    listSection.style.display = 'none';
    formSection.style.display = 'block';
  }

  function hideForm() {
    formSection.style.display = 'none';
    listSection.style.display = 'block';
  }

  // Event Handlers
  document.getElementById('btn-add-article').addEventListener('click', () => showForm(null));
  document.getElementById('btn-back').addEventListener('click', hideForm);
  document.getElementById('btn-cancel').addEventListener('click', hideForm);

  // Table buttons delegation
  tableBody.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.btn-edit');
    const deleteBtn = e.target.closest('.btn-delete');

    if (editBtn) {
      const id = editBtn.getAttribute('data-id');
      const art = await dataStore.getById('articles', id);
      if (art) showForm(art);
    }

    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id');
      const art = await dataStore.getById('articles', id);
      if (art && confirm(`Are you sure you want to delete "${art.title}"?`)) {
        await dataStore.delete('articles', id);
        showToast('Article deleted successfully', 'success');
        fetchAndRender();
      }
    }
  });

  // Filter triggers
  searchInput.addEventListener('input', applyFilters);
  filterCategory.addEventListener('change', applyFilters);
  filterStatus.addEventListener('change', applyFilters);

  // Form Submit
  articleForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = articleIdInput.value;
    const tagArray = tagsInput.value.split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const oldArt = id ? await dataStore.getById('articles', id) : null;

    const data = {
      title: titleInput.value.trim(),
      slug: slugInput.value.trim() || slugify(titleInput.value),
      category: categoryInput.value,
      author: authorInput.value.trim(),
      date: dateInput.value,
      status: statusInput.value,
      tags: tagArray,
      image: imageInput.value.trim(),
      excerpt: excerptInput.value.trim(),
      content: bodyInput.value.trim(),
      // Keep old stats if editing, or default to 0
      likes: oldArt ? (oldArt.likes || 0) : 0,
      comments: oldArt ? (oldArt.comments || 0) : 0
    };

    if (id) {
      data.id = id;
      await dataStore.update('articles', data);
      showToast('Article updated successfully', 'success');
    } else {
      await dataStore.add('articles', data);
      showToast('New article published successfully', 'success');
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
