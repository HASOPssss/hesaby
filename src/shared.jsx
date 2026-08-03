import { useState, useEffect, useCallback, useRef, useContext, createContext, forwardRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ══════════════════════════════════════════════════════════════════════════════
// shared.jsx
// كل المشترك بين الصفحات: Supabase client, useAppData hook, الثيم والألوان,
// الأيقونات، دوال الطباعة، ومكوّنات الواجهة العامة (Card, Btn, Modal, ...).
// أي صفحة جديدة أو منفصلة تستورد اللي محتاجاه من هنا بدل ما تكرره.
// ══════════════════════════════════════════════════════════════════════════════


// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const supabaseUrl = "https://cavzaxxfnxkzsmiratyk.supabase.co";
const supabaseKey = "sb_publishable_B6YjF_uKcUdFmX8FgiyTbQ_jZIJf-0J";
// ملحوظة أمان: بنستخدم sessionStorage بدل localStorage لتخزين جلسة الدخول،
// عشان لو المستخدم قفل التاب أو المتصفح، الجلسة تتمسح تلقائياً ويحتاج يسجل دخول
// تاني لما يفتح الموقع من جديد (بدل ما يفضل "مسجل دخول" لأيام).
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, storage: (typeof window !== "undefined" ? window.sessionStorage : undefined), autoRefreshToken: true },
});

// ─── SUPABASE ADMIN CLIENT ────────────────────────────────────────────────────
const supabaseAdmin = null;

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
  employees: [], salaries: [], attendance: [], advances: [], salaryArchive: [],
  productions: [],
  receipts: [], expenses: [],
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
        employees: [], salaries: [], attendance: [], advances: [], salaryArchive: [],
        productions: [],
        receipts: [], expenses: [],
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
          case "employees": {
            const idx = rebuilt.employees.findIndex(x => x.id === record.id);
            if (idx >= 0) rebuilt.employees[idx] = record; else rebuilt.employees.push(record); break;
          }
          case "salaries": rebuilt.salaries.push(record); break;
          case "attendance": rebuilt.attendance.push(record); break;
          case "advances": {
            const idx = rebuilt.advances.findIndex(x => x.id === record.id);
            if (idx >= 0) rebuilt.advances[idx] = record; else rebuilt.advances.push(record); break;
          }
          case "salary_archive": rebuilt.salaryArchive.push(record); break;
          case "production": {
            const idx = rebuilt.productions.findIndex(p => p.id === record.id);
            if (idx >= 0) rebuilt.productions[idx] = record; else rebuilt.productions.push(record); break;
          }
          case "receipt": {
            const idx = rebuilt.receipts.findIndex(r => r.id === record.id);
            if (idx >= 0) rebuilt.receipts[idx] = record; else rebuilt.receipts.push(record); break;
          }
          case "expense": {
            const idx = rebuilt.expenses.findIndex(e => e.id === record.id);
            if (idx >= 0) rebuilt.expenses[idx] = record; else rebuilt.expenses.push(record); break;
          }
          default: break;
        }
      });
      setData(rebuilt);
    } catch (e) { console.error("loadData error:", e.message); setError(e.message); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { if (userId) loadData(); else setData(EMPTY_STATE); }, [userId, loadData]);

  // ─── Realtime: أي تغيير في بيانات الشركة (فواتير، عملاء، موردين، مخزون، موظفين...) ───
  // يوصل لكل المستخدمين المتصلين لحظيًا من غير ما يحتاجوا Refresh.
  // بنأخّر إعادة الجلب شوية (Debounce) عشان منتسابقش مع التحديث المحلي الفوري
  // اللي بيحصل لحظة إضافة/تعديل أي حاجة (عشان مايحصلش وميض أو اختفاء العنصر
  // المضاف لسه).
  useEffect(() => {
    if (!userId) return;
    let debounceTimer = null;
    const channel = supabase
      .channel(`records-changes-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "records", filter: `user_id=eq.${userId}` }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => { loadData(); }, 700);
      })
      .subscribe();
    return () => { clearTimeout(debounceTimer); try { supabase.removeChannel(channel); } catch {} };
  }, [userId, loadData]);

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
    updateSale: async (invoice) => {
      const record = { ...invoice, type: "sale" };
      for (const item of (invoice.items || [])) if (item.category) await ensureCategory(item.category);
      await saveData("sales", record);
      setData(prev => ({ ...prev, salesInvoices: prev.salesInvoices.map(i => i.id === invoice.id ? record : i) }));
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
    updatePurchase: async (invoice) => {
      const record = { ...invoice, type: "purchase" };
      for (const item of (invoice.items || [])) if (item.category) await ensureCategory(item.category);
      await saveData("purchases", record);
      setData(prev => ({ ...prev, purchaseInvoices: prev.purchaseInvoices.map(i => i.id === invoice.id ? record : i) }));
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
    deleteCategory: async (name) => {
      setData(prev => {
        const cat = prev.categories.find(c => normalizeArabic(c) === normalizeArabic(name));
        if (!cat) return prev;
        // Delete from supabase records table (category type)
        supabase.from("records").select("id, data").eq("user_id", userId).eq("table_name", "categories").then(({data: rows}) => {
          if (rows) {
            const match = rows.find(r => r.data && normalizeArabic(r.data.name) === normalizeArabic(name));
            if (match) deleteRecord(match.id);
          }
        });
        return { ...prev, categories: prev.categories.filter(c => normalizeArabic(c) !== normalizeArabic(name)) };
      });
    },

    // ── الموظفين والمرتبات (مخزّنة في نفس جدول records — مش localStorage) ──
    addEmployee: async (emp) => {
      const record = { ...emp, type: "employees" };
      await saveData("employees", record);
      setData(prev => ({ ...prev, employees: [...prev.employees, record] }));
    },
    updateEmployee: async (emp) => {
      const record = { ...emp, type: "employees" };
      await saveData("employees", record);
      setData(prev => ({ ...prev, employees: prev.employees.map(e => e.id === emp.id ? record : e) }));
    },
    deleteEmployee: async (id) => {
      await deleteRecord(id);
      setData(prev => ({ ...prev, employees: prev.employees.filter(e => e.id !== id) }));
    },
    addSalary: async (sal) => {
      const record = { ...sal, type: "salaries" };
      await saveData("salaries", record);
      setData(prev => ({ ...prev, salaries: [...prev.salaries, record] }));
    },
    deleteSalary: async (id) => {
      await deleteRecord(id);
      setData(prev => ({ ...prev, salaries: prev.salaries.filter(s => s.id !== id) }));
    },
    addAttendance: async (att) => {
      const record = { ...att, type: "attendance" };
      await saveData("attendance", record);
      setData(prev => ({ ...prev, attendance: [...prev.attendance, record] }));
    },
    updateAttendance: async (att) => {
      const record = { ...att, type: "attendance" };
      await saveData("attendance", record);
      setData(prev => ({ ...prev, attendance: prev.attendance.map(a => a.id === att.id ? record : a) }));
    },
    deleteAttendance: async (id) => {
      await deleteRecord(id);
      setData(prev => ({ ...prev, attendance: prev.attendance.filter(a => a.id !== id) }));
    },
    addAdvance: async (adv) => {
      const record = { ...adv, type: "advances" };
      await saveData("advances", record);
      setData(prev => ({ ...prev, advances: [...prev.advances, record] }));
    },
    updateAdvance: async (adv) => {
      const record = { ...adv, type: "advances" };
      await saveData("advances", record);
      setData(prev => ({ ...prev, advances: prev.advances.map(a => a.id === adv.id ? record : a) }));
    },
    deleteAdvance: async (id) => {
      await deleteRecord(id);
      setData(prev => ({ ...prev, advances: prev.advances.filter(a => a.id !== id) }));
    },
    // أرشفة شهر: بتحفظ نسخة كاملة (سناب شوت) وتشيل السجلات النشطة بتاعت الشهر ده
    archiveSalaryMonth: async (archiveRecord, monthSalaryIds, monthAttendanceIds, monthAdvanceIds) => {
      const record = { ...archiveRecord, type: "salary_archive" };
      await saveData("salary_archive", record);
      for (const id of monthSalaryIds) await deleteRecord(id);
      for (const id of monthAttendanceIds) await deleteRecord(id);
      for (const id of monthAdvanceIds) await deleteRecord(id);
      setData(prev => ({
        ...prev,
        salaryArchive: [...prev.salaryArchive, record],
        salaries: prev.salaries.filter(s => !monthSalaryIds.includes(s.id)),
        attendance: prev.attendance.filter(a => !monthAttendanceIds.includes(a.id)),
        advances: prev.advances.filter(a => !monthAdvanceIds.includes(a.id)),
      }));
    },
    deleteSalaryArchive: async (id) => {
      await deleteRecord(id);
      setData(prev => ({ ...prev, salaryArchive: prev.salaryArchive.filter(a => a.id !== id) }));
    },

    // ── عمليات الإنتاج (Production Orders) — مسودة/معتمد ──
    // ملحوظة: التأثير الفعلي على المخزون (خصم المواد الخام + إضافة المنتج +
    // سجل المخزون + سجل النشاط) بيحصل من صفحة الإنتاج نفسها وقت الاعتماد
    // (بتستخدم updateInventoryItem + logInventoryMovement + logActivity)،
    // مش هنا — عشان دي مجرد حفظ/تحديث/حذف لسجل عملية الإنتاج ذاته.
    addProduction: async (prod) => {
      const record = { ...prod, type: "production" };
      await saveData("production", record);
      setData(prev => ({ ...prev, productions: [...prev.productions, record] }));
    },
    updateProduction: async (prod) => {
      const record = { ...prod, type: "production" };
      await saveData("production", record);
      setData(prev => ({ ...prev, productions: prev.productions.map(p => p.id === prod.id ? record : p) }));
    },
    deleteProduction: async (id) => {
      await deleteRecord(id);
      setData(prev => ({ ...prev, productions: prev.productions.filter(p => p.id !== id) }));
    },

    // ── المقبوضات (Receipts) ──
    addReceipt: async (rec) => {
      const record = { ...rec, type: "receipt" };
      await saveData("receipt", record);
      setData(prev => ({ ...prev, receipts: [record, ...prev.receipts] }));
    },
    updateReceipt: async (rec) => {
      const record = { ...rec, type: "receipt" };
      await saveData("receipt", record);
      setData(prev => ({ ...prev, receipts: prev.receipts.map(r => r.id === rec.id ? record : r) }));
    },
    deleteReceipt: async (id) => {
      await deleteRecord(id);
      setData(prev => ({ ...prev, receipts: prev.receipts.filter(r => r.id !== id) }));
    },

    // ── المصروفات (Expenses) ──
    addExpense: async (exp) => {
      const record = { ...exp, type: "expense" };
      await saveData("expense", record);
      setData(prev => ({ ...prev, expenses: [...prev.expenses, record] }));
    },
    updateExpense: async (exp) => {
      const record = { ...exp, type: "expense" };
      await saveData("expense", record);
      setData(prev => ({ ...prev, expenses: prev.expenses.map(e => e.id === exp.id ? record : e) }));
    },
    deleteExpense: async (id) => {
      await deleteRecord(id);
      setData(prev => ({ ...prev, expenses: prev.expenses.filter(e => e.id !== id) }));
    },
    // استرداد أرشيف: بترجع السجلات المحفوظة للقوائم النشطة وتمسح سجل الأرشيف
    restoreSalaryArchive: async (archiveId, salariesToRestore, attendanceToRestore, advancesToRestore) => {
      for (const s of salariesToRestore) await saveData("salaries", { ...s, type: "salaries" });
      for (const a of attendanceToRestore) await saveData("attendance", { ...a, type: "attendance" });
      for (const a of advancesToRestore) await saveData("advances", { ...a, type: "advances" });
      await deleteRecord(archiveId);
      setData(prev => ({
        ...prev,
        salaries: [...prev.salaries, ...salariesToRestore],
        attendance: [...prev.attendance, ...attendanceToRestore],
        advances: [...prev.advances, ...advancesToRestore],
        salaryArchive: prev.salaryArchive.filter(a => a.id !== archiveId),
      }));
    },
  };

  return { data, setData, loading, error, saveData, actions, loadData };
}

// ─── THEME ────────────────────────────────────────────────────────────────────
const DARK_THEME = {
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
const LIGHT_THEME = {
  bg: "#f0f4ff", surface: "#ffffff", surface2: "#f1f5fd", surface3: "#e6eaf5",
  border: "#d1d9ef", borderLight: "#c0cce8",
  accent: "#4f5ef7", accentDim: "rgba(79,94,247,0.1)", accentGlow: "rgba(79,94,247,0.25)",
  green: "#10b981", greenDim: "rgba(16,185,129,0.1)",
  red: "#ef4444", redDim: "rgba(239,68,68,0.1)",
  yellow: "#d97706", yellowDim: "rgba(217,119,6,0.1)",
  blue: "#2563eb", blueDim: "rgba(37,99,235,0.1)",
  purple: "#7c3aed", purpleDim: "rgba(124,58,237,0.1)",
  cyan: "#0891b2", cyanDim: "rgba(8,145,178,0.1)",
  text: "#1e293b", textMuted: "#94a3b8", textDim: "#475569",
};

let _currentTheme = (() => { try { return localStorage.getItem("app_theme")||"dark"; } catch { return "dark"; } })();
let C = _currentTheme === "light" ? LIGHT_THEME : DARK_THEME;
let _themeListeners = [];
function subscribeTheme(fn) { _themeListeners.push(fn); return () => { _themeListeners = _themeListeners.filter(f=>f!==fn); }; }
function setAppTheme(t) {
  _currentTheme = t;
  C = t === "light" ? LIGHT_THEME : DARK_THEME;
  try { localStorage.setItem("app_theme", t); } catch {}
  _themeListeners.forEach(fn => fn(t));
}
function useTheme() {
  const [theme, setTheme] = useState(_currentTheme);
  useEffect(() => {
    C = _currentTheme === "light" ? LIGHT_THEME : DARK_THEME;
    return subscribeTheme(t => {
      C = t === "light" ? LIGHT_THEME : DARK_THEME;
      setTheme(t);
    });
  }, []);
  return [theme, setAppTheme];
}

// ─── MOBILE DETECTION (لتصميم الموبايل) ───────────────────────────────────────
// بيتابع عرض الشاشة عن طريق matchMedia (خفيف جداً وما بيعملش أي طلبات شبكة أو
// إعادة تحميل بيانات — بس بيغيّر شكل الواجهة).
function useIsMobile(breakpoint = 860) {
  const [isMobile, setIsMobile] = useState(() => {
    try { return window.innerWidth <= breakpoint; } catch { return false; }
  });
  useEffect(() => {
    let mq;
    try { mq = window.matchMedia(`(max-width: ${breakpoint}px)`); } catch { return; }
    const handler = (e) => setIsMobile(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, [breakpoint]);
  return isMobile;
}

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
  keyboard: "M2 6a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8",
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
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
  bell: "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
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

// ─── PRINT HELPER ─────────────────────────────────────────────────────────────
// window.open triggers pagehide on the parent → React freezes / signs out.
// Fix: use a hidden iframe inside the same page instead.
const openPrint = (html) => {
  const existingFrame = document.getElementById("__print_frame__");
  if (existingFrame) existingFrame.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "__print_frame__";
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow.focus();
  iframe.contentWindow.print();

  // نشيل الـ iframe بعد ما الطباعة تخلص
  setTimeout(() => { if (iframe.parentNode) iframe.remove(); }, 2000);
};

// ─── PRINT INVOICE ────────────────────────────────────────────────────────────
const getCompanyBranding = () => {
  try {
    // Try sessionStorage first (set at login), fallback to localStorage
    const uid = sessionStorage.getItem("company_uid") || localStorage.getItem("company_uid_persist") || "";
    const name = sessionStorage.getItem("company_display_name") || localStorage.getItem("company_name_persist_" + uid) || "حسابي Pro";
    const logo = localStorage.getItem("company_logo_" + uid) || "";
    return { name, logo };
  } catch { return { name:"حسابي Pro", logo:"" }; }
};

const printInvoice = (inv, type) => {
  const { name: companyName, logo: companyLogo } = getCompanyBranding();
  const party = type === "sales" ? inv.client : inv.supplier;
  const partyLabel = type === "sales" ? "العميل" : "المورد";
  const title = type === "sales" ? "فاتورة مبيعات" : "فاتورة مشتريات";
  const logoHtml = companyLogo ? `<img src="${companyLogo}" style="width:60px;height:60px;object-fit:cover;border-radius:10px;margin-left:12px" />` : "";
  const printDateTime = new Date().toLocaleString("ar-EG", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
  const invDateTime = inv.createdAt ? new Date(inv.createdAt).toLocaleString("ar-EG", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" }) : inv.date;
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${title}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo','Segoe UI',sans-serif;background:#fff;color:#1a1a2e;padding:40px}
  .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #6c7fff}
  .company-info{display:flex;align-items:center}.company{font-size:24px;font-weight:800;color:#6c7fff}.invoice-num{font-size:20px;font-weight:800}
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
  .pay-table{margin-top:10px}.pay-table thead tr{background:#94a3b8}
  .status-banner{margin-top:20px;text-align:center;padding:14px;border-radius:10px;font-size:15px;font-weight:800}
  .status-paid{background:#ecfdf5;color:#16a34a;border:1px solid #86efac}
  .status-unpaid{background:#fef2f2;color:#dc2626;border:1px solid #fca5a5}
  @media print{body{padding:20px}}</style></head><body>
  <div class="header">
    <div class="company-info">${logoHtml}<div><div class="company">${companyName}</div></div></div>
    <div><div style="font-size:13px;color:#64748b">${title}</div><div class="invoice-num">${inv.id}</div><span class="badge">${inv.status}</span></div>
  </div>
  <div class="info-grid"><div class="info-box"><div class="info-label">${partyLabel}</div><div class="info-value">${party}</div></div>
  <div class="info-box"><div class="info-label">تاريخ ووقت الفاتورة</div><div class="info-value">${invDateTime}</div></div>
  ${inv.paymentMethod?`<div class="info-box"><div class="info-label">طريقة الدفع</div><div class="info-value">${inv.paymentMethod}${inv.checkNumber?" — شيك رقم "+inv.checkNumber:""}</div></div>`:""}
  ${inv.notes?`<div class="info-box"><div class="info-label">ملاحظات</div><div class="info-value" style="font-size:13px">${inv.notes}</div></div>`:""}
  </div>
  <table><thead><tr><th>الصنف</th><th>الفئة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>
  ${(inv.items||[]).map(it=>`<tr><td>${it.name||"—"}</td><td>${it.category||"—"}</td><td>${it.qty}</td><td>${(it.price||0).toLocaleString("ar-EG")} ج.م</td><td>${((it.qty||0)*(it.price||0)).toLocaleString("ar-EG")} ج.م</td></tr>`).join("")}
  </tbody></table>
  <div class="totals">
  <div class="total-row"><span>قبل الضريبة</span><span>${(inv.subtotal||inv.amount).toLocaleString("ar-EG")} ج.م</span></div>
  <div class="total-row"><span>ضريبة ${inv.taxRate||0}%</span><span>${(inv.taxAmount||0).toLocaleString("ar-EG")} ج.م</span></div>
  <div class="total-row"><span>المدفوع</span><span>${(inv.paid||0).toLocaleString("ar-EG")} ج.م</span></div>
  <div class="total-row"><span>المتبقي</span><span>${(inv.amount-inv.paid).toLocaleString("ar-EG")} ج.م</span></div>
  <div class="total-row main"><span>الإجمالي الكلي</span><span>${inv.amount.toLocaleString("ar-EG")} ج.م</span></div></div>
  ${(inv.payments&&inv.payments.length>0)?`
  <div style="font-size:14px;font-weight:800;margin:24px 0 10px">سجل الدفعات</div>
  <table class="pay-table"><thead><tr><th>#</th><th>قيمة الدفعة</th><th>التاريخ</th><th>الوقت</th><th>سجلها</th></tr></thead><tbody>
  ${inv.payments.map((p,idx)=>`<tr><td>${idx+1}</td><td>${(p.amount||0).toLocaleString("ar-EG")} ج.م</td><td>${p.date||"—"}</td><td>${p.time||"—"}</td><td>${p.by||"—"}</td></tr>`).join("")}
  </tbody></table>`:""}
  <div class="status-banner ${(inv.paid>=inv.amount)?"status-paid":"status-unpaid"}">
  ${(inv.paid>=inv.amount)?`✅ تم السداد بالكامل${inv.paidCompletedAt?" بتاريخ "+new Date(inv.paidCompletedAt).toLocaleString("ar-EG",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}):""}`:`⚠️ لم يتم السداد بالكامل — المتبقي ${(inv.amount-(inv.paid||0)).toLocaleString("ar-EG")} ج.م`}
  </div>
  <div class="footer">${companyName} — طُبعت بتاريخ ${printDateTime} — hesapy.pro</div>
  </body></html>`;
  openPrint(html);
};

// ─── PRINT TAX INVOICE ────────────────────────────────────────────────────────
const printTaxInvoice = (inv) => {
  const { name: companyName, logo: companyLogo } = getCompanyBranding();
  const logoHtml = companyLogo ? `<img src="${companyLogo}" style="width:50px;height:50px;object-fit:cover;border-radius:8px;margin:0 auto 8px;display:block" />` : "";
  const printDateTime = new Date().toLocaleString("ar-EG", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
  const invDateTime = inv.createdAt ? new Date(inv.createdAt).toLocaleString("ar-EG", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" }) : inv.date;
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
  <div class="header">${logoHtml}<div class="title">${companyName}</div><div class="subtitle">⚖️ فاتورة ضريبية رسمية</div>
  <div style="font-size:13px;color:#64748b;margin-top:6px">رقم الفاتورة: <strong>${inv.id}</strong></div><span class="badge">${inv.status}</span></div>
  <div class="info-grid">
  <div class="info-box"><div class="info-label">العميل / المورد</div><div class="info-value">${inv.client||inv.supplier||"—"}</div></div>
  <div class="info-box"><div class="info-label">تاريخ ووقت الفاتورة</div><div class="info-value">${invDateTime}</div></div>
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
  <div class="tax-note">📋 هذه فاتورة ضريبية رسمية تشمل ضريبة القيمة المضافة وفقاً للتشريعات المعمول بها.</div>
  <div class="footer">${companyName} — طُبعت بتاريخ ${printDateTime} — hesapy.pro</div></body></html>`;
  openPrint(html);
};

// ─── PRINT STOCKTAKE REPORT ───────────────────────────────────────────────────
const printStocktakeReport = (inventory, period, selectedMonth) => {
  const { name: companyName, logo: companyLogo } = getCompanyBranding();
  const logoHtml = companyLogo ? `<img src="${companyLogo}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;margin-left:10px" />` : "";
  const totalCostVal = inventory.reduce((s, p) => s + p.qty * p.cost, 0);
  const totalSaleVal = inventory.reduce((s, p) => s + p.qty * p.price, 0);
  const lowItems = inventory.filter(p => p.qty <= p.minQty);
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تقرير الجرد</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo','Segoe UI',sans-serif;background:#fff;color:#1a1a2e;padding:40px}
  .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #34d399}
  .co-info{display:flex;align-items:center}
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
  <div class="header">
    <div class="co-info">${logoHtml}<div><div style="font-size:22px;font-weight:800">تقرير الجرد الدوري</div>
    <div style="font-size:13px;color:#64748b;margin-top:4px">${period==="monthly"?"جرد شهري":"جرد أسبوعي"} — ${selectedMonth}</div></div></div>
    <div style="text-align:left"><div style="font-size:14px;font-weight:700;color:#34d399">${companyName}</div><div style="font-size:13px;color:#64748b;margin-top:2px">${new Date().toLocaleDateString("ar-EG")}</div></div>
  </div>
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
  <div class="footer">تقرير الجرد — ${companyName} — ${new Date().toLocaleString("ar-EG",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})} — hesapy.pro</div></body></html>`;
  openPrint(html);
};

// ─── PRINT STOCKTAKE UPDATE REPORT (بعد رفع إكسيل جرد جديد) ──────────────────
const printStocktakeUpdateReport = (comparison) => {
  const { name: companyName, logo: companyLogo } = getCompanyBranding();
  const logoHtml = companyLogo ? `<img src="${companyLogo}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;margin-left:10px" />` : "";
  const { updated=[], added=[], notCounted=[], shortages=[], lossValue=0, gainValue=0, by="" } = comparison;
  const changedOnly = updated.filter(u => u.diff !== 0);
  const printDateTime = new Date().toLocaleString("ar-EG", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تقرير تحديث الجرد</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo','Segoe UI',sans-serif;background:#fff;color:#1a1a2e;padding:40px}
  .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #6c7fff}
  .co-info{display:flex;align-items:center}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
  .stat{background:#f8faff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center}
  .stat-val{font-size:18px;font-weight:800}.stat-lbl{font-size:11px;color:#64748b;margin-top:4px}
  table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12px}thead tr{background:#6c7fff;color:#fff}
  thead th{padding:8px 12px;font-weight:700;text-align:right}tbody tr:nth-child(even){background:#f8faff}
  tbody td{padding:8px 12px;border-bottom:1px solid #e2e8f0}.up{color:#16a34a;font-weight:700}.down{color:#ef4444;font-weight:700}
  .section-title{font-size:15px;font-weight:800;margin:22px 0 10px}
  .new-badge{display:inline-block;background:#ecfdf5;color:#16a34a;border:1px solid #86efac;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700}
  .missing-badge{display:inline-block;background:#fff7ed;color:#c2410c;border:1px solid #fdba74;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700}
  .shortage{background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:10px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center}
  .footer{margin-top:30px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}
  @media print{body{padding:20px}}</style></head><body>
  <div class="header">
    <div class="co-info">${logoHtml}<div><div style="font-size:22px;font-weight:800">تقرير تحديث الجرد</div>
    <div style="font-size:13px;color:#64748b;margin-top:4px">تحديث بواسطة إكسيل${by?" — "+by:""}</div></div></div>
    <div style="text-align:left"><div style="font-size:14px;font-weight:700;color:#6c7fff">${companyName}</div><div style="font-size:13px;color:#64748b;margin-top:2px">${new Date().toLocaleDateString("ar-EG")}</div></div>
  </div>
  <div class="stats">
  <div class="stat"><div class="stat-val" style="color:#16a34a">${added.length}</div><div class="stat-lbl">أصناف جديدة</div></div>
  <div class="stat"><div class="stat-val" style="color:#6c7fff">${changedOnly.length}</div><div class="stat-lbl">أصناف تغيرت كميتها</div></div>
  <div class="stat"><div class="stat-val" style="color:#c2410c">${notCounted.length}</div><div class="stat-lbl">أصناف لم تُجرد</div></div>
  <div class="stat"><div class="stat-val" style="color:#ef4444">${lossValue.toLocaleString("ar-EG")} ج.م</div><div class="stat-lbl">قيمة العجز/الفاقد</div></div></div>

  ${shortages.length>0?`<div class="section-title">⚠️ النواقص (تحتاج إعادة طلب)</div>
  ${shortages.map(p=>`<div class="shortage"><div><strong>${p.name}</strong> — ${p.category||""}</div><div>الموجود: <span class="down">${p.qty} ${p.unit||""}</span> | الحد الأدنى: ${p.minQty} | <strong>النقص: ${Math.max(0,p.minQty-p.qty)} ${p.unit||""}</strong></div></div>`).join("")}`:""}

  ${changedOnly.length>0?`<div class="section-title">🔄 الأصناف اللي اتغيرت كميتها</div>
  <table><thead><tr><th>الصنف</th><th>الفئة</th><th>الكمية القديمة</th><th>الكمية الجديدة</th><th>الفرق</th><th>قيمة الفرق</th></tr></thead><tbody>
  ${changedOnly.map(u=>`<tr><td>${u.name}</td><td>${u.category||"—"}</td><td>${u.oldQty} ${u.unit||""}</td><td>${u.newQty} ${u.unit||""}</td><td class="${u.diff<0?"down":"up"}">${u.diff>0?"+":""}${u.diff} ${u.unit||""}</td><td class="${u.diff<0?"down":"up"}">${(u.diff*(u.cost||0)).toLocaleString("ar-EG")} ج.م</td></tr>`).join("")}
  </tbody></table>`:""}

  ${added.length>0?`<div class="section-title">🆕 منتجات جديدة اتضافت</div>
  <table><thead><tr><th>الصنف</th><th>الفئة</th><th>الكمية</th><th>سعر التكلفة</th><th>سعر البيع</th></tr></thead><tbody>
  ${added.map(p=>`<tr><td>${p.name} <span class="new-badge">جديد</span></td><td>${p.category||"—"}</td><td>${p.qty} ${p.unit||""}</td><td>${(p.cost||0).toLocaleString("ar-EG")} ج.م</td><td>${(p.price||0).toLocaleString("ar-EG")} ج.م</td></tr>`).join("")}
  </tbody></table>`:""}

  ${notCounted.length>0?`<div class="section-title">❔ أصناف موجودة في المخزون ولم تُجرد هذه المرة</div>
  <table><thead><tr><th>الصنف</th><th>الفئة</th><th>الكمية المسجلة (لم تتغير)</th></tr></thead><tbody>
  ${notCounted.map(p=>`<tr><td>${p.name} <span class="missing-badge">لم يُجرد</span></td><td>${p.category||"—"}</td><td>${p.oldQty} ${p.unit||""}</td></tr>`).join("")}
  </tbody></table>`:""}

  <div class="footer">تقرير تحديث الجرد — ${companyName} — آخر تحديث: ${printDateTime} — hesapy.pro</div></body></html>`;
  openPrint(html);
};

// ─── PRINT FINANCIAL REPORT ───────────────────────────────────────────────────
const printFinancialReport = (data, period, selectedMonth) => {
  const { name: companyName, logo: companyLogo } = getCompanyBranding();
  const logoHtml = companyLogo ? `<img src="${companyLogo}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;margin-left:10px;vertical-align:middle" />` : "";
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
  <div class="header">${logoHtml}<div class="title">${companyName}</div>
  <div style="font-size:16px;font-weight:700;color:#1a1a2e;margin-top:6px">التقرير المالي ${period==="monthly"?"الشهري":"اليومي"}</div>
  <div style="font-size:13px;color:#64748b;margin-top:4px">الفترة: ${selectedMonth} — طُبع: ${new Date().toLocaleString("ar-EG",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}</div></div>
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
  <div class="footer">التقرير المالي — ${companyName} — ${new Date().toLocaleString("ar-EG",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})} — hesapy.pro</div></body></html>`;
  openPrint(html);
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

// ─── جلسة واحدة بس للموظفين (Sub Users) — حساب الشركة نفسه مش خاضع لها ────────
// حساب الشركة (profiles) يقدر يسجّل دخول من أي عدد أجهزة من غير أي تتبع جلسات
// وبدون أي رسائل أو تسجيل خروج تلقائي بسبب جهاز تاني — عشان استقرار النظام.
//
// أما الموظفين (sub_users) فميزة "جهاز واحد بس" لسه شغالة، لكن بمنطق "استحواذ"
// بسيط وموثوق بدل منطق "رفض لو الجلسة القديمة لسه نشطة": أي تسجيل دخول جديد
// بنفس حساب الموظف بينجح فورًا ويكتب معرّف جلسة جديد على الصف، والجهاز القديم
// بيكتشف إن معرّف الجلسة اتغيّر (عن طريق Realtime وكـ fallback عن طريق نبضة كل
// 10 ثواني) ويتم تسجيل خروجه فورًا برسالة واضحة. مفيش مفهوم "جلسة قديمة عالقة"
// خالص في المنطق ده — أي دخول جديد بيكتب فوق القديم مباشرة.
const generateSessionId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// يسجّل جلسة جديدة للموظف (يستخدم فقط مع جدول sub_users). بيرجع دايمًا
// { allowed: true, sessionId } — مفيش رفض؛ أي دخول جديد بياخد الجلسة فورًا.
const claimSession = async (table, id) => {
  const sessionId = generateSessionId();
  try {
    await supabase.from(table).update({ active_session_id: sessionId, active_session_at: new Date().toISOString() }).eq("id", id);
  } catch { /* لو الأعمدة مش موجودة لسه أو حصل خطأ، منمنعش المستخدم من الدخول */ }
  return { allowed: true, sessionId };
};

// نبضة دورية (fallback على الـ Realtime): بتتأكد إن الجلسة لسه بتاعتنا.
// لو معرّف الجلسة على السيرفر اتغيّر لحاجة تانية (يعني حد دخل من جهاز تاني)،
// بترجع stillValid:false عشان الجهاز ده يتسجل خروجه فورًا.
const heartbeatSession = async (table, id, sessionId) => {
  try {
    const { data } = await supabase.from(table).select("active_session_id").eq("id", id).single();
    if (data?.active_session_id && data.active_session_id !== sessionId) {
      return { stillValid: false };
    }
    await supabase.from(table).update({ active_session_at: new Date().toISOString() }).eq("id", id);
    return { stillValid: true };
  } catch {
    return { stillValid: true };
  }
};

// تحرير الجلسة عند تسجيل الخروج — بس لو لسه هي جلستنا (حماية من تعارض التوقيت).
// كده أي "جلسة معلقة" بتتصفر فورًا لحظة الخروج الصريح، ومفيش أي بقايا.
const releaseSession = (table, id, sessionId) => {
  try { supabase.from(table).update({ active_session_id: null, active_session_at: null }).eq("id", id).eq("active_session_id", sessionId).then(()=>{}); } catch {}
};


// الباسكود بتاع الشركة بيتخزن في sessionStorage بعد جلبه من الداتابيز عند الدخول
// (مش عن طريق تسجيل دخول Supabase — عشان يشتغل مع المستخدمين الفرعيين برضو
// اللي مفيهمش حساب Supabase حقيقي أصلاً).
const getCachedPasscode = () => { try { return sessionStorage.getItem("security_passcode_cache") || ""; } catch { return ""; } };
const setCachedPasscode = (val) => { try { if (val) sessionStorage.setItem("security_passcode_cache", val); else sessionStorage.removeItem("security_passcode_cache"); } catch {} };

// ─── PASSCODE (رمز حماية مستقل عن كلمة مرور تسجيل الدخول) ────────────────────
function PasscodeDialog({ onConfirm, onCancel, title = "أدخل رمز الحماية (Passcode)" }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  // Esc تقفل أي نافذة منبثقة في النظام — الديالوج ده جزء منها
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const handleVerify = () => {
    const cached = getCachedPasscode();
    if (!cached) { setErr("لم يتم ضبط رمز حماية لهذه الشركة بعد. من فضلك اضبطه من إعدادات الشركة أولاً."); return; }
    if (!code) { setErr("أدخل رمز الحماية"); return; }
    if (code !== cached) { setErr("رمز الحماية غير صحيح"); return; }
    onConfirm();
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:3000 }}>
      <div style={{ background:C.surface,border:`1px solid ${C.accent}33`,borderRadius:18,padding:"28px 32px",maxWidth:360,width:"90%",boxShadow:`0 0 60px ${C.accent}22` }}>
        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:18 }}>
          <div style={{ background:C.accentDim,padding:10,borderRadius:10 }}><Ic d={I.shield} s={20} c={C.accent} /></div>
          <h3 style={{ margin:0,fontSize:15,fontWeight:700,color:C.text }}>{title}</h3>
        </div>
        <p style={{ margin:"0 0 16px",fontSize:12,color:C.textMuted,lineHeight:1.7 }}>هذه العملية حساسة وتتطلب رمز الحماية الخاص بالشركة (مش كلمة مرور حسابك).</p>
        <input type="password" value={code} onChange={e=>setCode(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&handleVerify()}
          placeholder="••••••" inputMode="numeric"
          style={{ width:"100%",background:C.bg,border:`1px solid ${err?C.red:C.border}`,borderRadius:8,padding:"10px 14px",color:C.text,fontSize:16,fontFamily:"inherit",outline:"none",boxSizing:"border-box",direction:"ltr",textAlign:"center",letterSpacing:4 }}
        />
        {err && <div style={{ color:C.red,fontSize:12,marginTop:6 }}>{err}</div>}
        <div style={{ display:"flex",gap:10,marginTop:18,justifyContent:"flex-end" }}>
          <button onClick={onCancel} style={{ background:C.surface2,color:C.textDim,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 20px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>إلغاء</button>
          <button onClick={handleVerify} style={{ background:C.accent,color:"#fff",border:"none",borderRadius:8,padding:"9px 20px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>تأكيد</button>
        </div>
      </div>
    </div>
  );
}

// ─── AUDIT LOG (سجل النشاط) ───────────────────────────────────────────────────
// بنسجل أي عملية مهمة (إضافة/تعديل/حذف/سداد/دخول/خروج...) في جدول audit_log.
// العملية دي "fire and forget" — لو فشلت (مثلاً الجدول مش موجود) الأكشن
// الأساسي مايتأثرش. before/after بيتسجلوا كـ JSON عشان تقدر ترجع للقيم القديمة.
const logActivity = async (ownerId, { userName, fullName, actionType, section, target, before, after }) => {
  try {
    await supabase.from("audit_log").insert({
      owner_id: ownerId,
      user_name: userName || "",
      full_name: fullName || userName || "",
      action_type: actionType || "",
      section: section || "",
      target: target || "",
      before_values: before ? JSON.stringify(before) : null,
      after_values: after ? JSON.stringify(after) : null,
      created_at: new Date().toISOString(),
    });
  } catch { /* تجاهل أي خطأ عشان ميوقفش العملية الأساسية */ }
};

// ─── سجل المخزون (Inventory Log) ──────────────────────────────────────────────
// بنسجل أي حركة دخول/خروج من المخزن في جدول inventory_log مستقل عن سجل النشاط
// العام، عشان يبقى فيه تتبع دقيق لكل حركة صنف بمفرده.
const logInventoryMovement = async (ownerId, { itemId, itemName, movementType, qty, balanceBefore, balanceAfter, reason, notes, userName, fullName }) => {
  try {
    await supabase.from("inventory_log").insert({
      owner_id: ownerId,
      item_id: itemId || "",
      item_name: itemName || "",
      movement_type: movementType || "in", // "in" | "out"
      qty: qty || 0,
      balance_before: balanceBefore ?? null,
      balance_after: balanceAfter ?? null,
      reason: reason || "",
      notes: notes || "",
      user_name: userName || "",
      full_name: fullName || userName || "",
      created_at: new Date().toISOString(),
    });
  } catch { /* تجاهل أي خطأ عشان ميوقفش العملية الأساسية */ }
};


// بيتحقق أولاً من صلاحية الصفحة/العملية (تعديل أو حذف) قبل ما يعرض شاشة الـ
// Passcode. لو الصلاحية مش مفعلة، بيوقف فوراً بتوست تحذيري من غير ما يطلب
// الباسكود أصلاً. التسجيل في سجل النشاط بقى صريح عبر log() عشان يتسجل بالقيم
// الفعلية بعد التعديل (مش وقت فتح شاشة التعديل قبل ما المستخدم يغيّر حاجة).
// ─── PASSCODE GATE HOOK (يستخدم في أي صفحة فيها عمليات حساسة) ────────────────
function usePasscodeGate(security) {
  const [pending, setPending] = useState(null); // { label, onConfirm }

  const requestPasscode = ({ pageId, kind, label, onConfirm }) => {
    if (security && typeof security.canDoSensitive === "function" && !security.canDoSensitive(pageId, kind)) {
      showPermissionToast(kind === "delete" ? "ليس لديك صلاحية الحذف في هذه الصفحة" : "ليس لديك صلاحية التعديل في هذه الصفحة", "error");
      return;
    }
    setPending({ label, onConfirm });
  };

  const PasscodeGate = pending ? (
    <PasscodeDialog
      title={pending.label ? `تأكيد: ${pending.label}` : undefined}
      onCancel={() => setPending(null)}
      onConfirm={() => {
        const { onConfirm } = pending;
        setPending(null);
        onConfirm();
      }}
    />
  ) : null;

  // تسجيل صريح في سجل النشاط - يُستدعى من الصفحة نفسها لحظة نجاح العملية الفعلية
  const log = (payload) => {
    if (security) logActivity(security.ownerId, { userName: security.userLabel, fullName: security.userLabel, ...payload });
  };

  return { requestPasscode, PasscodeGate, log };
}


// ─── CONFIRM DIALOG ───────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
  // Esc تقفل أي نافذة منبثقة في النظام — الديالوج ده جزء منها
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

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

// ─── نظام اختصارات لوحة المفاتيح (Keyboard Shortcuts) ─────────────────────────
// فكرة التصميم: كل صفحة بتسجّل اختصاراتها الخاصة (Ctrl+S للحفظ، Ctrl+N لسجل
// جديد، Ctrl+F للبحث، Delete للحذف...إلخ) عن طريق usePageShortcuts، وبتحدد
// بنفسها enabled:false لو المستخدم مالوش صلاحية — بالظبط نفس الفحص اللي
// بيحصل قبل إظهار زرار "إضافة" أو "حذف" بالماوس، فمفيش نظام صلاحيات موازي.
// - لو الاختصار مسجّل بس enabled:false، الضغط عليه بيوقف تنفيذ أي حاجة
//   ويطلع توست "ليس لديك صلاحية" — بالظبط زي لو ضغط على زرار متعطل.
// - Esc بيتعامل معاه كل من Modal/ConfirmDialog/PasscodeDialog بنفسه (فوق)،
//   مش هنا، عشان يشتغل صح مهما كانت النافذة المفتوحة وبدون أي تسجيل يدوي.
// - Ctrl + / بتفتح/تقفل نافذة الاختصارات من أي مكان في النظام.
// - أي اختصار مش مسجّل من الصفحة الحالية بيتجاهل تمامًا ومايعملش preventDefault،
//   عشان لو حد مسجّلش Ctrl+F مثلاً، بحث المتصفح الطبيعي (Ctrl+F) يفضل شغال عادي.
// - الاختصارات اللي ممكن تتصادم مع الكتابة العادية (Delete تحديدًا) بتتجاهل
//   تلقائيًا لو الفوكس في input/textarea/select، إلا لو الصفحة صرّحت
//   allowInEditable:true صراحةً.
const ShortcutsContext = createContext(null);

const isEditableTarget = (el) => {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
};

// combo نصي زي "ctrl+n" أو "ctrl+shift+n" أو "ctrl+/" أو "delete"
const eventMatchesCombo = (e, combo) => {
  const parts = combo.toLowerCase().split("+").map(p => p.trim());
  const mainPart = parts[parts.length - 1];
  const wantCtrl = parts.includes("ctrl");
  const wantShift = parts.includes("shift");
  const wantAlt = parts.includes("alt");
  const hasCtrl = e.ctrlKey || e.metaKey; // metaKey عشان تشتغل بـ Cmd على ماك برضه
  if (wantCtrl !== hasCtrl) return false;
  if (wantShift !== e.shiftKey) return false;
  if (wantAlt !== e.altKey) return false;
  const keyMap = { esc: "escape" };
  const target = keyMap[mainPart] || mainPart;
  return e.key.toLowerCase() === target;
};

const shortcutDisplayCombo = (combo) => combo.split("+").map(p => {
  const k = p.trim().toLowerCase();
  if (k === "ctrl") return "Ctrl";
  if (k === "shift") return "Shift";
  if (k === "alt") return "Alt";
  if (k === "esc") return "Esc";
  if (k === "delete") return "Delete";
  if (k === "enter") return "Enter";
  if (k === "/") return "/";
  return k.length === 1 ? k.toUpperCase() : k.charAt(0).toUpperCase() + k.slice(1);
}).join(" + ");

const GLOBAL_SHORTCUTS_INFO = [
  { combo: "Esc", label: "إغلاق النافذة الحالية", description: "يقفل أي نافذة منبثقة أو رسالة تأكيد أو شاشة Passcode مفتوحة" },
  { combo: "Tab  /  Shift + Tab", label: "التنقل بين الحقول", description: "ينتقل للحقل التالي أو السابق داخل أي نموذج" },
  { combo: "Ctrl + /", label: "اختصارات لوحة المفاتيح", description: "يفتح ويقفل نافذة الاختصارات دي" },
];

function ShortcutRow({ combo, label, description }) {
  return (
    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:14,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px" }}>
      <div>
        <div style={{ fontSize:13,fontWeight:600,color:C.text }}>{label}</div>
        {description && <div style={{ fontSize:11,color:C.textMuted,marginTop:2,lineHeight:1.6 }}>{description}</div>}
      </div>
      <kbd style={{ background:C.surface3,border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 10px",fontSize:11,fontFamily:"monospace",color:C.accent,whiteSpace:"nowrap",flexShrink:0 }}>{combo}</kbd>
    </div>
  );
}

// نافذة المساعدة بتعرض كل الاختصارات المتاحة (العامة + كل صفحة زُرت خلال
// الجلسة دي)، وبتحوّط بإطار أخضر الصفحة اللي انت فاتحها دلوقتي بالظبط، عشان
// تفرّق بسرعة بين "شغال هنا دلوقتي" و"شغال في صفحات تانية".
function ShortcutsHelpModal({ catalog, activePageLabel, onClose }) {
  const pageEntries = Object.entries(catalog || {}).filter(([, list]) => (list || []).some(s => s.enabled !== false && s.label));
  return (
    <Modal title="اختصارات لوحة المفاتيح" onClose={onClose} wide>
      <div style={{ display:"flex",flexDirection:"column",gap:18 }}>
        <div>
          <div style={{ fontSize:12,fontWeight:700,color:C.textMuted,marginBottom:8 }}>عامة (في كل الصفحات)</div>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {GLOBAL_SHORTCUTS_INFO.map(s => <ShortcutRow key={s.combo} combo={s.combo} label={s.label} description={s.description} />)}
          </div>
        </div>

        {pageEntries.length === 0 ? (
          <div style={{ fontSize:12,color:C.textMuted,background:C.surface2,borderRadius:10,padding:14,textAlign:"center" }}>
            لسه معملتش أي اختصارات خاصة بصفحات — بتظهر هنا أول ما تفتح صفحة فيها اختصارات.
          </div>
        ) : pageEntries.map(([pageLabel, list]) => {
          const isActive = pageLabel === activePageLabel;
          const rows = list.filter(s => s.enabled !== false && s.label);
          if (rows.length === 0) return null;
          return (
            <div key={pageLabel} style={{
              border: isActive ? `2px solid ${C.green}` : `1px solid transparent`,
              borderRadius: 14, padding: isActive ? 12 : 0,
              background: isActive ? `${C.green}0d` : "transparent",
              transition:"all 0.2s",
            }}>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8 }}>
                <div style={{ fontSize:12,fontWeight:700,color: isActive ? C.green : C.textMuted }}>{pageLabel}</div>
                {isActive && (
                  <span style={{ fontSize:10,fontWeight:700,color:C.green,background:`${C.green}18`,border:`1px solid ${C.green}44`,borderRadius:20,padding:"1px 8px" }}>
                    الصفحة المفتوحة الآن
                  </span>
                )}
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                {rows.map(s => <ShortcutRow key={s.combo} combo={shortcutDisplayCombo(s.combo)} label={s.label} description={s.description} />)}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// يلف التطبيق كله (مرة واحدة). بيسمع لضغطات الكيبورد على مستوى window ويوزّعها
// على اختصارات الصفحة الحالية المسجّلة، ومسؤول عن نافذة المساعدة (Ctrl+/).
//
// فيه فرق مهم بين حاجتين بيتابعهم الـ Provider:
// - liveListRef: اختصارات الصفحة المفتوحة فعليًا دلوقتي بس — ده اللي بيتنفذ
//   فعلاً لما تضغط أي combo، عشان منشغلش handler لصفحة اتقفلت.
// - catalogRef: أرشيف تراكمي لكل صفحة اتفتحت خلال الجلسة دي (مبيتمسحش لما
//   تقفل الصفحة) — ده اللي نافذة المساعدة بتعرضه كله، عشان "كل الاختصارات"
//   تفضل ظاهرة حتى لو رجعت لصفحة تانية.
function KeyboardShortcutsProvider({ children }) {
  const liveListRef = useRef([]);
  const activePageRef = useRef("");
  const catalogRef = useRef({});
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpSnapshot, setHelpSnapshot] = useState({ catalog:{}, activePageLabel:"" });
  const helpOpenRef = useRef(false);
  useEffect(() => { helpOpenRef.current = helpOpen; }, [helpOpen]);

  const registerPage = useCallback((pageLabel, list) => {
    liveListRef.current = list || [];
    activePageRef.current = pageLabel || "";
    if (pageLabel) catalogRef.current = { ...catalogRef.current, [pageLabel]: list || [] };
  }, []);

  const unregisterPage = useCallback((pageLabel) => {
    liveListRef.current = [];
    if (activePageRef.current === pageLabel) activePageRef.current = "";
    // ملحوظة: عمدًا مش بنمسح catalogRef[pageLabel] هنا — عايزينها تفضل في الأرشيف
  }, []);

  const snapshotNow = () => ({ catalog: catalogRef.current, activePageLabel: activePageRef.current });

  const openHelp = useCallback(() => {
    setHelpSnapshot(snapshotNow());
    setHelpOpen(true);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (eventMatchesCombo(e, "ctrl+/")) {
        e.preventDefault();
        setHelpSnapshot(snapshotNow());
        setHelpOpen(h => !h);
        return;
      }
      if (helpOpenRef.current) return; // نافذة المساعدة نفسها بتتقفل بـ Esc عن طريق Modal
      const editable = isEditableTarget(document.activeElement);
      for (const sc of liveListRef.current) {
        if (!sc.combo || !eventMatchesCombo(e, sc.combo)) continue;
        if (editable && !sc.allowInEditable) continue;
        e.preventDefault();
        if (sc.enabled === false) {
          showPermissionToast(sc.deniedMessage || "ليس لديك صلاحية لتنفيذ هذا الإجراء", "error");
        } else if (sc.handler) {
          sc.handler(e);
        }
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <ShortcutsContext.Provider value={{ registerPage, unregisterPage, openHelp }}>
      {children}
      {helpOpen && <ShortcutsHelpModal catalog={helpSnapshot.catalog} activePageLabel={helpSnapshot.activePageLabel} onClose={() => setHelpOpen(false)} />}
    </ShortcutsContext.Provider>
  );
}

// بيستخدم من أي صفحة عشان تسجّل اختصاراتها الخاصة. shortcuts array من عناصر:
// { combo:"ctrl+n", label:"فاتورة جديدة", description:"...", enabled:perms.canAdd,
//   handler:()=>..., allowInEditable:false, deniedMessage:"..." }
// pageLabel: اسم عربي قصير للصفحة (بيظهر في نافذة المساعدة).
function usePageShortcuts(pageLabel, shortcuts) {
  const ctx = useContext(ShortcutsContext);
  const latestRef = useRef(shortcuts);
  latestRef.current = shortcuts; // يتحدث في كل render من غير أي setState — يمنع الـ stale closures

  // "بصمة" نصية بالمحتوى الوصفي بس (مش الـ handler نفسها) عشان نتجنب إعادة
  // التسجيل (ومن ثم إعادة الـ render) في كل مرة الصفحة بترندر عادي
  const sig = shortcuts.map(s => `${s.combo}|${s.label}|${s.enabled !== false}|${!!s.allowInEditable}`).join(";;");

  useEffect(() => {
    if (!ctx) return;
    const wrapped = latestRef.current.map(s => ({
      ...s,
      handler: (...args) => {
        const fresh = latestRef.current.find(x => x.combo === s.combo);
        if (fresh && fresh.handler) fresh.handler(...args);
      },
    }));
    ctx.registerPage(pageLabel, wrapped);
    return () => ctx.unregisterPage(pageLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, pageLabel, sig]);
}

// زرار "اختصارات لوحة المفاتيح" من القائمة (بديل لـ Ctrl+/)
function useOpenShortcutsHelp() {
  const ctx = useContext(ShortcutsContext);
  return () => ctx?.openHelp?.();
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
  const isMobile = useIsMobile();
  const v = {
    primary: { background:C.accent,color:"#fff",border:"none",boxShadow:`0 4px 15px ${C.accent}30` },
    danger: { background:"transparent",color:C.red,border:`1px solid ${C.red}44` },
    ghost: { background:"transparent",color:C.textDim,border:`1px solid ${C.border}` },
    success: { background:C.greenDim,color:C.green,border:`1px solid ${C.green}33` },
    yellow: { background:C.yellowDim,color:C.yellow,border:`1px solid ${C.yellow}33` },
    purple: { background:C.purpleDim,color:C.purple,border:`1px solid ${C.purple}33` },
    cyan: { background:C.cyanDim,color:C.cyan,border:`1px solid ${C.cyan}33` },
  };
  const basePad = small ? "5px 12px" : (isMobile ? "11px 18px" : "8px 18px");
  const baseMinH = small ? undefined : (isMobile ? 44 : undefined);
  return (
    <button onClick={onClick} style={{ ...v[variant],borderRadius:9,padding:basePad,minHeight:baseMinH,fontSize:small?12:13,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,fontFamily:"inherit",transition:"all 0.2s",...style }}>
      {children}
    </button>
  );
};

// ─── CUSTOM DATE PICKER ───────────────────────────────────────────────────────
function DatePicker({ label, value, onChange, required=false }) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => value ? parseInt(value.split("-")[0]) : new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => value ? parseInt(value.split("-")[1])-1 : new Date().getMonth());
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (value) {
      setViewYear(parseInt(value.split("-")[0]));
      setViewMonth(parseInt(value.split("-")[1])-1);
    }
  }, [value]);

  const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const dayNames = ["أح","إث","ث","أر","خ","ج","س"];

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();
  const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

  const cells = [];
  for (let i=firstDay-1; i>=0; i--) cells.push({ day: daysInPrev-i, cur:false });
  for (let d=1; d<=daysInMonth; d++) cells.push({ day:d, cur:true });
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - daysInMonth - firstDay + 1, cur:false });

  const selYear = value ? parseInt(value.split("-")[0]) : null;
  const selMonth = value ? parseInt(value.split("-")[1])-1 : null;
  const selDay = value ? parseInt(value.split("-")[2]) : null;

  const selectDay = (d) => {
    const m = String(viewMonth+1).padStart(2,"0");
    const dy = String(d).padStart(2,"0");
    onChange(`${viewYear}-${m}-${dy}`);
    setOpen(false);
  };

  const prevMonth = () => { if (viewMonth===0) { setViewMonth(11); setViewYear(y=>y-1); } else setViewMonth(m=>m-1); };
  const nextMonth = () => { if (viewMonth===11) { setViewMonth(0); setViewYear(y=>y+1); } else setViewMonth(m=>m+1); };

  const displayValue = value ? new Date(value+"T00:00:00").toLocaleDateString("ar-EG", {year:"numeric",month:"2-digit",day:"2-digit"}) : "";

  return (
    <div ref={ref} style={{ display:"flex",flexDirection:"column",gap:5,position:"relative" }}>
      {label && <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>{label}{required && <span style={{ color:C.red }}> *</span>}</label>}
      <button type="button" onClick={()=>setOpen(p=>!p)} style={{
        background:C.bg, border:`1px solid ${open?C.accent:C.border}`, borderRadius:9, padding:"9px 13px",
        color: value ? C.text : C.textMuted, fontSize:13, fontFamily:"inherit", cursor:"pointer",
        display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, textAlign:"right",
        transition:"border-color 0.2s", width:"100%",
      }}>
        <span>{displayValue || "اختر تاريخ"}</span>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 6px)", right:0, zIndex:9999,
          background:C.surface, border:`1px solid ${C.borderLight}`, borderRadius:16,
          boxShadow:"0 12px 48px rgba(0,0,0,0.5)", padding:16, width:280, direction:"rtl",
        }}>
          {/* Header */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <button onClick={prevMonth} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted,padding:4,borderRadius:8,display:"flex" }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <span style={{ fontWeight:700, color:C.text, fontSize:14 }}>{monthNames[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted,padding:4,borderRadius:8,display:"flex" }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
          {/* Day names */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:6 }}>
            {dayNames.map(d=>(
              <div key={d} style={{ textAlign:"center", fontSize:11, fontWeight:700, color:C.textMuted, padding:"4px 0" }}>{d}</div>
            ))}
          </div>
          {/* Days */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
            {cells.map((c,i)=>{
              const isSelected = c.cur && selYear===viewYear && selMonth===viewMonth && selDay===c.day;
              const isToday = c.cur && new Date().getFullYear()===viewYear && new Date().getMonth()===viewMonth && new Date().getDate()===c.day;
              return (
                <button key={i} onClick={()=>c.cur && selectDay(c.day)} style={{
                  background: isSelected ? C.accent : isToday ? C.accentDim : "transparent",
                  color: isSelected ? "#fff" : c.cur ? C.text : C.textMuted,
                  border: isToday && !isSelected ? `1px solid ${C.accent}` : "1px solid transparent",
                  borderRadius:8, padding:"6px 2px", fontSize:12, fontWeight:isSelected?700:500,
                  cursor:c.cur?"pointer":"default", fontFamily:"inherit", transition:"all 0.15s",
                  opacity: c.cur ? 1 : 0.3,
                }} onMouseEnter={e=>{ if(c.cur&&!isSelected) e.target.style.background=C.accentDim; }}
                   onMouseLeave={e=>{ if(c.cur&&!isSelected) e.target.style.background="transparent"; }}>
                  {c.day}
                </button>
              );
            })}
          </div>
          {/* Footer */}
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:12, paddingTop:10, borderTop:`1px solid ${C.border}` }}>
            <button onClick={()=>{ onChange(""); setOpen(false); }} style={{ background:"none",border:"none",cursor:"pointer",color:C.red,fontSize:12,fontWeight:600,fontFamily:"inherit" }}>مسح</button>
            <button onClick={()=>{ const t=new Date(); selectDay(t.getDate()); setViewYear(t.getFullYear()); setViewMonth(t.getMonth()); }} style={{ background:"none",border:"none",cursor:"pointer",color:C.accent,fontSize:12,fontWeight:600,fontFamily:"inherit" }}>اليوم</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CUSTOM MONTH PICKER ──────────────────────────────────────────────────────
function MonthPicker({ label, value, onChange, required=false }) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => value ? parseInt(value.split("-")[0]) : new Date().getFullYear());
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const selYear = value ? parseInt(value.split("-")[0]) : null;
  const selMonth = value ? parseInt(value.split("-")[1])-1 : null;

  const selectMonth = (mi) => {
    onChange(`${viewYear}-${String(mi+1).padStart(2,"0")}`);
    setOpen(false);
  };

  const displayValue = value ? `${monthNames[parseInt(value.split("-")[1])-1]} ${value.split("-")[0]}` : "";

  return (
    <div ref={ref} style={{ display:"flex",flexDirection:"column",gap:5,position:"relative" }}>
      {label && <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>{label}{required && <span style={{ color:C.red }}> *</span>}</label>}
      <button type="button" onClick={()=>setOpen(p=>!p)} style={{
        background:C.bg, border:`1px solid ${open?C.accent:C.border}`, borderRadius:9, padding:"9px 13px",
        color: value ? C.text : C.textMuted, fontSize:13, fontFamily:"inherit", cursor:"pointer",
        display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, textAlign:"right",
        transition:"border-color 0.2s", width:"100%",
      }}>
        <span>{displayValue || "اختر شهر"}</span>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 6px)", right:0, zIndex:9999,
          background:C.surface, border:`1px solid ${C.borderLight}`, borderRadius:16,
          boxShadow:"0 12px 48px rgba(0,0,0,0.5)", padding:16, width:260, direction:"rtl",
        }}>
          {/* Year nav */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <button onClick={()=>setViewYear(y=>y-1)} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted,padding:4,borderRadius:8,display:"flex" }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <span style={{ fontWeight:700, color:C.text, fontSize:15 }}>{viewYear}</span>
            <button onClick={()=>setViewYear(y=>y+1)} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted,padding:4,borderRadius:8,display:"flex" }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
          {/* Months grid */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
            {monthNames.map((mn,mi)=>{
              const isSelected = selYear===viewYear && selMonth===mi;
              const isCurrentMonth = new Date().getFullYear()===viewYear && new Date().getMonth()===mi;
              return (
                <button key={mi} onClick={()=>selectMonth(mi)} style={{
                  background: isSelected ? C.accent : isCurrentMonth ? C.accentDim : C.surface2,
                  color: isSelected ? "#fff" : C.text,
                  border: isCurrentMonth && !isSelected ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
                  borderRadius:10, padding:"10px 6px", fontSize:12, fontWeight:isSelected?700:500,
                  cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s",
                }} onMouseEnter={e=>{ if(!isSelected) e.target.style.background=C.accentDim; }}
                   onMouseLeave={e=>{ if(!isSelected) e.target.style.background=isCurrentMonth?C.accentDim:C.surface2; }}>
                  {mn}
                </button>
              );
            })}
          </div>
          {/* Footer */}
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:12, paddingTop:10, borderTop:`1px solid ${C.border}` }}>
            <button onClick={()=>{ onChange(""); setOpen(false); }} style={{ background:"none",border:"none",cursor:"pointer",color:C.red,fontSize:12,fontWeight:600,fontFamily:"inherit" }}>مسح</button>
            <button onClick={()=>{ const t=new Date(); selectMonth(t.getMonth()); setViewYear(t.getFullYear()); }} style={{ background:"none",border:"none",cursor:"pointer",color:C.accent,fontSize:12,fontWeight:600,fontFamily:"inherit" }}>هذا الشهر</button>
          </div>
        </div>
      )}
    </div>
  );
}

const Inp = forwardRef(({ label, value, onChange, type="text", placeholder="", required=false }, ref) => {
  const isMobile = useIsMobile();
  return (
    <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
      {label && <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>{label}{required && <span style={{ color:C.red }}> *</span>}</label>}
      <input ref={ref} type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,padding:isMobile?"12px 13px":"9px 13px",color:C.text,fontSize:isMobile?16:13,fontFamily:"inherit",outline:"none",transition:"border-color 0.2s",boxSizing:"border-box",width:"100%" }}
        onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border} />
    </div>
  );
});

const Sel = ({ label, value, onChange, options, placeholder="-- اختر --" }) => {
  const isMobile = useIsMobile();
  return (
    <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
      {label && <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>{label}</label>}
      <select value={value} onChange={e=>onChange(e.target.value)} style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,padding:isMobile?"12px 13px":"9px 13px",color:C.text,fontSize:isMobile?16:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box",width:"100%" }}>
        <option value="">{placeholder}</option>
        {options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
      </select>
    </div>
  );
};

const Modal = ({ title, onClose, children, wide=false }) => {
  const isMobile = useIsMobile();

  // Esc تقفل أي نافذة منبثقة في النظام — الـ Modal العام ده جزء منها
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:isMobile?12:16 }}>
      <div style={{
        background:C.surface,border:`1px solid ${C.borderLight}`,
        borderRadius:isMobile?16:20,
        padding:isMobile?18:28,
        width:isMobile?"100%":(wide?"min(780px,95vw)":"min(540px,95vw)"),
        maxWidth:isMobile?"96vw":undefined,
        maxHeight:isMobile?"88vh":"90vh", overflowY:"auto",
        scrollbarWidth:"thin",scrollbarColor:`${C.border} transparent`,
        boxShadow:`0 30px 80px rgba(0,0,0,0.7)`,
        boxSizing:"border-box",
      }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:isMobile?16:22 }}>
          <h2 style={{ margin:0,fontSize:isMobile?15:17,fontWeight:700,color:C.text }}>{title}</h2>
          <button onClick={onClose} style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,cursor:"pointer",color:C.textMuted,padding:8,display:"flex",flexShrink:0 }}><Ic d={I.close} s={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
};

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
  <img src="/logo.png" alt="Hesapy" width={size} height={size} style={{ borderRadius:"50%", objectFit:"cover", display:"block" }} />
);


const ALL_PAGES = [
  { id:"dash", label:"الرئيسية" },
  { id:"sales", label:"المبيعات" },
  { id:"purchases", label:"المشتريات" },
  { id:"returns", label:"المرتجعات" },
  { id:"revenue", label:"الإيرادات" },
  { id:"expenses", label:"المصروفات" },
  { id:"receipts", label:"المقبوضات" },
  { id:"taxinvoices", label:"الفواتير الضريبية" },
  { id:"clients", label:"العملاء" },
  { id:"suppliers", label:"الموردين" },
  { id:"reports", label:"التقارير المالية" },
  { id:"taxreports", label:"التقارير الضريبية" },
  { id:"production", label:"تكلفة الإنتاج" },
  { id:"employees", label:"الموظفين" },
  { id:"inventory", label:"إدارة المخزون" },
  { id:"inventorylog", label:"سجل المخزون" },
  { id:"inventoryitems", label:"الأصناف" },
  { id:"categories", label:"الفئات" },
  { id:"settings", label:"إعدادات الشركة" },
];

const ROLE_PRESETS = {
  "مشاهدة فقط": { canAdd:false, canDelete:false, canEdit:false },
  "إضافة فقط":  { canAdd:true,  canDelete:false, canEdit:false },
  "إضافة وتعديل": { canAdd:true,  canDelete:false, canEdit:true },
  "صلاحيات كاملة": { canAdd:true,  canDelete:true,  canEdit:true },
};

// ─── قوالب الصلاحيات الجاهزة (Role Templates) ─────────────────────────────────
// دي بتتحدد من صاحب النظام بس (مكتوبة في الكود) ومش قابلة للتعديل من الشركات.
// اختيار القالب بيبقى نقطة بداية بس — تقدر تعدّل الصفحات يدوياً بعد كده.
const SUPERVISOR_TEMPLATE = "المشرف (Supervisor)";
const ROLE_TEMPLATES = {
  "محاسب المبيعات": { pages:["dash","sales","returns","receipts","clients"], role:"إضافة وتعديل" },
  "محاسب المشتريات": { pages:["dash","purchases","returns","suppliers"], role:"إضافة وتعديل" },
  "أمين المخزون": { pages:["dash","inventory","inventoryitems","categories"], role:"إضافة وتعديل" },
  "المحاسب العام": { pages:["dash","revenue","expenses","reports","taxreports","taxinvoices"], role:"إضافة وتعديل" },
  "مدير الإنتاج": { pages:["dash","production","inventoryitems","inventory"], role:"إضافة وتعديل" },
  "الموارد البشرية": { pages:["dash","employees"], role:"إضافة وتعديل" },
  [SUPERVISOR_TEMPLATE]: { pages: ALL_PAGES.map(p=>p.id), role:"صلاحيات كاملة" },
};

// ─── PERMISSION TOAST ─────────────────────────────────────────────────────────
let _showPermToast = null;
function setPermToastFn(fn) { _showPermToast = fn; }
function showPermissionToast(msg, type="warning") { if (_showPermToast) _showPermToast(msg, type); }

function PermissionToastProvider() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    setPermToastFn((msg, type) => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, msg, type }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    });
  }, []);
  if (!toasts.length) return null;
  return (
    <div style={{ position:"fixed",top:24,left:"50%",transform:"translateX(-50%)",zIndex:9999,display:"flex",flexDirection:"column",gap:10,alignItems:"center",pointerEvents:"none" }}>
      {toasts.map(t => {
        const color = t.type==="error" ? C.red : t.type==="success" ? C.green : C.yellow;
        const bg = t.type==="error" ? C.redDim : t.type==="success" ? C.greenDim : C.yellowDim;
        const icon = t.type==="error" ? I.alert : t.type==="success" ? I.stocktake : I.shield;
        return (
          <div key={t.id} style={{
            background:C.surface, border:`1px solid ${color}44`, borderRadius:14,
            padding:"14px 22px", display:"flex", alignItems:"center", gap:12,
            boxShadow:`0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${color}22`,
            animation:"slideDown 0.3s ease", minWidth:280, maxWidth:400,
            pointerEvents:"all",
          }}>
            <div style={{ background:bg, padding:8, borderRadius:10, flexShrink:0 }}>
              <Ic d={icon} s={16} c={color} />
            </div>
            <span style={{ fontSize:13, fontWeight:700, color:C.text, flex:1 }}>{t.msg}</span>
            <div style={{ width:3, height:32, background:color, borderRadius:3, flexShrink:0 }} />
          </div>
        );
      })}
      <style>{`@keyframes slideDown{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────
export {
  supabase, supabaseAdmin,
  claimSession, heartbeatSession, releaseSession,
  normalizeArabic, resolveCategory, EMPTY_STATE, useAppData,
  useTheme, setAppTheme, useIsMobile,
  Ic, I,
  fmt, fmtDateTime, fmtNum, nowISO, today, getMonth,
  openPrint, getCompanyBranding, printInvoice, printTaxInvoice, printStocktakeReport, printStocktakeUpdateReport, printFinancialReport,
  downloadInventoryTemplate, parseInventoryCSV,
  PasswordDialog, PasscodeDialog, getCachedPasscode, setCachedPasscode, logActivity, logInventoryMovement, usePasscodeGate,
  ConfirmDialog, Badge, Card, GlowCard, MiniStat, Btn,
  DatePicker, MonthPicker, Inp, Sel, Modal, THead, TRow, TD,
  PageHeader, ProgressBar, SectionTitle, ADMIN_EMAIL, Logo,
  ALL_PAGES, ROLE_PRESETS, ROLE_TEMPLATES, SUPERVISOR_TEMPLATE,
  showPermissionToast, PermissionToastProvider,
  KeyboardShortcutsProvider, usePageShortcuts, useOpenShortcutsHelp,
};
export { C };
