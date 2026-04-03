import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const supabaseUrl = "https://cavzaxxfnxkzsmiratyk.supabase.co";
const supabaseKey = "sb_publishable_B6YjF_uKcUdFmX8FgiyTbQ_jZIJf-0J";
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── ARABIC NORMALIZATION ─────────────────────────────────────────────────────
function normalizeArabic(str = "") {
  return str.trim().toLowerCase()
    .replace(/[أإآا]/g, "ا").replace(/[هة]/g, "ه")
    .replace(/[يى]/g, "ي").replace(/[ؤو]/g, "و")
    .replace(/[\u064B-\u065F]/g, "").replace(/\s+/g, " ");
}

function resolveCategory(rawName, existingCategories) {
  if (!rawName || !rawName.trim()) return existingCategories[0] || "";
  const normalized = normalizeArabic(rawName);
  const found = existingCategories.find(c => normalizeArabic(c) === normalized);
  return found || rawName.trim();
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
const EMPTY_STATE = {
  salesInvoices: [], purchaseInvoices: [], clients: [], suppliers: [],
  returns: [], categories: ["إلكترونيات","مواد خام","معدات","مستلزمات مكتبية","آلات","أغذية","ملابس","أدوات"],
  inventory: [],
};

// ─── useAppData HOOK ──────────────────────────────────────────────────────────
function useAppData(userId) {
  const [data, setData] = useState(EMPTY_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const saveData = useCallback(async (table, record) => {
    if (!userId) return null;
    try {
      const { data: saved, error: err } = await supabase.from("records").upsert({
        id: record.id, user_id: userId, table_name: table,
        type: record.type || null, data: record, updated_at: new Date().toISOString(),
      }, { onConflict: "id" }).select().single();
      if (err) throw err;
      return saved;
    } catch (e) { console.error("saveData error:", e.message); setError(e.message); return null; }
  }, [userId]);

  const deleteRecord = useCallback(async (recordId) => {
    if (!userId) return;
    try {
      const { error: err } = await supabase.from("records").delete().eq("id", recordId).eq("user_id", userId);
      if (err) throw err;
    } catch (e) { console.error("deleteRecord error:", e.message); setError(e.message); }
  }, [userId]);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data: rows, error: err } = await supabase.from("records").select("*").eq("user_id", userId).order("created_at", { ascending: true });
      if (err) throw err;
      const rebuilt = {
        salesInvoices: [], purchaseInvoices: [], clients: [], suppliers: [], returns: [],
        categories: ["إلكترونيات","مواد خام","معدات","مستلزمات مكتبية","آلات","أغذية","ملابس","أدوات"],
        inventory: [],
      };
      rows.forEach(row => {
        const record = row.data;
        switch (row.table_name) {
          case "sales": rebuilt.salesInvoices.push(record); break;
          case "purchases": rebuilt.purchaseInvoices.push(record); break;
          case "returns": rebuilt.returns.push(record); break;
          case "inventory": {
            const idx = rebuilt.inventory.findIndex(i => i.id === record.id);
            if (idx >= 0) rebuilt.inventory[idx] = record; else rebuilt.inventory.push(record); break;
          }
          case "clients": {
            const idx = rebuilt.clients.findIndex(c => c.id === record.id);
            if (idx >= 0) rebuilt.clients[idx] = record; else rebuilt.clients.push(record); break;
          }
          case "suppliers": {
            const idx = rebuilt.suppliers.findIndex(s => s.id === record.id);
            if (idx >= 0) rebuilt.suppliers[idx] = record; else rebuilt.suppliers.push(record); break;
          }
          case "categories":
            if (record.name && !rebuilt.categories.some(c => normalizeArabic(c) === normalizeArabic(record.name)))
              rebuilt.categories.push(record.name);
            break;
          default: break;
        }
      });
      setData(rebuilt);
    } catch (e) { console.error("loadData error:", e.message); setError(e.message); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { if (userId) loadData(); else setData(EMPTY_STATE); }, [userId, loadData]);

  const ensureCategory = useCallback(async (rawName) => {
    if (!rawName || !rawName.trim()) return;
    setData(prev => {
      const resolved = resolveCategory(rawName, prev.categories);
      if (prev.categories.some(c => normalizeArabic(c) === normalizeArabic(resolved))) return prev;
      const newCat = { id: "CAT" + Date.now(), name: resolved, type: "category" };
      saveData("categories", newCat);
      return { ...prev, categories: [...prev.categories, resolved] };
    });
  }, [saveData]);

  const actions = {
    addSale: async (invoice) => {
      const record = { ...invoice, type: "sale" };
      for (const item of (invoice.items || [])) if (item.category) await ensureCategory(item.category);
      await saveData("sales", record);
      setData(prev => ({ ...prev, salesInvoices: [...prev.salesInvoices, record] }));
    },
    deleteSale: async (id) => {
      await deleteRecord(id);
      setData(prev => ({ ...prev, salesInvoices: prev.salesInvoices.filter(i => i.id !== id) }));
    },
    addPurchase: async (invoice) => {
      const record = { ...invoice, type: "purchase" };
      for (const item of (invoice.items || [])) if (item.category) await ensureCategory(item.category);
      await saveData("purchases", record);
      setData(prev => ({ ...prev, purchaseInvoices: [...prev.purchaseInvoices, record] }));
    },
    deletePurchase: async (id) => {
      await deleteRecord(id);
      setData(prev => ({ ...prev, purchaseInvoices: prev.purchaseInvoices.filter(i => i.id !== id) }));
    },
    addReturn: async (ret) => {
      const record = { ...ret, type: "return" };
      await saveData("returns", record);
      setData(prev => ({ ...prev, returns: [...prev.returns, record] }));
    },
    deleteReturn: async (id) => {
      await deleteRecord(id);
      setData(prev => ({ ...prev, returns: prev.returns.filter(r => r.id !== id) }));
    },
    addClient: async (client) => {
      const record = { ...client, type: "client" };
      await saveData("clients", record);
      setData(prev => ({ ...prev, clients: [...prev.clients, record] }));
    },
    deleteClient: async (name) => {
      setData(prev => {
        const client = prev.clients.find(c => c.name === name);
        if (client) deleteRecord(client.id);
        return { ...prev, clients: prev.clients.filter(c => c.name !== name) };
      });
    },
    addSupplier: async (supplier) => {
      const record = { ...supplier, type: "supplier" };
      await saveData("suppliers", record);
      setData(prev => ({ ...prev, suppliers: [...prev.suppliers, record] }));
    },
    deleteSupplier: async (name) => {
      setData(prev => {
        const supplier = prev.suppliers.find(s => s.name === name);
        if (supplier) deleteRecord(supplier.id);
        return { ...prev, suppliers: prev.suppliers.filter(s => s.name !== name) };
      });
    },
    addInventoryItem: async (item) => {
      const record = { ...item, type: "inventory" };
      if (item.category) await ensureCategory(item.category);
      await saveData("inventory", record);
      setData(prev => ({ ...prev, inventory: [...prev.inventory, record] }));
    },
    updateInventoryItem: async (item) => {
      const record = { ...item, type: "inventory" };
      if (item.category) await ensureCategory(item.category);
      await saveData("inventory", record);
      setData(prev => ({ ...prev, inventory: prev.inventory.map(i => i.id === item.id ? record : i) }));
    },
    deleteInventoryItem: async (id) => {
      await deleteRecord(id);
      setData(prev => ({ ...prev, inventory: prev.inventory.filter(i => i.id !== id) }));
    },
    bulkAddInventory: async (items) => {
      const rawCategories = [...new Set(items.map(i => i.category).filter(Boolean))];
      for (const cat of rawCategories) await ensureCategory(cat);
      const saved = [];
      for (const item of items) {
        setData(prev => {
          const resolvedCat = resolveCategory(item.category, prev.categories);
          const record = { ...item, category: resolvedCat, type: "inventory" };
          saveData("inventory", record);
          saved.push(record);
          return prev;
        });
      }
      setData(prev => ({
        ...prev,
        inventory: [...prev.inventory.filter(i => !saved.find(s => s.id === i.id)), ...saved],
      }));
    },
    deleteMonth: async (month) => {
      const gm = d => d?.slice(0, 7);
      setData(prev => {
        const toDelete = [
          ...prev.salesInvoices.filter(i => gm(i.date) === month),
          ...prev.purchaseInvoices.filter(i => gm(i.date) === month),
          ...prev.returns.filter(i => gm(i.date) === month),
        ];
        toDelete.forEach(r => deleteRecord(r.id));
        return {
          ...prev,
          salesInvoices: prev.salesInvoices.filter(i => gm(i.date) !== month),
          purchaseInvoices: prev.purchaseInvoices.filter(i => gm(i.date) !== month),
          returns: prev.returns.filter(i => gm(i.date) !== month),
        };
      });
    },
    addCategory: async (name) => { await ensureCategory(name); },
  };

  return { data, setData, loading, error, saveData, actions, loadData };
}

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#070810", surface: "#0e1020", surface2: "#151829", surface3: "#1c2036",
  border: "#1e2238", borderLight: "#252a45",
  accent: "#6c7fff", accentDim: "rgba(108,127,255,0.1)", accentGlow: "rgba(108,127,255,0.25)",
  green: "#34d399", greenDim: "rgba(52,211,153,0.1)",
  red: "#f87171", redDim: "rgba(248,113,113,0.1)",
  yellow: "#fbbf24", yellowDim: "rgba(251,191,36,0.1)",
  blue: "#60a5fa", blueDim: "rgba(96,165,250,0.1)",
  purple: "#a78bfa", purpleDim: "rgba(167,139,250,0.1)",
  cyan: "#22d3ee", cyanDim: "rgba(34,211,238,0.1)",
  text: "#e2e8f0", textMuted: "#475569", textDim: "#94a3b8",
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
  logout: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  chartBar: "M18 20V10M12 20V4M6 20v-6",
  moon: "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
  stock: "M3 3h18v18H3zM3 9h18M9 21V9",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (n) => (n ?? 0).toLocaleString("ar-EG") + " ج.م";
const fmtNum = (n) => (n ?? 0).toLocaleString("ar-EG");
const today = () => new Date().toISOString().split("T")[0];
const getMonth = (d) => d?.slice(0, 7);

// ─── PRINT INVOICE ────────────────────────────────────────────────────────────
const printInvoice = (inv, type) => {
  const party = type === "sales" ? inv.client : inv.supplier;
  const partyLabel = type === "sales" ? "العميل" : "المورد";
  const title = type === "sales" ? "فاتورة مبيعات" : "فاتورة مشتريات";
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${title}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo','Segoe UI',sans-serif;background:#fff;color:#1a1a2e;padding:40px}
  .header{display:flex;justify-content:space-between;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #6c7fff}
  .company{font-size:24px;font-weight:800;color:#6c7fff}.invoice-num{font-size:20px;font-weight:800}
  .badge{display:inline-block;background:#f0f4ff;color:#6c7fff;border:1px solid #c7d2fe;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;margin-top:6px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:30px}
  .info-box{background:#f8faff;border:1px solid #e2e8f0;border-radius:10px;padding:16px}
  .info-label{font-size:11px;color:#64748b;font-weight:600;margin-bottom:4px}.info-value{font-size:15px;font-weight:700}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}thead tr{background:#6c7fff;color:#fff}
  thead th{padding:10px 14px;font-size:12px;font-weight:700;text-align:right}
  tbody tr:nth-child(even){background:#f8faff}tbody td{padding:10px 14px;font-size:13px;border-bottom:1px solid #e2e8f0}
  .totals{background:#f8faff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;max-width:300px;margin-right:auto}
  .total-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px}
  .total-row.main{font-size:16px;font-weight:800;color:#6c7fff;border-top:2px solid #c7d2fe;margin-top:8px;padding-top:10px}
  .footer{margin-top:40px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}
  @media print{body{padding:20px}}</style></head><body>
  <div class="header"><div><div class="company">حسابي Pro</div><div style="font-size:12px;color:#64748b;margin-top:4px">نظام محاسبة متكامل</div></div>
  <div><div style="font-size:13px;color:#64748b">${title}</div><div class="invoice-num">${inv.id}</div><span class="badge">${inv.status}</span></div></div>
  <div class="info-grid"><div class="info-box"><div class="info-label">${partyLabel}</div><div class="info-value">${party}</div></div>
  <div class="info-box"><div class="info-label">التاريخ</div><div class="info-value">${inv.date}</div></div></div>
  <table><thead><tr><th>الصنف</th><th>الفئة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>
  ${(inv.items||[]).map(it=>`<tr><td>${it.name||"—"}</td><td>${it.category||"—"}</td><td>${it.qty}</td><td>${(it.price||0).toLocaleString("ar-EG")} ج.م</td><td>${((it.qty||0)*(it.price||0)).toLocaleString("ar-EG")} ج.م</td></tr>`).join("")}
  </tbody></table>
  <div class="totals">
  <div class="total-row"><span>قبل الضريبة</span><span>${(inv.subtotal||inv.amount).toLocaleString("ar-EG")} ج.م</span></div>
  <div class="total-row"><span>ضريبة ${inv.taxRate||0}%</span><span>${(inv.taxAmount||0).toLocaleString("ar-EG")} ج.م</span></div>
  <div class="total-row"><span>المدفوع</span><span>${(inv.paid||0).toLocaleString("ar-EG")} ج.م</span></div>
  <div class="total-row"><span>المتبقي</span><span>${(inv.amount-inv.paid).toLocaleString("ar-EG")} ج.م</span></div>
  <div class="total-row main"><span>الإجمالي الكلي</span><span>${inv.amount.toLocaleString("ar-EG")} ج.م</span></div></div>
  ${inv.notes?`<p style="margin-top:20px;font-size:13px;color:#64748b"><strong>ملاحظات:</strong> ${inv.notes}</p>`:""}
  <div class="footer">تم إنشاء هذه الفاتورة بواسطة حسابي Pro — ${new Date().toLocaleDateString("ar-EG")}</div>
  </body></html>`;
  const w = window.open("", "_blank");
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(() => w.print(), 500);
};

// ─── PRINT TAX INVOICE ────────────────────────────────────────────────────────
const printTaxInvoice = (inv) => {
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>فاتورة ضريبية</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo','Segoe UI',sans-serif;background:#fff;color:#1a1a2e;padding:40px}
  .header{text-align:center;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #f59e0b}
  .title{font-size:22px;font-weight:800;color:#1a1a2e}.subtitle{color:#f59e0b;font-size:14px;font-weight:700;margin-top:4px}
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
  .tax-note{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;margin-top:20px;font-size:12px;color:#92400e}
  .footer{margin-top:30px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}
  @media print{body{padding:20px}}</style></head><body>
  <div class="header"><div class="title">حسابي Pro</div><div class="subtitle">⚖️ فاتورة ضريبية رسمية</div>
  <div style="font-size:13px;color:#64748b;margin-top:6px">رقم الفاتورة: <strong>${inv.id}</strong></div><span class="badge">${inv.status}</span></div>
  <div class="info-grid">
  <div class="info-box"><div class="info-label">العميل / المورد</div><div class="info-value">${inv.client||inv.supplier||"—"}</div></div>
  <div class="info-box"><div class="info-label">التاريخ</div><div class="info-value">${inv.date}</div></div>
  <div class="info-box"><div class="info-label">نسبة الضريبة المضافة</div><div class="info-value">${inv.taxRate||14}%</div></div>
  <div class="info-box"><div class="info-label">نوع الفاتورة</div><div class="info-value">${inv.client?"مبيعات":"مشتريات"}</div></div>
  </div>
  <table><thead><tr><th>الصنف</th><th>الفئة</th><th>الكمية</th><th>السعر (قبل ض.)</th><th>قيمة الضريبة</th><th>الإجمالي شامل الضريبة</th></tr></thead><tbody>
  ${(inv.items||[]).map(it=>{const tax=(it.qty||0)*(it.price||0)*(inv.taxRate||14)/100;const total=(it.qty||0)*(it.price||0)+tax;return`<tr><td>${it.name||"—"}</td><td>${it.category||"—"}</td><td>${it.qty}</td><td>${(it.price||0).toLocaleString("ar-EG")} ج.م</td><td style="color:#92400e;font-weight:600">${tax.toLocaleString("ar-EG")} ج.م</td><td style="font-weight:700">${total.toLocaleString("ar-EG")} ج.م</td></tr>`;}).join("")}
  </tbody></table>
  <div class="totals">
  <div class="total-row"><span>المجموع قبل الضريبة</span><span>${(inv.subtotal||inv.amount).toLocaleString("ar-EG")} ج.م</span></div>
  <div class="total-row tax"><span>⚖️ ضريبة القيمة المضافة ${inv.taxRate||14}%</span><span>${(inv.taxAmount||0).toLocaleString("ar-EG")} ج.م</span></div>
  <div class="total-row main"><span>الإجمالي شامل الضريبة</span><span>${inv.amount.toLocaleString("ar-EG")} ج.م</span></div>
  <div class="total-row"><span>المدفوع</span><span>${(inv.paid||0).toLocaleString("ar-EG")} ج.م</span></div>
  <div class="total-row" style="color:#ef4444"><span>المتبقي</span><span>${(inv.amount-(inv.paid||0)).toLocaleString("ar-EG")} ج.م</span></div></div>
  <div class="tax-note">📋 هذه فاتورة ضريبية رسمية تشمل ضريبة القيمة المضافة وفقاً للتشريعات المعمول بها. الرقم الضريبي: يُضاف حسب بيانات الشركة.</div>
  <div class="footer">الفاتورة الضريبية — حسابي Pro — ${new Date().toLocaleDateString("ar-EG")}</div></body></html>`;
  const w = window.open("", "_blank");
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(() => w.print(), 500);
};

// ─── PRINT STOCKTAKE REPORT ───────────────────────────────────────────────────
const printStocktakeReport = (inventory, period, selectedMonth) => {
  const totalCostVal = inventory.reduce((s, p) => s + p.qty * p.cost, 0);
  const totalSaleVal = inventory.reduce((s, p) => s + p.qty * p.price, 0);
  const lowItems = inventory.filter(p => p.qty <= p.minQty);
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تقرير الجرد</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo','Segoe UI',sans-serif;background:#fff;color:#1a1a2e;padding:40px}
  .header{display:flex;justify-content:space-between;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #34d399}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
  .stat{background:#f8faff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center}
  .stat-val{font-size:18px;font-weight:800}.stat-lbl{font-size:11px;color:#64748b;margin-top:4px}
  table{width:100%;border-collapse:collapse;margin-bottom:24px;font-size:12px}thead tr{background:#34d399;color:#fff}
  thead th{padding:8px 12px;font-weight:700;text-align:right}tbody tr:nth-child(even){background:#f0fdf4}
  tbody td{padding:8px 12px;border-bottom:1px solid #e2e8f0}.low{color:#ef4444;font-weight:700}.ok{color:#16a34a}
  .section-title{font-size:15px;font-weight:800;margin:20px 0 10px}
  .shortage{background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:10px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center}
  .footer{margin-top:30px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}
  @media print{body{padding:20px}}</style></head><body>
  <div class="header"><div><div style="font-size:22px;font-weight:800">تقرير الجرد الدوري</div>
  <div style="font-size:13px;color:#64748b;margin-top:4px">${period==="monthly"?"جرد شهري":"جرد أسبوعي"} — ${selectedMonth}</div></div>
  <div style="font-size:13px;color:#64748b">${new Date().toLocaleDateString("ar-EG")}</div></div>
  <div class="stats">
  <div class="stat"><div class="stat-val" style="color:#6c7fff">${inventory.length}</div><div class="stat-lbl">إجمالي الأصناف</div></div>
  <div class="stat"><div class="stat-val" style="color:#ef4444">${lowItems.length}</div><div class="stat-lbl">أصناف منخفضة</div></div>
  <div class="stat"><div class="stat-val" style="color:#fbbf24">${totalCostVal.toLocaleString("ar-EG")} ج.م</div><div class="stat-lbl">قيمة المخزون</div></div>
  <div class="stat"><div class="stat-val" style="color:#34d399">${totalSaleVal.toLocaleString("ar-EG")} ج.م</div><div class="stat-lbl">قيمة البيع</div></div></div>
  ${lowItems.length>0?`<div class="section-title">⚠️ النواقص والكميات المطلوبة</div>
  ${lowItems.map(p=>`<div class="shortage"><div><strong>${p.name}</strong> — ${p.category}</div><div>الموجود: <span class="low">${p.qty} ${p.unit}</span> | الحد الأدنى: ${p.minQty} | <strong>النقص: ${Math.max(0,p.minQty-p.qty)} ${p.unit}</strong></div></div>`).join("")}`:""}
  <div class="section-title">تفاصيل جميع الأصناف</div>
  <table><thead><tr><th>الكود</th><th>الصنف</th><th>الفئة</th><th>الكمية</th><th>الحد الأدنى</th><th>النقص</th><th>سعر التكلفة</th><th>قيمة المخزون</th><th>الحالة</th></tr></thead><tbody>
  ${inventory.map(p=>`<tr><td>${p.id}</td><td>${p.name}</td><td>${p.category}</td><td class="${p.qty<=p.minQty?"low":"ok"}">${p.qty} ${p.unit}</td><td>${p.minQty}</td><td class="${p.qty<=p.minQty?"low":"ok"}">${Math.max(0,p.minQty-p.qty)}</td><td>${p.cost.toLocaleString("ar-EG")} ج.م</td><td>${(p.qty*p.cost).toLocaleString("ar-EG")} ج.م</td><td class="${p.qty<=p.minQty?"low":"ok"}">${p.qty<=p.minQty?"منخفض":"كافي"}</td></tr>`).join("")}
  </tbody></table>
  <div class="footer">تقرير الجرد — حسابي Pro — ${new Date().toLocaleDateString("ar-EG")}</div></body></html>`;
  const w = window.open("", "_blank");
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(() => w.print(), 500);
};

// ─── PRINT FINANCIAL REPORT ───────────────────────────────────────────────────
const printFinancialReport = (data, period, selectedMonth) => {
  const filteredSales = data.salesInvoices.filter(i => getMonth(i.date) === selectedMonth);
  const filteredPurchases = data.purchaseInvoices.filter(i => getMonth(i.date) === selectedMonth);
  const totalSales = filteredSales.reduce((s, i) => s + i.amount, 0);
  const totalPurchases = filteredPurchases.reduce((s, i) => s + i.amount, 0);
  const totalPaid = filteredSales.reduce((s, i) => s + i.paid, 0);
  const profit = totalSales - totalPurchases;
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
  <div class="header"><div class="title">التقرير المالي ${period==="monthly"?"الشهري":"اليومي"}</div>
  <div style="font-size:13px;color:#64748b;margin-top:6px">الفترة: ${selectedMonth} — حسابي Pro</div></div>
  <div class="stats">
  <div class="stat"><div class="stat-val" style="color:#34d399">${totalSales.toLocaleString("ar-EG")} ج.م</div><div class="stat-lbl">المبيعات</div></div>
  <div class="stat"><div class="stat-val" style="color:#f87171">${totalPurchases.toLocaleString("ar-EG")} ج.م</div><div class="stat-lbl">المشتريات</div></div>
  <div class="stat"><div class="stat-val" style="color:${profit>=0?"#34d399":"#f87171"}">${profit.toLocaleString("ar-EG")} ج.م</div><div class="stat-lbl">صافي الربح</div></div>
  <div class="stat"><div class="stat-val" style="color:#6c7fff">${totalPaid.toLocaleString("ar-EG")} ج.م</div><div class="stat-lbl">المدفوع</div></div></div>
  <div class="section-title">فواتير المبيعات — ${selectedMonth}</div>
  <table><thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>العميل</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th></tr></thead><tbody>
  ${filteredSales.map(i=>`<tr><td>${i.id}</td><td>${i.date}</td><td>${i.client}</td><td>${i.amount.toLocaleString("ar-EG")} ج.م</td><td>${i.paid.toLocaleString("ar-EG")} ج.م</td><td>${(i.amount-i.paid).toLocaleString("ar-EG")} ج.م</td><td>${i.status}</td></tr>`).join("")}
  </tbody></table>
  <div class="section-title">فواتير المشتريات — ${selectedMonth}</div>
  <table><thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>المورد</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th></tr></thead><tbody>
  ${filteredPurchases.map(i=>`<tr><td>${i.id}</td><td>${i.date}</td><td>${i.supplier}</td><td>${i.amount.toLocaleString("ar-EG")} ج.م</td><td>${i.paid.toLocaleString("ar-EG")} ج.م</td><td>${(i.amount-i.paid).toLocaleString("ar-EG")} ج.م</td><td>${i.status}</td></tr>`).join("")}
  </tbody></table>
  <div class="footer">التقرير المالي — حسابي Pro — ${new Date().toLocaleDateString("ar-EG")}</div></body></html>`;
  const w = window.open("", "_blank");
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(() => w.print(), 500);
};

// ─── EXCEL HELPERS ────────────────────────────────────────────────────────────
const downloadInventoryTemplate = () => {
  const csv = "اسم الصنف,الفئة,الكمية الحالية,الحد الأدنى,سعر التكلفة,سعر البيع,وحدة القياس\n";
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "قالب_المخزون.csv"; a.click();
  URL.revokeObjectURL(url);
};

const parseInventoryCSV = (text, categories) => {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  return lines.slice(1).map((line, i) => {
    const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    if (!cols[0]) return null;
    return {
      id: "INV" + Date.now().toString().slice(-5) + i,
      name: cols[0] || "",
      category: resolveCategory(cols[1], categories),
      qty: parseFloat(cols[2]) || 0,
      minQty: parseFloat(cols[3]) || 0,
      cost: parseFloat(cols[4]) || 0,
      price: parseFloat(cols[5]) || 0,
      unit: cols[6] || "قطعة",
    };
  }).filter(Boolean);
};

// ─── PASSWORD VERIFY DIALOG ───────────────────────────────────────────────────
function PasswordDialog({ userEmail, onConfirm, onCancel, title = "تأكيد بكلمة المرور" }) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!password) { setErr("أدخل كلمة المرور"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: userEmail, password });
      if (error) { setErr("كلمة المرور غير صحيحة"); setLoading(false); return; }
      onConfirm();
    } catch { setErr("حدث خطأ"); }
    setLoading(false);
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:3000 }}>
      <div style={{ background:C.surface,border:`1px solid ${C.accent}33`,borderRadius:18,padding:"28px 32px",maxWidth:360,width:"90%",boxShadow:`0 0 60px ${C.accent}22` }}>
        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:18 }}>
          <div style={{ background:C.accentDim,padding:10,borderRadius:10 }}><Ic d={I.shield} s={20} c={C.accent} /></div>
          <h3 style={{ margin:0,fontSize:15,fontWeight:700,color:C.text }}>{title}</h3>
        </div>
        <p style={{ margin:"0 0 16px",fontSize:12,color:C.textMuted,lineHeight:1.7 }}>هذه العملية تتطلب تأكيد هويتك. أدخل كلمة مرور حسابك للمتابعة.</p>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&handleVerify()}
          placeholder="••••••••"
          style={{ width:"100%",background:C.bg,border:`1px solid ${err?C.red:C.border}`,borderRadius:8,padding:"10px 14px",color:C.text,fontSize:14,fontFamily:"inherit",outline:"none",boxSizing:"border-box",direction:"ltr",textAlign:"right" }}
        />
        {err && <div style={{ color:C.red,fontSize:12,marginTop:6 }}>{err}</div>}
        <div style={{ display:"flex",gap:10,marginTop:18,justifyContent:"flex-end" }}>
          <button onClick={onCancel} style={{ background:C.surface2,color:C.textDim,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 20px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>إلغاء</button>
          <button onClick={handleVerify} disabled={loading} style={{ background:C.accent,color:"#fff",border:"none",borderRadius:8,padding:"9px 20px",fontSize:12,fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit" }}>
            {loading ? "جاري التحقق..." : "تأكيد"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CONFIRM DIALOG ───────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000 }}>
      <div style={{ background:C.surface,border:`1px solid ${C.red}44`,borderRadius:18,padding:"28px 32px",maxWidth:380,width:"90%",textAlign:"center",boxShadow:`0 0 60px ${C.red}22` }}>
        <div style={{ width:52,height:52,borderRadius:"50%",background:C.redDim,border:`2px solid ${C.red}44`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px" }}>
          <Ic d={I.alert} s={24} c={C.red} />
        </div>
        <h3 style={{ margin:"0 0 10px",fontSize:16,fontWeight:700,color:C.text }}>تأكيد الحذف</h3>
        <p style={{ margin:"0 0 24px",fontSize:13,color:C.textMuted,lineHeight:1.7 }}>{message}</p>
        <div style={{ display:"flex",gap:10,justifyContent:"center" }}>
          <button onClick={onCancel} style={{ background:C.surface2,color:C.textDim,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 24px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>إلغاء</button>
          <button onClick={onConfirm} style={{ background:C.red,color:"#fff",border:"none",borderRadius:8,padding:"9px 24px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>نعم، احذف</button>
        </div>
      </div>
    </div>
  );
}

// ─── BASE COMPONENTS ──────────────────────────────────────────────────────────
const Badge = ({ label }) => {
  const colors = {
    "مدفوعة": { bg:C.greenDim,color:C.green,border:C.green+"33" },
    "جزئية": { bg:C.yellowDim,color:C.yellow,border:C.yellow+"33" },
    "غير مدفوعة": { bg:C.redDim,color:C.red,border:C.red+"33" },
    "مرتجع": { bg:C.purpleDim,color:C.purple,border:C.purple+"33" },
    "منخفض": { bg:C.redDim,color:C.red,border:C.red+"33" },
    "كافي": { bg:C.greenDim,color:C.green,border:C.green+"33" },
  };
  const s = colors[label] || { bg:C.surface2,color:C.textDim,border:C.border };
  return <span style={{ background:s.bg,color:s.color,border:`1px solid ${s.border}`,padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700,whiteSpace:"nowrap" }}>{label}</span>;
};

const Card = ({ children, style={} }) => (
  <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:"20px 22px",...style }}>{children}</div>
);

const GlowCard = ({ children, color = C.accent, style={} }) => (
  <div style={{ background:C.surface,border:`1px solid ${color}22`,borderRadius:16,padding:"20px 22px",boxShadow:`0 0 30px ${color}0a`,...style }}>{children}</div>
);

const MiniStat = ({ label, value, color=C.text, icon, accent, sub }) => (
  <div style={{ background:C.surface2,borderRadius:14,padding:"16px 18px",borderRight:`3px solid ${accent||color}`,display:"flex",flexDirection:"column",gap:8,position:"relative",overflow:"hidden" }}>
    <div style={{ position:"absolute",top:8,left:12,opacity:0.06 }}>
      {icon && <Ic d={icon} s={40} c={color} />}
    </div>
    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
      {icon && <div style={{ background:color+"18",padding:6,borderRadius:8 }}><Ic d={icon} s={14} c={color} /></div>}
      <span style={{ fontSize:11,color:C.textMuted,fontWeight:600 }}>{label}</span>
    </div>
    <div style={{ fontSize:19,fontWeight:800,color,fontFamily:"monospace" }}>{value}</div>
    {sub && <div style={{ fontSize:11,color:C.textMuted }}>{sub}</div>}
  </div>
);

const Btn = ({ children, onClick, variant="primary", small=false, style={} }) => {
  const v = {
    primary: { background:C.accent,color:"#fff",border:"none",boxShadow:`0 4px 15px ${C.accent}30` },
    danger: { background:"transparent",color:C.red,border:`1px solid ${C.red}44` },
    ghost: { background:"transparent",color:C.textDim,border:`1px solid ${C.border}` },
    success: { background:C.greenDim,color:C.green,border:`1px solid ${C.green}33` },
    yellow: { background:C.yellowDim,color:C.yellow,border:`1px solid ${C.yellow}33` },
    purple: { background:C.purpleDim,color:C.purple,border:`1px solid ${C.purple}33` },
    cyan: { background:C.cyanDim,color:C.cyan,border:`1px solid ${C.cyan}33` },
  };
  return (
    <button onClick={onClick} style={{ ...v[variant],borderRadius:9,padding:small?"5px 12px":"8px 18px",fontSize:small?12:13,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,fontFamily:"inherit",transition:"all 0.2s",...style }}>
      {children}
    </button>
  );
};

const Inp = ({ label, value, onChange, type="text", placeholder="", required=false }) => (
  <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
    {label && <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>{label}{required && <span style={{ color:C.red }}> *</span>}</label>}
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 13px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none",transition:"border-color 0.2s" }}
      onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border} />
  </div>
);

const Sel = ({ label, value, onChange, options, placeholder="-- اختر --" }) => (
  <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
    {label && <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>{label}</label>}
    <select value={value} onChange={e=>onChange(e.target.value)} style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 13px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none" }}>
      <option value="">{placeholder}</option>
      {options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
    </select>
  </div>
);

const Modal = ({ title, onClose, children, wide=false }) => (
  <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16 }}>
    <div style={{ background:C.surface,border:`1px solid ${C.borderLight}`,borderRadius:20,padding:28,width:wide?"min(780px,95vw)":"min(540px,95vw)",maxHeight:"90vh",overflowY:"auto",boxShadow:`0 30px 80px rgba(0,0,0,0.7)` }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22 }}>
        <h2 style={{ margin:0,fontSize:17,fontWeight:700,color:C.text }}>{title}</h2>
        <button onClick={onClose} style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,cursor:"pointer",color:C.textMuted,padding:6,display:"flex" }}><Ic d={I.close} s={16} /></button>
      </div>
      {children}
    </div>
  </div>
);

const THead = ({ cols }) => (
  <thead>
    <tr style={{ background:C.surface3,borderBottom:`1px solid ${C.border}` }}>
      {cols.map(c=><th key={c} style={{ padding:"10px 14px",fontSize:11,color:C.textMuted,fontWeight:700,textAlign:"right",whiteSpace:"nowrap",letterSpacing:0.3 }}>{c}</th>)}
    </tr>
  </thead>
);

const TRow = ({ children, alt }) => (
  <tr style={{ borderBottom:`1px solid ${C.border}20`,background:alt?"rgba(255,255,255,0.015)":"transparent",transition:"background 0.15s" }}>{children}</tr>
);

const TD = ({ children, color, mono=false }) => (
  <td style={{ padding:"11px 14px",fontSize:12,color:color||C.text,fontFamily:mono?"monospace":"inherit" }}>{children}</td>
);

const PageHeader = ({ title, subtitle, action, icon }) => (
  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:26 }}>
    <div style={{ display:"flex",alignItems:"center",gap:12 }}>
      {icon && <div style={{ background:C.accentDim,border:`1px solid ${C.accent}22`,padding:12,borderRadius:14 }}><Ic d={icon} s={22} c={C.accent} /></div>}
      <div>
        <h1 style={{ margin:0,fontSize:22,fontWeight:800,color:C.text,letterSpacing:-0.5 }}>{title}</h1>
        {subtitle && <p style={{ margin:"4px 0 0",color:C.textMuted,fontSize:13 }}>{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

const ProgressBar = ({ value, max, color }) => (
  <div style={{ background:C.surface3,borderRadius:6,height:5,overflow:"hidden" }}>
    <div style={{ width:`${Math.min(100,(value/max)*100)}%`,height:"100%",background:color,borderRadius:6,transition:"width 0.4s" }} />
  </div>
);

const SectionTitle = ({ children }) => (
  <div style={{ fontSize:12,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:1,marginBottom:8,paddingBottom:6,borderBottom:`1px solid ${C.border}` }}>
    {children}
  </div>
);

// ─── ADMIN_EMAIL ──────────────────────────────────────────────────────────────
const ADMIN_EMAIL = "gabr80252@gmail.com";

// ─── LOGO ─────────────────────────────────────────────────────────────────────
const Logo = ({ size=32 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <rect width="32" height="32" rx="9" fill="#6c7fff"/>
    <rect x="2" y="2" width="28" height="28" rx="7" fill="url(#lg)"/>
    <defs><linearGradient id="lg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse"><stop stopColor="#818cf8"/><stop offset="1" stopColor="#6c7fff"/></linearGradient></defs>
    <path d="M8 22V14l8-6 8 6v8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="13" y="16" width="6" height="6" rx="1" stroke="#fff" strokeWidth="1.8"/>
    <path d="M11 11h10M16 8v3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// ─── SUBSCRIPTION EXPIRED ─────────────────────────────────────────────────────
function SubscriptionExpired() {
  return (
    <div style={{ minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Cairo','Segoe UI',sans-serif",direction:"rtl" }}>
      <div style={{ background:C.surface,border:`2px solid ${C.red}33`,borderRadius:24,padding:"48px 52px",width:"min(440px,90vw)",display:"flex",flexDirection:"column",alignItems:"center",gap:22,textAlign:"center" }}>
        <div style={{ width:72,height:72,borderRadius:"50%",background:C.redDim,border:`2px solid ${C.red}44`,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <Ic d={I.alert} s={32} c={C.red} />
        </div>
        <div>
          <div style={{ fontSize:22,fontWeight:800,color:C.text,marginBottom:10 }}>انتهت مدة الاشتراك</div>
          <div style={{ fontSize:13,color:C.textMuted,lineHeight:1.9 }}>عذراً، انتهت صلاحية حسابك<br/>يرجى التواصل مع الإدارة لتجديد الاشتراك</div>
        </div>
        <div style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 24px",width:"100%" }}>
          <div style={{ fontSize:11,color:C.textMuted,marginBottom:6,fontWeight:600 }}>للتواصل والتجديد</div>
          <div style={{ fontSize:14,color:C.accent,fontWeight:700 }}>{ADMIN_EMAIL}</div>
        </div>
        <button onClick={()=>supabase.auth.signOut()} style={{ background:"none",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 22px",fontSize:12,color:C.textMuted,cursor:"pointer",fontFamily:"inherit" }}>تسجيل الخروج</button>
      </div>
    </div>
  );
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen() {
  const [form, setForm] = useState({ email:"", password:"" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!form.email || !form.password) { setErr("أدخل البريد الإلكتروني وكلمة المرور"); return; }
    setErr(""); setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email:form.email, password:form.password });
      if (error) {
        if (error.message.includes("Invalid login credentials")) setErr("البريد الإلكتروني أو كلمة المرور غير صحيحة");
        else if (error.message.includes("Email not confirmed")) setErr("الحساب لم يتم تفعيله، تحقق من بريدك");
        else setErr(error.message);
      }
    } catch(e){ setErr(e.message); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Cairo','Segoe UI',sans-serif",direction:"rtl",position:"relative",overflow:"hidden" }}>
      <div style={{ position:"absolute",top:-100,right:-100,width:400,height:400,borderRadius:"50%",background:`radial-gradient(circle, ${C.accentGlow} 0%, transparent 70%)`,pointerEvents:"none" }} />
      <div style={{ position:"absolute",bottom:-100,left:-100,width:300,height:300,borderRadius:"50%",background:`radial-gradient(circle, ${C.greenDim} 0%, transparent 70%)`,pointerEvents:"none" }} />
      <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:24,padding:"44px 48px",width:"min(420px,92vw)",display:"flex",flexDirection:"column",gap:22,position:"relative",zIndex:1,boxShadow:`0 40px 100px rgba(0,0,0,0.5)` }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ display:"flex",justifyContent:"center",marginBottom:18 }}><Logo size={56} /></div>
          <div style={{ fontSize:26,fontWeight:800,color:C.text,letterSpacing:-0.5 }}>حسابي Pro</div>
          <div style={{ fontSize:12,color:C.textMuted,marginTop:5 }}>نظام محاسبة متكامل للشركات والمصانع</div>
        </div>
        {err && <div style={{ background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:10,padding:"11px 16px",fontSize:12,color:C.red,textAlign:"center" }}>{err}</div>}
        <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
          <Inp label="البريد الإلكتروني" value={form.email} onChange={v=>setForm({...form,email:v})} type="email" placeholder="example@company.com" />
          <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
            <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>كلمة المرور</label>
            <input type="password" placeholder="••••••••" value={form.password}
              onChange={e=>setForm({...form,password:e.target.value})}
              onKeyDown={e=>e.key==="Enter"&&handleLogin()}
              style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 13px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none",direction:"ltr",textAlign:"right" }}
              onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border} />
          </div>
        </div>
        <button onClick={handleLogin} disabled={loading} style={{ background:loading?C.surface2:C.accent,color:loading?C.textMuted:"#fff",border:"none",borderRadius:11,padding:13,fontSize:14,fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",boxShadow:loading?"none":`0 8px 25px ${C.accent}40`,transition:"all 0.2s" }}>
          {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
        </button>
        <div style={{ textAlign:"center",fontSize:11,color:C.textMuted,borderTop:`1px solid ${C.border}`,paddingTop:14 }}>للحصول على حساب، تواصل مع الإدارة</div>
      </div>
    </div>
  );
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ email:"", password:"", company:"" });
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState({ text:"", type:"" });
  const [toggling, setToggling] = useState(null);

  const showMsg = (text, type="success") => { setMsg({ text, type }); setTimeout(()=>setMsg({text:"",type:""}),3500); };

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (!error) setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const toggleUser = async (user) => {
    setToggling(user.id);
    const newStatus = !user.is_active;
    const { error } = await supabase.from("profiles").update({ is_active: newStatus }).eq("id", user.id);
    if (!error) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: newStatus } : u));
      showMsg(newStatus ? `✓ تم تفعيل ${user.email}` : `✓ تم تعطيل ${user.email}`, newStatus ? "success" : "warning");
    } else { showMsg("حدث خطأ، حاول مرة أخرى", "error"); }
    setToggling(null);
  };

  const addUser = async () => {
    if (!newUser.email || !newUser.password) { showMsg("أدخل الإيميل وكلمة المرور", "error"); return; }
    if (newUser.password.length < 6) { showMsg("كلمة المرور 6 أحرف على الأقل", "error"); return; }
    setAdding(true);
    try {
      const { data, error } = await supabase.auth.admin.createUser({ email: newUser.email, password: newUser.password, email_confirm: true });
      if (error) { showMsg(error.message, "error"); setAdding(false); return; }
      if (newUser.company && data.user) await supabase.from("profiles").update({ company_name: newUser.company }).eq("id", data.user.id);
      showMsg(`✓ تم إضافة ${newUser.email} بنجاح`);
      setNewUser({ email:"", password:"", company:"" }); setShowAdd(false);
      await loadUsers();
    } catch(e) { showMsg(e.message, "error"); }
    setAdding(false);
  };

  const activeCount = users.filter(u => u.is_active && u.email !== ADMIN_EMAIL).length;
  const totalCount = users.filter(u => u.email !== ADMIN_EMAIL).length;

  return (
    <div style={{ minHeight:"100vh",background:C.bg,fontFamily:"'Cairo','Segoe UI',sans-serif",direction:"rtl",padding:"28px 32px" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28 }}>
        <div style={{ display:"flex",alignItems:"center",gap:14 }}>
          <Logo size={40} />
          <div>
            <div style={{ fontSize:22,fontWeight:800,color:C.text }}>لوحة الإدارة</div>
            <div style={{ fontSize:12,color:C.textMuted,marginTop:2 }}>إدارة حسابات العملاء والاشتراكات</div>
          </div>
        </div>
        <div style={{ display:"flex",gap:10,alignItems:"center" }}>
          {msg.text && <div style={{ background:msg.type==="success"?C.greenDim:msg.type==="warning"?C.yellowDim:C.redDim,border:`1px solid ${msg.type==="success"?C.green:msg.type==="warning"?C.yellow:C.red}33`,color:msg.type==="success"?C.green:msg.type==="warning"?C.yellow:C.red,borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:600 }}>{msg.text}</div>}
          <Btn onClick={()=>setShowAdd(true)}><Ic d={I.userPlus} s={15} />إضافة عميل</Btn>
          <Btn variant="danger" onClick={()=>supabase.auth.signOut()}><Ic d={I.logout} s={14} />خروج</Btn>
        </div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:24 }}>
        {[{label:"إجمالي العملاء",value:totalCount,color:C.accent},{label:"الاشتراكات الفعالة",value:activeCount,color:C.green},{label:"الاشتراكات المعطلة",value:totalCount-activeCount,color:C.red}].map(s=>(
          <div key={s.label} style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:"20px 24px",borderTop:`3px solid ${s.color}` }}>
            <div style={{ fontSize:11,color:C.textMuted,fontWeight:600,marginBottom:8 }}>{s.label}</div>
            <div style={{ fontSize:28,fontWeight:800,color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden" }}>
        <div style={{ padding:"14px 20px",borderBottom:`1px solid ${C.border}`,fontSize:14,fontWeight:700,color:C.text }}>قائمة العملاء</div>
        {loading ? <div style={{ padding:40,textAlign:"center",color:C.textMuted }}>جاري التحميل...</div> : (
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <THead cols={["البريد الإلكتروني","اسم الشركة","تاريخ الإنشاء","حالة الاشتراك","التحكم"]} />
            <tbody>
              {users.filter(u=>u.email!==ADMIN_EMAIL).map((u,i)=>(
                <TRow key={u.id} alt={i%2}>
                  <TD>{u.email}</TD>
                  <TD color={C.textDim}>{u.company_name||"—"}</TD>
                  <TD color={C.textMuted}>{new Date(u.created_at).toLocaleDateString("ar-EG")}</TD>
                  <td style={{ padding:"11px 14px" }}><Badge label={u.is_active?"مدفوعة":"غير مدفوعة"} /></td>
                  <td style={{ padding:"11px 14px" }}>
                    <button onClick={()=>toggleUser(u)} disabled={toggling===u.id}
                      style={{ background:u.is_active?C.redDim:C.greenDim,color:u.is_active?C.red:C.green,border:`1px solid ${u.is_active?C.red:C.green}33`,borderRadius:8,padding:"6px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>
                      {toggling===u.id?"جاري...":(u.is_active?"إيقاف":"تفعيل")}
                    </button>
                  </td>
                </TRow>
              ))}
            </tbody>
          </table>
        )}
        {!loading && users.filter(u=>u.email!==ADMIN_EMAIL).length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted }}>لا يوجد عملاء بعد</div>}
      </div>
      {showAdd && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }}>
          <div style={{ background:C.surface,border:`1px solid ${C.borderLight}`,borderRadius:20,padding:28,width:"min(440px,92vw)",display:"flex",flexDirection:"column",gap:16 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <h2 style={{ margin:0,fontSize:17,fontWeight:700,color:C.text }}>إضافة عميل جديد</h2>
              <button onClick={()=>setShowAdd(false)} style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,cursor:"pointer",color:C.textMuted,padding:6 }}><Ic d={I.close} s={16} /></button>
            </div>
            <Inp label="البريد الإلكتروني *" value={newUser.email} onChange={v=>setNewUser({...newUser,email:v})} type="email" placeholder="client@company.com" />
            <Inp label="كلمة المرور * (6 أحرف على الأقل)" value={newUser.password} onChange={v=>setNewUser({...newUser,password:v})} placeholder="اكتبها واحفظها" />
            <Inp label="اسم الشركة (اختياري)" value={newUser.company} onChange={v=>setNewUser({...newUser,company:v})} placeholder="شركة النور للتجارة" />
            <div style={{ background:C.yellowDim,border:`1px solid ${C.yellow}33`,borderRadius:8,padding:"10px 14px",fontSize:12,color:C.yellow }}>⚠️ احفظ كلمة المرور — مش هتقدر تشوفها تاني بعد الإنشاء</div>
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setShowAdd(false)}>إلغاء</Btn>
              <Btn onClick={addUser}>{adding?"جاري الإضافة...":"إضافة العميل"}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ data }) {
  const totalSales = data.salesInvoices.reduce((s,i)=>s+i.amount,0);
  const totalPurchases = data.purchaseInvoices.reduce((s,i)=>s+i.amount,0);
  const totalReceivable = data.salesInvoices.reduce((s,i)=>s+(i.amount-i.paid),0);
  const totalPayable = data.purchaseInvoices.reduce((s,i)=>s+(i.amount-i.paid),0);
  const totalReturns = data.returns.reduce((s,r)=>s+r.amount,0);
  const netProfit = totalSales - totalPurchases - totalReturns;
  const lowStock = data.inventory.filter(p=>p.qty<=p.minQty);

  const bigStats = [
    { label:"صافي الإيرادات", value:fmt(totalSales), color:C.green, icon:I.revenue },
    { label:"إجمالي المشتريات", value:fmt(totalPurchases), color:C.red, icon:I.purchase },
    { label:"صافي الربح", value:fmt(netProfit), color:netProfit>=0?C.green:C.red, icon:I.chartBar },
    { label:"مديونية العملاء", value:fmt(totalReceivable), color:C.accent, icon:I.clients },
    { label:"مديونية الموردين", value:fmt(totalPayable), color:C.yellow, icon:I.suppliers },
    { label:"المرتجعات", value:fmt(totalReturns), color:C.purple, icon:I.returns },
  ];

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:26 }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
        <div>
          <h1 style={{ margin:0,fontSize:24,fontWeight:800,color:C.text,letterSpacing:-0.5 }}>لوحة التحكم</h1>
          <p style={{ margin:"5px 0 0",color:C.textMuted,fontSize:13 }}>نظرة عامة شاملة على الأداء المالي</p>
        </div>
        <div style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 18px",fontSize:13,color:C.textDim,fontWeight:600 }}>
          {new Date().toLocaleDateString("ar-EG",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
        </div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:14 }}>
        {bigStats.map(s=>(
          <GlowCard key={s.label} color={s.color} style={{ padding:"18px 20px",display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
              <span style={{ fontSize:11,color:C.textMuted,fontWeight:600 }}>{s.label}</span>
              <div style={{ background:s.color+"18",padding:8,borderRadius:10 }}><Ic d={s.icon} s={15} c={s.color} /></div>
            </div>
            <div style={{ fontSize:21,fontWeight:800,color:s.color,fontFamily:"monospace" }}>{s.value}</div>
          </GlowCard>
        ))}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:18 }}>
        <Card>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <h3 style={{ margin:0,fontSize:14,fontWeight:700,color:C.text }}>آخر فواتير المبيعات</h3>
            <Badge label={`${data.salesInvoices.length} فاتورة`} />
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {data.salesInvoices.slice(-4).reverse().map(inv=>(
              <div key={inv.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:C.surface2,borderRadius:12,border:`1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize:13,fontWeight:600,color:C.text }}>{inv.client}</div>
                  <div style={{ fontSize:11,color:C.textMuted,marginTop:2 }}>{inv.date} · {inv.id}</div>
                </div>
                <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4 }}>
                  <div style={{ fontSize:13,fontWeight:700,color:C.green,fontFamily:"monospace" }}>{fmt(inv.amount)}</div>
                  <Badge label={inv.status} />
                </div>
              </div>
            ))}
            {data.salesInvoices.length === 0 && <div style={{ textAlign:"center",color:C.textMuted,fontSize:13,padding:20 }}>لا توجد فواتير بعد</div>}
          </div>
        </Card>
        <Card>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <h3 style={{ margin:0,fontSize:14,fontWeight:700,color:C.text }}>تنبيهات المخزون المنخفض</h3>
            {lowStock.length > 0 && <Badge label={`${lowStock.length} صنف`} />}
          </div>
          {lowStock.length===0 ? (
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:30,gap:10 }}>
              <div style={{ background:C.greenDim,padding:16,borderRadius:"50%" }}><Ic d={I.stocktake} s={28} c={C.green} /></div>
              <div style={{ fontSize:13,color:C.green,fontWeight:600 }}>المخزون في مستوى جيد</div>
            </div>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {lowStock.map(p=>(
                <div key={p.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:C.redDim,borderRadius:12,border:`1px solid ${C.red}22` }}>
                  <div>
                    <div style={{ fontSize:13,fontWeight:600,color:C.text }}>{p.name}</div>
                    <div style={{ fontSize:11,color:C.textMuted,marginTop:2 }}>{p.category}</div>
                  </div>
                  <div style={{ textAlign:"left" }}>
                    <div style={{ fontSize:13,fontWeight:700,color:C.red }}>{fmtNum(p.qty)} {p.unit}</div>
                    <div style={{ fontSize:10,color:C.textMuted,marginTop:2 }}>الحد: {p.minQty}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      {/* Quick stats row */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14 }}>
        <div style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 18px",textAlign:"center" }}>
          <div style={{ fontSize:24,fontWeight:800,color:C.accent }}>{data.clients.length}</div>
          <div style={{ fontSize:11,color:C.textMuted,marginTop:4 }}>عميل مسجل</div>
        </div>
        <div style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 18px",textAlign:"center" }}>
          <div style={{ fontSize:24,fontWeight:800,color:C.yellow }}>{data.suppliers.length}</div>
          <div style={{ fontSize:11,color:C.textMuted,marginTop:4 }}>مورد مسجل</div>
        </div>
        <div style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 18px",textAlign:"center" }}>
          <div style={{ fontSize:24,fontWeight:800,color:C.purple }}>{data.inventory.length}</div>
          <div style={{ fontSize:11,color:C.textMuted,marginTop:4 }}>صنف في المخزون</div>
        </div>
        <div style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 18px",textAlign:"center" }}>
          <div style={{ fontSize:24,fontWeight:800,color:C.cyan }}>{data.returns.length}</div>
          <div style={{ fontSize:11,color:C.textMuted,marginTop:4 }}>مرتجع مسجل</div>
        </div>
      </div>
    </div>
  );
}

// ─── INVOICE FORM ─────────────────────────────────────────────────────────────
function InvoiceForm({ type, clients, suppliers, categories, onSave, onClose }) {
  const isS = type==="sales";
  const [form, setForm] = useState({ date:today(),party:"",paid:"",taxRate:"14",notes:"" });
  const [items, setItems] = useState([{ category:"",name:"",qty:1,price:0 }]);
  const partyList = isS ? clients : suppliers;

  const subtotal = items.reduce((s,it)=>s+(parseFloat(it.qty)||0)*(parseFloat(it.price)||0),0);
  const taxAmount = subtotal*(parseFloat(form.taxRate)||0)/100;
  const total = subtotal+taxAmount;
  const paid = parseFloat(form.paid)||0;

  const addItem = ()=>setItems([...items,{ category:"",name:"",qty:1,price:0 }]);
  const removeItem = i=>setItems(items.filter((_,idx)=>idx!==i));
  const updateItem = (i,field,val)=>setItems(items.map((it,idx)=>idx===i?{...it,[field]:val}:it));

  const handleSave = () => {
    if (!form.party||items.every(it=>!it.name)) return;
    onSave({
      id:(isS?"S":"P")+Date.now().toString().slice(-5),
      date:form.date,
      [isS?"client":"supplier"]:form.party,
      amount:Math.round(total), paid,items,
      taxRate:parseFloat(form.taxRate)||0,
      subtotal:Math.round(subtotal),
      taxAmount:Math.round(taxAmount),
      notes:form.notes,
      status:paid>=total?"مدفوعة":paid>0?"جزئية":"غير مدفوعة",
    });
  };

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:18 }}>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
        <Inp label="التاريخ" type="date" value={form.date} onChange={v=>setForm({...form,date:v})} />
        <Sel label={isS?"العميل":"المورد"} value={form.party} onChange={v=>setForm({...form,party:v})} options={partyList.map(p=>({value:p.name,label:p.name}))} />
        <Inp label="نسبة الضريبة %" type="number" value={form.taxRate} onChange={v=>setForm({...form,taxRate:v})} placeholder="14" />
        <Inp label={isS?"المدفوع مقدماً":"المدفوع"} type="number" value={form.paid} onChange={v=>setForm({...form,paid:v})} placeholder="0" />
      </div>
      <div>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
          <label style={{ fontSize:13,fontWeight:600,color:C.textDim }}>الأصناف</label>
          <Btn small onClick={addItem}><Ic d={I.plus} s={12} />إضافة صنف</Btn>
        </div>
        <div style={{ background:C.surface2,borderRadius:12,overflow:"hidden",border:`1px solid ${C.border}` }}>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <THead cols={["الفئة","اسم الصنف","الكمية","السعر","الإجمالي",""]} />
            <tbody>
              {items.map((it,i)=>(
                <TRow key={i} alt={i%2}>
                  <td style={{ padding:"6px 10px" }}>
                    <select value={it.category} onChange={e=>updateItem(i,"category",e.target.value)}
                      style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 8px",color:C.text,fontSize:12,fontFamily:"inherit" }}>
                      <option value="">فئة</option>
                      {categories.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td style={{ padding:"6px 10px" }}>
                    <input value={it.name} onChange={e=>updateItem(i,"name",e.target.value)} placeholder="اسم الصنف"
                      style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 8px",color:C.text,fontSize:12,fontFamily:"inherit",width:"100%" }} />
                  </td>
                  <td style={{ padding:"6px 10px" }}>
                    <input type="number" value={it.qty} onChange={e=>updateItem(i,"qty",e.target.value)}
                      style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 8px",color:C.text,fontSize:12,fontFamily:"inherit",width:60 }} />
                  </td>
                  <td style={{ padding:"6px 10px" }}>
                    <input type="number" value={it.price} onChange={e=>updateItem(i,"price",e.target.value)}
                      style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 8px",color:C.text,fontSize:12,fontFamily:"inherit",width:80 }} />
                  </td>
                  <TD mono color={C.accent}>{fmt(it.qty*it.price)}</TD>
                  <td style={{ padding:"6px 10px" }}>
                    <button onClick={()=>removeItem(i)} style={{ background:"none",border:"none",cursor:"pointer",color:C.red }}><Ic d={I.trash} s={14} /></button>
                  </td>
                </TRow>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ background:C.surface3,borderRadius:12,padding:"14px 18px",display:"flex",flexDirection:"column",gap:8 }}>
        {[
          { label:"المجموع قبل الضريبة",val:fmt(subtotal),color:C.text },
          { label:`ضريبة ${form.taxRate}%`,val:fmt(taxAmount),color:C.yellow },
          { label:"الإجمالي الكلي",val:fmt(total),color:C.accent,bold:true },
          { label:"المدفوع",val:fmt(paid),color:C.green },
          { label:"المتبقي",val:fmt(total-paid),color:total-paid>0?C.red:C.green },
        ].map(r=>(
          <div key={r.label} style={{ display:"flex",justifyContent:"space-between",fontSize:r.bold?14:12,borderTop:r.bold?`1px solid ${C.border}`:"none",paddingTop:r.bold?8:0 }}>
            <span style={{ color:C.textMuted,fontWeight:r.bold?700:400 }}>{r.label}</span>
            <span style={{ color:r.color,fontWeight:700,fontFamily:"monospace" }}>{r.val}</span>
          </div>
        ))}
      </div>
      <Inp label="ملاحظات" value={form.notes} onChange={v=>setForm({...form,notes:v})} placeholder="أي ملاحظات إضافية..." />
      <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>إلغاء</Btn>
        <Btn onClick={handleSave}>حفظ الفاتورة</Btn>
      </div>
    </div>
  );
}

// ─── INVOICES PAGE ────────────────────────────────────────────────────────────
function InvoicesPage({ title, invoices, type, clients, suppliers, categories, onAdd, onDelete, userEmail }) {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [pwdDialog, setPwdDialog] = useState(null);

  const filtered = invoices.filter(i=>{
    const party = type==="sales"?i.client:i.supplier;
    return (party?.includes(search)||i.id?.includes(search)) && (!statusFilter||i.status===statusFilter);
  });

  const total = filtered.reduce((s,i)=>s+i.amount,0);
  const totalPaid = filtered.reduce((s,i)=>s+i.paid,0);
  const totalTax = filtered.reduce((s,i)=>s+(i.taxAmount||0),0);

  const handleDelete = (id) => {
    setPwdDialog({ onConfirm: () => {
      setPwdDialog(null);
      setConfirm({ id, msg: `هل أنت متأكد من حذف الفاتورة؟` });
    }});
  };

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      {confirm && <ConfirmDialog message={confirm.msg} onConfirm={()=>{ onDelete(confirm.id); setConfirm(null); }} onCancel={()=>setConfirm(null)} />}
      {pwdDialog && <PasswordDialog userEmail={userEmail} onConfirm={pwdDialog.onConfirm} onCancel={()=>setPwdDialog(null)} />}
      <PageHeader title={title} icon={type==="sales"?I.sales:I.purchase} subtitle={`${filtered.length} فاتورة`}
        action={<Btn onClick={()=>setShowModal(true)}><Ic d={I.plus} s={14} />فاتورة جديدة</Btn>} />
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
        <MiniStat label="الإجمالي" value={fmt(total)} color={C.accent} icon={I.revenue} />
        <MiniStat label="المدفوع" value={fmt(totalPaid)} color={C.green} icon={I.chartBar} />
        <MiniStat label="المتبقي" value={fmt(total-totalPaid)} color={C.red} icon={I.alert} />
        <MiniStat label="الضرائب" value={fmt(totalTax)} color={C.yellow} icon={I.tax} />
      </div>
      <Card style={{ padding:0 }}>
        <div style={{ padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بالاسم أو الرقم..."
            style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 13px",color:C.text,fontSize:12,fontFamily:"inherit",outline:"none",width:220 }} />
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
            style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 13px",color:C.text,fontSize:12,fontFamily:"inherit" }}>
            <option value="">كل الحالات</option>
            <option>مدفوعة</option><option>جزئية</option><option>غير مدفوعة</option>
          </select>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <THead cols={["رقم الفاتورة","التاريخ",type==="sales"?"العميل":"المورد","الأصناف","قبل الضريبة","الضريبة","الإجمالي",type==="sales"?"المدفوع":"المدفوع","المتبقي","الحالة","طباعة",""]} />
            <tbody>
              {filtered.map((inv,idx)=>{
                const party = type==="sales"?inv.client:inv.supplier;
                const remaining = inv.amount-inv.paid;
                const itemNames = (inv.items||[]).map(it=>it.name).filter(Boolean).join("، ");
                return (
                  <TRow key={inv.id} alt={idx%2}>
                    <TD color={C.accent}><span style={{ fontWeight:700 }}>{inv.id}</span></TD>
                    <TD color={C.textDim}>{inv.date}</TD>
                    <TD><span style={{ fontWeight:600 }}>{party}</span></TD>
                    <TD color={C.textMuted}><span style={{ fontSize:11 }}>{itemNames||"—"}</span></TD>
                    <TD mono color={C.textDim}>{fmt(inv.subtotal||inv.amount)}</TD>
                    <TD mono color={C.yellow}>{fmt(inv.taxAmount||0)}</TD>
                    <TD mono><span style={{ fontWeight:700 }}>{fmt(inv.amount)}</span></TD>
                    <TD mono color={C.green}>{fmt(inv.paid)}</TD>
                    <TD mono color={remaining>0?C.red:C.textMuted}>{fmt(remaining)}</TD>
                    <td style={{ padding:"11px 14px" }}><Badge label={inv.status} /></td>
                    <td style={{ padding:"11px 14px" }}>
                      <button onClick={()=>printInvoice(inv,type)} title="طباعة" style={{ background:"none",border:"none",cursor:"pointer",color:C.blue }}><Ic d={I.print} s={14} /></button>
                    </td>
                    <td style={{ padding:"11px 14px" }}>
                      <button onClick={()=>handleDelete(inv.id)} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted }}><Ic d={I.trash} s={14} /></button>
                    </td>
                  </TRow>
                );
              })}
            </tbody>
          </table>
          {filtered.length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد فواتير</div>}
        </div>
      </Card>
      {showModal && (
        <Modal title={`فاتورة ${type==="sales"?"مبيعات":"مشتريات"} جديدة`} onClose={()=>setShowModal(false)} wide>
          <InvoiceForm type={type} clients={clients} suppliers={suppliers} categories={categories}
            onSave={inv=>{ onAdd(inv); setShowModal(false); }} onClose={()=>setShowModal(false)} />
        </Modal>
      )}
    </div>
  );
}

// ─── ACCOUNT STATEMENT (العملاء والموردين) ────────────────────────────────────
function AccountStatement({ parties, invoices, type, onAddParty, onDeleteParty }) {
  const [selected, setSelected] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [addForm, setAddForm] = useState({ name:"",phone:"" });
  const key = type==="client"?"client":"supplier";
  const isClient = type==="client";

  const getStmt = name=>invoices.filter(i=>i[key]===name);
  const sel = parties.find(p=>p.name===selected);
  const stmt = selected?getStmt(selected):[];
  const totalAmt = stmt.reduce((s,i)=>s+i.amount,0);
  const totalPaid = stmt.reduce((s,i)=>s+i.paid,0);
  const balance = totalAmt-totalPaid;

  const handleAddParty = () => {
    if (!addForm.name.trim()) return;
    onAddParty({ id:(isClient?"C":"SP")+Date.now().toString().slice(-5),name:addForm.name.trim(),phone:addForm.phone.trim(),balance:0 });
    setAddForm({ name:"",phone:"" }); setShowAddModal(false);
  };

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      {confirm && <ConfirmDialog message={confirm.msg} onConfirm={()=>{ onDeleteParty(confirm.name); if(selected===confirm.name)setSelected(null); setConfirm(null); }} onCancel={()=>setConfirm(null)} />}
      <PageHeader title={`كشف حساب ${isClient?"العملاء":"الموردين"}`} icon={isClient?I.clients:I.suppliers}
        subtitle={`تتبع كل حركة مالية لكل ${isClient?"عميل":"مورد"}`}
        action={<Btn onClick={()=>setShowAddModal(true)}><Ic d={I.userPlus} s={14} />{isClient?"إضافة عميل":"إضافة مورد"}</Btn>} />
      {showAddModal && (
        <Modal title={isClient?"إضافة عميل جديد":"إضافة مورد جديد"} onClose={()=>setShowAddModal(false)}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <Inp label={isClient?"اسم العميل":"اسم المورد"} value={addForm.name} onChange={v=>setAddForm({...addForm,name:v})} required />
            <Inp label="رقم الهاتف" value={addForm.phone} onChange={v=>setAddForm({...addForm,phone:v})} placeholder="01xxxxxxxxx" />
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setShowAddModal(false)}>إلغاء</Btn>
              <Btn onClick={handleAddParty}>حفظ</Btn>
            </div>
          </div>
        </Modal>
      )}
      <div style={{ display:"grid",gridTemplateColumns:"260px 1fr",gap:18,alignItems:"start" }}>
        <Card style={{ padding:0 }}>
          <div style={{ padding:"12px 16px",borderBottom:`1px solid ${C.border}`,fontSize:11,fontWeight:700,color:C.textMuted,letterSpacing:0.5 }}>
            قائمة {isClient?"العملاء":"الموردين"} ({parties.length})
          </div>
          {parties.map(p=>{
            const bal = getStmt(p.name).reduce((s,i)=>s+(i.amount-i.paid),0);
            return (
              <div key={p.id} onClick={()=>setSelected(p.name)} style={{ padding:"12px 16px",cursor:"pointer",borderBottom:`1px solid ${C.border}10`,background:selected===p.name?C.accentDim:"transparent",borderRight:`3px solid ${selected===p.name?C.accent:"transparent"}`,display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.15s" }}>
                <div>
                  <div style={{ fontSize:13,fontWeight:600,color:C.text }}>{p.name}</div>
                  <div style={{ fontSize:11,color:bal>0?C.red:C.green,marginTop:2,fontFamily:"monospace" }}>{bal>0?`مديون: ${fmt(bal)}`:"✓ مسدد"}</div>
                </div>
                <button onClick={e=>{ e.stopPropagation(); setConfirm({ name:p.name,msg:`هل أنت متأكد من حذف "${p.name}"؟` }); }} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted,opacity:0.5 }}><Ic d={I.trash} s={12} /></button>
              </div>
            );
          })}
          {parties.length===0 && <div style={{ padding:24,textAlign:"center",color:C.textMuted,fontSize:12 }}>لا يوجد {isClient?"عملاء":"موردون"}</div>}
        </Card>
        <div>
          {selected ? (
            <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
              <Card>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                  <div>
                    <h2 style={{ margin:0,fontSize:18,fontWeight:700,color:C.text }}>{selected}</h2>
                    <div style={{ fontSize:12,color:C.textMuted,marginTop:4 }}>{sel?.phone}</div>
                  </div>
                  <div style={{ textAlign:"left" }}>
                    <div style={{ fontSize:11,color:C.textMuted,marginBottom:4 }}>الرصيد الحالي</div>
                    <div style={{ fontSize:24,fontWeight:800,color:balance>0?C.red:C.green,fontFamily:"monospace" }}>{fmt(balance)}</div>
                  </div>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginTop:16 }}>
                  {[{label:"إجمالي المعاملات",val:totalAmt,color:C.text},{label:"إجمالي المدفوع",val:totalPaid,color:C.green},{label:"المتبقي",val:balance,color:balance>0?C.red:C.green}].map(s=>(
                    <div key={s.label} style={{ background:C.surface2,borderRadius:10,padding:"10px 12px" }}>
                      <div style={{ fontSize:10,color:C.textMuted,fontWeight:600 }}>{s.label}</div>
                      <div style={{ fontSize:15,fontWeight:700,color:s.color,fontFamily:"monospace",marginTop:4 }}>{fmt(s.val)}</div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card style={{ padding:0 }}>
                <div style={{ padding:"12px 16px",borderBottom:`1px solid ${C.border}`,fontSize:13,fontWeight:700,color:C.text }}>سجل الفواتير</div>
                <table style={{ width:"100%",borderCollapse:"collapse" }}>
                  <THead cols={["رقم الفاتورة","التاريخ","الإجمالي","المدفوع","المتبقي","الحالة"]} />
                  <tbody>
                    {stmt.map((inv,i)=>(
                      <TRow key={inv.id} alt={i%2}>
                        <TD color={C.accent}>{inv.id}</TD>
                        <TD color={C.textDim}>{inv.date}</TD>
                        <TD mono>{fmt(inv.amount)}</TD>
                        <TD mono color={C.green}>{fmt(inv.paid)}</TD>
                        <TD mono color={(inv.amount-inv.paid)>0?C.red:C.textMuted}>{fmt(inv.amount-inv.paid)}</TD>
                        <td style={{ padding:"11px 14px" }}><Badge label={inv.status} /></td>
                      </TRow>
                    ))}
                  </tbody>
                </table>
                {stmt.length===0 && <div style={{ padding:20,textAlign:"center",color:C.textMuted,fontSize:12 }}>لا توجد فواتير</div>}
              </Card>
            </div>
          ) : (
            <Card style={{ display:"flex",alignItems:"center",justifyContent:"center",height:220 }}>
              <div style={{ textAlign:"center",color:C.textMuted }}>
                <div style={{ background:C.surface2,padding:20,borderRadius:"50%",display:"inline-flex",marginBottom:12 }}><Ic d={isClient?I.clients:I.suppliers} s={32} c={C.border} /></div>
                <div style={{ fontSize:13 }}>اختر {isClient?"عميلاً":"مورداً"} لعرض كشف الحساب</div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── REPORTS PAGE ─────────────────────────────────────────────────────────────
function ReportsPage({ data, userEmail }) {
  const [period, setPeriod] = useState("monthly");
  const [selectedMonth, setSelectedMonth] = useState(today().slice(0,7));
  const [pwdDialog, setPwdDialog] = useState(null);

  const allInvoices = [...data.salesInvoices,...data.purchaseInvoices];
  const months = [...new Set(allInvoices.map(i=>getMonth(i.date)))].sort().reverse();

  const salesByMonth = useMemo(()=>{
    const map={};
    data.salesInvoices.forEach(i=>{ const m=getMonth(i.date); if(!map[m])map[m]={sales:0,purchases:0,paid:0,unpaid:0,count:0}; map[m].sales+=i.amount; map[m].paid+=i.paid; map[m].unpaid+=(i.amount-i.paid); map[m].count++; });
    data.purchaseInvoices.forEach(i=>{ const m=getMonth(i.date); if(!map[m])map[m]={sales:0,purchases:0,paid:0,unpaid:0,count:0}; map[m].purchases+=i.amount; });
    return map;
  },[data]);

  const monthData = salesByMonth[selectedMonth]||{ sales:0,purchases:0,paid:0,unpaid:0,count:0 };
  const profit = monthData.sales-monthData.purchases;
  const filteredSales = data.salesInvoices.filter(i=>getMonth(i.date)===selectedMonth);
  const filteredPurchases = data.purchaseInvoices.filter(i=>getMonth(i.date)===selectedMonth);

  const catSales={};
  filteredSales.forEach(inv=>{ (inv.items||[]).forEach(it=>{ const c=it.category||"غير محدد"; catSales[c]=(catSales[c]||0)+it.qty*it.price; }); });

  const handlePrint = () => {
    setPwdDialog({ onConfirm: () => { setPwdDialog(null); printFinancialReport(data,period,selectedMonth); } });
  };

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:22 }}>
      {pwdDialog && <PasswordDialog userEmail={userEmail} onConfirm={pwdDialog.onConfirm} onCancel={()=>setPwdDialog(null)} title="تأكيد تحميل التقرير المالي" />}
      <PageHeader title="التقارير المالية" icon={I.report} subtitle="تقارير تفصيلية شهرية ويومية"
        action={<Btn variant="success" onClick={handlePrint}><Ic d={I.download} s={14} />تحميل التقرير</Btn>} />
      <div style={{ display:"flex",gap:10,alignItems:"center" }}>
        <div style={{ display:"flex",background:C.surface2,borderRadius:11,padding:3,border:`1px solid ${C.border}` }}>
          {["monthly","daily"].map(p=>(
            <button key={p} onClick={()=>setPeriod(p)} style={{ background:period===p?C.accent:"transparent",color:period===p?"#fff":C.textMuted,border:"none",borderRadius:8,padding:"7px 18px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s" }}>
              {p==="monthly"?"شهري":"يومي"}
            </button>
          ))}
        </div>
        <Sel value={selectedMonth} onChange={setSelectedMonth} options={months.map(m=>({ value:m,label:m }))} />
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
        <MiniStat label="المبيعات" value={fmt(monthData.sales)} color={C.green} icon={I.sales} />
        <MiniStat label="المشتريات" value={fmt(monthData.purchases)} color={C.red} icon={I.purchase} />
        <MiniStat label="صافي الربح" value={fmt(profit)} color={profit>=0?C.green:C.red} icon={I.chartBar} />
        <MiniStat label="المدفوع" value={fmt(monthData.paid)} color={C.accent} icon={I.revenue} />
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
        <Card>
          <h3 style={{ margin:"0 0 16px",fontSize:14,fontWeight:700,color:C.text }}>المبيعات حسب الفئة</h3>
          {Object.keys(catSales).length===0 ? (
            <div style={{ textAlign:"center",color:C.textMuted,padding:20,fontSize:13 }}>لا توجد بيانات لهذا الشهر</div>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              {Object.entries(catSales).sort((a,b)=>b[1]-a[1]).map(([cat,val])=>{
                const max=Math.max(...Object.values(catSales));
                return (
                  <div key={cat}>
                    <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                      <span style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>{cat}</span>
                      <span style={{ fontSize:12,color:C.accent,fontFamily:"monospace",fontWeight:700 }}>{fmt(val)}</span>
                    </div>
                    <ProgressBar value={val} max={max} color={C.accent} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <Card>
          <h3 style={{ margin:"0 0 16px",fontSize:14,fontWeight:700,color:C.text }}>تاريخ الأشهر</h3>
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {months.slice(0,6).map(m=>{
              const d=salesByMonth[m]||{};
              const p=(d.sales||0)-(d.purchases||0);
              return (
                <div key={m} onClick={()=>setSelectedMonth(m)} style={{ padding:"10px 14px",background:selectedMonth===m?C.accentDim:C.surface2,borderRadius:11,cursor:"pointer",border:`1px solid ${selectedMonth===m?C.accent+"44":"transparent"}`,display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.15s" }}>
                  <span style={{ fontSize:13,fontWeight:600,color:C.text }}>{m}</span>
                  <div style={{ display:"flex",gap:14 }}>
                    <span style={{ fontSize:11,color:C.green,fontFamily:"monospace" }}>{fmt(d.sales||0)}</span>
                    <span style={{ fontSize:11,color:p>=0?C.green:C.red,fontFamily:"monospace" }}>{p>=0?"+":""}{fmt(p)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      <Card style={{ padding:0 }}>
        <div style={{ padding:"14px 18px",borderBottom:`1px solid ${C.border}`,fontSize:14,fontWeight:700,color:C.text }}>فواتير المبيعات — {selectedMonth}</div>
        <table style={{ width:"100%",borderCollapse:"collapse" }}>
          <THead cols={["رقم الفاتورة","التاريخ","العميل","الإجمالي","المدفوع","المتبقي","الحالة"]} />
          <tbody>
            {filteredSales.map((inv,i)=>(
              <TRow key={inv.id} alt={i%2}>
                <TD color={C.accent}>{inv.id}</TD><TD color={C.textDim}>{inv.date}</TD><TD>{inv.client}</TD>
                <TD mono>{fmt(inv.amount)}</TD><TD mono color={C.green}>{fmt(inv.paid)}</TD>
                <TD mono color={(inv.amount-inv.paid)>0?C.red:C.textMuted}>{fmt(inv.amount-inv.paid)}</TD>
                <td style={{ padding:"11px 14px" }}><Badge label={inv.status} /></td>
              </TRow>
            ))}
          </tbody>
        </table>
        {filteredSales.length===0 && <div style={{ padding:30,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد فواتير لهذا الشهر</div>}
      </Card>
      <Card style={{ padding:0 }}>
        <div style={{ padding:"14px 18px",borderBottom:`1px solid ${C.border}`,fontSize:14,fontWeight:700,color:C.text }}>فواتير المشتريات — {selectedMonth}</div>
        <table style={{ width:"100%",borderCollapse:"collapse" }}>
          <THead cols={["رقم الفاتورة","التاريخ","المورد","الإجمالي","المدفوع","المتبقي","الحالة"]} />
          <tbody>
            {filteredPurchases.map((inv,i)=>(
              <TRow key={inv.id} alt={i%2}>
                <TD color={C.accent}>{inv.id}</TD><TD color={C.textDim}>{inv.date}</TD><TD>{inv.supplier}</TD>
                <TD mono>{fmt(inv.amount)}</TD><TD mono color={C.green}>{fmt(inv.paid)}</TD>
                <TD mono color={(inv.amount-inv.paid)>0?C.red:C.textMuted}>{fmt(inv.amount-inv.paid)}</TD>
                <td style={{ padding:"11px 14px" }}><Badge label={inv.status} /></td>
              </TRow>
            ))}
          </tbody>
        </table>
        {filteredPurchases.length===0 && <div style={{ padding:30,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد فواتير مشتريات لهذا الشهر</div>}
      </Card>
    </div>
  );
}

// ─── RETURNS PAGE ─────────────────────────────────────────────────────────────
function ReturnsPage({ returns, salesInvoices, purchaseInvoices, clients, suppliers, onAdd, onDelete }) {
  const [showModal, setShowModal] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [form, setForm] = useState({ date:today(),type:"sales",invoiceId:"",party:"",amount:"",reason:"" });

  const invoiceList = form.type==="sales"?salesInvoices:purchaseInvoices;
  const partyList = form.type==="sales"?clients:suppliers;
  const partyKey = form.type==="sales"?"client":"supplier";

  const handleSave = () => {
    if (!form.party||!form.amount) return;
    onAdd({ id:"R"+Date.now().toString().slice(-5),date:form.date,type:form.type,invoiceId:form.invoiceId,party:form.party,amount:parseFloat(form.amount)||0,reason:form.reason });
    setShowModal(false);
    setForm({ date:today(),type:"sales",invoiceId:"",party:"",amount:"",reason:"" });
  };

  const totalReturns = returns.reduce((s,r)=>s+r.amount,0);
  const salesReturns = returns.filter(r=>r.type==="sales").reduce((s,r)=>s+r.amount,0);
  const purchaseReturns = returns.filter(r=>r.type==="purchase").reduce((s,r)=>s+r.amount,0);

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      {confirm && <ConfirmDialog message={confirm.msg} onConfirm={()=>{ onDelete(confirm.id); setConfirm(null); }} onCancel={()=>setConfirm(null)} />}
      <PageHeader title="المرتجعات" icon={I.returns} subtitle={`${returns.length} مرتجع مسجل`}
        action={<Btn onClick={()=>setShowModal(true)}><Ic d={I.plus} s={14} />مرتجع جديد</Btn>} />
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12 }}>
        <MiniStat label="إجمالي المرتجعات" value={fmt(totalReturns)} color={C.purple} icon={I.returns} />
        <MiniStat label="مرتجعات مبيعات" value={fmt(salesReturns)} color={C.red} icon={I.sales} />
        <MiniStat label="مرتجعات مشتريات" value={fmt(purchaseReturns)} color={C.green} icon={I.purchase} />
      </div>
      <Card style={{ padding:0 }}>
        <table style={{ width:"100%",borderCollapse:"collapse" }}>
          <THead cols={["رقم المرتجع","التاريخ","النوع","الطرف","رقم الفاتورة","المبلغ","السبب",""]} />
          <tbody>
            {returns.map((r,i)=>(
              <TRow key={r.id} alt={i%2}>
                <TD color={C.purple}><span style={{ fontWeight:700 }}>{r.id}</span></TD>
                <TD color={C.textDim}>{r.date}</TD>
                <TD><Badge label="مرتجع" /></TD>
                <TD>{r.party}</TD>
                <TD color={C.accent}>{r.invoiceId||"—"}</TD>
                <TD mono color={C.red}>{fmt(r.amount)}</TD>
                <TD color={C.textMuted}>{r.reason||"—"}</TD>
                <td style={{ padding:"11px 14px" }}>
                  <button onClick={()=>setConfirm({ id:r.id,msg:`هل أنت متأكد من حذف المرتجع ${r.id}؟` })} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted }}><Ic d={I.trash} s={14} /></button>
                </td>
              </TRow>
            ))}
          </tbody>
        </table>
        {returns.length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد مرتجعات</div>}
      </Card>
      {showModal && (
        <Modal title="مرتجع جديد" onClose={()=>setShowModal(false)}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <Inp label="التاريخ" type="date" value={form.date} onChange={v=>setForm({...form,date:v})} />
              <Sel label="نوع المرتجع" value={form.type} onChange={v=>setForm({...form,type:v,invoiceId:"",party:""})} options={[{ value:"sales",label:"مرتجع مبيعات" },{ value:"purchase",label:"مرتجع مشتريات" }]} />
              <Sel label="الطرف" value={form.party} onChange={v=>setForm({...form,party:v})} options={partyList.map(p=>({ value:p.name,label:p.name }))} />
              <Sel label="رقم الفاتورة (اختياري)" value={form.invoiceId} onChange={v=>setForm({...form,invoiceId:v})} options={invoiceList.filter(i=>i[partyKey]===form.party).map(i=>({ value:i.id,label:i.id }))} placeholder="-- اختياري --" />
              <Inp label="المبلغ المرتجع" type="number" value={form.amount} onChange={v=>setForm({...form,amount:v})} required />
            </div>
            <Inp label="سبب المرتجع" value={form.reason} onChange={v=>setForm({...form,reason:v})} placeholder="وصف سبب الإرجاع..." />
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setShowModal(false)}>إلغاء</Btn>
              <Btn onClick={handleSave}>حفظ المرتجع</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── REVENUE PAGE ─────────────────────────────────────────────────────────────
function RevenuePage({ data, onDeleteMonth, userEmail }) {
  const [confirm, setConfirm] = useState(null);
  const [pwdDialog, setPwdDialog] = useState(null);

  const totalSales = data.salesInvoices.reduce((s,i)=>s+i.amount,0);
  const totalPurchases = data.purchaseInvoices.reduce((s,i)=>s+i.amount,0);
  const totalReturns = data.returns.reduce((s,r)=>s+r.amount,0);
  const totalTax = data.salesInvoices.reduce((s,i)=>s+(i.taxAmount||0),0);
  const netRevenue = totalSales-totalReturns;
  const grossProfit = netRevenue-totalPurchases;
  const netProfit = grossProfit-totalTax;

  const clientRevenue={};
  data.salesInvoices.forEach(i=>{ clientRevenue[i.client]=(clientRevenue[i.client]||0)+i.amount; });
  const topClients = Object.entries(clientRevenue).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxClient = topClients[0]?.[1]||1;

  const monthlyRev={};
  data.salesInvoices.forEach(i=>{ const m=getMonth(i.date); monthlyRev[m]=(monthlyRev[m]||0)+i.amount; });

  const handleDeleteMonth = (month) => {
    setPwdDialog({ month, onConfirm: () => {
      setPwdDialog(null);
      setConfirm({ month, msg:`هل أنت متأكد من حذف كل بيانات شهر "${month}"؟ لا يمكن التراجع عن هذا الإجراء.` });
    }});
  };

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:22 }}>
      {confirm && <ConfirmDialog message={confirm.msg} onConfirm={()=>{ onDeleteMonth(confirm.month); setConfirm(null); }} onCancel={()=>setConfirm(null)} />}
      {pwdDialog && <PasswordDialog userEmail={userEmail} onConfirm={pwdDialog.onConfirm} onCancel={()=>setPwdDialog(null)} title="تأكيد حذف بيانات الشهر" />}
      <PageHeader title="الإيرادات" icon={I.revenue} subtitle="تحليل شامل للإيرادات والأرباح" />
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14 }}>
        {[
          { label:"صافي الإيرادات",val:netRevenue,color:C.green,icon:I.revenue },
          { label:"إجمالي المشتريات",val:totalPurchases,color:C.red,icon:I.purchase },
          { label:"مجمل الربح",val:grossProfit,color:grossProfit>=0?C.green:C.red,icon:I.chartBar },
          { label:"صافي الربح",val:netProfit,color:netProfit>=0?C.green:C.red,icon:I.chartBar },
        ].map(s=>(
          <GlowCard key={s.label} color={s.color} style={{ padding:"18px 20px" }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
              <div style={{ background:s.color+"18",padding:7,borderRadius:8 }}><Ic d={s.icon} s={14} c={s.color} /></div>
              <span style={{ fontSize:11,color:C.textMuted,fontWeight:600 }}>{s.label}</span>
            </div>
            <div style={{ fontSize:21,fontWeight:800,color:s.color,fontFamily:"monospace" }}>{fmt(s.val)}</div>
          </GlowCard>
        ))}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
        <Card>
          <h3 style={{ margin:"0 0 16px",fontSize:14,fontWeight:700,color:C.text }}>أفضل العملاء</h3>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            {topClients.map(([name,val])=>(
              <div key={name}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                  <span style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>{name}</span>
                  <span style={{ fontSize:12,color:C.green,fontFamily:"monospace",fontWeight:700 }}>{fmt(val)}</span>
                </div>
                <ProgressBar value={val} max={maxClient} color={C.green} />
              </div>
            ))}
            {topClients.length===0 && <div style={{ textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد بيانات</div>}
          </div>
        </Card>
        <Card>
          <h3 style={{ margin:"0 0 16px",fontSize:14,fontWeight:700,color:C.text }}>الإيرادات الشهرية</h3>
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {Object.entries(monthlyRev).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,6).map(([month,val])=>(
              <div key={month} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:C.surface2,borderRadius:11,border:`1px solid ${C.border}` }}>
                <span style={{ fontSize:13,color:C.text,fontWeight:600 }}>{month}</span>
                <div style={{ display:"flex",gap:10,alignItems:"center" }}>
                  <span style={{ fontSize:13,color:C.green,fontFamily:"monospace",fontWeight:700 }}>{fmt(val)}</span>
                  <button onClick={()=>handleDeleteMonth(month)} style={{ background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:7,padding:"4px 10px",cursor:"pointer",color:C.red,fontSize:11,fontWeight:600,fontFamily:"inherit",display:"flex",alignItems:"center",gap:4 }}>
                    <Ic d={I.trash} s={11} />حذف الشهر
                  </button>
                </div>
              </div>
            ))}
            {Object.keys(monthlyRev).length===0 && <div style={{ textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد بيانات</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── TAX INVOICES PAGE ────────────────────────────────────────────────────────
function TaxInvoicesPage({ salesInvoices, purchaseInvoices }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const allWithTax = [
    ...salesInvoices.filter(i=>i.taxAmount>0).map(i=>({...i,_type:"sales"})),
    ...purchaseInvoices.filter(i=>i.taxAmount>0).map(i=>({...i,_type:"purchases"})),
  ].sort((a,b)=>b.date.localeCompare(a.date));

  const filtered = allWithTax.filter(i=>{
    const party = i._type==="sales"?i.client:i.supplier;
    const matchSearch = party?.includes(search)||i.id?.includes(search);
    const matchType = typeFilter==="all"||(typeFilter==="sales"&&i._type==="sales")||(typeFilter==="purchases"&&i._type==="purchases");
    return matchSearch&&matchType;
  });

  const totalTax = filtered.reduce((s,i)=>s+(i.taxAmount||0),0);

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      <PageHeader title="الفواتير الضريبية" icon={I.tax} subtitle={`${filtered.length} فاتورة ضريبية`} />
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12 }}>
        <MiniStat label="إجمالي الضرائب" value={fmt(totalTax)} color={C.yellow} icon={I.tax} />
        <MiniStat label="فواتير مبيعات" value={allWithTax.filter(i=>i._type==="sales").length} color={C.green} icon={I.sales} />
        <MiniStat label="فواتير مشتريات" value={allWithTax.filter(i=>i._type==="purchases").length} color={C.red} icon={I.purchase} />
      </div>
      <Card style={{ padding:0 }}>
        <div style={{ padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:10,alignItems:"center" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بالاسم أو الرقم..."
            style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 13px",color:C.text,fontSize:12,fontFamily:"inherit",outline:"none",width:220 }} />
          <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}
            style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 13px",color:C.text,fontSize:12,fontFamily:"inherit" }}>
            <option value="all">الكل</option>
            <option value="sales">مبيعات</option>
            <option value="purchases">مشتريات</option>
          </select>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <THead cols={["رقم الفاتورة","التاريخ","النوع","العميل/المورد","الإجمالي قبل الضريبة","نسبة الضريبة","قيمة الضريبة","الإجمالي شامل الضريبة","الحالة","طباعة"]} />
            <tbody>
              {filtered.map((inv,idx)=>{
                const party = inv._type==="sales"?inv.client:inv.supplier;
                return (
                  <TRow key={inv.id+inv._type} alt={idx%2}>
                    <TD color={C.accent}><span style={{ fontWeight:700 }}>{inv.id}</span></TD>
                    <TD color={C.textDim}>{inv.date}</TD>
                    <td style={{ padding:"11px 14px" }}>
                      <span style={{ background:inv._type==="sales"?C.greenDim:C.redDim,color:inv._type==="sales"?C.green:C.red,border:`1px solid ${inv._type==="sales"?C.green:C.red}33`,padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700 }}>
                        {inv._type==="sales"?"مبيعات":"مشتريات"}
                      </span>
                    </td>
                    <TD><span style={{ fontWeight:600 }}>{party}</span></TD>
                    <TD mono color={C.textDim}>{fmt(inv.subtotal||inv.amount)}</TD>
                    <TD mono color={C.yellow}>{inv.taxRate||14}%</TD>
                    <TD mono color={C.yellow}><span style={{ fontWeight:700 }}>{fmt(inv.taxAmount||0)}</span></TD>
                    <TD mono><span style={{ fontWeight:700 }}>{fmt(inv.amount)}</span></TD>
                    <td style={{ padding:"11px 14px" }}><Badge label={inv.status} /></td>
                    <td style={{ padding:"11px 14px" }}>
                      <button onClick={()=>printTaxInvoice(inv)} title="طباعة الفاتورة الضريبية"
                        style={{ background:C.yellowDim,border:`1px solid ${C.yellow}33`,borderRadius:7,padding:"5px 10px",cursor:"pointer",color:C.yellow,display:"flex",alignItems:"center",gap:4 }}>
                        <Ic d={I.print} s={13} />ضريبية
                      </button>
                    </td>
                  </TRow>
                );
              })}
            </tbody>
          </table>
          {filtered.length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد فواتير ضريبية</div>}
        </div>
      </Card>
    </div>
  );
}

// ─── MONTHLY REPORTS PAGE ─────────────────────────────────────────────────────
function MonthlyReportsPage({ data }) {
  const [selectedMonth, setSelectedMonth] = useState(today().slice(0,7));

  const allMonths = [...new Set([
    ...data.salesInvoices.map(i=>getMonth(i.date)),
    ...data.purchaseInvoices.map(i=>getMonth(i.date)),
  ])].sort().reverse();

  const filteredSales = data.salesInvoices.filter(i=>getMonth(i.date)===selectedMonth);
  const filteredPurchases = data.purchaseInvoices.filter(i=>getMonth(i.date)===selectedMonth);
  const filteredReturns = data.returns.filter(r=>getMonth(r.date)===selectedMonth);

  const totalSales = filteredSales.reduce((s,i)=>s+i.amount,0);
  const totalPurchases = filteredPurchases.reduce((s,i)=>s+i.amount,0);
  const totalPaid = filteredSales.reduce((s,i)=>s+i.paid,0);
  const totalTax = filteredSales.reduce((s,i)=>s+(i.taxAmount||0),0);
  const totalReturns = filteredReturns.reduce((s,r)=>s+r.amount,0);
  const profit = totalSales - totalPurchases;

  const dailySales = {};
  filteredSales.forEach(i=>{ dailySales[i.date]=(dailySales[i.date]||0)+i.amount; });

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:22 }}>
      <PageHeader title="التقارير الشهرية" icon={I.calendar} subtitle="تقرير مفصل شهر بشهر"
        action={<Btn variant="success" onClick={()=>printFinancialReport(data,"monthly",selectedMonth)}><Ic d={I.download} s={14} />تحميل</Btn>} />
      <div style={{ display:"flex",gap:10,alignItems:"center" }}>
        <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)}
          style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 14px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none" }}>
          {allMonths.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
        <div style={{ fontSize:12,color:C.textMuted }}>اختر الشهر لعرض التقرير</div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:12 }}>
        <MiniStat label="المبيعات" value={fmt(totalSales)} color={C.green} icon={I.sales} />
        <MiniStat label="المشتريات" value={fmt(totalPurchases)} color={C.red} icon={I.purchase} />
        <MiniStat label="صافي الربح" value={fmt(profit)} color={profit>=0?C.green:C.red} icon={I.chartBar} />
        <MiniStat label="المدفوع" value={fmt(totalPaid)} color={C.accent} icon={I.revenue} />
        <MiniStat label="الضرائب" value={fmt(totalTax)} color={C.yellow} icon={I.tax} />
        <MiniStat label="المرتجعات" value={fmt(totalReturns)} color={C.purple} icon={I.returns} />
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
        <Card>
          <h3 style={{ margin:"0 0 14px",fontSize:14,fontWeight:700,color:C.text }}>المبيعات اليومية — {selectedMonth}</h3>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {Object.entries(dailySales).sort((a,b)=>b[0].localeCompare(a[0])).map(([date,val])=>(
              <div key={date} style={{ display:"flex",justifyContent:"space-between",padding:"8px 12px",background:C.surface2,borderRadius:9 }}>
                <span style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>{date}</span>
                <span style={{ fontSize:12,color:C.green,fontFamily:"monospace",fontWeight:700 }}>{fmt(val)}</span>
              </div>
            ))}
            {Object.keys(dailySales).length===0 && <div style={{ textAlign:"center",color:C.textMuted,fontSize:13,padding:20 }}>لا توجد مبيعات</div>}
          </div>
        </Card>
        <Card>
          <h3 style={{ margin:"0 0 14px",fontSize:14,fontWeight:700,color:C.text }}>ملخص {selectedMonth}</h3>
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {[
              { label:"عدد فواتير المبيعات",val:filteredSales.length,color:C.green },
              { label:"عدد فواتير المشتريات",val:filteredPurchases.length,color:C.red },
              { label:"عدد المرتجعات",val:filteredReturns.length,color:C.purple },
              { label:"متوسط قيمة الفاتورة",val:fmt(filteredSales.length>0?totalSales/filteredSales.length:0),color:C.accent },
            ].map(s=>(
              <div key={s.label} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:C.surface2,borderRadius:10 }}>
                <span style={{ fontSize:12,color:C.textMuted }}>{s.label}</span>
                <span style={{ fontSize:13,color:s.color,fontWeight:700,fontFamily:"monospace" }}>{s.val}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card style={{ padding:0 }}>
        <div style={{ padding:"14px 18px",borderBottom:`1px solid ${C.border}`,fontSize:14,fontWeight:700,color:C.text }}>فواتير المبيعات — {selectedMonth}</div>
        <table style={{ width:"100%",borderCollapse:"collapse" }}>
          <THead cols={["رقم الفاتورة","التاريخ","العميل","الإجمالي","المدفوع","المتبقي","الحالة"]} />
          <tbody>
            {filteredSales.map((inv,i)=>(
              <TRow key={inv.id} alt={i%2}>
                <TD color={C.accent}>{inv.id}</TD><TD color={C.textDim}>{inv.date}</TD><TD>{inv.client}</TD>
                <TD mono>{fmt(inv.amount)}</TD><TD mono color={C.green}>{fmt(inv.paid)}</TD>
                <TD mono color={(inv.amount-inv.paid)>0?C.red:C.textMuted}>{fmt(inv.amount-inv.paid)}</TD>
                <td style={{ padding:"11px 14px" }}><Badge label={inv.status} /></td>
              </TRow>
            ))}
          </tbody>
        </table>
        {filteredSales.length===0 && <div style={{ padding:24,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد فواتير</div>}
      </Card>
    </div>
  );
}

// ─── INVENTORY ITEMS PAGE (المخزون كأصناف) ────────────────────────────────────
function InventoryItemsPage({ inventory, categories }) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");

  const filtered = inventory.filter(p=>{
    const matchSearch = p.name?.includes(search)||p.id?.includes(search)||p.category?.includes(search);
    const matchCat = !catFilter||p.category===catFilter;
    return matchSearch&&matchCat;
  });

  const totalValue = filtered.reduce((s,p)=>s+p.qty*p.cost,0);
  const totalSaleValue = filtered.reduce((s,p)=>s+p.qty*p.price,0);
  const lowItems = filtered.filter(p=>p.qty<=p.minQty);

  const catStats = {};
  filtered.forEach(p=>{ catStats[p.category]=(catStats[p.category]||{count:0,qty:0,value:0}); catStats[p.category].count++; catStats[p.category].qty+=p.qty; catStats[p.category].value+=p.qty*p.cost; });

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      <PageHeader title="المخزون كأصناف" icon={I.box} subtitle={`${filtered.length} صنف — إجمالي قيمة ${fmt(totalValue)}`} />
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
        <MiniStat label="إجمالي الأصناف" value={fmtNum(filtered.length)} color={C.accent} icon={I.box} />
        <MiniStat label="أصناف منخفضة" value={fmtNum(lowItems.length)} color={C.red} icon={I.alert} />
        <MiniStat label="قيمة المخزون" value={fmt(totalValue)} color={C.yellow} icon={I.revenue} />
        <MiniStat label="قيمة البيع" value={fmt(totalSaleValue)} color={C.green} icon={I.chartBar} />
      </div>
      {/* Category breakdown */}
      <Card>
        <h3 style={{ margin:"0 0 16px",fontSize:14,fontWeight:700,color:C.text }}>توزيع الأصناف حسب الفئة</h3>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10 }}>
          {Object.entries(catStats).map(([cat,s])=>(
            <div key={cat} style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px" }}>
              <div style={{ fontSize:12,fontWeight:700,color:C.text,marginBottom:8 }}>{cat}</div>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                <span style={{ fontSize:11,color:C.textMuted }}>عدد الأصناف</span>
                <span style={{ fontSize:12,color:C.accent,fontWeight:700 }}>{s.count}</span>
              </div>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                <span style={{ fontSize:11,color:C.textMuted }}>إجمالي الكمية</span>
                <span style={{ fontSize:12,color:C.text,fontWeight:600 }}>{fmtNum(s.qty)}</span>
              </div>
              <div style={{ display:"flex",justifyContent:"space-between" }}>
                <span style={{ fontSize:11,color:C.textMuted }}>القيمة</span>
                <span style={{ fontSize:12,color:C.yellow,fontFamily:"monospace",fontWeight:700 }}>{fmt(s.value)}</span>
              </div>
            </div>
          ))}
          {Object.keys(catStats).length===0 && <div style={{ color:C.textMuted,fontSize:13 }}>لا توجد بيانات</div>}
        </div>
      </Card>
      <Card style={{ padding:0 }}>
        <div style={{ padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:10,alignItems:"center" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بالاسم أو الفئة..."
            style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 13px",color:C.text,fontSize:12,fontFamily:"inherit",outline:"none",width:220 }} />
          <select value={catFilter} onChange={e=>setCatFilter(e.target.value)}
            style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 13px",color:C.text,fontSize:12,fontFamily:"inherit" }}>
            <option value="">كل الفئات</option>
            {categories.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <THead cols={["الكود","الصنف","الفئة","الكمية الحالية","الحد الأدنى","الوحدة","سعر التكلفة","سعر البيع","قيمة المخزون","هامش الربح","الحالة"]} />
            <tbody>
              {filtered.map((p,idx)=>{
                const margin = p.price > 0 ? ((p.price-p.cost)/p.price*100).toFixed(1) : 0;
                return (
                  <TRow key={p.id} alt={idx%2}>
                    <TD color={C.accent}><span style={{ fontSize:11 }}>{p.id}</span></TD>
                    <TD><span style={{ fontWeight:600 }}>{p.name}</span></TD>
                    <TD color={C.textDim}>{p.category}</TD>
                    <TD mono color={p.qty<=p.minQty?C.red:C.green}><span style={{ fontWeight:700 }}>{fmtNum(p.qty)}</span></TD>
                    <TD mono color={C.textMuted}>{fmtNum(p.minQty)}</TD>
                    <TD color={C.textMuted}>{p.unit}</TD>
                    <TD mono color={C.textDim}>{fmt(p.cost)}</TD>
                    <TD mono color={C.green}>{fmt(p.price)}</TD>
                    <TD mono color={C.yellow}>{fmt(p.qty*p.cost)}</TD>
                    <td style={{ padding:"11px 14px" }}>
                      <span style={{ color:margin>20?C.green:margin>10?C.yellow:C.red,fontFamily:"monospace",fontWeight:700,fontSize:12 }}>{margin}%</span>
                    </td>
                    <td style={{ padding:"11px 14px" }}><Badge label={p.qty<=p.minQty?"منخفض":"كافي"} /></td>
                  </TRow>
                );
              })}
            </tbody>
          </table>
          {filtered.length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد أصناف</div>}
        </div>
      </Card>
    </div>
  );
}

// ─── INVENTORY PAGE ───────────────────────────────────────────────────────────
function InventoryPage({ inventory, categories, onAdd, onEdit, onDelete, onBulkAdd, userEmail }) {
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [pwdDialog, setPwdDialog] = useState(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [stocktakePeriod, setStocktakePeriod] = useState("monthly");
  const [stocktakeMonth, setStocktakeMonth] = useState(today().slice(0,7));
  const [form, setForm] = useState({ name:"",category:"",qty:0,minQty:0,cost:0,price:0,unit:"قطعة" });

  const filtered = inventory.filter(p=>{
    const matchSearch = p.name?.includes(search)||p.id?.includes(search);
    const matchCat = !catFilter||p.category===catFilter;
    return matchSearch&&matchCat;
  });

  const totalCost = filtered.reduce((s,p)=>s+p.qty*p.cost,0);
  const totalSaleVal = filtered.reduce((s,p)=>s+p.qty*p.price,0);
  const lowItems = filtered.filter(p=>p.qty<=p.minQty);

  const openAdd = ()=>{ setForm({ name:"",category:categories[0]||"",qty:0,minQty:0,cost:0,price:0,unit:"قطعة" }); setEditItem(null); setShowModal(true); };
  const openEdit = item=>{ setForm({ ...item }); setEditItem(item); setShowModal(true); };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const record = { ...form,qty:parseFloat(form.qty)||0,minQty:parseFloat(form.minQty)||0,cost:parseFloat(form.cost)||0,price:parseFloat(form.price)||0 };
    if (editItem) { onEdit({ ...record,id:editItem.id }); }
    else { onAdd({ ...record,id:"INV"+Date.now().toString().slice(-5) }); }
    setShowModal(false);
  };

  const handleDelete = (id, name) => {
    setPwdDialog({ onConfirm: () => {
      setPwdDialog(null);
      setConfirm({ id, msg:`هل أنت متأكد من حذف الصنف "${name}"؟` });
    }});
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const items = parseInventoryCSV(ev.target.result, categories);
      if (items.length > 0) onBulkAdd(items);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      {confirm && <ConfirmDialog message={confirm.msg} onConfirm={()=>{ onDelete(confirm.id); setConfirm(null); }} onCancel={()=>setConfirm(null)} />}
      {pwdDialog && <PasswordDialog userEmail={userEmail} onConfirm={pwdDialog.onConfirm} onCancel={()=>setPwdDialog(null)} />}
      <PageHeader title="إدارة المخزون" icon={I.inventory} subtitle={`${inventory.length} صنف`}
        action={
          <div style={{ display:"flex",gap:8 }}>
            <label style={{ background:C.greenDim,color:C.green,border:`1px solid ${C.green}33`,borderRadius:9,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6 }}>
              <Ic d={I.upload} s={13} />رفع Excel
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} style={{ display:"none" }} />
            </label>
            <Btn variant="yellow" onClick={downloadInventoryTemplate}><Ic d={I.download} s={13} />قالب CSV</Btn>
            <Btn onClick={openAdd}><Ic d={I.plus} s={14} />إضافة صنف</Btn>
          </div>
        }
      />
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
        <MiniStat label="إجمالي الأصناف" value={fmtNum(filtered.length)} color={C.accent} icon={I.box} />
        <MiniStat label="أصناف منخفضة" value={fmtNum(lowItems.length)} color={C.red} icon={I.alert} />
        <MiniStat label="قيمة المخزون" value={fmt(totalCost)} color={C.yellow} icon={I.revenue} />
        <MiniStat label="قيمة البيع" value={fmt(totalSaleVal)} color={C.green} icon={I.chartBar} />
      </div>
      {lowItems.length>0 && (
        <div style={{ background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:12,padding:"12px 18px",display:"flex",alignItems:"center",gap:10 }}>
          <Ic d={I.alert} s={16} c={C.red} />
          <span style={{ fontSize:13,color:C.red,fontWeight:600 }}>{lowItems.length} أصناف وصلت للحد الأدنى: {lowItems.map(p=>p.name).join("، ")}</span>
        </div>
      )}
      <Card style={{ padding:0 }}>
        <div style={{ padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بالاسم أو الكود..."
            style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 13px",color:C.text,fontSize:12,fontFamily:"inherit",outline:"none",width:200 }} />
          <select value={catFilter} onChange={e=>setCatFilter(e.target.value)}
            style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 13px",color:C.text,fontSize:12,fontFamily:"inherit" }}>
            <option value="">كل الفئات</option>
            {categories.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <div style={{ marginRight:"auto",display:"flex",gap:8 }}>
            <select value={stocktakePeriod} onChange={e=>setStocktakePeriod(e.target.value)}
              style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 13px",color:C.text,fontSize:12,fontFamily:"inherit" }}>
              <option value="monthly">جرد شهري</option>
              <option value="weekly">جرد أسبوعي</option>
            </select>
            <input type="month" value={stocktakeMonth} onChange={e=>setStocktakeMonth(e.target.value)}
              style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 13px",color:C.text,fontSize:12,fontFamily:"inherit",outline:"none" }} />
            <Btn variant="success" small onClick={()=>printStocktakeReport(filtered,stocktakePeriod,stocktakeMonth)}>
              <Ic d={I.print} s={12} />طباعة الجرد
            </Btn>
          </div>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <THead cols={["الكود","الصنف","الفئة","الكمية","الحد الأدنى","سعر التكلفة","سعر البيع","الوحدة","قيمة المخزون","الحالة",""]} />
            <tbody>
              {filtered.map((p,idx)=>(
                <TRow key={p.id} alt={idx%2}>
                  <TD color={C.accent}><span style={{ fontSize:11 }}>{p.id}</span></TD>
                  <TD><span style={{ fontWeight:600 }}>{p.name}</span></TD>
                  <TD color={C.textDim}>{p.category}</TD>
                  <TD mono color={p.qty<=p.minQty?C.red:C.text}><span style={{ fontWeight:700 }}>{fmtNum(p.qty)}</span></TD>
                  <TD mono color={C.textMuted}>{fmtNum(p.minQty)}</TD>
                  <TD mono color={C.textDim}>{fmt(p.cost)}</TD>
                  <TD mono color={C.green}>{fmt(p.price)}</TD>
                  <TD color={C.textMuted}>{p.unit}</TD>
                  <TD mono color={C.yellow}>{fmt(p.qty*p.cost)}</TD>
                  <td style={{ padding:"11px 14px" }}><Badge label={p.qty<=p.minQty?"منخفض":"كافي"} /></td>
                  <td style={{ padding:"11px 14px" }}>
                    <div style={{ display:"flex",gap:6 }}>
                      <button onClick={()=>openEdit(p)} style={{ background:"none",border:"none",cursor:"pointer",color:C.accent }}><Ic d={I.edit} s={14} /></button>
                      <button onClick={()=>handleDelete(p.id,p.name)} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted }}><Ic d={I.trash} s={14} /></button>
                    </div>
                  </td>
                </TRow>
              ))}
            </tbody>
          </table>
          {filtered.length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد أصناف</div>}
        </div>
      </Card>
      {showModal && (
        <Modal title={editItem?"تعديل صنف":"إضافة صنف جديد"} onClose={()=>setShowModal(false)}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <Inp label="اسم الصنف" value={form.name} onChange={v=>setForm({...form,name:v})} required />
              <Sel label="الفئة" value={form.category} onChange={v=>setForm({...form,category:v})} options={categories} />
              <Inp label="الكمية الحالية" type="number" value={form.qty} onChange={v=>setForm({...form,qty:v})} />
              <Inp label="الحد الأدنى" type="number" value={form.minQty} onChange={v=>setForm({...form,minQty:v})} />
              <Inp label="سعر التكلفة" type="number" value={form.cost} onChange={v=>setForm({...form,cost:v})} />
              <Inp label="سعر البيع" type="number" value={form.price} onChange={v=>setForm({...form,price:v})} />
              <Inp label="وحدة القياس" value={form.unit} onChange={v=>setForm({...form,unit:v})} placeholder="قطعة، كيلو، رزمة..." />
            </div>
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setShowModal(false)}>إلغاء</Btn>
              <Btn onClick={handleSave}>{editItem?"حفظ التعديلات":"إضافة الصنف"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── STOCKTAKE PAGE (الجرد الشهري والأسبوعي) ─────────────────────────────────
function StocktakePage({ inventory, categories }) {
  const [period, setPeriod] = useState("monthly");
  const [selectedMonth, setSelectedMonth] = useState(today().slice(0,7));
  const [catFilter, setCatFilter] = useState("");
  const [showShortages, setShowShortages] = useState(false);

  const filtered = inventory.filter(p=>!catFilter||p.category===catFilter);
  const lowItems = filtered.filter(p=>p.qty<=p.minQty);
  const okItems = filtered.filter(p=>p.qty>p.minQty);
  const totalCost = filtered.reduce((s,p)=>s+p.qty*p.cost,0);

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      <PageHeader title="الجرد الدوري" icon={I.stocktake} subtitle="جرد شهري وأسبوعي للمخزون"
        action={
          <div style={{ display:"flex",gap:8 }}>
            <Btn variant="success" onClick={()=>printStocktakeReport(filtered,period,selectedMonth)}>
              <Ic d={I.print} s={14} />طباعة الجرد
            </Btn>
          </div>
        }
      />
      <div style={{ display:"flex",gap:10,alignItems:"center",flexWrap:"wrap" }}>
        <div style={{ display:"flex",background:C.surface2,borderRadius:11,padding:3,border:`1px solid ${C.border}` }}>
          {["monthly","weekly"].map(p=>(
            <button key={p} onClick={()=>setPeriod(p)} style={{ background:period===p?C.accent:"transparent",color:period===p?"#fff":C.textMuted,border:"none",borderRadius:8,padding:"7px 16px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s" }}>
              {p==="monthly"?"شهري":"أسبوعي"}
            </button>
          ))}
        </div>
        <input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)}
          style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 13px",color:C.text,fontSize:12,fontFamily:"inherit",outline:"none" }} />
        <select value={catFilter} onChange={e=>setCatFilter(e.target.value)}
          style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 13px",color:C.text,fontSize:12,fontFamily:"inherit" }}>
          <option value="">كل الفئات</option>
          {categories.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
        <MiniStat label="إجمالي الأصناف" value={fmtNum(filtered.length)} color={C.accent} icon={I.box} />
        <MiniStat label="أصناف كافية" value={fmtNum(okItems.length)} color={C.green} icon={I.stocktake} />
        <MiniStat label="أصناف منخفضة" value={fmtNum(lowItems.length)} color={C.red} icon={I.alert} />
        <MiniStat label="قيمة المخزون" value={fmt(totalCost)} color={C.yellow} icon={I.revenue} />
      </div>
      {lowItems.length > 0 && (
        <Card style={{ background:C.redDim,border:`1px solid ${C.red}33` }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showShortages?14:0 }}>
            <div style={{ display:"flex",alignItems:"center",gap:10 }}>
              <Ic d={I.alert} s={18} c={C.red} />
              <span style={{ fontWeight:700,color:C.red,fontSize:14 }}>النواقص والكميات المطلوبة ({lowItems.length} صنف)</span>
            </div>
            <Btn variant="danger" small onClick={()=>setShowShortages(!showShortages)}>
              {showShortages?"إخفاء":"عرض النواقص"}
            </Btn>
          </div>
          {showShortages && (
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {lowItems.map(p=>(
                <div key={p.id} style={{ background:C.surface,border:`1px solid ${C.red}22`,borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div>
                    <span style={{ fontWeight:600,color:C.text,fontSize:13 }}>{p.name}</span>
                    <span style={{ color:C.textMuted,fontSize:11,marginRight:8 }}>({p.category})</span>
                  </div>
                  <div style={{ display:"flex",gap:16,alignItems:"center" }}>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:10,color:C.textMuted }}>الموجود</div>
                      <div style={{ fontSize:13,fontWeight:700,color:C.red,fontFamily:"monospace" }}>{p.qty} {p.unit}</div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:10,color:C.textMuted }}>الحد الأدنى</div>
                      <div style={{ fontSize:13,fontWeight:700,color:C.textDim,fontFamily:"monospace" }}>{p.minQty} {p.unit}</div>
                    </div>
                    <div style={{ textAlign:"center",background:C.redDim,padding:"4px 12px",borderRadius:8 }}>
                      <div style={{ fontSize:10,color:C.textMuted }}>النقص</div>
                      <div style={{ fontSize:14,fontWeight:800,color:C.red,fontFamily:"monospace" }}>{Math.max(0,p.minQty-p.qty)} {p.unit}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
      <Card style={{ padding:0 }}>
        <div style={{ padding:"14px 18px",borderBottom:`1px solid ${C.border}`,fontSize:14,fontWeight:700,color:C.text }}>
          تفاصيل الجرد — {period==="monthly"?"شهري":"أسبوعي"} — {selectedMonth}
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <THead cols={["الكود","الصنف","الفئة","الكمية الحالية","الحد الأدنى","الوحدة","النقص","سعر التكلفة","قيمة المخزون","الحالة"]} />
            <tbody>
              {filtered.map((p,idx)=>{
                const shortage = Math.max(0, p.minQty - p.qty);
                return (
                  <TRow key={p.id} alt={idx%2}>
                    <TD color={C.accent}><span style={{ fontSize:11 }}>{p.id}</span></TD>
                    <TD><span style={{ fontWeight:600 }}>{p.name}</span></TD>
                    <TD color={C.textDim}>{p.category}</TD>
                    <TD mono color={p.qty<=p.minQty?C.red:C.green}><span style={{ fontWeight:700 }}>{fmtNum(p.qty)}</span></TD>
                    <TD mono color={C.textMuted}>{fmtNum(p.minQty)}</TD>
                    <TD color={C.textMuted}>{p.unit}</TD>
                    <TD mono color={shortage>0?C.red:C.textMuted}><span style={{ fontWeight:shortage>0?700:400 }}>{shortage||"—"}</span></TD>
                    <TD mono color={C.textDim}>{fmt(p.cost)}</TD>
                    <TD mono color={C.yellow}>{fmt(p.qty*p.cost)}</TD>
                    <td style={{ padding:"11px 14px" }}><Badge label={p.qty<=p.minQty?"منخفض":"كافي"} /></td>
                  </TRow>
                );
              })}
            </tbody>
          </table>
          {filtered.length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد أصناف</div>}
        </div>
      </Card>
    </div>
  );
}

// ─── CATEGORIES PAGE ──────────────────────────────────────────────────────────
function CategoriesPage({ categories, onAdd }) {
  const [newCat, setNewCat] = useState("");
  const handleAdd = () => {
    if (!newCat.trim()) return;
    onAdd(newCat.trim());
    setNewCat("");
  };
  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      <PageHeader title="الفئات" icon={I.categories} subtitle={`${categories.length} فئة مسجلة`} />
      <Card>
        <div style={{ display:"flex",gap:10,marginBottom:22 }}>
          <input value={newCat} onChange={e=>setNewCat(e.target.value)} placeholder="اسم الفئة الجديدة..."
            onKeyDown={e=>e.key==="Enter"&&handleAdd()}
            style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 13px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none",flex:1 }}
            onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border} />
          <Btn onClick={handleAdd}><Ic d={I.plus} s={14} />إضافة</Btn>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10 }}>
          {categories.map((cat,i)=>(
            <div key={i} style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,padding:"13px 16px",fontSize:13,fontWeight:600,color:C.text,display:"flex",alignItems:"center",gap:8 }}>
              <div style={{ width:8,height:8,borderRadius:"50%",background:C.accent,flexShrink:0 }} />
              {cat}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("dash");
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isActive, setIsActive] = useState(true);

  const checkSubscription = async (uid) => {
    if (!uid) return;
    try {
      const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", uid).single();
      setIsActive(profile ? profile.is_active !== false : true);
    } catch { setIsActive(true); }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      const email = session?.user?.email ?? null;
      setUserId(uid); setUserEmail(email);
      if (uid) checkSubscription(uid);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      const email = session?.user?.email ?? null;
      setUserId(uid); setUserEmail(email);
      if (uid) checkSubscription(uid);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(()=>{ document.title = 'حسابي Pro'; }, []);

  const { data, loading, actions } = useAppData(userId);

  if (authLoading) {
    return (
      <div style={{ minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",color:C.text,fontFamily:"'Cairo','Segoe UI',sans-serif",flexDirection:"column",gap:16 }}>
        <Logo size={52} />
        <div style={{ fontSize:14,color:C.textMuted }}>جاري التحميل...</div>
      </div>
    );
  }

  if (!userId) return <LoginScreen />;
  if (userEmail === ADMIN_EMAIL) return <AdminPanel />;
  if (!isActive) return <SubscriptionExpired />;

  const navGroups = [
    {
      label: "الرئيسية",
      items: [
        { id:"dash", label:"الرئيسية", icon:I.dash },
      ]
    },
    {
      label: "المالية",
      items: [
        { id:"sales", label:"المبيعات", icon:I.sales },
        { id:"purchases", label:"المشتريات", icon:I.purchase },
        { id:"returns", label:"المرتجعات", icon:I.returns },
        { id:"revenue", label:"الإيرادات", icon:I.revenue },
        { id:"taxinvoices", label:"الفواتير الضريبية", icon:I.tax },
      ]
    },
    {
      label: "الأطراف",
      items: [
        { id:"clients", label:"العملاء", icon:I.clients },
        { id:"suppliers", label:"الموردين", icon:I.suppliers },
      ]
    },
    {
      label: "التقارير",
      items: [
        { id:"reports", label:"التقارير المالية", icon:I.report },
        { id:"monthlyreports", label:"التقارير الشهرية", icon:I.calendar },
      ]
    },
    {
      label: "المخزون",
      items: [
        { id:"inventory", label:"إدارة المخزون", icon:I.inventory },
        { id:"stocktake", label:"الجرد الدوري", icon:I.stocktake },
        { id:"inventoryitems", label:"الأصناف", icon:I.box },
        { id:"categories", label:"الفئات", icon:I.categories },
      ]
    },
  ];

  const renderPage = () => {
    switch (page) {
      case "dash": return <Dashboard data={data} />;
      case "sales": return <InvoicesPage title="فواتير المبيعات" invoices={data.salesInvoices} type="sales" clients={data.clients} suppliers={data.suppliers} categories={data.categories} onAdd={actions.addSale} onDelete={actions.deleteSale} userEmail={userEmail} />;
      case "purchases": return <InvoicesPage title="فواتير المشتريات" invoices={data.purchaseInvoices} type="purchases" clients={data.clients} suppliers={data.suppliers} categories={data.categories} onAdd={actions.addPurchase} onDelete={actions.deletePurchase} userEmail={userEmail} />;
      case "clients": return <AccountStatement parties={data.clients} invoices={data.salesInvoices} type="client" onAddParty={actions.addClient} onDeleteParty={actions.deleteClient} />;
      case "suppliers": return <AccountStatement parties={data.suppliers} invoices={data.purchaseInvoices} type="supplier" onAddParty={actions.addSupplier} onDeleteParty={actions.deleteSupplier} />;
      case "returns": return <ReturnsPage returns={data.returns} salesInvoices={data.salesInvoices} purchaseInvoices={data.purchaseInvoices} clients={data.clients} suppliers={data.suppliers} onAdd={actions.addReturn} onDelete={actions.deleteReturn} />;
      case "revenue": return <RevenuePage data={data} onDeleteMonth={actions.deleteMonth} userEmail={userEmail} />;
      case "reports": return <ReportsPage data={data} userEmail={userEmail} />;
      case "monthlyreports": return <MonthlyReportsPage data={data} />;
      case "taxinvoices": return <TaxInvoicesPage salesInvoices={data.salesInvoices} purchaseInvoices={data.purchaseInvoices} />;
      case "inventory": return <InventoryPage inventory={data.inventory} categories={data.categories} onAdd={actions.addInventoryItem} onEdit={actions.updateInventoryItem} onDelete={actions.deleteInventoryItem} onBulkAdd={actions.bulkAddInventory} userEmail={userEmail} />;
      case "stocktake": return <StocktakePage inventory={data.inventory} categories={data.categories} />;
      case "inventoryitems": return <InventoryItemsPage inventory={data.inventory} categories={data.categories} />;
      case "categories": return <CategoriesPage categories={data.categories} onAdd={actions.addCategory} />;
      default: return <Dashboard data={data} />;
    }
  };

  const allNavItems = navGroups.flatMap(g=>g.items);

  return (
    <div style={{ minHeight:"100vh",background:C.bg,fontFamily:"'Cairo','Segoe UI',sans-serif",display:"flex",direction:"rtl" }}>
      {/* Sidebar */}
      <div style={{ width:220,background:C.surface,borderLeft:`1px solid ${C.border}`,display:"flex",flexDirection:"column",position:"fixed",top:0,right:0,height:"100vh",zIndex:100 }}>
        {/* Logo */}
        <div style={{ padding:"18px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12 }}>
          <Logo size={34} />
          <div>
            <div style={{ fontSize:15,fontWeight:800,color:C.text,letterSpacing:-0.3 }}>حسابي Pro</div>
            <div style={{ fontSize:10,color:C.textMuted,marginTop:1 }}>نظام محاسبة متكامل</div>
          </div>
        </div>
        {/* Nav */}
        <nav style={{ flex:1,overflowY:"auto",padding:"12px 8px" }}>
          {navGroups.map(group=>(
            <div key={group.label} style={{ marginBottom:16 }}>
              <div style={{ padding:"0 10px",fontSize:9,fontWeight:800,color:C.textMuted,letterSpacing:1.2,textTransform:"uppercase",marginBottom:6 }}>{group.label}</div>
              {group.items.map(item=>(
                <button key={item.id} onClick={()=>setPage(item.id)} style={{
                  width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:11,border:"none",cursor:"pointer",
                  fontFamily:"inherit",fontSize:13,fontWeight:600,textAlign:"right",marginBottom:2,transition:"all 0.15s",
                  background:page===item.id?C.accentDim:"transparent",
                  color:page===item.id?C.accent:C.textMuted,
                  borderRight:page===item.id?`3px solid ${C.accent}`:"3px solid transparent",
                }}>
                  <Ic d={item.icon} s={15} c={page===item.id?C.accent:C.textMuted} />
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        {/* Footer */}
        <div style={{ padding:"12px 8px",borderTop:`1px solid ${C.border}` }}>
          {loading && <div style={{ fontSize:11,color:C.textMuted,textAlign:"center",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
            <div style={{ width:6,height:6,borderRadius:"50%",background:C.accent,animation:"pulse 1s infinite" }} />
            جاري المزامنة...
          </div>}
          <div style={{ padding:"8px 12px",marginBottom:6,borderRadius:10,background:C.surface2,display:"flex",alignItems:"center",gap:8 }}>
            <div style={{ width:28,height:28,borderRadius:"50%",background:C.accentDim,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
              <span style={{ fontSize:12,fontWeight:700,color:C.accent }}>{userEmail?.[0]?.toUpperCase()}</span>
            </div>
            <div style={{ overflow:"hidden" }}>
              <div style={{ fontSize:11,color:C.text,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{userEmail}</div>
            </div>
          </div>
          <button onClick={()=>supabase.auth.signOut()} style={{
            width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:10,border:`1px solid ${C.red}33`,cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:600,
            background:C.redDim,color:C.red,transition:"all 0.2s",
          }}>
            <Ic d={I.logout} s={14} c={C.red} />تسجيل الخروج
          </button>
        </div>
      </div>
      {/* Main Content */}
      <div style={{ flex:1,marginRight:220,padding:"28px 30px",minHeight:"100vh",overflowY:"auto" }}>
        {renderPage()}
      </div>
    </div>
  );
}
