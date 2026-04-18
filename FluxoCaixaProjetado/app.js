/* ============================================================
   FLUXO DE CAIXA PROJETADO — app.js
   Modelo de lançamentos individuais por data
   ============================================================ */

'use strict';

/* ============================================================
   CONSTANTS & DEFAULT DATA
   ============================================================ */
const MONTHS_PT   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const QUARTERS    = ['Q1 (Jan–Mar)','Q2 (Abr–Jun)','Q3 (Jul–Set)','Q4 (Out–Dez)'];

const KEY_CONFIG      = 'fcp_config_v1';
const KEY_LINHAS      = 'fcp_linhas_v1';
const KEY_TRANSACOES  = 'fcp_transacoes_v2';
const KEY_STATUS      = 'fcp_status_mes_v1';
const KEY_SALDO_INIC  = 'fcp_saldo_inicial_v1';

const DEFAULT_LINHAS = [
  { id: 'saldo_inicial',    secao: 'sistema',        tipo: 'especial', nome: 'Saldo Inicial',                            ordem: 0,  sistema: true,  ativo: true },
  { id: 'hdr_op',           secao: 'operacional',    tipo: 'header',   nome: 'Atividades Operacionais',                  ordem: 10, sistema: true,  ativo: true },
  { id: 'rec_clientes',     secao: 'operacional',    tipo: 'entrada',  nome: 'Recebimento de clientes',                  ordem: 11, sistema: false, ativo: true },
  { id: 'outros_rec',       secao: 'operacional',    tipo: 'entrada',  nome: 'Outros recebimentos',                      ordem: 12, sistema: false, ativo: true },
  { id: 'desp_estrutura',   secao: 'operacional',    tipo: 'saida',    nome: 'Despesas com Estrutura',                   ordem: 13, sistema: false, ativo: true },
  { id: 'desp_endo',        secao: 'operacional',    tipo: 'saida',    nome: 'Despesas com Endomarketing',               ordem: 14, sistema: false, ativo: true },
  { id: 'desp_veiculos',    secao: 'operacional',    tipo: 'saida',    nome: 'Despesas com Veículos e Viagens',          ordem: 15, sistema: false, ativo: true },
  { id: 'desp_pessoal',     secao: 'operacional',    tipo: 'saida',    nome: 'Despesas com Pessoal e Benefícios',        ordem: 16, sistema: false, ativo: true },
  { id: 'desp_preposto',    secao: 'operacional',    tipo: 'saida',    nome: 'Despesas com Preposto',                    ordem: 17, sistema: false, ativo: true },
  { id: 'impostos',         secao: 'operacional',    tipo: 'saida',    nome: 'Impostos e Tributos',                      ordem: 18, sistema: false, ativo: true },
  { id: 'sub_op',           secao: 'operacional',    tipo: 'subtotal', nome: 'Fluxo de Caixa Operacional',               ordem: 19, sistema: true,  ativo: true },
  { id: 'hdr_inv',          secao: 'investimentos',  tipo: 'header',   nome: 'Atividades de Investimentos',              ordem: 20, sistema: true,  ativo: true },
  { id: 'venda_ativos',     secao: 'investimentos',  tipo: 'entrada',  nome: 'Venda de ativos',                          ordem: 21, sistema: false, ativo: true },
  { id: 'subvencoes',       secao: 'investimentos',  tipo: 'entrada',  nome: 'Subvenções',                               ordem: 22, sistema: false, ativo: true },
  { id: 'inv_pd',           secao: 'investimentos',  tipo: 'saida',    nome: 'Investimentos em P&D',                     ordem: 23, sistema: false, ativo: true },
  { id: 'aquisicoes',       secao: 'investimentos',  tipo: 'saida',    nome: 'Aquisições de ativos',                     ordem: 24, sistema: false, ativo: true },
  { id: 'sub_inv',          secao: 'investimentos',  tipo: 'subtotal', nome: 'Fluxo de Caixa de Investimentos',          ordem: 25, sistema: true,  ativo: true },
  { id: 'hdr_fin',          secao: 'financeiro',     tipo: 'header',   nome: 'Atividades Financeiras',                   ordem: 30, sistema: true,  ativo: true },
  { id: 'captacao',         secao: 'financeiro',     tipo: 'entrada',  nome: 'Captação de empréstimos',                  ordem: 31, sistema: false, ativo: true },
  { id: 'rec_financeiras',  secao: 'financeiro',     tipo: 'entrada',  nome: 'Receitas financeiras',                     ordem: 32, sistema: false, ativo: true },
  { id: 'reemb_emp',        secao: 'financeiro',     tipo: 'entrada',  nome: 'Reembolso empréstimos',                    ordem: 33, sistema: false, ativo: true },
  { id: 'pgto_emp',         secao: 'financeiro',     tipo: 'saida',    nome: 'Pagamento de empréstimos/financiamentos',  ordem: 34, sistema: false, ativo: true },
  { id: 'desp_bancarias',   secao: 'financeiro',     tipo: 'saida',    nome: 'Despesas bancárias e financeiras',         ordem: 35, sistema: false, ativo: true },
  { id: 'sub_fin',          secao: 'financeiro',     tipo: 'subtotal', nome: 'Fluxo de Caixa Financeiro',                ordem: 36, sistema: true,  ativo: true },
  { id: 'hdr_dra',          secao: 'dra',            tipo: 'header',   nome: 'Distribuição de Resultados e Aportes',     ordem: 40, sistema: true,  ativo: true },
  { id: 'aporte_socios',    secao: 'dra',            tipo: 'entrada',  nome: 'Aporte de sócios',                         ordem: 41, sistema: false, ativo: true },
  { id: 'distrib_lucros',   secao: 'dra',            tipo: 'saida',    nome: 'Distribuição de lucros aos sócios',        ordem: 42, sistema: false, ativo: true },
  { id: 'compra_cotas',     secao: 'dra',            tipo: 'saida',    nome: 'Compra Cotas',                             ordem: 43, sistema: false, ativo: true },
  { id: 'pprs',             secao: 'dra',            tipo: 'saida',    nome: 'PPRs',                                     ordem: 44, sistema: false, ativo: true },
  { id: 'sub_dra',          secao: 'dra',            tipo: 'subtotal', nome: 'Fluxo de Caixa DRAs',                      ordem: 45, sistema: true,  ativo: true },
  { id: 'geracao',          secao: 'resultado',      tipo: 'especial', nome: 'Geração de Caixa do Mês',                  ordem: 50, sistema: true,  ativo: true },
  { id: 'situacao',         secao: 'resultado',      tipo: 'especial', nome: 'Situação do Caixa (Final do Mês)',          ordem: 51, sistema: true,  ativo: true },
];

const DEFAULT_CONFIG = { anoRef: 2026, empresa: 'Unique', nomeRelatorio: 'Fluxo de Caixa Projetado' };

/* ============================================================
   STORAGE LAYER
   ============================================================ */
const store = {
  getConfig()   { return JSON.parse(localStorage.getItem(KEY_CONFIG) || 'null') || {...DEFAULT_CONFIG}; },
  setConfig(v)  { localStorage.setItem(KEY_CONFIG, JSON.stringify(v)); },

  getLinhas()   { return JSON.parse(localStorage.getItem(KEY_LINHAS) || 'null') || null; },
  setLinhas(v)  { localStorage.setItem(KEY_LINHAS, JSON.stringify(v)); },

  getTransacoes()  { return JSON.parse(localStorage.getItem(KEY_TRANSACOES) || '[]'); },
  setTransacoes(v) { localStorage.setItem(KEY_TRANSACOES, JSON.stringify(v)); },

  addTransacao(tx) {
    const all = this.getTransacoes();
    all.push({ ...tx, id: uid() });
    this.setTransacoes(all);
  },

  updateTransacao(id, tx) {
    const all = this.getTransacoes();
    const idx = all.findIndex(t => t.id === id);
    if (idx >= 0) all[idx] = { ...all[idx], ...tx };
    this.setTransacoes(all);
  },

  deleteTransacao(id) {
    this.setTransacoes(this.getTransacoes().filter(t => t.id !== id));
  },

  /* Saldo Inicial de abertura do ano */
  getSaldoInicial(ano) {
    const map = JSON.parse(localStorage.getItem(KEY_SALDO_INIC) || '{}');
    return map[String(ano)] || 0;
  },
  setSaldoInicial(ano, v) {
    const map = JSON.parse(localStorage.getItem(KEY_SALDO_INIC) || '{}');
    map[String(ano)] = v;
    localStorage.setItem(KEY_SALDO_INIC, JSON.stringify(map));
  },

  getMesStatus(ano, mes) {
    const all = JSON.parse(localStorage.getItem(KEY_STATUS) || '[]');
    const rec = all.find(s => s.ano === ano && s.mes === mes);
    return rec ? rec.status : 'projetado';
  },
  setMesStatus(ano, mes, status) {
    const all = JSON.parse(localStorage.getItem(KEY_STATUS) || '[]');
    const idx = all.findIndex(s => s.ano === ano && s.mes === mes);
    if (idx >= 0) all[idx].status = status; else all.push({ ano, mes, status });
    localStorage.setItem(KEY_STATUS, JSON.stringify(all));
  },
  getStatus() { return JSON.parse(localStorage.getItem(KEY_STATUS) || '[]'); },
  setStatus(v) { localStorage.setItem(KEY_STATUS, JSON.stringify(v)); },

  clearAll() {
    [KEY_CONFIG, KEY_LINHAS, KEY_TRANSACOES, KEY_STATUS, KEY_SALDO_INIC].forEach(k => localStorage.removeItem(k));
  }
};

/* ============================================================
   UTILITY
   ============================================================ */
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function formatFC(v) {
  if (v === 0 || v == null) return '-';
  const fmt = Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  return v > 0 ? fmt : '(' + fmt + ')';
}

function formatBRL(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function isoToYMD(iso) {
  if (!iso) return null;
  const p = iso.split('-').map(Number);
  return { y: p[0], m: p[1], d: p[2] };
}

function valClass(v) {
  if (v === 0) return 'val-zero';
  return v > 0 ? 'val-pos' : 'val-neg';
}

function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (type ? ' ' + type : '');
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, 2800);
}

function getLinhas() {
  let ls = store.getLinhas();
  if (!ls) { ls = DEFAULT_LINHAS.map(l => ({...l})); store.setLinhas(ls); }
  return ls.filter(l => l.ativo !== false).sort((a, b) => a.ordem - b.ordem);
}

function getEditableLinhas() {
  return getLinhas().filter(l => l.tipo === 'entrada' || l.tipo === 'saida');
}

function getAvailableYears() {
  const cfg = store.getConfig();
  const years = new Set([cfg.anoRef]);
  store.getTransacoes().forEach(t => {
    if (t.data) years.add(Number(t.data.split('-')[0]));
  });
  store.getStatus().forEach(s => years.add(s.ano));
  return Array.from(years).sort();
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* Days in a month */
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/* ============================================================
   COMPUTATION ENGINE
   ============================================================ */
function computeMonth(ano, mes) {
  const linhas = getLinhas();
  const result = {};

  linhas.forEach(l => {
    if (l.tipo === 'entrada' || l.tipo === 'saida') result[l.id] = 0;
  });

  store.getTransacoes().forEach(t => {
    if (!t.data) return;
    const ymd = isoToYMD(t.data);
    if (!ymd || ymd.y !== ano || ymd.m !== mes) return;
    const linha = linhas.find(l => l.id === t.linhaId);
    if (!linha || (linha.tipo !== 'entrada' && linha.tipo !== 'saida')) return;
    const contribution = linha.tipo === 'saida' ? -Math.abs(t.valor) : Math.abs(t.valor);
    result[t.linhaId] = (result[t.linhaId] || 0) + contribution;
  });

  const sectionMap = { operacional: 'sub_op', investimentos: 'sub_inv', financeiro: 'sub_fin', dra: 'sub_dra' };
  Object.entries(sectionMap).forEach(([secao, subId]) => {
    result[subId] = linhas
      .filter(l => l.secao === secao && (l.tipo === 'entrada' || l.tipo === 'saida'))
      .reduce((acc, l) => acc + (result[l.id] || 0), 0);
  });

  result['geracao'] = (result['sub_op'] || 0) + (result['sub_inv'] || 0)
                    + (result['sub_fin'] || 0) + (result['sub_dra'] || 0);

  if (mes === 1) {
    result['saldo_inicial'] = store.getSaldoInicial(ano);
  } else {
    result['saldo_inicial'] = computeMonth(ano, mes - 1)['situacao'] || 0;
  }

  result['situacao'] = (result['saldo_inicial'] || 0) + (result['geracao'] || 0);
  return result;
}

function computeAno(ano) {
  const linhas = getLinhas();
  const allIds = [...linhas.map(l => l.id), 'sub_op', 'sub_inv', 'sub_fin', 'sub_dra', 'geracao', 'saldo_inicial', 'situacao'];
  const result = {};
  allIds.forEach(id => { result[id] = 0; });

  for (let m = 1; m <= 12; m++) {
    const mo = computeMonth(ano, m);
    allIds.forEach(id => {
      if (id === 'saldo_inicial' || id === 'situacao') return;
      result[id] = (result[id] || 0) + (mo[id] || 0);
    });
  }

  result['saldo_inicial'] = computeMonth(ano, 1)['saldo_inicial'] || 0;
  result['situacao']      = computeMonth(ano, 12)['situacao'] || 0;
  return result;
}

/* ============================================================
   STATE
   ============================================================ */
const state = {
  currentTab: 'dashboard',
  dashAno: null,
  dashView: 'mensal',
  dashDiarioMes: new Date().getMonth() + 1,
  lancAno: null,
  lancMes: new Date().getMonth() + 1,
  txEditId: null,
};

/* ============================================================
   INIT
   ============================================================ */
function init() {
  if (!store.getLinhas()) store.setLinhas(DEFAULT_LINHAS.map(l => ({...l})));

  const cfg = store.getConfig();
  state.dashAno = cfg.anoRef;
  state.lancAno = cfg.anoRef;

  updateHeaderText();
  setupTabs();
  setupFilterBar();
  setupDashboardEvents();
  setupLancamentos();
  setupTxModal();
  setupEstrutura();
  setupConfiguracoes();
  setupExportPDF();

  renderDashboard();
  renderLancamentos();
  renderEstrutura();
  loadConfiguracoes();
}

/* ============================================================
   HEADER
   ============================================================ */
function updateHeaderText() {
  const cfg = store.getConfig();
  document.getElementById('hdr-relatorio').textContent = cfg.nomeRelatorio || 'Fluxo de Caixa Projetado';
  document.getElementById('hdr-empresa').textContent   = cfg.empresa || '';
}

/* ============================================================
   TABS
   ============================================================ */
function setupTabs() {
  document.getElementById('tab-nav').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    switchTab(btn.dataset.tab);
  });
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tab));
  state.currentTab = tab;
  if (tab === 'dashboard')    renderDashboard();
  if (tab === 'lancamentos')  renderLancamentos();
  if (tab === 'estrutura')    renderEstrutura();
  if (tab === 'configuracoes') loadConfiguracoes();
}

/* ============================================================
   FILTER BAR (Dashboard)
   ============================================================ */
function setupFilterBar() {
  const anoSel = document.getElementById('filter-ano');
  populateYearSelect(anoSel, state.dashAno);
  anoSel.addEventListener('change', () => { state.dashAno = parseInt(anoSel.value); renderDashboard(); });

  document.getElementById('btn-view-mensal').addEventListener('click', () => {
    setDashView('mensal');
  });
  document.getElementById('btn-view-trimestral').addEventListener('click', () => {
    setDashView('trimestral');
  });
  document.getElementById('btn-view-diario').addEventListener('click', () => {
    setDashView('diario');
  });

  const mesSel = document.getElementById('filter-mes-diario');
  mesSel.innerHTML = MONTHS_FULL.map((m, i) =>
    `<option value="${i+1}"${i+1 === state.dashDiarioMes ? ' selected' : ''}>${m}</option>`
  ).join('');
  mesSel.addEventListener('change', () => { state.dashDiarioMes = parseInt(mesSel.value); renderDashboard(); });
}

function setDashView(view) {
  state.dashView = view;
  document.getElementById('btn-view-mensal').classList.toggle('active', view === 'mensal');
  document.getElementById('btn-view-trimestral').classList.toggle('active', view === 'trimestral');
  document.getElementById('btn-view-diario').classList.toggle('active', view === 'diario');
  document.getElementById('filter-group-mes-diario').style.display = view === 'diario' ? 'flex' : 'none';
  renderDashboard();
}

function populateYearSelect(sel, currentVal) {
  const years = getAvailableYears();
  sel.innerHTML = years.map(y => `<option value="${y}"${y === currentVal ? ' selected' : ''}>${y}</option>`).join('');
}

/* ============================================================
   DASHBOARD EVENTS (Saldo Inicial popover)
   ============================================================ */
function setupDashboardEvents() {
  document.getElementById('ep-cancel').addEventListener('click', closePopover);
  document.getElementById('ep-save').addEventListener('click', savePopover);
  document.getElementById('ep-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') savePopover();
    if (e.key === 'Escape') closePopover();
  });
  document.addEventListener('click', e => {
    const popover = document.getElementById('edit-popover');
    if (popover.style.display !== 'none' &&
        !popover.contains(e.target) &&
        !e.target.classList.contains('cell-editable')) {
      closePopover();
    }
  });
}

/* ============================================================
   RENDER DASHBOARD
   ============================================================ */
function renderDashboard() {
  const ano  = state.dashAno;
  const view = state.dashView;

  populateYearSelect(document.getElementById('filter-ano'), ano);

  const diarioWrapper = document.getElementById('daily-wrapper');
  const dfcWrapper    = document.getElementById('dfc-wrapper');

  if (view === 'diario') {
    dfcWrapper.style.display    = 'none';
    diarioWrapper.style.display = 'block';
    renderKPIs(ano);
    renderDailyView(ano, state.dashDiarioMes);
    // Sync month select
    document.getElementById('filter-mes-diario').value = state.dashDiarioMes;
    return;
  }

  dfcWrapper.style.display    = 'block';
  diarioWrapper.style.display = 'none';
  renderKPIs(ano);
  renderDFCTable(ano, view);
}

function renderKPIs(ano) {
  const m12 = computeMonth(ano, 12);
  const anoData = computeAno(ano);

  // Entradas totais = soma de todas as entradas do ano
  const linhas = getLinhas();
  let totalEntradas = 0, totalSaidas = 0;
  for (let m = 1; m <= 12; m++) {
    const mo = computeMonth(ano, m);
    linhas.filter(l => l.tipo === 'entrada').forEach(l => { totalEntradas += (mo[l.id] || 0); });
    linhas.filter(l => l.tipo === 'saida').forEach(l => { totalSaidas += Math.abs(mo[l.id] || 0); });
  }

  document.getElementById('kpi-situacao').textContent = formatBRL(m12['situacao'] || 0);
  document.getElementById('kpi-situacao').className = `kpi-value ${(m12['situacao'] || 0) >= 0 ? 'kpi-green' : 'kpi-red'}`;

  document.getElementById('kpi-entradas').textContent = formatBRL(totalEntradas);
  document.getElementById('kpi-saidas').textContent   = formatBRL(totalSaidas);
  document.getElementById('kpi-geracao').textContent  = formatBRL(anoData['geracao'] || 0);
  document.getElementById('kpi-geracao').className = `kpi-value ${(anoData['geracao'] || 0) >= 0 ? 'kpi-green' : 'kpi-red'}`;
}

/* ── DFC TABLE ─────────────────────────────────────────────── */
function renderDFCTable(ano, view) {
  const linhas = getLinhas();
  const table  = document.getElementById('dfc-table');
  table.innerHTML = '';

  // Build column periods
  let periods = [];
  if (view === 'mensal') {
    periods = Array.from({length: 12}, (_, i) => ({ label: MONTHS_PT[i], mes: i + 1 }));
  } else {
    periods = [0,1,2,3].map(q => ({ label: QUARTERS[q], quarter: q }));
  }

  // THEAD
  const thead = document.createElement('thead');
  const trH = document.createElement('tr');
  trH.innerHTML = `<th class="col-nome">Linha</th><th class="col-ano">ANO</th>` +
    periods.map(p => `<th class="col-val">${p.label}</th>`).join('');
  thead.appendChild(trH);
  table.appendChild(thead);

  // STATUS ROW
  if (view === 'mensal') {
    const trS = document.createElement('tr');
    trS.className = 'row-status';
    trS.innerHTML = `<td class="col-nome">Status</td><td></td>` +
      periods.map(p => {
        const st = store.getMesStatus(ano, p.mes);
        return `<td><span class="status-chip ${st}" data-ano="${ano}" data-mes="${p.mes}">${st === 'realizado' ? '● R' : '◎ P'}</span></td>`;
      }).join('');
    const tbody0 = document.createElement('tbody');
    tbody0.appendChild(trS);
    table.appendChild(tbody0);

    tbody0.querySelectorAll('.status-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const a = parseInt(chip.dataset.ano), m = parseInt(chip.dataset.mes);
        const cur = store.getMesStatus(a, m);
        store.setMesStatus(a, m, cur === 'realizado' ? 'projetado' : 'realizado');
        renderDashboard();
        if (state.currentTab === 'lancamentos') renderLancamentos();
      });
    });
  }

  // DATA
  const anoData = computeAno(ano);
  const getVal = (linhaId, period) => {
    if (view === 'mensal') return computeMonth(ano, period.mes)[linhaId] || 0;
    const q = period.quarter;
    return [q*3+1, q*3+2, q*3+3].reduce((s, m) => s + (computeMonth(ano, m)[linhaId] || 0), 0);
  };

  const tbody = document.createElement('tbody');

  // Saldo inicial row (editable for ano)
  const trSI = document.createElement('tr');
  trSI.className = 'row-saldo-inicial';
  let siCells = `<td class="col-nome">Saldo Inicial de Abertura</td>`;
  siCells += `<td class="col-ano cell-editable" data-edit-saldo="${ano}">${formatFC(store.getSaldoInicial(ano))}</td>`;
  siCells += periods.map((p, i) => {
    const isFirst = view === 'mensal' ? p.mes === 1 : p.quarter === 0;
    if (isFirst) {
      const v = view === 'mensal' ? computeMonth(ano, 1)['saldo_inicial'] : computeMonth(ano, 1)['saldo_inicial'];
      return `<td class="col-val cell-editable" data-edit-saldo="${ano}">${formatFC(v)}</td>`;
    }
    const v = view === 'mensal'
      ? computeMonth(ano, p.mes)['saldo_inicial']
      : computeMonth(ano, p.quarter * 3 + 1)['saldo_inicial'];
    return `<td class="col-val ${valClass(v)}">${formatFC(v)}</td>`;
  }).join('');
  trSI.innerHTML = siCells;
  tbody.appendChild(trSI);

  // Saldo inicial editable click
  trSI.querySelectorAll('[data-edit-saldo]').forEach(td => {
    td.addEventListener('click', e => {
      e.stopPropagation();
      openSaldoInicialPopover(td, ano);
    });
  });

  linhas.forEach(l => {
    if (l.tipo === 'especial' && l.id !== 'geracao' && l.id !== 'situacao') return;
    if (l.tipo === 'especial' && l.id === 'saldo_inicial') return;

    const tr = document.createElement('tr');
    tr.className = getRowClass(l);

    const anoV = anoData[l.id] || 0;
    let html = `<td class="col-nome">${getPrefix(l)}${escHtml(l.nome)}</td>`;
    html += `<td class="col-ano ${valClass(anoV)}">${formatFC(anoV)}</td>`;
    html += periods.map(p => {
      const v = getVal(l.id, p);
      const editable = (l.tipo === 'entrada' || l.tipo === 'saida');
      const cls = `col-val ${valClass(v)}${editable ? ' cell-clickable' : ''}`;
      return `<td class="${cls}">${formatFC(v)}</td>`;
    }).join('');

    tr.innerHTML = html;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
}

function getRowClass(linha) {
  if (linha.tipo === 'header')   return 'row-header';
  if (linha.tipo === 'subtotal') return 'row-subtotal';
  if (linha.tipo === 'entrada')  return 'row-entrada';
  if (linha.tipo === 'saida')    return 'row-saida';
  if (linha.id === 'geracao')    return 'row-geracao';
  if (linha.id === 'situacao')   return 'row-situacao';
  return '';
}

function getPrefix(linha) {
  if (linha.tipo === 'entrada')  return '<span class="pfx pfx-e">(+) </span>';
  if (linha.tipo === 'saida')    return '<span class="pfx pfx-s">(-) </span>';
  if (linha.tipo === 'subtotal') return '<span class="pfx pfx-t">(=) </span>';
  return '';
}

/* ── POPOVER: Saldo Inicial ─────────────────────────────────── */
let _popoverAno = null;

function openSaldoInicialPopover(td, ano) {
  _popoverAno = ano;
  const cur = store.getSaldoInicial(ano);
  document.getElementById('ep-title').textContent = `Saldo Inicial de Abertura — ${ano}`;
  const inp = document.getElementById('ep-input');
  inp.value = cur !== 0 ? cur : '';

  const rect = td.getBoundingClientRect();
  const pop  = document.getElementById('edit-popover');
  pop.style.display = 'block';
  let top  = rect.bottom + window.scrollY + 4;
  let left = rect.left + window.scrollX;
  const popW = 240;
  if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
  pop.style.top = top + 'px';
  pop.style.left = left + 'px';
  setTimeout(() => inp.focus(), 50);
}

function closePopover() {
  document.getElementById('edit-popover').style.display = 'none';
  _popoverAno = null;
}

function savePopover() {
  if (_popoverAno === null) return;
  const raw = document.getElementById('ep-input').value.trim();
  const val = raw === '' ? 0 : parseFloat(raw);
  if (isNaN(val)) { showToast('Valor inválido', 'error'); return; }
  store.setSaldoInicial(_popoverAno, val);
  closePopover();
  renderDashboard();
  showToast('Saldo inicial salvo!', 'success');
}

/* ============================================================
   DAILY VIEW
   ============================================================ */
function renderDailyView(ano, mes) {
  const wrapper = document.getElementById('daily-wrapper');
  const linhas  = getLinhas();

  // Get transactions for this month, sorted by date
  const txs = store.getTransacoes()
    .filter(t => { const ymd = isoToYMD(t.data); return ymd && ymd.y === ano && ymd.m === mes; })
    .sort((a, b) => a.data.localeCompare(b.data));

  const saldoInicial = computeMonth(ano, mes)['saldo_inicial'] || 0;
  let saldoAcum = saldoInicial;

  if (txs.length === 0) {
    wrapper.innerHTML = `
      <div class="daily-empty">
        <span style="font-size:2rem;">📋</span>
        <p>Nenhum lançamento em ${MONTHS_FULL[mes-1]} ${ano}</p>
        <p style="font-size:.8rem;color:#64748b;">Vá à aba Lançamentos para adicionar transações.</p>
      </div>`;
    return;
  }

  let rows = '';
  txs.forEach(t => {
    const linha = linhas.find(l => l.id === t.linhaId);
    if (!linha) return;
    const contrib = linha.tipo === 'saida' ? -Math.abs(t.valor) : Math.abs(t.valor);
    saldoAcum += contrib;
    const tipoCls  = linha.tipo === 'entrada' ? 'entrada' : 'saida';
    const statusCls = t.status === 'realizado' ? 'realizado' : 'projetado';
    const saldoCls  = saldoAcum >= 0 ? 'val-pos' : 'val-neg';
    rows += `<tr>
      <td class="dd-col-data">${formatDate(t.data)}</td>
      <td><span class="tipo-badge ${tipoCls}">${tipoCls === 'entrada' ? '+' : '−'} ${escHtml(linha.nome)}</span></td>
      <td class="dd-col-desc">${escHtml(t.descricao || '—')}</td>
      <td class="dd-col-val ${contrib >= 0 ? 'val-pos' : 'val-neg'}">${formatFC(contrib)}</td>
      <td><span class="status-chip ${statusCls}">${t.status === 'realizado' ? '● R' : '◎ P'}</span></td>
      <td class="dd-col-val ${saldoCls}">${formatBRL(saldoAcum)}</td>
    </tr>`;
  });

  wrapper.innerHTML = `
    <div class="daily-header">
      <span class="daily-title">${MONTHS_FULL[mes-1]} ${ano}</span>
      <span class="daily-sub">Saldo inicial do mês: <strong>${formatBRL(saldoInicial)}</strong> · ${txs.length} lançamento(s)</span>
    </div>
    <div class="table-wrapper">
      <table class="dfc-table daily-table">
        <thead>
          <tr>
            <th class="dd-col-data">Data</th>
            <th>Classificação</th>
            <th class="dd-col-desc">Descrição</th>
            <th class="dd-col-val">Valor</th>
            <th>Status</th>
            <th class="dd-col-val">Saldo Acumulado</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* ============================================================
   LANÇAMENTOS TAB
   ============================================================ */
function setupLancamentos() {
  document.getElementById('month-grid').addEventListener('click', e => {
    const cell = e.target.closest('.month-cell');
    if (!cell) return;
    state.lancMes = parseInt(cell.dataset.mes);
    document.querySelectorAll('.month-cell').forEach(c =>
      c.classList.toggle('selected', parseInt(c.dataset.mes) === state.lancMes));
    renderLancamentosMes();
  });

  document.getElementById('lanc-ano-sel').addEventListener('change', e => {
    state.lancAno = parseInt(e.target.value);
    renderLancamentos();
  });

  document.getElementById('btn-toggle-status').addEventListener('click', () => {
    const cur = store.getMesStatus(state.lancAno, state.lancMes);
    store.setMesStatus(state.lancAno, state.lancMes, cur === 'realizado' ? 'projetado' : 'realizado');
    renderLancamentos();
    if (state.currentTab === 'dashboard') renderDashboard();
  });

  document.getElementById('btn-copiar-anterior').addEventListener('click', copiarMesAnterior);

  document.getElementById('btn-novo-lancamento').addEventListener('click', () => {
    openTxModal(null);
  });
}

function renderLancamentos() {
  const anoSel = document.getElementById('lanc-ano-sel');
  populateYearSelect(anoSel, state.lancAno);

  const grid = document.getElementById('month-grid');
  grid.innerHTML = MONTHS_PT.map((m, i) => {
    const mes = i + 1;
    const st  = store.getMesStatus(state.lancAno, mes);
    const count = store.getTransacoes().filter(t => {
      const ymd = isoToYMD(t.data);
      return ymd && ymd.y === state.lancAno && ymd.m === mes;
    }).length;
    return `<div class="month-cell${mes === state.lancMes ? ' selected' : ''}" data-mes="${mes}">
      ${m}
      <span class="status-dot ${st}">${st === 'realizado' ? 'R' : 'P'}</span>
      ${count > 0 ? `<span class="month-count">${count}</span>` : ''}
    </div>`;
  }).join('');

  renderLancamentosMes();
}

function renderLancamentosMes() {
  const ano = state.lancAno;
  const mes = state.lancMes;
  const linhas = getLinhas();
  const status   = store.getMesStatus(ano, mes);
  const computed = computeMonth(ano, mes);

  // Title
  document.getElementById('lanc-mes-title').textContent = `${MONTHS_FULL[mes - 1]} ${ano}`;
  const stEl = document.getElementById('lanc-mes-status');
  stEl.textContent = status === 'realizado' ? '● Realizado' : '◎ Projetado';
  stEl.className = 'lanc-mes-status ' + status;

  document.getElementById('btn-toggle-status').textContent =
    status === 'realizado' ? 'Marcar como Projetado' : 'Marcar como Realizado';

  // Get transactions for this month
  const txs = store.getTransacoes()
    .filter(t => { const ymd = isoToYMD(t.data); return ymd && ymd.y === ano && ymd.m === mes; })
    .sort((a, b) => a.data.localeCompare(b.data) || (a.descricao || '').localeCompare(b.descricao || ''));

  // Render transaction list
  const listEl = document.getElementById('lanc-list');
  if (txs.length === 0) {
    listEl.innerHTML = `<div class="lanc-list-empty">
      <span style="font-size:2rem;">📋</span>
      <p>Nenhum lançamento neste mês</p>
      <p style="font-size:.78rem;color:#94a3b8;">Clique em "+ Novo Lançamento" para adicionar</p>
    </div>`;
  } else {
    listEl.innerHTML = txs.map(t => {
      const linha = linhas.find(l => l.id === t.linhaId);
      if (!linha) return '';
      const tipoCls = linha.tipo === 'entrada' ? 'entrada' : 'saida';
      const contrib = linha.tipo === 'saida' ? -Math.abs(t.valor) : Math.abs(t.valor);
      return `<div class="tx-row" data-tx-id="${t.id}">
        <div class="tx-date">${formatDate(t.data)}</div>
        <div class="tx-class">
          <span class="tipo-badge ${tipoCls}">${tipoCls === 'entrada' ? '+' : '−'} ${escHtml(linha.nome)}</span>
        </div>
        <div class="tx-desc">${escHtml(t.descricao || '—')}</div>
        <div class="tx-valor ${contrib >= 0 ? 'val-pos' : 'val-neg'}">${formatFC(contrib)}</div>
        <div class="tx-status"><span class="status-chip ${t.status}">${t.status === 'realizado' ? '● Real.' : '◎ Proj.'}</span></div>
        <div class="tx-actions">
          <button class="btn-icon tx-edit" data-id="${t.id}" title="Editar">✏</button>
          <button class="btn-icon btn-delete tx-del" data-id="${t.id}" title="Excluir">✕</button>
        </div>
      </div>`;
    }).join('');

    // Events
    listEl.querySelectorAll('.tx-edit').forEach(btn => {
      btn.addEventListener('click', () => openTxModal(btn.dataset.id));
    });
    listEl.querySelectorAll('.tx-del').forEach(btn => {
      btn.addEventListener('click', () => {
        openConfirm('Excluir lançamento?', 'Esta ação não pode ser desfeita.', () => {
          store.deleteTransacao(btn.dataset.id);
          renderLancamentos();
          renderDashboard();
          showToast('Lançamento excluído.', 'success');
        });
      });
    });
  }

  renderLancSummary(computed);
}

function renderLancSummary(computed) {
  const items = [
    { label: 'Saldo Inicial',        id: 'saldo_inicial' },
    { label: 'Fluxo Operacional',    id: 'sub_op'  },
    { label: 'Fluxo Investimentos',  id: 'sub_inv' },
    { label: 'Fluxo Financeiro',     id: 'sub_fin' },
    { label: 'Fluxo DRA',            id: 'sub_dra' },
    { label: 'Geração de Caixa',     id: 'geracao' },
    { label: 'Situação (Final)',      id: 'situacao' },
  ];
  document.getElementById('lanc-summary').innerHTML = items.map(item => {
    const v   = computed[item.id] || 0;
    const cls = item.id === 'situacao'
      ? (v >= 0 ? 'situacao-pos' : 'situacao-neg')
      : valClass(v);
    return `<div class="summary-item">
      <div class="summary-label">${escHtml(item.label)}</div>
      <div class="summary-value ${cls}">${formatBRL(v)}</div>
    </div>`;
  }).join('');
}

function copiarMesAnterior() {
  const { lancAno: ano, lancMes: mes } = state;
  if (mes === 1) { showToast('Não há mês anterior para copiar.'); return; }

  const prevTxs = store.getTransacoes().filter(t => {
    const ymd = isoToYMD(t.data);
    return ymd && ymd.y === ano && ymd.m === mes - 1;
  });

  if (prevTxs.length === 0) { showToast('Mês anterior não tem lançamentos.'); return; }

  const maxDay = daysInMonth(ano, mes);

  const doCopy = () => {
    prevTxs.forEach(t => {
      const ymd = isoToYMD(t.data);
      const day = Math.min(ymd.d, maxDay);
      const novaData = `${ano}-${String(mes).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      store.addTransacao({ data: novaData, linhaId: t.linhaId, descricao: t.descricao, valor: t.valor, status: t.status });
    });
    renderLancamentos();
    renderDashboard();
    showToast(`${prevTxs.length} lançamentos copiados!`, 'success');
  };

  const curTxs = store.getTransacoes().filter(t => {
    const ymd = isoToYMD(t.data);
    return ymd && ymd.y === ano && ymd.m === mes;
  });

  if (curTxs.length > 0) {
    openConfirm('Copiar do mês anterior?',
      `O mês de ${MONTHS_FULL[mes-1]} já tem ${curTxs.length} lançamento(s). Deseja adicionar mais ${prevTxs.length} copiados de ${MONTHS_FULL[mes-2]}?`,
      doCopy);
  } else {
    doCopy();
  }
}

/* ============================================================
   TRANSACTION MODAL
   ============================================================ */
function setupTxModal() {
  document.getElementById('tx-modal-cancel').addEventListener('click', closeTxModal);
  document.getElementById('tx-modal-save').addEventListener('click', saveTx);
  document.getElementById('tx-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('tx-modal')) closeTxModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('tx-modal').style.display !== 'none') closeTxModal();
  });
}

function openTxModal(txId) {
  state.txEditId = txId;
  const linhas = getEditableLinhas();

  // Populate classification select
  const sel = document.getElementById('tx-linha');
  sel.innerHTML = linhas.map(l =>
    `<option value="${l.id}">${l.tipo === 'entrada' ? '(+)' : '(-)'} ${escHtml(l.nome)}</option>`
  ).join('');

  const modal = document.getElementById('tx-modal');
  document.getElementById('tx-error').style.display = 'none';

  if (txId) {
    // Edit mode
    const tx = store.getTransacoes().find(t => t.id === txId);
    if (!tx) return;
    document.getElementById('tx-modal-title').textContent = 'Editar Lançamento';
    document.getElementById('tx-data').value      = tx.data;
    document.getElementById('tx-linha').value     = tx.linhaId;
    document.getElementById('tx-descricao').value = tx.descricao || '';
    document.getElementById('tx-valor').value     = tx.valor;
    document.getElementById('tx-status').value    = tx.status;
  } else {
    // New mode — default date = 1st of current lanc month
    document.getElementById('tx-modal-title').textContent = 'Novo Lançamento';
    const defaultDate = `${state.lancAno}-${String(state.lancMes).padStart(2,'0')}-01`;
    document.getElementById('tx-data').value      = defaultDate;
    document.getElementById('tx-linha').value     = linhas[0]?.id || '';
    document.getElementById('tx-descricao').value = '';
    document.getElementById('tx-valor').value     = '';
    document.getElementById('tx-status').value    = store.getMesStatus(state.lancAno, state.lancMes);
  }

  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('tx-descricao').focus(), 80);
}

function closeTxModal() {
  document.getElementById('tx-modal').style.display = 'none';
  state.txEditId = null;
}

function saveTx() {
  const data      = document.getElementById('tx-data').value;
  const linhaId   = document.getElementById('tx-linha').value;
  const descricao = document.getElementById('tx-descricao').value.trim();
  const valorRaw  = document.getElementById('tx-valor').value;
  const status    = document.getElementById('tx-status').value;

  const errEl = document.getElementById('tx-error');

  if (!data)       { errEl.textContent = 'Data é obrigatória.'; errEl.style.display='block'; return; }
  if (!linhaId)    { errEl.textContent = 'Classificação é obrigatória.'; errEl.style.display='block'; return; }
  if (!descricao)  { errEl.textContent = 'Descrição é obrigatória.'; errEl.style.display='block'; return; }
  const valor = parseFloat(valorRaw);
  if (isNaN(valor) || valor <= 0) { errEl.textContent = 'Valor deve ser maior que zero.'; errEl.style.display='block'; return; }

  const payload = { data, linhaId, descricao, valor, status };

  if (state.txEditId) {
    store.updateTransacao(state.txEditId, payload);
    showToast('Lançamento atualizado!', 'success');
  } else {
    store.addTransacao(payload);
    showToast('Lançamento adicionado!', 'success');
  }

  // Update lancMes/lancAno to match the saved date
  const ymd = isoToYMD(data);
  if (ymd) { state.lancAno = ymd.y; state.lancMes = ymd.m; }

  closeTxModal();
  renderLancamentos();
  renderDashboard();
}

/* ============================================================
   ESTRUTURA TAB
   ============================================================ */
function setupEstrutura() {
  document.getElementById('add-linha-cancel').addEventListener('click', () => {
    document.getElementById('add-linha-modal').style.display = 'none';
  });
  document.getElementById('add-linha-confirm').addEventListener('click', confirmAddLinha);
}

function renderEstrutura() {
  const linhas = getLinhas();
  const container = document.getElementById('estrutura-sections');

  const sections = [
    { id: 'operacional',   label: 'Atividades Operacionais' },
    { id: 'investimentos', label: 'Atividades de Investimentos' },
    { id: 'financeiro',    label: 'Atividades Financeiras' },
    { id: 'dra',           label: 'Distribuição de Resultados e Aportes' },
  ];

  container.innerHTML = sections.map(sec => {
    const secLinhas = linhas.filter(l => l.secao === sec.id);
    return `<div class="estrutura-section">
      <div class="estrutura-section-header">
        <span>${escHtml(sec.label)}</span>
        <button class="btn btn-sm" style="background:rgba(255,255,255,.15);color:#fff;border-color:rgba(255,255,255,.2);"
          data-add-secao="${sec.id}">+ Adicionar Linha</button>
      </div>
      <ul class="estrutura-list">
        ${secLinhas.map(l => renderEstruturaItem(l)).join('')}
      </ul>
    </div>`;
  }).join('');

  container.querySelectorAll('[data-add-secao]').forEach(btn => {
    btn.addEventListener('click', () => openAddLinha(btn.dataset.addSecao));
  });

  container.querySelectorAll('[data-edit-nome]').forEach(inp => {
    inp.addEventListener('blur', () => {
      const id = inp.dataset.editNome;
      const all = JSON.parse(localStorage.getItem(KEY_LINHAS) || '[]');
      const idx = all.findIndex(l => l.id === id);
      if (idx >= 0) { all[idx].nome = inp.value; store.setLinhas(all); renderDashboard(); }
    });
  });

  container.querySelectorAll('[data-move]').forEach(btn => {
    btn.addEventListener('click', () => moveLinha(btn.dataset.moveId, btn.dataset.move));
  });

  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      openConfirm('Excluir linha?', `Deseja excluir "${btn.dataset.deleteName}"? Os lançamentos vinculados serão mantidos mas não exibidos.`, () => {
        deleteLinha(btn.dataset.delete);
      });
    });
  });
}

function renderEstruturaItem(l) {
  const isSys = l.sistema;
  const tipoCls = l.tipo === 'entrada' ? 'entrada' : l.tipo === 'saida' ? 'saida' : l.tipo === 'subtotal' ? 'subtotal' : 'especial';

  if (isSys) {
    return `<li class="estrutura-item is-system">
      <span class="estrutura-item-tipo tipo-badge ${tipoCls}">${tipoLabel(l.tipo)}</span>
      <span class="estrutura-item-nome">${escHtml(l.nome)}</span>
      <span title="Linha do sistema">🔒</span>
    </li>`;
  }

  return `<li class="estrutura-item" data-linha-id="${l.id}">
    <span class="estrutura-item-tipo tipo-badge ${tipoCls}">${tipoLabel(l.tipo)}</span>
    <div class="estrutura-item-nome">
      <input type="text" value="${escHtml(l.nome)}" data-edit-nome="${l.id}" />
    </div>
    <div class="estrutura-item-actions">
      <button class="btn-icon" data-move="up" data-move-id="${l.id}" title="Subir">↑</button>
      <button class="btn-icon" data-move="down" data-move-id="${l.id}" title="Descer">↓</button>
      <button class="btn-icon btn-delete" data-delete="${l.id}" data-delete-name="${escHtml(l.nome)}" title="Excluir">✕</button>
    </div>
  </li>`;
}

function tipoLabel(tipo) {
  if (tipo === 'entrada')  return '+ Entrada';
  if (tipo === 'saida')    return '− Saída';
  if (tipo === 'subtotal') return '= Subtotal';
  if (tipo === 'header')   return '• Seção';
  return tipo;
}

function openAddLinha(secao) {
  document.getElementById('new-linha-nome').value = '';
  document.getElementById('new-linha-tipo').value = 'entrada';
  document.getElementById('new-linha-secao').value = secao;
  document.getElementById('add-linha-modal').style.display = 'flex';
  document.getElementById('new-linha-nome').focus();
}

function confirmAddLinha() {
  const nome  = document.getElementById('new-linha-nome').value.trim();
  const tipo  = document.getElementById('new-linha-tipo').value;
  const secao = document.getElementById('new-linha-secao').value;
  if (!nome) { showToast('Informe o nome da linha.', 'error'); return; }

  const all = JSON.parse(localStorage.getItem(KEY_LINHAS) || '[]');
  const secLinhas     = all.filter(l => l.secao === secao);
  const subtotalLinha = all.find(l => l.secao === secao && l.tipo === 'subtotal');
  const subtotalOrdem = subtotalLinha ? subtotalLinha.ordem : 999;
  const nonSub        = secLinhas.filter(l => l.tipo !== 'subtotal' && l.tipo !== 'header');
  const maxOrdem      = nonSub.length ? Math.max(...nonSub.map(l => l.ordem)) : subtotalOrdem - 2;

  all.forEach(l => {
    if (l.secao === secao && l.tipo === 'subtotal') l.ordem += 1;
  });

  all.push({ id: uid(), secao, tipo, nome, ordem: maxOrdem + 1, sistema: false, ativo: true });
  store.setLinhas(all);
  document.getElementById('add-linha-modal').style.display = 'none';
  renderEstrutura();
  renderDashboard();
  renderLancamentos();
  showToast('Linha adicionada!', 'success');
}

function moveLinha(id, dir) {
  const all = JSON.parse(localStorage.getItem(KEY_LINHAS) || '[]');
  const linha = all.find(l => l.id === id);
  if (!linha) return;
  const secLinhas = all.filter(l => l.secao === linha.secao && !l.sistema && l.ativo).sort((a, b) => a.ordem - b.ordem);
  const idx = secLinhas.findIndex(l => l.id === id);
  if (dir === 'up' && idx > 0) { const o = secLinhas[idx-1]; [linha.ordem, o.ordem] = [o.ordem, linha.ordem]; }
  else if (dir === 'down' && idx < secLinhas.length - 1) { const o = secLinhas[idx+1]; [linha.ordem, o.ordem] = [o.ordem, linha.ordem]; }
  store.setLinhas(all);
  renderEstrutura();
  renderDashboard();
}

function deleteLinha(id) {
  const all = JSON.parse(localStorage.getItem(KEY_LINHAS) || '[]');
  const idx = all.findIndex(l => l.id === id);
  if (idx >= 0) all[idx].ativo = false;
  store.setLinhas(all);
  renderEstrutura();
  renderDashboard();
  renderLancamentos();
  showToast('Linha removida.', 'success');
}

/* ============================================================
   CONFIGURAÇÕES TAB
   ============================================================ */
function setupConfiguracoes() {
  document.getElementById('btn-save-config').addEventListener('click', () => {
    const cfg = {
      anoRef:        parseInt(document.getElementById('cfg-ano').value),
      empresa:       document.getElementById('cfg-empresa').value.trim(),
      nomeRelatorio: document.getElementById('cfg-relatorio').value.trim(),
    };
    store.setConfig(cfg);
    state.dashAno = cfg.anoRef;
    state.lancAno = cfg.anoRef;
    updateHeaderText();
    renderDashboard();
    renderLancamentos();
    showToast('Configurações salvas!', 'success');
  });

  document.getElementById('btn-export-json').addEventListener('click', exportJSON);
  document.getElementById('btn-import-json').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
  });
  document.getElementById('import-file-input').addEventListener('change', importJSON);
  document.getElementById('btn-clear-data').addEventListener('click', () => {
    openConfirm('Limpar todos os dados?', 'Apaga todas as configurações, linhas e lançamentos. Ação irreversível.', () => {
      store.clearAll();
      location.reload();
    });
  });
}

function loadConfiguracoes() {
  const cfg = store.getConfig();
  document.getElementById('cfg-ano').value       = cfg.anoRef || 2026;
  document.getElementById('cfg-empresa').value   = cfg.empresa || '';
  document.getElementById('cfg-relatorio').value = cfg.nomeRelatorio || '';
}

function exportJSON() {
  const saldoMap = JSON.parse(localStorage.getItem(KEY_SALDO_INIC) || '{}');
  const data = {
    config:      store.getConfig(),
    linhas:      JSON.parse(localStorage.getItem(KEY_LINHAS) || '[]'),
    transacoes:  store.getTransacoes(),
    status:      store.getStatus(),
    saldoInicial: saldoMap,
    exportedAt:  new Date().toISOString(),
  };
  const cfg  = store.getConfig();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `FCP_${(cfg.empresa || 'export').replace(/\s+/g,'_')}_${cfg.anoRef}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exportado com sucesso!', 'success');
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.config)      store.setConfig(data.config);
      if (data.linhas)      store.setLinhas(data.linhas);
      if (data.transacoes)  store.setTransacoes(data.transacoes);
      if (data.status)      store.setStatus(data.status);
      if (data.saldoInicial) localStorage.setItem(KEY_SALDO_INIC, JSON.stringify(data.saldoInicial));
      showToast('Importado com sucesso!', 'success');
      location.reload();
    } catch(err) {
      showToast('Erro ao importar: arquivo inválido.', 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

/* ============================================================
   CONFIRM MODAL
   ============================================================ */
let _confirmCallback = null;

function openConfirm(title, body, callback) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').textContent  = body;
  _confirmCallback = callback;
  document.getElementById('modal-overlay').style.display = 'flex';
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal-cancel').addEventListener('click', () => {
    document.getElementById('modal-overlay').style.display = 'none';
    _confirmCallback = null;
  });
  document.getElementById('modal-confirm').addEventListener('click', () => {
    document.getElementById('modal-overlay').style.display = 'none';
    if (_confirmCallback) { _confirmCallback(); _confirmCallback = null; }
  });
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) {
      document.getElementById('modal-overlay').style.display = 'none';
      _confirmCallback = null;
    }
  });
  document.getElementById('add-linha-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('add-linha-modal'))
      document.getElementById('add-linha-modal').style.display = 'none';
  });
});

/* ============================================================
   PDF EXPORT
   ============================================================ */
function setupExportPDF() {
  document.getElementById('btn-export-pdf').addEventListener('click', exportPDF);
}

function exportPDF() {
  try {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) { showToast('jsPDF não carregado.', 'error'); return; }

    const cfg  = store.getConfig();
    const ano  = state.dashAno;
    const doc  = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W    = 297, H = 210;
    const NAVY = [15, 32, 68];
    const BLUE = [37, 99, 235];

    /* ---- PAGE 1: CAPA ---- */
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W / 3, H, 'F');
    doc.setFillColor(...BLUE);
    doc.triangle(W / 3 - 30, 0, W / 3, 0, W / 3, 50, 'F');
    doc.setFontSize(32); doc.setTextColor(255,255,255); doc.setFont('helvetica', 'bold');
    doc.text('FCP', 20, 35);
    doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(147,197,253);
    doc.text('Fluxo de Caixa Projetado', 20, 44);
    doc.setFontSize(26); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
    doc.text(cfg.nomeRelatorio || 'Fluxo de Caixa Projetado', W / 3 + 15, 55);
    doc.setFontSize(20); doc.setTextColor(...BLUE);
    doc.text(`${cfg.empresa || 'Empresa'} — ${ano}`, W / 3 + 15, 70);
    doc.setFontSize(12); doc.setFont('helvetica', 'normal'); doc.setTextColor(100,116,139);
    doc.text(`Demonstração do Fluxo de Caixa`, W / 3 + 15, 82);
    doc.text(`Ano de referência: ${ano}`, W / 3 + 15, 90);

    /* ---- PAGE 2: DFC TABLE ---- */
    doc.addPage();
    const linhas    = getLinhas();
    const anoData   = computeAno(ano);
    const monthData = Array.from({length:12}, (_, i) => computeMonth(ano, i + 1));

    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
    doc.text(`${cfg.nomeRelatorio} — ${cfg.empresa} ${ano}`, W / 2, 12, { align: 'center' });

    const statusRow = ['Status', 'ANO', ...Array.from({length:12}, (_,i) => {
      return store.getMesStatus(ano, i+1) === 'realizado' ? 'Realizado' : 'Projetado';
    })];

    const head = [['Linha', 'ANO', ...MONTHS_PT]];
    const body = [statusRow];

    linhas.forEach(l => {
      const prefix = l.tipo === 'entrada' ? '(+) ' : l.tipo === 'saida' ? '(-) ' : l.tipo === 'subtotal' ? '(=) ' : '';
      body.push([
        prefix + l.nome,
        formatFC(anoData[l.id] || 0),
        ...Array.from({length:12}, (_, i) => formatFC(monthData[i][l.id] || 0))
      ]);
    });

    const colWidths = [62, 18, ...Array(12).fill(16.5)];

    doc.autoTable({
      head, body, startY: 16,
      styles: { fontSize: 6.5, cellPadding: 1.5, overflow: 'ellipsize', halign: 'right' },
      headStyles: { fillColor: NAVY, textColor: [255,255,255], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { halign: 'left', cellWidth: colWidths[0] },
        1: { cellWidth: colWidths[1], fillColor: [240,244,255], fontStyle: 'bold' },
        ...Object.fromEntries(Array.from({length:12}, (_, i) => [i+2, { cellWidth: colWidths[i+2] }]))
      },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const rowIdx = data.row.index;
        if (rowIdx === 0) {
          const colIdx = data.column.index;
          if (colIdx > 1) {
            const st = store.getMesStatus(ano, colIdx - 1);
            data.cell.styles.textColor = st === 'realizado' ? [37,99,235] : [217,119,6];
            data.cell.styles.fontStyle = 'bold'; data.cell.styles.halign = 'center';
          }
          data.cell.styles.fillColor = [248,250,252];
        } else {
          const linha = linhas[rowIdx - 1];
          if (!linha) return;
          if (linha.tipo === 'header') {
            data.cell.styles.fillColor = NAVY; data.cell.styles.textColor = [255,255,255]; data.cell.styles.fontStyle = 'bold';
          } else if (linha.tipo === 'subtotal') {
            data.cell.styles.fillColor = [226,232,240]; data.cell.styles.fontStyle = 'bold'; data.cell.styles.textColor = [30,58,110];
          } else if (linha.id === 'saldo_inicial') {
            data.cell.styles.fillColor = [254,252,232]; data.cell.styles.fontStyle = 'bold';
          } else if (linha.id === 'geracao') {
            data.cell.styles.fillColor = [241,245,249]; data.cell.styles.fontStyle = 'bold';
          } else if (linha.id === 'situacao') {
            data.cell.styles.fillColor = NAVY; data.cell.styles.textColor = [255,255,255]; data.cell.styles.fontStyle = 'bold';
          } else if (data.column.index > 0) {
            const cellTxt = data.cell.raw;
            if (cellTxt && cellTxt !== '-') {
              data.cell.styles.textColor = String(cellTxt).startsWith('(') ? [220,38,38] : [22,163,74];
            }
          }
        }
      },
      didDrawPage: (data) => {
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100,116,139);
        doc.text(`${cfg.empresa} — ${cfg.nomeRelatorio} ${ano}`, 10, H - 5);
        doc.text(`Página ${doc.internal.getCurrentPageInfo().pageNumber}`, W - 10, H - 5, { align: 'right' });
      }
    });

    /* ---- PAGE 3: ENCERRAMENTO ---- */
    doc.addPage();
    doc.setFillColor(...NAVY); doc.rect(0, 0, W / 3, H, 'F');
    doc.setFillColor(...BLUE); doc.triangle(W / 3 - 30, H, W / 3, H, W / 3, H - 50, 'F');
    doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(147,197,253);
    doc.text('JMP Finance Consultoria', 20, H - 30);
    doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
    doc.text('OBRIGADO PELA', W / 3 + 15, 70);
    doc.text('SUA ATENÇÃO', W / 3 + 15, 85);
    doc.setFontSize(12); doc.setFont('helvetica', 'normal'); doc.setTextColor(...BLUE);
    doc.text('www.ascensus.com.br', W / 3 + 15, 100);
    doc.setFontSize(10); doc.setTextColor(100,116,139);
    doc.text(`${cfg.empresa} — Fluxo de Caixa Projetado ${ano}`, W / 3 + 15, 115);

    doc.save(`FluxoCaixaProjetado_${(cfg.empresa||'empresa').replace(/\s+/g,'_')}_${ano}.pdf`);
    showToast('PDF exportado com sucesso!', 'success');
  } catch(err) {
    console.error('PDF export error:', err);
    showToast('Erro ao exportar PDF.', 'error');
  }
}

/* ============================================================
   BOOT
   ============================================================ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
