(() => {
  const API = String(window.TASK_API_URL || '').replace(/\/$/, '');
  const $ = (selector) => document.querySelector(selector);
  const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const state = { token: sessionStorage.getItem('taskforgex_token'), user: null, tasks: [], authMode: 'login', filter: 'all', query: '', newTaskStatus: 'todo', view: 'home', calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1), selectedDate: todayKey() };
  const esc = (value = '') => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

  function setAlert(element, message = '', type = 'error') { element.textContent = message; element.classList.toggle('hidden', !message); element.classList.toggle('success', type === 'success'); }
  function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.remove('hidden'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.add('hidden'), 2800); }
  function setTheme(theme) {
    const selected = theme === 'light' ? 'light' : 'dark';
    document.body.dataset.theme = selected;
    localStorage.setItem('taskforgex_theme', selected);
    $('#themeIcon').textContent = selected === 'dark' ? '☀' : '☾';
    $('#themeLabel').textContent = selected === 'dark' ? 'Day' : 'Night';
    $('#themeToggle').setAttribute('aria-label', `Switch to ${selected === 'dark' ? 'day' : 'night'} theme`);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', selected === 'dark' ? '#101116' : '#f7f8fc');
  }
  async function api(path, options = {}) {
    if (!API) throw new Error('Set the API URL in frontend/config.js first.');
    const headers = { 'Content-Type': 'application/json', ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}), ...options.headers };
    const response = await fetch(`${API}${path}`, { ...options, headers });
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { if (response.status === 401 && state.token) logout(false); throw new Error(payload.error || 'Something went wrong.'); }
    return payload;
  }

  function setAuthMode(mode) {
    state.authMode = mode;
    document.querySelectorAll('.auth-tab').forEach(tab => tab.classList.toggle('selected', tab.dataset.authMode === mode));
    $('#authTitle').textContent = mode === 'login' ? 'Welcome back' : 'Create your account';
    $('#authDescription').textContent = mode === 'login' ? 'Sign in and pick up where you left off.' : 'Start turning your plans into progress.';
    $('#nameField').classList.toggle('hidden', mode !== 'register');
    $('#nameInput').required = mode === 'register';
    $('#passwordInput').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    $('#authSubmit').innerHTML = `${mode === 'login' ? 'Sign in' : 'Create account'} <span>→</span>`;
    setAlert($('#authAlert'));
  }

  async function onAuthSubmit(event) {
    event.preventDefault(); setAlert($('#authAlert'));
    const submit = $('#authSubmit'); submit.disabled = true; submit.textContent = 'Please wait...';
    const body = { email: $('#emailInput').value.trim(), password: $('#passwordInput').value };
    if (state.authMode === 'register') body.name = $('#nameInput').value.trim();
    try {
      const result = await api(`/auth/${state.authMode}`, { method: 'POST', body: JSON.stringify(body) });
      state.token = result.token; state.user = result.user; sessionStorage.setItem('taskforgex_token', state.token);
      await showDashboard();
    } catch (error) { setAlert($('#authAlert'), error.message); }
    finally { submit.disabled = false; setAuthMode(state.authMode); }
  }

  function logout(showNotice = true) {
    state.token = null; state.user = null; state.tasks = []; sessionStorage.removeItem('taskforgex_token');
    $('#dashboardView').classList.add('hidden'); $('#authView').classList.remove('hidden'); $('#profileButton').classList.add('hidden'); $('#profilePopover').classList.add('hidden');
    if (showNotice) toast('You have signed out.');
  }

  async function showDashboard() {
    $('#authView').classList.add('hidden'); $('#dashboardView').classList.remove('hidden'); $('#profileButton').classList.remove('hidden');
    const name = state.user?.name || 'there';
    $('#welcomeName').textContent = name.split(' ')[0]; $('#userAvatar').textContent = name.slice(0, 1).toUpperCase();
    $('#sideName').textContent = name; $('#sideAvatar').textContent = name.slice(0, 1).toUpperCase();
    $('#railAvatar').textContent = name.slice(0, 1).toUpperCase();
    $('#profileMenuName').textContent = name; $('#profileMenuEmail').textContent = state.user?.email || '';
    $('#profileNameInput').value = name; $('#profileEmailInput').value = state.user?.email || '';
    await loadTasks();
  }

  async function loadTasks() {
    try { const result = await api('/tasks'); state.tasks = result.tasks; render(); setAlert($('#appAlert')); }
    catch (error) { setAlert($('#appAlert'), error.message); }
  }

  function prettyDate(date) {
    if (!date) return 'No date';
    const parsed = new Date(`${date}T00:00:00`);
    return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function readableDate(date, options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) {
    return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, options);
  }

  function render() {
    const today = todayKey();
    const filtered = state.tasks.filter(task => (state.filter === 'all' || task.status === state.filter) && (!state.query || `${task.title} ${task.description || ''}`.toLowerCase().includes(state.query)));
    const done = state.tasks.filter(task => task.status === 'done').length;
    $('#totalCount').textContent = state.tasks.length;
    $('#progressCount').textContent = state.tasks.filter(task => task.status === 'in_progress').length;
    $('#doneCount').textContent = done;
    $('#todayCount').textContent = state.tasks.filter(task => task.due_date === today && task.status !== 'done').length;
    $('#completionText').textContent = `${done} / ${state.tasks.length} complete`;
    $('#sidebarTotalCount').textContent = state.tasks.length;
    $('#sidebarTodoCount').textContent = state.tasks.filter(task => task.status === 'todo').length;
    const cardMarkup = task => `<article class="kanban-card ${task.status === 'done' ? 'is-done' : ''}" data-id="${task.id}" draggable="true" tabindex="0" aria-label="${esc(task.title)}. Drag to move between columns.">
      <div class="card-topline"><span class="priority ${esc(task.priority)}"><i></i>${esc(task.priority)}</span><button class="delete-button" data-action="delete" aria-label="Delete task" title="Delete task">×</button></div>
      <b class="card-title">${esc(task.title)}</b>${task.description ? `<p class="card-description">${esc(task.description)}</p>` : ''}
      <div class="card-footer"><span class="due-date ${task.due_date && task.due_date < today ? 'overdue' : ''}">▦ ${esc(prettyDate(task.due_date))}</span><select class="card-move" data-action="status" aria-label="Move task to another column"><option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To do</option><option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In progress</option><option value="done" ${task.status === 'done' ? 'selected' : ''}>Done</option></select></div>
    </article>`;
    const lanes = { todo: $('#todoColumn'), in_progress: $('#progressColumn'), done: $('#doneColumn') };
    const countIds = { todo: '#todoColumnCount', in_progress: '#progressColumnCount', done: '#doneColumnCount' };
    Object.entries(lanes).forEach(([status, lane]) => {
      const laneTasks = filtered.filter(task => task.status === status);
      $(countIds[status]).textContent = laneTasks.length;
      lane.innerHTML = laneTasks.length ? laneTasks.map(cardMarkup).join('') : '<div class="lane-empty">Drop a task here</div>';
    });
    const empty = filtered.length === 0;
    $('#emptyState').classList.toggle('hidden', !empty);
    $('#emptyTitle').textContent = state.query ? 'No tasks found' : state.tasks.length ? 'Nothing in this view' : 'A fresh start';
    $('#emptyDescription').textContent = state.query ? 'Try another search term.' : state.tasks.length ? 'Try another filter, or create a task.' : 'Create your first task and make today count.';
    $('#emptyAddButton').classList.toggle('hidden', Boolean(state.query));
    renderActivityHeatmap();
    const isCalendar = state.view === 'calendar'; const isHome = state.view === 'home';
    $('#kanbanBoard').classList.toggle('hidden', isCalendar || isHome);
    $('#emptyState').classList.toggle('hidden', isCalendar || isHome || !empty);
    $('.progress-note').classList.toggle('hidden', isCalendar || isHome);
    $('#calendarView').classList.toggle('hidden', !isCalendar);
    $('#homeOverview').classList.toggle('hidden', !isHome);
    $('.stats-grid').classList.toggle('hidden', !isHome); $('.activity-panel').classList.toggle('hidden', !isHome);
    $('#viewTitle').textContent = isCalendar ? 'Calendar' : isHome ? 'Home' : 'My workspace';
    $('#viewDescription').textContent = isCalendar ? 'See your deadlines and plan what comes next.' : isHome ? 'Your tasks, schedule and progress in one place.' : 'Drag cards between columns to update their status.';
    $('#navHome').classList.toggle('selected', isHome);
    $('#navBoard').classList.toggle('selected', !isCalendar && !isHome && state.filter !== 'todo');
    $('#navTodo').classList.toggle('selected', !isCalendar && !isHome && state.filter === 'todo');
    $('#navCalendar').classList.toggle('selected', isCalendar);
    $('#boardViewButton').classList.toggle('active', !isCalendar);
    $('#calendarViewButton').classList.toggle('active', isCalendar);
    $('#railBoard').classList.toggle('active', !isCalendar);
    $('#railCalendar').classList.toggle('active', isCalendar);
    if (isCalendar) renderCalendar();
    renderHome(); renderNotifications();
  }

  function renderHome() {
    const today = todayKey();
    const upcoming = state.tasks.filter(task => task.status !== 'done' && task.due_date && task.due_date >= today).sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 4);
    $('#homeUpcomingList').innerHTML = upcoming.length ? upcoming.map(task => `<div class="home-task-row"><span class="agenda-task-dot ${esc(task.status)}"></span><span><b>${esc(task.title)}</b><small>${esc(prettyDate(task.due_date))} · ${esc(task.status.replace('_', ' '))}</small></span><i class="priority-dot ${esc(task.priority)}"></i></div>`).join('') : '<div class="home-no-tasks">No upcoming due dates. Add a task with a due date to see it here.</div>';
  }

  function renderNotifications() {
    const today = todayKey(); const limit = new Date(); limit.setDate(limit.getDate() + 7); const end = `${limit.getFullYear()}-${String(limit.getMonth()+1).padStart(2,'0')}-${String(limit.getDate()).padStart(2,'0')}`;
    const upcoming = state.tasks.filter(task => task.status !== 'done' && task.due_date && task.due_date <= end).sort((a,b) => a.due_date.localeCompare(b.due_date)).slice(0,5);
    const badge = $('#notificationBadge'); badge.textContent = upcoming.length; badge.classList.toggle('hidden', !upcoming.length);
    $('#notificationList').innerHTML = upcoming.length ? upcoming.map(task => `<button class="notification-item" data-notification-date="${esc(task.due_date)}"><b>${esc(task.title)}</b><small>${task.due_date < today ? 'Overdue' : task.due_date === today ? 'Due today' : `Due ${esc(prettyDate(task.due_date))}`}</small></button>`).join('') : '<p class="notification-empty">All clear. No tasks due soon.</p>';
  }

  function renderActivityHeatmap() {
    const counts = new Map();
    state.tasks.forEach(task => {
      const key = String(task.created_at || '').slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) counts.set(key, (counts.get(key) || 0) + 1);
    });
    const today = new Date();
    const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const firstDay = new Date(weekStart); firstDay.setDate(firstDay.getDate() - 77);
    const cells = []; const months = []; let previousMonth = -1; let total = 0;
    for (let i = 0; i < 84; i += 1) {
      const date = new Date(firstDay); date.setDate(firstDay.getDate() + i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const count = counts.get(key) || 0; total += count;
      const level = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count <= 4 ? 3 : 4;
      cells.push(`<i class="heat-cell heat-${level}" title="${esc(readableDate(key))}: ${count} ${count === 1 ? 'task' : 'tasks'} created"></i>`);
      if (date.getMonth() !== previousMonth) {
        months.push(`<span style="grid-column:${Math.floor(i / 7) + 1}">${date.toLocaleDateString(undefined, { month: 'short' })}</span>`);
        previousMonth = date.getMonth();
      }
    }
    $('#heatmapGrid').innerHTML = cells.join('');
    $('#heatmapMonths').innerHTML = months.join('');
    $('#activityTotal').textContent = total;
    const countsByStatus = { todo: 0, in_progress: 0, done: 0 };
    state.tasks.forEach(task => { countsByStatus[task.status] = (countsByStatus[task.status] || 0) + 1; });
    $('#workflowNote').textContent = `${countsByStatus.todo} to do · ${countsByStatus.in_progress} in progress · ${countsByStatus.done} done`;
  }

  function renderCalendar() {
    const year = state.calendarMonth.getFullYear(); const month = state.calendarMonth.getMonth();
    $('#calendarMonthLabel').textContent = state.calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7;
    const startDate = new Date(year, month, 1 - firstOffset);
    const filteredTasks = state.tasks.filter(task => (state.filter === 'all' || task.status === state.filter) && (!state.query || `${task.title} ${task.description || ''}`.toLowerCase().includes(state.query)));
    const cells = [];
    for (let i = 0; i < 42; i += 1) {
      const date = new Date(startDate); date.setDate(startDate.getDate() + i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const tasks = filteredTasks.filter(task => task.due_date === key);
      const previews = tasks.slice(0, 2).map(task => `<span class="calendar-task-chip ${esc(task.status)}"><i></i>${esc(task.title)}</span>`).join('');
      const more = tasks.length > 2 ? `<span class="calendar-more">+${tasks.length - 2} more</span>` : '';
      cells.push(`<button class="calendar-day ${date.getMonth() !== month ? 'outside-month' : ''} ${key === todayKey() ? 'is-today' : ''} ${key === state.selectedDate ? 'is-selected' : ''}" data-calendar-date="${key}" aria-label="${esc(readableDate(key))}, ${tasks.length} tasks">
        <span class="calendar-day-number">${date.getDate()}</span>${tasks.length ? `<span class="calendar-task-count">${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}</span>` : ''}<span class="calendar-chip-stack">${previews}${more}</span>
      </button>`);
    }
    $('#calendarGrid').innerHTML = cells.join('');
    const selectedTasks = filteredTasks.filter(task => task.due_date === state.selectedDate);
    $('#agendaDateLabel').textContent = readableDate(state.selectedDate, { weekday: 'long', month: 'short', day: 'numeric' });
    $('#agendaCount').textContent = selectedTasks.length ? `${selectedTasks.length} ${selectedTasks.length === 1 ? 'task' : 'tasks'} scheduled` : 'A clear day. Make it count.';
    $('#agendaList').innerHTML = selectedTasks.length ? selectedTasks.map(task => `<article class="agenda-task ${esc(task.status)}"><span class="agenda-task-dot"></span><div><b>${esc(task.title)}</b><small>${esc(task.status.replace('_', ' '))} · ${esc(task.priority)} priority</small></div></article>`).join('') : '<div class="agenda-empty"><span>✦</span><b>No tasks scheduled</b><small>Add a task for this day to see it here.</small></div>';
  }

  async function createTask(event) {
    event.preventDefault(); const button = $('#saveTaskButton'); button.disabled = true; button.textContent = 'Saving...';
    const body = { title: $('#taskTitle').value.trim(), description: $('#taskDescription').value.trim(), status: state.newTaskStatus, priority: $('#taskPriority').value, due_date: $('#taskDueDate').value || null };
    try {
      const result = await api('/tasks', { method: 'POST', body: JSON.stringify(body) });
      state.tasks.unshift(result.task); render(); $('#taskDialog').close(); $('#taskForm').reset(); $('#taskPriority').value = 'medium'; toast('Task added to your list.');
    } catch (error) { setAlert($('#appAlert'), error.message); }
    finally { button.disabled = false; button.textContent = 'Create task'; }
  }

  async function onTaskAction(event) {
    const control = event.target.closest('[data-action]'); if (!control) return;
    const row = control.closest('[data-id]'); const task = state.tasks.find(item => String(item.id) === row.dataset.id); if (!task) return;
    try {
      if (control.dataset.action === 'delete') {
        if (!window.confirm(`Delete “${task.title}”?`)) return;
        await api(`/tasks/${task.id}`, { method: 'DELETE' }); state.tasks = state.tasks.filter(item => item.id !== task.id); toast('Task deleted.');
      } else {
        const status = control.value;
        const result = await api(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
        state.tasks = state.tasks.map(item => item.id === task.id ? result.task : item);
        if (status === 'done') toast('Nice work. Task completed!');
      }
      render();
    } catch (error) { setAlert($('#appAlert'), error.message); }
  }

  async function moveTask(taskId, status) {
    const task = state.tasks.find(item => String(item.id) === String(taskId));
    if (!task || task.status === status) { render(); return; }
    try {
      const result = await api(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      state.tasks = state.tasks.map(item => item.id === task.id ? result.task : item);
      render();
      if (status === 'done') toast('Nice work. Task completed!');
    } catch (error) { setAlert($('#appAlert'), error.message); render(); }
  }

  function onDragStart(event) {
    const card = event.target.closest('.kanban-card'); if (!card) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', card.dataset.id);
    card.classList.add('dragging');
  }
  function onDragEnd(event) {
    const card = event.target.closest('.kanban-card');
    if (card) card.classList.remove('dragging');
    document.querySelectorAll('.column-cards.drag-over').forEach(lane => lane.classList.remove('drag-over'));
  }
  function onDragOver(event) {
    const lane = event.target.closest('[data-drop-status]'); if (!lane) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'move'; lane.classList.add('drag-over');
  }
  function onDragLeave(event) {
    const lane = event.target.closest('[data-drop-status]');
    if (lane && !lane.contains(event.relatedTarget)) lane.classList.remove('drag-over');
  }
  function onDrop(event) {
    const lane = event.target.closest('[data-drop-status]'); if (!lane) return;
    event.preventDefault(); lane.classList.remove('drag-over');
    const id = event.dataTransfer.getData('text/plain');
    if (id) moveTask(id, lane.dataset.dropStatus);
  }

  function openDialog(event) { state.newTaskStatus = event?.currentTarget?.dataset?.status || 'todo'; $('#taskDueDate').value = state.view === 'calendar' ? state.selectedDate : ''; $('#taskDialog').showModal(); $('#taskTitle').focus(); }

  async function init() {
    setTheme(localStorage.getItem('taskforgex_theme') || 'dark');
    $('#todayLabel').textContent = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    $('#themeToggle').addEventListener('click', () => setTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark'));
    document.querySelectorAll('.auth-tab').forEach(tab => tab.addEventListener('click', () => setAuthMode(tab.dataset.authMode)));
    $('#authForm').addEventListener('submit', onAuthSubmit);
    $('#logoutButton').addEventListener('click', () => logout());
    $('#sideLogoutButton').addEventListener('click', () => logout());
    $('#brandHome').addEventListener('click', event => { event.preventDefault(); if (state.token) { state.view = 'home'; render(); } });
    $('#navHome').addEventListener('click', () => { state.view = 'home'; state.filter = 'all'; $('#filterSelect').value = 'all'; render(); });
    $('#newTaskButton').addEventListener('click', openDialog); $('#emptyAddButton').addEventListener('click', openDialog);
    document.querySelectorAll('[data-new-task]').forEach(button => button.addEventListener('click', openDialog));
    $('#closeDialog').addEventListener('click', () => $('#taskDialog').close()); $('#cancelDialog').addEventListener('click', () => $('#taskDialog').close());
    $('#taskForm').addEventListener('submit', createTask);
    $('#kanbanBoard').addEventListener('click', onTaskAction); $('#kanbanBoard').addEventListener('change', onTaskAction);
    $('#kanbanBoard').addEventListener('dragstart', onDragStart); $('#kanbanBoard').addEventListener('dragend', onDragEnd);
    $('#kanbanBoard').addEventListener('dragover', onDragOver); $('#kanbanBoard').addEventListener('dragleave', onDragLeave); $('#kanbanBoard').addEventListener('drop', onDrop);
    $('#filterSelect').addEventListener('change', event => { state.filter = event.target.value; render(); });
    $('#searchInput').addEventListener('input', event => { state.query = event.target.value.trim().toLowerCase(); render(); });
    $('#navBoard').addEventListener('click', () => { state.view = 'board'; state.filter = 'all'; $('#filterSelect').value = 'all'; render(); });
    $('#navTodo').addEventListener('click', () => { state.view = 'board'; state.filter = 'todo'; $('#filterSelect').value = 'todo'; render(); });
    $('#navCalendar').addEventListener('click', () => { state.view = 'calendar'; state.filter = 'all'; $('#filterSelect').value = 'all'; render(); });
    $('#boardViewButton').addEventListener('click', () => { state.view = 'board'; render(); });
    $('#calendarViewButton').addEventListener('click', () => { state.view = 'calendar'; state.filter = 'all'; $('#filterSelect').value = 'all'; render(); });
    $('#railBoard').addEventListener('click', () => $('#navBoard').click());
    $('#railCalendar').addEventListener('click', () => $('#navCalendar').click());
    $('#railAdd').addEventListener('click', openDialog);
    const openProfile = () => { $('#profilePopover').classList.add('hidden'); $('#profileDialog').showModal(); };
    $('#profileButton').addEventListener('click', () => $('#profilePopover').classList.toggle('hidden'));
    $('#editProfileButton').addEventListener('click', openProfile); $('#sideEditProfileButton').addEventListener('click', openProfile);
    $('#closeProfileDialog').addEventListener('click', () => $('#profileDialog').close()); $('#cancelProfileDialog').addEventListener('click', () => $('#profileDialog').close());
    $('#profileForm').addEventListener('submit', async event => {
      event.preventDefault(); const button = $('#saveProfileButton'); button.disabled = true; button.textContent = 'Saving...';
      try { const result = await api('/auth/profile', { method: 'PATCH', body: JSON.stringify({ name: $('#profileNameInput').value.trim() }) }); state.user = result.user; await showDashboard(); $('#profileDialog').close(); toast('Profile updated.'); }
      catch (error) { toast(error.message); } finally { button.disabled = false; button.textContent = 'Save changes'; }
    });
    $('#howItWorksButton').addEventListener('click', () => $('#helpDialog').showModal()); $('#helpCenterButton').addEventListener('click', () => $('#helpDialog').showModal());
    $('#feedbackButton').addEventListener('click', () => $('#feedbackDialog').showModal());
    $('#closeFeedbackDialog').addEventListener('click', () => $('#feedbackDialog').close()); $('#cancelFeedbackDialog').addEventListener('click', () => $('#feedbackDialog').close());
    $('#feedbackForm').addEventListener('submit', async event => { event.preventDefault(); const button = $('#sendFeedbackButton'); button.disabled = true; button.textContent = 'Sending...';
      try { await api('/feedback', { method: 'POST', body: JSON.stringify({ message: $('#feedbackMessage').value.trim() }) }); $('#feedbackDialog').close(); $('#feedbackForm').reset(); toast('Thanks for your feedback!'); }
      catch (error) { toast(error.message); } finally { button.disabled = false; button.textContent = 'Send feedback'; }
    });
    $('#notificationButton').addEventListener('click', () => $('#notificationPopover').classList.toggle('hidden'));
    $('#notificationList').addEventListener('click', event => { const item = event.target.closest('[data-notification-date]'); if (!item) return; state.selectedDate = item.dataset.notificationDate; const d = new Date(`${state.selectedDate}T00:00:00`); state.calendarMonth = new Date(d.getFullYear(), d.getMonth(), 1); state.view = 'calendar'; $('#notificationPopover').classList.add('hidden'); render(); });
    $('#homeNewTask').addEventListener('click', openDialog); $('#homeOpenBoard').addEventListener('click', () => $('#navBoard').click()); $('#homeOpenCalendar').addEventListener('click', () => $('#navCalendar').click());
    document.addEventListener('click', event => { if (!event.target.closest('.popover-wrap')) { $('#notificationPopover').classList.add('hidden'); $('#profilePopover').classList.add('hidden'); } });
    $('#calendarGrid').addEventListener('click', event => { const day = event.target.closest('[data-calendar-date]'); if (!day) return; state.selectedDate = day.dataset.calendarDate; renderCalendar(); });
    $('#calendarPrev').addEventListener('click', () => { state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() - 1, 1); renderCalendar(); });
    $('#calendarNext').addEventListener('click', () => { state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() + 1, 1); renderCalendar(); });
    $('#calendarToday').addEventListener('click', () => { const now = new Date(); state.calendarMonth = new Date(now.getFullYear(), now.getMonth(), 1); state.selectedDate = todayKey(); renderCalendar(); });
    $('#calendarAddButton').addEventListener('click', openDialog);
    if (state.token) {
      try { const result = await api('/auth/me'); state.user = result.user; await showDashboard(); }
      catch { logout(false); }
    }
  }
  document.addEventListener('DOMContentLoaded', init);
})();
