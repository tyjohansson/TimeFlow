// ============================================================
// TIMEFLOW - Mobile Time Tracker
// ============================================================

// ---- CONSTANTS ----

const KEYS = {
  ACTIVITIES: 'tf_activities',
  ENTRIES:    'tf_entries',
  NOTES:      'tf_daily_notes',
  SETTINGS:   'tf_settings',
  ACTIVE:     'tf_active',
  TAGS:       'tf_tags',
};

const DEFAULT_TAGS = [
  { id: 't1', name: 'Urgent', color: '#ef4444' },
  { id: 't2', name: 'Focus',  color: '#8b5cf6' },
  { id: 't3', name: 'Review', color: '#f59e0b' },
];

const DEFAULT_ACTIVITIES = [
  { id: 'a1', name: 'Client Work', icon: '💼', color: '#6366f1', billable: true,  deepWork: true,  tags: [], useCount: 0 },
  { id: 'a2', name: 'Deep Work',   icon: '🧠', color: '#8b5cf6', billable: false, deepWork: true,  tags: [], useCount: 0 },
  { id: 'a3', name: 'Meeting',     icon: '📞', color: '#f59e0b', billable: true,  deepWork: false, tags: [], useCount: 0 },
  { id: 'a4', name: 'Admin',       icon: '📧', color: '#64748b', billable: false, deepWork: false, tags: [], useCount: 0 },
  { id: 'a5', name: 'Learning',    icon: '📚', color: '#10b981', billable: false, deepWork: true,  tags: [], useCount: 0 },
  { id: 'a6', name: 'Break',       icon: '☕', color: '#06b6d4', billable: false, deepWork: false, tags: [], useCount: 0 },
  { id: 'a7', name: 'Exercise',    icon: '🏃', color: '#f43f5e', billable: false, deepWork: false, tags: [], useCount: 0 },
  { id: 'a8', name: 'Planning',    icon: '📋', color: '#0ea5e9', billable: true,  deepWork: false, tags: [], useCount: 0 },
];

const DEFAULT_SETTINGS = {
  dailyBillableGoal: 6,
  dailyDeepWorkGoal: 4,
  breakReminderMins: 90,
  smartSort:         true,
};

// ---- STATE ----

const state = {
  activities:    [],
  entries:       [],
  notes:         {},
  tags:          [],
  settings:      { ...DEFAULT_SETTINGS },
  activeEntry:   null,
  pendingEntry:  null,
  currentTab:    'track',
  logDate:       todayStr(),
  timerInterval: null,
  todayChart:    null,
  weekChart:     null,
  breakShown:    false,
  tempRatings:   {},
};

// ---- DATE UTILS ----

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function nowISO() {
  return new Date().toISOString();
}

function formatTimeStr(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function durationMs(entry) {
  const end = entry.endTime ? new Date(entry.endTime) : new Date();
  return end - new Date(entry.startTime);
}

function fmtDuration(ms) {
  const totalMins = Math.floor(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtHours(ms) {
  return (ms / 3600000).toFixed(1) + 'h';
}

function fmtElapsed(ms) {
  const s   = Math.floor(ms / 1000);
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

function fmtDate(dateStr) {
  const today = todayStr();
  if (dateStr === today) return 'Today';
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  if (dateStr === yest.toISOString().split('T')[0]) return 'Yesterday';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString([], {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function weekStartStr(dateStr) {
  const d   = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function getWeekDates(startStr) {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startStr + 'T00:00:00');
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---- STORAGE ----

function save() {
  localStorage.setItem(KEYS.ACTIVITIES, JSON.stringify(state.activities));
  localStorage.setItem(KEYS.ENTRIES,    JSON.stringify(state.entries));
  localStorage.setItem(KEYS.NOTES,      JSON.stringify(state.notes));
  localStorage.setItem(KEYS.SETTINGS,   JSON.stringify(state.settings));
  localStorage.setItem(KEYS.TAGS,       JSON.stringify(state.tags));
  if (state.activeEntry) {
    localStorage.setItem(KEYS.ACTIVE, JSON.stringify(state.activeEntry));
  } else {
    localStorage.removeItem(KEYS.ACTIVE);
  }
}

function load() {
  const acts = localStorage.getItem(KEYS.ACTIVITIES);
  state.activities = acts
    ? JSON.parse(acts).map(a => ({ tags: [], useCount: 0, ...a }))
    : DEFAULT_ACTIVITIES.map(a => ({ ...a }));

  const entries = localStorage.getItem(KEYS.ENTRIES);
  state.entries = entries ? JSON.parse(entries) : [];

  const notes = localStorage.getItem(KEYS.NOTES);
  state.notes = notes ? JSON.parse(notes) : {};

  const settings = localStorage.getItem(KEYS.SETTINGS);
  state.settings = settings
    ? { ...DEFAULT_SETTINGS, ...JSON.parse(settings) }
    : { ...DEFAULT_SETTINGS };

  const tags = localStorage.getItem(KEYS.TAGS);
  state.tags = tags ? JSON.parse(tags) : DEFAULT_TAGS.map(t => ({ ...t }));

  const active = localStorage.getItem(KEYS.ACTIVE);
  state.activeEntry = active ? JSON.parse(active) : null;
}

// ---- ACTIVITY HELPERS ----

function getActivity(id) {
  return state.activities.find(a => a.id === id);
}

function entriesForDate(date) {
  return state.entries.filter(e => e.date === date);
}

function sortedActivities() {
  if (!state.settings.smartSort) return state.activities;
  return [...state.activities].sort((a, b) => (b.useCount || 0) - (a.useCount || 0));
}

function renderActivityTags(act) {
  if (!act?.tags?.length) return '';
  return act.tags.map(tagId => {
    const tag = state.tags.find(t => t.id === tagId);
    if (!tag) return '';
    return `<span class="tag-pill" style="background:${tag.color}22;color:${tag.color};border-color:${tag.color}55">${tag.name}</span>`;
  }).join('');
}

// ---- TIMER ----

function startActivity(actId) {
  // Commit any pending entry (note skipped, switching activities)
  if (state.pendingEntry) {
    state.entries.push(state.pendingEntry);
    state.pendingEntry = null;
    closeModal();
  }

  // Stop current active entry silently (switching activities)
  if (state.activeEntry) {
    state.entries.push({ ...state.activeEntry, endTime: nowISO() });
    state.activeEntry = null;
  }

  state.activeEntry = {
    id:         uid(),
    activityId: actId,
    startTime:  nowISO(),
    endTime:    null,
    date:       todayStr(),
    note:       '',
  };
  state.breakShown = false;

  // Increment use count
  const act = state.activities.find(a => a.id === actId);
  if (act) act.useCount = (act.useCount || 0) + 1;

  save();
  startTimerTick();
  renderTrack();
  updateHeaderDot();
}

function stopTimer() {
  if (!state.activeEntry) return;

  const endedEntry    = { ...state.activeEntry, endTime: nowISO() };
  state.activeEntry   = null;
  state.pendingEntry  = endedEntry;

  stopTimerTick();
  save();
  renderTrack();
  updateHeaderDot();

  showNoteModal(endedEntry);
}

function showNoteModal(entry) {
  openModal(`
    <div class="note-modal">
      <h3>Add a Note</h3>
      <p class="modal-subtitle">Optional — add context to this time entry</p>
      <div class="input-group">
        <textarea id="entry-note" rows="3" placeholder="What were you working on? Any details…">${entry.note || ''}</textarea>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="commitWithNote(false)">Skip</button>
        <button class="btn-primary" onclick="commitWithNote(true)">Save Note</button>
      </div>
    </div>
  `);
}

function commitWithNote(saveNote) {
  const entry = state.pendingEntry;
  if (!entry) { closeModal(); return; }

  if (saveNote) {
    entry.note = document.getElementById('entry-note')?.value?.trim() || '';
  }

  state.entries.push(entry);
  state.pendingEntry = null;
  save();
  closeModal();

  if (state.currentTab === 'log')   renderLog(state.logDate);
  if (state.currentTab === 'today') renderToday();
  if (state.currentTab === 'week')  renderWeek();

  if (new Date().getHours() >= 16 && !state.notes[todayStr()]) {
    setTimeout(showWellbeingModal, 600);
  }
}

function startTimerTick() {
  stopTimerTick();
  state.timerInterval = setInterval(onTick, 1000);
}

function stopTimerTick() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function onTick() {
  const el = document.getElementById('timer-elapsed');
  if (el && state.activeEntry) {
    el.textContent = fmtElapsed(Date.now() - new Date(state.activeEntry.startTime));
  }
  const timeEl = document.getElementById('current-time');
  if (timeEl) {
    timeEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  checkBreak();
}

// ---- BREAK REMINDER ----

function checkBreak() {
  if (!state.activeEntry || state.breakShown) return;
  const act = getActivity(state.activeEntry.activityId);
  if (!act || !act.deepWork) return;
  const ms = Date.now() - new Date(state.activeEntry.startTime);
  if (ms >= state.settings.breakReminderMins * 60000) {
    state.breakShown = true;
    renderBreakAlert();
  }
}

function renderBreakAlert() {
  const el = document.getElementById('break-alert');
  if (!el) return;
  const breakAct = state.activities.find(a => a.name.toLowerCase().includes('break'));
  const breakId  = breakAct ? breakAct.id : state.activities[0].id;
  el.innerHTML = `
    <div class="break-alert-content">
      <span class="break-icon">⚡</span>
      <div>
        <strong>Time for a break!</strong>
        <p>You've been in deep work for ${state.settings.breakReminderMins} min. Rest your mind.</p>
      </div>
      <button onclick="startActivity('${breakId}')">Take Break</button>
    </div>
  `;
  el.classList.remove('hidden');
}

// ---- HEADER ----

function updateHeaderDot() {
  const dot = document.getElementById('active-dot');
  if (!dot) return;
  dot.classList.toggle('hidden', !state.activeEntry);
}

// ---- TAB NAVIGATION ----

function switchTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${tab}`)?.classList.add('active');
  document.querySelector(`.nav-btn[data-tab="${tab}"]`)?.classList.add('active');

  switch (tab) {
    case 'track':    renderTrack();             break;
    case 'log':      renderLog(state.logDate);  break;
    case 'today':    renderToday();             break;
    case 'week':     renderWeek();              break;
    case 'settings': renderSettings();          break;
  }
}

// ============================================================
// RENDER: TRACK
// ============================================================

function renderTrack() {
  const section = document.getElementById('active-section');
  const grid    = document.getElementById('activity-grid');
  const breakEl = document.getElementById('break-alert');

  if (!state.activeEntry && breakEl) breakEl.classList.add('hidden');

  if (section) {
    if (state.activeEntry) {
      const act     = getActivity(state.activeEntry.activityId);
      const elapsed = Date.now() - new Date(state.activeEntry.startTime);
      section.innerHTML = `
        <div class="active-timer" style="--activity-color: ${act?.color || '#6366f1'}">
          <div class="active-pulse" style="background: ${act?.color || '#6366f1'}"></div>
          <div class="active-info">
            <div class="active-activity-name">
              <span class="active-icon">${act?.icon || '▶'}</span>
              ${act?.name || 'Unknown'}
            </div>
            <div class="active-tags">
              ${act?.billable ? '<span class="tag tag-billable">Billable</span>' : ''}
              ${act?.deepWork ? '<span class="tag tag-deep">Deep Work</span>' : ''}
              ${renderActivityTags(act)}
            </div>
          </div>
          <div class="active-right">
            <div id="timer-elapsed" class="timer-elapsed">${fmtElapsed(elapsed)}</div>
            <button class="btn-stop" onclick="stopTimer()">&#9646; Stop</button>
          </div>
        </div>
      `;
    } else {
      section.innerHTML = `
        <div class="idle-prompt">
          <div class="idle-icon">⏱</div>
          <div class="idle-text">Tap an activity to start tracking</div>
          <div class="idle-hint">Hold &amp; drag to reorder</div>
        </div>
      `;
    }
  }

  if (grid) {
    const acts = sortedActivities();
    grid.innerHTML = acts.map(a => `
      <button
        class="activity-btn ${state.activeEntry?.activityId === a.id ? 'active' : ''}"
        style="--activity-color: ${a.color}"
        data-act-id="${a.id}"
        onclick="startActivity('${a.id}')">
        <span class="activity-icon">${a.icon}</span>
        <span class="activity-name">${a.name}</span>
        <div class="activity-meta">
          ${a.billable ? '<span class="dot dot-billable">$</span>' : ''}
          ${a.deepWork ? '<span class="dot dot-deep">🎯</span>' : ''}
          ${renderActivityTags(a)}
        </div>
      </button>
    `).join('');

    setupDrag(grid);
  }
}

// ============================================================
// DRAG & DROP (touch-based long-press)
// ============================================================

const drag = {
  active:         false,
  actId:          null,
  overActId:      null,
  ghost:          null,
  originEl:       null,
  longPressTimer: null,
  startX:         0,
  startY:         0,
  offsetX:        0,
  offsetY:        0,
};

function setupDrag(grid) {
  grid.addEventListener('touchstart',  dragTouchStart,  { passive: false });
  grid.addEventListener('touchmove',   dragTouchMove,   { passive: false });
  grid.addEventListener('touchend',    dragTouchEnd,    { passive: false });
  grid.addEventListener('touchcancel', dragCancel,      { passive: false });
}

function dragTouchStart(e) {
  const btn = e.target.closest('[data-act-id]');
  if (!btn) return;

  drag.startX = e.touches[0].clientX;
  drag.startY = e.touches[0].clientY;
  drag.actId  = btn.dataset.actId;

  drag.longPressTimer = setTimeout(() => {
    drag.active   = true;
    drag.originEl = btn;

    const rect   = btn.getBoundingClientRect();
    drag.offsetX = drag.startX - rect.left;
    drag.offsetY = drag.startY - rect.top;

    const ghost = btn.cloneNode(true);
    ghost.id    = 'drag-ghost';
    Object.assign(ghost.style, {
      position:      'fixed',
      width:         rect.width + 'px',
      height:        rect.height + 'px',
      top:           rect.top + 'px',
      left:          rect.left + 'px',
      opacity:       '0.88',
      pointerEvents: 'none',
      zIndex:        '500',
      transform:     'scale(1.06)',
      boxShadow:     '0 8px 30px rgba(0,0,0,0.5)',
      transition:    'none',
    });
    document.body.appendChild(ghost);
    drag.ghost = ghost;

    btn.style.opacity = '0.3';
    navigator.vibrate?.(40);
  }, 420);
}

function dragTouchMove(e) {
  const touch = e.touches[0];

  if (!drag.active) {
    if (drag.longPressTimer) {
      const dx = touch.clientX - drag.startX;
      const dy = touch.clientY - drag.startY;
      if (Math.sqrt(dx * dx + dy * dy) > 8) {
        clearTimeout(drag.longPressTimer);
        drag.longPressTimer = null;
      }
    }
    return;
  }

  e.preventDefault();

  drag.ghost.style.left = (touch.clientX - drag.offsetX) + 'px';
  drag.ghost.style.top  = (touch.clientY - drag.offsetY) + 'px';

  drag.ghost.style.display = 'none';
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  drag.ghost.style.display = '';

  const overBtn = el?.closest('[data-act-id]');
  document.querySelectorAll('[data-act-id].drag-over').forEach(b => b.classList.remove('drag-over'));

  if (overBtn && overBtn.dataset.actId !== drag.actId) {
    overBtn.classList.add('drag-over');
    drag.overActId = overBtn.dataset.actId;
  } else {
    drag.overActId = null;
  }
}

function dragTouchEnd() {
  clearTimeout(drag.longPressTimer);

  if (drag.active && drag.overActId && drag.actId !== drag.overActId) {
    // Lock in displayed order if smart sort was on, then turn it off
    if (state.settings.smartSort) {
      state.activities       = sortedActivities();
      state.settings.smartSort = false;
      showToast('Auto-sort off — order saved');
    }

    const fromIdx = state.activities.findIndex(a => a.id === drag.actId);
    const toIdx   = state.activities.findIndex(a => a.id === drag.overActId);

    if (fromIdx !== -1 && toIdx !== -1) {
      const [moved] = state.activities.splice(fromIdx, 1);
      state.activities.splice(toIdx, 0, moved);
      save();
    }

    renderTrack();
  }

  dragCleanup();
}

function dragCancel() {
  clearTimeout(drag.longPressTimer);
  dragCleanup();
}

function dragCleanup() {
  if (drag.ghost)    drag.ghost.remove();
  if (drag.originEl) drag.originEl.style.opacity = '';
  document.querySelectorAll('[data-act-id].drag-over').forEach(b => b.classList.remove('drag-over'));
  drag.active         = false;
  drag.actId          = null;
  drag.overActId      = null;
  drag.ghost          = null;
  drag.originEl       = null;
  drag.longPressTimer = null;
}

// ============================================================
// RENDER: LOG
// ============================================================

function renderLog(date) {
  state.logDate = date;
  const today = todayStr();

  const label   = document.getElementById('log-date-label');
  const list    = document.getElementById('log-entries');
  const summary = document.getElementById('log-summary');
  const nextBtn = document.getElementById('log-next-btn');

  if (label)   label.textContent = fmtDate(date);
  if (nextBtn) nextBtn.disabled  = date >= today;

  const saved = entriesForDate(date)
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  const display = [...saved];
  if (date === today && state.activeEntry) display.push({ ...state.activeEntry });

  if (!display.length) {
    if (list) list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>No entries for ${fmtDate(date)}</p>
      </div>
    `;
    if (summary) summary.innerHTML = '';
    return;
  }

  if (list) {
    list.innerHTML = display.map(entry => {
      const act  = getActivity(entry.activityId);
      const ms   = durationMs(entry);
      const live = !entry.endTime;
      const tagsHtml = renderActivityTags(act);
      return `
        <div class="log-entry" style="border-left-color: ${act?.color || '#64748b'}">
          <div class="log-entry-icon">${act?.icon || '•'}</div>
          <div class="log-entry-info">
            <div class="log-entry-name">${act?.name || 'Unknown'}</div>
            <div class="log-entry-time">
              ${formatTimeStr(entry.startTime)} – ${live ? 'now' : formatTimeStr(entry.endTime)}
            </div>
            ${tagsHtml ? `<div class="log-entry-tags">${tagsHtml}</div>` : ''}
            ${entry.note ? `<div class="log-entry-note">📝 ${entry.note}</div>` : ''}
          </div>
          <div class="log-entry-right">
            <div class="log-entry-duration ${live ? 'pulsing' : ''}">${fmtDuration(ms)}</div>
            ${act?.billable ? '<div class="log-tag">$</div>' : ''}
            ${!live ? `
              <button class="log-note-btn" onclick="editEntryNote('${entry.id}')" title="${entry.note ? 'Edit note' : 'Add note'}">📝</button>
              <button class="log-delete" onclick="deleteEntry('${entry.id}')">&#215;</button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  const totalMs    = saved.reduce((s, e) => s + durationMs(e), 0);
  const billableMs = saved.filter(e => getActivity(e.activityId)?.billable).reduce((s, e) => s + durationMs(e), 0);
  const deepMs     = saved.filter(e => getActivity(e.activityId)?.deepWork).reduce((s, e) => s + durationMs(e), 0);

  if (summary) {
    summary.innerHTML = `
      <div class="log-summary-grid">
        <div class="summary-item">
          <div class="summary-value">${fmtHours(totalMs)}</div>
          <div class="summary-label">Total</div>
        </div>
        <div class="summary-item">
          <div class="summary-value" style="color:#10b981">${fmtHours(billableMs)}</div>
          <div class="summary-label">Billable</div>
        </div>
        <div class="summary-item">
          <div class="summary-value" style="color:#8b5cf6">${fmtHours(deepMs)}</div>
          <div class="summary-label">Deep Work</div>
        </div>
      </div>
    `;
  }
}

function editEntryNote(entryId) {
  const entry = state.entries.find(e => e.id === entryId);
  if (!entry) return;
  openModal(`
    <div class="note-modal">
      <h3>${entry.note ? 'Edit Note' : 'Add Note'}</h3>
      <p class="modal-subtitle">Add context to this time entry</p>
      <div class="input-group">
        <textarea id="edit-note-text" rows="4" placeholder="What were you working on?">${entry.note || ''}</textarea>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="saveEditedNote('${entryId}')">Save</button>
      </div>
    </div>
  `);
}

function saveEditedNote(entryId) {
  const entry = state.entries.find(e => e.id === entryId);
  if (entry) {
    entry.note = document.getElementById('edit-note-text')?.value?.trim() || '';
    save();
  }
  closeModal();
  renderLog(state.logDate);
  showToast('Note saved');
}

function changeLogDate(delta) {
  const d = new Date(state.logDate + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  const next = d.toISOString().split('T')[0];
  if (next <= todayStr()) renderLog(next);
}

function deleteEntry(id) {
  state.entries = state.entries.filter(e => e.id !== id);
  save();
  renderLog(state.logDate);
  showToast('Entry deleted');
}

// ============================================================
// RENDER: TODAY DASHBOARD
// ============================================================

function renderToday() {
  const today = todayStr();
  const saved = entriesForDate(today);
  const note  = state.notes[today];

  const all = state.activeEntry ? [...saved, { ...state.activeEntry }] : saved;

  const totalMs    = all.reduce((s, e) => s + durationMs(e), 0);
  const billableMs = all.filter(e => getActivity(e.activityId)?.billable).reduce((s, e) => s + durationMs(e), 0);
  const deepMs     = all.filter(e => getActivity(e.activityId)?.deepWork).reduce((s, e) => s + durationMs(e), 0);

  const billGoalMs = state.settings.dailyBillableGoal * 3600000;
  const deepGoalMs = state.settings.dailyDeepWorkGoal * 3600000;
  const billPct    = Math.min(100, Math.round((billableMs / billGoalMs) * 100));
  const deepPct    = Math.min(100, Math.round((deepMs     / deepGoalMs) * 100));
  const utilPct    = totalMs > 0 ? Math.round((billableMs / totalMs) * 100) : 0;

  renderTodayChart(all);

  const metricsEl = document.getElementById('today-metrics');
  if (metricsEl) {
    metricsEl.innerHTML = `
      <div class="metric-card">
        <div class="metric-value">${fmtHours(totalMs)}</div>
        <div class="metric-label">Tracked Today</div>
      </div>
      <div class="metric-card">
        <div class="metric-value" style="color:#10b981">${fmtHours(billableMs)}</div>
        <div class="metric-label">Billable</div>
        <div class="metric-bar"><div class="metric-bar-fill" style="width:${billPct}%;background:#10b981"></div></div>
        <div class="metric-goal">${billPct}% of ${state.settings.dailyBillableGoal}h goal</div>
      </div>
      <div class="metric-card">
        <div class="metric-value" style="color:#8b5cf6">${fmtHours(deepMs)}</div>
        <div class="metric-label">Deep Work</div>
        <div class="metric-bar"><div class="metric-bar-fill" style="width:${deepPct}%;background:#8b5cf6"></div></div>
        <div class="metric-goal">${deepPct}% of ${state.settings.dailyDeepWorkGoal}h goal</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${utilPct}%</div>
        <div class="metric-label">Utilization</div>
      </div>
    `;
  }

  const wbEl = document.getElementById('today-wellbeing');
  if (wbEl) {
    if (note) {
      wbEl.innerHTML = `
        <div class="wellbeing-display">
          <div class="wellbeing-row">
            <span>Energy</span>
            <div class="wellbeing-dots">
              ${[1,2,3,4,5].map(i => `<span class="wdot ${i <= (note.energy||0) ? 'active' : ''}"></span>`).join('')}
            </div>
          </div>
          <div class="wellbeing-row">
            <span>Wellbeing</span>
            <div class="wellbeing-dots">
              ${[1,2,3,4,5].map(i => `<span class="wdot ${i <= (note.wellbeing||0) ? 'active' : ''}"></span>`).join('')}
            </div>
          </div>
          ${note.win   ? `<div class="wellbeing-win"><strong>Win: </strong>${note.win}</div>` : ''}
          ${note.focus ? `<div class="wellbeing-focus"><strong>Tomorrow: </strong>${note.focus}</div>` : ''}
          <button class="btn-text" onclick="showWellbeingModal()">Edit check-in</button>
        </div>
      `;
    } else {
      wbEl.innerHTML = `
        <div class="wellbeing-prompt">
          <span>💚</span>
          <div>
            <strong>Daily Check-in</strong>
            <p>Track energy &amp; wellbeing — takes 30 sec</p>
          </div>
          <button class="btn-primary btn-sm" onclick="showWellbeingModal()">Check In</button>
        </div>
      `;
    }
  }
}

function renderTodayChart(entries) {
  const canvas  = document.getElementById('today-chart');
  const emptyEl = document.getElementById('today-chart-empty');
  if (!canvas) return;

  const byAct = {};
  entries.forEach(e => {
    const act = getActivity(e.activityId);
    if (!act) return;
    if (!byAct[act.id]) byAct[act.id] = { name: act.name, color: act.color, ms: 0 };
    byAct[act.id].ms += durationMs(e);
  });

  const data = Object.values(byAct).filter(d => d.ms > 0);
  if (state.todayChart) { state.todayChart.destroy(); state.todayChart = null; }

  if (!data.length) {
    canvas.style.display = 'none';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  canvas.style.display = '';
  if (emptyEl) emptyEl.classList.add('hidden');

  state.todayChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels:   data.map(d => d.name),
      datasets: [{
        data:            data.map(d => Math.round(d.ms / 60000)),
        backgroundColor: data.map(d => d.color),
        borderColor:     '#1e293b',
        borderWidth:     2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 10, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const mins = ctx.parsed;
              const h = Math.floor(mins / 60), m = mins % 60;
              return ` ${h > 0 ? h + 'h ' : ''}${m}m`;
            },
          },
        },
      },
      cutout: '58%',
    },
  });
}

// ============================================================
// RENDER: WEEK DASHBOARD
// ============================================================

function renderWeek() {
  const start       = weekStartStr(todayStr());
  const dates       = getWeekDates(start);
  const today       = todayStr();
  const weekEntries = state.entries.filter(e => dates.includes(e.date));

  const totalMs    = weekEntries.reduce((s, e) => s + durationMs(e), 0);
  const billableMs = weekEntries.filter(e => getActivity(e.activityId)?.billable).reduce((s, e) => s + durationMs(e), 0);
  const deepMs     = weekEntries.filter(e => getActivity(e.activityId)?.deepWork).reduce((s, e) => s + durationMs(e), 0);

  const workDays = dates.filter(d => d <= today).length || 1;
  const utilPct  = totalMs > 0 ? Math.round((billableMs / totalMs) * 100) : 0;
  const deepPct  = totalMs > 0 ? Math.round((deepMs     / totalMs) * 100) : 0;

  renderWeekChart(dates, today);

  const metricsEl = document.getElementById('week-metrics');
  if (metricsEl) {
    const notes = dates.map(d => state.notes[d]).filter(Boolean);
    const avgWB = notes.length ? (notes.reduce((s, n) => s + (n.wellbeing || 0), 0) / notes.length).toFixed(1) : null;
    const avgEn = notes.length ? (notes.reduce((s, n) => s + (n.energy    || 0), 0) / notes.length).toFixed(1) : null;

    metricsEl.innerHTML = `
      <div class="metric-card">
        <div class="metric-value">${fmtHours(totalMs)}</div>
        <div class="metric-label">Total This Week</div>
      </div>
      <div class="metric-card">
        <div class="metric-value" style="color:#10b981">${fmtHours(billableMs)}</div>
        <div class="metric-label">Billable</div>
        <div class="metric-goal">${utilPct}% utilization</div>
      </div>
      <div class="metric-card">
        <div class="metric-value" style="color:#8b5cf6">${fmtHours(deepMs)}</div>
        <div class="metric-label">Deep Work</div>
        <div class="metric-goal">${deepPct}% of tracked</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${fmtHours(totalMs / workDays)}</div>
        <div class="metric-label">Avg / Day</div>
      </div>
      ${avgWB ? `
      <div class="metric-card">
        <div class="metric-value" style="color:#06b6d4">${avgWB}/5</div>
        <div class="metric-label">Avg Wellbeing</div>
      </div>
      <div class="metric-card">
        <div class="metric-value" style="color:#f43f5e">${avgEn}/5</div>
        <div class="metric-label">Avg Energy</div>
      </div>
      ` : ''}
    `;
  }

  const wbEl = document.getElementById('week-wellbeing');
  if (wbEl) {
    const hasNotes = dates.some(d => state.notes[d]);
    if (hasNotes) {
      wbEl.innerHTML = `
        <div class="wins-title">Daily Check-ins</div>
        <div class="week-checkins">
          ${dates.map(d => {
            const n      = state.notes[d];
            const day    = new Date(d + 'T00:00:00').toLocaleDateString([], { weekday: 'short' });
            const future = d > today;
            return `
              <div class="day-checkin ${future ? 'future' : ''}">
                <div class="day-checkin-label">${day}</div>
                ${n
                  ? `<div class="day-checkin-dots" title="Energy ${n.energy}/5, Wellbeing ${n.wellbeing}/5">
                      ${'●'.repeat(n.energy || 0)}${'○'.repeat(5 - (n.energy || 0))}
                    </div>`
                  : `<div class="day-checkin-empty">${future ? '–' : '○'}</div>`
                }
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      wbEl.innerHTML = `
        <div class="wellbeing-prompt">
          <span>💚</span>
          <div><p>Complete daily check-ins to see wellbeing trends</p></div>
        </div>
      `;
    }
  }

  renderInsights(dates, totalMs, billableMs, deepMs);
}

function renderInsights(dates, totalMs, billableMs, deepMs) {
  const el = document.getElementById('week-insights');
  if (!el) return;

  const insights = [];
  const today    = todayStr();
  const notes    = dates.map(d => state.notes[d]).filter(Boolean);
  const billGoal = state.settings.dailyBillableGoal * 3600000 * 5;
  const deepGoal = state.settings.dailyDeepWorkGoal * 3600000 * 5;

  const billPct = billGoal > 0 ? (billableMs / billGoal) * 100 : 0;
  if (billPct >= 100) {
    insights.push({ type: 'success', text: `🎯 You've hit your billable hours goal this week!` });
  } else if (billPct < 50 && dates.filter(d => d <= today).length >= 3) {
    insights.push({ type: 'warning', text: `📊 Billable hours at ${Math.round(billPct)}% of goal — you may need to push this week.` });
  }

  const deepPct = deepGoal > 0 ? (deepMs / deepGoal) * 100 : 0;
  if (deepPct >= 80) {
    insights.push({ type: 'success', text: `🧠 Strong deep work focus this week (${Math.round(deepPct)}% of goal).` });
  } else if (deepPct < 40 && dates.filter(d => d <= today).length >= 3) {
    insights.push({ type: 'warning', text: `🧠 Deep work is low (${Math.round(deepPct)}% of goal). Try blocking morning hours.` });
  }

  if (notes.length >= 3) {
    const avgEn = notes.reduce((s, n) => s + (n.energy || 0), 0) / notes.length;
    const avgWB = notes.reduce((s, n) => s + (n.wellbeing || 0), 0) / notes.length;
    if (avgEn < 2.5)      insights.push({ type: 'warning', text: `⚡ Your energy has been low this week. Consider rest, movement, or schedule changes.` });
    else if (avgEn >= 4)  insights.push({ type: 'success', text: `✨ High energy all week — your routine is working well.` });
    if (avgWB < 2.5)      insights.push({ type: 'warning', text: `💙 Wellbeing dipped this week. Protect time for rest and things you enjoy.` });
  }

  const daysTracked = dates.filter(d => d <= today && entriesForDate(d).length > 0).length;
  const daysElapsed = dates.filter(d => d <= today).length;
  if (daysElapsed >= 3 && daysTracked < daysElapsed - 1) {
    insights.push({ type: 'warning', text: `📋 Tracking missed on ${daysElapsed - daysTracked} days this week. Consistent data improves insights.` });
  }

  el.innerHTML = insights.map(ins =>
    `<div class="insight-card insight-${ins.type}">${ins.text}</div>`
  ).join('') || '';
}

function renderWeekChart(dates, today) {
  const canvas = document.getElementById('week-chart');
  if (!canvas) return;

  const labels = dates.map(d => {
    const name = new Date(d + 'T00:00:00').toLocaleDateString([], { weekday: 'short' });
    return d === today ? name + ' ●' : name;
  });

  const billableData = dates.map(d =>
    +(entriesForDate(d).filter(e => getActivity(e.activityId)?.billable)
      .reduce((s, e) => s + durationMs(e), 0) / 3600000).toFixed(1)
  );
  const nonBillData = dates.map(d =>
    +(entriesForDate(d).filter(e => !getActivity(e.activityId)?.billable)
      .reduce((s, e) => s + durationMs(e), 0) / 3600000).toFixed(1)
  );

  if (state.weekChart) { state.weekChart.destroy(); state.weekChart = null; }

  state.weekChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Billable',     data: billableData, backgroundColor: '#10b981', borderRadius: 4 },
        { label: 'Non-Billable', data: nonBillData,  backgroundColor: '#334155', borderRadius: 4 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        x: { stacked: true, ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: 'rgba(71,85,105,0.3)' } },
        y: { stacked: true, ticks: { color: '#94a3b8', callback: v => v + 'h', font: { size: 11 } }, grid: { color: 'rgba(71,85,105,0.3)' } },
      },
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}h` } },
      },
    },
  });
}

// ============================================================
// RENDER: SETTINGS
// ============================================================

function renderSettings() {
  const el = document.getElementById('settings-content');
  if (!el) return;

  el.innerHTML = `
    <div class="settings-section">
      <h3>Tags</h3>
      <div class="tags-list">
        ${state.tags.map(t => `
          <div class="tag-item">
            <span class="tag-item-dot" style="background:${t.color}"></span>
            <span class="tag-item-name">${t.name}</span>
            <div class="tag-item-actions">
              <button class="btn-icon" onclick="showTagModal('${t.id}')">&#9998;</button>
              <button class="btn-icon btn-danger" onclick="deleteTag('${t.id}')">&#215;</button>
            </div>
          </div>
        `).join('')}
        ${state.tags.length === 0 ? '<p class="no-items-hint">No tags yet. Create one below.</p>' : ''}
      </div>
      <button class="btn-outline btn-full" onclick="showTagModal(null)">+ New Tag</button>
    </div>

    <div class="settings-section">
      <h3>Activities</h3>
      <div class="activities-list">
        ${state.activities.map(a => {
          const actTagsHtml = (a.tags || []).map(tagId => {
            const tag = state.tags.find(t => t.id === tagId);
            return tag
              ? `<span class="tag-pill" style="background:${tag.color}22;color:${tag.color};border-color:${tag.color}55">${tag.name}</span>`
              : '';
          }).join('');
          return `
            <div class="activity-item">
              <div class="activity-item-left">
                <span class="activity-item-icon">${a.icon}</span>
                <div>
                  <div class="activity-item-name">${a.name}</div>
                  <div class="activity-item-tags">
                    ${a.billable ? '<span class="tag tag-sm tag-billable">Billable</span>' : ''}
                    ${a.deepWork ? '<span class="tag tag-sm tag-deep">Deep Work</span>'   : ''}
                    ${actTagsHtml}
                  </div>
                </div>
              </div>
              <div class="activity-item-right">
                <div class="activity-color-dot" style="background:${a.color}"></div>
                <button class="btn-icon" onclick="showActivityModal('${a.id}')">&#9998;</button>
                <button class="btn-icon btn-danger" onclick="deleteActivity('${a.id}')">&#215;</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <button class="btn-outline btn-full" onclick="showActivityModal(null)">+ Add Activity</button>
    </div>

    <div class="settings-section">
      <h3>Smart Sort</h3>
      <div class="toggle-row">
        <div>
          <div style="font-size:14px;color:var(--text)">Auto-sort by most used</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">Activities you use most appear first</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="smart-sort-toggle" ${state.settings.smartSort ? 'checked' : ''} onchange="toggleSmartSort(this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <div class="settings-section">
      <h3>Daily Goals</h3>
      <div class="goal-input">
        <label>Billable Hours Target</label>
        <div class="input-row">
          <input type="number" id="goal-billable" value="${state.settings.dailyBillableGoal}" min="1" max="24" step="0.5">
          <span>hours / day</span>
        </div>
      </div>
      <div class="goal-input">
        <label>Deep Work Target</label>
        <div class="input-row">
          <input type="number" id="goal-deep" value="${state.settings.dailyDeepWorkGoal}" min="1" max="12" step="0.5">
          <span>hours / day</span>
        </div>
      </div>
      <div class="goal-input">
        <label>Break Reminder</label>
        <div class="input-row">
          <input type="number" id="goal-break" value="${state.settings.breakReminderMins}" min="30" max="240" step="15">
          <span>min of deep work</span>
        </div>
      </div>
      <button class="btn-primary btn-full" style="margin-top:12px" onclick="saveSettings()">Save Goals</button>
    </div>

    <div class="settings-section">
      <h3>Data</h3>
      <button class="btn-outline btn-full" onclick="exportCSV()">&#8681; Export as CSV</button>
      <button class="btn-outline btn-full btn-danger-outline" onclick="confirmClear()">Clear All Data</button>
    </div>

    <div class="settings-footer">TimeFlow · Data stored locally on your device</div>
  `;
}

function toggleSmartSort(value) {
  state.settings.smartSort = value;
  save();
  if (state.currentTab === 'track') renderTrack();
  showToast(value ? 'Smart sort on' : 'Smart sort off');
}

function saveSettings() {
  const bill = parseFloat(document.getElementById('goal-billable')?.value);
  const deep = parseFloat(document.getElementById('goal-deep')?.value);
  const brk  = parseInt(document.getElementById('goal-break')?.value);
  if (bill > 0) state.settings.dailyBillableGoal = bill;
  if (deep > 0) state.settings.dailyDeepWorkGoal = deep;
  if (brk  > 0) state.settings.breakReminderMins = brk;
  save();
  showToast('Goals saved');
}

// ---- TAG MODAL ----

const PALETTE = ['#6366f1','#8b5cf6','#f59e0b','#10b981','#06b6d4','#f43f5e','#f97316','#0ea5e9','#64748b','#ec4899'];

function showTagModal(id) {
  const tag          = id ? state.tags.find(t => t.id === id) : null;
  const currentColor = tag?.color || PALETTE[0];

  openModal(`
    <div class="activity-modal">
      <h3>${tag ? 'Edit Tag' : 'New Tag'}</h3>
      <div class="input-group">
        <label>Tag Name</label>
        <input type="text" id="tag-name" value="${tag?.name || ''}" placeholder="e.g. Urgent">
      </div>
      <div class="input-group">
        <label>Color</label>
        <div class="color-picker">
          ${PALETTE.map(c => `
            <button class="color-swatch ${c === currentColor ? 'active' : ''}"
                    style="background:${c}"
                    data-color="${c}"
                    onclick="selectColor('${c}')"></button>
          `).join('')}
        </div>
        <input type="hidden" id="act-color" value="${currentColor}">
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="saveTag('${id || ''}')">Save</button>
      </div>
    </div>
  `);
}

function saveTag(id) {
  const name  = document.getElementById('tag-name')?.value?.trim();
  const color = document.getElementById('act-color')?.value || PALETTE[0];
  if (!name) { showToast('Please enter a tag name'); return; }

  if (id) {
    const idx = state.tags.findIndex(t => t.id === id);
    if (idx !== -1) state.tags[idx] = { ...state.tags[idx], name, color };
  } else {
    state.tags.push({ id: uid(), name, color });
  }

  save();
  closeModal();
  renderSettings();
  if (state.currentTab === 'track') renderTrack();
  showToast(id ? 'Tag updated' : 'Tag created');
}

function deleteTag(id) {
  state.tags = state.tags.filter(t => t.id !== id);
  state.activities.forEach(a => { a.tags = (a.tags || []).filter(tid => tid !== id); });
  save();
  renderSettings();
  showToast('Tag deleted');
}

// ---- ACTIVITY MODAL ----

function showActivityModal(id) {
  const a            = id ? state.activities.find(x => x.id === id) : null;
  const currentColor = a?.color || PALETTE[0];
  const actTags      = a?.tags || [];

  openModal(`
    <div class="activity-modal">
      <h3>${a ? 'Edit Activity' : 'New Activity'}</h3>
      <div class="input-group">
        <label>Emoji Icon</label>
        <input type="text" id="act-icon" value="${a?.icon || '📌'}" maxlength="2" class="icon-input">
      </div>
      <div class="input-group">
        <label>Name</label>
        <input type="text" id="act-name" value="${a?.name || ''}" placeholder="e.g. Research">
      </div>
      <div class="input-group">
        <label>Color</label>
        <div class="color-picker">
          ${PALETTE.map(c => `
            <button class="color-swatch ${c === currentColor ? 'active' : ''}"
                    style="background:${c}"
                    data-color="${c}"
                    onclick="selectColor('${c}')"></button>
          `).join('')}
        </div>
        <input type="hidden" id="act-color" value="${currentColor}">
      </div>
      <div class="input-group">
        <div class="toggle-row">
          <label>Billable</label>
          <label class="toggle">
            <input type="checkbox" id="act-billable" ${a?.billable ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="toggle-row">
          <label>Deep Work</label>
          <label class="toggle">
            <input type="checkbox" id="act-deep" ${a?.deepWork ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
      ${state.tags.length > 0 ? `
      <div class="input-group">
        <label>Tags</label>
        <div class="tag-selector">
          ${state.tags.map(tag => `
            <button type="button"
                    class="tag-chip ${actTags.includes(tag.id) ? 'selected' : ''}"
                    data-tag-id="${tag.id}"
                    style="--tag-color:${tag.color}"
                    onclick="this.classList.toggle('selected')">
              ${tag.name}
            </button>
          `).join('')}
        </div>
      </div>
      ` : ''}
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="saveActivity('${id || ''}')">Save</button>
      </div>
    </div>
  `);
}

function selectColor(color) {
  const input = document.getElementById('act-color');
  if (input) input.value = color;
  document.querySelectorAll('.color-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.color === color);
  });
}

function saveActivity(id) {
  const icon     = document.getElementById('act-icon')?.value?.trim()  || '📌';
  const name     = document.getElementById('act-name')?.value?.trim();
  const color    = document.getElementById('act-color')?.value          || PALETTE[0];
  const billable = document.getElementById('act-billable')?.checked     || false;
  const deepWork = document.getElementById('act-deep')?.checked         || false;
  const tags     = [...document.querySelectorAll('.tag-chip.selected')].map(c => c.dataset.tagId);

  if (!name) { showToast('Please enter a name'); return; }

  if (id) {
    const idx = state.activities.findIndex(a => a.id === id);
    if (idx !== -1) state.activities[idx] = { ...state.activities[idx], icon, name, color, billable, deepWork, tags };
  } else {
    state.activities.push({ id: uid(), icon, name, color, billable, deepWork, tags, useCount: 0 });
  }

  save();
  closeModal();
  renderSettings();
  if (state.currentTab === 'track') renderTrack();
}

function deleteActivity(id) {
  if (state.activities.length <= 1) { showToast('Need at least one activity'); return; }
  state.activities = state.activities.filter(a => a.id !== id);
  if (state.activeEntry?.activityId === id) stopTimer();
  save();
  renderSettings();
  showToast('Activity deleted');
}

// ---- WELLBEING MODAL ----

function showWellbeingModal() {
  const note = state.notes[todayStr()] || {};
  state.tempRatings = { energy: note.energy || 0, wellbeing: note.wellbeing || 0 };

  openModal(`
    <div class="wellbeing-modal">
      <h3>Daily Check-in</h3>
      <p class="modal-subtitle">How's your day going?</p>

      <div class="rating-group">
        <label>Energy Level</label>
        <div class="star-rating" id="energy-stars">
          ${[1,2,3,4,5].map(i => `
            <button class="star ${(note.energy||0) >= i ? 'active' : ''}"
                    onclick="setRating('energy', ${i})">&#9679;</button>
          `).join('')}
        </div>
      </div>

      <div class="rating-group">
        <label>Wellbeing</label>
        <div class="star-rating" id="wellbeing-stars">
          ${[1,2,3,4,5].map(i => `
            <button class="star ${(note.wellbeing||0) >= i ? 'active' : ''}"
                    onclick="setRating('wellbeing', ${i})">&#9679;</button>
          `).join('')}
        </div>
      </div>

      <div class="input-group">
        <label>Today's Win</label>
        <textarea id="win-input" rows="2" placeholder="What went well today?">${note.win || ''}</textarea>
      </div>

      <div class="input-group">
        <label>Tomorrow's Focus</label>
        <input type="text" id="focus-input" placeholder="Top priority for tomorrow" value="${note.focus || ''}">
      </div>

      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Skip</button>
        <button class="btn-primary" onclick="saveWellbeing()">Save</button>
      </div>
    </div>
  `);
}

function setRating(type, value) {
  state.tempRatings[type] = value;
  const containerId = type === 'energy' ? 'energy-stars' : 'wellbeing-stars';
  const container   = document.getElementById(containerId);
  if (container) {
    container.querySelectorAll('.star').forEach((star, i) => {
      star.classList.toggle('active', i < value);
    });
  }
}

function saveWellbeing() {
  const today = todayStr();
  state.notes[today] = {
    date:      today,
    energy:    state.tempRatings.energy    || 0,
    wellbeing: state.tempRatings.wellbeing || 0,
    win:       document.getElementById('win-input')?.value?.trim()   || '',
    focus:     document.getElementById('focus-input')?.value?.trim() || '',
  };
  state.tempRatings = {};
  save();
  closeModal();
  showToast('Check-in saved');
  if (state.currentTab === 'today') renderToday();
  if (state.currentTab === 'week')  renderWeek();
}

// ---- DATA EXPORT ----

function exportCSV() {
  const headers = ['Date','Activity','Start','End','Duration (min)','Billable','Deep Work','Tags','Note'];
  const rows = state.entries.map(e => {
    const act  = getActivity(e.activityId);
    const mins = Math.round(durationMs(e) / 60000);
    const tags = (act?.tags || [])
      .map(tid => state.tags.find(t => t.id === tid)?.name || '')
      .filter(Boolean).join('; ');
    return [
      e.date,
      act?.name || 'Unknown',
      formatTimeStr(e.startTime),
      e.endTime ? formatTimeStr(e.endTime) : '',
      mins,
      act?.billable ? 'Yes' : 'No',
      act?.deepWork ? 'Yes' : 'No',
      `"${tags}"`,
      `"${(e.note || '').replace(/"/g, '""')}"`,
    ].join(',');
  });

  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `timeflow-${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported');
}

function confirmClear() {
  openModal(`
    <div class="confirm-modal">
      <h3>Clear All Data?</h3>
      <p>This permanently deletes all time entries and daily notes. This cannot be undone.</p>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-danger" onclick="clearAllData()">Delete Everything</button>
      </div>
    </div>
  `);
}

function clearAllData() {
  state.entries     = [];
  state.notes       = {};
  state.activeEntry = null;
  save();
  closeModal();
  renderSettings();
  renderTrack();
  showToast('All data cleared');
}

// ---- MODAL ----

function openModal(html) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  if (!overlay || !content) return;
  content.innerHTML = html;
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.add('hidden');
  document.body.style.overflow = '';
  state.tempRatings = {};
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('modal-overlay') ||
      e.target === document.querySelector('.modal-container')) {
    closeModal();
  }
}

// ---- TOAST ----

function showToast(msg) {
  let t = document.getElementById('toast');
  if (t) t.remove();
  t = document.createElement('div');
  t.id = 'toast';
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => t.classList.add('show'));
  });
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2500);
}

// ============================================================
// INIT
// ============================================================

function init() {
  load();

  const updateClock = () => {
    const el = document.getElementById('current-time');
    if (el) el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  updateClock();
  setInterval(updateClock, 30000);

  if (state.activeEntry) startTimerTick();

  updateHeaderDot();
  renderTrack();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
