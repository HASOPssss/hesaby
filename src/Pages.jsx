import { useState, useEffect, useRef } from "react";
import {
  supabase, normalizeArabic, C, Ic, I, fmt, fmtNum, today, useIsMobile,
  printStocktakeReport, printStocktakeUpdateReport, downloadInventoryTemplate, parseInventoryCSV,
  ConfirmDialog, usePasscodeGate, setCachedPasscode, logActivity, Badge, Card, GlowCard, MiniStat, Btn,
  DatePicker, MonthPicker, Inp, Sel, Modal, THead, TRow, TD, PageHeader, usePageShortcuts,
} from "./shared";

// ══════════════════════════════════════════════════════════════════════════════
// Pages.jsx — الصفحات الأخف حجماً واللي مش محتاجة ملف لوحدها: اللوحة الرئيسية،
// كشف حساب العملاء/الموردين، المخزون (الإدارة/الجرد/الأصناف)، الفئات،
// إعدادات الشركة، المقبوضات، المصروفات، والساعة/جرس التنبيهات.
// ══════════════════════════════════════════════════════════════════════════════

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
function Dashboard({ data, daysUntilExpiry, inventory }) {
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
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
        <div>
          <h1 style={{ margin:0,fontSize:24,fontWeight:800,color:C.text,letterSpacing:-0.5 }}>لوحة التحكم</h1>
          <p style={{ margin:"5px 0 0",color:C.textMuted,fontSize:13 }}>نظرة عامة شاملة على الأداء المالي</p>
        </div>
        <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8 }}>
          <LiveClock />
          <UnifiedNotificationBell days={daysUntilExpiry} inventory={inventory||[]} />
        </div>
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

// ─── ACCOUNT STATEMENT (العملاء والموردين) ────────────────────────────────────
function AccountStatement({ parties, invoices, returns=[], type, onAddParty, onUpdateParty, onDeleteParty, security, pageId, userEmail }) {
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name:"",phone:"" });
  const [showArchived, setShowArchived] = useState(false);
  const { requestPasscode, PasscodeGate, log } = usePasscodeGate(security);
  const key = type==="client"?"client":"supplier";
  const isClient = type==="client";
  const engineType = isClient ? "sales" : "purchases";

  const getStmt = name=>invoices.filter(i=>i[key]===name);
  // مبلغ المرتجعات المرتبط بكل فواتير الطرف ده — بيتخصم من الرصيد المستحق
  const returnedAmountFor = (invIds) => returns
    .filter(r => (r.invoiceType||(r.type==="sale"?"sales":"purchases"))===engineType && invIds.includes(r.invoiceId))
    .reduce((s,r)=>s+(r.amount||0),0);
  const balanceFor = (name) => {
    const stmt = getStmt(name);
    const totalAmt = stmt.reduce((s,i)=>s+i.amount,0);
    const totalPaid = stmt.reduce((s,i)=>s+i.paid,0);
    const returned = returnedAmountFor(stmt.map(i=>i.id));
    return totalAmt - totalPaid - returned;
  };
  const activeParties = parties.filter(p=>p.isActive!==false);
  const archivedParties = parties.filter(p=>p.isActive===false);
  const visibleParties = showArchived ? archivedParties : activeParties;
  const sel = parties.find(p=>p.name===selected);
  const stmt = selected?getStmt(selected):[];
  const totalAmt = stmt.reduce((s,i)=>s+i.amount,0);
  const totalPaid = stmt.reduce((s,i)=>s+i.paid,0);
  const totalReturned = selected ? returnedAmountFor(stmt.map(i=>i.id)) : 0;
  const balance = totalAmt-totalPaid-totalReturned;

  const handleAddParty = () => {
    if (!addForm.name.trim()) return;
    onAddParty({ id:(isClient?"C":"SP")+Date.now().toString().slice(-5),name:addForm.name.trim(),phone:addForm.phone.trim(),balance:0,isActive:true });
    setAddForm({ name:"",phone:"" }); setShowAddModal(false);
  };

  // حذف حقيقي مسموح بس لو مفيش أي فاتورة مرتبطة بالطرف ده تاريخيًا. لو عنده
  // فواتير، "الحذف" بيتحول تلقائيًا لأرشفة — الطرف بيختفي من القوائم النشطة
  // لكن كل فواتيره وتقاريره التاريخية تفضل سليمة تمامًا، وممكن استعادته لاحقًا.
  const handleDeleteOrArchive = (p) => {
    const hasHistory = getStmt(p.name).length > 0;
    requestPasscode({
      pageId, kind:"delete",
      label: hasHistory ? `أرشفة ${isClient?"عميل":"مورد"} له سجل فواتير` : `حذف ${isClient?"عميل":"مورد"}`,
      onConfirm: () => {
        if (hasHistory) {
          onUpdateParty({ ...p, isActive:false });
          log({ actionType:"أرشفة", section:isClient?"العملاء":"الموردين", target:p.name, before:p, after:{...p,isActive:false} });
        } else {
          onDeleteParty(p.name);
          log({ actionType:"حذف", section:isClient?"العملاء":"الموردين", target:p.name, before:p, after:null });
        }
        if (selected===p.name) setSelected(null);
      },
    });
  };

  const handleReactivate = (p) => {
    requestPasscode({
      pageId, kind:"edit", label:`استعادة ${isClient?"عميل":"مورد"} من الأرشيف`,
      onConfirm: () => {
        onUpdateParty({ ...p, isActive:true });
        log({ actionType:"استعادة من الأرشيف", section:isClient?"العملاء":"الموردين", target:p.name, before:p, after:{...p,isActive:true} });
      },
    });
  };

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      {PasscodeGate}
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
      <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"260px 1fr",gap:18,alignItems:"start" }}>
        <Card style={{ padding:0 }}>
          <div style={{ padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <span style={{ fontSize:11,fontWeight:700,color:C.textMuted,letterSpacing:0.5 }}>
              {showArchived ? `المؤرشفون (${archivedParties.length})` : `قائمة ${isClient?"العملاء":"الموردين"} (${activeParties.length})`}
            </span>
            {archivedParties.length > 0 && (
              <button onClick={()=>setShowArchived(s=>!s)} style={{ background:"none",border:"none",cursor:"pointer",color:C.accent,fontSize:11,fontWeight:700,fontFamily:"inherit" }}>
                {showArchived ? "عرض النشطين" : `الأرشيف (${archivedParties.length})`}
              </button>
            )}
          </div>
          {visibleParties.map(p=>{
            const bal = balanceFor(p.name);
            return (
              <div key={p.id} onClick={()=>setSelected(p.name)} style={{ padding:"12px 16px",cursor:"pointer",borderBottom:`1px solid ${C.border}10`,background:selected===p.name?C.accentDim:"transparent",borderRight:`3px solid ${selected===p.name?C.accent:"transparent"}`,display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.15s",opacity:showArchived?0.7:1 }}>
                <div>
                  <div style={{ fontSize:13,fontWeight:600,color:C.text }}>{p.name}</div>
                  <div style={{ fontSize:11,color:bal>0?C.red:C.green,marginTop:2,fontFamily:"monospace" }}>{bal>0?`مديون: ${fmt(bal)}`:"✓ مسدد"}</div>
                </div>
                {showArchived ? (
                  <button onClick={e=>{ e.stopPropagation(); handleReactivate(p); }} title="استعادة" style={{ background:C.greenDim,color:C.green,border:`1px solid ${C.green}33`,borderRadius:7,padding:"4px 10px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>استعادة</button>
                ) : (
                  <button onClick={e=>{ e.stopPropagation(); handleDeleteOrArchive(p); }} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted,opacity:0.5 }}><Ic d={I.trash} s={12} /></button>
                )}
              </div>
            );
          })}
          {visibleParties.length===0 && <div style={{ padding:24,textAlign:"center",color:C.textMuted,fontSize:12 }}>{showArchived ? "لا يوجد مؤرشفون" : `لا يوجد ${isClient?"عملاء":"موردون"}`}</div>}
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
                <div style={{ overflowX:"auto",WebkitOverflowScrolling:"touch" }}>
                <table style={{ width:"100%",minWidth:640,borderCollapse:"collapse" }}>
                  <THead cols={["رقم الفاتورة","التاريخ","الإجمالي","المدفوع","مرتجعات","المتبقي","الحالة"]} />
                  <tbody>
                    {stmt.map((inv,i)=>{
                      const invReturned = returns.filter(r=>(r.invoiceType||(r.type==="sale"?"sales":"purchases"))===engineType && r.invoiceId===inv.id).reduce((s,r)=>s+(r.amount||0),0);
                      const remaining = inv.amount - inv.paid - invReturned;
                      return (
                        <TRow key={inv.id} alt={i%2}>
                          <TD color={C.accent}>{inv.id}</TD>
                          <TD color={C.textDim}>{inv.date}</TD>
                          <TD mono>{fmt(inv.amount)}</TD>
                          <TD mono color={C.green}>{fmt(inv.paid)}</TD>
                          <TD mono color={invReturned>0?C.purple:C.textMuted}>{invReturned>0?`- ${fmt(invReturned)}`:"—"}</TD>
                          <TD mono color={remaining>0?C.red:C.textMuted}>{fmt(remaining)}</TD>
                          <td style={{ padding:"11px 14px" }}><Badge label={inv.status} /></td>
                        </TRow>
                      );
                    })}
                  </tbody>
                </table>
                </div>
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

// ─── INVENTORY ITEMS PAGE (المخزون كأصناف) ────────────────────────────────────
function InventoryItemsPage({ inventory, categories }) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const searchRef = useRef(null);

  usePageShortcuts("المخزون كأصناف", [
    { combo:"ctrl+f", label:"البحث في الأصناف", description:"يركّز على مربع البحث بالاسم أو الفئة", handler:()=>searchRef.current?.focus() },
  ]);

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
          <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بالاسم أو الفئة..."
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
function InventoryPage({ inventory, categories, onAdd, onEdit, onDelete, onBulkAdd, userEmail, userId, security, pageId }) {
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const { requestPasscode, PasscodeGate, log } = usePasscodeGate(security);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [stocktakePeriod, setStocktakePeriod] = useState("monthly");
  const [stocktakeMonth, setStocktakeMonth] = useState(today().slice(0,7));
  const [form, setForm] = useState({ name:"",category:"",qty:0,minQty:0,cost:0,price:0,unit:"قطعة" });
  const [pendingReview, setPendingReview] = useState(null); // { updated, added, notCounted, shortages, lossValue, gainValue, finalRecords }
  const searchRef = useRef(null);
  const [lastUpdate, setLastUpdate] = useState(() => {
    try { const raw = localStorage.getItem("inv_last_update_"+(userId||"")); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });

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
    const item = inventory.find(p=>p.id===id);
    requestPasscode({
      pageId, kind:"delete", label:"حذف صنف من المخزون",
      onConfirm: () => { onDelete(id); log({ actionType:"حذف", section:"المخزون", target:name, before:item||null, after:null }); },
    });
  };

  // ─── الجرد عن طريق رفع إكسيل: تحديث الكميات + إضافة المنتجات الجديدة + مقارنة بالقديم ───
  const buildStocktakeReview = (newItemsRaw) => {
    const matchedIds = new Set();
    const updated = [];
    const added = [];

    newItemsRaw.forEach(ni => {
      const key = normalizeArabic(ni.name);
      const old = inventory.find(p => normalizeArabic(p.name) === key);
      if (old) {
        matchedIds.add(old.id);
        const newQty = ni.qty || 0;
        const diff = newQty - (old.qty || 0);
        updated.push({
          id: old.id,
          name: old.name,
          category: ni.category || old.category,
          unit: ni.unit || old.unit,
          oldQty: old.qty || 0,
          newQty,
          diff,
          minQty: ni.minQty || old.minQty || 0,
          cost: ni.cost || old.cost || 0,
          price: ni.price || old.price || 0,
        });
      } else {
        added.push({ ...ni });
      }
    });

    const notCounted = inventory
      .filter(p => !matchedIds.has(p.id))
      .map(p => ({ id: p.id, name: p.name, category: p.category, oldQty: p.qty, unit: p.unit }));

    const updatedRecords = updated.map(u => ({
      id: u.id, name: u.name, category: u.category, qty: u.newQty, minQty: u.minQty, cost: u.cost, price: u.price, unit: u.unit,
    }));
    const addedRecords = added.map(a => ({ ...a }));
    const finalRecords = [...updatedRecords, ...addedRecords];

    const notCountedRecords = notCounted.map(nc => inventory.find(p => p.id === nc.id)).filter(Boolean);
    const mergedForShortage = [...notCountedRecords, ...updatedRecords, ...addedRecords];
    const shortages = mergedForShortage.filter(p => (p.qty||0) <= (p.minQty||0));

    const lossValue = updated.filter(u => u.diff < 0).reduce((s,u)=>s+Math.abs(u.diff)*(u.cost||0), 0);
    const gainValue = updated.filter(u => u.diff > 0).reduce((s,u)=>s+u.diff*(u.cost||0), 0);

    return { updated, added, notCounted, shortages, lossValue, gainValue, finalRecords };
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const items = parseInventoryCSV(ev.target.result, categories);
      if (items.length > 0) setPendingReview(buildStocktakeReview(items));
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const confirmStocktakeUpdate = () => {
    if (!pendingReview) return;
    onBulkAdd(pendingReview.finalRecords);
    const changedCount = pendingReview.updated.filter(u=>u.diff!==0).length;
    const info = {
      date: new Date().toISOString(),
      by: userEmail || "",
      added: pendingReview.added.length,
      updated: changedCount,
      notCounted: pendingReview.notCounted.length,
    };
    try { localStorage.setItem("inv_last_update_"+(userId||""), JSON.stringify(info)); } catch {}
    setLastUpdate(info);
    printStocktakeUpdateReport({ ...pendingReview, by: userEmail || "" });
    log({ actionType:"تحديث جرد (إكسيل)", section:"المخزون", target:`${pendingReview.added.length} صنف جديد، ${changedCount} صنف اتغيرت كميته`, before:null, after:info });
    setPendingReview(null);
  };

  usePageShortcuts("إدارة المخزون", [
    { combo:"ctrl+n", label:"إضافة صنف جديد", description:"يفتح نموذج إضافة صنف للمخزون", enabled:!showModal, handler:openAdd },
    { combo:"ctrl+f", label:"البحث في المخزون", description:"يركّز على مربع البحث بالاسم أو الكود", enabled:!showModal, handler:()=>searchRef.current?.focus() },
    { combo:"ctrl+s", label:"حفظ الصنف", description:"يحفظ نموذج الصنف المفتوح حاليًا", enabled:showModal, handler:handleSave },
  ]);

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      {PasscodeGate}
      <PageHeader title="إدارة المخزون" icon={I.inventory} subtitle={`${inventory.length} صنف`}
        action={
          <div style={{ display:"flex",gap:8 }}>
            <label style={{ background:C.greenDim,color:C.green,border:`1px solid ${C.green}33`,borderRadius:9,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6 }}>
              <Ic d={I.upload} s={13} />رفع Excel (جرد وتحديث)
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} style={{ display:"none" }} />
            </label>
            <Btn variant="yellow" onClick={downloadInventoryTemplate}><Ic d={I.download} s={13} />قالب CSV</Btn>
            <Btn onClick={openAdd}><Ic d={I.plus} s={14} />إضافة صنف</Btn>
          </div>
        }
      />
      {lastUpdate && (
        <div style={{ display:"flex",alignItems:"center",gap:8,fontSize:12,color:C.textMuted }}>
          <Ic d={I.stocktake} s={13} c={C.accent} />
          <span>آخر تحديث للجرد: <strong style={{ color:C.text }}>{new Date(lastUpdate.date).toLocaleString("ar-EG",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}</strong>{lastUpdate.by?<> بواسطة <strong style={{ color:C.text }}>{lastUpdate.by}</strong></>:null} — {lastUpdate.added} صنف جديد، {lastUpdate.updated} صنف اتغيرت كميته، {lastUpdate.notCounted} صنف لم يُجرد</span>
        </div>
      )}
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
          <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بالاسم أو الكود..."
            style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 13px",color:C.text,fontSize:12,fontFamily:"inherit",outline:"none",width:200 }} />
          <select value={catFilter} onChange={e=>setCatFilter(e.target.value)}
            style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 13px",color:C.text,fontSize:12,fontFamily:"inherit" }}>
            <option value="">كل الفئات</option>
            {categories.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <div style={{ marginRight:"auto",display:"flex",gap:8 }}>
            <span style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 13px",color:C.text,fontSize:12,fontFamily:"inherit" }}>جرد شهري</span>
            <MonthPicker value={stocktakeMonth} onChange={v=>setStocktakeMonth(v)} />
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
      {pendingReview && (
        <Modal title="مراجعة تحديث الجرد قبل التأكيد" onClose={()=>setPendingReview(null)} wide>
          <div style={{ display:"flex",flexDirection:"column",gap:18 }}>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10 }}>
              <MiniStat label="أصناف جديدة" value={fmtNum(pendingReview.added.length)} color={C.green} icon={I.plus} />
              <MiniStat label="اتغيرت كميته" value={fmtNum(pendingReview.updated.filter(u=>u.diff!==0).length)} color={C.accent} icon={I.stocktake} />
              <MiniStat label="لم يُجرد" value={fmtNum(pendingReview.notCounted.length)} color={C.yellow} icon={I.alert} />
              <MiniStat label="قيمة العجز" value={fmt(pendingReview.lossValue)} color={C.red} icon={I.revenue} />
            </div>

            {pendingReview.updated.filter(u=>u.diff!==0).length>0 && (
              <div>
                <div style={{ fontSize:13,fontWeight:700,color:C.text,marginBottom:8 }}>🔄 أصناف اتغيرت كميتها</div>
                <div style={{ background:C.surface2,borderRadius:10,overflow:"hidden",border:`1px solid ${C.border}`,maxHeight:220,overflowY:"auto" }}>
                  <table style={{ width:"100%",borderCollapse:"collapse" }}>
                    <THead cols={["الصنف","الكمية القديمة","الكمية الجديدة","الفرق"]} />
                    <tbody>
                      {pendingReview.updated.filter(u=>u.diff!==0).map((u,idx)=>(
                        <TRow key={u.id} alt={idx%2}>
                          <TD><span style={{ fontWeight:600 }}>{u.name}</span></TD>
                          <TD mono color={C.textMuted}>{u.oldQty} {u.unit}</TD>
                          <TD mono color={C.text}>{u.newQty} {u.unit}</TD>
                          <TD mono color={u.diff<0?C.red:C.green}><span style={{ fontWeight:700 }}>{u.diff>0?"+":""}{u.diff} {u.unit}</span></TD>
                        </TRow>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {pendingReview.added.length>0 && (
              <div>
                <div style={{ fontSize:13,fontWeight:700,color:C.text,marginBottom:8 }}>🆕 منتجات جديدة هتتضاف</div>
                <div style={{ background:C.surface2,borderRadius:10,overflow:"hidden",border:`1px solid ${C.border}`,maxHeight:220,overflowY:"auto" }}>
                  <table style={{ width:"100%",borderCollapse:"collapse" }}>
                    <THead cols={["الصنف","الفئة","الكمية","سعر التكلفة"]} />
                    <tbody>
                      {pendingReview.added.map((p,idx)=>(
                        <TRow key={p.id} alt={idx%2}>
                          <TD><span style={{ fontWeight:600 }}>{p.name}</span></TD>
                          <TD color={C.textDim}>{p.category}</TD>
                          <TD mono>{p.qty} {p.unit}</TD>
                          <TD mono color={C.textDim}>{fmt(p.cost)}</TD>
                        </TRow>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {pendingReview.notCounted.length>0 && (
              <div>
                <div style={{ fontSize:13,fontWeight:700,color:C.text,marginBottom:8 }}>❔ أصناف مش موجودة في الشيت الجديد (هتفضل كميتها زي ما هي)</div>
                <div style={{ background:C.surface2,borderRadius:10,overflow:"hidden",border:`1px solid ${C.border}`,maxHeight:180,overflowY:"auto" }}>
                  <table style={{ width:"100%",borderCollapse:"collapse" }}>
                    <THead cols={["الصنف","الفئة","الكمية المسجلة"]} />
                    <tbody>
                      {pendingReview.notCounted.map((p,idx)=>(
                        <TRow key={p.id} alt={idx%2}>
                          <TD><span style={{ fontWeight:600 }}>{p.name}</span></TD>
                          <TD color={C.textDim}>{p.category}</TD>
                          <TD mono>{p.oldQty} {p.unit}</TD>
                        </TRow>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setPendingReview(null)}>إلغاء</Btn>
              <Btn variant="success" onClick={confirmStocktakeUpdate}><Ic d={I.print} s={13} />تأكيد وتحديث المخزون + طباعة PDF</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── CATEGORIES PAGE ──────────────────────────────────────────────────────────
function CategoriesPage({ categories, onAdd, onDelete }) {
  const [newCat, setNewCat] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const newCatRef = useRef(null);
  const handleAdd = () => {
    if (!newCat.trim()) return;
    onAdd(newCat.trim());
    setNewCat("");
  };

  usePageShortcuts("الفئات", [
    { combo:"ctrl+n", label:"فئة جديدة", description:"يركّز على حقل إضافة فئة جديدة (اكتب واضغط Enter)", handler:()=>newCatRef.current?.focus() },
  ]);

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      <PageHeader title="الفئات" icon={I.categories} subtitle={`${categories.length} فئة مسجلة`} />
      <Card>
        <div style={{ display:"flex",gap:10,marginBottom:22 }}>
          <input ref={newCatRef} value={newCat} onChange={e=>setNewCat(e.target.value)} placeholder="اسم الفئة الجديدة..."
            onKeyDown={e=>e.key==="Enter"&&handleAdd()}
            style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 13px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none",flex:1 }}
            onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border} />
          <Btn onClick={handleAdd}><Ic d={I.plus} s={14} />إضافة</Btn>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10 }}>
          {categories.map((cat,i)=>(
            <div key={i} style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,padding:"13px 16px",fontSize:13,fontWeight:600,color:C.text,display:"flex",alignItems:"center",gap:8 }}>
              <div style={{ width:8,height:8,borderRadius:"50%",background:C.accent,flexShrink:0 }} />
              <span style={{ flex:1 }}>{cat}</span>
              {onDelete && (
                <button onClick={()=>setConfirmDel(cat)} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted,padding:2,display:"flex",opacity:0.6,transition:"opacity 0.15s" }}
                  onMouseEnter={e=>e.currentTarget.style.opacity="1"} onMouseLeave={e=>e.currentTarget.style.opacity="0.6"}>
                  <Ic d={I.trash} s={14} c={C.red} />
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>
      {confirmDel && (
        <ConfirmDialog message={`هل تريد حذف فئة "${confirmDel}"؟`}
          onConfirm={()=>{ onDelete(confirmDel); setConfirmDel(null); }}
          onCancel={()=>setConfirmDel(null)} />
      )}
    </div>
  );
}

// ─── COMPANY SETTINGS PAGE ────────────────────────────────────────────────────
function CompanySettingsPage({ userId, userEmail, companyName: initialCompanyName, isSubUser=false }) {
  const [tab, setTab] = useState("general");
  const [companyName, setCompanyName] = useState(initialCompanyName || "");
  const [logo, setLogo] = useState(() => { try { return localStorage.getItem("company_logo_"+userId)||""; } catch { return ""; } });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text:"", type:"" });
  const [pwForm, setPwForm] = useState({ current:"", newPw:"", confirm:"" });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState({ text:"", type:"" });
  const [idleTimeout, setIdleTimeout] = useState(5);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [secMsg, setSecMsg] = useState({ text:"", type:"" });
  const [hasPasscode, setHasPasscode] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [passcodeConfirm, setPasscodeConfirm] = useState("");
  const [subUsersList, setSubUsersList] = useState([]);
  const [subUsersLoading, setSubUsersLoading] = useState(false);
  const [ownerCanEditUsers, setOwnerCanEditUsers] = useState(false);
  const [editingSubUser, setEditingSubUser] = useState(null);
  const [subUserEditForm, setSubUserEditForm] = useState({ username:"", display_name:"", password:"" });
  const [usersMsg, setUsersMsg] = useState({ text:"", type:"" });

  // جلب مدة الخروج التلقائي وحالة الـ Passcode الحالية من الداتابيز
  useEffect(() => {
    if (!userId) return;
    supabase.from("profiles").select("idle_timeout_minutes, security_passcode, owner_can_edit_users").eq("id", userId).single()
      .then(({ data }) => {
        if (Number(data?.idle_timeout_minutes) > 0) setIdleTimeout(Number(data.idle_timeout_minutes));
        setHasPasscode(!!data?.security_passcode);
        setOwnerCanEditUsers(!!data?.owner_can_edit_users);
      })
      .catch(() => {});
  }, [userId]);

  // جلب قائمة المستخدمين (الموظفين) بتاعين الشركة دي
  useEffect(() => {
    if (!userId || tab !== "users") return;
    setSubUsersLoading(true);
    supabase.from("sub_users").select("id, username, display_name, role, is_active").eq("owner_id", userId).order("username")
      .then(({ data }) => setSubUsersList(data || []))
      .catch(() => setSubUsersList([]))
      .finally(() => setSubUsersLoading(false));
  }, [userId, tab]);

  const showUsersMsg = (text, type="success") => { setUsersMsg({ text, type }); setTimeout(()=>setUsersMsg({text:"",type:""}),3500); };

  const openEditSubUser = (su) => {
    if (!ownerCanEditUsers) return;
    setEditingSubUser(su);
    setSubUserEditForm({ username: su.username, display_name: su.display_name || "", password: "" });
  };

  const saveSubUserEdit = async () => {
    if (!editingSubUser || !ownerCanEditUsers) return;
    const updates = { username: subUserEditForm.username.trim().toLowerCase(), display_name: subUserEditForm.display_name };
    if (subUserEditForm.password) updates.password_plain = subUserEditForm.password;
    const { error } = await supabase.from("sub_users").update(updates).eq("id", editingSubUser.id);
    if (!error) {
      showUsersMsg("✓ تم تحديث بيانات المستخدم");
      logActivity(userId, { userName:userEmail, fullName:userEmail, actionType:"تعديل", section:"إدارة المستخدمين", target:editingSubUser.username, before:{ username:editingSubUser.username, display_name:editingSubUser.display_name }, after:updates });
      setSubUsersList(prev => prev.map(s => s.id===editingSubUser.id ? { ...s, ...updates } : s));
      setEditingSubUser(null);
    } else showUsersMsg("خطأ: " + error.message, "error");
  };

  // Sync branding to sessionStorage AND localStorage for PDF use
  useEffect(() => {
    try {
      sessionStorage.setItem("company_uid", userId||"");
      sessionStorage.setItem("company_display_name", companyName||"حسابي Pro");
      // Also persist in localStorage so data survives tab close
      if (userId) localStorage.setItem("company_uid_persist", userId);
      if (companyName) localStorage.setItem("company_name_persist_" + (userId||""), companyName);
    } catch {}
  }, [userId, companyName]);

  const showMsg = (text, type="success") => { setMsg({ text, type }); setTimeout(()=>setMsg({text:"",type:""}),3500); };
  const showPwMsg = (text, type="success") => { setPwMsg({ text, type }); setTimeout(()=>setPwMsg({text:"",type:""}),3500); };
  const showSecMsg = (text, type="success") => { setSecMsg({ text, type }); setTimeout(()=>setSecMsg({text:"",type:""}),3500); };

  const handleSaveSecurity = async () => {
    setSavingSecurity(true);
    const oldValue = idleTimeout;
    const { error } = await supabase.from("profiles").update({ idle_timeout_minutes: idleTimeout }).eq("id", userId);
    if (!error) {
      showSecMsg("✓ تم حفظ إعدادات الأمان");
      logActivity(userId, { userName:userEmail, fullName:userEmail, actionType:"تعديل", section:"إعدادات الشركة", target:"مدة الخروج التلقائي", before:{ idle_timeout_minutes: oldValue }, after:{ idle_timeout_minutes: idleTimeout } });
    }
    else showSecMsg("خطأ: " + error.message, "error");
    setSavingSecurity(false);
  };

  const handleSavePasscode = async () => {
    if (!passcode || passcode.length < 4) { showSecMsg("رمز الحماية لازم يكون 4 أرقام/حروف على الأقل", "error"); return; }
    if (passcode !== passcodeConfirm) { showSecMsg("رمز الحماية والتأكيد مش متطابقين", "error"); return; }
    setSavingSecurity(true);
    const { error } = await supabase.from("profiles").update({ security_passcode: passcode }).eq("id", userId);
    if (!error) {
      setCachedPasscode(passcode); // يتفعّل فوراً من غير الحاجة لإعادة تسجيل الدخول
      setHasPasscode(true);
      setPasscode(""); setPasscodeConfirm("");
      showSecMsg("✓ تم حفظ رمز الحماية بنجاح");
      // لا نسجل القيمة الفعلية للباسكود في السجل حفاظاً على سريته
      logActivity(userId, { userName:userEmail, fullName:userEmail, actionType:"تعديل", section:"إعدادات الشركة", target:"رمز الحماية (Passcode)", before:null, after:{ changed:true } });
    } else showSecMsg("خطأ: " + error.message, "error");
    setSavingSecurity(false);
  };

  const handleSaveGeneral = async () => {
    setSaving(true);
    const oldName = initialCompanyName;
    const logoChanged = logo !== ((() => { try { return localStorage.getItem("company_logo_"+userId) || ""; } catch { return ""; } })());
    const { error } = await supabase.from("profiles").update({ company_name: companyName, company_logo: logo || null }).eq("id", userId);
    if (!error) {
      showMsg("✓ تم حفظ بيانات الشركة");
      logActivity(userId, { userName:userEmail, fullName:userEmail, actionType:"تعديل", section:"إعدادات الشركة", target:"بيانات الشركة (الاسم/الشعار)", before:{ company_name: oldName }, after:{ company_name: companyName, logo_changed: logoChanged } });
    }
    else showMsg("خطأ: " + error.message, "error");
    setSaving(false);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setLogo(dataUrl);
      try { localStorage.setItem("company_logo_"+userId, dataUrl); } catch {}
      showMsg("✓ تم حفظ الشعار");
    };
    reader.readAsDataURL(file);
  };

  const handleChangePassword = async () => {
    if (!pwForm.current) { showPwMsg("أدخل كلمة المرور الحالية", "error"); return; }
    if (pwForm.newPw.length < 6) { showPwMsg("كلمة المرور الجديدة 6 أحرف على الأقل", "error"); return; }
    if (pwForm.newPw !== pwForm.confirm) { showPwMsg("كلمتا المرور غير متطابقتين", "error"); return; }
    setPwLoading(true);
    // Verify current password first
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: userEmail, password: pwForm.current });
    if (signInErr) { showPwMsg("كلمة المرور الحالية غير صحيحة", "error"); setPwLoading(false); return; }
    const { error } = await supabase.auth.updateUser({ password: pwForm.newPw });
    if (!error) {
      showPwMsg("✓ تم تغيير كلمة المرور بنجاح");
      setPwForm({ current:"", newPw:"", confirm:"" });
      logActivity(userId, { userName:userEmail, fullName:userEmail, actionType:"تعديل", section:"إعدادات الشركة", target:"كلمة المرور", before:null, after:{ changed:true } });
    }
    else showPwMsg("خطأ: " + error.message, "error");
    setPwLoading(false);
  };

  const settingsTabs = [
    { id:"general", label:"بيانات الشركة" },
    { id:"password", label:"كلمة المرور" },
    ...(isSubUser ? [] : [{ id:"security", label:"الأمان" }, { id:"users", label:"إدارة المستخدمين" }]),
  ];

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      <PageHeader title="إعدادات الشركة" icon={I.settings} subtitle="إدارة بيانات الشركة وكلمة المرور" />
      <div style={{ display:"flex",background:C.surface2,borderRadius:12,padding:4,border:`1px solid ${C.border}`,gap:4,width:"fit-content" }}>
        {settingsTabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ background:tab===t.id?C.accent:"transparent",color:tab===t.id?"#fff":C.textMuted,border:"none",borderRadius:9,padding:"9px 22px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <Card>
          <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
            {msg.text && <div style={{ background:msg.type==="success"?C.greenDim:C.redDim,border:`1px solid ${msg.type==="success"?C.green:C.red}33`,color:msg.type==="success"?C.green:C.red,borderRadius:10,padding:"10px 16px",fontSize:13,fontWeight:700 }}>{msg.text}</div>}
            <div style={{ display:"flex",alignItems:"center",gap:20 }}>
              <div style={{ width:80,height:80,borderRadius:16,background:C.surface2,border:`2px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0 }}>
                {logo ? <img src={logo} alt="شعار" style={{ width:"100%",height:"100%",objectFit:"cover" }} /> : <Ic d={I.factory} s={32} c={C.textMuted} />}
              </div>
              <div>
                <div style={{ fontSize:13,fontWeight:600,color:C.text,marginBottom:8 }}>شعار الشركة</div>
                <label style={{ background:C.accentDim,color:C.accent,border:`1px solid ${C.accent}33`,borderRadius:9,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>
                  <Ic d={I.upload} s={13} /> اختيار صورة
                  <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display:"none" }} />
                </label>
                {logo && <button onClick={()=>{ setLogo(""); try { localStorage.removeItem("company_logo_"+userId); } catch {} }} style={{ marginRight:8,background:C.redDim,color:C.red,border:`1px solid ${C.red}33`,borderRadius:9,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>حذف</button>}
              </div>
            </div>
            <Inp label="اسم الشركة" value={companyName} onChange={setCompanyName} placeholder="شركة النور للتجارة" />
            <div style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 16px" }}>
              <div style={{ fontSize:12,color:C.textMuted,marginBottom:4 }}>البريد الإلكتروني</div>
              <div style={{ fontSize:14,fontWeight:700,color:C.textDim }}>{userEmail}</div>
              <div style={{ fontSize:11,color:C.textMuted,marginTop:4 }}>لتغيير البريد الإلكتروني تواصل مع الإدارة</div>
            </div>
            <div style={{ display:"flex",justifyContent:"flex-end" }}>
              <Btn onClick={handleSaveGeneral}>{saving?"جاري الحفظ...":"حفظ البيانات"}</Btn>
            </div>
          </div>
        </Card>
      )}

      {tab === "password" && (
        <Card>
          <div style={{ display:"flex",flexDirection:"column",gap:16,maxWidth:420 }}>
            {pwMsg.text && <div style={{ background:pwMsg.type==="success"?C.greenDim:C.redDim,border:`1px solid ${pwMsg.type==="success"?C.green:C.red}33`,color:pwMsg.type==="success"?C.green:C.red,borderRadius:10,padding:"10px 16px",fontSize:13,fontWeight:700 }}>{pwMsg.text}</div>}
            <div style={{ background:C.accentDim,border:`1px solid ${C.accent}22`,borderRadius:12,padding:"12px 16px",fontSize:12,color:C.accent }}>
              🔐 لتغيير كلمة المرور يجب إدخال كلمة المرور الحالية أولاً للتحقق من هويتك.
            </div>
            <Inp label="كلمة المرور الحالية" value={pwForm.current} onChange={v=>setPwForm({...pwForm,current:v})} placeholder="••••••••" />
            <Inp label="كلمة المرور الجديدة" value={pwForm.newPw} onChange={v=>setPwForm({...pwForm,newPw:v})} placeholder="6 أحرف على الأقل" />
            <Inp label="تأكيد كلمة المرور الجديدة" value={pwForm.confirm} onChange={v=>setPwForm({...pwForm,confirm:v})} placeholder="••••••••" />
            {pwForm.newPw && (
              <div style={{ fontSize:11,color:pwForm.newPw.length<6?C.red:pwForm.newPw.length<10?C.yellow:C.green,fontWeight:700 }}>
                قوة كلمة المرور: {pwForm.newPw.length<6?"ضعيفة جداً":pwForm.newPw.length<10?"متوسطة":"قوية"}
              </div>
            )}
            <div style={{ display:"flex",justifyContent:"flex-end" }}>
              <Btn onClick={handleChangePassword}>{pwLoading?"جاري التغيير...":"تغيير كلمة المرور"}</Btn>
            </div>
          </div>
        </Card>
      )}

      {tab === "security" && (
        <Card>
          <div style={{ display:"flex",flexDirection:"column",gap:16,maxWidth:460 }}>
            {secMsg.text && <div style={{ background:secMsg.type==="success"?C.greenDim:C.redDim,border:`1px solid ${secMsg.type==="success"?C.green:C.red}33`,color:secMsg.type==="success"?C.green:C.red,borderRadius:10,padding:"10px 16px",fontSize:13,fontWeight:700 }}>{secMsg.text}</div>}
            <div style={{ background:C.accentDim,border:`1px solid ${C.accent}22`,borderRadius:12,padding:"12px 16px",fontSize:12,color:C.accent }}>
              🔐 لو محدش استخدم الموقع لفترة، هيتم تسجيل الخروج تلقائياً لحماية بيانات شركتك. الإعداد ده بينطبق على حسابك وحسابات كل الموظفين تحت شركتك.
            </div>
            <Sel label="تسجيل الخروج التلقائي بعد عدم النشاط لمدة" value={String(idleTimeout)} onChange={v=>setIdleTimeout(Number(v))}
              options={["5","10","15","30","60"].map(v=>({ value:v, label:`${v} دقيقة` }))} />
            <div style={{ fontSize:11,color:C.textMuted }}>القيمة الحالية: {idleTimeout} دقيقة</div>
            <div style={{ display:"flex",justifyContent:"flex-end" }}>
              <Btn onClick={handleSaveSecurity}>{savingSecurity?"جاري الحفظ...":"حفظ إعدادات الأمان"}</Btn>
            </div>
          </div>
        </Card>
      )}

      {tab === "security" && (
        <Card>
          <div style={{ display:"flex",flexDirection:"column",gap:16,maxWidth:460 }}>
            <h3 style={{ margin:0,fontSize:14,fontWeight:700,color:C.text }}>🔑 رمز الحماية (Passcode)</h3>
            <div style={{ background:C.yellowDim,border:`1px solid ${C.yellow}33`,borderRadius:12,padding:"12px 16px",fontSize:12,color:C.yellow,lineHeight:1.7 }}>
              الـ Passcode ده مستقل تماماً عن كلمة مرور حسابك، ومشترك بين كل الموظفين اللي عندهم صلاحية العمليات الحساسة (تعديل/حذف فواتير، مصروفات، موظفين... إلخ). {hasPasscode ? "✓ فيه رمز حماية مضبوط حالياً." : "⚠️ لسه معملتش رمز حماية — العمليات الحساسة مش هتكون محمية."}
            </div>
            <Inp label="رمز الحماية الجديد" value={passcode} onChange={setPasscode} placeholder="4 أرقام أو أكثر" type="password" />
            <Inp label="تأكيد رمز الحماية" value={passcodeConfirm} onChange={setPasscodeConfirm} placeholder="أعد إدخال الرمز" type="password" />
            <div style={{ display:"flex",justifyContent:"flex-end" }}>
              <Btn variant="success" onClick={handleSavePasscode}>{savingSecurity?"جاري الحفظ...":hasPasscode?"تغيير رمز الحماية":"ضبط رمز الحماية"}</Btn>
            </div>
          </div>
        </Card>
      )}

      {tab === "security" && (
        <Card>
          <div style={{ display:"flex",alignItems:"center",gap:12,padding:"4px 0" }}>
            <Ic d={I.shield} s={20} c={C.accent} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13,fontWeight:700,color:C.text }}>سجل النشاط الكامل</div>
              <div style={{ fontSize:11,color:C.textMuted,marginTop:2 }}>كل العمليات المهمة بالتفصيل (بحث وفلترة وتصدير) موجودة في صفحة "سجل النشاط" من القائمة الجانبية.</div>
            </div>
          </div>
        </Card>
      )}

      {tab === "users" && (
        <Card>
          <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
            {usersMsg.text && <div style={{ background:usersMsg.type==="success"?C.greenDim:C.redDim,border:`1px solid ${usersMsg.type==="success"?C.green:C.red}33`,color:usersMsg.type==="success"?C.green:C.red,borderRadius:10,padding:"10px 16px",fontSize:13,fontWeight:700 }}>{usersMsg.text}</div>}
            <div style={{ background: ownerCanEditUsers ? C.greenDim : C.yellowDim, border:`1px solid ${ownerCanEditUsers?C.green:C.yellow}33`, borderRadius:12, padding:"12px 16px", fontSize:12, color: ownerCanEditUsers ? C.green : C.yellow, lineHeight:1.7 }}>
              {ownerCanEditUsers
                ? "✓ تقدر تعدّل اليوزرنيم/الاسم/كلمة المرور لموظفيك. إنشاء مستخدمين جدد أو تعديل الصلاحيات والأدوار متاح بس من خلال إدارة النظام."
                : "👁️ وضع المشاهدة فقط — تقدر تشوف قائمة موظفيك بس، ومش تقدر تعدّل بياناتهم. لو محتاج تعديل، تواصل مع إدارة النظام."}
            </div>
            {subUsersLoading ? (
              <div style={{ padding:30,textAlign:"center",color:C.textMuted,fontSize:13 }}>جاري التحميل...</div>
            ) : subUsersList.length===0 ? (
              <div style={{ padding:30,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا يوجد موظفين مضافين بعد</div>
            ) : (
              <div style={{ overflowX:"auto",WebkitOverflowScrolling:"touch" }}>
              <table style={{ width:"100%",minWidth:520,borderCollapse:"collapse" }}>
                <THead cols={["اسم المستخدم","الاسم الظاهر","الدور","الحالة",""]} />
                <tbody>
                  {subUsersList.map((su,idx)=>(
                    <TRow key={su.id} alt={idx%2}>
                      <TD color={C.accent}><span style={{ fontWeight:700 }}>{su.username}</span></TD>
                      <TD>{su.display_name||"—"}</TD>
                      <TD color={C.textDim}>{su.role}</TD>
                      <td style={{ padding:"11px 14px" }}><Badge label={su.is_active?"نشط":"موقوف"} /></td>
                      <td style={{ padding:"11px 14px" }}>
                        {ownerCanEditUsers && (
                          <button onClick={()=>openEditSubUser(su)} style={{ background:"none",border:"none",cursor:"pointer",color:C.accent }}><Ic d={I.edit} s={14} /></button>
                        )}
                      </td>
                    </TRow>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </Card>
      )}

      {editingSubUser && (
        <Modal title={`تعديل بيانات ${editingSubUser.username}`} onClose={()=>setEditingSubUser(null)}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <Inp label="اسم المستخدم (Username)" value={subUserEditForm.username} onChange={v=>setSubUserEditForm({...subUserEditForm,username:v.replace(/\s/g,"_")})} />
            <Inp label="الاسم الظاهر" value={subUserEditForm.display_name} onChange={v=>setSubUserEditForm({...subUserEditForm,display_name:v})} />
            <Inp label="كلمة مرور جديدة (اتركه فارغ للإبقاء على القديمة)" value={subUserEditForm.password} onChange={v=>setSubUserEditForm({...subUserEditForm,password:v})} type="password" placeholder="••••••••" />
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setEditingSubUser(null)}>إلغاء</Btn>
              <Btn onClick={saveSubUserEdit}>حفظ التعديلات</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── RECEIPTS PAGE (المقبوضات) ─────────────────────────────────────────────────
function ReceiptsPage({ receipts=[], onAdd, onUpdate, onDelete, security, pageId, userEmail }) {
  const [showModal, setShowModal] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState(null);
  const { requestPasscode, PasscodeGate, log } = usePasscodeGate(security);
  const emptyForm = { date: new Date().toISOString().split("T")[0], payer:"", amount:"", paymentMethod:"نقدي", checkNumber:"", checkDate:"", notes:"" };
  const [form, setForm] = useState(emptyForm);

  const handleAdd = () => {
    if (!form.payer.trim() || !form.amount) return;
    const amount = parseFloat(form.amount)||0;
    if (editingReceipt) {
      const updatedRec = { ...editingReceipt, ...form, amount };
      onUpdate(updatedRec);
      log({ actionType:"تعديل", section:"المقبوضات", target:`${editingReceipt.id} — ${form.payer}`, before:editingReceipt, after:updatedRec });
      setEditingReceipt(null);
    } else {
      const rec = { ...form, id:"RCP"+Date.now(), amount, createdAt: new Date().toISOString() };
      onAdd(rec);
    }
    setForm(emptyForm);
    setShowModal(false);
  };

  const openAdd = () => { setForm(emptyForm); setEditingReceipt(null); setShowModal(true); };

  const openEditClick = (r) => {
    requestPasscode({
      pageId, kind:"edit", label:"تعديل سند قبض",
      onConfirm: () => { setForm({ date:r.date, payer:r.payer, amount:String(r.amount), paymentMethod:r.paymentMethod, checkNumber:r.checkNumber||"", checkDate:r.checkDate||"", notes:r.notes||"" }); setEditingReceipt(r); setShowModal(true); },
    });
  };

  const handleDeleteClick = (r) => {
    requestPasscode({
      pageId, kind:"delete", label:"حذف سند قبض",
      onConfirm: () => { onDelete(r.id); log({ actionType:"حذف", section:"المقبوضات", target:`${r.id} — ${r.payer}`, before:r, after:null }); },
    });
  };

  const total = receipts.reduce((s,r)=>s+r.amount,0);
  const byMethod = { نقدي:0, شيك:0, تحويل:0, فيزا:0 };
  receipts.forEach(r=>{ if (byMethod[r.paymentMethod]!==undefined) byMethod[r.paymentMethod]+=r.amount; });

  usePageShortcuts("المقبوضات", [
    { combo:"ctrl+n", label:"سند قبض جديد", description:"يفتح نموذج إضافة مقبوض", enabled:!showModal, handler:openAdd },
    { combo:"ctrl+s", label:"حفظ السند", description:"يحفظ سند القبض المفتوح حاليًا", enabled:showModal, handler:handleAdd },
  ]);

  const inp = { background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 13px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box" };

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      {PasscodeGate}
      <PageHeader title="المقبوضات" icon={I.money} subtitle={`${receipts.length} سند قبض`}
        action={<Btn onClick={openAdd}><Ic d={I.plus} s={14} />إضافة مقبوض</Btn>} />

      {/* Stats */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
        <MiniStat label="إجمالي المقبوضات" value={fmt(total)} color={C.green} icon={I.money} />
        <MiniStat label="نقدي" value={fmt(byMethod["نقدي"])} color={C.blue} icon={I.money} />
        <MiniStat label="تحويل / فيزا" value={fmt(byMethod["تحويل"]+byMethod["فيزا"])} color={C.accent} icon={I.money} />
        <MiniStat label="شيكات" value={fmt(byMethod["شيك"])} color={C.yellow} icon={I.money} />
      </div>

      <Card style={{ padding:0 }}>
        <div style={{ overflowX:"auto",WebkitOverflowScrolling:"touch" }}>
        <table style={{ width:"100%",minWidth:700,borderCollapse:"collapse" }}>
          <THead cols={["رقم السند","التاريخ","المدفوع من","المبلغ","طريقة الدفع","ملاحظات",""]} />
          <tbody>
            {receipts.map((r,i)=>(
              <TRow key={r.id} alt={i%2}>
                <TD color={C.accent}>{r.id}</TD>
                <TD color={C.textDim}>{r.date}</TD>
                <TD><span style={{ fontWeight:700 }}>{r.payer}</span></TD>
                <TD mono color={C.green}><span style={{ fontWeight:700 }}>{fmt(r.amount)}</span></TD>
                <td style={{ padding:"11px 14px" }}>
                  <span style={{ background:C.accentDim,color:C.accent,border:`1px solid ${C.accent}33`,padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700 }}>
                    {r.paymentMethod==="نقدي"?"💵 نقدي":r.paymentMethod==="شيك"?"📄 شيك":r.paymentMethod==="تحويل"?"🏦 تحويل":r.paymentMethod==="فيزا"?"💳 فيزا":r.paymentMethod}
                  </span>
                  {r.paymentMethod==="شيك" && r.checkNumber && <div style={{ fontSize:10,color:C.textMuted,marginTop:3 }}>شيك #{r.checkNumber} — {r.checkDate}</div>}
                </td>
                <TD color={C.textMuted}>{r.notes||"—"}</TD>
                <td style={{ padding:"11px 14px" }}>
                  <div style={{ display:"flex",gap:6 }}>
                    <button onClick={()=>openEditClick(r)} style={{ background:"none",border:"none",cursor:"pointer",color:C.accent }}><Ic d={I.edit} s={14} /></button>
                    <button onClick={()=>handleDeleteClick(r)} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted }}><Ic d={I.trash} s={14} c={C.red} /></button>
                  </div>
                </td>
              </TRow>
            ))}
          </tbody>
        </table>
        </div>
        {receipts.length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد مقبوضات بعد</div>}
      </Card>

      {showModal && (
        <Modal title={editingReceipt?"تعديل سند قبض":"إضافة سند مقبوض"} onClose={()=>{ setShowModal(false); setEditingReceipt(null); }}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
                <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>التاريخ</label>
                <DatePicker value={form.date} onChange={v=>setForm({...form,date:v})} />
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
                <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>المدفوع من *</label>
                <input value={form.payer} onChange={e=>setForm({...form,payer:e.target.value})} placeholder="اسم الشخص أو الجهة" style={inp} />
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
                <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>المبلغ *</label>
                <input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0" style={inp} />
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
                <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>طريقة الدفع</label>
                <select value={form.paymentMethod} onChange={e=>setForm({...form,paymentMethod:e.target.value})} style={{...inp,padding:"9px 13px"}}>
                  <option value="نقدي">💵 نقدي</option>
                  <option value="شيك">📄 شيك</option>
                  <option value="تحويل">🏦 تحويل بنكي</option>
                  <option value="فيزا">💳 فيزا</option>
                </select>
              </div>
              {form.paymentMethod==="شيك" && <>
                <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
                  <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>رقم الشيك</label>
                  <input value={form.checkNumber} onChange={e=>setForm({...form,checkNumber:e.target.value})} style={inp} />
                </div>
                <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
                  <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>تاريخ الشيك</label>
                  <DatePicker value={form.checkDate} onChange={v=>setForm({...form,checkDate:v})} />
                </div>
              </>}
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
              <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>ملاحظات</label>
              <input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="أي ملاحظات..." style={inp} />
            </div>
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>{ setShowModal(false); setEditingReceipt(null); }}>إلغاء</Btn>
              <Btn variant="success" onClick={handleAdd}><Ic d={I.plus} s={14} />{editingReceipt?"حفظ التعديلات":"حفظ السند"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── SUBSCRIPTION EXPIRY BELL ────────────────────────────────────────────────

// ─── EXPENSES PAGE ────────────────────────────────────────────────────────────
function ExpensesPage({ expenses=[], onAdd, onUpdate, onDelete, security, pageId, userEmail }) {
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const { requestPasscode, PasscodeGate, log } = usePasscodeGate(security);
  const [filter, setFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const emptyForm = { date:today(), description:"", category:"إيجار", amount:"", paymentMethod:"نقدي", notes:"" };
  const [form, setForm] = useState(emptyForm);

  const expenseCategories = ["إيجار","كهرباء","مياه","غاز","إنترنت","تأمين","صيانة","مواصلات","تسويق","قرطاسية","رسوم قانونية","ضرائب","أخرى"];

  const handleSave = () => {
    if (!form.description.trim()||!form.amount) return;
    const amount = parseFloat(form.amount)||0;
    if (editingExpense) {
      const updatedRec = { ...editingExpense, ...form, amount };
      onUpdate(updatedRec);
      log({ actionType:"تعديل", section:"المصروفات", target:`${editingExpense.id} — ${form.description}`, before:editingExpense, after:updatedRec });
      setEditingExpense(null);
    } else {
      const rec = { id:"EXP"+Date.now().toString().slice(-5), ...form, amount };
      onAdd(rec);
    }
    setShowModal(false);
    setForm(emptyForm);
  };

  const openAdd = () => { setForm(emptyForm); setEditingExpense(null); setShowModal(true); };

  const openEditClick = (e) => {
    requestPasscode({
      pageId, kind:"edit", label:"تعديل مصروف",
      onConfirm: () => { setForm({ date:e.date, description:e.description, category:e.category, amount:String(e.amount), paymentMethod:e.paymentMethod, notes:e.notes||"" }); setEditingExpense(e); setShowModal(true); },
    });
  };

  const handleDeleteClick = (e) => {
    requestPasscode({
      pageId, kind:"delete", label:"حذف مصروف",
      onConfirm: () => { onDelete(e.id); log({ actionType:"حذف", section:"المصروفات", target:`${e.id} — ${e.description}`, before:e, after:null }); },
    });
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
  const filterRef = useRef(null);

  usePageShortcuts("المصروفات", [
    { combo:"ctrl+n", label:"مصروف جديد", description:"يفتح نموذج إضافة مصروف", enabled:!showModal, handler:openAdd },
    { combo:"ctrl+f", label:"البحث في المصروفات", description:"يركّز على مربع البحث بالوصف أو الفئة", enabled:!showModal, handler:()=>filterRef.current?.focus() },
    { combo:"ctrl+s", label:"حفظ المصروف", description:"يحفظ المصروف المفتوح حاليًا", enabled:showModal, handler:handleSave },
  ]);

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      {PasscodeGate}
      <PageHeader title="المصروفات" icon={I.revenue} subtitle={`${filtered.length} مصروف — إجمالي ${fmt(totalExpenses)}`}
        action={<Btn onClick={openAdd}><Ic d={I.plus} s={14} />إضافة مصروف</Btn>} />
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
          <input ref={filterRef} value={filter} onChange={e=>setFilter(e.target.value)} placeholder="ابحث..." style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 13px",color:C.text,fontSize:12,fontFamily:"inherit",outline:"none",width:200 }} />
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
                  <div style={{ display:"flex",gap:6 }}>
                    <button onClick={()=>openEditClick(e)} style={{ background:"none",border:"none",cursor:"pointer",color:C.accent }}><Ic d={I.edit} s={14} /></button>
                    <button onClick={()=>handleDeleteClick(e)} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted }}><Ic d={I.trash} s={14} /></button>
                  </div>
                </td>
              </TRow>
            ))}
          </tbody>
        </table>
        {filtered.length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد مصروفات</div>}
      </Card>
      {showModal && (
        <Modal title={editingExpense?"تعديل مصروف":"إضافة مصروف"} onClose={()=>{ setShowModal(false); setEditingExpense(null); }}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <DatePicker label="التاريخ" value={form.date} onChange={v=>setForm({...form,date:v})} />
              <Inp label="الوصف" value={form.description} onChange={v=>setForm({...form,description:v})} required />
              <Sel label="الفئة" value={form.category} onChange={v=>setForm({...form,category:v})} options={expenseCategories} />
              <Inp label="المبلغ (ج.م)" type="number" value={form.amount} onChange={v=>setForm({...form,amount:v})} required />
              <Sel label="طريقة الدفع" value={form.paymentMethod} onChange={v=>setForm({...form,paymentMethod:v})} options={[{value:"نقدي",label:"💵 نقدي"},{value:"شيك",label:"📄 شيك"},{value:"تحويل",label:"🏦 تحويل"}]} />
            </div>
            <Inp label="ملاحظات" value={form.notes} onChange={v=>setForm({...form,notes:v})} placeholder="أي ملاحظات..." />
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>{ setShowModal(false); setEditingExpense(null); }}>إلغاء</Btn>
              <Btn onClick={handleSave}>{editingExpense?"حفظ التعديلات":"حفظ المصروف"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── UNIFIED NOTIFICATIONS BELL ──────────────────────────────────────────────
function UnifiedNotificationBell({ days, inventory }) {
  const [open, setOpen] = useState(false);
  const lowItems = (inventory || []).filter(p => p.qty <= p.minQty);
  const hasExpiry = days !== null && days <= 10;
  const hasLowStock = lowItems.length > 0;
  const totalCount = (hasExpiry ? 1 : 0) + lowItems.length;
  if (!hasExpiry && !hasLowStock) return null;

  const expiryColor = days <= 3 ? C.red : days <= 7 ? C.yellow : C.blue;
  const expiryDim = days <= 3 ? C.redDim : days <= 7 ? C.yellowDim : C.blueDim;
  const expiryLabel = days === 0 ? "انتهى الاشتراك!" : days === 1 ? "يوم واحد متبقي" : `${days} يوم متبقي`;

  // لون الزرار: لو في اشتراك منتهي أو مخزون منخفض → أحمر، غير كده → لون الاشتراك
  const btnColor = (days !== null && days <= 3) || hasLowStock ? C.red : expiryColor;
  const btnDim = (days !== null && days <= 3) || hasLowStock ? C.redDim : expiryDim;

  return (
    <div style={{ position:"relative" }}>
      <button onClick={()=>setOpen(p=>!p)} style={{ background:btnDim,border:`1px solid ${btnColor}33`,borderRadius:10,padding:"8px 12px",cursor:"pointer",color:btnColor,display:"flex",alignItems:"center",gap:6,fontFamily:"inherit",fontSize:12,fontWeight:700 }}>
        <Ic d={I.bell} s={15} c={btnColor} />
        <span style={{ background:btnColor,color:"#fff",borderRadius:"50%",width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,flexShrink:0 }}>{totalCount}</span>
        <span>إشعارات</span>
      </button>
      {open && (
        <div style={{ position:"absolute",top:"calc(100% + 8px)",left:0,zIndex:500,background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:16,width:340,boxShadow:"0 8px 40px rgba(0,0,0,0.5)" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
            <span style={{ fontWeight:700,color:C.text,fontSize:13 }}>🔔 الإشعارات ({totalCount})</span>
            <button onClick={()=>setOpen(false)} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted }}><Ic d={I.close} s={14} /></button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:8,maxHeight:320,overflowY:"auto" }}>
            {/* تنبيه الاشتراك */}
            {hasExpiry && (
              <div style={{ background:expiryDim,border:`1px solid ${expiryColor}33`,borderRadius:12,padding:"12px 14px" }}>
                <div style={{ fontWeight:700,color:expiryColor,fontSize:12,marginBottom:4 }}>⏳ تنبيه الاشتراك</div>
                <div style={{ fontWeight:800,color:expiryColor,fontSize:14 }}>
                  {days === 0 ? "❌ انتهت صلاحية اشتراكك" : `متبقي ${expiryLabel}`}
                </div>
                <div style={{ fontSize:11,color:C.textMuted,marginTop:4 }}>تواصل مع الإدارة لتجديد الاشتراك</div>
              </div>
            )}
            {/* مخزون منخفض */}
            {hasLowStock && (
              <>
                <div style={{ fontSize:11,color:C.textMuted,fontWeight:600,padding:"2px 4px" }}>📦 مخزون منخفض ({lowItems.length} صنف)</div>
                {lowItems.map(p=>(
                  <div key={p.id} style={{ background:C.redDim,border:`1px solid ${C.red}22`,borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                    <div>
                      <div style={{ fontWeight:700,color:C.text,fontSize:13 }}>{p.name}</div>
                      <div style={{ fontSize:11,color:C.textMuted }}>{p.category}</div>
                    </div>
                    <div style={{ textAlign:"left" }}>
                      <div style={{ fontSize:13,fontWeight:800,color:C.red,fontFamily:"monospace" }}>{p.qty} / {p.minQty}</div>
                      <div style={{ fontSize:10,color:C.textMuted }}>الموجود / الحد الأدنى</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


export {
  LiveClock, Dashboard, AccountStatement, InventoryItemsPage, InventoryPage,
  CategoriesPage, CompanySettingsPage, ReceiptsPage,
  ExpensesPage, UnifiedNotificationBell,
};
