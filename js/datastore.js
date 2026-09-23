/* ============================================
   FightHub — DataStore
   Central data management with localStorage + IndexedDB
   ============================================ */

class FightHubDataStore {
  constructor() {
    this.dbName = 'FightHubDB';
    this.dbVersion = 1;
    this.db = null;
    this.stores = ['fighters', 'articles', 'events', 'rankings', 'gyms', 'martialArts', 'training'];
    this.listeners = {};
    this.dbOpen = this._initDB();
    this.ready = this.dbOpen.then(() => this.seedIfEmpty());
  }



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

  async _initDB() {
    // 1. Try to load Supabase if credentials are provided in localStorage
    const supabaseUrl = localStorage.getItem('fighthub_supabase_url');
    const supabaseKey = localStorage.getItem('fighthub_supabase_key');
    if (supabaseUrl && supabaseKey) {
      try {
        const loaded = await this._loadSupabaseSDK();
        if (loaded && window.supabase) {
          this.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
          console.log("Supabase Cloud Database initialized successfully!");
        }
      } catch (err) {
        console.error("Failed to initialize Supabase:", err);
      }
    }

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

  // ---- CRUD Operations ---- //
  async getAll(storeName) {
    await this.dbOpen;
    if (this.supabaseClient) {
      const { data, error } = await this.supabaseClient.from(storeName).select('*');
      if (error) throw error;
      return data || [];
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getById(storeName, id) {
    await this.dbOpen;
    if (this.supabaseClient) {
      const { data, error } = await this.supabaseClient.from(storeName).select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getByIndex(storeName, indexName, value) {
    await this.dbOpen;
    if (this.supabaseClient) {
      const { data, error } = await this.supabaseClient.from(storeName).select('*').eq(indexName, value);
      if (error) throw error;
      return data || [];
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async add(storeName, item) {
    await this.dbOpen;
    if (!item.id) item.id = this._generateId();
    if (!item.createdAt) item.createdAt = new Date().toISOString();
    item.updatedAt = new Date().toISOString();
    
    if (this.supabaseClient) {
      const { data, error } = await this.supabaseClient.from(storeName).insert([item]).select();
      if (error) throw error;
      this._logActivity('add', storeName, item);
      this._emit(storeName, 'add', item);
      return data[0];
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.add(item);
      request.onsuccess = () => {
        this._logActivity('add', storeName, item);
        this._emit(storeName, 'add', item);
        resolve(item);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async update(storeName, item) {
    await this.dbOpen;
    item.updatedAt = new Date().toISOString();
    
    if (this.supabaseClient) {
      const { data, error } = await this.supabaseClient.from(storeName).update(item).eq('id', item.id).select();
      if (error) throw error;
      this._logActivity('edit', storeName, item);
      this._emit(storeName, 'update', item);
      return data[0];
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(item);
      request.onsuccess = () => {
        this._logActivity('edit', storeName, item);
        this._emit(storeName, 'update', item);
        resolve(item);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, id) {
    await this.dbOpen;
    const item = await this.getById(storeName, id);
    if (!item) return;
    
    if (this.supabaseClient) {
      const { error } = await this.supabaseClient.from(storeName).delete().eq('id', id);
      if (error) throw error;
      this._logActivity('delete', storeName, item);
      this._emit(storeName, 'delete', { id });
      return id;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(id);
      request.onsuccess = () => {
        this._logActivity('delete', storeName, item);
        this._emit(storeName, 'delete', { id });
        resolve(id);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteMany(storeName, ids) {
    await this.dbOpen;
    if (this.supabaseClient) {
      const { error } = await this.supabaseClient.from(storeName).delete().in('id', ids);
      if (error) throw error;
      this._logActivity('delete', storeName, { count: ids.length });
      this._emit(storeName, 'deleteMany', { ids });
      return ids;
    }
    const tx = this.db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    
    return Promise.all(ids.map(id => {
      return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve(id);
        request.onerror = () => reject(request.error);
      });
    })).then(result => {
      this._logActivity('delete', storeName, { count: ids.length });
      this._emit(storeName, 'deleteMany', { ids });
      return result;
    });
  }

  async count(storeName) {
    await this.dbOpen;
    if (this.supabaseClient) {
      const { count, error } = await this.supabaseClient.from(storeName).select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName) {
    await this.dbOpen;
    if (this.supabaseClient) {
      const { error } = await this.supabaseClient.from(storeName).delete().neq('id', 'placeholder-value');
      if (error) throw error;
      this._emit(storeName, 'clear');
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => {
        this._emit(storeName, 'clear');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ---- Bulk Operations ---- //
  async bulkAdd(storeName, items) {
    await this.dbOpen;
    if (this.supabaseClient) {
      items.forEach(item => {
        if (!item.id) item.id = this._generateId();
        if (!item.createdAt) item.createdAt = new Date().toISOString();
        item.updatedAt = new Date().toISOString();
      });
      const { data, error } = await this.supabaseClient.from(storeName).insert(items).select();
      if (error) throw error;
      return data || items;
    }
    const tx = this.db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    
    return Promise.all(items.map(item => {
      if (!item.id) item.id = this._generateId();
      if (!item.createdAt) item.createdAt = new Date().toISOString();
      item.updatedAt = new Date().toISOString();
      
      return new Promise((resolve, reject) => {
        const request = store.put(item);
        request.onsuccess = () => resolve(item);
        request.onerror = () => reject(request.error);
      });
    }));
  }

  // ---- Secure Cloud Credentials & Keys Management ---- //
  async saveSecureKey(keyName, value) {
    await this.dbOpen;
    if (this.supabaseClient) {
      try {
        const { error } = await this.supabaseClient
          .from('settings')
          .upsert({ id: keyName, value: value, updatedAt: new Date().toISOString() });
        if (error) {
          console.warn("Supabase settings table upsert error, saving locally:", error);
        }
      } catch (err) {
        console.warn("Supabase key save fallback:", err);
      }
    }
    try {
      const encoded = btoa(encodeURIComponent(value));
      localStorage.setItem('fh_sec_' + keyName, encoded);
    } catch (e) {
      localStorage.setItem('fh_sec_' + keyName, value);
    }
  }

  async getSecureKey(keyName) {
    await this.dbOpen;
    if (this.supabaseClient) {
      try {
        const { data, error } = await this.supabaseClient
          .from('settings')
          .select('value')
          .eq('id', keyName)
          .maybeSingle();
        if (!error && data && data.value) {
          return data.value;
        }
      } catch (err) {
        console.warn("Supabase key fetch fallback:", err);
      }
    }
    const raw = localStorage.getItem('fh_sec_' + keyName) || localStorage.getItem('fighthub_' + keyName + '_key') || localStorage.getItem('fighthub_openrouter_key');
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
    
    return all.filter(item => {
      return fields.some(field => {
        const value = item[field];
        if (typeof value === 'string') {
          return value.toLowerCase().includes(q);
        }
        if (Array.isArray(value)) {
          return value.some(v => String(v).toLowerCase().includes(q));
        }
        return false;
      });
    });
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
        await this.bulkAdd(storeName, data[storeName]);
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
  getAdminHash() {
    return localStorage.getItem('fighthub_admin_hash') || this._hashPassword('fighthub2024');
  }

  setAdminPassword(password) {
    localStorage.setItem('fighthub_admin_hash', this._hashPassword(password));
  }

  verifyAdmin(password) {
    return this._hashPassword(password) === this.getAdminHash();
  }

  getAdminSession() {
    try {
      const session = JSON.parse(localStorage.getItem('fighthub_admin_session'));
      if (session && new Date(session.expiry) > new Date()) {
        return session;
      }
      localStorage.removeItem('fighthub_admin_session');
      return null;
    } catch {
      return null;
    }
  }

  setAdminSession() {
    const session = {
      loggedIn: true,
      loginTime: new Date().toISOString(),
      expiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    localStorage.setItem('fighthub_admin_session', JSON.stringify(session));
  }

  clearAdminSession() {
    localStorage.removeItem('fighthub_admin_session');
  }

  _hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'fh_' + Math.abs(hash).toString(36);
  }

  // ---- Activity Log ---- //
  _logActivity(action, collection, item) {
    try {
      const log = this.getActivityLog();
      log.unshift({
        action,
        collection,
        itemName: item?.name || item?.title || item?.id || 'Unknown',
        timestamp: new Date().toISOString()
      });
      // Keep last 50 entries
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

  // ---- Seed Data ---- //
  async seedIfEmpty() {
    const fighterCount = await this.count('fighters');
    if (fighterCount === 0) {
      console.log('Seeding default data...');
      await this._seedDefaults();
      console.log('Default data seeded successfully!');
    }
  }

  async _seedDefaults() {
    if (typeof DEFAULT_DATA === 'undefined') {
      console.warn('Default data not loaded');
      return;
    }
    
    for (const [storeName, items] of Object.entries(DEFAULT_DATA)) {
      if (this.stores.includes(storeName) && Array.isArray(items)) {
        await this.bulkAdd(storeName, items);
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

// Global instance
const dataStore = new FightHubDataStore();
window.dataStore = dataStore;

