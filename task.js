let tasksByDate = {};           // "YYYY-MM-DD": [ {id, text, completed, progress} ]
  let weeklyGoalsByWeek = {};     // weekKey (monday) -> []
  let monthlyGoalsByMonth = {};    // "YYYY-MM" -> []

  // Streak data: lastCompletedDate & streakCount
  let streakData = {
    count: 0,
    lastCompletedDate: null    // YYYY-MM-DD
  };

  let currentSelectedDate = null;
  let currentCalendarYear = 2026;
  let currentCalendarMonth = 3;

  // ----- helpers -----
  function formatDateKey(date) {
    let y = date.getFullYear();
    let m = String(date.getMonth() + 1).padStart(2, '0');
    let d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getTodayKey() {
    return formatDateKey(new Date());
  }

  function getWeekKeyFromDateStr(dateStr) {
    if (!dateStr) return null;
    let parts = dateStr.split('-');
    let d = new Date(parts[0], parts[1] - 1, parts[2]);
    let day = d.getDay();
    let diff = d.getDate() - day + (day === 0 ? -6 : 1);
    let monday = new Date(d.setDate(diff));
    return formatDateKey(monday);
  }

  function getMonthKey(dateStr) {
    if (!dateStr) return null;
    return dateStr.substring(0, 7);
  }

  // ----- STREAK LOGIC (based on daily tasks fully completed) -----
  function isDateFullyCompleted(dateKey) {
    let tasks = tasksByDate[dateKey] || [];
    if (tasks.length === 0) return false;
    return tasks.every(task => task.completed === true);
  }

  function updateStreakBasedOnToday() {
    const todayKey = getTodayKey();
    const isTodayComplete = isDateFullyCompleted(todayKey);
    if (!streakData.lastCompletedDate) {
      if (isTodayComplete) {
        streakData.count = 1;
        streakData.lastCompletedDate = todayKey;
      } else {
        streakData.count = 0;
      }
      saveStreak();
      renderStreakUI();
      return;
    }

    // calculate expected next day
    const lastDate = new Date(streakData.lastCompletedDate);
    const todayDate = new Date(todayKey);
    const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

    if (isTodayComplete) {
      if (diffDays === 1) {
        streakData.count += 1;
        streakData.lastCompletedDate = todayKey;
      } else if (diffDays === 0) {
        // already counted today, do nothing
      } else if (diffDays > 1) {
        streakData.count = 1;
        streakData.lastCompletedDate = todayKey;
      } else if (diffDays < 0) {
        // shouldn't happen
      }
    } else {
      // today not complete, but if last completed date is older than today and not consecutive, we reset only when a day is missed?
      // According to streak logic: if last completed date is yesterday but today incomplete, streak broken only after missing a day.
      if (diffDays >= 1 && !isTodayComplete) {
        // missed a day (yesterday completed but today not)
        streakData.count = 0;
        streakData.lastCompletedDate = null;
      }
    }
    saveStreak();
    renderStreakUI();
  }

  // re-evaluate streak whenever tasks change (for selected date that might be today)
  function reevaluateStreakForDate(dateKey) {
    if (dateKey === getTodayKey()) {
      updateStreakBasedOnToday();
    }
  }

  function saveStreak() {
    localStorage.setItem('serene_streak', JSON.stringify(streakData));
  }

  function loadStreak() {
    const stored = localStorage.getItem('serene_streak');
    if (stored) {
      streakData = JSON.parse(stored);
    } else {
      streakData = { count: 0, lastCompletedDate: null };
    }
    renderStreakUI();
  }

  function resetStreak() {
    streakData.count = 0;
    streakData.lastCompletedDate = null;
    saveStreak();
    renderStreakUI();
  }

  function renderStreakUI() {
    document.getElementById('streakCountDisplay').innerText = streakData.count;
  }

  // ----- PERSISTENCE -----
  function loadAllData() {
    const storedDaily = localStorage.getItem('serene_daily_tasks');
    if (storedDaily) tasksByDate = JSON.parse(storedDaily);
    else {
      const todayKey = getTodayKey();
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowKey = formatDateKey(tomorrow);
      tasksByDate = {
        [todayKey]: [
          { id: 'd1', text: '🌼 morning pages', completed: false, progress: 20 },
          { id: 'd2', text: '📖 read 15min', completed: false, progress: 0 },
        ],
        [tomorrowKey]: [
          { id: 'd3', text: '💧 plan the week', completed: false, progress: 0 },
        ]
      };
      // consistency
      for (let d in tasksByDate) {
        tasksByDate[d] = tasksByDate[d].map(t => {
          if (t.completed) t.progress = 100;
          if (!t.completed && t.progress >= 100) t.completed = true;
          if (t.progress === undefined) t.progress = t.completed ? 100 : 0;
          return t;
        });
      }
    }

    const storedWeekly = localStorage.getItem('serene_weekly_goals');
    if (storedWeekly) weeklyGoalsByWeek = JSON.parse(storedWeekly);
    const storedMonthly = localStorage.getItem('serene_monthly_goals');
    if (storedMonthly) monthlyGoalsByMonth = JSON.parse(storedMonthly);
  }

  function saveDaily() {
    localStorage.setItem('serene_daily_tasks', JSON.stringify(tasksByDate));
  }
  function saveWeekly() { localStorage.setItem('serene_weekly_goals', JSON.stringify(weeklyGoalsByWeek)); }
  function saveMonthly() { localStorage.setItem('serene_monthly_goals', JSON.stringify(monthlyGoalsByMonth)); }

  // ----- DAILY TASK CRUD -----
  function getTasksForDate(dateKey) { return tasksByDate[dateKey] || []; }
  function setTasksForDate(dateKey, tasks) { tasksByDate[dateKey] = tasks; saveDaily(); }

  function addTaskToSelected(text) {
    if (!currentSelectedDate) { alert("Select a date from calendar"); return false; }
    if (!text.trim()) return false;
    let tasks = getTasksForDate(currentSelectedDate);
    tasks.push({ id: Date.now() + '-' + Math.random(), text: text.trim(), completed: false, progress: 0 });
    setTasksForDate(currentSelectedDate, tasks);
    renderTaskPanel();
    reevaluateStreakForDate(currentSelectedDate);
    renderCalendar();  // update streak icons on calendar
    return true;
  }

  function deleteTask(taskId) {
    if (!currentSelectedDate) return;
    let tasks = getTasksForDate(currentSelectedDate);
    tasks = tasks.filter(t => t.id != taskId);
    setTasksForDate(currentSelectedDate, tasks);
    renderTaskPanel();
    reevaluateStreakForDate(currentSelectedDate);
    renderCalendar();
  }

  function toggleTaskCompletion(taskId, completed) {
    if (!currentSelectedDate) return;
    let tasks = getTasksForDate(currentSelectedDate);
    const task = tasks.find(t => t.id == taskId);
    if (task) {
      task.completed = completed;
      task.progress = completed ? 100 : (task.progress === 100 ? 0 : task.progress);
      setTasksForDate(currentSelectedDate, tasks);
      renderTaskPanel();
      reevaluateStreakForDate(currentSelectedDate);
      renderCalendar();
    }
  }

  function updateTaskProgress(taskId, newProgress) {
    if (!currentSelectedDate) return;
    let tasks = getTasksForDate(currentSelectedDate);
    const task = tasks.find(t => t.id == taskId);
    if (task) {
      task.progress = newProgress;
      task.completed = (newProgress >= 100);
      setTasksForDate(currentSelectedDate, tasks);
      renderTaskPanel();
      reevaluateStreakForDate(currentSelectedDate);
      renderCalendar();
    }
  }

  // ----- WEEKLY GOALS (similar pattern)-----
  function getWeeklyForDate(dateStr) { const wk = getWeekKeyFromDateStr(dateStr); return weeklyGoalsByWeek[wk] || []; }
  function setWeeklyForDate(dateStr, goals) { const wk = getWeekKeyFromDateStr(dateStr); weeklyGoalsByWeek[wk] = goals; saveWeekly(); }
  function addWeeklyToSelected(text) {
    if (!currentSelectedDate) { alert("Select a date"); return false; }
    if (!text.trim()) return false;
    let goals = getWeeklyForDate(currentSelectedDate);
    goals.push({ id: Date.now() + '-w', text: text.trim(), completed: false, progress: 0 });
    setWeeklyForDate(currentSelectedDate, goals);
    renderWeeklyPanel();
    return true;
  }
  function deleteWeekly(taskId) {
    if (!currentSelectedDate) return;
    let goals = getWeeklyForDate(currentSelectedDate);
    goals = goals.filter(g => g.id != taskId);
    setWeeklyForDate(currentSelectedDate, goals);
    renderWeeklyPanel();
  }
  function toggleWeeklyCompletion(taskId, completed) {
    if (!currentSelectedDate) return;
    let goals = getWeeklyForDate(currentSelectedDate);
    const goal = goals.find(g => g.id == taskId);
    if (goal) { goal.completed = completed; goal.progress = completed ? 100 : (goal.progress === 100 ? 0 : goal.progress); setWeeklyForDate(currentSelectedDate, goals); renderWeeklyPanel(); }
  }
  function updateWeeklyProgress(taskId, val) {
    if (!currentSelectedDate) return;
    let goals = getWeeklyForDate(currentSelectedDate);
    const goal = goals.find(g => g.id == taskId);
    if (goal) { goal.progress = val; goal.completed = val >= 100; setWeeklyForDate(currentSelectedDate, goals); renderWeeklyPanel(); }
  }

  // ----- MONTHLY GOALS -----
  function getMonthlyForDate(dateStr) { const mk = getMonthKey(dateStr); return monthlyGoalsByMonth[mk] || []; }
  function setMonthlyForDate(dateStr, goals) { const mk = getMonthKey(dateStr); monthlyGoalsByMonth[mk] = goals; saveMonthly(); }
  function addMonthlyToSelected(text) {
    if (!currentSelectedDate) return false;
    let goals = getMonthlyForDate(currentSelectedDate);
    goals.push({ id: Date.now() + '-m', text: text.trim(), completed: false, progress: 0 });
    setMonthlyForDate(currentSelectedDate, goals);
    renderMonthlyPanel();
    return true;
  }
  function deleteMonthly(taskId) {
    if (!currentSelectedDate) return;
    let goals = getMonthlyForDate(currentSelectedDate);
    goals = goals.filter(g => g.id != taskId);
    setMonthlyForDate(currentSelectedDate, goals);
    renderMonthlyPanel();
  }
  function toggleMonthlyCompletion(taskId, completed) {
    if (!currentSelectedDate) return;
    let goals = getMonthlyForDate(currentSelectedDate);
    const goal = goals.find(g => g.id == taskId);
    if (goal) { goal.completed = completed; goal.progress = completed ? 100 : (goal.progress === 100 ? 0 : goal.progress); setMonthlyForDate(currentSelectedDate, goals); renderMonthlyPanel(); }
  }
  function updateMonthlyProgress(taskId, val) {
    if (!currentSelectedDate) return;
    let goals = getMonthlyForDate(currentSelectedDate);
    const goal = goals.find(g => g.id == taskId);
    if (goal) { goal.progress = val; goal.completed = val >= 100; setMonthlyForDate(currentSelectedDate, goals); renderMonthlyPanel(); }
  }

  // ----- RENDER PANELS (daily, weekly, monthly) -----
  function renderTaskPanel() {
    const container = document.getElementById('taskListContainer');
    const badge = document.getElementById('selectedDateBadge');
    const statsSpan = document.getElementById('progressStats');
    if (!currentSelectedDate) { badge.innerText = '📌 no date selected'; container.innerHTML = '<li class="empty-message">🌸 pick a day</li>'; statsSpan.innerText = '0% completed'; return; }
    badge.innerText = `📌 selected: ${currentSelectedDate}`;
    const tasks = getTasksForDate(currentSelectedDate);
    if (!tasks.length) { container.innerHTML = '<li class="empty-message">✨ add a gentle intention ✨</li>'; statsSpan.innerText = '0% completed'; return; }
    let completedCount = tasks.filter(t => t.completed).length;
    let totalProgress = tasks.reduce((sum, t) => sum + (t.progress || 0), 0);
    let avg = Math.round(totalProgress / tasks.length);
    statsSpan.innerHTML = `📊 ${completedCount}/${tasks.length} done · avg ${avg}%`;
    container.innerHTML = '';
    tasks.forEach(task => {
      const li = document.createElement('li'); li.className = 'task-item';
      const leftDiv = document.createElement('div'); leftDiv.className = 'task-info';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'task-check'; cb.checked = task.completed;
      cb.addEventListener('change', (e) => toggleTaskCompletion(task.id, e.target.checked));
      const textSpan = document.createElement('span'); textSpan.className = `task-text ${task.completed ? 'completed' : ''}`; textSpan.innerText = task.text;
      leftDiv.append(cb, textSpan);
      const progressCtrl = document.createElement('div'); progressCtrl.className = 'progress-control';
      const slider = document.createElement('input'); slider.type = 'range'; slider.min = 0; slider.max = 100; slider.value = task.progress; slider.className = 'progress-slider';
      const percSpan = document.createElement('span'); percSpan.className = 'progress-percent'; percSpan.innerText = `${task.progress}%`;
      slider.addEventListener('input', (e) => { percSpan.innerText = e.target.value + '%'; updateTaskProgress(task.id, parseInt(e.target.value)); });
      progressCtrl.append(document.createElement('span'), slider, percSpan);
      progressCtrl.firstChild.innerText = 'progress'; progressCtrl.firstChild.className = 'progress-label';
      const delBtn = document.createElement('button'); delBtn.innerHTML = '✕'; delBtn.className = 'delete-task'; delBtn.onclick = () => deleteTask(task.id);
      li.append(leftDiv, progressCtrl, delBtn);
      container.appendChild(li);
    });
  }

  function renderGoalList(container, summarySpan, tasks, onToggle, onProgress, onDelete) {
    if (!tasks.length) { container.innerHTML = '<li class="empty-message">✨ add a goal ✨</li>'; summarySpan.innerText = '0% completed'; return; }
    let completed = tasks.filter(t => t.completed).length;
    let avg = Math.round(tasks.reduce((s,t)=>s+(t.progress||0),0)/tasks.length);
    summarySpan.innerText = `📊 ${completed}/${tasks.length} done · avg ${avg}%`;
    container.innerHTML = '';
    tasks.forEach(task => {
      const li = document.createElement('li'); li.className = 'task-item';
      const left = document.createElement('div'); left.className = 'task-info';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = task.completed; cb.className = 'task-check';
      cb.addEventListener('change', (e) => onToggle(task.id, e.target.checked));
      const txt = document.createElement('span'); txt.className = `task-text ${task.completed ? 'completed' : ''}`; txt.innerText = task.text;
      left.append(cb, txt);
      const ctrl = document.createElement('div'); ctrl.className = 'progress-control';
      const slider = document.createElement('input'); slider.type = 'range'; slider.min = 0; slider.max = 100; slider.value = task.progress; slider.className = 'progress-slider';
      const perc = document.createElement('span'); perc.className = 'progress-percent'; perc.innerText = `${task.progress}%`;
      slider.addEventListener('input', (e) => { perc.innerText = e.target.value + '%'; onProgress(task.id, parseInt(e.target.value)); });
      ctrl.append(document.createElement('span'), slider, perc); ctrl.firstChild.innerText = 'progress'; ctrl.firstChild.className = 'progress-label';
      const del = document.createElement('button'); del.innerHTML = '✕'; del.className = 'delete-task'; del.onclick = () => onDelete(task.id);
      li.append(left, ctrl, del);
      container.appendChild(li);
    });
  }

  function renderWeeklyPanel() {
    const container = document.getElementById('weeklyListContainer');
    const badge = document.getElementById('selectedWeekBadge');
    const summary = document.getElementById('weeklyProgressStats');
    if (!currentSelectedDate) { badge.innerText = '📌 no date'; container.innerHTML = '<li class="empty-message">select date</li>'; summary.innerText = '0%'; return; }
    const wk = getWeekKeyFromDateStr(currentSelectedDate);
    badge.innerText = `📌 week starting: ${wk}`;
    const goals = getWeeklyForDate(currentSelectedDate);
    renderGoalList(container, summary, goals, toggleWeeklyCompletion, updateWeeklyProgress, deleteWeekly);
  }

  function renderMonthlyPanel() {
    const container = document.getElementById('monthlyListContainer');
    const badge = document.getElementById('selectedMonthBadge');
    const summary = document.getElementById('monthlyProgressStats');
    if (!currentSelectedDate) { badge.innerText = '📌 no date'; container.innerHTML = '<li class="empty-message">select date</li>'; summary.innerText = '0%'; return; }
    const mk = getMonthKey(currentSelectedDate);
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthIdx = parseInt(mk.split('-')[1])-1;
    badge.innerText = `📌 month: ${monthNames[monthIdx]} ${mk.split('-')[0]}`;
    const goals = getMonthlyForDate(currentSelectedDate);
    renderGoalList(container, summary, goals, toggleMonthlyCompletion, updateMonthlyProgress, deleteMonthly);
  }

  // ----- CALENDAR with streak marker -----
  function renderCalendar() {
    const monthYearSpan = document.getElementById('monthYearDisplay');
    const container = document.getElementById('calendarDaysContainer');
    const monthNamesFull = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    monthYearSpan.innerText = `${monthNamesFull[currentCalendarMonth]} ${currentCalendarYear}`;
    const firstDay = new Date(currentCalendarYear, currentCalendarMonth, 1);
    let startWeekday = firstDay.getDay();
    let offset = startWeekday === 0 ? 6 : startWeekday - 1;
    const daysInMonth = new Date(currentCalendarYear, currentCalendarMonth + 1, 0).getDate();
    const prevMonthDate = new Date(currentCalendarYear, currentCalendarMonth, 0);
    const daysInPrev = prevMonthDate.getDate();
    let cells = [];
    for (let i = offset-1; i>=0; i--) { const d = daysInPrev - i; const dateObj = new Date(currentCalendarYear, currentCalendarMonth-1, d); cells.push({ day: d, isCurrent: false, dateKey: formatDateKey(dateObj) }); }
    for (let d=1; d<=daysInMonth; d++) { const dateObj = new Date(currentCalendarYear, currentCalendarMonth, d); cells.push({ day: d, isCurrent: true, dateKey: formatDateKey(dateObj) }); }
    while (cells.length < 42) { const nextDay = cells.length - daysInMonth - offset + 1; const dateObj = new Date(currentCalendarYear, currentCalendarMonth+1, nextDay); cells.push({ day: nextDay, isCurrent: false, dateKey: formatDateKey(dateObj) }); }
    container.innerHTML = '';
    cells.forEach(cell => {
      const div = document.createElement('div');
      div.className = `cal-day ${!cell.isCurrent ? 'other-month' : ''} ${currentSelectedDate === cell.dateKey ? 'selected' : ''}`;
      const isStreakDate = (streakData.lastCompletedDate === cell.dateKey && isDateFullyCompleted(cell.dateKey));
      if (isStreakDate) div.classList.add('streak-completed');
      div.innerText = cell.day;
      div.addEventListener('click', () => { currentSelectedDate = cell.dateKey; renderCalendar(); renderTaskPanel(); renderWeeklyPanel(); renderMonthlyPanel(); });
      container.appendChild(div);
    });
  }

  function prevMonth() { let nm = currentCalendarMonth-1; let ny = currentCalendarYear; if(nm<0){nm=11; ny--;} currentCalendarMonth=nm; currentCalendarYear=ny; renderCalendar(); }
  function nextMonth() { let nm = currentCalendarMonth+1; let ny = currentCalendarYear; if(nm>11){nm=0; ny++;} currentCalendarMonth=nm; currentCalendarYear=ny; renderCalendar(); }

  // ----- EVENT LISTENERS & INIT -----
  document.getElementById('addTaskBtn').onclick = () => { const inp = document.getElementById('newTaskInput'); if(addTaskToSelected(inp.value)) inp.value=''; else if(!currentSelectedDate) alert('Pick a date'); };
  document.getElementById('addWeeklyBtn').onclick = () => { const inp = document.getElementById('newWeeklyInput'); if(addWeeklyToSelected(inp.value)) inp.value=''; else alert('Select date first'); };
  document.getElementById('addMonthlyBtn').onclick = () => { const inp = document.getElementById('newMonthlyInput'); if(addMonthlyToSelected(inp.value)) inp.value=''; else alert('Select date first'); };
  document.getElementById('globalAddTaskBtn').onclick = () => { if(currentSelectedDate) document.getElementById('newTaskInput').focus(); else alert('Pick a date first'); };
  document.getElementById('prevMonthBtn').onclick = prevMonth;
  document.getElementById('nextMonthBtn').onclick = nextMonth;
  document.getElementById('resetStreakBtn').onclick = () => resetStreak();

  function init() {
    loadAllData();
    loadStreak();
    const today = new Date();
    currentCalendarYear = today.getFullYear();
    currentCalendarMonth = today.getMonth();
    currentSelectedDate = getTodayKey();
    renderCalendar();
    renderTaskPanel();
    renderWeeklyPanel();
    renderMonthlyPanel();
    updateStreakBasedOnToday();
  }
  init();