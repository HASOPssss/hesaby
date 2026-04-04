import { useState } from "react";

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
  returns: "M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15",
  plus: "M12 5v14M5 12h14",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  close: "M18 6L6 18M6 6l12 12",
  alert: "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  filter: "M22 3H2l8 9.46V19l4 2v-8.54z",
};

const Ic = ({ d, s = 16, c = "currentColor" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const fmt = (n) => (n ?? 0).toLocaleString("ar-EG") + " ج.م";
const fmtDateTime = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${d.toLocaleDateString("ar-EG")} — ${d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}`;
};
const today = () => new Date().toISOString().split("T")[0];

const Card = ({ children, style = {} }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 22px", ...style }}>{children}</div>
);

const MiniStat = ({ label, value, color, icon }) => (
  <div style={{ background: C.surface2, borderRadius: 14, padding: "16px 18px", borderRight: `3px solid ${color}`, display: "flex", flexDirection: "column", gap: 8 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {icon && <div style={{ background: color + "18", padding: 6, borderRadius: 8 }}><Ic d={icon} s={14} c={color} /></div>}
      <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>{label}</span>
    </div>
    <div style={{ fontSize: 19, fontWeight: 800, color, fontFamily: "monospace" }}>{value}</div>
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

const Btn = ({ children, onClick, variant = "primary", small = false, style = {} }) => {
  const v = {
    primary: { background: C.accent, color: "#fff", border: "none" },
    danger: { background: "transparent", color: C.red, border: `1px solid ${C.red}44` },
    ghost: { background: "transparent", color: C.textDim, border: `1px solid ${C.border}` },
    purple: { background: C.purpleDim, color: C.purple, border: `1px solid ${C.purple}33` },
  };
  return (
    <button onClick={onClick} style={{ ...v[variant], borderRadius: 9, padding: small ? "5px 12px" : "8px 18px", fontSize: small ? 12 : 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit", ...style }}>
      {children}
    </button>
  );
};

const Inp = ({ label, value, onChange, type = "text", placeholder = "", required = false }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    {label && <label style={{ fontSize: 12, color: C.textDim, fontWeight: 600 }}>{label}{required && <span style={{ color: C.red }}> *</span>}</label>}
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 13px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none" }}
      onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.border} />
  </div>
);

const Sel = ({ label, value, onChange, options }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    {label && <label style={{ fontSize: 12, color: C.textDim, fontWeight: 600 }}>{label}</label>}
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 13px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none" }}>
      <option value="">-- اختر --</option>
      {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
    </select>
  </div>
);

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

// ─── RETURNS PAGE ─────────────────────────────────────────────────────────────
export default function ReturnsPage({ returns, salesInvoices, purchaseInvoices, clients, suppliers, onAdd, onDelete }) {
  const [showModal, setShowModal] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [form, setForm] = useState({
    date: today(), type: "sale", party: "", invoiceRef: "", amount: "", reason: "", notes: ""
  });

  const partyList = form.type === "sale" ? clients : suppliers;
  const invoiceList = form.type === "sale"
    ? salesInvoices.filter(i => !form.party || i.client === form.party)
    : purchaseInvoices.filter(i => !form.party || i.supplier === form.party);

  const handleSave = () => {
    if (!form.party || !form.amount) return;
    onAdd({
      id: "R" + Date.now().toString().slice(-5),
      date: form.date,
      type: form.type,
      party: form.party,
      invoiceRef: form.invoiceRef,
      amount: parseFloat(form.amount) || 0,
      reason: form.reason,
      notes: form.notes,
      createdAt: new Date().toISOString(),
    });
    setForm({ date: today(), type: "sale", party: "", invoiceRef: "", amount: "", reason: "", notes: "" });
    setShowModal(false);
  };

  const filtered = returns.filter(r => {
    const matchSearch = !search || r.party?.includes(search) || r.id?.includes(search) || r.reason?.includes(search);
    const matchType = !typeFilter || r.type === typeFilter;
    return matchSearch && matchType;
  });

  const totalReturns = filtered.reduce((s, r) => s + r.amount, 0);
  const saleReturns = returns.filter(r => r.type === "sale").reduce((s, r) => s + r.amount, 0);
  const purchaseReturns = returns.filter(r => r.type === "purchase").reduce((s, r) => s + r.amount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, fontFamily: "'Cairo','Segoe UI',sans-serif", direction: "rtl" }}>
      {confirm && <ConfirmDialog message={confirm.msg} onConfirm={() => { onDelete(confirm.id); setConfirm(null); }} onCancel={() => setConfirm(null)} />}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: C.purpleDim, border: `1px solid ${C.purple}22`, padding: 12, borderRadius: 14 }}>
            <Ic d={I.returns} s={22} c={C.purple} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>المرتجعات</h1>
            <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>تسجيل وإدارة مرتجعات المبيعات والمشتريات</p>
          </div>
        </div>
        <Btn onClick={() => setShowModal(true)}><Ic d={I.plus} s={14} />إضافة مرتجع</Btn>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        <MiniStat label="إجمالي المرتجعات" value={fmt(saleReturns + purchaseReturns)} color={C.purple} icon={I.returns} />
        <MiniStat label="مرتجعات مبيعات" value={fmt(saleReturns)} color={C.red} icon={I.returns} />
        <MiniStat label="مرتجعات مشتريات" value={fmt(purchaseReturns)} color={C.green} icon={I.returns} />
      </div>

      {/* Filters */}
      <Card style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو رقم المرتجع..."
              style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 36px 9px 13px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" }} />
            <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.4 }}>
              <Ic d={I.filter} s={13} c={C.textMuted} />
            </div>
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 14px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none" }}>
            <option value="">كل الأنواع</option>
            <option value="sale">مرتجع مبيعات</option>
            <option value="purchase">مرتجع مشتريات</option>
          </select>
          {(search || typeFilter) && (
            <button onClick={() => { setSearch(""); setTypeFilter(""); }}
              style={{ background: C.redDim, color: C.red, border: `1px solid ${C.red}33`, borderRadius: 9, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              مسح
            </button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card style={{ padding: 0 }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>سجل المرتجعات ({filtered.length})</span>
          {filtered.length > 0 && <span style={{ fontSize: 12, color: C.purple, fontFamily: "monospace", fontWeight: 700 }}>{fmt(totalReturns)}</span>}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <THead cols={["رقم", "التاريخ", "النوع", "الطرف", "الفاتورة المرجعية", "المبلغ", "السبب", "ملاحظات", ""]} />
            <tbody>
              {filtered.map((r, i) => (
                <TRow key={r.id} alt={i % 2}>
                  <TD color={C.purple}><span style={{ fontWeight: 700 }}>{r.id}</span></TD>
                  <TD color={C.textDim}><span style={{ fontSize: 11 }}>{fmtDateTime(r.createdAt || r.date)}</span></TD>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{
                      background: r.type === "sale" ? C.redDim : C.greenDim,
                      color: r.type === "sale" ? C.red : C.green,
                      border: `1px solid ${r.type === "sale" ? C.red : C.green}33`,
                      padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700
                    }}>
                      {r.type === "sale" ? "↩ مبيعات" : "↪ مشتريات"}
                    </span>
                  </td>
                  <TD><span style={{ fontWeight: 600 }}>{r.party}</span></TD>
                  <TD color={C.accent}>{r.invoiceRef || "—"}</TD>
                  <TD mono color={C.purple}><span style={{ fontWeight: 700 }}>{fmt(r.amount)}</span></TD>
                  <TD color={C.textDim}>{r.reason || "—"}</TD>
                  <TD color={C.textMuted}><span style={{ fontSize: 11 }}>{r.notes || "—"}</span></TD>
                  <td style={{ padding: "11px 14px" }}>
                    <button onClick={() => setConfirm({ id: r.id, msg: `هل تريد حذف المرتجع "${r.id}"؟` })}
                      style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}>
                      <Ic d={I.trash} s={14} />
                    </button>
                  </td>
                </TRow>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: 48, textAlign: "center", color: C.textMuted }}>
              <div style={{ background: C.purpleDim, padding: 20, borderRadius: "50%", display: "inline-flex", marginBottom: 12 }}>
                <Ic d={I.returns} s={32} c={C.purple} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>لا توجد مرتجعات</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>اضغط "إضافة مرتجع" لتسجيل أول مرتجع</div>
            </div>
          )}
        </div>
      </Card>

      {/* Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 22, padding: 28, width: "min(540px,95vw)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text }}>تسجيل مرتجع جديد</h2>
              <button onClick={() => setShowModal(false)} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer", color: C.textMuted, padding: 6, display: "flex" }}>
                <Ic d={I.close} s={16} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Inp label="التاريخ" type="date" value={form.date} onChange={v => setForm({ ...form, date: v })} />
                <Sel label="نوع المرتجع" value={form.type} onChange={v => setForm({ ...form, type: v, party: "", invoiceRef: "" })}
                  options={[{ value: "sale", label: "↩ مرتجع مبيعات" }, { value: "purchase", label: "↪ مرتجع مشتريات" }]} />
                <Sel label={form.type === "sale" ? "العميل" : "المورد"} value={form.party} onChange={v => setForm({ ...form, party: v })}
                  options={partyList.map(p => ({ value: p.name, label: p.name }))} />
                <Sel label="الفاتورة المرجعية (اختياري)" value={form.invoiceRef} onChange={v => setForm({ ...form, invoiceRef: v })}
                  options={invoiceList.map(i => ({ value: i.id, label: `${i.id} — ${fmt(i.amount)}` }))} />
                <Inp label="المبلغ المرتجع (ج.م)" type="number" value={form.amount} onChange={v => setForm({ ...form, amount: v })} placeholder="0" required />
                <Inp label="سبب الإرجاع" value={form.reason} onChange={v => setForm({ ...form, reason: v })} placeholder="مثال: منتج معيب" />
              </div>
              <Inp label="ملاحظات" value={form.notes} onChange={v => setForm({ ...form, notes: v })} placeholder="أي تفاصيل إضافية..." />

              {/* Preview */}
              {form.amount && (
                <div style={{ background: C.purpleDim, border: `1px solid ${C.purple}33`, borderRadius: 12, padding: "14px 18px" }}>
                  <div style={{ fontSize: 12, color: C.purple, fontWeight: 700, marginBottom: 6 }}>ملخص المرتجع</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: C.textMuted }}>المبلغ المرتجع</span>
                    <span style={{ color: C.purple, fontWeight: 800, fontFamily: "monospace" }}>{fmt(parseFloat(form.amount) || 0)}</span>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <Btn variant="ghost" onClick={() => setShowModal(false)}>إلغاء</Btn>
                <Btn variant="purple" onClick={handleSave}>حفظ المرتجع</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
