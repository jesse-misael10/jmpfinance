/* ============================================================
   Auth — _shared/auth.js
   Gerencia sessão Supabase em todos os apps.
   Requer: supabase-client.js carregado antes
   ============================================================ */

// Inicializar cliente Supabase
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

// Nome do app atual (cada app define window.APP_NAME antes de carregar auth.js)
const APP_NAME = window.APP_NAME || 'unknown';

// ── Cloud Storage (substitui localStorage) ────────────────
// Mesma interface do localStorage mas salva no Supabase por usuário
const CloudStorage = {
  async get(key) {
    const { data } = await db
      .from('app_storage')
      .select('value')
      .eq('app_name', APP_NAME)
      .eq('key', key)
      .maybeSingle();
    return data?.value ?? null;
  },

  async set(key, value) {
    const { data: { user } } = await db.auth.getUser();
    if (!user) return;
    await db.from('app_storage').upsert({
      user_id:    user.id,
      app_name:   APP_NAME,
      key,
      value,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,app_name,key' });
  },

  async remove(key) {
    const { data: { user } } = await db.auth.getUser();
    if (!user) return;
    await db.from('app_storage')
      .delete()
      .eq('user_id', user.id)
      .eq('app_name', APP_NAME)
      .eq('key', key);
  }
};

// ── Verificar acesso ao app ───────────────────────────────
async function checkAppAccess() {
  const { data: { session } } = await db.auth.getSession();

  if (!session) {
    // Não logado → redirecionar para login
    const returnTo = encodeURIComponent(window.location.href);
    window.location.href = `/_shared/login.html?return=${returnTo}`;
    return false;
  }

  // Verificar permissão para este app
  const { data: perm } = await db
    .from('app_permissions')
    .select('app_name')
    .eq('app_name', APP_NAME)
    .maybeSingle();

  if (!perm) {
    // Sem permissão para este app
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;
                  font-family:sans-serif;flex-direction:column;gap:1rem;color:#64748b;">
        <span style="font-size:3rem;">🔒</span>
        <h2 style="margin:0;color:#0f2044;">Acesso não autorizado</h2>
        <p style="margin:0;">Você não tem permissão para acessar este módulo.</p>
        <button onclick="Auth.logout()"
          style="margin-top:.5rem;padding:.5rem 1.5rem;background:#0f2044;color:#fff;
                 border:none;border-radius:6px;cursor:pointer;font-size:.9rem;">
          Sair
        </button>
      </div>`;
    return false;
  }

  return true;
}

// ── Auth público ──────────────────────────────────────────
const Auth = {
  db,
  CloudStorage,

  async init() {
    const ok = await checkAppAccess();
    if (!ok) return null;

    const { data: { user } } = await db.auth.getUser();

    // Injetar header com info do usuário + botão de sair
    injectUserBar(user);

    return user;
  },

  async logout() {
    await db.auth.signOut();
    window.location.href = '/_shared/login.html';
  },

  getUser() {
    return db.auth.getUser();
  }
};

// ── Barra de usuário no header ────────────────────────────
function injectUserBar(user) {
  // Aguardar o DOM do app carregar
  const tryInject = () => {
    const headerRight = document.querySelector('.header-right');
    if (!headerRight) { setTimeout(tryInject, 100); return; }

    const bar = document.createElement('div');
    bar.className = 'user-bar';
    bar.innerHTML = `
      <span class="user-email">${user.email}</span>
      <button class="btn btn-ghost btn-sm" id="btn-logout">Sair</button>`;
    headerRight.prepend(bar);
    document.getElementById('btn-logout').addEventListener('click', () => Auth.logout());
  };
  tryInject();
}

// ── CSS da barra de usuário ───────────────────────────────
const style = document.createElement('style');
style.textContent = `
  .user-bar {
    display: flex;
    align-items: center;
    gap: .5rem;
    padding: 0 .5rem;
    border-right: 1px solid rgba(255,255,255,.2);
    margin-right: .5rem;
  }
  .user-email {
    font-size: .75rem;
    color: rgba(255,255,255,.8);
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
document.head.appendChild(style);
