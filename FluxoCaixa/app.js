/* ─────────────────────────────────────────
   Fluxo de Caixa — JMP Finance
   app.js  (vanilla JS, localStorage, Chart.js, SheetJS)
───────────────────────────────────────── */

'use strict';

// ═══════════════════════════════════════════
//  STORAGE HELPERS
// ═══════════════════════════════════════════

const KEYS = { BUS: 'fc_bus_v1', LANC: 'fc_lancamentos_v1' };

function loadBUs()   { try { return JSON.parse(localStorage.getItem(KEYS.BUS))  || []; } catch { return []; } }
function loadLancs() { try { return JSON.parse(localStorage.getItem(KEYS.LANC)) || []; } catch { return []; } }
function saveBUs(data)   { localStorage.setItem(KEYS.BUS,  JSON.stringify(data)); }
function saveLancs(data) { localStorage.setItem(KEYS.LANC, JSON.stringify(data)); }

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ═══════════════════════════════════════════
//  DATE / FORMAT HELPERS
// ═══════════════════════════════════════════

const fmtCurrency = v =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtDate = str => {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
};

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function isoToDate(iso) {
  // Parse YYYY-MM-DD as LOCAL date (avoid UTC shift)
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Parse a date from Excel import: handles DD/MM/YYYY, YYYY-MM-DD, serial numbers, JS Date
function parseExcelDate(raw) {
  if (raw === null || raw === undefined || raw === '') return null;

  // Excel serial number
  if (typeof raw === 'number') {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }

  // JS Date object
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    return raw.toISOString().slice(0, 10);
  }

  const s = String(raw).trim();

  // DD/MM/YYYY
  const ddmmyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  // YYYY-MM-DD
  const yyyymmdd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmdd) return s;

  // Try Date.parse as fallback
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  return null;
}

// Returns { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' } for current period selection
function getPeriodDates() {
  const periodo = document.getElementById('dash-periodo-select').value;
  const today = new Date();
  let start, end;

  if (periodo === 'este-mes') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end   = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  } else if (periodo === 'proximos-3') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end   = new Date(today.getFullYear(), today.getMonth() + 3, 0);
  } else if (periodo === 'proximos-6') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end   = new Date(today.getFullYear(), today.getMonth() + 6, 0);
  } else if (periodo === 'este-ano') {
    start = new Date(today.getFullYear(), 0, 1);
    end   = new Date(today.getFullYear(), 11, 31);
  } else {
    // personalizado
    const s = document.getElementById('dash-data-inicio').value;
    const e = document.getElementById('dash-data-fim').value;
    start = s ? isoToDate(s) : new Date(today.getFullYear(), today.getMonth(), 1);
    end   = e ? isoToDate(e) : new Date(today.getFullYear(), today.getMonth() + 1, 0);
  }

  return {
    start: toISO(start),
    end:   toISO(end)
  };
}

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// ═══════════════════════════════════════════
//  SALDO CALCULATION
// ═══════════════════════════════════════════

// Sort lancamentos by data ASC, then criadoEm ASC
function sortLancs(lancs) {
  return [...lancs].sort((a, b) => {
    if (a.data !== b.data) return a.data < b.data ? -1 : 1;
    return a.criadoEm < b.criadoEm ? -1 : 1;
  });
}

// Returns sorted lancs with a `saldo` field appended
function calcSaldos(lancs) {
  const sorted = sortLancs(lancs);
  let acc = 0;
  return sorted.map(l => {
    acc += l.valor;
    return { ...l, saldo: acc };
  });
}

// Get lancs for selected BU filter (buId or 'all')
function getLancsForBU(buId) {
  const all = loadLancs();
  if (buId === 'all') return all;
  return all.filter(l => l.buId === buId);
}

// Carry-forward: sum of ALL realized entries with data < periodStart, for given buId filter
function getCarryForward(buId, periodStart) {
  const lancs = getLancsForBU(buId).filter(l => l.status === 'realizado' && l.data < periodStart);
  return lancs.reduce((s, l) => s + l.valor, 0);
}

// ═══════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════

function showToast(msg, type = 'default', duration = 3500) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toast-out .25s ease forwards';
    setTimeout(() => toast.remove(), 260);
  }, duration);
}

// ═══════════════════════════════════════════
//  CHART INSTANCES
// ═══════════════════════════════════════════

let chartSaldo   = null;
let chartBarras  = null;
let chartDonut   = null;

function destroyCharts() {
  if (chartSaldo)  { chartSaldo.destroy();  chartSaldo = null; }
  if (chartBarras) { chartBarras.destroy(); chartBarras = null; }
  if (chartDonut)  { chartDonut.destroy();  chartDonut = null; }
}

// ═══════════════════════════════════════════
//  DASHBOARD RENDER
// ═══════════════════════════════════════════

function renderDashboard() {
  const buId   = document.getElementById('dash-bu-select').value;
  const period = getPeriodDates();
  const { start, end } = period;

  const allLancs     = getLancsForBU(buId);
  const sortedAll    = calcSaldos(allLancs);

  // Entries in period
  const inPeriod     = sortedAll.filter(l => l.data >= start && l.data <= end);
  const inPeriodReal = inPeriod.filter(l => l.status === 'realizado');

  // KPI 1: Saldo Atual = last saldo of ALL realized entries (entire history, not just period)
  const allRealized  = calcSaldos(allLancs.filter(l => l.status === 'realizado'));
  const saldoAtual   = allRealized.length ? allRealized[allRealized.length - 1].saldo : 0;

  // KPI 2 & 3: entradas/saidas in period (realizado + projetado)
  let totalEntradas = 0, totalSaidas = 0;
  inPeriod.forEach(l => {
    if (l.valor > 0) totalEntradas += l.valor;
    else totalSaidas += Math.abs(l.valor);
  });

  // KPI 4: Saldo Projetado = carry-forward + all period entries
  const carryFwd     = getCarryForward(buId, start);
  const saldoProj    = carryFwd + inPeriod.reduce((s, l) => s + l.valor, 0);

  // Update KPI DOM
  const elSaldo = document.getElementById('kpi-saldo-atual');
  elSaldo.textContent = fmtCurrency(saldoAtual);
  elSaldo.className = 'kpi-value ' + (saldoAtual >= 0 ? 'positive' : 'negative');

  document.getElementById('kpi-entradas').textContent  = fmtCurrency(totalEntradas);
  document.getElementById('kpi-saidas').textContent    = fmtCurrency(totalSaidas);

  const elProj = document.getElementById('kpi-projetado');
  elProj.textContent = fmtCurrency(saldoProj);
  elProj.className   = 'kpi-value ' + (saldoProj >= 0 ? 'positive' : 'negative');

  // ─── Build charts ───
  destroyCharts();
  renderChartSaldo(buId, start, end, carryFwd);
  renderChartBarras(inPeriod);
  renderChartDonut(totalEntradas, totalSaidas);

  // ─── Recentes table (last 10 in period, date DESC) ───
  const recentes = [...inPeriod].sort((a, b) => {
    if (a.data !== b.data) return a.data > b.data ? -1 : 1;
    return a.criadoEm > b.criadoEm ? -1 : 1;
  }).slice(0, 10);

  const tbody = document.getElementById('dash-recentes-body');
  const empty = document.getElementById('dash-recentes-empty');
  const tbl   = document.getElementById('dash-recentes-table');

  if (!recentes.length) {
    tbody.innerHTML = '';
    tbl.style.display = 'none';
    empty.style.display = 'flex';
  } else {
    tbl.style.display = 'table';
    empty.style.display = 'none';
    tbody.innerHTML = recentes.map(l => `
      <tr>
        <td>${fmtDate(l.data)}</td>
        <td>${escHtml(l.descricao)}</td>
        <td class="${l.valor >= 0 ? 'val-entrada' : 'val-saida'}">${fmtCurrency(l.valor)}</td>
        <td><span class="badge badge-${l.status}">${l.status === 'realizado' ? 'Realizado' : 'Projetado'}</span></td>
        <td class="${l.saldo >= 0 ? 'saldo-pos' : 'saldo-neg'}">${fmtCurrency(l.saldo)}</td>
      </tr>
    `).join('');
  }
}

// ─── Chart 1: Saldo Acumulado line chart ───
function renderChartSaldo(buId, start, end, carryFwd) {
  const canvas = document.getElementById('chart-saldo');
  const empty  = document.getElementById('chart-saldo-empty');

  const allLancs   = getLancsForBU(buId);
  const inPeriod   = sortLancs(allLancs.filter(l => l.data >= start && l.data <= end));

  if (!inPeriod.length) {
    canvas.style.display = 'none';
    empty.style.display  = 'flex';
    return;
  }
  canvas.style.display = '';
  empty.style.display  = 'none';

  // Build timeline of unique dates in period
  const dateSet = new Set(inPeriod.map(l => l.data));
  const dates   = Array.from(dateSet).sort();

  // Realized dataset: carry-forward + cumulative realized entries per date
  // Projected dataset: from last realized saldo + projected entries
  let realMap = {};   // date → saldo after all realized on that date
  let projMap = {};   // date → saldo after all (real+proj) on that date
  let accReal = carryFwd;
  let accProj = carryFwd;

  // We need day-by-day cumulative saldos
  // For each date in period, sum all entries on that date
  for (const d of dates) {
    const dayEntries = inPeriod.filter(l => l.data === d);
    dayEntries.forEach(l => {
      if (l.status === 'realizado') accReal += l.valor;
      accProj += l.valor;
    });
    realMap[d] = accReal;
    projMap[d] = accProj;
  }

  const labels       = dates.map(fmtDate);
  const realDataset  = dates.map(d => realMap[d]);
  const projDataset  = dates.map(d => projMap[d]);

  // Determine where realized ends (today)
  const todayISO_ = todayISO();
  const realData  = dates.map(d => d <= todayISO_ ? realMap[d] : null);
  const projData  = dates.map((d, i) => {
    // Projected line: starts from last known realized saldo point
    if (d > todayISO_) return projMap[d];
    // Before or on today: null (so lines don't overlap) — unless there are no realized after
    return null;
  });

  // Find the pivot index: last date <= today
  let pivotIdx = -1;
  dates.forEach((d, i) => { if (d <= todayISO_) pivotIdx = i; });

  // Projected line starts at the pivot value so it connects
  const projDataFull = dates.map((d, i) => {
    if (i === pivotIdx) return realDataset[i]; // connect at pivot
    if (d > todayISO_) return projMap[d];
    return null;
  });

  const ctx = canvas.getContext('2d');
  chartSaldo = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Realizado',
          data: realData,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37,99,235,.08)',
          borderWidth: 2.5,
          pointRadius: 3,
          pointBackgroundColor: '#2563eb',
          tension: .35,
          fill: true,
          spanGaps: false,
        },
        {
          label: 'Projetado',
          data: projDataFull,
          borderColor: 'rgba(37,99,235,.5)',
          backgroundColor: 'rgba(37,99,235,.03)',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 2,
          pointBackgroundColor: 'rgba(37,99,235,.5)',
          tension: .35,
          fill: false,
          spanGaps: false,
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 20 } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${fmtCurrency(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, maxTicksLimit: 12 } },
        y: {
          grid: { color: '#f1f5f9' },
          ticks: {
            font: { size: 10 },
            callback: v => fmtCurrency(v)
          }
        }
      }
    }
  });
}

// ─── Chart 2: Bar (Entradas vs Saídas por Mês) ───
function renderChartBarras(inPeriod) {
  const canvas = document.getElementById('chart-barras');
  const empty  = document.getElementById('chart-barras-empty');

  if (!inPeriod.length) {
    canvas.style.display = 'none';
    empty.style.display  = 'flex';
    return;
  }
  canvas.style.display = '';
  empty.style.display  = 'none';

  // Group by YYYY-MM
  const monthMap = {};
  inPeriod.forEach(l => {
    const mo = l.data.slice(0, 7);
    if (!monthMap[mo]) monthMap[mo] = { entradas: 0, saidas: 0 };
    if (l.valor > 0) monthMap[mo].entradas += l.valor;
    else monthMap[mo].saidas += Math.abs(l.valor);
  });

  const months  = Object.keys(monthMap).sort();
  const labels  = months.map(m => {
    const [y, mo] = m.split('-');
    return `${mo}/${y}`;
  });
  const entradas = months.map(m => monthMap[m].entradas);
  const saidas   = months.map(m => monthMap[m].saidas);

  const ctx = canvas.getContext('2d');
  chartBarras = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Entradas',
          data: entradas,
          backgroundColor: 'rgba(22,163,74,.75)',
          borderColor: '#16a34a',
          borderWidth: 1.5,
          borderRadius: 4,
        },
        {
          label: 'Saídas',
          data: saidas,
          backgroundColor: 'rgba(220,38,38,.75)',
          borderColor: '#dc2626',
          borderWidth: 1.5,
          borderRadius: 4,
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 16 } },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtCurrency(ctx.parsed.y)}` }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, callback: v => fmtCurrency(v) } }
      }
    }
  });
}

// ─── Chart 3: Doughnut ───
function renderChartDonut(totalEntradas, totalSaidas) {
  const canvas = document.getElementById('chart-donut');
  const empty  = document.getElementById('chart-donut-empty');

  if (totalEntradas === 0 && totalSaidas === 0) {
    canvas.style.display = 'none';
    empty.style.display  = 'flex';
    return;
  }
  canvas.style.display = '';
  empty.style.display  = 'none';

  const ctx = canvas.getContext('2d');
  chartDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Entradas', 'Saídas'],
      datasets: [{
        data: [totalEntradas, totalSaidas],
        backgroundColor: ['rgba(22,163,74,.8)', 'rgba(220,38,38,.8)'],
        borderColor: ['#16a34a', '#dc2626'],
        borderWidth: 2,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 14 } },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.label}: ${fmtCurrency(ctx.parsed)}` }
        }
      }
    }
  });
}

// ═══════════════════════════════════════════
//  LANÇAMENTOS TAB RENDER
// ═══════════════════════════════════════════

function renderLancamentos() {
  const search  = document.getElementById('lanc-search').value.trim().toLowerCase();
  const buId    = document.getElementById('lanc-bu-select').value;
  const status  = document.getElementById('lanc-status-select').value;
  const mesVal  = document.getElementById('lanc-mes-select').value; // YYYY-MM or ''

  const bus    = loadBUs();
  const buMap  = Object.fromEntries(bus.map(b => [b.id, b.nome]));

  // All lancs for selected BU, with saldo calculated over ALL entries (not just filtered)
  const baseLancs    = getLancsForBU(buId === 'all' ? 'all' : buId);
  const withSaldos   = calcSaldos(baseLancs); // sorted by date+criadoEm

  // Apply filters for display
  let filtered = withSaldos.filter(l => {
    if (status && l.status !== status) return false;
    if (mesVal  && !l.data.startsWith(mesVal)) return false;
    if (search) {
      const inDesc = (l.descricao   || '').toLowerCase().includes(search);
      const inObs  = (l.observacao  || '').toLowerCase().includes(search);
      if (!inDesc && !inObs) return false;
    }
    return true;
  });

  const tbody = document.getElementById('lanc-table-body');
  const empty = document.getElementById('lanc-empty');
  const tbl   = document.getElementById('lanc-table');

  document.getElementById('lanc-count').textContent =
    `${filtered.length} lançamento${filtered.length !== 1 ? 's' : ''}`;

  if (!filtered.length) {
    tbody.innerHTML = '';
    tbl.style.display = 'none';
    empty.style.display = 'flex';
    return;
  }
  tbl.style.display = 'table';
  empty.style.display = 'none';

  tbody.innerHTML = filtered.map(l => `
    <tr>
      <td>${fmtDate(l.data)}</td>
      <td>${escHtml(buMap[l.buId] || l.buId)}</td>
      <td>${escHtml(l.descricao)}</td>
      <td class="td-obs" title="${escAttr(l.observacao || '')}">${escHtml(l.observacao || '—')}</td>
      <td class="${l.valor >= 0 ? 'val-entrada' : 'val-saida'}">${fmtCurrency(l.valor)}</td>
      <td class="${l.saldo >= 0 ? 'saldo-pos' : 'saldo-neg'}">${fmtCurrency(l.saldo)}</td>
      <td><span class="badge badge-${l.status}">${l.status === 'realizado' ? 'Realizado' : 'Projetado'}</span></td>
      <td>
        <div class="td-actions">
          <button class="btn-icon btn-icon-edit" title="Editar" onclick="openEditModal('${l.id}')">✏️</button>
          <button class="btn-icon btn-icon-del"  title="Excluir" onclick="deleteLancamento('${l.id}')">✕</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ═══════════════════════════════════════════
//  CONFIGURAÇÕES TAB RENDER
// ═══════════════════════════════════════════

function renderConfiguracoes() {
  const bus = loadBUs();
  const list = document.getElementById('bu-list');

  if (!bus.length) {
    list.innerHTML = '<div class="empty-state"><span class="empty-icon">🏢</span><p>Nenhuma BU cadastrada</p></div>';
    return;
  }

  list.innerHTML = bus.map(b => `
    <div class="bu-item" id="bu-item-${b.id}">
      <span class="bu-name">${escHtml(b.nome)}</span>
      <span class="badge ${b.ativa ? 'badge-ativo' : 'badge-inativo'}">${b.ativa ? 'Ativa' : 'Inativa'}</span>
      <div class="bu-actions">
        <button class="btn-icon btn-icon-edit" title="Editar" onclick="editBU('${b.id}')">✏️</button>
        <button class="btn btn-outline btn-sm" onclick="toggleBU('${b.id}')">${b.ativa ? 'Desativar' : 'Ativar'}</button>
        <button class="btn-icon btn-icon-del"  title="Excluir" onclick="deleteBU('${b.id}')">✕</button>
      </div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════
//  BU OPERATIONS
// ═══════════════════════════════════════════

function editBU(id) {
  const bus = loadBUs();
  const bu  = bus.find(b => b.id === id);
  if (!bu) return;
  document.getElementById('bu-form-id').value   = id;
  document.getElementById('bu-form-nome').value = bu.nome;
  const form = document.getElementById('bu-form');
  form.style.display = 'flex';
  document.getElementById('bu-form-nome').focus();
}

function toggleBU(id) {
  const bus = loadBUs();
  const idx = bus.findIndex(b => b.id === id);
  if (idx === -1) return;
  bus[idx].ativa = !bus[idx].ativa;
  saveBUs(bus);
  renderConfiguracoes();
  populateAllBUSelects();
}

function deleteBU(id) {
  const lancs = loadLancs().filter(l => l.buId === id);
  if (lancs.length) {
    if (!confirm(`Esta BU possui ${lancs.length} lançamento(s). Excluir mesmo assim?\n(Os lançamentos também serão excluídos)`)) return;
    saveLancs(loadLancs().filter(l => l.buId !== id));
  } else {
    if (!confirm('Deseja excluir esta BU?')) return;
  }
  saveBUs(loadBUs().filter(b => b.id !== id));
  renderConfiguracoes();
  populateAllBUSelects();
  refreshActiveTab();
}

// ═══════════════════════════════════════════
//  LANCAMENTO MODAL
// ═══════════════════════════════════════════

function openNewModal() {
  const bus = loadBUs().filter(b => b.ativa);
  if (!bus.length) {
    showToast('Cadastre pelo menos uma BU ativa antes de criar lançamentos.', 'warning');
    switchTab('configuracoes');
    return;
  }
  document.getElementById('modal-title').textContent = 'Novo Lançamento';
  document.getElementById('form-id').value        = '';
  document.getElementById('form-bu').value        = '';
  document.getElementById('form-data').value      = todayISO();
  document.getElementById('form-descricao').value = '';
  document.getElementById('form-observacao').value= '';
  document.getElementById('form-valor').value     = '';
  document.getElementById('form-status').value    = 'realizado';
  document.getElementById('form-error').style.display = 'none';
  document.getElementById('modal-overlay').style.display = 'flex';
  setTimeout(() => document.getElementById('form-bu').focus(), 50);
}

function openEditModal(id) {
  const lancs = loadLancs();
  const l = lancs.find(x => x.id === id);
  if (!l) return;
  document.getElementById('modal-title').textContent  = 'Editar Lançamento';
  document.getElementById('form-id').value            = l.id;
  document.getElementById('form-bu').value            = l.buId;
  document.getElementById('form-data').value          = l.data;
  document.getElementById('form-descricao').value     = l.descricao;
  document.getElementById('form-observacao').value    = l.observacao || '';
  document.getElementById('form-valor').value         = l.valor;
  document.getElementById('form-status').value        = l.status;
  document.getElementById('form-error').style.display = 'none';
  document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

function saveModal() {
  const id          = document.getElementById('form-id').value.trim();
  const buId        = document.getElementById('form-bu').value.trim();
  const data        = document.getElementById('form-data').value.trim();
  const descricao   = document.getElementById('form-descricao').value.trim();
  const observacao  = document.getElementById('form-observacao').value.trim();
  const valorRaw    = document.getElementById('form-valor').value.trim();
  const status      = document.getElementById('form-status').value;
  const errEl       = document.getElementById('form-error');

  errEl.style.display = 'none';

  if (!buId)       { showFormError('Selecione uma BU.'); return; }
  if (!data)       { showFormError('Informe a data.'); return; }
  if (!descricao)  { showFormError('Informe a descrição.'); return; }
  if (valorRaw === '') { showFormError('Informe o valor.'); return; }

  const valor = parseFloat(valorRaw);
  if (isNaN(valor)) { showFormError('Valor inválido.'); return; }

  const lancs = loadLancs();

  if (id) {
    // Edit
    const idx = lancs.findIndex(l => l.id === id);
    if (idx === -1) { showFormError('Lançamento não encontrado.'); return; }
    lancs[idx] = { ...lancs[idx], buId, data, descricao, observacao, valor, status };
    saveLancs(lancs);
    showToast('Lançamento atualizado.', 'success');
  } else {
    // New
    lancs.push({ id: genId(), buId, data, descricao, observacao, valor, status, criadoEm: new Date().toISOString() });
    saveLancs(lancs);
    showToast('Lançamento criado.', 'success');
  }

  closeModal();
  refreshActiveTab();
}

function showFormError(msg) {
  const el = document.getElementById('form-error');
  el.textContent = msg;
  el.style.display = 'block';
}

// ═══════════════════════════════════════════
//  DELETE LANCAMENTO
// ═══════════════════════════════════════════

function deleteLancamento(id) {
  if (!confirm('Deseja excluir este lançamento?')) return;
  saveLancs(loadLancs().filter(l => l.id !== id));
  showToast('Lançamento excluído.', 'default');
  refreshActiveTab();
}

// ═══════════════════════════════════════════
//  POPULATE BU SELECTS
// ═══════════════════════════════════════════

function populateAllBUSelects() {
  const bus = loadBUs();
  const active = bus.filter(b => b.ativa);

  // Modal BU select
  const formBu = document.getElementById('form-bu');
  const prevFormBu = formBu.value;
  formBu.innerHTML = '<option value="">Selecione a BU...</option>' +
    active.map(b => `<option value="${b.id}">${escHtml(b.nome)}</option>`).join('');
  if (prevFormBu) formBu.value = prevFormBu;

  // Dashboard BU
  const dashBu = document.getElementById('dash-bu-select');
  const prevDash = dashBu.value || 'all';
  dashBu.innerHTML = '<option value="all">Todas as BUs</option>' +
    active.map(b => `<option value="${b.id}">${escHtml(b.nome)}</option>`).join('');
  dashBu.value = prevDash;

  // Lançamentos BU
  const lancBu = document.getElementById('lanc-bu-select');
  const prevLanc = lancBu.value || 'all';
  lancBu.innerHTML = '<option value="all">Todas as BUs</option>' +
    bus.map(b => `<option value="${b.id}">${escHtml(b.nome)}</option>`).join('');
  lancBu.value = prevLanc;
}

// ═══════════════════════════════════════════
//  EXPORT CSV
// ═══════════════════════════════════════════

function exportCSV() {
  const search  = document.getElementById('lanc-search').value.trim().toLowerCase();
  const buId    = document.getElementById('lanc-bu-select').value;
  const status  = document.getElementById('lanc-status-select').value;
  const mesVal  = document.getElementById('lanc-mes-select').value;

  const bus    = loadBUs();
  const buMap  = Object.fromEntries(bus.map(b => [b.id, b.nome]));

  const baseLancs  = getLancsForBU(buId === 'all' ? 'all' : buId);
  const withSaldos = calcSaldos(baseLancs);

  let filtered = withSaldos.filter(l => {
    if (status && l.status !== status) return false;
    if (mesVal  && !l.data.startsWith(mesVal)) return false;
    if (search) {
      const inDesc = (l.descricao  || '').toLowerCase().includes(search);
      const inObs  = (l.observacao || '').toLowerCase().includes(search);
      if (!inDesc && !inObs) return false;
    }
    return true;
  });

  const bom = '\uFEFF';
  const header = 'Data;BU;Descricao;Observacao;Valor;Status;SaldoAcumulado\n';
  const rows = filtered.map(l =>
    [
      fmtDate(l.data),
      `"${(buMap[l.buId] || l.buId).replace(/"/g, '""')}"`,
      `"${(l.descricao  || '').replace(/"/g, '""')}"`,
      `"${(l.observacao || '').replace(/"/g, '""')}"`,
      String(l.valor).replace('.', ','),
      l.status,
      String(l.saldo).replace('.', ',')
    ].join(';')
  ).join('\n');

  const blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `fluxo-caixa-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════
//  EXPORTAR PDF
// ═══════════════════════════════════════════

function exportPDF() {
  const { jsPDF } = window.jspdf;

  const search  = document.getElementById('lanc-search').value.trim().toLowerCase();
  const buId    = document.getElementById('lanc-bu-select').value;
  const status  = document.getElementById('lanc-status-select').value;
  const mesVal  = document.getElementById('lanc-mes-select').value;

  const bus    = loadBUs();
  const buMap  = Object.fromEntries(bus.map(b => [b.id, b.nome]));

  const baseLancs  = getLancsForBU(buId === 'all' ? 'all' : buId);
  const withSaldos = calcSaldos(baseLancs);

  let filtered = withSaldos.filter(l => {
    if (status && l.status !== status) return false;
    if (mesVal  && !l.data.startsWith(mesVal)) return false;
    if (search) {
      const inDesc = (l.descricao  || '').toLowerCase().includes(search);
      const inObs  = (l.observacao || '').toLowerCase().includes(search);
      if (!inDesc && !inObs) return false;
    }
    return true;
  });

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W   = doc.internal.pageSize.getWidth();   // 297
  const H   = doc.internal.pageSize.getHeight();  // 210

  const NAVY   = [15,  32,  68];
  const BLUE   = [37,  99,  235];
  const GREEN  = [22,  163, 74];
  const RED    = [220, 38,  38];
  const AMBER  = [217, 119, 6];
  const MUTED  = [100, 116, 139];
  const LIGHT  = [248, 250, 252];
  const WHITE  = [255, 255, 255];
  const BORDER = [226, 232, 240];

  // ── Filtro descritivo ──────────────────────────────────────
  const buLabel     = buId === 'all' ? 'Todas as BUs' : (buMap[buId] || buId);
  const statusLabel = status === 'realizado' ? 'Realizado' : status === 'projetado' ? 'Projetado' : 'Todos';
  const mesLabel    = mesVal ? (() => {
    const [y, m] = mesVal.split('-');
    return `${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][+m-1]}/${y}`;
  })() : 'Todos os meses';
  const geradoEm = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  // ── Totais de rodapé ───────────────────────────────────────
  const totalEntradas = filtered.filter(l => l.valor > 0).reduce((s, l) => s + l.valor, 0);
  const totalSaidas   = filtered.filter(l => l.valor < 0).reduce((s, l) => s + l.valor, 0);
  const saldoFinal    = filtered.length ? filtered[filtered.length - 1].saldo : 0;

  // ════════════════════════════
  //  PÁGINA 1 — CAPA
  // ════════════════════════════
  // Faixa navy (1/3 esquerdo)
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 90, H, 'F');

  // Diagonal azul
  doc.setFillColor(...BLUE);
  doc.triangle(55, 0, 80, 0, 55, H, 'F');

  // Título (área branca)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...NAVY);
  doc.text('Fluxo de Caixa', 100, 82);

  doc.setFontSize(30);
  doc.setTextColor(...BLUE);
  doc.text('JMP Finance', 100, 100);

  // Subtítulo filtros
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.text(`BU: ${buLabel}  ·  Status: ${statusLabel}  ·  Período: ${mesLabel}`, 100, 115);

  // Rodapé capa
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('www.ascensus.com.br', W - 15, H - 8, { align: 'right' });
  doc.text(`Gerado em ${geradoEm}`, 100, H - 8);

  // ════════════════════════════
  //  PÁGINA 2 — SUMÁRIO
  // ════════════════════════════
  doc.addPage();

  // Cabeçalho da página
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...WHITE);
  doc.text('Fluxo de Caixa — Resumo do Período', W / 2, 11, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(`${buLabel}  ·  ${statusLabel}  ·  ${mesLabel}`, W / 2, 24, { align: 'center' });

  // Cards de resumo
  const cardY   = 30;
  const cardH   = 22;
  const cardW   = 60;
  const gap     = 8;
  const startX  = (W - (3 * cardW + 2 * gap)) / 2;

  const cards = [
    { label: 'Total Entradas', value: fmtCurrency(totalEntradas), color: GREEN },
    { label: 'Total Saídas',   value: fmtCurrency(totalSaidas),   color: RED },
    { label: 'Saldo Final',    value: fmtCurrency(saldoFinal),    color: saldoFinal >= 0 ? GREEN : RED },
  ];

  cards.forEach((card, i) => {
    const x = startX + i * (cardW + gap);
    // borda esquerda colorida
    doc.setFillColor(...card.color);
    doc.rect(x, cardY, 2, cardH, 'F');
    // fundo branco com borda
    doc.setFillColor(...WHITE);
    doc.rect(x + 2, cardY, cardW - 2, cardH, 'F');
    doc.setDrawColor(...BORDER);
    doc.rect(x + 2, cardY, cardW - 2, cardH, 'S');
    // label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(card.label.toUpperCase(), x + 6, cardY + 7);
    // valor
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...card.color);
    doc.text(card.value, x + 6, cardY + 17);
  });

  // Linha separadora
  const sepY = cardY + cardH + 8;
  doc.setDrawColor(...BORDER);
  doc.line(10, sepY, W - 10, sepY);

  // Quantidade de lançamentos
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`${filtered.length} lançamento(s) no período`, 10, sepY + 6);

  // ════════════════════════════
  //  PÁGINAS SEGUINTES — TABELA
  // ════════════════════════════
  doc.addPage();

  // Cabeçalho repetido nas páginas de tabela (via didDrawPage hook)
  const tableHead = [['Data', 'BU', 'Descrição', 'Observação', 'Valor (R$)', 'Saldo Acum. (R$)', 'Status']];
  const tableBody = filtered.map(l => [
    fmtDate(l.data),
    buMap[l.buId] || '—',
    l.descricao   || '—',
    l.observacao  || '—',
    { content: fmtCurrency(l.valor), styles: { textColor: l.valor >= 0 ? GREEN : RED, fontStyle: 'bold' } },
    { content: fmtCurrency(l.saldo), styles: { textColor: l.saldo >= 0 ? GREEN : RED, fontStyle: 'bold' } },
    { content: l.status === 'realizado' ? 'Realizado' : 'Projetado',
      styles: { textColor: l.status === 'realizado' ? GREEN : AMBER, fontStyle: 'bold' } },
  ]);

  doc.autoTable({
    head:      tableHead,
    body:      tableBody,
    startY:    22,
    margin:    { left: 10, right: 10, top: 22 },
    styles:    { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: {
      fillColor:  NAVY,
      textColor:  WHITE,
      fontStyle:  'bold',
      fontSize:   8,
      halign:     'left',
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 28 },
      2: { cellWidth: 60 },
      3: { cellWidth: 45 },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' },
      6: { cellWidth: 22, halign: 'center' },
    },
    alternateRowStyles: { fillColor: LIGHT },
    didDrawPage: (data) => {
      // Cabeçalho de cada página
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, W, 16, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...WHITE);
      doc.text('Fluxo de Caixa — Lançamentos', 14, 10);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(180, 200, 230);
      doc.text(`${buLabel}  ·  ${statusLabel}  ·  ${mesLabel}`, W - 14, 10, { align: 'right' });

      // Rodapé de cada página
      const pageCount = doc.internal.getNumberOfPages();
      const curPage   = data.pageNumber;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(`Página ${curPage} de ${pageCount}`, W - 14, H - 5, { align: 'right' });
      doc.text(`Gerado em ${geradoEm}  ·  www.ascensus.com.br`, 14, H - 5);
    },

    // Linha de totais no final da tabela
    foot: [[
      '', '', '', 'TOTAL',
      { content: fmtCurrency(totalEntradas + totalSaidas), styles: { textColor: (totalEntradas + totalSaidas) >= 0 ? GREEN : RED, fontStyle: 'bold' } },
      { content: fmtCurrency(saldoFinal), styles: { textColor: saldoFinal >= 0 ? GREEN : RED, fontStyle: 'bold' } },
      '',
    ]],
    footStyles: {
      fillColor:  BORDER,
      textColor:  NAVY,
      fontStyle:  'bold',
      fontSize:   8,
    },
    showFoot: 'lastPage',
  });

  // Salva
  const nomeArq = `FluxoCaixa_${buLabel.replace(/\s+/g,'_')}_${mesVal || 'total'}_${todayISO()}.pdf`;
  doc.save(nomeArq);
}

// ═══════════════════════════════════════════
//  EXCEL IMPORT (SheetJS)
// ═══════════════════════════════════════════

function handleExcelImport(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb   = XLSX.read(data, { type: 'array', cellDates: false });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!rows.length) { showToast('Planilha vazia ou formato inválido.', 'error'); return; }

      // Normalize headers (case-insensitive, trim)
      const normalizeKey = k => k.toString().trim().toUpperCase();
      const normalizedRows = rows.map(row => {
        const nRow = {};
        Object.keys(row).forEach(k => { nRow[normalizeKey(k)] = row[k]; });
        return nRow;
      });

      let bus     = loadBUs();
      let lancs   = loadLancs();
      let imported = 0, skipped = 0;

      for (const row of normalizedRows) {
        // Parse DATA
        const rawData = row['DATA'];
        const dateISO = parseExcelDate(rawData);
        if (!dateISO) { skipped++; continue; }

        // Parse VALOR
        const rawValor = row['VALOR'];
        let valor;
        if (typeof rawValor === 'number') {
          valor = rawValor;
        } else {
          const cleaned = String(rawValor).replace(/\s/g, '').replace(',', '.');
          valor = parseFloat(cleaned);
        }
        if (isNaN(valor)) { skipped++; continue; }

        // DESCRICAO
        const descricao = String(row['DESCRICAO'] || '').trim();

        // OBSERVACAO
        const observacao = String(row['OBSERVACAO'] || '').trim();

        // STATUS
        const rawStatus = String(row['STATUS'] || '').trim().toLowerCase();
        let status = 'realizado';
        if (rawStatus.startsWith('proj')) status = 'projetado';
        else if (rawStatus.startsWith('real')) status = 'realizado';
        else if (rawStatus === '') status = 'realizado';

        // BU
        const rawBU  = String(row['BU'] || '').trim();
        let buId;
        if (rawBU) {
          const matchedBU = bus.find(b => b.nome.toLowerCase() === rawBU.toLowerCase());
          if (matchedBU) {
            buId = matchedBU.id;
          } else {
            // Create new BU
            const newBU = { id: genId(), nome: rawBU, ativa: true };
            bus.push(newBU);
            buId = newBU.id;
          }
        } else {
          // Use first active BU or skip
          const firstActive = bus.find(b => b.ativa);
          if (!firstActive) { skipped++; continue; }
          buId = firstActive.id;
        }

        lancs.push({ id: genId(), buId, data: dateISO, descricao, observacao, valor, status, criadoEm: new Date().toISOString() });
        imported++;
      }

      saveBUs(bus);
      saveLancs(lancs);
      populateAllBUSelects();
      refreshActiveTab();

      const msg = skipped
        ? `${imported} lançamentos importados. ${skipped} linha(s) ignorada(s) por dados inválidos.`
        : `${imported} lançamentos importados com sucesso.`;
      showToast(msg, imported ? 'success' : 'warning', 5000);

    } catch (err) {
      console.error('Import error:', err);
      showToast('Erro ao processar o arquivo. Verifique o formato.', 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

// ═══════════════════════════════════════════
//  JSON EXPORT / IMPORT
// ═══════════════════════════════════════════

function exportJSON() {
  const payload = { bus: loadBUs(), lancamentos: loadLancs(), exportadoEm: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `fc-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.bus) || !Array.isArray(data.lancamentos)) {
        showToast('Formato de JSON inválido.', 'error');
        return;
      }
      if (!confirm(`Importar ${data.bus.length} BUs e ${data.lancamentos.length} lançamentos?\nIsso SUBSTITUIRÁ todos os dados atuais.`)) return;
      saveBUs(data.bus);
      saveLancs(data.lancamentos);
      populateAllBUSelects();
      refreshActiveTab();
      renderConfiguracoes();
      showToast(`Dados importados: ${data.bus.length} BUs, ${data.lancamentos.length} lançamentos.`, 'success');
    } catch {
      showToast('Erro ao ler o arquivo JSON.', 'error');
    }
  };
  reader.readAsText(file);
}

// ═══════════════════════════════════════════
//  TAB SWITCHING
// ═══════════════════════════════════════════

let activeTab = 'dashboard';

function switchTab(tabName) {
  activeTab = tabName;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
    btn.setAttribute('aria-selected', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.toggle('active', el.id === `tab-${tabName}`);
  });

  if (tabName === 'dashboard')      renderDashboard();
  if (tabName === 'lancamentos')    renderLancamentos();
  if (tabName === 'configuracoes')  renderConfiguracoes();
}

function refreshActiveTab() {
  if (activeTab === 'dashboard')     renderDashboard();
  if (activeTab === 'lancamentos')   renderLancamentos();
  if (activeTab === 'configuracoes') renderConfiguracoes();
}

// ═══════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return escHtml(str);
}

// ═══════════════════════════════════════════
//  SEED DATA (for demo)
// ═══════════════════════════════════════════

function seedDemoData() {
  if (loadBUs().length) return; // Already has data

  const bu1 = { id: genId(), nome: 'TechOps',    ativa: true };
  const bu2 = { id: genId(), nome: 'Marketing',  ativa: true };
  const bu3 = { id: genId(), nome: 'Financeiro', ativa: true };
  saveBUs([bu1, bu2, bu3]);

  const today = new Date();
  const fmt = d => toISO(d);
  const ago = (days) => { const d = new Date(today); d.setDate(d.getDate() - days); return fmt(d); };
  const fwd = (days) => { const d = new Date(today); d.setDate(d.getDate() + days); return fmt(d); };

  const lancs = [
    // Histórico realizado
    { id: genId(), buId: bu1.id, data: ago(60), descricao: 'Contrato mensal cliente A', observacao: 'Renovação anual', valor: 45000,  status: 'realizado', criadoEm: new Date().toISOString() },
    { id: genId(), buId: bu2.id, data: ago(55), descricao: 'Campanha Google Ads',       observacao: '',                valor: -8500,  status: 'realizado', criadoEm: new Date().toISOString() },
    { id: genId(), buId: bu1.id, data: ago(50), descricao: 'Pagamento fornecedor infra', observacao: 'AWS / Azure',   valor: -12000, status: 'realizado', criadoEm: new Date().toISOString() },
    { id: genId(), buId: bu3.id, data: ago(45), descricao: 'Aporte de capital',          observacao: '',               valor: 100000, status: 'realizado', criadoEm: new Date().toISOString() },
    { id: genId(), buId: bu1.id, data: ago(40), descricao: 'Licença de software',        observacao: 'Anual',          valor: -6000,  status: 'realizado', criadoEm: new Date().toISOString() },
    { id: genId(), buId: bu2.id, data: ago(35), descricao: 'Receita de parceria',        observacao: '',               valor: 22000,  status: 'realizado', criadoEm: new Date().toISOString() },
    { id: genId(), buId: bu3.id, data: ago(30), descricao: 'Folha de pagamento',         observacao: 'Mês anterior',   valor: -38000, status: 'realizado', criadoEm: new Date().toISOString() },
    { id: genId(), buId: bu1.id, data: ago(25), descricao: 'Contrato cliente B',         observacao: '',               valor: 30000,  status: 'realizado', criadoEm: new Date().toISOString() },
    { id: genId(), buId: bu2.id, data: ago(20), descricao: 'Patrocínio evento',          observacao: 'Conferência TI', valor: -5000,  status: 'realizado', criadoEm: new Date().toISOString() },
    { id: genId(), buId: bu3.id, data: ago(15), descricao: 'Rendimento aplicação',       observacao: '',               valor: 4800,   status: 'realizado', criadoEm: new Date().toISOString() },
    { id: genId(), buId: bu1.id, data: ago(10), descricao: 'Suporte técnico cliente C',  observacao: '',               valor: 18000,  status: 'realizado', criadoEm: new Date().toISOString() },
    { id: genId(), buId: bu3.id, data: ago(5),  descricao: 'Folha de pagamento corrente',observacao: '',               valor: -42000, status: 'realizado', criadoEm: new Date().toISOString() },
    { id: genId(), buId: bu2.id, data: ago(3),  descricao: 'Receita e-commerce',         observacao: '',               valor: 9500,   status: 'realizado', criadoEm: new Date().toISOString() },
    // Futuro projetado
    { id: genId(), buId: bu1.id, data: fwd(5),  descricao: 'Contrato cliente D',         observacao: 'Renovação',      valor: 55000,  status: 'projetado', criadoEm: new Date().toISOString() },
    { id: genId(), buId: bu3.id, data: fwd(10), descricao: 'Pagamento de impostos',      observacao: 'IRPJ/CSLL',      valor: -15000, status: 'projetado', criadoEm: new Date().toISOString() },
    { id: genId(), buId: bu2.id, data: fwd(15), descricao: 'Investimento marketing Q2',  observacao: '',               valor: -20000, status: 'projetado', criadoEm: new Date().toISOString() },
    { id: genId(), buId: bu1.id, data: fwd(20), descricao: 'Recebimento projeto X',      observacao: 'Fase 2',         valor: 75000,  status: 'projetado', criadoEm: new Date().toISOString() },
    { id: genId(), buId: bu3.id, data: fwd(30), descricao: 'Folha projetada',            observacao: '',               valor: -44000, status: 'projetado', criadoEm: new Date().toISOString() },
    { id: genId(), buId: bu1.id, data: fwd(45), descricao: 'Contrato cliente E',         observacao: 'Novo contrato',  valor: 40000,  status: 'projetado', criadoEm: new Date().toISOString() },
    { id: genId(), buId: bu2.id, data: fwd(50), descricao: 'Campanha Ads Q2',            observacao: '',               valor: -10000, status: 'projetado', criadoEm: new Date().toISOString() },
  ];
  saveLancs(lancs);
}

// ═══════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

  // Seed demo data if empty
  seedDemoData();

  populateAllBUSelects();

  // ── Tab nav ──
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // ── Novo Lançamento ──
  document.getElementById('btn-novo-lancamento').addEventListener('click', openNewModal);

  // ── Modal ──
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
  document.getElementById('modal-save-btn').addEventListener('click', saveModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  // Allow Enter key in form (except textarea)
  document.getElementById('lancamento-form').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      saveModal();
    }
  });

  // ── Dashboard filters ──
  document.getElementById('dash-periodo-select').addEventListener('change', function() {
    const isCustom = this.value === 'personalizado';
    document.getElementById('dash-custom-range').style.display     = isCustom ? 'flex' : 'none';
    document.getElementById('dash-custom-range-end').style.display = isCustom ? 'flex' : 'none';
  });

  document.getElementById('dash-aplicar-btn').addEventListener('click', renderDashboard);
  document.getElementById('dash-bu-select').addEventListener('change', renderDashboard);

  // ── Lançamentos filters ──
  document.getElementById('lanc-search').addEventListener('input',          renderLancamentos);
  document.getElementById('lanc-bu-select').addEventListener('change',      renderLancamentos);
  document.getElementById('lanc-status-select').addEventListener('change',  renderLancamentos);
  document.getElementById('lanc-mes-select').addEventListener('change',     renderLancamentos);
  document.getElementById('lanc-export-btn').addEventListener('click',      exportCSV);
  document.getElementById('lanc-export-pdf-btn').addEventListener('click',  exportPDF);

  // ── Excel import ──
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file-input').value = '';
    document.getElementById('import-file-input').click();
  });
  document.getElementById('import-area').addEventListener('click', e => {
    if (e.target === document.getElementById('import-btn')) return; // handled above
  });
  document.getElementById('import-file-input').addEventListener('change', e => {
    handleExcelImport(e.target.files[0]);
  });

  // ── Configurações BU ──
  document.getElementById('config-nova-bu-btn').addEventListener('click', () => {
    document.getElementById('bu-form-id').value   = '';
    document.getElementById('bu-form-nome').value = '';
    const form = document.getElementById('bu-form');
    form.style.display = form.style.display === 'none' ? 'flex' : 'none';
    if (form.style.display === 'flex') document.getElementById('bu-form-nome').focus();
  });

  document.getElementById('bu-form-save').addEventListener('click', () => {
    const id   = document.getElementById('bu-form-id').value.trim();
    const nome = document.getElementById('bu-form-nome').value.trim();
    if (!nome) { showToast('Informe o nome da BU.', 'warning'); return; }

    const bus = loadBUs();
    if (id) {
      const idx = bus.findIndex(b => b.id === id);
      if (idx !== -1) bus[idx].nome = nome;
    } else {
      bus.push({ id: genId(), nome, ativa: true });
    }
    saveBUs(bus);
    document.getElementById('bu-form').style.display = 'none';
    document.getElementById('bu-form-nome').value = '';
    document.getElementById('bu-form-id').value   = '';
    renderConfiguracoes();
    populateAllBUSelects();
    showToast(id ? 'BU atualizada.' : 'BU criada.', 'success');
  });

  document.getElementById('bu-form-cancel').addEventListener('click', () => {
    document.getElementById('bu-form').style.display = 'none';
  });

  // ── Config data ──
  document.getElementById('config-export-json').addEventListener('click', exportJSON);

  document.getElementById('config-import-json-input').addEventListener('change', e => {
    importJSON(e.target.files[0]);
  });

  document.getElementById('config-clear-data').addEventListener('click', () => {
    if (!confirm('⚠️ Atenção! Isso excluirá TODOS os dados (BUs e lançamentos). Esta ação não pode ser desfeita.\n\nDeseja continuar?')) return;
    localStorage.removeItem(KEYS.BUS);
    localStorage.removeItem(KEYS.LANC);
    populateAllBUSelects();
    renderConfiguracoes();
    refreshActiveTab();
    showToast('Todos os dados foram removidos.', 'warning');
  });

  // ── Keyboard shortcut ──
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // ── Initial render ──
  renderDashboard();
});
