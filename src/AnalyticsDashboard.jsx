import { useState, useMemo, useEffect } from "react";
import {
  C, Ic, I, fmt, fmtNum, today, Card, GlowCard, MiniStat, Btn,
  DatePicker, Sel, PageHeader, openPrint, getCompanyBranding,
} from "./shared";

// ══════════════════════════════════════════════════════════════════════════════
// AnalyticsDashboard.jsx — لوحة الإحصائيات (Analytics Dashboard).
//
// الصفحة دي مبنية بالكامل على البيانات اللي بترجع من useAppData (نفس `data`
// اللي بتوصل لكل صفحات النظام)، وده معناه إنها بتتحدث لحظيًا تلقائيًا لأي
// تغيير (إضافة/تعديل/حذف فاتورة، صنف، موظف...إلخ) — لأن useAppData نفسها
// مشتركة في قناة Realtime على جدول records، فمفيش استعلامات إضافية هنا خالص.
//
// ⚠️ ملحوظتين مهمتين بخصوص اكتمال البيانات (لازم تتراجع بعد ما تشوف باقي
// ملفات المشروع اللي مكنتش متاحة لي وقت الكتابة):
//
// 1) "الفواتير الضريبية" (taxinvoices/taxreports) مفيش أي مصدر بيانات ليها
//    وصلني، فقسم الضرائب مش موجود في النسخة دي بدل ما أخترع أرقام غلط.
// 2) "أكثر/أقل المنتجات مبيعًا" و"حركة المخزون" التفصيلية محتاجة بنود
//    (line items) جوه فواتير المبيعات (data.salesInvoices[].items) وسجل
//    حركة مخزون. لو الفواتير عندك فيها مصفوفة items فعلاً، الكارت هيشتغل
//    تلقائي (فيه فحص دفاعي)، ولو لأ هيظهر رسالة واضحة بدل رقم وهمي.
//
// المقبوضات والمصروفات بقت جزء من نفس نظام records المركزي (زي الإنتاج)،
// فكل الأرقام في الصفحة دي — بما فيها الإيرادات والمصروفات — لحظية 100%
// ومشتركة عبر كل الأجهزة، مش محلية على متصفح واحد زي ما كانت قبل كده.
// ══════════════════════════════════════════════════════════════════════════════

// ─── فترات زمنية جاهزة ─────────────────────────────────────────────────────────
const PERIOD_PRESETS = [
  { id: "today", label: "اليوم" },
  { id: "week", label: "الأسبوع" },
  { id: "month", label: "الشهر" },
  { id: "year", label: "السنة" },
  { id: "custom", label: "فترة مخصصة" },
];

const toISODate = (d) => d.toISOString().split("T")[0];

const getPeriodRange = (preset, customFrom, customTo) => {
  const now = new Date();
  if (preset === "today") { const d = toISODate(now); return { from: d, to: d }; }
  if (preset === "week") {
    const d = new Date(now); d.setDate(d.getDate() - 6);
    return { from: toISODate(d), to: toISODate(now) };
  }
  if (preset === "month") {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toISODate(d), to: toISODate(now) };
  }
  if (preset === "year") {
    const d = new Date(now.getFullYear(), 0, 1);
    return { from: toISODate(d), to: toISODate(now) };
  }
  return { from: customFrom || toISODate(now), to: customTo || toISODate(now) };
};

const inRange = (dateStr, from, to) => dateStr && dateStr >= from && dateStr <= to;

// تجميع القيم حسب اليوم (لو المدى صغير) أو حسب الشهر (لو المدى كبير)
const bucketByDate = (items, dateField, from, to, valueFn) => {
  const spanDays = Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1);
  const byMonth = spanDays > 62;
  const key = (d) => byMonth ? d.slice(0, 7) : d;
  const map = new Map();
  items.forEach(it => {
    const d = it[dateField];
    if (!inRange(d, from, to)) return;
    const k = key(d);
    map.set(k, (map.get(k) || 0) + valueFn(it));
  });
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, value]) => ({ label, value }));
};

// ─── رسوم بيانية خفيفة بـ SVG خام (من غير أي مكتبة خارجية) ────────────────────
function BarChart({ data, color = C.accent, height = 180, formatValue = fmtNum }) {
  if (!data || data.length === 0) return <EmptyChart />;
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 90, fontSize: 11, color: C.textMuted, textAlign: "left", flexShrink: 0 }}>{formatValue(d.value)}</div>
          <div style={{ flex: 1, background: C.surface3, borderRadius: 6, overflow: "hidden", height: 16 }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: "100%", background: color, borderRadius: 6, transition: "width 0.3s" }} />
          </div>
          <div style={{ width: 90, fontSize: 11, color: C.textDim, fontWeight: 600, textAlign: "right", flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

function GroupedBarChart({ series, height = 180 }) {
  // series: [{ label, values: [{key,value,color}] }]
  if (!series || series.length === 0) return <EmptyChart />;
  const max = Math.max(1, ...series.flatMap(s => s.values.map(v => v.value)));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height, padding: "0 4px", overflowX: "auto" }}>
      {series.map((s, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 44 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: height - 30 }}>
            {s.values.map((v, j) => (
              <div key={j} title={`${v.key}: ${fmtNum(v.value)}`} style={{ width: 12, height: `${Math.max(2, (v.value / max) * (height - 30))}px`, background: v.color, borderRadius: "3px 3px 0 0" }} />
            ))}
          </div>
          <div style={{ fontSize: 10, color: C.textMuted, whiteSpace: "nowrap" }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function LineChart({ data, color = C.green, height = 160 }) {
  if (!data || data.length < 2) return <EmptyChart small={data && data.length === 1} />;
  const w = 100, h = 100;
  const max = Math.max(...data.map(d => d.value), 0);
  const min = Math.min(...data.map(d => d.value), 0);
  const span = max - min || 1;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d.value - min) / span) * h;
    return `${x},${y}`;
  });
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }}>
        <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => {
          const [x, y] = pts[i].split(",");
          return <circle key={i} cx={x} cy={y} r="1.6" fill={color} vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 10, color: C.textMuted }}>{data[0].label}</span>
        <span style={{ fontSize: 10, color: C.textMuted }}>{data[data.length - 1].label}</span>
      </div>
    </div>
  );
}

function DonutChart({ data, size = 150 }) {
  // data: [{label, value, color}]
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!data || data.length === 0 || total === 0) return <EmptyChart />;
  const r = 40, cx = 50, cy = 50, circumf = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <svg viewBox="0 0 100 100" style={{ width: size, height: size, flexShrink: 0, transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.surface3} strokeWidth="14" />
        {data.map((d, i) => {
          const frac = d.value / total;
          const dash = frac * circumf;
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth="14"
              strokeDasharray={`${dash} ${circumf - dash}`} strokeDashoffset={-offset} />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
            <span style={{ color: C.textDim }}>{d.label}</span>
            <span style={{ color: C.textMuted, fontFamily: "monospace" }}>({fmtNum(d.value)})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyChart({ small }) {
  return (
    <div style={{ padding: small ? 12 : 30, textAlign: "center", color: C.textMuted, fontSize: 12 }}>
      لا توجد بيانات كافية لعرض هذا الرسم في الفترة المختارة
    </div>
  );
}

// ─── الودجت الافتراضية للوحة (كروت + رسوم)، وكل واحدة معاها الصفحة اللي بتفتحها ──
// requiredPage: صفحة لازم تكون ضمن allowed_pages عشان الودجت دي تظهر (null = تظهر دايمًا)
const DEFAULT_ORDER = [
  "total_sales","total_purchases","net_profit","total_revenue","total_expenses",
  "total_debts","total_collected","invoice_count","clients_count","suppliers_count",
  "items_count","employees_count",
  "sales_by_period","purchases_by_period","revenue_vs_expenses","profit_over_time",
  "invoice_status","top_clients","top_suppliers","expense_by_category",
  "inventory_health","top_products","employees_finance",
];

function AnalyticsDashboard({ data, security, allowedPages, setPage }) {
  const ownerId = security?.ownerId || "local";
  const isUnrestricted = !Array.isArray(allowedPages);
  const canSee = (pageId) => !pageId || isUnrestricted || allowedPages.includes(pageId);

  // ── الفلاتر (تُحفظ آخر استخدام) ──
  const filtersKey = `analytics_filters_${ownerId}`;
  const [filters, setFilters] = useState(() => {
    try { return { preset: "month", customFrom: today(), customTo: today(), client: "", supplier: "", ...JSON.parse(localStorage.getItem(filtersKey) || "{}") }; }
    catch { return { preset: "month", customFrom: today(), customTo: today(), client: "", supplier: "" }; }
  });
  useEffect(() => { try { localStorage.setItem(filtersKey, JSON.stringify(filters)); } catch {} }, [filters, filtersKey]);

  // ── تخصيص اللوحة: ترتيب وإظهار/إخفاء الودجت ──
  const layoutKey = `analytics_layout_${ownerId}`;
  const [order, setOrder] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(layoutKey) || "null"); return saved?.order?.length ? saved.order : DEFAULT_ORDER; } catch { return DEFAULT_ORDER; }
  });
  const [hidden, setHidden] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(layoutKey) || "null"); return new Set(saved?.hidden || []); } catch { return new Set(); }
  });
  const [customizing, setCustomizing] = useState(false);
  const [dragId, setDragId] = useState(null);
  useEffect(() => { try { localStorage.setItem(layoutKey, JSON.stringify({ order, hidden: [...hidden] })); } catch {} }, [order, hidden, layoutKey]);

  const toggleHidden = (id) => setHidden(h => { const n = new Set(h); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const resetLayout = () => { setOrder(DEFAULT_ORDER); setHidden(new Set()); };
  const handleDrop = (targetId) => {
    if (!dragId || dragId === targetId) return;
    setOrder(o => {
      const next = o.filter(id => id !== dragId);
      const idx = next.indexOf(targetId);
      next.splice(idx, 0, dragId);
      return next;
    });
    setDragId(null);
  };

  // ── نطاق الفترة الحالي ──
  const { from, to } = useMemo(() => getPeriodRange(filters.preset, filters.customFrom, filters.customTo), [filters.preset, filters.customFrom, filters.customTo]);

  // ── مصادر البيانات ──
  const sales = data?.salesInvoices || [];
  const purchases = data?.purchaseInvoices || [];
  const returns = data?.returns || [];
  const clients = data?.clients || [];
  const suppliers = data?.suppliers || [];
  const inventory = data?.inventory || [];
  const employees = data?.employees || [];
  const salaries = data?.salaries || [];
  const advances = data?.advances || [];
  const receipts = data?.receipts || [];
  const expensesData = data?.expenses || [];

  const salesInRange = useMemo(() =>
    sales.filter(s => inRange(s.date, from, to) && (!filters.client || s.client === filters.client)),
    [sales, from, to, filters.client]);
  const purchasesInRange = useMemo(() =>
    purchases.filter(p => inRange(p.date, from, to) && (!filters.supplier || p.supplier === filters.supplier)),
    [purchases, from, to, filters.supplier]);
  const returnsInRange = useMemo(() => returns.filter(r => inRange(r.date, from, to)), [returns, from, to]);
  const receiptsInRange = useMemo(() => receipts.filter(r => inRange(r.date, from, to)), [receipts, from, to]);
  const expensesInRange = useMemo(() => expensesData.filter(e => inRange(e.date, from, to)), [expensesData, from, to]);

  // ── الحسابات الأساسية ──
  const totalSales = salesInRange.reduce((s, i) => s + (i.amount || 0), 0);
  const totalPurchases = purchasesInRange.reduce((s, i) => s + (i.amount || 0), 0);
  const totalReturns = returnsInRange.reduce((s, r) => s + (r.amount || 0), 0);
  const totalReceipts = receiptsInRange.reduce((s, r) => s + (r.amount || 0), 0);
  const totalExpenses = expensesInRange.reduce((s, e) => s + (e.amount || 0), 0);
  const salesCollected = salesInRange.reduce((s, i) => s + (i.paid || 0), 0);
  const purchasesPaid = purchasesInRange.reduce((s, i) => s + (i.paid || 0), 0);
  const totalRevenue = salesCollected + totalReceipts;
  const netProfit = totalSales - totalPurchases - totalReturns - totalExpenses;
  const debtsFromClients = salesInRange.reduce((s, i) => s + Math.max(0, (i.amount || 0) - (i.paid || 0)), 0);
  const debtsToSuppliers = purchasesInRange.reduce((s, i) => s + Math.max(0, (i.amount || 0) - (i.paid || 0)), 0);
  const totalDebts = debtsFromClients + debtsToSuppliers;
  const totalCollected = salesCollected + purchasesPaid + totalReceipts;
  const invoiceCount = salesInRange.length + purchasesInRange.length;

  const inventoryValue = inventory.reduce((s, i) => s + (i.qty || 0) * (i.cost || 0), 0);
  const lowStock = inventory.filter(p => (p.qty || 0) > 0 && p.qty <= (p.minQty || 0));
  const outOfStock = inventory.filter(p => (p.qty || 0) <= 0);

  const totalSalaries = salaries.filter(s => inRange(s.date || s.month + "-01", from, to) || !s.date).reduce((s, x) => s + (x.amount ?? x.netSalary ?? x.total ?? 0), 0);
  const totalAdvances = advances.filter(a => inRange(a.date, from, to)).reduce((s, x) => s + (x.amount || 0), 0);
  const totalDeductions = salaries.reduce((s, x) => s + (x.deduction ?? x.deductions ?? 0), 0);

  // ── فرز حسب العميل/المورد (للجدول والرسم) ──
  const byClient = useMemo(() => {
    const map = new Map();
    salesInRange.forEach(s => map.set(s.client, (map.get(s.client) || 0) + (s.amount || 0)));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));
  }, [salesInRange]);

  const bySupplier = useMemo(() => {
    const map = new Map();
    purchasesInRange.forEach(p => map.set(p.supplier || p.supplierName, (map.get(p.supplier || p.supplierName) || 0) + (p.amount || 0)));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));
  }, [purchasesInRange]);

  const invoiceStatusData = useMemo(() => {
    let paid = 0, partial = 0, unpaid = 0;
    salesInRange.forEach(s => {
      if ((s.paid || 0) >= (s.amount || 0) && (s.amount || 0) > 0) paid++;
      else if ((s.paid || 0) > 0) partial++;
      else unpaid++;
    });
    return [
      { label: "مدفوعة بالكامل", value: paid, color: C.green },
      { label: "مدفوعة جزئيًا", value: partial, color: C.yellow },
      { label: "غير مدفوعة", value: unpaid, color: C.red },
    ].filter(d => d.value > 0);
  }, [salesInRange]);

  // أكثر/أقل المنتجات مبيعًا — يعتمد على وجود بند items داخل فاتورة البيع
  const productSales = useMemo(() => {
    const map = new Map();
    let hasItems = false;
    salesInRange.forEach(inv => {
      if (Array.isArray(inv.items)) {
        hasItems = true;
        inv.items.forEach(it => {
          const name = it.name || it.productName || "—";
          map.set(name, (map.get(name) || 0) + (parseFloat(it.qty) || 0));
        });
      }
    });
    if (!hasItems) return null; // مفيش بيانات تفصيلية بالأصناف داخل الفواتير
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  }, [salesInRange]);

  const revenueVsExpensesSeries = useMemo(() => {
    const revBuckets = bucketByDate(salesInRange, "date", from, to, s => s.paid || 0);
    const expBuckets = bucketByDate(expensesInRange, "date", from, to, e => e.amount || 0);
    const labels = [...new Set([...revBuckets.map(b => b.label), ...expBuckets.map(b => b.label)])].sort();
    return labels.map(label => ({
      label,
      values: [
        { key: "إيرادات", value: revBuckets.find(b => b.label === label)?.value || 0, color: C.green },
        { key: "مصروفات", value: expBuckets.find(b => b.label === label)?.value || 0, color: C.red },
      ],
    }));
  }, [salesInRange, expensesInRange, from, to]);

  const profitOverTime = useMemo(() => {
    const salesBuckets = bucketByDate(salesInRange, "date", from, to, s => s.amount || 0);
    const purchaseBuckets = bucketByDate(purchasesInRange, "date", from, to, p => p.amount || 0);
    const labels = [...new Set([...salesBuckets.map(b => b.label), ...purchaseBuckets.map(b => b.label)])].sort();
    return labels.map(label => ({
      label,
      value: (salesBuckets.find(b => b.label === label)?.value || 0) - (purchaseBuckets.find(b => b.label === label)?.value || 0),
    }));
  }, [salesInRange, purchasesInRange, from, to]);

  const expenseByCategory = useMemo(() => {
    const palette = [C.accent, C.green, C.yellow, C.red, C.purple, C.cyan];
    const map = new Map();
    expensesInRange.forEach(e => map.set(e.category || "أخرى", (map.get(e.category || "أخرى") || 0) + (e.amount || 0)));
    return [...map.entries()].map(([label, value], i) => ({ label, value, color: palette[i % palette.length] }));
  }, [expensesInRange]);

  // ── الكروت والرسوم — id ثابت لكل ودجت + تعريفها بالكامل (label/value/render/permission) ──
  const goto = (pageId) => { if (setPage && pageId) setPage(pageId); };

  const widgets = {
    total_sales: { requiredPage: "sales", size: 1, render: () => (
      <ClickableStat label="إجمالي المبيعات" value={fmt(totalSales)} color={C.green} icon={I.sales} onClick={() => goto("sales")} />) },
    total_purchases: { requiredPage: "purchases", size: 1, render: () => (
      <ClickableStat label="إجمالي المشتريات" value={fmt(totalPurchases)} color={C.red} icon={I.purchase} onClick={() => goto("purchases")} />) },
    net_profit: { requiredPage: "reports", size: 1, render: () => (
      <ClickableStat label="صافي الربح" value={fmt(netProfit)} color={netProfit >= 0 ? C.green : C.red} icon={I.chartBar} onClick={() => goto("reports")} />) },
    total_revenue: { requiredPage: null, size: 1, render: () => (
      <ClickableStat label="إجمالي الإيرادات" value={fmt(totalRevenue)} color={C.accent} icon={I.revenue} onClick={() => goto("receipts")} sub="محصّل من المبيعات + المقبوضات" />) },
    total_expenses: { requiredPage: "expenses", size: 1, render: () => (
      <ClickableStat label="إجمالي المصروفات" value={fmt(totalExpenses)} color={C.red} icon={I.money} onClick={() => goto("expenses")} />) },
    total_debts: { requiredPage: null, size: 1, render: () => (
      <ClickableStat label="إجمالي الديون المستحقة" value={fmt(totalDebts)} color={C.yellow} icon={I.alert} onClick={() => goto("clients")} sub="عملاء + موردين" />) },
    total_collected: { requiredPage: null, size: 1, render: () => (
      <ClickableStat label="إجمالي المبالغ المحصلة" value={fmt(totalCollected)} color={C.green} icon={I.money} onClick={() => goto("receipts")} />) },
    invoice_count: { requiredPage: null, size: 1, render: () => (
      <ClickableStat label="عدد الفواتير" value={fmtNum(invoiceCount)} color={C.blue} icon={I.report} onClick={() => goto("sales")} />) },
    clients_count: { requiredPage: "clients", size: 1, render: () => (
      <ClickableStat label="عدد العملاء" value={fmtNum(clients.length)} color={C.accent} icon={I.clients} onClick={() => goto("clients")} />) },
    suppliers_count: { requiredPage: "suppliers", size: 1, render: () => (
      <ClickableStat label="عدد الموردين" value={fmtNum(suppliers.length)} color={C.yellow} icon={I.suppliers} onClick={() => goto("suppliers")} />) },
    items_count: { requiredPage: "inventoryitems", size: 1, render: () => (
      <ClickableStat label="عدد الأصناف" value={fmtNum(inventory.length)} color={C.purple} icon={I.box} onClick={() => goto("inventoryitems")} />) },
    employees_count: { requiredPage: "employees", size: 1, render: () => (
      <ClickableStat label="عدد الموظفين" value={fmtNum(employees.length)} color={C.cyan} icon={I.people} onClick={() => goto("employees")} />) },

    sales_by_period: { requiredPage: "sales", size: 2, title: "المبيعات خلال الفترة", render: () => <BarChart data={bucketByDate(salesInRange, "date", from, to, s => s.amount || 0)} color={C.green} /> },
    purchases_by_period: { requiredPage: "purchases", size: 2, title: "المشتريات خلال الفترة", render: () => <BarChart data={bucketByDate(purchasesInRange, "date", from, to, p => p.amount || 0)} color={C.red} /> },
    revenue_vs_expenses: { requiredPage: null, size: 2, title: "الإيرادات مقابل المصروفات", render: () => <GroupedBarChart series={revenueVsExpensesSeries} /> },
    profit_over_time: { requiredPage: "reports", size: 2, title: "الأرباح بمرور الوقت", render: () => <LineChart data={profitOverTime} color={C.accent} /> },
    invoice_status: { requiredPage: "sales", size: 1, title: "حالة فواتير المبيعات", render: () => <DonutChart data={invoiceStatusData} /> },
    top_clients: { requiredPage: "clients", size: 1, title: "العملاء الأكثر شراءً", render: () => <BarChart data={byClient} color={C.accent} /> },
    top_suppliers: { requiredPage: "suppliers", size: 1, title: "الموردون الأكثر تعاملًا", render: () => <BarChart data={bySupplier} color={C.yellow} /> },
    expense_by_category: { requiredPage: "expenses", size: 1, title: "توزيع المصروفات حسب الفئة", render: () => <DonutChart data={expenseByCategory} /> },
    inventory_health: { requiredPage: "inventory", size: 2, title: "حالة المخزون", render: () => (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        <MiniStat label="قيمة المخزون" value={fmt(inventoryValue)} color={C.accent} icon={I.stock} />
        <ClickableMiniStat label="منخفض المخزون" value={fmtNum(lowStock.length)} color={C.yellow} icon={I.alert} onClick={() => goto("inventoryitems")} />
        <ClickableMiniStat label="نافد من المخزون" value={fmtNum(outOfStock.length)} color={C.red} icon={I.alert} onClick={() => goto("inventoryitems")} />
      </div>
    ) },
    top_products: { requiredPage: "inventoryitems", size: 1, title: "الأكثر مبيعًا (بالكمية)", render: () => productSales ? <BarChart data={productSales.slice(0, 6)} color={C.purple} formatValue={fmtNum} /> : (
      <div style={{ padding: 16, fontSize: 12, color: C.textMuted, textAlign: "center", background: C.surface2, borderRadius: 10 }}>
        فواتير المبيعات مفيهاش تفاصيل أصناف (items) حاليًا، فمينفعش نحسب المنتج الأكثر مبيعًا. لو الفواتير بتتسجل ببنود تفصيلية هيشتغل تلقائي.
      </div>
    ) },
    employees_finance: { requiredPage: "employees", size: 2, title: "الموظفين", render: () => (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        <MiniStat label="إجمالي المرتبات" value={fmt(totalSalaries)} color={C.blue} icon={I.money} />
        <MiniStat label="إجمالي السلف" value={fmt(totalAdvances)} color={C.yellow} icon={I.money} />
        <MiniStat label="إجمالي الخصومات" value={fmt(totalDeductions)} color={C.red} icon={I.alert} />
      </div>
    ) },
  };

  const visibleOrder = order.filter(id => widgets[id] && canSee(widgets[id].requiredPage) && !hidden.has(id));
  const kpiIds = visibleOrder.filter(id => !widgets[id].title);
  const chartIds = visibleOrder.filter(id => widgets[id].title);

  // ── طباعة / تصدير Excel لملخص اللوحة ──
  const printSummary = () => {
    const { name: companyName, logo } = getCompanyBranding();
    const logoHtml = logo ? `<img src="${logo}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;margin-left:10px" />` : "";
    const rows = [
      ["إجمالي المبيعات", fmt(totalSales)], ["إجمالي المشتريات", fmt(totalPurchases)],
      ["صافي الربح", fmt(netProfit)], ["إجمالي الإيرادات", fmt(totalRevenue)],
      ["إجمالي المصروفات", fmt(totalExpenses)], ["إجمالي الديون المستحقة", fmt(totalDebts)],
      ["إجمالي المبالغ المحصلة", fmt(totalCollected)], ["عدد الفواتير", fmtNum(invoiceCount)],
      ["عدد العملاء", fmtNum(clients.length)], ["عدد الموردين", fmtNum(suppliers.length)],
      ["عدد الأصناف", fmtNum(inventory.length)], ["عدد الموظفين", fmtNum(employees.length)],
    ];
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>ملخص لوحة الإحصائيات</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo','Segoe UI',sans-serif;background:#fff;color:#1a1a2e;padding:40px}
    .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:26px;padding-bottom:18px;border-bottom:3px solid #6c7fff}
    table{width:100%;border-collapse:collapse;font-size:13px}thead tr{background:#6c7fff;color:#fff}
    thead th{padding:9px 12px;font-weight:700;text-align:right}tbody tr:nth-child(even){background:#f8faff}
    tbody td{padding:9px 12px;border-bottom:1px solid #e2e8f0}
    .footer{margin-top:24px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px}
    @media print{body{padding:20px}}</style></head><body>
    <div class="header"><div style="display:flex;align-items:center">${logoHtml}<div style="font-size:20px;font-weight:800">ملخص لوحة الإحصائيات — ${companyName}</div></div>
    <div style="font-size:12px;color:#64748b">${from} → ${to}</div></div>
    <table><thead><tr><th>المؤشر</th><th>القيمة</th></tr></thead><tbody>
    ${rows.map(([l, v]) => `<tr><td>${l}</td><td>${v}</td></tr>`).join("")}
    </tbody></table>
    <div class="footer">${companyName} — hesapy.pro</div></body></html>`;
    openPrint(html);
  };

  const exportCSV = () => {
    const rows = [
      ["المؤشر", "القيمة"],
      ["الفترة", `${from} إلى ${to}`],
      ["إجمالي المبيعات", totalSales], ["إجمالي المشتريات", totalPurchases],
      ["صافي الربح", netProfit], ["إجمالي الإيرادات", totalRevenue],
      ["إجمالي المصروفات", totalExpenses], ["إجمالي الديون المستحقة", totalDebts],
      ["إجمالي المبالغ المحصلة", totalCollected], ["عدد الفواتير", invoiceCount],
      ["عدد العملاء", clients.length], ["عدد الموردين", suppliers.length],
      ["عدد الأصناف", inventory.length], ["عدد الموظفين", employees.length],
    ].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ملخص_لوحة_الإحصائيات.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader title="لوحة الإحصائيات" icon={I.chartBar} subtitle={`${from} → ${to}`}
        action={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn variant="ghost" small onClick={printSummary}><Ic d={I.print} s={13} />طباعة</Btn>
            <Btn variant="ghost" small onClick={exportCSV}><Ic d={I.excel} s={13} />Excel</Btn>
            <Btn variant={customizing ? "success" : "ghost"} small onClick={() => setCustomizing(c => !c)}>
              <Ic d={I.settings} s={13} />{customizing ? "تم" : "تخصيص اللوحة"}
            </Btn>
          </div>
        } />

      {/* ── الفلاتر ── */}
      <Card>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, marginBottom: 6 }}>الفترة</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PERIOD_PRESETS.map(p => (
                <button key={p.id} onClick={() => setFilters(f => ({ ...f, preset: p.id }))}
                  style={{ padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    border: `1px solid ${filters.preset === p.id ? C.accent : C.border}`,
                    background: filters.preset === p.id ? C.accentDim : "transparent",
                    color: filters.preset === p.id ? C.accent : C.textDim }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {filters.preset === "custom" && (
            <>
              <DatePicker label="من" value={filters.customFrom} onChange={v => setFilters(f => ({ ...f, customFrom: v }))} />
              <DatePicker label="إلى" value={filters.customTo} onChange={v => setFilters(f => ({ ...f, customTo: v }))} />
            </>
          )}
          {clients.length > 0 && (
            <div style={{ width: 180 }}>
              <Sel label="العميل" value={filters.client} onChange={v => setFilters(f => ({ ...f, client: v }))}
                options={clients.map(c => ({ value: c.name, label: c.name }))} placeholder="كل العملاء" />
            </div>
          )}
          {suppliers.length > 0 && (
            <div style={{ width: 180 }}>
              <Sel label="المورد" value={filters.supplier} onChange={v => setFilters(f => ({ ...f, supplier: v }))}
                options={suppliers.map(s => ({ value: s.name, label: s.name }))} placeholder="كل الموردين" />
            </div>
          )}
        </div>
      </Card>

      {customizing && (
        <Card style={{ background: C.accentDim, border: `1px solid ${C.accent}33` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: C.text, fontWeight: 700 }}>اختر البطاقات والرسوم اللي تظهر، واسحب أي عنصر من الشبكة تحت لترتيبه</div>
            <Btn variant="ghost" small onClick={resetLayout}>استعادة الترتيب الافتراضي</Btn>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {DEFAULT_ORDER.filter(id => canSee(widgets[id]?.requiredPage)).map(id => (
              <label key={id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>
                <input type="checkbox" checked={!hidden.has(id)} onChange={() => toggleHidden(id)} />
                {widgets[id]?.title || WIDGET_LABELS[id] || id}
              </label>
            ))}
          </div>
        </Card>
      )}

      {/* ── الكروت الإحصائية ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
        {kpiIds.map(id => (
          <div key={id} draggable={customizing} onDragStart={() => setDragId(id)}
            onDragOver={e => customizing && e.preventDefault()} onDrop={() => customizing && handleDrop(id)}
            style={{ cursor: customizing ? "grab" : "default", outline: customizing ? `1px dashed ${C.border}` : "none", borderRadius: 14 }}>
            {widgets[id].render()}
          </div>
        ))}
        {kpiIds.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", color: C.textMuted, fontSize: 13, padding: 20 }}>مفيش بطاقات ظاهرة — فعّل بعضها من "تخصيص اللوحة"</div>}
      </div>

      {/* ── الرسوم البيانية ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {chartIds.map(id => (
          <div key={id} draggable={customizing} onDragStart={() => setDragId(id)}
            onDragOver={e => customizing && e.preventDefault()} onDrop={() => customizing && handleDrop(id)}
            style={{ gridColumn: widgets[id].size === 2 ? "span 2" : "span 1", cursor: customizing ? "grab" : "default" }}>
            <Card style={{ outline: customizing ? `1px dashed ${C.border}` : "none" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>{widgets[id].title}</div>
              {widgets[id].render()}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}

const WIDGET_LABELS = {
  total_sales: "إجمالي المبيعات", total_purchases: "إجمالي المشتريات", net_profit: "صافي الربح",
  total_revenue: "إجمالي الإيرادات", total_expenses: "إجمالي المصروفات", total_debts: "إجمالي الديون",
  total_collected: "إجمالي المحصّل", invoice_count: "عدد الفواتير", clients_count: "عدد العملاء",
  suppliers_count: "عدد الموردين", items_count: "عدد الأصناف", employees_count: "عدد الموظفين",
};

function ClickableStat({ label, value, color, icon, onClick, sub }) {
  return (
    <GlowCard color={color} style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12, cursor: onClick ? "pointer" : "default", transition: "transform 0.15s" }}
      onClick={onClick}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>{label}</span>
        <div style={{ background: color + "18", padding: 8, borderRadius: 10 }}><Ic d={icon} s={15} c={color} /></div>
      </div>
      <div style={{ fontSize: 21, fontWeight: 800, color, fontFamily: "monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.textMuted }}>{sub}</div>}
    </GlowCard>
  );
}

function ClickableMiniStat({ label, value, color, icon, onClick }) {
  return (
    <div onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <MiniStat label={label} value={value} color={color} icon={icon} />
    </div>
  );
}

export default AnalyticsDashboard;
