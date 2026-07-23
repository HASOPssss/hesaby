import { useState, useEffect } from "react";
import {
  supabase, C, Ic, I, fmtDateTime, openPrint, getCompanyBranding,
  Card, MiniStat, Btn, Inp, Sel, DatePicker, Modal, THead, TRow, TD, PageHeader,
} from "./shared";

// ══════════════════════════════════════════════════════════════════════════════
// ActivityLogPage.jsx — سجل النشاط (Audit Log): صفحة مستقلة للاطلاع على كل
// العمليات المهمة (إنشاء/تعديل/حذف/سداد/دخول/خروج...) مع بحث وفلترة وتصدير.
// الوصول لصاحب الشركة والمشرف (Supervisor) بس — بيتحقق منها في AppShell/App.jsx
// عن طريق security.canViewAuditLog. الصفحة للقراءة فقط، مفيش أي تعديل أو حذف
// للسجلات نهائياً — عشان موثوقية البيانات.
// ══════════════════════════════════════════════════════════════════════════════

function ActivityLogPage({ userId, security }) {
  const ownerId = security?.ownerId || userId;
  const canView = !security || security.canViewAuditLog;

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewingEntry, setViewingEntry] = useState(null);

  useEffect(() => {
    if (!ownerId || !canView) { setLoading(false); return; }
    setLoading(true);
    supabase.from("audit_log").select("*").eq("owner_id", ownerId).order("created_at", { ascending:false }).limit(2000)
      .then(({ data }) => setEntries(data || []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [ownerId, canView]);

  if (!canView) {
    return (
      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"80px 20px",gap:14 }}>
        <div style={{ background:C.redDim,padding:16,borderRadius:16 }}><Ic d={I.shield} s={32} c={C.red} /></div>
        <h3 style={{ margin:0,fontSize:16,color:C.text }}>غير مصرح لك بالوصول لهذه الصفحة</h3>
        <p style={{ margin:0,fontSize:13,color:C.textMuted,textAlign:"center" }}>سجل النشاط متاح لصاحب الشركة والمشرف (Supervisor) فقط.</p>
      </div>
    );
  }

  const sections = [...new Set(entries.map(e=>e.section).filter(Boolean))];
  const actionTypes = [...new Set(entries.map(e=>e.action_type).filter(Boolean))];

  const filtered = entries.filter(e => {
    const s = search.trim();
    const matchSearch = !s ||
      e.user_name?.includes(s) || e.full_name?.includes(s) || e.target?.includes(s);
    const matchSection = !sectionFilter || e.section === sectionFilter;
    const matchAction = !actionFilter || e.action_type === actionFilter;
    const day = e.created_at ? e.created_at.slice(0,10) : "";
    const matchFrom = !dateFrom || day >= dateFrom;
    const matchTo = !dateTo || day <= dateTo;
    return matchSearch && matchSection && matchAction && matchFrom && matchTo;
  });

  const fmtDT = (iso) => { try { return new Date(iso).toLocaleString("ar-EG",{ year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit" }); } catch { return iso||"—"; } };

  const actionColor = (t) => {
    if (!t) return C.textMuted;
    if (t.includes("حذف")) return C.red;
    if (t.includes("تعديل")) return C.accent;
    if (t.includes("إضافة")||t.includes("إنشاء")) return C.green;
    if (t.includes("سداد")) return C.yellow;
    if (t.includes("دخول")) return C.blue;
    if (t.includes("خروج")) return C.textMuted;
    return C.purple;
  };

  // ── تصدير Excel (CSV) ──
  const exportExcel = () => {
    const headers = ["الوقت","اسم المستخدم","الاسم الكامل","نوع العملية","القسم","العنصر"];
    const rows = filtered.map(e => [
      fmtDT(e.created_at), e.user_name||"", e.full_name||"", e.action_type||"", e.section||"", (e.target||"").replace(/\n/g," "),
    ]);
    const csv = "\uFEFF" + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `سجل_النشاط_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── تصدير PDF (طباعة) ──
  const exportPDF = () => {
    const { name: companyName, logo: companyLogo } = getCompanyBranding();
    const logoHtml = companyLogo ? `<img src="${companyLogo}" style="width:40px;height:40px;object-fit:cover;border-radius:8px;margin-left:10px" />` : "";
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>سجل النشاط</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo','Segoe UI',sans-serif;background:#fff;color:#1a1a2e;padding:30px}
    .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #6c7fff}
    table{width:100%;border-collapse:collapse;font-size:10px}thead tr{background:#6c7fff;color:#fff}
    thead th{padding:6px 8px;font-weight:700;text-align:right}tbody tr:nth-child(even){background:#f8faff}
    tbody td{padding:6px 8px;border-bottom:1px solid #e2e8f0}
    .footer{margin-top:20px;text-align:center;font-size:10px;color:#94a3b8}
    @media print{body{padding:15px}}</style></head><body>
    <div class="header"><div style="display:flex;align-items:center">${logoHtml}<div style="font-size:18px;font-weight:800">سجل النشاط</div></div>
    <div style="text-align:left"><div style="font-weight:700;color:#6c7fff">${companyName}</div><div style="font-size:11px;color:#64748b">${new Date().toLocaleDateString("ar-EG")} — ${filtered.length} عملية</div></div></div>
    <table><thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>القسم</th><th>العنصر</th></tr></thead><tbody>
    ${filtered.map(e=>`<tr><td>${fmtDT(e.created_at)}</td><td>${e.full_name||e.user_name||"—"}</td><td>${e.action_type||"—"}</td><td>${e.section||"—"}</td><td>${e.target||"—"}</td></tr>`).join("")}
    </tbody></table>
    <div class="footer">${companyName} — hesapy.pro</div>
    </body></html>`;
    openPrint(html);
  };

  const renderValues = (jsonStr) => {
    if (!jsonStr) return <span style={{ color:C.textMuted }}>—</span>;
    try {
      const obj = JSON.parse(jsonStr);
      return (
        <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
          {Object.entries(obj).map(([k,v])=>(
            <div key={k} style={{ fontSize:11 }}><span style={{ color:C.textMuted }}>{k}:</span> <span style={{ color:C.text,fontWeight:600 }}>{typeof v==="object"?JSON.stringify(v):String(v)}</span></div>
          ))}
        </div>
      );
    } catch { return <span style={{ color:C.textMuted }}>{jsonStr}</span>; }
  };

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      <PageHeader title="سجل النشاط" icon={I.shield} subtitle={`${filtered.length} من ${entries.length} عملية`}
        action={
          <div style={{ display:"flex",gap:8 }}>
            <Btn variant="yellow" onClick={exportExcel}><Ic d={I.download} s={13} />تصدير Excel</Btn>
            <Btn variant="cyan" onClick={exportPDF}><Ic d={I.print} s={13} />تصدير PDF</Btn>
          </div>
        }
      />

      <div style={{ background:C.accentDim,border:`1px solid ${C.accent}22`,borderRadius:12,padding:"12px 16px",fontSize:12,color:C.accent }}>
        🔒 السجل ده للقراءة فقط — لا يمكن تعديل أو حذف أي عملية منه حفاظاً على موثوقية البيانات.
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
        <MiniStat label="إجمالي العمليات" value={entries.length} color={C.accent} icon={I.chartBar} />
        <MiniStat label="عمليات حذف" value={entries.filter(e=>e.action_type?.includes("حذف")).length} color={C.red} icon={I.trash} />
        <MiniStat label="عمليات تعديل" value={entries.filter(e=>e.action_type?.includes("تعديل")).length} color={C.blue} icon={I.edit} />
        <MiniStat label="عمليات إضافة/إنشاء" value={entries.filter(e=>e.action_type?.includes("إضافة")||e.action_type?.includes("إنشاء")).length} color={C.green} icon={I.plus} />
      </div>

      <Card>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10 }}>
          <Inp label="بحث (مستخدم / عنصر)" value={search} onChange={setSearch} placeholder="اسم، رقم فاتورة، عميل..." />
          <Sel label="القسم" value={sectionFilter} onChange={setSectionFilter} options={[{value:"",label:"كل الأقسام"}, ...sections.map(s=>({value:s,label:s}))]} />
          <Sel label="نوع العملية" value={actionFilter} onChange={setActionFilter} options={[{value:"",label:"كل الأنواع"}, ...actionTypes.map(a=>({value:a,label:a}))]} />
          <DatePicker label="من تاريخ" value={dateFrom} onChange={setDateFrom} />
          <DatePicker label="إلى تاريخ" value={dateTo} onChange={setDateTo} />
        </div>
      </Card>

      <Card style={{ padding:0 }}>
        {loading ? (
          <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد عمليات مطابقة</div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%",borderCollapse:"collapse" }}>
              <THead cols={["الوقت","المستخدم","نوع العملية","القسم","العنصر",""]} />
              <tbody>
                {filtered.map((e,idx)=>(
                  <TRow key={e.id||idx} alt={idx%2}>
                    <TD color={C.textMuted}><span style={{ fontSize:11 }}>{fmtDT(e.created_at)}</span></TD>
                    <TD><span style={{ fontWeight:700 }}>{e.full_name || e.user_name || "—"}</span></TD>
                    <td style={{ padding:"11px 14px" }}>
                      <span style={{ background:actionColor(e.action_type)+"18",color:actionColor(e.action_type),border:`1px solid ${actionColor(e.action_type)}33`,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700 }}>{e.action_type||"—"}</span>
                    </td>
                    <TD color={C.textDim}>{e.section||"—"}</TD>
                    <TD color={C.text}>{e.target||"—"}</TD>
                    <td style={{ padding:"11px 14px" }}>
                      {(e.before_values || e.after_values) && (
                        <button onClick={()=>setViewingEntry(e)} style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,color:C.accent,cursor:"pointer",fontFamily:"inherit" }}>عرض التفاصيل</button>
                      )}
                    </td>
                  </TRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {viewingEntry && (
        <Modal title="تفاصيل العملية" onClose={()=>setViewingEntry(null)}>
          <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
            <div style={{ fontSize:12,color:C.textMuted }}>
              <strong style={{ color:C.text }}>{viewingEntry.full_name||viewingEntry.user_name}</strong> — {viewingEntry.action_type} — {viewingEntry.target} — {fmtDT(viewingEntry.created_at)}
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
              <div style={{ background:C.redDim,border:`1px solid ${C.red}22`,borderRadius:10,padding:14 }}>
                <div style={{ fontSize:12,fontWeight:700,color:C.red,marginBottom:8 }}>قبل التعديل</div>
                {renderValues(viewingEntry.before_values)}
              </div>
              <div style={{ background:C.greenDim,border:`1px solid ${C.green}22`,borderRadius:10,padding:14 }}>
                <div style={{ fontSize:12,fontWeight:700,color:C.green,marginBottom:8 }}>بعد التعديل</div>
                {renderValues(viewingEntry.after_values)}
              </div>
            </div>
            <div style={{ display:"flex",justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setViewingEntry(null)}>إغلاق</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ActivityLogPage;
