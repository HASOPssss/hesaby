import { useState, useEffect } from "react";
import {
  C, Ic, I, fmt, fmtDateTime, today, getMonth, openPrint, getCompanyBranding,
  usePasscodeGate, Badge, Card, MiniStat, Btn, DatePicker, THead, TRow, TD,
  PageHeader, ProgressBar,
} from "./shared";

// ══════════════════════════════════════════════════════════════════════════════
// UnifiedReportsPage.jsx — التقارير المالية الموحدة (يومي / شهري / أرشيف)
// وقوالب طباعة التقارير اليومية والشهرية.
// ══════════════════════════════════════════════════════════════════════════════

// ─── UNIFIED REPORTS PAGE (يومي + شهري مدمج + أرشيف شهري) ─────────────────────
function generateDayReportHTML(dayData, date) {
  const { name: companyName } = getCompanyBranding();
  const { sales, purchases, returns, expenses } = dayData;
  const totalSales = sales.reduce((s,i)=>s+i.amount,0);
  const totalPurchases = purchases.reduce((s,i)=>s+i.amount,0);
  const totalReturns = returns.reduce((s,i)=>s+i.amount,0);
  const totalExpenses = expenses.reduce((s,e)=>s+e.amount,0);
  const netProfit = totalSales - totalPurchases - totalReturns - totalExpenses;
  const paid = sales.reduce((s,i)=>s+i.paid,0);
  const unpaid = totalSales - paid;
  const dateLabel = new Date(date+"T00:00:00").toLocaleDateString("ar-EG",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  const printDateTime = new Date().toLocaleString("ar-EG",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تقرير يوم ${date}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo','Segoe UI',sans-serif;background:#fff;color:#1a1a2e;padding:36px 40px}
  .header{text-align:center;padding-bottom:18px;border-bottom:3px solid #6c7fff;margin-bottom:24px}
  .logo{font-size:26px;font-weight:900;color:#6c7fff}.sub{font-size:13px;color:#64748b;margin-top:4px}
  .stamp{background:#f0f4ff;border:1px solid #c7d2fe;border-radius:8px;padding:6px 18px;display:inline-block;margin-top:10px;font-size:12px;color:#4f46e5;font-weight:700}
  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
  .stat{border-radius:10px;padding:14px 16px;border:1px solid #e2e8f0;text-align:center}
  .stat-v{font-size:17px;font-weight:800;font-family:monospace}.stat-l{font-size:10px;color:#64748b;margin-top:3px}
  .sec{font-size:14px;font-weight:800;margin:20px 0 10px;color:#1e293b;border-right:4px solid #6c7fff;padding-right:10px}
  table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px}
  thead tr{background:#6c7fff;color:#fff}thead th{padding:8px 10px;font-weight:700;text-align:right}
  tbody tr:nth-child(even){background:#f8faff}tbody td{padding:8px 10px;border-bottom:1px solid #e2e8f0}
  .footer{margin-top:28px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px}
  .locked{background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:8px 14px;font-size:11px;color:#92400e;margin-top:10px;text-align:center}
  @media print{body{padding:16px}}</style></head><body>
  <div class="header">
    <div class="logo">${companyName}</div>
    <div class="sub">تقرير يومي مُغلق</div>
    <div class="stamp">📅 ${dateLabel}</div>
    <div class="locked">🔒 تم إغلاق هذا التقرير بتاريخ ${printDateTime} — غير قابل للتعديل</div>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-v" style="color:#34d399">${totalSales.toLocaleString("ar-EG")} ج.م</div><div class="stat-l">إجمالي المبيعات</div></div>
    <div class="stat"><div class="stat-v" style="color:#f87171">${totalPurchases.toLocaleString("ar-EG")} ج.م</div><div class="stat-l">إجمالي المشتريات</div></div>
    <div class="stat"><div class="stat-v" style="color:${netProfit>=0?"#34d399":"#f87171"}">${netProfit.toLocaleString("ar-EG")} ج.م</div><div class="stat-l">صافي الربح</div></div>
    <div class="stat"><div class="stat-v" style="color:#6c7fff">${paid.toLocaleString("ar-EG")} ج.م</div><div class="stat-l">المحصّل</div></div>
    <div class="stat"><div class="stat-v" style="color:#f59e0b">${unpaid.toLocaleString("ar-EG")} ج.م</div><div class="stat-l">غير محصّل</div></div>
    <div class="stat"><div class="stat-v" style="color:#a78bfa">${totalReturns.toLocaleString("ar-EG")} ج.م</div><div class="stat-l">المرتجعات</div></div>
  </div>
  ${sales.length>0?`<div class="sec">فواتير المبيعات (${sales.length})</div>
  <table><thead><tr><th>#</th><th>الوقت</th><th>العميل</th><th>الأصناف</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>طريقة الدفع</th><th>الحالة</th></tr></thead><tbody>
  ${sales.map(i=>`<tr><td>${i.id}</td><td>${fmtDateTime(i.createdAt||i.date)}</td><td>${i.client||"—"}</td><td style="font-size:10px">${(i.items||[]).map(x=>x.name).join("، ")||"—"}</td><td>${i.amount.toLocaleString("ar-EG")} ج.م</td><td>${i.paid.toLocaleString("ar-EG")} ج.م</td><td>${(i.amount-i.paid).toLocaleString("ar-EG")} ج.م</td><td>${i.paymentMethod||"نقدي"}</td><td>${i.status}</td></tr>`).join("")}
  </tbody></table>`:""}
  ${purchases.length>0?`<div class="sec">فواتير المشتريات (${purchases.length})</div>
  <table><thead><tr><th>#</th><th>الوقت</th><th>المورد</th><th>الإجمالي</th><th>المدفوع</th><th>طريقة الدفع</th><th>الحالة</th></tr></thead><tbody>
  ${purchases.map(i=>`<tr><td>${i.id}</td><td>${fmtDateTime(i.createdAt||i.date)}</td><td>${i.supplier||"—"}</td><td>${i.amount.toLocaleString("ar-EG")} ج.م</td><td>${i.paid.toLocaleString("ar-EG")} ج.م</td><td>${i.paymentMethod||"نقدي"}</td><td>${i.status}</td></tr>`).join("")}
  </tbody></table>`:""}
  ${returns.length>0?`<div class="sec">المرتجعات (${returns.length})</div>
  <table><thead><tr><th>#</th><th>الوقت</th><th>الطرف</th><th>المبلغ</th><th>السبب</th></tr></thead><tbody>
  ${returns.map(r=>`<tr><td>${r.id}</td><td>${fmtDateTime(r.createdAt||r.date)}</td><td>${r.party||"—"}</td><td>${r.amount.toLocaleString("ar-EG")} ج.م</td><td>${r.reason||"—"}</td></tr>`).join("")}
  </tbody></table>`:""}
  ${expenses.length>0?`<div class="sec">المصروفات (${expenses.length})</div>
  <table><thead><tr><th>#</th><th>الوقت</th><th>الوصف</th><th>الفئة</th><th>المبلغ</th><th>طريقة الدفع</th></tr></thead><tbody>
  ${expenses.map(e=>`<tr><td>${e.id}</td><td>${fmtDateTime(e.createdAt||e.date)}</td><td>${e.description||"—"}</td><td>${e.category||"—"}</td><td>${e.amount.toLocaleString("ar-EG")} ج.م</td><td>${e.paymentMethod||"نقدي"}</td></tr>`).join("")}
  </tbody></table>`:""}
  <div class="footer">${companyName} — تقرير يومي — طُبع: ${printDateTime} — hesapy.pro</div>
  </body></html>`;
}

function generateMonthReportHTML(monthData, month, data) {
  const { name: companyName } = getCompanyBranding();
  const { sales, purchases, returns, expenses } = monthData;
  const totalSales = sales.reduce((s,i)=>s+i.amount,0);
  const totalPurchases = purchases.reduce((s,i)=>s+i.amount,0);
  const totalReturns = returns.reduce((s,r)=>s+r.amount,0);
  const totalExpenses = expenses.reduce((s,e)=>s+e.amount,0);
  const totalTax = sales.reduce((s,i)=>s+(i.taxAmount||0),0);
  const netProfit = totalSales - totalPurchases - totalReturns - totalExpenses;
  const catSales = {};
  sales.forEach(inv=>{ (inv.items||[]).forEach(it=>{ const c=it.category||"غير محدد"; catSales[c]=(catSales[c]||0)+it.qty*it.price; }); });
  const [y,m] = month.split("-");
  const monthLabel = new Date(+y, +m-1, 1).toLocaleDateString("ar-EG",{month:"long",year:"numeric"});
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تقرير شهر ${month}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo','Segoe UI',sans-serif;background:#fff;color:#1a1a2e;padding:36px 40px}
  .header{text-align:center;padding-bottom:18px;border-bottom:3px solid #6c7fff;margin-bottom:24px}
  .logo{font-size:26px;font-weight:900;color:#6c7fff}.sub{font-size:13px;color:#64748b;margin-top:4px}
  .stamp{background:#f0f4ff;border:1px solid #c7d2fe;border-radius:8px;padding:6px 18px;display:inline-block;margin-top:10px;font-size:12px;color:#4f46e5;font-weight:700}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
  .stat{border-radius:10px;padding:14px 16px;border:1px solid #e2e8f0;text-align:center}
  .stat-v{font-size:17px;font-weight:800;font-family:monospace}.stat-l{font-size:10px;color:#64748b;margin-top:3px}
  .sec{font-size:14px;font-weight:800;margin:20px 0 10px;color:#1e293b;border-right:4px solid #6c7fff;padding-right:10px}
  table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px}
  thead tr{background:#6c7fff;color:#fff}thead th{padding:8px 10px;font-weight:700;text-align:right}
  tbody tr:nth-child(even){background:#f8faff}tbody td{padding:8px 10px;border-bottom:1px solid #e2e8f0}
  .locked{background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:8px 14px;font-size:11px;color:#92400e;margin-top:10px;text-align:center}
  .footer{margin-top:28px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px}
  @media print{body{padding:16px}}</style></head><body>
  <div class="header">
    <div class="logo">${companyName}</div><div class="sub">تقرير شهري مُغلق</div>
    <div class="stamp">📅 ${monthLabel}</div>
    <div class="locked">🔒 تم إغلاق هذا التقرير تلقائياً في بداية الشهر — غير قابل للتعديل</div>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-v" style="color:#34d399">${totalSales.toLocaleString("ar-EG")} ج.م</div><div class="stat-l">المبيعات</div></div>
    <div class="stat"><div class="stat-v" style="color:#f87171">${totalPurchases.toLocaleString("ar-EG")} ج.م</div><div class="stat-l">المشتريات</div></div>
    <div class="stat"><div class="stat-v" style="color:${netProfit>=0?"#34d399":"#f87171"}">${netProfit.toLocaleString("ar-EG")} ج.م</div><div class="stat-l">صافي الربح</div></div>
    <div class="stat"><div class="stat-v" style="color:#f59e0b">${totalTax.toLocaleString("ar-EG")} ج.م</div><div class="stat-l">إجمالي الضرائب</div></div>
    <div class="stat"><div class="stat-v" style="color:#a78bfa">${totalReturns.toLocaleString("ar-EG")} ج.م</div><div class="stat-l">المرتجعات</div></div>
    <div class="stat"><div class="stat-v" style="color:#f87171">${totalExpenses.toLocaleString("ar-EG")} ج.م</div><div class="stat-l">المصروفات</div></div>
    <div class="stat"><div class="stat-v" style="color:#6c7fff">${sales.length}</div><div class="stat-l">فواتير مبيعات</div></div>
    <div class="stat"><div class="stat-v" style="color:#60a5fa">${purchases.length}</div><div class="stat-l">فواتير مشتريات</div></div>
  </div>
  ${Object.keys(catSales).length>0?`<div class="sec">المبيعات حسب الفئة</div>
  <table><thead><tr><th>الفئة</th><th>القيمة</th></tr></thead><tbody>
  ${Object.entries(catSales).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`<tr><td>${c}</td><td>${v.toLocaleString("ar-EG")} ج.م</td></tr>`).join("")}
  </tbody></table>`:""}
  <div class="sec">كافة فواتير المبيعات (${sales.length})</div>
  <table><thead><tr><th>#</th><th>التاريخ والوقت</th><th>العميل</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>طريقة الدفع</th><th>الحالة</th></tr></thead><tbody>
  ${sales.map(i=>`<tr><td>${i.id}</td><td>${fmtDateTime(i.createdAt||i.date)}</td><td>${i.client||"—"}</td><td>${i.amount.toLocaleString("ar-EG")} ج.م</td><td>${i.paid.toLocaleString("ar-EG")} ج.م</td><td>${(i.amount-i.paid).toLocaleString("ar-EG")} ج.م</td><td>${i.paymentMethod||"نقدي"}</td><td>${i.status}</td></tr>`).join("")}
  </tbody></table>
  <div class="sec">كافة فواتير المشتريات (${purchases.length})</div>
  <table><thead><tr><th>#</th><th>التاريخ والوقت</th><th>المورد</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th></tr></thead><tbody>
  ${purchases.map(i=>`<tr><td>${i.id}</td><td>${fmtDateTime(i.createdAt||i.date)}</td><td>${i.supplier||"—"}</td><td>${i.amount.toLocaleString("ar-EG")} ج.م</td><td>${i.paid.toLocaleString("ar-EG")} ج.م</td><td>${(i.amount-i.paid).toLocaleString("ar-EG")} ج.م</td><td>${i.status}</td></tr>`).join("")}
  </tbody></table>
  ${returns.length>0?`<div class="sec">المرتجعات (${returns.length})</div>
  <table><thead><tr><th>#</th><th>التاريخ والوقت</th><th>الطرف</th><th>المبلغ</th><th>السبب</th></tr></thead><tbody>
  ${returns.map(r=>`<tr><td>${r.id}</td><td>${fmtDateTime(r.createdAt||r.date)}</td><td>${r.party||"—"}</td><td>${r.amount.toLocaleString("ar-EG")} ج.م</td><td>${r.reason||"—"}</td></tr>`).join("")}
  </tbody></table>`:""}
  ${expenses.length>0?`<div class="sec">المصروفات (${expenses.length})</div>
  <table><thead><tr><th>#</th><th>التاريخ والوقت</th><th>الوصف</th><th>الفئة</th><th>المبلغ</th></tr></thead><tbody>
  ${expenses.map(e=>`<tr><td>${e.id}</td><td>${fmtDateTime(e.createdAt||e.date)}</td><td>${e.description||"—"}</td><td>${e.category||"—"}</td><td>${e.amount.toLocaleString("ar-EG")} ج.م</td></tr>`).join("")}
  </tbody></table>`:""}
  <div class="footer">${companyName} — تقرير شهري — أُنشئ بتاريخ ${new Date().toLocaleString("ar-EG")} — hesapy.pro</div>
  </body></html>`;
}

function UnifiedReportsPage({ data, userEmail, security, pageId }) {
  const [viewMode, setViewMode] = useState("daily"); // daily | monthly | archive
  const [selectedDate, setSelectedDate] = useState(today());
  const [selectedMonth, setSelectedMonth] = useState(today().slice(0,7));
  const { requestPasscode, PasscodeGate, log } = usePasscodeGate(security);
  const [confirmClose, setConfirmClose] = useState(false);

  // Archived daily reports stored in localStorage
  const [dailyArchive, setDailyArchive] = useState(() => {
    try { return JSON.parse(localStorage.getItem("daily_reports_archive")||"[]"); } catch { return []; }
  });
  const [monthlyArchive, setMonthlyArchive] = useState(() => {
    try { return JSON.parse(localStorage.getItem("monthly_reports_archive")||"[]"); } catch { return []; }
  });

  // Expenses from localStorage
  const expenses = (() => { try { return JSON.parse(localStorage.getItem("expenses_local")||"[]"); } catch { return []; } })();

  // Auto-close month at midnight on 1st of each month
  useEffect(() => {
    const checkAutoClose = () => {
      const now = new Date();
      if (now.getDate() === 1 && now.getHours() === 0 && now.getMinutes() === 0) {
        const prevMonth = new Date(now.getFullYear(), now.getMonth()-1, 1);
        const m = prevMonth.toISOString().slice(0,7);
        if (!monthlyArchive.find(r=>r.month===m)) {
          autoCloseMonth(m);
        }
      }
    };
    const interval = setInterval(checkAutoClose, 60000);
    checkAutoClose();
    return () => clearInterval(interval);
  }, [monthlyArchive]);

  const autoCloseMonth = (month) => {
    const sales = data.salesInvoices.filter(i=>getMonth(i.date)===month);
    const purchases = data.purchaseInvoices.filter(i=>getMonth(i.date)===month);
    const returns = data.returns.filter(r=>getMonth(r.date)===month);
    const expMonthly = expenses.filter(e=>e.date?.startsWith(month));
    const report = {
      month, closedAt: new Date().toISOString(), auto: true,
      totalSales: sales.reduce((s,i)=>s+i.amount,0),
      totalPurchases: purchases.reduce((s,i)=>s+i.amount,0),
      totalReturns: returns.reduce((s,r)=>s+r.amount,0),
      totalExpenses: expMonthly.reduce((s,e)=>s+e.amount,0),
      totalTax: sales.reduce((s,i)=>s+(i.taxAmount||0),0),
      salesCount: sales.length, purchasesCount: purchases.length,
      htmlContent: generateMonthReportHTML({sales,purchases,returns,expenses:expMonthly}, month, data),
    };
    report.netProfit = report.totalSales - report.totalPurchases - report.totalReturns - report.totalExpenses;
    const updated = [...monthlyArchive.filter(r=>r.month!==month), report];
    setMonthlyArchive(updated);
    localStorage.setItem("monthly_reports_archive", JSON.stringify(updated));
  };

  // Close today's report manually
  const closeDayReport = () => {
    const sales = data.salesInvoices.filter(i=>i.date===selectedDate);
    const purchases = data.purchaseInvoices.filter(i=>i.date===selectedDate);
    const returns = data.returns.filter(r=>r.date===selectedDate);
    const dayExpenses = expenses.filter(e=>e.date===selectedDate);
    const html = generateDayReportHTML({sales,purchases,returns,expenses:dayExpenses}, selectedDate);
    const report = {
      date: selectedDate, closedAt: new Date().toISOString(),
      totalSales: sales.reduce((s,i)=>s+i.amount,0),
      totalPurchases: purchases.reduce((s,i)=>s+i.amount,0),
      totalReturns: returns.reduce((s,r)=>s+r.amount,0),
      totalExpenses: dayExpenses.reduce((s,e)=>s+e.amount,0),
      salesCount: sales.length, purchasesCount: purchases.length,
      htmlContent: html,
    };
    report.netProfit = report.totalSales - report.totalPurchases - report.totalReturns - report.totalExpenses;
    const updated = [...dailyArchive.filter(r=>r.date!==selectedDate), report];
    setDailyArchive(updated);
    localStorage.setItem("daily_reports_archive", JSON.stringify(updated));
    // Download PDF via print
    openPrint(html);
    setConfirmClose(false);
  };

  // Close month manually
  const closeMonthManual = () => {
    requestPasscode({
      pageId, kind:"delete", label:"إغلاق الشهر يدوياً",
      onConfirm: () => { autoCloseMonth(selectedMonth); log({ actionType:"إغلاق شهر", section:"التقارير المالية", target:selectedMonth, before:null, after:{ closed:true, month:selectedMonth } }); },
    });
  };

  // Download archived report
  const downloadArchive = (html, filename) => {
    openPrint(html);
  };

  // Data for selected date (daily view)
  const daySales = data.salesInvoices.filter(i=>i.date===selectedDate);
  const dayPurchases = data.purchaseInvoices.filter(i=>i.date===selectedDate);
  const dayReturns = data.returns.filter(r=>r.date===selectedDate);
  const dayExpenses = expenses.filter(e=>e.date===selectedDate);

  const dayTotalSales = daySales.reduce((s,i)=>s+i.amount,0);
  const dayTotalPurchases = dayPurchases.reduce((s,i)=>s+i.amount,0);
  const dayTotalReturns = dayReturns.reduce((s,r)=>s+r.amount,0);
  const dayTotalExpenses = dayExpenses.reduce((s,e)=>s+e.amount,0);
  const dayNetProfit = dayTotalSales - dayTotalPurchases - dayTotalReturns - dayTotalExpenses;
  const dayPaid = daySales.reduce((s,i)=>s+i.paid,0);
  const dayUnpaid = dayTotalSales - dayPaid;
  const isDayClosed = dailyArchive.some(r=>r.date===selectedDate);

  // Data for selected month (monthly view)
  const monthSales = data.salesInvoices.filter(i=>getMonth(i.date)===selectedMonth);
  const monthPurchases = data.purchaseInvoices.filter(i=>getMonth(i.date)===selectedMonth);
  const monthReturns = data.returns.filter(r=>getMonth(r.date)===selectedMonth);
  const monthExpenses = expenses.filter(e=>e.date?.startsWith(selectedMonth));
  const monthTotalSales = monthSales.reduce((s,i)=>s+i.amount,0);
  const monthTotalPurchases = monthPurchases.reduce((s,i)=>s+i.amount,0);
  const monthTotalReturns = monthReturns.reduce((s,r)=>s+r.amount,0);
  const monthTotalExpenses = monthExpenses.reduce((s,e)=>s+e.amount,0);
  const monthTotalTax = monthSales.reduce((s,i)=>s+(i.taxAmount||0),0);
  const monthNetProfit = monthTotalSales - monthTotalPurchases - monthTotalReturns - monthTotalExpenses;
  const isMonthClosed = monthlyArchive.some(r=>r.month===selectedMonth);

  const allMonths = [...new Set([
    ...data.salesInvoices.map(i=>getMonth(i.date)),
    ...data.purchaseInvoices.map(i=>getMonth(i.date)),
    today().slice(0,7),
  ])].filter(Boolean).sort().reverse();

  const dailySalesMap = {};
  monthSales.forEach(i=>{ dailySalesMap[i.date]=(dailySalesMap[i.date]||0)+i.amount; });

  const catSalesMap = {};
  monthSales.forEach(inv=>{ (inv.items||[]).forEach(it=>{ const c=it.category||"غير محدد"; catSalesMap[c]=(catSalesMap[c]||0)+it.qty*it.price; }); });

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:22 }}>
      {PasscodeGate}
      {confirmClose && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000 }}>
          <div style={{ background:C.surface,border:`2px solid ${C.accent}33`,borderRadius:20,padding:"32px 36px",maxWidth:400,width:"90%",textAlign:"center" }}>
            <div style={{ width:56,height:56,borderRadius:"50%",background:C.accentDim,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px" }}>
              <Ic d={I.stocktake} s={26} c={C.accent} />
            </div>
            <h3 style={{ margin:"0 0 10px",fontSize:16,fontWeight:700,color:C.text }}>إغلاق تقرير يوم {selectedDate}</h3>
            <p style={{ margin:"0 0 24px",fontSize:13,color:C.textMuted,lineHeight:1.8 }}>سيتم إغلاق اليوم وحفظ التقرير في الأرشيف وتنزيل PDF تلقائياً.</p>
            <div style={{ display:"flex",gap:10,justifyContent:"center" }}>
              <Btn variant="ghost" onClick={()=>setConfirmClose(false)}>إلغاء</Btn>
              <Btn onClick={closeDayReport}><Ic d={I.stocktake} s={14} />إغلاق وتنزيل PDF</Btn>
            </div>
          </div>
        </div>
      )}
      <PageHeader title="التقارير المالية" icon={I.report} subtitle="يومي وشهري مع أرشيف التقارير المغلقة"
        action={
          <div style={{ display:"flex",gap:8 }}>
            {viewMode==="daily" && !isDayClosed && <Btn variant="yellow" onClick={()=>setConfirmClose(true)}><Ic d={I.stocktake} s={14} />إغلاق اليوم + PDF</Btn>}
            {viewMode==="monthly" && !isMonthClosed && <Btn variant="cyan" onClick={closeMonthManual}><Ic d={I.stocktake} s={14} />إغلاق الشهر يدوياً</Btn>}
          </div>
        }
      />
      {/* Mode Tabs */}
      <div style={{ display:"flex",background:C.surface2,borderRadius:12,padding:4,border:`1px solid ${C.border}`,gap:4 }}>
        {[{id:"daily",label:"📅 يومي"},{id:"monthly",label:"📊 شهري"},{id:"archive",label:"🗂 الأرشيف"}].map(t=>(
          <button key={t.id} onClick={()=>setViewMode(t.id)} style={{ flex:1,background:viewMode===t.id?C.accent:"transparent",color:viewMode===t.id?"#fff":C.textMuted,border:"none",borderRadius:9,padding:"10px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── DAILY VIEW ─── */}
      {viewMode==="daily" && (
        <div style={{ display:"flex",flexDirection:"column",gap:18 }}>
          <div style={{ display:"flex",gap:12,alignItems:"center" }}>
            <DatePicker value={selectedDate} onChange={v=>setSelectedDate(v)} />
            {isDayClosed && (
              <div style={{ background:C.yellowDim,border:`1px solid ${C.yellow}33`,borderRadius:9,padding:"8px 14px",fontSize:12,color:C.yellow,fontWeight:700 }}>
                🔒 هذا اليوم مُغلق
              </div>
            )}
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:12 }}>
            <MiniStat label="المبيعات" value={fmt(dayTotalSales)} color={C.green} icon={I.sales} />
            <MiniStat label="المشتريات" value={fmt(dayTotalPurchases)} color={C.red} icon={I.purchase} />
            <MiniStat label="صافي الربح" value={fmt(dayNetProfit)} color={dayNetProfit>=0?C.green:C.red} icon={I.chartBar} />
            <MiniStat label="المحصّل" value={fmt(dayPaid)} color={C.accent} icon={I.revenue} />
            <MiniStat label="غير محصّل" value={fmt(dayUnpaid)} color={C.yellow} icon={I.alert} />
            <MiniStat label="المصروفات" value={fmt(dayTotalExpenses)} color={C.purple} icon={I.revenue} />
          </div>
          {/* Sales Table */}
          {daySales.length > 0 && (
            <Card style={{ padding:0 }}>
              <div style={{ padding:"12px 18px",borderBottom:`1px solid ${C.border}`,fontSize:13,fontWeight:700,color:C.text }}>فواتير المبيعات ({daySales.length})</div>
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <THead cols={["رقم","التاريخ والوقت","العميل","الأصناف","الإجمالي","المدفوع","المتبقي","طريقة الدفع","الحالة"]} />
                <tbody>
                  {daySales.map((inv,i)=>(
                    <TRow key={inv.id} alt={i%2}>
                      <TD color={C.accent}>{inv.id}</TD>
                      <TD color={C.textDim}><span style={{ fontSize:11 }}>{fmtDateTime(inv.createdAt||inv.date)}</span></TD>
                      <TD><span style={{ fontWeight:600 }}>{inv.client}</span></TD>
                      <TD color={C.textMuted}><span style={{ fontSize:11 }}>{(inv.items||[]).map(x=>x.name).join("، ")||"—"}</span></TD>
                      <TD mono>{fmt(inv.amount)}</TD>
                      <TD mono color={C.green}>{fmt(inv.paid)}</TD>
                      <TD mono color={(inv.amount-inv.paid)>0?C.red:C.textMuted}>{fmt(inv.amount-inv.paid)}</TD>
                      <TD color={inv.paymentMethod==="شيك"?C.yellow:C.green}>{inv.paymentMethod==="شيك"?"📄 شيك":"💵 نقدي"}</TD>
                      <td style={{ padding:"11px 14px" }}><Badge label={inv.status} /></td>
                    </TRow>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          {/* Purchases Table */}
          {dayPurchases.length > 0 && (
            <Card style={{ padding:0 }}>
              <div style={{ padding:"12px 18px",borderBottom:`1px solid ${C.border}`,fontSize:13,fontWeight:700,color:C.text }}>فواتير المشتريات ({dayPurchases.length})</div>
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <THead cols={["رقم","التاريخ والوقت","المورد","الإجمالي","المدفوع","المتبقي","طريقة الدفع","الحالة"]} />
                <tbody>
                  {dayPurchases.map((inv,i)=>(
                    <TRow key={inv.id} alt={i%2}>
                      <TD color={C.accent}>{inv.id}</TD>
                      <TD color={C.textDim}><span style={{ fontSize:11 }}>{fmtDateTime(inv.createdAt||inv.date)}</span></TD>
                      <TD><span style={{ fontWeight:600 }}>{inv.supplier}</span></TD>
                      <TD mono>{fmt(inv.amount)}</TD>
                      <TD mono color={C.green}>{fmt(inv.paid)}</TD>
                      <TD mono color={(inv.amount-inv.paid)>0?C.red:C.textMuted}>{fmt(inv.amount-inv.paid)}</TD>
                      <TD color={inv.paymentMethod==="شيك"?C.yellow:C.green}>{inv.paymentMethod==="شيك"?"📄 شيك":"💵 نقدي"}</TD>
                      <td style={{ padding:"11px 14px" }}><Badge label={inv.status} /></td>
                    </TRow>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          {dayReturns.length > 0 && (
            <Card style={{ padding:0 }}>
              <div style={{ padding:"12px 18px",borderBottom:`1px solid ${C.border}`,fontSize:13,fontWeight:700,color:C.text }}>المرتجعات ({dayReturns.length})</div>
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <THead cols={["رقم","التاريخ والوقت","الطرف","المبلغ","السبب"]} />
                <tbody>
                  {dayReturns.map((r,i)=>(
                    <TRow key={r.id} alt={i%2}>
                      <TD color={C.purple}>{r.id}</TD>
                      <TD color={C.textDim}><span style={{ fontSize:11 }}>{fmtDateTime(r.createdAt||r.date)}</span></TD>
                      <TD>{r.party}</TD>
                      <TD mono color={C.red}>{fmt(r.amount)}</TD>
                      <TD color={C.textMuted}>{r.reason||"—"}</TD>
                    </TRow>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          {dayExpenses.length > 0 && (
            <Card style={{ padding:0 }}>
              <div style={{ padding:"12px 18px",borderBottom:`1px solid ${C.border}`,fontSize:13,fontWeight:700,color:C.text }}>المصروفات ({dayExpenses.length})</div>
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <THead cols={["رقم","التاريخ والوقت","الوصف","الفئة","المبلغ","طريقة الدفع"]} />
                <tbody>
                  {dayExpenses.map((e,i)=>(
                    <TRow key={e.id} alt={i%2}>
                      <TD color={C.accent}>{e.id}</TD>
                      <TD color={C.textDim}><span style={{ fontSize:11 }}>{fmtDateTime(e.createdAt||e.date)}</span></TD>
                      <TD>{e.description}</TD>
                      <TD color={C.textDim}>{e.category}</TD>
                      <TD mono color={C.red}>{fmt(e.amount)}</TD>
                      <TD color={e.paymentMethod==="شيك"?C.yellow:C.green}>{e.paymentMethod==="شيك"?"📄 شيك":"💵 نقدي"}</TD>
                    </TRow>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          {daySales.length===0 && dayPurchases.length===0 && dayReturns.length===0 && dayExpenses.length===0 && (
            <Card style={{ textAlign:"center",padding:40,color:C.textMuted }}>لا توجد معاملات في هذا اليوم</Card>
          )}
        </div>
      )}

      {/* ─── MONTHLY VIEW ─── */}
      {viewMode==="monthly" && (
        <div style={{ display:"flex",flexDirection:"column",gap:18 }}>
          <div style={{ display:"flex",gap:12,alignItems:"center" }}>
            <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)}
              style={{ background:C.surface2,border:`1px solid ${isMonthClosed?C.yellow:C.border}`,borderRadius:9,padding:"9px 14px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none" }}>
              {allMonths.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
            {isMonthClosed && (
              <div style={{ background:C.yellowDim,border:`1px solid ${C.yellow}33`,borderRadius:9,padding:"8px 14px",fontSize:12,color:C.yellow,fontWeight:700 }}>
                🔒 هذا الشهر مُغلق
              </div>
            )}
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:12 }}>
            <MiniStat label="المبيعات" value={fmt(monthTotalSales)} color={C.green} icon={I.sales} />
            <MiniStat label="المشتريات" value={fmt(monthTotalPurchases)} color={C.red} icon={I.purchase} />
            <MiniStat label="صافي الربح" value={fmt(monthNetProfit)} color={monthNetProfit>=0?C.green:C.red} icon={I.chartBar} />
            <MiniStat label="الضرائب" value={fmt(monthTotalTax)} color={C.yellow} icon={I.tax} />
            <MiniStat label="المرتجعات" value={fmt(monthTotalReturns)} color={C.purple} icon={I.returns} />
            <MiniStat label="المصروفات" value={fmt(monthTotalExpenses)} color={C.red} icon={I.revenue} />
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
            <Card>
              <h3 style={{ margin:"0 0 14px",fontSize:14,fontWeight:700,color:C.text }}>المبيعات اليومية — {selectedMonth}</h3>
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                {Object.entries(dailySalesMap).sort((a,b)=>b[0].localeCompare(a[0])).map(([date,val])=>(
                  <div key={date} style={{ display:"flex",justifyContent:"space-between",padding:"8px 12px",background:C.surface2,borderRadius:9 }}>
                    <span style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>{date}</span>
                    <span style={{ fontSize:12,color:C.green,fontFamily:"monospace",fontWeight:700 }}>{fmt(val)}</span>
                  </div>
                ))}
                {Object.keys(dailySalesMap).length===0 && <div style={{ textAlign:"center",color:C.textMuted,fontSize:13,padding:20 }}>لا توجد مبيعات</div>}
              </div>
            </Card>
            <Card>
              <h3 style={{ margin:"0 0 14px",fontSize:14,fontWeight:700,color:C.text }}>المبيعات حسب الفئة</h3>
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                {Object.entries(catSalesMap).sort((a,b)=>b[1]-a[1]).map(([cat,val])=>{
                  const max = Math.max(...Object.values(catSalesMap));
                  return (
                    <div key={cat}>
                      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5 }}>
                        <span style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>{cat}</span>
                        <span style={{ fontSize:12,color:C.accent,fontFamily:"monospace",fontWeight:700 }}>{fmt(val)}</span>
                      </div>
                      <ProgressBar value={val} max={max} color={C.accent} />
                    </div>
                  );
                })}
                {Object.keys(catSalesMap).length===0 && <div style={{ color:C.textMuted,fontSize:13,textAlign:"center",padding:20 }}>لا توجد بيانات</div>}
              </div>
            </Card>
          </div>
          {/* Monthly Sales Table */}
          <Card style={{ padding:0 }}>
            <div style={{ padding:"12px 18px",borderBottom:`1px solid ${C.border}`,fontSize:13,fontWeight:700,color:C.text }}>فواتير المبيعات ({monthSales.length})</div>
            <table style={{ width:"100%",borderCollapse:"collapse" }}>
              <THead cols={["رقم","التاريخ والوقت","العميل","الإجمالي","المدفوع","المتبقي","طريقة الدفع","الحالة"]} />
              <tbody>
                {monthSales.map((inv,i)=>(
                  <TRow key={inv.id} alt={i%2}>
                    <TD color={C.accent}>{inv.id}</TD>
                    <TD color={C.textDim}><span style={{ fontSize:11 }}>{fmtDateTime(inv.createdAt||inv.date)}</span></TD>
                    <TD><span style={{ fontWeight:600 }}>{inv.client}</span></TD>
                    <TD mono>{fmt(inv.amount)}</TD>
                    <TD mono color={C.green}>{fmt(inv.paid)}</TD>
                    <TD mono color={(inv.amount-inv.paid)>0?C.red:C.textMuted}>{fmt(inv.amount-inv.paid)}</TD>
                    <TD color={inv.paymentMethod==="شيك"?C.yellow:C.green}>{inv.paymentMethod==="شيك"?"📄 شيك":"💵 نقدي"}</TD>
                    <td style={{ padding:"11px 14px" }}><Badge label={inv.status} /></td>
                  </TRow>
                ))}
              </tbody>
            </table>
            {monthSales.length===0 && <div style={{ padding:24,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد فواتير مبيعات</div>}
          </Card>
          <Card style={{ padding:0 }}>
            <div style={{ padding:"12px 18px",borderBottom:`1px solid ${C.border}`,fontSize:13,fontWeight:700,color:C.text }}>فواتير المشتريات ({monthPurchases.length})</div>
            <table style={{ width:"100%",borderCollapse:"collapse" }}>
              <THead cols={["رقم","التاريخ والوقت","المورد","الإجمالي","المدفوع","المتبقي","الحالة"]} />
              <tbody>
                {monthPurchases.map((inv,i)=>(
                  <TRow key={inv.id} alt={i%2}>
                    <TD color={C.accent}>{inv.id}</TD>
                    <TD color={C.textDim}><span style={{ fontSize:11 }}>{fmtDateTime(inv.createdAt||inv.date)}</span></TD>
                    <TD><span style={{ fontWeight:600 }}>{inv.supplier}</span></TD>
                    <TD mono>{fmt(inv.amount)}</TD>
                    <TD mono color={C.green}>{fmt(inv.paid)}</TD>
                    <TD mono color={(inv.amount-inv.paid)>0?C.red:C.textMuted}>{fmt(inv.amount-inv.paid)}</TD>
                    <td style={{ padding:"11px 14px" }}><Badge label={inv.status} /></td>
                  </TRow>
                ))}
              </tbody>
            </table>
            {monthPurchases.length===0 && <div style={{ padding:24,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد فواتير مشتريات</div>}
          </Card>
          {monthReturns.length > 0 && (
            <Card style={{ padding:0 }}>
              <div style={{ padding:"12px 18px",borderBottom:`1px solid ${C.border}`,fontSize:13,fontWeight:700,color:C.text }}>المرتجعات ({monthReturns.length})</div>
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <THead cols={["رقم","التاريخ والوقت","الطرف","المبلغ","السبب"]} />
                <tbody>
                  {monthReturns.map((r,i)=>(
                    <TRow key={r.id} alt={i%2}>
                      <TD color={C.purple}>{r.id}</TD>
                      <TD color={C.textDim}><span style={{ fontSize:11 }}>{fmtDateTime(r.createdAt||r.date)}</span></TD>
                      <TD>{r.party}</TD>
                      <TD mono color={C.red}>{fmt(r.amount)}</TD>
                      <TD color={C.textMuted}>{r.reason||"—"}</TD>
                    </TRow>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* ─── ARCHIVE VIEW ─── */}
      {viewMode==="archive" && (
        <div style={{ display:"flex",flexDirection:"column",gap:22 }}>
          {/* Monthly Archive */}
          <Card>
            <h3 style={{ margin:"0 0 16px",fontSize:15,fontWeight:700,color:C.text }}>🗂 التقارير الشهرية المغلقة</h3>
            {monthlyArchive.length===0 ? (
              <div style={{ textAlign:"center",color:C.textMuted,padding:30,fontSize:13 }}>لا توجد تقارير شهرية مُغلقة بعد</div>
            ) : (
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                {[...monthlyArchive].sort((a,b)=>b.month.localeCompare(a.month)).map(r=>{
                  const [y,m] = r.month.split("-");
                  const label = new Date(+y, +m-1, 1).toLocaleDateString("ar-EG",{month:"long",year:"numeric"});
                  return (
                    <div key={r.month} style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px 18px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                      <div>
                        <div style={{ fontSize:14,fontWeight:700,color:C.text,marginBottom:6 }}>📊 تقرير {label}</div>
                        <div style={{ display:"flex",gap:16,flexWrap:"wrap" }}>
                          <span style={{ fontSize:11,color:C.green }}>مبيعات: {fmt(r.totalSales)}</span>
                          <span style={{ fontSize:11,color:C.red }}>مشتريات: {fmt(r.totalPurchases)}</span>
                          <span style={{ fontSize:11,color:r.netProfit>=0?C.green:C.red }}>ربح: {fmt(r.netProfit)}</span>
                          <span style={{ fontSize:11,color:C.yellow }}>ضرائب: {fmt(r.totalTax||0)}</span>
                        </div>
                        <div style={{ fontSize:10,color:C.textMuted,marginTop:4 }}>
                          {r.auto?"🤖 مُغلق تلقائياً":"👤 مُغلق يدوياً"} — {fmtDateTime(r.closedAt)}
                        </div>
                      </div>
                      <Btn variant="success" small onClick={()=>downloadArchive(r.htmlContent, `تقرير_${r.month}`)}>
                        <Ic d={I.download} s={13} />تنزيل PDF
                      </Btn>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          {/* Daily Archive */}
          <Card>
            <h3 style={{ margin:"0 0 16px",fontSize:15,fontWeight:700,color:C.text }}>📅 التقارير اليومية المغلقة</h3>
            {dailyArchive.length===0 ? (
              <div style={{ textAlign:"center",color:C.textMuted,padding:30,fontSize:13 }}>لا توجد تقارير يومية مُغلقة بعد</div>
            ) : (
              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                {[...dailyArchive].sort((a,b)=>b.date.localeCompare(a.date)).map(r=>(
                  <div key={r.date} style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:13,fontWeight:700,color:C.text,marginBottom:4 }}>
                        📅 {new Date(r.date+"T00:00:00").toLocaleDateString("ar-EG",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
                      </div>
                      <div style={{ display:"flex",gap:14,flexWrap:"wrap" }}>
                        <span style={{ fontSize:11,color:C.green }}>مبيعات: {fmt(r.totalSales)}</span>
                        <span style={{ fontSize:11,color:C.red }}>مشتريات: {fmt(r.totalPurchases)}</span>
                        <span style={{ fontSize:11,color:r.netProfit>=0?C.green:C.red }}>ربح: {fmt(r.netProfit)}</span>
                        <span style={{ fontSize:11,color:C.textMuted }}>فواتير: {r.salesCount||0}</span>
                      </div>
                      <div style={{ fontSize:10,color:C.textMuted,marginTop:4 }}>🔒 مُغلق في {fmtDateTime(r.closedAt)}</div>
                    </div>
                    <Btn variant="ghost" small onClick={()=>downloadArchive(r.htmlContent, `تقرير_${r.date}`)}>
                      <Ic d={I.download} s={13} />PDF
                    </Btn>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

export default UnifiedReportsPage;
