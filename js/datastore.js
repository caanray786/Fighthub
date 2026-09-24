/* ============================================
   FightHub — DataStore
   Central data layer. Two modes:
   - Cloud: Supabase (shared by every visitor), enabled when js/config.js
     has a Supabase URL and anon key.
   - Local: IndexedDB in this browser only (development / offline demo).
   ============================================ */

// Store name (used throughout the front end) -> Supabase table name
const CLOUD_TABLES = {
  fighters: 'fighters',
  articles: 'articles',
  events: 'events',
  rankings: 'rankings',
  gyms: 'gyms',
  martialArts: 'martial_arts',
  training: 'training_plans'
};

class FightHubDataStore {
  constructor() {
    this.dbName = 'FightHubDB';
    this.dbVersion = 1;
    this.db = null;
    this.supabaseClient = null;
    this.stores = ['fighters', 'articles', 'events', 'rankings', 'gyms', 'martialArts', 'training'];
    this.listeners = {};

    const config = window.FIGHTHUB_CONFIG || {};
    this.cloud = !!(config.supabaseUrl && config.supabaseAnonKey);
    this.config = config;

    this.dbOpen = this.cloud ? this._initCloud() : this._initDB();
    // Seeding and seed upgrades only apply to the local database; the cloud
    // database is seeded once from supabase/seed.sql.
    this.ready = this.cloud ? this.dbOpen : this.dbOpen.then(() => this.seedIfEmpty());
  }

  get mode() {
    return this.cloud ? 'cloud' : 'local';
  }

  // ---- Initialisation ---- //
  async _loadSupabaseSDK() {
    if (window.supabase) return true;
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  async _initCloud() {
    const loaded = await this._loadSupabaseSDK();
    if (!loaded || !window.supabase) {
      throw new Error('Could not load the Supabase client library.');
    }
    this.supabaseClient = window.supabase.createClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
  }

  _initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        this.stores.forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'id' });
            store.createIndex('createdAt', 'createdAt', { unique: false });
            if (storeName === 'fighters') {
              store.createIndex('weightClass', 'weightClass', { unique: false });
              store.createIndex('status', 'status', { unique: false });
            }
            if (storeName === 'articles') {
              store.createIndex('category', 'category', { unique: false });
              store.createIndex('status', 'status', { unique: false });
            }
            if (storeName === 'events') {
              store.createIndex('date', 'date', { unique: false });
              store.createIndex('promotion', 'promotion', { unique: false });
            }
            if (storeName === 'gyms') {
              store.createIndex('city', 'city', { unique: false });
            }
          }
        });
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error('IndexedDB error:', e.target.error);
        reject(e.target.error);
      };
    });
  }

  // ---- Cloud helpers ---- //
  _table(storeName) {
    const table = CLOUD_TABLES[storeName];
    if (!table) throw new Error(`Unknown store: ${storeName}`);
    return this.supabaseClient.from(table);
  }

  // Each cloud row is { id, doc } where doc holds the full record as JSON
  _fromRow(row) {
    return row ? { ...row.doc, id: row.id } : null;
  }

  _toRow(item) {
    return { id: item.id, doc: item };
  }

  _stamp(item) {
    const now = new Date().toISOString();
    if (!item.id) item.id = this._generateId();
    if (!item.createdAt) item.createdAt = now;
    item.updatedAt = now;
    return item;
  }

  // ---- CRUD Operations ---- //
  async getAll(storeName) {
    await this.dbOpen;
    if (this.cloud) {
      try {
        // PostgREST caps responses at 1000 rows, so page through
        const pageSize = 1000;
        const all = [];
        for (let from = 0; ; from += pageSize) {
          const { data, error } = await this._table(storeName).select('id, doc').order('id').range(from, from + pageSize - 1);
          if (error) throw error;
          all.push(...data.map(row => this._fromRow(row)));
          if (data.length < pageSize) break;
        }
        return all;
      } catch (err) {
        // If the database is unreachable (e.g. a paused free-tier project),
        // fall back to the bundled starter content rather than a blank page.
        console.error(`Cloud read failed for ${storeName}; showing bundled content.`, err);
        return typeof DEFAULT_DATA !== 'undefined' && Array.isArray(DEFAULT_DATA[storeName])
          ? DEFAULT_DATA[storeName].map(item => ({ ...item }))
          : [];
      }
    }
    return new Promise((resolve, reject) => {
      const request = this.db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Only the named fields of every record (plus id): keeps list pages light
  // once there are thousands of records. Full records come from getById.
  async getSummaries(storeName, fields) {
    await this.dbOpen;
    if (!this.cloud) {
      const all = await this.getAll(storeName);
      return all.map(item => Object.fromEntries([['id', item.id], ...fields.map(f => [f, item[f]])]));
    }
    try {
      const select = ['id', ...fields.map(f => `${f}:doc->${f}`)].join(',');
      const all = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await this._table(storeName).select(select).order('id').range(from, from + 999);
        if (error) throw error;
        all.push(...data);
        if (data.length < 1000) break;
      }
      return all;
    } catch (err) {
      console.error(`Cloud read failed for ${storeName}; showing bundled content.`, err);
      return (typeof DEFAULT_DATA !== 'undefined' && DEFAULT_DATA[storeName] || [])
        .map(item => Object.fromEntries([['id', item.id], ...fields.map(f => [f, item[f]])]));
    }
  }

  // Clubs added on FightHub (not imported) plus featured ones: small list for the clubs page
  async ownAndFeaturedGyms() {
    await this.dbOpen;
    if (!this.cloud) {
      return (await this.getAll('gyms')).filter(g => g.source !== 'OpenStreetMap' || g.featured);
    }
    const { data, error } = await this._table('gyms').select('id, doc')
      .or('doc->>source.is.null,doc->>featured.eq.true')
      .limit(200);
    if (error) throw error;
    return data.map(row => this._fromRow(row));
  }

  // Nearest clubs to a point (distance in km), featured clubs first
  async gymsNear(lat, lng, radiusKm = 25, style = null) {
    await this.dbOpen;
    if (this.cloud) {
      const { data, error } = await this.supabaseClient.rpc('gyms_near', {
        p_lat: lat, p_lng: lng, p_km: radiusKm, p_style: style, p_limit: 150
      });
      if (error) throw error;
      return data.map(row => ({ ...row.doc, id: row.id, distanceKm: row.distance_km }));
    }
    const toRad = d => d * Math.PI / 180;
    const dist = (g) => 6371 * 2 * Math.asin(Math.sqrt(
      Math.sin(toRad(g.lat - lat) / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(g.lat)) * Math.sin(toRad(g.lng - lng) / 2) ** 2));
    return (await this.getAll('gyms'))
      .filter(g => Number.isFinite(g.lat) && Number.isFinite(g.lng) && (!style || (g.styles || []).includes(style)))
      .map(g => ({ ...g, distanceKm: dist(g) }))
      .filter(g => g.distanceKm <= radiusKm)
      .sort((a, b) => (!!b.featured - !!a.featured) || a.distanceKm - b.distanceKm);
  }

  // Records whose field equals a value, e.g. query('fighters', 'draft', true)
  async query(storeName, field, value) {
    await this.dbOpen;
    if (!this.cloud) {
      return (await this.getAll(storeName)).filter(item => item[field] === value);
    }
    const { data, error } = await this._table(storeName).select('id, doc').eq(`doc->>${field}`, String(value));
    if (error) throw error;
    return data.map(row => this._fromRow(row));
  }

  async getById(storeName, id) {
    await this.dbOpen;
    if (this.cloud) {
      const { data, error } = await this._table(storeName).select('id, doc').eq('id', id).maybeSingle();
      if (error) throw error;
      return this._fromRow(data);
    }
    return new Promise((resolve, reject) => {
      const request = this.db.transaction(storeName, 'readonly').objectStore(storeName).get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getByIndex(storeName, indexName, value) {
    await this.dbOpen;
    if (this.cloud) {
      const { data, error } = await this._table(storeName).select('id, doc').eq(`doc->>${indexName}`, value);
      if (error) throw error;
      return data.map(row => this._fromRow(row));
    }
    return new Promise((resolve, reject) => {
      const request = this.db.transaction(storeName, 'readonly').objectStore(storeName).index(indexName).getAll(value);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async add(storeName, item) {
    await this.dbOpen;
    this._stamp(item);

    if (this.cloud) {
      const { error } = await this._table(storeName).insert(this._toRow(item));
      if (error) throw error;
    } else {
      await new Promise((resolve, reject) => {
        const request = this.db.transaction(storeName, 'readwrite').objectStore(storeName).add(item);
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });
    }
    this._logActivity('add', storeName, item);
    this._emit(storeName, 'add', item);
    return item;
  }

  // Merges into the stored record, so fields an edit form doesn't show
  // (source links, AI tags, createdAt, ...) are kept rather than wiped.
  async update(storeName, changes) {
    await this.dbOpen;
    const existing = changes.id ? await this.getById(storeName, changes.id) : null;
    const item = this._stamp({ ...(existing || {}), ...changes });

    if (this.cloud) {
      const { error } = await this._table(storeName).upsert(this._toRow(item));
      if (error) throw error;
    } else {
      await new Promise((resolve, reject) => {
        const request = this.db.transaction(storeName, 'readwrite').objectStore(storeName).put(item);
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });
    }
    this._logActivity('edit', storeName, item);
    this._emit(storeName, 'update', item);
    return item;
  }

  // Insert or replace by id. Used by the pipelines so re-runs don't duplicate records.
  async upsert(storeName, item) {
    await this.dbOpen;
    this._stamp(item);

    if (this.cloud) {
      const { error } = await this._table(storeName).upsert(this._toRow(item));
      if (error) throw error;
    } else {
      await new Promise((resolve, reject) => {
        const request = this.db.transaction(storeName, 'readwrite').objectStore(storeName).put(item);
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });
    }
    this._emit(storeName, 'update', item);
    return item;
  }

  async delete(storeName, id) {
    await this.dbOpen;
    const item = await this.getById(storeName, id);
    if (!item) return;

    if (this.cloud) {
      const { error } = await this._table(storeName).delete().eq('id', id);
      if (error) throw error;
    } else {
      await new Promise((resolve, reject) => {
        const request = this.db.transaction(storeName, 'readwrite').objectStore(storeName).delete(id);
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });
    }
    this._logActivity('delete', storeName, item);
    this._emit(storeName, 'delete', { id });
    return id;
  }

  async deleteMany(storeName, ids) {
    await this.dbOpen;
    if (this.cloud) {
      const { error } = await this._table(storeName).delete().in('id', ids);
      if (error) throw error;
    } else {
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        ids.forEach(id => store.delete(id));
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    }
    this._logActivity('delete', storeName, { count: ids.length });
    this._emit(storeName, 'deleteMany', { ids });
    return ids;
  }

  async count(storeName) {
    await this.dbOpen;
    if (this.cloud) {
      const { count, error } = await this._table(storeName).select('id', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    }
    return new Promise((resolve, reject) => {
      const request = this.db.transaction(storeName, 'readonly').objectStore(storeName).count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName) {
    await this.dbOpen;
    if (this.cloud) {
      const { error } = await this._table(storeName).delete().not('id', 'is', null);
      if (error) throw error;
    } else {
      await new Promise((resolve, reject) => {
        const request = this.db.transaction(storeName, 'readwrite').objectStore(storeName).clear();
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });
    }
    this._emit(storeName, 'clear');
  }

  // Insert-or-replace many records in a single request/transaction
  async bulkUpsert(storeName, items) {
    await this.dbOpen;
    items.forEach(item => this._stamp(item));

    if (this.cloud) {
      const { error } = await this._table(storeName).upsert(items.map(item => this._toRow(item)));
      if (error) throw error;
      return items;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      items.forEach(item => store.put(item));
      tx.oncomplete = () => resolve(items);
      tx.onerror = () => reject(tx.error);
    });
  }

  // Kept for callers that used the old name
  async bulkAdd(storeName, items) {
    return this.bulkUpsert(storeName, items);
  }

  // ---- AI worker (cloud only) ---- //
  async getAiRuns(limit = 10) {
    await this.dbOpen;
    if (!this.cloud) return [];
    const { data, error } = await this.supabaseClient
      .from('ai_runs')
      .select('id, started_at, finished_at, ok, summary, log')
      .order('started_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  }

  // ---- API keys (local only) ---- //
  // Secrets are never written to the database: anything the browser can read,
  // a visitor can read too. From Phase 2 the OpenRouter key lives in Supabase
  // secrets and is used only by the server-side pipeline.
  async saveSecureKey(keyName, value) {
    try {
      localStorage.setItem('fh_sec_' + keyName, btoa(encodeURIComponent(value)));
    } catch (e) {
      localStorage.setItem('fh_sec_' + keyName, value);
    }
  }

  async getSecureKey(keyName) {
    const raw = localStorage.getItem('fh_sec_' + keyName) || localStorage.getItem('fighthub_' + keyName + '_key');
    if (!raw) return '';
    try {
      return decodeURIComponent(atob(raw));
    } catch (e) {
      return raw;
    }
  }

  // ---- Search ---- //
  async search(storeName, query, fields) {
    const all = await this.getAll(storeName);
    const q = query.toLowerCase().trim();
    if (!q) return all;

    return all.filter(item => fields.some(field => {
      const value = item[field];
      if (typeof value === 'string') return value.toLowerCase().includes(q);
      if (Array.isArray(value)) return value.some(v => String(v).toLowerCase().includes(q));
      return false;
    }));
  }

  // ---- Data Export/Import ---- //
  async exportAll() {
    const data = {};
    for (const storeName of this.stores) {
      data[storeName] = await this.getAll(storeName);
    }
    data.settings = this.getSettings();
    data.exportDate = new Date().toISOString();
    data.version = '1.0';
    return data;
  }

  async importAll(data) {
    for (const storeName of this.stores) {
      if (data[storeName] && Array.isArray(data[storeName])) {
        await this.clear(storeName);
        await this.bulkUpsert(storeName, data[storeName]);
      }
    }
    if (data.settings) {
      this.saveSettings(data.settings);
    }
  }

  downloadExport(data) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fighthub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- Settings (localStorage) ---- //
  getSettings() {
    try {
      return JSON.parse(localStorage.getItem('fighthub_settings')) || {};
    } catch {
      return {};
    }
  }

  saveSettings(settings) {
    localStorage.setItem('fighthub_settings', JSON.stringify(settings));
  }

  getSetting(key, defaultValue) {
    const settings = this.getSettings();
    return settings[key] !== undefined ? settings[key] : defaultValue;
  }

  setSetting(key, value) {
    const settings = this.getSettings();
    settings[key] = value;
    this.saveSettings(settings);
  }

  // ---- Theme ---- //
  getTheme() {
    return localStorage.getItem('fighthub_theme') || 'dark';
  }

  setTheme(theme) {
    localStorage.setItem('fighthub_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }

  // ---- Favorites (localStorage) ---- //
  getFavorites() {
    try {
      return JSON.parse(localStorage.getItem('fighthub_favorites')) || [];
    } catch {
      return [];
    }
  }

  toggleFavorite(fighterId) {
    const favorites = this.getFavorites();
    const index = favorites.indexOf(fighterId);
    if (index > -1) {
      favorites.splice(index, 1);
    } else {
      favorites.push(fighterId);
    }
    localStorage.setItem('fighthub_favorites', JSON.stringify(favorites));
    return favorites.includes(fighterId);
  }

  isFavorite(fighterId) {
    return this.getFavorites().includes(fighterId);
  }

  // ---- Article Likes (localStorage) ---- //
  getArticleLikes() {
    try {
      return JSON.parse(localStorage.getItem('fighthub_likes')) || {};
    } catch {
      return {};
    }
  }

  toggleLike(articleId) {
    const likes = this.getArticleLikes();
    likes[articleId] = !likes[articleId];
    localStorage.setItem('fighthub_likes', JSON.stringify(likes));
    return likes[articleId];
  }

  isLiked(articleId) {
    return this.getArticleLikes()[articleId] || false;
  }

  // ---- Admin Auth ---- //
  // Cloud: Supabase Auth (email + password) plus membership of public.admins.
  // Local: legacy browser-only password, for development without Supabase.

  async signInAdmin(email, password) {
    await this.dbOpen;
    if (this.cloud) {
      const { error } = await this.supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw new Error('Incorrect email or password.');
      if (!(await this._checkIsAdmin())) {
        await this.supabaseClient.auth.signOut();
        throw new Error('This account does not have admin access.');
      }
      return true;
    }
    if (!this._verifyLocalPassword(password)) throw new Error('Incorrect password.');
    localStorage.setItem('fighthub_admin_session', JSON.stringify({
      loggedIn: true,
      expiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }));
    return true;
  }

  async isAdminSignedIn() {
    await this.dbOpen;
    if (this.cloud) {
      const { data } = await this.supabaseClient.auth.getSession();
      return !!data.session && this._checkIsAdmin();
    }
    try {
      const session = JSON.parse(localStorage.getItem('fighthub_admin_session'));
      return !!session && new Date(session.expiry) > new Date();
    } catch {
      return false;
    }
  }

  async getAdminEmail() {
    if (!this.cloud) return null;
    const { data } = await this.supabaseClient.auth.getUser();
    return data.user ? data.user.email : null;
  }

  async signOutAdmin() {
    await this.dbOpen;
    if (this.cloud) {
      await this.supabaseClient.auth.signOut();
    }
    localStorage.removeItem('fighthub_admin_session');
  }

  async changeAdminPassword(currentPassword, newPassword) {
    await this.dbOpen;
    if (this.cloud) {
      const email = await this.getAdminEmail();
      const { error: authError } = await this.supabaseClient.auth.signInWithPassword({ email, password: currentPassword });
      if (authError) throw new Error('Current password is incorrect.');
      const { error } = await this.supabaseClient.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
      return;
    }
    if (!this._verifyLocalPassword(currentPassword)) throw new Error('Current password is incorrect.');
    localStorage.setItem('fighthub_admin_hash', this._hashPassword(newPassword));
  }

  async _checkIsAdmin() {
    const { data, error } = await this.supabaseClient.rpc('is_admin');
    return !error && data === true;
  }

  _verifyLocalPassword(password) {
    const stored = localStorage.getItem('fighthub_admin_hash') || this._hashPassword('fighthub2024');
    return this._hashPassword(password) === stored;
  }

  _hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      hash = ((hash << 5) - hash) + password.charCodeAt(i);
      hash = hash & hash;
    }
    return 'fh_' + Math.abs(hash).toString(36);
  }

  // ---- Activity Log (this browser only) ---- //
  _logActivity(action, collection, item) {
    try {
      const log = this.getActivityLog();
      log.unshift({
        action,
        collection,
        itemName: item?.name || item?.title || item?.id || 'Unknown',
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('fighthub_activity', JSON.stringify(log.slice(0, 50)));
    } catch (e) {
      console.warn('Activity log error:', e);
    }
  }

  getActivityLog() {
    try {
      return JSON.parse(localStorage.getItem('fighthub_activity')) || [];
    } catch {
      return [];
    }
  }

  clearActivityLog() {
    localStorage.setItem('fighthub_activity', '[]');
  }

  // ---- Event System ---- //
  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  _emit(collection, action, data) {
    const event = `${collection}:${action}`;
    (this.listeners[event] || []).forEach(cb => cb(data));
    (this.listeners[collection] || []).forEach(cb => cb(action, data));
    (this.listeners['*'] || []).forEach(cb => cb(collection, action, data));
  }

  // ---- Seed Data (local mode) ---- //
  async seedIfEmpty() {
    const fighterCount = await this.count('fighters');
    if (fighterCount === 0) {
      console.log('Seeding default data...');
      await this._seedDefaults();
      console.log('Default data seeded successfully!');
    } else {
      await this._upgradeSeed();
    }
    if (typeof DEFAULT_DATA_VERSION !== 'undefined') {
      localStorage.setItem('fighthub_seed_version', String(DEFAULT_DATA_VERSION));
    }
  }

  // Brings an existing local database up to the current seed version without
  // touching records the admin created.
  async _upgradeSeed() {
    if (typeof DEFAULT_DATA === 'undefined' || typeof DEFAULT_DATA_VERSION === 'undefined') return;
    const stored = parseInt(localStorage.getItem('fighthub_seed_version') || '1', 10);
    if (stored >= DEFAULT_DATA_VERSION) return;

    console.log(`Upgrading seed data v${stored} -> v${DEFAULT_DATA_VERSION}...`);
    for (const storeName of this.stores) {
      const existing = new Map((await this.getAll(storeName)).map(item => [item.id, item]));

      const removed = (REMOVED_SEED_IDS[storeName] || []).filter(id => existing.has(id));
      if (removed.length) await this.deleteMany(storeName, removed);

      const defaults = DEFAULT_DATA[storeName];
      if (!Array.isArray(defaults)) continue;
      const replace = SEED_REPLACE_STORES.includes(storeName);
      const merged = defaults.map(item => {
        const current = existing.get(item.id);
        return !current || replace ? { ...item } : { ...item, ...current };
      });
      await this.bulkUpsert(storeName, merged);
    }
  }

  async _seedDefaults() {
    if (typeof DEFAULT_DATA === 'undefined') {
      console.warn('Default data not loaded');
      return;
    }
    for (const [storeName, items] of Object.entries(DEFAULT_DATA)) {
      if (this.stores.includes(storeName) && Array.isArray(items)) {
        await this.bulkUpsert(storeName, items.map(item => ({ ...item })));
      }
    }
  }

  async resetToDefaults() {
    for (const storeName of this.stores) {
      await this.clear(storeName);
    }
    await this._seedDefaults();
    this.clearActivityLog();
  }

  // ---- Utilities ---- //
  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }
}

// ---- Shared helpers (datastore.js is loaded on every page) ---- //

// Escape text before interpolating it into an innerHTML template. Content can come
// from RSS feeds, the AI pipeline or admin input, so it must never be trusted as HTML.
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Only allow http(s) and site-relative URLs in href/src attributes.
function safeUrl(value, fallback = '') {
  if (!value) return fallback;
  const url = String(value).trim();
  if (/^https?:\/\//i.test(url) || /^[\w./-]+$/.test(url)) {
    return escapeHtml(url);
  }
  return fallback;
}

// 'YYYY-MM-DD' strings parse as UTC midnight with new Date(), which shows the
// previous day in the Americas. Parse them as local dates instead.
function parseLocalDate(dateStr) {
  if (!dateStr) return new Date(NaN);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(dateStr);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

window.escapeHtml = escapeHtml;
window.safeUrl = safeUrl;
window.parseLocalDate = parseLocalDate;
window.todayStr = todayStr;

// Global instance
const dataStore = new FightHubDataStore();
window.dataStore = dataStore;
