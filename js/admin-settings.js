/* ============================================
   FightHub — Admin Settings Script
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await dataStore.ready;

  // ---- 0. Automated Data Pipeline Control Center ---- //
  const btnRunPipeline = document.getElementById('btn-run-pipeline');
  const btnSetKeys = document.getElementById('btn-set-keys');
  const pipelineTerminal = document.getElementById('pipeline-terminal');

  function appendTerminalLog(msg) {
    if (pipelineTerminal) {
      const time = new Date().toLocaleTimeString();
      pipelineTerminal.innerHTML += `<br>[${time}] ${msg}`;
      pipelineTerminal.scrollTop = pipelineTerminal.scrollHeight;
    }
  }

  if (btnSetKeys) {
    btnSetKeys.addEventListener('click', async () => {
      const currentKey = await contentBotEngine.getApiKey();
      const apiKey = prompt("Enter your OpenRouter / Gemini API Key for LLM fight preview generation (stored securely in cloud/dataStore):", currentKey);
      if (apiKey !== null) {
        await contentBotEngine.setApiKey(apiKey.trim());
        const apiSportsKey = prompt("Enter your API-Sports Key (optional, press OK to use dynamic live feed):", fightAPIService.apiKey);
        if (apiSportsKey !== null) {
          fightAPIService.setApiKey(apiSportsKey.trim());
        }
        showToast("API Credentials saved securely!", "success");
        appendTerminalLog("🔑 API Keys updated and saved.");
      }
    });
  }

  if (btnRunPipeline) {
    btnRunPipeline.addEventListener('click', async () => {
      btnRunPipeline.disabled = true;
      btnRunPipeline.innerHTML = '⏳ Executing Pipeline...';

      try {
        appendTerminalLog("=============================================");
        appendTerminalLog("🚀 Launching Automated Combat Sports Pipeline...");
        
        const result = await contentBotEngine.runFullPipeline((logMsg) => {
          appendTerminalLog(logMsg);
        });

        appendTerminalLog(`🎉 Pipeline Execution Succeeded! ${result.previewsCount} fight previews & ${result.schedulesCount} fight cards loaded.`);
        showToast("Automated Data Pipeline executed successfully!", "success");
      } catch (err) {
        console.error("Pipeline error:", err);
        appendTerminalLog(`❌ Pipeline Error: ${err.message}`);
        showToast("Pipeline error: " + err.message, "error");
      } finally {
        btnRunPipeline.disabled = false;
        btnRunPipeline.innerHTML = '⚡ Run Automated Data Pipeline Now';
      }
    });
  }

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

    // Verify current password
    if (!dataStore.verifyAdmin(oldPwd)) {
      showPasswordFeedback('Current password is incorrect.', 'error');
      oldPasswordInput.value = '';
      oldPasswordInput.focus();
      return;
    }

    // Check matching confirm password
    if (newPwd !== confirmPwd) {
      showPasswordFeedback('New passwords do not match.', 'error');
      confirmPasswordInput.value = '';
      confirmPasswordInput.focus();
      return;
    }

    // Minimum password length validation
    if (newPwd.length < 6) {
      showPasswordFeedback('New password must be at least 6 characters long.', 'error');
      newPasswordInput.value = '';
      confirmPasswordInput.value = '';
      newPasswordInput.focus();
      return;
    }

    try {
      // Save new password
      dataStore.setAdminPassword(newPwd);
      showPasswordFeedback('Admin password changed successfully!', 'success');
      showToast('Password updated!', 'success');
      passwordForm.reset();
    } catch (err) {
      console.error(err);
      showPasswordFeedback('Failed to update administrative password.', 'error');
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
