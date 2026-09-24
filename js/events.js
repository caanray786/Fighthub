/* ============================================
   FightHub — Events JS
   Handles calendar view generation, date indicators,
   promotion filtering, and date selection sync.
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await dataStore.ready;

  // Element selections
  const monthYearDisplay = document.getElementById('calendar-month-year');
  const prevMonthBtn = document.getElementById('prev-month');
  const nextMonthBtn = document.getElementById('next-month');
  const calendarDaysContainer = document.getElementById('calendar-days');
  const eventsListContainer = document.getElementById('events-list-container');
  const eventsViewTitle = document.getElementById('events-view-title');
  const resetDateFilterBtn = document.getElementById('reset-date-filter');
  const promoButtons = document.querySelectorAll('.filter-bar button, .filter-bar .tag');

  let allEvents = [];
  let currentPromotion = 'All';
  let selectedDateStr = null; // YYYY-MM-DD format
  
  // Calendar opens on the current month
  const now = new Date();
  const today = todayStr();
  let calendarYear = now.getFullYear();
  let calendarMonth = now.getMonth(); // 0-indexed

  // 1. Fetch data
  try {
    allEvents = await dataStore.getAll('events');
    // Sort events by date ascending
    allEvents.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    
    initEventsPage();
  } catch (err) {
    console.error('Error fetching events:', err);
    eventsListContainer.innerHTML = `<p class="text-accent">Error loading event schedule.</p>`;
  }

  // 2. Initialize Calendar and List
  function initEventsPage() {
    renderCalendar();
    renderEventsList();
    
    // Attach calendar navigation handlers
    prevMonthBtn.addEventListener('click', () => {
      calendarMonth--;
      if (calendarMonth < 0) {
        calendarMonth = 11;
        calendarYear--;
      }
      renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
      calendarMonth++;
      if (calendarMonth > 11) {
        calendarMonth = 0;
        calendarYear++;
      }
      renderCalendar();
    });

    // Promotion filter tags
    promoButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        promoButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        currentPromotion = btn.getAttribute('data-promo');
        
        // Reset date filter on category change
        selectedDateStr = null;
        resetDateFilterBtn.style.display = 'none';

        renderCalendar();
        renderEventsList();
        
      });
    });

    // Reset date filter handler
    resetDateFilterBtn.addEventListener('click', () => {
      selectedDateStr = null;
      resetDateFilterBtn.style.display = 'none';
      
      // Remove selected active class from calendar days
      document.querySelectorAll('.calendar-day.selected').forEach(d => {
        d.classList.remove('selected');
      });
      
      renderEventsList();
    });
  }

  // 3. Render Calendar Grid
  function renderCalendar() {
    calendarDaysContainer.innerHTML = '';
    
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    monthYearDisplay.innerText = `${months[calendarMonth]} ${calendarYear}`;

    // Get first day of the month
    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
    // Get total days in the month
    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    // Get total days in the previous month
    const prevMonthTotalDays = new Date(calendarYear, calendarMonth, 0).getDate();

    // Fill other-month days at the beginning of current month's grid
    for (let i = firstDay - 1; i >= 0; i--) {
      const dayNum = prevMonthTotalDays - i;
      const dayDiv = document.createElement('div');
      dayDiv.className = 'calendar-day other-month';
      dayDiv.innerText = dayNum;
      calendarDaysContainer.appendChild(dayDiv);
    }

    // Fill current month days
    for (let day = 1; day <= totalDays; day++) {
      const dayDiv = document.createElement('div');
      dayDiv.className = 'calendar-day';
      dayDiv.innerText = day;
      
      // Construct date string
      const yyyy = calendarYear;
      const mm = String(calendarMonth + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      // Check if this date has events in the selected promotion
      const dateEvents = allEvents.filter(e => {
        const matchPromo = currentPromotion === 'All' || e.promotion === currentPromotion;
        return e.date === dateStr && matchPromo;
      });

      if (dateEvents.length > 0) {
        dayDiv.classList.add('has-event');
      }

      // Highlight selected day
      if (selectedDateStr === dateStr) {
        dayDiv.classList.add('selected');
        // Let's add a style to signify selections: border accent
        dayDiv.style.border = '1px solid var(--accent)';
      }

      if (dateStr === today) {
        dayDiv.classList.add('today');
      }

      dayDiv.addEventListener('click', () => {
        // Toggle/Select Date
        if (selectedDateStr === dateStr) {
          // If already selected, clear it
          selectedDateStr = null;
          dayDiv.classList.remove('selected');
          dayDiv.style.border = 'none';
          resetDateFilterBtn.style.display = 'none';
        } else {
          // Clear previous selected day classes
          document.querySelectorAll('.calendar-day').forEach(d => {
            d.classList.remove('selected');
            d.style.border = 'none';
          });
          
          selectedDateStr = dateStr;
          dayDiv.classList.add('selected');
          dayDiv.style.border = '1px solid var(--accent)';
          resetDateFilterBtn.style.display = 'inline-block';
        }

        renderEventsList();
      });

      calendarDaysContainer.appendChild(dayDiv);
    }

    // Fill remaining days of the week at the end
    const totalFilled = firstDay + totalDays;
    const remaining = 42 - totalFilled; // 6 rows of 7 days = 42 total
    for (let day = 1; day <= remaining; day++) {
      const dayDiv = document.createElement('div');
      dayDiv.className = 'calendar-day other-month';
      dayDiv.innerText = day;
      calendarDaysContainer.appendChild(dayDiv);
    }
  }

  // 4. Render Events Cards list
  function renderEventsList() {
    eventsListContainer.innerHTML = '';

    // Filter events
    let filtered = allEvents;
    
    // Apply promotion filter
    if (currentPromotion !== 'All') {
      filtered = filtered.filter(e => e.promotion === currentPromotion);
    }
    
    // Apply date filter; without one, list upcoming events only
    if (selectedDateStr) {
      filtered = filtered.filter(e => e.date === selectedDateStr);
      eventsViewTitle.innerText = `Fights Scheduled on ${formatDateLong(selectedDateStr)}`;
    } else {
      filtered = filtered.filter(e => e.date >= today);
      eventsViewTitle.innerText = `${currentPromotion === 'All' ? 'All' : currentPromotion} Upcoming Events`;
    }

    if (filtered.length === 0) {
      if (selectedDateStr) {
        eventsListContainer.innerHTML = `
          <div class="card card-glass text-center" style="padding:40px 20px;">
            <p>No fight events scheduled on this date.</p>
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('reset-date-filter').click();" style="margin-top:10px;">View All Fights</button>
          </div>
        `;
      } else {
        eventsListContainer.innerHTML = `
          <div class="text-center" style="padding:40px 0;">
            <p>No upcoming events found.</p>
          </div>
        `;
      }
      return;
    }

    // Render cards
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    eventsListContainer.innerHTML = filtered.map(evt => {
      const dateObj = parseLocalDate(evt.date);
      const monthStr = months[dateObj.getMonth()] || '';
      const dayStr = String(dateObj.getDate()).padStart(2, '0');
      const isPast = evt.date < today;

      let badgeClass = 'badge-accent';
      if (evt.promotion === 'Boxing') badgeClass = 'badge-info';
      if (evt.promotion === 'ONE') badgeClass = 'badge-warning';
      if (evt.promotion === 'PFL') badgeClass = 'badge-success';

      const location = [evt.venue, evt.city, evt.country].filter(v => v && v !== 'TBA').join(', ') || 'Venue TBA';
      const fightsListHtml = (evt.fights || []).map(f => `<li>🥊 ${escapeHtml(f)}</li>`).join('');
      const ticketUrl = safeUrl(evt.ticketUrl);
      const sourceUrl = safeUrl(evt.sourceUrl);

      return `
        <div class="event-card animate-on-scroll" style="width: 100%;${isPast ? ' opacity:0.7;' : ''}">
          <div class="event-date-box">
            <div class="event-month">${monthStr}</div>
            <div class="event-day">${dayStr}</div>
          </div>
          <div class="event-info" style="flex-grow:1;">
            <span class="badge ${badgeClass}" style="margin-bottom: 5px;">${escapeHtml(evt.promotion)}</span>
            ${isPast ? '<span class="badge" style="margin-bottom: 5px;">Completed</span>' : ''}
            <h3>${escapeHtml(evt.name)}</h3>
            <div class="event-location" style="margin-bottom: 10px;">
              📍 ${escapeHtml(location)} &nbsp;|&nbsp; 🕒 ${escapeHtml(evt.time || 'TBA')}
            </div>

            ${evt.description ? `<p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 10px;">${escapeHtml(evt.description)}</p>` : ''}

            <div class="event-fights" style="border-top:1px solid var(--border-color); padding-top:10px;">
              <div style="font-size: 0.8rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:5px;">Featured Fights</div>
              <ul style="padding-left:0; list-style:none; display:grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 0.85rem; color:var(--text-secondary);">
                ${fightsListHtml || '<li>Card to be announced</li>'}
              </ul>
            </div>
            ${sourceUrl ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:8px;"><a href="${sourceUrl}" target="_blank" rel="noopener">Source</a></div>` : ''}
          </div>

          ${ticketUrl && !isPast ? `
          <div style="margin-left:15px; display:flex; flex-direction:column; gap:10px;">
            <a href="${ticketUrl}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Tickets</a>
          </div>` : ''}
        </div>
      `;
    }).join('');

    if (window.initScrollAnimations) {
      window.initScrollAnimations();
    }
  }

  // Helpers
  function formatDateLong(dateStr) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return parseLocalDate(dateStr).toLocaleDateString(undefined, options);
  }
});
