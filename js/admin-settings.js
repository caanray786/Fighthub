/* ============================================
   FightHub — Admin Settings Script
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await dataStore.ready;

  // ---- 0. AI worker runs ---- //
  (async () => {
    const panel = document.getElementById('ai-runs');
    if (!panel) return;
    if (!dataStore.cloud) {
      panel.textContent = 'The AI worker writes to the cloud database; connect Supabase to see its runs.';
      return;
    }
    try {
      const runs = await dataStore.getAiRuns(10);
      if (!runs.length) {
        panel.innerHTML = 'No runs yet. The first scheduled run will appear here, or start one with <strong>Run now</strong>.';
        return;
      }
      panel.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>Started</th><th>Result</th><th>Articles</th><th>New fighters</th><th>Photos</th><th>Details</th></tr></thead>
          <tbody>${runs.map(run => {
            const s = run.summary || {};
            const state = run.finished_at ? (run.ok ? '🟢 OK' : '🟠 Partial') : '⏳ Running / stopped';
            return `<tr>
              <td>${escapeHtml(new Date(run.started_at).toLocaleString())}</td>
              <td>${state}</td>
              <td>${escapeHtml(s.articles ?? 0)}</td>
              <td>${escapeHtml(s.newFighters ?? 0)}</td>
              <td>${escapeHtml(s.photosAdded ?? 0)}</td>
              <td><details><summary style="cursor:pointer;">Log</summary><pre style="white-space:pre-wrap; max-height:300px; overflow:auto; font-size:0.75rem;">${escapeHtml(run.log || '')}</pre></details></td>
            </tr>`;
          }).join('')}</tbody>
        </table>`;
    } catch (err) {
      panel.textContent = `Could not load AI runs: ${err.message}. Has supabase/migrations/003_ai_worker.sql been run?`;
    }
  })();

  // Database connection panel
  (async () => {
    const panel = document.getElementById('db-connection-status');
    if (!panel) return;
    if (!dataStore.cloud) {
      panel.innerHTML = '⚪ <strong>Local mode</strong>: content is stored in this browser only. Add the Supabase URL and anon key to <code>js/config.js</code> to go live.';
      return;
    }
    try {
      const count = await dataStore.count('fighters');
      const email = await dataStore.getAdminEmail();
      panel.innerHTML = `🟢 <strong>Connected to Supabase</strong> (${escapeHtml(new URL(dataStore.config.supabaseUrl).host)}) · ${count} fighters · signed in as ${escapeHtml(email || 'unknown')}`;
    } catch (err) {
      panel.innerHTML = `🔴 <strong>Cannot reach Supabase</strong>: ${escapeHtml(err.message)}`;
    }
  })();

  // DOM elements
  const cardBackup = document.getElementById('card-backup');
  const cardRestore = document.getElementById('card-restore');
  const fileRestoreInput = document.getElementById('input-restore-file');
  const btnReset = document.getElementById('btn-reset-db');

  const passwordForm = document.getElementById('change-password-form');
  const oldPasswordInput = document.getElementById('old-password');
  const newPasswordInput = document.getElementById('new-password');
  const confirmPasswordInput = document.getElementById('confirm-password');
  const passwordFeedback = document.getElementById('password-feedback-msg');

  // ---- 1. Data Backup (Export) ---- //
  cardBackup.addEventListener('click', async () => {
    try {
      const data = await dataStore.exportAll();
      dataStore.downloadExport(data);
      showToast('Database backup downloaded successfully!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to export database backup.', 'error');
    }
  });

  // ---- 2. Data Restore (Import) ---- //
  cardRestore.addEventListener('click', () => {
    fileRestoreInput.click();
  });

  fileRestoreInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const importedData = JSON.parse(evt.target.result);
        
        // Simple verification that it's a fighthub file
        if (!importedData.fighters || !importedData.articles || !importedData.events) {
          showToast('Invalid backup file: Missing database store entries.', 'error');
          return;
        }

        if (confirm('Restoring this backup will replace all current data. Do you wish to continue?')) {
          await dataStore.importAll(importedData);
          showToast('Data restored and database re-indexed!', 'success');
          
          // Refresh after delay
          setTimeout(() => {
            window.location.href = 'index.html';
          }, 1500);
        }
      } catch (err) {
        console.error(err);
        showToast('Failed to parse file. Ensure it is a valid backup JSON.', 'error');
      }
    };
    reader.readAsText(file);
    // Clear input value so same file can be selected again
    fileRestoreInput.value = '';
  });

  // ---- 3. Reset Database (Danger Zone) ---- //
  btnReset.addEventListener('click', async () => {
    const doubleConfirm = confirm('Are you absolutely sure you want to RESET the entire database to original factory defaults?\n\nThis will DELETE all custom fighters, articles, schedules, and reviews.');
    if (!doubleConfirm) return;

    try {
      await dataStore.resetToDefaults();
      showToast('Database wiped and reset to factory defaults!', 'success');
      
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1500);
    } catch (e) {
      console.error(e);
      showToast('Failed to reset database defaults.', 'error');
    }
  });

  // ---- 4. Change Admin Password ---- //
  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const oldPwd = oldPasswordInput.value;
    const newPwd = newPasswordInput.value;
    const confirmPwd = confirmPasswordInput.value;

    // Reset feedback styling
    passwordFeedback.style.display = 'none';
    passwordFeedback.className = '';

    // Check matching confirm password
    if (newPwd !== confirmPwd) {
      showPasswordFeedback('New passwords do not match.', 'error');
      confirmPasswordInput.value = '';
      confirmPasswordInput.focus();
      return;
    }

    // Minimum password length validation
    if (newPwd.length < 10) {
      showPasswordFeedback('New password must be at least 10 characters long.', 'error');
      newPasswordInput.value = '';
      confirmPasswordInput.value = '';
      newPasswordInput.focus();
      return;
    }

    try {
      await dataStore.changeAdminPassword(oldPwd, newPwd);
      showPasswordFeedback('Password changed successfully.', 'success');
      showToast('Password updated!', 'success');
      passwordForm.reset();
    } catch (err) {
      showPasswordFeedback(err.message || 'Failed to change password.', 'error');
      oldPasswordInput.value = '';
      oldPasswordInput.focus();
    }
  });

  function showPasswordFeedback(msg, type) {
    passwordFeedback.textContent = msg;
    passwordFeedback.style.display = 'block';
    
    if (type === 'success') {
      passwordFeedback.style.background = 'rgba(34, 197, 94, 0.1)';
      passwordFeedback.style.border = '1px solid rgba(34, 197, 94, 0.3)';
      passwordFeedback.style.color = 'var(--admin-success)';
    } else {
      passwordFeedback.style.background = 'rgba(239, 68, 68, 0.1)';
      passwordFeedback.style.border = '1px solid rgba(239, 68, 68, 0.3)';
      passwordFeedback.style.color = 'var(--admin-error)';
    }
  }

});
