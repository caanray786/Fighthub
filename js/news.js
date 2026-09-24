/* ============================================
   FightHub — News JS
   Handles article queries, featured article render,
   category filtering, likes, comments, and article detail modal.
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await dataStore.ready;

  const featuredContainer = document.getElementById('featured-article-container');
  const articlesGrid = document.getElementById('articles-grid');
  const tabs = document.querySelectorAll('.tab');
  
  const modal = document.getElementById('news-modal');
  const modalBackdrop = document.getElementById('news-modal-backdrop');
  const modalClose = document.getElementById('modal-article-close');

  let allArticles = [];
  let currentCategory = 'All';

  // 1. Fetch data
  try {
    allArticles = (await dataStore.getAll('articles')).filter(a => a.status !== 'draft');
    // Sort articles by date descending
    allArticles.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    renderNews();
  } catch (err) {
    console.error('Error loading articles:', err);
    articlesGrid.innerHTML = `<div class="text-center" style="grid-column:1/-1;"><p class="text-accent">Error loading articles.</p></div>`;
  }

  // 2. Render News Section (Featured + Grid)
  function renderNews() {
    // Filter articles based on category
    const filtered = currentCategory === 'All' 
      ? allArticles 
      : allArticles.filter(art => art.category === currentCategory);

    // If 'All' is active and we have articles, show the first as Featured
    if (currentCategory === 'All' && filtered.length > 0) {
      featuredContainer.style.display = 'block';
      const featured = filtered[0];
      const rest = filtered.slice(1);
      
      renderFeatured(featured);
      renderGrid(rest);
    } else {
      // Hide featured container and render all filtered in grid
      featuredContainer.style.display = 'none';
      renderGrid(filtered);
    }
  }

  // 3. Render Featured Card
  function renderFeatured(art) {
    const isLiked = dataStore.isLiked(art.id);
    const commentCount = getCommentCount(art.id);
    
    // Increment default likes count if stored liked
    const likeDisplayCount = (art.likes || 0) + (isLiked ? 1 : 0);

    featuredContainer.innerHTML = `
      <div class="section-header" style="text-align:left; margin-bottom:var(--space-xl);">
        <h2>Featured <span class="text-accent">Story</span></h2>
        <div class="section-line" style="margin: 10px 0;"></div>
      </div>
      <div class="article-featured animate-on-scroll">
        <div class="article-image" style="background: linear-gradient(135deg, #1e0205 0%, #0c0001 100%); display:flex; align-items:center; justify-content:center; font-size:6rem; cursor:pointer;" data-open-article="${escapeHtml(art.id)}">
          📰
        </div>
        <div class="article-body">
          <div class="article-meta">
            <span class="badge badge-accent">${escapeHtml(art.category)}</span>
            <span>${formatDate(art.date)}</span>
            <span>By ${escapeHtml(art.author)}</span>
          </div>
          <h3 class="article-title" style="cursor:pointer;" data-open-article="${escapeHtml(art.id)}">${escapeHtml(art.title)}</h3>
          <p class="article-excerpt">${escapeHtml(art.excerpt)}</p>
          <div class="article-actions" style="margin-top:auto;">
            <button class="article-action-btn like-btn ${isLiked ? 'liked' : ''}" data-id="${escapeHtml(art.id)}">
              <span>${isLiked ? '❤️' : '🤍'}</span> <span class="like-count">${likeDisplayCount}</span> Likes
            </button>
            <button class="article-action-btn" data-open-article="${escapeHtml(art.id)}">
              💬 <span>${commentCount}</span> Comments
            </button>
            <button class="btn btn-secondary btn-sm" data-open-article="${escapeHtml(art.id)}" style="margin-left:auto;">Read Full Article</button>
          </div>
        </div>
      </div>
    `;

    setupLikeButton(featuredContainer.querySelector('.like-btn'), art);
  }

  // 4. Render Grid of Cards
  function renderGrid(articles) {
    articlesGrid.innerHTML = '';
    
    if (articles.length === 0) {
      articlesGrid.innerHTML = `<div class="text-center" style="grid-column:1/-1; padding:40px 0;"><p>No articles found in this category.</p></div>`;
      return;
    }

    articles.forEach(art => {
      const isLiked = dataStore.isLiked(art.id);
      const commentCount = getCommentCount(art.id);
      const likeDisplayCount = (art.likes || 0) + (isLiked ? 1 : 0);

      const card = document.createElement('div');
      card.className = 'article-card animate-on-scroll';
      card.innerHTML = `
        <div class="article-image" style="background: linear-gradient(135deg, #111 0%, #1c1c1c 100%); display:flex; align-items:center; justify-content:center; font-size:3.5rem; height: 180px; cursor:pointer;" data-open-article="${escapeHtml(art.id)}">
          📰
        </div>
        <div class="article-body">
          <div class="article-meta">
            <span class="badge badge-accent">${escapeHtml(art.category)}</span>
            <span>${formatDate(art.date)}</span>
          </div>
          <h3 class="article-title" style="cursor:pointer; font-size: 1.15rem;" data-open-article="${escapeHtml(art.id)}">${escapeHtml(art.title)}</h3>
          <p class="article-excerpt" style="font-size:0.85rem; height: 60px; overflow:hidden;">${escapeHtml(art.excerpt)}</p>
          <div class="article-actions">
            <button class="article-action-btn like-btn ${isLiked ? 'liked' : ''}" data-id="${escapeHtml(art.id)}">
              <span>${isLiked ? '❤️' : '🤍'}</span> <span class="like-count">${likeDisplayCount}</span>
            </button>
            <button class="article-action-btn" data-open-article="${escapeHtml(art.id)}">
              💬 <span>${commentCount}</span>
            </button>
            <button class="btn btn-secondary btn-sm" data-open-article="${escapeHtml(art.id)}" style="margin-left:auto; padding: 4px 10px; font-size:0.75rem;">Read</button>
          </div>
        </div>
      `;
      articlesGrid.appendChild(card);
      setupLikeButton(card.querySelector('.like-btn'), art);
    });

    if (window.initScrollAnimations) {
      window.initScrollAnimations();
    }
  }

  // 5. Setup Like Toggle Behavior
  function setupLikeButton(btn, art) {
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isLikedNow = dataStore.toggleLike(art.id);
      
      btn.classList.toggle('liked', isLikedNow);
      btn.querySelector('span:first-child').innerText = isLikedNow ? '❤️' : '🤍';
      btn.querySelector('.like-count').innerText = (art.likes || 0) + (isLikedNow ? 1 : 0);
      
      
      // Update other occurrences (e.g. sync featured and grid if they share same article)
      document.querySelectorAll(`.like-btn[data-id="${CSS.escape(art.id)}"]`).forEach(otherBtn => {
        if (otherBtn !== btn) {
          otherBtn.classList.toggle('liked', isLikedNow);
          otherBtn.querySelector('span:first-child').innerText = isLikedNow ? '❤️' : '🤍';
          otherBtn.querySelector('.like-count').innerText = (art.likes || 0) + (isLikedNow ? 1 : 0);
        }
      });
    });
  }

  // Open the article modal from any element tagged with data-open-article
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-open-article]');
    if (trigger) openArticleModal(trigger.getAttribute('data-open-article'));
  });

  // 6. Category Tabs handler
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCategory = tab.getAttribute('data-category');
      renderNews();
    });
  });

  // 7. Comments Storage Helpers
  function getComments(articleId) {
    try {
      return JSON.parse(localStorage.getItem(`fighthub_comments_${articleId}`)) || [];
    } catch {
      return [];
    }
  }

  function getCommentCount(articleId) {
    return getComments(articleId).length;
  }

  function saveComment(articleId, comment) {
    const comments = getComments(articleId);
    comments.push(comment);
    localStorage.setItem(`fighthub_comments_${articleId}`, JSON.stringify(comments));
  }

  // 8. Open Article Detail Modal
  window.openArticleModal = (id) => {
    const art = allArticles.find(a => a.id === id);
    if (!art) return;

    const isLiked = dataStore.isLiked(art.id);
    const likeDisplayCount = (art.likes || 0) + (isLiked ? 1 : 0);
    const comments = getComments(art.id);

    document.getElementById('modal-article-title').innerText = (art.category || 'Latest') + ' News';
    
    // Render Modal Body Content
    const modalBody = document.getElementById('modal-article-body');
    modalBody.innerHTML = `
      <div style="display:flex; flex-direction:column; gap: var(--space-lg);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <span class="badge badge-accent">${escapeHtml(art.category)}</span>
          <div style="color:var(--text-muted); font-size:0.85rem;">
            Published: <strong>${formatDate(art.date)}</strong> &nbsp;|&nbsp; By <strong>${escapeHtml(art.author)}</strong>
          </div>
        </div>

        <h1 style="font-size:2rem; line-height:1.2; font-family:var(--font-body); font-weight:800;">${escapeHtml(art.title)}</h1>
        
        <!-- Placeholder banner in modal -->
        <div style="width:100%; height:280px; background:linear-gradient(135deg, #161616 0%, #2a2a2a 100%); border-radius:var(--radius-md); display:flex; align-items:center; justify-content:center; font-size:5rem;">
          📰
        </div>

        <div style="font-size:1.05rem; line-height:1.8; color:var(--text-secondary); white-space:pre-line;">${escapeHtml(art.content)}</div>

        ${art.sourceUrl ? `
        <p style="font-size:0.9rem; color:var(--text-muted); margin:0;">
          ${art.isAIPreview ? 'AI-assisted rewrite. ' : ''}Original story: <a href="${safeUrl(art.sourceUrl, '#')}" target="_blank" rel="noopener">${escapeHtml(art.sourceName || 'source')}</a>
        </p>` : ''}

        <!-- Tags -->
        <div style="display:flex; gap:8px; flex-wrap:wrap; border-top:1px solid var(--border-color); padding-top:15px; margin-top:10px;">
          ${(art.tags || []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>

        <!-- Actions in Modal -->
        <div style="display:flex; gap:20px; align-items:center; border-top:1px solid var(--border-color); border-bottom:1px solid var(--border-color); padding: 15px 0;">
          <button id="modal-like-btn" class="article-action-btn like-btn ${isLiked ? 'liked' : ''}" style="font-size: 1rem;">
            <span>${isLiked ? '❤️' : '🤍'}</span> <span class="modal-like-count">${likeDisplayCount}</span> Likes
          </button>
          <span style="color:var(--text-muted); font-size:0.9rem;">
            💬 <span id="modal-comments-count">${comments.length}</span> Comments
          </span>
        </div>

        <!-- Comments Section -->
        <div>
          <h3 style="margin-bottom:15px; font-family:var(--font-body); font-weight:700; font-size:1.2rem;">Discussion</h3>
          
          <!-- Comments List -->
          <div id="comments-list" style="display:flex; flex-direction:column; gap:12px; margin-bottom:25px;">
            ${renderCommentsList(comments)}
          </div>

          <!-- Add Comment Form -->
          <form id="comment-form" style="display:grid; gap:10px; background:var(--bg-glass); border:1px solid var(--bg-glass-border); padding:20px; border-radius:var(--radius-md);">
            <h4 style="font-family:var(--font-body); font-weight:600; font-size:0.95rem; margin-bottom:5px;">Join the conversation</h4>
            <div style="display:grid; grid-template-columns: 1fr 2fr; gap:10px;">
              <input type="text" id="comment-author" placeholder="Your name" required style="height:40px;">
              <input type="text" id="comment-text" placeholder="Share your thoughts..." required style="height:40px;">
            </div>
            <button type="submit" class="btn btn-primary btn-sm" style="justify-self:end; height:40px; padding: 0 20px;">Post Comment</button>
          </form>
        </div>
      </div>
    `;

    // Modal Like click handler
    const modalLikeBtn = document.getElementById('modal-like-btn');
    modalLikeBtn.addEventListener('click', () => {
      const isLikedNow = dataStore.toggleLike(art.id);
      modalLikeBtn.classList.toggle('liked', isLikedNow);
      modalLikeBtn.querySelector('span:first-child').innerText = isLikedNow ? '❤️' : '🤍';
      
      const newCount = (art.likes || 0) + (isLikedNow ? 1 : 0);
      modalLikeBtn.querySelector('.modal-like-count').innerText = newCount;
      
      // Sync on main page grid/featured
      document.querySelectorAll(`.like-btn[data-id="${CSS.escape(art.id)}"]`).forEach(otherBtn => {
        otherBtn.classList.toggle('liked', isLikedNow);
        otherBtn.querySelector('span:first-child').innerText = isLikedNow ? '❤️' : '🤍';
        otherBtn.querySelector('.like-count').innerText = newCount;
      });

    });

    // Form Comment submit handler
    const form = document.getElementById('comment-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const authorInput = document.getElementById('comment-author');
      const textInput = document.getElementById('comment-text');
      
      const newComment = {
        author: authorInput.value.trim(),
        text: textInput.value.trim(),
        date: new Date().toISOString()
      };

      saveComment(art.id, newComment);
      
      // Update Modal Comments View
      const updatedComments = getComments(art.id);
      document.getElementById('comments-list').innerHTML = renderCommentsList(updatedComments);
      document.getElementById('modal-comments-count').innerText = updatedComments.length;
      
      // Reset inputs
      authorInput.value = '';
      textInput.value = '';

      showToast('Comment posted!', 'success');

      // Sync comment count display on original cards/featured
      renderNews(); 
    });

    modal.classList.add('active');
    modalBackdrop.classList.add('active');
  };

  function renderCommentsList(comments) {
    if (comments.length === 0) {
      return `<p style="font-size:0.9rem; color:var(--text-muted); font-style:italic;">No comments yet. Be the first to share your thoughts!</p>`;
    }
    return comments.map(c => `
      <div style="background:var(--bg-card); border:1px solid var(--border-color); padding:12px 15px; border-radius:var(--radius-sm);">
        <div style="display:flex; justify-content:between; align-items:center; font-size:0.8rem; margin-bottom:4px;">
          <strong class="text-accent">${escapeHtml(c.author)}</strong>
          <span style="color:var(--text-muted); margin-left:auto;">${formatRelativeTime(c.date)}</span>
        </div>
        <p style="font-size:0.9rem; margin-bottom:0; color:var(--text-secondary); line-height:1.4;">${escapeHtml(c.text)}</p>
      </div>
    `).join('');
  }

  const closeModal = () => {
    modal.classList.remove('active');
    modalBackdrop.classList.remove('active');
  };

  modalClose.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', closeModal);

  // Helper date formatter
  function formatDate(dateStr) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return parseLocalDate(dateStr).toLocaleDateString(undefined, options);
  }

  function formatRelativeTime(dateStr) {
    const elapsed = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(elapsed / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return formatDate(dateStr);
  }
});
