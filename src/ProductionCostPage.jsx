import { useState, useEffect } from "react";
import { C, Ic, I, fmt, today, Card, MiniStat, Btn, DatePicker, Inp, Modal, THead, TRow, TD, PageHeader } from "./shared";

// ══════════════════════════════════════════════════════════════════════════════
// ProductionCostPage.jsx — حساب تكلفة الإنتاج للمصانع/الورش.
// ══════════════════════════════════════════════════════════════════════════════

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

    // ── أضف/حدّث المنتج في المخزون ──
    if (actions) {
      const qty = parseFloat(form.quantity)||1;
      const existingItem = (data?.inventory||[]).find(i =>
        i.name?.trim().toLowerCase() === form.productName.trim().toLowerCase()
      );
      if (existingItem) {
        // حدّث الكمية بالزيادة
        actions.updateInventoryItem({
          ...existingItem,
          qty: (existingItem.qty||0) + qty,
          cost: Math.round(costPerUnit) || existingItem.cost,
        });
      } else {
        // أضف صنف جديد
        actions.addInventoryItem({
          id: "INV" + Date.now().toString().slice(-5),
          name: form.productName.trim(),
          category: "إنتاج",
          qty,
          minQty: 0,
          cost: Math.round(costPerUnit),
          price: Math.round(costPerUnit * 1.2),
          unit: form.unit || "قطعة",
        });
      }
    }

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
              <DatePicker label="التاريخ" value={form.date} onChange={v=>setForm({...form,date:v})} />
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

export default ProductionCostPage;
