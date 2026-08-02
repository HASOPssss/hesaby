import { useState, useMemo } from "react";
import {
  C, Ic, I, fmt, fmtNum, fmtDateTime, today, nowISO,
  Card, MiniStat, Btn, DatePicker, Inp, Sel, Modal, ConfirmDialog,
  THead, TRow, TD, PageHeader, openPrint, getCompanyBranding,
  logInventoryMovement, usePasscodeGate, showPermissionToast,
} from "./shared";

// ══════════════════════════════════════════════════════════════════════════════
// ProductionCostPage.jsx — نظام أوامر الإنتاج (Production Orders).
//
// الفكرة: عملية إنتاج مش مجرد حاسبة تكلفة، دي مستند له حالة (مسودة/معتمد)
// وبتأثر فعليًا على المخزون لما يتم اعتمادها:
//   - بتحمّل تركيبة المنتج (BOM) المحفوظة على صنف المنتج النهائي (item.bom)
//     وتحسب كميات المواد الخام المطلوبة = qtyPerUnit × الكمية المطلوب إنتاجها.
//   - في حالة "مسودة": تقدر تعدّل/تحذف بحرية، ومفيش أي تأثير على المخزون.
//   - عند "الاعتماد": بيتحقق النظام إن كل المواد الخام متوفرة بالكميات
//     المطلوبة، ولو ناقصة بيمنع الاعتماد ويوضح اسم المادة والمطلوب والمتاح.
//     لو كله متاح: بيخصم المواد الخام، يضيف المنتج النهائي (بمتوسط تكلفة
//     مرجّح لو الصنف عنده رصيد قديم)، يسجّل حركتين فأكتر في سجل المخزون
//     (خروج لكل مادة خام + دخول للمنتج)، ويسجّل اعتماد العملية في سجل النشاط.
//   - بعد الاعتماد: العملية تتقفل تمامًا (لا تعديل ولا حذف)، وأي تصحيح
//     لازم يتم بعملية إنتاج جديدة منفصلة (زرار "تصحيح" بينسخ نفس المنتج).
//
// ملحوظة مهمة: القسم الخاص بـ "نوع الصنف" (مادة خام / منتج نهائي / خدمة)
// و"تركيبة المنتج (BOM)" بيتحطوا داخل صفحة إضافة/تعديل الصنف نفسها، مش هنا.
// شوف ملف ItemTypeAndBOM.jsx المرفق — فيه المكوّن الجاهز اللي تضيفه هناك،
// وهو اللي بيكتب item.itemType و item.bom اللي الصفحة دي بتقرأ منها.
//
// الصفحة دي بتستقبل prop اختياري اسمه security (زي باقي صفحات النظام
// اللي بتستخدم usePasscodeGate) — لازم يكون فيه { ownerId, userLabel,
// canDoSensitive }. لو مش موجود، الصفحة تشتغل عادي بس من غير تسجيل في
// سجل النشاط ومن غير طلب رمز حماية عند الاعتماد/الحذف.
// ══════════════════════════════════════════════════════════════════════════════

const STATUS_LABEL = { draft: "مسودة", completed: "معتمد" };
const STATUS_COLOR = { draft: C.yellow, completed: C.green };

function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] || C.textMuted;
  return (
    <span style={{ background:color+"18",color,border:`1px solid ${color}33`,padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700,whiteSpace:"nowrap" }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

// ─── طباعة أمر إنتاج فردي ──────────────────────────────────────────────────────
const printProductionOrder = (p) => {
  const { name: companyName, logo: companyLogo } = getCompanyBranding();
  const logoHtml = companyLogo ? `<img src="${companyLogo}" style="width:50px;height:50px;object-fit:cover;border-radius:8px;margin-left:12px" />` : "";
  const printDateTime = new Date().toLocaleString("ar-EG", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>أمر إنتاج ${p.id}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo','Segoe UI',sans-serif;background:#fff;color:#1a1a2e;padding:40px}
  .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #6c7fff}
  .company-info{display:flex;align-items:center}.company{font-size:22px;font-weight:800;color:#6c7fff}
  .badge{display:inline-block;background:#f0f4ff;color:#6c7fff;border:1px solid #c7d2fe;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;margin-top:6px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:26px}
  .info-box{background:#f8faff;border:1px solid #e2e8f0;border-radius:10px;padding:14px}
  .info-label{font-size:11px;color:#64748b;font-weight:600;margin-bottom:4px}.info-value{font-size:14px;font-weight:700}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}thead tr{background:#6c7fff;color:#fff}
  thead th{padding:9px 12px;font-size:12px;font-weight:700;text-align:right}
  tbody tr:nth-child(even){background:#f8faff}tbody td{padding:8px 12px;font-size:12.5px;border-bottom:1px solid #e2e8f0}
  .totals{background:#f8faff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;max-width:320px;margin-right:auto}
  .total-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px}
  .total-row.main{font-size:16px;font-weight:800;color:#6c7fff;border-top:2px solid #c7d2fe;margin-top:8px;padding-top:10px}
  .footer{margin-top:36px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}
  @media print{body{padding:20px}}</style></head><body>
  <div class="header">
    <div class="company-info">${logoHtml}<div><div class="company">${companyName}</div></div></div>
    <div style="text-align:left"><div style="font-size:13px;color:#64748b">أمر إنتاج</div><div style="font-size:20px;font-weight:800">${p.id}</div><span class="badge">${STATUS_LABEL[p.status]||p.status}</span></div>
  </div>
  <div class="info-grid">
    <div class="info-box"><div class="info-label">المنتج النهائي</div><div class="info-value">${p.productName}</div></div>
    <div class="info-box"><div class="info-label">الكمية المنتجة</div><div class="info-value">${p.quantity} ${p.unit||""}</div></div>
    <div class="info-box"><div class="info-label">التاريخ</div><div class="info-value">${p.date||"—"}</div></div>
    <div class="info-box"><div class="info-label">أنشئ بواسطة</div><div class="info-value">${p.createdBy||"—"}</div></div>
    ${p.status==="completed" ? `<div class="info-box"><div class="info-label">اعتمد بواسطة</div><div class="info-value">${p.approvedBy||"—"}</div></div>
    <div class="info-box"><div class="info-label">وقت الاعتماد</div><div class="info-value">${p.approvedAt?fmtDateTime(p.approvedAt):"—"}</div></div>` : ""}
  </div>
  <table><thead><tr><th>المادة الخام</th><th>الكمية لكل وحدة</th><th>الكمية المطلوبة</th><th>تكلفة الوحدة</th><th>الإجمالي</th></tr></thead><tbody>
  ${(p.materials||[]).map(m=>`<tr><td>${m.materialName}</td><td>${m.qtyPerUnit} ${m.unit||""}</td><td>${m.qtyNeeded} ${m.unit||""}</td><td>${(m.unitCost||0).toLocaleString("ar-EG")} ج.م</td><td>${(m.totalCost||0).toLocaleString("ar-EG")} ج.م</td></tr>`).join("")}
  </tbody></table>
  <div class="totals">
  <div class="total-row"><span>تكلفة المواد</span><span>${(p.materialsCost||0).toLocaleString("ar-EG")} ج.م</span></div>
  <div class="total-row"><span>تكلفة العمالة</span><span>${(p.laborCost||0).toLocaleString("ar-EG")} ج.م</span></div>
  <div class="total-row"><span>مصاريف عامة</span><span>${(p.overheadCost||0).toLocaleString("ar-EG")} ج.م</span></div>
  <div class="total-row main"><span>إجمالي تكلفة الإنتاج</span><span>${(p.totalCost||0).toLocaleString("ar-EG")} ج.م</span></div>
  <div class="total-row"><span>تكلفة الوحدة</span><span>${(p.costPerUnit||0).toLocaleString("ar-EG")} ج.م</span></div>
  </div>
  ${p.notes ? `<div style="margin-top:16px;font-size:12px;color:#64748b"><strong>ملاحظات:</strong> ${p.notes}</div>` : ""}
  <div class="footer">${companyName} — طُبعت بتاريخ ${printDateTime} — hesapy.pro</div>
  </body></html>`;
  openPrint(html);
};

// ─── طباعة سجل عمليات الإنتاج (قائمة) ──────────────────────────────────────────
const printProductionLog = (list) => {
  const { name: companyName, logo: companyLogo } = getCompanyBranding();
  const logoHtml = companyLogo ? `<img src="${companyLogo}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;margin-left:10px" />` : "";
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>سجل عمليات الإنتاج</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo','Segoe UI',sans-serif;background:#fff;color:#1a1a2e;padding:40px}
  .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:26px;padding-bottom:18px;border-bottom:3px solid #6c7fff}
  table{width:100%;border-collapse:collapse;font-size:12px}thead tr{background:#6c7fff;color:#fff}
  thead th{padding:8px 10px;font-weight:700;text-align:right}tbody tr:nth-child(even){background:#f8faff}
  tbody td{padding:8px 10px;border-bottom:1px solid #e2e8f0}
  .footer{margin-top:24px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px}
  @media print{body{padding:20px}}</style></head><body>
  <div class="header"><div style="display:flex;align-items:center">${logoHtml}<div style="font-size:20px;font-weight:800">سجل عمليات الإنتاج — ${companyName}</div></div>
  <div style="font-size:12px;color:#64748b">${new Date().toLocaleDateString("ar-EG")}</div></div>
  <table><thead><tr><th>رقم العملية</th><th>المنتج</th><th>الكمية</th><th>إجمالي التكلفة</th><th>الحالة</th><th>المستخدم</th><th>التاريخ</th></tr></thead><tbody>
  ${list.map(p=>`<tr><td>${p.id}</td><td>${p.productName}</td><td>${p.quantity} ${p.unit||""}</td><td>${(p.totalCost||0).toLocaleString("ar-EG")} ج.م</td><td>${STATUS_LABEL[p.status]||p.status}</td><td>${p.createdBy||"—"}</td><td>${p.date||"—"}</td></tr>`).join("")}
  </tbody></table>
  <div class="footer">${companyName} — hesapy.pro</div></body></html>`;
  openPrint(html);
};

// ─── تصدير Excel (CSV) ─────────────────────────────────────────────────────────
const exportProductionCSV = (list) => {
  const header = "رقم العملية,المنتج,الكمية,تكلفة المواد,العمالة,المصاريف,إجمالي التكلفة,تكلفة الوحدة,الحالة,المستخدم,التاريخ\n";
  const rows = list.map(p => [
    p.id, p.productName, p.quantity, p.materialsCost, p.laborCost, p.overheadCost,
    p.totalCost, p.costPerUnit, STATUS_LABEL[p.status]||p.status, p.createdBy||"", p.date||"",
  ].map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "سجل_عمليات_الإنتاج.csv"; a.click();
  URL.revokeObjectURL(url);
};

const emptyForm = () => ({ date: today(), productId: "", quantity: 1, notes: "", correctionOf: "" });

// ─── PRODUCTION COST PAGE ─────────────────────────────────────────────────────
function ProductionCostPage({ data, actions, security }) {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null); // draft being edited, else null = new
  const [form, setForm] = useState(emptyForm());
  const [bomLines, setBomLines] = useState([]); // [{materialId, materialName, qtyPerUnit, qtyNeeded, unit, unitCost, totalCost}]
  const [laborCost, setLaborCost] = useState(0);
  const [overheadCost, setOverheadCost] = useState(0);
  const [shortageError, setShortageError] = useState(null); // {list:[...]}
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");

  const { requestPasscode, PasscodeGate, log } = usePasscodeGate(security);

  const productions = data?.productions || [];
  const inventory = data?.inventory || [];
  const finishedProducts = inventory.filter(i => i.itemType === "finished");

  const userName = security?.userLabel || "مستخدم";

  // ── تحميل تركيبة المنتج (BOM) وحساب الكميات بناءً على كمية الإنتاج ──
  const loadBomForProduct = (productId, qty) => {
    const product = inventory.find(i => i.id === productId);
    if (!product) { setBomLines([]); return; }
    const q = parseFloat(qty) || 0;
    const lines = (product.bom || []).map(b => {
      const material = inventory.find(i => i.id === b.materialId);
      const unitCost = material?.cost || 0;
      const qtyPerUnit = parseFloat(b.qtyPerUnit) || 0;
      const qtyNeeded = Math.round((qtyPerUnit * q + Number.EPSILON) * 1000) / 1000;
      return {
        materialId: b.materialId,
        materialName: material?.name || b.materialName || "—",
        unit: material?.unit || b.unit || "",
        qtyPerUnit,
        qtyNeeded,
        unitCost,
        totalCost: Math.round(qtyNeeded * unitCost),
        available: material?.qty ?? 0,
      };
    });
    setBomLines(lines);
  };

  const selectProduct = (productId) => {
    setForm(f => ({ ...f, productId }));
    loadBomForProduct(productId, form.quantity);
  };

  const changeQuantity = (qty) => {
    setForm(f => ({ ...f, quantity: qty }));
    loadBomForProduct(form.productId, qty);
  };

  const updateBomQty = (idx, qtyNeeded) => {
    setBomLines(lines => lines.map((l,i) => i===idx ? { ...l, qtyNeeded: parseFloat(qtyNeeded)||0, totalCost: Math.round((parseFloat(qtyNeeded)||0)*l.unitCost) } : l));
  };

  const materialsCost = bomLines.reduce((s,l)=>s+(l.totalCost||0),0);
  const totalCost = materialsCost + (parseFloat(laborCost)||0) + (parseFloat(overheadCost)||0);
  const qtyNum = parseFloat(form.quantity)||0;
  const costPerUnit = qtyNum > 0 ? totalCost / qtyNum : 0;

  const selectedProduct = inventory.find(i => i.id === form.productId);

  const resetForm = () => {
    setForm(emptyForm());
    setBomLines([]);
    setLaborCost(0); setOverheadCost(0);
    setEditingId(null);
    setShortageError(null);
  };

  const openNew = () => { resetForm(); setShowModal(true); };

  const openEditDraft = (p) => {
    setEditingId(p.id);
    setForm({ date: p.date, productId: p.productId, quantity: p.quantity, notes: p.notes||"", correctionOf: p.correctionOf||"" });
    setBomLines((p.materials||[]).map(m => ({ ...m })));
    setLaborCost(p.laborCost||0);
    setOverheadCost(p.overheadCost||0);
    setShortageError(null);
    setShowModal(true);
  };

  const openCorrection = (p) => {
    resetForm();
    setForm(f => ({ ...f, date: today(), productId: p.productId, quantity: 0, notes: `تصحيح للعملية ${p.id}`, correctionOf: p.id }));
    loadBomForProduct(p.productId, 0);
    setShowModal(true);
  };

  const buildRecord = (status) => ({
    id: editingId || ("PRD" + Date.now().toString().slice(-6)),
    status,
    date: form.date,
    productId: form.productId,
    productName: selectedProduct?.name || "",
    unit: selectedProduct?.unit || "قطعة",
    quantity: qtyNum,
    materials: bomLines,
    materialsCost: Math.round(materialsCost),
    laborCost: parseFloat(laborCost)||0,
    overheadCost: parseFloat(overheadCost)||0,
    totalCost: Math.round(totalCost),
    costPerUnit: Math.round(costPerUnit),
    notes: form.notes,
    correctionOf: form.correctionOf || "",
  });

  // ── حفظ كمسودة (لا يؤثر على المخزون إطلاقًا) ──
  const handleSaveDraft = async () => {
    if (!form.productId) { showPermissionToast("اختر المنتج النهائي أولاً", "warning"); return; }
    if (qtyNum <= 0) { showPermissionToast("أدخل كمية إنتاج أكبر من صفر", "warning"); return; }
    const record = buildRecord("draft");
    if (editingId) {
      const existing = productions.find(p=>p.id===editingId);
      await actions.updateProduction({ ...existing, ...record });
    } else {
      await actions.addProduction({ ...record, createdBy: userName, createdAt: nowISO() });
    }
    setShowModal(false);
    resetForm();
  };

  // ── اعتماد عملية الإنتاج: يتحقق من توفر المواد، ثم يخصم/يضيف من المخزون ──
  const doApprove = async (record) => {
    // إعادة التحقق من الأرصدة الحالية لحظة الاعتماد (مش وقت إنشاء المسودة)
    const shortages = [];
    for (const line of record.materials) {
      const material = inventory.find(i => i.id === line.materialId);
      const avail = material?.qty ?? 0;
      if (avail < line.qtyNeeded) {
        shortages.push({ name: line.materialName, required: line.qtyNeeded, available: avail, unit: line.unit });
      }
    }
    if (shortages.length > 0) {
      setShortageError({ list: shortages });
      return;
    }

    const ownerId = security?.ownerId;

    // 1) خصم المواد الخام
    for (const line of record.materials) {
      const material = inventory.find(i => i.id === line.materialId);
      if (!material) continue;
      const before = material.qty || 0;
      const after = before - line.qtyNeeded;
      await actions.updateInventoryItem({ ...material, qty: after });
      if (security) {
        await logInventoryMovement(ownerId, {
          itemId: material.id, itemName: material.name, movementType: "out",
          qty: line.qtyNeeded, balanceBefore: before, balanceAfter: after,
          reason: `استهلاك في إنتاج ${record.id}`, notes: record.correctionOf ? `تصحيح للعملية ${record.correctionOf}` : "",
          userName, fullName: userName,
        });
      }
    }

    // 2) إضافة المنتج النهائي (بمتوسط تكلفة مرجّح لو عنده رصيد سابق)
    const product = inventory.find(i => i.id === record.productId);
    if (product) {
      const beforeQty = product.qty || 0;
      const afterQty = beforeQty + record.quantity;
      const newAvgCost = beforeQty > 0
        ? Math.round(((beforeQty * (product.cost||0)) + (record.quantity * record.costPerUnit)) / (afterQty || 1))
        : record.costPerUnit;
      await actions.updateInventoryItem({ ...product, qty: afterQty, cost: newAvgCost });
      if (security) {
        await logInventoryMovement(ownerId, {
          itemId: product.id, itemName: product.name, movementType: "in",
          qty: record.quantity, balanceBefore: beforeQty, balanceAfter: afterQty,
          reason: `إنتاج دفعة ${record.id}`, notes: record.correctionOf ? `تصحيح للعملية ${record.correctionOf}` : "",
          userName, fullName: userName,
        });
      }
    }

    // 3) اعتماد سجل عملية الإنتاج نفسه — يُقفل بعدها تمامًا
    const existing = productions.find(p => p.id === record.id) || record;
    const approved = {
      ...existing, ...record,
      status: "completed",
      approvedAt: nowISO(),
      approvedBy: userName,
    };
    await actions.updateProduction(approved);

    // 4) سجل النشاط (Audit Log)
    if (security) {
      log({
        actionType: "اعتماد إنتاج",
        section: "تكلفة الإنتاج",
        target: record.id,
        after: approved,
      });
    }

    showPermissionToast("تم اعتماد عملية الإنتاج وتحديث المخزون", "success");
    setShowModal(false);
    resetForm();
  };

  const handleApprove = (record) => {
    requestPasscode({
      pageId: "production", kind: "edit",
      label: `اعتماد عملية الإنتاج ${record.id}`,
      onConfirm: () => doApprove(record),
    });
  };

  // ── حفظ ثم اعتماد مباشرة من نفس النافذة ──
  const handleSaveAndApprove = async () => {
    if (!form.productId) { showPermissionToast("اختر المنتج النهائي أولاً", "warning"); return; }
    if (qtyNum <= 0) { showPermissionToast("أدخل كمية إنتاج أكبر من صفر", "warning"); return; }
    const record = buildRecord("draft");
    if (editingId) {
      const existing = productions.find(p=>p.id===editingId);
      await actions.updateProduction({ ...existing, ...record });
      handleApprove({ ...existing, ...record });
    } else {
      const withMeta = { ...record, createdBy: userName, createdAt: nowISO() };
      await actions.addProduction(withMeta);
      handleApprove(withMeta);
    }
  };

  const handleDeleteDraft = (p) => {
    if (p.status !== "draft") return;
    requestPasscode({
      pageId: "production", kind: "delete",
      label: `حذف مسودة الإنتاج ${p.id}`,
      onConfirm: () => setConfirmDeleteId(p.id),
    });
  };

  const confirmDelete = async () => {
    await actions.deleteProduction(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  // ── الفلترة والبحث ──
  const filtered = useMemo(() => productions
    .filter(p => !statusFilter || p.status === statusFilter)
    .filter(p => !productFilter || p.productId === productFilter)
    .filter(p => !search.trim() || (p.productName||"").includes(search.trim()) || p.id.includes(search.trim()))
    .sort((a,b) => (b.createdAt||"").localeCompare(a.createdAt||"")),
    [productions, statusFilter, productFilter, search]);

  const totalAllCost = productions.reduce((s,p)=>s+(p.totalCost||0),0);
  const totalMaterials = productions.reduce((s,p)=>s+(p.materialsCost||0),0);
  const completedCount = productions.filter(p=>p.status==="completed").length;
  const draftCount = productions.filter(p=>p.status==="draft").length;

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      <PageHeader title="تكلفة الإنتاج" icon={I.chartBar} subtitle={`${productions.length} عملية إنتاج (${draftCount} مسودة، ${completedCount} معتمد)`}
        action={<Btn onClick={openNew}><Ic d={I.plus} s={14} />أمر إنتاج جديد</Btn>} />

      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
        <MiniStat label="إجمالي تكاليف الإنتاج" value={fmt(totalAllCost)} color={C.red} icon={I.revenue} />
        <MiniStat label="تكلفة المواد المستهلكة" value={fmt(totalMaterials)} color={C.yellow} icon={I.box} />
        <MiniStat label="عمليات معتمدة" value={fmtNum(completedCount)} color={C.green} icon={I.stocktake} />
        <MiniStat label="مسودات بانتظار الاعتماد" value={fmtNum(draftCount)} color={C.accent} icon={I.chartBar} />
      </div>

      <Card style={{ padding:0 }}>
        <div style={{ display:"flex",gap:10,flexWrap:"wrap",padding:16,borderBottom:`1px solid ${C.border}` }}>
          <div style={{ flex:"1 1 200px" }}>
            <Inp label="بحث" value={search} onChange={setSearch} placeholder="رقم العملية أو اسم المنتج..." />
          </div>
          <div style={{ width:180 }}>
            <Sel label="الحالة" value={statusFilter} onChange={setStatusFilter}
              options={[{value:"draft",label:"مسودة"},{value:"completed",label:"معتمد"}]} placeholder="كل الحالات" />
          </div>
          <div style={{ width:200 }}>
            <Sel label="المنتج" value={productFilter} onChange={setProductFilter}
              options={finishedProducts.map(p=>({value:p.id,label:p.name}))} placeholder="كل المنتجات" />
          </div>
          <div style={{ display:"flex",alignItems:"flex-end",gap:8 }}>
            <Btn variant="ghost" small onClick={()=>printProductionLog(filtered)}><Ic d={I.print} s={13} />طباعة</Btn>
            <Btn variant="ghost" small onClick={()=>exportProductionCSV(filtered)}><Ic d={I.excel} s={13} />Excel</Btn>
          </div>
        </div>
        <div style={{ overflowX:"auto",WebkitOverflowScrolling:"touch" }}>
        <table style={{ width:"100%",minWidth:900,borderCollapse:"collapse" }}>
          <THead cols={["رقم","التاريخ","المنتج","الكمية","إجمالي التكلفة","تكلفة الوحدة","الحالة","المستخدم",""]} />
          <tbody>
            {filtered.map((p,idx)=>(
              <TRow key={p.id} alt={idx%2}>
                <TD color={C.accent}>{p.id}{p.correctionOf && <div style={{ fontSize:10,color:C.textMuted }}>تصحيح لـ {p.correctionOf}</div>}</TD>
                <TD color={C.textDim}>{p.date}</TD>
                <TD><span style={{ fontWeight:700 }}>{p.productName}</span></TD>
                <TD mono color={C.text}>{p.quantity} {p.unit}</TD>
                <TD mono color={C.red}><span style={{ fontWeight:700 }}>{fmt(p.totalCost)}</span></TD>
                <TD mono color={C.green}>{fmt(p.costPerUnit)}</TD>
                <TD><StatusBadge status={p.status} /></TD>
                <TD color={C.textDim}>{p.status==="completed" ? p.approvedBy : p.createdBy}</TD>
                <td style={{ padding:"11px 14px" }}>
                  <div style={{ display:"flex",gap:8,justifyContent:"flex-end" }}>
                    <button title="طباعة" onClick={()=>printProductionOrder(p)} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted }}><Ic d={I.print} s={14} /></button>
                    {p.status==="draft" && (
                      <>
                        <button title="تعديل" onClick={()=>openEditDraft(p)} style={{ background:"none",border:"none",cursor:"pointer",color:C.blue }}><Ic d={I.edit} s={14} /></button>
                        <button title="اعتماد" onClick={()=>handleApprove({ ...p })} style={{ background:"none",border:"none",cursor:"pointer",color:C.green }}><Ic d={I.stocktake} s={14} /></button>
                        <button title="حذف" onClick={()=>handleDeleteDraft(p)} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted }}><Ic d={I.trash} s={14} /></button>
                      </>
                    )}
                    {p.status==="completed" && (
                      <button title="عملية تصحيح" onClick={()=>openCorrection(p)} style={{ background:"none",border:"none",cursor:"pointer",color:C.purple }}><Ic d={I.returns} s={14} /></button>
                    )}
                  </div>
                </td>
              </TRow>
            ))}
          </tbody>
        </table>
        </div>
        {filtered.length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد عمليات إنتاج بعد</div>}
      </Card>

      {showModal && (
        <Modal title={editingId ? `تعديل مسودة الإنتاج ${editingId}` : "أمر إنتاج جديد"} onClose={()=>{setShowModal(false);resetForm();}} wide>
          <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
            {form.correctionOf && (
              <div style={{ background:C.purpleDim,border:`1px solid ${C.purple}33`,borderRadius:10,padding:"10px 14px",fontSize:12,color:C.purple,fontWeight:600 }}>
                هذه عملية تصحيح للعملية المعتمدة {form.correctionOf} — لن يتم تعديل السجل الأصلي، وستُنشأ حركة مستقلة عند الاعتماد.
              </div>
            )}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12 }}>
              <DatePicker label="التاريخ" value={form.date} onChange={v=>setForm({...form,date:v})} />
              <Sel label="المنتج النهائي" value={form.productId} onChange={selectProduct}
                options={finishedProducts.map(p=>({value:p.id,label:p.name}))} placeholder="اختر منتج نهائي" />
              <Inp label="الكمية المطلوب إنتاجها" type="number" value={form.quantity} onChange={changeQuantity} />
            </div>

            {!form.productId && (
              <div style={{ background:C.surface2,borderRadius:10,padding:14,fontSize:12,color:C.textMuted,textAlign:"center" }}>
                اختر منتجًا نهائيًا له تركيبة (BOM) محفوظة من صفحة الأصناف عشان تتحمّل المواد الخام تلقائيًا.
              </div>
            )}

            {form.productId && (
              <div>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
                  <label style={{ fontSize:13,fontWeight:600,color:C.textDim }}>المواد الخام المطلوبة (من تركيبة المنتج)</label>
                </div>
                {bomLines.length === 0 ? (
                  <div style={{ background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:10,padding:14,fontSize:12,color:C.red }}>
                    هذا المنتج ليس له تركيبة (BOM) محفوظة بعد. أضِف المواد الخام من صفحة الصنف أولاً.
                  </div>
                ) : (
                  <div style={{ background:C.surface2,borderRadius:12,overflowX:"auto",border:`1px solid ${C.border}`,WebkitOverflowScrolling:"touch" }}>
                    <table style={{ width:"100%",minWidth:560,borderCollapse:"collapse" }}>
                      <THead cols={["المادة الخام","لكل وحدة","المطلوب","المتاح بالمخزون","تكلفة الوحدة","الإجمالي"]} />
                      <tbody>
                        {bomLines.map((l,i)=>(
                          <TRow key={l.materialId} alt={i%2}>
                            <TD>{l.materialName}</TD>
                            <TD mono color={C.textDim}>{l.qtyPerUnit} {l.unit}</TD>
                            <td style={{ padding:"6px 10px" }}>
                              <input type="number" value={l.qtyNeeded} onChange={e=>updateBomQty(i,e.target.value)}
                                style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 8px",color:C.text,fontSize:12,fontFamily:"inherit",width:80 }} />
                            </td>
                            <TD mono color={l.available < l.qtyNeeded ? C.red : C.green}>{l.available} {l.unit}</TD>
                            <TD mono color={C.textDim}>{fmt(l.unitCost)}</TD>
                            <TD mono color={C.accent}>{fmt(l.totalCost)}</TD>
                          </TRow>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

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
                { label:`تكلفة الوحدة`, val:fmt(costPerUnit), color:C.green, bold:true },
              ].map(r=>(
                <div key={r.label} style={{ display:"flex",justifyContent:"space-between",fontSize:r.bold?14:12,borderTop:r.bold?`1px solid ${C.border}`:"none",paddingTop:r.bold?8:0 }}>
                  <span style={{ color:C.textMuted,fontWeight:r.bold?700:400 }}>{r.label}</span>
                  <span style={{ color:r.color,fontWeight:700,fontFamily:"monospace" }}>{r.val}</span>
                </div>
              ))}
            </div>

            <Inp label="ملاحظات" value={form.notes} onChange={v=>setForm({...form,notes:v})} placeholder="أي ملاحظات..." />

            <div style={{ display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap" }}>
              <Btn variant="ghost" onClick={()=>{setShowModal(false);resetForm();}}>إلغاء</Btn>
              <Btn variant="yellow" onClick={handleSaveDraft}>حفظ كمسودة</Btn>
              <Btn variant="success" onClick={handleSaveAndApprove}><Ic d={I.stocktake} s={14} />حفظ واعتماد الآن</Btn>
            </div>
          </div>
        </Modal>
      )}

      {shortageError && (
        <Modal title="لا يمكن اعتماد العملية" onClose={()=>setShortageError(null)}>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ fontSize:13,color:C.red,fontWeight:600 }}>المواد الخام التالية غير متوفرة بالكميات المطلوبة:</div>
            {shortageError.list.map((s,i)=>(
              <div key={i} style={{ background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",fontSize:13 }}>
                <span style={{ fontWeight:700 }}>{s.name}</span>
                <span style={{ color:C.textDim }}>مطلوب {s.required} {s.unit} — متاح {s.available} {s.unit}</span>
              </div>
            ))}
            <div style={{ display:"flex",justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setShortageError(null)}>حسنًا</Btn>
            </div>
          </div>
        </Modal>
      )}

      {confirmDeleteId && (
        <ConfirmDialog
          message="سيتم حذف مسودة عملية الإنتاج هذه نهائيًا. المسودات فقط قابلة للحذف — العمليات المعتمدة لا يمكن حذفها."
          onConfirm={confirmDelete}
          onCancel={()=>setConfirmDeleteId(null)}
        />
      )}

      {PasscodeGate}
    </div>
  );
}

export default ProductionCostPage;
