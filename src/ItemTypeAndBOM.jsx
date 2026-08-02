import { useState } from "react";
import { C, Ic, I, Btn, Sel, THead, TRow, TD } from "./shared";

// ══════════════════════════════════════════════════════════════════════════════
// ItemTypeAndBOM.jsx — قسم "نوع الصنف" و"تركيبة المنتج (BOM)" الجاهز للتضمين
// داخل صفحة إضافة/تعديل الصنف الموجودة عندك (مش صفحة مستقلة).
//
// طريقة الاستخدام داخل صفحة الصنف (مثال):
//
//   import ItemTypeAndBOMFields from "./ItemTypeAndBOM";
//   ...
//   const [form, setForm] = useState({ ..., itemType: "raw", bom: [] });
//   ...
//   <ItemTypeAndBOMFields
//     itemType={form.itemType}
//     onItemTypeChange={(v)=>setForm({...form, itemType:v})}
//     bom={form.bom}
//     onBomChange={(bom)=>setForm({...form, bom})}
//     inventory={data.inventory}
//     currentItemId={form.id}
//   />
//
// وعند الحفظ، خزّن form.itemType و form.bom كما هما جوه سجل الصنف نفسه
// (actions.addInventoryItem / updateInventoryItem) — صفحة تكلفة الإنتاج
// بتقرأ منهم مباشرة (item.itemType === "finished" و item.bom).
//
// item.itemType: "raw" | "finished" | "service"
// item.bom: [{ materialId, materialName, qtyPerUnit, unit }]
// ══════════════════════════════════════════════════════════════════════════════

const ITEM_TYPE_OPTIONS = [
  { value: "raw", label: "مادة خام (Raw Material)" },
  { value: "finished", label: "منتج نهائي (Finished Product)" },
  { value: "service", label: "خدمة (Service)" },
];

function ItemTypeAndBOMFields({ itemType, onItemTypeChange, bom = [], onBomChange, inventory = [], currentItemId }) {
  const [newMaterialId, setNewMaterialId] = useState("");

  // المواد الخام المتاحة للاختيار = كل صنف نوعه "مادة خام"، ما عدا الصنف الحالي نفسه
  const rawMaterials = inventory.filter(i => i.itemType === "raw" && i.id !== currentItemId);

  const addLine = () => {
    if (!newMaterialId) return;
    if (bom.some(b => b.materialId === newMaterialId)) return; // منع تكرار نفس المادة
    const material = inventory.find(i => i.id === newMaterialId);
    onBomChange([...bom, { materialId: newMaterialId, materialName: material?.name || "", unit: material?.unit || "قطعة", qtyPerUnit: 1 }]);
    setNewMaterialId("");
  };

  const updateLine = (idx, field, val) => {
    onBomChange(bom.map((b,i) => i===idx ? { ...b, [field]: field==="qtyPerUnit" ? val : val } : b));
  };

  const removeLine = (idx) => onBomChange(bom.filter((_,i)=>i!==idx));

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
      <Sel label="نوع الصنف" value={itemType||"raw"} onChange={onItemTypeChange} options={ITEM_TYPE_OPTIONS} placeholder="اختر نوع الصنف" />

      {itemType === "finished" && (
        <div>
          <div style={{ fontSize:13,fontWeight:700,color:C.textDim,marginBottom:8 }}>تركيبة المنتج (Bill of Materials - BOM)</div>
          <p style={{ fontSize:11,color:C.textMuted,margin:"0 0 10px" }}>حدّد المواد الخام التي تدخل في تصنيع وحدة واحدة من هذا المنتج. صفحة تكلفة الإنتاج هتستخدم الكميات دي تلقائيًا وتضربها في كمية الإنتاج المطلوبة.</p>

          <div style={{ display:"flex",gap:8,marginBottom:12 }}>
            <div style={{ flex:1 }}>
              <Sel value={newMaterialId} onChange={setNewMaterialId}
                options={rawMaterials.map(m=>({value:m.id,label:m.name}))} placeholder="اختر مادة خام لإضافتها" />
            </div>
            <Btn small onClick={addLine}><Ic d={I.plus} s={12} />إضافة</Btn>
          </div>

          {rawMaterials.length === 0 && (
            <div style={{ background:C.surface2,borderRadius:10,padding:12,fontSize:12,color:C.textMuted,textAlign:"center",marginBottom:10 }}>
              لا توجد أصناف من نوع "مادة خام" بعد. أضِف أصناف المواد الخام أولاً واختر نوعها "مادة خام".
            </div>
          )}

          {bom.length > 0 && (
            <div style={{ background:C.surface2,borderRadius:12,overflowX:"auto",border:`1px solid ${C.border}` }}>
              <table style={{ width:"100%",minWidth:420,borderCollapse:"collapse" }}>
                <THead cols={["المادة الخام","الكمية لإنتاج وحدة واحدة","الوحدة",""]} />
                <tbody>
                  {bom.map((b,i)=>(
                    <TRow key={b.materialId} alt={i%2}>
                      <TD>{b.materialName}</TD>
                      <td style={{ padding:"6px 10px" }}>
                        <input type="number" value={b.qtyPerUnit} onChange={e=>updateLine(i,"qtyPerUnit",parseFloat(e.target.value)||0)}
                          style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 8px",color:C.text,fontSize:12,fontFamily:"inherit",width:90 }} />
                      </td>
                      <TD color={C.textDim}>{b.unit}</TD>
                      <td style={{ padding:"6px 10px" }}>
                        <button onClick={()=>removeLine(i)} style={{ background:"none",border:"none",cursor:"pointer",color:C.red }}><Ic d={I.trash} s={14} /></button>
                      </td>
                    </TRow>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ItemTypeAndBOMFields;
