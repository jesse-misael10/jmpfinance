/* ============================================================
   Auth DRE — auth-dre.js
   Autenticação Supabase adaptada para o layout do DRE
   ============================================================ */

const APP_NAME = 'dre';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── CloudStorage: salva/carrega dadosBrutos no Supabase ───
const CloudStorage = {
  async get(key) {
    const { data, error } = await db
      .from('app_storage')
      .select('value')
      .eq('app_name', APP_NAME)
      .eq('key', key)
      .maybeSingle();
    if (error || !data) return null;
    return data.value;
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

// ── Verificar login e permissão ───────────────────────────
async function initAuth() {
  const { data: { session } } = await db.auth.getSession();

  if (!session) {
    window.location.href = 'login.html?return=' +
      encodeURIComponent(window.location.href);
    return null;
  }

  // Verificar permissão para este app
  const { data: perm } = await db
    .from('app_permissions')
    .select('app_name')
    .eq('app_name', APP_NAME)
    .maybeSingle();

  if (!perm) {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;
                  font-family:sans-serif;flex-direction:column;gap:1rem;color:#64748b;">
        <span style="font-size:3rem;">🔒</span>
        <h2 style="margin:0;color:#0f2044;">Acesso não autorizado</h2>
        <p style="margin:0;">Você não tem permissão para acessar o DRE.</p>
        <button onclick="db.auth.signOut().then(()=>location.href='../login.html')"
          style="margin-top:.5rem;padding:.5rem 1.5rem;background:#0f2044;color:#fff;
                 border:none;border-radius:6px;cursor:pointer;font-size:.9rem;">Sair</button>
      </div>`;
    return null;
  }

  const { data: { user } } = await db.auth.getUser();
  injectUserBar(user);
  return user;
}

function injectUserBar(user) {
  const tryInject = () => {
    const actions = document.getElementById('headerActions');
    if (!actions) { setTimeout(tryInject, 100); return; }

    // Forçar visibilidade do header-actions para mostrar barra de usuário
    // mesmo antes de carregar arquivo
    const bar = document.createElement('div');
    bar.id = 'user-bar';
    bar.style.cssText = `
      display:flex;align-items:center;gap:.5rem;
      font-size:.78rem;color:rgba(255,255,255,.85);
      position:absolute;top:50%;right:1.5rem;transform:translateY(-50%);
    `;
    bar.innerHTML = `
      <span style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        ${user.email}
      </span>
      <button id="btn-logout-dre"
        style="padding:3px 10px;background:rgba(255,255,255,.15);color:#fff;
               border:1px solid rgba(255,255,255,.3);border-radius:5px;
               cursor:pointer;font-size:.75rem;font-weight:600;">
        Sair
      </button>`;

    const header = document.querySelector('.header-inner');
    if (header) {
      header.style.position = 'relative';
      header.appendChild(bar);
    }

    document.getElementById('btn-logout-dre')?.addEventListener('click', async () => {
      await db.auth.signOut();
      window.location.href = 'login.html';
    });
  };
  tryInject();
}
