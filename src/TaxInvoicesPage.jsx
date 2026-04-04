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
  text: "#e2e8f0", textMuted: "#475569", textDim: "#94a3b8",
};

const I = {
  tax: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 15l2 2 4-4",
  print: "M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z",
  filter: "M22 3H2l8 9.46V19l4 2v-8.54z",
  calendar: "M3 4h18v18H3zM16 2v4M8 2v4M3 10h18",
  download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
  chartBar: "M18 20V10M12 20V4M6 20v-6",
  sales: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
};

const Ic = ({ d, s = 16, c = "currentColor" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const fmt = (n) => (n ?? 0).toLocaleString("ar-EG") + " ج.م";
const getMonth = (d) => d?.slice(0, 7);
const today = () => new Date().toISOString().split("T")[0];

const Card = ({ children, style = {} }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 22px", ...style }}>{children}</div>
);

const MiniStat = ({ label, value, color, icon, sub }) => (
  <div style={{ background: C.surface2, borderRadius: 14, padding: "16px 18px", borderRight: `3px solid ${color}`, display: "flex", flexDirection: "column", gap: 8 }}>
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
    ghost: { background: "transparent", color: C.textDim, border: `1px solid ${C.border}` },
    yellow: { background: C.yellowDim, color: C.yellow, border: `1px solid ${C.yellow}33` },
  };
  return (
    <button onClick={onClick} style={{ ...v[variant], borderRadius: 9, padding: small ? "5px 12px" : "8px 18px", fontSize: small ? 12 : 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit", ...style }}>
      {children}
    </button>
  );
};

// ─── PRINT TAX INVOICE ────────────────────────────────────────────────────────
const printTaxInvoice = (inv) => {
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>فاتورة ضريبية</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo','Segoe UI',sans-serif;background:#fff;color:#1a1a2e;padding:40px}
  .header{text-align:center;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #f59e0b}
  .title{font-size:22px;font-weight:800}.subtitle{color:#f59e0b;font-size:14px;font-weight:700;margin-top:4px}
  .badge{display:inline-block;background:#fffbeb;color:#92400e;border:1px solid #fde68a;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;margin-top:6px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:20px 0}
  .info-box{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px}
  .info-label{font-size:11px;color:#92400e;font-weight:600;margin-bottom:4px}.info-value{font-size:14px;font-weight:700}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}thead tr{background:#f59e0b;color:#fff}
  thead th{padding:10px 14px;font-size:12px;font-weight:700;text-align:right}
  tbody tr:nth-child(even){background:#fffbeb}tbody td{padding:10px 14px;font-size:13px;border-bottom:1px solid #fde68a}
  .totals{background:#fffbeb;border:2px solid #f59e0b;border-radius:10px;padding:16px 20px;max-width:320px;margin-right:auto}
  .total-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px}
  .total-row.tax{color:#92400e;font-weight:700;background:#fef3c7;padding:8px;border-radius:6px;margin:4px 0}
  .total-row.main{font-size:16px;font-weight:800;color:#92400e;border-top:2px solid #f59e0b;margin-top:8px;padding-top:10px}
  .footer{margin-top:30px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}
  @media print{body{padding:20px}}</style></head><body>
  <div class="header">
    <div class="title">حسابي Pro</div>
    <div class="subtitle">⚖️ فاتورة ضريبية رسمية</div>
    <div style="font-size:13px;color:#64748b;margin-top:6px">رقم الفاتورة: <strong>${inv.id}</strong></div>
    <span class="badge">${inv.status}</span>
  </div>
  <div class="info-grid">
    <div class="info-box"><div class="info-label">العميل / المورد</div><div class="info-value">${inv.client || inv.supplier || "—"}</div></div>
    <div class="info-box"><div class="info-label">التاريخ</div><div class="info-value">${inv.date}</div></div>
    <div class="info-box"><div class="info-label">نسبة الضريبة المضافة</div><div class="info-value">${inv.taxRate || 14}%</div></div>
    <div class="info-box"><div class="info-label">نوع الفاتورة</div><div class="info-value">${inv.client ? "مبيعات" : "مشتريات"}</div></div>
  </div>
  <table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر (قبل ض.)</th><th>قيمة الضريبة</th><th>الإجمالي شامل الضريبة</th></tr></thead><tbody>
  ${(inv.items || []).map(it => {
    const tax = (it.qty || 0) * (it.price || 0) * (inv.taxRate || 14) / 100;
    const total = (it.qty || 0) * (it.price || 0) + tax;
    return `<tr><td>${it.name || "—"}</td><td>${it.qty}</td><td>${(it.price || 0).toLocaleString("ar-EG")} ج.م</td><td style="color:#92400e;font-weight:600">${tax.toLocaleString("ar-EG")} ج.م</td><td style="font-weight:700">${total.toLocaleString("ar-EG")} ج.م</td></tr>`;
  }).join("")}
  </tbody></table>
  <div class="totals">
    <div class="total-row"><span>المجموع قبل الضريبة</span><span>${(inv.subtotal || inv.amount).toLocaleString("ar-EG")} ج.م</span></div>
    <div class="total-row tax"><span>⚖️ ضريبة القيمة المضافة ${inv.taxRate || 14}%</span><span>${(inv.taxAmount || 0).toLocaleString("ar-EG")} ج.م</span></div>
    <div class="total-row main"><span>الإجمالي شامل الضريبة</span><span>${inv.amount.toLocaleString("ar-EG")} ج.م</span></div>
    <div class="total-row"><span>المدفوع</span><span>${(inv.paid || 0).toLocaleString("ar-EG")} ج.م</span></div>
    <div class="total-row"><span>المتبقي</span><span>${(inv.amount - inv.paid).toLocaleString("ar-EG")} ج.م</span></div>
  </div>
  <div class="footer">فاتورة ضريبية رسمية — حسابي Pro — ${new Date().toLocaleDateString("ar-EG")}</div>
  </body></html>`;
  const w = window.open("", "_blank");
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(() => w.print(), 500);
};

// ─── TAX INVOICES PAGE ────────────────────────────────────────────────────────
export default function TaxInvoicesPage({ salesInvoices, purchaseInvoices }) {
  const [selectedMonth, setSelectedMonth] = useState(today().slice(0, 7));
  const [activeTab, setActiveTab] = useState("sales"); // sales | purchases | summary
  const [search, setSearch] = useState("");

  // All months
  const allMonths = useMemo(() => {
    return [...new Set([
      ...salesInvoices.map(i => getMonth(i.date)),
      ...purchaseInvoices.map(i => getMonth(i.date)),
      today().slice(0, 7),
    ])].filter(Boolean).sort().reverse();
  }, [salesInvoices, purchaseInvoices]);

  const monthLabel = (m) => {
    if (!m) return "";
    const [y, mo] = m.split("-");
    return new Date(+y, +mo - 1, 1).toLocaleDateString("ar-EG", { month: "long", year: "numeric" });
  };

  // Monthly data — only sales invoices with tax > 0 are "tax invoices"
  const monthSales = salesInvoices.filter(i => getMonth(i.date) === selectedMonth && (i.taxAmount || 0) > 0);
  const monthPurchases = purchaseInvoices.filter(i => getMonth(i.date) === selectedMonth);

  // All sales with tax (for general listing)
  const allTaxSales = salesInvoices.filter(i => (i.taxAmount || 0) > 0);

  const filteredSales = monthSales.filter(i =>
    !search || i.client?.includes(search) || i.id?.includes(search)
  );
  const filteredPurchases = monthPurchases.filter(i =>
    !search || i.supplier?.includes(search) || i.id?.includes(search)
  );

  // Summary stats
  const totalSalesTax = monthSales.reduce((s, i) => s + (i.taxAmount || 0), 0);
  const totalSalesBase = monthSales.reduce((s, i) => s + (i.subtotal || i.amount), 0);
  const totalSalesGross = monthSales.reduce((s, i) => s + i.amount, 0);
  const totalPurchasesGross = monthPurchases.reduce((s, i) => s + i.amount, 0);
  const netTaxDue = totalSalesTax; // Simplified: VAT from sales only

  const tabStyle = (id) => ({
    padding: "9px 18px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", transition: "all 0.15s",
    background: activeTab === id ? C.yellow : "transparent",
    color: activeTab === id ? "#000" : C.textMuted,
    boxShadow: activeTab === id ? `0 4px 15px ${C.yellow}40` : "none",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, fontFamily: "'Cairo','Segoe UI',sans-serif", direction: "rtl" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: C.yellowDim, border: `1px solid ${C.yellow}22`, padding: 12, borderRadius: 14 }}>
            <Ic d={I.tax} s={22} c={C.yellow} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>الفواتير الضريبية</h1>
            <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>فواتير ضريبة القيمة المضافة وملخص الضرائب</p>
          </div>
        </div>
        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 14px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none" }}>
          {allMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        <MiniStat label="فواتير مبيعات ضريبية" value={monthSales.length} color={C.accent} icon={I.sales} sub={`${monthSales.length} فاتورة`} />
        <MiniStat label="إجمالي قبل الضريبة" value={fmt(totalSalesBase)} color={C.blue} icon={I.chartBar} />
        <MiniStat label="ضريبة القيمة المضافة" value={fmt(totalSalesTax)} color={C.yellow} icon={I.tax} />
        <MiniStat label="إجمالي شامل الضريبة" value={fmt(totalSalesGross)} color={C.green} icon={I.chartBar} />
      </div>

      {/* Tax Summary Box */}
      <div style={{ background: C.yellowDim, border: `2px solid ${C.yellow}44`, borderRadius: 16, padding: "20px 24px", display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ background: C.yellow + "18", padding: 14, borderRadius: 12 }}>
          <Ic d={I.tax} s={28} c={C.yellow} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.yellow, marginBottom: 8 }}>⚖️ ملخص ضريبة القيمة المضافة — {monthLabel(selectedMonth)}</div>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            {[
              { label: "ض.ق.م على المبيعات (مخرجات)", value: totalSalesTax, color: C.red },
              { label: "إجمالي المشتريات (مدخلات)", value: totalPurchasesGross, color: C.green },
              { label: "صافي الضريبة المستحقة", value: netTaxDue, color: C.yellow },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: "monospace" }}>{fmt(s.value)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: C.surface2, padding: 4, borderRadius: 12, border: `1px solid ${C.border}`, width: "fit-content" }}>
        <button style={tabStyle("sales")} onClick={() => setActiveTab("sales")}>فواتير المبيعات الضريبية ({filteredSales.length})</button>
        <button style={tabStyle("purchases")} onClick={() => setActiveTab("purchases")}>فواتير المشتريات ({filteredPurchases.length})</button>
        <button style={tabStyle("all")} onClick={() => setActiveTab("all")}>كل الفواتير الضريبية ({allTaxSales.length})</button>
      </div>

      {/* Search */}
      <div style={{ position: "relative", maxWidth: 320 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم الفاتورة أو الاسم..."
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 36px 9px 13px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" }} />
        <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.4 }}>
          <Ic d={I.filter} s={13} c={C.textMuted} />
        </div>
      </div>

      {/* Sales Tax Invoices Tab */}
      {activeTab === "sales" && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 700, color: C.text }}>
            فواتير المبيعات الضريبية — {monthLabel(selectedMonth)}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <THead cols={["رقم الفاتورة", "التاريخ", "العميل", "قبل الضريبة", `ض.ق.م (%)`, "إجمالي شامل", "المدفوع", "الحالة", "طباعة"]} />
              <tbody>
                {filteredSales.map((inv, i) => (
                  <TRow key={inv.id} alt={i % 2}>
                    <TD color={C.accent}><span style={{ fontWeight: 700 }}>{inv.id}</span></TD>
                    <TD color={C.textDim}><span style={{ fontSize: 11 }}>{inv.date}</span></TD>
                    <TD><span style={{ fontWeight: 600 }}>{inv.client}</span></TD>
                    <TD mono color={C.text}>{fmt(inv.subtotal || inv.amount)}</TD>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ background: C.yellowDim, color: C.yellow, border: `1px solid ${C.yellow}33`, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>
                        {inv.taxRate || 14}% = {fmt(inv.taxAmount || 0)}
                      </span>
                    </td>
                    <TD mono color={C.yellow}><span style={{ fontWeight: 800 }}>{fmt(inv.amount)}</span></TD>
                    <TD mono color={C.green}>{fmt(inv.paid)}</TD>
                    <td style={{ padding: "11px 14px" }}><Badge label={inv.status} /></td>
                    <td style={{ padding: "11px 14px" }}>
                      <button onClick={() => printTaxInvoice(inv)} title="طباعة فاتورة ضريبية"
                        style={{ background: C.yellowDim, color: C.yellow, border: `1px solid ${C.yellow}33`, borderRadius: 8, padding: "6px 12px", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit", fontWeight: 600 }}>
                        <Ic d={I.print} s={13} />طباعة
                      </button>
                    </td>
                  </TRow>
                ))}
              </tbody>
            </table>
            {filteredSales.length === 0 && (
              <div style={{ padding: 48, textAlign: "center", color: C.textMuted }}>
                <div style={{ background: C.yellowDim, padding: 20, borderRadius: "50%", display: "inline-flex", marginBottom: 12 }}>
                  <Ic d={I.tax} s={32} c={C.yellow} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>لا توجد فواتير ضريبية لهذا الشهر</div>
                <div style={{ fontSize: 12, marginTop: 6, color: C.textMuted }}>الفواتير الضريبية هي الفواتير التي تحتوي على ضريبة قيمة مضافة</div>
              </div>
            )}
          </div>
          {filteredSales.length > 0 && (
            <div style={{ padding: "12px 18px", borderTop: `1px solid ${C.border}`, background: C.yellowDim, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>إجمالي {filteredSales.length} فاتورة ضريبية</span>
              <div style={{ display: "flex", gap: 24, fontSize: 12 }}>
                <span style={{ color: C.textMuted }}>قبل الضريبة: <span style={{ color: C.text, fontFamily: "monospace", fontWeight: 700 }}>{fmt(totalSalesBase)}</span></span>
                <span style={{ color: C.textMuted }}>الضريبة: <span style={{ color: C.yellow, fontFamily: "monospace", fontWeight: 700 }}>{fmt(totalSalesTax)}</span></span>
                <span style={{ color: C.textMuted }}>الإجمالي: <span style={{ color: C.green, fontFamily: "monospace", fontWeight: 700 }}>{fmt(totalSalesGross)}</span></span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Purchases Tab */}
      {activeTab === "purchases" && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 700, color: C.text }}>
            فواتير المشتريات — {monthLabel(selectedMonth)}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <THead cols={["رقم الفاتورة", "التاريخ", "المورد", "الإجمالي", "المدفوع", "المتبقي", "طريقة الدفع", "الحالة"]} />
              <tbody>
                {filteredPurchases.map((inv, i) => (
                  <TRow key={inv.id} alt={i % 2}>
                    <TD color={C.accent}><span style={{ fontWeight: 700 }}>{inv.id}</span></TD>
                    <TD color={C.textDim}><span style={{ fontSize: 11 }}>{inv.date}</span></TD>
                    <TD><span style={{ fontWeight: 600 }}>{inv.supplier}</span></TD>
                    <TD mono><span style={{ fontWeight: 700 }}>{fmt(inv.amount)}</span></TD>
                    <TD mono color={C.green}>{fmt(inv.paid)}</TD>
                    <TD mono color={(inv.amount - inv.paid) > 0 ? C.red : C.textMuted}>{fmt(inv.amount - inv.paid)}</TD>
                    <TD color={inv.paymentMethod === "شيك" ? C.yellow : C.green}>
                      {inv.paymentMethod === "شيك" ? "📄 شيك" : inv.paymentMethod === "تحويل" ? "🏦 تحويل" : "💵 نقدي"}
                    </TD>
                    <td style={{ padding: "11px 14px" }}><Badge label={inv.status} /></td>
                  </TRow>
                ))}
              </tbody>
            </table>
            {filteredPurchases.length === 0 && <div style={{ padding: 40, textAlign: "center", color: C.textMuted, fontSize: 13 }}>لا توجد فواتير مشتريات لهذا الشهر</div>}
          </div>
        </div>
      )}

      {/* All Tax Invoices Tab */}
      {activeTab === "all" && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>كل الفواتير الضريبية ({allTaxSales.length})</span>
            <span style={{ fontSize: 12, color: C.yellow, fontFamily: "monospace", fontWeight: 700 }}>
              إجمالي الضرائب: {fmt(allTaxSales.reduce((s, i) => s + (i.taxAmount || 0), 0))}
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <THead cols={["رقم الفاتورة", "التاريخ", "الشهر", "العميل", "قبل الضريبة", "الضريبة", "الإجمالي", "الحالة", "طباعة"]} />
              <tbody>
                {allTaxSales.sort((a, b) => b.date?.localeCompare(a.date)).map((inv, i) => {
                  const [y, m] = (getMonth(inv.date) || "").split("-");
                  const mLabel = y ? new Date(+y, +m - 1, 1).toLocaleDateString("ar-EG", { month: "short", year: "numeric" }) : "—";
                  return (
                    <TRow key={inv.id} alt={i % 2}>
                      <TD color={C.accent}><span style={{ fontWeight: 700 }}>{inv.id}</span></TD>
                      <TD color={C.textDim}><span style={{ fontSize: 11 }}>{inv.date}</span></TD>
                      <TD color={C.textMuted}><span style={{ fontSize: 11 }}>{mLabel}</span></TD>
                      <TD><span style={{ fontWeight: 600 }}>{inv.client}</span></TD>
                      <TD mono color={C.textDim}>{fmt(inv.subtotal || inv.amount)}</TD>
                      <TD mono color={C.yellow}><span style={{ fontWeight: 700 }}>{fmt(inv.taxAmount || 0)}</span></TD>
                      <TD mono color={C.green}><span style={{ fontWeight: 700 }}>{fmt(inv.amount)}</span></TD>
                      <td style={{ padding: "11px 14px" }}><Badge label={inv.status} /></td>
                      <td style={{ padding: "11px 14px" }}>
                        <button onClick={() => printTaxInvoice(inv)} style={{ background: C.yellowDim, color: C.yellow, border: `1px solid ${C.yellow}33`, borderRadius: 8, padding: "5px 10px", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
                          <Ic d={I.print} s={12} />PDF
                        </button>
                      </td>
                    </TRow>
                  );
                })}
              </tbody>
            </table>
            {allTaxSales.length === 0 && <div style={{ padding: 40, textAlign: "center", color: C.textMuted, fontSize: 13 }}>لا توجد فواتير ضريبية بعد</div>}
          </div>
        </div>
      )}
    </div>
  );
}
