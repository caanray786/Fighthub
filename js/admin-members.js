/* ============================================
   FightHub — Admin: Members
   Everyone who has signed up to the Fight Hub app: when they joined, which
   country they connect from, how they signed up, their plan and who invited
   them. Read from /api/members, which only answers signed-in admins.
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await dataStore.ready;
  if (!(await dataStore.isAdminSignedIn())) return; // admin-app.js sends them to the login page

  const el = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const regionNames = (() => { try { return new Intl.DisplayNames(['en'], { type: 'region' }); } catch { return null; } })();
  const countryName = code => (code ? (regionNames?.of(code) || code) : '');
  const fmtDate = iso => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const ago = iso => {
    if (!iso) return '';
    const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days} days ago`;
    return fmtDate(iso);
  };

  let members = [];
  let summary = null;

  const setStatus = (text, isError = false) => {
    const s = el('members-status');
    s.textContent = text;
    s.hidden = !text;
    s.classList.toggle('is-error', isError);
  };

  async function load() {
    setStatus('Loading members…');
    el('btn-refresh').disabled = true;
    try {
      const { data } = await dataStore.supabaseClient.auth.getSession();
      const res = await fetch('../api/members', { headers: { Authorization: `Bearer ${data.session?.access_token || ''}` } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Members could not be loaded (error ${res.status}).`);
      members = body.members || [];
      summary = body.summary;
      renderSummary();
      renderFilters();
      renderTable();
      setStatus('');
      el('members-updated').textContent = `Updated ${new Date(body.updated).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    } catch (err) {
      setStatus(err.message, true);
    } finally {
      el('btn-refresh').disabled = false;
    }
  }

  function renderSummary() {
    el('stat-total').textContent = summary.total.toLocaleString('en-GB');
    el('stat-week').textContent = summary.last7.toLocaleString('en-GB');
    el('stat-month').textContent = summary.last30.toLocaleString('en-GB');
    el('stat-premium').textContent = summary.premium.toLocaleString('en-GB');

    // Sign-ups on each of the last 30 days
    const max = Math.max(1, ...summary.daily.map(d => d.count));
    el('signup-chart').innerHTML = summary.daily.map(d => {
      const label = `${new Date(d.day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}: ${d.count} sign-up${d.count === 1 ? '' : 's'}`;
      return `<span style="height:${Math.max(2, Math.round((d.count / max) * 100))}%" title="${esc(label)}" aria-label="${esc(label)}"></span>`;
    }).join('');
    el('signup-chart-range').textContent = `${fmtDate(summary.daily[0].day)} to ${fmtDate(summary.daily[summary.daily.length - 1].day)}`;

    // Members by country
    const top = summary.countries[0]?.count || 1;
    el('country-list').innerHTML = summary.countries.length
      ? summary.countries.map(c => `
          <li class="country-row">
            <span>${esc(countryName(c.code))} <small>${esc(c.code)}</small></span>
            <strong>${c.count}</strong>
            <span class="country-bar"><i style="width:${Math.round((c.count / top) * 100)}%"></i></span>
          </li>`).join('')
      : '<li class="country-row muted">No countries recorded yet.</li>';
    el('country-unknown').textContent = summary.noCountry
      ? `${summary.noCountry} member${summary.noCountry === 1 ? '' : 's'} not known yet: the country is recorded the next time they open the app.`
      : '';
    el('method-split').textContent = Object.entries(summary.methods).map(([m, n]) => `${m}: ${n}`).join(' · ');
  }

  function renderFilters() {
    const country = el('filter-country');
    const chosen = country.value;
    country.innerHTML = '<option value="">All countries</option>'
      + summary.countries.map(c => `<option value="${esc(c.code)}">${esc(countryName(c.code))} (${c.count})</option>`).join('')
      + (summary.noCountry ? '<option value="-">Not known yet</option>' : '');
    country.value = chosen;
  }

  function filtered() {
    const q = el('search-input').value.trim().toLowerCase();
    const country = el('filter-country').value, plan = el('filter-plan').value, method = el('filter-method').value;
    return members.filter(m =>
      (!q || `${m.name} ${m.email}`.toLowerCase().includes(q))
      && (!country || (country === '-' ? !m.country : m.country === country))
      && (!plan || (plan === 'premium' ? m.premium : !m.premium))
      && (!method || m.method === method));
  }

  function renderTable() {
    const rows = filtered();
    el('members-count').textContent = `${rows.length} of ${members.length} member${members.length === 1 ? '' : 's'}`;
    el('members-body').innerHTML = rows.length ? rows.map(m => `
      <tr>
        <td><strong>${esc(m.name || '(no name)')}</strong></td>
        <td>${esc(m.email)}</td>
        <td>${esc(fmtDate(m.joined))}</td>
        <td>${m.country ? `${esc(countryName(m.country))}${m.firstCountry && m.firstCountry !== m.country ? `<br><small class="muted">joined from ${esc(countryName(m.firstCountry))}</small>` : ''}` : '<span class="muted">Not known yet</span>'}</td>
        <td>${esc(m.method)}</td>
        <td><span class="status-badge ${m.premium ? 'status-active' : 'status-archived'}">${esc(m.plan)}</span></td>
        <td>${esc(ago(m.lastActive))}</td>
        <td>${esc(m.invitedBy)}</td>
      </tr>`).join('')
      : '<tr><td colspan="8" class="muted" style="text-align:center; padding: 24px;">No members match.</td></tr>';
  }

  // Spreadsheet download of the members shown (after search and filters)
  function exportCsv() {
    const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Name', 'Email', 'Joined', 'Country', 'Country code', 'Joined from', 'Signed up with', 'Plan', 'Last active', 'Invited by'];
    const lines = filtered().map(m => [m.name, m.email, m.joined?.slice(0, 10), countryName(m.country), m.country, countryName(m.firstCountry), m.method, m.plan, m.lastActive?.slice(0, 10), m.invitedBy].map(cell).join(','));
    const blob = new Blob([[head.map(cell).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `fighthub-members-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  ['search-input', 'filter-country', 'filter-plan', 'filter-method'].forEach(id => el(id).addEventListener('input', renderTable));
  el('btn-refresh').addEventListener('click', load);
  el('btn-export').addEventListener('click', exportCsv);
  load();
});
