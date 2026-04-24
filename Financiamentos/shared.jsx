// Shared sample data + formatters for all three dashboard variations.
// Values are illustrative but internally consistent.

const SAMPLE = {
  kpis: {
    dividaTotal: 18_742_300,
    operacoesAtivas: 14,
    parcelaMes: 412_800,
    competencia: 'Abr/2026',
    jurosProj12m: 2_187_450,
    proximoVenc: '2026-04-29',
    proximoValor: 184_200,
    proximoDias: 5,
  },
  fxRows: [
    { moeda: 'USD', finimp: 4_200_000,   ndf: 3_800_000,   mtm:  142_300, cot: 5.1280, cotPrev: 5.0950 },
    { moeda: 'EUR', finimp: 1_650_000,   ndf: 1_200_000,   mtm:  -38_900, cot: 5.5420, cotPrev: 5.5610 },
    { moeda: 'GBP', finimp:   780_000,   ndf:   800_000,   mtm:   12_450, cot: 6.4320, cotPrev: 6.4180 },
  ],
  alerts: [
    { op: 'Capital de Giro — Bradesco',          cred: 'Bradesco',   parc: '08/36', venc: '2026-04-29', val:  184_200, dias:   5, level: 'urgente' },
    { op: 'FINIMP — Maquinário Alemão',          cred: 'Citibank',   parc: '03/06', venc: '2026-05-12', val:  412_800, dias:  18, level: 'proximo' },
    { op: 'CCB Investimento — Itaú',             cred: 'Itaú BBA',   parc: '12/48', venc: '2026-05-15', val:  218_400, dias:  21, level: 'proximo' },
    { op: 'NDF USD — Hedge Exportação',          cred: 'Santander',  parc: 'Liq.',  venc: '2026-06-02', val:  142_300, dias:  39, level: 'normal'  },
    { op: 'Debênture 3ª Emissão',                cred: 'Banco BV',   parc: '04/10', venc: '2026-06-20', val:  680_000, dias:  57, level: 'normal'  },
    { op: 'FINIMP — Matéria-Prima',              cred: 'HSBC',       parc: '02/04', venc: '2026-07-14', val:  305_100, dias:  81, level: 'normal'  },
  ],
  // 24-month debt evolution (BRL, millions). Smooth decay with one uptick.
  saldo24m: [
    18.74, 18.52, 18.28, 17.98, 17.65, 17.30, 16.92, 16.50, 16.05, 15.58,
    15.08, 14.56, 14.02, 13.45, 12.87, 12.26, 11.63, 10.98, 10.31,  9.62,
     8.91,  8.18,  7.43,  6.66,  5.87,
  ],
  // Next 12 months — amort vs juros (BRL, thousands).
  amortJuros: [
    { m: 'Abr', a: 318, j:  94 }, { m: 'Mai', a: 340, j:  92 },
    { m: 'Jun', a: 355, j:  89 }, { m: 'Jul', a: 368, j:  86 },
    { m: 'Ago', a: 380, j:  83 }, { m: 'Set', a: 395, j:  79 },
    { m: 'Out', a: 412, j:  76 }, { m: 'Nov', a: 428, j:  72 },
    { m: 'Dez', a: 445, j:  68 }, { m: 'Jan', a: 462, j:  64 },
    { m: 'Fev', a: 480, j:  60 }, { m: 'Mar', a: 498, j:  55 },
  ],
  // Debt composition by creditor (BRL, millions).
  credores: [
    { nome: 'Bradesco',  v: 5.82 },
    { nome: 'Itaú BBA',  v: 4.20 },
    { nome: 'Citibank',  v: 3.15 },
    { nome: 'Santander', v: 2.38 },
    { nome: 'Banco BV',  v: 1.85 },
    { nome: 'HSBC',      v: 1.34 },
  ],
  cotacoes: [
    { moeda: 'USD', val: 5.1280, delta: +0.65 },
    { moeda: 'EUR', val: 5.5420, delta: -0.34 },
    { moeda: 'GBP', val: 6.4320, delta: +0.22 },
    { moeda: 'JPY', val: 0.0332, delta: -0.12 },
    { moeda: 'CHF', val: 5.7610, delta: +0.48 },
  ],
};

// ─── FORMATTERS ───────────────────────────────────────────────
const fmtBRL = (v, opts = {}) => {
  const { compact = false, sign = false } = opts;
  if (v === null || v === undefined || isNaN(v)) return '—';
  if (compact) {
    const abs = Math.abs(v);
    const s = sign && v > 0 ? '+' : v < 0 ? '−' : '';
    if (abs >= 1e6) return `${s}R$ ${(abs / 1e6).toFixed(2).replace('.', ',')}M`;
    if (abs >= 1e3) return `${s}R$ ${(abs / 1e3).toFixed(0)}k`;
    return `${s}R$ ${abs.toFixed(0)}`;
  }
  const f = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(v));
  return (sign && v > 0 ? '+' : v < 0 ? '−' : '') + f;
};

const fmtBRLShort = v => fmtBRL(v, { compact: true });

const fmtPct = (v, digits = 2) => {
  if (v === null || v === undefined) return '—';
  const s = v > 0 ? '+' : '';
  return s + v.toFixed(digits).replace('.', ',') + '%';
};

const fmtNum = (v, digits = 4) => {
  if (v === null || v === undefined) return '—';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

const fmtDate = iso => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
};

// ─── SVG CHART PRIMITIVES ─────────────────────────────────────
// Tiny declarative charts (no chart.js in the mockup — we want design
// control over every stroke). Each returns an <svg>; callers size via CSS.

function AreaChart({ data, color, fillColor, height = 160, stroke = 2, showDots = false, grid = true, gridColor = 'rgba(0,0,0,0.06)', axisColor = 'rgba(0,0,0,0.35)' }) {
  const W = 800, H = height;
  const pad = { t: 10, r: 10, b: 22, l: 38 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad.l + (i / (data.length - 1)) * iw;
    const y = pad.t + ih - ((v - min) / range) * ih;
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const area = path + ` L${pad.l + iw},${pad.t + ih} L${pad.l},${pad.t + ih} Z`;

  // Y ticks
  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
    const v = min + (range * i) / ticks;
    const y = pad.t + ih - (i / ticks) * ih;
    return { v, y };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      {grid && yTicks.map((t, i) => (
        <line key={i} x1={pad.l} x2={W - pad.r} y1={t.y} y2={t.y} stroke={gridColor} strokeWidth="1" />
      ))}
      {yTicks.map((t, i) => (
        <text key={i} x={pad.l - 6} y={t.y + 3} textAnchor="end" fontSize="10" fill={axisColor} fontFamily="inherit">
          {t.v.toFixed(1)}
        </text>
      ))}
      <path d={area} fill={fillColor} />
      <path d={path} fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round" />
      {showDots && pts.filter((_, i) => i % 4 === 0).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill={color} />
      ))}
    </svg>
  );
}

function BarChart({ data, colors = ['#2563eb', '#dc2626'], height = 180, stacked = true, labelColor = 'rgba(0,0,0,0.5)', gridColor = 'rgba(0,0,0,0.06)' }) {
  const W = 800, H = height;
  const pad = { t: 10, r: 10, b: 26, l: 42 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = Math.max(...data.map(d => d.a + d.j)) * 1.1;
  const bw = (iw / data.length) * 0.62;
  const bgap = (iw / data.length) * 0.38;
  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
    const v = (max * i) / ticks;
    const y = pad.t + ih - (i / ticks) * ih;
    return { v, y };
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      {yTicks.map((t, i) => (
        <line key={i} x1={pad.l} x2={W - pad.r} y1={t.y} y2={t.y} stroke={gridColor} strokeWidth="1" />
      ))}
      {yTicks.map((t, i) => (
        <text key={i} x={pad.l - 6} y={t.y + 3} textAnchor="end" fontSize="10" fill={labelColor} fontFamily="inherit">
          {t.v.toFixed(0)}
        </text>
      ))}
      {data.map((d, i) => {
        const x = pad.l + i * (bw + bgap) + bgap / 2;
        const hA = (d.a / max) * ih;
        const hJ = (d.j / max) * ih;
        const yA = pad.t + ih - hA;
        const yJ = yA - hJ;
        return (
          <g key={i}>
            <rect x={x} y={yA} width={bw} height={hA} fill={colors[0]} rx="1" />
            <rect x={x} y={yJ} width={bw} height={hJ} fill={colors[1]} rx="1" />
            <text x={x + bw / 2} y={H - 10} textAnchor="middle" fontSize="10" fill={labelColor} fontFamily="inherit">{d.m}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Donut({ data, colors, size = 160, thickness = 22, bg = 'transparent' }) {
  const total = data.reduce((s, d) => s + d.v, 0);
  const r = size / 2 - thickness / 2 - 2;
  const cx = size / 2, cy = size / 2;
  let angle = -Math.PI / 2;
  const arcs = data.map((d, i) => {
    const frac = d.v / total;
    const a0 = angle;
    const a1 = angle + frac * Math.PI * 2;
    angle = a1;
    const large = frac > 0.5 ? 1 : 0;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const path = `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
    return { path, color: colors[i % colors.length], pct: (frac * 100).toFixed(1) };
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, display: 'block' }}>
      <circle cx={cx} cy={cy} r={r} fill={bg} stroke="rgba(0,0,0,0.04)" strokeWidth="1" />
      {arcs.map((a, i) => (
        <path key={i} d={a.path} fill="none" stroke={a.color} strokeWidth={thickness} strokeLinecap="butt" />
      ))}
    </svg>
  );
}

function Sparkline({ data, color = 'currentColor', width = 80, height = 24, stroke = 1.5 }) {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 2) + 1;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

Object.assign(window, { SAMPLE, fmtBRL, fmtBRLShort, fmtPct, fmtNum, fmtDate, AreaChart, BarChart, Donut, Sparkline });
