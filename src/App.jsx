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
      const record = { ...invoice, type: "sale", createdAt: new Date().toISOString() };
      for (const item of (invoice.items || [])) if (item.category) await ensureCategory(item.category);
      await saveData("sales", record);
      setData(prev => ({ ...prev, salesInvoices: [...prev.salesInvoices, record] }));
    },
    deleteSale: async (id) => {
      await deleteRecord(id);
      setData(prev => ({ ...prev, salesInvoices: prev.salesInvoices.filter(i => i.id !== id) }));
    },
    addPurchase: async (invoice) => {
      const record = { ...invoice, type: "purchase", createdAt: new Date().toISOString() };
      for (const item of (invoice.items || [])) if (item.category) await ensureCategory(item.category);
      await saveData("purchases", record);
      setData(prev => ({ ...prev, purchaseInvoices: [...prev.purchaseInvoices, record] }));
    },
    deletePurchase: async (id) => {
      await deleteRecord(id);
      setData(prev => ({ ...prev, purchaseInvoices: prev.purchaseInvoices.filter(i => i.id !== id) }));
    },
    addReturn: async (ret) => {
      const record = { ...ret, type: "return", createdAt: new Date().toISOString() };
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
  factory: "M2 20V8l6-4 6 4V4l6 4v12H2zM10 20v-5h4v5",
  money: "M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6",
  people: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (n) => (n ?? 0).toLocaleString("ar-EG") + " ج.م";
const fmtDateTime = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const date = d.toLocaleDateString("ar-EG", { year:"numeric", month:"2-digit", day:"2-digit" });
  const time = d.toLocaleTimeString("ar-EG", { hour:"2-digit", minute:"2-digit" });
  return `${date} — ${time}`;
};
const nowISO = () => new Date().toISOString();
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
// Sub-user login: stored in Supabase table "sub_users" with owner_id, username, password_hash, role, allowed_pages
// We do client-side lookup since we can't use admin SDK on frontend
function LoginScreen({ onSubUserLogin }) {
  const [mode, setMode] = useState("company"); // "company" | "employee"
  const [form, setForm] = useState({ email:"", password:"" });
  const [empForm, setEmpForm] = useState({ username:"", password:"" });
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

  const handleEmployeeLogin = async () => {
    if (!empForm.username || !empForm.password) { setErr("أدخل اسم المستخدم وكلمة المرور"); return; }
    setErr(""); setLoading(true);
    try {
      // Look up sub_user by username (case-insensitive)
      const { data: subUsers, error } = await supabase
        .from("sub_users")
        .select("*")
        .ilike("username", empForm.username.trim());
      if (error) { setErr("حدث خطأ في الاتصال"); setLoading(false); return; }
      if (!subUsers || subUsers.length === 0) { setErr("اسم المستخدم غير موجود"); setLoading(false); return; }
      const su = subUsers[0];
      if (su.password_plain !== empForm.password) { setErr("كلمة المرور غير صحيحة"); setLoading(false); return; }
      if (!su.is_active) { setErr("هذا الحساب معطّل، تواصل مع المسؤول"); setLoading(false); return; }
      // Now sign in as the owner to get data access
      onSubUserLogin(su);
    } catch(e){ setErr(e.message); }
    setLoading(false);
  };

  const inputStyle = { background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 14px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box",transition:"border-color 0.2s" };

  return (
    <div style={{ minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Cairo','Segoe UI',sans-serif",direction:"rtl",position:"relative",overflow:"hidden" }}>
      {/* Ambient glows */}
      <div style={{ position:"absolute",top:-120,right:-80,width:500,height:500,borderRadius:"50%",background:`radial-gradient(circle, ${C.accentGlow} 0%, transparent 65%)`,pointerEvents:"none" }} />
      <div style={{ position:"absolute",bottom:-80,left:-80,width:350,height:350,borderRadius:"50%",background:`radial-gradient(circle, rgba(52,211,153,0.12) 0%, transparent 70%)`,pointerEvents:"none" }} />
      <div style={{ position:"absolute",top:"40%",left:"20%",width:200,height:200,borderRadius:"50%",background:`radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 70%)`,pointerEvents:"none" }} />

      <div style={{ background:C.surface,border:`1px solid ${C.borderLight}`,borderRadius:28,padding:"44px 48px",width:"min(440px,92vw)",display:"flex",flexDirection:"column",gap:0,position:"relative",zIndex:1,boxShadow:`0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(108,127,255,0.05)` }}>
        {/* Logo */}
        <div style={{ textAlign:"center",marginBottom:28 }}>
          <div style={{ display:"flex",justifyContent:"center",marginBottom:16 }}><Logo size={60} /></div>
          <div style={{ fontSize:28,fontWeight:800,color:C.text,letterSpacing:-0.8 }}>حسابي Pro</div>
          <div style={{ fontSize:12,color:C.textMuted,marginTop:6,lineHeight:1.6 }}>نظام محاسبة متكامل للشركات والمصانع</div>
        </div>

        {/* Mode Toggle */}
        <div style={{ display:"flex",background:C.surface2,borderRadius:14,padding:4,marginBottom:24,border:`1px solid ${C.border}` }}>
          {[{id:"company",label:"🏢 حساب الشركة"},{id:"employee",label:"👤 دخول موظف"}].map(m=>(
            <button key={m.id} onClick={()=>{ setMode(m.id); setErr(""); }} style={{
              flex:1,padding:"9px 12px",borderRadius:11,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit",transition:"all 0.2s",
              background:mode===m.id?C.accent:"transparent",
              color:mode===m.id?"#fff":C.textMuted,
              boxShadow:mode===m.id?`0 4px 15px ${C.accent}40`:"none",
            }}>{m.label}</button>
          ))}
        </div>

        {err && <div style={{ background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:10,padding:"11px 16px",fontSize:12,color:C.red,textAlign:"center",marginBottom:16 }}>{err}</div>}

        {mode === "company" ? (
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
              <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>البريد الإلكتروني</label>
              <input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} type="email" placeholder="example@company.com"
                style={inputStyle} onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border} />
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
              <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>كلمة المرور</label>
              <input type="password" placeholder="••••••••" value={form.password}
                onChange={e=>setForm({...form,password:e.target.value})}
                onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                style={{...inputStyle,direction:"ltr",textAlign:"right"}}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border} />
            </div>
            <button onClick={handleLogin} disabled={loading} style={{ background:loading?C.surface2:C.accent,color:loading?C.textMuted:"#fff",border:"none",borderRadius:12,padding:"13px",fontSize:14,fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",boxShadow:loading?"none":`0 8px 25px ${C.accent}40`,transition:"all 0.2s",marginTop:4 }}>
              {loading ? "جاري تسجيل الدخول..." : "دخول"}
            </button>
          </div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ background:C.accentDim,border:`1px solid ${C.accent}22`,borderRadius:12,padding:"12px 16px",fontSize:12,color:C.accent,lineHeight:1.7 }}>
              💡 أدخل اليوزرنيم والباسورد الخاص بيك كموظف، اللي أعطاهولك مدير الشركة
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
              <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>اسم المستخدم (Username)</label>
              <input value={empForm.username} onChange={e=>setEmpForm({...empForm,username:e.target.value})} placeholder="ahmed_sales"
                style={{...inputStyle,direction:"ltr",textAlign:"right"}}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border} />
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
              <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>كلمة المرور</label>
              <input type="password" placeholder="••••••••" value={empForm.password}
                onChange={e=>setEmpForm({...empForm,password:e.target.value})}
                onKeyDown={e=>e.key==="Enter"&&handleEmployeeLogin()}
                style={{...inputStyle,direction:"ltr",textAlign:"right"}}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border} />
            </div>
            <button onClick={handleEmployeeLogin} disabled={loading} style={{ background:loading?C.surface2:C.green,color:loading?C.textMuted:"#fff",border:"none",borderRadius:12,padding:"13px",fontSize:14,fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",boxShadow:loading?"none":`0 8px 25px rgba(52,211,153,0.4)`,transition:"all 0.2s",marginTop:4 }}>
              {loading ? "جاري التحقق..." : "دخول كموظف"}
            </button>
          </div>
        )}

        <div style={{ textAlign:"center",fontSize:11,color:C.textMuted,borderTop:`1px solid ${C.border}`,paddingTop:16,marginTop:24 }}>للحصول على حساب، تواصل مع الإدارة</div>
      </div>
    </div>
  );
}

// ─── ALL PAGES LIST (for permissions) ─────────────────────────────────────────
const ALL_PAGES = [
  { id:"dash", label:"الرئيسية" },
  { id:"sales", label:"المبيعات" },
  { id:"purchases", label:"المشتريات" },
  { id:"returns", label:"المرتجعات" },
  { id:"revenue", label:"الإيرادات" },
  { id:"expenses", label:"المصروفات" },
  { id:"taxinvoices", label:"الفواتير الضريبية" },
  { id:"clients", label:"العملاء" },
  { id:"suppliers", label:"الموردين" },
  { id:"reports", label:"التقارير المالية" },
  { id:"taxreports", label:"التقارير الضريبية" },
  { id:"production", label:"تكلفة الإنتاج" },
  { id:"employees", label:"الموظفين" },
  { id:"inventory", label:"إدارة المخزون" },
  { id:"stocktake", label:"الجرد الشهري" },
  { id:"inventoryitems", label:"الأصناف" },
  { id:"categories", label:"الفئات" },
];

const ROLE_PRESETS = {
  "مشاهدة فقط": { canAdd:false, canDelete:false, canEdit:false },
  "إضافة فقط":  { canAdd:true,  canDelete:false, canEdit:false },
  "إضافة وتعديل": { canAdd:true,  canDelete:false, canEdit:true },
  "صلاحيات كاملة": { canAdd:true,  canDelete:true,  canEdit:true },
};

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
function AdminPanel() {
  const [activeTab, setActiveTab] = useState("clients"); // clients | subusers
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ email:"", password:"", company:"" });
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState({ text:"", type:"" });
  const [toggling, setToggling] = useState(null);

  // Sub-users state
  const [subUsers, setSubUsers] = useState([]);
  const [subLoading, setSubLoading] = useState(false);
  const [showSubAdd, setShowSubAdd] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState(""); // owner profile id
  const [subForm, setSubForm] = useState({ username:"", password:"", display_name:"", role:"مشاهدة فقط", allowed_pages: ALL_PAGES.map(p=>p.id) });
  const [addingSub, setAddingSub] = useState(false);
  const [togglingSubId, setTogglingSubId] = useState(null);

  const showMsg = (text, type="success") => { setMsg({ text, type }); setTimeout(()=>setMsg({text:"",type:""}),4000); };

  // ── Load company clients ──
  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (!error) setUsers(data || []);
    setLoading(false);
  };

  // ── Load sub-users ──
  const loadSubUsers = async () => {
    setSubLoading(true);
    const { data, error } = await supabase.from("sub_users").select("*").order("created_at", { ascending: false });
    if (!error) setSubUsers(data || []);
    setSubLoading(false);
  };

  useEffect(() => { loadUsers(); loadSubUsers(); }, []);

  // ── Toggle client subscription ──
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

  // ── Add new company client via Supabase signup trick ──
  const addUser = async () => {
    if (!newUser.email || !newUser.password) { showMsg("أدخل الإيميل وكلمة المرور", "error"); return; }
    if (newUser.password.length < 6) { showMsg("كلمة المرور 6 أحرف على الأقل", "error"); return; }
    setAdding(true);
    try {
      // Use signUp — this works with publishable key
      const { data, error } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: { data: { company_name: newUser.company || "" } }
      });
      if (error) { showMsg(error.message, "error"); setAdding(false); return; }
      // Update profile if created
      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          email: newUser.email,
          company_name: newUser.company || "",
          is_active: true,
        }, { onConflict: "id" });
      }
      showMsg(`✓ تم إضافة ${newUser.email} بنجاح — يحتاج تأكيد إيميل`);
      setNewUser({ email:"", password:"", company:"" }); setShowAdd(false);
      setTimeout(loadUsers, 1500);
    } catch(e) { showMsg(e.message, "error"); }
    setAdding(false);
  };

  // ── Add sub-user (employee) ──
  const addSubUser = async () => {
    if (!subForm.username.trim() || !subForm.password) { showMsg("أدخل اسم المستخدم وكلمة المرور", "error"); return; }
    if (!selectedOwner) { showMsg("اختر حساب الشركة", "error"); return; }
    // Check username unique
    const exists = subUsers.some(su => su.username.toLowerCase() === subForm.username.trim().toLowerCase());
    if (exists) { showMsg("اسم المستخدم موجود بالفعل", "error"); return; }
    setAddingSub(true);
    const perms = ROLE_PRESETS[subForm.role] || ROLE_PRESETS["مشاهدة فقط"];
    const { error } = await supabase.from("sub_users").insert({
      owner_id: selectedOwner,
      username: subForm.username.trim().toLowerCase(),
      password_plain: subForm.password,
      display_name: subForm.display_name || subForm.username,
      role: subForm.role,
      allowed_pages: subForm.allowed_pages,
      can_add: perms.canAdd,
      can_delete: perms.canDelete,
      can_edit: perms.canEdit,
      is_active: true,
    });
    if (error) { showMsg("خطأ: " + error.message, "error"); }
    else {
      showMsg(`✓ تم إضافة الموظف "${subForm.username}" بنجاح`);
      setSubForm({ username:"", password:"", display_name:"", role:"مشاهدة فقط", allowed_pages: ALL_PAGES.map(p=>p.id) });
      setShowSubAdd(false);
      loadSubUsers();
    }
    setAddingSub(false);
  };

  const toggleSubUser = async (su) => {
    setTogglingSubId(su.id);
    const newStatus = !su.is_active;
    const { error } = await supabase.from("sub_users").update({ is_active: newStatus }).eq("id", su.id);
    if (!error) {
      setSubUsers(prev => prev.map(s => s.id === su.id ? { ...s, is_active: newStatus } : s));
      showMsg(newStatus ? `✓ تم تفعيل ${su.username}` : `✓ تم تعطيل ${su.username}`, newStatus ? "success" : "warning");
    } else showMsg("حدث خطأ", "error");
    setTogglingSubId(null);
  };

  const deleteSubUser = async (id) => {
    const { error } = await supabase.from("sub_users").delete().eq("id", id);
    if (!error) { setSubUsers(prev => prev.filter(s => s.id !== id)); showMsg("✓ تم الحذف"); }
    else showMsg("خطأ في الحذف", "error");
  };

  const clientUsers = users.filter(u => u.email !== ADMIN_EMAIL);
  const activeCount = clientUsers.filter(u => u.is_active).length;

  const tabStyle = (id) => ({
    padding:"10px 24px",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit",transition:"all 0.2s",
    background: activeTab===id ? C.accent : "transparent",
    color: activeTab===id ? "#fff" : C.textMuted,
    boxShadow: activeTab===id ? `0 4px 15px ${C.accent}40` : "none",
  });

  return (
    <div style={{ minHeight:"100vh",background:C.bg,fontFamily:"'Cairo','Segoe UI',sans-serif",direction:"rtl",padding:"24px 28px" }}>
      {/* Header */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
        <div style={{ display:"flex",alignItems:"center",gap:14 }}>
          <Logo size={42} />
          <div>
            <div style={{ fontSize:22,fontWeight:800,color:C.text }}>لوحة إدارة حسابي Pro</div>
            <div style={{ fontSize:12,color:C.textMuted,marginTop:2 }}>إدارة شاملة للعملاء والموظفين والصلاحيات</div>
          </div>
        </div>
        <div style={{ display:"flex",gap:10,alignItems:"center" }}>
          {msg.text && (
            <div style={{ background:msg.type==="success"?C.greenDim:msg.type==="warning"?C.yellowDim:C.redDim,border:`1px solid ${msg.type==="success"?C.green:msg.type==="warning"?C.yellow:C.red}33`,color:msg.type==="success"?C.green:msg.type==="warning"?C.yellow:C.red,borderRadius:10,padding:"8px 18px",fontSize:12,fontWeight:700,maxWidth:320 }}>
              {msg.text}
            </div>
          )}
          <Btn variant="danger" onClick={()=>supabase.auth.signOut()}><Ic d={I.logout} s={14} />خروج</Btn>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24 }}>
        {[
          {label:"إجمالي الشركات",value:clientUsers.length,color:C.accent,icon:I.clients},
          {label:"اشتراكات فعالة",value:activeCount,color:C.green,icon:I.shield},
          {label:"اشتراكات معطلة",value:clientUsers.length-activeCount,color:C.red,icon:I.alert},
          {label:"إجمالي الموظفين",value:subUsers.length,color:C.purple,icon:I.people},
        ].map(s=>(
          <div key={s.label} style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:"18px 22px",borderTop:`3px solid ${s.color}`,display:"flex",alignItems:"center",gap:14 }}>
            <div style={{ background:s.color+"18",padding:10,borderRadius:12 }}><Ic d={s.icon} s={20} c={s.color} /></div>
            <div>
              <div style={{ fontSize:11,color:C.textMuted,fontWeight:600,marginBottom:4 }}>{s.label}</div>
              <div style={{ fontSize:26,fontWeight:800,color:s.color }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex",gap:6,marginBottom:20,background:C.surface2,padding:4,borderRadius:14,border:`1px solid ${C.border}`,width:"fit-content" }}>
        <button style={tabStyle("clients")} onClick={()=>setActiveTab("clients")}>🏢 إدارة الشركات العملاء</button>
        <button style={tabStyle("subusers")} onClick={()=>setActiveTab("subusers")}>👥 إدارة موظفي الشركات</button>
      </div>

      {/* ── Clients Tab ── */}
      {activeTab === "clients" && (
        <div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ fontSize:16,fontWeight:700,color:C.text }}>قائمة الشركات العملاء</div>
            <Btn onClick={()=>setShowAdd(true)}><Ic d={I.userPlus} s={14} />إضافة شركة جديدة</Btn>
          </div>
          <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden" }}>
            {loading ? <div style={{ padding:40,textAlign:"center",color:C.textMuted }}>جاري التحميل...</div> : (
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <THead cols={["البريد الإلكتروني","اسم الشركة","تاريخ الإنشاء","الموظفون","الحالة","التحكم"]} />
                <tbody>
                  {clientUsers.map((u,i)=>{
                    const empCount = subUsers.filter(su=>su.owner_id===u.id).length;
                    return (
                      <TRow key={u.id} alt={i%2}>
                        <TD><span style={{ fontWeight:600 }}>{u.email}</span></TD>
                        <TD color={C.textDim}>{u.company_name||"—"}</TD>
                        <TD color={C.textMuted}>{new Date(u.created_at).toLocaleDateString("ar-EG")}</TD>
                        <TD><span style={{ background:C.purpleDim,color:C.purple,padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700 }}>{empCount} موظف</span></TD>
                        <td style={{ padding:"11px 14px" }}><Badge label={u.is_active?"مدفوعة":"غير مدفوعة"} /></td>
                        <td style={{ padding:"11px 14px",display:"flex",gap:8,alignItems:"center" }}>
                          <button onClick={()=>toggleUser(u)} disabled={toggling===u.id}
                            style={{ background:u.is_active?C.redDim:C.greenDim,color:u.is_active?C.red:C.green,border:`1px solid ${u.is_active?C.red:C.green}33`,borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>
                            {toggling===u.id?"...":(u.is_active?"إيقاف":"تفعيل")}
                          </button>
                        </td>
                      </TRow>
                    );
                  })}
                </tbody>
              </table>
            )}
            {!loading && clientUsers.length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted }}>لا يوجد عملاء بعد</div>}
          </div>
        </div>
      )}

      {/* ── Sub-Users Tab ── */}
      {activeTab === "subusers" && (
        <div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ fontSize:16,fontWeight:700,color:C.text }}>موظفو الشركات (Sub-Users)</div>
            <Btn onClick={()=>setShowSubAdd(true)}><Ic d={I.userPlus} s={14} />إضافة موظف</Btn>
          </div>
          <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden" }}>
            {subLoading ? <div style={{ padding:40,textAlign:"center",color:C.textMuted }}>جاري التحميل...</div> : (
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <THead cols={["اسم المستخدم","الاسم","الشركة","الدور","الصلاحيات","الصفحات","الحالة","التحكم"]} />
                <tbody>
                  {subUsers.map((su,i)=>{
                    const ownerProfile = users.find(u=>u.id===su.owner_id);
                    const pagesCount = (su.allowed_pages||[]).length;
                    return (
                      <TRow key={su.id} alt={i%2}>
                        <TD><span style={{ fontFamily:"monospace",fontWeight:700,color:C.accent }}>{su.username}</span></TD>
                        <TD>{su.display_name||"—"}</TD>
                        <TD color={C.textDim}>{ownerProfile?.company_name||ownerProfile?.email||"—"}</TD>
                        <TD><span style={{ background:C.purpleDim,color:C.purple,padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700 }}>{su.role}</span></TD>
                        <td style={{ padding:"11px 14px" }}>
                          <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>
                            {su.can_add && <span style={{ background:C.greenDim,color:C.green,fontSize:10,padding:"2px 7px",borderRadius:20,fontWeight:700 }}>إضافة</span>}
                            {su.can_edit && <span style={{ background:C.blueDim,color:C.blue,fontSize:10,padding:"2px 7px",borderRadius:20,fontWeight:700 }}>تعديل</span>}
                            {su.can_delete && <span style={{ background:C.redDim,color:C.red,fontSize:10,padding:"2px 7px",borderRadius:20,fontWeight:700 }}>حذف</span>}
                            {!su.can_add&&!su.can_edit&&!su.can_delete && <span style={{ background:C.surface2,color:C.textMuted,fontSize:10,padding:"2px 7px",borderRadius:20,fontWeight:700 }}>مشاهدة فقط</span>}
                          </div>
                        </td>
                        <TD color={C.textMuted}><span style={{ fontSize:11 }}>{pagesCount} صفحة</span></TD>
                        <td style={{ padding:"11px 14px" }}><Badge label={su.is_active?"مدفوعة":"غير مدفوعة"} /></td>
                        <td style={{ padding:"11px 14px" }}>
                          <div style={{ display:"flex",gap:6 }}>
                            <button onClick={()=>toggleSubUser(su)} disabled={togglingSubId===su.id}
                              style={{ background:su.is_active?C.yellowDim:C.greenDim,color:su.is_active?C.yellow:C.green,border:`1px solid ${su.is_active?C.yellow:C.green}33`,borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>
                              {togglingSubId===su.id?"...":(su.is_active?"تعطيل":"تفعيل")}
                            </button>
                            <button onClick={()=>deleteSubUser(su.id)} style={{ background:C.redDim,color:C.red,border:`1px solid ${C.red}33`,borderRadius:8,padding:"5px 10px",fontSize:11,cursor:"pointer" }}>
                              <Ic d={I.trash} s={13} />
                            </button>
                          </div>
                        </td>
                      </TRow>
                    );
                  })}
                </tbody>
              </table>
            )}
            {!subLoading && subUsers.length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted }}>لا يوجد موظفون مضافون بعد</div>}
          </div>
        </div>
      )}

      {/* ── Add Company Modal ── */}
      {showAdd && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }}>
          <div style={{ background:C.surface,border:`1px solid ${C.borderLight}`,borderRadius:22,padding:32,width:"min(460px,92vw)",display:"flex",flexDirection:"column",gap:16 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
              <h2 style={{ margin:0,fontSize:17,fontWeight:700,color:C.text }}>🏢 إضافة شركة عميل جديدة</h2>
              <button onClick={()=>setShowAdd(false)} style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,cursor:"pointer",color:C.textMuted,padding:6,display:"flex" }}><Ic d={I.close} s={16} /></button>
            </div>
            <Inp label="البريد الإلكتروني *" value={newUser.email} onChange={v=>setNewUser({...newUser,email:v})} type="email" placeholder="company@example.com" />
            <Inp label="كلمة المرور * (6 أحرف على الأقل)" value={newUser.password} onChange={v=>setNewUser({...newUser,password:v})} placeholder="اكتبها واحفظها جيداً" />
            <Inp label="اسم الشركة" value={newUser.company} onChange={v=>setNewUser({...newUser,company:v})} placeholder="شركة النور للتجارة" />
            <div style={{ background:C.yellowDim,border:`1px solid ${C.yellow}33`,borderRadius:10,padding:"11px 14px",fontSize:12,color:C.yellow,lineHeight:1.7 }}>
              ⚠️ سيتم إرسال إيميل تأكيد للعميل — احفظ كلمة المرور لأنك لن تراها مرة أخرى
            </div>
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end",marginTop:4 }}>
              <Btn variant="ghost" onClick={()=>setShowAdd(false)}>إلغاء</Btn>
              <Btn onClick={addUser}>{adding?"جاري الإضافة...":"إضافة الشركة"}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Sub-User Modal ── */}
      {showSubAdd && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16 }}>
          <div style={{ background:C.surface,border:`1px solid ${C.borderLight}`,borderRadius:22,padding:32,width:"min(640px,95vw)",maxHeight:"90vh",overflowY:"auto",display:"flex",flexDirection:"column",gap:18 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <h2 style={{ margin:0,fontSize:17,fontWeight:700,color:C.text }}>👤 إضافة موظف جديد</h2>
              <button onClick={()=>setShowSubAdd(false)} style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,cursor:"pointer",color:C.textMuted,padding:6,display:"flex" }}><Ic d={I.close} s={16} /></button>
            </div>

            {/* Owner select */}
            <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
              <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>الشركة التابع لها الموظف *</label>
              <select value={selectedOwner} onChange={e=>setSelectedOwner(e.target.value)}
                style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none" }}>
                <option value="">-- اختر الشركة --</option>
                {clientUsers.map(u=><option key={u.id} value={u.id}>{u.company_name||u.email}</option>)}
              </select>
            </div>

            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <Inp label="اسم المستخدم (Username) *" value={subForm.username} onChange={v=>setSubForm({...subForm,username:v.replace(/\s/g,"_")})} placeholder="ahmed_sales" />
              <Inp label="الاسم الظاهر" value={subForm.display_name} onChange={v=>setSubForm({...subForm,display_name:v})} placeholder="أحمد محمود" />
              <Inp label="كلمة المرور *" value={subForm.password} onChange={v=>setSubForm({...subForm,password:v})} placeholder="123456" />
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>الدور</label>
                <select value={subForm.role} onChange={e=>{
                  const role = e.target.value;
                  const perms = ROLE_PRESETS[role];
                  setSubForm(prev=>({...prev, role, can_add:perms.canAdd, can_delete:perms.canDelete, can_edit:perms.canEdit}));
                }} style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none" }}>
                  {Object.keys(ROLE_PRESETS).map(r=><option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            {/* Role permissions preview */}
            <div style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 18px" }}>
              <div style={{ fontSize:12,fontWeight:700,color:C.textDim,marginBottom:10 }}>الصلاحيات المحددة للدور:</div>
              <div style={{ display:"flex",gap:10 }}>
                {[
                  {label:"إضافة",active:ROLE_PRESETS[subForm.role]?.canAdd,color:C.green},
                  {label:"تعديل",active:ROLE_PRESETS[subForm.role]?.canEdit,color:C.blue},
                  {label:"حذف",active:ROLE_PRESETS[subForm.role]?.canDelete,color:C.red},
                ].map(p=>(
                  <div key={p.label} style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:20,background:p.active?p.color+"18":C.surface3,border:`1px solid ${p.active?p.color+"44":C.border}` }}>
                    <div style={{ width:6,height:6,borderRadius:"50%",background:p.active?p.color:C.textMuted }} />
                    <span style={{ fontSize:12,fontWeight:700,color:p.active?p.color:C.textMuted }}>{p.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Allowed pages */}
            <div>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>الصفحات المسموح بها ({subForm.allowed_pages.length} من {ALL_PAGES.length})</label>
                <div style={{ display:"flex",gap:8 }}>
                  <button onClick={()=>setSubForm(p=>({...p,allowed_pages:ALL_PAGES.map(x=>x.id)}))} style={{ background:C.greenDim,color:C.green,border:`1px solid ${C.green}33`,borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>تحديد الكل</button>
                  <button onClick={()=>setSubForm(p=>({...p,allowed_pages:[]}))} style={{ background:C.redDim,color:C.red,border:`1px solid ${C.red}33`,borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>إلغاء الكل</button>
                </div>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8 }}>
                {ALL_PAGES.map(pg=>{
                  const checked = subForm.allowed_pages.includes(pg.id);
                  return (
                    <label key={pg.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:10,background:checked?C.accentDim:C.surface2,border:`1px solid ${checked?C.accent+"44":C.border}`,cursor:"pointer",transition:"all 0.15s" }}>
                      <input type="checkbox" checked={checked} onChange={e=>setSubForm(prev=>({
                        ...prev,
                        allowed_pages: e.target.checked ? [...prev.allowed_pages,pg.id] : prev.allowed_pages.filter(x=>x!==pg.id)
                      }))} style={{ accentColor:C.accent,width:14,height:14 }} />
                      <span style={{ fontSize:12,fontWeight:600,color:checked?C.accent:C.textMuted }}>{pg.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ background:C.yellowDim,border:`1px solid ${C.yellow}33`,borderRadius:10,padding:"11px 14px",fontSize:12,color:C.yellow,lineHeight:1.7 }}>
              💡 الموظف سيدخل من شاشة تسجيل الدخول باختيار "دخول موظف" ثم يدخل اليوزرنيم والباسورد
            </div>

            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setShowSubAdd(false)}>إلغاء</Btn>
              <Btn onClick={addSubUser}>{addingSub?"جاري الإضافة...":"إضافة الموظف"}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LIVE CLOCK ───────────────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const dateStr = now.toLocaleDateString("ar-EG", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
  const timeStr = now.toLocaleTimeString("ar-EG", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
  return (
    <div style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 18px",display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2 }}>
      <div style={{ fontSize:13,color:C.textDim,fontWeight:600 }}>{dateStr}</div>
      <div style={{ fontSize:16,color:C.accent,fontWeight:800,fontFamily:"monospace",letterSpacing:1 }}>{timeStr}</div>
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
        <LiveClock />
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
  const [form, setForm] = useState({ date:today(),party:"",paid:"",taxRate:"14",paymentMethod:"نقدي",checkNumber:"",checkDate:"",notes:"" });
  const [items, setItems] = useState([{ category:"",name:"",qty:1,price:0 }]);
  const partyList = isS ? clients : suppliers;

  const subtotal = items.reduce((s,it)=>s+(parseFloat(it.qty)||0)*(parseFloat(it.price)||0),0);
  const taxAmount = isS ? subtotal*(parseFloat(form.taxRate)||0)/100 : 0;
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
      paymentMethod:form.paymentMethod,
      checkNumber:form.checkNumber,
      checkDate:form.checkDate,
      notes:form.notes,
      status:paid>=total?"مدفوعة":paid>0?"جزئية":"غير مدفوعة",
    });
  };

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:18 }}>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
        <Inp label="التاريخ" type="date" value={form.date} onChange={v=>setForm({...form,date:v})} />
        <Sel label={isS?"العميل":"المورد"} value={form.party} onChange={v=>setForm({...form,party:v})} options={partyList.map(p=>({value:p.name,label:p.name}))} />
        {isS && <Inp label="نسبة الضريبة %" type="number" value={form.taxRate} onChange={v=>setForm({...form,taxRate:v})} placeholder="14" />}
        <Inp label={isS?"المدفوع مقدماً":"المدفوع"} type="number" value={form.paid} onChange={v=>setForm({...form,paid:v})} placeholder="0" />
        <Sel label="طريقة الدفع" value={form.paymentMethod} onChange={v=>setForm({...form,paymentMethod:v})} options={[{value:"نقدي",label:"💵 نقدي"},{value:"شيك",label:"📄 شيك"},{value:"تحويل",label:"🏦 تحويل بنكي"}]} />
        {form.paymentMethod==="شيك" && <Inp label="رقم الشيك" value={form.checkNumber} onChange={v=>setForm({...form,checkNumber:v})} placeholder="رقم الشيك..." />}
        {form.paymentMethod==="شيك" && <Inp label="تاريخ الشيك" type="date" value={form.checkDate} onChange={v=>setForm({...form,checkDate:v})} />}
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
          { label:"المجموع",val:fmt(subtotal),color:C.text,show:true },
          { label:`ضريبة ${form.taxRate}%`,val:fmt(taxAmount),color:C.yellow,show:isS },
          { label:"الإجمالي الكلي",val:fmt(total),color:C.accent,bold:true,show:true },
          { label:"المدفوع",val:fmt(paid),color:C.green,show:true },
          { label:"المتبقي",val:fmt(total-paid),color:total-paid>0?C.red:C.green,show:true },
        ].filter(r=>r.show).map(r=>(
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
            <THead cols={["رقم الفاتورة","التاريخ",type==="sales"?"العميل":"المورد","الأصناف","الإجمالي","المدفوع","المتبقي","طريقة الدفع","الحالة","طباعة",""]} />
            <tbody>
              {filtered.map((inv,idx)=>{
                const party = type==="sales"?inv.client:inv.supplier;
                const remaining = inv.amount-inv.paid;
                const itemNames = (inv.items||[]).map(it=>it.name).filter(Boolean).join("، ");
                return (
                  <TRow key={inv.id} alt={idx%2}>
                    <TD color={C.accent}><span style={{ fontWeight:700 }}>{inv.id}</span></TD>
                    <TD color={C.textDim}><span style={{ fontSize:11 }}>{fmtDateTime(inv.createdAt||inv.date)}</span></TD>
                    <TD><span style={{ fontWeight:600 }}>{party}</span></TD>
                    <TD color={C.textMuted}><span style={{ fontSize:11 }}>{itemNames||"—"}</span></TD>
                    <TD mono><span style={{ fontWeight:700 }}>{fmt(inv.amount)}</span></TD>
                    <TD mono color={C.green}>{fmt(inv.paid)}</TD>
                    <TD mono color={remaining>0?C.red:C.textMuted}>{fmt(remaining)}</TD>
                    <td style={{ padding:"11px 14px" }}>
                      <span style={{ fontSize:11,color:inv.paymentMethod==="شيك"?C.yellow:inv.paymentMethod==="تحويل"?C.blue:C.green,fontWeight:600 }}>
                        {inv.paymentMethod==="شيك"?"📄 شيك":inv.paymentMethod==="تحويل"?"🏦 تحويل":"💵 نقدي"}
                        {inv.paymentMethod==="شيك"&&inv.checkNumber?` #${inv.checkNumber}`:""}
                      </span>
                    </td>
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


// ─── UNIFIED REPORTS PAGE (يومي + شهري مدمج + أرشيف شهري) ─────────────────────
function generateDayReportHTML(dayData, date) {
  const { sales, purchases, returns, expenses } = dayData;
  const totalSales = sales.reduce((s,i)=>s+i.amount,0);
  const totalPurchases = purchases.reduce((s,i)=>s+i.amount,0);
  const totalReturns = returns.reduce((s,i)=>s+i.amount,0);
  const totalExpenses = expenses.reduce((s,e)=>s+e.amount,0);
  const netProfit = totalSales - totalPurchases - totalReturns - totalExpenses;
  const paid = sales.reduce((s,i)=>s+i.paid,0);
  const unpaid = totalSales - paid;
  const dateLabel = new Date(date+"T00:00:00").toLocaleDateString("ar-EG",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
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
    <div class="logo">حسابي Pro</div>
    <div class="sub">تقرير يومي مُغلق</div>
    <div class="stamp">📅 ${dateLabel}</div>
    <div class="locked">🔒 تم إغلاق هذا التقرير بتاريخ ${new Date().toLocaleString("ar-EG")} — غير قابل للتعديل</div>
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
  <div class="footer">تقرير يومي — حسابي Pro — أُنشئ بتاريخ ${new Date().toLocaleString("ar-EG")}</div>
  </body></html>`;
}

function generateMonthReportHTML(monthData, month, data) {
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
    <div class="logo">حسابي Pro</div><div class="sub">تقرير شهري مُغلق</div>
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
  <div class="footer">تقرير شهري — حسابي Pro — أُنشئ بتاريخ ${new Date().toLocaleString("ar-EG")}</div>
  </body></html>`;
}

function UnifiedReportsPage({ data, userEmail }) {
  const [viewMode, setViewMode] = useState("daily"); // daily | monthly | archive
  const [selectedDate, setSelectedDate] = useState(today());
  const [selectedMonth, setSelectedMonth] = useState(today().slice(0,7));
  const [pwdDialog, setPwdDialog] = useState(null);
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
    const w = window.open("","_blank");
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(()=>w.print(),500);
    setConfirmClose(false);
  };

  // Close month manually
  const closeMonthManual = () => {
    setPwdDialog({ onConfirm: () => {
      setPwdDialog(null);
      autoCloseMonth(selectedMonth);
    }});
  };

  // Download archived report
  const downloadArchive = (html, filename) => {
    const w = window.open("","_blank");
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(()=>w.print(),500);
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
      {pwdDialog && <PasswordDialog userEmail={userEmail} onConfirm={pwdDialog.onConfirm} onCancel={()=>setPwdDialog(null)} title="تأكيد إغلاق الشهر" />}
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
            <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}
              style={{ background:C.surface2,border:`1px solid ${isDayClosed?C.yellow:C.border}`,borderRadius:9,padding:"9px 14px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none" }} />
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
            <span style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 13px",color:C.text,fontSize:12,fontFamily:"inherit" }}>جرد شهري</span>
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
      <PageHeader title="الجرد الدوري" icon={I.stocktake} subtitle="الجرد الشهري للمخزون"
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
          <button style={{ background:C.accent,color:"#fff",border:"none",borderRadius:8,padding:"7px 16px",fontSize:12,fontWeight:600,cursor:"default",fontFamily:"inherit" }}>
            شهري
          </button>
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
          تفاصيل الجرد الشهري — {selectedMonth}
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


// ─── EMPLOYEES PAGE ───────────────────────────────────────────────────────────
function EmployeesPage() {
  const [employees, setEmployees] = useState(() => {
    try { return JSON.parse(localStorage.getItem("employees_local")||"[]"); } catch { return []; }
  });
  const [salaries, setSalaries] = useState(() => {
    try { return JSON.parse(localStorage.getItem("salaries_local")||"[]"); } catch { return []; }
  });
  const [attendance, setAttendance] = useState(() => {
    try { return JSON.parse(localStorage.getItem("attendance_local")||"[]"); } catch { return []; }
  });
  const [advances, setAdvances] = useState(() => {
    try { return JSON.parse(localStorage.getItem("advances_local")||"[]"); } catch { return []; }
  });
  const [tab, setTab] = useState("employees");
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("employee");
  const [confirm, setConfirm] = useState(null);
  const [empForm, setEmpForm] = useState({ name:"", position:"", baseSalary:"", phone:"", startDate:today(), notes:"" });
  const [salForm, setSalForm] = useState({ employeeId:"", month:today().slice(0,7), baseSalary:"", bonus:"", deductions:"", notes:"", paymentMethod:"نقدي" });
  const [attForm, setAttForm] = useState({ employeeId:"", date:today(), type:"غياب", reason:"" });
  const [advForm, setAdvForm] = useState({ employeeId:"", date:today(), amount:"", reason:"", status:"قيد السداد" });

  const saveEmp = (list) => { setEmployees(list); localStorage.setItem("employees_local", JSON.stringify(list)); };
  const saveSal = (list) => { setSalaries(list); localStorage.setItem("salaries_local", JSON.stringify(list)); };
  const saveAtt = (list) => { setAttendance(list); localStorage.setItem("attendance_local", JSON.stringify(list)); };
  const saveAdv = (list) => { setAdvances(list); localStorage.setItem("advances_local", JSON.stringify(list)); };

  const openModal = (type) => { setModalType(type); setShowModal(true); };

  const handleSaveEmployee = () => {
    if (!empForm.name.trim()) return;
    saveEmp([...employees, { id:"EMP"+Date.now().toString().slice(-5), ...empForm, baseSalary:parseFloat(empForm.baseSalary)||0 }]);
    setShowModal(false);
    setEmpForm({ name:"", position:"", baseSalary:"", phone:"", startDate:today(), notes:"" });
  };

  const handleSaveSalary = () => {
    if (!salForm.employeeId) return;
    const emp = employees.find(e=>e.id===salForm.employeeId);
    const base = parseFloat(salForm.baseSalary)||(emp?.baseSalary||0);
    const bonus = parseFloat(salForm.bonus)||0;
    const deductions = parseFloat(salForm.deductions)||0;
    const net = base + bonus - deductions;
    saveSal([...salaries, { id:"SAL"+Date.now().toString().slice(-5), ...salForm, baseSalary:base, bonus, deductions, netSalary:net, employeeName:emp?.name||"" }]);
    setShowModal(false);
    setSalForm({ employeeId:"", month:today().slice(0,7), baseSalary:"", bonus:"", deductions:"", notes:"", paymentMethod:"نقدي" });
  };

  const handleSaveAttendance = () => {
    if (!attForm.employeeId) return;
    const emp = employees.find(e=>e.id===attForm.employeeId);
    saveAtt([...attendance, { id:"ATT"+Date.now().toString().slice(-5), ...attForm, employeeName:emp?.name||"" }]);
    setShowModal(false);
    setAttForm({ employeeId:"", date:today(), type:"غياب", reason:"" });
  };

  const handleSaveAdvance = () => {
    if (!advForm.employeeId||!advForm.amount) return;
    const emp = employees.find(e=>e.id===advForm.employeeId);
    saveAdv([...advances, { id:"ADV"+Date.now().toString().slice(-5), ...advForm, amount:parseFloat(advForm.amount)||0, employeeName:emp?.name||"" }]);
    setShowModal(false);
    setAdvForm({ employeeId:"", date:today(), amount:"", reason:"", status:"قيد السداد" });
  };

  const totalSalaries = salaries.reduce((s,r)=>s+r.netSalary,0);
  const totalAdvances = advances.filter(a=>a.status==="قيد السداد").reduce((s,a)=>s+a.amount,0);
  const absences = attendance.filter(a=>a.type==="غياب").length;
  const leaveDays = attendance.filter(a=>a.type==="إجازة").length;

  const tabs = [
    { id:"employees", label:"الموظفين" },
    { id:"salaries", label:"المرتبات" },
    { id:"attendance", label:"الغياب والإجازات" },
    { id:"advances", label:"السلف" },
  ];

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      <PageHeader title="إدارة الموظفين" icon={I.clients} subtitle={`${employees.length} موظف`}
        action={
          <div style={{ display:"flex",gap:8 }}>
            {tab==="employees" && <Btn onClick={()=>openModal("employee")}><Ic d={I.plus} s={14} />موظف جديد</Btn>}
            {tab==="salaries" && <Btn onClick={()=>openModal("salary")} variant="success"><Ic d={I.plus} s={14} />صرف مرتب</Btn>}
            {tab==="attendance" && <Btn onClick={()=>openModal("attendance")} variant="yellow"><Ic d={I.plus} s={14} />تسجيل غياب/إجازة</Btn>}
            {tab==="advances" && <Btn onClick={()=>openModal("advance")} variant="purple"><Ic d={I.plus} s={14} />سلفة جديدة</Btn>}
          </div>
        }
      />
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
        <MiniStat label="عدد الموظفين" value={employees.length} color={C.accent} icon={I.clients} />
        <MiniStat label="إجمالي المرتبات" value={fmt(totalSalaries)} color={C.green} icon={I.revenue} />
        <MiniStat label="السلف القائمة" value={fmt(totalAdvances)} color={C.red} icon={I.alert} />
        <MiniStat label={`غياب: ${absences} / إجازات: ${leaveDays}`} value={absences+leaveDays+" يوم"} color={C.yellow} icon={I.calendar} />
      </div>
      {/* Tabs */}
      <div style={{ display:"flex",background:C.surface2,borderRadius:12,padding:4,border:`1px solid ${C.border}`,gap:4 }}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1,background:tab===t.id?C.accent:"transparent",color:tab===t.id?"#fff":C.textMuted,border:"none",borderRadius:9,padding:"9px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s" }}>
            {t.label}
          </button>
        ))}
      </div>
      {/* Employees Tab */}
      {tab==="employees" && (
        <Card style={{ padding:0 }}>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <THead cols={["الكود","الاسم","المنصب","الراتب الأساسي","الهاتف","تاريخ التعيين","ملاحظات",""]} />
            <tbody>
              {employees.map((e,idx)=>(
                <TRow key={e.id} alt={idx%2}>
                  <TD color={C.accent}>{e.id}</TD>
                  <TD><span style={{ fontWeight:700 }}>{e.name}</span></TD>
                  <TD color={C.textDim}>{e.position||"—"}</TD>
                  <TD mono color={C.green}>{fmt(e.baseSalary)}</TD>
                  <TD color={C.textMuted}>{e.phone||"—"}</TD>
                  <TD color={C.textMuted}>{e.startDate}</TD>
                  <TD color={C.textMuted}>{e.notes||"—"}</TD>
                  <td style={{ padding:"11px 14px" }}>
                    <button onClick={()=>setConfirm({ msg:`حذف الموظف "${e.name}"؟`, onConfirm:()=>saveEmp(employees.filter(x=>x.id!==e.id)) })} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted }}><Ic d={I.trash} s={14} /></button>
                  </td>
                </TRow>
              ))}
            </tbody>
          </table>
          {employees.length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا يوجد موظفون بعد</div>}
        </Card>
      )}
      {/* Salaries Tab */}
      {tab==="salaries" && (
        <Card style={{ padding:0 }}>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <THead cols={["رقم","الشهر","الموظف","الراتب الأساسي","مكافآت","خصومات","صافي المرتب","طريقة الدفع","ملاحظات"]} />
            <tbody>
              {salaries.map((s,idx)=>(
                <TRow key={s.id} alt={idx%2}>
                  <TD color={C.accent}>{s.id}</TD>
                  <TD color={C.textDim}>{s.month}</TD>
                  <TD><span style={{ fontWeight:600 }}>{s.employeeName}</span></TD>
                  <TD mono>{fmt(s.baseSalary)}</TD>
                  <TD mono color={C.green}>{s.bonus?fmt(s.bonus):"—"}</TD>
                  <TD mono color={C.red}>{s.deductions?fmt(s.deductions):"—"}</TD>
                  <TD mono color={C.accent}><span style={{ fontWeight:700 }}>{fmt(s.netSalary)}</span></TD>
                  <TD color={s.paymentMethod==="شيك"?C.yellow:C.green}>{s.paymentMethod==="شيك"?"📄 شيك":"💵 نقدي"}</TD>
                  <TD color={C.textMuted}>{s.notes||"—"}</TD>
                </TRow>
              ))}
            </tbody>
          </table>
          {salaries.length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد سجلات مرتبات</div>}
        </Card>
      )}
      {/* Attendance Tab */}
      {tab==="attendance" && (
        <Card style={{ padding:0 }}>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <THead cols={["رقم","التاريخ","الموظف","النوع","السبب",""]} />
            <tbody>
              {attendance.map((a,idx)=>(
                <TRow key={a.id} alt={idx%2}>
                  <TD color={C.accent}>{a.id}</TD>
                  <TD color={C.textDim}>{a.date}</TD>
                  <TD><span style={{ fontWeight:600 }}>{a.employeeName}</span></TD>
                  <td style={{ padding:"11px 14px" }}>
                    <span style={{ background:a.type==="غياب"?C.redDim:C.yellowDim,color:a.type==="غياب"?C.red:C.yellow,border:`1px solid ${a.type==="غياب"?C.red:C.yellow}33`,padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700 }}>{a.type}</span>
                  </td>
                  <TD color={C.textMuted}>{a.reason||"—"}</TD>
                  <td style={{ padding:"11px 14px" }}>
                    <button onClick={()=>setConfirm({ msg:"حذف هذا السجل؟", onConfirm:()=>saveAtt(attendance.filter(x=>x.id!==a.id)) })} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted }}><Ic d={I.trash} s={14} /></button>
                  </td>
                </TRow>
              ))}
            </tbody>
          </table>
          {attendance.length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد سجلات غياب أو إجازات</div>}
        </Card>
      )}
      {/* Advances Tab */}
      {tab==="advances" && (
        <Card style={{ padding:0 }}>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <THead cols={["رقم","التاريخ","الموظف","المبلغ","السبب","الحالة",""]} />
            <tbody>
              {advances.map((a,idx)=>(
                <TRow key={a.id} alt={idx%2}>
                  <TD color={C.accent}>{a.id}</TD>
                  <TD color={C.textDim}>{a.date}</TD>
                  <TD><span style={{ fontWeight:600 }}>{a.employeeName}</span></TD>
                  <TD mono color={C.red}>{fmt(a.amount)}</TD>
                  <TD color={C.textMuted}>{a.reason||"—"}</TD>
                  <td style={{ padding:"11px 14px" }}>
                    <span style={{ background:a.status==="مسدد"?C.greenDim:C.yellowDim,color:a.status==="مسدد"?C.green:C.yellow,border:`1px solid ${a.status==="مسدد"?C.green:C.yellow}33`,padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700 }}>{a.status}</span>
                  </td>
                  <td style={{ padding:"11px 14px" }}>
                    <div style={{ display:"flex",gap:6 }}>
                      {a.status!=="مسدد" && <button onClick={()=>saveAdv(advances.map(x=>x.id===a.id?{...x,status:"مسدد"}:x))} style={{ background:C.greenDim,border:`1px solid ${C.green}33`,borderRadius:6,padding:"3px 10px",fontSize:11,color:C.green,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>مسدد</button>}
                      <button onClick={()=>setConfirm({ msg:"حذف هذه السلفة؟", onConfirm:()=>saveAdv(advances.filter(x=>x.id!==a.id)) })} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted }}><Ic d={I.trash} s={14} /></button>
                    </div>
                  </td>
                </TRow>
              ))}
            </tbody>
          </table>
          {advances.length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد سلف</div>}
        </Card>
      )}
      {/* Modals */}
      {showModal && modalType==="employee" && (
        <Modal title="إضافة موظف جديد" onClose={()=>setShowModal(false)}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <Inp label="الاسم الكامل" value={empForm.name} onChange={v=>setEmpForm({...empForm,name:v})} required />
              <Inp label="المنصب الوظيفي" value={empForm.position} onChange={v=>setEmpForm({...empForm,position:v})} />
              <Inp label="الراتب الأساسي (ج.م)" type="number" value={empForm.baseSalary} onChange={v=>setEmpForm({...empForm,baseSalary:v})} />
              <Inp label="رقم الهاتف" value={empForm.phone} onChange={v=>setEmpForm({...empForm,phone:v})} />
              <Inp label="تاريخ التعيين" type="date" value={empForm.startDate} onChange={v=>setEmpForm({...empForm,startDate:v})} />
            </div>
            <Inp label="ملاحظات" value={empForm.notes} onChange={v=>setEmpForm({...empForm,notes:v})} />
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setShowModal(false)}>إلغاء</Btn>
              <Btn onClick={handleSaveEmployee}>إضافة الموظف</Btn>
            </div>
          </div>
        </Modal>
      )}
      {showModal && modalType==="salary" && (
        <Modal title="صرف مرتب" onClose={()=>setShowModal(false)}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <Sel label="الموظف" value={salForm.employeeId} onChange={v=>{ const e=employees.find(x=>x.id===v); setSalForm({...salForm,employeeId:v,baseSalary:e?.baseSalary||""}); }} options={employees.map(e=>({value:e.id,label:e.name}))} />
              <Inp label="الشهر" type="month" value={salForm.month} onChange={v=>setSalForm({...salForm,month:v})} />
              <Inp label="الراتب الأساسي (ج.م)" type="number" value={salForm.baseSalary} onChange={v=>setSalForm({...salForm,baseSalary:v})} />
              <Inp label="مكافآت (ج.م)" type="number" value={salForm.bonus} onChange={v=>setSalForm({...salForm,bonus:v})} placeholder="0" />
              <Inp label="خصومات (ج.م)" type="number" value={salForm.deductions} onChange={v=>setSalForm({...salForm,deductions:v})} placeholder="0" />
              <Sel label="طريقة الدفع" value={salForm.paymentMethod} onChange={v=>setSalForm({...salForm,paymentMethod:v})} options={[{value:"نقدي",label:"💵 نقدي"},{value:"شيك",label:"📄 شيك"},{value:"تحويل",label:"🏦 تحويل"}]} />
            </div>
            <div style={{ background:C.surface3,borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between" }}>
              <span style={{ color:C.textMuted,fontSize:13 }}>صافي المرتب</span>
              <span style={{ color:C.green,fontWeight:800,fontSize:16,fontFamily:"monospace" }}>{fmt((parseFloat(salForm.baseSalary)||0)+(parseFloat(salForm.bonus)||0)-(parseFloat(salForm.deductions)||0))}</span>
            </div>
            <Inp label="ملاحظات" value={salForm.notes} onChange={v=>setSalForm({...salForm,notes:v})} />
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setShowModal(false)}>إلغاء</Btn>
              <Btn variant="success" onClick={handleSaveSalary}>صرف المرتب</Btn>
            </div>
          </div>
        </Modal>
      )}
      {showModal && modalType==="attendance" && (
        <Modal title="تسجيل غياب / إجازة" onClose={()=>setShowModal(false)}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <Sel label="الموظف" value={attForm.employeeId} onChange={v=>setAttForm({...attForm,employeeId:v})} options={employees.map(e=>({value:e.id,label:e.name}))} />
              <Inp label="التاريخ" type="date" value={attForm.date} onChange={v=>setAttForm({...attForm,date:v})} />
              <Sel label="النوع" value={attForm.type} onChange={v=>setAttForm({...attForm,type:v})} options={[{value:"غياب",label:"🔴 غياب"},{value:"إجازة",label:"🟡 إجازة"},{value:"تأخر",label:"🟠 تأخر"}]} />
            </div>
            <Inp label="السبب" value={attForm.reason} onChange={v=>setAttForm({...attForm,reason:v})} placeholder="سبب الغياب أو الإجازة..." />
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setShowModal(false)}>إلغاء</Btn>
              <Btn variant="yellow" onClick={handleSaveAttendance}>تسجيل</Btn>
            </div>
          </div>
        </Modal>
      )}
      {showModal && modalType==="advance" && (
        <Modal title="سلفة جديدة" onClose={()=>setShowModal(false)}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <Sel label="الموظف" value={advForm.employeeId} onChange={v=>setAdvForm({...advForm,employeeId:v})} options={employees.map(e=>({value:e.id,label:e.name}))} />
              <Inp label="التاريخ" type="date" value={advForm.date} onChange={v=>setAdvForm({...advForm,date:v})} />
              <Inp label="المبلغ (ج.م)" type="number" value={advForm.amount} onChange={v=>setAdvForm({...advForm,amount:v})} required />
            </div>
            <Inp label="السبب" value={advForm.reason} onChange={v=>setAdvForm({...advForm,reason:v})} placeholder="سبب السلفة..." />
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setShowModal(false)}>إلغاء</Btn>
              <Btn variant="purple" onClick={handleSaveAdvance}>منح السلفة</Btn>
            </div>
          </div>
        </Modal>
      )}
      {confirm && <ConfirmDialog message={confirm.msg} onConfirm={()=>{ confirm.onConfirm(); setConfirm(null); }} onCancel={()=>setConfirm(null)} />}
    </div>
  );
}


// ─── EXPENSES PAGE ────────────────────────────────────────────────────────────
function ExpensesPage() {
  const [expenses, setExpenses] = useState(() => {
    try { return JSON.parse(localStorage.getItem("expenses_local")||"[]"); } catch { return []; }
  });
  const [showModal, setShowModal] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [filter, setFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [form, setForm] = useState({ date:today(), description:"", category:"إيجار", amount:"", paymentMethod:"نقدي", notes:"" });

  const expenseCategories = ["إيجار","كهرباء","مياه","غاز","إنترنت","تأمين","صيانة","مواصلات","تسويق","قرطاسية","رسوم قانونية","ضرائب","أخرى"];

  const save = (list) => {
    setExpenses(list);
    localStorage.setItem("expenses_local", JSON.stringify(list));
  };

  const handleSave = () => {
    if (!form.description.trim()||!form.amount) return;
    const rec = { id:"EXP"+Date.now().toString().slice(-5), ...form, amount:parseFloat(form.amount)||0 };
    save([...expenses, rec]);
    setShowModal(false);
    setForm({ date:today(), description:"", category:"إيجار", amount:"", paymentMethod:"نقدي", notes:"" });
  };

  const filtered = expenses.filter(e=>{
    const matchFilter = !filter || e.description?.includes(filter) || e.category?.includes(filter);
    const matchMonth = !monthFilter || e.date?.startsWith(monthFilter);
    return matchFilter && matchMonth;
  });

  const totalExpenses = filtered.reduce((s,e)=>s+e.amount,0);
  const byCategory = {};
  filtered.forEach(e=>{ byCategory[e.category]=(byCategory[e.category]||0)+e.amount; });
  const months = [...new Set(expenses.map(e=>e.date?.slice(0,7)))].filter(Boolean).sort().reverse();

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      {confirm && <ConfirmDialog message={confirm.msg} onConfirm={()=>{ save(expenses.filter(e=>e.id!==confirm.id)); setConfirm(null); }} onCancel={()=>setConfirm(null)} />}
      <PageHeader title="المصروفات" icon={I.revenue} subtitle={`${filtered.length} مصروف — إجمالي ${fmt(totalExpenses)}`}
        action={<Btn onClick={()=>setShowModal(true)}><Ic d={I.plus} s={14} />إضافة مصروف</Btn>} />
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
        <MiniStat label="إجمالي المصروفات" value={fmt(totalExpenses)} color={C.red} icon={I.revenue} />
        <MiniStat label="نقدي" value={fmt(filtered.filter(e=>e.paymentMethod==="نقدي").reduce((s,e)=>s+e.amount,0))} color={C.green} icon={I.chartBar} />
        <MiniStat label="شيكات" value={fmt(filtered.filter(e=>e.paymentMethod==="شيك").reduce((s,e)=>s+e.amount,0))} color={C.yellow} icon={I.tax} />
        <MiniStat label="عدد الأصناف" value={Object.keys(byCategory).length} color={C.accent} icon={I.categories} />
      </div>
      {Object.keys(byCategory).length > 0 && (
        <Card>
          <h3 style={{ margin:"0 0 14px",fontSize:14,fontWeight:700,color:C.text }}>توزيع المصروفات حسب الفئة</h3>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8 }}>
            {Object.entries(byCategory).sort((a,b)=>b[1]-a[1]).map(([cat,val])=>(
              <div key={cat} style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <span style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>{cat}</span>
                <span style={{ fontSize:13,color:C.red,fontFamily:"monospace",fontWeight:700 }}>{fmt(val)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card style={{ padding:0 }}>
        <div style={{ padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap" }}>
          <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="ابحث..." style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 13px",color:C.text,fontSize:12,fontFamily:"inherit",outline:"none",width:200 }} />
          <select value={monthFilter} onChange={e=>setMonthFilter(e.target.value)} style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 13px",color:C.text,fontSize:12,fontFamily:"inherit" }}>
            <option value="">كل الأشهر</option>
            {months.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <table style={{ width:"100%",borderCollapse:"collapse" }}>
          <THead cols={["رقم","التاريخ","الوصف","الفئة","المبلغ","طريقة الدفع","ملاحظات",""]} />
          <tbody>
            {filtered.map((e,idx)=>(
              <TRow key={e.id} alt={idx%2}>
                <TD color={C.accent}>{e.id}</TD>
                <TD color={C.textDim}>{e.date}</TD>
                <TD><span style={{ fontWeight:600 }}>{e.description}</span></TD>
                <TD><span style={{ background:C.surface3,padding:"2px 8px",borderRadius:6,fontSize:11,color:C.textDim }}>{e.category}</span></TD>
                <TD mono color={C.red}><span style={{ fontWeight:700 }}>{fmt(e.amount)}</span></TD>
                <TD color={e.paymentMethod==="شيك"?C.yellow:C.green}>{e.paymentMethod==="شيك"?"📄 شيك":"💵 نقدي"}</TD>
                <TD color={C.textMuted}>{e.notes||"—"}</TD>
                <td style={{ padding:"11px 14px" }}>
                  <button onClick={()=>setConfirm({ id:e.id,msg:`حذف "${e.description}"؟` })} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted }}><Ic d={I.trash} s={14} /></button>
                </td>
              </TRow>
            ))}
          </tbody>
        </table>
        {filtered.length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد مصروفات</div>}
      </Card>
      {showModal && (
        <Modal title="إضافة مصروف" onClose={()=>setShowModal(false)}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <Inp label="التاريخ" type="date" value={form.date} onChange={v=>setForm({...form,date:v})} />
              <Inp label="الوصف" value={form.description} onChange={v=>setForm({...form,description:v})} required />
              <Sel label="الفئة" value={form.category} onChange={v=>setForm({...form,category:v})} options={expenseCategories} />
              <Inp label="المبلغ (ج.م)" type="number" value={form.amount} onChange={v=>setForm({...form,amount:v})} required />
              <Sel label="طريقة الدفع" value={form.paymentMethod} onChange={v=>setForm({...form,paymentMethod:v})} options={[{value:"نقدي",label:"💵 نقدي"},{value:"شيك",label:"📄 شيك"},{value:"تحويل",label:"🏦 تحويل"}]} />
            </div>
            <Inp label="ملاحظات" value={form.notes} onChange={v=>setForm({...form,notes:v})} placeholder="أي ملاحظات..." />
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setShowModal(false)}>إلغاء</Btn>
              <Btn onClick={handleSave}>حفظ المصروف</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}


// ─── PRODUCTION COST PAGE ─────────────────────────────────────────────────────
function ProductionCostPage({ data, actions }) {
  const [showModal, setShowModal] = useState(false);
  const [productions, setProductions] = useState([]);
  const [form, setForm] = useState({ date: today(), productName:"", quantity:1, unit:"قطعة", notes:"" });
  const [materials, setMaterials] = useState([{ name:"", qty:1, unit:"قطعة", cost:0 }]);
  const [laborCost, setLaborCost] = useState(0);
  const [overheadCost, setOverheadCost] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem("productions_" + "local");
    if (stored) try { setProductions(JSON.parse(stored)); } catch {}
  }, []);

  const saveProductions = (list) => {
    setProductions(list);
    localStorage.setItem("productions_local", JSON.stringify(list));
  };

  const addMaterial = () => setMaterials([...materials, { name:"", qty:1, unit:"قطعة", cost:0 }]);
  const removeMaterial = (i) => setMaterials(materials.filter((_,idx)=>idx!==i));
  const updateMaterial = (i,field,val) => setMaterials(materials.map((m,idx)=>idx===i?{...m,[field]:val}:m));

  const materialsCost = materials.reduce((s,m)=>(s+(parseFloat(m.qty)||0)*(parseFloat(m.cost)||0)),0);
  const totalCost = materialsCost + (parseFloat(laborCost)||0) + (parseFloat(overheadCost)||0);
  const costPerUnit = form.quantity > 0 ? totalCost / (parseFloat(form.quantity)||1) : 0;

  const handleSave = () => {
    if (!form.productName.trim()) return;
    const record = {
      id: "PRD" + Date.now().toString().slice(-5),
      date: form.date,
      productName: form.productName,
      quantity: parseFloat(form.quantity)||1,
      unit: form.unit,
      materials: materials.filter(m=>m.name.trim()),
      materialsCost: Math.round(materialsCost),
      laborCost: parseFloat(laborCost)||0,
      overheadCost: parseFloat(overheadCost)||0,
      totalCost: Math.round(totalCost),
      costPerUnit: Math.round(costPerUnit),
      notes: form.notes,
    };
    saveProductions([...productions, record]);
    setShowModal(false);
    setForm({ date:today(), productName:"", quantity:1, unit:"قطعة", notes:"" });
    setMaterials([{ name:"", qty:1, unit:"قطعة", cost:0 }]);
    setLaborCost(0); setOverheadCost(0);
  };

  const deleteProduction = (id) => saveProductions(productions.filter(p=>p.id!==id));

  const totalAllCost = productions.reduce((s,p)=>s+p.totalCost,0);
  const totalMaterials = productions.reduce((s,p)=>s+p.materialsCost,0);
  const totalLabor = productions.reduce((s,p)=>s+p.laborCost,0);

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      <PageHeader title="تكلفة الإنتاج" icon={I.chartBar} subtitle={`${productions.length} دفعة إنتاجية`}
        action={<Btn onClick={()=>setShowModal(true)}><Ic d={I.plus} s={14} />إضافة دفعة إنتاج</Btn>} />
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
        <MiniStat label="إجمالي التكاليف" value={fmt(totalAllCost)} color={C.red} icon={I.revenue} />
        <MiniStat label="تكلفة المواد" value={fmt(totalMaterials)} color={C.yellow} icon={I.box} />
        <MiniStat label="تكلفة العمالة" value={fmt(totalLabor)} color={C.blue} icon={I.clients} />
        <MiniStat label="عدد الدفعات" value={productions.length} color={C.accent} icon={I.chartBar} />
      </div>
      <Card style={{ padding:0 }}>
        <table style={{ width:"100%",borderCollapse:"collapse" }}>
          <THead cols={["رقم","التاريخ","المنتج","الكمية","تكلفة المواد","العمالة","المصاريف","إجمالي التكلفة","تكلفة الوحدة",""]} />
          <tbody>
            {productions.map((p,idx)=>(
              <TRow key={p.id} alt={idx%2}>
                <TD color={C.accent}>{p.id}</TD>
                <TD color={C.textDim}>{p.date}</TD>
                <TD><span style={{ fontWeight:700 }}>{p.productName}</span></TD>
                <TD mono color={C.text}>{p.quantity} {p.unit}</TD>
                <TD mono color={C.yellow}>{fmt(p.materialsCost)}</TD>
                <TD mono color={C.blue}>{fmt(p.laborCost)}</TD>
                <TD mono color={C.purple}>{fmt(p.overheadCost)}</TD>
                <TD mono color={C.red}><span style={{ fontWeight:700 }}>{fmt(p.totalCost)}</span></TD>
                <TD mono color={C.green}>{fmt(p.costPerUnit)}</TD>
                <td style={{ padding:"11px 14px" }}>
                  <button onClick={()=>deleteProduction(p.id)} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted }}><Ic d={I.trash} s={14} /></button>
                </td>
              </TRow>
            ))}
          </tbody>
        </table>
        {productions.length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد دفعات إنتاجية بعد</div>}
      </Card>
      {showModal && (
        <Modal title="إضافة دفعة إنتاج" onClose={()=>setShowModal(false)} wide>
          <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12 }}>
              <Inp label="التاريخ" type="date" value={form.date} onChange={v=>setForm({...form,date:v})} />
              <Inp label="اسم المنتج" value={form.productName} onChange={v=>setForm({...form,productName:v})} required />
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                <Inp label="الكمية المنتجة" type="number" value={form.quantity} onChange={v=>setForm({...form,quantity:v})} />
                <Inp label="الوحدة" value={form.unit} onChange={v=>setForm({...form,unit:v})} />
              </div>
            </div>
            <div>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
                <label style={{ fontSize:13,fontWeight:600,color:C.textDim }}>المواد الخام</label>
                <Btn small onClick={addMaterial}><Ic d={I.plus} s={12} />إضافة مادة</Btn>
              </div>
              <div style={{ background:C.surface2,borderRadius:12,overflow:"hidden",border:`1px solid ${C.border}` }}>
                <table style={{ width:"100%",borderCollapse:"collapse" }}>
                  <THead cols={["المادة","الكمية","الوحدة","تكلفة الوحدة","الإجمالي",""]} />
                  <tbody>
                    {materials.map((m,i)=>(
                      <TRow key={i} alt={i%2}>
                        <td style={{ padding:"6px 10px" }}><input value={m.name} onChange={e=>updateMaterial(i,"name",e.target.value)} placeholder="اسم المادة" style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 8px",color:C.text,fontSize:12,fontFamily:"inherit",width:"100%" }} /></td>
                        <td style={{ padding:"6px 10px" }}><input type="number" value={m.qty} onChange={e=>updateMaterial(i,"qty",e.target.value)} style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 8px",color:C.text,fontSize:12,fontFamily:"inherit",width:60 }} /></td>
                        <td style={{ padding:"6px 10px" }}><input value={m.unit} onChange={e=>updateMaterial(i,"unit",e.target.value)} style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 8px",color:C.text,fontSize:12,fontFamily:"inherit",width:60 }} /></td>
                        <td style={{ padding:"6px 10px" }}><input type="number" value={m.cost} onChange={e=>updateMaterial(i,"cost",e.target.value)} style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 8px",color:C.text,fontSize:12,fontFamily:"inherit",width:80 }} /></td>
                        <TD mono color={C.accent}>{fmt((parseFloat(m.qty)||0)*(parseFloat(m.cost)||0))}</TD>
                        <td style={{ padding:"6px 10px" }}><button onClick={()=>removeMaterial(i)} style={{ background:"none",border:"none",cursor:"pointer",color:C.red }}><Ic d={I.trash} s={14} /></button></td>
                      </TRow>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <Inp label="تكلفة العمالة (ج.م)" type="number" value={laborCost} onChange={setLaborCost} placeholder="0" />
              <Inp label="مصاريف عامة (ج.م)" type="number" value={overheadCost} onChange={setOverheadCost} placeholder="0" />
            </div>
            <div style={{ background:C.surface3,borderRadius:12,padding:"14px 18px",display:"flex",flexDirection:"column",gap:8 }}>
              {[
                { label:"تكلفة المواد", val:fmt(materialsCost), color:C.yellow },
                { label:"تكلفة العمالة", val:fmt(parseFloat(laborCost)||0), color:C.blue },
                { label:"مصاريف عامة", val:fmt(parseFloat(overheadCost)||0), color:C.purple },
                { label:"إجمالي التكلفة", val:fmt(totalCost), color:C.red, bold:true },
                { label:`تكلفة الوحدة (${form.unit})`, val:fmt(costPerUnit), color:C.green, bold:true },
              ].map(r=>(
                <div key={r.label} style={{ display:"flex",justifyContent:"space-between",fontSize:r.bold?14:12,borderTop:r.bold?`1px solid ${C.border}`:"none",paddingTop:r.bold?8:0 }}>
                  <span style={{ color:C.textMuted,fontWeight:r.bold?700:400 }}>{r.label}</span>
                  <span style={{ color:r.color,fontWeight:700,fontFamily:"monospace" }}>{r.val}</span>
                </div>
              ))}
            </div>
            <Inp label="ملاحظات" value={form.notes} onChange={v=>setForm({...form,notes:v})} placeholder="أي ملاحظات..." />
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setShowModal(false)}>إلغاء</Btn>
              <Btn onClick={handleSave}>حفظ دفعة الإنتاج</Btn>
            </div>
          </div>
        </Modal>
      )}
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
  const [subUser, setSubUser] = useState(null); // { id, owner_id, username, role, allowed_pages, can_add, can_delete, can_edit }
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
      if (!uid) setSubUser(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(()=>{ document.title = 'حسابي Pro'; }, []);

  // For sub-users: we need to load data using the owner's userId
  const effectiveUserId = subUser ? subUser.owner_id : userId;
  const { data, loading, actions } = useAppData(effectiveUserId);

  // Sub-user login: sign in with owner account silently isn't possible,
  // so we load data from sub_users table directly using owner_id
  // But we need auth session for supabase RLS — so sub-users use the owner's data via owner_id
  // The sub_users table has owner_id; after sub-user validates, we need to load that owner's records
  // Solution: after sub-user login, sign in with owner's credentials isn't possible client-side
  // Instead: allow sub_users to access records with owner_id via RLS policy allowing select where owner_id = sub_user.owner_id
  // For now, we store owner_id and use it, but RLS may block — we bypass with anon key policy
  // The simplest working approach: keep the sub-user in state, use owner_id as userId for data hooks

  // Handle sub-user login (called from LoginScreen)
  const handleSubUserLogin = (su) => {
    setSubUser(su);
    // Navigate to first allowed page
    const firstPage = su.allowed_pages?.[0] || "dash";
    setPage(firstPage);
  };

  const handleSubUserLogout = () => {
    setSubUser(null);
    setPage("dash");
  };

  if (authLoading) {
    return (
      <div style={{ minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",color:C.text,fontFamily:"'Cairo','Segoe UI',sans-serif",flexDirection:"column",gap:16 }}>
        <Logo size={52} />
        <div style={{ fontSize:14,color:C.textMuted }}>جاري التحميل...</div>
      </div>
    );
  }

  // Sub-user is logged in (no supabase auth needed for display)
  if (subUser) {
    const allowedPages = subUser.allowed_pages || [];
    const perms = { canAdd: subUser.can_add, canDelete: subUser.can_delete, canEdit: subUser.can_edit };

    const navGroups = [
      { label:"الرئيسية", items:[{ id:"dash", label:"الرئيسية", icon:I.dash }] },
      { label:"المالية", items:[
        { id:"sales", label:"المبيعات", icon:I.sales },
        { id:"purchases", label:"المشتريات", icon:I.purchase },
        { id:"returns", label:"المرتجعات", icon:I.returns },
        { id:"revenue", label:"الإيرادات", icon:I.revenue },
        { id:"expenses", label:"المصروفات", icon:I.revenue },
        { id:"taxinvoices", label:"الفواتير الضريبية", icon:I.tax },
      ]},
      { label:"الأطراف", items:[
        { id:"clients", label:"العملاء", icon:I.clients },
        { id:"suppliers", label:"الموردين", icon:I.suppliers },
      ]},
      { label:"التقارير", items:[
        { id:"reports", label:"التقارير المالية", icon:I.report },
        { id:"taxreports", label:"التقارير الضريبية", icon:I.tax },
      ]},
      { label:"الإنتاج", items:[
        { id:"production", label:"تكلفة الإنتاج", icon:I.chartBar },
        { id:"employees", label:"الموظفين", icon:I.clients },
      ]},
      { label:"المخزون", items:[
        { id:"inventory", label:"إدارة المخزون", icon:I.inventory },
        { id:"stocktake", label:"الجرد الشهري", icon:I.stocktake },
        { id:"inventoryitems", label:"الأصناف", icon:I.box },
        { id:"categories", label:"الفئات", icon:I.categories },
      ]},
    ].map(g=>({...g, items: g.items.filter(it=>allowedPages.includes(it.id))})).filter(g=>g.items.length>0);

    // Restrict actions based on permissions
    const restrictedActions = {
      ...actions,
      addSale: perms.canAdd ? actions.addSale : ()=>alert("ليس لديك صلاحية الإضافة"),
      deleteSale: perms.canDelete ? actions.deleteSale : ()=>alert("ليس لديك صلاحية الحذف"),
      addPurchase: perms.canAdd ? actions.addPurchase : ()=>alert("ليس لديك صلاحية الإضافة"),
      deletePurchase: perms.canDelete ? actions.deletePurchase : ()=>alert("ليس لديك صلاحية الحذف"),
      addReturn: perms.canAdd ? actions.addReturn : ()=>alert("ليس لديك صلاحية الإضافة"),
      deleteReturn: perms.canDelete ? actions.deleteReturn : ()=>alert("ليس لديك صلاحية الحذف"),
      addClient: perms.canAdd ? actions.addClient : ()=>alert("ليس لديك صلاحية الإضافة"),
      deleteClient: perms.canDelete ? actions.deleteClient : ()=>alert("ليس لديك صلاحية الحذف"),
      addSupplier: perms.canAdd ? actions.addSupplier : ()=>alert("ليس لديك صلاحية الإضافة"),
      deleteSupplier: perms.canDelete ? actions.deleteSupplier : ()=>alert("ليس لديك صلاحية الحذف"),
      addInventoryItem: perms.canAdd ? actions.addInventoryItem : ()=>alert("ليس لديك صلاحية الإضافة"),
      updateInventoryItem: perms.canEdit ? actions.updateInventoryItem : ()=>alert("ليس لديك صلاحية التعديل"),
      deleteInventoryItem: perms.canDelete ? actions.deleteInventoryItem : ()=>alert("ليس لديك صلاحية الحذف"),
    };

    return <AppShell page={page} setPage={setPage} navGroups={navGroups} data={data} actions={restrictedActions} loading={loading}
      userEmail={subUser.display_name||subUser.username} onLogout={handleSubUserLogout}
      roleBadge={<span style={{ background:C.purpleDim,color:C.purple,border:`1px solid ${C.purple}33`,borderRadius:20,padding:"2px 10px",fontSize:10,fontWeight:700 }}>{subUser.role}</span>}
      sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed}
    />;
  }

  if (!userId) return <LoginScreen onSubUserLogin={handleSubUserLogin} />;
  if (userEmail === ADMIN_EMAIL) return <AdminPanel />;
  if (!isActive) return <SubscriptionExpired />;

  const navGroups = [
    { label:"الرئيسية", items:[{ id:"dash", label:"الرئيسية", icon:I.dash }] },
    { label:"المالية", items:[
      { id:"sales", label:"المبيعات", icon:I.sales },
      { id:"purchases", label:"المشتريات", icon:I.purchase },
      { id:"returns", label:"المرتجعات", icon:I.returns },
      { id:"revenue", label:"الإيرادات", icon:I.revenue },
      { id:"expenses", label:"المصروفات", icon:I.revenue },
      { id:"taxinvoices", label:"الفواتير الضريبية", icon:I.tax },
    ]},
    { label:"الأطراف", items:[
      { id:"clients", label:"العملاء", icon:I.clients },
      { id:"suppliers", label:"الموردين", icon:I.suppliers },
    ]},
    { label:"التقارير", items:[
      { id:"reports", label:"التقارير المالية", icon:I.report },
      { id:"taxreports", label:"التقارير الضريبية", icon:I.tax },
      { id:"taxinvoices", label:"الفواتير الضريبية", icon:I.tax },
    ]},
    { label:"الإنتاج والموارد", items:[
      { id:"production", label:"تكلفة الإنتاج", icon:I.chartBar },
      { id:"employees", label:"الموظفين", icon:I.clients },
    ]},
    { label:"المخزون", items:[
      { id:"inventory", label:"إدارة المخزون", icon:I.inventory },
      { id:"stocktake", label:"الجرد الشهري", icon:I.stocktake },
      { id:"inventoryitems", label:"الأصناف", icon:I.box },
      { id:"categories", label:"الفئات", icon:I.categories },
    ]},
  ];

  return <AppShell page={page} setPage={setPage} navGroups={navGroups} data={data} actions={actions} loading={loading}
    userEmail={userEmail} onLogout={()=>supabase.auth.signOut()}
    sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed}
  />;
}

// ─── APP SHELL (Sidebar + Content) ────────────────────────────────────────────
function AppShell({ page, setPage, navGroups, data, actions, loading, userEmail, onLogout, roleBadge, sidebarCollapsed, setSidebarCollapsed }) {
  const W = sidebarCollapsed ? 68 : 230;

  const renderPage = () => {
    switch (page) {
      case "dash": return <Dashboard data={data} />;
      case "sales": return <InvoicesPage title="فواتير المبيعات" invoices={data.salesInvoices} type="sales" clients={data.clients} suppliers={data.suppliers} categories={data.categories} onAdd={actions.addSale} onDelete={actions.deleteSale} userEmail={userEmail} />;
      case "purchases": return <InvoicesPage title="فواتير المشتريات" invoices={data.purchaseInvoices} type="purchases" clients={data.clients} suppliers={data.suppliers} categories={data.categories} onAdd={actions.addPurchase} onDelete={actions.deletePurchase} userEmail={userEmail} />;
      case "clients": return <AccountStatement parties={data.clients} invoices={data.salesInvoices} type="client" onAddParty={actions.addClient} onDeleteParty={actions.deleteClient} />;
      case "suppliers": return <AccountStatement parties={data.suppliers} invoices={data.purchaseInvoices} type="supplier" onAddParty={actions.addSupplier} onDeleteParty={actions.deleteSupplier} />;
      case "returns": return <ReturnsPage returns={data.returns} salesInvoices={data.salesInvoices} purchaseInvoices={data.purchaseInvoices} clients={data.clients} suppliers={data.suppliers} onAdd={actions.addReturn} onDelete={actions.deleteReturn} />;
      case "revenue": return <RevenuePage data={data} onDeleteMonth={actions.deleteMonth} userEmail={userEmail} />;
      case "reports": return <UnifiedReportsPage data={data} userEmail={userEmail} />;
      case "taxreports": return <TaxReportsPage data={data} />;
      case "taxinvoices": return <TaxInvoicesPage salesInvoices={data.salesInvoices} purchaseInvoices={data.purchaseInvoices} />;
      case "expenses": return <ExpensesPage />;
      case "production": return <ProductionCostPage data={data} />;
      case "employees": return <EmployeesPage />;
      case "inventory": return <InventoryPage inventory={data.inventory} categories={data.categories} onAdd={actions.addInventoryItem} onEdit={actions.updateInventoryItem} onDelete={actions.deleteInventoryItem} onBulkAdd={actions.bulkAddInventory} userEmail={userEmail} />;
      case "stocktake": return <StocktakePage inventory={data.inventory} categories={data.categories} />;
      case "inventoryitems": return <InventoryItemsPage inventory={data.inventory} categories={data.categories} />;
      case "categories": return <CategoriesPage categories={data.categories} onAdd={actions.addCategory} />;
      default: return <Dashboard data={data} />;
    }
  };

  return (
    <div style={{ minHeight:"100vh",background:C.bg,fontFamily:"'Cairo','Segoe UI',sans-serif",display:"flex",direction:"rtl" }}>
      {/* ── Sidebar ── */}
      <div style={{
        width:W, background:C.surface, borderLeft:`1px solid ${C.border}`,
        display:"flex", flexDirection:"column", position:"fixed", top:0, right:0,
        height:"100vh", zIndex:100, transition:"width 0.25s cubic-bezier(0.4,0,0.2,1)",
        overflow:"hidden",
      }}>
        {/* Logo area */}
        <div style={{ padding:"16px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10,minHeight:70,flexShrink:0 }}>
          <div style={{ flexShrink:0 }}><Logo size={36} /></div>
          {!sidebarCollapsed && (
            <div style={{ overflow:"hidden",flex:1 }}>
              <div style={{ fontSize:15,fontWeight:800,color:C.text,letterSpacing:-0.3,whiteSpace:"nowrap" }}>حسابي Pro</div>
              <div style={{ fontSize:10,color:C.textMuted,marginTop:1,whiteSpace:"nowrap" }}>نظام محاسبة متكامل</div>
            </div>
          )}
          <button onClick={()=>setSidebarCollapsed(p=>!p)} style={{
            background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,cursor:"pointer",
            color:C.textMuted,padding:5,display:"flex",flexShrink:0,marginRight:"auto",transition:"all 0.2s",
          }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {sidebarCollapsed ? <path d="M9 18l6-6-6-6"/> : <path d="M15 18l-6-6 6-6"/>}
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex:1,overflowY:"auto",overflowX:"hidden",padding:"10px 6px",scrollbarWidth:"thin",scrollbarColor:`${C.border} transparent` }}>
          <style>{`
            nav::-webkit-scrollbar{width:4px}
            nav::-webkit-scrollbar-track{background:transparent}
            nav::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}
            nav::-webkit-scrollbar-thumb:hover{background:${C.borderLight}}
          `}</style>
          {navGroups.map(group=>(
            <div key={group.label} style={{ marginBottom:sidebarCollapsed?8:14 }}>
              {!sidebarCollapsed && (
                <div style={{ padding:"0 10px",fontSize:9,fontWeight:800,color:C.textMuted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:5,whiteSpace:"nowrap",opacity:0.7 }}>{group.label}</div>
              )}
              {sidebarCollapsed && <div style={{ height:1,background:C.border,margin:"4px 6px 6px" }} />}
              {group.items.map(item=>{
                const active = page===item.id;
                return (
                  <button key={item.id} onClick={()=>setPage(item.id)} title={sidebarCollapsed?item.label:""} style={{
                    width:"100%",display:"flex",alignItems:"center",gap:sidebarCollapsed?0:10,
                    padding:sidebarCollapsed?"10px 0":"9px 12px",borderRadius:11,border:"none",cursor:"pointer",
                    fontFamily:"inherit",fontSize:12.5,fontWeight:600,textAlign:"right",marginBottom:2,
                    transition:"all 0.15s",justifyContent:sidebarCollapsed?"center":"flex-start",
                    background:active?C.accentDim:"transparent",
                    color:active?C.accent:C.textMuted,
                    borderRight:active?`3px solid ${C.accent}`:"3px solid transparent",
                    position:"relative",
                  }}>
                    <Ic d={item.icon} s={15} c={active?C.accent:C.textMuted} />
                    {!sidebarCollapsed && <span style={{ whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{item.label}</span>}
                    {active && !sidebarCollapsed && (
                      <div style={{ position:"absolute",left:8,width:6,height:6,borderRadius:"50%",background:C.accent,boxShadow:`0 0 6px ${C.accent}` }} />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding:"10px 6px",borderTop:`1px solid ${C.border}`,flexShrink:0 }}>
          {loading && !sidebarCollapsed && (
            <div style={{ fontSize:10,color:C.textMuted,textAlign:"center",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:5 }}>
              <div style={{ width:5,height:5,borderRadius:"50%",background:C.accent }} />
              مزامنة...
            </div>
          )}
          {/* User card */}
          <div style={{ padding:sidebarCollapsed?"8px 0":"8px 10px",marginBottom:6,borderRadius:10,background:C.surface2,display:"flex",alignItems:"center",gap:8,justifyContent:sidebarCollapsed?"center":"flex-start" }}>
            <div style={{ width:30,height:30,borderRadius:"50%",background:C.accentDim,border:`2px solid ${C.accent}33`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
              <span style={{ fontSize:12,fontWeight:800,color:C.accent }}>{userEmail?.[0]?.toUpperCase()}</span>
            </div>
            {!sidebarCollapsed && (
              <div style={{ overflow:"hidden",flex:1 }}>
                <div style={{ fontSize:11,color:C.text,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{userEmail}</div>
                {roleBadge && <div style={{ marginTop:3 }}>{roleBadge}</div>}
              </div>
            )}
          </div>
          <button onClick={onLogout} title={sidebarCollapsed?"تسجيل الخروج":""} style={{
            width:"100%",display:"flex",alignItems:"center",gap:sidebarCollapsed?0:8,
            padding:sidebarCollapsed?"9px 0":"9px 12px",borderRadius:10,border:`1px solid ${C.red}33`,
            cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:600,
            background:C.redDim,color:C.red,transition:"all 0.2s",justifyContent:sidebarCollapsed?"center":"flex-start",
          }}>
            <Ic d={I.logout} s={14} c={C.red} />
            {!sidebarCollapsed && "تسجيل الخروج"}
          </button>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex:1,marginRight:W,padding:"28px 30px",minHeight:"100vh",overflowY:"auto",transition:"margin-right 0.25s cubic-bezier(0.4,0,0.2,1)" }}>
        {renderPage()}
      </div>
    </div>
  );
}
// ─── TAX REPORTS PAGE ────────────────────────────────────────────────────────
function TaxReportsPage({ data }) {
  const [taxRules, setTaxRules] = useState(() => {
    try { return JSON.parse(localStorage.getItem("tax_rules_local")||"[]"); } catch { return []; }
  });
  const [monthlyTaxReports, setMonthlyTaxReports] = useState(() => {
    try { return JSON.parse(localStorage.getItem("monthly_tax_reports")||"[]"); } catch { return []; }
  });
  const [selectedMonth, setSelectedMonth] = useState(today().slice(0,7));
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [activeTab, setActiveTab] = useState("summary"); // summary | rules | archive
  const [ruleForm, setRuleForm] = useState({
    name:"", type:"نسبة مبيعات", rate:"", fixedAmount:"", base:"إجمالي المبيعات",
    category:"", notes:"", entityType:"شركة", frequency:"شهري"
  });

  const taxTypes = [
    { value:"نسبة مبيعات", label:"نسبة من المبيعات %" },
    { value:"نسبة أرباح", label:"نسبة من صافي الربح %" },
    { value:"قيمة مضافة", label:"ضريبة القيمة المضافة % (ع.ق)" },
    { value:"دمغة", label:"ضريبة دمغة %" },
    { value:"دخل", label:"ضريبة دخل %" },
    { value:"عقارات", label:"ضريبة عقارات %" },
    { value:"زراعية", label:"رسوم زراعية %" },
    { value:"صناعية", label:"رسوم صناعية %" },
    { value:"ثابتة شهرية", label:"رسم ثابت شهري (ج.م)" },
    { value:"جمارك", label:"رسوم جمارك %" },
  ];

  const entityTypes = ["شركة","مصنع","مزرعة","متجر","مطعم","مقاول","فردي","آخر"];

  const saveTaxRules = (list) => {
    setTaxRules(list);
    localStorage.setItem("tax_rules_local", JSON.stringify(list));
  };

  const handleSaveRule = () => {
    if (!ruleForm.name.trim()) return;
    const rec = {
      id: "TAX"+Date.now().toString().slice(-5),
      ...ruleForm,
      rate: parseFloat(ruleForm.rate)||0,
      fixedAmount: parseFloat(ruleForm.fixedAmount)||0,
      createdAt: new Date().toISOString(),
    };
    saveTaxRules([...taxRules, rec]);
    setShowRuleModal(false);
    setRuleForm({ name:"", type:"نسبة مبيعات", rate:"", fixedAmount:"", base:"إجمالي المبيعات", category:"", notes:"", entityType:"شركة", frequency:"شهري" });
  };

  const deleteRule = (id) => saveTaxRules(taxRules.filter(r=>r.id!==id));

  // Calculate taxes for selected month
  const monthSales = data.salesInvoices.filter(i=>getMonth(i.date)===selectedMonth);
  const monthPurchases = data.purchaseInvoices.filter(i=>getMonth(i.date)===selectedMonth);
  const invoiceTax = monthSales.reduce((s,i)=>s+(i.taxAmount||0),0);
  const totalSales = monthSales.reduce((s,i)=>s+i.amount,0);
  const totalPurchases = monthPurchases.reduce((s,i)=>s+i.amount,0);
  const netProfit = totalSales - totalPurchases;

  const getBase = (rule) => {
    if (rule.base==="صافي الربح") return netProfit;
    if (rule.base==="إجمالي المشتريات") return totalPurchases;
    return totalSales; // default: إجمالي المبيعات
  };

  const calcTax = (rule) => {
    if (rule.type==="ثابتة شهرية") return rule.fixedAmount||0;
    const base = getBase(rule);
    return base * (rule.rate||0) / 100;
  };

  const taxSummary = taxRules.filter(r=>r.frequency==="شهري"||r.frequency==="كل فاتورة").map(r=>({
    ...r, calculatedAmount: calcTax(r)
  }));

  const totalCustomTax = taxSummary.reduce((s,r)=>s+r.calculatedAmount,0);
  const grandTotalTax = invoiceTax + totalCustomTax;

  const allMonths = [...new Set([
    ...data.salesInvoices.map(i=>getMonth(i.date)),
    today().slice(0,7),
  ])].filter(Boolean).sort().reverse();

  const saveMonthlyTaxReport = () => {
    const report = {
      month: selectedMonth,
      closedAt: new Date().toISOString(),
      invoiceTax, totalCustomTax, grandTotalTax,
      totalSales, totalPurchases, netProfit,
      rules: taxSummary,
    };
    const updated = [...monthlyTaxReports.filter(r=>r.month!==selectedMonth), report];
    setMonthlyTaxReports(updated);
    localStorage.setItem("monthly_tax_reports", JSON.stringify(updated));
    // Print
    printTaxMonthReport(report, selectedMonth);
  };

  const printTaxMonthReport = (report, month) => {
    const [y,m] = month.split("-");
    const label = new Date(+y,+m-1,1).toLocaleDateString("ar-EG",{month:"long",year:"numeric"});
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تقرير ضريبي ${month}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo','Segoe UI',sans-serif;background:#fff;color:#1a1a2e;padding:36px 40px}
    .header{text-align:center;padding-bottom:18px;border-bottom:3px solid #f59e0b;margin-bottom:24px}
    .logo{font-size:24px;font-weight:900;color:#f59e0b}.stamp{background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:6px 18px;display:inline-block;margin-top:10px;font-size:12px;color:#92400e;font-weight:700}
    .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
    .stat{border-radius:10px;padding:14px 16px;border:1px solid #e2e8f0;text-align:center}
    .stat-v{font-size:17px;font-weight:800;font-family:monospace}.stat-l{font-size:10px;color:#64748b;margin-top:3px}
    table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px}
    thead tr{background:#f59e0b;color:#fff}thead th{padding:9px 12px;font-weight:700;text-align:right}
    tbody tr:nth-child(even){background:#fffbeb}tbody td{padding:9px 12px;border-bottom:1px solid #e2e8f0}
    .total{background:#fef3c7;font-weight:800;font-size:13px}
    .footer{margin-top:24px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px}
    @media print{body{padding:16px}}</style></head><body>
    <div class="header"><div class="logo">📊 التقرير الضريبي الشهري</div><div style="font-size:12px;color:#64748b;margin-top:4px">حسابي Pro</div>
    <div class="stamp">📅 ${label}</div></div>
    <div class="stats">
      <div class="stat"><div class="stat-v" style="color:#34d399">${report.totalSales.toLocaleString("ar-EG")} ج.م</div><div class="stat-l">إجمالي المبيعات</div></div>
      <div class="stat"><div class="stat-v" style="color:#f87171">${report.totalPurchases.toLocaleString("ar-EG")} ج.م</div><div class="stat-l">إجمالي المشتريات</div></div>
      <div class="stat"><div class="stat-v" style="color:${report.netProfit>=0?"#34d399":"#f87171"}">${report.netProfit.toLocaleString("ar-EG")} ج.م</div><div class="stat-l">صافي الربح</div></div>
    </div>
    <table><thead><tr><th>اسم الضريبة</th><th>النوع</th><th>النسبة/المبلغ</th><th>الأساس</th><th>المبلغ المحسوب</th></tr></thead><tbody>
    <tr><td>ضريبة القيمة المضافة على الفواتير</td><td>ع.ق فواتير</td><td>—</td><td>الفواتير</td><td>${report.invoiceTax.toLocaleString("ar-EG")} ج.م</td></tr>
    ${report.rules.map(r=>`<tr><td>${r.name}</td><td>${r.type}</td><td>${r.type==="ثابتة شهرية"?r.fixedAmount.toLocaleString("ar-EG")+" ج.م":r.rate+"%"}</td><td>${r.base||"—"}</td><td>${r.calculatedAmount.toLocaleString("ar-EG")} ج.م</td></tr>`).join("")}
    <tr class="total"><td colspan="4">إجمالي الضرائب المستحقة</td><td style="color:#f59e0b">${report.grandTotalTax.toLocaleString("ar-EG")} ج.م</td></tr>
    </tbody></table>
    <div class="footer">تقرير ضريبي شهري — حسابي Pro — ${new Date().toLocaleString("ar-EG")}</div></body></html>`;
    const w = window.open("","_blank");
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(()=>w.print(),500);
  };

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      <PageHeader title="التقارير الضريبية" icon={I.tax} subtitle="إدارة الضرائب الشهرية لجميع أنواع المنشآت"
        action={
          <div style={{ display:"flex",gap:8 }}>
            {activeTab==="summary" && <Btn variant="yellow" onClick={saveMonthlyTaxReport}><Ic d={I.download} s={14} />حفظ وطباعة التقرير</Btn>}
            {activeTab==="rules" && <Btn onClick={()=>setShowRuleModal(true)}><Ic d={I.plus} s={14} />إضافة ضريبة</Btn>}
          </div>
        }
      />
      {/* Tabs */}
      <div style={{ display:"flex",background:C.surface2,borderRadius:12,padding:4,border:`1px solid ${C.border}`,gap:4 }}>
        {[{id:"summary",label:"📊 ملخص الشهر"},{id:"rules",label:"⚙️ قواعد الضرائب"},{id:"archive",label:"🗂 الأرشيف"}].map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{ flex:1,background:activeTab===t.id?C.yellow:"transparent",color:activeTab===t.id?"#1a1a2e":C.textMuted,border:"none",borderRadius:9,padding:"10px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* SUMMARY TAB */}
      {activeTab==="summary" && (
        <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
          <div style={{ display:"flex",gap:10,alignItems:"center" }}>
            <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)}
              style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 14px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none" }}>
              {allMonths.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
            <MiniStat label="إجمالي المبيعات" value={fmt(totalSales)} color={C.green} icon={I.sales} />
            <MiniStat label="صافي الربح" value={fmt(netProfit)} color={netProfit>=0?C.green:C.red} icon={I.chartBar} />
            <MiniStat label="ض.ق.م الفواتير" value={fmt(invoiceTax)} color={C.yellow} icon={I.tax} />
            <MiniStat label="إجمالي الضرائب" value={fmt(grandTotalTax)} color={C.yellow} icon={I.tax} />
          </div>
          <Card style={{ padding:0 }}>
            <div style={{ padding:"12px 18px",borderBottom:`1px solid ${C.border}`,fontSize:13,fontWeight:700,color:C.text }}>تفاصيل الضرائب — {selectedMonth}</div>
            <table style={{ width:"100%",borderCollapse:"collapse" }}>
              <THead cols={["اسم الضريبة","النوع","نوع المنشأة","النسبة/المبلغ","الأساس","المبلغ المحسوب"]} />
              <tbody>
                <TRow alt={false}>
                  <TD><span style={{ fontWeight:600 }}>ضريبة القيمة المضافة (ع.ق) من الفواتير</span></TD>
                  <TD color={C.yellow}>ع.ق فواتير</TD>
                  <TD color={C.textMuted}>—</TD>
                  <TD mono color={C.yellow}>من الفواتير</TD>
                  <TD color={C.textMuted}>الفواتير</TD>
                  <TD mono color={C.yellow}><span style={{ fontWeight:700 }}>{fmt(invoiceTax)}</span></TD>
                </TRow>
                {taxSummary.map((r,i)=>(
                  <TRow key={r.id} alt={(i+1)%2}>
                    <TD><span style={{ fontWeight:600 }}>{r.name}</span></TD>
                    <TD color={C.yellow}>{r.type}</TD>
                    <TD color={C.textMuted}>{r.entityType}</TD>
                    <TD mono color={C.accent}>{r.type==="ثابتة شهرية"?fmt(r.fixedAmount):`${r.rate}%`}</TD>
                    <TD color={C.textMuted}>{r.base||"—"}</TD>
                    <TD mono color={C.yellow}><span style={{ fontWeight:700 }}>{fmt(r.calculatedAmount)}</span></TD>
                  </TRow>
                ))}
                {/* Total Row */}
                <tr style={{ background:C.yellowDim,borderTop:`2px solid ${C.yellow}44` }}>
                  <td colSpan={5} style={{ padding:"12px 14px",fontSize:14,fontWeight:800,color:C.yellow }}>إجمالي الضرائب المستحقة للشهر</td>
                  <td style={{ padding:"12px 14px",fontSize:16,fontWeight:900,color:C.yellow,fontFamily:"monospace" }}>{fmt(grandTotalTax)}</td>
                </tr>
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* RULES TAB */}
      {activeTab==="rules" && (
        <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
          <Card>
            <p style={{ margin:0,fontSize:12,color:C.textMuted,lineHeight:1.8 }}>
              قم بإضافة الضرائب والرسوم الخاصة بمنشأتك (مصنع، شركة، مزرعة، إلخ). سيتم حسابها تلقائياً كل شهر بناءً على بيانات المبيعات والأرباح.
            </p>
          </Card>
          {taxRules.length===0 ? (
            <Card style={{ textAlign:"center",padding:40 }}>
              <div style={{ color:C.textMuted,fontSize:13 }}>لم تُضف قواعد ضريبية بعد. اضغط "إضافة ضريبة" للبدء.</div>
            </Card>
          ) : (
            <Card style={{ padding:0 }}>
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <THead cols={["الاسم","النوع","نوع المنشأة","النسبة","الأساس","الدورية","ملاحظات",""]} />
                <tbody>
                  {taxRules.map((r,i)=>(
                    <TRow key={r.id} alt={i%2}>
                      <TD><span style={{ fontWeight:700 }}>{r.name}</span></TD>
                      <TD color={C.yellow}>{r.type}</TD>
                      <TD color={C.textDim}>{r.entityType}</TD>
                      <TD mono color={C.accent}>{r.type==="ثابتة شهرية"?fmt(r.fixedAmount):`${r.rate}%`}</TD>
                      <TD color={C.textMuted}>{r.base||"—"}</TD>
                      <TD color={C.textDim}>{r.frequency}</TD>
                      <TD color={C.textMuted}>{r.notes||"—"}</TD>
                      <td style={{ padding:"11px 14px" }}>
                        <button onClick={()=>deleteRule(r.id)} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted }}><Ic d={I.trash} s={14} /></button>
                      </td>
                    </TRow>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* ARCHIVE TAB */}
      {activeTab==="archive" && (
        <Card>
          <h3 style={{ margin:"0 0 16px",fontSize:15,fontWeight:700,color:C.text }}>🗂 أرشيف التقارير الضريبية الشهرية</h3>
          {monthlyTaxReports.length===0 ? (
            <div style={{ textAlign:"center",color:C.textMuted,padding:30,fontSize:13 }}>لا توجد تقارير ضريبية محفوظة بعد</div>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              {[...monthlyTaxReports].sort((a,b)=>b.month.localeCompare(a.month)).map(r=>{
                const [y,m] = r.month.split("-");
                const label = new Date(+y,+m-1,1).toLocaleDateString("ar-EG",{month:"long",year:"numeric"});
                return (
                  <div key={r.month} style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:13,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:14,fontWeight:700,color:C.text,marginBottom:5 }}>🧾 تقرير ضريبي — {label}</div>
                      <div style={{ display:"flex",gap:16 }}>
                        <span style={{ fontSize:11,color:C.yellow }}>إجمالي الضرائب: {fmt(r.grandTotalTax)}</span>
                        <span style={{ fontSize:11,color:C.green }}>مبيعات: {fmt(r.totalSales)}</span>
                        <span style={{ fontSize:11,color:r.netProfit>=0?C.green:C.red }}>ربح: {fmt(r.netProfit)}</span>
                      </div>
                      <div style={{ fontSize:10,color:C.textMuted,marginTop:4 }}>حُفظ في {fmtDateTime(r.closedAt)}</div>
                    </div>
                    <Btn variant="yellow" small onClick={()=>printTaxMonthReport(r, r.month)}>
                      <Ic d={I.download} s={13} />طباعة
                    </Btn>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Add Rule Modal */}
      {showRuleModal && (
        <Modal title="إضافة قاعدة ضريبية" onClose={()=>setShowRuleModal(false)}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <Inp label="اسم الضريبة/الرسم" value={ruleForm.name} onChange={v=>setRuleForm({...ruleForm,name:v})} required placeholder="مثال: ضريبة القيمة المضافة" />
              <Sel label="نوع المنشأة" value={ruleForm.entityType} onChange={v=>setRuleForm({...ruleForm,entityType:v})} options={entityTypes} />
              <Sel label="نوع الضريبة" value={ruleForm.type} onChange={v=>setRuleForm({...ruleForm,type:v})} options={taxTypes.map(t=>({value:t.value,label:t.label}))} />
              <Sel label="دورية الاحتساب" value={ruleForm.frequency} onChange={v=>setRuleForm({...ruleForm,frequency:v})} options={[{value:"شهري",label:"شهري"},{value:"سنوي",label:"سنوي"}]} />
              {ruleForm.type!=="ثابتة شهرية" ? (
                <>
                  <Inp label="النسبة %" type="number" value={ruleForm.rate} onChange={v=>setRuleForm({...ruleForm,rate:v})} placeholder="مثال: 14" />
                  <Sel label="الأساس" value={ruleForm.base} onChange={v=>setRuleForm({...ruleForm,base:v})} options={[{value:"إجمالي المبيعات",label:"إجمالي المبيعات"},{value:"صافي الربح",label:"صافي الربح"},{value:"إجمالي المشتريات",label:"إجمالي المشتريات"}]} />
                </>
              ) : (
                <Inp label="المبلغ الثابت (ج.م)" type="number" value={ruleForm.fixedAmount} onChange={v=>setRuleForm({...ruleForm,fixedAmount:v})} />
              )}
            </div>
            <Inp label="ملاحظات" value={ruleForm.notes} onChange={v=>setRuleForm({...ruleForm,notes:v})} placeholder="أي تفاصيل إضافية..." />
            <div style={{ background:C.yellowDim,border:`1px solid ${C.yellow}33`,borderRadius:10,padding:"10px 14px",fontSize:12,color:C.yellow }}>
              💡 سيتم احتساب هذه الضريبة تلقائياً في ملخص الشهر بناءً على بيانات الفواتير.
            </div>
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setShowRuleModal(false)}>إلغاء</Btn>
              <Btn variant="yellow" onClick={handleSaveRule}>إضافة الضريبة</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}



