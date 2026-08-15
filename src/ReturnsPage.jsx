import { useState, useMemo } from "react";
import {
  C, Ic, I, fmt, today, Card, MiniStat, Btn, Badge,
  DatePicker, Inp, Sel, Modal, THead, TRow, TD, PageHeader,
  usePasscodeGate, showPermissionToast,
  validateAndBuildMovements, applyInventoryMovements,
} from "./shared";

// ══════════════════════════════════════════════════════════════════════════════
// ReturnsPage.jsx — مرتجعات المبيعات والمشتريات (إعادة تصميم كاملة).
//
// المرتجع هنا مش مبلغ حر منفصل — هو دايمًا مرتبط بفاتورة حقيقية موجودة،
// وبيتم اختيار الأصناف والكميات المرتجعة من نفس بنود الفاتورة، مع منع
// إرجاع أكتر من "المتاح للإرجاع" (الكمية الأصلية ناقص أي مرتجع سابق لنفس
// الصنف في نفس الفاتورة). القيمة والتأثير على المخزون بيتحسبوا تلقائيًا،
// مش بيتكتبوا يدويًا.
//
// مرتجع المبيعات بيرجّع الكمية للمخزون (زي ما تكون فاتورة المبيعات نفسها
// اتقلّلت)، ومرتجع المشتريات بيسحب الكمية من المخزون (زي ما تكون فاتورة
// الشراء اتقلّلت) — بنفس محرك الفرق (Diff Engine) المستخدم بالظبط في صفحة
// الفواتير، فمفيش قواعد مخزون مزدوجة في النظام.
// ══════════════════════════════════════════════════════════════════════════════

function ReturnsPage({ returns=[], salesInvoices=[], purchaseInvoices=[], inventory=[], onAdd, onDelete, onAddInventoryItem, onUpdateInventoryItem, security, pageId="returns" }) {
  const [showModal, setShowModal] = useState(false);
  const [docType, setDocType] = useState("sales"); // "sales" | "purchases"
  const [invoiceId, setInvoiceId] = useState("");
  const [lines, setLines] = useState([]); // [{itemId,name,unit,price,originalQty,alreadyReturned,maxReturnable,returnQty}]
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [shortageError, setShortageError] = useState(null); // { mode:"save"|"delete", list }
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const { requestPasscode, PasscodeGate, log } = usePasscodeGate(security);

  const invoicesForType = docType === "sales" ? salesInvoices : purchaseInvoices;
  const partyKey = docType === "sales" ? "client" : "supplier";

  // ── الكمية اللي اترجعت قبل كده لكل صنف في فاتورة معينة (من كل مرتجعات الفاتورة دي) ──
  const returnedQtyMap = (invId) => {
    const map = new Map();
    returns.filter(r => r.invoiceId === invId).forEach(r => {
      (r.items||[]).forEach(it => {
        const k = it.itemId || it.name;
        map.set(k, (map.get(k)||0) + (parseFloat(it.qty)||0));
      });
    });
    return map;
  };

  const selectInvoice = (id) => {
    setInvoiceId(id);
    const inv = invoicesForType.find(i => i.id === id);
    if (!inv) { setLines([]); return; }
    const returnedMap = returnedQtyMap(id);
    setLines((inv.items||[]).map(it => {
      const k = it.itemId || it.name;
      const originalQty = parseFloat(it.qty)||0;
      const already = returnedMap.get(k) || 0;
      const maxReturnable = Math.max(0, originalQty - already);
      return { itemId: it.itemId, name: it.name, unit: it.unit||"قطعة", price: it.price||0, originalQty, alreadyReturned: already, maxReturnable, returnQty: 0 };
    }));
  };

  const setLineQty = (idx, val) => {
    setLines(prev => prev.map((l,i) => {
      if (i!==idx) return l;
      const q = Math.max(0, Math.min(l.maxReturnable, parseFloat(val)||0));
      return { ...l, returnQty: q };
    }));
  };

  const setAllToMax = () => setLines(prev => prev.map(l => ({ ...l, returnQty: l.maxReturnable })));
  const clearAll = () => setLines(prev => prev.map(l => ({ ...l, returnQty: 0 })));

  const totalReturnAmount = lines.reduce((s,l)=>s+(l.returnQty*l.price),0);
  const selectedInvoice = invoicesForType.find(i => i.id === invoiceId);
  const isFullReturn = lines.length>0 && lines.every(l => l.returnQty >= l.maxReturnable) && lines.some(l=>l.maxReturnable>0);

  const resetForm = () => { setInvoiceId(""); setLines([]); setReason(""); setNotes(""); };
  const openNew = () => { resetForm(); setDocType("sales"); setShowModal(true); };

  const handleSave = async () => {
    if (!invoiceId) { showPermissionToast("اختر الفاتورة أولاً", "warning"); return; }
    const returnedLines = lines.filter(l => l.returnQty > 0);
    if (returnedLines.length === 0) { showPermissionToast("حدّد كمية إرجاع لصنف واحد على الأقل", "warning"); return; }

    const manualDiffs = returnedLines.map(l => ({ name: l.name, itemId: l.itemId, delta: -l.returnQty }));
    const { ok, shortages, movements } = validateAndBuildMovements(docType, manualDiffs, inventory);
    if (!ok) { setShortageError({ mode:"save", list: shortages }); return; }

    const party = selectedInvoice[partyKey];
    const record = {
      id: "RET" + Date.now().toString().slice(-6),
      type: docType==="sales" ? "sale" : "purchase",
      invoiceType: docType,
      invoiceId,
      [partyKey]: party,
      date: today(),
      items: returnedLines.map(l => ({ itemId: l.itemId, name: l.name, qty: l.returnQty, price: l.price, unit: l.unit })),
      amount: totalReturnAmount,
      reason, notes,
      createdAt: new Date().toISOString(),
    };

    await applyInventoryMovements(movements, {
      type: docType, onAddInventoryItem, onUpdateInventoryItem, security,
      invoiceLabel: `مرتجع ${docType==="sales"?"مبيعات":"مشتريات"} ${record.id} — فاتورة ${invoiceId}`,
    });
    await onAdd(record);
    log({ actionType:"إضافة مرتجع", section: docType==="sales"?"مرتجعات المبيعات":"مرتجعات المشتريات", target:`${record.id} — فاتورة ${invoiceId} (${party})`, before:null, after:record });
    showPermissionToast("تم حفظ المرتجع بنجاح", "success");
    setShowModal(false);
    resetForm();
  };

  // ── حذف مرتجع: عكس كامل لتأثيره على المخزون (بيتمنع لو الكمية اتستهلكت تاني) ──
  const handleDeleteClick = (ret) => {
    const party = ret[ret.invoiceType==="sales"||ret.type==="sale" ? "client" : "supplier"];
    requestPasscode({
      pageId, kind:"delete", label:`حذف مرتجع ${ret.id}`,
      onConfirm: async () => {
        const engineType = (ret.invoiceType || (ret.type==="sale"?"sales":"purchases"));
        const manualDiffs = (ret.items||[]).map(it => ({ name: it.name, itemId: it.itemId, delta: it.qty }));
        const { ok, shortages, movements } = validateAndBuildMovements(engineType, manualDiffs, inventory);
        if (!ok) { setShortageError({ mode:"delete", list: shortages }); return; }
        await applyInventoryMovements(movements, {
          type: engineType, onAddInventoryItem, onUpdateInventoryItem, security,
          invoiceLabel: `حذف مرتجع ${ret.id} — فاتورة ${ret.invoiceId}`,
        });
        await onDelete(ret.id);
        log({ actionType:"حذف مرتجع", section: engineType==="sales"?"مرتجعات المبيعات":"مرتجعات المشتريات", target:`${ret.id} — فاتورة ${ret.invoiceId} (${party})`, before:ret, after:null });
      },
    });
  };

  const filtered = useMemo(() => returns
    .filter(r => !typeFilter || (r.invoiceType||(r.type==="sale"?"sales":"purchases"))===typeFilter)
    .filter(r => {
      const party = r.client || r.supplier || "";
      return !search.trim() || r.id.includes(search) || r.invoiceId?.includes(search) || party.includes(search);
    })
    .sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"")),
    [returns, typeFilter, search]);

  const totalReturns = returns.reduce((s,r)=>s+(r.amount||0),0);
  const salesReturns = returns.filter(r=>(r.invoiceType||(r.type==="sale"?"sales":"purchases"))==="sales");
  const purchaseReturns = returns.filter(r=>(r.invoiceType||(r.type==="sale"?"sales":"purchases"))==="purchases");

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <PageHeader title="المرتجعات" icon={I.returns} subtitle={`${returns.length} مرتجع`}
        action={<Btn onClick={openNew}><Ic d={I.plus} s={14} />مرتجع جديد</Btn>} />

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        <MiniStat label="إجمالي المرتجعات" value={fmt(totalReturns)} color={C.purple} icon={I.returns} />
        <MiniStat label="مرتجعات المبيعات" value={fmt(salesReturns.reduce((s,r)=>s+(r.amount||0),0))} color={C.red} icon={I.sales} />
        <MiniStat label="مرتجعات المشتريات" value={fmt(purchaseReturns.reduce((s,r)=>s+(r.amount||0),0))} color={C.green} icon={I.purchase} />
        <MiniStat label="عدد المرتجعات" value={returns.length} color={C.accent} icon={I.report} />
      </div>

      <Card style={{ padding:0 }}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", padding:16, borderBottom:`1px solid ${C.border}` }}>
          <div style={{ flex:"1 1 200px" }}>
            <Inp label="بحث" value={search} onChange={setSearch} placeholder="رقم المرتجع، رقم الفاتورة، أو اسم الطرف..." />
          </div>
          <div style={{ width:180 }}>
            <Sel label="النوع" value={typeFilter} onChange={setTypeFilter}
              options={[{value:"sales",label:"مرتجع مبيعات"},{value:"purchases",label:"مرتجع مشتريات"}]} placeholder="كل الأنواع" />
          </div>
        </div>
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
          <table style={{ width:"100%", minWidth:900, borderCollapse:"collapse" }}>
            <THead cols={["رقم المرتجع","النوع","الفاتورة المرتبطة","الطرف","الأصناف","القيمة","التاريخ",""]} />
            <tbody>
              {filtered.map((r,idx)=>{
                const eType = r.invoiceType || (r.type==="sale"?"sales":"purchases");
                const party = r.client || r.supplier || "—";
                return (
                  <TRow key={r.id} alt={idx%2}>
                    <TD color={C.accent}>{r.id}</TD>
                    <TD><Badge label={eType==="sales"?"مبيعات":"مشتريات"} /></TD>
                    <TD color={C.textDim}>{r.invoiceId}</TD>
                    <TD>{party}</TD>
                    <TD color={C.textMuted}>{(r.items||[]).map(it=>`${it.name} ×${it.qty}`).join("، ")}</TD>
                    <TD mono color={C.purple}><span style={{ fontWeight:700 }}>{fmt(r.amount)}</span></TD>
                    <TD color={C.textDim}>{r.date}</TD>
                    <td style={{ padding:"11px 14px" }}>
                      <button onClick={()=>handleDeleteClick(r)} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted }}><Ic d={I.trash} s={14} /></button>
                    </td>
                  </TRow>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد مرتجعات بعد</div>}
      </Card>

      {showModal && (
        <Modal title="مرتجع جديد" onClose={()=>{setShowModal(false);resetForm();}} wide>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Sel label="نوع المستند" value={docType} onChange={v=>{ setDocType(v); setInvoiceId(""); setLines([]); }}
                options={[{value:"sales",label:"فاتورة مبيعات"},{value:"purchases",label:"فاتورة مشتريات"}]} />
              <Sel label="الفاتورة" value={invoiceId} onChange={selectInvoice}
                options={invoicesForType.map(i=>({ value:i.id, label:`${i.id} — ${i[partyKey]} — ${i.date}` }))}
                placeholder="اختر الفاتورة" />
            </div>

            {!invoiceId && (
              <div style={{ background:C.surface2, borderRadius:10, padding:14, fontSize:12, color:C.textMuted, textAlign:"center" }}>
                اختر فاتورة عشان تظهر أصنافها والكميات المتاحة للإرجاع.
              </div>
            )}

            {invoiceId && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <label style={{ fontSize:13, fontWeight:600, color:C.textDim }}>الأصناف والكميات المرتجعة</label>
                  <div style={{ display:"flex", gap:8 }}>
                    <Btn small variant="ghost" onClick={clearAll}>مسح الكل</Btn>
                    <Btn small onClick={setAllToMax}>إرجاع الفاتورة بالكامل</Btn>
                  </div>
                </div>
                {lines.length === 0 ? (
                  <div style={{ background:C.surface2, borderRadius:10, padding:14, fontSize:12, color:C.textMuted, textAlign:"center" }}>هذه الفاتورة ليس بها أصناف.</div>
                ) : (
                  <div style={{ background:C.surface2, borderRadius:12, overflowX:"auto", border:`1px solid ${C.border}` }}>
                    <table style={{ width:"100%", minWidth:600, borderCollapse:"collapse" }}>
                      <THead cols={["الصنف","الكمية الأصلية","مُرتجع سابقًا","المتاح للإرجاع","كمية الإرجاع","القيمة"]} />
                      <tbody>
                        {lines.map((l,i)=>(
                          <TRow key={l.itemId||l.name} alt={i%2}>
                            <TD>{l.name}</TD>
                            <TD mono color={C.textDim}>{l.originalQty} {l.unit}</TD>
                            <TD mono color={C.textMuted}>{l.alreadyReturned} {l.unit}</TD>
                            <TD mono color={l.maxReturnable>0?C.green:C.red}>{l.maxReturnable} {l.unit}</TD>
                            <td style={{ padding:"6px 10px" }}>
                              <input type="number" min={0} max={l.maxReturnable} value={l.returnQty} disabled={l.maxReturnable<=0}
                                onChange={e=>setLineQty(i, e.target.value)}
                                style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:7, padding:"5px 8px", color:C.text, fontSize:12, fontFamily:"inherit", width:80, opacity:l.maxReturnable<=0?0.5:1 }} />
                            </td>
                            <TD mono color={C.purple}>{fmt(l.returnQty*l.price)}</TD>
                          </TRow>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {isFullReturn && (
                  <div style={{ marginTop:10, background:C.purpleDim, border:`1px solid ${C.purple}33`, borderRadius:10, padding:"8px 14px", fontSize:12, color:C.purple, fontWeight:700 }}>
                    ↩ هذا سيُسجَّل كمرتجع كامل للفاتورة
                  </div>
                )}
              </div>
            )}

            <Inp label="سبب الإرجاع" value={reason} onChange={setReason} placeholder="مثال: عيب في المنتج، طلب زيادة عن الحاجة..." />
            <Inp label="ملاحظات" value={notes} onChange={setNotes} placeholder="أي ملاحظات إضافية..." />

            {totalReturnAmount > 0 && (
              <div style={{ background:C.surface3, borderRadius:12, padding:"14px 18px", display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:C.textMuted, fontWeight:700 }}>إجمالي قيمة المرتجع</span>
                <span style={{ color:C.purple, fontWeight:800, fontFamily:"monospace", fontSize:16 }}>{fmt(totalReturnAmount)}</span>
              </div>
            )}

            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>{setShowModal(false);resetForm();}}>إلغاء</Btn>
              <Btn variant="purple" onClick={handleSave}>حفظ المرتجع</Btn>
            </div>
          </div>
        </Modal>
      )}

      {shortageError && (
        <Modal title={shortageError.mode==="delete" ? "لا يمكن حذف المرتجع" : "لا يمكن حفظ المرتجع"} onClose={()=>setShortageError(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ fontSize:13, color:C.red, fontWeight:600 }}>
              هذا سيؤدي إلى رصيد سالب في الأصناف التالية (تم استخدام/بيع جزء من الكمية بالفعل):
            </div>
            {shortageError.list.map((s,i)=>(
              <div key={i} style={{ background:C.redDim, border:`1px solid ${C.red}33`, borderRadius:10, padding:"10px 14px", display:"flex", justifyContent:"space-between", fontSize:13 }}>
                <span style={{ fontWeight:700 }}>{s.name}</span>
                <span style={{ color:C.textDim }}>مطلوب {s.required} — متاح {s.available}</span>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setShortageError(null)}>حسنًا</Btn>
            </div>
          </div>
        </Modal>
      )}

      {PasscodeGate}
    </div>
  );
}

export default ReturnsPage;
