import { useState } from "react";
import {
  C, Ic, I, fmt, fmtDateTime, today, openPrint, getCompanyBranding,
  ConfirmDialog, usePasscodeGate, Card, MiniStat, Btn, DatePicker, MonthPicker, Inp, Sel,
  Modal, THead, TRow, TD, PageHeader, showPermissionToast,
} from "./shared";

// ══════════════════════════════════════════════════════════════════════════════
// EmployeesPage.jsx — الموظفين: البيانات، الحضور والانصراف، السلف، المرتبات،
// وأرشيف المرتبات. البيانات كلها متخزنة فعلياً في قاعدة البيانات (جدول records)
// عن طريق الـ actions اللي بتوصل من App/AppShell — مش localStorage، عشان تتشارك
// بين صاحب الحساب وكل الموظفين المصرح لهم بدل ما تختلف من جهاز لجهاز.
// ══════════════════════════════════════════════════════════════════════════════

// ─── PRINT SALARY SLIP ───────────────────────────────────────────────────────
const printSalarySlip = (sal, emp, attList, advList) => {
  const { name: companyName, logo: companyLogo } = getCompanyBranding();
  const logoHtml = companyLogo ? `<img src="${companyLogo}" style="width:54px;height:54px;object-fit:cover;border-radius:10px;margin-left:12px" />` : "";
  const printDateTime = new Date().toLocaleString("ar-EG",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
  const payDateTime = sal.paidAt ? new Date(sal.paidAt).toLocaleString("ar-EG",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}) : printDateTime;
  const empAtts = attList.filter(a=>a.employeeId===sal.employeeId && a.date?.startsWith(sal.month));
  const empAdvs = advList.filter(a=>a.employeeId===sal.employeeId && a.status==="قيد السداد" && a.deductedInSalary===sal.id);
  const absRows = empAtts.filter(a=>a.type==="غياب");
  const leaveRows = empAtts.filter(a=>a.type==="إجازة");
  const lateRows = empAtts.filter(a=>a.type==="تأخر");
  const otherRows = empAtts.filter(a=>a.type==="خصم آخر");
  const totalAdvDeduct = empAdvs.reduce((s,a)=>s+a.amount,0);
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>قسيمة مرتب</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo','Segoe UI',sans-serif;background:#fff;color:#1a1a2e;padding:40px;max-width:700px;margin:0 auto}
  .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:20px;border-bottom:3px solid #6c7fff}
  .company{font-size:20px;font-weight:800;color:#1a1a2e}.slip-title{font-size:14px;color:#64748b;margin-top:4px}
  .slip-id{font-size:13px;color:#6c7fff;font-weight:700;margin-top:2px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:24px}
  .info-box{background:#f8faff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px}
  .info-label{font-size:10px;color:#94a3b8;font-weight:600;margin-bottom:3px;text-transform:uppercase}
  .info-value{font-size:14px;font-weight:700;color:#1a1a2e}
  .section{margin-bottom:20px}.section-title{font-size:13px;font-weight:800;color:#475569;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:6px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px}
  thead tr{background:#f1f5fd}thead th{padding:8px 12px;font-weight:700;text-align:right;color:#475569}
  tbody td{padding:8px 12px;border-bottom:1px solid #f1f5f9}
  .deduct-row td{color:#ef4444}.summary{background:#f8faff;border:2px solid #e2e8f0;border-radius:12px;padding:18px 22px;margin-bottom:20px}
  .sum-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;color:#475569}
  .sum-row.deduct{color:#ef4444}.sum-row.bonus{color:#10b981}
  .sum-row.total{font-size:17px;font-weight:800;color:#6c7fff;border-top:2px solid #c7d2fe;margin-top:10px;padding-top:12px}
  .footer{margin-top:24px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}
  .badge{display:inline-block;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700}
  .badge-abs{background:#fee2e2;color:#dc2626}.badge-leave{background:#fef3c7;color:#d97706}.badge-late{background:#fff7ed;color:#ea580c}.badge-other{background:#f1f5f9;color:#475569}
  @media print{body{padding:20px}}</style></head><body>
  <div class="header">
    <div style="display:flex;align-items:center">${logoHtml}<div><div class="company">${companyName}</div><div class="slip-title">قسيمة صرف مرتب</div><div class="slip-id">${sal.id}</div></div></div>
    <div style="text-align:left"><div style="font-size:13px;color:#64748b">تاريخ الصرف</div><div style="font-size:15px;font-weight:800;color:#1a1a2e">${payDateTime}</div></div>
  </div>
  <div class="info-grid">
    <div class="info-box"><div class="info-label">الموظف</div><div class="info-value">${sal.employeeName}</div></div>
    <div class="info-box"><div class="info-label">المنصب</div><div class="info-value">${emp?.position||"—"}</div></div>
    <div class="info-box"><div class="info-label">الشهر</div><div class="info-value">${sal.month}</div></div>
    <div class="info-box"><div class="info-label">طريقة الدفع</div><div class="info-value">${sal.paymentMethod}</div></div>
  </div>
  <div class="summary">
    <div class="sum-row"><span>الراتب الأساسي</span><span style="font-weight:700">${sal.baseSalary.toLocaleString("ar-EG")} ج.م</span></div>
    ${sal.bonus>0?`<div class="sum-row bonus"><span>➕ مكافآت وبدلات</span><span style="font-weight:700">+ ${sal.bonus.toLocaleString("ar-EG")} ج.م</span></div>`:""}
    ${absRows.length>0?`<div class="sum-row deduct"><span>➖ خصم غياب (${absRows.length} يوم)</span><span style="font-weight:700">- ${(sal.deductAbsence||0).toLocaleString("ar-EG")} ج.م</span></div>`:""}
    ${leaveRows.length>0?`<div class="sum-row deduct"><span>➖ إجازة (${leaveRows.length} يوم)</span><span style="font-weight:700">- ${(sal.deductLeave||0).toLocaleString("ar-EG")} ج.م</span></div>`:""}
    ${lateRows.length>0?`<div class="sum-row deduct"><span>➖ خصم تأخر (${lateRows.length} مرة)</span><span style="font-weight:700">- ${(sal.deductLate||0).toLocaleString("ar-EG")} ج.م</span></div>`:""}
    ${otherRows.length>0?`<div class="sum-row deduct"><span>➖ خصومات أخرى (${otherRows.length})</span><span style="font-weight:700">- ${(sal.deductOther||0).toLocaleString("ar-EG")} ج.م</span></div>`:""}
    ${totalAdvDeduct>0?`<div class="sum-row deduct"><span>➖ سلف مخصومة</span><span style="font-weight:700">- ${totalAdvDeduct.toLocaleString("ar-EG")} ج.م</span></div>`:""}
    ${sal.deductions>0?`<div class="sum-row deduct"><span>➖ خصومات إضافية</span><span style="font-weight:700">- ${sal.deductions.toLocaleString("ar-EG")} ج.م</span></div>`:""}
    <div class="sum-row total"><span>💰 صافي المرتب</span><span>${sal.netSalary.toLocaleString("ar-EG")} ج.م</span></div>
  </div>
  ${empAtts.length>0?`<div class="section"><div class="section-title">📋 سجل الخصومات — ${sal.month}</div>
  <table><thead><tr><th>التاريخ</th><th>النوع</th><th>قيمة الخصم</th><th>السبب</th></tr></thead><tbody>
  ${empAtts.map(a=>`<tr class="deduct-row">
    <td>${a.date}</td>
    <td><span class="badge ${a.type==="غياب"?"badge-abs":a.type==="إجازة"?"badge-leave":a.type==="تأخر"?"badge-late":"badge-other"}">${a.type}</span></td>
    <td>${a.deductAmount?(a.deductAmount.toLocaleString("ar-EG")+" ج.م"):"—"}</td>
    <td>${a.reason||"—"}</td>
  </tr>`).join("")}
  </tbody></table></div>`:""}
  ${empAdvs.length>0?`<div class="section"><div class="section-title">💳 السلف المخصومة من هذا المرتب</div>
  <table><thead><tr><th>رقم السلفة</th><th>التاريخ</th><th>المبلغ المخصوم</th><th>السبب</th></tr></thead><tbody>
  ${empAdvs.map(a=>`<tr class="deduct-row"><td>${a.id}</td><td>${a.date}</td><td>${a.amount.toLocaleString("ar-EG")} ج.م</td><td>${a.reason||"—"}</td></tr>`).join("")}
  </tbody></table></div>`:""}
  ${sal.notes?`<div style="background:#f8faff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#475569"><strong>ملاحظات:</strong> ${sal.notes}</div>`:""}
  <div class="footer">${companyName} — قسيمة مرتب ${sal.employeeName} — ${sal.month} — طُبعت ${printDateTime} — hesapy.pro</div>
  </body></html>`;
  openPrint(html);
};

// ─── PRINT ALL SALARIES ────────────────────────────────────────────────────────
const printAllSalaries = (salaries, employees, attendance, advances, month) => {
  const { name: companyName, logo: companyLogo } = getCompanyBranding();
  const logoHtml = companyLogo ? `<img src="${companyLogo}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;margin-left:10px" />` : "";
  const printDateTime = new Date().toLocaleString("ar-EG",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
  const monthSals = month ? salaries.filter(s=>s.month===month) : salaries;
  const totalNet = monthSals.reduce((s,x)=>s+x.netSalary,0);
  const totalBase = monthSals.reduce((s,x)=>s+x.baseSalary,0);
  const totalDeduct = monthSals.reduce((s,x)=>s+(x.totalDeductions||0),0);
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>كشف المرتبات</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo','Segoe UI',sans-serif;background:#fff;color:#1a1a2e;padding:40px}
  .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:20px;border-bottom:3px solid #6c7fff}
  .co-info{display:flex;align-items:center}.company{font-size:20px;font-weight:800}
  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
  .stat{background:#f8faff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center}
  .stat-val{font-size:18px;font-weight:800}.stat-lbl{font-size:11px;color:#64748b;margin-top:4px}
  table{width:100%;border-collapse:collapse;font-size:12px}thead tr{background:#6c7fff;color:#fff}
  thead th{padding:9px 12px;font-weight:700;text-align:right}tbody tr:nth-child(even){background:#f8faff}
  tbody td{padding:9px 12px;border-bottom:1px solid #e2e8f0}
  .footer{margin-top:24px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}
  .page-break{page-break-after:always}
  @media print{body{padding:20px}}</style></head><body>
  <div class="header"><div class="co-info">${logoHtml}<div><div class="company">${companyName}</div><div style="color:#64748b;font-size:13px;margin-top:3px">كشف صرف المرتبات${month?" — "+month:""}</div></div></div>
  <div style="text-align:left;font-size:12px;color:#64748b">طُبع: ${printDateTime}</div></div>
  <div class="stats">
    <div class="stat"><div class="stat-val" style="color:#6c7fff">${monthSals.length}</div><div class="stat-lbl">عدد الموظفين</div></div>
    <div class="stat"><div class="stat-val" style="color:#ef4444">${totalDeduct.toLocaleString("ar-EG")} ج.م</div><div class="stat-lbl">إجمالي الخصومات</div></div>
    <div class="stat"><div class="stat-val" style="color:#10b981">${totalNet.toLocaleString("ar-EG")} ج.م</div><div class="stat-lbl">إجمالي صافي المرتبات</div></div>
  </div>
  <table><thead><tr><th>الموظف</th><th>المنصب</th><th>الراتب الأساسي</th><th>مكافآت</th><th>خصم غياب</th><th>خصم إجازة</th><th>خصم تأخر</th><th>سلف</th><th>خصومات أخرى</th><th>صافي المرتب</th><th>طريقة الدفع</th><th>وقت الصرف</th></tr></thead><tbody>
  ${monthSals.map(s=>{
    const emp = employees.find(e=>e.id===s.employeeId);
    const payDt = s.paidAt ? new Date(s.paidAt).toLocaleString("ar-EG",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—";
    return `<tr>
      <td style="font-weight:700">${s.employeeName}</td>
      <td style="color:#64748b">${emp?.position||"—"}</td>
      <td style="font-family:monospace">${s.baseSalary.toLocaleString("ar-EG")} ج.م</td>
      <td style="color:#10b981;font-family:monospace">${s.bonus>0?s.bonus.toLocaleString("ar-EG")+" ج.م":"—"}</td>
      <td style="color:#ef4444;font-family:monospace">${(s.deductAbsence||0)>0?(s.deductAbsence.toLocaleString("ar-EG")+" ج.م"):"—"}</td>
      <td style="color:#ef4444;font-family:monospace">${(s.deductLeave||0)>0?(s.deductLeave.toLocaleString("ar-EG")+" ج.م"):"—"}</td>
      <td style="color:#ef4444;font-family:monospace">${(s.deductLate||0)>0?(s.deductLate.toLocaleString("ar-EG")+" ج.م"):"—"}</td>
      <td style="color:#ef4444;font-family:monospace">${(s.deductAdvances||0)>0?(s.deductAdvances.toLocaleString("ar-EG")+" ج.م"):"—"}</td>
      <td style="color:#ef4444;font-family:monospace">${s.deductions>0?s.deductions.toLocaleString("ar-EG")+" ج.م":"—"}</td>
      <td style="font-weight:800;font-family:monospace;color:#6c7fff">${s.netSalary.toLocaleString("ar-EG")} ج.م</td>
      <td>${s.paymentMethod}</td>
      <td style="font-size:11px;color:#64748b">${payDt}</td>
    </tr>`;
  }).join("")}
  <tr style="background:#eff6ff;font-weight:800"><td colspan="2">الإجمالي</td><td style="font-family:monospace">${totalBase.toLocaleString("ar-EG")} ج.م</td><td colspan="6"></td><td style="font-family:monospace;color:#6c7fff">${totalNet.toLocaleString("ar-EG")} ج.م</td><td colspan="2"></td></tr>
  </tbody></table>
  <div class="footer">${companyName} — كشف المرتبات — ${printDateTime} — hesapy.pro</div></body></html>`;
  openPrint(html);
};

// ─── EMPLOYEES PAGE ───────────────────────────────────────────────────────────
function EmployeesPage({
  employees, salaries, attendance, advances, salaryArchive,
  onAddEmployee, onUpdateEmployee, onDeleteEmployee,
  onAddSalary, onDeleteSalary,
  onAddAttendance, onUpdateAttendance, onDeleteAttendance,
  onAddAdvance, onUpdateAdvance, onDeleteAdvance,
  onArchiveMonth, onDeleteArchive, onRestoreArchive,
  security, pageId, userEmail,
}) {
  const { requestPasscode, PasscodeGate, log } = usePasscodeGate(security);

  const [tab, setTab] = useState("employees");
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("employee");
  const [confirm, setConfirm] = useState(null);
  const [empForm, setEmpForm] = useState({ name:"", position:"", baseSalary:"", phone:"", startDate:today(), notes:"" });
  const [editingEmp, setEditingEmp] = useState(null);
  const [salForm, setSalForm] = useState({
    employeeId:"", month:today().slice(0,7), baseSalary:"", bonus:"", deductions:"",
    notes:"", paymentMethod:"نقدي", workingDays:"26", lateDeductPerTime:"", advancesToDeduct:[]
  });
  const [attForm, setAttForm] = useState({ employeeId:"", date:today(), type:"غياب", reason:"", deductAmount:"" });
  const [advForm, setAdvForm] = useState({ employeeId:"", date:today(), amount:"", reason:"", status:"قيد السداد" });
  const [archiveMonth, setArchiveMonth] = useState(today().slice(0,7));
  const [empMsg, setEmpMsg] = useState({ text:"", type:"success" });
  const showEmpMsg = (text, type="success") => { setEmpMsg({text,type}); setTimeout(()=>setEmpMsg({text:"",type:"success"}),3500); };
  const [lastPaidSal, setLastPaidSal] = useState(null); // آخر مرتب اتصرف — لعرض زرار الطباعة

  const openModal = (type) => { setModalType(type); setShowModal(true); };

  const handleSaveEmployee = () => {
    if (!empForm.name.trim()) return;
    if (editingEmp) {
      const updatedRec = { ...editingEmp, ...empForm, baseSalary:parseFloat(empForm.baseSalary)||0 };
      onUpdateEmployee(updatedRec);
      log({ actionType:"تعديل", section:"الموظفين", target:empForm.name, before:editingEmp, after:updatedRec });
      setEditingEmp(null);
    } else {
      const newEmp = { id:"EMP"+Date.now().toString().slice(-5), ...empForm, baseSalary:parseFloat(empForm.baseSalary)||0, createdAt: new Date().toISOString() };
      onAddEmployee(newEmp);
      log({ actionType:"إضافة", section:"الموظفين", target:empForm.name, before:null, after:newEmp });
    }
    setShowModal(false);
    setEmpForm({ name:"", position:"", baseSalary:"", phone:"", startDate:today(), notes:"" });
  };

  const openEditEmpDirect = (e) => {
    setEditingEmp(e);
    setEmpForm({ name:e.name, position:e.position||"", baseSalary:e.baseSalary||"", phone:e.phone||"", startDate:e.startDate||today(), notes:e.notes||"" });
    setModalType("employee");
    setShowModal(true);
  };

  const openEditEmp = (e) => {
    requestPasscode({
      pageId, kind:"edit", label:"تعديل بيانات موظف",
      onConfirm: () => openEditEmpDirect(e),
    });
  };

  const handleDeleteEmployee = (e) => {
    requestPasscode({
      pageId, kind:"delete", label:"حذف موظف",
      onConfirm: () => { onDeleteEmployee(e.id); log({ actionType:"حذف", section:"الموظفين", target:e.name, before:e, after:null }); },
    });
  };

  // حساب الخصومات من سجل الخصومات - المبلغ المكتوب يُطرح مباشرة
  const calcDeductions = (empId, month, baseSalary, workingDays, lateDeductPerTime) => {
    const dailyRate = baseSalary / (parseInt(workingDays)||26);
    const empAtts = attendance.filter(a=>a.employeeId===empId && a.date?.startsWith(month));
    const absRows = empAtts.filter(a=>a.type==="غياب");
    const leaveRows = empAtts.filter(a=>a.type==="إجازة");
    const lateRows = empAtts.filter(a=>a.type==="تأخر");
    const otherRows = empAtts.filter(a=>a.type==="خصم آخر");
    // كل خصم يُطرح بالمبلغ المكتوب مباشرة
    const deductAbsence = absRows.reduce((s,a)=>s+(a.deductAmount||0),0);
    const deductLeave = leaveRows.reduce((s,a)=>s+(a.deductAmount||0),0);
    const deductLate = lateRows.reduce((s,a)=>s+(a.deductAmount||0),0);
    const deductOther = otherRows.reduce((s,a)=>s+(a.deductAmount||0),0);
    const absCount = absRows.length;
    const leaveCount = leaveRows.length;
    const lateCount = lateRows.length;
    return { dailyRate, absCount, leaveCount, lateCount, deductAbsence, deductLeave, deductLate, deductOther };
  };

  const handleSaveSalary = () => {
    if (!salForm.employeeId) return;
    const emp = employees.find(e=>e.id===salForm.employeeId);

    // ✋ منع صرف مرتب في شهر مأرشف
    if (archivedMonths.has(salForm.month)) {
      showPermissionToast(`شهر ${salForm.month} مأرشف — احذف الأرشيف أولاً للتعديل`, "error");
      return;
    }

    // ✋ منع صرف نفس الموظف مرتين في نفس الشهر
    const duplicate = salaries.find(s=>s.employeeId===salForm.employeeId && s.month===salForm.month);
    if (duplicate) {
      showPermissionToast(`تم صرف مرتب "${emp?.name}" عن ${salForm.month} من قبل`, "error");
      return;
    }

    const base = parseFloat(salForm.baseSalary)||(emp?.baseSalary||0);
    const bonus = parseFloat(salForm.bonus)||0;
    const deductions = parseFloat(salForm.deductions)||0;
    const { dailyRate, absCount, leaveCount, lateCount, deductAbsence, deductLeave, deductLate, deductOther } = calcDeductions(salForm.employeeId, salForm.month, base, salForm.workingDays, salForm.lateDeductPerTime);
    // خصم السلف المختارة
    const selectedAdvIds = salForm.advancesToDeduct||[];
    const advancesDeducted = advances.filter(a=>selectedAdvIds.includes(a.id));
    const deductAdvances = advancesDeducted.reduce((s,a)=>s+a.amount,0);
    const totalDeductions = deductAbsence + deductLeave + deductLate + deductOther + deductAdvances + deductions;
    const net = base + bonus - totalDeductions;
    const salId = "SAL"+Date.now().toString().slice(-5);
    const paidAt = new Date().toISOString();
    const newSal = {
      id: salId, ...salForm, baseSalary:base, bonus, deductions, netSalary:Math.max(0,net),
      employeeName:emp?.name||"",
      dailyRate, deductAbsence, deductLeave, deductLate, deductOther, deductAdvances, totalDeductions,
      absCount, leaveCount, lateCount, paidAt
    };
    onAddSalary(newSal);
    log({ actionType:"سداد مرتب", section:"المرتبات", target:`${emp?.name||""} — ${newSal.month}`, before:null, after:{ netSalary:newSal.netSalary, month:newSal.month } });

    // ① علّم خصومات هذا الموظف في هذا الشهر كـ "مسددة" بدل حذفها
    const attToSettle = attendance.filter(a => a.employeeId===salForm.employeeId && a.date?.startsWith(salForm.month));
    attToSettle.forEach(a => onUpdateAttendance({ ...a, settled: true, settledInSalary: salId }));

    // ② علّم السلف المخصومة كـ "مسددة" بدل حذفها
    if (selectedAdvIds.length > 0) {
      advances.filter(a => selectedAdvIds.includes(a.id)).forEach(a => onUpdateAdvance({ ...a, status: "مسدد", settledInSalary: salId }));
    }

    setShowModal(false);
    setSalForm({ employeeId:"", month:today().slice(0,7), baseSalary:"", bonus:"", deductions:"", notes:"", paymentMethod:"نقدي", workingDays:"26", lateDeductPerTime:"", advancesToDeduct:[] });

    // احفظ آخر مرتب عشان زرار الطباعة — المستخدم يطبع لما يريد بدون freeze
    setLastPaidSal({ sal: newSal, emp, attSnapshot: attendance, advSnapshot: advancesDeducted });
    showPermissionToast(`✅ تم صرف مرتب ${emp?.name||""} — ${newSal.month}`, "success");
  };

  const handleSaveAttendance = () => {
    if (!attForm.employeeId) return;
    const emp = employees.find(e=>e.id===attForm.employeeId);
    const newAtt = { id:"ATT"+Date.now().toString().slice(-5), ...attForm, employeeName:emp?.name||"", deductAmount:parseFloat(attForm.deductAmount)||0 };
    onAddAttendance(newAtt);
    log({ actionType:"إضافة خصم", section:"الموظفين", target:`${emp?.name||""} — ${attForm.type}`, before:null, after:newAtt });
    setShowModal(false);
    setAttForm({ employeeId:"", date:today(), type:"غياب", reason:"", deductAmount:"" });
  };

  const handleSaveAdvance = () => {
    if (!advForm.employeeId||!advForm.amount) return;
    const emp = employees.find(e=>e.id===advForm.employeeId);
    const newAdv = { id:"ADV"+Date.now().toString().slice(-5), ...advForm, amount:parseFloat(advForm.amount)||0, employeeName:emp?.name||"" };
    onAddAdvance(newAdv);
    log({ actionType:"إضافة سلفة", section:"الموظفين", target:`${emp?.name||""} — ${fmt(newAdv.amount)}`, before:null, after:newAdv });
    setShowModal(false);
    setAdvForm({ employeeId:"", date:today(), amount:"", reason:"", status:"قيد السداد" });
  };

  // أرشفة مرتبات شهر
  const handleArchiveMonth = (month) => {
    const monthSals = salaries.filter(s=>s.month===month);
    if (monthSals.length===0) { showEmpMsg("لا توجد مرتبات لهذا الشهر", "error"); return; }
    const existing = salaryArchive.find(a=>a.month===month);
    if (existing) {
      setConfirm({ msg:`يوجد أرشيف لشهر ${month} مسبقاً، هل تريد تحديثه؟`, onConfirm: () => {
        doArchive(month, monthSals);
        setConfirm(null);
      }});
      return;
    }
    doArchive(month, monthSals);
  };

  const doArchive = (month, monthSals) => {
    // كل الخصومات والسلف الخاصة بموظفي هذا الشهر
    const empIds = new Set(monthSals.map(s=>s.employeeId));
    const monthAtt = attendance.filter(a=>a.date?.startsWith(month) && empIds.has(a.employeeId));
    const salIds = new Set(monthSals.map(s=>s.id));
    const monthAdvs = advances.filter(a=>empIds.has(a.employeeId) && (a.settledInSalary && salIds.has(a.settledInSalary)));

    const archiveEntry = {
      id: "ARCH_" + month, month, archivedAt: new Date().toISOString(),
      salaries: monthSals,
      attendance: monthAtt,
      advances: monthAdvs,
      totalNet: monthSals.reduce((s,x)=>s+x.netSalary,0),
      totalDeductions: monthSals.reduce((s,x)=>s+(x.totalDeductions||0),0),
      empCount: monthSals.length,
    };

    onArchiveMonth(
      archiveEntry,
      monthSals.map(s=>s.id),
      monthAtt.map(a=>a.id),
      monthAdvs.map(a=>a.id),
    );
    log({ actionType:"أرشفة مرتبات", section:"المرتبات", target:`أرشيف ${month}`, before:null, after:{ month, empCount: monthSals.length, totalNet: archiveEntry.totalNet } });

    showPermissionToast(`✅ تم أرشفة مرتبات ${month} (${monthSals.length} موظف)`, "success");
  };

  const handleDeleteArchive = (month, label) => {
    const arch = salaryArchive.find(a=>a.month===month);
    requestPasscode({
      pageId, kind:"delete", label:"حذف أرشيف مرتبات",
      onConfirm: () => {
        if (arch) onDeleteArchive(arch.id);
        log({ actionType:"حذف", section:"المرتبات", target:`أرشيف ${label}`, before: arch||null, after:null });
      },
    });
  };

  const handleRestoreArchive = (month, label) => {
    setConfirm({ msg:`استرداد أرشيف ${label}؟ ستعود المرتبات والخصومات والسلف للقوائم العادية.`, onConfirm: () => {
      const arch = salaryArchive.find(a=>a.month===month);
      if (!arch) { setConfirm(null); return; }

      // رجّع المرتبات (تجنب تكرار)
      const existingSalIds = new Set(salaries.map(s=>s.id));
      const newSals = (arch.salaries||[]).filter(s=>!existingSalIds.has(s.id));

      // رجّع الخصومات — كلها مسددة لأنها دخلت الأرشيف
      const existingAttIds = new Set(attendance.map(a=>a.id));
      const newAtt = (arch.attendance||[])
        .filter(a=>!existingAttIds.has(a.id))
        .map(a=>({ ...a, settled: true }));

      // رجّع السلف — كلها مسدد لأنها دخلت الأرشيف
      const existingAdvIds = new Set(advances.map(a=>a.id));
      const newAdvs = (arch.advances||[])
        .filter(a=>!existingAdvIds.has(a.id))
        .map(a=>({ ...a, status: "مسدد" }));

      onRestoreArchive(arch.id, newSals, newAtt, newAdvs);
      log({ actionType:"استرداد أرشيف", section:"المرتبات", target:`أرشيف ${label}`, before:null, after:{ month } });
      setConfirm(null);
      showPermissionToast(`✅ تم استرداد أرشيف ${label}`, "success");
    }});
  };

  const totalSalaries = salaries.reduce((s,r)=>s+r.netSalary,0);
  const totalAdvances = advances.filter(a=>a.status==="قيد السداد").reduce((s,a)=>s+a.amount,0);
  const absences = attendance.filter(a=>a.type==="غياب").length;
  const leaveDays = attendance.filter(a=>a.type==="إجازة").length;

  const tabs = [
    { id:"employees", label:"الموظفين" },
    { id:"salaries", label:"المرتبات" },
    { id:"attendance", label:"الخصومات" },
    { id:"advances", label:"السلف" },
    { id:"archive", label:"🗂 الأرشيف" },
  ];

  // حساب الخصومات في نموذج صرف المرتب
  const salModalEmp = employees.find(e=>e.id===salForm.employeeId);
  const salModalBase = parseFloat(salForm.baseSalary)||(salModalEmp?.baseSalary||0);
  const salModalCalc = salForm.employeeId ? calcDeductions(salForm.employeeId, salForm.month, salModalBase, salForm.workingDays, "") : { dailyRate:0, absCount:0, leaveCount:0, lateCount:0, deductAbsence:0, deductLeave:0, deductLate:0, deductOther:0 };
  const pendingAdvances = advances.filter(a=>a.employeeId===salForm.employeeId&&a.status==="قيد السداد");
  const selectedAdvTotal = (salForm.advancesToDeduct||[]).reduce((s,id)=>{ const a=advances.find(x=>x.id===id); return s+(a?.amount||0); },0);
  const salModalNet = salModalBase + (parseFloat(salForm.bonus)||0) - salModalCalc.deductAbsence - salModalCalc.deductLeave - salModalCalc.deductLate - (salModalCalc.deductOther||0) - selectedAdvTotal - (parseFloat(salForm.deductions)||0);

  const allSalaryMonths = [...new Set(salaries.map(s=>s.month))].sort().reverse();
  // المرتبات المرئية = التي لم تُأرشف بعد
  const archivedMonths = new Set(salaryArchive.map(a=>a.month));
  const activeSalaries = salaries.filter(s=>!archivedMonths.has(s.month));

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      {empMsg.text && (
        <div style={{ background: empMsg.type==="error" ? C.redDim : C.greenDim, border:`1px solid ${empMsg.type==="error"?C.red:C.green}44`, borderRadius:10, padding:"12px 18px", fontSize:13, fontWeight:600, color: empMsg.type==="error"?C.red:C.green }}>
          {empMsg.text}
        </div>
      )}
      <PageHeader title="إدارة الموظفين" icon={I.clients} subtitle={`${employees.length} موظف`}
        action={
          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
            {tab==="employees" && <Btn onClick={()=>openModal("employee")}><Ic d={I.plus} s={14} />موظف جديد</Btn>}
            {tab==="salaries" && <>
              <Btn onClick={()=>openModal("salary")} variant="success"><Ic d={I.plus} s={14} />صرف مرتب</Btn>
              <Btn variant="yellow" onClick={()=>printAllSalaries(salaries,employees,attendance,advances,null)}><Ic d={I.print} s={14} />طباعة الكل</Btn>
            </>}
            {tab==="attendance" && <Btn onClick={()=>openModal("attendance")} variant="yellow"><Ic d={I.plus} s={14} />إضافة خصم</Btn>}
            {tab==="advances" && <Btn onClick={()=>openModal("advance")} variant="purple"><Ic d={I.plus} s={14} />سلفة جديدة</Btn>}
          </div>
        }
      />
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
        <MiniStat label="عدد الموظفين" value={employees.length} color={C.accent} icon={I.clients} />
        <MiniStat label="إجمالي المرتبات" value={fmt(totalSalaries)} color={C.green} icon={I.revenue} />
        <MiniStat label="السلف القائمة" value={fmt(totalAdvances)} color={C.red} icon={I.alert} />
        <MiniStat label={`غياب: ${absences} / إجازة: ${leaveDays}`} value={absences+leaveDays+" يوم"} color={C.yellow} icon={I.calendar} />
      </div>
      {/* Tabs */}
      <div style={{ display:"flex",background:C.surface2,borderRadius:12,padding:4,border:`1px solid ${C.border}`,gap:4,flexWrap:"wrap" }}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1,background:tab===t.id?C.accent:"transparent",color:tab===t.id?"#fff":C.textMuted,border:"none",borderRadius:9,padding:"9px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s",minWidth:80 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Employees Tab */}
      {tab==="employees" && (
        <Card style={{ padding:0 }}>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <THead cols={["الكود","الاسم","المنصب","الراتب الأساسي","الهاتف","تاريخ التعيين","ملاحظات",""]} />
            <tbody>
              {employees.map((e,idx)=>(
                <TRow key={e.id} alt={idx%2}>
                  <TD color={C.accent}>{e.id}</TD>
                  <TD><span style={{ fontWeight:700 }}>{e.name}</span></TD>
                  <TD color={C.textDim}>{e.position||"—"}</TD>
                  <TD mono color={C.green}>{fmt(e.baseSalary)}</TD>
                  <TD color={C.textMuted}>{e.phone||"—"}</TD>
                  <TD color={C.textMuted}>{e.startDate||"—"}</TD>
                  <TD color={C.textMuted}>{e.notes||"—"}</TD>
                  <td style={{ padding:"11px 14px" }}>
                    <div style={{ display:"flex",gap:6 }}>
                      <button onClick={()=>openEditEmp(e)} style={{ background:"none",border:"none",cursor:"pointer",color:C.accent }}><Ic d={I.edit} s={14} /></button>
                      <button onClick={()=>handleDeleteEmployee(e)} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted }}><Ic d={I.trash} s={14} /></button>
                    </div>
                  </td>
                </TRow>
              ))}
            </tbody>
          </table>
          {employees.length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا يوجد موظفون بعد</div>}
        </Card>
      )}

      {/* Salaries Tab */}
      {tab==="salaries" && (
        <Card style={{ padding:0 }}>
          {lastPaidSal && (
            <div style={{ padding:"12px 16px", background:C.greenDim, borderBottom:`1px solid ${C.green}33`, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
              <span style={{ fontSize:13, fontWeight:700, color:C.green }}>✅ تم صرف مرتب {lastPaidSal.emp?.name} — {lastPaidSal.sal.month}</span>
              <div style={{ display:"flex", gap:8 }}>
                <Btn variant="success" small onClick={()=>{ printSalarySlip(lastPaidSal.sal, lastPaidSal.emp, lastPaidSal.attSnapshot, lastPaidSal.advSnapshot); }}>
                  <Ic d={I.print} s={13} />طباعة القسيمة
                </Btn>
                <button onClick={()=>setLastPaidSal(null)} style={{ background:"none", border:"none", cursor:"pointer", color:C.textMuted, fontSize:18, lineHeight:1 }}>×</button>
              </div>
            </div>
          )}
          <div style={{ padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap" }}>
            <span style={{ fontSize:13,fontWeight:700,color:C.text }}>كشف المرتبات</span>
          </div>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <THead cols={["رقم","الشهر","الموظف","الراتب الأساسي","مكافآت","خصم غياب","خصم إجازة","خصم تأخر","سلف","خصومات أخرى","صافي المرتب","وقت الصرف",""]} />
            <tbody>
              {activeSalaries.map((s,idx)=>(
                <TRow key={s.id} alt={idx%2}>
                  <TD color={C.accent}>{s.id}</TD>
                  <TD color={C.textDim}>{s.month}</TD>
                  <TD><span style={{ fontWeight:600 }}>{s.employeeName}</span></TD>
                  <TD mono>{fmt(s.baseSalary)}</TD>
                  <TD mono color={C.green}>{s.bonus>0?fmt(s.bonus):"—"}</TD>
                  <TD mono color={C.red}>{(s.deductAbsence||0)>0?fmt(s.deductAbsence):"—"}</TD>
                  <TD mono color={C.red}>{(s.deductLeave||0)>0?fmt(s.deductLeave):"—"}</TD>
                  <TD mono color={C.red}>{(s.deductLate||0)>0?fmt(s.deductLate):"—"}</TD>
                  <TD mono color={C.red}>{(s.deductAdvances||0)>0?fmt(s.deductAdvances):"—"}</TD>
                  <TD mono color={C.red}>{((s.deductOther||0)+(s.deductions||0))>0?fmt((s.deductOther||0)+(s.deductions||0)):"—"}</TD>
                  <TD mono color={C.accent}><span style={{ fontWeight:800 }}>{fmt(s.netSalary)}</span></TD>
                  <TD color={C.textMuted} style={{ fontSize:11 }}>{s.paidAt?fmtDateTime(s.paidAt):"—"}</TD>
                  <td style={{ padding:"11px 14px" }}>
                    <button onClick={()=>{ const emp=employees.find(e=>e.id===s.employeeId); printSalarySlip(s,emp,attendance,advances); }}
                      style={{ background:C.accentDim,border:`1px solid ${C.accent}33`,borderRadius:7,padding:"4px 10px",fontSize:11,color:C.accent,cursor:"pointer",fontFamily:"inherit",fontWeight:600,display:"flex",alignItems:"center",gap:4 }}>
                      <Ic d={I.print} s={12} />طباعة
                    </button>
                  </td>
                </TRow>
              ))}
            </tbody>
          </table>
          {activeSalaries.length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد سجلات مرتبات (المُأرشفة لا تظهر هنا)</div>}
        </Card>
      )}

      {/* Deductions Tab */}
      {tab==="attendance" && (
        <Card style={{ padding:0 }}>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <THead cols={["رقم","التاريخ","الموظف","النوع","قيمة الخصم","السبب","الحالة"]} />
            <tbody>
              {attendance.map((a,idx)=>(
                <TRow key={a.id} alt={idx%2}>
                  <TD color={C.accent}>{a.id}</TD>
                  <TD color={C.textDim}>{a.date}</TD>
                  <TD><span style={{ fontWeight:600 }}>{a.employeeName}</span></TD>
                  <td style={{ padding:"11px 14px" }}>
                    <span style={{
                      background: a.type==="غياب"?C.redDim : a.type==="إجازة"?C.yellowDim : a.type==="تأخر"?C.accentDim : C.surface3,
                      color: a.type==="غياب"?C.red : a.type==="إجازة"?C.yellow : a.type==="تأخر"?C.accent : C.textDim,
                      border: `1px solid ${a.type==="غياب"?C.red : a.type==="إجازة"?C.yellow : a.type==="تأخر"?C.accent : C.border}33`,
                      padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700
                    }}>{a.type}</span>
                  </td>
                  <TD mono color={C.red}>{a.deductAmount>0?fmt(a.deductAmount):"—"}</TD>
                  <TD color={C.textMuted}>{a.reason||"—"}</TD>
                  <td style={{ padding:"11px 14px" }}>
                    {a.settled
                      ? <span style={{ background:C.greenDim,color:C.green,border:`1px solid ${C.green}33`,padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700 }}>✓ مسددة</span>
                      : <button onClick={()=>requestPasscode({ pageId, kind:"delete", label:"حذف سجل خصم/غياب", onConfirm:()=>{ onDeleteAttendance(a.id); log({ actionType:"حذف", section:"الموظفين", target:`سجل ${a.type} — ${a.employeeName}`, before:a, after:null }); } })} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted }}><Ic d={I.trash} s={14} /></button>
                    }
                  </td>
                </TRow>
              ))}
            </tbody>
          </table>
          {attendance.length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد خصومات مسجلة</div>}
        </Card>
      )}

      {/* Advances Tab */}
      {tab==="advances" && (
        <Card style={{ padding:0 }}>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <THead cols={["رقم","التاريخ","الموظف","المبلغ","السبب","الحالة",""]} />
            <tbody>
              {advances.map((a,idx)=>(
                <TRow key={a.id} alt={idx%2}>
                  <TD color={C.accent}>{a.id}</TD>
                  <TD color={C.textDim}>{a.date}</TD>
                  <TD><span style={{ fontWeight:600 }}>{a.employeeName}</span></TD>
                  <TD mono color={C.red}>{fmt(a.amount)}</TD>
                  <TD color={C.textMuted}>{a.reason||"—"}</TD>
                  <td style={{ padding:"11px 14px" }}>
                    <span style={{ background:a.status==="مسدد"?C.greenDim:C.yellowDim,color:a.status==="مسدد"?C.green:C.yellow,border:`1px solid ${a.status==="مسدد"?C.green:C.yellow}33`,padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700 }}>{a.status}</span>
                  </td>
                  <td style={{ padding:"11px 14px" }}>
                    <div style={{ display:"flex",gap:6 }}>
                      {a.status!=="مسدد" && <button onClick={()=>requestPasscode({ pageId, kind:"edit", label:"تعديل سلفة (تسديد)", onConfirm:()=>{ onUpdateAdvance({...a,status:"مسدد"}); log({ actionType:"تعديل سلفة", section:"الموظفين", target:`${a.employeeName} — ${fmt(a.amount)}`, before:{status:a.status}, after:{status:"مسدد"} }); } })} style={{ background:C.greenDim,border:`1px solid ${C.green}33`,borderRadius:6,padding:"3px 10px",fontSize:11,color:C.green,cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>مسدد</button>}
                      <button onClick={()=>requestPasscode({ pageId, kind:"delete", label:"حذف سلفة", onConfirm:()=>{ onDeleteAdvance(a.id); log({ actionType:"حذف", section:"الموظفين", target:`سلفة ${a.employeeName} — ${fmt(a.amount)}`, before:a, after:null }); } })} style={{ background:"none",border:"none",cursor:"pointer",color:C.textMuted }}><Ic d={I.trash} s={14} /></button>
                    </div>
                  </td>
                </TRow>
              ))}
            </tbody>
          </table>
          {advances.length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted,fontSize:13 }}>لا توجد سلف</div>}
        </Card>
      )}

      {/* Archive Tab */}
      {tab==="archive" && (
        <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
          <Card>
            <div style={{ display:"flex",gap:12,alignItems:"center",flexWrap:"wrap" }}>
              <span style={{ fontSize:14,fontWeight:700,color:C.text }}>🗂 أرشفة مرتبات شهر</span>
              <select value={archiveMonth} onChange={e=>setArchiveMonth(e.target.value)}
                style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 13px",color:C.text,fontSize:12,fontFamily:"inherit" }}>
                {allSalaryMonths.map(m=><option key={m} value={m}>{m} {archivedMonths.has(m)?"(مأرشف)":""}</option>)}
                {[...archivedMonths].filter(m=>!allSalaryMonths.includes(m)).map(m=><option key={m} value={m}>{m} (مأرشف)</option>)}
                {allSalaryMonths.length===0&&salaryArchive.length===0&&<option value={today().slice(0,7)}>{today().slice(0,7)}</option>}
              </select>
              <Btn variant="yellow" onClick={()=>handleArchiveMonth(archiveMonth)}><Ic d={I.download} s={14} />حفظ في الأرشيف</Btn>
              <Btn variant="ghost" onClick={()=>{ const [y,m]=archiveMonth.split("-"); const label=new Date(+y,+m-1,1).toLocaleDateString("ar-EG",{month:"long",year:"numeric"}); handleRestoreArchive(archiveMonth,label); }}><Ic d={I.returns} s={14} />استرداد</Btn>
            </div>
            <p style={{ margin:"10px 0 0",fontSize:12,color:C.textMuted }}>اختر الشهر ثم اضغط "حفظ في الأرشيف" للأرشفة، أو "استرداد" لإرجاع مرتبات شهر مؤرشف.</p>
          </Card>
          {salaryArchive.length===0 ? (
            <Card style={{ textAlign:"center",padding:40 }}>
              <div style={{ color:C.textMuted,fontSize:13 }}>لا توجد سجلات أرشيف بعد. احفظ مرتبات أي شهر للبدء.</div>
            </Card>
          ) : (
            [...salaryArchive].sort((a,b)=>b.month.localeCompare(a.month)).map(arch=>{
              const [y,m] = arch.month.split("-");
              const label = new Date(+y,+m-1,1).toLocaleDateString("ar-EG",{month:"long",year:"numeric"});
              return (
                <div key={arch.month} style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:13,padding:"16px 20px" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
                    <div>
                      <div style={{ fontSize:15,fontWeight:800,color:C.text }}>📁 أرشيف — {label}</div>
                      <div style={{ display:"flex",gap:14,marginTop:6 }}>
                        <span style={{ fontSize:11,color:C.green }}>صافي المرتبات: {fmt(arch.totalNet)}</span>
                        <span style={{ fontSize:11,color:C.red }}>إجمالي الخصومات: {fmt(arch.totalDeductions)}</span>
                        <span style={{ fontSize:11,color:C.accent }}>عدد الموظفين: {arch.empCount}</span>
                      </div>
                      <div style={{ fontSize:10,color:C.textMuted,marginTop:4 }}>حُفظ في {fmtDateTime(arch.archivedAt)}</div>
                    </div>
                    <div style={{ display:"flex",gap:8 }}>
                      <Btn variant="yellow" small onClick={()=>printAllSalaries(arch.salaries,employees,arch.attendance||[],arch.advances||[],arch.month)}>
                        <Ic d={I.print} s={13} />طباعة
                      </Btn>
                      <Btn variant="danger" small onClick={()=>handleDeleteArchive(arch.month, label)}>
                        <Ic d={I.trash} s={13} />حذف
                      </Btn>
                    </div>
                  </div>
                  <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
                    <THead cols={["الموظف","الراتب الأساسي","إجمالي الخصومات","صافي المرتب","وقت الصرف"]} />
                    <tbody>
                      {arch.salaries.map((s,idx)=>(
                        <TRow key={s.id} alt={idx%2}>
                          <TD><span style={{ fontWeight:600 }}>{s.employeeName}</span></TD>
                          <TD mono>{fmt(s.baseSalary)}</TD>
                          <TD mono color={C.red}>{fmt(s.totalDeductions||0)}</TD>
                          <TD mono color={C.accent}><span style={{ fontWeight:800 }}>{fmt(s.netSalary)}</span></TD>
                          <TD color={C.textMuted} style={{ fontSize:11 }}>{s.paidAt?fmtDateTime(s.paidAt):"—"}</TD>
                        </TRow>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modals */}
      {showModal && modalType==="employee" && (
        <Modal title={editingEmp ? "✏️ تعديل بيانات الموظف" : "إضافة موظف جديد"} onClose={()=>{setShowModal(false);setEditingEmp(null);setEmpForm({ name:"", position:"", baseSalary:"", phone:"", startDate:today(), notes:"" });}}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <Inp label="الاسم الكامل" value={empForm.name} onChange={v=>setEmpForm({...empForm,name:v})} required />
              <Inp label="المنصب الوظيفي" value={empForm.position} onChange={v=>setEmpForm({...empForm,position:v})} />
              <Inp label="الراتب الأساسي (ج.م)" type="number" value={empForm.baseSalary} onChange={v=>setEmpForm({...empForm,baseSalary:v})} />
              <Inp label="رقم الهاتف" value={empForm.phone} onChange={v=>setEmpForm({...empForm,phone:v})} />
              <DatePicker label="تاريخ التعيين" value={empForm.startDate} onChange={v=>setEmpForm({...empForm,startDate:v})} />
            </div>
            <Inp label="ملاحظات" value={empForm.notes} onChange={v=>setEmpForm({...empForm,notes:v})} />
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>{setShowModal(false);setEditingEmp(null);setEmpForm({ name:"", position:"", baseSalary:"", phone:"", startDate:today(), notes:"" });}}>إلغاء</Btn>
              <Btn onClick={handleSaveEmployee}>{editingEmp?"حفظ التعديلات":"إضافة الموظف"}</Btn>
            </div>
          </div>
        </Modal>
      )}

      {showModal && modalType==="salary" && (
        <Modal title="💰 صرف مرتب" onClose={()=>setShowModal(false)}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <Sel label="الموظف" value={salForm.employeeId} onChange={v=>{ const e=employees.find(x=>x.id===v); setSalForm({...salForm,employeeId:v,baseSalary:e?.baseSalary||"",advancesToDeduct:[]}); }} options={employees.map(e=>({value:e.id,label:e.name}))} />
              <MonthPicker label="الشهر" value={salForm.month} onChange={v=>setSalForm({...salForm,month:v})} />
              <Inp label="الراتب الأساسي (ج.م)" type="number" value={salForm.baseSalary} onChange={v=>setSalForm({...salForm,baseSalary:v})} />
              <Inp label="أيام العمل الشهرية" type="number" value={salForm.workingDays} onChange={v=>setSalForm({...salForm,workingDays:v})} placeholder="26" />
              <Inp label="مكافآت وبدلات (ج.م)" type="number" value={salForm.bonus} onChange={v=>setSalForm({...salForm,bonus:v})} placeholder="0" />
              <Sel label="طريقة الدفع" value={salForm.paymentMethod} onChange={v=>setSalForm({...salForm,paymentMethod:v})} options={[{value:"نقدي",label:"💵 نقدي"},{value:"شيك",label:"📄 شيك"},{value:"تحويل",label:"🏦 تحويل"}]} />
              <Inp label="خصومات أخرى (ج.م)" type="number" value={salForm.deductions} onChange={v=>setSalForm({...salForm,deductions:v})} placeholder="0" />
            </div>
            {/* الخصومات التلقائية */}
            {salForm.employeeId && (
              <div style={{ background:C.redDim,border:`1px solid ${C.red}22`,borderRadius:11,padding:"12px 16px" }}>
                <div style={{ fontSize:12,fontWeight:700,color:C.red,marginBottom:8 }}>📋 الخصومات المسجلة — {salForm.month}</div>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,fontSize:12 }}>
                  <div style={{ background:C.surface,borderRadius:8,padding:"8px 12px" }}>
                    <div style={{ color:C.textMuted,marginBottom:2 }}>غياب ({salModalCalc.absCount} يوم)</div>
                    <div style={{ color:C.red,fontWeight:700,fontFamily:"monospace" }}>{salModalCalc.absCount>0?"-"+fmt(salModalCalc.deductAbsence):"لا يوجد"}</div>
                  </div>
                  <div style={{ background:C.surface,borderRadius:8,padding:"8px 12px" }}>
                    <div style={{ color:C.textMuted,marginBottom:2 }}>إجازة ({salModalCalc.leaveCount} يوم)</div>
                    <div style={{ color:C.red,fontWeight:700,fontFamily:"monospace" }}>{salModalCalc.leaveCount>0?"-"+fmt(salModalCalc.deductLeave):"لا يوجد"}</div>
                  </div>
                  <div style={{ background:C.surface,borderRadius:8,padding:"8px 12px" }}>
                    <div style={{ color:C.textMuted,marginBottom:2 }}>تأخر ({salModalCalc.lateCount} مرة)</div>
                    <div style={{ color:C.red,fontWeight:700,fontFamily:"monospace" }}>{salModalCalc.lateCount>0?"-"+fmt(salModalCalc.deductLate):"لا يوجد"}</div>
                  </div>
                  <div style={{ background:C.surface,borderRadius:8,padding:"8px 12px" }}>
                    <div style={{ color:C.textMuted,marginBottom:2 }}>خصومات أخرى</div>
                    <div style={{ color:C.red,fontWeight:700,fontFamily:"monospace" }}>{(salModalCalc.deductOther||0)>0?"-"+fmt(salModalCalc.deductOther):"لا يوجد"}</div>
                  </div>
                </div>
                {salModalCalc.absCount===0&&salModalCalc.leaveCount===0&&salModalCalc.lateCount===0&&(salModalCalc.deductOther||0)===0&&<div style={{ textAlign:"center",color:C.textMuted,fontSize:12,marginTop:4 }}>لا توجد خصومات مسجلة لهذا الشهر</div>}
              </div>
            )}
            {/* السلف القائمة */}
            {pendingAdvances.length>0 && (
              <div style={{ background:C.yellowDim,border:`1px solid ${C.yellow}22`,borderRadius:11,padding:"12px 16px" }}>
                <div style={{ fontSize:12,fontWeight:700,color:C.yellow,marginBottom:8 }}>💳 السلف القائمة — اختر ما تريد خصمه</div>
                {pendingAdvances.map(a=>(
                  <label key={a.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:`1px solid ${C.border}`,cursor:"pointer" }}>
                    <input type="checkbox" checked={(salForm.advancesToDeduct||[]).includes(a.id)}
                      onChange={e=>{ const cur=salForm.advancesToDeduct||[]; setSalForm({...salForm,advancesToDeduct:e.target.checked?[...cur,a.id]:cur.filter(x=>x!==a.id)}); }} />
                    <span style={{ flex:1,fontSize:12,color:C.text }}>{a.date} — {a.reason||"سلفة"}</span>
                    <span style={{ color:C.red,fontWeight:700,fontFamily:"monospace",fontSize:12 }}>{fmt(a.amount)}</span>
                  </label>
                ))}
                {selectedAdvTotal>0&&<div style={{ textAlign:"left",fontSize:12,fontWeight:700,color:C.red,marginTop:8 }}>إجمالي السلف المخصومة: {fmt(selectedAdvTotal)}</div>}
              </div>
            )}
            {/* ملخص */}
            <div style={{ background:C.surface3,borderRadius:11,padding:"14px 18px" }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                <span style={{ color:C.textMuted,fontSize:12 }}>الراتب الأساسي</span>
                <span style={{ fontFamily:"monospace",fontSize:12 }}>{fmt(salModalBase)}</span>
              </div>
              {(parseFloat(salForm.bonus)||0)>0&&<div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                <span style={{ color:C.green,fontSize:12 }}>+ مكافآت</span>
                <span style={{ fontFamily:"monospace",fontSize:12,color:C.green }}>{fmt(parseFloat(salForm.bonus)||0)}</span>
              </div>}
              {(salModalCalc.deductAbsence+salModalCalc.deductLeave+salModalCalc.deductLate+(salModalCalc.deductOther||0)+selectedAdvTotal+(parseFloat(salForm.deductions)||0))>0&&<div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                <span style={{ color:C.red,fontSize:12 }}>- إجمالي الخصومات</span>
                <span style={{ fontFamily:"monospace",fontSize:12,color:C.red }}>{fmt(salModalCalc.deductAbsence+salModalCalc.deductLeave+salModalCalc.deductLate+(salModalCalc.deductOther||0)+selectedAdvTotal+(parseFloat(salForm.deductions)||0))}</span>
              </div>}
              <div style={{ display:"flex",justifyContent:"space-between",borderTop:`1px solid ${C.border}`,paddingTop:8,marginTop:4 }}>
                <span style={{ color:C.text,fontWeight:700,fontSize:14 }}>💰 صافي المرتب</span>
                <span style={{ color:C.green,fontWeight:800,fontSize:17,fontFamily:"monospace" }}>{fmt(Math.max(0,salModalNet))}</span>
              </div>
            </div>
            <Inp label="ملاحظات" value={salForm.notes} onChange={v=>setSalForm({...salForm,notes:v})} />
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setShowModal(false)}>إلغاء</Btn>
              <Btn variant="success" onClick={()=>requestPasscode({ pageId, kind:"edit", label:"صرف مرتب", onConfirm:handleSaveSalary })}>✅ صرف المرتب</Btn>
            </div>
          </div>
        </Modal>
      )}

      {showModal && modalType==="attendance" && (
        <Modal title="تسجيل خصم / غياب / إجازة" onClose={()=>setShowModal(false)}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <Sel label="الموظف" value={attForm.employeeId} onChange={v=>setAttForm({...attForm,employeeId:v})} options={employees.map(e=>({value:e.id,label:e.name}))} />
              <DatePicker label="التاريخ" value={attForm.date} onChange={v=>setAttForm({...attForm,date:v})} />
              <Sel label="النوع" value={attForm.type} onChange={v=>setAttForm({...attForm,type:v})} options={[{value:"غياب",label:"🔴 غياب"},{value:"إجازة",label:"🟡 إجازة"},{value:"تأخر",label:"🟠 تأخر"},{value:"خصم آخر",label:"⚫ خصم آخر"}]} />
              <Inp label="قيمة الخصم (ج.م)" type="number" value={attForm.deductAmount} onChange={v=>setAttForm({...attForm,deductAmount:v})} placeholder="المبلغ بالجنيه" required />
            </div>
            <Inp label="السبب" value={attForm.reason} onChange={v=>setAttForm({...attForm,reason:v})} placeholder="سبب الخصم..." />
            <div style={{ background:C.yellowDim,border:`1px solid ${C.yellow}22`,borderRadius:10,padding:"10px 14px",fontSize:12,color:C.yellow }}>
              💡 قيمة الخصم تُطرح مباشرة من المرتب بالمبلغ الذي تكتبه هنا عند الصرف.
            </div>
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setShowModal(false)}>إلغاء</Btn>
              <Btn variant="yellow" onClick={handleSaveAttendance}>تسجيل</Btn>
            </div>
          </div>
        </Modal>
      )}

      {showModal && modalType==="advance" && (
        <Modal title="سلفة جديدة" onClose={()=>setShowModal(false)}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <Sel label="الموظف" value={advForm.employeeId} onChange={v=>setAdvForm({...advForm,employeeId:v})} options={employees.map(e=>({value:e.id,label:e.name}))} />
              <DatePicker label="التاريخ" value={advForm.date} onChange={v=>setAdvForm({...advForm,date:v})} />
              <Inp label="المبلغ (ج.م)" type="number" value={advForm.amount} onChange={v=>setAdvForm({...advForm,amount:v})} required />
            </div>
            <Inp label="السبب" value={advForm.reason} onChange={v=>setAdvForm({...advForm,reason:v})} placeholder="سبب السلفة..." />
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setShowModal(false)}>إلغاء</Btn>
              <Btn variant="purple" onClick={handleSaveAdvance}>منح السلفة</Btn>
            </div>
          </div>
        </Modal>
      )}

      {PasscodeGate}
      {confirm && <ConfirmDialog message={confirm.msg} onConfirm={()=>{ confirm.onConfirm(); setConfirm(null); }} onCancel={()=>setConfirm(null)} />}
    </div>
  );
}

export default EmployeesPage;
