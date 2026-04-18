/* ============================================================
   CARTÃO DE CRÉDITO — app.js
   ============================================================ */

// ── PDF.js worker ──────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── Storage Keys ───────────────────────────────────────────
const KEY_CARTOES  = 'cc_cartoes_v1';
const KEY_FATURAS  = 'cc_faturas_v1';
const KEY_LANCS    = 'cc_lancamentos_v1';

// ── Categorias padrão ──────────────────────────────────────
const CATEGORIAS = [
  'Alimentação', 'Supermercado', 'Transporte', 'Combustível',
  'Saúde', 'Farmácia', 'Educação', 'Lazer', 'Viagem',
  'Vestuário', 'Assinatura', 'Serviço', 'Transferência',
  'Parcelamento', 'Outros'
];

// ── Cores para cartões ─────────────────────────────────────
const CARD_COLORS = [
  '#2563eb','#16a34a','#dc2626','#d97706','#7c3aed',
  '#0891b2','#db2777','#65a30d','#ea580c','#0f2044'
];

// ── Banco labels ───────────────────────────────────────────
const BANCO_LABELS = {
  mercado_pago:        'Mercado Pago',
  inter:               'Inter',
  santander_empresas:  'Santander Empresas',
  santander_unique:    'Santander Unique',
  outro:               'Outro',
  '':                  'Outro'
};

// ══════════════════════════════════════════════════════════
// STORE
// ══════════════════════════════════════════════════════════
const Store = {
  getCartoes:  () => JSON.parse(localStorage.getItem(KEY_CARTOES)  || '[]'),
  getFaturas:  () => JSON.parse(localStorage.getItem(KEY_FATURAS)  || '[]'),
  getLancs:    () => JSON.parse(localStorage.getItem(KEY_LANCS)    || '[]'),

  saveCartoes: (d) => localStorage.setItem(KEY_CARTOES,  JSON.stringify(d)),
  saveFaturas: (d) => localStorage.setItem(KEY_FATURAS,  JSON.stringify(d)),
  saveLancs:   (d) => localStorage.setItem(KEY_LANCS,    JSON.stringify(d)),

  getCartao(id) { return this.getCartoes().find(c => c.id === id); },

  upsertCartao(cartao) {
    const list = this.getCartoes();
    const idx  = list.findIndex(c => c.id === cartao.id);
    if (idx >= 0) list[idx] = cartao; else list.push(cartao);
    this.saveCartoes(list);
  },

  deleteCartao(id) {
    this.saveCartoes(this.getCartoes().filter(c => c.id !== id));
    this.saveFaturas(this.getFaturas().filter(f => f.cartaoId !== id));
    this.saveLancs(this.getLancs().filter(l => l.cartaoId !== id));
  },

  addFatura(fatura) {
    const list = this.getFaturas();
    list.push(fatura);
    this.saveFaturas(list);
  },

  deleteFatura(id) {
    this.saveFaturas(this.getFaturas().filter(f => f.id !== id));
    this.saveLancs(this.getLancs().filter(l => l.faturaId !== id));
  },

  addLancs(lancs) {
    const list = this.getLancs();
    list.push(...lancs);
    this.saveLancs(list);
  },

  updateLanc(id, patch) {
    const list = this.getLancs();
    const idx  = list.findIndex(l => l.id === id);
    if (idx >= 0) { list[idx] = { ...list[idx], ...patch }; this.saveLancs(list); }
  },

  deleteLanc(id) {
    this.saveLancs(this.getLancs().filter(l => l.id !== id));
  }
};

// ══════════════════════════════════════════════════════════
// UTILITÁRIOS
// ══════════════════════════════════════════════════════════
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function isoFromDDMM(dd, mm, yyyy) {
  const y = yyyy || new Date().getFullYear();
  return `${String(y).padStart(4,'0')}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
}

function inferCategoria(desc) {
  const d = desc.toLowerCase();
  if (/supermercado|mercado|carrefour|extra|atacadão|sam's|walmart|assai/.test(d)) return 'Supermercado';
  if (/restaurante|lanchonete|padaria|ifood|rappi|uber.?eat|delivery|burger|mcdonald|subway|pizza/.test(d)) return 'Alimentação';
  if (/uber|99|taxi|onibus|metrô|metro|passagem|combustivel|gasolina|shell|posto|ipiranga|petrobras/.test(d)) return 'Transporte';
  if (/combustivel|gasolina|etanol|diesel|shell|posto|ipiranga|br avia/.test(d)) return 'Combustível';
  if (/farmac|drogaria|droga|ultrafarma|pacheco|panvel|drogasil/.test(d)) return 'Farmácia';
  if (/hospital|clínica|clinica|médico|medico|plano.?saude|unimed|bradesco.?saude|dental|odonto/.test(d)) return 'Saúde';
  if (/escola|faculdade|curso|universidade|mensalidade|mba|idioma/.test(d)) return 'Educação';
  if (/netflix|spotify|amazon.?prime|youtube|disney|hbo|globo.?play|telecine|deezer|apple/.test(d)) return 'Assinatura';
  if (/viagem|hotel|airbnb|booking|decolar|cvc|latam|gol|azul|aereo|hospedagem/.test(d)) return 'Viagem';
  if (/roupa|vestuário|zara|hm |renner|riachuelo|c&a|marisa|lojas|calçad/.test(d)) return 'Vestuário';
  if (/transf|pix|pagamento|boleto/.test(d)) return 'Transferência';
  if (/parc |parcela|parcelamento/.test(d)) return 'Parcelamento';
  if (/mercado.?pago|stone|cielo|pagamento/.test(d)) return 'Serviço';
  return 'Outros';
}

function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + type;
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function openConfirm(title, body, onOk) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-body').textContent  = body;
  document.getElementById('modal-confirm').style.display = 'flex';
  const ok = document.getElementById('confirm-ok');
  ok.onclick = () => {
    document.getElementById('modal-confirm').style.display = 'none';
    onOk();
  };
}

function cartaoChip(cartao) {
  if (!cartao) return '<span class="td-muted">—</span>';
  const color = cartao.cor || '#2563eb';
  const r = parseInt(color.slice(1,3),16);
  const g = parseInt(color.slice(3,5),16);
  const b = parseInt(color.slice(5,7),16);
  const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
  const fg  = lum > 0.55 ? '#1e293b' : '#ffffff';
  return `<span class="chip-cartao" style="background:${color};color:${fg}">
    <span class="chip-dot" style="background:${fg};opacity:.7;"></span>
    ${esc(cartao.nome)}
  </span>`;
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ══════════════════════════════════════════════════════════
// PDF TEXT EXTRACTION
// ══════════════════════════════════════════════════════════
async function extractPdfText(file) {
  const buf  = await file.arrayBuffer();
  const pdf  = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page  = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Preserve line structure by sorting by Y then X
    const items = content.items.slice().sort((a, b) => {
      const dy = Math.round(b.transform[5]) - Math.round(a.transform[5]);
      return dy !== 0 ? dy : a.transform[4] - b.transform[4];
    });
    let lines = [];
    let lastY = null;
    let line  = [];
    for (const item of items) {
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        lines.push(line.join(' ').trim());
        line = [];
      }
      line.push(item.str);
      lastY = y;
    }
    if (line.length) lines.push(line.join(' ').trim());
    pages.push(lines.filter(l => l.length > 0));
  }
  return pages;
}

// ══════════════════════════════════════════════════════════
// PARSERS
// ══════════════════════════════════════════════════════════

// ── Detectar banco ─────────────────────────────────────────
function detectBanco(pages) {
  const flat = pages.flat().join(' ').toLowerCase();
  if (/mercado.?pago/.test(flat))              return 'mercado_pago';
  if (/fatura inter|banco inter|inter\.co/.test(flat)) return 'inter';
  if (/santander.*empresas|empresas.*santander|santander.*corporate/.test(flat)) return 'santander_empresas';
  if (/santander.*unique|unique.*santander|visa.*infinite|infinite.*visa/.test(flat)) return 'santander_unique';
  if (/santander/.test(flat))                  return 'santander_unique';
  return 'outro';
}

// ── Parsear valor BR ───────────────────────────────────────
function parseBRLValue(s) {
  // Ex: "1.234,56" ou "1234,56" ou "R$ 1.234,56"
  const clean = s.replace(/[R$\s]/g,'').replace(/\./g,'').replace(',','.');
  return parseFloat(clean);
}

// ── Mercado Pago ───────────────────────────────────────────
// Linha: "DD/MM Descrição [Parcela X de Y] R$ 1.234,56"
function parseMercadoPago(pages) {
  const results = [];
  // Encontrar cartão
  let ultimosDigitos = '';
  const allLines = pages.flat();

  for (const line of allLines) {
    const mCard = line.match(/Cart[aã]o\s+(?:Visa|Master)?\s*\[?\*{0,4}(\d{4})\]?/i);
    if (mCard) { ultimosDigitos = mCard[1]; break; }
  }

  // Encontrar ano da fatura
  let anoFatura = new Date().getFullYear();
  for (const line of allLines) {
    const mAno = line.match(/\b(20\d{2})\b/);
    if (mAno) { anoFatura = parseInt(mAno[1]); break; }
  }

  // Processar transações
  const txRegex = /^(\d{2})\/(\d{2})\s+(.+?)\s+R\$\s*([\d.,]+)\s*$/;
  const parcRegex = /Parcela\s+(\d+)\s+de\s+(\d+)/i;

  for (const line of allLines) {
    const m = line.match(txRegex);
    if (!m) continue;
    const [, dd, mm, descRaw, valorStr] = m;
    const valor = parseBRLValue(valorStr);
    if (isNaN(valor) || valor === 0) continue;

    const parcM = descRaw.match(parcRegex);
    let parcela  = '';
    let desc     = descRaw.replace(parcRegex, '').trim();
    if (parcM) parcela = `${parcM[1]}/${parcM[2]}`;

    results.push({
      data:     isoFromDDMM(dd, mm, anoFatura),
      descricao: desc,
      valor,
      parcela,
      categoria: inferCategoria(desc)
    });
  }
  return { transactions: results, ultimosDigitos };
}

// ── Santander Empresas ─────────────────────────────────────
// Linha: "DD-MM-YYYY Descrição [PARC XX/YY LOCAL] VALOR"
function parseSantanderEmpresas(pages) {
  const results = [];
  const allLines = pages.flat();

  // Cartão
  let ultimosDigitos = '';
  for (const line of allLines) {
    const m = line.match(/\b(\d{4})\s+[Xx*]{4}\s+[Xx*]{4}\s+(\d{4})\b/);
    if (m) { ultimosDigitos = m[2]; break; }
    const m2 = line.match(/\*{4}\s*(\d{4})/);
    if (m2) { ultimosDigitos = m2[1]; break; }
  }

  // Transações: data no formato DD-MM-YYYY ou DD/MM/YYYY
  const txRegex = /^(\d{2})[-/](\d{2})[-/](\d{4})\s+(.+?)\s+([\d.,]+)\s*$/;
  const parcRegex = /PARC\s+(\d{1,2})\/(\d{1,2})/i;

  let inSection = false;
  for (const line of allLines) {
    if (/demonstrativo.*(transa|lançamento)/i.test(line)) { inSection = true; continue; }
    if (!inSection) continue;
    if (/total|subtotal|saldo/i.test(line) && line.length < 40) continue;

    const m = line.match(txRegex);
    if (!m) continue;
    const [, dd, mm, yyyy, descRaw, valorStr] = m;
    const valor = parseBRLValue(valorStr);
    if (isNaN(valor) || valor === 0) continue;

    const parcM = descRaw.match(parcRegex);
    let parcela  = '';
    let desc     = descRaw.replace(parcRegex, '').replace(/\s{2,}/g,' ').trim();
    if (parcM) parcela = `${parcM[1]}/${parcM[2]}`;

    results.push({
      data:     isoFromDDMM(dd, mm, parseInt(yyyy)),
      descricao: desc,
      valor,
      parcela,
      categoria: inferCategoria(desc)
    });
  }
  return { transactions: results, ultimosDigitos };
}

// ── Inter ──────────────────────────────────────────────────
// Fatura pode ter múltiplos sub-cartões
// Cabeçalho: "5364****XXXX"
// Linha: "DD de mes. YYYY Beneficiário Descrição [Parcela XX de YY] R$ VALOR"
function parseMesPortugues(mes) {
  const m = { jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12 };
  return m[mes.toLowerCase().slice(0,3)] || 0;
}

function parseInter(pages) {
  const allLines = pages.flat();
  const subCartoes = [];
  let currentCartao = null;

  const cardRegex   = /(\d{4})\*{4}(\d{4})/;
  // DD de mes. YYYY  ou  DD de mes YYYY
  const dateRegex   = /^(\d{1,2})\s+de\s+([a-záéíóúâêôãõ]+)\.?\s+(\d{4})\b/i;
  const parcRegex   = /Parcela\s+(\d+)\s+de\s+(\d+)/i;
  const valorRegex  = /R\$\s*([\d.,]+)\s*$/;

  for (const line of allLines) {
    // Detectar sub-cartão
    const mCard = line.match(cardRegex);
    if (mCard) {
      const ultimos = mCard[2];
      currentCartao = { ultimos, transactions: [] };
      subCartoes.push(currentCartao);
      continue;
    }

    if (!currentCartao) continue;

    // Detectar linha de transação
    const mDate = line.match(dateRegex);
    if (!mDate) continue;

    const [fullDate, dd, mesStr, yyyy] = mDate;
    const mm  = parseMesPortugues(mesStr);
    if (!mm) continue;

    const rest = line.slice(fullDate.length).trim();
    const mValor = rest.match(valorRegex);
    if (!mValor) continue;

    const valor   = parseBRLValue(mValor[1]);
    if (isNaN(valor) || valor === 0) continue;

    let descRaw = rest.slice(0, rest.lastIndexOf(mValor[0])).trim();
    const parcM = descRaw.match(parcRegex);
    let parcela  = '';
    if (parcM) {
      parcela  = `${parcM[1]}/${parcM[2]}`;
      descRaw  = descRaw.replace(parcRegex, '').trim();
    }
    // Remove possível nome do beneficiário (primeira palavra maiúscula separada)
    const desc = descRaw.replace(/\s{2,}/g, ' ').trim();

    currentCartao.transactions.push({
      data:     isoFromDDMM(String(dd).padStart(2,'0'), String(mm).padStart(2,'0'), parseInt(yyyy)),
      descricao: desc,
      valor,
      parcela,
      categoria: inferCategoria(desc)
    });
  }

  if (!subCartoes.length) {
    // Fallback: tente como cartão único
    return [{ ultimos: '', transactions: [] }];
  }
  return subCartoes;
}

// ── Santander Unique / multi-portador ──────────────────────
// Seção: "NOME - 4258 XXXX XXXX YYYY"
// Linhas: "DD/MM Descrição [PARC XX/YY] VALOR"
function parseSantanderUnique(pages) {
  const allLines = pages.flat();
  const portadores = [];
  let current = null;

  const portadorRegex = /^([A-ZÁÉÍÓÚÂÊÔÃÕ ]+)\s*[-–]\s*(\d{4})\s+[Xx*]{4}\s+[Xx*]{4}\s+(\d{4})/i;
  const txRegex       = /^(\d{2})\/(\d{2})\s+(.+?)\s+([\d.,]+)\s*$/;
  const parcRegex     = /PARC\s+(\d{1,2})\/(\d{1,2})/i;

  // Ano da fatura
  let anoFatura = new Date().getFullYear();
  for (const line of allLines) {
    const mAno = line.match(/(?:vencimento|fatura|referente).*?(20\d{2})/i);
    if (mAno) { anoFatura = parseInt(mAno[1]); break; }
  }

  for (const line of allLines) {
    const mPort = line.match(portadorRegex);
    if (mPort) {
      current = { portador: mPort[1].trim(), ultimos: mPort[3], transactions: [] };
      portadores.push(current);
      continue;
    }

    if (!current) continue;

    const m = line.match(txRegex);
    if (!m) continue;
    const [, dd, mm, descRaw, valorStr] = m;
    const valor = parseBRLValue(valorStr);
    if (isNaN(valor) || valor === 0) continue;

    const parcM = descRaw.match(parcRegex);
    let parcela  = '';
    let desc     = descRaw.replace(parcRegex, '').trim();
    if (parcM) parcela = `${parcM[1]}/${parcM[2]}`;

    current.transactions.push({
      data:     isoFromDDMM(dd, mm, anoFatura),
      descricao: desc,
      valor,
      parcela,
      categoria: inferCategoria(desc)
    });
  }

  // Fallback
  if (!portadores.length) {
    // Generic Santander: same as empresas fallback
    const r = parseSantanderEmpresas(pages);
    return [{ portador: '', ultimos: r.ultimosDigitos, transactions: r.transactions }];
  }
  return portadores;
}

// ── Dispatcher ─────────────────────────────────────────────
// Retorna: [{ cartaoKey, ultimos, portador, transactions }]
async function parsePDF(file) {
  const pages = await extractPdfText(file);
  const banco = detectBanco(pages);

  if (banco === 'mercado_pago') {
    const { transactions, ultimosDigitos } = parseMercadoPago(pages);
    return [{ banco, ultimos: ultimosDigitos, portador: '', transactions }];
  }

  if (banco === 'inter') {
    const subs = parseInter(pages);
    return subs.map(s => ({ banco, ultimos: s.ultimos, portador: '', transactions: s.transactions }));
  }

  if (banco === 'santander_empresas') {
    const { transactions, ultimosDigitos } = parseSantanderEmpresas(pages);
    return [{ banco, ultimos: ultimosDigitos, portador: '', transactions }];
  }

  if (banco === 'santander_unique') {
    const portadores = parseSantanderUnique(pages);
    return portadores.map(p => ({ banco, ultimos: p.ultimos, portador: p.portador, transactions: p.transactions }));
  }

  // Genérico: tenta detectar linhas com data e valor
  return [{ banco: 'outro', ultimos: '', portador: '', transactions: parseGenerico(pages) }];
}

function parseGenerico(pages) {
  const results = [];
  const txRegex = /^(\d{2})\/(\d{2})\s+(.+?)\s+([\d.,]+)\s*$/;
  for (const line of pages.flat()) {
    const m = line.match(txRegex);
    if (!m) continue;
    const [, dd, mm, desc, valorStr] = m;
    const valor = parseBRLValue(valorStr);
    if (!isNaN(valor) && valor > 0) {
      results.push({
        data: isoFromDDMM(dd, mm, new Date().getFullYear()),
        descricao: desc.trim(),
        valor,
        parcela: '',
        categoria: inferCategoria(desc)
      });
    }
  }
  return results;
}

// ══════════════════════════════════════════════════════════
// IMPORT FLOW
// ══════════════════════════════════════════════════════════
let importQueue = []; // [{ file, parsed, status, items }]

function openImportModal() {
  importQueue = [];
  document.getElementById('import-progress').style.display = 'none';
  document.getElementById('import-drop-area').style.display = 'flex';
  document.getElementById('import-confirm').style.display = 'none';
  document.getElementById('import-file-list').innerHTML = '';
  document.getElementById('modal-import').style.display = 'flex';
}

async function processImportFiles(files) {
  if (!files || !files.length) return;
  document.getElementById('import-drop-area').style.display = 'none';
  document.getElementById('import-progress').style.display  = 'block';

  const list = document.getElementById('import-file-list');

  for (const file of files) {
    const itemId = uid();
    const itemEl = document.createElement('div');
    itemEl.className = 'import-file-item';
    itemEl.id = itemId;
    itemEl.innerHTML = `
      <div class="import-file-icon">📄</div>
      <div class="import-file-info">
        <div class="import-file-name">${esc(file.name)}</div>
        <div class="import-file-bank"></div>
        <div class="import-file-status loading">⏳ Lendo PDF…</div>
        <div class="progress-bar-wrap"><div class="progress-bar" style="width:30%"></div></div>
      </div>`;
    list.appendChild(itemEl);

    const bankEl   = itemEl.querySelector('.import-file-bank');
    const statusEl = itemEl.querySelector('.import-file-status');
    const barEl    = itemEl.querySelector('.progress-bar');

    try {
      barEl.style.width = '60%';
      const parsed = await parsePDF(file);
      barEl.style.width = '100%';

      const totalTx = parsed.reduce((s, p) => s + p.transactions.length, 0);
      const banco   = BANCO_LABELS[parsed[0]?.banco] || 'Desconhecido';

      bankEl.textContent = banco;

      if (totalTx === 0) {
        statusEl.className = 'import-file-status err';
        statusEl.textContent = '⚠ Nenhuma transação encontrada. Formato não reconhecido.';
        importQueue.push({ file, parsed, status: 'warn', totalTx });
      } else {
        statusEl.className = 'import-file-status ok';
        statusEl.innerHTML = `✔ ${totalTx} lançamento${totalTx !== 1 ? 's' : ''} encontrado${totalTx !== 1 ? 's' : ''}`;

        // Preview das primeiras transações
        const preview = document.createElement('div');
        preview.className = 'import-tx-preview';
        const sample = parsed.flatMap(p => p.transactions).slice(0, 5);
        preview.innerHTML = sample.map(t =>
          `${fmtDate(t.data)} — ${esc(t.descricao.slice(0,40))} — ${fmtBRL(t.valor)}`
        ).join('<br>') + (totalTx > 5 ? `<br>… e mais ${totalTx - 5}` : '');
        itemEl.querySelector('.import-file-info').appendChild(preview);
        importQueue.push({ file, parsed, status: 'ok', totalTx });
      }
    } catch (err) {
      barEl.style.width = '100%';
      barEl.style.background = 'var(--c-red)';
      statusEl.className = 'import-file-status err';
      statusEl.textContent = '✖ Erro ao processar: ' + (err.message || 'desconhecido');
      importQueue.push({ file, parsed: [], status: 'error', totalTx: 0 });
    }
  }

  const hasOk = importQueue.some(q => q.status === 'ok');
  document.getElementById('import-confirm').style.display = hasOk ? 'inline-flex' : 'none';
}

function confirmImport() {
  let totalImported = 0;
  const hoje = new Date().toISOString().slice(0, 10);

  for (const entry of importQueue) {
    if (entry.status !== 'ok') continue;

    for (const grupo of entry.parsed) {
      if (!grupo.transactions.length) continue;

      // Encontrar ou criar cartão
      let cartao = findOrCreateCartao(grupo.banco, grupo.ultimos, grupo.portador);

      // Criar fatura
      const primeiraData = grupo.transactions
        .map(t => t.data)
        .filter(Boolean)
        .sort()[0] || hoje;
      const mesRef = primeiraData.slice(0, 7); // YYYY-MM

      const faturaId = uid();
      Store.addFatura({
        id:       faturaId,
        cartaoId: cartao.id,
        mesRef,
        fileName: entry.file.name,
        importadaEm: hoje,
        total: grupo.transactions.reduce((s, t) => s + t.valor, 0)
      });

      // Criar lançamentos
      const lancs = grupo.transactions.map(t => ({
        id:        uid(),
        faturaId,
        cartaoId:  cartao.id,
        data:      t.data,
        descricao: t.descricao,
        valor:     t.valor,
        parcela:   t.parcela || '',
        categoria: t.categoria || 'Outros'
      }));

      Store.addLancs(lancs);
      totalImported += lancs.length;
    }
  }

  document.getElementById('modal-import').style.display = 'none';
  importQueue = [];
  showToast(`✔ ${totalImported} lançamentos importados`, 'success');
  renderAll();
}

function findOrCreateCartao(banco, ultimos, portador) {
  const cartoes = Store.getCartoes();
  // Tentar achar por banco + ultimos
  let match = cartoes.find(c => c.banco === banco && c.ultimos === ultimos && ultimos);
  if (!match && portador) {
    match = cartoes.find(c => c.banco === banco && c.portador === portador);
  }
  if (match) return match;

  // Criar novo
  const usedColors = cartoes.map(c => c.cor);
  const cor = CARD_COLORS.find(c => !usedColors.includes(c)) || CARD_COLORS[cartoes.length % CARD_COLORS.length];
  const banco_label = BANCO_LABELS[banco] || 'Outro';
  const nome = portador
    ? `${portador} (${banco_label})`
    : ultimos
      ? `${banco_label} ****${ultimos}`
      : banco_label;

  const cartao = { id: uid(), nome, banco, ultimos: ultimos || '', portador: portador || '', cor };
  Store.upsertCartao(cartao);
  return cartao;
}

// ══════════════════════════════════════════════════════════
// RENDER: DASHBOARD
// ══════════════════════════════════════════════════════════
function getFilteredLancs(periodo, cartaoId) {
  let lancs = Store.getLancs();

  if (cartaoId) {
    lancs = lancs.filter(l => l.cartaoId === cartaoId);
  }

  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;

  if (periodo === 'mes') {
    const prefix = `${anoAtual}-${String(mesAtual).padStart(2,'0')}`;
    lancs = lancs.filter(l => l.data && l.data.startsWith(prefix));
  } else if (periodo === '3m') {
    const limit = new Date(hoje); limit.setMonth(hoje.getMonth() - 3);
    lancs = lancs.filter(l => l.data && new Date(l.data) >= limit);
  } else if (periodo === '6m') {
    const limit = new Date(hoje); limit.setMonth(hoje.getMonth() - 6);
    lancs = lancs.filter(l => l.data && new Date(l.data) >= limit);
  } else if (periodo === 'ano') {
    lancs = lancs.filter(l => l.data && l.data.startsWith(String(anoAtual)));
  }

  return lancs;
}

function renderDashboard() {
  const periodo  = document.getElementById('dash-periodo').value;
  const cartaoId = document.getElementById('dash-cartao').value;
  const lancs    = getFilteredLancs(periodo, cartaoId);
  const cartoes  = Store.getCartoes();
  const faturas  = Store.getFaturas();

  // KPIs
  const total = lancs.reduce((s, l) => s + (l.valor || 0), 0);
  document.getElementById('kpi-total').textContent = fmtBRL(total);
  document.getElementById('kpi-total-sub').textContent = `${lancs.length} lançamentos`;

  // Maior gasto único
  const maior = lancs.reduce((best, l) => (!best || l.valor > best.valor) ? l : best, null);
  document.getElementById('kpi-maior').textContent = maior ? fmtBRL(maior.valor) : 'R$ 0,00';
  document.getElementById('kpi-maior-sub').textContent = maior ? esc(maior.descricao.slice(0, 28)) : '—';

  // Parcelamentos
  const parcLancs = lancs.filter(l => l.parcela);
  const totalParc = parcLancs.reduce((s, l) => s + l.valor, 0);
  document.getElementById('kpi-parc').textContent = fmtBRL(totalParc);
  document.getElementById('kpi-parc-sub').textContent = `${parcLancs.length} parcelas`;

  // Faturas importadas
  document.getElementById('kpi-faturas').textContent = faturas.length;
  document.getElementById('kpi-faturas-sub').textContent = `${cartoes.length} cartão${cartoes.length !== 1 ? 's' : ''}`;

  // Categorias
  const catMap = {};
  for (const l of lancs) {
    const cat = l.categoria || 'Outros';
    catMap[cat] = (catMap[cat] || 0) + l.valor;
  }
  const catSorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const maxCat = catSorted[0]?.[1] || 1;
  const catList = document.getElementById('cat-list');
  if (!catSorted.length) {
    catList.innerHTML = '<div class="empty-state">Nenhum dado no período</div>';
  } else {
    catList.innerHTML = catSorted.slice(0, 10).map(([cat, val]) => `
      <div class="cat-item">
        <span class="cat-label">${esc(cat)}</span>
        <div class="cat-bar-wrap"><div class="cat-bar" style="width:${(val/maxCat*100).toFixed(1)}%"></div></div>
        <span class="cat-value">${fmtBRL(val)}</span>
      </div>`).join('');
  }

  // Últimos lançamentos
  const cartaoMap = Object.fromEntries(cartoes.map(c => [c.id, c]));
  const recentes  = lancs.slice().sort((a, b) => (b.data || '') > (a.data || '') ? 1 : -1).slice(0, 10);
  const tbody = document.getElementById('dash-tbody');
  if (!recentes.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">Nenhum lançamento</td></tr>';
  } else {
    tbody.innerHTML = recentes.map(l => {
      const c = cartaoMap[l.cartaoId];
      return `<tr>
        <td class="td-muted">${fmtDate(l.data)}</td>
        <td class="td-main">${esc(l.descricao)}</td>
        <td>${cartaoChip(c)}</td>
        <td class="td-num val-neg">${fmtBRL(l.valor)}</td>
      </tr>`;
    }).join('');
  }

  // Popular select de cartões
  populateCartaoSelects();
}

// ══════════════════════════════════════════════════════════
// RENDER: FATURAS
// ══════════════════════════════════════════════════════════
function renderFaturas() {
  const faturas = Store.getFaturas().slice().sort((a, b) => b.mesRef > a.mesRef ? 1 : -1);
  const cartoes = Store.getCartoes();
  const cartaoMap = Object.fromEntries(cartoes.map(c => [c.id, c]));

  const container = document.getElementById('faturas-list');
  const empty     = document.getElementById('faturas-empty');

  if (!faturas.length) {
    empty.style.display = 'flex';
    // Remove fatura cards
    container.querySelectorAll('.fatura-card').forEach(el => el.remove());
    return;
  }
  empty.style.display = 'none';
  container.querySelectorAll('.fatura-card').forEach(el => el.remove());

  for (const f of faturas) {
    const cartao = cartaoMap[f.cartaoId];
    const cor    = cartao?.cor || '#94a3b8';
    const el = document.createElement('div');
    el.className = 'fatura-card';
    el.dataset.faturaId = f.id;
    el.innerHTML = `
      <div class="fatura-card-color" style="background:${cor}"></div>
      <div class="fatura-card-info">
        <div class="fatura-card-title">${esc(cartao?.nome || 'Cartão')}</div>
        <div class="fatura-card-sub">${f.mesRef ? formatMesRef(f.mesRef) : ''} · ${esc(f.fileName || '')}</div>
      </div>
      <div>
        <div class="fatura-card-valor">${fmtBRL(f.total || 0)}</div>
        <div class="fatura-card-count">${countLancsByFatura(f.id)} lançamentos</div>
      </div>
      <div class="fatura-card-actions" onclick="event.stopPropagation()">
        <button class="btn-icon btn-delete" data-fatura-id="${f.id}" title="Excluir">✕</button>
      </div>`;
    el.addEventListener('click', () => openFaturaModal(f.id));
    container.appendChild(el);
  }
}

function countLancsByFatura(faturaId) {
  return Store.getLancs().filter(l => l.faturaId === faturaId).length;
}

function formatMesRef(mesRef) {
  // "2026-04" → "Abr/2026"
  if (!mesRef) return '';
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const [y, m] = mesRef.split('-');
  return `${meses[parseInt(m)-1]}/${y}`;
}

function openFaturaModal(faturaId) {
  const fatura  = Store.getFaturas().find(f => f.id === faturaId);
  if (!fatura) return;
  const cartao  = Store.getCartao(fatura.cartaoId);
  const lancs   = Store.getLancs().filter(l => l.faturaId === faturaId)
                       .sort((a, b) => (a.data || '') > (b.data || '') ? 1 : -1);

  document.getElementById('fatura-modal-title').textContent =
    (cartao?.nome || 'Fatura') + ' — ' + (fatura.mesRef ? formatMesRef(fatura.mesRef) : '');

  const info = document.getElementById('fatura-modal-info');
  info.innerHTML = `
    <div class="fatura-info-item"><span class="fatura-info-label">Arquivo</span><span class="fatura-info-value">${esc(fatura.fileName || '—')}</span></div>
    <div class="fatura-info-item"><span class="fatura-info-label">Total</span><span class="fatura-info-value" style="color:var(--c-red)">${fmtBRL(fatura.total||0)}</span></div>
    <div class="fatura-info-item"><span class="fatura-info-label">Importada em</span><span class="fatura-info-value">${fmtDate(fatura.importadaEm)}</span></div>
    <div class="fatura-info-item"><span class="fatura-info-label">Lançamentos</span><span class="fatura-info-value">${lancs.length}</span></div>`;

  const tbody = document.getElementById('fatura-modal-tbody');
  tbody.innerHTML = lancs.length ? lancs.map(l => `
    <tr>
      <td class="td-muted">${fmtDate(l.data)}</td>
      <td class="td-main">${esc(l.descricao)}</td>
      <td>${esc(l.categoria || '—')}</td>
      <td>${l.parcela ? `<span class="badge-parc">${esc(l.parcela)}</span>` : ''}</td>
      <td class="td-num val-neg">${fmtBRL(l.valor)}</td>
      <td class="td-actions">
        <button class="btn-icon" data-edit-lanc="${l.id}" title="Editar">✏</button>
      </td>
    </tr>`).join('')
    : '<tr><td colspan="6" class="empty-cell">Sem lançamentos</td></tr>';

  document.getElementById('fatura-delete').dataset.faturaId = faturaId;
  document.getElementById('modal-fatura').style.display = 'flex';
}

// ══════════════════════════════════════════════════════════
// RENDER: LANÇAMENTOS
// ══════════════════════════════════════════════════════════
function renderLancamentos() {
  const search   = document.getElementById('lanc-search').value.toLowerCase();
  const cartaoId = document.getElementById('lanc-cartao').value;
  const cat      = document.getElementById('lanc-cat').value;
  const mes      = document.getElementById('lanc-mes').value; // YYYY-MM

  const cartoes   = Store.getCartoes();
  const cartaoMap = Object.fromEntries(cartoes.map(c => [c.id, c]));

  let lancs = Store.getLancs().slice().sort((a, b) =>
    (b.data || '') > (a.data || '') ? 1 : -1);

  if (search)   lancs = lancs.filter(l => l.descricao.toLowerCase().includes(search));
  if (cartaoId) lancs = lancs.filter(l => l.cartaoId === cartaoId);
  if (cat)      lancs = lancs.filter(l => l.categoria === cat);
  if (mes)      lancs = lancs.filter(l => l.data && l.data.startsWith(mes));

  const tbody = document.getElementById('lanc-tbody');
  if (!lancs.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">Nenhum lançamento</td></tr>';
    document.getElementById('lanc-footer').textContent = '';
    return;
  }

  tbody.innerHTML = lancs.map(l => {
    const c = cartaoMap[l.cartaoId];
    return `<tr>
      <td class="td-muted">${fmtDate(l.data)}</td>
      <td class="td-main" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;">${esc(l.descricao)}</td>
      <td>${cartaoChip(c)}</td>
      <td class="td-muted">${esc(BANCO_LABELS[c?.banco] || '—')}</td>
      <td>${esc(l.categoria || '—')}</td>
      <td>${l.parcela ? `<span class="badge-parc">${esc(l.parcela)}</span>` : ''}</td>
      <td class="td-num val-neg">${fmtBRL(l.valor)}</td>
      <td class="td-actions">
        <button class="btn-icon" data-edit-lanc="${l.id}" title="Editar">✏</button>
        <button class="btn-icon btn-delete" data-del-lanc="${l.id}" title="Excluir">✕</button>
      </td>
    </tr>`;
  }).join('');

  const total = lancs.reduce((s, l) => s + (l.valor || 0), 0);
  document.getElementById('lanc-footer').innerHTML =
    `${lancs.length} lançamentos &nbsp;|&nbsp; Total: <strong>${fmtBRL(total)}</strong>`;

  // Popular categorias no filtro
  populateCatSelect();
}

// ══════════════════════════════════════════════════════════
// RENDER: CARTÕES
// ══════════════════════════════════════════════════════════
function renderCartoes() {
  const cartoes  = Store.getCartoes();
  const faturas  = Store.getFaturas();
  const lancs    = Store.getLancs();

  const container = document.getElementById('cartoes-grid');
  const empty     = document.getElementById('cartoes-empty');

  if (!cartoes.length) {
    empty.style.display = 'flex';
    container.querySelectorAll('.cartao-card').forEach(el => el.remove());
    return;
  }
  empty.style.display = 'none';
  container.querySelectorAll('.cartao-card').forEach(el => el.remove());

  for (const c of cartoes) {
    const cFaturas = faturas.filter(f => f.cartaoId === c.id);
    const cLancs   = lancs.filter(l => l.cartaoId === c.id);
    const cTotal   = cLancs.reduce((s, l) => s + l.valor, 0);

    const el = document.createElement('div');
    el.className = 'cartao-card';
    el.style.setProperty('--card-color', c.cor || '#2563eb');
    el.innerHTML = `
      <div class="cartao-card-header">
        <div>
          <div class="cartao-card-nome">${esc(c.nome)}</div>
          <div class="cartao-card-banco">${esc(BANCO_LABELS[c.banco] || 'Outro')}</div>
          ${c.ultimos ? `<div class="cartao-card-num">**** **** **** ${esc(c.ultimos)}</div>` : ''}
        </div>
        <div class="cartao-card-actions">
          <button class="btn-icon" data-edit-cartao="${c.id}" title="Editar">✏</button>
          <button class="btn-icon btn-delete" data-del-cartao="${c.id}" title="Excluir">✕</button>
        </div>
      </div>
      <div class="cartao-card-stats">
        <div class="cartao-stat">
          <div class="cartao-stat-label">Total gasto</div>
          <div class="cartao-stat-value" style="color:var(--c-red)">${fmtBRL(cTotal)}</div>
        </div>
        <div class="cartao-stat">
          <div class="cartao-stat-label">Faturas</div>
          <div class="cartao-stat-value">${cFaturas.length}</div>
        </div>
        <div class="cartao-stat">
          <div class="cartao-stat-label">Lançamentos</div>
          <div class="cartao-stat-value">${cLancs.length}</div>
        </div>
        <div class="cartao-stat">
          <div class="cartao-stat-label">Parcelas</div>
          <div class="cartao-stat-value">${cLancs.filter(l => l.parcela).length}</div>
        </div>
      </div>`;
    container.appendChild(el);
  }
}

// ══════════════════════════════════════════════════════════
// MODAL: LANÇAMENTO EDITAR
// ══════════════════════════════════════════════════════════
let editingLancId = null;

function openLancEdit(id) {
  const l = Store.getLancs().find(x => x.id === id);
  if (!l) return;
  editingLancId = id;
  document.getElementById('lanc-edit-desc').value  = l.descricao || '';
  document.getElementById('lanc-edit-valor').value = l.valor || '';

  const catSel = document.getElementById('lanc-edit-cat');
  catSel.innerHTML = CATEGORIAS.map(c =>
    `<option value="${esc(c)}" ${l.categoria === c ? 'selected' : ''}>${esc(c)}</option>`
  ).join('');

  document.getElementById('lanc-edit-error').style.display = 'none';
  document.getElementById('modal-lanc').style.display = 'flex';
}

function saveLancEdit() {
  const desc  = document.getElementById('lanc-edit-desc').value.trim();
  const valor = parseFloat(document.getElementById('lanc-edit-valor').value);
  const cat   = document.getElementById('lanc-edit-cat').value;
  const errEl = document.getElementById('lanc-edit-error');

  if (!desc || isNaN(valor)) {
    errEl.textContent = 'Preencha descrição e valor.';
    errEl.style.display = 'block';
    return;
  }

  Store.updateLanc(editingLancId, { descricao: desc, valor, categoria: cat });
  document.getElementById('modal-lanc').style.display = 'none';
  editingLancId = null;
  renderAll();
  showToast('Lançamento atualizado', 'success');
}

// ══════════════════════════════════════════════════════════
// MODAL: CARTÃO
// ══════════════════════════════════════════════════════════
let editingCartaoId = null;

function openCartaoModal(id) {
  editingCartaoId = id || null;
  const c = id ? Store.getCartao(id) : null;
  document.getElementById('cartao-modal-title').textContent = c ? 'Editar Cartão' : 'Novo Cartão';
  document.getElementById('cartao-nome').value    = c?.nome    || '';
  document.getElementById('cartao-banco').value   = c?.banco   || '';
  document.getElementById('cartao-ultimos').value = c?.ultimos || '';
  document.getElementById('cartao-error').style.display = 'none';

  // Color swatches
  const row = document.getElementById('cartao-cor-row');
  const selectedCor = c?.cor || CARD_COLORS[0];
  row.innerHTML = CARD_COLORS.map(cor =>
    `<div class="color-swatch${cor === selectedCor ? ' selected' : ''}"
       style="background:${cor}" data-cor="${cor}" title="${cor}"></div>`
  ).join('');

  document.getElementById('modal-cartao').style.display = 'flex';
}

function saveCartao() {
  const nome    = document.getElementById('cartao-nome').value.trim();
  const banco   = document.getElementById('cartao-banco').value;
  const ultimos = document.getElementById('cartao-ultimos').value.trim();
  const cor     = document.getElementById('cartao-cor-row').querySelector('.selected')?.dataset.cor || CARD_COLORS[0];
  const errEl   = document.getElementById('cartao-error');

  if (!nome) {
    errEl.textContent = 'Nome é obrigatório.';
    errEl.style.display = 'block';
    return;
  }

  const cartao = {
    id:      editingCartaoId || uid(),
    nome,
    banco,
    ultimos,
    portador: '',
    cor
  };
  Store.upsertCartao(cartao);
  document.getElementById('modal-cartao').style.display = 'none';
  editingCartaoId = null;
  renderAll();
  showToast(editingCartaoId ? 'Cartão atualizado' : 'Cartão criado', 'success');
}

// ══════════════════════════════════════════════════════════
// SELECTS POPULADOS DINAMICAMENTE
// ══════════════════════════════════════════════════════════
function populateCartaoSelects() {
  const cartoes = Store.getCartoes();
  const opts = `<option value="">Todos</option>` +
    cartoes.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
  document.getElementById('dash-cartao').innerHTML = opts;
  document.getElementById('lanc-cartao').innerHTML = opts;
}

function populateCatSelect() {
  const lancs = Store.getLancs();
  const cats  = [...new Set(lancs.map(l => l.categoria).filter(Boolean))].sort();
  const sel   = document.getElementById('lanc-cat');
  const cur   = sel.value;
  sel.innerHTML = `<option value="">Todas</option>` +
    cats.map(c => `<option value="${esc(c)}" ${c === cur ? 'selected':''}>${esc(c)}</option>`).join('');
}

// ══════════════════════════════════════════════════════════
// EXPORT CSV
// ══════════════════════════════════════════════════════════
function exportCSV() {
  const cartoes   = Store.getCartoes();
  const cartaoMap = Object.fromEntries(cartoes.map(c => [c.id, c]));

  const search   = document.getElementById('lanc-search').value.toLowerCase();
  const cartaoId = document.getElementById('lanc-cartao').value;
  const cat      = document.getElementById('lanc-cat').value;
  const mes      = document.getElementById('lanc-mes').value;

  let lancs = Store.getLancs().slice().sort((a, b) =>
    (b.data || '') > (a.data || '') ? 1 : -1);
  if (search)   lancs = lancs.filter(l => l.descricao.toLowerCase().includes(search));
  if (cartaoId) lancs = lancs.filter(l => l.cartaoId === cartaoId);
  if (cat)      lancs = lancs.filter(l => l.categoria === cat);
  if (mes)      lancs = lancs.filter(l => l.data && l.data.startsWith(mes));

  const header = ['Data','Descrição','Cartão','Banco','Categoria','Parcela','Valor'];
  const rows = lancs.map(l => {
    const c = cartaoMap[l.cartaoId];
    return [
      fmtDate(l.data),
      `"${(l.descricao||'').replace(/"/g,'""')}"`,
      `"${(c?.nome||'').replace(/"/g,'""')}"`,
      BANCO_LABELS[c?.banco] || '',
      l.categoria || '',
      l.parcela || '',
      String(l.valor || 0).replace('.',',')
    ].join(';');
  });

  const csv  = [header.join(';'), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'lancamentos.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════════════════
// RENDER ALL
// ══════════════════════════════════════════════════════════
function renderAll() {
  populateCartaoSelects();
  populateCatSelect();
  renderDashboard();
  renderFaturas();
  renderLancamentos();
  renderCartoes();
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

  // "Ver todos →" link
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-tab-goto]');
    if (!btn) return;
    const tab = btn.dataset.tabGoto;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tab));
  });

  // Importar buttons
  document.getElementById('btn-importar').addEventListener('click', openImportModal);
  document.getElementById('btn-importar-fat').addEventListener('click', openImportModal);

  // Drop area
  const dropArea = document.getElementById('import-drop-area');
  dropArea.addEventListener('click', () => document.getElementById('import-file-input').click());
  dropArea.addEventListener('dragover', e => { e.preventDefault(); dropArea.classList.add('dragover'); });
  dropArea.addEventListener('dragleave', () => dropArea.classList.remove('dragover'));
  dropArea.addEventListener('drop', e => {
    e.preventDefault();
    dropArea.classList.remove('dragover');
    processImportFiles(e.dataTransfer.files);
  });

  document.getElementById('import-select-btn').addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('import-file-input').click();
  });
  document.getElementById('import-file-input').addEventListener('change', e => {
    processImportFiles(e.target.files);
    e.target.value = '';
  });

  document.getElementById('import-confirm').addEventListener('click', confirmImport);
  document.getElementById('import-close').addEventListener('click', () =>
    document.getElementById('modal-import').style.display = 'none');
  document.getElementById('import-cancel').addEventListener('click', () =>
    document.getElementById('modal-import').style.display = 'none');

  // Modal fatura
  document.getElementById('fatura-close').addEventListener('click', () =>
    document.getElementById('modal-fatura').style.display = 'none');
  document.getElementById('fatura-modal-close').addEventListener('click', () =>
    document.getElementById('modal-fatura').style.display = 'none');
  document.getElementById('fatura-delete').addEventListener('click', function() {
    const id = this.dataset.faturaId;
    openConfirm('Excluir fatura', 'Excluir esta fatura e todos os lançamentos?', () => {
      Store.deleteFatura(id);
      document.getElementById('modal-fatura').style.display = 'none';
      renderAll();
      showToast('Fatura excluída');
    });
  });

  // Modal lançamento editar
  document.getElementById('lanc-close').addEventListener('click', () =>
    document.getElementById('modal-lanc').style.display = 'none');
  document.getElementById('lanc-edit-cancel').addEventListener('click', () =>
    document.getElementById('modal-lanc').style.display = 'none');
  document.getElementById('lanc-edit-save').addEventListener('click', saveLancEdit);

  // Modal cartão
  document.getElementById('btn-add-cartao').addEventListener('click', () => openCartaoModal(null));
  document.getElementById('cartao-close').addEventListener('click', () =>
    document.getElementById('modal-cartao').style.display = 'none');
  document.getElementById('cartao-cancel').addEventListener('click', () =>
    document.getElementById('modal-cartao').style.display = 'none');
  document.getElementById('cartao-save').addEventListener('click', saveCartao);
  document.getElementById('modal-cartao').addEventListener('click', e => {
    const sw = e.target.closest('.color-swatch');
    if (!sw) return;
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    sw.classList.add('selected');
  });

  // Modal confirm
  document.getElementById('confirm-cancel').addEventListener('click', () =>
    document.getElementById('modal-confirm').style.display = 'none');

  // Close overlays on backdrop click
  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) o.style.display = 'none'; });
  });

  // Filtros dashboard
  document.getElementById('dash-periodo').addEventListener('change', renderDashboard);
  document.getElementById('dash-cartao').addEventListener('change', renderDashboard);

  // Filtros lançamentos
  document.getElementById('lanc-search').addEventListener('input', renderLancamentos);
  document.getElementById('lanc-cartao').addEventListener('change', renderLancamentos);
  document.getElementById('lanc-cat').addEventListener('change', renderLancamentos);
  document.getElementById('lanc-mes').addEventListener('change', renderLancamentos);
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);

  // Delegação: editar/deletar lançamento (em tabelas e modal fatura)
  document.addEventListener('click', e => {
    // Editar lançamento
    const editBtn = e.target.closest('[data-edit-lanc]');
    if (editBtn) { openLancEdit(editBtn.dataset.editLanc); return; }

    // Deletar lançamento
    const delLanc = e.target.closest('[data-del-lanc]');
    if (delLanc) {
      openConfirm('Excluir lançamento', 'Excluir este lançamento?', () => {
        Store.deleteLanc(delLanc.dataset.delLanc);
        renderAll();
        showToast('Lançamento excluído');
      });
      return;
    }

    // Deletar fatura (card na tab Faturas)
    const delFat = e.target.closest('[data-fatura-id]');
    if (delFat && e.target.closest('.btn-delete')) {
      const id = delFat.dataset.faturaId;
      openConfirm('Excluir fatura', 'Excluir esta fatura e todos os lançamentos?', () => {
        Store.deleteFatura(id);
        renderAll();
        showToast('Fatura excluída');
      });
      return;
    }

    // Editar cartão
    const editCartao = e.target.closest('[data-edit-cartao]');
    if (editCartao) { openCartaoModal(editCartao.dataset.editCartao); return; }

    // Deletar cartão
    const delCartao = e.target.closest('[data-del-cartao]');
    if (delCartao) {
      const c = Store.getCartao(delCartao.dataset.delCartao);
      openConfirm('Excluir cartão',
        `Excluir "${c?.nome}" e todas as faturas e lançamentos?`, () => {
        Store.deleteCartao(delCartao.dataset.delCartao);
        renderAll();
        showToast('Cartão excluído');
      });
      return;
    }
  });

  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
