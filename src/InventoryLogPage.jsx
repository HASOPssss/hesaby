import { useState, useEffect } from "react";
import {
  supabase, C, Ic, I, fmt, fmtNum, today, openPrint, getCompanyBranding, logInventoryMovement,
  Card, MiniStat, Btn, Inp, Sel, DatePicker, Modal, THead, TRow, TD, PageHeader,
} from "./shared";

// ══════════════════════════════════════════════════════════════════════════════
// InventoryLogPage.jsx — سجل المخزون (Inventory Log): تتبع كل حركات دخول/خروج
// الأصناف من المخزن. الوصول لصاحب الشركة، المشرف (Supervisor)، وأي مستخدم
// معاه صلاحية "إدارة المخزون". الصفحة للقراءة فقط بعد التسجيل — أي خطأ يتصحح
// بحركة تصحيح جديدة، مش بتعديل الحركة الأصلية.
// ══════════════════════════════════════════════════════════════════════════════

function InventoryLogPage({ inventory, onUpdateInventoryItem, security, pageId, userId }) {
  const ownerId = security?.ownerId || userId;
  const canView = !security || security.canViewInventoryLog;

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [showMove, setShowMove] = useState(null); // "in" | "out" | null
  const [moveForm, setMoveForm] = useState({ itemId:"", qty:"", reason:"", notes:"" });
  const [itemSuggestions, setItemSuggestions] = useState([]);
  const [itemSearch, setItemSearch] = useState("");

  const fetchLog = () => {
    if (!ownerId || !canView) { setLoading(false); return; }
    setLoading(true);
    supabase.from("inventory_log").select("*").eq("owner_id", ownerId).order("created_at", { ascending:false }).limit(2000)
      .then(({ data }) => setEntries(data || []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLog(); /* eslint-disable-next-line */ }, [ownerId, canView]);

  if (!canView) {
    return (
      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"80px 20px",gap:14 }}>
        <div style={{ background:C.redDim,padding:16,borderRadius:16 }}><Ic d={I.shield} s={32} c={C.red} /></div>
        <h3 style={{ margin:0,fontSize:16,color:C.text }}>غير مصرح لك بالوصول لهذه الصفحة</h3>
        <p style={{ margin:0,fontSize:13,color:C.textMuted,textAlign:"center" }}>سجل المخزون متاح لصاحب الشركة، المشرف، ومن لديه صلاحية إدارة المخزون فقط.</p>
      </div>
    );
  }

  const users = [...new Set(entries.map(e=>e.full_name||e.user_name).filter(Boolean))];

  const filtered = entries.filter(e => {
    const s = search.trim();
    const matchSearch = !s || e.item_name?.includes(s);
    const matchType = !typeFilter || e.movement_type === typeFilter;
    const matchUser = !userFilter || (e.full_name||e.user_name) === userFilter;
    const day = e.created_at ? e.created_at.slice(0,10) : "";
    const matchFrom = !dateFrom || day >= dateFrom;
    const matchTo = !dateTo || day <= dateTo;
    return matchSearch && matchType && matchUser && matchFrom && matchTo;
  });

  const fmtDT = (iso) => { try { return new Date(iso).toLocaleString("ar-EG",{ year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit" }); } catch { return iso||"—"; } };

  const totalIn = entries.filter(e=>e.movement_type==="in").reduce((s,e)=>s+(e.qty||0),0);
  const totalOut = entries.filter(e=>e.movement_type==="out").reduce((s,e)=>s+(e.qty||0),0);

  // ── فتح مودال الحركة ──
  const openMove = (type) => {
    setMoveForm({ itemId:"", qty:"", reason:"", notes:"" });
    setItemSearch("");
    setItemSuggestions([]);
    setShowMove(type);
  };

  const handleItemSearch = (val) => {
    setItemSearch(val);
    setMoveForm(prev=>({...prev, itemId:""}));
    if (!val.trim()) { setItemSuggestions((inventory||[]).slice(0,8)); return; }
    const q = val.trim().toLowerCase();
    setItemSuggestions((inventory||[]).filter(inv=>inv.name?.toLowerCase().includes(q)).slice(0,8));
  };

  const pickItem = (inv) => {
    setMoveForm(prev=>({...prev, itemId:inv.id}));
    setItemSearch(inv.name);
    setItemSuggestions([]);
  };

  const selectedItem = (inventory||[]).find(inv=>inv.id===moveForm.itemId);

  const handleSaveMove = () => {
    if (!selectedItem || !moveForm.qty || parseFloat(moveForm.qty) <= 0) return;
    const qty = parseFloat(moveForm.qty);
    const balanceBefore = selectedItem.qty || 0;
    const balanceAfter = showMove === "in" ? balanceBefore + qty : Math.max(0, balanceBefore - qty);

    // تحديث رصيد الصنف
    onUpdateInventoryItem({ ...selectedItem, qty: balanceAfter });

    // تسجيل الحركة في سجل المخزون
    logInventoryMovement(ownerId, {
      itemId: selectedItem.id, itemName: selectedItem.name, movementType: showMove,
      qty, balanceBefore, balanceAfter,
      reason: moveForm.reason, notes: moveForm.notes,
      userName: security?.userLabel, fullName: security?.userLabel,
    });

    setShowMove(null);
    setTimeout(fetchLog, 500); // نديها شوية وقت تتسجل قبل ما نجيبها تاني
  };

  // ── تصدير Excel (CSV) ──
  const exportExcel = () => {
    const headers = ["نوع الحركة","الصنف","الكمية","الرصيد قبل","الرصيد بعد","المستخدم","الوقت","السبب","ملاحظات"];
    const rows = filtered.map(e => [
      e.movement_type==="in"?"دخول":"خروج", e.item_name||"", e.qty||0, e.balance_before??"", e.balance_after??"",
      e.full_name||e.user_name||"", fmtDT(e.created_at), e.reason||"", (e.notes||"").replace(/\n/g," "),
    ]);
    const csv = "\uFEFF" + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `سجل_المخزون_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── تصدير PDF ──
  const exportPDF = () => {
    const { name: companyName, logo: companyLogo } = getCompanyBranding();
    const logoHtml = companyLogo ? `<img src="${companyLogo}" style="width:40px;height:40px;object-fit:cover;border-radius:8px;margin-left:10px" />` : "";
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>سجل المخزون</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo','Segoe UI',sans-serif;background:#fff;color:#1a1a2e;padding:30px}
    .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #6c7fff}
    table{width:100%;border-collapse:collapse;font-size:10px}thead tr{background:#6c7fff;color:#fff}
    thead th{padding:6px 8px;font-weight:700;text-align:right}tbody tr:nth-child(even){background:#f8faff}
    tbody td{padding:6px 8px;border-bottom:1px solid #e2e8f0}.in{color:#16a34a;font-weight:700}.out{color:#dc2626;font-weight:700}
    .footer{margin-top:20px;text-align:center;font-size:10px;color:#94a3b8}
    @media print{body{padding:15px}}</style></head><body>
    <div class="header"><div style="display:flex;align-items:center">${logoHtml}<div style="font-size:18px;font-weight:800">سجل المخزون</div></div>
    <div style="text-align:left"><div style="font-weight:700;color:#6c7fff">${companyName}</div><div style="font-size:11px;color:#64748b">${new Date().toLocaleDateString("ar-EG")} — ${filtered.length} حركة</div></div></div>
    <table><thead><tr><th>النوع</th><th>الصنف</th><th>الكمية</th><th>قبل</th><th>بعد</th><th>المستخدم</th><th>الوقت</th></tr></thead><tbody>
    ${filtered.map(e=>`<tr><td class="${e.movement_type}">${e.movement_type==="in"?"دخول":"خروج"}</td><td>${e.item_name||"—"}</td><td>${e.qty}</td><td>${e.balance_before??"—"}</td><td>${e.balance_after??"—"}</td><td>${e.full_name||e.user_name||"—"}</td><td>${fmtDT(e.created_at)}</td></tr>`).join("")}
    </tbody></table>
    <div class="footer">${companyName} — hesapy.pro</div>
    </body></html>`;
    openPrint(html);
  };

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      <PageHeader title="سجل المخزون" icon={I.stocktake} subtitle={`${filtered.length} من ${entries.length} حركة`}
        action={
          <div style={{ display:"flex",gap:8 }}>
            <Btn variant="success" onClick={()=>openMove("in")}><Ic d={I.plus} s={13} />إضافة حركة دخول</Btn>
            <Btn variant="danger" onClick={()=>openMove("out")}><Ic d={I.trash} s={13} />إضافة حركة خروج</Btn>
          </div>
        }
      />

      <div style={{ background:C.accentDim,border:`1px solid ${C.accent}22`,borderRadius:12,padding:"12px 16px",fontSize:12,color:C.accent }}>
        🔒 السجل ده للقراءة فقط — مفيش تعديل أو حذف لأي حركة بعد تسجيلها. لو فيه خطأ، سجّل حركة تصحيح جديدة بدل ما تلمس القديمة.
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
        <MiniStat label="إجمالي الحركات" value={entries.length} color={C.accent} icon={I.chartBar} />
        <MiniStat label="حركات دخول" value={fmtNum(totalIn)} color={C.green} icon={I.plus} />
        <MiniStat label="حركات خروج" value={fmtNum(totalOut)} color={C.red} icon={I.trash} />
        <MiniStat label="عدد الأصناف المتحركة" value={new Set(entries.map(e=>e.item_name)).size} color={C.yellow} icon={I.box} />
      </div>

      <Card>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10 }}>
          <Inp label="بحث باسم الصنف" value={search} onChange={setSearch} placeholder="اسم الصنف..." />
          <Sel label="نوع الحركة" value={typeFilter} onChange={setTypeFilter} options={[{value:"",label:"الكل"},{value:"in",label:"دخول"},{value:"out",label:"خروج"}]} />
          <Sel label="المستخدم" value={userFilter} onChange={setUserFilter} options={[{value:"",label:"الكل"}, ...users.map(u=>({value:u,label:u}))]} />
          <DatePicker label="من تاريخ" value={dateFrom} onChange={setDateFrom} />
          <DatePicker label="إلى تاريخ" value={dateTo} onChange={setDateTo} />
        </div>
        <div style={{ display:"flex",gap:8,marginTop:12,justifyContent:"flex-end" }}>
          <Btn variant="yellow" small onClick={exportExcel}><Ic d={I.download} s={12} />تصدير Excel</Btn>
          <Btn variant="cyan" small onClick={exportPDF}><Ic d={I.print} s={12} />تصدير PDF</Btn>
        </div>
      </Card>

      <Card style={{ padding:0 }}>
        {loading ? (
          <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد حركات مطابقة</div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%",borderCollapse:"collapse" }}>
              <THead cols={["النوع","الصنف","الكمية","قبل الحركة","بعد الحركة","المستخدم","الوقت","السبب"]} />
              <tbody>
                {filtered.map((e,idx)=>(
                  <TRow key={e.id||idx} alt={idx%2}>
                    <td style={{ padding:"11px 14px" }}>
                      <span style={{ background:e.movement_type==="in"?C.greenDim:C.redDim,color:e.movement_type==="in"?C.green:C.red,border:`1px solid ${e.movement_type==="in"?C.green:C.red}33`,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700 }}>
                        {e.movement_type==="in"?"⬇ دخول":"⬆ خروج"}
                      </span>
                    </td>
                    <TD><span style={{ fontWeight:700 }}>{e.item_name||"—"}</span></TD>
                    <TD mono color={e.movement_type==="in"?C.green:C.red}><span style={{ fontWeight:700 }}>{e.qty}</span></TD>
                    <TD mono color={C.textMuted}>{e.balance_before??"—"}</TD>
                    <TD mono color={C.text}><span style={{ fontWeight:700 }}>{e.balance_after??"—"}</span></TD>
                    <TD>{e.full_name||e.user_name||"—"}</TD>
                    <TD color={C.textMuted}><span style={{ fontSize:11 }}>{fmtDT(e.created_at)}</span></TD>
                    <TD color={C.textDim}>{e.reason||"—"}</TD>
                  </TRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showMove && (
        <Modal title={showMove==="in"?"إضافة حركة دخول للمخزون":"إضافة حركة خروج من المخزون"} onClose={()=>setShowMove(null)}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ position:"relative" }}>
              <label style={{ fontSize:12,color:C.textDim,fontWeight:600,display:"block",marginBottom:5 }}>الصنف *</label>
              <input value={itemSearch} onChange={e=>handleItemSearch(e.target.value)}
                onFocus={()=>handleItemSearch(itemSearch)}
                onBlur={()=>setTimeout(()=>setItemSuggestions([]),180)}
                placeholder="ابحث أو اختر صنف"
                style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 13px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box" }} />
              {itemSuggestions.length > 0 && (
                <div style={{ position:"absolute",top:"100%",right:0,left:0,zIndex:500,background:C.surface,border:`1px solid ${C.accent}44`,borderRadius:10,boxShadow:"0 8px 30px rgba(0,0,0,0.4)",maxHeight:220,overflowY:"auto",marginTop:4 }}>
                  {itemSuggestions.map(inv=>(
                    <div key={inv.id} onMouseDown={()=>pickItem(inv)}
                      style={{ padding:"8px 12px",cursor:"pointer",borderBottom:`1px solid ${C.border}20`,display:"flex",justifyContent:"space-between",fontSize:12 }}
                      onMouseEnter={e=>e.currentTarget.style.background=C.accentDim}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <span style={{ fontWeight:700,color:C.text }}>{inv.name}</span>
                      <span style={{ color:C.textMuted }}>الرصيد: {inv.qty} {inv.unit}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedItem && (
              <div style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",fontSize:12,color:C.textMuted }}>
                الرصيد الحالي: <strong style={{ color:C.text }}>{selectedItem.qty} {selectedItem.unit}</strong>
                {moveForm.qty && parseFloat(moveForm.qty)>0 && (
                  <> ← بعد الحركة: <strong style={{ color: showMove==="in"?C.green:C.red }}>{showMove==="in" ? selectedItem.qty+parseFloat(moveForm.qty) : Math.max(0,selectedItem.qty-parseFloat(moveForm.qty))} {selectedItem.unit}</strong></>
                )}
              </div>
            )}
            <Inp label="الكمية *" type="number" value={moveForm.qty} onChange={v=>setMoveForm({...moveForm,qty:v})} placeholder="0" />
            <Inp label="سبب الحركة (اختياري)" value={moveForm.reason} onChange={v=>setMoveForm({...moveForm,reason:v})} placeholder={showMove==="in"?"مثال: توريد جديد":"مثال: تالف، عينة، صرف داخلي"} />
            <Inp label="ملاحظات (اختياري)" value={moveForm.notes} onChange={v=>setMoveForm({...moveForm,notes:v})} placeholder="أي تفاصيل إضافية..." />
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setShowMove(null)}>إلغاء</Btn>
              <Btn variant={showMove==="in"?"success":"danger"} onClick={handleSaveMove}>
                <Ic d={I.plus} s={13} />{showMove==="in"?"تسجيل حركة الدخول":"تسجيل حركة الخروج"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default InventoryLogPage;
