/* ============================================================
   DRE — Demonstração do Resultado do Exercício
   app.js
   ============================================================ */

'use strict';

// ── CONSTANTES ───────────────────────────────────────────────

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

/**
 * Classificação das contas contábeis nas linhas da DRE.
 * Retorna null para contas que não fazem parte da DRE operacional.
 *
 * Sinal adotado: DRE_VALUE = -SALDO
 *   • Contas de receita (3101): SALDO negativo (crédito) → -SALDO = positivo ✓
 *   • Deduções  (3103): SALDO positivo (débito) → -SALDO = negativo ✓
 *   • CMV (3303/3305): SALDO positivo → -SALDO = negativo ✓
 *   • Despesas (3401/3403/3409): SALDO positivo → -SALDO = negativo ✓
 *   • Financeiro ativo (3105/3106): SALDO negativo → -SALDO = positivo ✓
 *   • Financeiro passivo (3411): SALDO positivo → -SALDO = negativo ✓
 *   • IR/CSLL (3901): SALDO positivo → -SALDO = negativo ✓
 */
function classificarConta(conta) {
  const c = String(conta || '').trim();
  if (c.startsWith('3101'))    return 'receita_bruta';
  if (c.startsWith('3103001')) return 'devolucoes';   // Devoluções de vendas — já embutidas na Receita Bruta
  if (c.startsWith('3103'))    return 'deducoes';
  if (c.startsWith('3303') ||
      c.startsWith('3305'))    return 'cmv';
  if (c.startsWith('3401'))    return 'despesas_vendas';
  if (c.startsWith('3403001')) return 'despesas_pessoal';   // 3403001xxx — pessoal
  if (c.startsWith('3403009')) return 'depreciacao';         // 3403009xxx — depreciação
  if (c.startsWith('3403007') ||
      c.startsWith('3403011') ||
      c.startsWith('3403015') ||
      c.startsWith('3403017') ||
      c.startsWith('3403018') ||
      c.startsWith('3409'))    return 'despesas_admin';
  if (c.startsWith('3105') ||
      c.startsWith('3106') ||
      c.startsWith('3411'))    return 'resultado_financeiro';
  if (c.startsWith('3901'))    return 'ir_csll';
  return null;
}

/** Estrutura das linhas da DRE na ordem de exibição */
const DRE_LINHAS = [
  { id: 'receita_bruta',        label: 'Receita Bruta',              prefix: '(+)', tipo: 'item'      },
  { id: 'deducoes',             label: 'Deduções da Receita',        prefix: '(-)', tipo: 'item'      },
  { id: 'receita_liquida',      label: 'Receita Líquida',            prefix: '(=)', tipo: 'total'     },
  { id: 'cmv',                  label: 'CMV / CPV',                  prefix: '(-)', tipo: 'item'      },
  { id: 'lucro_bruto',          label: 'Lucro Bruto',                prefix: '(=)', tipo: 'total'     },
  { id: '_desp_header',         label: 'Despesas Operacionais',      prefix: '',    tipo: 'header'    },
  { id: 'despesas_vendas',      label: 'Despesas com Vendas',        prefix: '(-)', tipo: 'subitem'   },
  { id: 'despesas_pessoal',     label: 'Despesas com Pessoal',       prefix: '(-)', tipo: 'subitem'   },
  { id: 'despesas_admin',       label: 'Despesas Administrativas',   prefix: '(-)', tipo: 'subitem'   },
  { id: 'ebitda',               label: 'EBITDA',                     prefix: '(=)', tipo: 'highlight' },
  { id: 'depreciacao',          label: 'Depreciação & Amortização',  prefix: '(-)', tipo: 'subitem'   },
  { id: 'ebit',                 label: 'EBIT',                       prefix: '(=)', tipo: 'total'     },
  { id: 'resultado_financeiro', label: 'Resultado Financeiro',       prefix: '(±)', tipo: 'item'      },
  { id: 'lair',                 label: 'LAIR',                       prefix: '(=)', tipo: 'total'     },
  { id: 'ir_csll',              label: 'IR / CSLL',                  prefix: '(-)', tipo: 'item'      },
  { id: 'lucro_liquido',        label: 'Lucro Líquido',              prefix: '(=)', tipo: 'highlight' },
];

// ── DRILL-DOWN: mapa de categorias por linha ─────────────────

const DRILL_MAPA = {
  receita_bruta:        ['receita_bruta', 'devolucoes'],
  deducoes:             ['deducoes'],
  receita_liquida:      ['receita_bruta', 'devolucoes', 'deducoes'],
  cmv:                  ['cmv'],
  lucro_bruto:          ['receita_bruta', 'devolucoes', 'deducoes', 'cmv'],
  despesas_vendas:      ['despesas_vendas'],
  despesas_pessoal:     ['despesas_pessoal'],
  despesas_admin:       ['despesas_admin'],
  ebitda:               ['receita_bruta', 'devolucoes', 'deducoes', 'cmv', 'despesas_vendas', 'despesas_pessoal', 'despesas_admin'],
  depreciacao:          ['depreciacao'],
  ebit:                 ['receita_bruta', 'devolucoes', 'deducoes', 'cmv', 'despesas_vendas', 'despesas_pessoal', 'despesas_admin', 'depreciacao'],
  resultado_financeiro: ['resultado_financeiro'],
  lair:                 ['receita_bruta', 'devolucoes', 'deducoes', 'cmv', 'despesas_vendas', 'despesas_pessoal', 'despesas_admin', 'depreciacao', 'resultado_financeiro'],
  ir_csll:              ['ir_csll'],
  lucro_liquido:        ['receita_bruta', 'devolucoes', 'deducoes', 'cmv', 'despesas_vendas', 'despesas_pessoal', 'despesas_admin', 'depreciacao', 'resultado_financeiro', 'ir_csll'],
};

// ── LABELS DE SUBGRUPOS DO BALANÇO ───────────────────────────
// Mapeia os 2 primeiros dígitos da conta para o nome do grupo.
// Ajuste conforme o plano de contas da empresa.
const BP_SUBGRUPO_LABELS = {
  '11': 'Ativo Circulante',
  '12': 'Ativo Não Circulante',
  '13': 'Ativo Não Circulante',
  '21': 'Passivo Circulante',
  '22': 'Passivo Não Circulante',
  '23': 'Patrimônio Líquido',
  '24': 'Patrimônio Líquido',
  '25': 'Patrimônio Líquido',
};

// ── AUTENTICAÇÃO ─────────────────────────────────────────────
// initAuth() definido em auth-dre.js — verifica login e permissão
(async () => {
  const user = await initAuth();
  if (!user) return; // redirecionado para login

  // Tentar carregar dados salvos na nuvem
  try {
    const saved = await CloudStorage.get('dados_brutos');
    if (saved && saved.rows && saved.rows.length) {
      dadosBrutos = saved.rows;
      setStatus(`✓ ${saved.rows.length.toLocaleString('pt-BR')} registros carregados (sessão anterior).`, 'success');
      inicializarDashboard(saved.nomeArquivo || 'Relatório salvo', saved.rows);
    }
  } catch (e) {
    // sem dados salvos, continua normalmente
  }
})();

// ── ESTADO ───────────────────────────────────────────────────

let dadosBrutos = [];
let modoVisualizacao = 'monthly';
let filtroFilial = new Set();   // Set vazio = sem filtro (todos)
let filtroBU     = new Set();
let abaPrincipal = 'dre';       // 'dre' | 'bp' | 'dashboard'
let dashPeriodo  = null;        // null = Acumulado; string = período selecionado
let drePeriodo   = null;        // null = Acumulado; string = período selecionado na DRE
let chartDash1   = null;
let chartDash2   = null;
let chartDash3   = null;
let chartDash4   = null;
let chartDash5   = null;

// ── LEITURA DO ARQUIVO ───────────────────────────────────────

document.getElementById('btnSelectFile').addEventListener('click', () =>
  document.getElementById('fileInput').click());

document.getElementById('fileInput').addEventListener('change', e => {
  if (e.target.files[0]) processarArquivo(e.target.files[0]);
});

const dropZone = document.getElementById('dropZone');
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processarArquivo(file);
});

function setStatus(msg, tipo) {
  const el = document.getElementById('uploadStatus');
  el.textContent = msg;
  el.className = `upload-status ${tipo}`;
}

function processarArquivo(file) {
  setStatus('Carregando arquivo…', 'loading');
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb   = XLSX.read(data, { type: 'array', cellDates: true });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

      if (!rows.length) throw new Error('Planilha vazia ou sem dados reconhecíveis.');

      dadosBrutos = rows;
      setStatus(`✓ ${rows.length.toLocaleString('pt-BR')} registros carregados com sucesso.`, 'success');
      inicializarDashboard(file.name, rows);
      // Salvar na nuvem para próxima sessão
      CloudStorage.set('dados_brutos', { rows, nomeArquivo: file.name }).catch(() => {});
    } catch (err) {
      setStatus(`✗ Erro: ${err.message}`, 'error');
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

function inicializarDashboard(nomeArquivo, rows) {
  popularFiltros(rows);

  // Detecta contas de Ativo (1xxx) ou Passivo/PL (2xxx)
  const temBP = rows.some(r => {
    const p = String(r.CONTA || '').trim().charAt(0);
    return p === '1' || p === '2';
  });

  setTimeout(() => {
    document.getElementById('uploadSection').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('headerActions').style.display = 'flex';
    document.getElementById('headerSub').textContent = nomeArquivo;
    document.getElementById('footerTimestamp').textContent =
      'Gerado em ' + new Date().toLocaleString('pt-BR');

    document.getElementById('tabNav').style.display = 'flex';
    document.getElementById('tabBtnBP').style.display = temBP ? '' : 'none';

    abaPrincipal = 'dre';
    renderizar();
  }, 400);
}

// ── MULTI-SELECT COMPONENT ───────────────────────────────────

/**
 * Cria um dropdown multi-select com checkboxes dentro de um container.
 * Retorna um controller com métodos: setOpcoes(), getSelecionados(), reset().
 * Chama onChange(Set) toda vez que a seleção muda.
 */
function criarMultiSelect(containerId, placeholder, onChange) {
  const container = document.getElementById(containerId);
  let opcoes = [];
  let selecionados = new Set();

  container.innerHTML = `
    <div class="ms-trigger">
      <span class="ms-label">${placeholder}</span>
      <span class="ms-arrow">▾</span>
    </div>
    <div class="ms-dropdown">
      <div class="ms-actions">
        <button class="ms-btn ms-btn-all">Todas</button>
        <button class="ms-btn ms-btn-clear">Limpar</button>
      </div>
      <div class="ms-options-list"></div>
    </div>`;

  const trigger  = container.querySelector('.ms-trigger');
  const label    = container.querySelector('.ms-label');
  const optList  = container.querySelector('.ms-options-list');
  const btnAll   = container.querySelector('.ms-btn-all');
  const btnClear = container.querySelector('.ms-btn-clear');

  // Abrir / fechar
  trigger.addEventListener('click', e => {
    e.stopPropagation();
    const aberto = container.classList.toggle('is-open');
    if (aberto) fecharOutros(containerId);
  });

  document.addEventListener('click', e => {
    if (!container.contains(e.target)) container.classList.remove('is-open');
  });

  btnAll.addEventListener('click', () => {
    opcoes.forEach(o => selecionados.add(o));
    atualizarCheckboxes();
    atualizarLabel();
    onChange(new Set(selecionados));
  });

  btnClear.addEventListener('click', () => {
    selecionados.clear();
    atualizarCheckboxes();
    atualizarLabel();
    onChange(new Set(selecionados));
  });

  function atualizarCheckboxes() {
    optList.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.checked = selecionados.has(cb.value);
    });
  }

  function atualizarLabel() {
    if (selecionados.size === 0) {
      label.textContent = placeholder;
      return;
    }
    if (selecionados.size === 1) {
      label.textContent = [...selecionados][0];
      return;
    }
    label.textContent = `${selecionados.size} selecionadas`;
  }

  return {
    setOpcoes(lista) {
      opcoes = lista;
      optList.innerHTML = '';
      lista.forEach(op => {
        const div = document.createElement('div');
        div.className = 'ms-option';
        const id = `ms-${containerId}-${op.replace(/\s+/g, '_')}`;
        div.innerHTML = `<label><input type="checkbox" id="${id}" value="${op}"><span>${op}</span></label>`;
        div.querySelector('input').addEventListener('change', e => {
          if (e.target.checked) selecionados.add(op);
          else selecionados.delete(op);
          atualizarLabel();
          onChange(new Set(selecionados));
        });
        optList.appendChild(div);
      });
    },
    reset() {
      selecionados.clear();
      atualizarCheckboxes();
      atualizarLabel();
    },
    getSelecionados() { return new Set(selecionados); },
  };
}

// Garante que apenas um dropdown fique aberto por vez
const _msAbertos = {};
function fecharOutros(id) {
  Object.keys(_msAbertos).forEach(k => {
    if (k !== id) document.getElementById(k)?.classList.remove('is-open');
  });
  _msAbertos[id] = true;
}

// ── FILTROS ──────────────────────────────────────────────────

let msFilial, msBU;

function popularFiltros(rows) {
  const filiais = [...new Set(rows.map(r => r.FILIAL_NOME).filter(Boolean))].sort();
  const bus     = [...new Set(rows.map(r => r.BU).filter(Boolean))].sort();

  msFilial = criarMultiSelect('filterFilial', 'Todas as Empresas', sel => {
    filtroFilial = sel;
    drePeriodo = null;
    renderizar();
  });
  msFilial.setOpcoes(filiais);

  msBU = criarMultiSelect('filterBU', 'Todas as UNs', sel => {
    filtroBU = sel;
    drePeriodo = null;
    renderizar();
  });
  msBU.setOpcoes(bus);
}

document.getElementById('viewToggle').addEventListener('click', e => {
  const btn = e.target.closest('.toggle-btn');
  if (!btn) return;
  document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  modoVisualizacao = btn.dataset.view;
  renderizar();
});

document.getElementById('btnExportCSV').addEventListener('click', exportarCSV);
document.getElementById('btnNewFile').addEventListener('click', () => {
  dadosBrutos  = [];
  filtroFilial = new Set();
  filtroBU     = new Set();
  abaPrincipal = 'dre';
  dashPeriodo  = null;
  if (chartDash1) { chartDash1.destroy(); chartDash1 = null; }
  if (chartDash2) { chartDash2.destroy(); chartDash2 = null; }
  if (chartDash3) { chartDash3.destroy(); chartDash3 = null; }
  if (chartDash4) { chartDash4.destroy(); chartDash4 = null; }
  if (chartDash5) { chartDash5.destroy(); chartDash5 = null; }
  CloudStorage.remove('dados_brutos').catch(() => {});
  document.getElementById('tabNav').style.display  = 'none';
  document.getElementById('dreSection').style.display  = 'block';
  document.getElementById('dashSection').style.display = 'none';
  document.getElementById('bpSection').style.display   = 'none';
  document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('headerActions').style.display = 'none';
  document.getElementById('uploadSection').style.display = 'flex';
  document.getElementById('uploadStatus').textContent = '';
  document.getElementById('fileInput').value = '';
  document.getElementById('filterFilial').innerHTML = '';
  document.getElementById('filterBU').innerHTML = '';
});

// ── TAB SWITCHING ─────────────────────────────────────────────

document.getElementById('tabNav').addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  const aba = btn.dataset.tab;
  if (aba === abaPrincipal) return;
  abaPrincipal = aba;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === aba));
  document.getElementById('dreSection').style.display  = aba === 'dre'       ? 'block' : 'none';
  document.getElementById('dashSection').style.display = aba === 'dashboard' ? 'block' : 'none';
  document.getElementById('bpSection').style.display   = aba === 'bp'        ? 'block' : 'none';
  renderizar();
});

// ── PROCESSAMENTO DRE ────────────────────────────────────────

function extrairData(val) {
  if (!val) return null;
  let d;
  if (val instanceof Date)      { d = val; }
  else if (typeof val === 'number') { d = new Date(Math.round((val - 25569) * 86400000)); }
  else                          { d = new Date(String(val)); }
  return isNaN(d.getTime()) ? null : d;
}

function chavePeriodo(d, modo) {
  if (modo === 'quarterly') {
    const q = Math.ceil((d.getMonth() + 1) / 3);
    return `${d.getFullYear()}-Q${q}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function labelPeriodo(chave, modo) {
  if (modo === 'quarterly') {
    const [ano, q] = chave.split('-');
    return `${q}/${String(ano).slice(2)}`;
  }
  const [ano, mes] = chave.split('-');
  return `${MESES_PT[parseInt(mes, 10) - 1]}/${String(ano).slice(2)}`;
}

function processarDRE(rows, filtFilial, filtBU, modo) {
  // Filtragem — Set vazio = sem filtro (exibe tudo)
  const filtrados = rows.filter(r => {
    if (filtFilial.size > 0 && !filtFilial.has(r.FILIAL_NOME)) return false;
    if (filtBU.size     > 0 && !filtBU.has(r.BU))             return false;
    return true;
  });

  // Acumulação por período × categoria
  const mapa = {};  // { periodoKey: { categoria: soma } }

  filtrados.forEach(row => {
    const d = extrairData(row.DATA);
    if (!d) return;

    const categoria = classificarConta(row.CONTA);
    if (!categoria) return;

    // SALDO pode estar na coluna SALDO ou ser calculado
    let saldo = parseFloat(row.SALDO);
    if (isNaN(saldo)) {
      saldo = (parseFloat(row.VALOR_DEBITO) || 0) - (parseFloat(row.VALOR_CREDITO) || 0);
    }

    const dreVal = -saldo;  // convenção DRE: negar o SALDO
    const chave  = chavePeriodo(d, modo);

    if (!mapa[chave]) mapa[chave] = {};
    mapa[chave][categoria] = (mapa[chave][categoria] || 0) + dreVal;
  });

  // Linhas derivadas por período
  const periodos  = Object.keys(mapa).sort();
  const calculado = {};

  periodos.forEach(p => {
    const m = mapa[p];
    const c = {};

    c.devolucoes           = m.devolucoes           || 0;   // negativo — já embutido na Receita Bruta
    c.receita_bruta        = (m.receita_bruta || 0) + c.devolucoes;  // Receita Bruta líquida de devoluções
    c.deducoes             = m.deducoes             || 0;   // apenas deduções fiscais (ICMS, PIS, COFINS...)
    c.receita_liquida      = c.receita_bruta + c.deducoes;

    c.cmv                  = m.cmv                  || 0;   // negativo
    c.lucro_bruto          = c.receita_liquida + c.cmv;

    c.despesas_vendas      = m.despesas_vendas      || 0;   // negativo
    c.despesas_pessoal     = m.despesas_pessoal     || 0;   // negativo
    c.despesas_admin       = m.despesas_admin       || 0;   // negativo

    c.ebitda = c.lucro_bruto + c.despesas_vendas + c.despesas_pessoal + c.despesas_admin;

    c.depreciacao          = m.depreciacao          || 0;   // negativo
    c.ebit                 = c.ebitda + c.depreciacao;

    c.resultado_financeiro = m.resultado_financeiro || 0;   // pode ser +/-
    c.lair                 = c.ebit + c.resultado_financeiro;

    c.ir_csll              = m.ir_csll              || 0;   // negativo
    c.lucro_liquido        = c.lair + c.ir_csll;

    calculado[p] = c;
  });

  // Coluna Total
  const total = {};
  periodos.forEach(p => {
    Object.entries(calculado[p]).forEach(([k, v]) => {
      total[k] = (total[k] || 0) + v;
    });
  });

  return { periodos, calculado, total };
}

// ── RENDERIZAÇÃO PRINCIPAL ───────────────────────────────────

function renderizar() {
  if (!dadosBrutos.length) return;

  const partesFiltro = [];
  if (filtroFilial.size > 0) partesFiltro.push([...filtroFilial].join(', '));
  if (filtroBU.size     > 0) partesFiltro.push([...filtroBU].join(', '));
  document.getElementById('filterInfo').textContent =
    partesFiltro.length ? `Exibindo: ${partesFiltro.join(' · ')}` : '';

  if (abaPrincipal === 'bp') {
    renderizarBalancete();
  } else if (abaPrincipal === 'dashboard') {
    const { periodos, calculado, total } = processarDRE(dadosBrutos, filtroFilial, filtroBU, modoVisualizacao);
    renderizarDashboard(periodos, calculado, total);
  } else {
    const { periodos, calculado, total } = processarDRE(dadosBrutos, filtroFilial, filtroBU, modoVisualizacao);

    // Barra de períodos da DRE
    const bar = document.getElementById('drePeriodBar');
    bar.innerHTML = '';
    const criarBtnDre = (chave, label) => {
      const btn = document.createElement('button');
      btn.className = `dash-pb${drePeriodo === chave ? ' active' : ''}`;
      btn.textContent = label;
      btn.addEventListener('click', () => { drePeriodo = chave; renderizar(); });
      return btn;
    };
    bar.appendChild(criarBtnDre(null, 'Acumulado'));
    periodos.forEach(p => bar.appendChild(criarBtnDre(p, labelPeriodo(p, modoVisualizacao))));

    // Filtrar períodos visíveis na tabela
    const periodosVisiveis = drePeriodo ? periodos.filter(p => p === drePeriodo) : periodos;

    renderizarKPIs(drePeriodo ? calculado[drePeriodo] : total, periodosVisiveis);
    renderizarTabela(periodosVisiveis, calculado, total);
  }
}

// ── KPIs ─────────────────────────────────────────────────────

function renderizarKPIs(total, periodos) {
  const rb = total.receita_bruta || 0;
  const lb = total.lucro_bruto   || 0;
  const eb = total.ebitda        || 0;
  const ll = total.lucro_liquido || 0;

  setKPI('kpiReceitaVal', rb, 'kpiReceitaMeta', `${periodos.length} período(s)`, rb);
  setKPI('kpiLBVal',      lb, 'kpiLBMeta',      `Margem: ${pct(lb, rb)}`,         lb);
  setKPI('kpiEBITDAVal',  eb, 'kpiEBITDAMeta',  `Margem: ${pct(eb, rb)}`,         eb);
  setKPI('kpiLLVal',      ll, 'kpiLLMeta',       `Margem: ${pct(ll, rb)}`,         ll);
}

function setKPI(valId, val, metaId, metaText, refVal) {
  const el = document.getElementById(valId);
  el.textContent = formatBRL(val);
  el.className = `kpi-value ${refVal >= 0 ? 'val-pos' : 'val-neg'}`;
  document.getElementById(metaId).textContent = metaText;
}

// ── TABELA DRE ───────────────────────────────────────────────

function criarTH(text, attrs = {}) {
  const th = document.createElement('th');
  th.textContent = text;
  if (attrs.colSpan) th.colSpan = attrs.colSpan;
  if (attrs.rowSpan) th.rowSpan = attrs.rowSpan;
  return th;
}

function renderizarTabela(periodos, calculado, total) {
  const thead = document.getElementById('dreHead');
  const oldTbody = document.getElementById('dreBody');
  thead.innerHTML = '';

  // Replace tbody entirely to clear any previously attached click listeners
  const tbody = document.createElement('tbody');
  tbody.id = 'dreBody';
  oldTbody.parentNode.replaceChild(tbody, oldTbody);

  const numCols = 2 + (periodos.length + 1) * 2; // prefix + desc + (val+pct) * (N períodos + total)

  // Linha 1: cabeçalhos de colunas
  const tr1 = document.createElement('tr');
  tr1.appendChild(criarTH(''));
  tr1.appendChild(criarTH('Descrição'));
  periodos.forEach(p => tr1.appendChild(criarTH(labelPeriodo(p, modoVisualizacao), { colSpan: 2 })));
  tr1.appendChild(criarTH('Total', { colSpan: 2 }));
  thead.appendChild(tr1);

  // Linha 2: sub-cabeçalhos R$ / AV%
  const tr2 = document.createElement('tr');
  tr2.appendChild(criarTH(''));
  tr2.appendChild(criarTH(''));
  [...periodos, 'total'].forEach(() => {
    tr2.appendChild(criarTH('R$'));
    tr2.appendChild(criarTH('AV%'));
  });
  thead.appendChild(tr2);

  // Linhas da DRE
  DRE_LINHAS.forEach(linha => {
    const tr = document.createElement('tr');
    tr.className = `row-${linha.tipo}`;

    if (linha.tipo === 'header') {
      const td = document.createElement('td');
      td.colSpan = numCols;
      td.textContent = linha.label;
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    // Marcar como clicável se tiver drill-down
    const isDrillable = !!DRILL_MAPA[linha.id];
    if (isDrillable) {
      tr.classList.add('row-drillable');
      tr.dataset.linhaId     = linha.id;
      tr.dataset.linhaLabel  = linha.label;
      tr.dataset.linhaPrefix = linha.prefix;
    }

    // Célula prefixo (com ícone toggle para drillable)
    const tdPfx = document.createElement('td');
    if (isDrillable) {
      tdPfx.innerHTML = `<span class="dre-drill-icon">▶</span> ${linha.prefix}`;
    } else {
      tdPfx.textContent = linha.prefix;
    }
    tr.appendChild(tdPfx);

    // Célula descrição
    const tdDesc = document.createElement('td');
    tdDesc.textContent = linha.label;
    tr.appendChild(tdDesc);

    // Células de valor por período + total
    [...periodos, 'total'].forEach(p => {
      const dados     = p === 'total' ? total : calculado[p];
      const valor     = dados?.[linha.id] ?? 0;
      const recBruta  = p === 'total' ? (total.receita_liquida || 0) : (calculado[p]?.receita_liquida || 0);

      const tdVal = document.createElement('td');
      tdVal.textContent = formatBRL(valor);
      tdVal.className = valor >= 0 ? 'val-pos' : 'val-neg';

      const tdPct = document.createElement('td');
      tdPct.textContent = pct(valor, recBruta);
      tdPct.className = 'val-pct';

      tr.appendChild(tdVal);
      tr.appendChild(tdPct);
    });

    tbody.appendChild(tr);
  });

  // Delegação de click para drill-down inline
  tbody.addEventListener('click', e => {
    const tr = e.target.closest('tr.row-drillable');
    if (!tr) return;

    // Se já está aberto, remove todas as linhas de detalhe
    const next = tr.nextElementSibling;
    if (next && next.classList.contains('dre-inline-detail')) {
      let curr = next;
      while (curr && curr.classList.contains('dre-inline-detail')) {
        const rem = curr;
        curr = curr.nextElementSibling;
        rem.remove();
      }
      tr.classList.remove('is-open');
      return;
    }

    tr.classList.add('is-open');
    const linhas = construirLinhasDetalhe(
      tr.dataset.linhaId, tr.dataset.linhaLabel, periodos, calculado, total
    );
    let ref = tr;
    linhas.forEach(r => { ref.insertAdjacentElement('afterend', r); ref = r; });
  });
}

// ── CORES / UTILITÁRIOS DE GRÁFICO ──────────────────────────

const CORES = {
  azul:       'rgba(37, 99, 235, .85)',
  azulLt:     'rgba(37, 99, 235, .15)',
  roxo:       'rgba(124, 58, 237, .82)',
  ambar:      'rgba(217, 119, 6, .85)',
  verde:      'rgba(5, 150, 105, .85)',
  verdeLt:    'rgba(5, 150, 105, .18)',
  vermelho:   'rgba(220, 38, 38, .85)',
  vermelhoLt: 'rgba(220, 38, 38, .18)',
};

function corSinal(valor, pos, neg) { return valor >= 0 ? pos : neg; }

function opcoesGrafico({ tooltip, tickY }) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: { font: { size: 11 }, padding: 14, usePointStyle: true },
      },
      tooltip: {
        callbacks: { label: ctx => ` ${tooltip(ctx)}` },
      },
    },
    scales: {
      y: {
        ticks: { callback: tickY, font: { size: 11 } },
        grid: { color: 'rgba(0,0,0,.05)' },
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 12 } },
      },
    },
  };
}

// ── DRILL-DOWN INLINE (DRE) ──────────────────────────────────

/**
 * Agrega os dados brutos por conta × período para uma linha da DRE.
 * Retorna { contasMapa: { [conta]: { conta, descConta, periodos:{}, total } } }
 */
function agregarContasPorPeriodo(linhaId) {
  const categorias = DRILL_MAPA[linhaId] || [];
  const contasMapa = {};

  dadosBrutos.forEach(r => {
    if (!r.CONTA || !r.DATA) return;
    if (filtroFilial.size > 0 && !filtroFilial.has(r.FILIAL_NOME)) return;
    if (filtroBU.size     > 0 && !filtroBU.has(r.BU))             return;
    if (!categorias.includes(classificarConta(r.CONTA))) return;

    const d = extrairData(r.DATA);
    if (!d) return;

    const p    = chavePeriodo(d, modoVisualizacao);
    const key  = String(r.CONTA || '');
    let saldo  = parseFloat(r.SALDO);
    if (isNaN(saldo)) saldo = (parseFloat(r.VALOR_DEBITO) || 0) - (parseFloat(r.VALOR_CREDITO) || 0);
    const dreVal = -saldo;

    if (!contasMapa[key]) contasMapa[key] = {
      conta: key, descConta: r.DESC_CONTA || key, periodos: {}, total: 0,
    };
    contasMapa[key].periodos[p] = (contasMapa[key].periodos[p] || 0) + dreVal;
    contasMapa[key].total += dreVal;
  });

  return contasMapa;
}

/**
 * Retorna array de <tr> para inserir diretamente no tbody da tabela DRE.
 * Mesma estrutura de colunas: prefixo | descrição | (R$ + AV%) × (períodos + total)
 */
function construirLinhasDetalhe(linhaId, linhaLabel, periodos, calculado, total) {
  const contasMapa = agregarContasPorPeriodo(linhaId);
  const contas     = Object.values(contasMapa).sort((a, b) => a.conta.localeCompare(b.conta));
  if (!contas.length) return [];

  const criarLinha = (descricao, classeExtra, getValFn) => {
    const tr = document.createElement('tr');
    tr.className = `dre-inline-detail ${classeExtra}`;

    // Célula prefixo (vazia — alinha com a col de prefix da DRE)
    const tdPfx = document.createElement('td');
    tr.appendChild(tdPfx);

    // Descrição
    const tdDesc = document.createElement('td');
    tdDesc.textContent = descricao;
    tr.appendChild(tdDesc);

    // Valores por período + total
    [...periodos, 'total'].forEach(p => {
      const val = getValFn(p);
      const rb  = p === 'total' ? (total.receita_liquida || 0) : (calculado[p]?.receita_liquida || 0);

      const tdVal = document.createElement('td');
      tdVal.textContent = formatBRL(val);
      tdVal.className   = val >= 0 ? 'val-pos' : 'val-neg';

      const tdPct = document.createElement('td');
      tdPct.textContent = pct(val, rb);
      tdPct.className   = 'val-pct';

      tr.append(tdVal, tdPct);
    });

    return tr;
  };

  const linhas = contas.map(c => {
    const tr = criarLinha(c.descConta, 'idw-conta-row',
      p => p === 'total' ? c.total : (c.periodos[p] || 0));
    // Ícone de detalhe na célula prefixo + clique abre modal de lançamentos
    tr.cells[0].innerHTML = '<span title="Ver lançamentos">🔍</span>';
    tr.addEventListener('click', e => {
      e.stopPropagation();
      abrirModalLancamentos(c.conta, c.descConta);
    });
    return tr;
  });

  // Linha de total só se houver mais de uma conta
  if (contas.length > 1) {
    linhas.push(criarLinha(`Total — ${linhaLabel}`, 'idw-total-row',
      p => p === 'total'
        ? contas.reduce((s, c) => s + c.total, 0)
        : contas.reduce((s, c) => s + (c.periodos[p] || 0), 0)
    ));
  }

  return linhas;
}

// ── MODAL: LANÇAMENTOS DA CONTA ──────────────────────────────

function abrirModalLancamentos(conta, descConta) {
  // Filtrar lançamentos para esta conta respeitando filtros ativos
  const rows = dadosBrutos.filter(r => {
    if (String(r.CONTA || '').trim() !== String(conta).trim()) return false;
    if (!r.DATA) return false;
    if (filtroFilial.size > 0 && !filtroFilial.has(r.FILIAL_NOME)) return false;
    if (filtroBU.size     > 0 && !filtroBU.has(r.BU))             return false;
    return true;
  });

  // Agrupar por mês
  const porMes = {};
  rows.forEach(r => {
    const d = extrairData(r.DATA);
    if (!d) return;
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!porMes[chave]) porMes[chave] = [];
    let saldo = parseFloat(r.SALDO);
    if (isNaN(saldo)) saldo = (parseFloat(r.VALOR_DEBITO) || 0) - (parseFloat(r.VALOR_CREDITO) || 0);
    porMes[chave].push({ ...r, _dreVal: -saldo, _date: d });
  });

  const meses = Object.keys(porMes).sort();
  let mesSelecionado = null; // null = Todos

  // Título e subtítulo
  document.getElementById('lancModalTitle').textContent = descConta;
  document.getElementById('lancModalSub').textContent =
    `Conta: ${conta}` +
    (filtroFilial.size ? ` · Empresa: ${[...filtroFilial].join(', ')}` : '') +
    (filtroBU.size     ? ` · BU: ${[...filtroBU].join(', ')}` : '');

  // Barra de meses
  const periodsEl = document.getElementById('lancModalPeriods');
  periodsEl.innerHTML = '';
  const criarBtnMes = (chave, label) => {
    const btn = document.createElement('button');
    btn.className = `dash-pb${mesSelecionado === chave ? ' active' : ''}`;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      mesSelecionado = chave;
      renderModalConteudo();
    });
    return btn;
  };
  periodsEl.appendChild(criarBtnMes(null, 'Todos'));
  meses.forEach(m => {
    const [ano, mes] = m.split('-');
    periodsEl.appendChild(criarBtnMes(m, `${MESES_PT[parseInt(mes, 10) - 1]}/${String(ano).slice(2)}`));
  });

  function renderModalConteudo() {
    // Atualizar botões ativos
    periodsEl.querySelectorAll('.dash-pb').forEach(btn => btn.classList.remove('active'));
    periodsEl.querySelectorAll('.dash-pb').forEach((btn, i) => {
      const chave = i === 0 ? null : meses[i - 1];
      if (chave === mesSelecionado) btn.classList.add('active');
    });

    const mesesVisiveis = mesSelecionado ? [mesSelecionado] : meses;
    const rowsVisiveis  = mesesVisiveis.flatMap(m => porMes[m] || []);
    const totalVis      = rowsVisiveis.reduce((s, r) => s + r._dreVal, 0);

    // KPIs
    document.getElementById('lancModalKpis').innerHTML = `
      <div class="lanc-kpi-item">
        <span class="lanc-kpi-label">Total (DRE)</span>
        <span class="lanc-kpi-val ${totalVis >= 0 ? 'pos' : 'neg'}">${formatBRL(totalVis)}</span>
      </div>
      <div class="lanc-kpi-item">
        <span class="lanc-kpi-label">Lançamentos</span>
        <span class="lanc-kpi-val">${rowsVisiveis.length}</span>
      </div>
      <div class="lanc-kpi-item">
        <span class="lanc-kpi-label">Períodos</span>
        <span class="lanc-kpi-val">${mesesVisiveis.length}</span>
      </div>`;

    // Corpo
    const body = document.getElementById('lancModalBody');
    body.innerHTML = '';
    body.scrollTop = 0;

    if (!rowsVisiveis.length) {
      body.innerHTML = '<p style="color:var(--c-muted);text-align:center;padding:2rem;">Nenhum lançamento encontrado.</p>';
      return;
    }

    mesesVisiveis.forEach(mes => {
      const lancamentos = (porMes[mes] || []).slice().sort((a, b) => a._date - b._date);
      const totalMes    = lancamentos.reduce((s, r) => s + r._dreVal, 0);
      const [ano, m]    = mes.split('-');
      const label       = `${MESES_PT[parseInt(m, 10) - 1]} / ${ano}`;

      const section = document.createElement('div');
      section.className = 'lanc-mes-section';

      const header = document.createElement('div');
      header.className = 'lanc-mes-header';
      header.innerHTML = `
        <span>${label}</span>
        <span class="lanc-mes-total ${totalMes >= 0 ? '' : 'neg'}">${formatBRL(totalMes)}</span>`;
      section.appendChild(header);

      const table = document.createElement('table');
      table.className = 'lanc-detail-table';
      table.innerHTML = `
        <thead><tr>
          <th>Data</th><th>Histórico</th><th>BU</th><th>Saldo</th><th>Valor DRE</th>
        </tr></thead>`;

      const tbody = document.createElement('tbody');
      lancamentos.forEach(r => {
        const tr = document.createElement('tr');
        const saldo = parseFloat(r.SALDO) || 0;
        const v     = r._dreVal;
        tr.innerHTML = `
          <td>${r._date.toLocaleDateString('pt-BR')}</td>
          <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
              title="${(r.HISTORICO || '').replace(/"/g, '&quot;')}">${r.HISTORICO || '—'}</td>
          <td>${r.BU || '—'}</td>
          <td class="col-val ${saldo >= 0 ? 'pos' : 'neg'}">${formatBRL(saldo)}</td>
          <td class="col-val ${v >= 0 ? 'pos' : 'neg'}">${formatBRL(v)}</td>`;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      section.appendChild(table);
      body.appendChild(section);
    });
  }

  renderModalConteudo();
  document.getElementById('lancModalOverlay').style.display = 'flex';
}

// Fechar modal
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('lancModalOverlay');
  document.getElementById('lancModalClose')?.addEventListener('click', () => {
    overlay.style.display = 'none';
  });
  overlay?.addEventListener('click', e => {
    if (e.target === overlay) overlay.style.display = 'none';
  });
});

// ── DASHBOARD ────────────────────────────────────────────────

/** Agrega Receita Bruta por BU a partir dos dados brutos */
function calcularRankingBU(periodoFiltro) {
  const mapa = {};
  dadosBrutos.forEach(r => {
    if (!r.CONTA || !r.DATA) return;
    if (filtroFilial.size > 0 && !filtroFilial.has(r.FILIAL_NOME)) return;
    if (filtroBU.size     > 0 && !filtroBU.has(r.BU))             return;
    const cat = classificarConta(r.CONTA);
    if (cat !== 'receita_bruta' && cat !== 'devolucoes') return;
    const d = extrairData(r.DATA);
    if (!d) return;
    if (periodoFiltro && chavePeriodo(d, modoVisualizacao) !== periodoFiltro) return;
    const bu = r.BU || 'Sem BU';
    let saldo = parseFloat(r.SALDO);
    if (isNaN(saldo)) saldo = (parseFloat(r.VALOR_DEBITO) || 0) - (parseFloat(r.VALOR_CREDITO) || 0);
    mapa[bu] = (mapa[bu] || 0) + (-saldo);
  });
  return Object.entries(mapa)
    .map(([bu, val]) => ({ bu, val }))
    .sort((a, b) => b.val - a.val);
}

function renderizarDashboard(periodos, calculado, total) {
  // Barra de períodos
  const bar = document.getElementById('dashPeriodBar');
  bar.innerHTML = '';
  const criarBtnPeriodo = (chave, label) => {
    const btn = document.createElement('button');
    btn.className = `dash-pb${dashPeriodo === chave ? ' active' : ''}`;
    btn.textContent = label;
    btn.addEventListener('click', () => { dashPeriodo = chave; renderizarDashboard(periodos, calculado, total); });
    return btn;
  };
  bar.appendChild(criarBtnPeriodo(null, 'Acumulado'));
  periodos.forEach(p => bar.appendChild(criarBtnPeriodo(p, labelPeriodo(p, modoVisualizacao))));

  // KPIs — usam o período selecionado (ou total acumulado)
  const dados = dashPeriodo ? (calculado[dashPeriodo] || {}) : total;
  const rb = dados.receita_bruta   || 0;
  const rl = dados.receita_liquida || 0;
  const eb = dados.ebitda          || 0;
  const ll = dados.lucro_liquido   || 0;

  const setVal = (valId, val, metaId, metaText) => {
    const el = document.getElementById(valId);
    if (!el) return;
    el.textContent = formatBRL(val);
    el.className = `kpi-value ${val >= 0 ? 'val-pos' : 'val-neg'}`;
    if (metaId) { const m = document.getElementById(metaId); if (m) m.textContent = metaText; }
  };

  setVal('dashKpiRBVal', rb, 'dashKpiRBMeta',
    dashPeriodo ? labelPeriodo(dashPeriodo, modoVisualizacao) : `${periodos.length} período(s)`);
  setVal('dashKpiRLVal', rl, 'dashKpiRLMeta', `${pct(rl, rb)} da R. Bruta`);
  setVal('dashKpiEBVal', eb, 'dashKpiEBMeta', `Margem: ${pct(eb, rl)}`);
  setVal('dashKpiLLVal', ll, 'dashKpiLLMeta', `Margem: ${pct(ll, rl)}`);

  // Gráficos de barras — sempre mostram todos os períodos para visualizar tendência
  const labels = periodos.map(p => labelPeriodo(p, modoVisualizacao));

  const makeBarChart = (canvasId, data, color, existing) => {
    if (existing) existing.destroy();
    return new Chart(document.getElementById(canvasId).getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: color + '30',
          borderColor: color,
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ' ' + formatBRL(ctx.raw) } },
        },
        scales: {
          y: {
            ticks: { callback: v => formatBRLCurto(v), font: { size: 10 }, color: '#94a3b8' },
            grid: { color: '#f1f5f9' },
            border: { display: false },
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 11, weight: '600' }, color: '#64748b' },
          },
        },
      },
    });
  };

  chartDash1 = makeBarChart('dashChart1', periodos.map(p => calculado[p]?.receita_bruta   || 0), '#1d4ed8', chartDash1);
  chartDash2 = makeBarChart('dashChart2', periodos.map(p => calculado[p]?.receita_liquida || 0), '#0891b2', chartDash2);
  chartDash3 = makeBarChart('dashChart3', periodos.map(p => calculado[p]?.ebitda          || 0), '#d97706', chartDash3);
  chartDash4 = makeBarChart('dashChart4', periodos.map(p => calculado[p]?.lucro_liquido   || 0), '#059669', chartDash4);

  // Ranking de BU
  const ranking = calcularRankingBU(dashPeriodo);
  if (chartDash5) { chartDash5.destroy(); chartDash5 = null; }

  const buCanvas = document.getElementById('dashChartBU');
  if (buCanvas && ranking.length > 0) {
    const PALETTE = ['#1d4ed8','#0891b2','#d97706','#059669','#7c3aed','#db2777','#ea580c','#65a30d'];
    chartDash5 = new Chart(buCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ranking.map(r => r.bu),
        datasets: [{
          data: ranking.map(r => r.val),
          backgroundColor: ranking.map((_, i) => PALETTE[i % PALETTE.length] + '30'),
          borderColor:     ranking.map((_, i) => PALETTE[i % PALETTE.length]),
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ' ' + formatBRL(ctx.raw) } },
        },
        scales: {
          x: {
            ticks: { callback: v => formatBRLCurto(v), font: { size: 10 }, color: '#94a3b8' },
            grid: { color: '#f1f5f9' },
            border: { display: false },
          },
          y: {
            grid: { display: false },
            ticks: { font: { size: 12, weight: '700' }, color: '#1e293b' },
          },
        },
      },
    });
  } else if (buCanvas && !ranking.length) {
    const ctx = buCanvas.getContext('2d');
    ctx.clearRect(0, 0, buCanvas.width, buCanvas.height);
  }
}

// ── FORMATAÇÃO ───────────────────────────────────────────────

function formatBRL(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return '—';
  const abs = Math.abs(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return valor < 0 ? `(${abs})` : abs;
}

function formatBRLCurto(valor) {
  const abs = Math.abs(valor);
  let str;
  if      (abs >= 1e6) str = (abs / 1e6).toFixed(1) + 'M';
  else if (abs >= 1e3) str = (abs / 1e3).toFixed(0) + 'K';
  else                 str = abs.toFixed(0);
  return valor < 0 ? `(${str})` : str;
}

function pct(valor, base) {
  if (!base || isNaN(valor) || isNaN(base)) return '—';
  return ((valor / base) * 100).toFixed(1) + '%';
}

// ── DRILL-DOWN ───────────────────────────────────────────────

let ddAtual   = null;
let ddPeriodo = 'todos';

/* Abre o drawer para uma linha da DRE */
function abrirDrillDown(linhaId, linhaLabel, linhaPrefix) {
  ddAtual   = { tipo: 'dre', linhaId, linhaLabel, linhaPrefix };
  ddPeriodo = 'todos';

  document.getElementById('ddPrefix').textContent    = linhaPrefix;
  document.getElementById('ddTitleText').textContent = linhaLabel;
  document.getElementById('ddSearch').value          = '';

  const { periodos } = processarDRE(dadosBrutos, filtroFilial, filtroBU, modoVisualizacao);
  renderizarAbasDrill(periodos);
  renderizarDrill();

  document.getElementById('ddOverlay').classList.add('is-open');
  document.getElementById('ddDrawer').classList.add('is-open');
  document.getElementById('ddDrawer').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function fecharDrillDown() {
  document.getElementById('ddOverlay').classList.remove('is-open');
  document.getElementById('ddDrawer').classList.remove('is-open');
  document.getElementById('ddDrawer').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  ddAtual = null;
}

document.getElementById('ddOverlay').addEventListener('click', fecharDrillDown);
document.getElementById('ddClose').addEventListener('click', fecharDrillDown);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ddAtual) fecharDrillDown(); });

document.getElementById('ddSearch').addEventListener('input', () => renderizarDrill());

document.getElementById('ddBtnExport').addEventListener('click', exportarDrillCSV);

/* Abas de período */
function renderizarAbasDrill(periodos) {
  const container = document.getElementById('ddTabs');
  container.innerHTML = '';

  [{ chave: 'todos', label: 'Todos' }, ...periodos.map(p => ({ chave: p, label: labelPeriodo(p, modoVisualizacao) }))]
    .forEach(({ chave, label }) => {
      const btn = document.createElement('button');
      btn.className = `dd-tab${chave === ddPeriodo ? ' active' : ''}`;
      btn.textContent = label;
      btn.addEventListener('click', () => {
        ddPeriodo = chave;
        container.querySelectorAll('.dd-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderizarDrill();
      });
      container.appendChild(btn);
    });
}

/* Busca lançamentos para o drill-down atual */
function obterLancamentosDrill() {
  if (!ddAtual) return [];

  // Filtro de período e empresa (comum a DRE e BP)
  const filtroPeriodo = r => {
    if (!r.CONTA || !r.DATA) return false;
    if (filtroFilial.size > 0 && !filtroFilial.has(r.FILIAL_NOME)) return false;
    if (filtroBU.size     > 0 && !filtroBU.has(r.BU))             return false;
    if (ddPeriodo !== 'todos') {
      const d = extrairData(r.DATA);
      if (!d || chavePeriodo(d, modoVisualizacao) !== ddPeriodo) return false;
    }
    return true;
  };

  return dadosBrutos
    .filter(r => {
      if (!filtroPeriodo(r)) return false;
      if (ddAtual.tipo === 'bp') {
        // Filtra pelos códigos de conta explícitos (Balancete)
        return ddAtual.contas.includes(String(r.CONTA || '').trim());
      } else {
        // Filtra pelas categorias DRE
        const categorias = DRILL_MAPA[ddAtual.linhaId] || [];
        return categorias.includes(classificarConta(r.CONTA));
      }
    })
    .map(r => {
      const d = extrairData(r.DATA);
      let saldo = parseFloat(r.SALDO);
      if (isNaN(saldo)) saldo = (parseFloat(r.VALOR_DEBITO) || 0) - (parseFloat(r.VALOR_CREDITO) || 0);

      // Convenção de sinal:
      // DRE  → dreVal = -SALDO
      // BP   → Ativo (1xxx) = SALDO; Passivo/PL (2xxx) = -SALDO
      let dreVal;
      if (ddAtual.tipo === 'bp') {
        const p1 = String(r.CONTA || '').trim().charAt(0);
        dreVal = p1 === '1' ? saldo : -saldo;
      } else {
        dreVal = -saldo;
      }

      return {
        data:      d,
        filial:    r.FILIAL_NOME || '',
        bu:        r.BU || '',
        conta:     String(r.CONTA || ''),
        descConta: r.DESC_CONTA || '',
        historico: r.HISTORICO || '',
        dreVal,
      };
    })
    .sort((a, b) => a.conta.localeCompare(b.conta) || (a.data || 0) - (b.data || 0));
}

/* Renderiza o conteúdo do drawer */
function renderizarDrill() {
  if (!ddAtual) return;

  const busca      = document.getElementById('ddSearch').value.trim().toLowerCase();
  const todos      = obterLancamentosDrill();
  const totalGeral = todos.reduce((s, l) => s + l.dreVal, 0);

  // Agrupar por conta
  const grupos = {};
  todos.forEach(l => {
    const k = l.conta;
    if (!grupos[k]) grupos[k] = { conta: l.conta, descConta: l.descConta, items: [], subtotal: 0 };
    grupos[k].items.push(l);
    grupos[k].subtotal += l.dreVal;
  });

  const tbody = document.getElementById('ddBody');
  tbody.innerHTML = '';

  let totalVisivel   = 0;
  let contLancamentos = 0;

  Object.values(grupos).forEach(grupo => {
    // Filtrar itens do grupo pela busca
    const itens = busca
      ? grupo.items.filter(l =>
          l.historico.toLowerCase().includes(busca) ||
          l.descConta.toLowerCase().includes(busca) ||
          l.filial.toLowerCase().includes(busca)    ||
          l.conta.includes(busca))
      : grupo.items;

    if (!itens.length) return;

    contLancamentos += itens.length;
    const subtotalVis = itens.reduce((s, l) => s + l.dreVal, 0);
    totalVisivel     += subtotalVis;

    // Linha de grupo (cabeçalho colapsável)
    const trGrupo = document.createElement('tr');
    trGrupo.className = 'dd-group';

    const tdTog = document.createElement('td');
    tdTog.className = 'dd-col-toggle';
    tdTog.innerHTML = '<span class="dd-toggle-icon">▶</span>';

    const tdConta = document.createElement('td');
    tdConta.textContent = grupo.conta;
    tdConta.style.fontFamily = 'monospace';

    const tdDesc = document.createElement('td');
    tdDesc.textContent = grupo.descConta;

    const tdCount = document.createElement('td');
    tdCount.className = 'dd-col-count';
    tdCount.textContent = itens.length;

    const tdSub = document.createElement('td');
    tdSub.className = `dd-col-val ${subtotalVis >= 0 ? 'val-pos' : 'val-neg'}`;
    tdSub.textContent = formatBRL(subtotalVis);

    trGrupo.append(tdTog, tdConta, tdDesc, tdCount, tdSub);
    tbody.appendChild(trGrupo);

    // Linhas de lançamentos (ocultas por padrão; expandidas se há busca)
    const itemRows = itens.map(l => {
      const tr = document.createElement('tr');
      tr.className = `dd-item${busca ? ' visible' : ''}`;

      const tdVazio = document.createElement('td');

      const tdData = document.createElement('td');
      tdData.className = 'dd-td-date';
      tdData.textContent = l.data ? l.data.toLocaleDateString('pt-BR') : '—';

      const tdEmpresa = document.createElement('td');
      tdEmpresa.className = 'dd-td-empresa';
      tdEmpresa.title = l.filial;
      tdEmpresa.textContent = l.filial;

      const tdBU = document.createElement('td');
      tdBU.innerHTML = `<span class="dd-bu-badge">${l.bu}</span>`;

      const tdHist = document.createElement('td');
      tdHist.className = 'dd-td-hist';
      tdHist.title = l.historico;
      // Destaca termo de busca no histórico
      if (busca && l.historico.toLowerCase().includes(busca)) {
        const re = new RegExp(`(${busca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        tdHist.innerHTML = l.historico.replace(re, '<mark>$1</mark>');
      } else {
        tdHist.textContent = l.historico;
      }

      const tdVal = document.createElement('td');
      tdVal.className = `dd-td-val ${l.dreVal >= 0 ? 'val-pos' : 'val-neg'}`;
      tdVal.textContent = formatBRL(l.dreVal);

      tr.append(tdVazio, tdData, tdEmpresa, tdBU, tdHist, tdVal);
      return tr;
    });

    // Expande com busca ativa; senão colapsa ao clicar
    if (busca) {
      trGrupo.classList.add('is-open');
    }

    trGrupo.addEventListener('click', () => {
      const aberto = trGrupo.classList.toggle('is-open');
      itemRows.forEach(r => r.classList.toggle('visible', aberto));
    });

    itemRows.forEach(r => tbody.appendChild(r));
  });

  // Stats
  document.getElementById('ddStats').innerHTML =
    `<span><strong>${contLancamentos}</strong> lançamento(s) em <strong>${Object.keys(grupos).length}</strong> conta(s)</span>` +
    `<span>Total período: <strong class="${totalGeral >= 0 ? 'val-pos' : 'val-neg'}">${formatBRL(totalGeral)}</strong></span>`;

  if (!contLancamentos) {
    tbody.innerHTML = `<tr><td colspan="6" class="dd-empty">Nenhum lançamento encontrado${busca ? ' para "' + busca + '"' : ''}.</td></tr>`;
  }

  // Footer
  document.getElementById('ddFooter').innerHTML =
    `<span>${contLancamentos} lançamento(s)${busca ? ' filtrados' : ''}</span>` +
    `<span class="dd-footer-total">Total: <strong class="${totalVisivel >= 0 ? 'val-pos' : 'val-neg'}">${formatBRL(totalVisivel)}</strong></span>`;
}

/* Exporta CSV do drill-down */
function exportarDrillCSV() {
  if (!ddAtual) return;
  const todos = obterLancamentosDrill();

  const cabecalho = ['Data','Empresa','BU','Conta','Descrição Conta','Histórico','Valor DRE'];
  const linhas    = todos.map(l => [
    l.data ? l.data.toLocaleDateString('pt-BR') : '',
    l.filial, l.bu, l.conta, l.descConta, l.historico,
    formatBRL(l.dreVal),
  ]);

  const csv = [cabecalho, ...linhas]
    .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), {
    href:     url,
    download: `Detalhe_${ddAtual.tipo === 'bp' ? 'BP_' + ddAtual.linhaLabel.replace(/\s+/g,'_').substring(0,20) : ddAtual.linhaId}_${new Date().toISOString().slice(0,10)}.csv`,
  }).click();
  URL.revokeObjectURL(url);
}

// ── BALANCETE ────────────────────────────────────────────────

/* Abre o drill-down para contas do Balanço Patrimonial */
function abrirDrillDownBP(contas, label) {
  ddAtual   = { tipo: 'bp', contas, linhaId: null, linhaLabel: label, linhaPrefix: '≡' };
  ddPeriodo = 'todos';

  document.getElementById('ddPrefix').textContent    = '≡';
  document.getElementById('ddTitleText').textContent = label;
  document.getElementById('ddSearch').value          = '';

  const { periodos } = processarBP(dadosBrutos, filtroFilial, filtroBU, modoVisualizacao);
  renderizarAbasDrill(periodos);
  renderizarDrill();

  document.getElementById('ddOverlay').classList.add('is-open');
  document.getElementById('ddDrawer').classList.add('is-open');
  document.getElementById('ddDrawer').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

/* Processa contas de Ativo (1xxx) e Passivo/PL (2xxx) */
function processarBP(rows, filtFilial, filtBU, modo) {
  const filtrados = rows.filter(r => {
    if (!r.CONTA) return false;
    const p1 = String(r.CONTA).trim().charAt(0);
    if (p1 !== '1' && p1 !== '2') return false;
    if (filtFilial.size > 0 && !filtFilial.has(r.FILIAL_NOME)) return false;
    if (filtBU.size     > 0 && !filtBU.has(r.BU))             return false;
    return true;
  });

  // Períodos disponíveis
  const periodSet = new Set();
  filtrados.forEach(r => {
    const d = extrairData(r.DATA);
    if (d) periodSet.add(chavePeriodo(d, modo));
  });
  const periodos = [...periodSet].sort();

  // Agrega por conta × período
  const contasMapa = {};
  filtrados.forEach(r => {
    const d = extrairData(r.DATA);
    if (!d) return;
    const p     = chavePeriodo(d, modo);
    const conta = String(r.CONTA).trim();
    const p1    = conta.charAt(0);
    const p2    = conta.substring(0, 2);

    let saldo = parseFloat(r.SALDO);
    if (isNaN(saldo)) saldo = (parseFloat(r.VALOR_DEBITO) || 0) - (parseFloat(r.VALOR_CREDITO) || 0);
    // Ativo = SALDO (débito normal); Passivo/PL = -SALDO (crédito normal → positivo)
    const bpVal = p1 === '1' ? saldo : -saldo;

    if (!contasMapa[conta]) {
      contasMapa[conta] = {
        conta, descConta: r.DESC_CONTA || conta,
        grupo: p1 === '1' ? 'ativo' : 'passivo',
        subgrupo: p2, periodos: {}, total: 0,
      };
    }
    contasMapa[conta].periodos[p] = (contasMapa[conta].periodos[p] || 0) + bpVal;
    contasMapa[conta].total      += bpVal;
  });

  // Monta subgrupos
  const subgruposMapa = {};
  Object.values(contasMapa).forEach(c => {
    const k = c.subgrupo;
    if (!subgruposMapa[k]) {
      subgruposMapa[k] = {
        subgrupo: k,
        label: BP_SUBGRUPO_LABELS[k] || `Grupo ${k}`,
        grupo: c.grupo,
        contasMap: {}, totais: {}, total: 0,
      };
    }
    subgruposMapa[k].contasMap[c.conta] = c;
    periodos.forEach(p => {
      subgruposMapa[k].totais[p] = (subgruposMapa[k].totais[p] || 0) + (c.periodos[p] || 0);
    });
    subgruposMapa[k].total += c.total;
  });

  // Monta seções
  const buildSection = (grupoId, label) => {
    const subgrupos = Object.values(subgruposMapa)
      .filter(sg => sg.grupo === grupoId)
      .sort((a, b) => a.subgrupo.localeCompare(b.subgrupo));
    const totais = {};
    let total = 0;
    subgrupos.forEach(sg => {
      periodos.forEach(p => { totais[p] = (totais[p] || 0) + (sg.totais[p] || 0); });
      total += sg.total;
    });
    return { id: grupoId, label, subgrupos, totais, total };
  };

  return {
    periodos,
    sections: [
      buildSection('ativo',   'ATIVO'),
      buildSection('passivo', 'PASSIVO + PATRIMÔNIO LÍQUIDO'),
    ],
  };
}

/* KPIs do Balancete */
function renderizarKPIsBP(bpData) {
  const { periodos, sections } = bpData;
  const ativo   = sections[0];
  const passivo = sections[1];

  const totalAtivo   = ativo.total;
  const totalPassivo = passivo.total;
  const delta        = totalAtivo - totalPassivo;

  // Ativo Circulante = subgrupo '11' (ou primeiro subgrupo do ativo)
  const sgAC = ativo.subgrupos.find(sg => sg.subgrupo === '11') || ativo.subgrupos[0];
  const totalAC = sgAC ? sgAC.total : 0;

  document.getElementById('bpKpiAtivoVal').textContent     = formatBRL(totalAtivo);
  document.getElementById('bpKpiAtivoMeta').textContent    = `${periodos.length} período(s)`;
  document.getElementById('bpKpiPassivoVal').textContent   = formatBRL(totalPassivo);
  document.getElementById('bpKpiPassivoMeta').textContent  = `${periodos.length} período(s)`;
  document.getElementById('bpKpiACVal').textContent        = formatBRL(totalAC);
  document.getElementById('bpKpiACMeta').textContent       = sgAC ? sgAC.label : '—';

  const elDelta = document.getElementById('bpKpiDeltaVal');
  elDelta.textContent  = formatBRL(delta);
  elDelta.className    = `kpi-value ${Math.abs(delta) < 0.01 ? 'val-pos' : 'val-neg'}`;
}

/* Renderiza a tabela do Balancete */
function renderizarBalancete() {
  const bpData = processarBP(dadosBrutos, filtroFilial, filtroBU, modoVisualizacao);
  const { periodos, sections } = bpData;

  renderizarKPIsBP(bpData);

  const thead = document.getElementById('bpHead');
  const tbody = document.getElementById('bpBody');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  if (!periodos.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:2rem;color:#94a3b8">Nenhum dado de Ativo/Passivo encontrado no arquivo.</td></tr>';
    return;
  }

  // ── Cabeçalho ──────────────────────────────────────────────
  const tr1 = document.createElement('tr');
  [criarTH(''), criarTH('Conta'), criarTH('Descrição')].forEach(th => tr1.appendChild(th));
  periodos.forEach(p  => tr1.appendChild(criarTH(labelPeriodo(p, modoVisualizacao))));
  tr1.appendChild(criarTH('Total'));
  thead.appendChild(tr1);

  // ── Helper: cria célula de valor ───────────────────────────
  const tdVal = (v, cls = '') => {
    const td = document.createElement('td');
    td.textContent = formatBRL(v);
    td.className   = (v >= 0 ? 'val-pos' : 'val-neg') + (cls ? ' ' + cls : '');
    return td;
  };

  // Monta linhas por seção
  sections.forEach(section => {
    // Linha de seção (ATIVO / PASSIVO + PL)
    const trSec = document.createElement('tr');
    trSec.className = 'row-header';
    const tdSec = document.createElement('td');
    tdSec.colSpan = 3 + periodos.length + 1;
    tdSec.textContent = section.label;
    trSec.appendChild(tdSec);
    tbody.appendChild(trSec);

    section.subgrupos.forEach(sg => {
      const allContas = Object.keys(sg.contasMap);

      // ── Linha de subgrupo (colapsável + drillável) ──────────
      const trSg = document.createElement('tr');
      trSg.className = 'row-bp-subgrupo row-drillable';

      const tdTog = document.createElement('td');
      tdTog.className = 'bp-col-toggle';
      tdTog.innerHTML = '<span class="dd-toggle-icon">▶</span>';
      trSg.appendChild(tdTog);

      const tdSgName = document.createElement('td');
      tdSgName.colSpan = 2;
      tdSgName.textContent = sg.label;
      trSg.appendChild(tdSgName);

      periodos.forEach(p => trSg.appendChild(tdVal(sg.totais[p] || 0)));
      trSg.appendChild(tdVal(sg.total));
      tbody.appendChild(trSg);

      // ── Linhas de contas individuais (ocultas por padrão) ───
      const contaRows = Object.values(sg.contasMap)
        .sort((a, b) => a.conta.localeCompare(b.conta))
        .map(c => {
          const tr = document.createElement('tr');
          tr.className    = 'row-bp-conta row-drillable';
          tr.style.display = 'none';

          const tdT = document.createElement('td'); // espaçador toggle
          tr.appendChild(tdT);

          const tdCod = document.createElement('td');
          tdCod.className   = 'bp-col-conta';
          tdCod.textContent = c.conta;
          tr.appendChild(tdCod);

          const tdDesc = document.createElement('td');
          tdDesc.textContent = c.descConta;
          tr.appendChild(tdDesc);

          periodos.forEach(p => tr.appendChild(tdVal(c.periodos[p] || 0)));
          tr.appendChild(tdVal(c.total));

          // Drill-down na conta individual
          tr.addEventListener('click', () => abrirDrillDownBP([c.conta], c.descConta));
          tbody.appendChild(tr);
          return tr;
        });

      // Toggle expande/colapsa contas do subgrupo
      let sgAberto = false;
      tdTog.addEventListener('click', e => {
        e.stopPropagation();
        sgAberto = !sgAberto;
        trSg.classList.toggle('is-open', sgAberto);
        contaRows.forEach(r => r.style.display = sgAberto ? '' : 'none');
      });

      // Drill-down no subgrupo (linha inteira, exceto toggle)
      trSg.addEventListener('click', e => {
        if (e.target.closest('.bp-col-toggle')) return;
        abrirDrillDownBP(allContas, sg.label);
      });
    });

    // ── Total da seção ──────────────────────────────────────
    const trTot = document.createElement('tr');
    trTot.className = 'row-bp-total';

    const tdTotEmpty = document.createElement('td');
    trTot.appendChild(tdTotEmpty);

    const tdTotLabel = document.createElement('td');
    tdTotLabel.colSpan    = 2;
    tdTotLabel.textContent = `TOTAL ${section.label}`;
    trTot.appendChild(tdTotLabel);

    periodos.forEach(p => trTot.appendChild(tdVal(section.totais[p] || 0)));
    trTot.appendChild(tdVal(section.total));
    tbody.appendChild(trTot);
  });

  // ── Linha de verificação (Ativo − Passivo+PL) ───────────────
  const ativo   = sections[0];
  const passivo = sections[1];
  const trCheck = document.createElement('tr');
  trCheck.className = 'row-bp-check';

  const tdChkEmpty = document.createElement('td');
  trCheck.appendChild(tdChkEmpty);

  const tdChkLabel = document.createElement('td');
  tdChkLabel.colSpan    = 2;
  tdChkLabel.textContent = 'VERIFICAÇÃO  (Ativo − Passivo+PL)';
  trCheck.appendChild(tdChkLabel);

  let estaBalanceado = true;
  periodos.forEach(p => {
    const delta = (ativo.totais[p] || 0) - (passivo.totais[p] || 0);
    if (Math.abs(delta) > 0.01) estaBalanceado = false;
    const td = document.createElement('td');
    td.textContent = formatBRL(delta);
    td.style.fontWeight = '700';
    trCheck.appendChild(td);
  });

  const deltaTotal = ativo.total - passivo.total;
  if (Math.abs(deltaTotal) > 0.01) estaBalanceado = false;
  const tdChkTot = document.createElement('td');
  tdChkTot.textContent = formatBRL(deltaTotal);
  tdChkTot.style.fontWeight = '700';
  trCheck.appendChild(tdChkTot);

  if (estaBalanceado) trCheck.classList.add('balanced');
  tbody.appendChild(trCheck);
}

// ── EXPORTAR CSV ─────────────────────────────────────────────

function exportarCSV() {
  const table = document.getElementById('dreTable');
  if (!table) return;

  let csv = '';
  table.querySelectorAll('tr').forEach(row => {
    const celulas = [...row.querySelectorAll('th,td')].map(c =>
      '"' + c.textContent.replace(/"/g, '""').trim() + '"'
    );
    csv += celulas.join(';') + '\n';
  });

  const bom  = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href:     url,
    download: `DRE_${new Date().toISOString().slice(0,10)}.csv`,
  });
  a.click();
  URL.revokeObjectURL(url);
}
