/* ============================================================
   PFL — app.js
   Lê o Relatório de Controladoria DaaS e exibe:
   - PFL: resumo DRE + indicadores
   - DRE Mês a Mês
   - DRE Acumulado (YTD)
   ============================================================ */

'use strict';

const KEY_DATA = 'pfl_data_v1';
const KEY_BU   = 'pfl_bu_v1';

// ══════════════════════════════════════════════════════════
// MAPEAMENTO DE CONTAS → ESTRUTURA DRE
// ══════════════════════════════════════════════════════════
// Para contas RESULTADO (3xxx): valor de exibição = -SALDO
//   → receita (crédito, SALDO<0) aparece positiva
//   → custo/despesa (débito, SALDO>0) aparece negativa

const ACCOUNT_DRE = {
  // ── Receita Bruta ──────────────────────────────────────
  '3101003005': 'vend_merc',
  '3103001001': 'dev_vend',
  // ── Deduções ───────────────────────────────────────────
  '3103005001': 'imp_vendas',
  '3103005002': 'imp_vendas',
  '3103005003': 'imp_vendas',
  '3103005004': 'imp_vendas',
  '3103005005': 'imp_vendas',
  '3103005006': 'imp_vendas',
  '3103005007': 'imp_vendas',
  '3103005008': 'imp_vendas',
  '3103005009': 'imp_vendas',
  '3103005010': 'imp_vendas',
  // ── Outras Receitas ────────────────────────────────────
  '3105001001': 'rec_fin',
  '3105001002': 'rec_fin',
  '3105001005': 'rec_fin',
  '3105001012': 'rec_fin',
  '3105003020': 'outras_op',
  '3105003001': 'outras_op',
  '3105003005': 'outras_op',
  // ── CMV ────────────────────────────────────────────────
  '3303001001': 'cmv',
  '3303001004': 'cmv',
  '3303001008': 'cmv',
  '3303001015': 'cmv',
  '3303001020': 'cmv',
  // ── Despesas Variáveis ─────────────────────────────────
  '3401008001': 'desp_vendas',
  '3305001023': 'fee',
  '3305001001': 'fee',
  // ── Despesas Financeiras ───────────────────────────────
  '3411001001': 'desp_fin',
  '3411001002': 'desp_fin',
  '3411001005': 'desp_fin',
  '3411001010': 'desp_fin',
  '3411001012': 'desp_fin',
  // ── Despesas Operacionais ──────────────────────────────
  '3403011001': 'desp_op',
  '3403011004': 'desp_op',
  '3403001001': 'desp_op',
  '3403001002': 'desp_op',
  // ── IRPJ / CSLL ────────────────────────────────────────
  '3407001001': 'irpj',
  '3407001002': 'irpj',
  '3407003001': 'csll',
  '3407003002': 'csll',
  // ── Repasse ────────────────────────────────────────────
  '3401007001': 'repasse',
  '3401007008': 'repasse',
};

// Nomes de exibição das linhas DRE
const DRE_LINE_LABELS = {
  vend_merc:  '3101003005 - Vendas de Mercadorias',
  dev_vend:   '3103001001 - (-) Devoluções de Vendas',
  imp_vendas: '(-) Impostos Incidentes s/ Vendas',
  rec_fin:    'Receitas Financeiras',
  outras_op:  'Outras Receitas Operacionais',
  cmv:        'Custo das Mercadorias Vendidas',
  desp_vendas:'Frete sobre Vendas',
  fee:        'Despesa de FEE',
  desp_fin:   'Despesas Financeiras',
  desp_op:    'Despesas Operacionais',
  irpj:       'IRPJ',
  csll:       'CSLL',
  repasse:    'Repasse / Serviços Profissionais',
  outros:     'Outras Contas',
};

// ── Hierarquia da DRE ──────────────────────────────────────
// type: 'total'|'group'|'subgroup'|'line'|'sep'
// lines[]: quais DRE_LINE_LABELS filhos pertencem a este nó
// Para 'group'/'subgroup': valor = soma dos filhos
const DRE_STRUCTURE = [
  { id: 'resultado',    label: '(=) RESULTADO',                  type: 'total',    level: 0 },
  { id: 'sep0', type: 'sep' },
  { id: 'rec_op',       label: 'RECEITAS OPERACIONAIS',          type: 'group',    level: 1 },
  { id: 'rbv',          label: 'Receita Bruta de Vendas',        type: 'subgroup', level: 2, lines: ['vend_merc', 'dev_vend'] },
  { id: 'vend_merc',    label: DRE_LINE_LABELS.vend_merc,        type: 'line',     level: 3 },
  { id: 'dev_vend',     label: DRE_LINE_LABELS.dev_vend,         type: 'line',     level: 3 },
  { id: 'deducoes',     label: '(-) Deduções da Receita',        type: 'subgroup', level: 2, lines: ['imp_vendas'] },
  { id: 'imp_vendas',   label: DRE_LINE_LABELS.imp_vendas,       type: 'line',     level: 3 },
  { id: 'rec_liq',      label: '(=) RECEITA LÍQUIDA',           type: 'subtotal', level: 2, calc: ['vend_merc','dev_vend','imp_vendas'] },
  { id: 'outras_rec',   label: 'Outras Receitas Operacionais',   type: 'subgroup', level: 2, lines: ['rec_fin','outras_op'] },
  { id: 'rec_fin',      label: DRE_LINE_LABELS.rec_fin,          type: 'line',     level: 3 },
  { id: 'outras_op',    label: DRE_LINE_LABELS.outras_op,        type: 'line',     level: 3 },
  { id: 'sep1', type: 'sep' },
  { id: 'custo',        label: 'CUSTO MERCADORIAS E SERVIÇOS',   type: 'group',    level: 1, lines: ['cmv'] },
  { id: 'cmv',          label: DRE_LINE_LABELS.cmv,              type: 'line',     level: 2 },
  { id: 'lob',          label: '(=) LOB — Lucro Op. Bruto',     type: 'subtotal', level: 1, calc: ['vend_merc','dev_vend','imp_vendas','rec_fin','outras_op','cmv'] },
  { id: 'sep2', type: 'sep' },
  { id: 'desp_var',     label: 'DESPESAS VARIÁVEIS',             type: 'group',    level: 1, lines: ['desp_vendas','fee'] },
  { id: 'desp_vendas',  label: DRE_LINE_LABELS.desp_vendas,      type: 'line',     level: 2 },
  { id: 'fee',          label: DRE_LINE_LABELS.fee,              type: 'line',     level: 2 },
  { id: 'mc',           label: '(=) MARGEM DE CONTRIBUIÇÃO',    type: 'subtotal', level: 1, calc: ['vend_merc','dev_vend','imp_vendas','rec_fin','outras_op','cmv','desp_vendas','fee'] },
  { id: 'sep3', type: 'sep' },
  { id: 'desp_fin_g',   label: 'DESPESAS FINANCEIRAS',           type: 'group',    level: 1, lines: ['desp_fin'] },
  { id: 'desp_fin',     label: DRE_LINE_LABELS.desp_fin,         type: 'line',     level: 2 },
  { id: 'desp_op_g',    label: 'DESPESAS OPERACIONAIS',          type: 'group',    level: 1, lines: ['desp_op'] },
  { id: 'desp_op',      label: DRE_LINE_LABELS.desp_op,          type: 'line',     level: 2 },
  { id: 'ebitda',       label: '(=) EBITDA',                    type: 'subtotal', level: 1, calc: ['vend_merc','dev_vend','imp_vendas','rec_fin','outras_op','cmv','desp_vendas','fee','desp_fin','desp_op'] },
  { id: 'sep4', type: 'sep' },
  { id: 'repasse_g',    label: 'REPASSE',                        type: 'group',    level: 1, lines: ['repasse'] },
  { id: 'repasse',      label: DRE_LINE_LABELS.repasse,          type: 'line',     level: 2 },
  { id: 'irpj_g',       label: 'IRPJ / CSLL',                   type: 'group',    level: 1, lines: ['irpj','csll'] },
  { id: 'irpj',         label: DRE_LINE_LABELS.irpj,             type: 'line',     level: 2 },
  { id: 'csll',         label: DRE_LINE_LABELS.csll,             type: 'line',     level: 2 },
  { id: 'outros_g',     label: 'Outras Contas (3xxx)',           type: 'group',    level: 1, lines: ['outros'] },
  { id: 'outros',       label: DRE_LINE_LABELS.outros,           type: 'line',     level: 2 },
];

// ══════════════════════════════════════════════════════════
// MAPEAMENTO ATIVO / PASSIVO (Balanço)
// ══════════════════════════════════════════════════════════
const BP_STRUCTURE = {
  ativo: {
    label: 'ATIVO',
    groups: {
      disponivel:      { label: 'Disponível',                   accounts: ['1101001002','1101002036','1101002109'] },
      clientes:        { label: 'Clientes',                     accounts: ['1102001004','1102001009','1102001013'] },
      outros_cred:     { label: 'Outros Créditos',              accounts: ['1104013001','1104013003','1104013017','1104013018','1104021001','1104021002','1104021007','1104021008'] },
      estoque:         { label: 'Estoque / Importação',         accounts: ['1108001001','1108001002','1108003001','1108003007','1108003010'] },
      ativo_nc:        { label: 'Ativo Não Circulante',         accounts: ['1200000000'] }, // genérico
    }
  },
  passivo: {
    label: 'PASSIVO + PL',
    groups: {
      fornecedores:    { label: 'Fornecedores',                 accounts: ['2103001001','2103001013','2103001016','2103003001'] },
      obrig_trib:      { label: 'Obrigações Tributárias',       accounts: ['2105001003','2105001004','2105001005','2105001006','2105003002','2105003005'] },
      outras_obrig:    { label: 'Outras Obrigações',            accounts: ['2109001001','2109001003'] },
      pl:              { label: 'Patrimônio Líquido',           accounts: ['2401001001','2405001001','2405001002','2405003001'] },
    }
  }
};

// ══════════════════════════════════════════════════════════
// UTILITÁRIOS
// ══════════════════════════════════════════════════════════
const fmtBRL = v =>
  new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(v ?? 0);

const fmtPct = v =>
  isFinite(v) ? (v * 100).toFixed(1) + '%' : '—';

function yyyymm(date) {
  if (!date) return null;
  let d;
  if (typeof date === 'number') {
    // Excel serial date (dias desde 1900-01-01, com correção de 25569 para epoch JS)
    d = new Date(Math.round((date - 25569) * 86400 * 1000));
  } else if (typeof date === 'string') {
    const s = date.trim();
    // Formato DD/MM/YYYY ou DD-MM-YYYY (padrão brasileiro)
    const mBR = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (mBR) {
      d = new Date(parseInt(mBR[3]), parseInt(mBR[2]) - 1, parseInt(mBR[1]));
    } else {
      // Formato YYYY-MM-DD ou outros
      d = new Date(s);
    }
  } else if (date instanceof Date) {
    d = date;
  } else {
    return null;
  }
  if (!d || isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  // Sanidade: só aceitar anos entre 2015 e 2035
  if (y < 2015 || y > 2035) return null;
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthLabel(ym) {
  // "2026-01" → "Jan/2026"
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const [y, m] = ym.split('-');
  return `${MESES[parseInt(m) - 1]}/${y}`;
}

function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + type;
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, 3200);
}

// ══════════════════════════════════════════════════════════
// STORE
// ══════════════════════════════════════════════════════════
const Store = {
  save(data, bu) {
    localStorage.setItem(KEY_DATA, JSON.stringify(data));
    if (bu) localStorage.setItem(KEY_BU, bu);
  },
  load() {
    const raw = localStorage.getItem(KEY_DATA);
    return raw ? JSON.parse(raw) : null;
  },
  getBU() { return localStorage.getItem(KEY_BU) || 'PFL'; },
  clear() { localStorage.removeItem(KEY_DATA); localStorage.removeItem(KEY_BU); }
};

// ══════════════════════════════════════════════════════════
// PARSER — lê o Excel do Relatório de Controladoria
// ══════════════════════════════════════════════════════════
// Retorna objeto: {
//   byAccount: { [conta]: { [yyyymm]: saldoMovimento } }   ← movimento mensal
//   months: ['2026-01', '2026-02', ...]                    ← ordenado
//   bu: string
// }
function parseRelatorio(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb   = XLSX.read(e.target.result, { type: 'binary', cellDates: true, dateNF: 'DD/MM/YYYY' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        // raw: true preserva tipos originais (Date objects para datas, numbers para números)
        const rows = XLSX.utils.sheet_to_json(ws, { raw: true, defval: '' });

        if (!rows.length) throw new Error('Planilha vazia');

        // Detectar colunas (case-insensitive, trim)
        const sample = rows[0];
        const colMap = {};
        for (const key of Object.keys(sample)) {
          const k = key.trim().toUpperCase()
            .replace('Ç','C').replace(/[ÁÂÃÀ]/g,'A')
            .replace(/[ÉÊ]/g,'E').replace(/[ÍÎ]/g,'I')
            .replace(/[ÓÔÕ]/g,'O').replace(/[ÚÛ]/g,'U');
          colMap[k] = key;
        }

        const getCol = (...names) => {
          for (const n of names) {
            if (colMap[n]) return colMap[n];
          }
          return null;
        };

        const colData    = getCol('DATA');
        const colConta   = getCol('CONTA');
        const colDesc    = getCol('DESC_CONTA','DESCRICAO_CONTA');
        const colSaldo   = getCol('SALDO');
        const colFilial  = getCol('FILIAL');
        const colBU      = getCol('BU');
        const colNat     = getCol('NATUREZA');

        if (!colData || !colConta || !colSaldo) {
          throw new Error('Colunas obrigatórias não encontradas (DATA, CONTA, SALDO).\nVerifique se o arquivo é o Relatório de Controladoria.');
        }

        const byAccount   = {};   // { conta: { yyyymm: totalSaldo } }
        const accountDesc = {};   // { conta: descricao }
        const monthsSet   = new Set();
        let bu = '';

        for (const row of rows) {
          const filial = String(row[colFilial] || '').trim();
          // Pular linha de total
          if (/^total/i.test(filial) || filial.toLowerCase() === 'total') continue;

          const rawDate  = row[colData];
          const conta    = String(row[colConta] || '').trim().replace(/\D/g, '');
          const rawSaldo = String(row[colSaldo] || '0')
            .replace(/\s/g,'').replace(/R\$\s*/i,'')
            .replace(/\./g,'').replace(',','.');
          const saldo    = parseFloat(rawSaldo) || 0;

          if (!conta || isNaN(saldo) || saldo === 0) continue;

          const ym = yyyymm(rawDate);
          if (!ym) continue;

          monthsSet.add(ym);
          if (!byAccount[conta])       byAccount[conta] = {};
          if (!byAccount[conta][ym])   byAccount[conta][ym] = 0;
          byAccount[conta][ym] += saldo;

          if (colDesc && row[colDesc]) accountDesc[conta] = String(row[colDesc]).trim();
          if (colBU && row[colBU] && !bu) bu = String(row[colBU]).trim();
        }

        const months = Array.from(monthsSet).sort();

        resolve({ byAccount, accountDesc, months, bu });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsBinaryString(file);
  });
}

// ══════════════════════════════════════════════════════════
// COMPUTAR DRE
// ══════════════════════════════════════════════════════════
// Retorna: { [lineId]: { [yyyymm]: value } }
// value usa convenção -SALDO para contas 3xxx
function computeDRELines(data) {
  const { byAccount, months } = data;
  const lines = {}; // { lineId: { ym: value } }

  for (const [conta, byMonth] of Object.entries(byAccount)) {
    const tipoNivel1 = conta.charAt(0); // '1'=ativo, '2'=passivo, '3'=resultado

    if (tipoNivel1 !== '3') continue; // apenas resultado

    const lineId = ACCOUNT_DRE[conta] || 'outros';
    if (!lines[lineId]) lines[lineId] = {};

    for (const [ym, saldo] of Object.entries(byMonth)) {
      if (!lines[lineId][ym]) lines[lineId][ym] = 0;
      // Usar -SALDO: receitas (crédito, saldo<0) → positivo; despesas (débito, saldo>0) → negativo
      lines[lineId][ym] += -saldo;
    }
  }

  return lines;
}

// Valor de uma linha em um mês (mes a mes)
function lineValue(lines, lineId, ym) {
  return lines[lineId]?.[ym] ?? 0;
}

// Calcular valor de nó na estrutura (recursivo para groups/subtotals)
function nodeValue(node, lines, ym) {
  if (node.type === 'line') {
    return lineValue(lines, node.id, ym);
  }
  if (node.type === 'subtotal' || node.type === 'total') {
    // calc = lista de lineIds a somar
    if (node.calc) {
      return node.calc.reduce((s, id) => s + lineValue(lines, id, ym), 0);
    }
  }
  if (node.type === 'group' || node.type === 'subgroup') {
    // soma de todos os filhos (lines[])
    const nodeLines = node.lines || [];
    return nodeLines.reduce((s, id) => s + lineValue(lines, id, ym), 0);
  }
  return 0;
}

// Calc para 'resultado' (todos os 3xxx)
function resultadoValue(lines, ym) {
  return Object.values(lines).reduce((s, byMonth) => s + (byMonth[ym] ?? 0), 0);
}

// ── Balanço Patrimonial (saldos acumulados) ────────────────
function computeBalanco(data) {
  const { byAccount, months } = data;
  // saldo acumulado histórico até cada mês
  const balanco = {}; // { conta: { ym: saldoAcumulado } }

  for (const [conta, byMonth] of Object.entries(byAccount)) {
    const tipo = conta.charAt(0);
    if (tipo !== '1' && tipo !== '2') continue;

    balanco[conta] = {};
    let acum = 0;
    for (const ym of months) {
      acum += byMonth[ym] ?? 0;
      // Ativo: saldo positivo (débito normal) → exibir como positivo → usar saldo direto
      // Passivo: saldo negativo (crédito normal) → exibir como positivo → usar -saldo
      balanco[conta][ym] = tipo === '1' ? acum : -acum;
    }
  }
  return balanco;
}

// ── DRE Acumulado YTD ──────────────────────────────────────
function computeAcumulado(lines, months) {
  // Para cada lineId e cada mês: soma de Jan do mesmo ano até esse mês
  const acum = {};
  for (const [lineId, byMonth] of Object.entries(lines)) {
    acum[lineId] = {};
    let currentYear = null;
    let running = 0;
    for (const ym of months) {
      const ano = ym.slice(0, 4);
      if (ano !== currentYear) { running = 0; currentYear = ano; }
      running += byMonth[ym] ?? 0;
      acum[lineId][ym] = running;
    }
  }
  return acum;
}

// ══════════════════════════════════════════════════════════
// RENDER: DRE TABLE
// ══════════════════════════════════════════════════════════
let dreVisMode = { mes: 'resumido', acum: 'resumido' };

function renderDRETable(tableId, lines, months, mode) {
  const table  = document.getElementById(tableId);
  const isAcum = tableId.includes('acum');
  const vis    = isAcum ? dreVisMode.acum : dreVisMode.mes;
  const isDetail = vis === 'detalhado';

  let html = '<thead><tr>';
  html += '<th class="col-label">Conta</th>';
  for (const ym of months) {
    html += `<th>${monthLabel(ym)}</th>`;
  }
  // Coluna total
  html += '<th style="background:#1a3a7a;">Total</th>';
  html += '</tr></thead><tbody>';

  for (const node of DRE_STRUCTURE) {
    if (node.type === 'sep') {
      html += `<tr class="row-separator"><td colspan="${months.length + 2}"></td></tr>`;
      continue;
    }

    // Em modo resumido, ocultar linhas de detalhe (level >= 2 que não sejam subtotal)
    const hide = !isDetail && (node.type === 'line' || node.type === 'subgroup');

    let rowClass = '';
    if (node.type === 'total')    rowClass = 'row-total';
    else if (node.type === 'subtotal') rowClass = 'row-subtotal';
    else if (node.type === 'group')    rowClass = 'row-group';
    else if (node.type === 'subgroup') rowClass = 'row-group';
    else rowClass = 'row-account';
    if (hide) rowClass += ' hidden';

    html += `<tr class="${rowClass}" data-node="${node.id}">`;

    // Label
    const indent = `indent-${Math.min(node.level, 4)}`;
    const labelContent = (node.type === 'group' || node.type === 'subgroup')
      ? `<span class="row-toggle" data-toggle="${node.id}">${node.label}</span>`
      : node.label;
    html += `<td class="col-label ${indent}">${labelContent}</td>`;

    // Valores por mês
    let total = 0;
    for (const ym of months) {
      let v;
      if (node.type === 'total') {
        v = resultadoValue(lines, ym);
      } else {
        v = nodeValue(node, lines, ym);
      }
      total += v;

      const cls = v > 0.005 ? 'val-pos' : v < -0.005 ? 'val-neg' : 'val-zero';
      html += `<td class="${cls}">${v !== 0 ? fmtBRL(v) : '—'}</td>`;
    }

    // Total coluna
    const tcls = total > 0.005 ? 'val-pos' : total < -0.005 ? 'val-neg' : 'val-zero';
    html += `<td class="${tcls}" style="font-weight:600;">${total !== 0 ? fmtBRL(total) : '—'}</td>`;
    html += '</tr>';
  }

  html += '</tbody>';
  table.innerHTML = html;

  // Bind toggle clicks
  table.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const nodeId = btn.dataset.toggle;
      toggleDREGroup(table, nodeId);
    });
  });
}

function toggleDREGroup(table, nodeId) {
  // Encontrar o nó na estrutura
  const node = DRE_STRUCTURE.find(n => n.id === nodeId);
  if (!node || !node.lines) return;

  const btn = table.querySelector(`[data-toggle="${nodeId}"]`);
  if (!btn) return;

  const isCollapsed = btn.classList.contains('collapsed');
  btn.classList.toggle('collapsed', !isCollapsed);

  // Mostrar/ocultar linhas filhas
  for (const lineId of node.lines) {
    const rows = table.querySelectorAll(`tr[data-node="${lineId}"]`);
    rows.forEach(row => {
      if (isCollapsed) {
        row.classList.remove('hidden');
      } else {
        row.classList.add('hidden');
      }
    });
  }
}

// ══════════════════════════════════════════════════════════
// RENDER: PFL DASHBOARD
// ══════════════════════════════════════════════════════════
function renderPFL(data) {
  const lines  = computeDRELines(data);
  const months = data.months;

  // Selector de mês
  const sel = document.getElementById('pfl-mes');
  sel.innerHTML = months.map(ym =>
    `<option value="${ym}">${monthLabel(ym)}</option>`
  ).join('');
  // Selecionar o último mês por padrão
  sel.value = months[months.length - 1];

  sel.addEventListener('change', () => updatePFLMes(data, lines));
  updatePFLMes(data, lines);
}

function updatePFLMes(data, lines) {
  const ym     = document.getElementById('pfl-mes').value;
  const ano    = ym.slice(0,4);
  const months = data.months;

  // YTD: meses do mesmo ano até ym
  const ytdMonths = months.filter(m => m.slice(0,4) === ano && m <= ym);

  // Valores YTD
  const val = lineId => ytdMonths.reduce((s, m) => s + lineValue(lines, lineId, m), 0);
  const RESULTADO_YTD = Object.values(lines).reduce((s, byMonth) =>
    s + ytdMonths.reduce((ss, m) => ss + (byMonth[m] ?? 0), 0), 0);

  const REC_BRUTA = val('vend_merc') + val('dev_vend');
  const DEDUCOES  = val('imp_vendas');
  const REC_LIQ   = REC_BRUTA + DEDUCOES;
  const OUTRAS    = val('rec_fin') + val('outras_op');
  const CMV       = val('cmv');
  const LOB       = REC_LIQ + OUTRAS + CMV;
  const DESP_VAR  = val('desp_vendas') + val('fee');
  const MC        = LOB + DESP_VAR;
  const DESP_FIN  = val('desp_fin');
  const DESP_OP   = val('desp_op');
  const EBITDA    = MC + DESP_FIN + DESP_OP;
  const REPASSE   = val('repasse');
  const IRPJ      = val('irpj') + val('csll');
  const RESULTADO = RESULTADO_YTD;

  document.getElementById('pfl-periodo-label').textContent =
    `Jan/${ano} — ${monthLabel(ym)}`;

  // KPIs
  const pct = (v, base) => base !== 0 ? fmtPct(v / base) : '—';

  const kpiItems = [
    { label: 'Receita Bruta',       value: REC_BRUTA, pct: null },
    { label: 'Receita Líquida',     value: REC_LIQ,   pct: pct(REC_LIQ, REC_BRUTA) + ' da bruta' },
    { label: 'LOB',                 value: LOB,        pct: pct(LOB, REC_LIQ) + ' da rec. líq.' },
    { label: 'Margem de Contrib.',  value: MC,         pct: pct(MC, REC_LIQ) + ' da rec. líq.' },
    { label: 'EBITDA',              value: EBITDA,     pct: pct(EBITDA, REC_LIQ) + ' da rec. líq.' },
    { label: 'Resultado',           value: RESULTADO,  pct: pct(RESULTADO, REC_LIQ) + ' da rec. líq.' },
  ];

  document.getElementById('kpi-resumo').innerHTML = kpiItems.map(k => {
    const cls = k.value >= 0 ? 'kpi-pos' : 'kpi-neg';
    return `<div class="kpi-resumo-item">
      <div class="kpi-resumo-label">${k.label}</div>
      <div class="kpi-resumo-value ${cls}">${fmtBRL(k.value)}</div>
      ${k.pct ? `<div class="kpi-resumo-pct">${k.pct}</div>` : ''}
    </div>`;
  }).join('');

  // ── Indicadores ─────────────────────────────────────────
  // Balanço: saldo acumulado no mês ym
  const balanco = computeBalanco(data);
  const bp = (conta) => balanco[conta]?.[ym] ?? 0;

  const bpGroup = (accs) => accs.reduce((s, c) => s + bp(c), 0);

  const DISPONIVEL  = bpGroup(['1101001002','1101002036','1101002109']);
  const CLIENTES    = bpGroup(['1102001004','1102001009','1102001013']);
  const OUTROS_CRED = bpGroup(['1104013001','1104013003','1104013017','1104013018','1104021001','1104021002','1104021007','1104021008']);
  const ESTOQUE     = bpGroup(['1108001001','1108001002','1108003001','1108003007','1108003010']);
  const AC          = DISPONIVEL + CLIENTES + OUTROS_CRED + ESTOQUE;
  // Ativo total = somar todos os 1xxx
  const ATIVO       = Object.entries(balanco)
    .filter(([c]) => c.charAt(0) === '1')
    .reduce((s, [, bm]) => s + (bm[ym] ?? 0), 0);

  const FORNEC = bpGroup(['2103001001','2103001013','2103001016','2103003001']);
  const OBRIG  = bpGroup(['2105001003','2105001004','2105001005','2105001006','2105003002','2105003005']);
  const OUT_OB = bpGroup(['2109001001','2109001003']);
  const PC     = FORNEC + OBRIG + OUT_OB;  // Passivo Corrente
  const PL     = bpGroup(['2401001001','2405001001','2405001002','2405003001']);
  const PASSIVO_TOTAL = PC + PL;

  // Índices de Lucratividade
  const margem_liq  = REC_LIQ !== 0 ? RESULTADO / REC_LIQ : 0;
  const margem_ebit = REC_LIQ !== 0 ? EBITDA / REC_LIQ    : 0;

  document.getElementById('indic-lucrat').innerHTML = [
    { label: 'Margem Líquida',            value: fmtPct(margem_liq),  cls: margem_liq  >= 0 ? 'kpi-pos' : 'kpi-neg' },
    { label: 'Lucratividade (EBITDA)',     value: fmtPct(margem_ebit), cls: margem_ebit >= 0 ? 'kpi-pos' : 'kpi-neg' },
    { label: 'Receita Líquida (YTD)',      value: fmtBRL(REC_LIQ),     cls: '' },
    { label: 'EBITDA (YTD)',               value: fmtBRL(EBITDA),      cls: EBITDA >= 0 ? 'kpi-pos' : 'kpi-neg' },
    { label: 'Resultado (YTD)',            value: fmtBRL(RESULTADO),   cls: RESULTADO >= 0 ? 'kpi-pos' : 'kpi-neg' },
  ].map(i => `<div class="indic-item">
    <span class="indic-label">${i.label}</span>
    <span class="indic-value ${i.cls}">${i.value}</span>
  </div>`).join('');

  // Índices de Liquidez
  const liq_imediat = PC !== 0 ? DISPONIVEL / PC : 0;
  const liq_seca    = PC !== 0 ? (AC - ESTOQUE) / PC : 0;
  const liq_corrente= PC !== 0 ? AC / PC : 0;
  const liq_geral   = PC !== 0 ? ATIVO / (PC) : 0;

  document.getElementById('indic-liquid').innerHTML = [
    { label: 'Liquidez Imediata',  value: liq_imediat.toFixed(2)  },
    { label: 'Liquidez Seca',      value: liq_seca.toFixed(2)     },
    { label: 'Liquidez Corrente',  value: liq_corrente.toFixed(2) },
    { label: 'Liquidez Geral',     value: liq_geral.toFixed(2)    },
    { label: 'Disponível',         value: fmtBRL(DISPONIVEL)      },
    { label: 'Passivo Corrente',   value: fmtBRL(PC)              },
  ].map(i => `<div class="indic-item">
    <span class="indic-label">${i.label}</span>
    <span class="indic-value">${i.value}</span>
  </div>`).join('');

  // Índices de Endividamento
  const base_endiv  = PL + RESULTADO;
  const endiv_cp    = base_endiv !== 0 ? PC / base_endiv : 0;
  const endiv_total = base_endiv !== 0 ? (PC) / base_endiv : 0;

  document.getElementById('indic-endiv').innerHTML = [
    { label: 'Endividamento Curto Prazo', value: fmtPct(endiv_cp)    },
    { label: 'Endividamento Total',       value: fmtPct(endiv_total) },
    { label: 'Ativo Total',               value: fmtBRL(ATIVO)       },
    { label: 'Passivo Corrente',          value: fmtBRL(PC)          },
    { label: 'Patrimônio Líquido',        value: fmtBRL(PL)          },
  ].map(i => `<div class="indic-item">
    <span class="indic-label">${i.label}</span>
    <span class="indic-value">${i.value}</span>
  </div>`).join('');
}

// ══════════════════════════════════════════════════════════
// RENDER: DRE mês e acumulado
// ══════════════════════════════════════════════════════════
function populateAnoSelect(selId, months) {
  const anos = [...new Set(months.map(m => m.slice(0,4)))].sort().reverse();
  const sel  = document.getElementById(selId);
  sel.innerHTML = anos.map(a => `<option value="${a}">${a}</option>`).join('');
}

function renderDREMes(data) {
  const lines  = computeDRELines(data);
  const months = data.months;

  populateAnoSelect('dre-mes-ano', months);

  const update = () => {
    const ano    = document.getElementById('dre-mes-ano').value;
    const meses  = months.filter(m => m.slice(0,4) === ano);
    renderDRETable('dre-mes-table', lines, meses, 'mes');
  };

  document.getElementById('dre-mes-ano').addEventListener('change', update);
  update();
}

function renderDREAcum(data) {
  const lines  = computeDRELines(data);
  const acumLines = computeAcumulado(lines, data.months);
  const months = data.months;

  populateAnoSelect('dre-acum-ano', months);

  const update = () => {
    const ano   = document.getElementById('dre-acum-ano').value;
    const meses = months.filter(m => m.slice(0,4) === ano);
    renderDRETable('dre-acum-table', acumLines, meses, 'acum');
  };

  document.getElementById('dre-acum-ano').addEventListener('change', update);
  update();
}

// ══════════════════════════════════════════════════════════
// INICIALIZAÇÃO COM DADOS
// ══════════════════════════════════════════════════════════
function initWithData(data) {
  const bu = data.bu || Store.getBU();
  document.getElementById('header-bu').textContent = `PFL ${bu}`;

  document.getElementById('pfl-info').textContent =
    `${data.months.length} meses · ${Object.keys(data.byAccount).length} contas`;

  // Mostrar conteúdos, ocultar empties
  document.getElementById('pfl-empty').style.display = 'none';
  document.getElementById('pfl-content').style.display = 'block';
  document.getElementById('dre-mes-empty').style.display = 'none';
  document.getElementById('dre-mes-content').style.display = 'flex';
  document.getElementById('dre-acum-empty').style.display = 'none';
  document.getElementById('dre-acum-content').style.display = 'flex';
  document.getElementById('btn-clear').style.display = 'inline-flex';

  renderPFL(data);
  renderDREMes(data);
  renderDREAcum(data);
}

// ══════════════════════════════════════════════════════════
// IMPORT FLOW
// ══════════════════════════════════════════════════════════
let pendingData = null;

function openImportModal() {
  pendingData = null;
  document.getElementById('import-status').style.display = 'none';
  document.getElementById('import-confirm').style.display = 'none';
  document.getElementById('import-drop').style.display    = 'flex';
  document.getElementById('modal-import').style.display   = 'flex';
}

async function handleImportFile(file) {
  const status = document.getElementById('import-status');
  status.style.display = 'block';
  status.innerHTML = '⏳ Lendo arquivo…';
  document.getElementById('import-drop').style.display = 'none';

  try {
    const data = await parseRelatorio(file);

    if (!data.months.length) throw new Error('Nenhum lançamento com data válida encontrado.');

    pendingData = data;
    const contas3 = Object.keys(data.byAccount).filter(c => c.charAt(0) === '3').length;
    const contas1 = Object.keys(data.byAccount).filter(c => c.charAt(0) === '1').length;
    const contas2 = Object.keys(data.byAccount).filter(c => c.charAt(0) === '2').length;

    status.innerHTML = `
      ✔ Arquivo lido com sucesso<br>
      BU: <strong>${data.bu || '—'}</strong> ·
      Período: <strong>${monthLabel(data.months[0])} → ${monthLabel(data.months[data.months.length-1])}</strong><br>
      ${data.months.length} meses · ${contas3} contas de resultado · ${contas1} ativo · ${contas2} passivo
    `;
    document.getElementById('import-confirm').style.display = 'inline-flex';
  } catch (err) {
    status.innerHTML = `<span style="color:var(--c-red)">✖ ${err.message}</span>`;
    document.getElementById('import-drop').style.display = 'flex';
  }
}

function confirmImport() {
  if (!pendingData) return;
  Store.save(pendingData, pendingData.bu);
  document.getElementById('modal-import').style.display = 'none';
  pendingData = null;
  initWithData(Store.load());
  showToast('Relatório importado com sucesso', 'success');
}

// ══════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════
function init() {
  // Tab switching
  document.getElementById('tab-nav').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tab-panel').forEach(p =>
      p.classList.toggle('active', p.id === 'tab-' + btn.dataset.tab));
  });

  // Import buttons
  const openImport = () => openImportModal();
  document.getElementById('btn-import').addEventListener('click', openImport);
  document.getElementById('btn-import-empty').addEventListener('click', openImport);

  // Drop area
  const drop = document.getElementById('import-drop');
  drop.addEventListener('click', () => document.getElementById('import-file').click());
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleImportFile(e.dataTransfer.files[0]);
  });

  document.getElementById('import-select').addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', e => {
    if (e.target.files[0]) handleImportFile(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('import-confirm').addEventListener('click', confirmImport);
  document.getElementById('import-cancel').addEventListener('click', () =>
    document.getElementById('modal-import').style.display = 'none');
  document.getElementById('import-close').addEventListener('click', () =>
    document.getElementById('modal-import').style.display = 'none');

  // Close on backdrop
  document.getElementById('modal-import').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-import'))
      document.getElementById('modal-import').style.display = 'none';
  });

  // Clear
  document.getElementById('btn-clear').addEventListener('click', () => {
    if (!confirm('Limpar todos os dados importados?')) return;
    Store.clear();
    location.reload();
  });

  // Visibility toggles (DRE mes)
  document.getElementById('dre-mes-content').addEventListener('click', e => {
    const btn = e.target.closest('.toggle-btn[data-vis]');
    if (!btn) return;
    const group = btn.closest('.toggle-group');
    group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    dreVisMode.mes = btn.dataset.vis;
    const data = Store.load();
    if (data) {
      const lines = computeDRELines(data);
      const ano   = document.getElementById('dre-mes-ano').value;
      const meses = data.months.filter(m => m.slice(0,4) === ano);
      renderDRETable('dre-mes-table', lines, meses, 'mes');
    }
  });

  // Visibility toggles (DRE acum)
  document.getElementById('dre-acum-content').addEventListener('click', e => {
    const btn = e.target.closest('.toggle-btn[data-vis]');
    if (!btn) return;
    const group = btn.closest('.toggle-group');
    group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    dreVisMode.acum = btn.dataset.vis;
    const data = Store.load();
    if (data) {
      const lines     = computeDRELines(data);
      const acumLines = computeAcumulado(lines, data.months);
      const ano       = document.getElementById('dre-acum-ano').value;
      const meses     = data.months.filter(m => m.slice(0,4) === ano);
      renderDRETable('dre-acum-table', acumLines, meses, 'acum');
    }
  });

  // Carregar dados do localStorage se existir
  const saved = Store.load();
  if (saved) initWithData(saved);
}

document.addEventListener('DOMContentLoaded', init);
