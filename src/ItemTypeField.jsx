import { Sel } from "./shared";

// ══════════════════════════════════════════════════════════════════════════════
// ItemTypeField.jsx — حقل "نوع الصنف" الجاهز للتضمين داخل صفحة إضافة/تعديل
// الصنف الموجودة عندك (مش صفحة مستقلة).
//
// ⚠️ تحديث: تركيبة المنتج (BOM) اتشالت من هنا بالكامل بناءً على طلبك — إدارة
// الـ BOM بقت قسم مستقل جوه صفحة "تكلفة الإنتاج" (ProductionCostPage.jsx)
// اسمه "إدارة تركيبات المنتجات (BOM)"، مش هنا. أي صنف — بغض النظر عن نوعه —
// ممكن يتحط له تركيبة من هناك مباشرة، فمفيش أي اعتماد على الحقل ده لتحديد
// "هل الصنف منتج بيتصنّع ولا لأ" — الاعتماد بقى على وجود تركيبة محفوظة له
// (item.bom) مش على item.itemType.
//
// الحقل ده بقى اختياري تمامًا ومفيدله بس لو حابب تصنّف/تفلتر الأصناف بصريًا
// (مادة خام / منتج نهائي / خدمة) — احذفه من صفحة الصنف براحتك لو مش محتاجه.
//
// طريقة الاستخدام داخل صفحة الصنف (مثال):
//
//   import ItemTypeField from "./ItemTypeField";
//   ...
//   const [form, setForm] = useState({ ..., itemType: "raw" });
//   ...
//   <ItemTypeField itemType={form.itemType} onItemTypeChange={(v)=>setForm({...form, itemType:v})} />
//
// وعند الحفظ، خزّن form.itemType كما هو جوه سجل الصنف (actions.addInventoryItem
// / updateInventoryItem).
//
// item.itemType: "raw" | "finished" | "service"
// ══════════════════════════════════════════════════════════════════════════════

const ITEM_TYPE_OPTIONS = [
  { value: "raw", label: "مادة خام (Raw Material)" },
  { value: "finished", label: "منتج نهائي (Finished Product)" },
  { value: "service", label: "خدمة (Service)" },
];

function ItemTypeField({ itemType, onItemTypeChange }) {
  return (
    <Sel label="نوع الصنف" value={itemType || "raw"} onChange={onItemTypeChange}
      options={ITEM_TYPE_OPTIONS} placeholder="اختر نوع الصنف" />
  );
}

export default ItemTypeField;
