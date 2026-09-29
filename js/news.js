/* ============================================
   FightHub — News JS
   Lead story + top headlines, category filter, story list,
   likes, comments and the article reader (news.html?id=… opens a story).
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await dataStore.ready;

  const topEl = document.getElementById('news-top');
  const filtersEl = document.getElementById('news-filters');
  const listEl = document.getElementById('story-list');
  const moreBtn = document.getElementById('load-more');

  const modal = document.getElementById('news-modal');
  const modalBackdrop = document.getElementById('news-modal-backdrop');
  const modalClose = document.getElementById('modal-article-close');

  const PAGE_SIZE = 18;
  const CATEGORY_LABELS = { ONE: 'ONE Championship', General: 'General' };
  const label = cat => CATEGORY_LABELS[cat] || cat || 'News';
  const likeIcon = liked => icon('heart', liked ? 'icon-filled' : '');

  let allArticles = [];
  let imageFor = () => ({ src: 'images/martial-arts/mma.jpg' });
  let currentCategory = new URLSearchParams(location.search).get('category') || 'All';
  let shown = PAGE_SIZE;

  const storyLink = art => `news.html?id=${encodeURIComponent(art.id)}`;
  const leadBackground = art => {
    const img = imageFor(art);
    return `background-image: linear-gradient(to top, rgba(8,8,11,0.95) 10%, rgba(8,8,11,0.25) 65%), ${cssUrl(img.src)};`
      + (img.fighter ? ' background-position: center 25%;' : '');
  };

  // 1. Fetch data
  try {
    const [articles, fighters] = await Promise.all([
      dataStore.getAll('articles'),
      dataStore.getSummaries('fighters', ['name', 'image', 'imageCredit', 'imageSourceUrl', 'draft'])
    ]);
    allArticles = articles.filter(a => a.status !== 'draft' && !a.draft);
    allArticles.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    imageFor = articleImageFinder(fighters);

    renderTop();
    renderFilters();
    renderList();

  } catch (err) {
    console.error('Error loading articles:', err);
    topEl.innerHTML = '<p class="text-accent">Error loading articles.</p>';
  }

  // 2. Lead story + the next five headlines
  function renderTop() {
    if (!allArticles.length) {
      topEl.innerHTML = '<p style="color: var(--text-muted);">No stories yet. Check back soon.</p>';
      return;
    }
    const [lead, ...rest] = allArticles;
    topEl.innerHTML = `
      <a class="news-lead" href="${storyLink(lead)}" data-open-article="${escapeHtml(lead.id)}" style="${leadBackground(lead)}">
        <span class="badge badge-accent">${escapeHtml(label(lead.category))}</span>
        <h3>${escapeHtml(lead.title)}</h3>
        <p>${escapeHtml(lead.excerpt || (lead.content || '').slice(0, 180))}</p>
        <small>${escapeHtml(formatDate(lead.date))}${lead.sourceName ? ` · via ${escapeHtml(lead.sourceName)}` : ''}</small>
      </a>
      <ul class="news-list">
        ${rest.slice(0, 5).map(a => `
          <li><a href="${storyLink(a)}" data-open-article="${escapeHtml(a.id)}">
            <small>${escapeHtml(label(a.category))} · ${escapeHtml(formatDate(a.date))}</small>
            <strong>${escapeHtml(a.title)}</strong>
          </a></li>`).join('')}
      </ul>`;
  }

  // 3. Category chips, built from the categories that actually have stories
  function renderFilters() {
    const counts = {};
    allArticles.forEach(a => { counts[a.category] = (counts[a.category] || 0) + 1; });
    const cats = Object.keys(counts).filter(Boolean).sort((a, b) => counts[b] - counts[a]);
    if (currentCategory !== 'All' && !counts[currentCategory]) currentCategory = 'All';

    filtersEl.innerHTML = [['All', allArticles.length], ...cats.map(c => [c, counts[c]])].map(([cat, n]) => `
      <button type="button" class="chip ${cat === currentCategory ? 'active' : ''}" data-category="${escapeHtml(cat)}">
        ${escapeHtml(cat === 'All' ? 'All news' : label(cat))} <span>${n}</span>
      </button>`).join('');

    filtersEl.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => {
      currentCategory = chip.dataset.category;
      shown = PAGE_SIZE;
      filtersEl.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
      renderList();
    }));
  }

  // 4. Story list (the top six are already shown above when viewing everything)
  function renderList() {
    const stories = currentCategory === 'All'
      ? allArticles.slice(6)
      : allArticles.filter(a => a.category === currentCategory);

    if (!stories.length) {
      listEl.innerHTML = '<p style="color: var(--text-muted); padding: var(--space-lg) 0;">No more stories in this category yet.</p>';
      moreBtn.hidden = true;
      return;
    }

    listEl.innerHTML = stories.slice(0, shown).map(art => {
      const img = imageFor(art);
      return `
        <a class="story" href="${storyLink(art)}" data-open-article="${escapeHtml(art.id)}">
          <img class="story-thumb" src="${safeUrl(img.src)}" alt="" loading="lazy"${img.fighter ? ' style="object-position: center 25%;"' : ''}>
          <div class="story-body">
            <small>${escapeHtml(label(art.category))} · ${escapeHtml(formatDate(art.date))}</small>
            <strong>${escapeHtml(art.title)}</strong>
            <p>${escapeHtml(art.excerpt || '')}</p>
            ${art.sourceName ? `<span class="story-source">via ${escapeHtml(art.sourceName)}</span>` : ''}
          </div>
        </a>`;
    }).join('');

    moreBtn.hidden = stories.length <= shown;
  }

  moreBtn.addEventListener('click', () => {
    shown += PAGE_SIZE;
    renderList();
  });

  // Open a story from any link tagged with data-open-article (new-tab clicks still work)
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-open-article]');
    if (!trigger || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    openArticleModal(trigger.getAttribute('data-open-article'));
  });

  // 5. Comments (kept in this browser only)
  function getComments(articleId) {
    try {
      return JSON.parse(localStorage.getItem(`fighthub_comments_${articleId}`)) || [];
    } catch {
      return [];
    }
  }

  function saveComment(articleId, comment) {
    const comments = getComments(articleId);
    comments.push(comment);
    try {
      localStorage.setItem(`fighthub_comments_${articleId}`, JSON.stringify(comments));
    } catch { /* storage unavailable */ }
  }

  // 6. Article reader
  window.openArticleModal = (id) => {
    const art = allArticles.find(a => a.id === id);
    if (!art) return;

    const isLiked = dataStore.isLiked(art.id);
    const likeDisplayCount = (art.likes || 0) + (isLiked ? 1 : 0);
    const comments = getComments(art.id);
    const img = imageFor(art);

    document.getElementById('modal-article-title').innerText = `${label(art.category)} News`;

    const modalBody = document.getElementById('modal-article-body');
    modalBody.innerHTML = `
      <article class="article-reader">
        <div class="article-reader-meta">
          <span class="badge badge-accent">${escapeHtml(label(art.category))}</span>
          <span>${escapeHtml(formatDate(art.date))}${art.author ? ` · By ${escapeHtml(art.author)}` : ''}</span>
        </div>

        <h1>${escapeHtml(art.title)}</h1>

        <figure class="article-figure">
          <img src="${safeUrl(img.src)}" alt=""${img.fighter ? ' style="object-position: center 25%;"' : ''}>
          ${img.credit ? `<figcaption>${img.fighter ? `${escapeHtml(img.fighter.name)}. ` : ''}Photo: ${img.sourceUrl ? `<a href="${safeUrl(img.sourceUrl, '#')}" target="_blank" rel="noopener">${escapeHtml(img.credit)}</a>` : escapeHtml(img.credit)}</figcaption>` : ''}
        </figure>

        <div class="article-text">${escapeHtml(art.content)}</div>

        ${art.sourceUrl ? `
        <p class="article-source">
          ${art.isAIPreview ? 'AI-assisted rewrite. ' : ''}Original story: <a href="${safeUrl(art.sourceUrl, '#')}" target="_blank" rel="noopener">${escapeHtml(art.sourceName || 'source')}</a>
        </p>` : ''}

        ${img.fighter ? `<a class="btn btn-secondary btn-sm" href="fighters.html?q=${encodeURIComponent(img.fighter.name)}">${escapeHtml(img.fighter.name)}: fighter profile →</a>` : ''}

        ${(art.tags || []).length ? `<div class="article-tags">${art.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}

        <div class="article-reader-actions">
          <button id="modal-like-btn" class="article-action-btn like-btn ${isLiked ? 'liked' : ''}">
            <span>${likeIcon(isLiked)}</span> <span class="modal-like-count">${likeDisplayCount}</span> Likes
          </button>
          <span>${icon('message')} <span id="modal-comments-count">${comments.length}</span> Comments</span>
        </div>

        <div>
          <h3 class="article-reader-subhead">Discussion</h3>
          <div id="comments-list" class="comments-list">${renderCommentsList(comments)}</div>
          <form id="comment-form" class="comment-form">
            <h4>Join the conversation</h4>
            <div class="comment-form-fields">
              <input type="text" id="comment-author" placeholder="Your name" required>
              <input type="text" id="comment-text" placeholder="Share your thoughts..." required>
            </div>
            <button type="submit" class="btn btn-primary btn-sm">Post Comment</button>
          </form>
        </div>
      </article>
    `;

    const modalLikeBtn = document.getElementById('modal-like-btn');
    modalLikeBtn.addEventListener('click', () => {
      const isLikedNow = dataStore.toggleLike(art.id);
      modalLikeBtn.classList.toggle('liked', isLikedNow);
      modalLikeBtn.querySelector('span:first-child').innerHTML = likeIcon(isLikedNow);
      modalLikeBtn.querySelector('.modal-like-count').innerText = (art.likes || 0) + (isLikedNow ? 1 : 0);
    });

    document.getElementById('comment-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const authorInput = document.getElementById('comment-author');
      const textInput = document.getElementById('comment-text');
      saveComment(art.id, {
        author: authorInput.value.trim(),
        text: textInput.value.trim(),
        date: new Date().toISOString()
      });
      const updated = getComments(art.id);
      document.getElementById('comments-list').innerHTML = renderCommentsList(updated);
      document.getElementById('modal-comments-count').innerText = updated.length;
      authorInput.value = '';
      textInput.value = '';
      showToast('Comment posted!', 'success');
    });

    // Shareable address for the open story
    history.replaceState(null, '', storyLink(art));
    modal.classList.add('active');
    modalBackdrop.classList.add('active');
    modal.scrollTop = 0;
  };

  function renderCommentsList(comments) {
    if (comments.length === 0) {
      return '<p class="comments-empty">No comments yet. Be the first to share your thoughts!</p>';
    }
    return comments.map(c => `
      <div class="comment">
        <div class="comment-head">
          <strong class="text-accent">${escapeHtml(c.author)}</strong>
          <span>${formatRelativeTime(c.date)}</span>
        </div>
        <p>${escapeHtml(c.text)}</p>
      </div>
    `).join('');
  }

  const closeModal = () => {
    modal.classList.remove('active');
    modalBackdrop.classList.remove('active');
    history.replaceState(null, '', 'news.html');
  };

  modalClose.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('active')) closeModal(); });

  // news.html?id=… opens that story straight away
  const openId = new URLSearchParams(location.search).get('id');
  if (openId) openArticleModal(openId);

  function formatDate(dateStr) {
    if (!dateStr) return '';
    return parseLocalDate(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function formatRelativeTime(dateStr) {
    const elapsed = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(elapsed / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return formatDate(dateStr.slice(0, 10));
  }
});
