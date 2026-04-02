import { useState, useMemo } from "react";

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#0b0d14",
  surface: "#13151f",
  surface2: "#1a1d2b",
  border: "#252838",
  borderLight: "#2e3248",
  accent: "#6c7fff",
  accentDim: "rgba(108,127,255,0.12)",
  green: "#34d399",
  greenDim: "rgba(52,211,153,0.1)",
  red: "#f87171",
  redDim: "rgba(248,113,113,0.1)",
  yellow: "#fbbf24",
  yellowDim: "rgba(251,191,36,0.1)",
  blue: "#60a5fa",
  blueDim: "rgba(96,165,250,0.1)",
  purple: "#a78bfa",
  purpleDim: "rgba(167,139,250,0.1)",
  text: "#e2e8f0",
  textMuted: "#64748b",
  textDim: "#94a3b8",
};

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Ic = ({ d, s = 16, c = "currentColor" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const I = {
  dash: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  sales: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  purchase: "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0",
  clients: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  suppliers: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10",
  report: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  returns: "M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15",
  revenue: "M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6",
  inventory: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12",
  tax: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 15l2 2 4-4",
  stocktake: "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
  categories: "M4 6h16M4 10h16M4 14h16M4 18h16",
  plus: "M12 5v14M5 12h14",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  close: "M18 6L6 18M6 6l12 12",
  edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  chevDown: "M6 9l6 6 6-6",
  alert: "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  filter: "M22 3H2l8 9.46V19l4 2v-8.54z",
  calendar: "M3 4h18v18H3zM16 2v4M8 2v4M3 10h18",
  box: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",
  print: "M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z",
  download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
  upload: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
  excel: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M10 13l4 6M14 13l-4 6",
  userPlus: "M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 11a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (n) => (n ?? 0).toLocaleString("ar-EG") + " ج.م";
const fmtNum = (n) => (n ?? 0).toLocaleString("ar-EG");
const today = () => new Date().toISOString().split("T")[0];
const getMonth = (d) => d?.slice(0, 7);
const getWeek = (d) => {
  const dt = new Date(d);
  const jan1 = new Date(dt.getFullYear(), 0, 1);
  return Math.ceil(((dt - jan1) / 86400000 + jan1.getDay() + 1) / 7);
};

// ─── PRINT HELPERS ────────────────────────────────────────────────────────────
const printInvoice = (inv, type) => {
  const party = type === "sales" ? inv.client : inv.supplier;
  const partyLabel = type === "sales" ? "العميل" : "المورد";
  const title = type === "sales" ? "فاتورة مبيعات" : "فاتورة مشتريات";
  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>${title} - ${inv.id}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Cairo', 'Segoe UI', sans-serif; background: #fff; color: #1a1a2e; padding: 40px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #6c7fff; }
        .company { font-size: 24px; font-weight: 800; color: #6c7fff; }
        .company-sub { font-size: 12px; color: #64748b; margin-top: 4px; }
        .invoice-meta { text-align: left; }
        .invoice-num { font-size: 20px; font-weight: 800; color: #1a1a2e; }
        .invoice-type { font-size: 13px; color: #64748b; margin-bottom: 4px; }
        .badge { display: inline-block; background: #f0f4ff; color: #6c7fff; border: 1px solid #c7d2fe; padding: 3px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; margin-top: 6px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .info-box { background: #f8faff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; }
        .info-label { font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 4px; }
        .info-value { font-size: 15px; font-weight: 700; color: #1a1a2e; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        thead tr { background: #6c7fff; color: #fff; }
        thead th { padding: 10px 14px; font-size: 12px; font-weight: 700; text-align: right; }
        tbody tr:nth-child(even) { background: #f8faff; }
        tbody td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
        .totals { background: #f8faff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 20px; max-width: 300px; margin-right: auto; }
        .total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
        .total-row.main { font-size: 16px; font-weight: 800; color: #6c7fff; border-top: 2px solid #c7d2fe; margin-top: 8px; padding-top: 10px; }
        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="company">حسابي Pro</div>
          <div class="company-sub">نظام محاسبة متكامل</div>
        </div>
        <div class="invoice-meta">
          <div class="invoice-type">${title}</div>
          <div class="invoice-num">${inv.id}</div>
          <span class="badge">${inv.status}</span>
        </div>
      </div>
      <div class="info-grid">
        <div class="info-box">
          <div class="info-label">${partyLabel}</div>
          <div class="info-value">${party}</div>
        </div>
        <div class="info-box">
          <div class="info-label">التاريخ</div>
          <div class="info-value">${inv.date}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>الصنف</th>
            <th>الفئة</th>
            <th>الكمية</th>
            <th>السعر</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${(inv.items || []).map(it => `
            <tr>
              <td>${it.name || "—"}</td>
              <td>${it.category || "—"}</td>
              <td>${it.qty}</td>
              <td>${(it.price || 0).toLocaleString("ar-EG")} ج.م</td>
              <td>${((it.qty || 0) * (it.price || 0)).toLocaleString("ar-EG")} ج.م</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="totals">
        <div class="total-row"><span>قبل الضريبة</span><span>${(inv.subtotal || inv.amount).toLocaleString("ar-EG")} ج.م</span></div>
        <div class="total-row"><span>ضريبة ${inv.taxRate || 0}%</span><span>${(inv.taxAmount || 0).toLocaleString("ar-EG")} ج.م</span></div>
        <div class="total-row"><span>المدفوع</span><span>${(inv.paid || 0).toLocaleString("ar-EG")} ج.م</span></div>
        <div class="total-row"><span>المتبقي</span><span>${(inv.amount - inv.paid).toLocaleString("ar-EG")} ج.م</span></div>
        <div class="total-row main"><span>الإجمالي الكلي</span><span>${inv.amount.toLocaleString("ar-EG")} ج.م</span></div>
      </div>
      ${inv.notes ? `<p style="margin-top:20px;font-size:13px;color:#64748b;"><strong>ملاحظات:</strong> ${inv.notes}</p>` : ""}
      <div class="footer">تم إنشاء هذه الفاتورة بواسطة حسابي Pro — ${new Date().toLocaleDateString("ar-EG")}</div>
    </body>
    </html>
  `;
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
};

const printTaxInvoice = (inv, type) => {
  const party = type === "sales" ? inv.client : inv.supplier;
  const partyLabel = type === "sales" ? "العميل" : "المورد";
  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>فاتورة ضريبية - ${inv.id}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Cairo', 'Segoe UI', sans-serif; background: #fff; color: #1a1a2e; padding: 40px; }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #fbbf24; }
        .title { font-size: 26px; font-weight: 800; color: #1a1a2e; }
        .subtitle { font-size: 14px; color: #64748b; margin-top: 4px; }
        .tax-badge { display: inline-block; background: #fffbeb; color: #92400e; border: 2px solid #fbbf24; padding: 6px 20px; border-radius: 30px; font-size: 14px; font-weight: 800; margin-top: 10px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 30px; }
        .info-box { background: #f8faff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center; }
        .info-label { font-size: 11px; color: #64748b; font-weight: 600; }
        .info-value { font-size: 15px; font-weight: 800; color: #1a1a2e; margin-top: 4px; }
        .tax-box { background: #fffbeb; border: 2px solid #fbbf24; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
        .tax-amount { font-size: 32px; font-weight: 800; color: #92400e; }
        .tax-label { font-size: 13px; color: #78716c; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        thead tr { background: #fbbf24; color: #1a1a2e; }
        thead th { padding: 10px 14px; font-size: 12px; font-weight: 700; text-align: right; }
        tbody tr:nth-child(even) { background: #fffbeb; }
        tbody td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
        .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">فاتورة ضريبية رسمية</div>
        <div class="subtitle">حسابي Pro — نظام محاسبة متكامل</div>
        <div class="tax-badge">ضريبة القيمة المضافة ${inv.taxRate}%</div>
      </div>
      <div class="info-grid">
        <div class="info-box"><div class="info-label">رقم الفاتورة</div><div class="info-value">${inv.id}</div></div>
        <div class="info-box"><div class="info-label">${partyLabel}</div><div class="info-value">${party}</div></div>
        <div class="info-box"><div class="info-label">التاريخ</div><div class="info-value">${inv.date}</div></div>
      </div>
      <table>
        <thead><tr><th>البيان</th><th>المبلغ</th></tr></thead>
        <tbody>
          <tr><td>المبلغ قبل الضريبة</td><td>${(inv.subtotal || inv.amount).toLocaleString("ar-EG")} ج.م</td></tr>
          <tr><td>نسبة الضريبة</td><td>${inv.taxRate}%</td></tr>
          <tr><td><strong>مبلغ الضريبة المستحقة</strong></td><td><strong>${(inv.taxAmount || 0).toLocaleString("ar-EG")} ج.م</strong></td></tr>
          <tr><td><strong>الإجمالي شامل الضريبة</strong></td><td><strong>${inv.amount.toLocaleString("ar-EG")} ج.م</strong></td></tr>
        </tbody>
      </table>
      <div class="tax-box">
        <div class="tax-amount">${(inv.taxAmount || 0).toLocaleString("ar-EG")} ج.م</div>
        <div class="tax-label">إجمالي ضريبة القيمة المضافة المستحقة</div>
      </div>
      <div class="footer">هذه فاتورة ضريبية رسمية — تم الإنشاء بتاريخ ${new Date().toLocaleDateString("ar-EG")}</div>
    </body>
    </html>
  `;
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
};

const printStocktakeReport = (inventory, period, selectedMonth, categories) => {
  const filtered = selectedMonth
    ? inventory
    : inventory;
  const totalCostVal = filtered.reduce((s, p) => s + p.qty * p.cost, 0);
  const totalSaleVal = filtered.reduce((s, p) => s + p.qty * p.price, 0);
  const lowItems = filtered.filter(p => p.qty <= p.minQty);
  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>تقرير الجرد - ${selectedMonth || ""}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Cairo', 'Segoe UI', sans-serif; background: #fff; color: #1a1a2e; padding: 40px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #34d399; }
        .title { font-size: 22px; font-weight: 800; }
        .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
        .stat { background: #f8faff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center; }
        .stat-val { font-size: 18px; font-weight: 800; }
        .stat-lbl { font-size: 11px; color: #64748b; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
        thead tr { background: #34d399; color: #fff; }
        thead th { padding: 8px 12px; font-weight: 700; text-align: right; }
        tbody tr:nth-child(even) { background: #f0fdf4; }
        tbody td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
        .low { color: #ef4444; font-weight: 700; }
        .ok { color: #16a34a; }
        .section-title { font-size: 15px; font-weight: 800; margin: 20px 0 10px; color: #1a1a2e; }
        .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="title">تقرير الجرد الدوري</div>
          <div class="subtitle">${period === "monthly" ? "جرد شهري" : "جرد أسبوعي"} — ${selectedMonth}</div>
        </div>
        <div class="subtitle">${new Date().toLocaleDateString("ar-EG")}</div>
      </div>
      <div class="stats">
        <div class="stat"><div class="stat-val" style="color:#6c7fff">${filtered.length}</div><div class="stat-lbl">إجمالي الأصناف</div></div>
        <div class="stat"><div class="stat-val" style="color:#ef4444">${lowItems.length}</div><div class="stat-lbl">أصناف منخفضة</div></div>
        <div class="stat"><div class="stat-val" style="color:#fbbf24">${totalCostVal.toLocaleString("ar-EG")} ج.م</div><div class="stat-lbl">قيمة المخزون</div></div>
        <div class="stat"><div class="stat-val" style="color:#34d399">${totalSaleVal.toLocaleString("ar-EG")} ج.م</div><div class="stat-lbl">قيمة البيع</div></div>
      </div>
      ${lowItems.length > 0 ? `
        <div class="section-title">⚠️ الأصناف المنخفضة — تحتاج تجديد</div>
        <table>
          <thead><tr><th>الصنف</th><th>الفئة</th><th>الكمية الحالية</th><th>الحد الأدنى</th><th>النقص</th></tr></thead>
          <tbody>
            ${lowItems.map(p => `<tr><td class="low">${p.name}</td><td>${p.category}</td><td class="low">${p.qty} ${p.unit}</td><td>${p.minQty}</td><td class="low">${Math.max(0, p.minQty - p.qty)} ${p.unit}</td></tr>`).join("")}
          </tbody>
        </table>
      ` : ""}
      <div class="section-title">تفاصيل جميع الأصناف</div>
      <table>
        <thead><tr><th>الكود</th><th>الصنف</th><th>الفئة</th><th>الكمية</th><th>سعر التكلفة</th><th>قيمة المخزون</th><th>الحالة</th></tr></thead>
        <tbody>
          ${filtered.map(p => `
            <tr>
              <td>${p.id}</td>
              <td>${p.name}</td>
              <td>${p.category}</td>
              <td class="${p.qty <= p.minQty ? "low" : "ok"}">${p.qty} ${p.unit}</td>
              <td>${p.cost.toLocaleString("ar-EG")} ج.م</td>
              <td>${(p.qty * p.cost).toLocaleString("ar-EG")} ج.م</td>
              <td class="${p.qty <= p.minQty ? "low" : "ok"}">${p.qty <= p.minQty ? "منخفض" : "كافي"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="footer">تقرير الجرد — حسابي Pro — ${new Date().toLocaleDateString("ar-EG")}</div>
    </body>
    </html>
  `;
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
};

const printFinancialReport = (data, period, selectedMonth) => {
  const filteredSales = data.salesInvoices.filter(i => getMonth(i.date) === selectedMonth);
  const filteredPurchases = data.purchaseInvoices.filter(i => getMonth(i.date) === selectedMonth);
  const totalSales = filteredSales.reduce((s, i) => s + i.amount, 0);
  const totalPurchases = filteredPurchases.reduce((s, i) => s + i.amount, 0);
  const totalPaid = filteredSales.reduce((s, i) => s + i.paid, 0);
  const totalTax = filteredSales.reduce((s, i) => s + (i.taxAmount || 0), 0);
  const profit = totalSales - totalPurchases;

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>التقرير المالي - ${selectedMonth}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Cairo', 'Segoe UI', sans-serif; background: #fff; color: #1a1a2e; padding: 40px; }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #6c7fff; }
        .title { font-size: 24px; font-weight: 800; color: #6c7fff; }
        .subtitle { font-size: 13px; color: #64748b; margin-top: 6px; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 30px; }
        .stat { border-radius: 10px; padding: 16px; text-align: center; border: 1px solid #e2e8f0; }
        .stat-val { font-size: 18px; font-weight: 800; font-family: monospace; }
        .stat-lbl { font-size: 11px; color: #64748b; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
        thead tr { background: #6c7fff; color: #fff; }
        thead th { padding: 9px 12px; font-weight: 700; text-align: right; }
        tbody tr:nth-child(even) { background: #f8faff; }
        tbody td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; }
        .section-title { font-size: 15px; font-weight: 800; margin: 24px 0 12px; }
        .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">التقرير المالي ${period === "monthly" ? "الشهري" : "اليومي"}</div>
        <div class="subtitle">الفترة: ${selectedMonth} — حسابي Pro</div>
      </div>
      <div class="stats">
        <div class="stat"><div class="stat-val" style="color:#34d399">${totalSales.toLocaleString("ar-EG")} ج.م</div><div class="stat-lbl">المبيعات</div></div>
        <div class="stat"><div class="stat-val" style="color:#f87171">${totalPurchases.toLocaleString("ar-EG")} ج.م</div><div class="stat-lbl">المشتريات</div></div>
        <div class="stat"><div class="stat-val" style="color:${profit >= 0 ? "#34d399" : "#f87171"}">${profit.toLocaleString("ar-EG")} ج.م</div><div class="stat-lbl">صافي الربح</div></div>
        <div class="stat"><div class="stat-val" style="color:#6c7fff">${totalPaid.toLocaleString("ar-EG")} ج.م</div><div class="stat-lbl">المدفوع</div></div>
      </div>
      <div class="section-title">فواتير المبيعات — ${selectedMonth}</div>
      <table>
        <thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>العميل</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th></tr></thead>
        <tbody>
          ${filteredSales.map(i => `<tr><td>${i.id}</td><td>${i.date}</td><td>${i.client}</td><td>${i.amount.toLocaleString("ar-EG")} ج.م</td><td>${i.paid.toLocaleString("ar-EG")} ج.م</td><td>${(i.amount-i.paid).toLocaleString("ar-EG")} ج.م</td><td>${i.status}</td></tr>`).join("")}
        </tbody>
      </table>
      <div class="section-title">فواتير المشتريات — ${selectedMonth}</div>
      <table>
        <thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>المورد</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th></tr></thead>
        <tbody>
          ${filteredPurchases.map(i => `<tr><td>${i.id}</td><td>${i.date}</td><td>${i.supplier}</td><td>${i.amount.toLocaleString("ar-EG")} ج.م</td><td>${i.paid.toLocaleString("ar-EG")} ج.م</td><td>${(i.amount-i.paid).toLocaleString("ar-EG")} ج.م</td><td>${i.status}</td></tr>`).join("")}
        </tbody>
      </table>
      <div class="footer">التقرير المالي — حسابي Pro — ${new Date().toLocaleDateString("ar-EG")}</div>
    </body>
    </html>
  `;
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
};

// ─── EXCEL HELPERS ────────────────────────────────────────────────────────────
const downloadInventoryTemplate = () => {
  const csv = "اسم الصنف,الفئة,الكمية الحالية,الحد الأدنى,سعر التكلفة,سعر البيع,وحدة القياس\n";
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "قالب_المخزون.csv";
  a.click();
  URL.revokeObjectURL(url);
};

const parseInventoryCSV = (text, categories) => {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    if (!cols[0]) continue;
    items.push({
      id: "INV" + Date.now().toString().slice(-5) + i,
      name: cols[0] || "",
      category: cols[1] || categories[0] || "",
      qty: parseFloat(cols[2]) || 0,
      minQty: parseFloat(cols[3]) || 0,
      cost: parseFloat(cols[4]) || 0,
      price: parseFloat(cols[5]) || 0,
      unit: cols[6] || "قطعة",
    });
  }
  return items;
};

// ─── CONFIRM DIALOG ───────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000,
    }}>
      <div style={{
        background: C.surface, border: `1px solid ${C.red}44`, borderRadius: 16,
        padding: "28px 32px", maxWidth: 380, width: "90%", textAlign: "center",
        boxShadow: `0 0 40px ${C.red}22`,
      }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.redDim, border: `2px solid ${C.red}44`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Ic d={I.alert} s={24} c={C.red} />
        </div>
        <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700, color: C.text }}>تأكيد الحذف</h3>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onCancel} style={{
            background: C.surface2, color: C.textDim, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: "9px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>إلغاء</button>
          <button onClick={onConfirm} style={{
            background: C.red, color: "#fff", border: "none",
            borderRadius: 8, padding: "9px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>نعم، احذف</button>
        </div>
      </div>
    </div>
  );
}

// ─── INITIAL DATA ─────────────────────────────────────────────────────────────
const init = {
  salesInvoices: [
    { id: "S001", date: "2025-03-01", client: "شركة النور للتجارة", amount: 15000, paid: 15000, items: [{ category: "إلكترونيات", name: "لابتوب", qty: 2, price: 7500 }], status: "مدفوعة", taxRate: 14, subtotal: 13158, taxAmount: 1842 },
    { id: "S002", date: "2025-03-10", client: "مصنع الإبداع", amount: 32000, paid: 20000, items: [{ category: "مواد خام", name: "حديد", qty: 10, price: 3200 }], status: "جزئية", taxRate: 14, subtotal: 28070, taxAmount: 3930 },
    { id: "S003", date: "2025-03-20", client: "شركة الفجر", amount: 8500, paid: 0, items: [{ category: "معدات", name: "ماكينة طباعة", qty: 1, price: 8500 }], status: "غير مدفوعة", taxRate: 14, subtotal: 7456, taxAmount: 1044 },
  ],
  purchaseInvoices: [
    { id: "P001", date: "2025-03-05", supplier: "موردو الخليج", amount: 9000, paid: 9000, items: [{ category: "مستلزمات مكتبية", name: "ورق A4", qty: 100, price: 90 }], status: "مدفوعة", taxRate: 14, subtotal: 7895, taxAmount: 1105 },
    { id: "P002", date: "2025-03-15", supplier: "شركة الصناعات", amount: 21000, paid: 10000, items: [{ category: "آلات", name: "مضخة صناعية", qty: 3, price: 7000 }], status: "جزئية", taxRate: 14, subtotal: 18421, taxAmount: 2579 },
  ],
  clients: [
    { id: "C001", name: "شركة النور للتجارة", phone: "01000000001", balance: 0 },
    { id: "C002", name: "مصنع الإبداع", phone: "01000000002", balance: 12000 },
    { id: "C003", name: "شركة الفجر", phone: "01000000003", balance: 8500 },
  ],
  suppliers: [
    { id: "SP001", name: "موردو الخليج", phone: "01100000001", balance: 0 },
    { id: "SP002", name: "شركة الصناعات", phone: "01100000002", balance: 11000 },
  ],
  returns: [],
  categories: ["إلكترونيات", "مواد خام", "معدات", "مستلزمات مكتبية", "آلات", "أغذية", "ملابس", "أدوات"],
  inventory: [
    { id: "INV001", name: "لابتوب", category: "إلكترونيات", qty: 15, minQty: 3, cost: 7000, price: 7500, unit: "قطعة" },
    { id: "INV002", name: "ورق A4", category: "مستلزمات مكتبية", qty: 500, minQty: 50, cost: 80, price: 90, unit: "رزمة" },
    { id: "INV003", name: "مضخة صناعية", category: "آلات", qty: 5, minQty: 2, cost: 6500, price: 7000, unit: "قطعة" },
    { id: "INV004", name: "حديد", category: "مواد خام", qty: 200, minQty: 30, cost: 3000, price: 3200, unit: "طن" },
  ],
};

// ─── BASE COMPONENTS ──────────────────────────────────────────────────────────
const Badge = ({ label }) => {
  const colors = {
    "مدفوعة": { bg: C.greenDim, color: C.green, border: C.green + "33" },
    "جزئية": { bg: C.yellowDim, color: C.yellow, border: C.yellow + "33" },
    "غير مدفوعة": { bg: C.redDim, color: C.red, border: C.red + "33" },
    "مرتجع": { bg: C.purpleDim, color: C.purple, border: C.purple + "33" },
    "منخفض": { bg: C.redDim, color: C.red, border: C.red + "33" },
    "كافي": { bg: C.greenDim, color: C.green, border: C.green + "33" },
  };
  const s = colors[label] || { bg: C.surface2, color: C.textDim, border: C.border };
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
};

const Card = ({ children, style = {} }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", ...style }}>
    {children}
  </div>
);

const MiniStat = ({ label, value, color = C.text, icon, accent }) => (
  <div style={{
    background: C.surface2, borderRadius: 12, padding: "16px 18px",
    borderTop: `2px solid ${accent || color}`,
    display: "flex", flexDirection: "column", gap: 8,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {icon && <Ic d={icon} s={14} c={color} />}
      <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
    </div>
    <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div>
  </div>
);

const Btn = ({ children, onClick, variant = "primary", small = false, style = {} }) => {
  const v = {
    primary: { background: C.accent, color: "#fff", border: "none" },
    danger: { background: "transparent", color: C.red, border: `1px solid ${C.red}44` },
    ghost: { background: "transparent", color: C.textDim, border: `1px solid ${C.border}` },
    success: { background: C.greenDim, color: C.green, border: `1px solid ${C.green}33` },
    yellow: { background: C.yellowDim, color: C.yellow, border: `1px solid ${C.yellow}33` },
  };
  return (
    <button onClick={onClick} style={{
      ...v[variant], borderRadius: 8, padding: small ? "5px 12px" : "8px 18px",
      fontSize: small ? 12 : 13, fontWeight: 600, cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit", ...style,
    }}>{children}</button>
  );
};

const Inp = ({ label, value, onChange, type = "text", placeholder = "", required = false }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    {label && <label style={{ fontSize: 12, color: C.textDim, fontWeight: 600 }}>{label}{required && <span style={{ color: C.red }}> *</span>}</label>}
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{
        background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: "8px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none",
      }}
      onFocus={e => e.target.style.borderColor = C.accent}
      onBlur={e => e.target.style.borderColor = C.border}
    />
  </div>
);

const Sel = ({ label, value, onChange, options, placeholder = "-- اختر --" }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    {label && <label style={{ fontSize: 12, color: C.textDim, fontWeight: 600 }}>{label}</label>}
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
      padding: "8px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none",
    }}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
    </select>
  </div>
);

const Modal = ({ title, onClose, children, wide = false }) => (
  <div style={{
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16,
  }}>
    <div style={{
      background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 18,
      padding: 26, width: wide ? "min(760px,95vw)" : "min(520px,95vw)",
      maxHeight: "90vh", overflowY: "auto", boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text }}>{title}</h2>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}>
          <Ic d={I.close} s={18} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const THead = ({ cols }) => (
  <thead>
    <tr style={{ background: C.surface2, borderBottom: `1px solid ${C.border}` }}>
      {cols.map(c => (
        <th key={c} style={{ padding: "10px 14px", fontSize: 11, color: C.textMuted, fontWeight: 700, textAlign: "right", whiteSpace: "nowrap", letterSpacing: 0.3 }}>{c}</th>
      ))}
    </tr>
  </thead>
);

const TRow = ({ children, alt }) => (
  <tr style={{ borderBottom: `1px solid ${C.border}`, background: alt ? "rgba(255,255,255,0.01)" : "transparent" }}>
    {children}
  </tr>
);

const TD = ({ children, color, mono = false }) => (
  <td style={{ padding: "11px 14px", fontSize: 12, color: color || C.text, fontFamily: mono ? "monospace" : "inherit" }}>
    {children}
  </td>
);

const PageHeader = ({ title, subtitle, action }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
    <div>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>{title}</h1>
      {subtitle && <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

const ProgressBar = ({ value, max, color }) => (
  <div style={{ background: C.surface2, borderRadius: 4, height: 6, overflow: "hidden" }}>
    <div style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.3s" }} />
  </div>
);

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ data }) {
  const totalSales = data.salesInvoices.reduce((s, i) => s + i.amount, 0);
  const totalPurchases = data.purchaseInvoices.reduce((s, i) => s + i.amount, 0);
  const totalReceivable = data.salesInvoices.reduce((s, i) => s + (i.amount - i.paid), 0);
  const totalPayable = data.purchaseInvoices.reduce((s, i) => s + (i.amount - i.paid), 0);
  const totalReturns = data.returns.reduce((s, r) => s + r.amount, 0);
  const netProfit = totalSales - totalPurchases - totalReturns;
  const lowStock = data.inventory.filter(p => p.qty <= p.minQty);

  const bigStats = [
    { label: "صافي الإيرادات", value: fmt(totalSales), color: C.green, icon: I.revenue },
    { label: "إجمالي المشتريات", value: fmt(totalPurchases), color: C.red, icon: I.purchase },
    { label: "صافي الربح", value: fmt(netProfit), color: netProfit >= 0 ? C.green : C.red, icon: I.revenue },
    { label: "مديونية العملاء", value: fmt(totalReceivable), color: C.accent, icon: I.clients },
    { label: "مديونية الموردين", value: fmt(totalPayable), color: C.yellow, icon: I.suppliers },
    { label: "المرتجعات", value: fmt(totalReturns), color: C.purple, icon: I.returns },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <PageHeader title="لوحة التحكم" subtitle="نظرة عامة شاملة على الأداء المالي" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {bigStats.map(s => (
          <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{s.label}</span>
              <div style={{ background: s.color + "18", padding: 8, borderRadius: 8 }}>
                <Ic d={s.icon} s={14} c={s.color} />
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: "monospace" }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <Card>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: C.text }}>آخر فواتير المبيعات</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.salesInvoices.slice(-3).reverse().map(inv => (
              <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: C.surface2, borderRadius: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{inv.client}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{inv.date}</div>
                </div>
                <div style={{ textAlign: "left", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.green, fontFamily: "monospace" }}>{fmt(inv.amount)}</div>
                  <Badge label={inv.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: C.text }}>تنبيهات المخزون المنخفض</h3>
          {lowStock.length === 0 ? (
            <div style={{ textAlign: "center", color: C.green, padding: 20 }}>
              <Ic d={I.stocktake} s={32} c={C.green} />
              <div style={{ marginTop: 8, fontSize: 13 }}>المخزون في مستوى جيد</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {lowStock.map(p => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: C.redDim, borderRadius: 10, border: `1px solid ${C.red}22` }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{p.category}</div>
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.red }}>{fmtNum(p.qty)} {p.unit}</div>
                    <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>الحد الأدنى: {p.minQty}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── INVOICE FORM ─────────────────────────────────────────────────────────────
function InvoiceForm({ type, clients, suppliers, categories, inventory, onSave, onClose }) {
  const isS = type === "sales";
  const [form, setForm] = useState({ date: today(), party: "", paid: "", taxRate: "14", notes: "" });
  const [items, setItems] = useState([{ category: "", name: "", qty: 1, price: 0 }]);
  const partyList = isS ? clients : suppliers;

  const subtotal = items.reduce((s, it) => s + (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0), 0);
  const taxAmount = subtotal * (parseFloat(form.taxRate) || 0) / 100;
  const total = subtotal + taxAmount;
  const paid = parseFloat(form.paid) || 0;

  const addItem = () => setItems([...items, { category: "", name: "", qty: 1, price: 0 }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => setItems(items.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  const handleSave = () => {
    if (!form.party || items.every(it => !it.name)) return;
    onSave({
      id: (isS ? "S" : "P") + Date.now().toString().slice(-5),
      date: form.date,
      [isS ? "client" : "supplier"]: form.party,
      amount: Math.round(total),
      paid,
      items,
      taxRate: parseFloat(form.taxRate) || 0,
      subtotal: Math.round(subtotal),
      taxAmount: Math.round(taxAmount),
      notes: form.notes,
      status: paid >= total ? "مدفوعة" : paid > 0 ? "جزئية" : "غير مدفوعة",
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Inp label="التاريخ" type="date" value={form.date} onChange={v => setForm({ ...form, date: v })} />
        <Sel label={isS ? "العميل" : "المورد"} value={form.party} onChange={v => setForm({ ...form, party: v })}
          options={partyList.map(p => ({ value: p.name, label: p.name }))} />
        <Inp label="نسبة الضريبة %" type="number" value={form.taxRate} onChange={v => setForm({ ...form, taxRate: v })} placeholder="14" />
        <Inp label="المدفوع مقدماً" type="number" value={form.paid} onChange={v => setForm({ ...form, paid: v })} placeholder="0" />
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.textDim }}>الأصناف</label>
          <Btn small onClick={addItem}><Ic d={I.plus} s={12} />إضافة صنف</Btn>
        </div>
        <div style={{ background: C.surface2, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <THead cols={["الفئة", "اسم الصنف", "الكمية", "السعر", "الإجمالي", ""]} />
            <tbody>
              {items.map((it, i) => (
                <TRow key={i} alt={i % 2}>
                  <td style={{ padding: "6px 10px" }}>
                    <select value={it.category} onChange={e => updateItem(i, "category", e.target.value)}
                      style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 8px", color: C.text, fontSize: 12, fontFamily: "inherit" }}>
                      <option value="">فئة</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "6px 10px" }}>
                    <input value={it.name} onChange={e => updateItem(i, "name", e.target.value)}
                      placeholder="اسم الصنف"
                      style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 8px", color: C.text, fontSize: 12, fontFamily: "inherit", width: "100%" }} />
                  </td>
                  <td style={{ padding: "6px 10px" }}>
                    <input type="number" value={it.qty} onChange={e => updateItem(i, "qty", e.target.value)}
                      style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 8px", color: C.text, fontSize: 12, fontFamily: "inherit", width: 60 }} />
                  </td>
                  <td style={{ padding: "6px 10px" }}>
                    <input type="number" value={it.price} onChange={e => updateItem(i, "price", e.target.value)}
                      style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 8px", color: C.text, fontSize: 12, fontFamily: "inherit", width: 80 }} />
                  </td>
                  <TD mono color={C.accent}>{fmt(it.qty * it.price)}</TD>
                  <td style={{ padding: "6px 10px" }}>
                    <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", cursor: "pointer", color: C.red }}><Ic d={I.trash} s={14} /></button>
                  </td>
                </TRow>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ background: C.surface2, borderRadius: 10, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          { label: "المجموع قبل الضريبة", val: fmt(subtotal), color: C.text },
          { label: `ضريبة ${form.taxRate}%`, val: fmt(taxAmount), color: C.yellow },
          { label: "الإجمالي الكلي", val: fmt(total), color: C.accent, bold: true },
          { label: "المدفوع", val: fmt(paid), color: C.green },
          { label: "المتبقي", val: fmt(total - paid), color: total - paid > 0 ? C.red : C.green },
        ].map(r => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: r.bold ? 14 : 12, borderTop: r.bold ? `1px solid ${C.border}` : "none", paddingTop: r.bold ? 8 : 0 }}>
            <span style={{ color: C.textMuted, fontWeight: r.bold ? 700 : 400 }}>{r.label}</span>
            <span style={{ color: r.color, fontWeight: 700, fontFamily: "monospace" }}>{r.val}</span>
          </div>
        ))}
      </div>
      <Inp label="ملاحظات" value={form.notes} onChange={v => setForm({ ...form, notes: v })} placeholder="أي ملاحظات إضافية..." />
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>إلغاء</Btn>
        <Btn onClick={handleSave}>حفظ الفاتورة</Btn>
      </div>
    </div>
  );
}

// ─── INVOICES PAGE ────────────────────────────────────────────────────────────
function InvoicesPage({ title, invoices, type, clients, suppliers, categories, inventory, onAdd, onDelete }) {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [confirm, setConfirm] = useState(null);

  const filtered = invoices.filter(i => {
    const party = type === "sales" ? i.client : i.supplier;
    const matchSearch = party?.includes(search) || i.id?.includes(search);
    const matchStatus = !statusFilter || i.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const total = filtered.reduce((s, i) => s + i.amount, 0);
  const totalPaid = filtered.reduce((s, i) => s + i.paid, 0);
  const totalTax = filtered.reduce((s, i) => s + (i.taxAmount || 0), 0);

  const handleDelete = (id) => {
    setConfirm({ id, msg: `هل أنت متأكد من حذف الفاتورة رقم ${id}؟ لا يمكن التراجع عن هذا الإجراء.` });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {confirm && (
        <ConfirmDialog
          message={confirm.msg}
          onConfirm={() => { onDelete(confirm.id); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}
      <PageHeader title={title} subtitle={`${filtered.length} فاتورة`}
        action={<Btn onClick={() => setShowModal(true)}><Ic d={I.plus} s={14} />فاتورة جديدة</Btn>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <MiniStat label="الإجمالي" value={fmt(total)} color={C.accent} />
        <MiniStat label="المدفوع" value={fmt(totalPaid)} color={C.green} />
        <MiniStat label="المتبقي" value={fmt(total - totalPaid)} color={C.red} />
        <MiniStat label="الضرائب" value={fmt(totalTax)} color={C.yellow} />
      </div>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10, alignItems: "center" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الرقم..."
            style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", color: C.text, fontSize: 12, fontFamily: "inherit", outline: "none", width: 220 }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", color: C.text, fontSize: 12, fontFamily: "inherit" }}>
            <option value="">كل الحالات</option>
            <option>مدفوعة</option><option>جزئية</option><option>غير مدفوعة</option>
          </select>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <THead cols={["رقم الفاتورة", "التاريخ", type === "sales" ? "العميل" : "المورد", "الأصناف", "قبل الضريبة", "الضريبة", "الإجمالي", "المدفوع", "المتبقي", "الحالة", "طباعة", ""]} />
            <tbody>
              {filtered.map((inv, idx) => {
                const party = type === "sales" ? inv.client : inv.supplier;
                const remaining = inv.amount - inv.paid;
                const itemNames = (inv.items || []).map(it => it.name).filter(Boolean).join("، ");
                return (
                  <TRow key={inv.id} alt={idx % 2}>
                    <TD color={C.accent}><span style={{ fontWeight: 700 }}>{inv.id}</span></TD>
                    <TD color={C.textDim}>{inv.date}</TD>
                    <TD><span style={{ fontWeight: 600 }}>{party}</span></TD>
                    <TD color={C.textMuted}><span style={{ fontSize: 11 }}>{itemNames || "—"}</span></TD>
                    <TD mono color={C.textDim}>{fmt(inv.subtotal || inv.amount)}</TD>
                    <TD mono color={C.yellow}>{fmt(inv.taxAmount || 0)}</TD>
                    <TD mono><span style={{ fontWeight: 700 }}>{fmt(inv.amount)}</span></TD>
                    <TD mono color={C.green}>{fmt(inv.paid)}</TD>
                    <TD mono color={remaining > 0 ? C.red : C.textMuted}>{fmt(remaining)}</TD>
                    <td style={{ padding: "11px 14px" }}><Badge label={inv.status} /></td>
                    <td style={{ padding: "11px 14px" }}>
                      <button onClick={() => printInvoice(inv, type)} title="طباعة PDF" style={{ background: "none", border: "none", cursor: "pointer", color: C.blue, borderRadius: 6 }}>
                        <Ic d={I.print} s={14} />
                      </button>
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <button onClick={() => handleDelete(inv.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, borderRadius: 6 }}>
                        <Ic d={I.trash} s={14} />
                      </button>
                    </td>
                  </TRow>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ padding: 40, textAlign: "center", color: C.textMuted, fontSize: 13 }}>لا توجد فواتير</div>}
        </div>
      </Card>

      {showModal && (
        <Modal title={`فاتورة ${type === "sales" ? "مبيعات" : "مشتريات"} جديدة`} onClose={() => setShowModal(false)} wide>
          <InvoiceForm type={type} clients={clients} suppliers={suppliers} categories={categories} inventory={inventory}
            onSave={inv => { onAdd(inv); setShowModal(false); }} onClose={() => setShowModal(false)} />
        </Modal>
      )}
    </div>
  );
}

// ─── ACCOUNT STATEMENT ────────────────────────────────────────────────────────
function AccountStatement({ parties, invoices, type, onAddParty, onDeleteParty }) {
  const [selected, setSelected] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [addForm, setAddForm] = useState({ name: "", phone: "" });
  const key = type === "client" ? "client" : "supplier";
  const isClient = type === "client";

  const getStmt = (name) => invoices.filter(i => i[key] === name);
  const sel = parties.find(p => p.name === selected);
  const stmt = selected ? getStmt(selected) : [];
  const totalAmt = stmt.reduce((s, i) => s + i.amount, 0);
  const totalPaid = stmt.reduce((s, i) => s + i.paid, 0);
  const balance = totalAmt - totalPaid;

  const handleAddParty = () => {
    if (!addForm.name.trim()) return;
    onAddParty({
      id: (isClient ? "C" : "SP") + Date.now().toString().slice(-5),
      name: addForm.name.trim(),
      phone: addForm.phone.trim(),
      balance: 0,
    });
    setAddForm({ name: "", phone: "" });
    setShowAddModal(false);
  };

  const handleDeleteParty = (name) => {
    setConfirm({ name, msg: `هل أنت متأكد من حذف "${name}"؟ سيتم حذف بياناته بالكامل.` });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {confirm && (
        <ConfirmDialog
          message={confirm.msg}
          onConfirm={() => { onDeleteParty(confirm.name); if (selected === confirm.name) setSelected(null); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}
      <PageHeader
        title={`كشف حساب ${isClient ? "العملاء" : "الموردين"}`}
        subtitle={`تتبع كل حركة مالية لكل ${isClient ? "عميل" : "مورد"}`}
        action={
          <Btn onClick={() => setShowAddModal(true)}>
            <Ic d={I.userPlus} s={14} />
            {isClient ? "إضافة عميل" : "إضافة مورد"}
          </Btn>
        }
      />

      {showAddModal && (
        <Modal title={isClient ? "إضافة عميل جديد" : "إضافة مورد جديد"} onClose={() => setShowAddModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Inp label={isClient ? "اسم العميل" : "اسم المورد"} value={addForm.name} onChange={v => setAddForm({ ...addForm, name: v })} required />
            <Inp label="رقم الهاتف" value={addForm.phone} onChange={v => setAddForm({ ...addForm, phone: v })} placeholder="01xxxxxxxxx" />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setShowAddModal(false)}>إلغاء</Btn>
              <Btn onClick={handleAddParty}>حفظ</Btn>
            </div>
          </div>
        </Modal>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 18, alignItems: "start" }}>
        <Card style={{ padding: 0 }}>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
            قائمة {isClient ? "العملاء" : "الموردين"}
          </div>
          {parties.map(p => {
            const bal = getStmt(p.name).reduce((s, i) => s + (i.amount - i.paid), 0);
            return (
              <div key={p.id} onClick={() => setSelected(p.name)} style={{
                padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${C.border}`,
                background: selected === p.name ? C.accentDim : "transparent",
                borderRight: `3px solid ${selected === p.name ? C.accent : "transparent"}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: bal > 0 ? C.red : C.green, marginTop: 2, fontFamily: "monospace" }}>
                    {bal > 0 ? `مديون: ${fmt(bal)}` : "✓ مسدد"}
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); handleDeleteParty(p.name); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, opacity: 0.5 }}>
                  <Ic d={I.trash} s={12} />
                </button>
              </div>
            );
          })}
          {parties.length === 0 && <div style={{ padding: 20, textAlign: "center", color: C.textMuted, fontSize: 12 }}>لا يوجد {isClient ? "عملاء" : "موردون"}</div>}
        </Card>

        <div>
          {selected ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text }}>{selected}</h2>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{sel?.phone}</div>
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>الرصيد الحالي</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: balance > 0 ? C.red : C.green, fontFamily: "monospace" }}>{fmt(balance)}</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 16 }}>
                  {[
                    { label: "إجمالي المعاملات", val: totalAmt, color: C.text },
                    { label: "إجمالي المدفوع", val: totalPaid, color: C.green },
                    { label: "المتبقي", val: balance, color: balance > 0 ? C.red : C.green },
                  ].map(s => (
                    <div key={s.label} style={{ background: C.surface2, borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>{s.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: s.color, fontFamily: "monospace", marginTop: 4 }}>{fmt(s.val)}</div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card style={{ padding: 0 }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700, color: C.text }}>سجل الفواتير</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <THead cols={["رقم الفاتورة", "التاريخ", "الإجمالي", "المدفوع", "المتبقي", "الحالة"]} />
                  <tbody>
                    {stmt.map((inv, i) => (
                      <TRow key={inv.id} alt={i % 2}>
                        <TD color={C.accent}>{inv.id}</TD>
                        <TD color={C.textDim}>{inv.date}</TD>
                        <TD mono>{fmt(inv.amount)}</TD>
                        <TD mono color={C.green}>{fmt(inv.paid)}</TD>
                        <TD mono color={(inv.amount - inv.paid) > 0 ? C.red : C.textMuted}>{fmt(inv.amount - inv.paid)}</TD>
                        <td style={{ padding: "11px 14px" }}><Badge label={inv.status} /></td>
                      </TRow>
                    ))}
                  </tbody>
                </table>
                {stmt.length === 0 && <div style={{ padding: 20, textAlign: "center", color: C.textMuted, fontSize: 12 }}>لا توجد فواتير</div>}
              </Card>
            </div>
          ) : (
            <Card style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
              <div style={{ textAlign: "center", color: C.textMuted }}>
                <Ic d={I.clients} s={36} c={C.border} />
                <div style={{ marginTop: 10, fontSize: 13 }}>اختر {isClient ? "عميلاً" : "مورداً"} لعرض كشف الحساب</div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── REPORTS PAGE ─────────────────────────────────────────────────────────────
function ReportsPage({ data }) {
  const [period, setPeriod] = useState("monthly");
  const [selectedMonth, setSelectedMonth] = useState(today().slice(0, 7));

  const allInvoices = [...data.salesInvoices, ...data.purchaseInvoices];
  const months = [...new Set(allInvoices.map(i => getMonth(i.date)))].sort().reverse();

  const salesByMonth = useMemo(() => {
    const map = {};
    data.salesInvoices.forEach(i => {
      const m = getMonth(i.date);
      if (!map[m]) map[m] = { sales: 0, purchases: 0, paid: 0, unpaid: 0, count: 0 };
      map[m].sales += i.amount; map[m].paid += i.paid; map[m].unpaid += (i.amount - i.paid); map[m].count++;
    });
    data.purchaseInvoices.forEach(i => {
      const m = getMonth(i.date);
      if (!map[m]) map[m] = { sales: 0, purchases: 0, paid: 0, unpaid: 0, count: 0 };
      map[m].purchases += i.amount;
    });
    return map;
  }, [data]);

  const monthData = salesByMonth[selectedMonth] || { sales: 0, purchases: 0, paid: 0, unpaid: 0, count: 0 };
  const profit = monthData.sales - monthData.purchases;

  const filteredSales = data.salesInvoices.filter(i => getMonth(i.date) === selectedMonth);
  const filteredPurchases = data.purchaseInvoices.filter(i => getMonth(i.date) === selectedMonth);

  const catSales = {};
  filteredSales.forEach(inv => {
    (inv.items || []).forEach(it => {
      const c = it.category || "غير محدد";
      catSales[c] = (catSales[c] || 0) + it.qty * it.price;
    });
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PageHeader title="التقارير المالية" subtitle="تقارير تفصيلية شهرية ويومية"
        action={
          <Btn variant="success" onClick={() => printFinancialReport(data, period, selectedMonth)}>
            <Ic d={I.print} s={14} />تحميل التقرير
          </Btn>
        }
      />

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ display: "flex", background: C.surface2, borderRadius: 10, padding: 3 }}>
          {["monthly", "daily"].map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              background: period === p ? C.accent : "transparent", color: period === p ? "#fff" : C.textMuted,
              border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>
              {p === "monthly" ? "شهري" : "يومي"}
            </button>
          ))}
        </div>
        <Sel value={selectedMonth} onChange={setSelectedMonth}
          options={months.map(m => ({ value: m, label: m }))} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <MiniStat label="المبيعات" value={fmt(monthData.sales)} color={C.green} />
        <MiniStat label="المشتريات" value={fmt(monthData.purchases)} color={C.red} />
        <MiniStat label="صافي الربح" value={fmt(profit)} color={profit >= 0 ? C.green : C.red} />
        <MiniStat label="المدفوع" value={fmt(monthData.paid)} color={C.accent} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: C.text }}>المبيعات حسب الفئة</h3>
          {Object.keys(catSales).length === 0 ? (
            <div style={{ textAlign: "center", color: C.textMuted, padding: 20, fontSize: 13 }}>لا توجد بيانات لهذا الشهر</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.entries(catSales).sort((a, b) => b[1] - a[1]).map(([cat, val]) => {
                const max = Math.max(...Object.values(catSales));
                return (
                  <div key={cat}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: C.textDim, fontWeight: 600 }}>{cat}</span>
                      <span style={{ fontSize: 12, color: C.accent, fontFamily: "monospace", fontWeight: 700 }}>{fmt(val)}</span>
                    </div>
                    <ProgressBar value={val} max={max} color={C.accent} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: C.text }}>تاريخ الأشهر</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {months.slice(0, 6).map(m => {
              const d = salesByMonth[m] || {};
              const p = (d.sales || 0) - (d.purchases || 0);
              return (
                <div key={m} onClick={() => setSelectedMonth(m)} style={{
                  padding: "10px 14px", background: selectedMonth === m ? C.accentDim : C.surface2,
                  borderRadius: 10, cursor: "pointer", border: `1px solid ${selectedMonth === m ? C.accent + "44" : "transparent"}`,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{m}</span>
                  <div style={{ display: "flex", gap: 14 }}>
                    <span style={{ fontSize: 11, color: C.green, fontFamily: "monospace" }}>{fmt(d.sales || 0)}</span>
                    <span style={{ fontSize: 11, color: p >= 0 ? C.green : C.red, fontFamily: "monospace" }}>
                      {p >= 0 ? "+" : ""}{fmt(p)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 700, color: C.text }}>
          فواتير المبيعات — {selectedMonth}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <THead cols={["رقم الفاتورة", "التاريخ", "العميل", "الإجمالي", "المدفوع", "المتبقي", "الحالة"]} />
          <tbody>
            {filteredSales.map((inv, i) => (
              <TRow key={inv.id} alt={i % 2}>
                <TD color={C.accent}>{inv.id}</TD>
                <TD color={C.textDim}>{inv.date}</TD>
                <TD>{inv.client}</TD>
                <TD mono>{fmt(inv.amount)}</TD>
                <TD mono color={C.green}>{fmt(inv.paid)}</TD>
                <TD mono color={(inv.amount - inv.paid) > 0 ? C.red : C.textMuted}>{fmt(inv.amount - inv.paid)}</TD>
                <td style={{ padding: "11px 14px" }}><Badge label={inv.status} /></td>
              </TRow>
            ))}
          </tbody>
        </table>
        {filteredSales.length === 0 && <div style={{ padding: 30, textAlign: "center", color: C.textMuted, fontSize: 13 }}>لا توجد فواتير لهذا الشهر</div>}
      </Card>
    </div>
  );
}

// ─── RETURNS PAGE ─────────────────────────────────────────────────────────────
function ReturnsPage({ returns, salesInvoices, purchaseInvoices, clients, suppliers, onAdd, onDelete }) {
  const [showModal, setShowModal] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [form, setForm] = useState({ date: today(), type: "sales", invoiceId: "", party: "", amount: "", reason: "" });

  const invoiceList = form.type === "sales" ? salesInvoices : purchaseInvoices;
  const partyList = form.type === "sales" ? clients : suppliers;
  const partyKey = form.type === "sales" ? "client" : "supplier";

  const handleSave = () => {
    if (!form.party || !form.amount) return;
    onAdd({
      id: "R" + Date.now().toString().slice(-5),
      date: form.date, type: form.type,
      invoiceId: form.invoiceId, party: form.party,
      amount: parseFloat(form.amount) || 0, reason: form.reason,
    });
    setShowModal(false);
    setForm({ date: today(), type: "sales", invoiceId: "", party: "", amount: "", reason: "" });
  };

  const totalReturns = returns.reduce((s, r) => s + r.amount, 0);
  const salesReturns = returns.filter(r => r.type === "sales").reduce((s, r) => s + r.amount, 0);
  const purchaseReturns = returns.filter(r => r.type === "purchase").reduce((s, r) => s + r.amount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {confirm && (
        <ConfirmDialog
          message={confirm.msg}
          onConfirm={() => { onDelete(confirm.id); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}
      <PageHeader title="المرتجعات" subtitle={`${returns.length} مرتجع مسجل`}
        action={<Btn onClick={() => setShowModal(true)}><Ic d={I.plus} s={14} />مرتجع جديد</Btn>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <MiniStat label="إجمالي المرتجعات" value={fmt(totalReturns)} color={C.purple} />
        <MiniStat label="مرتجعات مبيعات" value={fmt(salesReturns)} color={C.red} />
        <MiniStat label="مرتجعات مشتريات" value={fmt(purchaseReturns)} color={C.green} />
      </div>

      <Card style={{ padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <THead cols={["رقم المرتجع", "التاريخ", "النوع", "الطرف", "رقم الفاتورة", "المبلغ", "السبب", ""]} />
          <tbody>
            {returns.map((r, i) => (
              <TRow key={r.id} alt={i % 2}>
                <TD color={C.purple}><span style={{ fontWeight: 700 }}>{r.id}</span></TD>
                <TD color={C.textDim}>{r.date}</TD>
                <TD><Badge label="مرتجع" /></TD>
                <TD>{r.party}</TD>
                <TD color={C.accent}>{r.invoiceId || "—"}</TD>
                <TD mono color={C.red}>{fmt(r.amount)}</TD>
                <TD color={C.textMuted}>{r.reason || "—"}</TD>
                <td style={{ padding: "11px 14px" }}>
                  <button onClick={() => setConfirm({ id: r.id, msg: `هل أنت متأكد من حذف المرتجع ${r.id}؟` })} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}>
                    <Ic d={I.trash} s={14} />
                  </button>
                </td>
              </TRow>
            ))}
          </tbody>
        </table>
        {returns.length === 0 && <div style={{ padding: 40, textAlign: "center", color: C.textMuted, fontSize: 13 }}>لا توجد مرتجعات</div>}
      </Card>

      {showModal && (
        <Modal title="مرتجع جديد" onClose={() => setShowModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp label="التاريخ" type="date" value={form.date} onChange={v => setForm({ ...form, date: v })} />
              <Sel label="نوع المرتجع" value={form.type} onChange={v => setForm({ ...form, type: v, invoiceId: "", party: "" })}
                options={[{ value: "sales", label: "مرتجع مبيعات" }, { value: "purchase", label: "مرتجع مشتريات" }]} />
              <Sel label="الطرف" value={form.party} onChange={v => setForm({ ...form, party: v })}
                options={partyList.map(p => ({ value: p.name, label: p.name }))} />
              <Sel label="رقم الفاتورة (اختياري)" value={form.invoiceId} onChange={v => setForm({ ...form, invoiceId: v })}
                options={invoiceList.filter(i => i[partyKey] === form.party).map(i => ({ value: i.id, label: i.id }))}
                placeholder="-- اختياري --" />
              <Inp label="المبلغ المرتجع" type="number" value={form.amount} onChange={v => setForm({ ...form, amount: v })} required />
            </div>
            <Inp label="سبب المرتجع" value={form.reason} onChange={v => setForm({ ...form, reason: v })} placeholder="وصف سبب الإرجاع..." />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setShowModal(false)}>إلغاء</Btn>
              <Btn onClick={handleSave}>حفظ المرتجع</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── REVENUE PAGE ─────────────────────────────────────────────────────────────
function RevenuePage({ data, onDeleteMonth }) {
  const [confirm, setConfirm] = useState(null);

  const totalSales = data.salesInvoices.reduce((s, i) => s + i.amount, 0);
  const totalPurchases = data.purchaseInvoices.reduce((s, i) => s + i.amount, 0);
  const totalReturns = data.returns.reduce((s, r) => s + r.amount, 0);
  const totalTax = data.salesInvoices.reduce((s, i) => s + (i.taxAmount || 0), 0);
  const netRevenue = totalSales - totalReturns;
  const grossProfit = netRevenue - totalPurchases;
  const netProfit = grossProfit - totalTax;

  const clientRevenue = {};
  data.salesInvoices.forEach(i => {
    clientRevenue[i.client] = (clientRevenue[i.client] || 0) + i.amount;
  });
  const topClients = Object.entries(clientRevenue).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxClient = topClients[0]?.[1] || 1;

  const monthlyRev = {};
  data.salesInvoices.forEach(i => {
    const m = getMonth(i.date);
    monthlyRev[m] = (monthlyRev[m] || 0) + i.amount;
  });

  const handleDeleteMonth = (month) => {
    setConfirm({
      month,
      msg: `هل أنت متأكد من حذف كل بيانات شهر "${month}"؟ سيتم حذف جميع فواتير المبيعات والمشتريات والمرتجعات لهذا الشهر ولا يمكن التراجع.`,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {confirm && (
        <ConfirmDialog
          message={confirm.msg}
          onConfirm={() => { onDeleteMonth(confirm.month); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}
      <PageHeader title="الإيرادات" subtitle="تحليل شامل للإيرادات والأرباح" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <MiniStat label="إجمالي المبيعات" value={fmt(totalSales)} color={C.green} />
        <MiniStat label="صافي الإيرادات" value={fmt(netRevenue)} color={C.blue} />
        <MiniStat label="إجمالي الربح" value={fmt(grossProfit)} color={grossProfit >= 0 ? C.green : C.red} />
        <MiniStat label="صافي الربح" value={fmt(netProfit)} color={netProfit >= 0 ? C.green : C.red} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <h3 style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 700, color: C.text }}>أعلى العملاء إيراداً</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {topClients.map(([name, val], i) => (
              <div key={name}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{name}</span>
                  <span style={{ fontSize: 12, color: C.green, fontFamily: "monospace", fontWeight: 700 }}>{fmt(val)}</span>
                </div>
                <ProgressBar value={val} max={maxClient} color={[C.green, C.accent, C.blue, C.yellow, C.purple][i]} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 700, color: C.text }}>ملخص مالي</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "إجمالي المبيعات", val: totalSales, color: C.green },
              { label: "المرتجعات", val: -totalReturns, color: C.red },
              { label: "صافي المبيعات", val: netRevenue, color: C.blue, sep: true },
              { label: "تكلفة المشتريات", val: -totalPurchases, color: C.red },
              { label: "إجمالي الربح", val: grossProfit, color: grossProfit >= 0 ? C.green : C.red, sep: true },
              { label: "الضرائب", val: -totalTax, color: C.yellow },
              { label: "صافي الربح", val: netProfit, color: netProfit >= 0 ? C.green : C.red, sep: true, bold: true },
            ].map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: r.sep ? 8 : 0, borderTop: r.sep ? `1px solid ${C.border}` : "none" }}>
                <span style={{ fontSize: r.bold ? 13 : 12, color: C.textMuted, fontWeight: r.bold ? 700 : 400 }}>{r.label}</span>
                <span style={{ fontSize: r.bold ? 14 : 12, color: r.color, fontWeight: 700, fontFamily: "monospace" }}>
                  {r.val < 0 ? "-" : ""}{fmt(Math.abs(r.val))}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <h3 style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 700, color: C.text }}>الإيرادات الشهرية</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Object.entries(monthlyRev).sort((a, b) => b[0].localeCompare(a[0])).map(([month, val]) => {
            const maxVal = Math.max(...Object.values(monthlyRev));
            return (
              <div key={month} style={{ display: "grid", gridTemplateColumns: "100px 1fr 120px auto", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: C.textDim, fontWeight: 600 }}>{month}</span>
                <ProgressBar value={val} max={maxVal} color={C.green} />
                <span style={{ fontSize: 12, color: C.green, fontFamily: "monospace", fontWeight: 700, textAlign: "left" }}>{fmt(val)}</span>
                <button
                  onClick={() => handleDeleteMonth(month)}
                  title={`حذف كل بيانات ${month}`}
                  style={{ background: C.redDim, border: `1px solid ${C.red}33`, borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: C.red, display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}
                >
                  <Ic d={I.trash} s={12} c={C.red} />مسح الشهر
                </button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─── INVENTORY PAGE ───────────────────────────────────────────────────────────
function InventoryPage({ inventory, categories, onAdd, onUpdate, onDelete, onBulkAdd }) {
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [uploadMsg, setUploadMsg] = useState("");

  const [form, setForm] = useState({ name: "", category: "", qty: "", minQty: "", cost: "", price: "", unit: "قطعة" });

  const filtered = inventory.filter(p => {
    const ms = p.name?.includes(search) || p.category?.includes(search);
    const mc = !catFilter || p.category === catFilter;
    return ms && mc;
  });

  const totalValue = inventory.reduce((s, p) => s + p.qty * p.cost, 0);
  const totalSaleValue = inventory.reduce((s, p) => s + p.qty * p.price, 0);
  const lowCount = inventory.filter(p => p.qty <= p.minQty).length;

  const handleSave = () => {
    if (!form.name || !form.qty) return;
    const item = {
      id: editItem?.id || "INV" + Date.now().toString().slice(-5),
      name: form.name, category: form.category,
      qty: parseFloat(form.qty) || 0, minQty: parseFloat(form.minQty) || 0,
      cost: parseFloat(form.cost) || 0, price: parseFloat(form.price) || 0,
      unit: form.unit,
    };
    if (editItem) onUpdate(item); else onAdd(item);
    setShowModal(false); setEditItem(null);
    setForm({ name: "", category: "", qty: "", minQty: "", cost: "", price: "", unit: "قطعة" });
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({ name: item.name, category: item.category, qty: item.qty, minQty: item.minQty, cost: item.cost, price: item.price, unit: item.unit });
    setShowModal(true);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const items = parseInventoryCSV(text, categories);
        if (items.length === 0) { setUploadMsg("لم يتم العثور على بيانات صالحة في الملف"); return; }
        onBulkAdd(items);
        setUploadMsg(`تم استيراد ${items.length} صنف بنجاح ✓`);
        setTimeout(() => setUploadMsg(""), 3000);
      } catch {
        setUploadMsg("حدث خطأ في قراءة الملف");
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {confirm && (
        <ConfirmDialog
          message={confirm.msg}
          onConfirm={() => { onDelete(confirm.id); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}
      <PageHeader title="إدارة المخزون" subtitle={`${inventory.length} صنف`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="ghost" onClick={downloadInventoryTemplate}>
              <Ic d={I.download} s={14} />تحميل قالب Excel
            </Btn>
            <label style={{
              background: C.greenDim, color: C.green, border: `1px solid ${C.green}33`,
              borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              <Ic d={I.upload} s={14} c={C.green} />رفع ملف CSV
              <input type="file" accept=".csv,.txt" onChange={handleFileUpload} style={{ display: "none" }} />
            </label>
            <Btn onClick={() => { setEditItem(null); setForm({ name: "", category: "", qty: "", minQty: "", cost: "", price: "", unit: "قطعة" }); setShowModal(true); }}>
              <Ic d={I.plus} s={14} />صنف جديد
            </Btn>
          </div>
        }
      />

      {uploadMsg && (
        <div style={{ background: uploadMsg.includes("✓") ? C.greenDim : C.redDim, border: `1px solid ${uploadMsg.includes("✓") ? C.green : C.red}44`, borderRadius: 10, padding: "10px 16px", fontSize: 13, color: uploadMsg.includes("✓") ? C.green : C.red, fontWeight: 600 }}>
          {uploadMsg}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <MiniStat label="عدد الأصناف" value={fmtNum(inventory.length)} color={C.accent} />
        <MiniStat label="قيمة المخزون بالتكلفة" value={fmt(totalValue)} color={C.blue} />
        <MiniStat label="قيمة المخزون بالبيع" value={fmt(totalSaleValue)} color={C.green} />
        <MiniStat label="أصناف منخفضة" value={fmtNum(lowCount)} color={lowCount > 0 ? C.red : C.green} />
      </div>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن صنف..."
            style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", color: C.text, fontSize: 12, fontFamily: "inherit", outline: "none", width: 200 }} />
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", color: C.text, fontSize: 12, fontFamily: "inherit" }}>
            <option value="">كل الفئات</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <THead cols={["الكود", "اسم الصنف", "الفئة", "الكمية", "الحد الأدنى", "سعر التكلفة", "سعر البيع", "قيمة المخزون", "الحالة", ""]} />
          <tbody>
            {filtered.map((p, i) => (
              <TRow key={p.id} alt={i % 2}>
                <TD color={C.accent}>{p.id}</TD>
                <TD><span style={{ fontWeight: 600 }}>{p.name}</span></TD>
                <TD color={C.textDim}>{p.category}</TD>
                <td style={{ padding: "11px 14px" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: p.qty <= p.minQty ? C.red : C.text, fontFamily: "monospace" }}>
                    {fmtNum(p.qty)} {p.unit}
                  </span>
                </td>
                <TD mono color={C.textMuted}>{fmtNum(p.minQty)}</TD>
                <TD mono color={C.textDim}>{fmt(p.cost)}</TD>
                <TD mono color={C.green}>{fmt(p.price)}</TD>
                <TD mono color={C.blue}>{fmt(p.qty * p.cost)}</TD>
                <td style={{ padding: "11px 14px" }}><Badge label={p.qty <= p.minQty ? "منخفض" : "كافي"} /></td>
                <td style={{ padding: "11px 14px", display: "flex", gap: 6 }}>
                  <button onClick={() => openEdit(p)} style={{ background: "none", border: "none", cursor: "pointer", color: C.accent }}><Ic d={I.edit} s={14} /></button>
                  <button onClick={() => setConfirm({ id: p.id, msg: `هل أنت متأكد من حذف الصنف "${p.name}"؟` })} style={{ background: "none", border: "none", cursor: "pointer", color: C.red }}><Ic d={I.trash} s={14} /></button>
                </td>
              </TRow>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: 40, textAlign: "center", color: C.textMuted, fontSize: 13 }}>لا توجد أصناف</div>}
      </Card>

      {showModal && (
        <Modal title={editItem ? "تعديل الصنف" : "صنف جديد"} onClose={() => { setShowModal(false); setEditItem(null); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp label="اسم الصنف" value={form.name} onChange={v => setForm({ ...form, name: v })} required />
              <Sel label="الفئة" value={form.category} onChange={v => setForm({ ...form, category: v })} options={categories} />
              <Inp label="الكمية الحالية" type="number" value={form.qty} onChange={v => setForm({ ...form, qty: v })} required />
              <Inp label="الحد الأدنى للتنبيه" type="number" value={form.minQty} onChange={v => setForm({ ...form, minQty: v })} />
              <Inp label="سعر التكلفة" type="number" value={form.cost} onChange={v => setForm({ ...form, cost: v })} />
              <Inp label="سعر البيع" type="number" value={form.price} onChange={v => setForm({ ...form, price: v })} />
              <Inp label="وحدة القياس" value={form.unit} onChange={v => setForm({ ...form, unit: v })} placeholder="قطعة / كيلو / متر..." />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => { setShowModal(false); setEditItem(null); }}>إلغاء</Btn>
              <Btn onClick={handleSave}>{editItem ? "تحديث" : "حفظ"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── TAX INVOICES PAGE ────────────────────────────────────────────────────────
function TaxInvoicesPage({ salesInvoices, purchaseInvoices }) {
  const [type, setType] = useState("sales");
  const invoices = type === "sales" ? salesInvoices : purchaseInvoices;
  const filtered = invoices.filter(i => i.taxRate > 0);

  const totalTax = filtered.reduce((s, i) => s + (i.taxAmount || 0), 0);
  const totalBefore = filtered.reduce((s, i) => s + (i.subtotal || i.amount), 0);
  const totalAfter = filtered.reduce((s, i) => s + i.amount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader title="الفواتير الضريبية" subtitle="إدارة ضريبة القيمة المضافة" />

      <div style={{ display: "flex", background: C.surface2, borderRadius: 10, padding: 3, width: "fit-content" }}>
        {["sales", "purchase"].map(t => (
          <button key={t} onClick={() => setType(t)} style={{
            background: type === t ? C.accent : "transparent", color: type === t ? "#fff" : C.textMuted,
            border: "none", borderRadius: 8, padding: "7px 18px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>
            {t === "sales" ? "ضريبة المبيعات" : "ضريبة المشتريات"}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <MiniStat label="قبل الضريبة" value={fmt(totalBefore)} color={C.textDim} />
        <MiniStat label="إجمالي الضريبة" value={fmt(totalTax)} color={C.yellow} />
        <MiniStat label="بعد الضريبة" value={fmt(totalAfter)} color={C.accent} />
      </div>

      <Card style={{ padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <THead cols={["رقم الفاتورة", "التاريخ", type === "sales" ? "العميل" : "المورد", "قبل الضريبة", "نسبة الضريبة", "مبلغ الضريبة", "الإجمالي", "الحالة", "طباعة"]} />
          <tbody>
            {filtered.map((inv, i) => {
              const party = type === "sales" ? inv.client : inv.supplier;
              return (
                <TRow key={inv.id} alt={i % 2}>
                  <TD color={C.accent}><span style={{ fontWeight: 700 }}>{inv.id}</span></TD>
                  <TD color={C.textDim}>{inv.date}</TD>
                  <TD>{party}</TD>
                  <TD mono color={C.textDim}>{fmt(inv.subtotal || inv.amount)}</TD>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{ background: C.yellowDim, color: C.yellow, border: `1px solid ${C.yellow}33`, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                      {inv.taxRate}%
                    </span>
                  </td>
                  <TD mono color={C.yellow}>{fmt(inv.taxAmount || 0)}</TD>
                  <TD mono><span style={{ fontWeight: 700 }}>{fmt(inv.amount)}</span></TD>
                  <td style={{ padding: "11px 14px" }}><Badge label={inv.status} /></td>
                  <td style={{ padding: "11px 14px" }}>
                    <button onClick={() => printTaxInvoice(inv, type)} title="طباعة الفاتورة الضريبية"
                      style={{ background: C.yellowDim, border: `1px solid ${C.yellow}33`, borderRadius: 6, padding: "5px 10px", cursor: "pointer", color: C.yellow, display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>
                      <Ic d={I.print} s={12} c={C.yellow} />طباعة
                    </button>
                  </td>
                </TRow>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: 40, textAlign: "center", color: C.textMuted, fontSize: 13 }}>لا توجد فواتير ضريبية</div>}
      </Card>
    </div>
  );
}

// ─── STOCKTAKE PAGE ───────────────────────────────────────────────────────────
function StocktakePage({ inventory, categories }) {
  const [period, setPeriod] = useState("weekly");
  const [catFilter, setCatFilter] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(today().slice(0, 7));

  const filtered = inventory.filter(p => !catFilter || p.category === catFilter);
  const totalQty = filtered.reduce((s, p) => s + p.qty, 0);
  const totalCostVal = filtered.reduce((s, p) => s + p.qty * p.cost, 0);
  const totalSaleVal = filtered.reduce((s, p) => s + p.qty * p.price, 0);
  const lowItems = filtered.filter(p => p.qty <= p.minQty);
  const okItems = filtered.filter(p => p.qty > p.minQty);

  const catGroups = {};
  filtered.forEach(p => {
    const c = p.category || "غير محدد";
    if (!catGroups[c]) catGroups[c] = { count: 0, qty: 0, value: 0 };
    catGroups[c].count++; catGroups[c].qty += p.qty; catGroups[c].value += p.qty * p.cost;
  });

  const now = new Date();
  const reportDate = now.toLocaleDateString("ar-EG");
  const reportTitle = period === "weekly" ? `جرد أسبوعي — الأسبوع ${getWeek(today())}` : `جرد شهري — ${selectedMonth}`;

  // Generate months list from today back 12 months
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>الجرد الدوري</h1>
          <p style={{ margin: "4px 0 0", color: C.textMuted, fontSize: 13 }}>{reportDate}</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", background: C.surface2, borderRadius: 10, padding: 3 }}>
            {["weekly", "monthly"].map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                background: period === p ? C.accent : "transparent", color: period === p ? "#fff" : C.textMuted,
                border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>
                {p === "weekly" ? "أسبوعي" : "شهري"}
              </button>
            ))}
          </div>
          {period === "monthly" && (
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", color: C.text, fontSize: 12, fontFamily: "inherit" }}>
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", color: C.text, fontSize: 12, fontFamily: "inherit" }}>
            <option value="">كل الفئات</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <Btn variant="success" onClick={() => printStocktakeReport(filtered, period, period === "monthly" ? selectedMonth : `أسبوع ${getWeek(today())}`, categories)}>
            <Ic d={I.print} s={14} />طباعة الجرد
          </Btn>
        </div>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.accent}33`, borderRadius: 14, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{reportTitle}</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>تقرير جرد شامل لجميع الأصناف</div>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.green }}>{fmtNum(okItems.length)}</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>أصناف كافية</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.red }}>{fmtNum(lowItems.length)}</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>أصناف منخفضة</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <MiniStat label="إجمالي الأصناف" value={fmtNum(filtered.length)} color={C.accent} />
        <MiniStat label="إجمالي الكميات" value={fmtNum(totalQty)} color={C.blue} />
        <MiniStat label="قيمة المخزون" value={fmt(totalCostVal)} color={C.yellow} />
        <MiniStat label="قيمة البيع المتوقعة" value={fmt(totalSaleVal)} color={C.green} />
      </div>

      {/* النواقص وإضافة الكميات */}
      {lowItems.length > 0 && (
        <Card style={{ border: `1px solid ${C.red}33` }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: C.red }}>
            <Ic d={I.alert} s={14} c={C.red} /> النواقص — أصناف تحتاج تجديد
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <THead cols={["الصنف", "الفئة", "الكمية الحالية", "الحد الأدنى", "النقص المطلوب"]} />
              <tbody>
                {lowItems.map((p, i) => (
                  <TRow key={p.id} alt={i % 2}>
                    <TD><span style={{ fontWeight: 600, color: C.red }}>{p.name}</span></TD>
                    <TD color={C.textDim}>{p.category}</TD>
                    <TD mono color={C.red}>{fmtNum(p.qty)} {p.unit}</TD>
                    <TD mono color={C.textMuted}>{fmtNum(p.minQty)}</TD>
                    <TD mono color={C.yellow}>{fmtNum(Math.max(0, p.minQty - p.qty))} {p.unit}</TD>
                  </TRow>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: C.text }}>الجرد حسب الفئة</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.entries(catGroups).map(([cat, d]) => (
              <div key={cat} style={{ background: C.surface2, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{cat}</span>
                  <span style={{ fontSize: 11, color: C.textMuted }}>{d.count} صنف</span>
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <span style={{ fontSize: 11, color: C.blue }}>الكمية: {fmtNum(d.qty)}</span>
                  <span style={{ fontSize: 11, color: C.yellow }}>القيمة: {fmt(d.value)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: C.text }}>الأصناف المنخفضة</h3>
          {lowItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: 30, color: C.green }}>
              <Ic d={I.stocktake} s={36} c={C.green} />
              <div style={{ marginTop: 10, fontSize: 13 }}>لا توجد أصناف تحتاج تجديد</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {lowItems.map(p => (
                <div key={p.id} style={{ background: C.redDim, borderRadius: 10, padding: "12px 14px", border: `1px solid ${C.red}22`, display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{p.category}</div>
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.red, fontFamily: "monospace" }}>{fmtNum(p.qty)}</div>
                    <div style={{ fontSize: 10, color: C.textMuted }}>الحد الأدنى: {p.minQty}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 700, color: C.text }}>
          تفاصيل جميع الأصناف
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <THead cols={["الكود", "الصنف", "الفئة", "الكمية", "الحد الأدنى", "سعر التكلفة", "قيمة المخزون", "سعر البيع", "الحالة"]} />
          <tbody>
            {filtered.map((p, i) => (
              <TRow key={p.id} alt={i % 2}>
                <TD color={C.accent}>{p.id}</TD>
                <TD><span style={{ fontWeight: 600 }}>{p.name}</span></TD>
                <TD color={C.textDim}>{p.category}</TD>
                <td style={{ padding: "11px 14px" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: p.qty <= p.minQty ? C.red : C.green, fontFamily: "monospace" }}>
                    {fmtNum(p.qty)} {p.unit}
                  </span>
                </td>
                <TD mono color={C.textMuted}>{fmtNum(p.minQty)}</TD>
                <TD mono color={C.textDim}>{fmt(p.cost)}</TD>
                <TD mono color={C.blue}>{fmt(p.qty * p.cost)}</TD>
                <TD mono color={C.green}>{fmt(p.price)}</TD>
                <td style={{ padding: "11px 14px" }}><Badge label={p.qty <= p.minQty ? "منخفض" : "كافي"} /></td>
              </TRow>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── CATEGORIES PAGE ──────────────────────────────────────────────────────────
function CategoriesPage({ categories, inventory, onAddCategory, onDeleteCategory }) {
  const [newCat, setNewCat] = useState("");
  const [confirm, setConfirm] = useState(null);

  const catStats = categories.map(cat => {
    const items = inventory.filter(p => p.category === cat);
    const totalQty = items.reduce((s, p) => s + p.qty, 0);
    const totalValue = items.reduce((s, p) => s + p.qty * p.cost, 0);
    return { name: cat, count: items.length, qty: totalQty, value: totalValue };
  }).sort((a, b) => b.value - a.value);

  const maxVal = Math.max(...catStats.map(c => c.value), 1);

  const handleAdd = () => {
    if (!newCat.trim() || categories.includes(newCat.trim())) return;
    onAddCategory(newCat.trim());
    setNewCat("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {confirm && (
        <ConfirmDialog
          message={confirm.msg}
          onConfirm={() => { onDeleteCategory(confirm.name); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}
      <PageHeader title="إدارة الفئات" subtitle={`${categories.length} فئة مسجلة`} />

      <Card>
        <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: C.text }}>إضافة فئة جديدة</h3>
        <div style={{ display: "flex", gap: 10 }}>
          <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="اسم الفئة الجديدة..."
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            style={{ flex: 1, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 14px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
          <Btn onClick={handleAdd}><Ic d={I.plus} s={14} />إضافة</Btn>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {catStats.map((cat, i) => (
          <div key={cat.name} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: [C.accentDim, C.greenDim, C.yellowDim, C.purpleDim, C.blueDim, C.redDim][i % 6], display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Ic d={I.box} s={16} c={[C.accent, C.green, C.yellow, C.purple, C.blue, C.red][i % 6]} />
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{cat.name}</span>
              </div>
              <button
                onClick={() => {
                  if (cat.count > 0) return;
                  setConfirm({ name: cat.name, msg: `هل أنت متأكد من حذف الفئة "${cat.name}"؟` });
                }}
                style={{ background: "none", border: "none", cursor: cat.count > 0 ? "not-allowed" : "pointer", color: C.textMuted, opacity: cat.count > 0 ? 0.3 : 1 }}
                title={cat.count > 0 ? "الفئة مستخدمة" : "حذف الفئة"}>
                <Ic d={I.trash} s={14} />
              </button>
            </div>
            <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted }}>الأصناف</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.accent }}>{fmtNum(cat.count)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted }}>الكمية</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.blue }}>{fmtNum(cat.qty)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted }}>القيمة</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.yellow, fontFamily: "monospace" }}>{fmt(cat.value)}</div>
              </div>
            </div>
            <ProgressBar value={cat.value} max={maxVal} color={[C.accent, C.green, C.yellow, C.purple, C.blue, C.red][i % 6]} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("dashboard");
  const [data, setData] = useState(init);

  const upd = (key, val) => setData(d => ({ ...d, [key]: val }));

  const actions = {
    addSale: inv => upd("salesInvoices", [...data.salesInvoices, inv]),
    addPurchase: inv => upd("purchaseInvoices", [...data.purchaseInvoices, inv]),
    delSale: id => upd("salesInvoices", data.salesInvoices.filter(i => i.id !== id)),
    delPurchase: id => upd("purchaseInvoices", data.purchaseInvoices.filter(i => i.id !== id)),
    addReturn: r => upd("returns", [...data.returns, r]),
    delReturn: id => upd("returns", data.returns.filter(r => r.id !== id)),
    addInvItem: item => upd("inventory", [...data.inventory, item]),
    updateInvItem: item => upd("inventory", data.inventory.map(p => p.id === item.id ? item : p)),
    delInvItem: id => upd("inventory", data.inventory.filter(p => p.id !== id)),
    bulkAddInvItems: items => upd("inventory", [...data.inventory, ...items]),
    addCategory: cat => upd("categories", [...data.categories, cat]),
    delCategory: cat => upd("categories", data.categories.filter(c => c !== cat)),
    addClient: c => upd("clients", [...data.clients, c]),
    delClient: name => upd("clients", data.clients.filter(c => c.name !== name)),
    addSupplier: s => upd("suppliers", [...data.suppliers, s]),
    delSupplier: name => upd("suppliers", data.suppliers.filter(s => s.name !== name)),
    deleteMonth: (month) => {
      setData(d => ({
        ...d,
        salesInvoices: d.salesInvoices.filter(i => getMonth(i.date) !== month),
        purchaseInvoices: d.purchaseInvoices.filter(i => getMonth(i.date) !== month),
        returns: d.returns.filter(r => getMonth(r.date) !== month),
      }));
    },
  };

  const navGroups = [
    {
      label: "الرئيسية",
      items: [{ key: "dashboard", label: "لوحة التحكم", icon: I.dash }],
    },
    {
      label: "المبيعات والمشتريات",
      items: [
        { key: "sales", label: "فواتير المبيعات", icon: I.sales },
        { key: "purchases", label: "فواتير المشتريات", icon: I.purchase },
        { key: "returns", label: "المرتجعات", icon: I.returns },
        { key: "tax", label: "الفواتير الضريبية", icon: I.tax },
      ],
    },
    {
      label: "العملاء والموردين",
      items: [
        { key: "clients", label: "كشف العملاء", icon: I.clients },
        { key: "suppliers", label: "كشف الموردين", icon: I.suppliers },
      ],
    },
    {
      label: "المخزون",
      items: [
        { key: "inventory", label: "إدارة المخزون", icon: I.inventory },
        { key: "categories", label: "الفئات", icon: I.categories },
        { key: "stocktake", label: "الجرد الدوري", icon: I.stocktake },
      ],
    },
    {
      label: "التقارير",
      items: [
        { key: "reports", label: "التقارير المالية", icon: I.report },
        { key: "revenue", label: "الإيرادات", icon: I.revenue },
      ],
    },
  ];

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Cairo', 'Segoe UI', sans-serif", display: "flex" }}>
      {/* Sidebar */}
      <div style={{ width: 230, background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", position: "fixed", height: "100vh", right: 0, overflowY: "auto" }}>
        <div style={{ padding: "20px 16px 16px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Ic d={I.revenue} s={16} c="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>حسابي Pro</div>
              <div style={{ fontSize: 10, color: C.textMuted }}>نظام محاسبة متكامل</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "10px 10px" }}>
          {navGroups.map(group => (
            <div key={group.label} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, padding: "8px 10px 4px" }}>
                {group.label}
              </div>
              {group.items.map(item => (
                <button key={item.key} onClick={() => setPage(item.key)} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 9,
                  padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                  marginBottom: 2, fontFamily: "inherit", fontSize: 13, fontWeight: page === item.key ? 700 : 500,
                  background: page === item.key ? C.accentDim : "transparent",
                  color: page === item.key ? C.accent : C.textDim,
                  borderRight: `3px solid ${page === item.key ? C.accent : "transparent"}`,
                }}>
                  <Ic d={item.icon} s={15} c={page === item.key ? C.accent : C.textMuted} />
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div style={{ padding: "12px 14px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: C.textMuted, textAlign: "center" }}>حسابي Pro v2.0</div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, marginRight: 230, padding: 26, minHeight: "100vh", maxWidth: "calc(100vw - 230px)" }}>
        {page === "dashboard" && <Dashboard data={data} />}
        {page === "sales" && <InvoicesPage title="فواتير المبيعات" invoices={data.salesInvoices} type="sales" clients={data.clients} suppliers={data.suppliers} categories={data.categories} inventory={data.inventory} onAdd={actions.addSale} onDelete={actions.delSale} />}
        {page === "purchases" && <InvoicesPage title="فواتير المشتريات" invoices={data.purchaseInvoices} type="purchase" clients={data.clients} suppliers={data.suppliers} categories={data.categories} inventory={data.inventory} onAdd={actions.addPurchase} onDelete={actions.delPurchase} />}
        {page === "returns" && <ReturnsPage returns={data.returns} salesInvoices={data.salesInvoices} purchaseInvoices={data.purchaseInvoices} clients={data.clients} suppliers={data.suppliers} onAdd={actions.addReturn} onDelete={actions.delReturn} />}
        {page === "tax" && <TaxInvoicesPage salesInvoices={data.salesInvoices} purchaseInvoices={data.purchaseInvoices} />}
        {page === "clients" && <AccountStatement parties={data.clients} invoices={data.salesInvoices} type="client" onAddParty={actions.addClient} onDeleteParty={actions.delClient} />}
        {page === "suppliers" && <AccountStatement parties={data.suppliers} invoices={data.purchaseInvoices} type="supplier" onAddParty={actions.addSupplier} onDeleteParty={actions.delSupplier} />}
        {page === "inventory" && <InventoryPage inventory={data.inventory} categories={data.categories} onAdd={actions.addInvItem} onUpdate={actions.updateInvItem} onDelete={actions.delInvItem} onBulkAdd={actions.bulkAddInvItems} />}
        {page === "categories" && <CategoriesPage categories={data.categories} inventory={data.inventory} onAddCategory={actions.addCategory} onDeleteCategory={actions.delCategory} />}
        {page === "stocktake" && <StocktakePage inventory={data.inventory} categories={data.categories} />}
        {page === "reports" && <ReportsPage data={data} />}
        {page === "revenue" && <RevenuePage data={data} onDeleteMonth={actions.deleteMonth} />}
      </div>
    </div>
  );
}
