// ─── useAppData.js ────────────────────────────────────────────────────────────
// Hook مركزي يحتوي على:
//   - saveData(table, record)  → يحفظ في Supabase مع user_id تلقائي
//   - loadData()               → يجلب كل بيانات المستخدم الحالي
//   - normalizeCategory(name)  → يوحّد الفئات (يتعامل مع ه/ة/ا/أ/إ وغيرها)
//   - actions                  → كل عمليات الإضافة والحذف والتعديل
//
// كيف يعمل:
//   1. عند تسجيل الدخول يُجلب كل بيانات user_id تلقائياً
//   2. كل إضافة تُحفظ في Supabase فوراً
//   3. الفئات تتولّد تلقائياً من ملف Excel وتُوحَّد بـ normalizeCategory
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase";

// ─── SCHEMA المطلوب في Supabase ───────────────────────────────────────────────
//
// جدول: records
//   id          text primary key
//   user_id     uuid references auth.users not null
//   table_name  text not null          -- 'sales' | 'purchases' | 'returns' | 'inventory' | 'clients' | 'suppliers' | 'categories'
//   type        text                   -- نوع السجل إن وُجد
//   data        jsonb not null         -- كل حقول السجل
//   created_at  timestamptz default now()
//   updated_at  timestamptz default now()
//
// Row Level Security:
//   CREATE POLICY "users_own_records"
//   ON records FOR ALL
//   USING (auth.uid() = user_id)
//   WITH CHECK (auth.uid() = user_id);
//
// ─────────────────────────────────────────────────────────────────────────────

// ─── تطبيع الفئات (يعالج أخطاء الكتابة العربية) ──────────────────────────────
// يحوّل النص إلى صيغة موحّدة للمقارنة فقط (لا يغيّر النص الأصلي)
export function normalizeArabic(str = "") {
  return str
    .trim()
    .toLowerCase()
    // توحيد الألف
    .replace(/[أإآا]/g, "ا")
    // توحيد الهاء والتاء المربوطة
    .replace(/[هة]/g, "ه")
    // توحيد الياء
    .replace(/[يى]/g, "ي")
    // توحيد الواو
    .replace(/[ؤو]/g, "و")
    // حذف التشكيل
    .replace(/[\u064B-\u065F]/g, "")
    // حذف المسافات الزائدة
    .replace(/\s+/g, " ");
}

// يجد فئة موجودة مطابقة أو يُنشئ فئة جديدة
export function resolveCategory(rawName, existingCategories) {
  if (!rawName || !rawName.trim()) return existingCategories[0] || "";
  const normalized = normalizeArabic(rawName);
  const found = existingCategories.find(c => normalizeArabic(c) === normalized);
  return found || rawName.trim(); // إذا لم توجد: أضف الاسم الجديد كما هو
}

// ─── البيانات الأولية (تُستبدل بالبيانات من Supabase بعد تسجيل الدخول) ────────
const EMPTY_STATE = {
  salesInvoices: [],
  purchaseInvoices: [],
  clients: [],
  suppliers: [],
  returns: [],
  categories: ["إلكترونيات", "مواد خام", "معدات", "مستلزمات مكتبية", "آلات", "أغذية", "ملابس", "أدوات"],
  inventory: [],
};

// ─── HOOK الرئيسي ─────────────────────────────────────────────────────────────
export function useAppData(userId) {
  const [data, setData] = useState(EMPTY_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ─── saveData: حفظ أي record في Supabase ───────────────────────────────────
  // table: 'sales' | 'purchases' | 'returns' | 'inventory' | 'clients' | 'suppliers' | 'categories'
  // record: الكائن المراد حفظه (يُضاف له user_id تلقائياً)
  const saveData = useCallback(async (table, record) => {
    if (!userId) {
      console.warn("saveData: لا يوجد user_id — تخطّي الحفظ");
      return null;
    }
    try {
      const { data: saved, error: err } = await supabase
        .from("records")
        .upsert({
          id: record.id,
          user_id: userId,
          table_name: table,
          type: record.type || null,
          data: record,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" })
        .select()
        .single();

      if (err) throw err;
      return saved;
    } catch (e) {
      console.error("saveData error:", e.message);
      setError(e.message);
      return null;
    }
  }, [userId]);

  // ─── deleteRecord: حذف record من Supabase ──────────────────────────────────
  const deleteRecord = useCallback(async (recordId) => {
    if (!userId) return;
    try {
      const { error: err } = await supabase
        .from("records")
        .delete()
        .eq("id", recordId)
        .eq("user_id", userId);
      if (err) throw err;
    } catch (e) {
      console.error("deleteRecord error:", e.message);
      setError(e.message);
    }
  }, [userId]);

  // ─── loadData: جلب كل بيانات المستخدم ─────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data: rows, error: err } = await supabase
        .from("records")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (err) throw err;

      // ترتيب السجلات حسب الجدول
      const rebuilt = { ...EMPTY_STATE };

      rows.forEach(row => {
        const record = row.data;
        switch (row.table_name) {
          case "sales":
            rebuilt.salesInvoices.push(record);
            break;
          case "purchases":
            rebuilt.purchaseInvoices.push(record);
            break;
          case "returns":
            rebuilt.returns.push(record);
            break;
          case "inventory":
            // تحديث إذا موجود، إضافة إذا لا
            const invIdx = rebuilt.inventory.findIndex(i => i.id === record.id);
            if (invIdx >= 0) rebuilt.inventory[invIdx] = record;
            else rebuilt.inventory.push(record);
            break;
          case "clients":
            const cIdx = rebuilt.clients.findIndex(c => c.id === record.id);
            if (cIdx >= 0) rebuilt.clients[cIdx] = record;
            else rebuilt.clients.push(record);
            break;
          case "suppliers":
            const sIdx = rebuilt.suppliers.findIndex(s => s.id === record.id);
            if (sIdx >= 0) rebuilt.suppliers[sIdx] = record;
            else rebuilt.suppliers.push(record);
            break;
          case "categories":
            // الفئات مخزّنة كـ { id, name }
            if (record.name && !rebuilt.categories.includes(record.name)) {
              rebuilt.categories.push(record.name);
            }
            break;
          default:
            break;
        }
      });

      setData(rebuilt);
    } catch (e) {
      console.error("loadData error:", e.message);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // جلب البيانات عند تغيّر المستخدم
  useEffect(() => {
    if (userId) loadData();
    else setData(EMPTY_STATE);
  }, [userId, loadData]);

  // ─── ensureCategory: تأكّد وجود فئة وأضفها إن لم توجد ─────────────────────
  const ensureCategory = useCallback(async (rawName) => {
    if (!rawName || !rawName.trim()) return;

    setData(prev => {
      const resolved = resolveCategory(rawName, prev.categories);
      if (prev.categories.some(c => normalizeArabic(c) === normalizeArabic(resolved))) {
        return prev; // موجودة بالفعل
      }
      // فئة جديدة: أضفها في الحالة المحلية
      const newCat = { id: "CAT" + Date.now(), name: resolved, type: "category" };
      // احفظها في Supabase (async، لا ننتظر)
      saveData("categories", newCat);
      return { ...prev, categories: [...prev.categories, resolved] };
    });
  }, [saveData]);

  // ─── ACTIONS ───────────────────────────────────────────────────────────────
  const actions = {

    // ── فاتورة مبيعات ──────────────────────────────────────────────────────
    addSale: async (invoice) => {
      const record = { ...invoice, type: "sale" };
      // تأكّد من وجود فئات كل الأصناف
      for (const item of (invoice.items || [])) {
        if (item.category) await ensureCategory(item.category);
      }
      await saveData("sales", record);
      setData(prev => ({ ...prev, salesInvoices: [...prev.salesInvoices, record] }));
    },

    deleteSale: async (id) => {
      await deleteRecord(id);
      setData(prev => ({ ...prev, salesInvoices: prev.salesInvoices.filter(i => i.id !== id) }));
    },

    // ── فاتورة مشتريات ─────────────────────────────────────────────────────
    addPurchase: async (invoice) => {
      const record = { ...invoice, type: "purchase" };
      for (const item of (invoice.items || [])) {
        if (item.category) await ensureCategory(item.category);
      }
      await saveData("purchases", record);
      setData(prev => ({ ...prev, purchaseInvoices: [...prev.purchaseInvoices, record] }));
    },

    deletePurchase: async (id) => {
      await deleteRecord(id);
      setData(prev => ({ ...prev, purchaseInvoices: prev.purchaseInvoices.filter(i => i.id !== id) }));
    },

    // ── مرتجع ──────────────────────────────────────────────────────────────
    addReturn: async (ret) => {
      const record = { ...ret, type: "return" };
      await saveData("returns", record);
      setData(prev => ({ ...prev, returns: [...prev.returns, record] }));
    },

    deleteReturn: async (id) => {
      await deleteRecord(id);
      setData(prev => ({ ...prev, returns: prev.returns.filter(r => r.id !== id) }));
    },

    // ── عميل ───────────────────────────────────────────────────────────────
    addClient: async (client) => {
      const record = { ...client, type: "client" };
      await saveData("clients", record);
      setData(prev => ({ ...prev, clients: [...prev.clients, record] }));
    },

    deleteClient: async (name) => {
      const client = data.clients.find(c => c.name === name);
      if (client) await deleteRecord(client.id);
      setData(prev => ({ ...prev, clients: prev.clients.filter(c => c.name !== name) }));
    },

    // ── مورد ───────────────────────────────────────────────────────────────
    addSupplier: async (supplier) => {
      const record = { ...supplier, type: "supplier" };
      await saveData("suppliers", record);
      setData(prev => ({ ...prev, suppliers: [...prev.suppliers, record] }));
    },

    deleteSupplier: async (name) => {
      const supplier = data.suppliers.find(s => s.name === name);
      if (supplier) await deleteRecord(supplier.id);
      setData(prev => ({ ...prev, suppliers: prev.suppliers.filter(s => s.name !== name) }));
    },

    // ── مخزون ──────────────────────────────────────────────────────────────
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
      setData(prev => ({
        ...prev,
        inventory: prev.inventory.map(i => i.id === item.id ? record : i),
      }));
    },

    deleteInventoryItem: async (id) => {
      await deleteRecord(id);
      setData(prev => ({ ...prev, inventory: prev.inventory.filter(i => i.id !== id) }));
    },

    // ── رفع ملف Excel للمخزون (مع استخراج الفئات تلقائياً) ─────────────────
    // يُستدعى من parseInventoryCSV بعد قراءة الملف
    bulkAddInventory: async (items) => {
      // استخرج الفئات الفريدة من الملف
      const rawCategories = [...new Set(items.map(i => i.category).filter(Boolean))];

      // أضف الفئات الجديدة (ensureCategory تتعامل مع التكرار)
      for (const cat of rawCategories) {
        await ensureCategory(cat);
      }

      // احفظ كل صنف
      const saved = [];
      for (const item of items) {
        // حوّل اسم الفئة إلى الاسم الموحّد الموجود
        const resolvedCat = resolveCategory(item.category, data.categories);
        const record = { ...item, category: resolvedCat, type: "inventory" };
        await saveData("inventory", record);
        saved.push(record);
      }

      setData(prev => ({
        ...prev,
        inventory: [
          ...prev.inventory.filter(i => !saved.find(s => s.id === i.id)),
          ...saved,
        ],
      }));
    },

    // ── حذف شهر كامل ───────────────────────────────────────────────────────
    deleteMonth: async (month) => {
      const getMonth = (d) => d?.slice(0, 7);
      const toDelete = [
        ...data.salesInvoices.filter(i => getMonth(i.date) === month),
        ...data.purchaseInvoices.filter(i => getMonth(i.date) === month),
        ...data.returns.filter(i => getMonth(i.date) === month),
      ];
      for (const rec of toDelete) {
        await deleteRecord(rec.id);
      }
      setData(prev => ({
        ...prev,
        salesInvoices: prev.salesInvoices.filter(i => getMonth(i.date) !== month),
        purchaseInvoices: prev.purchaseInvoices.filter(i => getMonth(i.date) !== month),
        returns: prev.returns.filter(i => getMonth(i.date) !== month),
      }));
    },

    // ── فئة يدوية ───────────────────────────────────────────────────────────
    addCategory: async (name) => {
      await ensureCategory(name);
    },
  };

  return { data, setData, loading, error, saveData, actions, loadData };
}

// ─── كيف تستخدم useAppData في App.jsx ────────────────────────────────────────
//
//  import { useAppData } from './useAppData';
//
//  function App() {
//    const [userId, setUserId] = useState(null);
//
//    // استمع لحالة المصادقة
//    useEffect(() => {
//      supabase.auth.getSession().then(({ data: { session } }) => {
//        setUserId(session?.user?.id ?? null);
//      });
//      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
//        setUserId(session?.user?.id ?? null);
//      });
//      return () => subscription.unsubscribe();
//    }, []);
//
//    const { data, loading, actions } = useAppData(userId);
//
//    // استبدل كل:
//    //   setData(prev => ({ ...prev, salesInvoices: [...prev.salesInvoices, inv] }))
//    // بـ:
//    //   await actions.addSale(inv)
//    //
//    // واستبدل كل:
//    //   setData(prev => ({ ...prev, salesInvoices: prev.salesInvoices.filter(i => i.id !== id) }))
//    // بـ:
//    //   await actions.deleteSale(id)
//  }
//
// ─── رفع ملف Excel ────────────────────────────────────────────────────────────
//
//  // في parseInventoryCSV أو بعد قراءة الملف:
//  const items = parseInventoryCSV(text, data.categories);  // موجود بالفعل
//  await actions.bulkAddInventory(items);                   // يضيف الفئات تلقائياً
//
// ─────────────────────────────────────────────────────────────────────────────
