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
  rfdPendingList: [],
  rfdPendingPage: 1,
  rfdDoneList: [],
  rfdDonePage: 1,
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

  window.addEventListener('popstate', () => {
    if (!State.token) return;
    history.pushState({ appPage: State.page }, '');
    const target = State.prevPage || 'dashboard';
    if (target === 'detail') {
      const woId = localStorage.getItem('lastWoId');
      if (woId) openWoDetail(parseInt(woId, 10));
      else navigateTo('dashboard');
    } else {
      navigateTo(target);
    }
  });

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
  while (true) {
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
      updateConnectingMessage(`Server restarting — reconnecting… (attempt ${attempts})`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
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
  const allowedPages = ['dashboard','create-wo','all-wo','rfd','detail','user-mgmt'];
  let targetPage = savedPage && allowedPages.includes(savedPage) ? savedPage : null;

  if (State.user?.role === 'ADMIN') {
    targetPage = 'user-mgmt';
  } else if (State.user?.role === 'SALES_EXECUTIVE') {
    // Sales Exec only sees the RFD page
    if (targetPage !== 'rfd') targetPage = 'rfd';
  } else {
    if (targetPage === 'user-mgmt' || targetPage === 'rfd') targetPage = 'dashboard';
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
  showModal('Sign Out', `
    <div style="text-align:center;padding:8px 0 4px">
      <div style="font-size:2rem;margin-bottom:12px">👋</div>
      <p style="margin:0;font-size:.95rem;color:var(--text)">Are you sure you want to sign out?</p>
    </div>`,
    [
      { label: 'Sign Out', cls: 'btn-danger', id: 'confirmLogoutBtn' },
      { label: 'Cancel',   cls: 'btn-outline', close: true }
    ]
  );
  id('confirmLogoutBtn')?.addEventListener('click', () => {
    closeModal();
    forceLogout();
  });
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

  const isGM          = u.role === 'GENERAL_MANAGER';
  const isAdmin       = u.role === 'ADMIN';
  const isInvoiceCreator = u.role === 'INVOICE_CREATOR';
  const isSalesExec   = u.role === 'SALES_EXECUTIVE';

  // Show/hide nav items by role
  document.querySelectorAll('.nav-only-gm').forEach(el => el.style.display = isGM ? '' : 'none');
  document.querySelectorAll('.nav-only-admin').forEach(el => el.style.display = isAdmin ? '' : 'none');
  document.querySelectorAll('.nav-only-invoice-creator').forEach(el => el.style.display = isInvoiceCreator ? '' : 'none');
  document.querySelectorAll('.nav-only-sales-exec').forEach(el => el.style.display = isSalesExec ? '' : 'none');
  document.querySelectorAll('.nav-hide-sales-exec').forEach(el => el.style.display = isSalesExec ? 'none' : '');

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
  const map = { ADMIN:'Admin', GENERAL_MANAGER:'General Manager', STORE:'Store', INVOICE_CREATOR:'Invoice Creator', SALES_EXECUTIVE:'Sales Executive', GUEST:'Guest' };
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
  removeTallyFloatBtn();
  if (State.page !== page) {
    State.prevPage = State.page;
    history.pushState({ appPage: page }, '');
  }
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
    'rfd':        { pageId:'pageRfd',        title:'Ready for Dispatch' },
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
  if (page === 'rfd') loadRFDPage();
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
  // For date-only strings (no T), append time to prevent timezone shift
  const s = String(val).includes('T') ? String(val) : String(val) + 'T00:00:00';
  const d = new Date(s);
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
  if (!wo?.createdAt) return false;
  const date = new Date(wo.createdAt);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function getDashboardStatsList() {
  if (isDashboardFilterActive()) {
    return applyFilters(State.woList, true);
  }
  if (State.dashboardView === 'ALL' || State.dashboardView === 'READY_INVOICE' || State.dashboardView === 'READY_DISPATCH') {
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

  const viewBtnIds = ['dashInProgressBtn', 'dashCompletedBtn', 'dashAllBtn', 'dashReadyInvoiceBtn', 'dashReadyDispatchBtn', 'dashTodaysCollectionBtn'];
  viewBtnIds.forEach(btnId => {
    const btn = id(btnId);
    if (!btn) return;
    btn.onclick = () => {
      if (btnId === 'dashReadyInvoiceBtn') {
        State.dashboardView = 'READY_INVOICE';
      } else if (btnId === 'dashReadyDispatchBtn') {
        State.dashboardView = 'READY_DISPATCH';
      } else if (btnId === 'dashCompletedBtn') {
        State.dashboardView = 'COMPLETED';
      } else if (btnId === 'dashAllBtn') {
        State.dashboardView = 'ALL';
      } else if (btnId === 'dashTodaysCollectionBtn') {
        State.dashboardView = 'TODAYS_COLLECTION';
      } else {
        State.dashboardView = 'IN_PROGRESS';
      }
      viewBtnIds.forEach(b => id(b)?.classList.remove('active'));
      btn.classList.add('active');
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
  if (State.dashboardView === 'READY_DISPATCH') return list.filter(w =>
    w.readyForDispatchStatus === 'DONE'
  );
  if (State.dashboardView === 'TODAYS_COLLECTION') {
    const today = new Date().toISOString().substring(0, 10);
    return list.filter(w =>
      w.collectionStatus === 'DONE' &&
      w.collectionUpdatedAt &&
      w.collectionUpdatedAt.substring(0, 10) === today
    );
  }
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
  if (m)   list = list.filter(w => w.createdAt && new Date(w.createdAt).getMonth()+1 === parseInt(m, 10));
  if (y)   list = list.filter(w => w.createdAt && new Date(w.createdAt).getFullYear() === parseInt(y, 10));
  if (df)  list = list.filter(w => w.createdAt && w.createdAt.substring(0, 10) >= df);
  if (dt)  list = list.filter(w => w.createdAt && w.createdAt.substring(0, 10) <= dt);
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
    <td>${stepBadge(w.invoiceStatus)}${w.invoiceNumber?`<br><span style="font-size:.7rem;color:var(--text3)"><strong>${esc(w.invoiceNumber)}</strong></span>`:''}</td>
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

// ── READY FOR DISPATCH PAGE (Sales Executive) ───────────────────────
let _rfdTabsBound = false;

function loadRFDPage() {
  if (!_rfdTabsBound) {
    _rfdTabsBound = true;

    document.querySelectorAll('.rfd-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.rfd-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const which = tab.dataset.tab;
        id('rfdTabPending').style.display = which === 'pending' ? '' : 'none';
        id('rfdTabDone').style.display    = which === 'done'    ? '' : 'none';
        if (which === 'done') loadRFDDoneTab();
      });
    });

    // DL number click — delegated on scroll area, works for both tabs
    id('rfdScrollArea').addEventListener('click', (e) => {
      const link = e.target.closest('.rfd-dl-link');
      if (!link) return;
      e.preventDefault();
      openWoDetail(parseInt(link.dataset.woId));
    });
  }
  loadRFDPendingTab();
}

async function loadRFDPendingTab() {
  id('rfdLoading').style.display = 'block';
  id('rfdEmpty').style.display = 'none';
  id('rfdList').innerHTML = '';
  id('rfdPagination').innerHTML = '';
  try {
    const res = await api('/api/sales-exec/rfd');
    State.rfdPendingList = res.data || [];
    State.rfdPendingPage = 1;
    id('rfdLoading').style.display = 'none';
    renderRFDPendingPage();
  } catch(e) {
    id('rfdLoading').style.display = 'none';
    showToast('Failed to load list: ' + e.message, 'error');
  }
}

function renderRFDPendingPage() {
  const list = State.rfdPendingList || [];
  if (!list.length) { id('rfdEmpty').style.display = 'block'; id('rfdPagination').innerHTML = ''; return; }
  id('rfdEmpty').style.display = 'none';

  const { items, safePage, totalPages, total } = paginateList(list, State.rfdPendingPage);
  State.rfdPendingPage = safePage;

  id('rfdList').innerHTML = items.map(wo => `
    <div class="rfd-card" id="rfd-card-${wo.id}">
      <div class="rfd-card-info">
        <div class="rfd-dl-number"><a href="#" class="rfd-dl-link" data-wo-id="${wo.id}">${esc(wo.woNumber)}</a></div>
        <div class="rfd-customer">${esc(wo.customerName)}</div>
        <div class="rfd-meta">
          ${wo.invoiceNumber ? `Invoice: <strong>${esc(wo.invoiceNumber)}</strong> &nbsp;·&nbsp;` : ''}
          ${esc(wo.shipmentMode || '—')} &nbsp;·&nbsp; ${formatDate(wo.woDate)}
        </div>
      </div>
      <div class="rfd-actions">
        ${wo.latestPdfFileId ? `<a href="/api/files/view/${wo.latestPdfFileId}?token=${State.token}" target="_blank" class="btn btn-outline rfd-view-btn">View Invoice</a>` : ''}
        <button class="btn btn-success rfd-dispatch-btn" data-id="${wo.id}">Documentation Done</button>
      </div>
    </div>
  `).join('');

  renderPagination('rfdPagination', safePage, totalPages, total, 'setRfdPendingPage');

  id('rfdList').querySelectorAll('.rfd-dispatch-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const woId = btn.dataset.id;
      btn.disabled = true; btn.textContent = 'Saving…';
      try {
        await api(`/api/sales-exec/${woId}/mark-done`, 'POST');
        // Remove from in-memory list and re-render
        State.rfdPendingList = (State.rfdPendingList || []).filter(w => String(w.id) !== String(woId));
        renderRFDPendingPage();
        showToast('Documentation marked as done!', 'success');
      } catch(e) {
        showToast(e.message, 'error');
        btn.disabled = false; btn.textContent = 'Documentation Done';
      }
    });
  });
}

async function loadRFDDoneTab() {
  id('rfdDoneLoading').style.display = 'block';
  id('rfdDoneEmpty').style.display = 'none';
  id('rfdDoneList').innerHTML = '';
  id('rfdDonePagination').innerHTML = '';
  try {
    const res = await api('/api/sales-exec/doc-done');
    State.rfdDoneList = res.data || [];
    State.rfdDonePage = 1;
    id('rfdDoneLoading').style.display = 'none';
    renderRFDDonePage();
  } catch(e) {
    id('rfdDoneLoading').style.display = 'none';
    showToast('Failed to load done list: ' + e.message, 'error');
  }
}

function renderRFDDonePage() {
  const list = State.rfdDoneList || [];
  if (!list.length) { id('rfdDoneEmpty').style.display = 'block'; id('rfdDonePagination').innerHTML = ''; return; }
  id('rfdDoneEmpty').style.display = 'none';

  const { items, safePage, totalPages, total } = paginateList(list, State.rfdDonePage);
  State.rfdDonePage = safePage;

  id('rfdDoneList').innerHTML = items.map(item => {
    const wo = item.workOrder;
    return `
      <div class="rfd-card rfd-card-done">
        <div class="rfd-card-info">
          <div class="rfd-dl-number"><a href="#" class="rfd-dl-link" data-wo-id="${wo.id}">${esc(wo.woNumber)}</a></div>
          <div class="rfd-customer">${esc(wo.customerName)}</div>
          <div class="rfd-meta">
            ${wo.invoiceNumber ? `Invoice: <strong>${esc(wo.invoiceNumber)}</strong> &nbsp;·&nbsp;` : ''}
            ${esc(wo.shipmentMode || '—')} &nbsp;·&nbsp; ${formatDate(wo.woDate)}
          </div>
        </div>
        <div class="rfd-done-badge">
          ${wo.latestPdfFileId ? `<a href="/api/files/view/${wo.latestPdfFileId}?token=${State.token}" target="_blank" class="btn btn-outline rfd-view-btn">View Invoice</a>` : ''}
          <span class="badge badge-done">Doc Done</span>
          <div class="rfd-done-meta">by ${esc(item.markedBy)}<br>${formatDate(item.markedAt)}</div>
        </div>
      </div>
    `;
  }).join('');

  renderPagination('rfdDonePagination', safePage, totalPages, total, 'setRfdDonePage');
}

window.setRfdPendingPage = function(n) {
  State.rfdPendingPage = n;
  renderRFDPendingPage();
  const area = id('rfdScrollArea');
  if (area) area.scrollTo({ top: 0, behavior: 'smooth' });
};

window.setRfdDonePage = function(n) {
  State.rfdDonePage = n;
  renderRFDDonePage();
  const area = id('rfdScrollArea');
  if (area) area.scrollTo({ top: 0, behavior: 'smooth' });
};

// ── CREATE FORM ─────────────────────────────────────────────────────
let _createFormBound = false;
function initCreateForm() {
  resetCreateForm();
  if (!_createFormBound) {
    _createFormBound = true;
    setupFileDrop('excelDropZone', 'woExcelFile', 'excelFileName', ['.xlsx','.xls']);
    id('createWoBtn')?.addEventListener('click', submitCreateWo);
  }
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
  setupLookupDropdown('shipmentSearch', 'shipmentList', 'selectedShipment', 'shipmentDropdown',
    () => State.shipmentModes, '', 'Create New Shipment Mode', 'shipment-mode');
  setupLookupDropdown('invoiceTypeSearch', 'invoiceTypeList', 'selectedInvoiceType', 'invoiceTypeDropdown',
    () => State.invoiceTypes, 'Commercial', 'Create New Invoice Type', 'invoice-type');

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

// Generic searchable dropdown for lookup lists (shipment mode, invoice type).
// getItems is a function () => array so it always reads the current State (avoids
// stale-closure bug when loadLookupData() replaces the array after setup).
function setupLookupDropdown(searchId, listId, hiddenId, dropdownId, getItems, defaultValue, createNewLabel, createNewType) {
  const searchInput = id(searchId);
  const listEl      = id(listId);
  const hidden      = id(hiddenId);
  if (!searchInput || !listEl || !hidden) return;

  hidden.value = defaultValue || '';
  searchInput.value = defaultValue || '';

  function renderList(filtered) {
    listEl.innerHTML = '';
    if (!filtered.length) {
      listEl.innerHTML = '<div class="dropdown-item no-results">No results found</div>';
    } else {
      filtered.forEach(item => {
        const div = document.createElement('div');
        div.className = 'dropdown-item';
        div.textContent = item.name;
        div.addEventListener('click', () => {
          searchInput.value = item.name;
          hidden.value = item.name;
          listEl.style.display = 'none';
        });
        listEl.appendChild(div);
      });
    }
    const createDiv = document.createElement('div');
    createDiv.className = 'dropdown-item create-new';
    createDiv.textContent = '+ ' + createNewLabel;
    createDiv.addEventListener('click', () => {
      listEl.style.display = 'none';
      showCreateLookupModal(createNewType, searchId, hiddenId);
    });
    listEl.appendChild(createDiv);
    listEl.style.display = 'block';
  }

  searchInput.addEventListener('focus', () => renderList(getItems()));
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase();
    renderList(getItems().filter(i => i.name.toLowerCase().includes(q)));
    hidden.value = searchInput.value;
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#' + dropdownId)) listEl.style.display = 'none';
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
  const shipmentMode = id('selectedShipment').value || id('shipmentSearch').value.trim();
  const invoiceType  = id('selectedInvoiceType').value || id('invoiceTypeSearch').value.trim() || 'Commercial';
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
    const amountTotal = await _calcExcelInvoiceTotal(excelFile);
    const formData = new FormData();
    formData.append('data', new Blob([JSON.stringify({ customerName, shipmentMode, invoiceType, woDate })], { type:'application/json' }));
    formData.append('excelFile', excelFile);
    if (amountTotal != null) formData.append('amountTotal', amountTotal);
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
        <div class="detail-section-header">Dispatch Info
          ${role === 'GENERAL_MANAGER' ? `<button class="btn btn-outline btn-xs" id="editDetailsBtn">✏ Edit</button>` : ''}
        </div>
        <div class="detail-section-body">
          <div class="detail-row"><span class="detail-label">Dispatch No.</span><span class="detail-value" style="font-family:monospace">${esc(wo.woNumber)}</span></div>
          <div class="detail-row"><span class="detail-label">Customer</span><span class="detail-value">${esc(wo.customerName)}</span></div>
          <div class="detail-row"><span class="detail-label">Shipment Mode</span><span class="detail-value">${esc(wo.shipmentMode||'—')}</span></div>
          <div class="detail-row"><span class="detail-label">Invoice Type</span><span class="detail-value"><span class="badge badge-ip">${esc(wo.invoiceType||'Commercial')}</span></span></div>
          <div class="detail-row"><span class="detail-label">Dispatch Date</span><span class="detail-value">${formatDate(wo.woDate)}</span></div>
          <div class="detail-row"><span class="detail-label">Created By</span><span class="detail-value">${esc(wo.createdBy||'—')}</span></div>
          <div class="detail-row"><span class="detail-label">Version</span><span class="detail-value">v${wo.version}</span></div>
          ${wo.revised && wo.revisionReason ? `<div class="detail-row"><span class="detail-label">Revision Reason</span><span class="detail-value" style="color:var(--amber);white-space:pre-wrap">${esc(wo.revisionReason)}</span></div>` : ''}
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
          ${renderFileSection('Excel Files', wo.excelFiles, `${wo.customerName} ${wo.woNumber}`)}
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

    <!-- Logs Button -->
    <div style="margin-top:20px;text-align:center">
      <button class="btn btn-outline" id="viewLogsBtn">📋 View Logs</button>
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
    <div><div class="step-label">Stock</div><div class="step-sub">${isDone && wo.stockUpdatedBy ? 'By '+wo.stockUpdatedBy+(wo.stockUpdatedAt?' · '+formatDate(wo.stockUpdatedAt):'') : ''}</div></div>
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
      <div class="step-sub">${isDone && wo.packagingUpdatedBy ? 'By '+wo.packagingUpdatedBy+(wo.packagingUpdatedAt?' · '+formatDate(wo.packagingUpdatedAt):'') : ''}</div>
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
      <div class="step-sub">${isDone && wo.packingDetailsUpdatedBy ? 'By '+wo.packingDetailsUpdatedBy+(wo.packingDetailsUpdatedAt?' · '+formatDate(wo.packingDetailsUpdatedAt):'') : !invoiceDone ? 'Waiting for Invoice' : 'Upload packing details file'}</div>
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
  const canCreateInvoice = canToggle && (wo.latestExcelFileId || (wo.excelFiles && wo.excelFiles.length > 0));
  return `<div class="step-row">
    <div>
      <div class="step-label">Invoice ${wo.invoiceNumber ? `<small style="color:var(--text3)">(<strong>${wo.invoiceNumber}</strong>${wo.invoiceDate ? ' · ' + formatDate(wo.invoiceDate) : ''})</small>` : ''}</div>
      <div class="step-sub">${isDone && wo.invoiceUpdatedBy ? 'By '+wo.invoiceUpdatedBy : ''}</div>
    </div>
    <div class="step-actions">
      ${stepBadge(wo.invoiceStatus)}
      ${canToggle && !isDone ? `<button class="btn btn-success btn-xs" id="invoiceDoneBtn">Mark Done</button>` : ''}
      ${canRevert ? `<button class="btn btn-amber btn-xs" id="invoiceRevertBtn">Revert</button>` : ''}
      ${isDone && canToggle ? `<button class="btn btn-outline btn-xs" id="invoiceEditBtn">Edit</button>` : ''}
      ${canCreateInvoice ? `<button class="btn btn-outline btn-xs" style="background:var(--navy,#1e3a6e);color:#fff;border-color:var(--navy)" id="createTallyInvoiceBtn">🧾 Create Invoice</button>` : ''}
    </div>
  </div>`;
}

function renderRFDStep(wo, role) {
  const isDone = (wo.readyForDispatchStatus||'PENDING') === 'DONE';
  const canToggle = role === 'STORE';
  const nextDone = (wo.collectionStatus||'PENDING') === 'DONE';
  const canRevert = canToggle && isDone && !nextDone;
  return `<div class="step-row">
    <div><div class="step-label">Ready For Dispatch</div><div class="step-sub">${isDone && wo.readyForDispatchUpdatedBy ? 'By '+wo.readyForDispatchUpdatedBy+(wo.readyForDispatchUpdatedAt?' · '+formatDate(wo.readyForDispatchUpdatedAt):'') : ''}</div></div>
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
    <div><div class="step-label">Collection</div><div class="step-sub">${isDone && wo.collectionUpdatedBy ? 'By '+wo.collectionUpdatedBy+(wo.collectionUpdatedAt?' · '+formatDate(wo.collectionUpdatedAt):'') : ''}</div></div>
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

function renderFileSection(title, files, downloadPrefix = null) {
  if (!files || !files.length) return `<div style="margin-bottom:12px"><strong style="font-size:.78rem;color:var(--text2)">${title}</strong><div style="color:var(--text3);font-size:.78rem;margin-top:4px">None</div></div>`;
  return `<div style="margin-bottom:12px">
    <strong style="font-size:.78rem;color:var(--text2)">${title}</strong>
    <div class="file-list" style="margin-top:6px">
      ${files.map(f => {
        const name = f.originalFileName || '';
        const isExcel = /\.(xlsx?|csv)$/i.test(name);
        const isPdf = /\.pdf$/i.test(name);
        const isInvoicePdf = title === 'Invoice PDFs' && isPdf;
        const invoiceViewBtn = (isExcel && title === 'Excel Files')
          ? `<button class="btn btn-outline btn-xs" data-fid="${f.id}" data-fname="${esc(name)}" onclick="viewExcelInvoice(+this.dataset.fid, this.dataset.fname)">📄 Invoice View</button>`
          : '';
        const viewBtn = isPdf
          ? `<a href="${f.downloadUrl.replace('/download/','/view/')}?token=${State.token}" target="_blank" class="btn btn-outline btn-xs">👁 View</a>`
          : isExcel
          ? `<button class="btn btn-outline btn-xs" onclick="viewExcel(${f.id},'${esc(name)}')">👁 View</button>`
          : '';
        const deleteBtn = (isInvoicePdf && State.user?.role === 'INVOICE_CREATOR')
          ? `<button class="btn btn-danger btn-xs" onclick="deleteInvoicePdf(${f.id},'${esc(name)}')">🗑 Delete</button>`
          : '';
        // For Excel files use blob download with customer-named filename; others use direct link
        const ext = name.match(/\.(xlsx?|csv)$/i)?.[0] || '.xlsx';
        const dlBtn = (isExcel && downloadPrefix)
          ? `<button class="btn btn-outline btn-xs" data-fid="${f.id}" data-fname="${esc(downloadPrefix + ext)}" onclick="downloadFileAs(+this.dataset.fid, this.dataset.fname)">↓ Download</button>`
          : `<a href="${f.downloadUrl}?token=${State.token}" class="btn btn-outline btn-xs">↓ Download</a>`;
        const totalLabel = isExcel
          ? ` &nbsp;·&nbsp; <span id="excel-amt-${f.id}" style="color:var(--green,#38a169);font-weight:600">${f.amountVerified === true ? Number(f.amountTotal).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : ''}</span>`
          : '';
        return `<div class="file-item">
          <div><div class="file-name">${esc(name)}</div><div class="file-meta">v${f.version} · ${f.uploadedBy||''}${totalLabel}</div></div>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            ${viewBtn}
            ${invoiceViewBtn}
            ${dlBtn}
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

function showLogsModal(wo) {
  const logs = wo.activityLogs || [];
  const rows = logs.length
    ? logs.map(l => `
        <div style="padding:10px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:.85rem;color:var(--text1)">${esc(l.action)}</div>
          <div style="font-size:.75rem;color:var(--text3);margin-top:3px">${esc(l.formattedTimestamp)}</div>
        </div>`).join('')
    : '<div style="color:var(--text3);font-size:.83rem;padding:12px 0">No activity yet</div>';

  showModal(`Logs — ${wo.woNumber}`, `
    <div style="max-height:420px;overflow-y:auto;padding-right:4px">${rows}</div>
  `, [{ label: 'Close', cls: 'btn-outline', close: true }]);
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
  id('createTallyInvoiceBtn')?.addEventListener('click', () => openTallyModal(wo));
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

  // Dispatch Info edit
  id('editDetailsBtn')?.addEventListener('click', () => showEditDetailsModal(wo));

  // Logs
  id('viewLogsBtn')?.addEventListener('click', () => showLogsModal(wo));

  // Notes & Issues
  id('editNoteBtn')?.addEventListener('click', () => showNoteModal(wo));
  id('reportIssueBtn')?.addEventListener('click', () => showIssueModal(wo));

  // Files
  id('reviseExcelBtn')?.addEventListener('click', () => showRevisionModal(wo));
  id('uploadPdfBtn')?.addEventListener('click', () => showUploadPdfModal(wo));

  // Floating Create Invoice button for INVOICE_CREATOR
  removeTallyFloatBtn();
  if (State.user?.role === 'INVOICE_CREATOR' && wo.excelFiles && wo.excelFiles.length > 0) {
    injectTallyFloatBtn(wo);
  }
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
      <strong>Invoice:</strong> <strong>${wo.invoiceNumber || '—'}</strong>
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

// ── EDIT DETAILS MODAL ─────────────────────────────────────────────
function showEditDetailsModal(wo) {
  const custList = State.customers.map(c => `<option value="${esc(c.name)}"></option>`).join('');
  const modeOpts = () => State.shipmentModes.map(m =>
    `<option value="${esc(m.name)}"${m.name === id('editShipmentSel')?.value ? ' selected' : ''}>${esc(m.name)}</option>`
  ).join('');
  const typeOpts = () => State.invoiceTypes.map(t =>
    `<option value="${esc(t.name)}"${t.name === id('editInvoiceTypeSel')?.value ? ' selected' : ''}>${esc(t.name)}</option>`
  ).join('');
  const inlineRow = (inputId, addId, cancelId) =>
    `<div class="edit-inline-add" style="display:none;margin-top:6px;display:none">
       <input type="text" id="${inputId}" placeholder="Type name and click Add…" style="flex:1;min-width:0"/>
       <button class="btn btn-success btn-xs" id="${addId}">Add</button>
       <button class="btn btn-outline btn-xs" id="${cancelId}">Cancel</button>
     </div>`;

  showModal('Edit Dispatch Details', `
    <div class="field-group" style="margin-bottom:12px">
      <label>Customer</label>
      <input type="text" id="editCustomerInput" value="${esc(wo.customerName)}" list="editCustDatalist" autocomplete="off" placeholder="Customer name"/>
      <datalist id="editCustDatalist">${custList}</datalist>
      <button class="btn-add-option" id="editCreateCustBtn">+ Create New Customer</button>
      ${inlineRow('editNewCustName','editAddCustBtn','editCancelCustBtn')}
    </div>
    <div class="field-group" style="margin-bottom:12px">
      <label>Shipment Mode</label>
      <select id="editShipmentSel">${State.shipmentModes.map(m => `<option value="${esc(m.name)}"${m.name === wo.shipmentMode ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
      <button class="btn-add-option" id="editCreateModeBtn">+ Create New Shipment Mode</button>
      ${inlineRow('editNewModeName','editAddModeBtn','editCancelModeBtn')}
    </div>
    <div class="field-group" style="margin-bottom:12px">
      <label>Invoice Type</label>
      <select id="editInvoiceTypeSel">${State.invoiceTypes.map(t => `<option value="${esc(t.name)}"${t.name === (wo.invoiceType || 'Commercial') ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
      <button class="btn-add-option" id="editCreateTypeBtn">+ Create New Invoice Type</button>
      ${inlineRow('editNewTypeName','editAddTypeBtn','editCancelTypeBtn')}
    </div>
    <div class="field-group" style="margin-bottom:12px">
      <label>Dispatch Date</label>
      <input type="date" id="editWoDate" value="${wo.woDate || ''}"/>
    </div>
    <div id="editDetailsAlert" class="alert" style="display:none;margin-top:10px"></div>
  `, [
    { label: 'Save Changes', cls: 'btn-primary', id: 'saveEditDetailsBtn' },
    { label: 'Cancel', cls: 'btn-outline', close: true }
  ]);

  // ── inline add helpers ──
  function toggleInline(btnId, rowInputId) {
    const row = id(btnId)?.nextElementSibling;
    if (!row) return;
    const visible = row.style.display !== 'none';
    row.style.display = visible ? 'none' : 'flex';
    if (!visible) id(rowInputId)?.focus();
  }
  function hideInline(btnId) {
    const row = id(btnId)?.nextElementSibling;
    if (row) row.style.display = 'none';
  }

  // Customer inline
  id('editCreateCustBtn')?.addEventListener('click', () => toggleInline('editCreateCustBtn', 'editNewCustName'));
  id('editCancelCustBtn')?.addEventListener('click', () => hideInline('editCreateCustBtn'));
  id('editAddCustBtn')?.addEventListener('click', async () => {
    const name = id('editNewCustName').value.trim();
    if (!name) return;
    const btn = id('editAddCustBtn'); btn.disabled = true;
    try {
      const res = await api('/api/lookup/customers', 'POST', { name });
      if (!State.customers.find(c => c.id === res.data.id)) State.customers.push(res.data);
      const datalist = id('editCustDatalist');
      if (datalist) datalist.innerHTML += `<option value="${esc(res.data.name)}"></option>`;
      id('editCustomerInput').value = res.data.name;
      hideInline('editCreateCustBtn');
      id('editNewCustName').value = '';
      showToast('Customer created: ' + res.data.name, 'success');
    } catch(e) { showAlert(id('editDetailsAlert'), e.message, 'error'); }
    finally { btn.disabled = false; }
  });

  // Shipment Mode inline
  id('editCreateModeBtn')?.addEventListener('click', () => toggleInline('editCreateModeBtn', 'editNewModeName'));
  id('editCancelModeBtn')?.addEventListener('click', () => hideInline('editCreateModeBtn'));
  id('editAddModeBtn')?.addEventListener('click', async () => {
    const name = id('editNewModeName').value.trim();
    if (!name) return;
    const btn = id('editAddModeBtn'); btn.disabled = true;
    try {
      const res = await api('/api/lookup/shipment-modes', 'POST', { name });
      if (!State.shipmentModes.find(m => m.id === res.data.id)) State.shipmentModes.push(res.data);
      const sel = id('editShipmentSel');
      sel.innerHTML += `<option value="${esc(res.data.name)}">${esc(res.data.name)}</option>`;
      sel.value = res.data.name;
      hideInline('editCreateModeBtn');
      id('editNewModeName').value = '';
      showToast('Shipment mode created: ' + res.data.name, 'success');
    } catch(e) { showAlert(id('editDetailsAlert'), e.message, 'error'); }
    finally { btn.disabled = false; }
  });

  // Invoice Type inline
  id('editCreateTypeBtn')?.addEventListener('click', () => toggleInline('editCreateTypeBtn', 'editNewTypeName'));
  id('editCancelTypeBtn')?.addEventListener('click', () => hideInline('editCreateTypeBtn'));
  id('editAddTypeBtn')?.addEventListener('click', async () => {
    const name = id('editNewTypeName').value.trim();
    if (!name) return;
    const btn = id('editAddTypeBtn'); btn.disabled = true;
    try {
      const res = await api('/api/lookup/invoice-types', 'POST', { name });
      if (!State.invoiceTypes.find(t => t.id === res.data.id)) State.invoiceTypes.push(res.data);
      const sel = id('editInvoiceTypeSel');
      sel.innerHTML += `<option value="${esc(res.data.name)}">${esc(res.data.name)}</option>`;
      sel.value = res.data.name;
      hideInline('editCreateTypeBtn');
      id('editNewTypeName').value = '';
      showToast('Invoice type created: ' + res.data.name, 'success');
    } catch(e) { showAlert(id('editDetailsAlert'), e.message, 'error'); }
    finally { btn.disabled = false; }
  });

  id('saveEditDetailsBtn')?.addEventListener('click', async () => {
    const customerName = id('editCustomerInput').value.trim();
    const shipmentMode = id('editShipmentSel').value;
    const invoiceType  = id('editInvoiceTypeSel').value || 'Commercial';
    const woDate       = id('editWoDate').value;
    const alertEl      = id('editDetailsAlert');
    if (!customerName) { showAlert(alertEl, 'Customer name is required.', 'error'); return; }
    if (!shipmentMode) { showAlert(alertEl, 'Shipment mode is required.', 'error'); return; }
    if (!woDate)       { showAlert(alertEl, 'Dispatch date is required.', 'error'); return; }
    const btn = id('saveEditDetailsBtn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const res = await api(`/api/workorders/${wo.id}/details`, 'PUT', { customerName, shipmentMode, invoiceType, woDate });
      State.currentWo = res.data;
      renderWoDetail(res.data);
      closeModal();
      showToast('Dispatch details updated', 'success');
      triggerImmediateSync();
    } catch(e) { showAlert(alertEl, e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Save Changes'; }
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
      const amountTotal = await _calcExcelInvoiceTotal(file);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('revisionReason', reason);
      if (amountTotal != null) formData.append('amountTotal', amountTotal);
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

function showCreateLookupModal(type, searchId, hiddenId) {
  const isMode = type === 'shipment-mode';
  const title   = isMode ? 'Create Shipment Mode' : 'Create Invoice Type';
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
      } else {
        if (!State.invoiceTypes.find(t => t.id === res.data.id)) State.invoiceTypes.push(res.data);
      }
      // Update whichever dropdown triggered this (create form or edit modal inline)
      const sId = searchId || (isMode ? 'shipmentSearch' : 'invoiceTypeSearch');
      const hId = hiddenId || (isMode ? 'selectedShipment' : 'selectedInvoiceType');
      if (id(sId)) id(sId).value = res.data.name;
      if (id(hId)) id(hId).value = res.data.name;
      // Also keep edit modal inline selects in sync if present
      if (isMode && id('editShipmentSel')) {
        id('editShipmentSel').innerHTML += `<option value="${esc(res.data.name)}" selected>${esc(res.data.name)}</option>`;
        id('editShipmentSel').value = res.data.name;
      }
      if (!isMode && id('editInvoiceTypeSel')) {
        id('editInvoiceTypeSel').innerHTML += `<option value="${esc(res.data.name)}" selected>${esc(res.data.name)}</option>`;
        id('editInvoiceTypeSel').value = res.data.name;
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
  const notif = State.notifications[origIdx];
  if (!notif) return;
  notif.read = true;
  saveNotifs(); renderNotifBadge(); renderNotifList();
  if (notif.woId) {
    id('notifPanel').style.display = 'none';
    openWoDetail(notif.woId);
  } else if (notif.dispatchNo) {
    // Fallback: look up by WO number in cached list
    const wo = State.woList.find(w => w.woNumber === notif.dispatchNo);
    if (wo) {
      id('notifPanel').style.display = 'none';
      openWoDetail(wo.id);
    }
  }
}

function addNotification(eventType, message, dispatchNo, woId) {
  if (!message || message.trim() === '') {
    console.warn('Notification received with empty message for eventType:', eventType);
    return;
  }
  const icon  = NOTIF_ICONS[eventType]  || '🔔';
  const title = NOTIF_TITLES[eventType] || 'Dispatch Update';
  const notif = { icon, text: message, time: new Date().toLocaleTimeString(), dispatchNo: dispatchNo || '', woId: woId || null, read: false };
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
    `<div class="notif-item${n.read ? '' : ' notif-unread'}${(n.woId || n.dispatchNo) ? ' notif-clickable' : ''}" onclick="markNotifRead(${n._i})">
      <span class="notif-icon">${n.icon || '🔔'}</span>
      <div class="notif-content">
        <div class="notif-text">${esc(n.text)}</div>
        ${n.dispatchNo ? `<div class="notif-dispatch">${esc(n.dispatchNo)}${(n.woId || n.dispatchNo) ? ' <span style="font-size:.7rem;color:var(--blue-600)">→ Open</span>' : ''}</div>` : ''}
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
        addNotification(eventType, messageText, updatedWo?.woNumber, updatedWo?.id);
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
      if (payload?.message) addNotification('UPDATE', payload.message, payload.data?.woNumber, payload.data?.id);
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
function showModal(title, bodyHtml, buttons, opts = {}) {
  id('modalTitle').textContent = title;
  id('modalBody').innerHTML = bodyHtml;
  id('modalFooter').innerHTML = buttons.map(b =>
    b.close
      ? `<button class="btn ${b.cls}" id="modalCancelBtn">${b.label}</button>`
      : `<button class="btn ${b.cls}" id="${b.id}">${b.label}</button>`
  ).join('');
  const box = id('modal').querySelector('.modal-box');
  box.classList.toggle('modal-box--wide', !!opts.wide);
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

// ── INVOICE VIEW ────────────────────────────────────────────────────

// Identical cell-extraction to renderExcelSheet: cell.w → SSF.format → raw
function _getCellText(ws, r, c) {
  const cell = ws[XLSX.utils.encode_cell({ r, c })];
  if (!cell) return '';
  if (cell.w !== undefined) return cell.w.trim();
  if (cell.t === 'n' && cell.z) {
    try { return XLSX.SSF.format(cell.z, cell.v).trim(); } catch (_) { return String(cell.v).trim(); }
  }
  if (cell.v !== undefined) return String(cell.v).trim();
  return '';
}

// Returns true when a DESP. AMT. value means "no amount":
// handles hyphen (-), en-dash (–), em-dash (—), Unicode minus (−), and empty/whitespace.
function _isDash(val) {
  return !val || /^[\-–—−\s]+$/.test(val);
}

// Scan only visible (non-hidden) columns to find the 8 invoice column positions.
// visCols: array of column indices to scan (pass visible cols from ws['!cols']).
function _findInvoiceColumns(ws, range, visCols) {
  const cols = visCols || (() => {
    const a = []; for (let c = range.s.c; c <= range.e.c; c++) a.push(c); return a;
  })();

  const targets = [
    { key: 'po',       test: v => /p\.?\s*o/i.test(v) },
    { key: 'customer', test: v => /cust/i.test(v) },
    { key: 'sr',       test: v => /\bsr\b/i.test(v) },
    { key: 'part',     test: v => /part/i.test(v) },
    { key: 'qty',      test: v => /qty|quantity/i.test(v) && !/desp/i.test(v) },
    { key: 'rate',     test: v => /rate/i.test(v) },
    { key: 'despQty',  test: v => /desp/i.test(v) && /qt/i.test(v) && !/amt/i.test(v) },
    { key: 'despAmt',  test: v => /desp/i.test(v) && /amt/i.test(v) },
  ];

  for (let r = range.s.r; r <= Math.min(range.s.r + 20, range.e.r); r++) {
    // Combine current row + next row text per visible column (handles split headers)
    const colText = {};
    for (const c of cols) {
      colText[c] = (_getCellText(ws, r, c) + ' ' + _getCellText(ws, r + 1, c)).trim();
    }

    const colMap = {};
    for (const t of targets) {
      for (const c of cols) {
        if (t.test(colText[c]) && !(t.key in colMap)) { colMap[t.key] = c; break; }
      }
    }

    if (Object.keys(colMap).length >= 4) {
      // If headerRow+1 also matches as headers (split-header), skip it
      const nextRowHits = Object.values(colMap).filter(c =>
        targets.some(t => t.test(_getCellText(ws, r + 1, c)))
      ).length;
      const dataStartRow = (nextRowHits >= 3) ? r + 2 : r + 1;
      return { headerRow: r, dataStartRow, colMap };
    }
  }
  return null;
}

// Parse an Excel File object and return the DESP. AMT. total for visible invoice rows.
// Returns a number (possibly 0) or null if columns can't be detected.
async function _calcExcelInvoiceTotal(file) {
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws || !ws['!ref']) return null;
    const range = XLSX.utils.decode_range(ws['!ref']);
    const colProps = ws['!cols'] || [];
    const visCols = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      if (!colProps[c]?.hidden) visCols.push(c);
    }
    const found = _findInvoiceColumns(ws, range, visCols);
    if (!found || !('despAmt' in found.colMap)) return null;
    const { dataStartRow, colMap } = found;
    const allKeys = Object.keys(colMap);
    const rowHidden = ws['!rows'] || [];
    let total = 0;
    for (let r = dataStartRow; r <= range.e.r; r++) {
      if (rowHidden[r]?.hidden) continue;
      const amtStr = _getCellText(ws, r, colMap.despAmt);
      if (_isDash(amtStr) || amtStr === '0') continue;
      // Use the same logic as viewExcelInvoice: skip rows where fewer than 2 detected columns have values
      // (catches total/subtotal rows regardless of which columns exist in this Excel format)
      const filledCount = allKeys.filter(k => _getCellText(ws, r, colMap[k])).length;
      if (filledCount < 2) continue;
      const val = parseFloat(amtStr.replace(/,/g, ''));
      if (!isNaN(val)) total += val;
    }
    return Math.round(total * 100) / 100;
  } catch { return null; }
}

async function viewExcelInvoice(fileId, fileName) {
  showModal('Invoice View — ' + fileName,
    `<div id="invViewBody" style="text-align:center;padding:20px;color:var(--text3)">Loading…</div>`,
    [
      { label: '⬇ Export CSV', cls: 'btn-outline', id: 'invExportBtn' },
      { label: '🖨 Print',     cls: 'btn-outline', id: 'invPrintBtn'  },
      { label: 'Close',        cls: 'btn-outline', close: true        },
    ],
    { wide: true }
  );

  let invoiceRows = [], colLabels = [], excelTotalRow = null, amtColIdx = -1;

  try {
    const res = await fetch(`/api/files/download/${fileId}?token=${State.token}`);
    if (!res.ok) throw new Error('Failed to fetch file');
    const wb = XLSX.read(await res.arrayBuffer(), { type: 'array', cellStyles: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const range = XLSX.utils.decode_range(ws['!ref']);
    // Same as renderExcelSheet: only consider visible (non-hidden) columns
    const colProps = ws['!cols'] || [];
    const visCols = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      if (!colProps[c]?.hidden) visCols.push(c);
    }
    const found = _findInvoiceColumns(ws, range, visCols);

    if (!found) {
      id('invViewBody').innerHTML = '<div style="color:var(--red,#e53e3e);padding:16px">Could not detect required columns (P.O.NO., CUSTOMER, PART NO., DESP. AMT., etc.) in this file.</div>';
      return;
    }

    const { dataStartRow, colMap } = found;
    const ORDER = ['po','customer','sr','part','qty','rate','despQty','despAmt'];
    const presentKeys = ORDER.filter(k => k in colMap);
    colLabels = presentKeys.map(k => targets_labels[k]);
    // Same as renderExcelSheet: skip hidden rows
    const rowHidden = ws['!rows'] || [];
    amtColIdx = presentKeys.indexOf('despAmt');

    // Collect rows — same hidden-row logic as View; additionally filter by despAmt
    for (let r = dataStartRow; r <= range.e.r; r++) {
      if (rowHidden[r]?.hidden) continue;
      const vals = presentKeys.map(k => _getCellText(ws, r, colMap[k]));
      // Use _isDash to handle hyphen, en-dash, em-dash, Unicode minus, empty
      const amtVal = amtColIdx >= 0 ? vals[amtColIdx] : '';
      if (_isDash(amtVal) || amtVal === '0') continue;
      // Subtotal/total row: only DESP. AMT. filled — keep the last one to show at bottom
      if (vals.filter(v => v).length < 2) { excelTotalRow = vals; continue; }
      invoiceRows.push(vals);
    }

    if (!invoiceRows.length) {
      id('invViewBody').innerHTML = '<div style="color:var(--text3);padding:16px">No invoice rows found (all DESP. AMT. are empty or —).</div>';
      return;
    }

    const thead = `<tr>${colLabels.map(l => `<th>${esc(l)}</th>`).join('')}</tr>`;
    const tbody = invoiceRows.map((row, i) =>
      `<tr data-inv-row="${i}">${row.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`
    ).join('');

    // Total row from the Excel sheet shown at bottom (styled separately)
    const totalTr = excelTotalRow
      ? `<tr class="inv-total-row">${excelTotalRow.map((v, i) =>
          `<td>${i === 0 ? 'TOTAL' : i === amtColIdx ? `<strong>${esc(v)}</strong>` : ''}</td>`
        ).join('')}</tr>`
      : '';

    const grandTotal = amtColIdx >= 0
      ? invoiceRows.reduce((s, row) => {
          const v = parseFloat(String(row[amtColIdx]).replace(/,/g, ''));
          return s + (isNaN(v) ? 0 : v);
        }, 0)
      : null;

    // Push the correct total back to the file list entry on the detail page
    if (grandTotal !== null) {
      const amtSpan = id('excel-amt-' + fileId);
      if (amtSpan) amtSpan.textContent = grandTotal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
    }

    const totalBadge = grandTotal !== null
      ? `<div style="text-align:right;font-size:.85rem;font-weight:700;margin-bottom:8px;color:var(--text)">
           Total DESP. AMT.: <span style="color:var(--green,#38a169)">${grandTotal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
         </div>`
      : '';

    id('invViewBody').innerHTML = `
      ${totalBadge}
      <div style="font-size:.73rem;color:var(--text3);margin-bottom:8px;line-height:1.6">
        Click row to select &nbsp;·&nbsp;
        <kbd class="inv-kbd">↑↓</kbd> navigate &nbsp;·&nbsp;
        <kbd class="inv-kbd">R</kbd> mark red (PO missing) &nbsp;·&nbsp;
        <kbd class="inv-kbd">Space</kbd> mark verified ✓
      </div>
      <div id="invTableWrap" style="overflow-y:auto;max-height:54vh" tabindex="0">
        <table class="inv-view-table">
          <thead>${thead}</thead>
          <tbody>${tbody}${totalTr}</tbody>
        </table>
      </div>`;

    // Row selection & keyboard navigation
    const wrap = id('invTableWrap');
    const trows = Array.from(wrap.querySelectorAll('tr[data-inv-row]'));
    let selIdx = -1;

    function invSelect(idx) {
      trows.forEach((r, i) => r.classList.toggle('inv-selected', i === idx));
      selIdx = idx;
      if (idx >= 0) trows[idx].scrollIntoView({ block: 'nearest' });
    }

    trows.forEach((tr, i) => tr.addEventListener('click', () => invSelect(i)));

    wrap.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        invSelect(selIdx < 0 ? 0 : Math.min(selIdx + 1, trows.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        invSelect(Math.max(selIdx - 1, 0));
      } else if ((e.key === 'r' || e.key === 'R') && selIdx >= 0) {
        trows[selIdx].classList.remove('inv-green');
        trows[selIdx].classList.toggle('inv-red');
      } else if (e.key === ' ' && selIdx >= 0) {
        e.preventDefault();
        trows[selIdx].classList.remove('inv-red');
        trows[selIdx].classList.toggle('inv-green');
      }
    });

    wrap.focus();

    // Save verified total to DB — always save when invoice view is opened so amountVerified=true is set
    if (grandTotal != null) {
      const woFile = State.currentWo?.excelFiles?.find(f => f.id === fileId);
      if (woFile && !woFile.amountVerified) {
        fetch(`/api/files/${fileId}/amount-total?value=${grandTotal}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${State.token}` }
        }).then(r => {
          if (r.ok) {
            woFile.amountTotal = grandTotal;
            woFile.amountVerified = true;
          }
        }).catch(() => {});
      }
    }

  } catch (e) {
    id('invViewBody').innerHTML = `<div style="color:var(--red,#e53e3e);padding:16px">Error: ${esc(e.message)}</div>`;
    return;
  }

  // Export CSV
  id('invExportBtn')?.addEventListener('click', () => {
    const bom = '﻿';
    const csv = bom + [colLabels, ...invoiceRows]
      .map(row => row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','))
      .join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = fileName.replace(/\.[^.]+$/, '') + '_invoice.csv';
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  // Print
  id('invPrintBtn')?.addEventListener('click', () => {
    const wo = State.currentWo || {};
    const dlHeader = wo.woNumber
      ? `<div style="font-size:15px;font-weight:700;margin-bottom:2px">${esc(wo.woNumber)}</div>
         <div style="font-size:12px;color:#555;margin-bottom:14px">${esc(wo.customerName || '')}${wo.shipmentMode ? ' — ' + esc(wo.shipmentMode) : ''}</div>`
      : '';
    const totalRowHtml = excelTotalRow
      ? `<tr style="font-weight:700;background:#f0f0f0;border-top:2px solid #999">
           ${excelTotalRow.map((v, i) => `<td>${i === 0 ? 'TOTAL' : i === amtColIdx ? esc(v) : ''}</td>`).join('')}
         </tr>`
      : '';
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>${esc(wo.woNumber || fileName)} — Invoice</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; }
        th { background: #f0f0f0; font-weight: bold; }
        tr:nth-child(even) td { background: #fafafa; }
        @media print { body { margin: 10px; } }
      </style></head><body>
      ${dlHeader}
      <table><thead><tr>${colLabels.map(l => `<th>${esc(l)}</th>`).join('')}</tr></thead>
      <tbody>${invoiceRows.map(row => `<tr>${row.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}${totalRowHtml}</tbody>
      </table></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  });
}

// Column labels lookup used inside viewExcelInvoice
const targets_labels = {
  po: 'P.O.NO.', customer: 'CUSTOMER', sr: 'SR. NO.', part: 'PART NO.',
  qty: 'QTY.', rate: 'RATE PER Pc.', despQty: 'DESP. QTY.', despAmt: 'DESP. AMT.'
};
// Close on backdrop click
document.addEventListener('DOMContentLoaded', () => {
  id('excelViewerModal')?.addEventListener('click', e => {
    if (e.target === id('excelViewerModal')) closeExcelViewer();
  });
});

// ── USER MANAGEMENT ────────────────────────────────────────────────
const ALL_ROLES = ['ADMIN','GENERAL_MANAGER','STORE','INVOICE_CREATOR','SALES_EXECUTIVE','GUEST'];

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

async function downloadFileAs(fileId, filename) {
  try {
    showToast('Preparing download…', 'info');
    const res = await fetch(`/api/files/download/${fileId}?token=${State.token}`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    showToast('Download failed: ' + e.message, 'error');
  }
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

// ═══════════════════════════════════════════════════════════════════
// TALLY INVOICE MODAL
// ═══════════════════════════════════════════════════════════════════

State.tallyParts = [];
State.tallyWoId = null;
State.tallyCurrentTab = 1;
State.tallyImportMethod = 'v374';
State.tallyCurrentWo = null;

function injectTallyFloatBtn(wo) {
  const btn = document.createElement('button');
  btn.id = 'tallyFloatBtn';
  btn.innerHTML = '🧾 Create Invoice';
  btn.style.cssText = [
    'position:fixed',
    'bottom:32px',
    'right:32px',
    'z-index:2000',
    'background:#1e3a6e',
    'color:#fff',
    'border:none',
    'border-radius:10px',
    'padding:13px 22px',
    'font-size:14px',
    'font-weight:700',
    'cursor:pointer',
    'box-shadow:0 4px 16px rgba(0,0,0,0.35)',
    'letter-spacing:.3px',
    'transition:opacity .15s',
  ].join(';');
  btn.onmouseenter = () => btn.style.opacity = '.85';
  btn.onmouseleave = () => btn.style.opacity = '1';
  btn.onclick = () => openTallyModal(wo);
  document.body.appendChild(btn);
}

function removeTallyFloatBtn() {
  id('tallyFloatBtn')?.remove();
}

async function openTallyModal(wo) {
  State.tallyWoId = wo.id;
  State.tallyCurrentWo = wo;
  State.tallyCurrentTab = 1;
  State.tallyImportMethod = 'v374';
  State.tallyParts = [];

  const modal = id('tallyInvoiceModal');
  modal.style.display = 'flex';

  // Reset result box
  const resultBox = id('tallyResultBox');
  if (resultBox) { resultBox.style.display = 'none'; resultBox.textContent = ''; }

  // Show loading in parts status
  const statusEl = id('tallyPartsStatus');
  if (statusEl) statusEl.textContent = 'Loading Excel data...';
  const tbody = id('tallyPartsTbody');
  if (tbody) tbody.innerHTML = '';

  switchTallyTab(1);

  try {
    const res = await api(`/api/tally/prefill/${wo.id}?method=${State.tallyImportMethod}`, 'GET');
    const d = res.data;

    // Store parts
    State.tallyParts = (d.parts || []).map(p => ({ ...p, deleted: false }));

    // Populate Step 2 fields
    setVal('tallyVoucherNo', d.nextVoucherNo || '');
    setVal('tallyVoucherDate', new Date().toISOString().slice(0, 10).replace(/-/g, ''));
    setVal('tallyPartyName', d.partyTally || '');
    setVal('tallyPartyCountry', d.partyCountry || '');
    // Load today's stored rates into inputs; selectTallyCurrByValue below will fill tallyExRate
    loadTallyDailyRates();
    setVal('tallyTerms', d.terms || '');
    setVal('tallyPortL', d.portLoading || '');
    setVal('tallyPortD', d.portDischarge || '');
    setVal('tallyFinalDest', d.finalDest || '');
    setVal('tallyCountryDest', d.countryDest || '');
    setVal('tallyBuyerName', d.buyerName || '');
    setVal('tallyBuyerAddr', d.buyerAddress || '');

    // Currency buttons
    selectTallyCurrByValue(d.currency || 'DOLLAR');

    // AIR/SEA radio
    const modeEl = document.querySelector(`input[name="tallyMode"][value="${d.airSea || 'AIR'}"]`);
    if (modeEl) modeEl.checked = true;

    // Step 3 fields — auto-fill from store packing details
    const packing = parsePackingText(wo.packagingDetails || '');
    setVal('tallyNetWt',    packing.netWt    || '');
    setVal('tallyGrossWt',  packing.grossWt  || '');
    setVal('tallyBoxSize',  packing.boxSize  || '');
    setVal('tallyBoxType',  packing.boxType  || '01 WOODEN BOX');
    setVal('tallyMainFolder', d.mainInvoiceFolder || '');

    // Method label
    updateTallyMethodLabel();

    // Render parts
    renderTallyParts();

    // Address preview
    if (d.addressLines && d.addressLines.length) {
      const preview = id('tallyAddrPreview');
      if (preview) preview.textContent = (d.mailingName ? d.mailingName + '\n' : '') + d.addressLines.join('\n');
    }

    // Show parse error if any
    if (d.parseError) {
      if (statusEl) { statusEl.style.color = '#dc2626'; statusEl.textContent = '⚠ ' + d.parseError; }
    } else {
      if (statusEl) { statusEl.style.color = ''; statusEl.textContent = `${State.tallyParts.length} part(s) loaded`; }
    }

  } catch (e) {
    showToast('Failed to load invoice data: ' + e.message, 'error');
    closeTallyModal();
  }
}

function closeTallyModal() {
  const modal = id('tallyInvoiceModal');
  if (modal) modal.style.display = 'none';
  State.tallyParts = [];
  State.tallyWoId = null;
}

function switchTallyTab(n) {
  State.tallyCurrentTab = n;
  for (let i = 1; i <= 4; i++) {
    const step = id('tallyStep' + i);
    const tab  = id('tallyTab' + i);
    if (step) step.style.display = i === n ? 'block' : 'none';
    if (tab) tab.classList.toggle('active', i === n);
  }
  if (n === 4) buildTallyReview();
}

function selectTallyCurr(btn) {
  document.querySelectorAll('.tally-curr-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyTallyRateForCurrency(btn.dataset.curr || btn.textContent.trim());
}

function selectTallyCurrByValue(val) {
  const upper = val.toUpperCase();
  document.querySelectorAll('.tally-curr-btn').forEach(b => {
    const curr = (b.dataset.curr || b.textContent.trim()).toUpperCase();
    const euroVariants = ['EUR', 'EURO', '€'];
    const isEuro = euroVariants.some(v => upper.startsWith(v)) && euroVariants.some(v => curr.startsWith(v));
    b.classList.toggle('active', curr === upper || isEuro);
  });
  applyTallyRateForCurrency(val);
}

function getSelectedTallyCurr() {
  const active = document.querySelector('.tally-curr-btn.active');
  return active ? (active.dataset.curr || active.textContent.trim()) : 'DOLLAR';
}

function renderTallyParts() {
  const tbody = id('tallyPartsTbody');
  if (!tbody) return;

  const active  = State.tallyParts.filter(p => !p.deleted);
  const deleted = State.tallyParts.filter(p =>  p.deleted);

  if (active.length === 0 && deleted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="padding:1rem;color:var(--text3);text-align:center">No parts. Check Excel file.</td></tr>';
    updateTallyStats();
    return;
  }

  const activeRows = active.map(p => {
    const oi = State.tallyParts.indexOf(p);
    return `<tr style="border-bottom:1px solid var(--border,#e5e7eb)">
      <td style="padding:4px 8px;text-align:center"><input type="checkbox" class="tally-part-cb" data-idx="${oi}"></td>
      <td style="padding:4px 6px;color:var(--text3);font-size:11px">${p.row}</td>
      <td style="padding:4px 8px;font-weight:500">${esc(p.partNo)}</td>
      <td style="padding:4px 6px;text-align:right">${p.qty}</td>
      <td style="padding:4px 8px;text-align:right">${p.amount.toFixed(2)}</td>
      <td style="padding:4px 8px;color:var(--text3);font-size:12px">${esc(p.poNo || '')}</td>
      <td style="padding:4px 6px;color:var(--text3);font-size:11px">${esc(p.poSrNo || '')}</td>
      <td style="padding:4px 6px;text-align:right;color:var(--text3);font-size:12px">${p.ratePc ? p.ratePc.toFixed(2) : ''}</td>
      <td style="padding:4px 6px;text-align:center">
        <button class="btn btn-xs" style="background:#fee2e2;color:#dc2626;border:none;cursor:pointer;border-radius:4px;padding:2px 7px"
          onclick="deleteTallyPart(${oi})">✕</button>
      </td>
    </tr>`;
  }).join('');

  const deletedRows = deleted.length === 0 ? '' :
    `<tr><td colspan="9" style="padding:4px 8px;background:#fef2f2;font-size:.78rem;color:#dc2626;font-weight:600">
      — ${deleted.length} deleted part(s) — click ↩ to restore —
    </td></tr>` +
    deleted.map(p => {
      const oi = State.tallyParts.indexOf(p);
      return `<tr style="background:#fef2f2;opacity:.65">
        <td></td>
        <td style="padding:3px 6px;color:var(--text3);font-size:11px">${p.row}</td>
        <td style="padding:3px 8px;text-decoration:line-through;color:var(--text3)">${esc(p.partNo)}</td>
        <td style="padding:3px 6px;text-align:right;color:var(--text3)">${p.qty}</td>
        <td style="padding:3px 8px;text-align:right;color:var(--text3)">${p.amount.toFixed(2)}</td>
        <td style="padding:3px 8px;color:var(--text3);font-size:12px">${esc(p.poNo || '')}</td>
        <td></td><td></td>
        <td style="padding:3px 6px;text-align:center">
          <button class="btn btn-xs" style="background:#e0f2fe;color:#0369a1;border:none;cursor:pointer;border-radius:4px;padding:2px 7px"
            onclick="restoreTallyPart(${oi})">↩</button>
        </td>
      </tr>`;
    }).join('');

  tbody.innerHTML = activeRows + deletedRows;
  updateTallyStats();
}

function deleteTallyPart(originalIdx) {
  if (State.tallyParts[originalIdx]) State.tallyParts[originalIdx].deleted = true;
  renderTallyParts();
}

function restoreTallyPart(originalIdx) {
  if (State.tallyParts[originalIdx]) State.tallyParts[originalIdx].deleted = false;
  renderTallyParts();
}

function deleteTallySelected() {
  document.querySelectorAll('.tally-part-cb:checked').forEach(cb => {
    const idx = parseInt(cb.dataset.idx);
    if (State.tallyParts[idx]) State.tallyParts[idx].deleted = true;
  });
  renderTallyParts();
}

function toggleTallySelectAll(cb) {
  document.querySelectorAll('.tally-part-cb').forEach(c => c.checked = cb.checked);
}

// ── Check Parts against Tally Stock Items ────────────────────────────────
async function checkTallyParts() {
  const panel = id('tallyCheckPanel');
  if (!panel) return;
  // Toggle off if already showing
  if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }

  const active = State.tallyParts.filter(p => !p.deleted);
  if (active.length === 0) {
    panel.innerHTML = '<div style="padding:8px;color:#dc2626;font-size:.85rem">No active parts to check.</div>';
    panel.style.display = 'block';
    return;
  }

  panel.style.display = 'block';
  panel.innerHTML = `<div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:6px;padding:14px;text-align:center;color:var(--navy,#1e3a6e)">
    🔄 Checking ${active.length} parts against Tally database…
  </div>`;

  try {
    const res = await api('/api/tally/check-parts', 'POST', { parts: active.map(p => p.partNo) });
    State.tallyCheckResult = res.data;
    renderTallyCheckPanel();
  } catch (e) {
    panel.innerHTML = `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:12px 14px;color:#dc2626;font-size:.85rem">
      ✗ Cannot reach Tally: ${esc(e.message || 'Make sure Tally is open with HTTP Server enabled on port 9000')}
    </div>`;
  }
}

function renderTallyCheckPanel() {
  const panel = id('tallyCheckPanel');
  if (!panel) return;
  const result   = State.tallyCheckResult || { found: [], notFound: [] };
  const foundSet = new Set((result.found || []).map(s => s.toUpperCase()));
  const active   = State.tallyParts.filter(p => !p.deleted);
  const deleted  = State.tallyParts.filter(p =>  p.deleted);
  const foundCnt    = active.filter(p => foundSet.has(p.partNo.toUpperCase())).length;
  const notFoundCnt = active.length - foundCnt;

  const activeRows = active.map(p => {
    const oi     = State.tallyParts.indexOf(p);
    const exists = foundSet.has(p.partNo.toUpperCase());
    return `<tr style="border-bottom:1px solid #e5e7eb;background:${exists ? '#f0fdf4' : '#fef2f2'}">
      <td style="padding:4px 8px;text-align:center"><input type="checkbox" class="tally-check-cb" data-idx="${oi}" ${!exists ? 'checked' : ''}></td>
      <td style="padding:4px 8px;font-weight:500;font-size:.82rem">${esc(p.partNo)}</td>
      <td style="padding:4px 6px;text-align:right;font-size:.8rem">${p.qty}</td>
      <td style="padding:4px 8px;text-align:right;font-size:.8rem">${p.amount.toFixed(2)}</td>
      <td style="padding:4px 8px;font-size:.8rem;font-weight:600;color:${exists ? '#15803d' : '#dc2626'}">${exists ? '✓ In Tally' : '✗ Not in Tally'}</td>
      <td style="padding:4px 6px;text-align:center">
        <button style="background:#fee2e2;color:#dc2626;border:none;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:.75rem"
          onclick="deleteTallyPart(${oi});renderTallyCheckPanel()">✕</button>
      </td>
    </tr>`;
  }).join('');

  const deletedRows = deleted.length === 0 ? '' :
    `<tr><td colspan="6" style="padding:4px 8px;background:#ffe4e4;font-size:.73rem;color:#dc2626;font-weight:600">— ${deleted.length} deleted (↩ to restore) —</td></tr>` +
    deleted.map(p => {
      const oi = State.tallyParts.indexOf(p);
      return `<tr style="background:#fff5f5;opacity:.72">
        <td style="padding:4px 8px;text-align:center"><input type="checkbox" class="tally-restore-cb" data-idx="${oi}"></td>
        <td style="padding:4px 8px;text-decoration:line-through;color:var(--text3);font-size:.82rem">${esc(p.partNo)}</td>
        <td style="padding:4px 6px;text-align:right;font-size:.8rem">${p.qty}</td>
        <td style="padding:4px 8px;text-align:right;font-size:.8rem">${p.amount.toFixed(2)}</td>
        <td style="padding:4px 8px;font-size:.8rem;color:#dc2626">⊘ Deleted</td>
        <td style="padding:4px 6px;text-align:center">
          <button style="background:#e0f2fe;color:#0369a1;border:none;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:.75rem"
            onclick="restoreTallyPart(${oi});renderTallyCheckPanel()">↩</button>
        </td>
      </tr>`;
    }).join('');

  panel.innerHTML = `
    <div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:6px;padding:12px 14px">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:10px;flex-wrap:wrap">
        <div style="font-weight:700;font-size:.88rem;color:var(--navy,#1e3a6e)">Tally Stock Check</div>
        <span style="background:#dcfce7;color:#15803d;border-radius:4px;padding:2px 7px;font-size:.74rem;font-weight:600">${foundCnt} found</span>
        ${notFoundCnt ? `<span style="background:#fee2e2;color:#dc2626;border-radius:4px;padding:2px 7px;font-size:.74rem;font-weight:600">${notFoundCnt} NOT in Tally</span>` : ''}
        <button onclick="deleteTallyCheckSelected()"
          style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:5px;padding:2px 9px;font-size:.74rem;font-weight:600;cursor:pointer">🗑 Delete Selected</button>
        ${notFoundCnt ? `<button onclick="deleteAllNotInTally()"
          style="background:#fff3cd;color:#856404;border:1px solid #ffc107;border-radius:5px;padding:2px 9px;font-size:.74rem;font-weight:600;cursor:pointer">⚠ Delete All Not-In-Tally (${notFoundCnt})</button>` : ''}
        ${deleted.length ? `<button onclick="restoreTallyCheckSelected()"
          style="background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd;border-radius:5px;padding:2px 9px;font-size:.74rem;font-weight:600;cursor:pointer">↩ Restore Selected</button>` : ''}
      </div>
      <div style="max-height:270px;overflow-y:auto;border:1px solid #c7d2fe;border-radius:4px">
        <table style="width:100%;font-size:.82rem;border-collapse:collapse">
          <thead style="position:sticky;top:0;z-index:1">
            <tr style="background:#c7d2fe">
              <th style="padding:4px 8px;width:28px"><input type="checkbox" title="Select all"
                onchange="document.querySelectorAll('.tally-check-cb,.tally-restore-cb').forEach(c=>c.checked=this.checked)"></th>
              <th style="padding:4px 10px;text-align:left">Part No.</th>
              <th style="padding:4px 6px;text-align:right">Qty</th>
              <th style="padding:4px 8px;text-align:right">Amount</th>
              <th style="padding:4px 10px;text-align:left">Status</th>
              <th style="padding:4px 6px"></th>
            </tr>
          </thead>
          <tbody>${activeRows}${deletedRows}</tbody>
        </table>
      </div>
      ${result.totalInTally !== undefined ? `<div style="margin-top:5px;font-size:.72rem;color:var(--text3)">Tally has ${result.totalInTally} total stock items</div>` : ''}
    </div>`;
  panel.style.display = 'block';
}

function deleteTallyCheckSelected() {
  document.querySelectorAll('.tally-check-cb:checked').forEach(cb => {
    const idx = parseInt(cb.dataset.idx);
    if (State.tallyParts[idx]) State.tallyParts[idx].deleted = true;
  });
  renderTallyParts();
  renderTallyCheckPanel();
}

function restoreTallyCheckSelected() {
  document.querySelectorAll('.tally-restore-cb:checked').forEach(cb => {
    const idx = parseInt(cb.dataset.idx);
    if (State.tallyParts[idx]) State.tallyParts[idx].deleted = false;
  });
  renderTallyParts();
  renderTallyCheckPanel();
}

function deleteAllNotInTally() {
  const notFound = new Set((State.tallyCheckResult?.notFound || []).map(s => s.toUpperCase()));
  State.tallyParts.forEach(p => { if (!p.deleted && notFound.has(p.partNo.toUpperCase())) p.deleted = true; });
  renderTallyParts();
  renderTallyCheckPanel();
}

// ── Daily Currency Rate Cache (localStorage, resets per day) ─────────────
function getTallyRatesKey() {
  return 'tallyRates_' + new Date().toISOString().slice(0, 10);
}

function loadTallyDailyRates() {
  const rates = JSON.parse(localStorage.getItem(getTallyRatesKey()) || '{}');
  State.tallyDailyRates = rates;
  if (id('tallyRateDollar')) id('tallyRateDollar').value = rates.DOLLAR || '';
  if (id('tallyRateEuro'))   id('tallyRateEuro').value   = rates.EUR    || '';
  if (id('tallyRatePound'))  id('tallyRatePound').value  = rates.POUND  || '';
  const tag = id('tallyRatesSavedTag');
  if (tag) {
    const d = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    const hasAny = Object.keys(rates).length > 0;
    tag.textContent = hasAny ? `✓ Saved for ${d}` : `Not set for ${d}`;
    tag.style.color = hasAny ? '#15803d' : '#e65100';
  }
}

function saveTallyRate(curr, value) {
  if (!value || isNaN(parseFloat(value)) || parseFloat(value) <= 0) return;
  const rate  = parseFloat(value);
  const key   = getTallyRatesKey();
  const rates = JSON.parse(localStorage.getItem(key) || '{}');
  rates[curr.toUpperCase()] = rate;
  localStorage.setItem(key, JSON.stringify(rates));
  State.tallyDailyRates = rates;
  // If this currency is currently selected, update the exchange rate field
  const sel = getSelectedTallyCurr().toUpperCase();
  const eu  = ['EUR','EURO','€'];
  const match = sel === curr.toUpperCase()
    || (eu.some(v => sel.startsWith(v)) && eu.some(v => curr.toUpperCase().startsWith(v)));
  if (match) setVal('tallyExRate', rate);
  const tag = id('tallyRatesSavedTag');
  if (tag) { const d = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); tag.textContent = `✓ Saved for ${d}`; tag.style.color='#15803d'; }
}

function applyTallyRateForCurrency(currKey) {
  const rates = State.tallyDailyRates || {};
  const up = (currKey || '').toUpperCase();
  let rate = null;
  if (up === 'DOLLAR' || up === 'USD') rate = rates['DOLLAR'];
  else if (up.startsWith('EUR') || up === '€') rate = rates['EUR'];
  else if (up === 'POUND' || up === 'GBP') rate = rates['POUND'];
  if (rate) setVal('tallyExRate', rate);
}

async function savePartyToJson() {
  const req = collectTallyRequest();
  if (!req.partyTally) { showToast('Party name is required', 'error'); return; }
  try {
    await api('/api/tally/save-party', 'POST', req);
    showToast('Party details saved to JSON', 'success');
  } catch (e) {
    showToast('Save failed: ' + (e.message || 'unknown error'), 'error');
  }
}

function updateTallyStats() {
  const active = State.tallyParts.filter(p => !p.deleted);
  const total = active.reduce((s, p) => s + p.amount, 0);
  const statsEl = id('tallyPartsStats');
  if (statsEl) statsEl.textContent = `${active.length} part(s) · Total: ${total.toFixed(2)}`;
}

function buildTallyReview() {
  const active = State.tallyParts.filter(p => !p.deleted);
  const total = active.reduce((s, p) => s + p.amount, 0);
  const curr = getSelectedTallyCurr();
  const mode = document.querySelector('input[name="tallyMode"]:checked')?.value || 'AIR';

  const lines = [
    `Voucher No : ${getVal('tallyVoucherNo')}`,
    `Date       : ${getVal('tallyVoucherDate')}`,
    `Party      : ${getVal('tallyPartyName')}`,
    `Country    : ${getVal('tallyPartyCountry')}`,
    `Currency   : ${curr}  (Rate: ${getVal('tallyExRate')})`,
    `Mode       : ${mode}`,
    `Terms      : ${getVal('tallyTerms')}`,
    `Port Load  : ${getVal('tallyPortL')}`,
    `Port Disc  : ${getVal('tallyPortD')}`,
    `Final Dest : ${getVal('tallyFinalDest')}`,
    `Cty Dest   : ${getVal('tallyCountryDest')}`,
    `Buyer      : ${getVal('tallyBuyerName')}`,
    `Buyer Addr : ${getVal('tallyBuyerAddr')}`,
    ``,
    `Net Wt     : ${getVal('tallyNetWt')} kg`,
    `Gross Wt   : ${getVal('tallyGrossWt')} kg`,
    `Box Size   : ${getVal('tallyBoxSize')}`,
    `Box Type   : ${getVal('tallyBoxType')}`,
    ``,
    `Parts (${active.length}):`,
    ...active.map(p => `  Row ${p.row}: ${p.partNo}  qty=${p.qty}  amt=${p.amount.toFixed(2)}  po=${p.poNo || '—'}`),
    ``,
    `Total Amount: ${total.toFixed(2)} ${curr}`,
    `Folder: ${getVal('tallyMainFolder')}`,
  ];

  const reviewEl = id('tallyReviewBox');
  if (reviewEl) reviewEl.textContent = lines.join('\n');
}

function collectTallyRequest() {
  const mode = document.querySelector('input[name="tallyMode"]:checked')?.value || 'AIR';
  return {
    parts: State.tallyParts.filter(p => !p.deleted),
    voucherNumber: getVal('tallyVoucherNo'),
    voucherDate: getVal('tallyVoucherDate').replace(/-/g, ''),
    partyTally: getVal('tallyPartyName'),
    partyCountry: getVal('tallyPartyCountry'),
    currency: getSelectedTallyCurr(),
    exchangeRate: parseFloat(getVal('tallyExRate') || '1'),
    airSea: mode,
    terms: getVal('tallyTerms'),
    portLoading: getVal('tallyPortL'),
    portDischarge: getVal('tallyPortD'),
    finalDest: getVal('tallyFinalDest'),
    countryDest: getVal('tallyCountryDest'),
    buyerName: getVal('tallyBuyerName'),
    buyerAddress: getVal('tallyBuyerAddr'),
    netWeight: getVal('tallyNetWt'),
    grossWeight: getVal('tallyGrossWt'),
    boxSize: getVal('tallyBoxSize'),
    boxType: getVal('tallyBoxType'),
    mainInvoiceFolder: getVal('tallyMainFolder'),
  };
}

function showTallyResult(text, ok) {
  const box = id('tallyResultBox');
  if (!box) return;
  box.style.display = 'block';
  box.style.background = ok ? '#f0fdf4' : '#fef2f2';
  box.style.border = `1px solid ${ok ? '#86efac' : '#fca5a5'}`;
  box.style.color = ok ? '#15803d' : '#dc2626';
  box.style.whiteSpace = 'pre-wrap';
  box.textContent = text;
}

async function sendTallyInvoice() {
  const req = collectTallyRequest();
  if (!req.parts.length) { showToast('No parts to send', 'error'); return; }
  if (!req.voucherNumber) { showToast('Voucher number is required', 'error'); return; }

  showTallyResult('Sending to Tally...', true);

  try {
    const res = await api('/api/tally/send', 'POST', req);
    const d = res.data;
    const ok = d.status === 'CREATED' || d.status === 'ALTERED';
    showTallyResult(
      ok
        ? `✓ Invoice ${d.status} in Tally (Voucher: ${req.voucherNumber})`
        : `✗ Tally responded: ${d.status}\n${d.tallyResponse || ''}`,
      ok
    );
    showToast(ok ? `Invoice ${req.voucherNumber} sent to Tally` : 'Tally returned: ' + d.status, ok ? 'success' : 'error');
  } catch (e) {
    showTallyResult('✗ ' + e.message, false);
    showToast('Send failed: ' + e.message, 'error');
  }
}

async function createTallyFolders() {
  const req = collectTallyRequest();
  if (!req.voucherNumber) { showToast('Voucher number is required', 'error'); return; }

  showTallyResult('Creating folders...', true);

  try {
    const res = await api('/api/tally/create-folders', 'POST', req);
    const d = res.data;
    const ok = d.status === 'OK';
    showTallyResult(ok ? '✓ Folders created:\n' + (d.folderPath || '') : '✗ ' + (d.message || 'Unknown error'), ok);
    showToast(ok ? 'Invoice folders created' : 'Folder creation failed', ok ? 'success' : 'error');
  } catch (e) {
    showTallyResult('✗ ' + e.message, false);
    showToast('Folder creation failed: ' + e.message, 'error');
  }
}

function onTallyModeChange() {
  if (State.tallyCurrentTab === 4) buildTallyReview();
}

async function switchTallyMethod() {
  State.tallyImportMethod = State.tallyImportMethod === 'v374' ? 'v35' : 'v374';
  updateTallyMethodLabel();

  const statusEl = id('tallyPartsStatus');
  const tbody = id('tallyPartsTbody');
  if (statusEl) statusEl.textContent = `Re-loading with ${State.tallyImportMethod.toUpperCase()}…`;
  if (tbody) tbody.innerHTML = '';
  State.tallyParts = [];
  updateTallyStats();

  try {
    const res = await api(`/api/tally/prefill/${State.tallyWoId}?method=${State.tallyImportMethod}`, 'GET');
    const d = res.data;
    State.tallyParts = (d.parts || []).map(p => ({ ...p, deleted: false }));
    renderTallyParts();
    if (d.parseError) {
      if (statusEl) { statusEl.style.color = '#dc2626'; statusEl.textContent = '⚠ ' + d.parseError; }
    } else {
      if (statusEl) { statusEl.style.color = ''; statusEl.textContent = `${State.tallyParts.length} part(s) loaded (${State.tallyImportMethod.toUpperCase()})`; }
    }
  } catch (e) {
    showToast('Re-parse failed: ' + e.message, 'error');
    if (statusEl) { statusEl.style.color = '#dc2626'; statusEl.textContent = '✗ ' + e.message; }
  }
}

function updateTallyMethodLabel() {
  const lbl = id('tallyMethodLabel');
  const btn = id('tallyMethodBtn');
  if (!lbl || !btn) return;
  if (State.tallyImportMethod === 'v374') {
    lbl.textContent = 'Import: V3.7.4 (default)';
    btn.textContent = '⚠ Wrong parts? Switch to V3.5';
    btn.style.background = '#e65100';
  } else {
    lbl.textContent = 'Import: V3.5 (strict part filter)';
    btn.textContent = '↩ Switch back to V3.7.4';
    btn.style.background = '#1e3a6e';
  }
}

function parsePackingText(text) {
  if (!text) return {};
  const t = text.toUpperCase();
  const result = {};

  // Net weight — "NET WT. 10.000" or "NET WT : 10"
  let m = t.match(/NET\s+WT\.?\s*[:\-]?\s*([\d]+(?:[.,][\d]+)?)/);
  if (m) result.netWt = m[1].replace(',', '.');

  // Gross weight — "TOTAL GR. WT : 13.000" or "GR. WT" or "GROSS WT"
  m = t.match(/TOTAL\s+GR\.?\s*\.?\s*WT\.?\s*[:\-]?\s*([\d]+(?:[.,][\d]+)?)/);
  if (!m) m = t.match(/GR(?:OSS)?\.?\s*WT\.?\s*[:\-]?\s*([\d]+(?:[.,][\d]+)?)/);
  if (m) result.grossWt = m[1].replace(',', '.');

  // Box size — "BOX SIZE : 13"X13"X06"" or "BOX SIZE - 12'' X 9''X5''"
  m = text.match(/BOX\s+SIZE\s*[-:]\s*([^\n\r]+)/i);
  if (m) result.boxSize = m[1].trim().replace(/\s+/g, ' ');

  // Box type — "NO. OF BOXES : 01 CORRUGATED BOX" → "01 CORRUGATED BOX"
  m = t.match(/NO\.?\s*OF\s*BOXES\s*[:\-]?\s*(\d+\s+[A-Z]+(?:\s+[A-Z]+)*BOX)/);
  if (m) {
    result.boxType = m[1].trim().replace(/\.$/, '');
  } else {
    // Standalone box type: "COURAGATED BOX" / "CORRUGATED BOX" / "WOODEN BOX"
    m = t.match(/\b(\d+\s+)?(?:CORR(?:UGATED)?|COURAGATED|WOODEN|PLYWOOD)\s+BOX/);
    if (m) result.boxType = m[0].trim().replace(/\.$/, '');
  }

  return result;
}

function setVal(elId, val) {
  const el = id(elId);
  if (el) el.value = val ?? '';
}

function getVal(elId) {
  return id(elId)?.value?.trim() ?? '';
}
