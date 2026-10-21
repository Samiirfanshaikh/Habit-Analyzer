// ===============================
// AI HABIT DRIFT ANALYZER - app.js
// ===============================

const isLocalFileMode = window.location.protocol === 'file:';
const isPublicPage = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/') || window.location.pathname.endsWith('signin.html') || window.location.pathname.endsWith('signup.html');
const isAuthPage = window.location.pathname.endsWith('signin.html') || window.location.pathname.endsWith('signup.html');
const isLoggedIn = !!localStorage.getItem('user_id');

if (!isPublicPage && !isLoggedIn) window.location.replace('signin.html');
if (isAuthPage && isLoggedIn) window.location.replace('dashboard.html');

// Dynamic Navbar UI Updater
function updateAuthUI() {
  const loggedIn = !!localStorage.getItem('user_id');
  const signIn = document.getElementById('navSignIn');
  const signUp = document.getElementById('navSignUp');
  const signOut = document.getElementById('navSignOut');

  if (localStorage.getItem('local_mode') === 'true') {
    const logo = document.querySelector('.logo');
    if (logo && !logo.querySelector('.offline-badge')) {
      const badge = document.createElement('span');
      badge.className = 'offline-badge';
      badge.style.cssText = 'font-size:0.7rem;padding:0.15rem 0.5rem;background:#f59e0b;color:#000;border-radius:10px;margin-left:0.6rem;font-weight:700;vertical-align:middle;display:inline-block;letter-spacing:0.5px;';
      badge.textContent = 'OFFLINE';
      logo.appendChild(badge);
    }
  }

  if (!signIn || !signUp || !signOut) return;

  if (loggedIn) {
    signIn.classList.add('hidden');
    signUp.classList.add('hidden');
    signOut.classList.remove('hidden');
  } else {
    signIn.classList.remove('hidden');
    signUp.classList.remove('hidden');
    signOut.classList.add('hidden');
  }
}

// Grading System
function getGradeLabel(score) {
  if (score >= 90) return { label: 'Excellent', color: '#10b981', desc: 'Outstanding consistency' };
  if (score >= 75) return { label: 'Good', color: '#3b82f6', desc: 'Solid progress' };
  if (score >= 60) return { label: 'Fair', color: '#f59e0b', desc: 'Needs minor adjustments' };
  if (score >= 35) return { label: 'At Risk', color: '#ef4444', desc: 'Pattern drift detected' };
  return { label: 'Critical', color: '#7f1d1d', desc: 'Collapse imminent' };
}

// Core Habit Scoring (0-1)
function calculateHabitScore(log) {
  const sleepIdeal = 7.5, studyIdeal = 3, exerciseIdeal = 30;
  const sleepScore = Math.max(0, 1 - Math.abs((log.sleep || 0) - sleepIdeal) / sleepIdeal);
  const studyScore = Math.min((log.study || 0) / studyIdeal, 1);
  const exerciseScore = log.exercise_minutes ? Math.min(log.exercise_minutes / exerciseIdeal, 1) : 0;
  return (sleepScore * 0.4 + studyScore * 0.4 + exerciseScore * 0.2);
}

function calculateMomentum(logs) {
  if (!logs || logs.length === 0) return 0;
  let momentum = 0, weight = 1, totalWeight = 0;
  for (let i = logs.length - 1; i >= 0; i--) {
    momentum += calculateHabitScore(logs[i]) * weight;
    totalWeight += weight;
    weight *= 0.85;
  }
  return Math.round((momentum / totalWeight) * 100);
}

function calculateDriftDays(logs) { if (!logs) return 0; return logs.reduce((c, l) => calculateHabitScore(l) < 0.6 ? c + 1 : c, 0); }

// Date Utility Helpers (Timezone-safe & lexicographical comparisons)
function getLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function calculateCurrentStreak(logs) {
  if (!logs || logs.length === 0) return 0;
  const map = {};
  logs.forEach(l => { map[l.date] = calculateHabitScore(l) >= 0.6; });
  let streak = 0; const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const key = getLocalDateString(d);
    if (map[key]) streak++; else if (i > 0) break;
  }
  return streak;
}

function calculateLongestStreak(logs) {
  if (!logs || logs.length === 0) return 0;
  const map = {};
  logs.forEach(l => { map[l.date] = calculateHabitScore(l) >= 0.6; });
  const good = Object.keys(map).filter(d => map[d]).sort();
  if (good.length === 0) return 0;
  let max = 1, cur = 1;
  for (let i = 1; i < good.length; i++) {
    const parts1 = good[i].split('-');
    const parts2 = good[i - 1].split('-');
    const d1 = new Date(Date.UTC(parseInt(parts1[0]), parseInt(parts1[1]) - 1, parseInt(parts1[2])));
    const d2 = new Date(Date.UTC(parseInt(parts2[0]), parseInt(parts2[1]) - 1, parseInt(parts2[2])));
    const diff = Math.round((d1 - d2) / 86400000);
    if (diff === 1) { cur++; max = Math.max(max, cur); } else cur = 1;
  }
  return max;
}

function predictCollapseRisk(logs) {
  if (!logs || logs.length === 0) return 20;
  const recent = logs.slice(-Math.min(logs.length, 5));
  const scores = recent.map(calculateHabitScore);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const trend = scores[scores.length - 1] - scores[0];
  let risk = (1 - avg) * 70; if (trend < -0.2) risk += 20;
  return Math.min(100, Math.max(0, Math.round(risk)));
}

function getWeekLabel(dateString) {
  const parts = dateString.split('-');
  const d = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
  const f = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `W${Math.ceil((Math.floor((d - f) / 86400000) + 1) / 7)}`;
}

function getRiskTrendData(logs, days = 30) {
  if (!logs || logs.length === 0) return [];
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days + 1);
  const cutoffStr = getLocalDateString(cutoffDate);
  const win = sorted.filter(l => l.date >= cutoffStr);
  return win.map((l, i) => ({ date: formatDateDMY(l.date), risk: predictCollapseRisk(win.slice(0, i + 1)) }));
}

function formatDateDMY(dateString) {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function filterLogsByPeriod(logs, period) {
  if (!logs || logs.length === 0) return [];
  if (period === 'all' || period === '0') return [...logs];
  const days = parseInt(period, 10); if (isNaN(days) || days <= 0) return [...logs];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days + 1);
  const cutoffStr = getLocalDateString(cutoffDate);
  return logs.filter(l => l.date >= cutoffStr);
}

let performanceChart = null, weeklyTrendChart = null, riskTrendChart = null, consistencyChart = null;
function destroyChart(chart) { if (chart && typeof chart.destroy === 'function') chart.destroy(); }

function initDailyPerformanceChart(logs, period) {
  const ctx = document.getElementById('performanceChart'); if (!ctx || typeof Chart === 'undefined') return;
  destroyChart(performanceChart);
  const filtered = filterLogsByPeriod(logs, period), canvas = document.getElementById('performanceChart'), container = canvas?.parentElement;
  if (!filtered || filtered.length === 0) {
    if (canvas) canvas.style.display = 'none';
    if (container && !container.querySelector('.empty-chart-msg')) {
      const msg = document.createElement('p'); msg.className = 'empty-chart-msg'; msg.style.cssText = 'text-align:center;padding:2rem;color:#6b7280;';
      msg.textContent = 'No data available for this period'; container.appendChild(msg);
    } return;
  }
  if (canvas) canvas.style.display = 'block'; const empty = container?.querySelector('.empty-chart-msg'); if (empty) empty.remove();
  const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));
  performanceChart = new Chart(ctx, { type: 'line', data: { labels: sorted.map(l => formatDateDMY(l.date)), datasets: [{ label: 'Daily Habit Score', data: sorted.map(l => Math.round(calculateHabitScore(l) * 100)), borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.1)', tension: 0.3, fill: true }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Score (0-100)' } } } } });
}

function initAllTimeTrendChart(logs) {
  const ctx = document.getElementById('weeklyTrendChart'); if (!ctx || typeof Chart === 'undefined') return;
  destroyChart(weeklyTrendChart);
  const filtered = logs, canvas = document.getElementById('weeklyTrendChart'), container = canvas?.parentElement;
  if (!filtered || filtered.length === 0) {
    if (canvas) canvas.style.display = 'none';
    if (container && !container.querySelector('.empty-chart-msg')) {
      const msg = document.createElement('p'); msg.className = 'empty-chart-msg'; msg.style.cssText = 'text-align:center;padding:2rem;color:#6b7280;';
      msg.textContent = 'No data available for this period'; container.appendChild(msg);
    } return;
  }
  if (canvas) canvas.style.display = 'block'; const empty = container?.querySelector('.empty-chart-msg'); if (empty) empty.remove();
  const weekly = {}; filtered.forEach(log => { const k = getWeekLabel(log.date); weekly[k] = weekly[k] || []; weekly[k].push(calculateHabitScore(log)); });
  const labels = Object.keys(weekly).sort();
  weeklyTrendChart = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Weekly Avg Score', data: labels.map(k => Math.round((weekly[k].reduce((a, b) => a + b, 0) / weekly[k].length) * 100)), backgroundColor: '#10b981', borderRadius: 4 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Score (0-100)' } } } } });
}

async function updateDashboardForPeriod(period) {
  const logs = await fetchLogs(); const filtered = filterLogsByPeriod(logs, period); const display = filtered.length ? filtered : logs;
  const momentum = calculateMomentum(display), risk = predictCollapseRisk(display), grade = getGradeLabel(momentum), has = display.length > 0;
  const el = (id) => document.getElementById(id);
  if (el('momentumScore')) el('momentumScore').textContent = has ? momentum : '—';
  if (el('consistency')) el('consistency').textContent = has ? `${Math.round(100 - risk)}%` : '—';
  if (el('momentumGrade')) { el('momentumGrade').textContent = has ? grade.label : '—'; el('momentumGrade').style.color = grade.color; }
  if (el('driftDays')) el('driftDays').textContent = has ? calculateDriftDays(display) : '0';
  if (el('streak')) el('streak').textContent = has ? calculateCurrentStreak(display) : '0';
  
  if (el('aiInsightText')) {
    if (has) {
      if (risk >= 70) {
        el('aiInsightText').innerHTML = `⚠️ <strong>High Collapse Risk detected (${risk}%)!</strong> Your habit momentum has dropped to <strong>${momentum}%</strong> due to recent pattern drift. Prioritize stabilizing your routine today to prevent complete habit failure.`;
      } else if (risk >= 40) {
        el('aiInsightText').innerHTML = `⚡ <strong>Moderate Drift detected (${risk}%):</strong> You are doing well, but slight inconsistencies are starting to creep in. Sticking to your target schedule today will help rebuild solid momentum!`;
      } else {
        el('aiInsightText').innerHTML = `🎉 <strong>Excellent Consistency:</strong> Your momentum is strong (<strong>${momentum}%</strong>) and collapse risk is very low (<strong>${risk}%</strong>). Keep up this outstanding routine!`;
      }
    } else {
      el('aiInsightText').textContent = 'Start logging your habits to see AI-powered insights and predictions.';
    }
  }

  initDailyPerformanceChart(display, period); initAllTimeTrendChart(display);
}

function initDashboard() {
  document.querySelectorAll('.tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tabs .tab-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      updateDashboardForPeriod(e.currentTarget.getAttribute('data-filter'));
    });
  });
  updateDashboardForPeriod('7');
}

function initRiskTrendChart(logs) {
  const ctx = document.getElementById('riskTrendChart'); if (!ctx || typeof Chart === 'undefined') return; destroyChart(riskTrendChart);
  const canvas = document.getElementById('riskTrendChart'), container = canvas?.parentElement;
  if (!logs || logs.length === 0) { if (canvas) canvas.style.display = 'none'; if (container && !container.querySelector('.empty-chart-msg')) { const m = document.createElement('p'); m.className = 'empty-chart-msg'; m.style.cssText = 'text-align:center;padding:2rem;color:#6b7280;'; m.textContent = 'Log at least one day to see risk predictions.'; container.appendChild(m); } return; }
  if (canvas) canvas.style.display = 'block'; const empty = container?.querySelector('.empty-chart-msg'); if (empty) empty.remove();
  const trend = getRiskTrendData(logs, 30); if (trend.length === 0) return;
  riskTrendChart = new Chart(ctx, { type: 'line', data: { labels: trend.map(d => d.date), datasets: [{ label: 'Collapse Risk %', data: trend.map(d => d.risk), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', tension: 0.3, fill: true }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Risk %' } } } } });
}

function renderHistoryTable(logs) {
  const tbody = document.getElementById('history-tbody'); if (!tbody) return;
  if (!logs || logs.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="empty-text">No history for selected period.</td></tr>'; return; }
  tbody.innerHTML = [...logs].sort((a, b) => b.date.localeCompare(a.date)).map(log => {
    const s = Math.round(calculateHabitScore(log) * 100), g = getGradeLabel(s);
    return `<tr><td>${formatDateDMY(log.date)}</td><td style="color:${g.color};font-weight:600;">${s}%</td><td>${log.sleep || 0}h</td><td>${log.study || 0}h</td><td>${log.exercise_minutes || 0}m</td><td><span style="color:${g.color};font-weight:600;">${g.label}</span></td></tr>`;
  }).join('');
}

function updateHistoryStats(logs) {
  const t = logs?.length || 0; const el = (id) => document.getElementById(id);
  if (el('history-total')) el('history-total').textContent = t;
  if (el('history-avg')) el('history-avg').textContent = t === 0 ? '0' : Math.round(logs.reduce((s, l) => s + calculateHabitScore(l) * 100, 0) / t);
  if (el('history-exercise')) el('history-exercise').textContent = logs.reduce((s, l) => s + (l.exercise_minutes || 0), 0);
  if (el('history-streak')) el('history-streak').textContent = calculateLongestStreak(logs);
}

async function initHistoryPage() {
  let logs = await fetchLogs();
  const upd = (p) => { const f = filterLogsByPeriod(logs, p); updateHistoryStats(f); renderHistoryTable(f); };
  upd('7');
  document.querySelectorAll('.history-filters .tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.history-filters .tab-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      fetchLogs().then(f => { logs = f; upd(e.currentTarget.getAttribute('data-filter')); });
    });
  });
}

async function initPredictions() {
  const logs = await fetchLogs(); if (logs.length === 0) return;
  const el = (id) => document.getElementById(id);
  [3, 7, 14].forEach(d => {
    const v = predictCollapseRisk(logs.slice(-d));
    if (el(`risk${d}d`)) el(`risk${d}d`).textContent = `${v}%`;
    if (el(`label${d}d`)) el(`label${d}d`).textContent = v >= 70 ? 'High Risk' : v >= 40 ? 'Moderate Risk' : 'Low Risk';
    if (el(`progress${d}d`)) { el(`progress${d}d`).style.width = `${v}%`; el(`progress${d}d`).setAttribute('data-percent', v); }
  });
  const r = predictCollapseRisk(logs.slice(-7)), g = getGradeLabel(100 - r);
  if (el('predictionGrade')) { el('predictionGrade').textContent = g.label; el('predictionGrade').title = g.desc; }
  if (el('driftFactor')) el('driftFactor').textContent = calculateDriftDays(logs);
  if (el('momentumFactor')) el('momentumFactor').textContent = calculateMomentum(logs);
  if (el('consistencyFactor')) el('consistencyFactor').textContent = `${Math.max(0, 100 - r)}%`;
  if (el('warningBox') && r >= 70) el('warningBox').style.display = 'block';
  initRiskTrendChart(logs);
}

async function initInsightsPage() {
  const logs = await fetchLogs(), el = (id) => document.getElementById(id);
  if (!logs || logs.length === 0) {
    el('patternInsights').innerHTML = '<p>Log more habits to see pattern insights.</p>';
    el('riskFactors').innerHTML = '<li>Insufficient data to detect risks.</li>';
    el('recommendations').innerHTML = '<li>• Start logging daily habits to unlock personalized recommendations.</li>';
    el('insightsMomentum').textContent = '0'; el('momentumPercent').textContent = '0%'; return;
  }
  const m = calculateMomentum(logs), g = getGradeLabel(m);
  el('insightsMomentum').textContent = m; el('momentumPercent').textContent = m + '%';
  el('momentumLabel').textContent = g.desc; el('momentumProgress').style.width = m + '%';
  const avgS = (logs.reduce((s, l) => s + (l.study || 0), 0) / logs.length).toFixed(1);
  const avgSl = (logs.reduce((s, l) => s + (l.sleep || 0), 0) / logs.length).toFixed(1);
  el('patternInsights').innerHTML = `<p><strong>Total Entries:</strong> ${logs.length} days</p><p><strong>Avg Study:</strong> ${avgS}h/day</p><p><strong>Avg Sleep:</strong> ${avgSl}h/day</p>`;
  const risk = predictCollapseRisk(logs), drift = calculateDriftDays(logs);
  let rh = ''; if (risk >= 70) rh += '<li style="color:#ef4444;">🚨 High collapse risk</li>';
  if (drift > 0) rh += `<li style="color:#f59e0b;">⚠️ ${drift} drift day(s)</li>`;
  if (!rh) rh = '<li style="color:#10b981;">✅ All metrics stable</li>';
  el('riskFactors').innerHTML = rh;
  const recs = []; if (avgS < 2) recs.push('Increase study time to ≥2h/day.'); if (avgSl < 6) recs.push('Prioritize sleep. Aim for 7-8 hours.'); if (risk >= 50) recs.push('Focus on consistency over intensity.');
  el('recommendations').innerHTML = recs.length ? recs.map(r => `<li>• ${r}</li>`).join('') : '<li>• Keep up the great work!</li>';
  const ctx = document.getElementById('consistencyChart');
  if (ctx && typeof Chart !== 'undefined') {
    const rec = [...logs].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
    consistencyChart = new Chart(ctx, { type: 'line', data: { labels: rec.map(l => formatDateDMY(l.date)), datasets: [{ label: 'Daily Score', data: rec.map(l => Math.round(calculateHabitScore(l) * 100)), borderColor: '#c084fc', backgroundColor: 'rgba(192,132,252,0.1)', tension: 0.3, fill: true }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } } });
  }
}

window.logout = () => { localStorage.removeItem('isLoggedIn'); localStorage.removeItem('user_id'); window.location.href = 'signin.html'; };

// Backend Auth Logic (with LocalStorage Offline Fallback)
function initAuthPages() {
  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('signup-email')?.value;
      const password = document.getElementById('signup-password')?.value;
      if (!email || !password) return;

      try {
        if (isLocalFileMode) throw new Error('local_offline');
        const response = await fetch('signup.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        const text = await response.text();
        let result;
        try {
          result = JSON.parse(text);
        } catch (e) {
          throw new Error('Server returned non-JSON');
        }

        if (result.status === 'success') {
          alert('Signup successful! Please sign in.');
          window.location.href = 'signin.html';
        } else {
          alert(result.message || 'Signup failed');
        }
      } catch (err) {
        if (err.message !== 'local_offline') {
          console.warn('Signup Fetch failed. Falling back to offline local mode:', err);
        } else {
          console.log('Signup: Operating in offline LocalStorage mode.');
        }
        let users = JSON.parse(localStorage.getItem('ha_users') || '[]');
        if (users.some(u => u.email === email)) {
          alert('Email already registered (Offline Mode)');
          return;
        }
        const user_id = Date.now();
        users.push({ id: user_id, email, password });
        localStorage.setItem('ha_users', JSON.stringify(users));
        alert('Signup successful (Offline Mode)! Please sign in.');
        window.location.href = 'signin.html';
      }
    });
  }

  const signinForm = document.getElementById('signinForm');
  if (signinForm) {
    signinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email')?.value;
      const password = document.getElementById('password')?.value;
      const errorMsg = document.getElementById('errorMsg');
      if (!email || !password) return;

      try {
        if (isLocalFileMode) throw new Error('local_offline');
        const response = await fetch('login.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        const text = await response.text();
        let result;
        try {
          result = JSON.parse(text);
        } catch (e) {
          throw new Error('Server returned non-JSON');
        }

        if (result.status === 'success') {
          localStorage.setItem('user_id', result.data.user_id);
          localStorage.removeItem('local_mode');
          window.location.href = 'dashboard.html';
        } else {
          if (errorMsg) {
            errorMsg.innerText = result.message || 'Invalid email or password';
            errorMsg.style.display = 'block';
          } else {
            alert(result.message || 'Invalid email or password');
          }
        }
      } catch (err) {
        if (err.message !== 'local_offline') {
          console.warn('Login Fetch failed. Falling back to offline local mode:', err);
        } else {
          console.log('Login: Operating in offline LocalStorage mode.');
        }
        let users = JSON.parse(localStorage.getItem('ha_users') || '[]');
        const user = users.find(u => u.email === email && u.password === password);
        if (user) {
          localStorage.setItem('user_id', user.id);
          localStorage.setItem('local_mode', 'true');
          window.location.href = 'dashboard.html';
        } else {
          const emailExists = users.some(u => u.email === email);
          if (!emailExists) {
            const newUser = { id: Date.now(), email, password };
            users.push(newUser);
            localStorage.setItem('ha_users', JSON.stringify(users));
            localStorage.setItem('user_id', newUser.id);
            localStorage.setItem('local_mode', 'true');
            alert('Welcome! Since you are running offline, we have automatically created a local account for you and logged you in.');
            window.location.href = 'dashboard.html';
          } else {
            if (errorMsg) {
              errorMsg.innerText = 'Incorrect password for this local offline account.';
              errorMsg.style.display = 'block';
            } else {
              alert('Incorrect password for this local offline account.');
            }
          }
        }
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateAuthUI();
  if (window.location.pathname.match(/(signin|signup)\.html$/)) {
    initAuthPages();
    return;
  }

  if (window.location.pathname.includes('log.html')) {
    const form = document.getElementById('logForm'); if (form) form.onsubmit = handleLogSubmit;
    const dateInput = document.getElementById('logDate'); if (dateInput) dateInput.value = getLocalDateString(new Date());
    const exType = document.getElementById('exercise-type'), exMin = document.getElementById('exercise-minutes');
    if (exType && exMin) {
      const toggle = () => { exMin.style.display = exType.value === 'minutes' ? 'block' : 'none'; exMin.required = exType.value === 'minutes'; if (exType.value !== 'minutes') exMin.value = ''; };
      exType.addEventListener('change', toggle); toggle();
    } return;
  }
  if (window.location.pathname.includes('dashboard.html')) { initDashboard(); return; }
  if (window.location.pathname.includes('predictions.html')) { initPredictions(); return; }
  if (window.location.pathname.includes('history.html')) { initHistoryPage(); return; }
  if (window.location.pathname.includes('insights.html')) { initInsightsPage(); return; }
});

// Local Storage Fallback helpers
function getLocalLogs(uid) {
  let logs = JSON.parse(localStorage.getItem('ha_logs_' + uid) || '[]');
  return logs.map(l => ({
    ...l,
    sleep: parseFloat(l.sleep),
    study: parseFloat(l.study),
    exercise_minutes: parseInt(l.exercise_minutes)
  }));
}

async function handleLogSubmit(e) {
  e.preventDefault();
  const uid = localStorage.getItem('user_id');
  if (!uid) { alert('Please sign in again.'); return; }

  const date = document.getElementById('logDate')?.value;
  const sleep = parseFloat(document.getElementById('sleep')?.value) || 0;
  const study = parseFloat(document.getElementById('study')?.value) || 0;
  const exType = document.getElementById('exercise-type')?.value;
  const exMin = exType === 'minutes' ? parseInt(document.getElementById('exercise-minutes')?.value) || 0 : 0;

  if (!date) { alert('Please select a date'); return; }

  try {
    if (isLocalFileMode) throw new Error('local_offline');
    const response = await fetch('save_log.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: parseInt(uid), date, sleep, study, exercise_minutes: exMin })
    });
    
    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      throw new Error('Server returned non-JSON');
    }

    if (result.status === 'success') {
      alert('Saved Successfully');
      if (document.getElementById('logForm')) document.getElementById('logForm').reset();
      window.location.href = 'dashboard.html';
    } else {
      alert(result.message || 'Failed to save log');
    }
  } catch (err) {
    if (err.message !== 'local_offline') {
      console.warn('Save Log Fetch failed. Saving locally:', err);
    } else {
      console.log('Save Log: Operating in offline LocalStorage mode.');
    }
    let logs = getLocalLogs(uid);
    const idx = logs.findIndex(l => l.date === date);
    const newLog = { date, sleep, study, exercise_minutes: exMin };
    if (idx >= 0) {
      logs[idx] = newLog;
    } else {
      logs.push(newLog);
    }
    localStorage.setItem('ha_logs_' + uid, JSON.stringify(logs));
    alert('Saved Successfully (Offline Mode)');
    if (document.getElementById('logForm')) document.getElementById('logForm').reset();
    window.location.href = 'dashboard.html';
  }
}

async function fetchLogs() {
  const uid = localStorage.getItem('user_id');
  if (!uid) return [];

  try {
    if (isLocalFileMode) throw new Error('local_offline');
    const response = await fetch('get_logs.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: parseInt(uid) })
    });
    
    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      return getLocalLogs(uid);
    }

    if (result.status === 'success' && result.data && result.data.logs) {
      return result.data.logs.map(l => ({
        ...l,
        sleep: parseFloat(l.sleep),
        study: parseFloat(l.study),
        exercise_minutes: parseInt(l.exercise_minutes)
      }));
    }
    return getLocalLogs(uid);
  } catch (err) {
    if (err.message !== 'local_offline') {
      console.warn('Fetch Logs Fetch failed. Loading local data:', err);
    }
    return getLocalLogs(uid);
  }
}