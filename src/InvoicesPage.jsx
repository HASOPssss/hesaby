import { useState } from "react";
import { createPortal } from "react-dom";
import {
  C, Ic, I, fmt, fmtDateTime, today, printInvoice,
  ConfirmDialog, usePasscodeGate, Badge, Card, MiniStat, Btn,
  DatePicker, Inp, Sel, Modal, THead, TRow, TD, PageHeader,
  showPermissionToast, computeItemDiffs, validateAndBuildMovements, applyInventoryMovements,
} from "./shared";

// ══════════════════════════════════════════════════════════════════════════════
// InvoicesPage.jsx — صفحة فواتير المبيعات/المشتريات (النموذج + الجدول).
//
// منطق المخزون هنا شغال بمبدأ "الفرق" (Diff-based) مش "استبدال كامل" — الأدوات
// المشتركة (computeItemDiffs / validateAndBuildMovements / applyInventoryMovements)
// موجودة في shared.jsx عشان نفس المنطق بالظبط يُستخدم في صفحة المرتجعات كمان.
// أي حفظ (إضافة/تعديل/حذف) بيتقارن فيه الحالة القديمة بالجديدة لكل صنف على
// حدة، وبيتنفذ بس فرق الحركة الناتج عن كده. المبيعات بتتحقق من توفر المخزون
// قبل أي زيادة في الكمية المباعة (تمنع البيع بدون رصيد)، والمشتريات بتتحقق
// من عدم الوصول لرصيد سالب قبل أي نقص في الكمية المشتراة (تعديل/حذف).
// ══════════════════════════════════════════════════════════════════════════════

// ─── INVOICE FORM ─────────────────────────────────────────────────────────────
function InvoiceForm({ type, clients, suppliers, categories, onSave, onClose, onAddClient, onAddSupplier, inventory, onAddInventoryItem, onUpdateInventoryItem, editingInvoice }) {
  const isS = type==="sales";
  const [form, setForm] = useState(() => editingInvoice ? {
    date: editingInvoice.date, party: editingInvoice[isS?"client":"supplier"] || "",
    paid: String(editingInvoice.paid ?? ""), taxRate: String(editingInvoice.taxRate || "14"),
    taxEnabled: (editingInvoice.taxRate||0) > 0, paymentMethod: editingInvoice.paymentMethod || "نقدي",
    checkNumber: editingInvoice.checkNumber || "", checkDate: editingInvoice.checkDate || "", notes: editingInvoice.notes || "",
  } : { date:today(),party:"",paid:"",taxRate:"14",taxEnabled:true,paymentMethod:"نقدي",checkNumber:"",checkDate:"",notes:"" });
  const [items, setItems] = useState(() => editingInvoice?.items?.length ? editingInvoice.items.map(it=>({...it})) : [{ category:"",name:"",qty:1,price:0 }]);
  const [itemSuggestions, setItemSuggestions] = useState({});
  const [activeItemIdx, setActiveItemIdx] = useState(null);
  const [dropdownPos, setDropdownPos] = useState(null); // { top, left, width } لعرض القائمة كـ Portal
  const [quickAddItemIdx, setQuickAddItemIdx] = useState(null); // index of the row we're adding a new inventory item for
  const [quickItemForm, setQuickItemForm] = useState({ name:"", category:"", qty:"1", cost:"", price:"", unit:"قطعة", minQty:"0" });
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const activePartyList = (isS ? clients : suppliers).filter(p=>p.isActive!==false);
  const partyList = editingInvoice && !activePartyList.some(p=>p.name===form.party)
    ? [...activePartyList, ...(isS?clients:suppliers).filter(p=>p.name===form.party)]
    : activePartyList;

  const subtotal = items.reduce((s,it)=>s+(parseFloat(it.qty)||0)*(parseFloat(it.price)||0),0);
  const taxAmount = isS && form.taxEnabled ? subtotal*(parseFloat(form.taxRate)||0)/100 : 0;
  const total = subtotal+taxAmount;
  const paid = parseFloat(form.paid)||0;

  const addItem = ()=>setItems([...items,{ category:"",name:"",qty:1,price:0 }]);
  const removeItem = i=>setItems(items.filter((_,idx)=>idx!==i));
  const updateItem = (i,field,val)=>setItems(items.map((it,idx)=>idx===i?{...it,[field]:val}:it));

  // Handle item name typing — show matching inventory items
  const handleItemNameChange = (i, val, e) => {
    setItems(prev => prev.map((it,idx) => idx===i ? { ...it, name: val, itemId: undefined } : it));
    if (e?.target) updateDropdownPos(e.target);
    if (!(inventory||[]).length) { setItemSuggestions(prev=>({...prev,[i]:[]})); return; }
    if (!val.trim()) {
      // فاضي: اعرض أول أصناف عشان يتصفح من غير ما يكتب حاجة
      setItemSuggestions(prev=>({...prev,[i]:(inventory||[]).slice(0,20)}));
      return;
    }
    const q = val.trim().toLowerCase();
    const matches = (inventory||[]).filter(inv =>
      inv.name?.toLowerCase().includes(q) || inv.id?.toLowerCase().includes(q)
    ).slice(0,20);
    setItemSuggestions(prev=>({...prev,[i]:matches}));
  };

  const updateDropdownPos = (el) => {
    const rect = el.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width });
  };

  const handleItemFocus = (i, e) => {
    setActiveItemIdx(i);
    if (e?.target) updateDropdownPos(e.target);
    const val = items[i]?.name || "";
    if (!val.trim() && (inventory||[]).length) {
      setItemSuggestions(prev=>({...prev,[i]:(inventory||[]).slice(0,20)}));
    }
  };

  // User picks a suggestion
  const selectSuggestion = (i, invItem) => {
    setItems(prev => prev.map((it,idx) => idx===i ? {
      ...it,
      itemId: invItem.id,
      name: invItem.name,
      category: invItem.category || it.category,
      price: isS ? (invItem.price||0) : (invItem.cost||0),
      unit: invItem.unit || it.unit,
    } : it));
    setItemSuggestions(prev=>({...prev,[i]:[]}));
    setActiveItemIdx(null);
    setDropdownPos(null);
  };

  const openQuickAddItem = (i) => {
    setQuickItemForm({ name: items[i]?.name || "", category: items[i]?.category || categories[0] || "", qty:"1", cost:"", price:"", unit:"قطعة", minQty:"0" });
    setQuickAddItemIdx(i);
    setItemSuggestions(prev=>({...prev,[i]:[]}));
    setActiveItemIdx(null);
    setDropdownPos(null);
  };

  const saveQuickAddItem = () => {
    if (!quickItemForm.name.trim() || quickAddItemIdx===null) return;
    const newItem = {
      id: "INV"+Date.now().toString().slice(-5),
      name: quickItemForm.name.trim(),
      category: quickItemForm.category,
      qty: parseFloat(quickItemForm.qty)||0,
      minQty: parseFloat(quickItemForm.minQty)||0,
      cost: parseFloat(quickItemForm.cost)||0,
      price: parseFloat(quickItemForm.price)||0,
      unit: quickItemForm.unit || "قطعة",
    };
    if (onAddInventoryItem) onAddInventoryItem(newItem);
    setItems(prev => prev.map((it,idx) => idx===quickAddItemIdx ? {
      ...it,
      itemId: newItem.id,
      name: newItem.name,
      category: newItem.category,
      price: isS ? newItem.price : newItem.cost,
      unit: newItem.unit,
    } : it));
    setQuickAddItemIdx(null);
  };

  const handleQuickAdd = () => {
    if (!quickName.trim()) return;
    const record = { id:(isS?"C":"SP")+Date.now().toString().slice(-5), name:quickName.trim(), phone:quickPhone.trim(), balance:0 };
    if (isS && onAddClient) onAddClient(record);
    else if (!isS && onAddSupplier) onAddSupplier(record);
    setForm({...form, party: quickName.trim()});
    setQuickName(""); setQuickPhone("");
    setShowQuickAdd(false);
  };

  // ── الحفظ هنا بيبني بيانات الفاتورة بس. التحقق من المخزون وتنفيذ حركاته
  // (الفرق بين القديم والجديد) بيحصل في InvoicesPage نفسها، عشان يكون عندها
  // رؤية موحدة على المخزون والفاتورة القديمة سوا قبل ما تقرر توافق على الحفظ. ──
  const handleSave = () => {
    if (!form.party||items.every(it=>!it.name)) return;
    const filledItems = items.filter(it=>it.name);
    // "المدفوع" مش قابل للتعديل المباشر وإحنا بنعدّل فاتورة موجودة — أي دفعة
    // جديدة لازم تعدّي من نافذة "سداد الديون" المخصصة عشان تتسجل صح بكل تفاصيلها.
    const paidFinal = editingInvoice ? (editingInvoice.paid||0) : paid;
    const isFullyPaidNow = paidFinal >= total && total > 0;
    const initialPayments = (!editingInvoice && paid > 0) ? [{
      amount: paid,
      date: form.date,
      time: new Date().toLocaleTimeString("ar-EG", { hour:"2-digit", minute:"2-digit" }),
      by: "—",
    }] : (editingInvoice ? (editingInvoice.payments || []) : []);
    onSave({
      id: editingInvoice ? editingInvoice.id : (isS?"S":"P") + Date.now().toString().slice(-6),
      type: isS ? "sale" : "purchase",
      date: form.date,
      [isS?"client":"supplier"]: form.party,
      items: filledItems,
      subtotal, taxRate: isS && form.taxEnabled ? parseFloat(form.taxRate)||0 : 0,
      taxAmount: isS && form.taxEnabled ? taxAmount : 0,
      amount: total, paid: paidFinal,
      status: paidFinal >= total ? "مدفوعة" : paidFinal > 0 ? "جزئية" : "غير مدفوعة",
      paymentMethod: form.paymentMethod,
      checkNumber: form.checkNumber,
      checkDate: form.checkDate,
      notes: form.notes,
      createdAt: editingInvoice ? editingInvoice.createdAt : new Date().toISOString(),
      payments: initialPayments,
      paidCompletedAt: editingInvoice ? (editingInvoice.paidCompletedAt || null) : (isFullyPaidNow ? new Date().toISOString() : null),
    });
  };

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:18 }}>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
        <DatePicker label="التاريخ" value={form.date} onChange={v=>setForm({...form,date:v})} />
        {/* Client/Supplier selector with quick-add */}
        <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>{isS?"العميل":"المورد"}</label>
            <button onClick={()=>setShowQuickAdd(p=>!p)} style={{ background:showQuickAdd?C.accentDim:"transparent",color:C.accent,border:`1px solid ${C.accent}33`,borderRadius:7,padding:"2px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4 }}>
              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              {isS?"إضافة عميل":"إضافة مورد"}
            </button>
          </div>
          <select value={form.party} onChange={e=>setForm({...form,party:e.target.value})}
            style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 13px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none" }}>
            <option value="">-- اختر {isS?"العميل":"المورد"} --</option>
            {partyList.map(p=><option key={p.id??p.name} value={p.name}>{p.name}</option>)}
          </select>
          {showQuickAdd && (
            <div style={{ background:C.accentDim,border:`1px solid ${C.accent}33`,borderRadius:10,padding:"12px 14px",display:"flex",flexDirection:"column",gap:8,marginTop:2 }}>
              <div style={{ fontSize:12,fontWeight:700,color:C.accent }}>➕ {isS?"إضافة عميل جديد":"إضافة مورد جديد"}</div>
              <input value={quickName} onChange={e=>setQuickName(e.target.value)} placeholder={isS?"اسم العميل *":"اسم المورد *"}
                style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 10px",color:C.text,fontSize:12,fontFamily:"inherit",outline:"none" }} />
              <input value={quickPhone} onChange={e=>setQuickPhone(e.target.value)} placeholder="رقم الهاتف (اختياري)"
                style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 10px",color:C.text,fontSize:12,fontFamily:"inherit",outline:"none" }} />
              <div style={{ display:"flex",gap:8 }}>
                <button onClick={handleQuickAdd} disabled={!quickName.trim()} style={{ flex:1,background:quickName.trim()?C.accent:C.surface3,color:quickName.trim()?"#fff":C.textMuted,border:"none",borderRadius:8,padding:"7px 0",fontSize:12,fontWeight:700,cursor:quickName.trim()?"pointer":"not-allowed",fontFamily:"inherit" }}>
                  إضافة وتحديد
                </button>
                <button onClick={()=>{setShowQuickAdd(false);setQuickName("");setQuickPhone("");}} style={{ background:C.surface2,color:C.textDim,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </div>
        {isS && (
          <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
              <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>نسبة الضريبة %</label>
              <button type="button" onClick={()=>setForm({...form,taxEnabled:!form.taxEnabled})}
                title={form.taxEnabled?"إيقاف الضريبة عن الفاتورة":"تفعيل الضريبة على الفاتورة"}
                style={{ width:38,height:20,borderRadius:20,border:"none",cursor:"pointer",background:form.taxEnabled?C.green:C.surface3,position:"relative",padding:0,flexShrink:0 }}>
                <span style={{ position:"absolute",top:2,right:form.taxEnabled?20:2,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"right 0.2s" }} />
              </button>
            </div>
            {form.taxEnabled && (
              <input type="number" value={form.taxRate} onChange={e=>setForm({...form,taxRate:e.target.value})} placeholder="14"
                style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 13px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none" }}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border} />
            )}
          </div>
        )}
        {editingInvoice ? (
          <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
            <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>المدفوع</label>
            <div style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 13px",color:C.textDim,fontSize:13 }}>
              {fmt(editingInvoice.paid||0)}
            </div>
            <span style={{ fontSize:10,color:C.textMuted }}>لتسجيل دفعة جديدة استخدم زرار "سداد الديون" من قائمة الفواتير</span>
          </div>
        ) : (
          <Inp label={isS?"المدفوع مقدماً":"المدفوع"} type="number" value={form.paid} onChange={v=>setForm({...form,paid:v})} placeholder="0" />
        )}
        <Sel label="طريقة الدفع" value={form.paymentMethod} onChange={v=>setForm({...form,paymentMethod:v})} options={[{value:"نقدي",label:"💵 نقدي"},{value:"شيك",label:"📄 شيك"},{value:"تحويل",label:"🏦 تحويل بنكي"},{value:"فيزا",label:"💳 فيزا"}]} />
        {form.paymentMethod==="شيك" && <Inp label="رقم الشيك" value={form.checkNumber} onChange={v=>setForm({...form,checkNumber:v})} placeholder="رقم الشيك..." />}
        {form.paymentMethod==="شيك" && <DatePicker label="تاريخ الشيك" value={form.checkDate} onChange={v=>setForm({...form,checkDate:v})} />}
      </div>
      <div>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
          <label style={{ fontSize:13,fontWeight:600,color:C.textDim }}>الأصناف</label>
          <Btn small onClick={addItem}><Ic d={I.plus} s={12} />إضافة صنف</Btn>
        </div>
        <div style={{ background:C.surface2,borderRadius:12,border:`1px solid ${C.border}`,overflowX:"auto",WebkitOverflowScrolling:"touch" }}>
          <table style={{ width:"100%",minWidth:640,borderCollapse:"collapse" }}>
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
                  <td style={{ padding:"6px 10px", position:"relative" }}>
                    <input
                      value={it.name}
                      onChange={e=>handleItemNameChange(i, e.target.value, e)}
                      onFocus={e=>handleItemFocus(i, e)}
                      onBlur={()=>setTimeout(()=>{ setItemSuggestions(prev=>({...prev,[i]:[]})); setActiveItemIdx(null); setDropdownPos(null); }, 180)}
                      placeholder="ابحث أو اختر صنف من القائمة"
                      style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 8px",color:C.text,fontSize:12,fontFamily:"inherit",width:"100%",direction:"rtl",textAlign:"right" }} />
                    {(() => {
                      const matched = it.name ? (inventory||[]).find(inv => inv.name === it.name) : null;
                      return matched ? (
                        <div style={{ fontSize:10,color:C.textMuted,marginTop:3 }}>
                          الوحدة: {matched.unit||"—"} · الرصيد الحالي: <span style={{ color: matched.qty<=matched.minQty?C.red:C.text, fontWeight:700 }}>{matched.qty}</span>
                        </div>
                      ) : null;
                    })()}
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
          { label:`ضريبة ${form.taxRate}%`,val:fmt(taxAmount),color:C.yellow,show:isS && form.taxEnabled },
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
        <Btn onClick={handleSave}>{editingInvoice ? "حفظ التعديلات" : "حفظ الفاتورة"}</Btn>
      </div>
      {activeItemIdx !== null && dropdownPos && (itemSuggestions[activeItemIdx]||[]).length > 0 && createPortal(
        <div style={{
          position:"absolute", top:dropdownPos.top, left:dropdownPos.left, width:Math.max(dropdownPos.width,260),
          zIndex:99999, background:C.surface, border:`1px solid ${C.accent}44`, borderRadius:10,
          boxShadow:"0 12px 34px rgba(0,0,0,0.5)", display:"flex", flexDirection:"column", direction:"rtl",
        }}>
          <div style={{ maxHeight:230, overflowY:"auto" }}>
            {(itemSuggestions[activeItemIdx]||[]).map(inv=>(
              <div key={inv.id} onMouseDown={()=>selectSuggestion(activeItemIdx, inv)}
                style={{ padding:"8px 12px",cursor:"pointer",borderBottom:`1px solid ${C.border}20`,display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12 }}
                onMouseEnter={e=>e.currentTarget.style.background=C.accentDim}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div>
                  <div style={{ fontWeight:700,color:C.text }}>{inv.name}</div>
                  <div style={{ fontSize:10,color:C.textMuted }}>{inv.category} · {inv.unit||"قطعة"} · الرصيد: {inv.qty}</div>
                </div>
                <div style={{ textAlign:"left" }}>
                  <div style={{ color:C.green,fontWeight:700 }}>{fmt(isS?inv.price:inv.cost)}</div>
                  {inv.qty <= inv.minQty && <div style={{ fontSize:10,color:C.red }}>⚠ منخفض</div>}
                </div>
              </div>
            ))}
          </div>
          <div onMouseDown={()=>openQuickAddItem(activeItemIdx)}
            style={{ padding:"9px 12px",cursor:"pointer",fontSize:12,fontWeight:700,color:C.accent,textAlign:"center",borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",gap:6,flexShrink:0 }}>
            <Ic d={I.plus} s={12} />إضافة صنف جديد
          </div>
        </div>,
        document.body
      )}
      {quickAddItemIdx !== null && (
        <Modal title="إضافة صنف جديد" onClose={()=>setQuickAddItemIdx(null)}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <Inp label="اسم الصنف *" value={quickItemForm.name} onChange={v=>setQuickItemForm({...quickItemForm,name:v})} required />
              <Sel label="الفئة" value={quickItemForm.category} onChange={v=>setQuickItemForm({...quickItemForm,category:v})} options={categories} />
              <Inp label="الكمية الحالية" type="number" value={quickItemForm.qty} onChange={v=>setQuickItemForm({...quickItemForm,qty:v})} />
              <Inp label="الحد الأدنى" type="number" value={quickItemForm.minQty} onChange={v=>setQuickItemForm({...quickItemForm,minQty:v})} />
              <Inp label="سعر التكلفة (الشراء)" type="number" value={quickItemForm.cost} onChange={v=>setQuickItemForm({...quickItemForm,cost:v})} />
              <Inp label="سعر البيع" type="number" value={quickItemForm.price} onChange={v=>setQuickItemForm({...quickItemForm,price:v})} />
              <Inp label="وحدة القياس" value={quickItemForm.unit} onChange={v=>setQuickItemForm({...quickItemForm,unit:v})} placeholder="قطعة، كيلو، رزمة..." />
            </div>
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setQuickAddItemIdx(null)}>إلغاء</Btn>
              <Btn onClick={saveQuickAddItem}>إضافة واختيار في الفاتورة</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── INVOICES PAGE ────────────────────────────────────────────────────────────
function InvoicesPage({ title, invoices, type, clients, suppliers, categories, onAdd, onUpdate, onDelete, onAddClient, onAddSupplier, userEmail, inventory, onAddInventoryItem, onUpdateInventoryItem, returns=[], security, pageId }) {
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [partyForm, setPartyForm] = useState({ name:"", phone:"" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [shortageError, setShortageError] = useState(null); // { list, mode: "save"|"delete" }
  const { requestPasscode, PasscodeGate, log } = usePasscodeGate(security);

  const filtered = invoices.filter(i=>{
    const party = type==="sales"?i.client:i.supplier;
    return (party?.includes(search)||i.id?.includes(search)) && (!statusFilter||i.status===statusFilter);
  });

  const total = filtered.reduce((s,i)=>s+i.amount,0);
  const totalPaid = filtered.reduce((s,i)=>s+i.paid,0);
  const totalTax = filtered.reduce((s,i)=>s+(i.taxAmount||0),0);

  const sectionLabel = type==="sales"?"المبيعات":"المشتريات";
  const invoiceWord = type==="sales"?"مبيعات":"مشتريات";

  // ── حذف فاتورة: عكس كامل لتأثيرها على المخزون (كل بند بيرجع/يتشال بالكامل) ──
  const handleDelete = (inv) => {
    const party = type==="sales"?inv.client:inv.supplier;
    const paidNote = (inv.paid||0) > 0 ? ` — تم تحصيل/دفع ${fmt(inv.paid)} منها بالفعل` : "";
    requestPasscode({
      pageId, kind:"delete", label:`حذف فاتورة ${invoiceWord} ${inv.id}${paidNote}`,
      onConfirm: async () => {
        const diffs = computeItemDiffs(inv.items||[], []);
        const { ok, shortages, movements } = validateAndBuildMovements(type, diffs, inventory||[]);
        if (!ok) {
          setShortageError({ mode:"delete", list: shortages });
          return;
        }
        await applyInventoryMovements(movements, {
          type, onAddInventoryItem, onUpdateInventoryItem, security,
          invoiceLabel: `حذف فاتورة ${invoiceWord} ${inv.id} — ${party}`,
        });
        await onDelete(inv.id);
        log({ actionType:"حذف", section:sectionLabel, target:`فاتورة ${inv.id} — ${party}`, before: inv, after: null });
      },
    });
  };

  const handleEditClick = (inv) => {
    const party = type==="sales"?inv.client:inv.supplier;
    requestPasscode({
      pageId, kind:"edit", label:`تعديل فاتورة ${type==="sales"?"مبيعات":"مشتريات"}`,
      onConfirm: () => setEditingInvoice(inv),
    });
  };

  // ── الحفظ الموحّد لإضافة/تعديل فاتورة: يتحقق من فرق الأصناف على المخزون،
  // يمنع أي حالة مالية غير منطقية (تعديل ينقص الإجمالي عن المبلغ المحصّل بالفعل)،
  // وبعدين ينفّذ حركات المخزون الفعلية قبل حفظ الفاتورة نفسها. ──
  const processSave = async (inv, oldInvoice) => {
    if (oldInvoice && inv.amount < (oldInvoice.paid||0) - 0.001) {
      showPermissionToast(`لا يمكن حفظ التعديل — الإجمالي الجديد (${fmt(inv.amount)}) أقل من المبلغ المحصّل بالفعل (${fmt(oldInvoice.paid)}). راجع الأصناف أو الأسعار.`, "error");
      return;
    }
    const diffs = computeItemDiffs(oldInvoice?.items||[], inv.items||[]);
    const { ok, shortages, movements } = validateAndBuildMovements(type, diffs, inventory||[]);
    if (!ok) {
      setShortageError({ mode:"save", list: shortages });
      return;
    }
    const party = type==="sales"?inv.client:inv.supplier;
    await applyInventoryMovements(movements, {
      type, onAddInventoryItem, onUpdateInventoryItem, security,
      invoiceLabel: `فاتورة ${invoiceWord} ${inv.id} — ${party}`,
    });
    if (oldInvoice) {
      await onUpdate(inv);
      setEditingInvoice(null);
      log({ actionType:"تعديل", section:sectionLabel, target:`فاتورة ${inv.id} — ${party}`, before:oldInvoice, after:inv });
    } else {
      await onAdd(inv);
      setShowModal(false);
      log({ actionType:"إضافة", section:sectionLabel, target:`فاتورة ${inv.id} — ${party}`, before:null, after:inv });
    }
  };

  const openPayModal = (inv) => { setPayingInvoice(inv); setPaymentAmount(""); };

  const returnedAmountForInvoice = (invId) => returns
    .filter(r => (r.invoiceType||(r.type==="sale"?"sales":"purchases"))===type && r.invoiceId===invId)
    .reduce((s,r)=>s+(r.amount||0),0);

  const handleAddPayment = () => {
    if (!payingInvoice) return;
    const returnedAmt = returnedAmountForInvoice(payingInvoice.id);
    const remaining = payingInvoice.amount - (payingInvoice.paid||0) - returnedAmt;
    const amount = parseFloat(paymentAmount) || 0;
    if (amount <= 0 || amount > remaining + 0.001) return;
    const now = new Date();
    const payment = {
      amount,
      date: now.toISOString().split("T")[0],
      time: now.toLocaleTimeString("ar-EG", { hour:"2-digit", minute:"2-digit" }),
      by: security?.userLabel || "—",
    };
    const newPayments = [...(payingInvoice.payments||[]), payment];
    const newPaid = (payingInvoice.paid||0) + amount;
    const isFullyPaid = newPaid >= payingInvoice.amount - returnedAmt - 0.001;
    const updated = {
      ...payingInvoice,
      payments: newPayments,
      paid: newPaid,
      status: isFullyPaid ? "مدفوعة" : newPaid > 0 ? "جزئية" : "غير مدفوعة",
      paidCompletedAt: isFullyPaid ? (payingInvoice.paidCompletedAt || now.toISOString()) : payingInvoice.paidCompletedAt,
    };
    onUpdate(updated);
    setPayingInvoice(updated);
    setPaymentAmount("");
    const party = type==="sales"?payingInvoice.client:payingInvoice.supplier;
    log({
      actionType:"سداد دفعة", section:sectionLabel, target:`فاتورة ${payingInvoice.id} — ${party}`,
      before: { paid: payingInvoice.paid||0, status: payingInvoice.status },
      after: { paid: newPaid, status: updated.status, paymentAmount: amount },
    });
  };

  const handleAddParty = () => {
    if (!partyForm.name.trim()) return;
    const isS = type === "sales";
    const record = { id:(isS?"C":"SP")+Date.now().toString().slice(-5), name:partyForm.name.trim(), phone:partyForm.phone.trim(), balance:0 };
    if (isS && onAddClient) onAddClient(record);
    else if (!isS && onAddSupplier) onAddSupplier(record);
    setPartyForm({ name:"", phone:"" });
    setShowAddPartyModal(false);
  };

  const isS = type === "sales";

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      {shortageError && (
        <Modal title={shortageError.mode==="delete" ? "لا يمكن حذف الفاتورة" : "لا يمكن حفظ الفاتورة"} onClose={()=>setShortageError(null)}>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ fontSize:13,color:C.red,fontWeight:600 }}>
              {type==="sales"
                ? "الكميات التالية غير متوفرة في المخزون:"
                : "تعديل/حذف هذه الفاتورة سيؤدي إلى رصيد سالب في الأصناف التالية (تم استخدام جزء من الكمية بالفعل):"}
            </div>
            {shortageError.list.map((s,i)=>(
              <div key={i} style={{ background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",fontSize:13 }}>
                <span style={{ fontWeight:700 }}>{s.name}</span>
                <span style={{ color:C.textDim }}>مطلوب {s.required} — متاح {s.available}</span>
              </div>
            ))}
            <div style={{ display:"flex",justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setShortageError(null)}>حسنًا</Btn>
            </div>
          </div>
        </Modal>
      )}
      {PasscodeGate}
      {showAddPartyModal && (
        <Modal title={isS?"إضافة عميل جديد":"إضافة مورد جديد"} onClose={()=>setShowAddPartyModal(false)}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <Inp label={isS?"اسم العميل *":"اسم المورد *"} value={partyForm.name} onChange={v=>setPartyForm({...partyForm,name:v})} required />
            <Inp label="رقم الهاتف" value={partyForm.phone} onChange={v=>setPartyForm({...partyForm,phone:v})} placeholder="01xxxxxxxxx" />
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setShowAddPartyModal(false)}>إلغاء</Btn>
              <Btn onClick={handleAddParty}>حفظ</Btn>
            </div>
          </div>
        </Modal>
      )}
      <PageHeader title={title} icon={type==="sales"?I.sales:I.purchase} subtitle={`${filtered.length} فاتورة`}
        action={
          <div style={{ display:"flex",gap:8 }}>
            <Btn variant="ghost" onClick={()=>setShowAddPartyModal(true)}>
              <Ic d={I.userPlus} s={14} />{isS?"إضافة عميل":"إضافة مورد"}
            </Btn>
            <Btn onClick={()=>setShowModal(true)}><Ic d={I.plus} s={14} />فاتورة جديدة</Btn>
          </div>
        } />
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
                const invReturns = returns.filter(r=>(r.invoiceType||(r.type==="sale"?"sales":"purchases"))===type && r.invoiceId===inv.id);
                const returnedAmount = invReturns.reduce((s,r)=>s+(r.amount||0),0);
                const remaining = inv.amount - inv.paid - returnedAmount;
                const originalQtyTotal = (inv.items||[]).reduce((s,it)=>s+(parseFloat(it.qty)||0),0);
                const returnedQtyTotal = invReturns.reduce((s,r)=>s+(r.items||[]).reduce((s2,it)=>s2+(parseFloat(it.qty)||0),0),0);
                const returnLabel = returnedAmount<=0 ? null : (returnedQtyTotal>=originalQtyTotal ? "مرتجع بالكامل" : "مرتجع جزئي");
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
                    <td style={{ padding:"11px 14px" }}>
                      <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                        <Badge label={inv.status} />
                        {returnLabel && <span style={{ fontSize:10,fontWeight:700,color:C.purple,background:C.purpleDim,border:`1px solid ${C.purple}33`,borderRadius:20,padding:"2px 8px" }}>↩ {returnLabel}</span>}
                      </div>
                    </td>
                    <td style={{ padding:"11px 14px" }}>
                      <button onClick={()=>printInvoice(inv,type,invReturns)} title="طباعة" style={{ background:"none",border:"none",cursor:"pointer",color:C.blue }}><Ic d={I.print} s={14} /></button>
                    </td>
                    <td style={{ padding:"11px 14px" }}>
                      <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                        {remaining > 0 && (
                          <button onClick={()=>openPayModal(inv)} style={{ background:C.greenDim,color:C.green,border:`1px solid ${C.green}33`,borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4 }}>
                            <Ic d={I.money} s={12} />سداد الديون
                          </button>
                        )}
                        <button onClick={()=>handleEditClick(inv)} style={{ background:"none",border:"none",cursor:"pointer",color:C.accent }}><Ic d={I.edit} s={14} /></button>
                        <button onClick={()=>handleDelete(inv)} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted }}><Ic d={I.trash} s={14} /></button>
                      </div>
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
            onSave={inv=>processSave(inv, null)} onClose={()=>setShowModal(false)}
            onAddClient={onAddClient} onAddSupplier={onAddSupplier}
            inventory={inventory||[]}
            onAddInventoryItem={onAddInventoryItem} />
        </Modal>
      )}
      {editingInvoice && (
        <Modal title={`تعديل فاتورة ${type==="sales"?"مبيعات":"مشتريات"}`} onClose={()=>setEditingInvoice(null)} wide>
          <InvoiceForm type={type} clients={clients} suppliers={suppliers} categories={categories}
            editingInvoice={editingInvoice}
            onSave={inv=>processSave(inv, editingInvoice)} onClose={()=>setEditingInvoice(null)}
            onAddClient={onAddClient} onAddSupplier={onAddSupplier}
            inventory={inventory||[]}
            onAddInventoryItem={onAddInventoryItem} />
        </Modal>
      )}
      {payingInvoice && (
        <Modal title={`سداد الديون — فاتورة ${payingInvoice.id}`} onClose={()=>setPayingInvoice(null)}>
          <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10 }}>
              <MiniStat label="إجمالي الفاتورة" value={fmt(payingInvoice.amount)} color={C.accent} />
              <MiniStat label="المدفوع" value={fmt(payingInvoice.paid||0)} color={C.green} />
              <MiniStat label="المتبقي" value={fmt(payingInvoice.amount-(payingInvoice.paid||0)-returnedAmountForInvoice(payingInvoice.id))} color={C.red} />
            </div>

            {(payingInvoice.payments||[]).length > 0 && (
              <div>
                <div style={{ fontSize:13,fontWeight:700,color:C.text,marginBottom:8 }}>سجل الدفعات</div>
                <div style={{ background:C.surface2,borderRadius:10,overflow:"hidden",border:`1px solid ${C.border}`,maxHeight:200,overflowY:"auto" }}>
                  <table style={{ width:"100%",borderCollapse:"collapse" }}>
                    <THead cols={["قيمة الدفعة","التاريخ","الوقت","سجّلها"]} />
                    <tbody>
                      {payingInvoice.payments.map((p,idx)=>(
                        <TRow key={idx} alt={idx%2}>
                          <TD mono color={C.green}><span style={{ fontWeight:700 }}>{fmt(p.amount)}</span></TD>
                          <TD color={C.textDim}>{p.date}</TD>
                          <TD color={C.textMuted}>{p.time}</TD>
                          <TD color={C.textMuted}>{p.by||"—"}</TD>
                        </TRow>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {payingInvoice.amount - (payingInvoice.paid||0) - returnedAmountForInvoice(payingInvoice.id) > 0.001 ? (
              <div style={{ display:"flex",gap:10,alignItems:"flex-end" }}>
                <div style={{ flex:1 }}>
                  <Inp label="قيمة الدفعة الجديدة" type="number" value={paymentAmount} onChange={setPaymentAmount} placeholder={`الحد الأقصى ${fmt(payingInvoice.amount-(payingInvoice.paid||0)-returnedAmountForInvoice(payingInvoice.id))}`} />
                </div>
                <Btn variant="success" onClick={handleAddPayment}><Ic d={I.money} s={13} />تسجيل الدفعة</Btn>
              </div>
            ) : (
              <div style={{ background:C.greenDim,border:`1px solid ${C.green}33`,borderRadius:10,padding:"12px 16px",color:C.green,fontWeight:700,textAlign:"center" }}>
                ✅ تم السداد بالكامل
              </div>
            )}

            <div style={{ display:"flex",justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setPayingInvoice(null)}>إغلاق</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default InvoicesPage;
export { InvoiceForm, InvoicesPage };
