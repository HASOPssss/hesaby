import { useState } from "react";
import {
  C, Ic, I, fmt, fmtDateTime, today, getMonth, openPrint, getCompanyBranding,
  Card, MiniStat, Btn, Inp, Sel, Modal, THead, TRow, TD, PageHeader,
} from "./shared";

// ══════════════════════════════════════════════════════════════════════════════
// TaxReportsPage.jsx — التقارير الضريبية: ملخص الشهر، قواعد الضرائب، والأرشيف.
// ══════════════════════════════════════════════════════════════════════════════

// ─── TAX REPORTS PAGE ────────────────────────────────────────────────────────
function TaxReportsPage({ data }) {
  const [taxRules, setTaxRules] = useState(() => {
    try { return JSON.parse(localStorage.getItem("tax_rules_local")||"[]"); } catch { return []; }
  });
  const [monthlyTaxReports, setMonthlyTaxReports] = useState(() => {
    try { return JSON.parse(localStorage.getItem("monthly_tax_reports")||"[]"); } catch { return []; }
  });
  const [selectedMonth, setSelectedMonth] = useState(today().slice(0,7));
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [activeTab, setActiveTab] = useState("summary"); // summary | rules | archive
  const [ruleForm, setRuleForm] = useState({
    name:"", type:"نسبة مبيعات", rate:"", fixedAmount:"", base:"إجمالي المبيعات",
    category:"", notes:"", entityType:"شركة", frequency:"شهري"
  });

  const taxTypes = [
    { value:"نسبة مبيعات", label:"نسبة من المبيعات %" },
    { value:"نسبة أرباح", label:"نسبة من صافي الربح %" },
    { value:"قيمة مضافة", label:"ضريبة القيمة المضافة % (ع.ق)" },
    { value:"دمغة", label:"ضريبة دمغة %" },
    { value:"دخل", label:"ضريبة دخل %" },
    { value:"عقارات", label:"ضريبة عقارات %" },
    { value:"زراعية", label:"رسوم زراعية %" },
    { value:"صناعية", label:"رسوم صناعية %" },
    { value:"ثابتة شهرية", label:"رسم ثابت شهري (ج.م)" },
    { value:"جمارك", label:"رسوم جمارك %" },
  ];

  const entityTypes = ["شركة","مصنع","مزرعة","متجر","مطعم","مقاول","فردي","آخر"];

  const saveTaxRules = (list) => {
    setTaxRules(list);
    localStorage.setItem("tax_rules_local", JSON.stringify(list));
  };

  const handleSaveRule = () => {
    if (!ruleForm.name.trim()) return;
    const rec = {
      id: "TAX"+Date.now().toString().slice(-5),
      ...ruleForm,
      rate: parseFloat(ruleForm.rate)||0,
      fixedAmount: parseFloat(ruleForm.fixedAmount)||0,
      createdAt: new Date().toISOString(),
    };
    saveTaxRules([...taxRules, rec]);
    setShowRuleModal(false);
    setRuleForm({ name:"", type:"نسبة مبيعات", rate:"", fixedAmount:"", base:"إجمالي المبيعات", category:"", notes:"", entityType:"شركة", frequency:"شهري" });
  };

  const deleteRule = (id) => saveTaxRules(taxRules.filter(r=>r.id!==id));

  // Calculate taxes for selected month
  const monthSales = data.salesInvoices.filter(i=>getMonth(i.date)===selectedMonth);
  const monthPurchases = data.purchaseInvoices.filter(i=>getMonth(i.date)===selectedMonth);
  const invoiceTax = monthSales.reduce((s,i)=>s+(i.taxAmount||0),0);
  const totalSales = monthSales.reduce((s,i)=>s+i.amount,0);
  const totalPurchases = monthPurchases.reduce((s,i)=>s+i.amount,0);
  const netProfit = totalSales - totalPurchases;

  const getBase = (rule) => {
    if (rule.base==="صافي الربح") return netProfit;
    if (rule.base==="إجمالي المشتريات") return totalPurchases;
    return totalSales; // default: إجمالي المبيعات
  };

  const calcTax = (rule) => {
    if (rule.type==="ثابتة شهرية") return rule.fixedAmount||0;
    const base = getBase(rule);
    return base * (rule.rate||0) / 100;
  };

  const taxSummary = taxRules.filter(r=>r.frequency==="شهري"||r.frequency==="كل فاتورة").map(r=>({
    ...r, calculatedAmount: calcTax(r)
  }));

  const totalCustomTax = taxSummary.reduce((s,r)=>s+r.calculatedAmount,0);
  const grandTotalTax = invoiceTax + totalCustomTax;

  const allMonths = [...new Set([
    ...data.salesInvoices.map(i=>getMonth(i.date)),
    today().slice(0,7),
  ])].filter(Boolean).sort().reverse();

  const saveMonthlyTaxReport = () => {
    const report = {
      month: selectedMonth,
      closedAt: new Date().toISOString(),
      invoiceTax, totalCustomTax, grandTotalTax,
      totalSales, totalPurchases, netProfit,
      rules: taxSummary,
    };
    const updated = [...monthlyTaxReports.filter(r=>r.month!==selectedMonth), report];
    setMonthlyTaxReports(updated);
    localStorage.setItem("monthly_tax_reports", JSON.stringify(updated));
    // Print
    printTaxMonthReport(report, selectedMonth);
  };

  const printTaxMonthReport = (report, month) => {
    const { name: companyName, logo: companyLogo } = getCompanyBranding();
    const logoHtml = companyLogo ? `<img src="${companyLogo}" style="width:50px;height:50px;object-fit:cover;border-radius:8px;margin:0 auto 8px;display:block" />` : "";
    const [y,m] = month.split("-");
    const label = new Date(+y,+m-1,1).toLocaleDateString("ar-EG",{month:"long",year:"numeric"});
    const printDateTime = new Date().toLocaleString("ar-EG",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تقرير ضريبي ${month}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo','Segoe UI',sans-serif;background:#fff;color:#1a1a2e;padding:36px 40px}
    .header{text-align:center;padding-bottom:18px;border-bottom:3px solid #f59e0b;margin-bottom:24px}
    .logo{font-size:24px;font-weight:900;color:#f59e0b}.stamp{background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:6px 18px;display:inline-block;margin-top:10px;font-size:12px;color:#92400e;font-weight:700}
    .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
    .stat{border-radius:10px;padding:14px 16px;border:1px solid #e2e8f0;text-align:center}
    .stat-v{font-size:17px;font-weight:800;font-family:monospace}.stat-l{font-size:10px;color:#64748b;margin-top:3px}
    table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px}
    thead tr{background:#f59e0b;color:#fff}thead th{padding:9px 12px;font-weight:700;text-align:right}
    tbody tr:nth-child(even){background:#fffbeb}tbody td{padding:9px 12px;border-bottom:1px solid #e2e8f0}
    .total{background:#fef3c7;font-weight:800;font-size:13px}
    .footer{margin-top:24px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px}
    @media print{body{padding:16px}}</style></head><body>
    <div class="header">${logoHtml}<div class="logo">${companyName}</div><div style="font-size:13px;color:#64748b;margin-top:4px">📊 التقرير الضريبي الشهري</div>
    <div class="stamp">📅 ${label}</div></div>
    <div class="stats">
      <div class="stat"><div class="stat-v" style="color:#34d399">${report.totalSales.toLocaleString("ar-EG")} ج.م</div><div class="stat-l">إجمالي المبيعات</div></div>
      <div class="stat"><div class="stat-v" style="color:#f87171">${report.totalPurchases.toLocaleString("ar-EG")} ج.م</div><div class="stat-l">إجمالي المشتريات</div></div>
      <div class="stat"><div class="stat-v" style="color:${report.netProfit>=0?"#34d399":"#f87171"}">${report.netProfit.toLocaleString("ar-EG")} ج.م</div><div class="stat-l">صافي الربح</div></div>
    </div>
    <table><thead><tr><th>اسم الضريبة</th><th>النوع</th><th>النسبة/المبلغ</th><th>الأساس</th><th>المبلغ المحسوب</th></tr></thead><tbody>
    <tr><td>ضريبة القيمة المضافة على الفواتير</td><td>ع.ق فواتير</td><td>—</td><td>الفواتير</td><td>${report.invoiceTax.toLocaleString("ar-EG")} ج.م</td></tr>
    ${report.rules.map(r=>`<tr><td>${r.name}</td><td>${r.type}</td><td>${r.type==="ثابتة شهرية"?r.fixedAmount.toLocaleString("ar-EG")+" ج.م":r.rate+"%"}</td><td>${r.base||"—"}</td><td>${r.calculatedAmount.toLocaleString("ar-EG")} ج.م</td></tr>`).join("")}
    <tr class="total"><td colspan="4">إجمالي الضرائب المستحقة</td><td style="color:#f59e0b">${report.grandTotalTax.toLocaleString("ar-EG")} ج.م</td></tr>
    </tbody></table>
    <div class="footer">${companyName} — التقرير الضريبي الشهري — طُبع: ${printDateTime} — hesapy.pro</div></body></html>`;
    openPrint(html);
  };

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      <PageHeader title="التقارير الضريبية" icon={I.tax} subtitle="إدارة الضرائب الشهرية لجميع أنواع المنشآت"
        action={
          <div style={{ display:"flex",gap:8 }}>
            {activeTab==="summary" && <Btn variant="yellow" onClick={saveMonthlyTaxReport}><Ic d={I.download} s={14} />حفظ وطباعة التقرير</Btn>}
            {activeTab==="rules" && <Btn onClick={()=>setShowRuleModal(true)}><Ic d={I.plus} s={14} />إضافة ضريبة</Btn>}
          </div>
        }
      />
      {/* Tabs */}
      <div style={{ display:"flex",background:C.surface2,borderRadius:12,padding:4,border:`1px solid ${C.border}`,gap:4 }}>
        {[{id:"summary",label:"📊 ملخص الشهر"},{id:"rules",label:"⚙️ قواعد الضرائب"},{id:"archive",label:"🗂 الأرشيف"}].map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{ flex:1,background:activeTab===t.id?C.yellow:"transparent",color:activeTab===t.id?"#1a1a2e":C.textMuted,border:"none",borderRadius:9,padding:"10px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* SUMMARY TAB */}
      {activeTab==="summary" && (
        <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
          <div style={{ display:"flex",gap:10,alignItems:"center" }}>
            <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)}
              style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 14px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none" }}>
              {allMonths.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
            <MiniStat label="إجمالي المبيعات" value={fmt(totalSales)} color={C.green} icon={I.sales} />
            <MiniStat label="صافي الربح" value={fmt(netProfit)} color={netProfit>=0?C.green:C.red} icon={I.chartBar} />
            <MiniStat label="ض.ق.م الفواتير" value={fmt(invoiceTax)} color={C.yellow} icon={I.tax} />
            <MiniStat label="إجمالي الضرائب" value={fmt(grandTotalTax)} color={C.yellow} icon={I.tax} />
          </div>
          <Card style={{ padding:0 }}>
            <div style={{ padding:"12px 18px",borderBottom:`1px solid ${C.border}`,fontSize:13,fontWeight:700,color:C.text }}>تفاصيل الضرائب — {selectedMonth}</div>
            <div style={{ overflowX:"auto",WebkitOverflowScrolling:"touch" }}>
            <table style={{ width:"100%",minWidth:640,borderCollapse:"collapse" }}>
              <THead cols={["اسم الضريبة","النوع","نوع المنشأة","النسبة/المبلغ","الأساس","المبلغ المحسوب"]} />
              <tbody>
                <TRow alt={false}>
                  <TD><span style={{ fontWeight:600 }}>ضريبة القيمة المضافة (ع.ق) من الفواتير</span></TD>
                  <TD color={C.yellow}>ع.ق فواتير</TD>
                  <TD color={C.textMuted}>—</TD>
                  <TD mono color={C.yellow}>من الفواتير</TD>
                  <TD color={C.textMuted}>الفواتير</TD>
                  <TD mono color={C.yellow}><span style={{ fontWeight:700 }}>{fmt(invoiceTax)}</span></TD>
                </TRow>
                {taxSummary.map((r,i)=>(
                  <TRow key={r.id} alt={(i+1)%2}>
                    <TD><span style={{ fontWeight:600 }}>{r.name}</span></TD>
                    <TD color={C.yellow}>{r.type}</TD>
                    <TD color={C.textMuted}>{r.entityType}</TD>
                    <TD mono color={C.accent}>{r.type==="ثابتة شهرية"?fmt(r.fixedAmount):`${r.rate}%`}</TD>
                    <TD color={C.textMuted}>{r.base||"—"}</TD>
                    <TD mono color={C.yellow}><span style={{ fontWeight:700 }}>{fmt(r.calculatedAmount)}</span></TD>
                  </TRow>
                ))}
                {/* Total Row */}
                <tr style={{ background:C.yellowDim,borderTop:`2px solid ${C.yellow}44` }}>
                  <td colSpan={5} style={{ padding:"12px 14px",fontSize:14,fontWeight:800,color:C.yellow }}>إجمالي الضرائب المستحقة للشهر</td>
                  <td style={{ padding:"12px 14px",fontSize:16,fontWeight:900,color:C.yellow,fontFamily:"monospace" }}>{fmt(grandTotalTax)}</td>
                </tr>
              </tbody>
            </table>
            </div>
          </Card>
        </div>
      )}

      {/* RULES TAB */}
      {activeTab==="rules" && (
        <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
          <Card>
            <p style={{ margin:0,fontSize:12,color:C.textMuted,lineHeight:1.8 }}>
              قم بإضافة الضرائب والرسوم الخاصة بمنشأتك (مصنع، شركة، مزرعة، إلخ). سيتم حسابها تلقائياً كل شهر بناءً على بيانات المبيعات والأرباح.
            </p>
          </Card>
          {taxRules.length===0 ? (
            <Card style={{ textAlign:"center",padding:40 }}>
              <div style={{ color:C.textMuted,fontSize:13 }}>لم تُضف قواعد ضريبية بعد. اضغط "إضافة ضريبة" للبدء.</div>
            </Card>
          ) : (
            <Card style={{ padding:0 }}>
              <div style={{ overflowX:"auto",WebkitOverflowScrolling:"touch" }}>
              <table style={{ width:"100%",minWidth:760,borderCollapse:"collapse" }}>
                <THead cols={["الاسم","النوع","نوع المنشأة","النسبة","الأساس","الدورية","ملاحظات",""]} />
                <tbody>
                  {taxRules.map((r,i)=>(
                    <TRow key={r.id} alt={i%2}>
                      <TD><span style={{ fontWeight:700 }}>{r.name}</span></TD>
                      <TD color={C.yellow}>{r.type}</TD>
                      <TD color={C.textDim}>{r.entityType}</TD>
                      <TD mono color={C.accent}>{r.type==="ثابتة شهرية"?fmt(r.fixedAmount):`${r.rate}%`}</TD>
                      <TD color={C.textMuted}>{r.base||"—"}</TD>
                      <TD color={C.textDim}>{r.frequency}</TD>
                      <TD color={C.textMuted}>{r.notes||"—"}</TD>
                      <td style={{ padding:"11px 14px" }}>
                        <button onClick={()=>deleteRule(r.id)} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted }}><Ic d={I.trash} s={14} /></button>
                      </td>
                    </TRow>
                  ))}
                </tbody>
              </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ARCHIVE TAB */}
      {activeTab==="archive" && (
        <Card>
          <h3 style={{ margin:"0 0 16px",fontSize:15,fontWeight:700,color:C.text }}>🗂 أرشيف التقارير الضريبية الشهرية</h3>
          {monthlyTaxReports.length===0 ? (
            <div style={{ textAlign:"center",color:C.textMuted,padding:30,fontSize:13 }}>لا توجد تقارير ضريبية محفوظة بعد</div>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              {[...monthlyTaxReports].sort((a,b)=>b.month.localeCompare(a.month)).map(r=>{
                const [y,m] = r.month.split("-");
                const label = new Date(+y,+m-1,1).toLocaleDateString("ar-EG",{month:"long",year:"numeric"});
                return (
                  <div key={r.month} style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:13,padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:14,fontWeight:700,color:C.text,marginBottom:5 }}>🧾 تقرير ضريبي — {label}</div>
                      <div style={{ display:"flex",gap:16 }}>
                        <span style={{ fontSize:11,color:C.yellow }}>إجمالي الضرائب: {fmt(r.grandTotalTax)}</span>
                        <span style={{ fontSize:11,color:C.green }}>مبيعات: {fmt(r.totalSales)}</span>
                        <span style={{ fontSize:11,color:r.netProfit>=0?C.green:C.red }}>ربح: {fmt(r.netProfit)}</span>
                      </div>
                      <div style={{ fontSize:10,color:C.textMuted,marginTop:4 }}>حُفظ في {fmtDateTime(r.closedAt)}</div>
                    </div>
                    <Btn variant="yellow" small onClick={()=>printTaxMonthReport(r, r.month)}>
                      <Ic d={I.download} s={13} />طباعة
                    </Btn>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Add Rule Modal */}
      {showRuleModal && (
        <Modal title="إضافة قاعدة ضريبية" onClose={()=>setShowRuleModal(false)}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <Inp label="اسم الضريبة/الرسم" value={ruleForm.name} onChange={v=>setRuleForm({...ruleForm,name:v})} required placeholder="مثال: ضريبة القيمة المضافة" />
              <Sel label="نوع المنشأة" value={ruleForm.entityType} onChange={v=>setRuleForm({...ruleForm,entityType:v})} options={entityTypes} />
              <Sel label="نوع الضريبة" value={ruleForm.type} onChange={v=>setRuleForm({...ruleForm,type:v})} options={taxTypes.map(t=>({value:t.value,label:t.label}))} />
              <Sel label="دورية الاحتساب" value={ruleForm.frequency} onChange={v=>setRuleForm({...ruleForm,frequency:v})} options={[{value:"شهري",label:"شهري"},{value:"سنوي",label:"سنوي"}]} />
              {ruleForm.type!=="ثابتة شهرية" ? (
                <>
                  <Inp label="النسبة %" type="number" value={ruleForm.rate} onChange={v=>setRuleForm({...ruleForm,rate:v})} placeholder="مثال: 14" />
                  <Sel label="الأساس" value={ruleForm.base} onChange={v=>setRuleForm({...ruleForm,base:v})} options={[{value:"إجمالي المبيعات",label:"إجمالي المبيعات"},{value:"صافي الربح",label:"صافي الربح"},{value:"إجمالي المشتريات",label:"إجمالي المشتريات"}]} />
                </>
              ) : (
                <Inp label="المبلغ الثابت (ج.م)" type="number" value={ruleForm.fixedAmount} onChange={v=>setRuleForm({...ruleForm,fixedAmount:v})} />
              )}
            </div>
            <Inp label="ملاحظات" value={ruleForm.notes} onChange={v=>setRuleForm({...ruleForm,notes:v})} placeholder="أي تفاصيل إضافية..." />
            <div style={{ background:C.yellowDim,border:`1px solid ${C.yellow}33`,borderRadius:10,padding:"10px 14px",fontSize:12,color:C.yellow }}>
              💡 سيتم احتساب هذه الضريبة تلقائياً في ملخص الشهر بناءً على بيانات الفواتير.
            </div>
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setShowRuleModal(false)}>إلغاء</Btn>
              <Btn variant="yellow" onClick={handleSaveRule}>إضافة الضريبة</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default TaxReportsPage;
