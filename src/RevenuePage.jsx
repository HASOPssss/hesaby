import { useState, useMemo } from "react";

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#070810", surface: "#0e1020", surface2: "#151829", surface3: "#1c2036",
  border: "#1e2238", borderLight: "#252a45",
  accent: "#6c7fff", accentDim: "rgba(108,127,255,0.1)",
  green: "#34d399", greenDim: "rgba(52,211,153,0.1)",
  red: "#f87171", redDim: "rgba(248,113,113,0.1)",
  yellow: "#fbbf24", yellowDim: "rgba(251,191,36,0.1)",
  blue: "#60a5fa", blueDim: "rgba(96,165,250,0.1)",
  purple: "#a78bfa", purpleDim: "rgba(167,139,250,0.1)",
  cyan: "#22d3ee", cyanDim: "rgba(34,211,238,0.1)",
  text: "#e2e8f0", textMuted: "#475569", textDim: "#94a3b8",
};

const I = {
  revenue: "M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6",
  chartBar: "M18 20V10M12 20V4M6 20v-6",
  sales: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  purchase: "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0",
  returns: "M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15",
  clients: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  alert: "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  tax: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 15l2 2 4-4",
  calendar: "M3 4h18v18H3zM16 2v4M8 2v4M3 10h18",
  download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
  print: "M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z",
};

const Ic = ({ d, s = 16, c = "currentColor" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const fmt = (n) => (n ?? 0).toLocaleString("ar-EG") + " ج.م";
const fmtNum = (n) => (n ?? 0).toLocaleString("ar-EG");
const today = () => new Date().toISOString().split("T")[0];
const getMonth = (d) => d?.slice(0, 7);

const Card = ({ children, style = {} }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 22px", ...style }}>{children}</div>
);

const GlowCard = ({ children, color = C.accent, style = {} }) => (
  <div style={{ background: C.surface, border: `1px solid ${color}22`, borderRadius: 16, padding: "20px 22px", boxShadow: `0 0 30px ${color}0a`, ...style }}>{children}</div>
);

const MiniStat = ({ label, value, color, icon, sub }) => (
  <div style={{ background: C.surface2, borderRadius: 14, padding: "16px 18px", borderRight: `3px solid ${color}`, display: "flex", flexDirection: "column", gap: 8, position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", top: 8, left: 12, opacity: 0.06 }}>
      {icon && <Ic d={icon} s={40} c={color} />}
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {icon && <div style={{ background: color + "18", padding: 6, borderRadius: 8 }}><Ic d={icon} s={14} c={color} /></div>}
      <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>{label}</span>
    </div>
    <div style={{ fontSize: 19, fontWeight: 800, color, fontFamily: "monospace" }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: C.textMuted }}>{sub}</div>}
  </div>
);

const THead = ({ cols }) => (
  <thead>
    <tr style={{ background: C.surface3, borderBottom: `1px solid ${C.border}` }}>
      {cols.map(c => <th key={c} style={{ padding: "10px 14px", fontSize: 11, color: C.textMuted, fontWeight: 700, textAlign: "right", whiteSpace: "nowrap" }}>{c}</th>)}
    </tr>
  </thead>
);

const TRow = ({ children, alt }) => (
  <tr style={{ borderBottom: `1px solid ${C.border}20`, background: alt ? "rgba(255,255,255,0.015)" : "transparent" }}>{children}</tr>
);

const TD = ({ children, color, mono = false }) => (
  <td style={{ padding: "11px 14px", fontSize: 12, color: color || C.text, fontFamily: mono ? "monospace" : "inherit" }}>{children}</td>
);

const Badge = ({ label }) => {
  const colors = {
    "مدفوعة": { bg: C.greenDim, color: C.green, border: C.green + "33" },
    "جزئية": { bg: C.yellowDim, color: C.yellow, border: C.yellow + "33" },
    "غير مدفوعة": { bg: C.redDim, color: C.red, border: C.red + "33" },
  };
  const s = colors[label] || { bg: C.surface2, color: C.textDim, border: C.border };
  return <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{label}</span>;
};

const Btn = ({ children, onClick, variant = "primary", small = false, style = {} }) => {
  const v = {
    primary: { background: C.accent, color: "#fff", border: "none" },
    danger: { background: C.redDim, color: C.red, border: `1px solid ${C.red}44` },
    ghost: { background: "transparent", color: C.textDim, border: `1px solid ${C.border}` },
    yellow: { background: C.yellowDim, color: C.yellow, border: `1px solid ${C.yellow}33` },
  };
  return (
    <button onClick={onClick} style={{ ...v[variant], borderRadius: 9, padding: small ? "5px 12px" : "8px 18px", fontSize: small ? 12 : 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit", ...style }}>
      {children}
    </button>
  );
};

// ─── PRINT FINANCIAL REPORT ───────────────────────────────────────────────────
const printFinancialReport = (data, selectedMonth) => {
  const filteredSales = data.salesInvoices.filter(i => getMonth(i.date) === selectedMonth);
  const filteredPurchases = data.purchaseInvoices.filter(i => getMonth(i.date) === selectedMonth);
  const filteredReturns = data.returns.filter(r => getMonth(r.date) === selectedMonth);
  const totalSales = filteredSales.reduce((s, i) => s + i.amount, 0);
  const totalPurchases = filteredPurchases.reduce((s, i) => s + i.amount, 0);
  const totalReturns = filteredReturns.reduce((s, r) => s + r.amount, 0);
  const totalPaid = filteredSales.reduce((s, i) => s + i.paid, 0);
  const profit = totalSales - totalPurchases - totalReturns;
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>التقرير المالي</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo','Segoe UI',sans-serif;background:#fff;color:#1a1a2e;padding:40px}
  .header{text-align:center;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #6c7fff}
  .title{font-size:24px;font-weight:800;color:#6c7fff}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:30px}
  .stat{border-radius:10px;padding:16px;text-align:center;border:1px solid #e2e8f0}
  .stat-val{font-size:18px;font-weight:800;font-family:monospace}.stat-lbl{font-size:11px;color:#64748b;margin-top:4px}
  table{width:100%;border-collapse:collapse;margin-bottom:24px;font-size:12px}thead tr{background:#6c7fff;color:#fff}
  thead th{padding:9px 12px;font-weight:700;text-align:right}tbody tr:nth-child(even){background:#f8faff}
  tbody td{padding:9px 12px;border-bottom:1px solid #e2e8f0}.section-title{font-size:15px;font-weight:800;margin:24px 0 12px}
  .footer{margin-top:30px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}
  @media print{body{padding:20px}}</style></head><body>
  <div class="header"><div class="title">التقرير المالي الشهري</div>
  <div style="font-size:13px;color:#64748b;margin-top:6px">الفترة: ${selectedMonth} — حسابي Pro</div></div>
  <div class="stats">
  <div class="stat"><div class="stat-val" style="color:#34d399">${totalSales.toLocaleString("ar-EG")} ج.م</div><div class="stat-lbl">المبيعات</div></div>
  <div class="stat"><div class="stat-val" style="color:#f87171">${totalPurchases.toLocaleString("ar-EG")} ج.م</div><div class="stat-lbl">المشتريات</div></div>
  <div class="stat"><div class="stat-val" style="color:${profit >= 0 ? "#34d399" : "#f87171"}">${profit.toLocaleString("ar-EG")} ج.م</div><div class="stat-lbl">صافي الربح</div></div>
  <div class="stat"><div class="stat-val" style="color:#6c7fff">${totalPaid.toLocaleString("ar-EG")} ج.م</div><div class="stat-lbl">المحصّل</div></div></div>
  <div class="section-title">فواتير المبيعات — ${selectedMonth}</div>
  <table><thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>العميل</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th></tr></thead><tbody>
  ${filteredSales.map(i => `<tr><td>${i.id}</td><td>${i.date}</td><td>${i.client}</td><td>${i.amount.toLocaleString("ar-EG")} ج.م</td><td>${i.paid.toLocaleString("ar-EG")} ج.م</td><td>${(i.amount - i.paid).toLocaleString("ar-EG")} ج.م</td><td>${i.status}</td></tr>`).join("")}
  </tbody></table>
  <div class="footer">التقرير المالي — حسابي Pro — ${new Date().toLocaleDateString("ar-EG")}</div></body></html>`;
  const w = window.open("", "_blank");
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(() => w.print(), 500);
};

// ─── CONFIRM DIALOG ───────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.red}44`, borderRadius: 18, padding: "28px 32px", maxWidth: 380, width: "90%", textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.redDim, border: `2px solid ${C.red}44`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Ic d={I.alert} s={24} c={C.red} />
        </div>
        <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700, color: C.text }}>تأكيد الحذف</h3>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: C.textMuted, lineHeight: 1.7 }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onCancel} style={{ background: C.surface2, color: C.textDim, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button>
          <button onClick={onConfirm} style={{ background: C.red, color: "#fff", border: "none", borderRadius: 8, padding: "9px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>نعم، احذف</button>
        </div>
      </div>
    </div>
  );
}

// ─── REVENUE PAGE ─────────────────────────────────────────────────────────────
export default function RevenuePage({ data, onDeleteMonth, userEmail }) {
  const [selectedMonth, setSelectedMonth] = useState(today().slice(0, 7));
  const [activeTab, setActiveTab] = useState("overview"); // overview | sales | purchases | clients
  const [confirm, setConfirm] = useState(null);

  // All months with data
  const allMonths = useMemo(() => {
    return [...new Set([
      ...data.salesInvoices.map(i => getMonth(i.date)),
      ...data.purchaseInvoices.map(i => getMonth(i.date)),
      today().slice(0, 7),
    ])].filter(Boolean).sort().reverse();
  }, [data]);

  // Monthly filtered data
  const monthSales = data.salesInvoices.filter(i => getMonth(i.date) === selectedMonth);
  const monthPurchases = data.purchaseInvoices.filter(i => getMonth(i.date) === selectedMonth);
  const monthReturns = data.returns.filter(r => getMonth(r.date) === selectedMonth);

  const totalSales = monthSales.reduce((s, i) => s + i.amount, 0);
  const totalPurchases = monthPurchases.reduce((s, i) => s + i.amount, 0);
  const totalReturns = monthReturns.reduce((s, r) => s + r.amount, 0);
  const netProfit = totalSales - totalPurchases - totalReturns;
  const totalReceivable = monthSales.reduce((s, i) => s + (i.amount - i.paid), 0);
  const totalCollected = monthSales.reduce((s, i) => s + i.paid, 0);
  const totalTax = monthSales.reduce((s, i) => s + (i.taxAmount || 0), 0);

  // Top clients by sales
  const clientMap = {};
  monthSales.forEach(inv => {
    if (!clientMap[inv.client]) clientMap[inv.client] = { total: 0, paid: 0, count: 0 };
    clientMap[inv.client].total += inv.amount;
    clientMap[inv.client].paid += inv.paid;
    clientMap[inv.client].count++;
  });
  const topClients = Object.entries(clientMap).sort((a, b) => b[1].total - a[1].total).slice(0, 8);

  // Category breakdown
  const catMap = {};
  monthSales.forEach(inv => {
    (inv.items || []).forEach(it => {
      const c = it.category || "غير محدد";
      catMap[c] = (catMap[c] || 0) + (it.qty || 0) * (it.price || 0);
    });
  });
  const catBreakdown = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const catTotal = catBreakdown.reduce((s, [, v]) => s + v, 0);

  const tabStyle = (id) => ({
    padding: "9px 18px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", transition: "all 0.15s",
    background: activeTab === id ? C.accent : "transparent",
    color: activeTab === id ? "#fff" : C.textMuted,
  });

  const monthLabel = (m) => {
    if (!m) return "";
    const [y, mo] = m.split("-");
    return new Date(+y, +mo - 1, 1).toLocaleDateString("ar-EG", { month: "long", year: "numeric" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, fontFamily: "'Cairo','Segoe UI',sans-serif", direction: "rtl" }}>
      {confirm && <ConfirmDialog message={confirm.msg} onConfirm={() => { onDeleteMonth(confirm.month); setConfirm(null); }} onCancel={() => setConfirm(null)} />}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: C.greenDim, border: `1px solid ${C.green}22`, padding: 12, borderRadius: 14 }}>
            <Ic d={I.revenue} s={22} c={C.green} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>الإيرادات والأرباح</h1>
            <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>تحليل مالي شامل بالشهر</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 14px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none" }}>
            {allMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <Btn variant="ghost" small onClick={() => printFinancialReport(data, selectedMonth)}>
            <Ic d={I.print} s={13} />طباعة
          </Btn>
          <Btn variant="danger" small onClick={() => setConfirm({ month: selectedMonth, msg: `هل تريد حذف بيانات شهر "${monthLabel(selectedMonth)}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.` })}>
            <Ic d={I.trash} s={13} />حذف الشهر
          </Btn>
        </div>
      </div>

      {/* Main Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <GlowCard color={C.green} style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>إجمالي المبيعات</span>
            <div style={{ background: C.green + "18", padding: 7, borderRadius: 9 }}><Ic d={I.sales} s={14} c={C.green} /></div>
          </div>
          <div style={{ fontSize: 21, fontWeight: 800, color: C.green, fontFamily: "monospace" }}>{fmt(totalSales)}</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>{monthSales.length} فاتورة</div>
        </GlowCard>
        <GlowCard color={C.red} style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>إجمالي المشتريات</span>
            <div style={{ background: C.red + "18", padding: 7, borderRadius: 9 }}><Ic d={I.purchase} s={14} c={C.red} /></div>
          </div>
          <div style={{ fontSize: 21, fontWeight: 800, color: C.red, fontFamily: "monospace" }}>{fmt(totalPurchases)}</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>{monthPurchases.length} فاتورة</div>
        </GlowCard>
        <GlowCard color={netProfit >= 0 ? C.accent : C.red} style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>صافي الربح</span>
            <div style={{ background: (netProfit >= 0 ? C.accent : C.red) + "18", padding: 7, borderRadius: 9 }}><Ic d={I.chartBar} s={14} c={netProfit >= 0 ? C.accent : C.red} /></div>
          </div>
          <div style={{ fontSize: 21, fontWeight: 800, color: netProfit >= 0 ? C.accent : C.red, fontFamily: "monospace" }}>{fmt(netProfit)}</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>{netProfit >= 0 ? "▲ ربح" : "▼ خسارة"}</div>
        </GlowCard>
        <GlowCard color={C.yellow} style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>المديونية</span>
            <div style={{ background: C.yellow + "18", padding: 7, borderRadius: 9 }}><Ic d={I.clients} s={14} c={C.yellow} /></div>
          </div>
          <div style={{ fontSize: 21, fontWeight: 800, color: C.yellow, fontFamily: "monospace" }}>{fmt(totalReceivable)}</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>محصّل: {fmt(totalCollected)}</div>
        </GlowCard>
      </div>

      {/* Mini stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <MiniStat label="المرتجعات" value={fmt(totalReturns)} color={C.purple} icon={I.returns} />
        <MiniStat label="ضريبة القيمة المضافة" value={fmt(totalTax)} color={C.yellow} icon={I.tax} />
        <MiniStat label="هامش الربح" value={totalSales > 0 ? `${Math.round((netProfit / totalSales) * 100)}%` : "—"} color={netProfit >= 0 ? C.green : C.red} icon={I.chartBar} />
        <MiniStat label="متوسط قيمة الفاتورة" value={monthSales.length > 0 ? fmt(Math.round(totalSales / monthSales.length)) : "—"} color={C.blue} icon={I.sales} />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: C.surface2, padding: 4, borderRadius: 12, border: `1px solid ${C.border}`, width: "fit-content" }}>
        {[
          { id: "overview", label: "نظرة عامة" },
          { id: "sales", label: `فواتير المبيعات (${monthSales.length})` },
          { id: "purchases", label: `فواتير المشتريات (${monthPurchases.length})` },
          { id: "clients", label: "أفضل العملاء" },
        ].map(t => <button key={t.id} style={tabStyle(t.id)} onClick={() => setActiveTab(t.id)}>{t.label}</button>)}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          {/* Category breakdown */}
          <Card>
            <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: C.text }}>📊 مبيعات حسب الفئة</h3>
            {catBreakdown.length === 0 ? (
              <div style={{ textAlign: "center", color: C.textMuted, padding: 24, fontSize: 13 }}>لا توجد بيانات للفئات</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {catBreakdown.map(([cat, val]) => (
                  <div key={cat}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{cat}</span>
                      <span style={{ fontSize: 12, fontFamily: "monospace", color: C.accent }}>{fmt(val)}</span>
                    </div>
                    <div style={{ background: C.surface2, borderRadius: 6, height: 5, overflow: "hidden" }}>
                      <div style={{ width: `${catTotal > 0 ? Math.min(100, (val / catTotal) * 100) : 0}%`, height: "100%", background: C.accent, borderRadius: 6, transition: "width 0.4s" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Payment method breakdown */}
          <Card>
            <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: C.text }}>💳 طرق الدفع</h3>
            {(() => {
              const methods = { نقدي: 0, شيك: 0, تحويل: 0 };
              monthSales.forEach(i => { methods[i.paymentMethod] = (methods[i.paymentMethod] || 0) + i.amount; });
              const methodColors = { نقدي: C.green, شيك: C.yellow, تحويل: C.blue };
              const methodIcons = { نقدي: "💵", شيك: "📄", تحويل: "🏦" };
              return Object.entries(methods).filter(([, v]) => v > 0).map(([method, val]) => (
                <div key={method} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: C.surface2, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{methodIcons[method]}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{method}</span>
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: methodColors[method], fontFamily: "monospace" }}>{fmt(val)}</div>
                    <div style={{ fontSize: 10, color: C.textMuted }}>{totalSales > 0 ? `${Math.round((val / totalSales) * 100)}%` : "—"}</div>
                  </div>
                </div>
              ));
            })()}
            {monthSales.length === 0 && <div style={{ textAlign: "center", color: C.textMuted, padding: 24, fontSize: 13 }}>لا توجد فواتير</div>}
          </Card>
        </div>
      )}

      {/* Sales Tab */}
      {activeTab === "sales" && (
        <Card style={{ padding: 0 }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 700, color: C.text }}>
            فواتير المبيعات — {monthLabel(selectedMonth)}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <THead cols={["رقم", "التاريخ", "العميل", "الإجمالي", "المدفوع", "المتبقي", "ضريبة", "طريقة الدفع", "الحالة"]} />
              <tbody>
                {monthSales.map((inv, i) => (
                  <TRow key={inv.id} alt={i % 2}>
                    <TD color={C.accent}><span style={{ fontWeight: 700 }}>{inv.id}</span></TD>
                    <TD color={C.textDim}><span style={{ fontSize: 11 }}>{inv.date}</span></TD>
                    <TD><span style={{ fontWeight: 600 }}>{inv.client}</span></TD>
                    <TD mono><span style={{ fontWeight: 700 }}>{fmt(inv.amount)}</span></TD>
                    <TD mono color={C.green}>{fmt(inv.paid)}</TD>
                    <TD mono color={(inv.amount - inv.paid) > 0 ? C.red : C.textMuted}>{fmt(inv.amount - inv.paid)}</TD>
                    <TD mono color={C.yellow}>{fmt(inv.taxAmount || 0)}</TD>
                    <TD color={inv.paymentMethod === "شيك" ? C.yellow : inv.paymentMethod === "تحويل" ? C.blue : C.green}>
                      {inv.paymentMethod === "شيك" ? "📄 شيك" : inv.paymentMethod === "تحويل" ? "🏦 تحويل" : "💵 نقدي"}
                    </TD>
                    <td style={{ padding: "11px 14px" }}><Badge label={inv.status} /></td>
                  </TRow>
                ))}
              </tbody>
            </table>
            {monthSales.length === 0 && <div style={{ padding: 40, textAlign: "center", color: C.textMuted, fontSize: 13 }}>لا توجد فواتير مبيعات لهذا الشهر</div>}
          </div>
          {monthSales.length > 0 && (
            <div style={{ padding: "12px 18px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end", gap: 24, fontSize: 12 }}>
              <span style={{ color: C.textMuted }}>الإجمالي: <span style={{ color: C.green, fontFamily: "monospace", fontWeight: 700 }}>{fmt(totalSales)}</span></span>
              <span style={{ color: C.textMuted }}>المحصّل: <span style={{ color: C.accent, fontFamily: "monospace", fontWeight: 700 }}>{fmt(totalCollected)}</span></span>
              <span style={{ color: C.textMuted }}>المتبقي: <span style={{ color: C.red, fontFamily: "monospace", fontWeight: 700 }}>{fmt(totalReceivable)}</span></span>
            </div>
          )}
        </Card>
      )}

      {/* Purchases Tab */}
      {activeTab === "purchases" && (
        <Card style={{ padding: 0 }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 700, color: C.text }}>
            فواتير المشتريات — {monthLabel(selectedMonth)}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <THead cols={["رقم", "التاريخ", "المورد", "الإجمالي", "المدفوع", "المتبقي", "طريقة الدفع", "الحالة"]} />
              <tbody>
                {monthPurchases.map((inv, i) => (
                  <TRow key={inv.id} alt={i % 2}>
                    <TD color={C.accent}><span style={{ fontWeight: 700 }}>{inv.id}</span></TD>
                    <TD color={C.textDim}><span style={{ fontSize: 11 }}>{inv.date}</span></TD>
                    <TD><span style={{ fontWeight: 600 }}>{inv.supplier}</span></TD>
                    <TD mono><span style={{ fontWeight: 700 }}>{fmt(inv.amount)}</span></TD>
                    <TD mono color={C.green}>{fmt(inv.paid)}</TD>
                    <TD mono color={(inv.amount - inv.paid) > 0 ? C.red : C.textMuted}>{fmt(inv.amount - inv.paid)}</TD>
                    <TD color={inv.paymentMethod === "شيك" ? C.yellow : inv.paymentMethod === "تحويل" ? C.blue : C.green}>
                      {inv.paymentMethod === "شيك" ? "📄 شيك" : inv.paymentMethod === "تحويل" ? "🏦 تحويل" : "💵 نقدي"}
                    </TD>
                    <td style={{ padding: "11px 14px" }}><Badge label={inv.status} /></td>
                  </TRow>
                ))}
              </tbody>
            </table>
            {monthPurchases.length === 0 && <div style={{ padding: 40, textAlign: "center", color: C.textMuted, fontSize: 13 }}>لا توجد فواتير مشتريات لهذا الشهر</div>}
          </div>
          {monthPurchases.length > 0 && (
            <div style={{ padding: "12px 18px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end", gap: 24, fontSize: 12 }}>
              <span style={{ color: C.textMuted }}>الإجمالي: <span style={{ color: C.red, fontFamily: "monospace", fontWeight: 700 }}>{fmt(totalPurchases)}</span></span>
            </div>
          )}
        </Card>
      )}

      {/* Top Clients Tab */}
      {activeTab === "clients" && (
        <Card style={{ padding: 0 }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 700, color: C.text }}>
            أفضل العملاء — {monthLabel(selectedMonth)}
          </div>
          {topClients.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: C.textMuted, fontSize: 13 }}>لا توجد بيانات عملاء لهذا الشهر</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <THead cols={["العميل", "عدد الفواتير", "الإجمالي", "المدفوع", "المتبقي", "نسبة التحصيل"]} />
              <tbody>
                {topClients.map(([name, d], i) => {
                  const remaining = d.total - d.paid;
                  const collectionRate = d.total > 0 ? Math.round((d.paid / d.total) * 100) : 0;
                  return (
                    <TRow key={name} alt={i % 2}>
                      <TD><span style={{ fontWeight: 700 }}>{name}</span></TD>
                      <TD color={C.textMuted}>{d.count} فاتورة</TD>
                      <TD mono color={C.green}><span style={{ fontWeight: 700 }}>{fmt(d.total)}</span></TD>
                      <TD mono color={C.accent}>{fmt(d.paid)}</TD>
                      <TD mono color={remaining > 0 ? C.red : C.textMuted}>{fmt(remaining)}</TD>
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ background: C.surface2, borderRadius: 6, height: 6, overflow: "hidden", flex: 1, minWidth: 60 }}>
                            <div style={{ width: `${collectionRate}%`, height: "100%", background: collectionRate >= 80 ? C.green : collectionRate >= 50 ? C.yellow : C.red, borderRadius: 6 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: collectionRate >= 80 ? C.green : collectionRate >= 50 ? C.yellow : C.red, fontFamily: "monospace" }}>{collectionRate}%</span>
                        </div>
                      </td>
                    </TRow>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
