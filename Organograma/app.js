/* ============================================================
   ORGANOGRAMA — app.js
   ============================================================ */

'use strict';

/* ============================================================
   CONSTANTS
   ============================================================ */
const CARD_W = 172;
const CARD_H = 76;
const H_GAP  = 28;
const V_GAP  = 56;
const PAD    = 48;

const KEY_PESSOAS = 'org_pessoas_v1';
const APP_NAME    = 'organograma';

/* ============================================================
   SUPABASE + STORAGE
   ============================================================ */
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

let _cache = null; // in-memory cache

function _saveCloud(val) {
  db.auth.getUser().then(({ data: { user } }) => {
    if (!user) return;
    db.from('app_storage').upsert({
      user_id:    user.id,
      app_name:   APP_NAME,
      key:        KEY_PESSOAS,
      value:      val,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,app_name,key' });
  });
}

const store = {
  getPessoas() {
    return _cache || [];
  },
  setPessoas(v) {
    _cache = v;
    _saveCloud(v);
  },
  addPessoa(p) {
    const all = this.getPessoas();
    all.push({ ...p, id: uid() });
    this.setPessoas(all);
  },
  updatePessoa(id, p) {
    const all = this.getPessoas();
    const idx = all.findIndex(x => x.id === id);
    if (idx >= 0) all[idx] = { ...all[idx], ...p };
    this.setPessoas(all);
  },
  deletePessoa(id) {
    const all = this.getPessoas();
    const person = all.find(p => p.id === id);
    const grandparentId = person ? person.parentId : null;
    const updated = all
      .filter(p => p.id !== id)
      .map(p => p.parentId === id ? { ...p, parentId: grandparentId } : p);
    this.setPessoas(updated);
  },
};

/* ============================================================
   UTILITIES
   ============================================================ */
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function initials(nome) {
  return (nome || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
}

async function resizeImage(file, maxSize = 128) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
    img.src = url;
  });
}

function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (type ? ' ' + type : '');
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, 2800);
}

/* ============================================================
   STATE
   ============================================================ */
const state = {
  currentTab: 'organograma',
  collapsed: new Set(),
  search: '',
  editId: null,
};

/* ============================================================
   INIT
   ============================================================ */
function init() {
  setupTabs();
  setupSearch();
  setupToolbarButtons();
  setupModal();
  setupConfirmModal();

  // Single delegated listener on wrapper (always in DOM, never replaced)
  document.getElementById('org-wrapper').addEventListener('click', onOrgClick);

  renderAll();
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
  state.currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tab));
  if (tab === 'organograma') renderOrg();
  if (tab === 'pessoas')     renderPessoas();
}

/* ============================================================
   SEARCH
   ============================================================ */
function setupSearch() {
  const input = document.getElementById('search-input');
  const clear = document.getElementById('search-clear');

  input.addEventListener('input', () => {
    state.search = input.value.trim().toLowerCase();
    clear.style.display = state.search ? 'block' : 'none';
    if (state.currentTab === 'organograma') renderOrg();
  });

  clear.addEventListener('click', () => {
    input.value = '';
    state.search = '';
    clear.style.display = 'none';
    if (state.currentTab === 'organograma') renderOrg();
  });
}

/* ============================================================
   TOOLBAR BUTTONS
   ============================================================ */
function setupToolbarButtons() {
  document.getElementById('btn-add-pessoa-org').addEventListener('click', () => openModal(null));
  document.getElementById('btn-add-pessoa').addEventListener('click', () => openModal(null));

  document.getElementById('btn-export-png').addEventListener('click', exportPNG);
  document.getElementById('btn-export-pdf').addEventListener('click', exportPDF);

  document.getElementById('btn-expand-all').addEventListener('click', () => {
    state.collapsed.clear();
    renderOrg();
  });

  document.getElementById('btn-collapse-all').addEventListener('click', () => {
    const { children, roots } = buildTree(store.getPessoas());
    const collapseAll = id => {
      if ((children[id] || []).length > 0) state.collapsed.add(id);
      (children[id] || []).forEach(k => collapseAll(k.id));
    };
    roots.forEach(r => collapseAll(r.id));
    renderOrg();
  });
}

/* ============================================================
   TREE BUILDING
   ============================================================ */
function buildTree(pessoas) {
  const byId     = {};
  const children = {};

  pessoas.forEach(p => {
    byId[p.id]     = p;
    children[p.id] = [];
  });

  const roots = [];
  pessoas.forEach(p => {
    if (p.parentId && byId[p.parentId]) {
      children[p.parentId].push(p);
    } else {
      roots.push(p);
    }
  });

  // Stable sort within each siblings group
  Object.values(children).forEach(arr => arr.sort((a, b) => (a.nome || '').localeCompare(b.nome || '')));

  return { byId, children, roots };
}

/* ============================================================
   LAYOUT ENGINE
   ============================================================ */
function subtreeWidth(id, children, collapsed) {
  if (collapsed.has(id)) return CARD_W;
  const kids = children[id] || [];
  if (!kids.length) return CARD_W;
  const total = kids.reduce((s, k, i) => s + subtreeWidth(k.id, children, collapsed) + (i > 0 ? H_GAP : 0), 0);
  return Math.max(CARD_W, total);
}

function assignPositions(id, cx, y, children, collapsed, positions) {
  positions[id] = { x: Math.round(cx - CARD_W / 2), y };
  if (collapsed.has(id)) return;
  const kids = children[id] || [];
  if (!kids.length) return;

  const widths  = kids.map(k => subtreeWidth(k.id, children, collapsed));
  const totalW  = widths.reduce((s, w, i) => s + w + (i > 0 ? H_GAP : 0), 0);
  let curX = cx - totalW / 2;

  kids.forEach((kid, i) => {
    assignPositions(kid.id, curX + widths[i] / 2, y + CARD_H + V_GAP, children, collapsed, positions);
    curX += widths[i] + H_GAP;
  });
}

function computeLayout(roots, children, collapsed) {
  const positions = {};
  let startCX = 0;

  roots.forEach((root, i) => {
    const w = subtreeWidth(root.id, children, collapsed);
    assignPositions(root.id, startCX + w / 2, 0, children, collapsed, positions);
    startCX += w + H_GAP;
  });

  // Normalize to origin + padding
  const allPos = Object.values(positions);
  if (!allPos.length) return positions;
  const minX = Math.min(...allPos.map(p => p.x));
  const minY = Math.min(...allPos.map(p => p.y));
  allPos.forEach(p => { p.x -= minX - PAD; p.y -= minY - PAD; });

  return positions;
}

/* ============================================================
   SEARCH HIGHLIGHTING
   ============================================================ */
function getMatchingIds(pessoas, search) {
  if (!search) return null;
  const byId = {};
  pessoas.forEach(p => byId[p.id] = p);

  const matching = new Set();
  pessoas.forEach(p => {
    if ((p.nome  || '').toLowerCase().includes(search) ||
        (p.cargo || '').toLowerCase().includes(search)) {
      matching.add(p.id);
    }
  });

  // Include ancestors so the path is visible
  const addAncestors = id => {
    const p = byId[id];
    if (!p || !p.parentId || matching.has(p.parentId)) return;
    matching.add(p.parentId);
    addAncestors(p.parentId);
  };
  [...matching].forEach(addAncestors);

  return matching;
}

/* ============================================================
   COUNT DESCENDANTS
   ============================================================ */
function countDescendants(id, children) {
  return (children[id] || []).reduce((s, k) => s + 1 + countDescendants(k.id, children), 0);
}

/* ============================================================
   SVG CONNECTORS
   ============================================================ */
function svgLine(svg, x1, y1, x2, y2) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', x1); line.setAttribute('y1', y1);
  line.setAttribute('x2', x2); line.setAttribute('y2', y2);
  line.setAttribute('stroke', '#94a3b8');
  line.setAttribute('stroke-width', '1.5');
  line.setAttribute('stroke-linecap', 'round');
  svg.appendChild(line);
}

function drawConnectors(parentId, children, positions, collapsed, svg) {
  if (collapsed.has(parentId)) return;
  const kids = (children[parentId] || []).filter(k => positions[k.id]);
  if (!kids.length) return;

  const pp  = positions[parentId];
  const px  = pp.x + CARD_W / 2;
  const py  = pp.y + CARD_H;
  const midY = py + V_GAP / 2;

  if (kids.length === 1) {
    const cp = positions[kids[0].id];
    const cx = cp.x + CARD_W / 2;
    if (px === cx) {
      svgLine(svg, px, py, cx, cp.y);
    } else {
      svgLine(svg, px, py, px, midY);
      svgLine(svg, px, midY, cx, midY);
      svgLine(svg, cx, midY, cx, cp.y);
    }
  } else {
    const cxs = kids.map(k => positions[k.id].x + CARD_W / 2);
    const minCX = Math.min(...cxs);
    const maxCX = Math.max(...cxs);

    svgLine(svg, px, py, px, midY);
    svgLine(svg, minCX, midY, maxCX, midY);
    kids.forEach((k, i) => {
      const cp = positions[k.id];
      svgLine(svg, cxs[i], midY, cxs[i], cp.y);
    });
  }

  kids.forEach(k => drawConnectors(k.id, children, positions, collapsed, svg));
}

/* ============================================================
   RENDER ORG CHART
   ============================================================ */
function renderAll() {
  if (state.currentTab === 'organograma') renderOrg();
  if (state.currentTab === 'pessoas')     renderPessoas();
}

function renderOrg() {
  const wrapper   = document.getElementById('org-wrapper');
  const container = document.getElementById('org-container');
  const pessoas   = store.getPessoas();

  // Update count
  document.getElementById('org-count').textContent = pessoas.length
    ? `${pessoas.length} pessoa${pessoas.length !== 1 ? 's' : ''}`
    : '';

  // Ensure org-empty sibling exists (created once)
  let emptyEl = document.getElementById('org-empty-state');
  if (!emptyEl) {
    emptyEl = document.createElement('div');
    emptyEl.id = 'org-empty-state';
    emptyEl.className = 'org-empty';
    emptyEl.innerHTML = `<span style="font-size:3rem;">🏢</span>
      <p style="font-weight:700;color:#334155;">Nenhuma pessoa cadastrada</p>
      <p style="font-size:.8rem;color:#94a3b8;">Clique em <strong>+ Nova Pessoa</strong> para começar</p>`;
    wrapper.appendChild(emptyEl);
  }

  if (!pessoas.length) {
    container.innerHTML = '';
    container.style.width  = '';
    container.style.height = '';
    container.style.display = 'none';
    emptyEl.style.display   = 'flex';
    return;
  }

  container.style.display = '';
  emptyEl.style.display   = 'none';

  const { byId, children, roots } = buildTree(pessoas);
  const positions    = computeLayout(roots, children, state.collapsed);
  const matchingIds  = getMatchingIds(pessoas, state.search);

  const allPos = Object.values(positions);
  if (!allPos.length) return;

  const canvasW = Math.max(...allPos.map(p => p.x + CARD_W)) + PAD;
  const canvasH = Math.max(...allPos.map(p => p.y + CARD_H)) + PAD + 20; // extra for toggle

  container.style.width  = canvasW + 'px';
  container.style.height = canvasH + 'px';
  container.innerHTML    = '';

  // SVG layer (behind cards)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width',  canvasW);
  svg.setAttribute('height', canvasH);
  svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:0;';
  container.appendChild(svg);

  // Draw connectors
  roots.forEach(r => drawConnectors(r.id, children, positions, state.collapsed, svg));

  // Draw cards (recursive to handle collapse)
  const renderNode = id => {
    const pessoa = byId[id];
    const pos    = positions[id];
    if (!pessoa || !pos) return;

    const kids        = children[id] || [];
    const hasKids     = kids.length > 0;
    const isCollapsed = state.collapsed.has(id);

    let dimmed      = false;
    let highlighted = false;
    if (matchingIds !== null) {
      if (!matchingIds.has(id)) {
        dimmed = true;
      } else if (state.search &&
                 ((pessoa.nome  || '').toLowerCase().includes(state.search) ||
                  (pessoa.cargo || '').toLowerCase().includes(state.search))) {
        highlighted = true;
      }
    }

    const card = document.createElement('div');
    card.className  = 'org-card' + (dimmed ? ' dimmed' : '') + (highlighted ? ' highlighted' : '');
    card.style.left = pos.x + 'px';
    card.style.top  = pos.y + 'px';
    card.dataset.id = id;

    // Photo
    const photoEl = document.createElement('div');
    photoEl.className = 'card-photo' + (pessoa.foto ? '' : ' no-photo');
    if (pessoa.foto) {
      photoEl.style.backgroundImage = `url(${pessoa.foto})`;
    } else {
      photoEl.textContent = initials(pessoa.nome);
    }

    // Info
    const infoEl = document.createElement('div');
    infoEl.className = 'card-info';
    infoEl.innerHTML = `<div class="card-nome">${escHtml(pessoa.nome)}</div>
                        <div class="card-cargo">${escHtml(pessoa.cargo || '—')}</div>`;

    // Actions (edit/delete on hover)
    const actionsEl = document.createElement('div');
    actionsEl.className = 'card-actions';
    actionsEl.innerHTML = `
      <button class="card-btn card-edit" data-id="${escHtml(id)}" title="Editar">✏</button>
      <button class="card-btn card-del"  data-id="${escHtml(id)}" title="Excluir">✕</button>`;

    card.appendChild(photoEl);
    card.appendChild(infoEl);
    card.appendChild(actionsEl);

    // Expand/collapse toggle
    if (hasKids) {
      const toggle = document.createElement('div');
      toggle.className = 'card-toggle' + (isCollapsed ? ' collapsed' : '');
      toggle.dataset.toggleId = id;
      const count = countDescendants(id, children);
      toggle.textContent = isCollapsed ? `▶  ${count}` : `▼`;
      toggle.title = isCollapsed ? `Expandir (${count} subordinado${count !== 1 ? 's' : ''})` : 'Colapsar';
      card.appendChild(toggle);
    }

    container.appendChild(card);

    // Recurse into visible children
    if (!isCollapsed) {
      kids.forEach(k => renderNode(k.id));
    }
  };

  roots.forEach(r => renderNode(r.id));
}

function onOrgClick(e) {
  const editBtn  = e.target.closest('.card-edit');
  const delBtn   = e.target.closest('.card-del');
  const toggle   = e.target.closest('[data-toggle-id]');

  if (editBtn) { e.stopPropagation(); openModal(editBtn.dataset.id); return; }
  if (delBtn)  { e.stopPropagation(); confirmDeletePessoa(delBtn.dataset.id); return; }
  if (toggle)  {
    e.stopPropagation();
    const id = toggle.dataset.toggleId;
    if (state.collapsed.has(id)) state.collapsed.delete(id);
    else state.collapsed.add(id);
    renderOrg();
  }
}

/* ============================================================
   PESSOAS TAB
   ============================================================ */
function renderPessoas() {
  const pessoas = store.getPessoas();
  const { byId }  = buildTree(pessoas);
  const body    = document.getElementById('pessoas-body');
  const empty   = document.getElementById('pessoas-empty');

  if (!pessoas.length) {
    body.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';
  const sorted = [...pessoas].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  body.innerHTML = sorted.map(p => {
    const mgr = p.parentId && byId[p.parentId] ? escHtml(byId[p.parentId].nome) : '—';
    const photoHtml = p.foto
      ? `<div class="pessoa-photo" style="background-image:url(${p.foto})"></div>`
      : `<div class="pessoa-photo no-photo">${escHtml(initials(p.nome))}</div>`;
    return `<tr>
      <td>${photoHtml}</td>
      <td class="td-nome">${escHtml(p.nome)}</td>
      <td>${escHtml(p.cargo || '—')}</td>
      <td>${mgr}</td>
      <td class="td-actions">
        <button class="btn-icon pessoa-edit" data-id="${escHtml(p.id)}" title="Editar">✏</button>
        <button class="btn-icon btn-delete pessoa-del" data-id="${escHtml(p.id)}" title="Excluir">✕</button>
      </td>
    </tr>`;
  }).join('');

  body.querySelectorAll('.pessoa-edit').forEach(btn =>
    btn.addEventListener('click', () => openModal(btn.dataset.id)));
  body.querySelectorAll('.pessoa-del').forEach(btn =>
    btn.addEventListener('click', () => confirmDeletePessoa(btn.dataset.id)));
}

/* ============================================================
   MODAL: ADD / EDIT PERSON
   ============================================================ */
function setupModal() {
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-save').addEventListener('click', savePessoa);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  // Photo upload
  document.getElementById('form-foto-btn').addEventListener('click', () =>
    document.getElementById('form-foto-input').click());

  document.getElementById('form-foto-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const b64 = await resizeImage(file, 128);
    if (!b64) return;
    const preview = document.getElementById('form-foto-preview');
    preview.style.backgroundImage = `url(${b64})`;
    preview.dataset.foto = b64;
    preview.textContent  = '';
    preview.classList.remove('no-photo');
    e.target.value = '';
  });

  document.getElementById('form-foto-remove').addEventListener('click', () => {
    const preview = document.getElementById('form-foto-preview');
    preview.style.backgroundImage = '';
    preview.dataset.foto = '';
    preview.classList.add('no-photo');
    preview.textContent = initials(document.getElementById('form-nome').value) || '?';
  });

  document.getElementById('form-nome').addEventListener('input', e => {
    const preview = document.getElementById('form-foto-preview');
    if (!preview.dataset.foto) preview.textContent = initials(e.target.value) || '?';
  });
}

function openModal(id) {
  state.editId = id;
  const pessoas   = store.getPessoas();
  const modal     = document.getElementById('modal-overlay');
  const preview   = document.getElementById('form-foto-preview');
  const parentSel = document.getElementById('form-parent');
  const errEl     = document.getElementById('modal-error');

  errEl.style.display = 'none';

  // Build parent select (exclude self)
  parentSel.innerHTML =
    `<option value="">— Sem superior (topo da hierarquia) —</option>` +
    pessoas
      .filter(p => p.id !== id)
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
      .map(p => `<option value="${escHtml(p.id)}">${escHtml(p.nome)} — ${escHtml(p.cargo || '')}</option>`)
      .join('');

  if (id) {
    const p = pessoas.find(x => x.id === id);
    if (!p) return;
    document.getElementById('modal-title').textContent = 'Editar Pessoa';
    document.getElementById('form-nome').value   = p.nome  || '';
    document.getElementById('form-cargo').value  = p.cargo || '';
    parentSel.value = p.parentId || '';
    preview.dataset.foto = p.foto || '';
    if (p.foto) {
      preview.style.backgroundImage = `url(${p.foto})`;
      preview.textContent = '';
      preview.classList.remove('no-photo');
    } else {
      preview.style.backgroundImage = '';
      preview.textContent = initials(p.nome);
      preview.classList.add('no-photo');
    }
  } else {
    document.getElementById('modal-title').textContent = 'Nova Pessoa';
    document.getElementById('form-nome').value  = '';
    document.getElementById('form-cargo').value = '';
    parentSel.value = '';
    preview.style.backgroundImage = '';
    preview.dataset.foto = '';
    preview.textContent = '?';
    preview.classList.add('no-photo');
  }

  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('form-nome').focus(), 60);
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  state.editId = null;
}

function savePessoa() {
  const nome     = document.getElementById('form-nome').value.trim();
  const cargo    = document.getElementById('form-cargo').value.trim();
  const parentId = document.getElementById('form-parent').value || null;
  const foto     = document.getElementById('form-foto-preview').dataset.foto || '';
  const errEl    = document.getElementById('modal-error');

  if (!nome)  { errEl.textContent = 'Nome é obrigatório.';  errEl.style.display = 'block'; return; }
  if (!cargo) { errEl.textContent = 'Cargo é obrigatório.'; errEl.style.display = 'block'; return; }

  // Cycle check
  if (state.editId && parentId) {
    const { children } = buildTree(store.getPessoas());
    const descendants = new Set();
    const collect = id => (children[id] || []).forEach(k => { descendants.add(k.id); collect(k.id); });
    collect(state.editId);
    if (descendants.has(parentId)) {
      errEl.textContent = 'Não é possível definir um subordinado como superior.';
      errEl.style.display = 'block';
      return;
    }
  }

  const payload = { nome, cargo, parentId, foto };

  if (state.editId) {
    store.updatePessoa(state.editId, payload);
    showToast('Pessoa atualizada!', 'success');
  } else {
    store.addPessoa(payload);
    showToast('Pessoa adicionada!', 'success');
  }

  closeModal();
  renderAll();
}

/* ============================================================
   CONFIRM DELETE
   ============================================================ */
let _deleteCallback = null;

function setupConfirmModal() {
  document.getElementById('confirm-cancel').addEventListener('click', () => {
    document.getElementById('confirm-overlay').style.display = 'none';
    _deleteCallback = null;
  });
  document.getElementById('confirm-confirm').addEventListener('click', () => {
    document.getElementById('confirm-overlay').style.display = 'none';
    if (_deleteCallback) { _deleteCallback(); _deleteCallback = null; }
  });
  document.getElementById('confirm-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('confirm-overlay')) {
      document.getElementById('confirm-overlay').style.display = 'none';
      _deleteCallback = null;
    }
  });
}

function confirmDeletePessoa(id) {
  const pessoa = store.getPessoas().find(p => p.id === id);
  if (!pessoa) return;

  const { children } = buildTree(store.getPessoas());
  const count = countDescendants(id, children);

  const msg = count > 0
    ? `Excluir "${pessoa.nome}"?\n\nEsta pessoa tem ${count} subordinado(s) que serão movidos para o nível superior.`
    : `Excluir "${pessoa.nome}"? Esta ação não pode ser desfeita.`;

  document.getElementById('confirm-title').textContent = 'Excluir pessoa';
  document.getElementById('confirm-body').textContent  = msg;

  _deleteCallback = () => {
    store.deletePessoa(id);
    renderAll();
    showToast('Pessoa excluída.', 'success');
  };

  document.getElementById('confirm-overlay').style.display = 'flex';
}

/* ============================================================
   EXPORT
   ============================================================ */
async function exportPNG() {
  if (typeof html2canvas === 'undefined') { showToast('html2canvas não carregado.', 'error'); return; }
  const container = document.getElementById('org-container');
  if (!container.children.length) { showToast('Nada para exportar.'); return; }

  showToast('Gerando imagem…');
  try {
    const canvas = await html2canvas(container, {
      backgroundColor: '#f8fafc',
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const a = document.createElement('a');
    a.download = `Organograma_${new Date().toISOString().slice(0,10)}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    showToast('PNG exportado!', 'success');
  } catch(e) {
    console.error(e);
    showToast('Erro ao exportar imagem.', 'error');
  }
}

async function exportPDF() {
  if (typeof html2canvas === 'undefined' || !window.jspdf) {
    showToast('Bibliotecas não carregadas.', 'error'); return;
  }
  const container = document.getElementById('org-container');
  if (!container.children.length) { showToast('Nada para exportar.'); return; }

  showToast('Gerando PDF…');
  try {
    const canvas  = await html2canvas(container, {
      backgroundColor: '#f8fafc',
      scale: 1.5,
      useCORS: true,
      logging: false,
    });
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const W = canvas.width;
    const H = canvas.height;
    const orientation = W >= H ? 'landscape' : 'portrait';
    const doc = new jsPDF({ orientation, unit: 'px', format: [W, H] });
    doc.addImage(imgData, 'PNG', 0, 0, W, H);
    doc.save(`Organograma_${new Date().toISOString().slice(0,10)}.pdf`);
    showToast('PDF exportado!', 'success');
  } catch(e) {
    console.error(e);
    showToast('Erro ao exportar PDF.', 'error');
  }
}

/* ============================================================
   BOOT
   ============================================================ */
async function boot() {
  // Auth check
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    window.location.href = '/_shared/login.html?return=' + encodeURIComponent('/Organograma/index.html');
    return;
  }

  // Load data from Supabase
  try {
    const { data } = await db.from('app_storage')
      .select('value')
      .eq('user_id', session.user.id)
      .eq('app_name', APP_NAME)
      .eq('key', KEY_PESSOAS)
      .maybeSingle();
    if (data && Array.isArray(data.value)) {
      _cache = data.value;
    } else {
      _cache = [];
    }
  } catch(e) {
    _cache = [];
  }

  init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
