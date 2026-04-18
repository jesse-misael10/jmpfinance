/* ============================================================
   JMP Finance — Faturamento + FEE DaaS
   app.js  — single-file vanilla JS app, zero build step
   ============================================================ */

'use strict';

/* ── Storage keys ─────────────────────────────────────────── */
const KEY_BUS      = 'fee_bus_v1';
const KEY_LANC     = 'fee_lancamentos_v1';
const KEY_NOTAS    = 'fee_notas_v1';
const KEY_CONFIG   = 'fee_config_v1';
const APP_NAME     = 'fee';

/* ── Supabase ─────────────────────────────────────────────── */
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

/* ── Auth: verificar login e permissão ───────────────────── */
async function initAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    window.location.href = 'login.html?return=' + encodeURIComponent(window.location.href);
    return false;
  }
  const { data: perm } = await db.from('app_permissions')
    .select('app_name').eq('app_name', APP_NAME).maybeSingle();
  if (!perm) {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;
                  font-family:sans-serif;flex-direction:column;gap:1rem;color:#64748b;">
        <span style="font-size:3rem;">🔒</span>
        <h2 style="margin:0;color:#0f2044;">Acesso não autorizado</h2>
        <p>Você não tem permissão para acessar este módulo.</p>
        <button onclick="db.auth.signOut().then(()=>location.href='login.html')"
          style="padding:.5rem 1.5rem;background:#0f2044;color:#fff;border:none;
                 border-radius:6px;cursor:pointer;">Sair</button>
      </div>`;
    return false;
  }
  // Injetar botão sair + email no header
  const { data: { user } } = await db.auth.getUser();
  const headerInner = document.querySelector('.header-inner');
  if (headerInner) {
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;gap:.5rem;margin-left:auto;';
    bar.innerHTML = `
      <span style="font-size:.75rem;color:rgba(255,255,255,.75);max-width:180px;
                   overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${user.email}</span>
      <button onclick="db.auth.signOut().then(()=>location.href='login.html')"
        style="padding:3px 10px;background:rgba(255,255,255,.15);color:#fff;
               border:1px solid rgba(255,255,255,.3);border-radius:5px;
               cursor:pointer;font-size:.75rem;font-weight:600;">Sair</button>`;
    // Inserir antes do último botão (btn-pdf)
    const btnPdf = document.getElementById('btn-pdf');
    if (btnPdf) headerInner.insertBefore(bar, btnPdf);
    else headerInner.appendChild(bar);
  }
  return true;
}

/* ── Helpers: Supabase storage (síncrono via cache local) ── */
// Cache em memória para manter a API síncrona do app original
const _cache = {};

function load(key, def) {
  return key in _cache ? _cache[key] : def;
}

function save(key, val) {
  _cache[key] = val;
  // Salvar no Supabase em background (sem bloquear UI)
  db.auth.getUser().then(({ data: { user } }) => {
    if (!user) return;
    db.from('app_storage').upsert({
      user_id:    user.id,
      app_name:   APP_NAME,
      key,
      value:      val,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,app_name,key' });
  });
}

/* ── Carregar dados do Supabase na inicialização ─────────── */
async function loadAllFromCloud() {
  const keys = [KEY_BUS, KEY_LANC, KEY_NOTAS, KEY_CONFIG];
  const { data } = await db.from('app_storage')
    .select('key, value')
    .eq('app_name', APP_NAME)
    .in('key', keys);
  if (data) {
    for (const row of data) {
      _cache[row.key] = row.value;
    }
  }
}

/* ── Default config ──────────────────────────────────────── */
function getConfig() {
  return Object.assign({ nomeRelatorio: 'DaaS', anoRef: new Date().getFullYear(), logoB64: null }, load(KEY_CONFIG, {}));
}
function saveConfig(cfg) { save(KEY_CONFIG, cfg); }

/* ── BU helpers ──────────────────────────────────────────── */
function getBUs()     { return load(KEY_BUS, []); }
function saveBUs(arr) { save(KEY_BUS, arr); }
function uid()        { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ── Lancamento helpers ──────────────────────────────────── */
function getLancs()      { return load(KEY_LANC, []); }
function saveLancs(arr)  { save(KEY_LANC, arr); }

function getLanc(buId, ano, mes) {
  return getLancs().find(l => l.buId === buId && l.ano === ano && l.mes === mes) || null;
}

function upsertLanc(patch) {
  const arr = getLancs();
  const idx = arr.findIndex(l => l.buId === patch.buId && l.ano === patch.ano && l.mes === patch.mes);
  if (idx >= 0) {
    arr[idx] = Object.assign({}, arr[idx], patch);
  } else {
    arr.push(Object.assign({
      id: uid(), faturamento: 0, budgetFaturamento: 0,
      fee: 0, budgetFee: 0, feeManual: false, budgetFeeManual: false
    }, patch));
  }
  saveLancs(arr);
  return getLanc(patch.buId, patch.ano, patch.mes);
}

/* ── Notas helpers ───────────────────────────────────────── */
function getNotas()      { return load(KEY_NOTAS, {}); }
function notaKey(ano, mes) { return `${ano}-${String(mes).padStart(2, '0')}`; }
function getNota(ano, mes) { return getNotas()[notaKey(ano, mes)] || ''; }
function setNota(ano, mes, txt) {
  const n = getNotas();
  n[notaKey(ano, mes)] = txt;
  save(KEY_NOTAS, n);
}

/* ── Number formatting ───────────────────────────────────── */
function fmtNum(v) {
  if (v === null || v === undefined) return '-';
  const n = Number(v);
  if (isNaN(n)) return '-';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(v) {
  if (v === null || v === undefined) return '-';
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

function fmtDif(v) {
  if (v === 0) return '0';
  if (v < 0) return '(' + fmtNum(Math.abs(v)) + ')';
  return fmtNum(v);
}

const MESES_ABBR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

/* ── Toast ───────────────────────────────────────────────── */
let _toastTimer = null;
function toast(msg, dur = 2200) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), dur);
}

/* ── Tab routing ─────────────────────────────────────────── */
let currentTab = 'dashboard';

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tab));
  if (tab === 'dashboard')    renderDashboard();
  if (tab === 'lancamentos')  renderLancamentos();
  if (tab === 'bus')          renderBUs();
  if (tab === 'config')       renderConfig();
}

/* ── Filter state ────────────────────────────────────────── */
const now = new Date();
let filtroAno = now.getFullYear();
let filtroMes = now.getMonth() + 1; // 1-12

/* ================================================================
   DASHBOARD
   ================================================================ */

function buildTableRows(ano, mes, ytd = false) {
  const bus    = getBUs().filter(b => b.ativa);
  const lancs  = getLancs();

  return bus.map(bu => {
    let fat = 0, budFat = 0, fee = 0, budFee = 0;
    if (ytd) {
      for (let m = 1; m <= mes; m++) {
        const l = lancs.find(x => x.buId === bu.id && x.ano === ano && x.mes === m);
        if (l) { fat += l.faturamento; budFat += l.budgetFaturamento; fee += l.fee; budFee += l.budgetFee; }
      }
    } else {
      const l = lancs.find(x => x.buId === bu.id && x.ano === ano && x.mes === mes);
      if (l) { fat = l.faturamento; budFat = l.budgetFaturamento; fee = l.fee; budFee = l.budgetFee; }
    }
    return { bu, fat, budFat, fee, budFee };
  });
}

function sortRows(rows) {
  return [...rows].sort((a, b) => b.fat - a.fat || b.fee - a.fee);
}

function calcPctBudget(real, bud) {
  if (bud === 0) return null; // no budget
  return (real - bud) / bud * 100;
}

function pctBudgetCell(val) {
  // null means no budget → treat as +0% ▲ blue
  if (val === null) return { txt: '+ 0% ▲', cls: 'val-pos' };
  const sign  = val >= 0 ? '+' : '-';
  const arrow = val >= 0 ? '▲' : '▼';
  const abs   = Math.abs(val).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return { txt: `${sign} ${abs}% ${arrow}`, cls: val >= 0 ? 'val-pos' : 'val-neg' };
}

function renderFeeTable(rows, containerId) {
  const sorted = sortRows(rows);
  const cfg    = getConfig();
  const budLbl = 'Budget ' + String(cfg.anoRef).slice(-2);

  // Totals
  const totFat    = rows.reduce((s, r) => s + r.fat,    0);
  const totBudFat = rows.reduce((s, r) => s + r.budFat, 0);
  const totFee    = rows.reduce((s, r) => s + r.fee,    0);
  const totBudFee = rows.reduce((s, r) => s + r.budFee, 0);

  let html = `<div class="table-scroll"><table class="tbl-fee">
    <thead>
      <tr>
        <th style="width:40px"># Rank</th>
        <th class="col-bu">BU</th>
        <th>Faturamento</th>
        <th>${budLbl}</th>
        <th>Dif.</th>
        <th>% Budget</th>
        <th>FEE</th>
        <th>${budLbl}</th>
        <th>Dif.</th>
        <th>% Budget</th>
        <th>% FEE</th>
      </tr>
    </thead>
    <tbody>`;

  sorted.forEach((r, i) => {
    const rank = i + 1;
    const difFat = r.fat - r.budFat;
    const difFee = r.fee - r.budFee;
    const pctFat = calcPctBudget(r.fat, r.budFat);
    const pctFeeB = calcPctBudget(r.fee, r.budFee);
    const pctFee = r.fat === 0 ? null : r.fee / r.fat * 100;
    const pbFat  = pctBudgetCell(pctFat);
    const pbFeeB = pctBudgetCell(pctFeeB);

    const fatDisplay    = r.fat    === 0 ? '-' : fmtNum(r.fat);
    const budFatDisplay = r.budFat === 0 ? '-' : fmtNum(r.budFat);
    const feeDisplay    = r.fee    === 0 ? '-' : fmtNum(r.fee);
    const budFeeDisplay = r.budFee === 0 ? '-' : fmtNum(r.budFee);
    const difFatDisplay = r.fat === 0 && r.budFat === 0 ? '-' : fmtDif(difFat);
    const difFeeDisplay = r.fee === 0 && r.budFee === 0 ? '-' : fmtDif(difFee);
    const difFatCls     = difFat < 0 ? 'cell-dif-neg' : difFat > 0 ? 'cell-dif-pos' : '';
    const difFeeCls     = difFee < 0 ? 'cell-dif-neg' : difFee > 0 ? 'cell-dif-pos' : '';

    html += `<tr>
      <td class="col-rank row-rank">${rank}</td>
      <td class="col-bu">${esc(r.bu.nome)}</td>
      <td>${fatDisplay}</td>
      <td>${budFatDisplay}</td>
      <td class="${difFatCls}">${difFatDisplay}</td>
      <td class="${pbFat.cls}">${pbFat.txt}</td>
      <td>${feeDisplay}</td>
      <td>${budFeeDisplay}</td>
      <td class="${difFeeCls}">${difFeeDisplay}</td>
      <td class="${pbFeeB.cls}">${pbFeeB.txt}</td>
      <td class="text-muted">${pctFee !== null ? fmtPct(pctFee) : '-'}</td>
    </tr>`;
  });

  // Total row
  const totDifFat   = totFat - totBudFat;
  const totDifFee   = totFee - totBudFee;
  const totPctFat   = pctBudgetCell(calcPctBudget(totFat, totBudFat));
  const totPctFeeB  = pctBudgetCell(calcPctBudget(totFee, totBudFee));
  const totPctFee   = totFat === 0 ? null : totFee / totFat * 100;
  const totDifFatCls = totDifFat < 0 ? 'cell-dif-neg' : totDifFat > 0 ? 'cell-dif-pos' : '';
  const totDifFeeCls = totDifFee < 0 ? 'cell-dif-neg' : totDifFee > 0 ? 'cell-dif-pos' : '';

  html += `<tr class="row-total">
    <td class="col-rank">—</td>
    <td class="col-bu">Total Geral</td>
    <td>${totFat === 0 ? '-' : fmtNum(totFat)}</td>
    <td>${totBudFat === 0 ? '-' : fmtNum(totBudFat)}</td>
    <td class="${totDifFatCls}">${totFat === 0 && totBudFat === 0 ? '-' : fmtDif(totDifFat)}</td>
    <td class="${totPctFat.cls}">${totPctFat.txt}</td>
    <td>${totFee === 0 ? '-' : fmtNum(totFee)}</td>
    <td>${totBudFee === 0 ? '-' : fmtNum(totBudFee)}</td>
    <td class="${totDifFeeCls}">${totFee === 0 && totBudFee === 0 ? '-' : fmtDif(totDifFee)}</td>
    <td class="${totPctFeeB.cls}">${totPctFeeB.txt}</td>
    <td>${totPctFee !== null ? fmtPct(totPctFee) : '-'}</td>
  </tr>`;

  html += `</tbody></table></div>`;
  document.getElementById(containerId).innerHTML = html;
}

function renderDashboard() {
  const ano = filtroAno;
  const mes = filtroMes;

  // Filter selects
  document.getElementById('dash-ano').value = ano;
  document.getElementById('dash-mes').value = mes;

  const bus  = getBUs().filter(b => b.ativa);
  const rows = buildTableRows(ano, mes);
  const ytdRows = buildTableRows(ano, mes, true);

  // KPI
  const totFat    = rows.reduce((s, r) => s + r.fat, 0);
  const totFee    = rows.reduce((s, r) => s + r.fee, 0);
  const totBudFat = rows.reduce((s, r) => s + r.budFat, 0);
  const pctFeeGeral = totFat === 0 ? 0 : totFee / totFat * 100;
  const pctBudFat   = totBudFat === 0 ? null : (totFat - totBudFat) / totBudFat * 100;

  document.getElementById('kpi-fat').textContent     = totFat  === 0 ? 'R$ —' : 'R$ ' + fmtNum(totFat);
  document.getElementById('kpi-fee').textContent     = totFee  === 0 ? 'R$ —' : 'R$ ' + fmtNum(totFee);
  document.getElementById('kpi-pct-fee').textContent = fmtPct(pctFeeGeral);

  const kpiBud = document.getElementById('kpi-bud');
  if (pctBudFat === null) {
    kpiBud.textContent = '+ 0% ▲';
    kpiBud.closest('.kpi-card').className = 'kpi-card kpi-blue';
  } else {
    const sign  = pctBudFat >= 0 ? '+' : '-';
    const arrow = pctBudFat >= 0 ? '▲' : '▼';
    kpiBud.textContent = `${sign} ${Math.abs(pctBudFat).toLocaleString('pt-BR', {minimumFractionDigits:1,maximumFractionDigits:1})}% ${arrow}`;
    kpiBud.closest('.kpi-card').className = 'kpi-card ' + (pctBudFat >= 0 ? 'kpi-blue' : 'kpi-red');
  }

  // Section headers
  const mesAbr = MESES_ABBR[mes - 1];
  document.getElementById('sec-mensal-title').textContent =
    `Demonstração Mensal — ${mesAbr}/${ano}`;
  document.getElementById('sec-ytd-title').textContent =
    `Acumulado YTD — Jan a ${mesAbr}/${ano}`;

  if (bus.length === 0) {
    document.getElementById('tbl-mensal').innerHTML = emptyState('Nenhuma BU ativa. Cadastre BUs na aba BUs.');
    document.getElementById('tbl-ytd').innerHTML    = emptyState('Nenhuma BU ativa. Cadastre BUs na aba BUs.');
  } else {
    renderFeeTable(rows, 'tbl-mensal');
    renderFeeTable(ytdRows, 'tbl-ytd');
  }

  updatePdfBtn();
}

/* ================================================================
   LANÇAMENTOS
   ================================================================ */

// Track manual edits per input during session
// feeManual / budgetFeeManual are persisted on the lancamento record

function renderLancamentos() {
  document.getElementById('lanc-ano').value = filtroAno;
  document.getElementById('lanc-mes').value = filtroMes;

  const bus  = getBUs().filter(b => b.ativa);
  const ano  = filtroAno;
  const mes  = filtroMes;
  const cfg  = getConfig();
  const budLbl = 'Budget ' + String(cfg.anoRef).slice(-2);

  const container = document.getElementById('lanc-table-wrap');

  if (bus.length === 0) {
    container.innerHTML = emptyState('Nenhuma BU ativa. Cadastre BUs na aba BUs.');
    document.getElementById('notas-wrap').style.display = 'none';
    return;
  }

  document.getElementById('notas-wrap').style.display = '';

  let html = `<div class="table-scroll"><table class="tbl-lanc">
    <thead>
      <tr>
        <th>BU</th>
        <th>Faturamento</th>
        <th>${budLbl} Fat.</th>
        <th>FEE</th>
        <th>${budLbl} FEE</th>
        <th style="width:70px">% FEE</th>
      </tr>
    </thead>
    <tbody>`;

  bus.forEach(bu => {
    const l = getLanc(bu.id, ano, mes);
    const fat    = l ? l.faturamento        : 0;
    const budFat = l ? l.budgetFaturamento  : 0;
    const fee    = l ? l.fee                : 0;
    const budFee = l ? l.budgetFee          : 0;
    const pctFee = fat === 0 ? '' : (fee / fat * 100).toLocaleString('pt-BR', {minimumFractionDigits:1,maximumFractionDigits:1}) + '%';

    html += `<tr data-bu-id="${bu.id}">
      <td>${esc(bu.nome)}</td>
      <td><input type="number" class="cell-input" data-field="faturamento" value="${fat || ''}" placeholder="0"></td>
      <td><input type="number" class="cell-input" data-field="budgetFaturamento" value="${budFat || ''}" placeholder="0"></td>
      <td><input type="number" class="cell-input" data-field="fee" value="${fee || ''}" placeholder="0"></td>
      <td><input type="number" class="cell-input" data-field="budgetFee" value="${budFee || ''}" placeholder="0"></td>
      <td class="cell-pct-fee" id="pct-${bu.id}">${pctFee}</td>
    </tr>`;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;

  // Note
  document.getElementById('notas-textarea').value = getNota(ano, mes);

  // Attach events
  container.querySelectorAll('.cell-input').forEach(inp => {
    inp.addEventListener('blur', onCellBlur);
    inp.addEventListener('input', onCellInput);
  });
}

function onCellInput(e) {
  const inp   = e.target;
  const field = inp.dataset.field;
  if (field === 'fee' || field === 'budgetFee') {
    // Mark as manual if user is actively typing
    inp.dataset.manuallyEdited = '1';
  }
}

function onCellBlur(e) {
  const inp    = e.target;
  const row    = inp.closest('tr');
  const buId   = row.dataset.buId;
  const field  = inp.dataset.field;
  const val    = parseFloat(inp.value) || 0;
  const ano    = filtroAno;
  const mes    = filtroMes;

  const bu     = getBUs().find(b => b.id === buId);
  let current  = getLanc(buId, ano, mes) || { buId, ano, mes };

  // Update the field
  current[field] = val;

  // Handle manual flags
  if (field === 'fee')       current.feeManual       = inp.dataset.manuallyEdited === '1';
  if (field === 'budgetFee') current.budgetFeeManual = inp.dataset.manuallyEdited === '1';

  // Auto-calculate fee from faturamento if pctFeeContratado is set
  if (field === 'faturamento' && bu.pctFeeContratado != null) {
    if (!current.feeManual) {
      current.fee = Math.round(val * bu.pctFeeContratado / 100);
    }
  }
  if (field === 'budgetFaturamento' && bu.pctFeeContratado != null) {
    if (!current.budgetFeeManual) {
      current.budgetFee = Math.round(val * bu.pctFeeContratado / 100);
    }
  }

  upsertLanc(current);

  // Refresh the row's % FEE display
  const l2 = getLanc(buId, ano, mes);
  const fat2 = l2 ? l2.faturamento : 0;
  const fee2 = l2 ? l2.fee : 0;
  const pctFee2 = fat2 === 0 ? '' : (fee2 / fat2 * 100).toLocaleString('pt-BR', {minimumFractionDigits:1,maximumFractionDigits:1}) + '%';
  const pctCell = document.getElementById('pct-' + buId);
  if (pctCell) pctCell.textContent = pctFee2;

  // If faturamento changed and fee was auto-calculated, update fee input
  if ((field === 'faturamento' || field === 'budgetFaturamento') && bu.pctFeeContratado != null) {
    const feeField = field === 'faturamento' ? 'fee' : 'budgetFee';
    const feeInp = row.querySelector(`[data-field="${feeField}"]`);
    if (feeInp) {
      const l3 = getLanc(buId, ano, mes);
      feeInp.value = l3 ? (l3[feeField] || '') : '';
    }
  }
}

function copiarBudget() {
  const ano = filtroAno;
  const mes = filtroMes;
  const bus = getBUs().filter(b => b.ativa);
  let copied = 0;

  bus.forEach(bu => {
    let srcAno = ano, srcMes = mes - 1;
    if (srcMes < 1) { srcMes = 12; srcAno = ano - 1; }
    const src = getLanc(bu.id, srcAno, srcMes);
    if (!src) return;
    const cur = getLanc(bu.id, ano, mes) || { buId: bu.id, ano, mes };
    cur.budgetFaturamento = src.budgetFaturamento;
    cur.budgetFee         = src.budgetFee;
    upsertLanc(cur);
    copied++;
  });

  toast(copied > 0 ? `Budget copiado para ${copied} BU(s).` : 'Nenhum dado de budget no mês anterior.');
  renderLancamentos();
}

/* ================================================================
   BUs
   ================================================================ */

function renderBUs() {
  const bus = getBUs();
  const list = document.getElementById('bu-list');

  if (bus.length === 0) {
    list.innerHTML = emptyState('Nenhuma BU cadastrada. Clique em "+ Nova BU" para começar.');
    return;
  }

  list.innerHTML = bus.map(bu => `
    <div class="bu-item" data-id="${bu.id}">
      <div class="bu-nome">${esc(bu.nome)}</div>
      <div class="bu-pct">${bu.pctFeeContratado != null ? 'FEE Contratado: ' + bu.pctFeeContratado + '%' : 'FEE: não definido'}</div>
      <span class="${bu.ativa ? 'badge-ativa' : 'badge-inativa'}">${bu.ativa ? 'Ativa' : 'Inativa'}</span>
      <div class="bu-actions">
        <button class="btn btn-secondary btn-sm" onclick="editBU('${bu.id}')">Editar</button>
        <button class="btn btn-secondary btn-sm" onclick="toggleBU('${bu.id}')">${bu.ativa ? 'Desativar' : 'Ativar'}</button>
        <button class="btn btn-danger btn-sm" onclick="deleteBU('${bu.id}')">Excluir</button>
      </div>
    </div>
  `).join('');
}

function openBUModal(buId = null) {
  const bu   = buId ? getBUs().find(b => b.id === buId) : null;
  const modal = document.getElementById('bu-modal');
  document.getElementById('bu-modal-title').textContent = bu ? 'Editar BU' : 'Nova BU';
  document.getElementById('bu-form-id').value           = buId || '';
  document.getElementById('bu-form-nome').value         = bu ? bu.nome : '';
  document.getElementById('bu-form-pct').value          = bu && bu.pctFeeContratado != null ? bu.pctFeeContratado : '';
  document.getElementById('bu-form-ativa').checked      = bu ? bu.ativa : true;
  modal.classList.add('open');
}

function closeBUModal() { document.getElementById('bu-modal').classList.remove('open'); }

function saveBUForm() {
  const id    = document.getElementById('bu-form-id').value;
  const nome  = document.getElementById('bu-form-nome').value.trim();
  const pctV  = document.getElementById('bu-form-pct').value.trim();
  const ativa = document.getElementById('bu-form-ativa').checked;

  if (!nome) { alert('O nome da BU é obrigatório.'); return; }

  const pct = pctV === '' ? null : Math.min(100, Math.max(0, parseFloat(pctV)));

  const bus = getBUs();
  if (id) {
    const idx = bus.findIndex(b => b.id === id);
    if (idx >= 0) bus[idx] = Object.assign(bus[idx], { nome, pctFeeContratado: pct, ativa });
  } else {
    bus.push({ id: uid(), nome, pctFeeContratado: pct, ativa, createdAt: Date.now() });
  }
  saveBUs(bus);
  closeBUModal();
  renderBUs();
  toast(id ? 'BU atualizada.' : 'BU criada.');
}

function editBU(id)   { openBUModal(id); }

function toggleBU(id) {
  const bus = getBUs();
  const idx = bus.findIndex(b => b.id === id);
  if (idx >= 0) { bus[idx].ativa = !bus[idx].ativa; saveBUs(bus); renderBUs(); toast('Status da BU atualizado.'); }
}

function deleteBU(id) {
  if (!confirm('Excluir esta BU? Os lançamentos associados serão mantidos, mas a BU não aparecerá mais.')) return;
  saveBUs(getBUs().filter(b => b.id !== id));
  renderBUs();
  toast('BU excluída.');
}

/* ================================================================
   CONFIGURAÇÕES
   ================================================================ */

function renderConfig() {
  const cfg = getConfig();
  document.getElementById('cfg-nome').value = cfg.nomeRelatorio;
  document.getElementById('cfg-ano').value  = cfg.anoRef;
  const prev = document.getElementById('cfg-logo-preview');
  if (cfg.logoB64) {
    prev.src   = cfg.logoB64;
    prev.style.display = 'block';
  } else {
    prev.src   = '';
    prev.style.display = 'none';
  }
}

function saveConfigForm() {
  const cfg = getConfig();
  cfg.nomeRelatorio = document.getElementById('cfg-nome').value.trim() || 'DaaS';
  cfg.anoRef        = parseInt(document.getElementById('cfg-ano').value) || new Date().getFullYear();
  saveConfig(cfg);
  toast('Configurações salvas.');
}

function onLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const cfg = getConfig();
    cfg.logoB64 = ev.target.result;
    saveConfig(cfg);
    const prev = document.getElementById('cfg-logo-preview');
    prev.src = cfg.logoB64;
    prev.style.display = 'block';
    toast('Logo carregado.');
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  const cfg = getConfig();
  cfg.logoB64 = null;
  saveConfig(cfg);
  document.getElementById('cfg-logo-preview').style.display = 'none';
  toast('Logo removido.');
}

function exportData() {
  const data = {
    bus:     getBUs(),
    lancs:   getLancs(),
    notas:   getNotas(),
    config:  getConfig(),
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `fee_daas_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Dados exportados.');
}

function importData() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json';
  inp.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.bus)    saveBUs(data.bus);
        if (data.lancs)  saveLancs(data.lancs);
        if (data.notas)  save(KEY_NOTAS, data.notas);
        if (data.config) saveConfig(data.config);
        toast('Dados importados com sucesso!', 3000);
        switchTab(currentTab);
      } catch {
        alert('Arquivo inválido ou corrompido.');
      }
    };
    reader.readAsText(file);
  };
  inp.click();
}

/* ================================================================
   PDF GENERATION
   ================================================================ */

function updatePdfBtn() {
  const bus   = getBUs().filter(b => b.ativa);
  const lancs = getLancs();
  const hasData = bus.length > 0 && lancs.some(l => l.faturamento > 0 || l.fee > 0);
  document.getElementById('btn-pdf').disabled = !hasData;
}

async function gerarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W   = 297;
  const H   = 210;
  const ano = filtroAno;
  const mes = filtroMes;
  const mm  = String(mes).padStart(2, '0');
  const cfg = getConfig();
  const budLbl = 'Budget ' + String(cfg.anoRef).slice(-2);

  const NAVY  = [15, 32, 68];
  const BLUE  = [37, 99, 235];
  const DARK  = [30, 41, 59];
  const GRAY  = [100, 116, 139];
  const WHITE = [255, 255, 255];
  const RED_C = [220, 38, 38];

  // ── Helper: draw cover/closing accent ──────────────────────
  function drawAccent(doc) {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, 55, H, 'F');
    // Blue diagonal polygon
    doc.setFillColor(...BLUE);
    doc.triangle(55, 0, 80, 0, 35, H, 'F');
    doc.setFillColor(...BLUE);
    doc.triangle(80, 0, 60, H, 35, H, 'F');
  }

  // ── Page 1: Capa ──────────────────────────────────────────
  drawAccent(doc);

  if (cfg.logoB64) {
    try { doc.addImage(cfg.logoB64, 'AUTO', 8, 155, 50, 20); } catch {}
  }

  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text('Faturamento + FEE', 95, 90);

  doc.setTextColor(...BLUE);
  doc.setFontSize(32);
  doc.text(`${cfg.nomeRelatorio} ${mm}/${ano}`, 95, 108);

  doc.setTextColor(...GRAY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('www.ascensus.com.br', W - 12, H - 8, { align: 'right' });

  // ── Build table data ──────────────────────────────────────
  function buildPdfRows(ytd) {
    const bus   = getBUs().filter(b => b.ativa);
    const lancs = getLancs();

    const rawRows = bus.map(bu => {
      let fat = 0, budFat = 0, fee = 0, budFee = 0;
      if (ytd) {
        for (let m = 1; m <= mes; m++) {
          const l = lancs.find(x => x.buId === bu.id && x.ano === ano && x.mes === m);
          if (l) { fat += l.faturamento; budFat += l.budgetFaturamento; fee += l.fee; budFee += l.budgetFee; }
        }
      } else {
        const l = lancs.find(x => x.buId === bu.id && x.ano === ano && x.mes === mes);
        if (l) { fat = l.faturamento; budFat = l.budgetFaturamento; fee = l.fee; budFee = l.budgetFee; }
      }
      return { bu, fat, budFat, fee, budFee };
    });

    const sorted = [...rawRows].sort((a, b) => b.fat - a.fat || b.fee - a.fee);

    const totFat    = rawRows.reduce((s, r) => s + r.fat,    0);
    const totBudFat = rawRows.reduce((s, r) => s + r.budFat, 0);
    const totFee    = rawRows.reduce((s, r) => s + r.fee,    0);
    const totBudFee = rawRows.reduce((s, r) => s + r.budFee, 0);

    function pdfPctBudget(real, bud) {
      if (bud === 0) return '+ 0% ▲';
      const v    = (real - bud) / bud * 100;
      const sign = v >= 0 ? '+' : '-';
      const arrow= v >= 0 ? '▲' : '▼';
      const abs  = Math.abs(v).toLocaleString('pt-BR', {minimumFractionDigits:1,maximumFractionDigits:1});
      return `${sign} ${abs}% ${arrow}`;
    }

    function pdfDif(v, fat, bud) {
      if (fat === 0 && bud === 0) return '-';
      return fmtDif(v);
    }

    const body = sorted.map((r, i) => {
      const difFat = r.fat - r.budFat;
      const difFee = r.fee - r.budFee;
      const pctFee = r.fat === 0 ? '-' : fmtPct(r.fee / r.fat * 100);
      return [
        String(i + 1),
        r.bu.nome,
        r.fat === 0 ? '-' : fmtNum(r.fat),
        r.budFat === 0 ? '-' : fmtNum(r.budFat),
        pdfDif(difFat, r.fat, r.budFat),
        pdfPctBudget(r.fat, r.budFat),
        r.fee === 0 ? '-' : fmtNum(r.fee),
        r.budFee === 0 ? '-' : fmtNum(r.budFee),
        pdfDif(difFee, r.fee, r.budFee),
        pdfPctBudget(r.fee, r.budFee),
        pctFee
      ];
    });

    const totDifFat = totFat - totBudFat;
    const totDifFee = totFee - totBudFee;
    const totPctFee = totFat === 0 ? '-' : fmtPct(totFee / totFat * 100);

    body.push([
      '—', 'Total Geral',
      totFat    === 0 ? '-' : fmtNum(totFat),
      totBudFat === 0 ? '-' : fmtNum(totBudFat),
      totFat === 0 && totBudFat === 0 ? '-' : fmtDif(totDifFat),
      pdfPctBudget(totFat, totBudFat),
      totFee    === 0 ? '-' : fmtNum(totFee),
      totBudFee === 0 ? '-' : fmtNum(totBudFee),
      totFee === 0 && totBudFee === 0 ? '-' : fmtDif(totDifFee),
      pdfPctBudget(totFee, totBudFee),
      totPctFee
    ]);

    return body;
  }

  const colWidths  = [12, 38, 24, 24, 22, 20, 22, 22, 22, 20, 14];
  const colHeaders = ['# RANK', 'BU', 'Faturamento', budLbl, 'Dif.', '% Budget', 'FEE', budLbl, 'Dif.', '% Budget', '% FEE'];

  function addTablePage(title, body, isYtd) {
    doc.addPage();

    // Title bar
    const titleX = W / 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(16);
    doc.setTextColor(...DARK);
    const prefix = 'Faturamento + FEE — ';
    const suffix = isYtd ? `${cfg.nomeRelatorio} YTD ${ano}` : `${cfg.nomeRelatorio} ${mm}/${ano}`;
    const prefW  = doc.getTextWidth(prefix);
    const totalW = prefW + doc.getTextWidth(suffix);
    const startX = (W - totalW) / 2;
    doc.text(prefix, startX, 18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLUE);
    doc.text(suffix, startX + prefW, 18);

    // Table
    doc.autoTable({
      startY: 25,
      head: [colHeaders],
      body: body,
      margin: { left: 10, right: 10 },
      tableWidth: 277,
      columnStyles: {
        0: { halign: 'center',  cellWidth: colWidths[0]  },
        1: { halign: 'left',    cellWidth: colWidths[1]  },
        2: { halign: 'right',   cellWidth: colWidths[2]  },
        3: { halign: 'right',   cellWidth: colWidths[3]  },
        4: { halign: 'right',   cellWidth: colWidths[4]  },
        5: { halign: 'center',  cellWidth: colWidths[5]  },
        6: { halign: 'right',   cellWidth: colWidths[6]  },
        7: { halign: 'right',   cellWidth: colWidths[7]  },
        8: { halign: 'right',   cellWidth: colWidths[8]  },
        9: { halign: 'center',  cellWidth: colWidths[9]  },
        10: { halign: 'right',  cellWidth: colWidths[10] }
      },
      headStyles: {
        fillColor: [30, 58, 110],
        textColor: WHITE,
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center'
      },
      bodyStyles: { fontSize: 8, cellPadding: 2 },
      didParseCell: function(data) {
        if (data.section === 'body') {
          const isTotal = data.row.index === body.length - 1;
          if (isTotal) {
            data.cell.styles.fillColor  = [226, 232, 240];
            data.cell.styles.fontStyle  = 'bold';
          }
          // % Budget columns
          if (data.column.index === 5 || data.column.index === 9) {
            const txt = data.cell.raw || '';
            if (txt.includes('▲')) data.cell.styles.textColor = BLUE;
            else if (txt.includes('▼')) data.cell.styles.textColor = RED_C;
          }
          // Dif. columns
          if (data.column.index === 4 || data.column.index === 8) {
            const txt = data.cell.raw || '';
            if (String(txt).startsWith('(')) data.cell.styles.textColor = RED_C;
          }
        }
      }
    });

    // Notes (only mensal)
    if (!isYtd) {
      const nota = getNota(ano, mes);
      if (nota.trim()) {
        const afterY = doc.lastAutoTable.finalY + 8;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...DARK);
        doc.text('Notas', 10, afterY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        const lines = nota.split('\n').filter(l => l.trim());
        let y = afterY + 5;
        lines.forEach(line => {
          const parts = doc.splitTextToSize('• ' + line, 270);
          parts.forEach(p => {
            if (y > H - 8) return;
            doc.text(p, 12, y);
            y += 4.5;
          });
        });
      }
    }
  }

  // ── Page 2: Mensal ────────────────────────────────────────
  addTablePage(`${cfg.nomeRelatorio} ${mm}/${ano}`, buildPdfRows(false), false);

  // ── Page 3: YTD ──────────────────────────────────────────
  addTablePage(`${cfg.nomeRelatorio} YTD ${ano}`, buildPdfRows(true), true);

  // ── Page 4: Encerramento ──────────────────────────────────
  doc.addPage();
  drawAccent(doc);

  const rx = 140;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...DARK);
  doc.text('OBRIGADO PELA', rx, 75, { align: 'center' });

  doc.setFontSize(22);
  doc.setTextColor(...BLUE);
  doc.text('SUA ATENÇÃO', rx, 90, { align: 'center' });

  doc.setFontSize(16);
  doc.setTextColor(...DARK);
  doc.text('THANK YOU', rx, 110, { align: 'center' });

  doc.setFontSize(18);
  doc.setTextColor(...BLUE);
  doc.text('FOR YOUR ATTENTION', rx, 123, { align: 'center' });

  if (cfg.logoB64) {
    try { doc.addImage(cfg.logoB64, 'AUTO', rx - 25, 140, 50, 20); } catch {}
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text('www.ascensus.com.br', rx, 175, { align: 'center' });

  // ── Save ─────────────────────────────────────────────────
  doc.save(`Faturamento_FEE_${cfg.nomeRelatorio}_${mm}_${ano}.pdf`);
  toast('PDF gerado com sucesso!', 3000);
}

/* ================================================================
   MISC HELPERS
   ================================================================ */
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function emptyState(msg) {
  return `<div class="empty-state"><p>${msg}</p></div>`;
}

/* ================================================================
   INIT
   ================================================================ */
document.addEventListener('DOMContentLoaded', async () => {

  // Auth + carregar dados da nuvem antes de renderizar
  const ok = await initAuth();
  if (!ok) return;
  await loadAllFromCloud();

  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // PDF button
  document.getElementById('btn-pdf').addEventListener('click', gerarPDF);

  // Dashboard filters
  document.getElementById('dash-ano').addEventListener('change', e => {
    filtroAno = parseInt(e.target.value);
    renderDashboard();
  });
  document.getElementById('dash-mes').addEventListener('change', e => {
    filtroMes = parseInt(e.target.value);
    renderDashboard();
  });

  // Lançamentos filters
  document.getElementById('lanc-ano').addEventListener('change', e => {
    filtroAno = parseInt(e.target.value);
    renderLancamentos();
  });
  document.getElementById('lanc-mes').addEventListener('change', e => {
    filtroMes = parseInt(e.target.value);
    renderLancamentos();
  });

  // Copiar budget
  document.getElementById('btn-copiar-budget').addEventListener('click', copiarBudget);

  // Notas textarea
  document.getElementById('notas-textarea').addEventListener('blur', e => {
    setNota(filtroAno, filtroMes, e.target.value);
  });

  // BU modal
  document.getElementById('btn-nova-bu').addEventListener('click', () => openBUModal());
  document.getElementById('bu-modal-cancel').addEventListener('click', closeBUModal);
  document.getElementById('bu-modal-save').addEventListener('click', saveBUForm);
  document.getElementById('bu-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('bu-modal')) closeBUModal();
  });

  // Config form
  document.getElementById('btn-save-config').addEventListener('click', saveConfigForm);
  document.getElementById('cfg-logo-input').addEventListener('change', onLogoUpload);
  document.getElementById('btn-remove-logo').addEventListener('click', removeLogo);
  document.getElementById('btn-export').addEventListener('click', exportData);
  document.getElementById('btn-import').addEventListener('click', importData);

  // Populate year selects
  const currentYear = new Date().getFullYear();
  ['dash-ano', 'lanc-ano'].forEach(id => {
    const sel = document.getElementById(id);
    sel.innerHTML = '';
    for (let y = currentYear - 3; y <= currentYear + 2; y++) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      if (y === filtroAno) opt.selected = true;
      sel.appendChild(opt);
    }
  });

  // Initial render
  switchTab('dashboard');
});
