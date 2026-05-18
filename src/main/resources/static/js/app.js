/* ================================================================
   AMEYA DISPATCH TRACKER v5 — app.js
   Full feature: roles, collapsible sidebar, searchable dropdowns,
   status flow locking, packing type logic, ready/collection cols
   ================================================================ */

'use strict';

// ── STATE ──────────────────────────────────────────────────────────
const State = {
  token: null,
  user:  null,
  page:  'dashboard',
  prevPage: null,
  woList: [],
  currentWo: null,
  customers: [],
  shipmentModes: [],
  invoiceTypes: [],
  dashboardView: 'IN_PROGRESS',
  sidebarExpanded: localStorage.getItem('sidebarExpanded') !== 'false',
  darkMode: localStorage.getItem('darkTheme') === 'true',
  notifications: JSON.parse(localStorage.getItem('notifications') || '[]'),
  selectedCustomer: null,
  syncTimer: null,
  lastNotificationTime: 0,
  userCache: [],
  allWoFilters: { q: '', status: '' },
  dashPage: 1,
  allWoPage: 1,
  dashDisplayList: [],
  allWoDisplayList: [],
};

// ── INIT ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  applySidebar();
  bindLogin();
  bindNav();
  bindSidebar();
  id('loginScreen').style.display = 'none';
  id('appShell').style.display = 'none';

  const saved = localStorage.getItem('authToken');
  const savedUser = localStorage.getItem('authUser');
  if (saved && savedUser) {
    State.token = saved;
    State.user  = JSON.parse(savedUser);
    validateSessionAndShowApp();
  } else {
    showLoginScreen();
  }
});

async function validateSessionAndShowApp() {
  showServerConnecting(true);
  let attempts = 0;
  const maxAttempts = 6;
  while (attempts < maxAttempts) {
    try {
      await api('/api/lookup/customers');
      showServerConnecting(false);
      showApp();
      return;
    } catch (e) {
      if (e.message.includes('Session expired')) {
        showServerConnecting(false);
        return; // forceLogout() already called inside api()
      }
      attempts++;
      if (attempts < maxAttempts) {
        updateConnectingMessage(`Server restarted — reconnecting… (${attempts}/${maxAttempts})`);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }
  showServerConnecting(false);
  forceLogout();
  id('loginError').textContent = 'Server could not be reached. Please log in again.';
  id('loginError').style.display = 'block';
}

function showServerConnecting(show) {
  let overlay = id('serverConnectingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'serverConnectingOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;color:#fff;gap:16px;font-family:Inter,sans-serif';
    overlay.innerHTML = '<div style="width:48px;height:48px;border:4px solid rgba(255,255,255,.2);border-top-color:#2563eb;border-radius:50%;animation:refreshSpin 1s linear infinite"></div><p id="serverConnectingMsg" style="font-size:1rem;font-weight:600">Connecting to server…</p><p style="font-size:.82rem;color:#94a3b8">Please wait while the server starts up</p>';
    document.body.appendChild(overlay);
  }
  overlay.style.display = show ? 'flex' : 'none';
}

function updateConnectingMessage(msg) {
  const el = id('serverConnectingMsg');
  if (el) el.textContent = msg;
}

// ── THEME ──────────────────────────────────────────────────────────
function applyTheme() {
  document.documentElement.setAttribute('data-theme', State.darkMode ? 'dark' : 'light');
  const btn = id('themeToggleBtn');
  if (btn) {
    btn.querySelector('.nav-icon').textContent = State.darkMode ? '☀️' : '🌙';
    btn.querySelector('.nav-label').textContent = State.darkMode ? 'Light Mode' : 'Dark Mode';
  }
}
function toggleTheme() {
  State.darkMode = !State.darkMode;
  localStorage.setItem('darkTheme', State.darkMode);
  applyTheme();
}

// ── SIDEBAR ─────────────────────────────────────────────────────────
function applySidebar() {
  const sidebar = id('sidebar');
  const main = id('mainContent');
  if (!sidebar) return;
  if (State.sidebarExpanded) {
    sidebar.classList.remove('collapsed');
  } else {
    sidebar.classList.add('collapsed');
  }
}
function bindSidebar() {
  const btn = id('sidebarToggleBtn');
  if (btn) btn.addEventListener('click', () => {
    State.sidebarExpanded = !State.sidebarExpanded;
    localStorage.setItem('sidebarExpanded', State.sidebarExpanded);
    applySidebar();
  });

  // Mobile top menu btn
  const topBtn = id('topMenuBtn');
  if (topBtn) topBtn.addEventListener('click', () => {
    const sidebar = id('sidebar');
    const isOpen = sidebar.classList.contains('mobile-open');
    if (isOpen) {
      sidebar.classList.remove('mobile-open');
    } else {
      sidebar.classList.remove('collapsed'); // prevent collapsed from hiding mobile-open
      sidebar.classList.add('mobile-open');
    }
  });

  // Close sidebar on outside click (mobile)
  document.addEventListener('click', (e) => {
    if (window.innerWidth > 768) return;
    const sidebar = id('sidebar');
    const topMenuBtn = id('topMenuBtn');
    if (!sidebar || !topMenuBtn) return;
    if (sidebar.classList.contains('mobile-open') &&
        !sidebar.contains(e.target) &&
        !topMenuBtn.contains(e.target)) {
      sidebar.classList.remove('mobile-open');
    }
  });

  // Mouse edge hover expand
  const sidebar = id('sidebar');
  if (sidebar) {
    sidebar.addEventListener('mouseenter', () => {
      if (!State.sidebarExpanded) sidebar.classList.remove('collapsed');
    });
    sidebar.addEventListener('mouseleave', () => {
      if (!State.sidebarExpanded) sidebar.classList.add('collapsed');
    });
  }

  id('themeToggleBtn')?.addEventListener('click', toggleTheme);
  id('changePasswordBtn')?.addEventListener('click', showChangePasswordModal);
}

// ── AUTH ───────────────────────────────────────────────────────────
function bindLogin() {
  id('pwToggle')?.addEventListener('click', () => {
    const pw = id('loginPassword');
    pw.type = pw.type === 'password' ? 'text' : 'password';
  });
  id('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = id('loginBtn');
    const err = id('loginError');
    err.style.display = 'none';
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Signing in…';
    try {
      const res = await api('/api/auth/login', 'POST', {
        username: id('loginUsername').value.trim(),
        password: id('loginPassword').value
      });
      State.token = res.data.token;
      State.user  = { username: res.data.username, fullName: res.data.fullName, role: res.data.role };
      localStorage.setItem('authToken', State.token);
      localStorage.setItem('authUser', JSON.stringify(State.user));
      showApp();
    } catch (ex) {
      err.textContent = ex.message || 'Login failed';
      err.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Sign In';
    }
  });
}

function showApp() {
  id('loginScreen').style.display  = 'none';
  id('appShell').style.display = 'flex';
  setupUserUI();
  loadLookupData();
  setupNotifications();
  startAutoSync();
  setupNotificationBanner();

  const savedPage = localStorage.getItem('lastPage');
  const savedWoId = localStorage.getItem('lastWoId');
  const allowedPages = ['dashboard','create-wo','all-wo','detail','user-mgmt'];
  let targetPage = savedPage && allowedPages.includes(savedPage) ? savedPage : null;

  if (State.user?.role === 'ADMIN') {
    targetPage = targetPage === 'dashboard' || targetPage === 'create-wo' || targetPage === 'all-wo' || targetPage === 'detail'
      ? 'user-mgmt'
      : 'user-mgmt';
  } else {
    if (targetPage === 'user-mgmt') targetPage = 'dashboard';
    if (!targetPage) targetPage = 'dashboard';
  }

  navigateTo(targetPage);
  if (targetPage === 'detail' && savedWoId) {
    openWoDetail(parseInt(savedWoId, 10));
  }
}

function showLoginScreen() {
  id('appShell').style.display = 'none';
  id('loginScreen').style.display = 'flex';
}

function logout() {
  if (!confirm('Are you sure you want to sign out?')) return;
  forceLogout();
}

function forceLogout() {
  if (State.syncTimer) {
    clearInterval(State.syncTimer);
    State.syncTimer = null;
  }
  State.token = null; State.user = null;
  localStorage.removeItem('authToken'); localStorage.removeItem('authUser');
  localStorage.removeItem('lastPage'); localStorage.removeItem('lastWoId');
  id('appShell').style.display = 'none';
  id('loginScreen').style.display = 'flex';
  id('loginUsername').value = '';
  id('loginPassword').value = '';
}

function setupUserUI() {
  const u = State.user;
  if (!u) return;
  const initials = u.fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
  id('userAvatar').textContent = initials;
  id('sidebarUserName').textContent = u.fullName;
  id('sidebarUserRole').textContent = roleLabel(u.role);

  const isGM    = u.role === 'GENERAL_MANAGER';
  const isAdmin = u.role === 'ADMIN';
  const isInvoiceCreator = u.role === 'INVOICE_CREATOR';

  // Show/hide nav items by role
  document.querySelectorAll('.nav-only-gm').forEach(el => el.style.display = isGM ? '' : 'none');
  document.querySelectorAll('.nav-only-admin').forEach(el => el.style.display = isAdmin ? '' : 'none');
  document.querySelectorAll('.nav-only-invoice-creator').forEach(el => el.style.display = isInvoiceCreator ? '' : 'none');

  // ADMIN cannot touch dispatches — redirect to user-mgmt as home
  if (isAdmin) {
    document.querySelectorAll('[data-page="all-wo"]').forEach(el => el.style.display = 'none');
    document.querySelectorAll('[data-page="dashboard"]').forEach(el => el.style.display = 'none');
  }

  id('logoutBtn')?.addEventListener('click', logout);
  
  id('refreshPageBtn')?.addEventListener('click', async () => {
    id('refreshOverlay')?.classList.add('active');
    try {
      await syncWorkOrders();
      if (State.page === 'dashboard') renderDashboard();
      if (State.page === 'all-wo') await loadAllWo();
      if (State.page === 'detail' && State.currentWo) await openWoDetail(State.currentWo.id);
    } finally {
      setTimeout(() => id('refreshOverlay')?.classList.remove('active'), 300);
    }
  });
}

function roleLabel(role) {
  const map = { ADMIN:'Admin', GENERAL_MANAGER:'General Manager', STORE:'Store', INVOICE_CREATOR:'Invoice Creator', GUEST:'Guest' };
  return map[role] || role;
}

// ── NAVIGATION ─────────────────────────────────────────────────────
function bindNav() {
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(el.dataset.page);
    });
  });
}

function navigateTo(page) {
  _focusedRowIndex = -1;
  State.prevPage = State.page;
  State.page = page;
  localStorage.setItem('lastPage', page);
  if (page !== 'detail') {
    localStorage.removeItem('lastWoId');
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageMap = {
    'dashboard':  { pageId:'pageDashboard',  title:'Dashboard' },
    'create-wo':  { pageId:'pageCreateWo',   title:'New Dispatch' },
    'all-wo':     { pageId:'pageAllWo',      title:'All Dispatch Lists' },
    'detail':     { pageId:'pageWoDetail',   title:'Dispatch Detail' },
    'user-mgmt':  { pageId:'pageUserMgmt',   title:'User Management' },
  };
  const info = pageMap[page];
  if (!info) return;
  id(info.pageId)?.classList.add('active');
  id('topBarTitle').textContent = info.title;
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');

  if (page === 'dashboard') {
    if (State.woList.length) {
      renderDashboard();
    } else {
      loadWoList();
    }
  }
  if (page === 'create-wo') initCreateForm();
  if (page === 'all-wo') loadAllWo();
  if (page === 'user-mgmt') loadUserManagement();
}

// ── LOOKUP DATA ────────────────────────────────────────────────────
async function loadLookupData() {
  try {
    const [custR, modeR, typeR] = await Promise.all([
      api('/api/lookup/customers'),
      api('/api/lookup/shipment-modes'),
      api('/api/lookup/invoice-types'),
    ]);
    State.customers = custR.data || [];
    State.shipmentModes = modeR.data || [];
    State.invoiceTypes = typeR.data || [];

    // Populate invoice type filter dropdown
    const ftSel = id('filterInvoiceType');
    if (ftSel) {
      State.invoiceTypes.forEach(t => {
        const o = document.createElement('option');
        o.value = t.name; o.textContent = t.name;
        ftSel.appendChild(o);
      });
    }

    // Populate year filter dynamically: 2024 up to next year
    const yearSel = id('filterYear');
    if (yearSel) {
      const currentYear = new Date().getFullYear();
      for (let y = 2024; y <= currentYear + 1; y++) {
        const o = document.createElement('option');
        o.value = y; o.textContent = y;
        yearSel.appendChild(o);
      }
    }
  } catch (e) { console.warn('Lookup load failed', e); }
}

// ── WO LIST / DASHBOARD ─────────────────────────────────────────────
async function loadWoList() {
  showTableLoading(true);
  try {
    const res = await api('/api/workorders');
    State.woList = res.data || [];
    renderDashboard();
  } catch(e) { showToast('Failed to load dispatches', 'error'); }
  showTableLoading(false);
}

function showTableLoading(show) {
  id('woTableLoading').style.display = show ? 'block' : 'none';
  id('woTable').style.display = show ? 'none' : 'table';
  id('woTableEmpty').style.display = 'none';
}

// ── DATE FORMATTING ────────────────────────────────────────────────
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val + 'T00:00:00'); // prevent timezone shift
  if (isNaN(d)) return val;
  const dd  = String(d.getDate()).padStart(2,'0');
  const mon = MONTHS_SHORT[d.getMonth()];
  const yy  = String(d.getFullYear()).slice(-2);
  return `${dd} ${mon} ${yy}`;
}

function renderDashboard() {
  const statsSource = getDashboardStatsList();
  id('statTotal').textContent = statsSource.length;
  id('statInProgress').textContent = statsSource.filter(w => w.status === 'IN_PROGRESS').length;
  id('statCompleted').textContent  = statsSource.filter(w => w.status === 'COMPLETED').length;
  id('statRevised').textContent    = statsSource.filter(w => w.status === 'REVISED').length;
  id('statIssues').textContent     = statsSource.filter(w => w.hasInvoiceIssue).length;

  bindDashboardControls();
  bindDashboardFilters();
  renderWoTable(getDashboardVisibleList());
}

function isCurrentMonth(wo) {
  if (!wo?.woDate) return false;
  const date = new Date(wo.woDate + 'T00:00:00');
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function getDashboardStatsList() {
  if (isDashboardFilterActive()) {
    return applyFilters(State.woList, true);
  }
  if (State.dashboardView === 'ALL' || State.dashboardView === 'READY_INVOICE') {
    return getDashboardBaseList(State.woList);
  }
  return getDashboardBaseList(State.woList).filter(isCurrentMonth);
}

function bindDashboardControls() {
  // Stats show/hide toggle (preference persisted in localStorage)
  const statsToggleBtn = id('toggleStatsBtn');
  const statsRow = document.querySelector('#pageDashboard .stats-row');
  if (statsToggleBtn && statsRow) {
    const applyStatsVisibility = (hidden) => {
      statsRow.style.display = hidden ? 'none' : '';
      statsToggleBtn.textContent = hidden ? '▼ Stats' : '▲ Stats';
    };
    applyStatsVisibility(localStorage.getItem('statsHidden') === 'true');
    statsToggleBtn.onclick = () => {
      const nowHidden = statsRow.style.display !== 'none';
      localStorage.setItem('statsHidden', nowHidden);
      applyStatsVisibility(nowHidden);
    };
  }

  const toggleBtn = id('toggleFilterBarBtn');
  const filterBar = id('dashboardFilterBar');
  if (toggleBtn && filterBar) {
    toggleBtn.onclick = () => {
      filterBar.classList.toggle('hidden');
      toggleBtn.textContent = filterBar.classList.contains('hidden') ? 'Search / Filter' : 'Hide Search';
    };
  }

  ['dashInProgressBtn', 'dashCompletedBtn', 'dashAllBtn', 'dashReadyInvoiceBtn'].forEach(btnId => {
    const btn = id(btnId);
    if (!btn) return;
    btn.onclick = () => {
      if (btnId === 'dashReadyInvoiceBtn') {
        State.dashboardView = 'READY_INVOICE';
      } else if (btnId === 'dashCompletedBtn') {
        State.dashboardView = 'COMPLETED';
      } else if (btnId === 'dashAllBtn') {
        State.dashboardView = 'ALL';
      } else {
        State.dashboardView = 'IN_PROGRESS';
      }
      State.dashPage = 1;
      renderDashboard();
    };
  });
}

const onDashboardFilterChange = () => applyFilters();

function bindDashboardFilters() {
  const filterIds = ['filterCustomer','filterMonth','filterYear','filterDateFrom','filterDateTo','filterInvDateFrom','filterInvDateTo','filterInvoiceType','filterStatus'];
  filterIds.forEach(fid => {
    const el = id(fid);
    if (!el) return;
    const evt = fid === 'filterCustomer' ? 'input' : 'change';
    el.removeEventListener(evt, onDashboardFilterChange);
    el.addEventListener(evt, onDashboardFilterChange);
  });
  const clearBtn = id('filterClearBtn');
  if (clearBtn) {
    clearBtn.removeEventListener('click', clearFilters);
    clearBtn.addEventListener('click', clearFilters);
  }
}

function getDashboardVisibleList() {
  const baseList = isDashboardFilterActive() ? State.woList : getDashboardBaseList(State.woList);
  return applyFilters(baseList, true);
}

function getDashboardBaseList(list) {
  if (State.dashboardView === 'COMPLETED') return list.filter(w => w.status === 'COMPLETED');
  if (State.dashboardView === 'ALL') return list;
  if (State.dashboardView === 'READY_INVOICE') return list.filter(w =>
    w.stockStatus === 'DONE' && w.packagingStatus === 'DONE' && w.invoiceStatus === 'PENDING'
  );
  return list.filter(w => w.status === 'IN_PROGRESS');
}

function isDashboardFilterActive() {
  return ['filterCustomer','filterMonth','filterYear','filterDateFrom','filterDateTo','filterInvDateFrom','filterInvDateTo','filterInvoiceType','filterStatus']
    .some(fid => {
      const el = id(fid);
      return el && String(el.value).trim() !== '';
    });
}

function applyFilters(sourceList = State.woList, returnOnly = false) {
  if (sourceList && sourceList.target && typeof sourceList.preventDefault === 'function') {
    sourceList = State.woList;
    returnOnly = false;
  }
  if (!returnOnly) State.dashPage = 1;
  const q    = String(id('filterCustomer')?.value || '').toLowerCase();
  const m    = id('filterMonth')?.value;
  const y    = id('filterYear')?.value;
  const df   = id('filterDateFrom')?.value;
  const dt   = id('filterDateTo')?.value;
  const idf  = id('filterInvDateFrom')?.value;
  const idt  = id('filterInvDateTo')?.value;
  const it   = id('filterInvoiceType')?.value;
  const s    = id('filterStatus')?.value;
  let list   = sourceList;
  if (q) {
    list = list.filter(w => {
      const customerMatch = String(w.customerName || '').toLowerCase().includes(q);
      const invoiceMatch = String(w.invoiceNumber || '').toLowerCase().includes(q);
      return customerMatch || invoiceMatch;
    });
  }
  if (m)   list = list.filter(w => w.woDate && new Date(w.woDate + 'T00:00:00').getMonth()+1 === parseInt(m, 10));
  if (y)   list = list.filter(w => w.woDate && new Date(w.woDate + 'T00:00:00').getFullYear() === parseInt(y, 10));
  if (df)  list = list.filter(w => w.woDate && w.woDate >= df);
  if (dt)  list = list.filter(w => w.woDate && w.woDate <= dt);
  if (idf) list = list.filter(w => w.invoiceDate && w.invoiceDate >= idf);
  if (idt) list = list.filter(w => w.invoiceDate && w.invoiceDate <= idt);
  if (it)  list = list.filter(w => (w.invoiceType || 'Commercial') === it);
  if (s)   list = list.filter(w => w.status === s);
  if (returnOnly) return list;
  renderWoTable(list);
}

function clearFilters() {
  ['filterCustomer','filterMonth','filterYear','filterDateFrom','filterDateTo','filterInvDateFrom','filterInvDateTo','filterInvoiceType','filterStatus']
    .forEach(fid => { const el = id(fid); if (el) el.value = ''; });
  State.dashPage = 1;
  renderWoTable(getDashboardBaseList(State.woList));
}

function renderWoTable(list) {
  const loadingEl = id('woTableLoading');
  if (loadingEl) loadingEl.style.display = 'none';
  State.dashDisplayList = list;
  const tbody = id('woTableBody');
  // Ensure the cards container exists next to the table-card
  let cardsEl = id('woCardsContainer');
  if (!cardsEl) {
    cardsEl = document.createElement('div');
    cardsEl.id = 'woCardsContainer';
    cardsEl.className = 'wo-cards';
    const tableCard = id('woTable').closest('.table-card');
    tableCard.parentNode.insertBefore(cardsEl, tableCard);
  }

  if (!list.length) {
    id('woTable').style.display = 'none';
    id('woTableEmpty').style.display = 'block';
    cardsEl.innerHTML = '';
    const pEl = id('dashPagination');
    if (pEl) pEl.innerHTML = '';
    return;
  }
  id('woTable').style.display = 'table';
  id('woTableEmpty').style.display = 'none';

  const { items, safePage, totalPages, total } = paginateList(list, State.dashPage);
  State.dashPage = safePage;
  tbody.innerHTML = items.map(w => woRow(w)).join('');
  cardsEl.innerHTML = items.map(w => woCard(w)).join('');
  renderPagination('dashPagination', safePage, totalPages, total, 'setDashPage');

  // Use .onclick (property assignment) to prevent stacking listeners across re-renders
  tbody.onclick = (e) => {
    if (e.target.closest('a[href]')) return;
    const row = e.target.closest('tr[data-detail]');
    if (row?.dataset.detail) openWoDetail(parseInt(row.dataset.detail));
  };
  cardsEl.onclick = (e) => {
    if (e.target.closest('a[href]')) return;
    const row = e.target.closest('.wo-card[data-detail]');
    if (row?.dataset.detail) openWoDetail(parseInt(row.dataset.detail));
  };
  tbody.onmouseover = (e) => {
    const row = e.target.closest('tr[data-detail]');
    if (!row) return;
    const rows = [...tbody.querySelectorAll('tr[data-detail]')];
    const idx = rows.indexOf(row);
    if (idx !== _focusedRowIndex) setRowFocus(rows, idx);
  };
}

function woCard(w) {
  const statusClass = w.status === 'COMPLETED' ? 'status-completed' : w.status === 'REVISED' ? 'status-revised' : '';
  const steps = [
    { label: 'Stock',    status: w.stockStatus },
    { label: 'Packing',  status: w.packagingStatus },
    { label: 'Invoice',  status: w.invoiceStatus },
    { label: 'Ready',    status: w.readyForDispatchStatus || 'PENDING' },
    { label: 'Collect',  status: w.collectionStatus || 'PENDING' },
  ];
  const stepsHtml = steps.map(s => `
    <div class="wo-card-step">
      <span class="badge ${s.status === 'DONE' ? 'badge-done' : 'badge-pending'}" style="font-size:.65rem;padding:2px 5px">${s.status === 'DONE' ? '✓' : '…'}</span>
      <span class="wo-card-step-label">${s.label}</span>
    </div>`).join('');
  const flags = `${w.hasNote ? ' 📝' : ''}${w.hasInvoiceIssue ? ' ⚠' : ''}`;
  const xlsBtn = w.latestExcelFileId
    ? `<a href="/api/files/download/${w.latestExcelFileId}?token=${State.token}" class="btn btn-outline btn-xs">↓ XLS</a>` : '';
  const pdfBtn = w.latestPdfFileId
    ? `<a href="/api/files/view/${w.latestPdfFileId}?token=${State.token}" target="_blank" class="btn btn-outline btn-xs">↓ PDF</a>` : '';

  return `<div class="wo-card ${statusClass}" data-detail="${w.id}">
    <div class="wo-card-top">
      <div>
        <div class="wo-card-num">${esc(w.woNumber)}${w.revised ? ' <span style="color:var(--amber);font-size:.75rem">↻ v'+w.version+'</span>' : ''}</div>
        <div class="wo-card-customer">${esc(w.customerName)}${flags}</div>
        <div class="wo-card-date">${formatDate(w.woDate)} &nbsp;·&nbsp; ${esc(w.shipmentMode||'—')} &nbsp;·&nbsp; ${esc(w.invoiceType||'Commercial')}</div>
      </div>
      <div>${statusBadgeHtml(w.status)}</div>
    </div>
    <div class="wo-card-steps">${stepsHtml}</div>
    <div class="wo-card-actions" onclick="event.stopPropagation()">
      <button class="btn btn-outline btn-sm" onclick="openWoDetail(${w.id})">👁 View</button>
      ${xlsBtn}${pdfBtn}
    </div>
  </div>`;
}

function woRow(w) {
  const statusBadge = statusBadgeHtml(w.status);
  const xlsBtn = w.latestExcelFileId
    ? `<a href="/api/files/download/${w.latestExcelFileId}?token=${State.token}" class="btn btn-outline btn-xs" title="${w.latestExcelFileName}">↓ XLS</a><button class="btn btn-outline btn-xs" onclick="viewExcel(${w.latestExcelFileId},'${esc(w.latestExcelFileName||'Excel')}')">👁</button>` : '';
  const pdfBtn = w.latestPdfFileId
    ? `<a href="/api/files/download/${w.latestPdfFileId}?token=${State.token}" class="btn btn-outline btn-xs" title="${w.latestPdfFileName}">↓ PDF</a><a href="/api/files/view/${w.latestPdfFileId}?token=${State.token}" target="_blank" class="btn btn-outline btn-xs">👁</a>` : '';
  const flags = `${w.hasNote ? '📝' : ''}${w.hasInvoiceIssue ? ' ⚠' : ''}`;
  const versionBadge = w.revised ? `<span class="badge badge-revised" style="font-size:.68rem">v${w.version}</span>` : `v${w.version}`;

  return `<tr data-detail="${w.id}">
    <td><span class="wo-number-link">${w.woNumber}</span>${w.revised?`<br><span style="font-size:.7rem;color:var(--amber)">↻ Revised</span>`:''}</td>
    <td><span style="font-size:.82rem">${esc(w.customerName)}</span><br><span style="font-size:.7rem;color:var(--text3)">${formatDate(w.woDate)}</span></td>
    <td><span style="font-size:.8rem">${esc(w.shipmentMode||'—')}</span></td>
    <td><span class="badge badge-ip" style="font-size:.72rem">${esc(w.invoiceType||'Commercial')}</span></td>
    <td>${stepBadge(w.stockStatus)}</td>
    <td>${stepBadge(w.packagingStatus)}<br><span style="font-size:.7rem;color:var(--text3)">${w.packingType==='01_BOX'?'01 Box':w.packingType==='MORE_THAN_ONE_BOX'?'>1 Box':''}</span></td>
    <td>${stepBadge(w.invoiceStatus)}${w.invoiceNumber?`<br><span style="font-size:.7rem;color:var(--text3)">${esc(w.invoiceNumber)}</span>`:''}</td>
    <td>${stepBadge(w.readyForDispatchStatus||'PENDING')}</td>
    <td>${stepBadge(w.collectionStatus||'PENDING')}</td>
    <td>${statusBadge}</td>
    <td>${versionBadge}</td>
    <td>${flags||'—'}</td>
    <td class="col-actions" onclick="event.stopPropagation()">
      <button class="btn btn-outline btn-xs" onclick="openWoDetail(${w.id})">👁 View</button>
      ${xlsBtn}${pdfBtn}
    </td>
  </tr>`;
}

function stepBadge(status) {
  if (!status) status = 'PENDING';
  return status === 'DONE'
    ? `<span class="badge badge-done">Done</span>`
    : `<span class="badge badge-pending">Pending</span>`;
}

function statusBadgeHtml(status) {
  const map = {
    IN_PROGRESS: '<span class="badge badge-ip">In Progress</span>',
    COMPLETED:   '<span class="badge badge-completed">Completed</span>',
    REVISED:     '<span class="badge badge-revised">Revised</span>',
  };
  return map[status] || status;
}

// ── ALL WO PAGE ────────────────────────────────────────────────────
async function loadAllWo() {
  const container = id('allWoContent');
  container.onclick = (e) => {
    if (e.target.closest('a[href]')) return;
    const row = e.target.closest('tr[data-detail], .wo-card[data-detail]');
    if (row?.dataset.detail) openWoDetail(parseInt(row.dataset.detail));
  };

  // Wire All WO filter controls (once via flag)
  const filterQ = id('allWoFilterQ');
  const filterStatus = id('allWoFilterStatus');
  if (filterQ && !filterQ._bound) {
    filterQ._bound = true;
    filterQ.addEventListener('input', filterAllWoContent);
    filterStatus?.addEventListener('change', filterAllWoContent);
    id('allWoFilterClearBtn')?.addEventListener('click', () => {
      if (filterQ) filterQ.value = '';
      if (filterStatus) filterStatus.value = '';
      State.allWoFilters = { q: '', status: '' };
      State.allWoPage = 1;
      renderAllWoContent(State.woList);
    });
    id('allWoToggleFilterBtn')?.addEventListener('click', () => {
      const bar = id('allWoFilterBar');
      const btn = id('allWoToggleFilterBtn');
      bar?.classList.toggle('hidden');
      if (btn) btn.textContent = bar?.classList.contains('hidden') ? 'Search / Filter' : 'Hide Search';
    });
    id('allWoExportCsvBtn')?.addEventListener('click', exportAllWoCsv);
  }

  // Restore filter inputs from state
  if (filterQ) filterQ.value = State.allWoFilters.q;
  if (filterStatus) filterStatus.value = State.allWoFilters.status;

  if (State.woList.length) {
    renderAllWoContent(applyAllWoFilters(State.woList));
    return;
  }
  container.innerHTML = '<div class="loading-state">Loading…</div>';
  try {
    const res = await api('/api/workorders');
    State.woList = res.data || [];
    renderAllWoContent(applyAllWoFilters(State.woList));
  } catch(e) { container.innerHTML = '<div class="alert alert-error">Failed to load</div>'; }
}

function renderAllWoContent(list) {
  State.allWoDisplayList = list;
  const container = id('allWoContent');
  const paginationEl = id('allWoPagination');
  if (!list.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>No dispatch lists found</p></div>';
    if (paginationEl) paginationEl.innerHTML = '';
    return;
  }
  const { items, safePage, totalPages, total } = paginateList(list, State.allWoPage);
  State.allWoPage = safePage;
  container.innerHTML = `
    <div class="wo-cards" id="allWoCards">${items.map(w => woCard(w)).join('')}</div>
    <div class="table-card"><div class="table-wrap">
      <table class="wo-table">
        <thead><tr>
          <th>Dispatch No.</th><th>Customer</th><th>Shipment</th><th>Invoice Type</th>
          <th>Stock</th><th>Box Details</th><th>Invoice</th>
          <th>Ready For Dispatch</th><th>Collection</th>
          <th>Status</th><th>Ver.</th><th>Actions</th>
        </tr></thead>
        <tbody>${items.map(w => woRow(w)).join('')}</tbody>
      </table>
    </div></div>`;
  renderPagination('allWoPagination', safePage, totalPages, total, 'setAllWoPage');
}

// ── CREATE FORM ─────────────────────────────────────────────────────
function initCreateForm() {
  resetCreateForm();
  id('addShipmentModeBtn')?.addEventListener('click', () => showCreateLookupModal('shipment-mode'));
  id('addInvoiceTypeBtn')?.addEventListener('click', () => showCreateLookupModal('invoice-type'));
  id('createWoBtn')?.addEventListener('click', submitCreateWo);
}

function resetCreateForm() {
  // Clear customer
  const searchInput = id('customerSearch');
  if (searchInput) searchInput.value = '';
  const hidden = id('selectedCustomer');
  if (hidden) hidden.value = '';
  State.selectedCustomer = null;
  const list = id('customerList');
  if (list) list.style.display = 'none';

  // Reset selects to first/default option
  populateSelect('woShipment', State.shipmentModes, '');
  populateSelect('woInvoiceType', State.invoiceTypes, 'Commercial');

  // Reset date to today
  id('woDate').value = new Date().toISOString().slice(0, 10);

  // Clear file upload
  const fileInput = id('woExcelFile');
  if (fileInput) fileInput.value = '';
  const fileName = id('excelFileName');
  if (fileName) { fileName.style.display = 'none'; fileName.textContent = ''; }
  const dropZone = id('excelDropZone');
  if (dropZone) dropZone.classList.remove('has-file');

  // Clear alert
  const alert = id('createWoAlert');
  if (alert) alert.style.display = 'none';

  // Re-setup dropdowns freshly
  setupCustomerDropdown();
  setupFileDrop('excelDropZone', 'woExcelFile', 'excelFileName', ['.xlsx','.xls']);
}

function setupCustomerDropdown() {
  const searchInput = id('customerSearch');
  const listEl = id('customerList');
  const hidden = id('selectedCustomer');
  State.selectedCustomer = null;
  hidden.value = '';

  function renderList(items) {
    listEl.innerHTML = '';
    if (!items.length) {
      listEl.innerHTML = '<div class="dropdown-item no-results">No results found</div>';
    } else {
      items.forEach(c => {
        const div = document.createElement('div');
        div.className = 'dropdown-item';
        div.textContent = c.name;
        div.addEventListener('click', () => {
          searchInput.value = c.name;
          hidden.value = c.name;
          State.selectedCustomer = c.name;
          listEl.style.display = 'none';
        });
        listEl.appendChild(div);
      });
    }
    // Create new option
    const createDiv = document.createElement('div');
    createDiv.className = 'dropdown-item create-new';
    createDiv.textContent = '+ Create New Customer';
    createDiv.addEventListener('click', () => {
      listEl.style.display = 'none';
      showCreateCustomerModal(searchInput.value);
    });
    listEl.appendChild(createDiv);
    listEl.style.display = 'block';
  }

  searchInput.addEventListener('focus', () => renderList(State.customers));
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase();
    const filtered = State.customers.filter(c => c.name.toLowerCase().includes(q));
    renderList(filtered);
    hidden.value = searchInput.value;
    State.selectedCustomer = searchInput.value;
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#customerDropdown')) listEl.style.display = 'none';
  }, { capture: true });
}

function populateSelect(selectId, items, defaultValue) {
  const sel = id(selectId);
  if (!sel) return;
  const current = sel.value || defaultValue;
  sel.innerHTML = `<option value="">Select…</option>` +
    items.map(i => `<option value="${esc(i.name)}" ${i.name === current ? 'selected' : ''}>${esc(i.name)}</option>`).join('');
  if (defaultValue) sel.value = defaultValue;
}

async function submitCreateWo() {
  const customerName = id('selectedCustomer').value || id('customerSearch').value.trim();
  const shipmentMode = id('woShipment').value;
  const invoiceType  = id('woInvoiceType').value || 'Commercial';
  const woDate       = id('woDate').value;
  const excelFile    = id('woExcelFile').files[0];
  const alertEl      = id('createWoAlert');

  if (!customerName) { showAlert(alertEl, 'Please select or enter a customer.', 'error'); return; }
  if (!shipmentMode) { showAlert(alertEl, 'Please select a shipment mode.', 'error'); return; }
  if (!woDate) { showAlert(alertEl, 'Please select a dispatch date.', 'error'); return; }
  if (!excelFile) { showAlert(alertEl, 'Please upload an Excel file.', 'error'); return; }

  alertEl.style.display = 'none';
  const btn = id('createWoBtn');
  btn.disabled = true; btn.textContent = 'Creating…';

  try {
    const formData = new FormData();
    formData.append('data', new Blob([JSON.stringify({ customerName, shipmentMode, invoiceType, woDate })], { type:'application/json' }));
    formData.append('excelFile', excelFile);
    const res = await apiFormData('/api/workorders', formData);
    showToast('Dispatch created: ' + res.data.woNumber, 'success');
    triggerImmediateSync();
    navigateTo('dashboard');
  } catch(e) {
    showAlert(alertEl, e.message || 'Failed to create dispatch', 'error');
  } finally { btn.disabled = false; btn.textContent = 'Create Dispatch'; }
}

// ── DETAIL PAGE ─────────────────────────────────────────────────────
async function openWoDetail(id_) {
  navigateTo('detail');
  localStorage.setItem('lastWoId', id_);
  id('woDetailContent').innerHTML = '<div class="loading-state">Loading dispatch details...</div>';
  try {
    const res = await api(`/api/workorders/${id_}`);
    if (!res || !res.data) throw new Error("Empty response from server");
    State.currentWo = res.data;
    try {
      renderWoDetail(res.data);
    } catch (renderError) {
      console.error("Render Error:", renderError);
      throw new Error("Failed to render dispatch details due to unexpected data format.");
    }
  } catch(e) {
    console.error("Error opening dispatch detail:", e);
    id('woDetailContent').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon" style="color:var(--danger)">⚠</div>
        <p style="margin-bottom: 16px;">Failed to load dispatch details: ${esc(e.message)}</p>
        <button class="btn btn-primary" onclick="openWoDetail(${id_})">⟳ Retry Loading</button>
      </div>`;
  }
}

function renderWoDetail(wo) {
  id('detailWoNumber').textContent = wo.woNumber;
  id('detailCustomerName').textContent = wo.customerName;
  id('detailWoBadges').innerHTML = statusBadgeHtml(wo.status) +
    (wo.revised ? ` <span class="badge badge-revised">Rev v${wo.version}</span>` : '');
  const deleteBtn = id('btnDeleteWo');
  if (deleteBtn) {
    deleteBtn.style.display = State.user?.role === 'GENERAL_MANAGER' ? 'flex' : 'none';
    deleteBtn.onclick = () => confirmDeleteWo(wo.id, wo.woNumber);
  }
  id('backBtn').onclick = () => navigateTo(State.prevPage || 'dashboard');

  const role = State.user?.role;
  const html = `
    <!-- Info Grid -->
    <div class="detail-grid">
      <div class="detail-section">
        <div class="detail-section-header">Dispatch Info</div>
        <div class="detail-section-body">
          <div class="detail-row"><span class="detail-label">Dispatch No.</span><span class="detail-value" style="font-family:monospace">${esc(wo.woNumber)}</span></div>
          <div class="detail-row"><span class="detail-label">Customer</span><span class="detail-value">${esc(wo.customerName)}</span></div>
          <div class="detail-row"><span class="detail-label">Shipment Mode</span><span class="detail-value">${esc(wo.shipmentMode||'—')}</span></div>
          <div class="detail-row"><span class="detail-label">Invoice Type</span><span class="detail-value"><span class="badge badge-ip">${esc(wo.invoiceType||'Commercial')}</span></span></div>
          <div class="detail-row"><span class="detail-label">Dispatch Date</span><span class="detail-value">${formatDate(wo.woDate)}</span></div>
          <div class="detail-row"><span class="detail-label">Created By</span><span class="detail-value">${esc(wo.createdBy||'—')}</span></div>
          <div class="detail-row"><span class="detail-label">Version</span><span class="detail-value">v${wo.version}</span></div>
        </div>
      </div>

      <!-- Status Flow -->
      <div class="detail-section">
        <div class="detail-section-header">Status Flow</div>
        <div class="detail-section-body">
          ${renderStockStep(wo, role)}
          ${renderPackingStep(wo, role)}
          ${renderInvoiceStep(wo, role)}
          ${wo.packingType === 'MORE_THAN_ONE_BOX' ? renderPackingDetailsStep(wo, role) : ''}
          ${renderRFDStep(wo, role)}
          ${renderCollectionStep(wo, role)}
        </div>
      </div>
    </div>

    <!-- Files & Notes -->
    <div class="detail-grid">
      <div class="detail-section">
        <div class="detail-section-header">Box Details</div>
        <div class="detail-section-body">
          ${renderPackagingDetailsSection(wo)}
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-header">Files
          ${role === 'GENERAL_MANAGER' ? `<button class="btn btn-outline btn-xs" id="reviseExcelBtn">↑ Upload Revision</button>` : ''}
          ${(role === 'INVOICE_CREATOR') ? `<button class="btn btn-outline btn-xs" id="uploadPdfBtn">↑ Invoice PDF</button>` : ''}
        </div>
        <div class="detail-section-body">
          ${renderFileSection('Excel Files', wo.excelFiles)}
          ${renderFileSection('Invoice PDFs', wo.pdfFiles)}
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-header">Notes & Issues</div>
        <div class="detail-section-body">
          ${renderNotesSection(wo, role)}
        </div>
      </div>
    </div>

    <!-- Activity Log -->
    <div class="detail-section" style="margin-top:16px">
      <div class="detail-section-header">Activity Log</div>
      <div class="detail-section-body">
        ${renderActivityLog(wo.activityLogs)}
      </div>
    </div>
  `;
  id('woDetailContent').innerHTML = html;
  bindDetailActions(wo);
}

function renderStockStep(wo, role) {
  const isDone = wo.stockStatus === 'DONE';
  const canToggle = role === 'STORE';
  const nextDone = wo.packagingStatus === 'DONE';
  const canRevert = canToggle && isDone && !nextDone;
  return `<div class="step-row">
    <div><div class="step-label">Stock</div><div class="step-sub">${isDone && wo.stockUpdatedBy ? 'By '+wo.stockUpdatedBy : ''}</div></div>
    <div class="step-actions">
      ${stepBadge(wo.stockStatus)}
      ${canToggle && !isDone ? `<button class="btn btn-success btn-xs" id="stockDoneBtn">Mark Done</button>` : ''}
      ${canRevert ? `<button class="btn btn-amber btn-xs" id="stockRevertBtn">Revert</button>` : ''}
    </div>
  </div>`;
}

function renderPackingStep(wo, role) {
  const isDone = wo.packagingStatus === 'DONE';
  const canToggle = role === 'STORE';
  const nextDone = wo.invoiceStatus === 'DONE';
  const canRevert = canToggle && isDone && !nextDone;
  const packingTypeLabel = wo.packingType === '01_BOX' ? '01 Box' : wo.packingType === 'MORE_THAN_ONE_BOX' ? 'More Than One Box' : '';
  return `<div class="step-row">
    <div style="flex:1;min-width:0">
      <div class="step-label">Box Details ${packingTypeLabel ? `<small style="color:var(--text3)">(${packingTypeLabel})</small>` : ''}</div>
      <div class="step-sub">${isDone && wo.packagingUpdatedBy ? 'By '+wo.packagingUpdatedBy : ''}</div>
    </div>
    <div class="step-actions">
      ${stepBadge(wo.packagingStatus)}
      ${canToggle && !isDone ? `<button class="btn btn-success btn-xs" id="packingEditBtn">Enter Details</button>` : ''}
      ${canRevert ? `<button class="btn btn-amber btn-xs" id="packingRevertBtn">Revert</button>` : ''}
      ${isDone && canToggle ? `<button class="btn btn-outline btn-xs" id="packingEditBtn2">Edit</button>` : ''}
    </div>
  </div>`;
}

function renderPackingDetailsStep(wo, role) {
  const isDone = (wo.packingDetailsStatus || 'PENDING') === 'DONE';
  const canToggle = role === 'STORE';
  const invoiceDone = wo.invoiceStatus === 'DONE';
  const nextDone = (wo.readyForDispatchStatus || 'PENDING') === 'DONE';
  const canRevert = canToggle && isDone && !nextDone;
  const fileHtml = isDone && wo.latestPackingFileId
    ? `<div class="step-sub" style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap">
        <a href="/api/files/download/${wo.latestPackingFileId}?token=${State.token}" class="btn btn-outline btn-xs">↓ ${esc(wo.latestPackingFileName||'Packing File')}</a>
        <button class="btn btn-outline btn-xs" onclick="viewExcel(${wo.latestPackingFileId},'${esc(wo.latestPackingFileName||'Packing')}')">👁 View</button>
       </div>`
    : '';
  return `<div class="step-row">
    <div style="flex:1;min-width:0">
      <div class="step-label">Packing Details <small style="color:var(--text3)">(File Upload)</small></div>
      <div class="step-sub">${isDone && wo.packingDetailsUpdatedBy ? 'By '+wo.packingDetailsUpdatedBy : !invoiceDone ? 'Waiting for Invoice' : 'Upload packing details file'}</div>
      ${fileHtml}
    </div>
    <div class="step-actions">
      ${stepBadge(wo.packingDetailsStatus || 'PENDING')}
      ${canToggle && !isDone && invoiceDone ? `<button class="btn btn-success btn-xs" id="packingDetailsUploadBtn">Upload File</button>` : ''}
      ${canRevert ? `<button class="btn btn-amber btn-xs" id="packingDetailsRevertBtn">Revert</button>` : ''}
      ${isDone && canToggle ? `<button class="btn btn-outline btn-xs" id="packingDetailsEditBtn">Replace</button>` : ''}
    </div>
  </div>`;
}

function renderInvoiceStep(wo, role) {
  const isDone = wo.invoiceStatus === 'DONE';
  const canToggle = role === 'INVOICE_CREATOR';
  const nextDone = wo.readyForDispatchStatus === 'DONE';
  const canRevert = canToggle && isDone && !nextDone;
  return `<div class="step-row">
    <div>
      <div class="step-label">Invoice ${wo.invoiceNumber ? `<small style="color:var(--text3)">(${wo.invoiceNumber}${wo.invoiceDate ? ' · ' + formatDate(wo.invoiceDate) : ''})</small>` : ''}</div>
      <div class="step-sub">${isDone && wo.invoiceUpdatedBy ? 'By '+wo.invoiceUpdatedBy : ''}</div>
    </div>
    <div class="step-actions">
      ${stepBadge(wo.invoiceStatus)}
      ${canToggle && !isDone ? `<button class="btn btn-success btn-xs" id="invoiceDoneBtn">Mark Done</button>` : ''}
      ${canRevert ? `<button class="btn btn-amber btn-xs" id="invoiceRevertBtn">Revert</button>` : ''}
      ${isDone && canToggle ? `<button class="btn btn-outline btn-xs" id="invoiceEditBtn">Edit</button>` : ''}
    </div>
  </div>`;
}

function renderRFDStep(wo, role) {
  const isDone = (wo.readyForDispatchStatus||'PENDING') === 'DONE';
  const canToggle = role === 'STORE';
  const nextDone = (wo.collectionStatus||'PENDING') === 'DONE';
  const canRevert = canToggle && isDone && !nextDone;
  return `<div class="step-row">
    <div><div class="step-label">Ready For Dispatch</div><div class="step-sub">${isDone && wo.readyForDispatchUpdatedBy ? 'By '+wo.readyForDispatchUpdatedBy : ''}</div></div>
    <div class="step-actions">
      ${stepBadge(wo.readyForDispatchStatus||'PENDING')}
      ${canToggle && !isDone ? `<button class="btn btn-success btn-xs" id="rfdDoneBtn">Mark Done</button>` : ''}
      ${canRevert ? `<button class="btn btn-amber btn-xs" id="rfdRevertBtn">Revert</button>` : ''}
    </div>
  </div>`;
}

function renderCollectionStep(wo, role) {
  const isDone = (wo.collectionStatus||'PENDING') === 'DONE';
  const canToggle = role === 'STORE';
  const canRevert = canToggle && isDone;
  return `<div class="step-row">
    <div><div class="step-label">Collection</div><div class="step-sub">${isDone && wo.collectionUpdatedBy ? 'By '+wo.collectionUpdatedBy : ''}</div></div>
    <div class="step-actions">
      ${stepBadge(wo.collectionStatus||'PENDING')}
      ${canToggle && !isDone ? `<button class="btn btn-success btn-xs" id="collectionDoneBtn">Mark Done</button>` : ''}
      ${canRevert ? `<button class="btn btn-amber btn-xs" id="collectionRevertBtn">Revert</button>` : ''}
    </div>
  </div>`;
}

function renderPackagingDetailsSection(wo) {
  if (!wo.packagingDetails && (!wo.packingFiles || !wo.packingFiles.length)) {
    return `<div style="color:var(--text3);font-size:.78rem">No packing details added yet</div>`;
  }

  let html = '';

  // Show text details for both box types
  if (wo.packagingDetails) {
    html += `<div style="margin-bottom:12px">
      <strong style="font-size:.78rem;color:var(--text2)">Details (Text)</strong>
      <div style="background:var(--surface-alt);padding:8px;border-radius:4px;margin-top:6px;font-size:.85rem;line-height:1.5;white-space:pre-wrap;word-wrap:break-word;color:var(--text)">${esc(wo.packagingDetails)}</div>
    </div>`;
  }

  // Show packing files for MORE_THAN_ONE_BOX (these are in the Packing Details step)
  if (wo.packingFiles && wo.packingFiles.length > 0) {
    html += renderFileSection('Packing Files', wo.packingFiles);
  }

  return html;
}

function renderFileSection(title, files) {
  if (!files || !files.length) return `<div style="margin-bottom:12px"><strong style="font-size:.78rem;color:var(--text2)">${title}</strong><div style="color:var(--text3);font-size:.78rem;margin-top:4px">None</div></div>`;
  return `<div style="margin-bottom:12px">
    <strong style="font-size:.78rem;color:var(--text2)">${title}</strong>
    <div class="file-list" style="margin-top:6px">
      ${files.map(f => {
        const name = f.originalFileName || '';
        const isExcel = /\.(xlsx?|csv)$/i.test(name);
        const isPdf = /\.pdf$/i.test(name);
        const isInvoicePdf = title === 'Invoice PDFs' && isPdf;
        const viewBtn = isPdf
          ? `<a href="${f.downloadUrl.replace('/download/','/view/')}?token=${State.token}" target="_blank" class="btn btn-outline btn-xs">👁 View</a>`
          : isExcel
          ? `<button class="btn btn-outline btn-xs" onclick="viewExcel(${f.id},'${esc(name)}')">👁 View</button>`
          : '';
        const deleteBtn = (isInvoicePdf && State.user?.role === 'INVOICE_CREATOR')
          ? `<button class="btn btn-danger btn-xs" onclick="deleteInvoicePdf(${f.id},'${esc(name)}')">🗑 Delete</button>`
          : '';
        return `<div class="file-item">
          <div><div class="file-name">${esc(name)}</div><div class="file-meta">v${f.version} · ${f.uploadedBy||''}</div></div>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            ${viewBtn}
            <a href="${f.downloadUrl}?token=${State.token}" class="btn btn-outline btn-xs">↓ Download</a>
            ${deleteBtn}
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function renderNotesSection(wo, role) {
  const noteHtml = `
    <div style="margin-bottom:14px">
      <div style="font-size:.78rem;font-weight:700;color:var(--text2);margin-bottom:6px">NOTE FOR INVOICE CREATOR</div>
      ${wo.noteForInvoice ? `<div style="background:var(--surface2);border-radius:6px;padding:10px;font-size:.83rem">${esc(wo.noteForInvoice)}</div>` : `<div style="color:var(--text3);font-size:.78rem">No note</div>`}
      ${(role === 'GENERAL_MANAGER' || role === 'STORE') ? `<button class="btn btn-outline btn-xs" id="editNoteBtn" style="margin-top:8px">✏ Edit Note</button>` : ''}
    </div>`;
  const issueHtml = `
    <div>
      <div style="font-size:.78rem;font-weight:700;color:var(--text2);margin-bottom:6px">INVOICE ISSUE</div>
      ${wo.invoiceIssue ? `<div style="background:var(--red-bg);border-radius:6px;padding:10px;font-size:.83rem;color:var(--red)">⚠ ${esc(wo.invoiceIssue)}</div>` : `<div style="color:var(--text3);font-size:.78rem">No issues</div>`}
      ${role === 'INVOICE_CREATOR' ? `<button class="btn btn-outline btn-xs" id="reportIssueBtn" style="margin-top:8px">${wo.invoiceIssue ? '✏ Update Issue' : '⚠ Report Issue'}</button>` : ''}
    </div>`;
  return noteHtml + issueHtml;
}

function renderActivityLog(logs) {
  if (!logs || !logs.length) return '<div style="color:var(--text3);font-size:.83rem">No activity yet</div>';
  return `<div class="activity-list">${logs.map(l => `
    <div class="activity-item">
      <div class="activity-dot"></div>
      <div><div class="activity-action">${esc(l.action)}</div><div class="activity-time">${l.formattedTimestamp}</div></div>
    </div>`).join('')}</div>`;
}

function bindDetailActions(wo) {
  // Stock
  id('stockDoneBtn')?.addEventListener('click', async () => {
    await patchStatus(`/api/workorders/${wo.id}/stock?action=DONE`, 'Stock marked Done');
  });
  id('stockRevertBtn')?.addEventListener('click', async () => {
    await patchStatus(`/api/workorders/${wo.id}/stock?action=PENDING`, 'Stock reverted');
  });

  // Box Details (renamed from Packing Details)
  id('packingEditBtn')?.addEventListener('click', () => showPackingModal(wo));
  id('packingEditBtn2')?.addEventListener('click', () => showPackingModal(wo));
  id('packingRevertBtn')?.addEventListener('click', async () => {
    try {
      const res = await api(`/api/workorders/${wo.id}/packaging/revert`, 'PATCH');
      State.currentWo = res.data;
      renderWoDetail(res.data);
      showToast('Box Details reverted', 'success');
      triggerImmediateSync();
    } catch(e) { showToast(e.message, 'error'); }
  });

  // Packing Details (MORE_THAN_ONE_BOX only — file upload after invoice)
  id('packingDetailsUploadBtn')?.addEventListener('click', () => showPackingDetailsModal(wo));
  id('packingDetailsEditBtn')?.addEventListener('click', () => showPackingDetailsModal(wo));
  id('packingDetailsRevertBtn')?.addEventListener('click', async () => {
    try {
      const res = await api(`/api/workorders/${wo.id}/packing-details/revert`, 'PATCH');
      State.currentWo = res.data;
      renderWoDetail(res.data);
      showToast('Packing Details reverted', 'success');
      triggerImmediateSync();
    } catch(e) { showToast(e.message, 'error'); }
  });

  // Invoice
  id('invoiceDoneBtn')?.addEventListener('click', () => showInvoiceModal(wo, false));
  id('invoiceEditBtn')?.addEventListener('click', () => showInvoiceModal(wo, true));
  id('invoiceRevertBtn')?.addEventListener('click', async () => {
    try {
      const res = await api(`/api/workorders/${wo.id}/invoice/revert`, 'PATCH');
      State.currentWo = res.data;
      renderWoDetail(res.data);
      showToast('Invoice reverted', 'success');
      triggerImmediateSync();
    } catch(e) { showToast(e.message, 'error'); }
  });

  // Ready For Dispatch
  id('rfdDoneBtn')?.addEventListener('click', async () => {
    await patchStatus(`/api/workorders/${wo.id}/ready-for-dispatch?action=DONE`, 'Ready For Dispatch marked Done');
  });
  id('rfdRevertBtn')?.addEventListener('click', async () => {
    await patchStatus(`/api/workorders/${wo.id}/ready-for-dispatch?action=PENDING`, 'Ready For Dispatch reverted');
  });

  // Collection
  id('collectionDoneBtn')?.addEventListener('click', async () => {
    await patchStatus(`/api/workorders/${wo.id}/collection?action=DONE`, 'Collection marked Done');
  });
  id('collectionRevertBtn')?.addEventListener('click', async () => {
    await patchStatus(`/api/workorders/${wo.id}/collection?action=PENDING`, 'Collection reverted');
  });

  // Notes & Issues
  id('editNoteBtn')?.addEventListener('click', () => showNoteModal(wo));
  id('reportIssueBtn')?.addEventListener('click', () => showIssueModal(wo));

  // Files
  id('reviseExcelBtn')?.addEventListener('click', () => showRevisionModal(wo));
  id('uploadPdfBtn')?.addEventListener('click', () => showUploadPdfModal(wo));
}

async function patchStatus(url, successMsg) {
  try {
    const res = await api(url, 'PATCH');
    State.currentWo = res.data;
    renderWoDetail(res.data);
    showToast(successMsg, 'success');
    triggerImmediateSync();
  } catch(e) { showToast(e.message, 'error'); }
}

// ── BOX DETAILS MODAL (text only, both box types) ──────────────────
function showPackingModal(wo) {
  const isMoreBox = wo.packingType === 'MORE_THAN_ONE_BOX';
  showModal('Box Details', `
    <div class="packing-type-group">
      <button class="packing-type-btn ${!isMoreBox ? 'selected' : ''}" data-type="01_BOX" id="pt01Box">📦 01 BOX</button>
      <button class="packing-type-btn ${isMoreBox ? 'selected' : ''}" data-type="MORE_THAN_ONE_BOX" id="ptMoreBox">📦📦 More Than One BOX</button>
    </div>
    <div class="field-group" style="margin-bottom:14px">
      <label>Box Details <span class="req">*</span></label>
      <textarea id="packingDetailsText" rows="4" placeholder="Enter box details, dimensions, weight etc…">${esc(wo.packagingDetails||'')}</textarea>
    </div>
    <div id="packingAlert" class="alert" style="display:none;margin-top:10px"></div>
  `, [
    { label:'Save Box Details', cls:'btn-success', id:'savePackingBtn' },
    { label:'Cancel', cls:'btn-outline', close:true }
  ]);

  document.querySelectorAll('.packing-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.packing-type-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  id('savePackingBtn')?.addEventListener('click', async () => {
    const packingType = document.querySelector('.packing-type-btn.selected')?.dataset.type || '01_BOX';
    const packagingDetails = id('packingDetailsText').value.trim();
    const alertEl = id('packingAlert');
    if (!packagingDetails) { showAlert(alertEl, 'Box details text is required.', 'error'); return; }
    const btn = id('savePackingBtn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const res = await api(`/api/workorders/${wo.id}/packaging`, 'PUT', { packingType, packagingDetails });
      State.currentWo = res.data;
      renderWoDetail(res.data);
      closeModal();
      showToast('Box Details saved', 'success');
      triggerImmediateSync();
    } catch(e) { showAlert(alertEl, e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Save Box Details'; }
  });
}

// ── PACKING DETAILS MODAL (file upload — MORE_THAN_ONE_BOX only, after invoice) ──
function showPackingDetailsModal(wo) {
  showModal('Upload Packing Details', `
    <div style="background:var(--surface2);border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:.82rem">
      <strong>Invoice:</strong> ${wo.invoiceNumber || '—'}
      ${wo.invoiceDate ? ` &nbsp;·&nbsp; <strong>Date:</strong> ${formatDate(wo.invoiceDate)}` : ''}
    </div>
    <div class="field-group">
      <label>Packing Details File <span class="req">*</span> <small style="color:var(--text3)">(PDF or Word)</small></label>
      <div class="file-drop" id="packingDetailsDropZone">
        <div class="file-drop-icon">📎</div>
        <p>Drag &amp; drop or <span class="file-browse">browse</span></p>
        <p class="file-hint">.pdf, .docx, .doc, .xlsx, .xls</p>
        <input type="file" id="packingDetailsFile" accept=".pdf,.docx,.doc,.xlsx,.xls" style="display:none"/>
        <div id="packingDetailsFileName" class="file-selected" style="display:none"></div>
      </div>
    </div>
    <div id="packingDetailsAlert" class="alert" style="display:none;margin-top:10px"></div>
  `, [
    { label:'Upload Packing Details', cls:'btn-success', id:'savePackingDetailsBtn' },
    { label:'Cancel', cls:'btn-outline', close:true }
  ]);
  setupFileDrop('packingDetailsDropZone', 'packingDetailsFile', 'packingDetailsFileName', ['.pdf','.docx','.doc','.xlsx','.xls']);

  id('savePackingDetailsBtn')?.addEventListener('click', async () => {
    const file = id('packingDetailsFile').files[0];
    const alertEl = id('packingDetailsAlert');
    if (!file) { showAlert(alertEl, 'Please select a file to upload.', 'error'); return; }
    const btn = id('savePackingDetailsBtn');
    btn.disabled = true; btn.textContent = 'Uploading…';
    try {
      const formData = new FormData();
      formData.append('packingFile', file);
      const res = await apiFormData(`/api/workorders/${wo.id}/packing-details`, formData, 'PUT');
      State.currentWo = res.data;
      renderWoDetail(res.data);
      closeModal();
      showToast('Packing Details uploaded', 'success');
      triggerImmediateSync();
    } catch(e) { showAlert(alertEl, e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Upload Packing Details'; }
  });
}

// ── INVOICE MODAL ──────────────────────────────────────────────────
function showInvoiceModal(wo, isEdit) {
  const today = new Date().toISOString().slice(0,10);
  const existingDate = wo.invoiceDate ? wo.invoiceDate : today;
  showModal(isEdit ? 'Edit Invoice' : 'Mark Invoice Done', `
    <div class="field-group" style="margin-bottom:14px">
      <label>Invoice Number <span class="req">*</span></label>
      <input type="text" id="invoiceNumberInput" value="${esc(wo.invoiceNumber||'')}" placeholder="e.g. INV-2026-001"/>
    </div>
    <div class="field-group" style="margin-bottom:14px">
      <label>Invoice Date <span class="req">*</span></label>
      <input type="date" id="invoiceDateInput" value="${existingDate}" autocomplete="off"/>
    </div>
    <div class="field-group">
      <label>Attach Invoice PDF (optional)</label>
      <div class="file-drop" id="invPdfDropZone">
        <div class="file-drop-icon">📄</div>
        <p>Drag &amp; drop or <span class="file-browse">browse</span></p>
        <p class="file-hint">.pdf files only</p>
        <input type="file" id="invPdfFile" accept=".pdf" style="display:none"/>
        <div id="invPdfFileName" class="file-selected" style="display:none"></div>
      </div>
    </div>
    <div id="invoiceAlert" class="alert" style="display:none;margin-top:10px"></div>
  `, [
    { label: isEdit ? 'Update Invoice' : 'Mark Invoice Done', cls:'btn-success', id:'saveInvoiceBtn' },
    { label:'Cancel', cls:'btn-outline', close:true }
  ]);
  setupFileDrop('invPdfDropZone', 'invPdfFile', 'invPdfFileName', ['.pdf']);

  id('saveInvoiceBtn')?.addEventListener('click', async () => {
    const invoiceNumber = id('invoiceNumberInput').value.trim();
    const invoiceDate   = id('invoiceDateInput').value;
    const pdfFile = id('invPdfFile').files[0];
    const alertEl = id('invoiceAlert');
    if (!invoiceNumber) { showAlert(alertEl, 'Invoice number is required.', 'error'); return; }
    if (!invoiceDate)   { showAlert(alertEl, 'Invoice date is required.', 'error'); return; }
    const btn = id('saveInvoiceBtn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const formData = new FormData();
      formData.append('data', new Blob([JSON.stringify({ invoiceNumber, invoiceDate })], { type:'application/json' }));
      if (pdfFile) formData.append('pdfFile', pdfFile);
      const res = await apiFormData(`/api/workorders/${wo.id}/invoice`, formData, 'PUT');
      State.currentWo = res.data;
      renderWoDetail(res.data);
      closeModal();
      showToast(isEdit ? 'Invoice updated' : 'Invoice marked Done', 'success');
      triggerImmediateSync();
    } catch(e) { showAlert(alertEl, e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = isEdit ? 'Update Invoice' : 'Mark Invoice Done'; }
  });
}

// ── NOTE MODAL ─────────────────────────────────────────────────────
function showNoteModal(wo) {
  showModal('Edit Note for Invoice Creator', `
    <div class="field-group">
      <label>Note</label>
      <textarea id="noteText" rows="5" placeholder="Enter note…">${esc(wo.noteForInvoice||'')}</textarea>
    </div>
    <div id="noteAlert" class="alert" style="display:none;margin-top:10px"></div>
  `, [
    { label:'Save Note', cls:'btn-primary', id:'saveNoteBtn' },
    { label:'Cancel', cls:'btn-outline', close:true }
  ]);
  id('saveNoteBtn')?.addEventListener('click', async () => {
    const btn = id('saveNoteBtn');
    btn.disabled = true;
    try {
      const res = await api(`/api/workorders/${wo.id}/note`, 'PUT', { noteForInvoice: id('noteText').value });
      State.currentWo = res.data;
      renderWoDetail(res.data);
      closeModal();
      showToast('Note saved', 'success');
    } catch(e) { showAlert(id('noteAlert'), e.message, 'error'); }
    finally { btn.disabled = false; }
  });
}

// ── ISSUE MODAL ─────────────────────────────────────────────────────
function showIssueModal(wo) {
  showModal('Report Invoice Issue', `
    <div class="field-group">
      <label>Issue Description</label>
      <textarea id="issueText" rows="4" placeholder="Describe the issue…">${esc(wo.invoiceIssue||'')}</textarea>
    </div>
    <div id="issueAlert" class="alert" style="display:none;margin-top:10px"></div>
  `, [
    { label:'Save Issue', cls:'btn-danger', id:'saveIssueBtn' },
    { label:'Cancel', cls:'btn-outline', close:true }
  ]);
  id('saveIssueBtn')?.addEventListener('click', async () => {
    const btn = id('saveIssueBtn');
    btn.disabled = true;
    try {
      const res = await api(`/api/workorders/${wo.id}/invoice-issue`, 'PUT', { invoiceIssue: id('issueText').value });
      State.currentWo = res.data;
      renderWoDetail(res.data);
      closeModal();
      showToast('Issue saved', 'success');
    } catch(e) { showAlert(id('issueAlert'), e.message, 'error'); }
    finally { btn.disabled = false; }
  });
}

// ── REVISION MODAL ─────────────────────────────────────────────────
function showRevisionModal(wo) {
  showModal('Upload Excel Revision', `
    <div class="alert alert-warn" style="margin-bottom:14px">⚠ Uploading a revision will reset all step statuses to Pending.</div>
    <div class="field-group" style="margin-bottom:14px">
      <label>Revision Reason <span class="req">*</span></label>
      <textarea id="revisionReasonText" rows="3" placeholder="Reason for revision…"></textarea>
    </div>
    <div class="field-group">
      <label>New Excel File <span class="req">*</span></label>
      <div class="file-drop" id="revDropZone">
        <div class="file-drop-icon">📊</div>
        <p>Drag &amp; drop or <span class="file-browse">browse</span></p>
        <input type="file" id="revExcelFile" accept=".xlsx,.xls" style="display:none"/>
        <div id="revExcelFileName" class="file-selected" style="display:none"></div>
      </div>
    </div>
    <div id="revAlert" class="alert" style="display:none;margin-top:10px"></div>
  `, [
    { label:'Upload Revision', cls:'btn-primary', id:'submitRevBtn' },
    { label:'Cancel', cls:'btn-outline', close:true }
  ]);
  setupFileDrop('revDropZone', 'revExcelFile', 'revExcelFileName', ['.xlsx','.xls']);
  id('submitRevBtn')?.addEventListener('click', async () => {
    const reason = id('revisionReasonText').value.trim();
    const file = id('revExcelFile').files[0];
    const alertEl = id('revAlert');
    if (!reason) { showAlert(alertEl, 'Revision reason is required.', 'error'); return; }
    if (!file) { showAlert(alertEl, 'Excel file is required.', 'error'); return; }
    const btn = id('submitRevBtn');
    btn.disabled = true; btn.textContent = 'Uploading…';
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('revisionReason', reason);
      const res = await apiFormData(`/api/workorders/${wo.id}/excel`, formData, 'POST');
      State.currentWo = res.data;
      renderWoDetail(res.data);
      closeModal();
      showToast('Revision uploaded: v'+res.data.version, 'success');
    } catch(e) { showAlert(alertEl, e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Upload Revision'; }
  });
}

// ── UPLOAD PDF MODAL ────────────────────────────────────────────────
function showUploadPdfModal(wo) {
  showModal('Upload Invoice PDF', `
    <div class="file-drop" id="pdfDropZone2">
      <div class="file-drop-icon">📄</div>
      <p>Drag &amp; drop or <span class="file-browse">browse</span></p>
      <input type="file" id="pdfFileInput" accept=".pdf" style="display:none"/>
      <div id="pdfFileName2" class="file-selected" style="display:none"></div>
    </div>
    <div id="pdfAlert" class="alert" style="display:none;margin-top:10px"></div>
  `, [
    { label:'Upload PDF', cls:'btn-primary', id:'submitPdfBtn' },
    { label:'Cancel', cls:'btn-outline', close:true }
  ]);
  setupFileDrop('pdfDropZone2', 'pdfFileInput', 'pdfFileName2', ['.pdf']);
  id('submitPdfBtn')?.addEventListener('click', async () => {
    const file = id('pdfFileInput').files[0];
    if (!file) { showAlert(id('pdfAlert'), 'Please select a PDF.', 'error'); return; }
    const btn = id('submitPdfBtn');
    btn.disabled = true; btn.textContent = 'Uploading…';
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiFormData(`/api/workorders/${wo.id}/invoice/pdf`, formData, 'POST');
      State.currentWo = res.data;
      renderWoDetail(res.data);
      closeModal();
      showToast('PDF uploaded', 'success');
    } catch(e) { showAlert(id('pdfAlert'), e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Upload PDF'; }
  });
}

// ── DELETE CONFIRM ─────────────────────────────────────────────────
function confirmDeleteWo(woId, woNumber) {
  showModal('Delete Dispatch', `
    <div class="alert alert-error">⚠ Are you sure you want to delete <strong>${esc(woNumber)}</strong>? This cannot be undone.</div>
  `, [
    { label:'Delete', cls:'btn-danger', id:'confirmDeleteBtn' },
    { label:'Cancel', cls:'btn-outline', close:true }
  ]);
  id('confirmDeleteBtn')?.addEventListener('click', async () => {
    try {
      await api(`/api/workorders/${woId}`, 'DELETE');
      closeModal();
      showToast('Dispatch deleted', 'success');
      navigateTo('dashboard');
    } catch(e) { showToast(e.message, 'error'); }
  });
}

// ── CHANGE PASSWORD MODAL ──────────────────────────────────────────
function showChangePasswordModal() {
  showModal('Change Password', `
    <div class="field-group" style="margin-bottom:12px">
      <label>Current Password <span class="req">*</span></label>
      <input type="password" id="cpOld" placeholder="Current password"/>
    </div>
    <div class="field-group" style="margin-bottom:12px">
      <label>New Password <span class="req">*</span></label>
      <input type="password" id="cpNew" placeholder="New password"/>
    </div>
    <div class="field-group" style="margin-bottom:12px">
      <label>Confirm New Password <span class="req">*</span></label>
      <input type="password" id="cpConfirm" placeholder="Confirm new password"/>
    </div>
    <div id="cpAlert" class="alert" style="display:none;margin-top:8px"></div>
  `, [
    { label:'Change Password', cls:'btn-primary', id:'cpSubmitBtn' },
    { label:'Cancel', cls:'btn-outline', close:true }
  ]);
  id('cpSubmitBtn')?.addEventListener('click', async () => {
    const oldPassword    = id('cpOld').value;
    const newPassword    = id('cpNew').value;
    const confirmPassword = id('cpConfirm').value;
    const alertEl = id('cpAlert');
    if (!oldPassword || !newPassword || !confirmPassword) { showAlert(alertEl, 'All fields are required.', 'error'); return; }
    if (newPassword !== confirmPassword) { showAlert(alertEl, 'New passwords do not match.', 'error'); return; }
    const btn = id('cpSubmitBtn');
    btn.disabled = true; btn.textContent = 'Changing…';
    try {
      await api('/api/auth/change-password', 'POST', { oldPassword, newPassword, confirmPassword });
      closeModal();
      showToast('Password changed successfully', 'success');
    } catch(e) { showAlert(alertEl, e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Change Password'; }
  });
}

// ── CREATE LOOKUP MODALS ────────────────────────────────────────────
function showCreateCustomerModal(prefill) {
  showModal('Create New Customer', `
    <div class="field-group">
      <label>Customer Name <span class="req">*</span></label>
      <input type="text" id="newCustomerName" value="${esc(prefill||'')}" placeholder="Enter customer name"/>
    </div>
    <div id="createCustAlert" class="alert" style="display:none;margin-top:8px"></div>
  `, [
    { label:'Create Customer', cls:'btn-primary', id:'createCustBtn' },
    { label:'Cancel', cls:'btn-outline', close:true }
  ]);
  id('createCustBtn')?.addEventListener('click', async () => {
    const name = id('newCustomerName').value.trim();
    if (!name) { showAlert(id('createCustAlert'), 'Name required.', 'error'); return; }
    const btn = id('createCustBtn');
    btn.disabled = true;
    try {
      const res = await api('/api/lookup/customers', 'POST', { name });
      if (!State.customers.find(c => c.id === res.data.id))
        State.customers.push(res.data);
      id('customerSearch').value = res.data.name;
      id('selectedCustomer').value = res.data.name;
      State.selectedCustomer = res.data.name;
      closeModal();
      showToast('Customer created: ' + res.data.name, 'success');
    } catch(e) { showAlert(id('createCustAlert'), e.message, 'error'); }
    finally { btn.disabled = false; }
  });
}

function showCreateLookupModal(type) {
  const isMode = type === 'shipment-mode';
  const title = isMode ? 'Create Shipment Mode' : 'Create Invoice Type';
  const fieldId = isMode ? 'newModeValue' : 'newTypeValue';
  const alertId = isMode ? 'createModeAlert' : 'createTypeAlert';
  const btnId   = isMode ? 'createModeBtn' : 'createTypeBtn';
  showModal(title, `
    <div class="field-group">
      <label>Name <span class="req">*</span></label>
      <input type="text" id="${fieldId}" placeholder="Enter name"/>
    </div>
    <div id="${alertId}" class="alert" style="display:none;margin-top:8px"></div>
  `, [
    { label:'Create', cls:'btn-primary', id:btnId },
    { label:'Cancel', cls:'btn-outline', close:true }
  ]);
  id(btnId)?.addEventListener('click', async () => {
    const name = id(fieldId).value.trim();
    if (!name) { showAlert(id(alertId), 'Name required.', 'error'); return; }
    const url = isMode ? '/api/lookup/shipment-modes' : '/api/lookup/invoice-types';
    const btn = id(btnId);
    btn.disabled = true;
    try {
      const res = await api(url, 'POST', { name });
      if (isMode) {
        if (!State.shipmentModes.find(m => m.id === res.data.id)) State.shipmentModes.push(res.data);
        populateSelect('woShipment', State.shipmentModes, res.data.name);
      } else {
        if (!State.invoiceTypes.find(t => t.id === res.data.id)) State.invoiceTypes.push(res.data);
        populateSelect('woInvoiceType', State.invoiceTypes, res.data.name);
      }
      closeModal();
      showToast('Created: ' + res.data.name, 'success');
    } catch(e) { showAlert(id(alertId), e.message, 'error'); }
    finally { btn.disabled = false; }
  });
}

// ── NOTIFICATIONS (SSE) ─────────────────────────────────────────────
const NOTIF_ICONS = {
  DISPATCH_CREATED:          '🆕',
  DISPATCH_REVISED:          '🔄',
  STOCK_DONE:                '📦',
  STOCK_REVERT:              '↩️',
  PACKAGING_DONE:            '📫',
  PACKAGING_REVERT:          '↩️',
  INVOICE_DONE:              '🧾',
  INVOICE_REVERT:            '↩️',
  READY_FOR_DISPATCH_DONE:   '🚚',
  READY_FOR_DISPATCH_REVERT: '↩️',
  COLLECTION_DONE:           '✅',
  COLLECTION_REVERT:         '↩️',
  NOTE_ADDED:                '📝',
};

const NOTIF_TITLES = {
  DISPATCH_CREATED:          'New Dispatch Created',
  DISPATCH_REVISED:          'Dispatch Revised',
  STOCK_DONE:                'Stock Done',
  STOCK_REVERT:              'Stock Reverted',
  PACKAGING_DONE:            'Packing Details Added',
  PACKAGING_REVERT:          'Packing Reverted',
  INVOICE_DONE:              'Invoice Uploaded',
  INVOICE_REVERT:            'Invoice Reverted',
  READY_FOR_DISPATCH_DONE:   'Ready For Dispatch',
  READY_FOR_DISPATCH_REVERT: 'Ready For Dispatch Reverted',
  COLLECTION_DONE:           'Collection Done',
  COLLECTION_REVERT:         'Collection Reverted',
  INVOICE_ISSUE:             'Invoice Issue Reported',
  NOTE_ADDED:                'Note Added',
};

let _notifTab = 'all';
let _sseSource = null;
let _sseRetryDelay = 2000;

// ── KEYBOARD ROW NAVIGATION ─────────────────────────────────────────
let _focusedRowIndex = -1;

function getNavRows() {
  if (State.page === 'dashboard') return [...(id('woTableBody')?.querySelectorAll('tr[data-detail]') || [])];
  if (State.page === 'all-wo')   return [...(id('allWoContent')?.querySelectorAll('tbody tr[data-detail]') || [])];
  return [];
}

function setRowFocus(rows, idx) {
  rows.forEach((r, i) => r.classList.toggle('row-focused', i === idx));
  if (idx >= 0 && rows[idx]) rows[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  _focusedRowIndex = idx;
}

document.addEventListener('keydown', (e) => {
  // Don't hijack keys when typing in an input, select, or textarea
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  // Don't hijack when a modal is open
  if (id('modal')?.style.display === 'flex') return;

  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return;
  const rows = getNavRows();
  if (!rows.length) return;
  e.preventDefault();

  if (e.key === 'ArrowDown') {
    const next = _focusedRowIndex < 0 ? 0 : Math.min(_focusedRowIndex + 1, rows.length - 1);
    setRowFocus(rows, next);
  } else if (e.key === 'ArrowUp') {
    const prev = _focusedRowIndex < 0 ? rows.length - 1 : Math.max(_focusedRowIndex - 1, 0);
    setRowFocus(rows, prev);
  } else if (e.key === 'Enter' && _focusedRowIndex >= 0) {
    const row = rows[_focusedRowIndex];
    if (row?.dataset.detail) openWoDetail(parseInt(row.dataset.detail));
  }
});

// ── BELL PANEL ──────────────────────────────────────────────────────
function setupNotifications() {
  try {
    const raw = localStorage.getItem('notifications');
    State.notifications = raw ? JSON.parse(raw).map(n => ({ icon: '🔔', dispatchNo: '', ...n, read: n.read ?? false })) : [];
  } catch(_) { State.notifications = []; }

  renderNotifBadge();
  renderNotifList();

  id('notifBtn').onclick = (e) => {
    e.stopPropagation();
    const panel = id('notifPanel');
    const open = panel.style.display === 'flex';
    panel.style.display = open ? 'none' : 'flex';
  };

  id('notifMarkRead').onclick = (e) => {
    e.stopPropagation();
    State.notifications.forEach(n => n.read = true);
    saveNotifs(); renderNotifBadge(); renderNotifList();
  };

  id('notifClear').onclick = (e) => {
    e.stopPropagation();
    State.notifications = State.notifications.filter(n => !n.read);
    saveNotifs(); renderNotifBadge(); renderNotifList();
  };

  document.addEventListener('click', (e) => {
    const panel = id('notifPanel');
    if (panel && !id('notifBtn').contains(e.target) && !panel.contains(e.target))
      panel.style.display = 'none';
  });

  if (State.token) connectSSE();
}

function switchNotifTab(tab) {
  _notifTab = tab;
  id('notifTabAll').classList.toggle('active', tab === 'all');
  id('notifTabUnread').classList.toggle('active', tab === 'unread');
  renderNotifList();
}

function saveNotifs() {
  localStorage.setItem('notifications', JSON.stringify(State.notifications));
}

function markNotifRead(origIdx) {
  if (State.notifications[origIdx]) {
    State.notifications[origIdx].read = true;
    saveNotifs(); renderNotifBadge(); renderNotifList();
  }
}

function addNotification(eventType, message, dispatchNo) {
  if (!message || message.trim() === '') {
    console.warn('Notification received with empty message for eventType:', eventType);
    return;
  }
  const icon  = NOTIF_ICONS[eventType]  || '🔔';
  const title = NOTIF_TITLES[eventType] || 'Dispatch Update';
  const notif = { icon, text: message, time: new Date().toLocaleTimeString(), dispatchNo: dispatchNo || '', read: false };
  State.notifications.unshift(notif);
  if (State.notifications.length > 100) State.notifications.pop();
  saveNotifs(); 
  renderNotifBadge(); 
  renderNotifList();
  showToast(`${icon} ${message}`, 'info');
  fireDesktopNotif(`${icon} ${title}`, message);
}

function renderNotifBadge() {
  const badge = id('notifBadge');
  if (!badge) return;
  const unread = State.notifications.filter(n => !n.read).length;
  badge.textContent = unread;
  badge.style.display = unread ? 'flex' : 'none';
  const uc = id('notifUnreadCount');
  if (uc) uc.textContent = unread ? `(${unread})` : '';
}

function renderNotifList() {
  const list = id('notifList');
  if (!list) return;
  const items = (_notifTab === 'unread'
    ? State.notifications.map((n,i) => ({...n,_i:i})).filter(n => !n.read)
    : State.notifications.map((n,i) => ({...n,_i:i})));
  if (!items.length) {
    list.innerHTML = `<div class="notif-empty">${_notifTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}</div>`;
    return;
  }
  list.innerHTML = items.map(n =>
    `<div class="notif-item${n.read ? '' : ' notif-unread'}" onclick="markNotifRead(${n._i})">
      <span class="notif-icon">${n.icon || '🔔'}</span>
      <div class="notif-content">
        <div class="notif-text">${esc(n.text)}</div>
        ${n.dispatchNo ? `<div class="notif-dispatch">${esc(n.dispatchNo)}</div>` : ''}
        <div class="notif-time">${n.time}${!n.read ? ' <span class="notif-dot">●</span>' : ''}</div>
      </div>
    </div>`).join('');
}

// ── SSE CONNECTION ──────────────────────────────────────────────────
function connectSSE() {
  if (_sseSource) { _sseSource.close(); _sseSource = null; }
  const evtSrc = new EventSource(`/api/notifications/stream?token=${State.token}`);
  _sseSource = evtSrc;
  console.debug('SSE connection initiated');

  ['DISPATCH_CREATED','DISPATCH_REVISED','STOCK_DONE','STOCK_REVERT',
   'PACKAGING_DONE','PACKAGING_REVERT','INVOICE_DONE','INVOICE_REVERT',
   'READY_FOR_DISPATCH_DONE','READY_FOR_DISPATCH_REVERT',
   'COLLECTION_DONE','COLLECTION_REVERT','INVOICE_ISSUE','NOTE_ADDED'].forEach(eventType => {
    evtSrc.addEventListener(eventType, (e) => {
      try {
        const payload = JSON.parse(e.data);
        const updatedWo = payload.data;
        const messageText = payload.message || eventType;
        console.debug('SSE event received:', eventType, 'message:', messageText);
        
        if (updatedWo && updatedWo.id) {
          const idx = State.woList.findIndex(w => w.id === updatedWo.id);
          if (idx >= 0) State.woList[idx] = updatedWo; else State.woList.unshift(updatedWo);
          if (State.currentWo?.id === updatedWo.id) State.currentWo = updatedWo;
          if (State.page === 'dashboard') renderDashboard();
          if (State.page === 'detail') renderWoDetail(updatedWo);
        }
        addNotification(eventType, messageText, updatedWo?.woNumber);
        _sseRetryDelay = 2000;
      } catch (err) { console.warn('SSE parse error:', err); }
    });
  });

  evtSrc.addEventListener('heartbeat', () => { _sseRetryDelay = 2000; });
  evtSrc.addEventListener('ping', () => {});
  evtSrc.addEventListener('open', () => {
    console.debug('✅ Notification stream connected and active');
    _sseRetryDelay = 2000;
  });
  evtSrc.addEventListener('message', (e) => {
    try {
      const payload = JSON.parse(e.data);
      if (payload?.message) addNotification('UPDATE', payload.message, payload.data?.woNumber);
    } catch (err) {
      // ignore non-JSON heartbeat or unrelated message events
    }
  });
  evtSrc.onerror = (err) => {
    console.error('SSE connection error:', err);
    evtSrc.close(); _sseSource = null;
    setTimeout(() => { if (State.token) connectSSE(); }, _sseRetryDelay);
    _sseRetryDelay = Math.min(_sseRetryDelay * 2, 30000);
  };
}

// ── DESKTOP NOTIFICATIONS ───────────────────────────────────────────
function setupNotificationBanner() {
  const banner = id('notifPermBanner');
  if (!banner || !('Notification' in window)) return;
  
  // Show banner if permission is not determined (default state)
  if (Notification.permission !== 'default') {
    banner.style.display = 'none';
    if (Notification.permission === 'granted' && !localStorage.getItem('notifGrantedShown')) {
      localStorage.setItem('notifGrantedShown', '1');
    }
    return;
  }
  
  if (localStorage.getItem('notifDismissed') === '1') return;

  banner.style.display = 'flex';

  id('notifPermAllow').onclick = async () => {
    try {
      const perm = await Notification.requestPermission();
      banner.style.display = 'none';
      if (perm === 'granted') {
        localStorage.setItem('notifGrantedShown', '1');
        localStorage.removeItem('notifDismissed');
        showToast('✅ Desktop notifications enabled! You will receive real-time alerts.', 'success');
        try {
          new Notification('🔔 Ameya Dispatch Tracker', {
            body: 'Notifications enabled. You will get real-time alerts for all dispatch updates.',
            icon: '/static/ameya-logo.png'
          });
        } catch(e) {
          console.warn('Welcome notification failed:', e);
        }
      } else if (perm === 'denied') {
        showToast('⚠ Notifications blocked — enable in browser Settings → Site Settings.', 'error');
      }
    } catch(e) {
      console.error('Permission request failed:', e);
      showToast('⚠ Failed to request notification permission', 'error');
    }
  };

  id('notifPermDismiss').onclick = () => {
    banner.style.display = 'none';
    localStorage.setItem('notifDismissed', '1');
  };
}

function fireDesktopNotif(title, body) {
  if (!('Notification' in window)) {
    console.warn('Desktop Notifications not supported in this browser');
    return;
  }
  if (Notification.permission === 'granted') {
    try {
      const options = {
        body: body || 'Check the app for details',
        icon: '/static/ameya-logo.png',
        tag: 'invoice-tracker-notification',
        requireInteraction: false,
        badge: '/static/ameya-logo.png'
      };
      new Notification(title, options);
      console.debug('Desktop notification sent:', title);
    } catch(e) {
      console.warn('Desktop notification creation failed:', e.message);
    }
  } else if (Notification.permission === 'denied') {
    console.debug('Desktop notifications are blocked - user denied permission');
  } else {
    console.debug('Desktop notification permission not yet granted');
  }
}

function requestNotificationPermission() { /* handled by banner */ }

function startAutoSync() {
  requestNotificationPermission();
  if (State.syncTimer) clearInterval(State.syncTimer);
  State.syncTimer = setInterval(syncWorkOrders, 60000); // 60s fallback; SSE handles real-time
  syncWorkOrders();
}

async function syncWorkOrders() {
  if (!State.token) return;
  try {
    const res = await api('/api/workorders');
    const latest = Array.isArray(res.data) ? res.data : [];
    const changed = latest.length !== State.woList.length ||
      (latest.length > 0 && (
        latest[0]?.id !== State.woList[0]?.id ||
        latest[latest.length - 1]?.id !== State.woList[State.woList.length - 1]?.id
      ));
    if (changed) {
      State.woList = latest;
      if (State.page === 'dashboard') renderDashboard();
      if (State.page === 'all-wo') renderAllWoContent(applyAllWoFilters(latest));
    }
  } catch (err) {
    console.warn('Auto-sync failed', err);
  }
}

// Immediate sync after any action that might change data
function triggerImmediateSync() {
  if (State.syncTimer) {
    clearInterval(State.syncTimer);
    State.syncTimer = setInterval(syncWorkOrders, 30000);
  }
  syncWorkOrders();
}

// ── MODAL HELPERS ──────────────────────────────────────────────────
function showModal(title, bodyHtml, buttons) {
  id('modalTitle').textContent = title;
  id('modalBody').innerHTML = bodyHtml;
  id('modalFooter').innerHTML = buttons.map(b =>
    b.close
      ? `<button class="btn ${b.cls}" id="modalCancelBtn">${b.label}</button>`
      : `<button class="btn ${b.cls}" id="${b.id}">${b.label}</button>`
  ).join('');
  id('modal').style.display = 'flex';
  id('modalClose').onclick = closeModal;
  id('modalCancelBtn')?.addEventListener('click', closeModal);
}

function closeModal() {
  id('modal').style.display = 'none';
}

// ── FILE DROP ──────────────────────────────────────────────────────
function setupFileDrop(dropZoneId, fileInputId, fileNameId, accept) {
  const dropZone = id(dropZoneId);
  const fileInput = id(fileInputId);
  const fileNameEl = id(fileNameId);
  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.querySelector('.file-browse')?.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (f) { fileNameEl.textContent = '✓ ' + f.name; fileNameEl.style.display = 'block'; }
  });
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); dropZone.classList.remove('drag-over');
    const dt = new DataTransfer();
    dt.items.add(e.dataTransfer.files[0]);
    fileInput.files = dt.files;
    const f = fileInput.files[0];
    if (f) { fileNameEl.textContent = '✓ ' + f.name; fileNameEl.style.display = 'block'; }
  });
}

// ── API ────────────────────────────────────────────────────────────
async function api(url, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (State.token) opts.headers['Authorization'] = `Bearer ${State.token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (res.status === 401) {
    forceLogout();
    throw new Error('Session expired. Please log in again.');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
  return data;
}

async function apiFormData(url, formData, method = 'POST') {
  const opts = { method, body: formData };
  if (State.token) opts.headers = { 'Authorization': `Bearer ${State.token}` };
  const res = await fetch(url, opts);
  if (res.status === 401) {
    forceLogout();
    throw new Error('Session expired. Please log in again.');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
  return data;
}

// ── UTILS ──────────────────────────────────────────────────────────
function id(s) { return document.getElementById(s); }
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function showAlert(el, msg, type) {
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.style.display = 'block';
}
function showToast(msg, type='info') {
  const container = id('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity .4s'; setTimeout(() => t.remove(), 400); }, 3500);
}

// ── EXCEL VIEWER ────────────────────────────────────────────────────
let _excelWorkbook = null;

async function deleteInvoicePdf(fileId, fileName) {
  if (!confirm(`Delete invoice PDF "${fileName}"? This action cannot be undone.`)) return;
  try {
    const res = await api(`/api/files/${fileId}`, 'DELETE', null);
    showToast(res.message || 'Invoice PDF deleted successfully', 'success');
    const currentWoId = State.currentWo?.id;
    if (currentWoId) openWoDetail(currentWoId);
  } catch (ex) {
    showToast(ex.message || 'Failed to delete invoice PDF', 'error');
  }
}

async function viewExcel(fileId, fileName) {
  id('excelViewerModal').style.display = 'flex';
  id('excelViewerTitle').textContent = fileName;
  id('excelViewerLoading').style.display = 'block';
  id('excelViewerTable').style.display = 'none';
  id('excelSheetTabs').innerHTML = '';
  _excelWorkbook = null;

  try {
    const res = await fetch(`/api/files/download/${fileId}?token=${State.token}`);
    if (!res.ok) throw new Error('Failed to fetch file');
    const arrayBuffer = await res.arrayBuffer();
    _excelWorkbook = XLSX.read(arrayBuffer, { type: 'array', cellStyles: true });
    id('excelViewerLoading').style.display = 'none';
    renderExcelSheet(_excelWorkbook.SheetNames[0]);
    // Build sheet tabs
    const tabs = id('excelSheetTabs');
    _excelWorkbook.SheetNames.forEach((name, i) => {
      const btn = document.createElement('button');
      btn.className = 'excel-sheet-tab' + (i === 0 ? ' active' : '');
      btn.textContent = name;
      btn.onclick = () => {
        document.querySelectorAll('.excel-sheet-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderExcelSheet(name);
      };
      tabs.appendChild(btn);
    });
  } catch (e) {
    id('excelViewerLoading').textContent = '⚠ Could not load file: ' + e.message;
  }
}

function renderExcelSheet(sheetName) {
  const ws = _excelWorkbook.Sheets[sheetName];
  const container = id('excelViewerTable');
  container.style.display = 'block';

  if (!ws || !ws['!ref']) {
    container.innerHTML = '<div style="padding:20px;color:var(--text3)">Empty sheet</div>';
    return;
  }

  const range    = XLSX.utils.decode_range(ws['!ref']);
  const colProps = ws['!cols']   || [];
  const rowProps = ws['!rows']   || [];
  const merges   = ws['!merges'] || [];

  // Build merge map: "r,c" → {rowspan, colspan}; track covered cells to skip
  const mergeMap  = {};
  const skipCell  = new Set();
  merges.forEach(m => {
    mergeMap[`${m.s.r},${m.s.c}`] = {
      rowspan: m.e.r - m.s.r + 1,
      colspan: m.e.c - m.s.c + 1
    };
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r !== m.s.r || c !== m.s.c) skipCell.add(`${r},${c}`);
      }
    }
  });

  // Only include visible columns
  const visCols = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    if (!colProps[c]?.hidden) visCols.push(c);
  }

  // <colgroup> so column widths are respected
  const colgroup = visCols.map(c => {
    const px = colProps[c]?.wpx || Math.round((colProps[c]?.wch || 10) * 7);
    return `<col style="min-width:${Math.max(px, 40)}px">`;
  }).join('');

  // Build rows — skip hidden ones
  let rowsHtml = '';
  for (let r = range.s.r; r <= range.e.r; r++) {
    if (rowProps[r]?.hidden) continue;

    let cellsHtml = '';
    for (const c of visCols) {
      const key  = `${r},${c}`;
      if (skipCell.has(key)) continue;

      const addr  = XLSX.utils.encode_cell({ r, c });
      const cell  = ws[addr];
      const merge = mergeMap[key];
      const rs    = merge?.rowspan > 1 ? ` rowspan="${merge.rowspan}"` : '';
      const cs    = merge?.colspan > 1 ? ` colspan="${merge.colspan}"` : '';

      // cell.w = SheetJS formatted text (dates, numbers, currency all pre-formatted)
      // Fall back: try XLSX.SSF.format with the cell's format string, then raw value
      let val = '';
      if (cell) {
        if (cell.w !== undefined) {
          val = cell.w;
        } else if (cell.t === 'n' && cell.z) {
          try { val = XLSX.SSF.format(cell.z, cell.v); } catch (_) { val = String(cell.v); }
        } else if (cell.v !== undefined) {
          val = String(cell.v);
        }
      }

      const align = cell?.t === 'n' ? 'right' : cell?.t === 'b' ? 'center' : 'left';
      cellsHtml += `<td${rs}${cs} style="text-align:${align}">${esc(val)}</td>`;
    }
    rowsHtml += `<tr>${cellsHtml}</tr>`;
  }

  container.innerHTML = `
    <div class="excel-table-wrap">
      <table class="excel-sheet-table">
        <colgroup>${colgroup}</colgroup>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
}

function closeExcelViewer() {
  id('excelViewerModal').style.display = 'none';
  _excelWorkbook = null;
}
// Close on backdrop click
document.addEventListener('DOMContentLoaded', () => {
  id('excelViewerModal')?.addEventListener('click', e => {
    if (e.target === id('excelViewerModal')) closeExcelViewer();
  });
});

// ── USER MANAGEMENT ────────────────────────────────────────────────
const ALL_ROLES = ['ADMIN','GENERAL_MANAGER','STORE','INVOICE_CREATOR','GUEST'];

async function loadUserManagement() {
  const tbody = id('userTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3)">Loading…</td></tr>';
  try {
    const res = await api('/api/auth/users');
    const users = res.data || [];
    State.userCache = users;
    tbody.innerHTML = users.map(u => `
      <tr>
        <td><strong>${esc(u.fullName)}</strong></td>
        <td><code style="font-size:.8rem">${esc(u.username)}</code></td>
        <td><span class="badge badge-ip" style="font-size:.72rem">${roleLabel(u.role)}</span></td>
        <td>${u.active
          ? '<span class="badge badge-done">Active</span>'
          : '<span class="badge badge-pending">Disabled</span>'}</td>
        <td class="col-actions">
          <button class="btn btn-outline btn-xs" onclick="openEditUserModal(${u.id})">✏ Edit</button>
          <button class="btn btn-outline btn-xs" onclick="toggleUserActive(${u.id},'${esc(u.fullName)}')" style="color:${u.active?'var(--red)':'var(--green)'}">
            ${u.active ? '⊘ Disable' : '✓ Enable'}
          </button>
        </td>
      </tr>`).join('');
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--red)">Failed to load users: ${e.message}</td></tr>`;
  }
  id('addUserBtn').onclick = openAddUserModal;
}

function openAddUserModal() {
  id('modalTitle').textContent = '＋ Add User';
  id('modalBody').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="field-group">
        <label>Full Name <span class="req">*</span></label>
        <input type="text" id="muFullName" placeholder="e.g. Mauli Karande" autocomplete="off"/>
      </div>
      <div class="field-group">
        <label>Username <span class="req">*</span></label>
        <input type="text" id="muUsername" placeholder="e.g. mauli.karande" autocomplete="off"/>
      </div>
      <div class="field-group">
        <label>Password <span class="req">*</span></label>
        <input type="password" id="muPassword" placeholder="Min 6 characters" autocomplete="new-password"/>
      </div>
      <div class="field-group">
        <label>Role <span class="req">*</span></label>
        <select id="muRole">
          ${ALL_ROLES.map(r => `<option value="${r}">${roleLabel(r)}</option>`).join('')}
        </select>
      </div>
      <div id="muAlert" class="alert" style="display:none"></div>
    </div>`;
  id('modalFooter').innerHTML = `
    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="submitAddUser()">Create User</button>`;
  id('modal').style.display = 'flex';
}

async function submitAddUser() {
  const body = {
    fullName: id('muFullName').value.trim(),
    username: id('muUsername').value.trim(),
    password: id('muPassword').value,
    role: id('muRole').value,
  };
  const alertEl = id('muAlert');
  if (!body.fullName || !body.username || !body.password)
    return showAlert(alertEl, 'Please fill all required fields.', 'error');
  if (body.password.length < 6)
    return showAlert(alertEl, 'Password must be at least 6 characters.', 'error');
  try {
    await api('/api/auth/users', 'POST', body);
    closeModal();
    showToast('✅ User created successfully', 'success');
    loadUserManagement();
  } catch(e) { showAlert(alertEl, e.message, 'error'); }
}

async function openEditUserModal(userId) {
  id('modalTitle').textContent = '✏ Edit User';
  id('modal').style.display = 'flex';

  const u = State.userCache.find(x => x.id === userId);
  if (!u) {
    id('modalBody').innerHTML = `<div style="color:var(--red);padding:20px">User not found. Please close and reopen User Management.</div>`;
    id('modalFooter').innerHTML = `<button class="btn btn-outline" onclick="closeModal()">Close</button>`;
    return;
  }

  try {
    id('modalBody').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="field-group">
          <label>Full Name</label>
          <input type="text" id="muFullName" value="${esc(u.fullName)}" placeholder="Display name" autocomplete="off"/>
        </div>
        <div class="field-group">
          <label>Username</label>
          <input type="text" id="muUsername" value="${esc(u.username)}" placeholder="Login username" autocomplete="off"/>
        </div>
        <div class="field-group">
          <label>New Password <span style="color:var(--text3);font-size:.78rem;font-weight:400;text-transform:none;letter-spacing:0">(leave blank to keep current)</span></label>
          <input type="password" id="muPassword" placeholder="Leave blank to keep existing" autocomplete="new-password"/>
        </div>
        <div class="field-group">
          <label>Role</label>
          <select id="muRole">
            ${ALL_ROLES.map(r => `<option value="${r}"${r===u.role?' selected':''}>${roleLabel(r)}</option>`).join('')}
          </select>
        </div>
        <div id="muAlert" class="alert" style="display:none"></div>
      </div>`;
    id('modalFooter').innerHTML = `
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitEditUser(${userId})">Save Changes</button>`;
  } catch(e) {
    id('modalBody').innerHTML = `<div style="color:var(--red);padding:20px">${e.message}</div>`;
  }
}

async function submitEditUser(userId) {
  const alertEl = id('muAlert');
  const body = {};
  const fn = id('muFullName').value.trim();
  const un = id('muUsername').value.trim();
  const pw = id('muPassword').value;
  const rl = id('muRole').value;
  if (fn) body.fullName = fn;
  if (un) body.username = un;
  if (pw) {
    if (pw.length < 6) return showAlert(alertEl, 'Password must be at least 6 characters.', 'error');
    body.newPassword = pw;
  }
  if (rl) body.role = rl;
  try {
    await api(`/api/auth/users/${userId}`, 'PUT', body);
    closeModal();
    showToast('✅ User updated successfully', 'success');
    loadUserManagement();
  } catch(e) { showAlert(alertEl, e.message, 'error'); }
}

async function toggleUserActive(userId, name) {
  try {
    await api(`/api/auth/users/${userId}/toggle`, 'PATCH');
    showToast(`User ${name} status changed`, 'info');
    loadUserManagement();
  } catch(e) { showToast(e.message, 'error'); }
}

// ── PAGINATION ──────────────────────────────────────────────────────
const PER_PAGE = 25;

function paginateList(list, page) {
  const totalPages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const safePage = Math.min(Math.max(1, page || 1), totalPages);
  const start = (safePage - 1) * PER_PAGE;
  return { items: list.slice(start, start + PER_PAGE), safePage, totalPages, total: list.length };
}

function renderPagination(containerId, currentPage, totalPages, total, callbackName) {
  const el = id(containerId);
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  const start = (currentPage - 1) * PER_PAGE + 1;
  const end = Math.min(currentPage * PER_PAGE, total);
  let html = `<span class="pagination-info">${start}–${end} of ${total}</span>`;
  html += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="${callbackName}(${currentPage - 1})">&#8249;</button>`;
  let from = Math.max(1, currentPage - 2);
  let to = Math.min(totalPages, from + 4);
  from = Math.max(1, to - 4);
  if (from > 1) {
    html += `<button class="page-btn" onclick="${callbackName}(1)">1</button>`;
    if (from > 2) html += `<span class="pagination-info">…</span>`;
  }
  for (let p = from; p <= to; p++) {
    html += `<button class="page-btn${p === currentPage ? ' active' : ''}" onclick="${callbackName}(${p})">${p}</button>`;
  }
  if (to < totalPages) {
    if (to < totalPages - 1) html += `<span class="pagination-info">…</span>`;
    html += `<button class="page-btn" onclick="${callbackName}(${totalPages})">${totalPages}</button>`;
  }
  html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="${callbackName}(${currentPage + 1})">&#8250;</button>`;
  el.innerHTML = html;
}

window.setDashPage = function(n) {
  State.dashPage = n;
  renderWoTable(State.dashDisplayList || []);
};

window.setAllWoPage = function(n) {
  State.allWoPage = n;
  renderAllWoContent(State.allWoDisplayList || State.woList);
};

// ── ALL WO FILTERS ──────────────────────────────────────────────────
function applyAllWoFilters(list) {
  const q = (State.allWoFilters.q || '').toLowerCase();
  const status = State.allWoFilters.status || '';
  let filtered = list;
  if (q) filtered = filtered.filter(w =>
    String(w.customerName || '').toLowerCase().includes(q) ||
    String(w.woNumber || '').toLowerCase().includes(q) ||
    String(w.invoiceNumber || '').toLowerCase().includes(q)
  );
  if (status) filtered = filtered.filter(w => w.status === status);
  return filtered;
}

function filterAllWoContent() {
  State.allWoFilters.q = (id('allWoFilterQ')?.value || '').trim().toLowerCase();
  State.allWoFilters.status = id('allWoFilterStatus')?.value || '';
  State.allWoPage = 1;
  renderAllWoContent(applyAllWoFilters(State.woList));
}

function exportAllWoCsv() {
  const list = State.allWoDisplayList?.length ? State.allWoDisplayList : State.woList;
  if (!list.length) { showToast('No data to export', 'info'); return; }
  const headers = ['Dispatch No.','Customer','WO Date','Shipment','Invoice Type',
    'Stock','Packing','Invoice No.','Invoice Date','Ready','Collection','Status','Version'];
  const rows = list.map(w => [
    w.woNumber, w.customerName, w.woDate || '', w.shipmentMode || '',
    w.invoiceType || 'Commercial', w.stockStatus || '', w.packagingStatus || '',
    w.invoiceNumber || '', w.invoiceDate || '',
    w.readyForDispatchStatus || '', w.collectionStatus || '',
    w.status, w.version
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dispatch-list-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Exported ${list.length} records to CSV`, 'success');
}
