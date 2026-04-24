// Neo-fintech dashboard — themed version.
// Takes a palette object so the same component renders light, dark, and
// alternative accent palettes without branching.

function NeoDash({ palette, paletteKey, mode, onPaletteChange, onModeChange }) {
  const t = palette;

  const S = {
    root: { background: t.bg, color: t.ink, fontFamily: t.sans, width: '100%', minHeight: 1320, letterSpacing: '-0.005em' },
    header: { background: t.surface, padding: '16px 40px', display: 'flex', alignItems: 'center', gap: 32, borderBottom: `1px solid ${t.rule}` },
    brand: { display: 'flex', alignItems: 'center', gap: 10 },
    brandMark: { width: 28, height: 28, background: t.accent, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.onAccent, fontWeight: 700, fontSize: 13 },
    brandText: { fontSize: 15, fontWeight: 600, color: t.ink },
    nav: { display: 'flex', gap: 4, background: t.bg, padding: 4, borderRadius: 10 },
    navItem: (active) => ({
      fontSize: 13, fontWeight: 500,
      color: active ? t.ink : t.inkSoft,
      padding: '7px 14px', borderRadius: 7,
      background: active ? t.surface : 'transparent',
      boxShadow: active ? t.navShadow : 'none',
      cursor: 'pointer',
    }),
    rightActions: { marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' },
    btnSecondary: { background: t.bg, color: t.ink, border: 'none', padding: '8px 14px', fontSize: 13, fontWeight: 500, borderRadius: 8, cursor: 'pointer' },
    btnPrimary: { background: t.accent, color: t.onAccent, border: 'none', padding: '9px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: 'pointer' },

    body: { padding: '32px 40px 40px', display: 'flex', flexDirection: 'column', gap: 28 },

    pageHead: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 4 },
    pageTitle: { fontSize: 28, fontWeight: 600, color: t.ink, letterSpacing: '-0.02em' },
    pageSub: { fontSize: 14, color: t.inkSoft, marginTop: 4 },
    pageMeta: { display: 'flex', gap: 8, alignItems: 'center' },
    chip: { display: 'inline-flex', alignItems: 'center', gap: 6, background: t.surface, padding: '6px 12px', borderRadius: 100, fontSize: 12, color: t.inkSoft, boxShadow: t.shadow },
    chipDot: { width: 6, height: 6, background: t.accent, borderRadius: '50%' },

    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 },
    kpiCard: { background: t.surface, padding: '20px 22px', borderRadius: 14, boxShadow: t.shadow, display: 'flex', flexDirection: 'column', gap: 10 },
    kpiTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    kpiLabel: { fontSize: 12, fontWeight: 500, color: t.inkSoft },
    kpiPill: (kind) => {
      const map = { pos: { bg: t.accentSoft, fg: t.accentInk },
                    neg: { bg: t.negSoft, fg: t.neg },
                    warn: { bg: t.warnSoft, fg: t.warn } };
      const c = map[kind] || map.pos;
      return { fontSize: 11, fontWeight: 600, color: c.fg, background: c.bg, padding: '3px 8px', borderRadius: 6, fontFamily: t.mono, letterSpacing: '-0.02em' };
    },
    kpiValue: { fontSize: 28, fontWeight: 600, color: t.ink, letterSpacing: '-0.02em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' },
    kpiMeta: { fontSize: 12, color: t.inkMute },

    row2: { display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 },
    card: { background: t.surface, borderRadius: 14, boxShadow: t.shadow, padding: 24 },
    cardHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
    cardTitle: { fontSize: 16, fontWeight: 600, color: t.ink, letterSpacing: '-0.01em' },
    cardSub: { fontSize: 12, color: t.inkMute, marginTop: 2 },
    segment: { display: 'inline-flex', background: t.bg, padding: 3, borderRadius: 8, fontSize: 12 },
    segmentItem: (active) => ({ padding: '4px 10px', borderRadius: 6, color: active ? t.ink : t.inkSoft, background: active ? t.surface : 'transparent', fontWeight: 500, cursor: 'pointer' }),

    fxGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 4 },
    fxCard: { background: t.bg, borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 },
    fxHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    fxMoeda: { fontSize: 14, fontWeight: 700, color: t.ink, fontFamily: t.mono, letterSpacing: '-0.02em' },
    fxCot: { fontSize: 12, color: t.inkSoft, fontVariantNumeric: 'tabular-nums' },
    fxBar: { display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: t.barBg },
    fxBarFill: (pct, color) => ({ width: pct + '%', background: color, height: '100%' }),
    fxRowsGrid: { display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '4px 12px', fontSize: 12, alignItems: 'baseline' },
    fxRowK: { color: t.inkMute },
    fxRowV: { color: t.ink, fontFamily: t.mono, fontVariantNumeric: 'tabular-nums', textAlign: 'right', fontSize: 12 },

    alertRow: { display: 'grid', gridTemplateColumns: '2fr 1.2fr 0.6fr 0.8fr 1fr 0.9fr', gap: 16, padding: '16px 0', borderBottom: `1px solid ${t.rule}`, alignItems: 'center', fontSize: 13 },
    alertHead: { display: 'grid', gridTemplateColumns: '2fr 1.2fr 0.6fr 0.8fr 1fr 0.9fr', gap: 16, padding: '0 0 12px', borderBottom: `1px solid ${t.rule}`, fontSize: 11, color: t.inkMute, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' },
    alertTag: (lvl) => {
      const map = { urgente: { bg: t.negSoft, fg: t.neg },
                    proximo: { bg: t.warnSoft, fg: t.warn },
                    normal:  { bg: t.accentSoft, fg: t.accentInk } };
      const c = map[lvl] || map.normal;
      return { display: 'inline-flex', alignItems: 'center', gap: 6, background: c.bg, color: c.fg, padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, fontFamily: t.mono, letterSpacing: '-0.02em' };
    },

    legendRow: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '6px 0' },
  };

  const cores = t.donutColors;

  return (
    <div style={S.root}>
      <header style={S.header}>
        <div style={S.brand}>
          <div style={S.brandMark}>◐</div>
          <div style={S.brandText}>Operações Financeiras</div>
        </div>
        <nav style={S.nav}>
          <span style={S.navItem(true)}>Dashboard</span>
          <span style={S.navItem(false)}>Operações</span>
          <span style={S.navItem(false)}>Simulador</span>
          <span style={S.navItem(false)}>Câmbio</span>
          <span style={S.navItem(false)}>Relatórios</span>
        </nav>
        <div style={S.rightActions}>
          <ThemeSwitcher
            palette={t}
            paletteKey={paletteKey}
            mode={mode}
            onPaletteChange={onPaletteChange}
            onModeChange={onModeChange}
          />
          <button style={S.btnSecondary}>Exportar</button>
          <button style={S.btnPrimary}>+ Nova Operação</button>
        </div>
      </header>

      <main style={S.body}>
        <div style={S.pageHead}>
          <div>
            <div style={S.pageTitle}>Visão geral</div>
            <div style={S.pageSub}>14 operações ativas em 6 credores e 3 moedas · abril de 2026</div>
          </div>
          <div style={S.pageMeta}>
            <span style={S.chip}><span style={S.chipDot} /> Sincronizado há 2 min</span>
            <span style={S.chip}>USD 5,1280 · EUR 5,5420 · GBP 6,4320</span>
          </div>
        </div>

        <div style={S.kpiGrid}>
          <div style={S.kpiCard}>
            <div style={S.kpiTop}><span style={S.kpiLabel}>Dívida total</span><span style={S.kpiPill('pos')}>−6,2% QoQ</span></div>
            <div style={S.kpiValue}>R$ 18,74M</div>
            <div style={S.kpiMeta}>14 ativas · consolidado BRL</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiTop}><span style={S.kpiLabel}>Parcela do mês</span><span style={S.kpiPill('warn')}>6 parcelas</span></div>
            <div style={S.kpiValue}>R$ 412,8k</div>
            <div style={S.kpiMeta}>Competência Abr/26</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiTop}><span style={S.kpiLabel}>Juros projetados 12m</span><span style={S.kpiPill('pos')}>1,08% a.m.</span></div>
            <div style={S.kpiValue}>R$ 2,19M</div>
            <div style={S.kpiMeta}>Custo médio ponderado</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiTop}><span style={S.kpiLabel}>MtM consolidado</span><span style={S.kpiPill('pos')}>Favorável</span></div>
            <div style={{ ...S.kpiValue, color: t.accent }}>+R$ 115,8k</div>
            <div style={S.kpiMeta}>3 NDFs ativos</div>
          </div>
        </div>

        <div style={S.row2}>
          <div style={S.card}>
            <div style={S.cardHead}>
              <div>
                <div style={S.cardTitle}>Evolução do saldo devedor</div>
                <div style={S.cardSub}>Consolidado em BRL · projeção dos próximos 24 meses</div>
              </div>
              <div style={S.segment}>
                <span style={S.segmentItem(false)}>12m</span>
                <span style={S.segmentItem(true)}>24m</span>
                <span style={S.segmentItem(false)}>Total</span>
              </div>
            </div>
            <AreaChart data={SAMPLE.saldo24m} color={t.accent} fillColor={t.areaFill} height={220} stroke={2} gridColor={t.gridLine} axisColor={t.inkMute} />
          </div>
          <div style={S.card}>
            <div style={S.cardHead}>
              <div>
                <div style={S.cardTitle}>Concentração por credor</div>
                <div style={S.cardSub}>Saldo atual em BRL</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              <Donut data={SAMPLE.credores} colors={cores} size={160} thickness={18} />
              <div style={{ width: '100%' }}>
                {SAMPLE.credores.map((c, i) => {
                  const total = SAMPLE.credores.reduce((s, x) => s + x.v, 0);
                  return (
                    <div key={c.nome} style={S.legendRow}>
                      <span style={{ width: 10, height: 10, background: cores[i], borderRadius: 3, flexShrink: 0 }} />
                      <span style={{ flex: 1, color: t.ink }}>{c.nome}</span>
                      <span style={{ color: t.inkMute, fontSize: 12, fontFamily: t.mono }}>{(c.v / total * 100).toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div style={S.card}>
          <div style={S.cardHead}>
            <div>
              <div style={S.cardTitle}>Exposição cambial</div>
              <div style={S.cardSub}>FINIMP + NDF por moeda · cobertura e marcação a mercado</div>
            </div>
            <div style={S.segment}>
              <span style={S.segmentItem(true)}>Por moeda</span>
              <span style={S.segmentItem(false)}>Por operação</span>
            </div>
          </div>
          <div style={S.fxGrid}>
            {SAMPLE.fxRows.map((r) => {
              const liq = r.finimp - r.ndf;
              const coverage = Math.min(100, (r.ndf / r.finimp * 100));
              const delta = (r.cot / r.cotPrev - 1) * 100;
              return (
                <div key={r.moeda} style={S.fxCard}>
                  <div style={S.fxHead}>
                    <span style={S.fxMoeda}>{r.moeda}</span>
                    <span style={S.fxCot}>R$ {fmtNum(r.cot, 4)} <span style={{ color: delta >= 0 ? t.pos : t.neg, marginLeft: 4 }}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(2)}%</span></span>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11, color: t.inkMute }}>
                      <span>Cobertura</span>
                      <span style={{ color: t.ink, fontFamily: t.mono, fontWeight: 600 }}>{coverage.toFixed(0)}%</span>
                    </div>
                    <div style={S.fxBar}><div style={S.fxBarFill(coverage, t.accent)} /></div>
                  </div>
                  <div style={S.fxRowsGrid}>
                    <span style={S.fxRowK}>FINIMP</span><span></span>
                    <span style={S.fxRowV}>{r.moeda} {fmtNum(r.finimp, 0)}</span>
                    <span style={S.fxRowK}>NDF</span><span></span>
                    <span style={S.fxRowV}>{r.moeda} {fmtNum(r.ndf, 0)}</span>
                    <span style={S.fxRowK}>Líquida</span><span></span>
                    <span style={{ ...S.fxRowV, color: liq > 0 ? t.neg : t.pos, fontWeight: 600 }}>{liq > 0 ? '+' : ''}{fmtNum(liq, 0)}</span>
                    <span style={S.fxRowK}>MtM</span><span></span>
                    <span style={{ ...S.fxRowV, color: r.mtm >= 0 ? t.pos : t.neg, fontWeight: 600 }}>{fmtBRL(r.mtm, { sign: true })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={S.card}>
            <div style={S.cardHead}>
              <div>
                <div style={S.cardTitle}>Amortização &amp; juros</div>
                <div style={S.cardSub}>Próximos 12 meses · em R$ mil</div>
              </div>
            </div>
            <BarChart data={SAMPLE.amortJuros} colors={[t.accent, t.accent2]} height={220} labelColor={t.inkMute} gridColor={t.gridLine} />
            <div style={{ display: 'flex', gap: 20, marginTop: 14, fontSize: 12, color: t.inkSoft }}>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: t.accent, marginRight: 8, borderRadius: 2 }} />Amortização</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: t.accent2, marginRight: 8, borderRadius: 2 }} />Juros</span>
            </div>
          </div>
          <div style={S.card}>
            <div style={S.cardHead}>
              <div>
                <div style={S.cardTitle}>Vencimentos próximos</div>
                <div style={S.cardSub}>6 eventos em até 90 dias</div>
              </div>
            </div>
            <div style={S.alertHead}>
              <span>Operação</span><span>Credor</span><span>Parc.</span>
              <span>Vencimento</span>
              <span style={{ textAlign: 'right' }}>Valor</span>
              <span style={{ textAlign: 'right' }}>Prazo</span>
            </div>
            {SAMPLE.alerts.map((a, i) => (
              <div key={i} style={S.alertRow}>
                <span style={{ color: t.ink, fontWeight: 500 }}>{a.op}</span>
                <span style={{ color: t.inkSoft }}>{a.cred}</span>
                <span style={{ color: t.inkSoft, fontFamily: t.mono, fontSize: 12 }}>{a.parc}</span>
                <span style={{ color: t.ink, fontFamily: t.mono, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmtDate(a.venc)}</span>
                <span style={{ color: t.ink, textAlign: 'right', fontWeight: 600, fontFamily: t.mono, fontVariantNumeric: 'tabular-nums' }}>{fmtBRLShort(a.val)}</span>
                <span style={{ textAlign: 'right' }}><span style={S.alertTag(a.level)}>{a.dias} dias</span></span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── PALETTES ───────────────────────────────────────────────────
// Each palette defines light + dark variants. The current view picks one.
const BASE_SANS = '"Geist", "Inter", -apple-system, sans-serif';
const BASE_MONO = '"Geist Mono", "JetBrains Mono", ui-monospace, monospace';

const NEO_PALETTES = {
  forest: {
    label: 'Verde Floresta',
    swatch: '#1a4d3e',
    light: {
      bg: '#f4f5f7', surface: '#ffffff',
      ink: '#0c1220', inkSoft: '#475569', inkMute: '#94a3b8',
      accent: '#1a4d3e', accent2: '#86a89a', onAccent: '#ffffff',
      accentSoft: '#e6f0ec', accentInk: '#0f3329',
      pos: '#1a4d3e', neg: '#b91c1c', warn: '#92400e',
      warnSoft: '#fef3c7', negSoft: '#fee2e2',
      rule: '#e8eaef',
      shadow: '0 1px 2px rgba(12,18,32,0.04), 0 4px 12px rgba(12,18,32,0.04)',
      navShadow: '0 1px 2px rgba(12,18,32,0.05)',
      gridLine: 'rgba(12,18,32,0.05)', areaFill: 'rgba(26,77,62,0.08)', barBg: '#e2e8f0',
      donutColors: ['#1a4d3e', '#2d6a56', '#5d8b7a', '#86a89a', '#afc5bc', '#d7e2dd'],
      sans: BASE_SANS, mono: BASE_MONO,
    },
    dark: {
      bg: '#0a0f0d', surface: '#121816',
      ink: '#e8efec', inkSoft: '#9aa9a2', inkMute: '#6a7a72',
      accent: '#4ade80', accent2: '#86a89a', onAccent: '#052e20',
      accentSoft: 'rgba(74,222,128,0.12)', accentInk: '#86efac',
      pos: '#4ade80', neg: '#f87171', warn: '#fbbf24',
      warnSoft: 'rgba(251,191,36,0.14)', negSoft: 'rgba(248,113,113,0.14)',
      rule: '#1f2a26',
      shadow: '0 1px 2px rgba(0,0,0,0.4), 0 4px 14px rgba(0,0,0,0.3)',
      navShadow: '0 1px 2px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.04)',
      gridLine: 'rgba(255,255,255,0.05)', areaFill: 'rgba(74,222,128,0.10)', barBg: '#1f2a26',
      donutColors: ['#4ade80', '#22c55e', '#15803d', '#86a89a', '#5d8b7a', '#2f5147'],
      sans: BASE_SANS, mono: BASE_MONO,
    },
  },
  indigo: {
    label: 'Índigo',
    swatch: '#4338ca',
    light: {
      bg: '#f4f5f8', surface: '#ffffff',
      ink: '#0c1220', inkSoft: '#475569', inkMute: '#94a3b8',
      accent: '#4338ca', accent2: '#a5b4fc', onAccent: '#ffffff',
      accentSoft: '#eef2ff', accentInk: '#312e81',
      pos: '#047857', neg: '#b91c1c', warn: '#92400e',
      warnSoft: '#fef3c7', negSoft: '#fee2e2',
      rule: '#e8eaef',
      shadow: '0 1px 2px rgba(12,18,32,0.04), 0 4px 12px rgba(12,18,32,0.04)',
      navShadow: '0 1px 2px rgba(12,18,32,0.05)',
      gridLine: 'rgba(12,18,32,0.05)', areaFill: 'rgba(67,56,202,0.08)', barBg: '#e2e8f0',
      donutColors: ['#4338ca', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'],
      sans: BASE_SANS, mono: BASE_MONO,
    },
    dark: {
      bg: '#0b0d1a', surface: '#141729',
      ink: '#e8ebf5', inkSoft: '#9aa1bd', inkMute: '#6a7192',
      accent: '#818cf8', accent2: '#4338ca', onAccent: '#11133a',
      accentSoft: 'rgba(129,140,248,0.14)', accentInk: '#c7d2fe',
      pos: '#34d399', neg: '#f87171', warn: '#fbbf24',
      warnSoft: 'rgba(251,191,36,0.14)', negSoft: 'rgba(248,113,113,0.14)',
      rule: '#21253b',
      shadow: '0 1px 2px rgba(0,0,0,0.4), 0 4px 14px rgba(0,0,0,0.3)',
      navShadow: '0 1px 2px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.04)',
      gridLine: 'rgba(255,255,255,0.05)', areaFill: 'rgba(129,140,248,0.14)', barBg: '#21253b',
      donutColors: ['#818cf8', '#6366f1', '#4338ca', '#a5b4fc', '#4f46e5', '#312e81'],
      sans: BASE_SANS, mono: BASE_MONO,
    },
  },
  graphite: {
    label: 'Grafite',
    swatch: '#1f2937',
    light: {
      bg: '#f5f5f4', surface: '#ffffff',
      ink: '#0c1220', inkSoft: '#475569', inkMute: '#94a3b8',
      accent: '#1f2937', accent2: '#9ca3af', onAccent: '#ffffff',
      accentSoft: '#f1f5f9', accentInk: '#0f172a',
      pos: '#047857', neg: '#b91c1c', warn: '#92400e',
      warnSoft: '#fef3c7', negSoft: '#fee2e2',
      rule: '#e8eaef',
      shadow: '0 1px 2px rgba(12,18,32,0.04), 0 4px 12px rgba(12,18,32,0.04)',
      navShadow: '0 1px 2px rgba(12,18,32,0.05)',
      gridLine: 'rgba(12,18,32,0.05)', areaFill: 'rgba(31,41,55,0.08)', barBg: '#e2e8f0',
      donutColors: ['#1f2937', '#374151', '#4b5563', '#6b7280', '#9ca3af', '#d1d5db'],
      sans: BASE_SANS, mono: BASE_MONO,
    },
    dark: {
      bg: '#08090b', surface: '#141518',
      ink: '#ececec', inkSoft: '#a1a1aa', inkMute: '#71717a',
      accent: '#fafafa', accent2: '#a1a1aa', onAccent: '#09090b',
      accentSoft: 'rgba(250,250,250,0.08)', accentInk: '#fafafa',
      pos: '#4ade80', neg: '#f87171', warn: '#fbbf24',
      warnSoft: 'rgba(251,191,36,0.14)', negSoft: 'rgba(248,113,113,0.14)',
      rule: '#1f2023',
      shadow: '0 1px 2px rgba(0,0,0,0.4), 0 4px 14px rgba(0,0,0,0.3)',
      navShadow: '0 1px 2px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.04)',
      gridLine: 'rgba(255,255,255,0.05)', areaFill: 'rgba(250,250,250,0.08)', barBg: '#1f2023',
      donutColors: ['#fafafa', '#d4d4d8', '#a1a1aa', '#71717a', '#52525b', '#3f3f46'],
      sans: BASE_SANS, mono: BASE_MONO,
    },
  },
  terracotta: {
    label: 'Terracota',
    swatch: '#b4532a',
    light: {
      bg: '#f7f3ee', surface: '#ffffff',
      ink: '#1c1715', inkSoft: '#5a4f47', inkMute: '#9c8f84',
      accent: '#b4532a', accent2: '#e6a57c', onAccent: '#ffffff',
      accentSoft: '#fdeee2', accentInk: '#7c3514',
      pos: '#047857', neg: '#b91c1c', warn: '#92400e',
      warnSoft: '#fef3c7', negSoft: '#fee2e2',
      rule: '#ebe4dc',
      shadow: '0 1px 2px rgba(28,23,21,0.04), 0 4px 12px rgba(28,23,21,0.05)',
      navShadow: '0 1px 2px rgba(28,23,21,0.05)',
      gridLine: 'rgba(28,23,21,0.05)', areaFill: 'rgba(180,83,42,0.08)', barBg: '#e8dccf',
      donutColors: ['#b4532a', '#c87545', '#d99a6f', '#e6b79a', '#efd2be', '#f5e3d4'],
      sans: BASE_SANS, mono: BASE_MONO,
    },
    dark: {
      bg: '#0f0a08', surface: '#1a1310',
      ink: '#f0e8e2', inkSoft: '#a89b92', inkMute: '#7a6e65',
      accent: '#f2875b', accent2: '#b4532a', onAccent: '#1c0e08',
      accentSoft: 'rgba(242,135,91,0.12)', accentInk: '#fbb88e',
      pos: '#4ade80', neg: '#f87171', warn: '#fbbf24',
      warnSoft: 'rgba(251,191,36,0.14)', negSoft: 'rgba(248,113,113,0.14)',
      rule: '#261b15',
      shadow: '0 1px 2px rgba(0,0,0,0.4), 0 4px 14px rgba(0,0,0,0.3)',
      navShadow: '0 1px 2px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.04)',
      gridLine: 'rgba(255,255,255,0.05)', areaFill: 'rgba(242,135,91,0.12)', barBg: '#261b15',
      donutColors: ['#f2875b', '#c87545', '#b4532a', '#8a3f1f', '#5e2b15', '#3a1a0d'],
      sans: BASE_SANS, mono: BASE_MONO,
    },
  },
  azure: {
    label: 'Azul Corporativo',
    swatch: '#1e40af',
    light: {
      bg: '#f1f5f9', surface: '#ffffff',
      ink: '#0c1220', inkSoft: '#475569', inkMute: '#94a3b8',
      accent: '#1e40af', accent2: '#7da3e0', onAccent: '#ffffff',
      accentSoft: '#dbeafe', accentInk: '#1e3a8a',
      pos: '#047857', neg: '#b91c1c', warn: '#92400e',
      warnSoft: '#fef3c7', negSoft: '#fee2e2',
      rule: '#e2e8f0',
      shadow: '0 1px 2px rgba(12,18,32,0.04), 0 4px 12px rgba(12,18,32,0.04)',
      navShadow: '0 1px 2px rgba(12,18,32,0.05)',
      gridLine: 'rgba(12,18,32,0.05)', areaFill: 'rgba(30,64,175,0.08)', barBg: '#e2e8f0',
      donutColors: ['#1e40af', '#3b63c9', '#5d85dc', '#7ea3e8', '#a3bff0', '#c9d8f5'],
      sans: BASE_SANS, mono: BASE_MONO,
    },
    dark: {
      bg: '#070b18', surface: '#111827',
      ink: '#e8ecf5', inkSoft: '#94a3b8', inkMute: '#64748b',
      accent: '#60a5fa', accent2: '#1e40af', onAccent: '#0a1226',
      accentSoft: 'rgba(96,165,250,0.14)', accentInk: '#bfdbfe',
      pos: '#34d399', neg: '#f87171', warn: '#fbbf24',
      warnSoft: 'rgba(251,191,36,0.14)', negSoft: 'rgba(248,113,113,0.14)',
      rule: '#1e293b',
      shadow: '0 1px 2px rgba(0,0,0,0.4), 0 4px 14px rgba(0,0,0,0.3)',
      navShadow: '0 1px 2px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.04)',
      gridLine: 'rgba(255,255,255,0.05)', areaFill: 'rgba(96,165,250,0.12)', barBg: '#1e293b',
      donutColors: ['#60a5fa', '#3b82f6', '#2563eb', '#1e40af', '#1e3a8a', '#1e3366'],
      sans: BASE_SANS, mono: BASE_MONO,
    },
  },
};

// ─── ThemeSwitcher ─────────────────────────────────────────────
// In-product theme picker that lives in the dashboard header.
// Click to open a popover with palette swatches + light/dark toggle.
function ThemeSwitcher({ palette, paletteKey, mode, onPaletteChange, onModeChange }) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef(null);
  const t = palette;

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const triggerStyle = {
    background: t.bg, color: t.ink, border: 'none',
    padding: '8px 10px', fontSize: 13, fontWeight: 500,
    borderRadius: 8, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 8,
    fontFamily: 'inherit', letterSpacing: '-0.005em',
  };
  const swatchStyle = {
    width: 14, height: 14, borderRadius: 4,
    background: t.accent,
    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
    flexShrink: 0,
  };
  const caret = {
    width: 0, height: 0,
    borderLeft: '4px solid transparent',
    borderRight: '4px solid transparent',
    borderTop: `5px solid ${t.inkSoft}`,
    marginLeft: 2,
    opacity: 0.7,
  };
  const popover = {
    position: 'absolute', top: 'calc(100% + 6px)', right: 0,
    background: t.surface,
    borderRadius: 12,
    boxShadow: t.shadow + ', 0 12px 40px rgba(12,18,32,0.12)',
    padding: 14,
    width: 260,
    zIndex: 50,
    border: `1px solid ${t.rule}`,
  };
  const popHeader = {
    fontSize: 11, fontWeight: 500, color: t.inkMute,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    marginBottom: 10,
  };
  const swatchGrid = {
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6,
  };
  const swatchBtn = (selected) => ({
    cursor: 'pointer',
    background: 'transparent',
    border: selected ? `2px solid ${t.accent}` : `2px solid transparent`,
    borderRadius: 10,
    padding: 3,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    fontFamily: 'inherit',
  });
  const swatchDot = (color) => ({
    width: 30, height: 30, borderRadius: 8,
    background: color,
    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
  });
  const swatchLabel = (selected) => ({
    fontSize: 9.5, color: selected ? t.ink : t.inkMute,
    fontWeight: selected ? 600 : 400,
    textAlign: 'center', lineHeight: 1.2,
  });
  const modeToggle = {
    marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.rule}`,
    display: 'flex', background: t.bg, padding: 3, borderRadius: 8,
  };
  const modeBtn = (active) => ({
    flex: 1, padding: '6px 0', border: 'none',
    background: active ? t.surface : 'transparent',
    color: active ? t.ink : t.inkSoft,
    fontSize: 12, fontWeight: 500, borderRadius: 6,
    cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: active ? t.navShadow : 'none',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  });

  const sunIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
  const moonIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        style={triggerStyle}
        onClick={() => setOpen(o => !o)}
        aria-label="Mudar tema"
        aria-expanded={open}
      >
        <span style={swatchStyle} />
        <span>Tema</span>
        <span style={caret} />
      </button>
      {open && (
        <div style={popover} role="dialog">
          <div style={popHeader}>Paleta</div>
          <div style={swatchGrid}>
            {Object.entries(NEO_PALETTES).map(([key, def]) => {
              const selected = paletteKey === key;
              return (
                <button
                  key={key}
                  onClick={() => onPaletteChange(key)}
                  title={def.label}
                  style={swatchBtn(selected)}
                >
                  <span style={swatchDot(def.swatch)} />
                  <span style={swatchLabel(selected)}>{def.label}</span>
                </button>
              );
            })}
          </div>
          <div style={modeToggle}>
            <button style={modeBtn(mode === 'light')} onClick={() => onModeChange('light')}>
              {sunIcon} Claro
            </button>
            <button style={modeBtn(mode === 'dark')} onClick={() => onModeChange('dark')}>
              {moonIcon} Escuro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { NeoDash, NEO_PALETTES, ThemeSwitcher });
