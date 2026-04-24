/* ============================================================
   Empréstimos & Financiamentos — app.js
   ============================================================ */

'use strict';

// ── CONSTANTES ───────────────────────────────────────────────
const STORAGE_KEY = 'ef_operacoes_v2';
const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const TIPO_LABEL = {
  emprestimo: 'Empréstimo', financiamento: 'Financiamento',
  debenture: 'Debênture', cri: 'CRI', cra: 'CRA',
  finimp: 'FINIMP', ndf: 'NDF', outro: 'Outro',
};
const SISTEMA_LABEL  = { price: 'Price', sac: 'SAC', bullet: 'Bullet' };
const INDEXADOR_LABEL = {
  prefixado: 'Prefixado', cdi: 'CDI+', ipca: 'IPCA+', igpm: 'IGP-M+', outro: 'Outro',
};
const FINALIDADE_LABEL = {
  capital_giro: 'Capital de Giro', investimento: 'Investimento',
  imobilizado: 'Imobilizado', refinanciamento: 'Refinanciamento',
  importacao: 'Importação', maquinario: 'Maquinário', materia_prima: 'Matéria-Prima',
  outro: 'Outro',
};

// ── ESTADO ───────────────────────────────────────────────────
let operacoes    = [];
let abaAtual     = 'dashboard';
let catModal     = 'padrao';   // 'padrao' | 'finimp' | 'ndf'
let opEditandoId = null;
let drawerOpId   = null;

// ── STORAGE ───────────────────────────────────────────────────
async function carregarDados() {
  // Tenta nuvem primeiro, cai em localStorage se não tiver auth
  try {
    if (typeof CloudStorage !== 'undefined') {
      const cloud = await CloudStorage.get(STORAGE_KEY);
      if (cloud && Array.isArray(cloud)) {
        operacoes = cloud;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cloud));
        return;
      }
    }
  } catch {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    operacoes = raw ? JSON.parse(raw) : [];
  } catch { operacoes = []; }
}

function salvarDados() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(operacoes));
  // Salva na nuvem em background sem bloquear a UI
  if (typeof CloudStorage !== 'undefined') {
    CloudStorage.set(STORAGE_KEY, operacoes).catch(() => {});
  }
}

// ── HELPERS ───────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const r2  = v => Math.round(v * 100) / 100;

function formatBRL(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}
function formatMoeda(v, moeda) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda,
      minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  } catch {
    return moeda + ' ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  }
}
function formatPct(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + '%';
}
function formatCotacao(v) {
  if (!v) return '—';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}
function formatDate(s) {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}
function hoje() { return new Date().toISOString().slice(0, 10); }
function diasAte(dateStr) {
  const hj = new Date(); hj.setHours(0,0,0,0);
  const alvo = new Date(dateStr + 'T00:00:00');
  return Math.round((alvo - hj) / 86400000);
}

// ── CÁLCULOS BASE ─────────────────────────────────────────────
function mesesPorPeriodo(periodicidade) {
  return { mensal: 1, trimestral: 3, semestral: 6, anual: 12 }[periodicidade] || 1;
}

/** taxa mensal → taxa do período: r_p = (1 + r_m)^n − 1 */
function taxaPeriodo(taxaMensal, periodicidade) {
  const n = mesesPorPeriodo(periodicidade);
  return Math.pow(1 + taxaMensal / 100, n) - 1;
}

/** Gera plano de pagamentos — usa moeda estrangeira se op.tipo === 'finimp' */
function gerarPlano(op) {
  const isFinimp = op.tipo === 'finimp';
  const n   = mesesPorPeriodo(op.periodicidade);
  const r   = taxaPeriodo(op.taxaMensal, op.periodicidade);
  const np  = op.numeroParcelas;
  const pv  = isFinimp ? op.valorMoeda : op.valorContratado;
  const dia = op.diaVencimento || 15;
  const cot = isFinimp ? op.cotacaoAtual : 1;  // cotação atual para converter p/ BRL

  let pmt = 0;
  if (op.sistema === 'price') {
    pmt = r > 0 ? pv * r / (1 - Math.pow(1 + r, -np)) : pv / np;
  }
  const amortSAC = op.sistema === 'sac' ? pv / np : 0;

  let saldo = pv;
  const parcelas = [];

  for (let i = 1; i <= np; i++) {
    const dtBase = new Date(op.dataContratacao + 'T12:00:00');
    dtBase.setMonth(dtBase.getMonth() + n * i);
    const ultimoDia = new Date(dtBase.getFullYear(), dtBase.getMonth() + 1, 0).getDate();
    dtBase.setDate(Math.min(dia, ultimoDia));
    const vencimento = dtBase.toISOString().slice(0, 10);

    const saldoInicial = saldo;
    const juros        = r2(saldoInicial * r);
    let amortizacao, parcela;

    if (op.sistema === 'sac') {
      amortizacao = r2(amortSAC);
      parcela     = r2(amortizacao + juros);
    } else if (op.sistema === 'price') {
      parcela     = r2(pmt);
      amortizacao = r2(parcela - juros);
    } else {
      if (i < np) { amortizacao = 0; parcela = r2(juros); }
      else { amortizacao = r2(saldoInicial); parcela = r2(saldoInicial + juros); }
    }

    const saldoFinal = r2(Math.max(0, saldoInicial - amortizacao));
    const existing   = op.parcelas?.find(p => p.numero === i);

    parcelas.push({
      numero:        i,
      vencimento,
      saldoInicial:  r2(saldoInicial),
      amortizacao,
      juros,
      parcela,
      saldoFinal,
      // Para FINIMP: valores em BRL também (snapshot da cotação atual)
      parcelaBRL:    isFinimp ? r2(parcela * cot) : parcela,
      saldoFinalBRL: isFinimp ? r2(saldoFinal * cot) : saldoFinal,
      paga:          existing?.paga          || false,
      dataPagamento: existing?.dataPagamento || null,
    });

    saldo = saldoFinal;
  }
  return parcelas;
}

/** Saldo devedor atual em moeda nativa da operação */
function saldoAtual(op) {
  if (op.tipo === 'ndf') return null;
  if (!op.parcelas?.length) return op.tipo === 'finimp' ? op.valorMoeda : op.valorContratado;
  const pagas = op.parcelas.filter(p => p.paga).sort((a, b) => b.numero - a.numero);
  if (!pagas.length) return op.parcelas[0]?.saldoInicial ?? (op.tipo === 'finimp' ? op.valorMoeda : op.valorContratado);
  return pagas[0].saldoFinal;
}

/** Saldo devedor em BRL */
function saldoAtualBRL(op) {
  if (op.tipo === 'ndf') return null;
  const s = saldoAtual(op);
  return op.tipo === 'finimp' ? r2(s * (op.cotacaoAtual || 1)) : s;
}

function proximaParcela(op) {
  if (op.tipo === 'ndf') return null;
  return op.parcelas?.find(p => !p.paga) || null;
}

function statusOp(op) {
  if (op.tipo === 'ndf') {
    if (op.liquidada) return 'encerrada';
    if (diasAte(op.dataLiquidacao) < 0) return 'vencida';
    return 'ativa';
  }
  if (!op.parcelas?.length) return 'ativa';
  if (op.parcelas.every(p => p.paga)) return 'encerrada';
  const prox = proximaParcela(op);
  if (prox && diasAte(prox.vencimento) < 0) return 'vencida';
  return 'ativa';
}

/** MtM do NDF em BRL:
 *  Venda (exportador): ganho se cotação atual < trava → (trava − atual) × nocional
 *  Compra (importador): ganho se cotação atual > trava → (atual − trava) × nocional
 */
function calcMtM(op) {
  if (op.tipo !== 'ndf') return null;
  const cot   = op.cotacaoAtual  || 0;
  const trava = op.taxaTrava     || 0;
  const noc   = op.nocional      || 0;
  if (op.direcao === 'venda') return r2((trava - cot) * noc);
  return r2((cot - trava) * noc);   // compra
}

// ── NAVEGAÇÃO ─────────────────────────────────────────────────
function mostrarAba(aba) {
  abaAtual = aba;
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === aba));
  const pageMap = { dashboard: 'pageDashboard', operacoes: 'pageOperacoes', simulador: 'pageSimulador' };
  document.getElementById(pageMap[aba]).style.display = '';
  if (aba === 'dashboard') renderizarDashboard();
  if (aba === 'operacoes') renderizarOperacoes();
  if (aba === 'simulador') initSimulador();
}

// ── DASHBOARD ─────────────────────────────────────────────────
function renderizarDashboard() {
  renderizarKPIsDash();
  renderizarExposicaoCambial();
  renderizarAlertas();
  renderizarGraficos();
  document.getElementById('footerTs').textContent = 'Atualizado em ' + new Date().toLocaleString('pt-BR');
}

function renderizarKPIsDash() {
  const ativas = operacoes.filter(op => statusOp(op) !== 'encerrada' && op.tipo !== 'ndf');
  const totalDivida = ativas.reduce((s, op) => s + (saldoAtualBRL(op) || 0), 0);

  const hj = new Date(); hj.setHours(0,0,0,0);
  const mesAtual = `${hj.getFullYear()}-${String(hj.getMonth()+1).padStart(2,'0')}`;
  let totalMes = 0;
  operacoes.forEach(op => {
    if (op.tipo === 'ndf') return;
    op.parcelas?.forEach(p => {
      if (!p.paga && p.vencimento.startsWith(mesAtual)) totalMes += p.parcelaBRL || p.parcela;
    });
  });

  const limite12 = new Date(hj); limite12.setMonth(limite12.getMonth() + 12);
  let juros12 = 0;
  operacoes.forEach(op => {
    if (op.tipo === 'ndf') return;
    const cot = op.tipo === 'finimp' ? (op.cotacaoAtual || 1) : 1;
    op.parcelas?.forEach(p => {
      if (!p.paga) {
        const dv = new Date(p.vencimento + 'T00:00:00');
        if (dv >= hj && dv <= limite12) juros12 += p.juros * cot;
      }
    });
  });

  let proxGlobal = null;
  operacoes.forEach(op => {
    if (op.tipo === 'ndf') return;
    const prox = proximaParcela(op);
    if (prox && (!proxGlobal || prox.vencimento < proxGlobal.vencimento))
      proxGlobal = { ...prox, opDesc: op.descricao };
  });
  const dias = proxGlobal ? diasAte(proxGlobal.vencimento) : null;

  // Subtítulo da página
  const credores = [...new Set(ativas.map(o => o.credor || o.contraparte).filter(Boolean))];
  const mesAno = `${MESES_PT[hj.getMonth()]}/${hj.getFullYear()}`;
  const subEl = document.getElementById('pageSub');
  if (subEl) subEl.textContent =
    `${ativas.length} operaç${ativas.length === 1 ? 'ão ativa' : 'ões ativas'}` +
    (credores.length ? ` em ${credores.length} credor${credores.length > 1 ? 'es' : ''}` : '') +
    ` · ${mesAno}`;

  // Pill do próximo vencimento
  const proxPill = dias === null ? '' :
    dias < 0  ? `<span class="kpi-pill neg">${Math.abs(dias)}d atraso</span>` :
    dias <= 7  ? `<span class="kpi-pill neg">${dias}d</span>` :
    dias <= 30 ? `<span class="kpi-pill warn">${dias}d</span>` :
                 `<span class="kpi-pill pos">${dias}d</span>`;

  // Taxa média ponderada
  const taxaMedia = ativas.length
    ? ativas.reduce((s, o) => s + (o.taxaMensal || 0), 0) / ativas.length
    : 0;

  document.getElementById('dashKpis').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-card-top">
        <span class="kpi-label">Dívida Total Ativa</span>
        <span class="kpi-pill pos">${ativas.length} ativa${ativas.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="kpi-value">${formatBRL(totalDivida)}</div>
      <div class="kpi-meta">Consolidado BRL</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-card-top">
        <span class="kpi-label">Parcelas do Mês</span>
        <span class="kpi-pill warn">${mesAno}</span>
      </div>
      <div class="kpi-value">${formatBRL(totalMes)}</div>
      <div class="kpi-meta">Competência do mês corrente</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-card-top">
        <span class="kpi-label">Juros Projetados 12m</span>
        <span class="kpi-pill pos">${taxaMedia > 0 ? taxaMedia.toFixed(3).replace('.',',') + '% a.m.' : '—'}</span>
      </div>
      <div class="kpi-value">${formatBRL(juros12)}</div>
      <div class="kpi-meta">Custo médio ponderado</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-card-top">
        <span class="kpi-label">Próximo Vencimento</span>
        ${proxPill}
      </div>
      <div class="kpi-value" style="font-size:1.25rem;letter-spacing:-.02em">${proxGlobal ? formatDate(proxGlobal.vencimento) : '—'}</div>
      <div class="kpi-meta ${dias !== null && dias <= 7 ? 'alert' : ''}">
        ${proxGlobal
          ? `${formatBRL(proxGlobal.parcelaBRL || proxGlobal.parcela)}`
          : 'Sem parcelas pendentes'}
      </div>
    </div>`;
}

function renderizarExposicaoCambial() {
  const finimps = operacoes.filter(o => o.tipo === 'finimp' && statusOp(o) !== 'encerrada');
  const ndfs    = operacoes.filter(o => o.tipo === 'ndf'    && statusOp(o) !== 'encerrada');
  const fxBlock = document.getElementById('fxBlock');

  if (!finimps.length && !ndfs.length) { fxBlock.style.display = 'none'; return; }
  fxBlock.style.display = '';

  // Agrupa por moeda
  const moedas = [...new Set([...finimps.map(o => o.moeda), ...ndfs.map(o => o.moeda)])].sort();
  const cards  = [];

  moedas.forEach(moeda => {
    const fi = finimps.filter(o => o.moeda === moeda);
    const nd = ndfs.filter(o => o.moeda === moeda);

    const expFinimp = fi.reduce((s, o) => s + (saldoAtual(o) || 0), 0);
    const expNdf    = nd.reduce((s, o) => {
      // NDF reduz exposição se direção = compra (importador hedgeado)
      return s + (o.direcao === 'compra' ? o.nocional : -o.nocional);
    }, 0);
    const liq = expFinimp - expNdf;
    const mtm = nd.reduce((s, o) => s + (calcMtM(o) || 0), 0);
    const mtmCls = mtm >= 0 ? 'fx-mtm-pos' : 'fx-mtm-neg';

    if (fi.length) cards.push(`
      <div class="fx-card fx-finimp">
        <div class="fx-moeda">FINIMP · ${moeda}</div>
        <div class="fx-label">Exposição FINIMP</div>
        <div class="fx-value">${formatMoeda(expFinimp, moeda)}</div>
        <div class="fx-sub">${formatBRL(expFinimp * (fi[0]?.cotacaoAtual || 1))} · cot. ${formatCotacao(fi[0]?.cotacaoAtual)}</div>
      </div>`);

    if (nd.length) {
      const ndfCompra = nd.filter(o => o.direcao === 'compra').reduce((s,o)=>s+o.nocional,0);
      const ndfVenda  = nd.filter(o => o.direcao === 'venda' ).reduce((s,o)=>s+o.nocional,0);
      cards.push(`
      <div class="fx-card fx-ndf">
        <div class="fx-moeda">NDF · ${moeda}</div>
        <div class="fx-label">Hedgeado (NDFs)</div>
        <div class="fx-value">${formatMoeda(ndfCompra + ndfVenda, moeda)}</div>
        <div class="fx-sub">Compra: ${formatMoeda(ndfCompra,moeda)} · Venda: ${formatMoeda(ndfVenda,moeda)}</div>
      </div>
      <div class="fx-card ${mtmCls}">
        <div class="fx-moeda">MtM · ${moeda}</div>
        <div class="fx-label">Resultado MtM NDFs</div>
        <div class="fx-value ${mtm >= 0 ? 'mtm-pos' : 'mtm-neg'}">${formatBRL(mtm)}</div>
        <div class="fx-sub">${nd.length} NDF(s) ativo(s)</div>
      </div>`);
    }

    if (fi.length && nd.length) {
      const liqBRL = liq * (fi[0]?.cotacaoAtual || nd[0]?.cotacaoAtual || 1);
      cards.push(`
      <div class="fx-card fx-liq">
        <div class="fx-moeda">Líquido · ${moeda}</div>
        <div class="fx-label">Exposição Líquida</div>
        <div class="fx-value ${liq > 0 ? 'val-neg' : 'mtm-pos'}">${formatMoeda(Math.abs(liq), moeda)}</div>
        <div class="fx-sub">${liq > 0 ? 'Descoberta' : 'Overhedge'} · ${formatBRL(Math.abs(liqBRL))}</div>
      </div>`);
    }
  });

  document.getElementById('fxGrid').innerHTML = cards.join('');
}

function renderizarAlertas() {
  const hj = hoje();
  const alertas = [];

  operacoes.forEach(op => {
    if (op.tipo === 'ndf') {
      if (!op.liquidada) {
        const dias = diasAte(op.dataLiquidacao);
        if (dias <= 90) alertas.push({
          opDesc: op.descricao, credor: op.contraparte || '—',
          vencimento: op.dataLiquidacao,
          valor: calcMtM(op), label: 'MtM',
          numero: '—', totalParcelas: '—', dias, isNdf: true,
        });
      }
      return;
    }
    op.parcelas?.forEach(p => {
      if (p.paga) return;
      const dias = diasAte(p.vencimento);
      if (dias <= 90) alertas.push({
        opDesc: op.descricao, credor: op.credor || op.contraparte || '—',
        vencimento: p.vencimento,
        valor: p.parcelaBRL || p.parcela,
        label: op.tipo === 'finimp' ? `${formatMoeda(p.parcela, op.moeda)}` : null,
        numero: p.numero, totalParcelas: op.numeroParcelas, dias,
      });
    });
  });

  alertas.sort((a, b) => a.vencimento.localeCompare(b.vencimento));

  const el = document.getElementById('alertsContent');
  if (!alertas.length) {
    el.innerHTML = '<p class="no-alerts">✓ Nenhum vencimento nos próximos 90 dias.</p>';
    return;
  }

  const tagAlerta = dias => {
    if (dias < 0)   return '<span class="alert-tag vencida">Vencida</span>';
    if (dias <= 7)  return '<span class="alert-tag urgente">≤ 7 dias</span>';
    if (dias <= 30) return '<span class="alert-tag proximo">≤ 30 dias</span>';
    return '<span class="alert-tag normal">≤ 90 dias</span>';
  };

  el.innerHTML = `<table class="alerts-table">
    <thead><tr>
      <th>Operação</th><th>Credor / Contraparte</th><th>Parcela</th>
      <th>Vencimento</th><th>Valor (BRL)</th><th>Situação</th>
    </tr></thead>
    <tbody>
      ${alertas.map(a => `<tr>
        <td>${a.opDesc}${a.isNdf ? ' <span class="badge-ndf">NDF</span>' : ''}</td>
        <td>${a.credor}</td>
        <td>${a.numero !== '—' ? `${a.numero}/${a.totalParcelas}` : 'Liquidação'}${a.label ? `<br><span style="font-size:.7rem;color:var(--c-muted)">${a.label}</span>` : ''}</td>
        <td>${formatDate(a.vencimento)}</td>
        <td style="text-align:right;font-weight:600">${formatBRL(a.valor)}</td>
        <td>${tagAlerta(a.dias)}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function renderizarGraficos() {
  const hj = new Date(); hj.setHours(0,0,0,0);

  // Gráfico 1 — Evolução saldo devedor 24m (BRL)
  const labels24 = [], totaisSaldo = [];
  for (let i = 0; i <= 24; i++) {
    const ref = new Date(hj); ref.setMonth(ref.getMonth() + i);
    const refStr = ref.toISOString().slice(0, 7);
    labels24.push(MESES_PT[ref.getMonth()] + '/' + String(ref.getFullYear()).slice(2));
    let total = 0;
    operacoes.filter(o => o.tipo !== 'ndf' && statusOp(o) !== 'encerrada').forEach(op => {
      const cot   = op.tipo === 'finimp' ? (op.cotacaoAtual || 1) : 1;
      const pv    = op.tipo === 'finimp' ? op.valorMoeda : op.valorContratado;
      const pars  = op.parcelas || [];
      const ate   = pars.filter(p => p.vencimento.slice(0,7) <= refStr);
      total += ate.length ? ate[ate.length-1].saldoFinal * cot : pv * cot;
    });
    totaisSaldo.push(total);
  }
  destroyChart('chartSaldo');
  chartSaldo = new Chart(document.getElementById('chartSaldo').getContext('2d'), {
    type: 'line',
    data: {
      labels: labels24,
      datasets: [{
        label: 'Saldo Devedor Total (BRL)',
        data: totaisSaldo,
        borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.08)',
        fill: true, tension: .35, pointRadius: 3, pointBackgroundColor: '#2563eb',
      }],
    },
    options: opcoesGrafico({ tickY: true }),
  });

  // Gráfico 2 — Composição por credor (rosca)
  const credorMap = {};
  operacoes.filter(o => o.tipo !== 'ndf' && statusOp(o) !== 'encerrada').forEach(op => {
    const key = op.credor || op.contraparte || '—';
    credorMap[key] = (credorMap[key] || 0) + (saldoAtualBRL(op) || 0);
  });
  const credores = Object.keys(credorMap);
  const PALETA = ['#2563eb','#4f46e5','#0891b2','#16a34a','#d97706','#dc2626','#7c3aed','#0f766e'];
  destroyChart('chartComposicao');
  chartComposicao = new Chart(document.getElementById('chartComposicao').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: credores,
      datasets: [{
        data: credores.map(c => credorMap[c]),
        backgroundColor: PALETA.slice(0, credores.length),
        borderWidth: 2, borderColor: '#fff',
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${formatBRL(ctx.parsed)}` } },
      },
    },
  });

  // Gráfico 3 — Amortização vs Juros 12m
  const labels12 = [], amortData = [], jurosData = [];
  for (let i = 0; i < 12; i++) {
    const ref = new Date(hj); ref.setMonth(ref.getMonth() + i);
    const refStr = ref.toISOString().slice(0, 7);
    labels12.push(MESES_PT[ref.getMonth()] + '/' + String(ref.getFullYear()).slice(2));
    let somaAmort = 0, somaJuros = 0;
    operacoes.filter(o => o.tipo !== 'ndf').forEach(op => {
      const cot = op.tipo === 'finimp' ? (op.cotacaoAtual || 1) : 1;
      op.parcelas?.forEach(p => {
        if (!p.paga && p.vencimento.slice(0,7) === refStr) {
          somaAmort += p.amortizacao * cot;
          somaJuros += p.juros * cot;
        }
      });
    });
    amortData.push(r2(somaAmort));
    jurosData.push(r2(somaJuros));
  }
  destroyChart('chartAmortJuros');
  chartAmortJuros = new Chart(document.getElementById('chartAmortJuros').getContext('2d'), {
    type: 'bar',
    data: {
      labels: labels12,
      datasets: [
        { label: 'Amortização', data: amortData, backgroundColor: 'rgba(37,99,235,.75)', borderRadius: 4, stack: 'stack' },
        { label: 'Juros',       data: jurosData, backgroundColor: 'rgba(220,38,38,.65)', borderRadius: 4, stack: 'stack' },
      ],
    },
    options: {
      ...opcoesGrafico({ tickY: false }),
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { stacked: true, ticks: { font: { size: 11 }, callback: v => formatBRLCurto(v) }, grid: { color: '#f1f5f9' } },
      },
    },
  });
}

let chartSaldo = null, chartComposicao = null, chartAmortJuros = null;

function destroyChart(id) {
  const existing = Chart.getChart(document.getElementById(id));
  if (existing) existing.destroy();
}
function opcoesGrafico({ tickY = false } = {}) {
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, labels: { font: { size: 11 }, boxWidth: 12 } },
      tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${formatBRL(ctx.parsed.y ?? ctx.parsed)}` } },
    },
    scales: tickY ? {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: { ticks: { font: { size: 11 }, callback: v => formatBRLCurto(v) }, grid: { color: '#f1f5f9' } },
    } : undefined,
  };
}
function formatBRLCurto(v) {
  if (Math.abs(v) >= 1e6) return 'R$ ' + (v/1e6).toFixed(1) + 'M';
  if (Math.abs(v) >= 1e3) return 'R$ ' + (v/1e3).toFixed(0) + 'k';
  return 'R$ ' + v.toFixed(0);
}

// ── OPERAÇÕES ─────────────────────────────────────────────────
function renderizarOperacoes() {
  const busca  = (document.getElementById('opsSearch').value || '').toLowerCase();
  const status = document.getElementById('filtroStatus').value;
  const tipo   = document.getElementById('filtroTipo').value;

  let lista = operacoes.filter(op => {
    const nome = (op.descricao + ' ' + (op.credor || op.contraparte || '')).toLowerCase();
    if (busca  && !nome.includes(busca))    return false;
    if (status && statusOp(op) !== status)  return false;
    if (tipo   && op.tipo !== tipo)         return false;
    return true;
  });

  document.getElementById('opsCount').textContent = `${lista.length} de ${operacoes.length} operação(ões)`;
  const tbody = document.getElementById('opsBody');
  const empty = document.getElementById('opsEmpty');
  const wrap  = document.getElementById('opsTableWrap');

  if (!lista.length) { wrap.style.display = 'none'; empty.style.display = ''; return; }
  wrap.style.display = ''; empty.style.display = 'none';

  tbody.innerHTML = lista.map(op => {
    const st = statusOp(op);

    if (op.tipo === 'ndf') {
      const mtm     = calcMtM(op);
      const dias    = diasAte(op.dataLiquidacao);
      const vencCls = dias < 0 ? 'style="color:var(--c-red);font-weight:600"' : '';
      return `<tr>
        <td><strong>${op.descricao}</strong><br><span style="font-size:.72rem;color:var(--c-muted)">NDF · ${op.observacoes || ''}</span></td>
        <td>${op.contraparte}</td>
        <td><span class="badge-ndf">NDF</span></td>
        <td><span class="badge-moeda">${op.moeda}</span> <span class="badge-${op.direcao}">${op.direcao === 'compra' ? 'Compra' : 'Venda'}</span></td>
        <td class="col-num">${formatCotacao(op.taxaTrava)}</td>
        <td class="col-num">${formatMoeda(op.nocional, op.moeda)}</td>
        <td class="col-num ${mtm >= 0 ? 'mtm-pos' : 'mtm-neg'}">${formatBRL(mtm)}</td>
        <td ${vencCls}>${formatDate(op.dataLiquidacao)}${dias < 0 ? `<br><span style="font-size:.7rem">${Math.abs(dias)}d atraso</span>` : ''}</td>
        <td><span class="badge badge-${st}">${st.charAt(0).toUpperCase()+st.slice(1)}</span></td>
        <td class="col-acoes"><div class="acoes">
          <button class="btn-icon"   onclick="abrirPlano('${op.id}')">Detalhe</button>
          <button class="btn-icon"   onclick="abrirModal('${op.id}')">✎</button>
          <button class="btn-danger" onclick="excluirOp('${op.id}')">✕</button>
        </div></td>
      </tr>`;
    }

    const prox   = proximaParcela(op);
    const saldo  = saldoAtualBRL(op);
    const dias   = prox ? diasAte(prox.vencimento) : null;
    const vencCls = dias !== null && dias < 0 ? 'style="color:var(--c-red);font-weight:600"' : '';
    const parcelaBRL = prox ? (prox.parcelaBRL || prox.parcela) : null;
    const isFi = op.tipo === 'finimp';

    return `<tr>
      <td><strong>${op.descricao}</strong><br>
        <span style="font-size:.72rem;color:var(--c-muted)">
          ${FINALIDADE_LABEL[op.finalidade]||''} · ${isFi ? op.moeda : (INDEXADOR_LABEL[op.indexador]||'')}
        </span>
      </td>
      <td>${op.credor || '—'}</td>
      <td>
        <span class="label-tipo">${TIPO_LABEL[op.tipo]||op.tipo}</span>
        ${isFi ? `<br><span class="badge-moeda">${op.moeda}</span>` : ''}
      </td>
      <td><span class="label-sis">${SISTEMA_LABEL[op.sistema]||op.sistema}</span></td>
      <td class="col-num">${formatPct(op.taxaMensal)}</td>
      <td class="col-num" style="font-weight:700">
        ${formatBRL(saldo)}
        ${isFi ? `<br><span style="font-size:.7rem;color:var(--c-muted)">${formatMoeda(saldoAtual(op), op.moeda)}</span>` : ''}
      </td>
      <td class="col-num">
        ${prox ? formatBRL(parcelaBRL) : '—'}
        ${isFi && prox ? `<br><span style="font-size:.7rem;color:var(--c-muted)">${formatMoeda(prox.parcela, op.moeda)}</span>` : ''}
      </td>
      <td ${vencCls}>${prox ? formatDate(prox.vencimento) + (dias < 0 ? `<br><span style="font-size:.7rem">${Math.abs(dias)}d atraso</span>` : '') : '—'}</td>
      <td><span class="badge badge-${st}">${st.charAt(0).toUpperCase()+st.slice(1)}</span></td>
      <td class="col-acoes"><div class="acoes">
        <button class="btn-icon"   onclick="abrirPlano('${op.id}')">Plano</button>
        <button class="btn-icon"   onclick="abrirModal('${op.id}')">✎</button>
        <button class="btn-danger" onclick="excluirOp('${op.id}')">✕</button>
      </div></td>
    </tr>`;
  }).join('');
}

function excluirOp(id) {
  const op = operacoes.find(o => o.id === id);
  if (!op || !confirm(`Excluir "${op.descricao}"?\nEsta ação não pode ser desfeita.`)) return;
  operacoes = operacoes.filter(o => o.id !== id);
  salvarDados();
  renderizarOperacoes();
  if (abaAtual === 'dashboard') renderizarDashboard();
}

// ── MODAL ─────────────────────────────────────────────────────
function setCat(cat) {
  catModal = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  document.getElementById('formPadrao').style.display = cat === 'padrao' ? '' : 'none';
  document.getElementById('formFinimp').style.display = cat === 'finimp' ? '' : 'none';
  document.getElementById('formNdf').style.display    = cat === 'ndf'    ? '' : 'none';
}

function abrirModal(id = null) {
  opEditandoId = id;
  document.getElementById('modalTitle').textContent = id ? 'Editar Operação' : 'Nova Operação';

  if (id) {
    const op = operacoes.find(o => o.id === id);
    if (!op) return;

    if (op.tipo === 'finimp') {
      setCat('finimp');
      document.getElementById('fiDescricao').value         = op.descricao;
      document.getElementById('fiCredor').value            = op.credor || '';
      document.getElementById('fiFinalidade').value        = op.finalidade || 'importacao';
      document.getElementById('fiMoeda').value             = op.moeda || 'USD';
      document.getElementById('fiObservacoes').value       = op.observacoes || '';
      document.getElementById('fiValorMoeda').value        = op.valorMoeda;
      document.getElementById('fiCotacaoContratacao').value= op.cotacaoContratacao;
      document.getElementById('fiCotacaoAtual').value      = op.cotacaoAtual;
      document.getElementById('fiDataContratacao').value   = op.dataContratacao;
      document.getElementById('fiNParcelas').value         = op.numeroParcelas;
      document.getElementById('fiPeriodicidade').value     = op.periodicidade;
      document.getElementById('fiDiaVenc').value           = op.diaVencimento;
      document.getElementById('fiTaxa').value              = op.taxaMensal;
      document.getElementById('fiSistema').value           = op.sistema;
    } else if (op.tipo === 'ndf') {
      setCat('ndf');
      document.getElementById('ndfDescricao').value        = op.descricao;
      document.getElementById('ndfContraparte').value      = op.contraparte || '';
      document.getElementById('ndfMoeda').value            = op.moeda || 'USD';
      document.getElementById('ndfDirecao').value          = op.direcao || 'compra';
      document.getElementById('ndfObservacoes').value      = op.observacoes || '';
      document.getElementById('ndfNocional').value         = op.nocional;
      document.getElementById('ndfTaxaTrava').value        = op.taxaTrava;
      document.getElementById('ndfCotacaoAtual').value     = op.cotacaoAtual;
      document.getElementById('ndfDataContratacao').value  = op.dataContratacao;
      document.getElementById('ndfDataLiquidacao').value   = op.dataLiquidacao;
    } else {
      setCat('padrao');
      document.getElementById('opDescricao').value         = op.descricao;
      document.getElementById('opCredor').value            = op.credor;
      document.getElementById('opTipo').value              = op.tipo;
      document.getElementById('opFinalidade').value        = op.finalidade;
      document.getElementById('opGarantias').value         = op.garantias || '';
      document.getElementById('opObservacoes').value       = op.observacoes || '';
      document.getElementById('opValor').value             = op.valorContratado;
      document.getElementById('opDataContratacao').value   = op.dataContratacao;
      document.getElementById('opNParcelas').value         = op.numeroParcelas;
      document.getElementById('opPeriodicidade').value     = op.periodicidade;
      document.getElementById('opDiaVenc').value           = op.diaVencimento;
      document.getElementById('opTaxa').value              = op.taxaMensal;
      document.getElementById('opIndexador').value         = op.indexador;
      document.getElementById('opSistema').value           = op.sistema;
    }
  } else {
    setCat('padrao');
    ['opDescricao','opCredor','opGarantias','opObservacoes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('opTipo').value            = 'emprestimo';
    document.getElementById('opFinalidade').value      = 'capital_giro';
    document.getElementById('opValor').value           = '';
    document.getElementById('opDataContratacao').value = hoje();
    document.getElementById('opNParcelas').value       = '';
    document.getElementById('opPeriodicidade').value   = 'mensal';
    document.getElementById('opDiaVenc').value         = '15';
    document.getElementById('opTaxa').value            = '';
    document.getElementById('opIndexador').value       = 'prefixado';
    document.getElementById('opSistema').value         = 'price';
  }

  document.getElementById('modalOverlay').classList.add('is-open');
  document.getElementById('modal').classList.add('is-open');
  document.getElementById('modal').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function fecharModal() {
  document.getElementById('modalOverlay').classList.remove('is-open');
  document.getElementById('modal').classList.remove('is-open');
  document.getElementById('modal').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function salvarModal() {
  let novaOp;
  const exOp = opEditandoId ? operacoes.find(o => o.id === opEditandoId) : null;

  if (catModal === 'ndf') {
    const descricao      = document.getElementById('ndfDescricao').value.trim();
    const contraparte    = document.getElementById('ndfContraparte').value.trim();
    const nocionalStr    = document.getElementById('ndfNocional').value;
    const travaStr       = document.getElementById('ndfTaxaTrava').value;
    const cotAtualStr    = document.getElementById('ndfCotacaoAtual').value;
    const dataContratacao= document.getElementById('ndfDataContratacao').value;
    const dataLiquidacao = document.getElementById('ndfDataLiquidacao').value;

    if (!descricao || !contraparte || !nocionalStr || !travaStr || !cotAtualStr || !dataContratacao || !dataLiquidacao) {
      alert('Preencha todos os campos obrigatórios (*).'); return;
    }
    novaOp = {
      id:              opEditandoId || uid(),
      tipo:            'ndf',
      descricao,
      contraparte,
      moeda:           document.getElementById('ndfMoeda').value,
      direcao:         document.getElementById('ndfDirecao').value,
      observacoes:     document.getElementById('ndfObservacoes').value.trim(),
      nocional:        parseFloat(nocionalStr),
      taxaTrava:       parseFloat(travaStr),
      cotacaoAtual:    parseFloat(cotAtualStr),
      dataContratacao,
      dataLiquidacao,
      liquidada:       exOp?.liquidada || false,
      parcelas:        [],
    };

  } else if (catModal === 'finimp') {
    const descricao      = document.getElementById('fiDescricao').value.trim();
    const credor         = document.getElementById('fiCredor').value.trim();
    const valorMoedaStr  = document.getElementById('fiValorMoeda').value;
    const cotContStr     = document.getElementById('fiCotacaoContratacao').value;
    const cotAtualStr    = document.getElementById('fiCotacaoAtual').value;
    const dataContratacao= document.getElementById('fiDataContratacao').value;
    const nParcelasStr   = document.getElementById('fiNParcelas').value;
    const taxaStr        = document.getElementById('fiTaxa').value;

    if (!descricao || !credor || !valorMoedaStr || !cotContStr || !cotAtualStr || !dataContratacao || !nParcelasStr || !taxaStr) {
      alert('Preencha todos os campos obrigatórios (*).'); return;
    }
    novaOp = {
      id:                   opEditandoId || uid(),
      tipo:                 'finimp',
      descricao,
      credor,
      finalidade:           document.getElementById('fiFinalidade').value,
      moeda:                document.getElementById('fiMoeda').value,
      observacoes:          document.getElementById('fiObservacoes').value.trim(),
      valorMoeda:           parseFloat(valorMoedaStr),
      cotacaoContratacao:   parseFloat(cotContStr),
      cotacaoAtual:         parseFloat(cotAtualStr),
      valorContratado:      r2(parseFloat(valorMoedaStr) * parseFloat(cotContStr)),
      dataContratacao,
      numeroParcelas:       parseInt(nParcelasStr, 10),
      periodicidade:        document.getElementById('fiPeriodicidade').value,
      diaVencimento:        parseInt(document.getElementById('fiDiaVenc').value, 10) || 15,
      taxaMensal:           parseFloat(taxaStr),
      indexador:            'prefixado',
      sistema:              document.getElementById('fiSistema').value,
      parcelas:             exOp?.parcelas || [],
    };
    novaOp.parcelas = gerarPlano(novaOp);

  } else {
    // Padrão
    const descricao      = document.getElementById('opDescricao').value.trim();
    const credor         = document.getElementById('opCredor').value.trim();
    const valorStr       = document.getElementById('opValor').value;
    const dataContratacao= document.getElementById('opDataContratacao').value;
    const nParcelasStr   = document.getElementById('opNParcelas').value;
    const taxaStr        = document.getElementById('opTaxa').value;

    if (!descricao || !credor || !valorStr || !dataContratacao || !nParcelasStr || !taxaStr) {
      alert('Preencha todos os campos obrigatórios (*).'); return;
    }
    novaOp = {
      id:              opEditandoId || uid(),
      tipo:            document.getElementById('opTipo').value,
      descricao,
      credor,
      finalidade:      document.getElementById('opFinalidade').value,
      garantias:       document.getElementById('opGarantias').value.trim(),
      observacoes:     document.getElementById('opObservacoes').value.trim(),
      valorContratado: parseFloat(valorStr),
      dataContratacao,
      numeroParcelas:  parseInt(nParcelasStr, 10),
      periodicidade:   document.getElementById('opPeriodicidade').value,
      diaVencimento:   parseInt(document.getElementById('opDiaVenc').value, 10) || 15,
      taxaMensal:      parseFloat(taxaStr),
      indexador:       document.getElementById('opIndexador').value,
      sistema:         document.getElementById('opSistema').value,
      parcelas:        exOp?.parcelas || [],
    };
    novaOp.parcelas = gerarPlano(novaOp);
  }

  if (opEditandoId) {
    const idx = operacoes.findIndex(o => o.id === opEditandoId);
    if (idx >= 0) operacoes[idx] = novaOp;
  } else {
    operacoes.push(novaOp);
  }

  salvarDados();
  fecharModal();
  if (abaAtual === 'dashboard') renderizarDashboard();
  if (abaAtual === 'operacoes') renderizarOperacoes();
}

// ── DRAWER — DETALHE / PLANO ──────────────────────────────────
function abrirPlano(id) {
  drawerOpId = id;
  const op = operacoes.find(o => o.id === id);
  if (!op) return;

  document.getElementById('drawerTitle').textContent = op.descricao;

  if (op.tipo === 'ndf') {
    renderizarDetalheNDF(op);
  } else {
    const isFi = op.tipo === 'finimp';
    document.getElementById('drawerSub').textContent =
      `${op.credor} · ${TIPO_LABEL[op.tipo]} · ${SISTEMA_LABEL[op.sistema]} · ${formatPct(op.taxaMensal)} a.m.${isFi ? ' · ' + op.moeda + ' · cot. ' + formatCotacao(op.cotacaoAtual) : ''}`;
    renderizarPlano(op);
  }

  document.getElementById('drawerOverlay').classList.add('is-open');
  document.getElementById('drawer').classList.add('is-open');
  document.getElementById('drawer').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function fecharDrawer() {
  document.getElementById('drawerOverlay').classList.remove('is-open');
  document.getElementById('drawer').classList.remove('is-open');
  document.getElementById('drawer').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  drawerOpId = null;
}

function renderizarPlano(op) {
  const parcelas = op.parcelas || [];
  const hj       = hoje();
  const isFi     = op.tipo === 'finimp';
  const cot      = isFi ? (op.cotacaoAtual || 1) : 1;

  const totalParcela = parcelas.reduce((s, p) => s + p.parcela, 0);
  const totalJuros   = parcelas.reduce((s, p) => s + p.juros, 0);
  const pagas        = parcelas.filter(p => p.paga).length;
  const pctPago      = parcelas.length ? (pagas / parcelas.length * 100).toFixed(0) : 0;

  document.getElementById('drawerKpis').innerHTML = `
    <div class="drawer-kpi">
      <div class="kpi-label">Valor Contratado</div>
      <div class="kpi-value">${isFi ? formatMoeda(op.valorMoeda, op.moeda) : formatBRL(op.valorContratado)}</div>
      ${isFi ? `<div class="kpi-meta">${formatBRL(op.valorContratado)} na contratação</div>` : ''}
    </div>
    <div class="drawer-kpi">
      <div class="kpi-label">Saldo Devedor</div>
      <div class="kpi-value" style="color:var(--c-red)">${isFi ? formatMoeda(saldoAtual(op), op.moeda) : formatBRL(saldoAtual(op))}</div>
      ${isFi ? `<div class="kpi-meta">${formatBRL(saldoAtualBRL(op))} · cot. ${formatCotacao(op.cotacaoAtual)}</div>` : ''}
    </div>
    <div class="drawer-kpi">
      <div class="kpi-label">Total de Juros</div>
      <div class="kpi-value">${isFi ? formatMoeda(totalJuros, op.moeda) : formatBRL(totalJuros)}</div>
      ${isFi ? `<div class="kpi-meta">${formatBRL(totalJuros * cot)}</div>` : ''}
    </div>
    <div class="drawer-kpi">
      <div class="kpi-label">Progresso</div>
      <div class="kpi-value">${pagas}/${parcelas.length} <span style="font-size:.8rem;font-weight:400;color:var(--c-muted)">(${pctPago}%)</span></div>
    </div>`;

  // Cabeçalho dinâmico
  const headMoeda = isFi ? `<th class="col-num">${op.moeda}</th>` : '';
  document.getElementById('drawerPlanoHead').innerHTML = `<tr>
    <th class="col-num">Nº</th><th>Vencimento</th>
    <th class="col-num">Saldo Inicial</th><th class="col-num">Amortização</th>
    <th class="col-num">Juros</th><th class="col-num">Parcela</th>
    ${isFi ? `<th class="col-num">Parcela BRL</th>` : ''}
    <th class="col-num">Saldo Final</th>
    <th class="col-status">Status</th><th class="col-pago">Pago</th>
  </tr>`;

  document.getElementById('drawerBody').innerHTML = parcelas.map(p => {
    const atrasada = !p.paga && p.vencimento < hj;
    const rowCls   = p.paga ? 'plano-row-paga' : atrasada ? 'plano-row-vencida' : '';
    const st       = p.paga ? '<span class="badge badge-encerrada">Pago</span>'
                   : atrasada ? '<span class="badge badge-vencida">Vencida</span>'
                   : '<span class="badge badge-ativa">Pendente</span>';

    return `<tr class="${rowCls}">
      <td class="col-num">${p.numero}</td>
      <td>${formatDate(p.vencimento)}</td>
      <td class="col-num">${isFi ? formatMoeda(p.saldoInicial, op.moeda) : formatBRL(p.saldoInicial)}</td>
      <td class="col-num">${isFi ? formatMoeda(p.amortizacao, op.moeda) : formatBRL(p.amortizacao)}</td>
      <td class="col-num">${isFi ? formatMoeda(p.juros, op.moeda) : formatBRL(p.juros)}</td>
      <td class="col-num" style="font-weight:700">${isFi ? formatMoeda(p.parcela, op.moeda) : formatBRL(p.parcela)}</td>
      ${isFi ? `<td class="col-num">${formatBRL(p.parcelaBRL)}</td>` : ''}
      <td class="col-num">${isFi ? formatMoeda(p.saldoFinal, op.moeda) : formatBRL(p.saldoFinal)}</td>
      <td class="col-status">${st}</td>
      <td class="col-pago" style="text-align:center">
        <input type="checkbox" class="check-pago" ${p.paga ? 'checked' : ''}
          onchange="marcarPaga('${op.id}', ${p.numero}, this.checked)">
      </td>
    </tr>`;
  }).join('');
}

function renderizarDetalheNDF(op) {
  const mtm     = calcMtM(op) || 0;
  const nocBRL  = op.nocional * (op.cotacaoAtual || 0);
  const travaBRL= op.nocional * (op.taxaTrava   || 0);
  const dias    = diasAte(op.dataLiquidacao);

  document.getElementById('drawerSub').textContent =
    `${op.contraparte} · NDF ${op.moeda} · ${op.direcao === 'compra' ? 'Compra' : 'Venda'} · Liquidação: ${formatDate(op.dataLiquidacao)}`;

  document.getElementById('drawerKpis').innerHTML = `
    <div class="drawer-kpi">
      <div class="kpi-label">Nocional</div>
      <div class="kpi-value">${formatMoeda(op.nocional, op.moeda)}</div>
      <div class="kpi-meta">${formatBRL(nocBRL)} à cot. atual</div>
    </div>
    <div class="drawer-kpi">
      <div class="kpi-label">Taxa Trava</div>
      <div class="kpi-value">${formatCotacao(op.taxaTrava)}</div>
      <div class="kpi-meta">${formatBRL(travaBRL)} em BRL</div>
    </div>
    <div class="drawer-kpi">
      <div class="kpi-label">Cotação Atual</div>
      <div class="kpi-value">${formatCotacao(op.cotacaoAtual)}</div>
      <div class="kpi-meta">Variação: ${((op.cotacaoAtual / op.taxaTrava - 1)*100).toFixed(2)}%</div>
    </div>
    <div class="drawer-kpi">
      <div class="kpi-label">MtM (BRL)</div>
      <div class="kpi-value ${mtm >= 0 ? 'mtm-pos' : 'mtm-neg'}">${formatBRL(mtm)}</div>
      <div class="kpi-meta">${dias < 0 ? Math.abs(dias)+'d em atraso' : dias === 0 ? 'Vence hoje' : 'em '+dias+' dias'}</div>
    </div>`;

  document.getElementById('drawerPlanoHead').innerHTML = `<tr>
    <th>Campo</th><th>Valor</th>
  </tr>`;

  const linhas = [
    ['Tipo', 'NDF'],
    ['Moeda', op.moeda],
    ['Direção', op.direcao === 'compra' ? 'Compra (Long)' : 'Venda (Short)'],
    ['Contraparte', op.contraparte],
    ['Nocional', formatMoeda(op.nocional, op.moeda)],
    ['Nocional em BRL (trava)', formatBRL(travaBRL)],
    ['Nocional em BRL (atual)', formatBRL(nocBRL)],
    ['Taxa Trava', formatCotacao(op.taxaTrava)],
    ['Cotação Atual', formatCotacao(op.cotacaoAtual)],
    ['Data Contratação', formatDate(op.dataContratacao)],
    ['Data Liquidação', formatDate(op.dataLiquidacao)],
    ['Dias para Liquidação', dias < 0 ? Math.abs(dias)+' dias em atraso' : dias+' dias'],
    ['MtM Atual (BRL)', formatBRL(mtm)],
    ['Resultado Esperado', mtm >= 0 ? 'Ganho' : 'Perda'],
    ['Observações', op.observacoes || '—'],
  ];

  document.getElementById('drawerBody').innerHTML = linhas.map(([k, v]) => `
    <tr>
      <td style="font-weight:600;color:var(--c-navy-md);width:200px">${k}</td>
      <td>${v}</td>
    </tr>`).join('');

  // Botão de marcar liquidada
  const jaBtnLiq = document.getElementById('btnLiquidarNDF');
  if (!jaBtnLiq) {
    const btnLiq = document.createElement('button');
    btnLiq.id        = 'btnLiquidarNDF';
    btnLiq.className = op.liquidada ? 'btn-secondary' : 'btn-primary';
    btnLiq.style.margin = '1rem 1.5rem';
    btnLiq.textContent = op.liquidada ? '✓ Liquidada' : 'Marcar como Liquidada';
    btnLiq.onclick = () => {
      op.liquidada = !op.liquidada;
      salvarDados();
      renderizarDetalheNDF(op);
      if (abaAtual === 'dashboard') renderizarDashboard();
      if (abaAtual === 'operacoes') renderizarOperacoes();
    };
    document.getElementById('drawer').appendChild(btnLiq);
  } else {
    jaBtnLiq.className   = op.liquidada ? 'btn-secondary' : 'btn-primary';
    jaBtnLiq.textContent = op.liquidada ? '✓ Liquidada' : 'Marcar como Liquidada';
    jaBtnLiq.onclick = () => {
      op.liquidada = !op.liquidada;
      salvarDados();
      renderizarDetalheNDF(op);
      if (abaAtual === 'dashboard') renderizarDashboard();
      if (abaAtual === 'operacoes') renderizarOperacoes();
    };
  }
}

function marcarPaga(opId, numeroParcela, paga) {
  const op = operacoes.find(o => o.id === opId);
  if (!op) return;
  const p = op.parcelas.find(p => p.numero === numeroParcela);
  if (!p) return;
  p.paga = paga;
  p.dataPagamento = paga ? hoje() : null;
  salvarDados();
  renderizarPlano(op);
  if (abaAtual === 'dashboard') renderizarDashboard();
  if (abaAtual === 'operacoes') renderizarOperacoes();
}

function exportarPlanoCSV() {
  const op = operacoes.find(o => o.id === drawerOpId);
  if (!op) return;

  if (op.tipo === 'ndf') {
    const mtm   = calcMtM(op) || 0;
    const linhas = [
      ['Campo', 'Valor'],
      ['Descrição', op.descricao],
      ['Contraparte', op.contraparte],
      ['Moeda', op.moeda],
      ['Direção', op.direcao],
      ['Nocional', op.nocional],
      ['Taxa Trava', op.taxaTrava],
      ['Cotação Atual', op.cotacaoAtual],
      ['Data Contratação', formatDate(op.dataContratacao)],
      ['Data Liquidação', formatDate(op.dataLiquidacao)],
      ['MtM BRL', formatBRL(mtm)],
    ];
    gerarDownloadCSV(linhas, `NDF_${op.descricao.replace(/\s+/g,'_').slice(0,30)}_${hoje()}.csv`);
    return;
  }

  const isFi = op.tipo === 'finimp';
  const cab  = isFi
    ? ['Nº','Vencimento','Saldo Inicial','Amortização','Juros','Parcela (moeda)','Parcela BRL','Saldo Final','Status']
    : ['Nº','Vencimento','Saldo Inicial','Amortização','Juros','Parcela','Saldo Final','Status','Data Pagamento'];

  const linhas = op.parcelas.map(p => isFi
    ? [p.numero, formatDate(p.vencimento),
       formatMoeda(p.saldoInicial, op.moeda), formatMoeda(p.amortizacao, op.moeda),
       formatMoeda(p.juros, op.moeda), formatMoeda(p.parcela, op.moeda),
       formatBRL(p.parcelaBRL), formatMoeda(p.saldoFinal, op.moeda),
       p.paga ? 'Pago' : (p.vencimento < hoje() ? 'Vencida' : 'Pendente')]
    : [p.numero, formatDate(p.vencimento),
       formatBRL(p.saldoInicial), formatBRL(p.amortizacao),
       formatBRL(p.juros), formatBRL(p.parcela),
       formatBRL(p.saldoFinal),
       p.paga ? 'Pago' : (p.vencimento < hoje() ? 'Vencida' : 'Pendente'),
       p.dataPagamento ? formatDate(p.dataPagamento) : '']);

  gerarDownloadCSV([cab, ...linhas], `Plano_${op.descricao.replace(/\s+/g,'_').slice(0,30)}_${hoje()}.csv`);
}

function gerarDownloadCSV(linhas, nome) {
  const csv = linhas.map(row => row.map(c => `"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: nome }).click();
  URL.revokeObjectURL(url);
}

// ── SIMULADOR ─────────────────────────────────────────────────
function initSimulador() {
  if (!document.getElementById('simData').value)
    document.getElementById('simData').value = hoje();
}

function calcularSimulacao() {
  const valor       = parseFloat(document.getElementById('simValor').value);
  const taxa        = parseFloat(document.getElementById('simTaxa').value);
  const nParcelas   = parseInt(document.getElementById('simNParcelas').value, 10);
  const periodicidade = document.getElementById('simPeriodicidade').value;
  const sistema     = document.getElementById('simSistema').value;
  const dataInicial = document.getElementById('simData').value;

  if (!valor || !taxa || !nParcelas || valor <= 0 || taxa < 0 || nParcelas < 1 || !dataInicial) {
    alert('Preencha todos os parâmetros da simulação.'); return;
  }

  const opSim = {
    id: '__sim__', descricao: 'Simulação', credor: '', tipo: 'emprestimo',
    finalidade: 'outro', valorContratado: valor, dataContratacao: dataInicial,
    numeroParcelas: nParcelas, periodicidade, diaVencimento: 15,
    taxaMensal: taxa, indexador: 'prefixado', sistema, parcelas: [],
  };
  const parcelas     = gerarPlano(opSim);
  const totalParcela = parcelas.reduce((s, p) => s + p.parcela, 0);
  const totalJuros   = parcelas.reduce((s, p) => s + p.juros, 0);
  const r            = taxaPeriodo(taxa, periodicidade);

  document.getElementById('simKpis').innerHTML = `
    <div class="sim-kpi"><div class="kpi-label">Valor Financiado</div><div class="kpi-value">${formatBRL(valor)}</div></div>
    <div class="sim-kpi"><div class="kpi-label">Total Pago</div><div class="kpi-value">${formatBRL(totalParcela)}</div></div>
    <div class="sim-kpi"><div class="kpi-label">Total de Juros</div><div class="kpi-value" style="color:var(--c-red)">${formatBRL(totalJuros)}</div></div>
    <div class="sim-kpi"><div class="kpi-label">Taxa do Período</div><div class="kpi-value">${formatPct(r*100)}</div><div class="kpi-meta">${formatPct(taxa)} a.m.</div></div>
    ${sistema === 'price' ? `<div class="sim-kpi"><div class="kpi-label">Parcela Fixa</div><div class="kpi-value">${formatBRL(parcelas[0]?.parcela)}</div></div>` : ''}
    ${sistema === 'sac'   ? `<div class="sim-kpi"><div class="kpi-label">1ª Parcela</div><div class="kpi-value">${formatBRL(parcelas[0]?.parcela)}</div></div>` : ''}
    ${sistema === 'sac'   ? `<div class="sim-kpi"><div class="kpi-label">Última Parcela</div><div class="kpi-value">${formatBRL(parcelas[parcelas.length-1]?.parcela)}</div></div>` : ''}`;

  document.getElementById('simBody').innerHTML = parcelas.map(p => `<tr>
    <td class="col-num">${p.numero}</td><td>${formatDate(p.vencimento)}</td>
    <td class="col-num">${formatBRL(p.saldoInicial)}</td><td class="col-num">${formatBRL(p.amortizacao)}</td>
    <td class="col-num">${formatBRL(p.juros)}</td>
    <td class="col-num" style="font-weight:700">${formatBRL(p.parcela)}</td>
    <td class="col-num">${formatBRL(p.saldoFinal)}</td>
  </tr>`).join('');

  document.getElementById('simResult').style.display = '';
}

// ── COTAÇÕES AO VIVO ──────────────────────────────────────────
const RATE_CACHE_KEY = 'ef_cotacoes_v1';
const RATE_CACHE_TTL = 3600000; // 1 hora

/**
 * Busca cotação R$/moeda na API pública (sem chave).
 * Usa duas fontes com fallback:
 *   1. exchangerate-api.com (gratuito, sem auth)
 *   2. open.er-api.com (fallback)
 * Cache local de 1h para evitar chamadas repetidas.
 */
async function buscarCotacoes(forcar = false) {
  const moedas = moedasNecessarias();
  if (!moedas.length) return;

  const btnAtualizar = document.getElementById('btnAtualizarCotacoes');
  if (btnAtualizar) { btnAtualizar.disabled = true; btnAtualizar.textContent = '↻ Buscando…'; }

  // Verifica cache (exceto se forçado)
  if (!forcar) {
    try {
      const cached = JSON.parse(localStorage.getItem(RATE_CACHE_KEY) || '{}');
      if (cached.timestamp && (Date.now() - cached.timestamp) < RATE_CACHE_TTL
          && moedas.every(m => cached.rates?.[m])) {
        aplicarCotacoes(cached.rates, cached.timestamp, true);
        if (btnAtualizar) { btnAtualizar.disabled = false; btnAtualizar.textContent = '↻ Atualizar'; }
        return;
      }
    } catch { /* ignora cache corrompido */ }
  }

  try {
    const rates = {};
    await Promise.all(moedas.map(async moeda => {
      let cotBRL = null;

      // Fonte 1 — exchangerate-api.com
      try {
        const res  = await fetch(`https://api.exchangerate-api.com/v4/latest/${moeda}`, { cache: 'no-store' });
        const data = await res.json();
        cotBRL = data?.rates?.BRL;
      } catch { /* tenta fonte 2 */ }

      // Fonte 2 — open.er-api.com
      if (!cotBRL) {
        try {
          const res  = await fetch(`https://open.er-api.com/v6/latest/${moeda}`, { cache: 'no-store' });
          const data = await res.json();
          cotBRL = data?.rates?.BRL;
        } catch { /* sem internet ou API fora */ }
      }

      if (cotBRL) rates[moeda] = r2(cotBRL);
    }));

    if (Object.keys(rates).length) {
      const timestamp = Date.now();
      localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rates, timestamp }));
      aplicarCotacoes(rates, timestamp, false);
    } else {
      // Usa cache expirado como fallback
      carregarCacheExpirado();
    }
  } catch {
    carregarCacheExpirado();
  } finally {
    if (btnAtualizar) { btnAtualizar.disabled = false; btnAtualizar.textContent = '↻ Atualizar'; }
  }
}

function carregarCacheExpirado() {
  try {
    const cached = JSON.parse(localStorage.getItem(RATE_CACHE_KEY) || '{}');
    if (cached.rates) aplicarCotacoes(cached.rates, cached.timestamp, true);
  } catch { /* sem cache disponível */ }
}

function moedasNecessarias() {
  return [...new Set(
    operacoes
      .filter(o => (o.tipo === 'finimp' || o.tipo === 'ndf') && statusOp(o) !== 'encerrada')
      .map(o => o.moeda)
  )].filter(Boolean);
}

/**
 * Aplica as cotações em todas as operações FINIMP e NDF,
 * guarda a cotação anterior para calcular a variação,
 * e força re-render.
 */
function aplicarCotacoes(rates, timestamp, doCacheCache) {
  // Guarda cotações anteriores para mostrar variação
  let prevRates = {};
  try {
    prevRates = JSON.parse(localStorage.getItem('ef_cotacoes_prev') || '{}');
  } catch { }

  let changed = false;
  operacoes.forEach(op => {
    if ((op.tipo === 'finimp' || op.tipo === 'ndf') && rates[op.moeda]) {
      const novaCot = rates[op.moeda];
      if (op.cotacaoAtual !== novaCot) {
        op.cotacaoAtual = novaCot;
        if (op.tipo === 'finimp') op.parcelas = gerarPlano(op); // recalcula BRL
        changed = true;
      }
    }
  });

  if (changed) salvarDados();

  // Salva prev para próxima atualização
  if (!doCacheCache) {
    localStorage.setItem('ef_cotacoes_prev', JSON.stringify(rates));
  }

  renderizarWidgetCotacoes(rates, prevRates, timestamp, doCacheCache);

  if (abaAtual === 'dashboard') {
    renderizarKPIsDash();
    renderizarExposicaoCambial();
  }
  if (abaAtual === 'operacoes') renderizarOperacoes();
}

function renderizarWidgetCotacoes(rates, prevRates, timestamp, fromCache) {
  const moedas = Object.keys(rates);
  const bar    = document.getElementById('cotacoesBar');
  if (!moedas.length) { bar.style.display = 'none'; return; }

  bar.style.display = '';

  const chips = moedas.map(moeda => {
    const val  = rates[moeda];
    const prev = prevRates[moeda];
    let varHtml = '';
    if (prev && prev !== val) {
      const delta = ((val / prev) - 1) * 100;
      const cls   = delta > 0 ? 'up' : 'dn';
      const sinal = delta > 0 ? '▲' : '▼';
      varHtml = `<span class="chip-var ${cls}">${sinal} ${Math.abs(delta).toFixed(2)}%</span>`;
    } else if (prev === val) {
      varHtml = `<span class="chip-var neu">—</span>`;
    }
    return `<div class="cotacao-chip">
      <span class="chip-moeda">${moeda}/BRL</span>
      <span class="chip-val">${val.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</span>
      ${varHtml}
    </div>`;
  }).join('');

  document.getElementById('cotacoesChips').innerHTML = chips;

  const dtStr = timestamp
    ? new Date(timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : '—';
  document.getElementById('cotacoesTs').textContent =
    (fromCache ? 'Cache de ' : 'Atualizado em ') + dtStr;
}

// ── EVENT LISTENERS ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Carrega do localStorage imediatamente — UI aparece sem delay
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    operacoes = raw ? JSON.parse(raw) : [];
  } catch { operacoes = []; }

  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.addEventListener('click', () => mostrarAba(btn.dataset.tab)));

  document.getElementById('btnNovaOp').addEventListener('click', () => abrirModal());
  document.getElementById('btnNovaOpEmpty')?.addEventListener('click', () => abrirModal());

  // Categoria do modal
  document.querySelectorAll('.cat-btn').forEach(btn =>
    btn.addEventListener('click', () => setCat(btn.dataset.cat)));

  document.getElementById('modalOverlay').addEventListener('click', fecharModal);
  document.getElementById('modalClose').addEventListener('click', fecharModal);
  document.getElementById('modalCancel').addEventListener('click', fecharModal);
  document.getElementById('modalSave').addEventListener('click', salvarModal);

  document.getElementById('drawerOverlay').addEventListener('click', fecharDrawer);
  document.getElementById('drawerClose').addEventListener('click', fecharDrawer);
  document.getElementById('drawerExport').addEventListener('click', exportarPlanoCSV);

  document.getElementById('opsSearch').addEventListener('input', renderizarOperacoes);
  document.getElementById('filtroStatus').addEventListener('change', renderizarOperacoes);
  document.getElementById('filtroTipo').addEventListener('change',   renderizarOperacoes);

  document.getElementById('btnSimular').addEventListener('click', calcularSimulacao);

  // Botão atualizar cotações
  document.getElementById('btnAtualizarCotacoes').addEventListener('click', () => buscarCotacoes(true));

  // 2. Renderiza imediatamente com dados locais
  renderizarDashboard();

  // 3. Sincroniza com nuvem em background sem bloquear a UI
  if (typeof Auth !== 'undefined') {
    Auth.init().then(async user => {
      if (!user) return;
      try {
        const cloud = await CloudStorage.get(STORAGE_KEY);
        if (cloud && Array.isArray(cloud) && cloud.length > 0) {
          operacoes = cloud;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cloud));
          renderizarDashboard();
          if (abaAtual === 'operacoes') renderizarOperacoes();
        }
      } catch {}
    }).catch(() => {});
  }

  // Busca cotações automaticamente no carregamento (usa cache se disponível)
  buscarCotacoes(false);

  // Auto-refresh a cada 5 minutos se a aba estiver visível
  setInterval(() => {
    if (!document.hidden && moedasNecessarias().length) buscarCotacoes(false);
  }, 5 * 60 * 1000);

  document.getElementById('footerTs').textContent = 'Atualizado em ' + new Date().toLocaleString('pt-BR');
});
