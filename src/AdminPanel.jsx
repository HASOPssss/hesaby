import { useState, useEffect } from "react";
import {
  supabase, useAppData, C, Ic, I, Logo, fmtDateTime,
  ConfirmDialog, Badge, Btn, DatePicker, Inp, Sel, Modal, THead, TRow, TD,
  ADMIN_EMAIL, ALL_PAGES, ROLE_PRESETS, ROLE_TEMPLATES, SUPERVISOR_TEMPLATE, showPermissionToast, logActivity,
} from "./shared";
import AppShell from "./AppShell";

// ══════════════════════════════════════════════════════════════════════════════
// AdminPanel.jsx — لوحة تحكم الأدمن: إدارة الشركات المشتركة، المستخدمين
// الفرعيين وصلاحياتهم، ومشاهدة بيانات أي شركة (قراءة فقط) عبر AdminCompanyViewer.
// ══════════════════════════════════════════════════════════════════════════════


// ─── ADMIN COMPANY VIEWER (Read-Only) ────────────────────────────────────────
function AdminCompanyViewer({ company, onBack }) {
  const [page, setPage] = useState("dash");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { data, loading } = useAppData(company.id);

  const navGroups = [
    { label:"الرئيسية", items:[{ id:"dash", label:"الرئيسية", icon:I.dash }] },
    { label:"المالية", items:[
      { id:"sales", label:"المبيعات", icon:I.sales },
      { id:"purchases", label:"المشتريات", icon:I.purchase },
      { id:"returns", label:"المرتجعات", icon:I.returns },
      { id:"revenue", label:"الإيرادات", icon:I.revenue },
      { id:"taxinvoices", label:"الفواتير الضريبية", icon:I.tax },
    ]},
    { label:"الأطراف", items:[
      { id:"clients", label:"العملاء", icon:I.clients },
      { id:"suppliers", label:"الموردين", icon:I.suppliers },
    ]},
    { label:"التقارير", items:[
      { id:"reports", label:"التقارير المالية", icon:I.report },
      { id:"taxreports", label:"التقارير الضريبية", icon:I.tax },
    ]},
    { label:"الإنتاج", items:[
      { id:"production", label:"تكلفة الإنتاج", icon:I.chartBar },
      { id:"employees", label:"الموظفين", icon:I.clients },
    ]},
    { label:"المخزون", items:[
      { id:"inventory", label:"إدارة المخزون", icon:I.inventory },
      { id:"inventoryitems", label:"الأصناف", icon:I.box },
      { id:"categories", label:"الفئات", icon:I.categories },
    ]},
  ];

  // No-op actions — read only
  const noOp = () => showPermissionToast("وضع المشاهدة فقط — لا يمكن التعديل", "warning");
  const readOnlyActions = new Proxy({}, { get: () => noOp });

  return (
    <div style={{ position:"relative" }}>
      {/* Admin banner */}
      <div style={{ position:"fixed",top:0,left:0,right:0,zIndex:9999,background:`linear-gradient(90deg,${C.accent},#a78bfa)`,padding:"8px 24px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <Ic d={I.shield} s={16} c="#fff" />
          <span style={{ color:"#fff",fontWeight:700,fontSize:13,fontFamily:"'Cairo','Segoe UI',sans-serif" }}>
            🔍 مشاهدة كمشرف — {company.company_name || company.email}
          </span>
          <span style={{ background:"rgba(255,255,255,0.25)",color:"#fff",fontSize:11,padding:"2px 10px",borderRadius:20,fontWeight:700 }}>للقراءة فقط</span>
        </div>
        <button onClick={onBack} style={{ background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.4)",borderRadius:8,padding:"6px 16px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Cairo','Segoe UI',sans-serif",display:"flex",alignItems:"center",gap:6 }}>
          <Ic d={I.logout} s={13} c="#fff" />العودة للادمن
        </button>
      </div>
      <div style={{ paddingTop:42 }}>
        <AppShell page={page} setPage={setPage} navGroups={navGroups} data={data} actions={readOnlyActions}
          loading={loading} userEmail={company.company_name || company.email}
          onLogout={onBack}
          roleBadge={<span style={{ background:"rgba(108,127,255,0.2)",color:C.accent,border:`1px solid ${C.accent}33`,borderRadius:20,padding:"2px 10px",fontSize:10,fontWeight:700 }}>مشرف — قراءة فقط</span>}
          sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed}
        />
      </div>
    </div>
  );
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
function AdminPanel() {
  const [activeTab, setActiveTab] = useState("clients"); // clients | subusers
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ email:"", password:"", company:"", firstLogin:true, subscriptionExpires: new Date(Date.now() + 365*24*60*60*1000).toISOString().split("T")[0] });
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState({ text:"", type:"" });
  const showMsg = (text, type="success") => { setMsg({ text, type }); setTimeout(()=>setMsg({text:"",type:""}),3500); };
  const [toggling, setToggling] = useState(null);
  const [adminViewingCompany, setAdminViewingCompany] = useState(null); // { id, email, company_name }

  // Sub-users state
  const [subUsers, setSubUsers] = useState([]);
  const [subLoading, setSubLoading] = useState(false);
  const [showSubAdd, setShowSubAdd] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState(""); // owner profile id
  const SENSITIVE_PAGE_IDS = ["sales","purchases","clients","suppliers","expenses","receipts","employees","inventory"];
  const [subForm, setSubForm] = useState({ username:"", password:"", display_name:"", role:"مشاهدة فقط", role_template:null, allowed_pages: ALL_PAGES.map(p=>p.id), sensitive_pages: SENSITIVE_PAGE_IDS });
  const [addingSub, setAddingSub] = useState(false);
  const [togglingSubId, setTogglingSubId] = useState(null);
  const [editingSub, setEditingSub] = useState(null); // sub-user being edited
  const [editForm, setEditForm] = useState(null);

  const [editingCompany, setEditingCompany] = useState(null);
  const [editCompanyForm, setEditCompanyForm] = useState({ email:"", company_name:"", subscription_expires_at:"", allowed_pages: ALL_PAGES.map(p=>p.id), owner_can_edit_users:false });
  const [auditLog, setAuditLog] = useState([]);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);

  // ── Load audit log from Supabase ──
  const loadAuditLog = async () => {
    setAuditLoading(true);
    const { data, error } = await supabase
      .from("admin_logs")
      .select("*")
      .order("performed_at", { ascending: false })
      .limit(200);
    if (!error && data) {
      setAuditLog(data.map(r => ({
        id: r.id,
        action: r.action,
        details: r.details,
        timestamp: r.performed_at,
      })));
    }
    setAuditLoading(false);
  };

  // ── Audit log helper — saves to Supabase ──
  const addAuditLog = async (action, details) => {
    const entry = { id: Date.now(), action, details, timestamp: new Date().toISOString() };
    setAuditLog(prev => [entry, ...prev.slice(0, 199)]);
    await supabase.from("admin_logs").insert({ action, details });
  };

  // ── Open edit company modal ──
  const openEditCompany = (u) => {
    setEditingCompany(u);
    setEditCompanyForm({
      email: u.email || "",
      company_name: u.company_name || "",
      subscription_expires_at: u.subscription_expires_at ? u.subscription_expires_at.split("T")[0] : "",
      allowed_pages: Array.isArray(u.allowed_pages) ? u.allowed_pages : ALL_PAGES.map(p=>p.id),
      owner_can_edit_users: !!u.owner_can_edit_users,
    });
  };

  // ── Save edit company ──
  const saveEditCompany = async () => {
    const updates = {
      company_name: editCompanyForm.company_name,
      subscription_expires_at: editCompanyForm.subscription_expires_at ? new Date(editCompanyForm.subscription_expires_at + "T23:59:59").toISOString() : null,
      allowed_pages: editCompanyForm.allowed_pages,
      owner_can_edit_users: editCompanyForm.owner_can_edit_users,
    };
    const { data: updateResult, error } = await supabase.from("profiles").update(updates).eq("id", editingCompany.id).select();
    if (error) {
      showMsg(`خطأ في الحفظ: ${error.message}`, "error");
      return;
    }
    // تحقق إن الـ update أثر فعلاً على صف
    if (!updateResult || updateResult.length === 0) {
      showMsg("⚠️ لم يتم الحفظ — تحقق من RLS Policies في Supabase: الأدمن محتاج صلاحية UPDATE على profiles", "error");
      return;
    }
    setUsers(prev => prev.map(u => u.id === editingCompany.id ? { ...u, ...updates, allowed_pages: editCompanyForm.allowed_pages } : u));
    addAuditLog("تعديل بيانات شركة", `${editingCompany.email} → اسم: ${editCompanyForm.company_name}, صفحات: ${editCompanyForm.allowed_pages.length}`);
    showMsg(`✓ تم تحديث بيانات ${editingCompany.email}`);
    setEditingCompany(null);
  };

  // ── Export companies to CSV/Excel ──
  const exportCompaniesCSV = () => {
    const headers = ["البريد الإلكتروني", "اسم الشركة", "تاريخ الإنشاء", "انتهاء الاشتراك", "الحالة", "عدد الموظفين"];
    const rows = clientUsers.map(u => {
      const empCount = subUsers.filter(su => su.owner_id === u.id).length;
      return [
        u.email,
        u.company_name || "",
        u.created_at ? new Date(u.created_at).toLocaleDateString("ar-EG") : "",
        u.subscription_expires_at ? new Date(u.subscription_expires_at).toLocaleDateString("ar-EG") : "",
        u.is_active ? "فعال" : "معطل",
        empCount,
      ];
    });
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `شركات_حسابي_pro_${new Date().toLocaleDateString("ar-EG").replace(/\//g,"-")}.csv`;
    a.click(); URL.revokeObjectURL(url);
    addAuditLog("تصدير بيانات الشركات", `${clientUsers.length} شركة`);
  };



  // ── Load company clients ──
  const db = supabaseAdmin || supabase; // استخدم admin client لو متاح
  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("added_at", { ascending: false, nullsFirst: false });

      if (error) {
        // جرب بدون order
        const { data: data2, error: error2 } = await supabase.from("profiles").select("*");
        if (error2) {
          const isRLS = error2.message?.includes("row-level") || error2.message?.includes("recursion") || error2.message?.includes("permission") || error2.code === "42501";
          setUsers([]);
          if (isRLS && !supabaseAdmin) {
            showMsg("⚠️ محتاج Service Role Key — اتبع التعليمات في تاب (⚙️ إعداد Supabase)", "error");
          } else {
            showMsg("خطأ: " + error2.message, "error");
          }
        } else {
          setUsers(data2 || []);
        }
      } else {
        setUsers(data || []);
      }
    } catch(e) {
      showMsg("خطأ في الاتصال: " + e.message, "error");
      setUsers([]);
    }
    setLoading(false);
  };

  // ── Load sub-users ──
  const loadSubUsers = async () => {
    setSubLoading(true);
    const { data, error } = await supabase.from("sub_users").select("*");
    if (error) console.error("loadSubUsers error:", error.message);
    if (!error) setSubUsers(data || []);
    setSubLoading(false);
  };

  useEffect(() => { loadUsers(); loadSubUsers(); loadAuditLog(); }, []);

  // ── Toggle client subscription (also toggles all sub_users under that company) ──
  const toggleUser = async (user) => {
    setToggling(user.id);
    const newStatus = !user.is_active;
    const { error } = await supabase.from("profiles").update({ is_active: newStatus }).eq("id", user.id);
    if (!error) {
      // Also update all sub_users belonging to this company
      await supabase.from("sub_users").update({ is_active: newStatus }).eq("owner_id", user.id);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: newStatus } : u));
      setSubUsers(prev => prev.map(su => su.owner_id === user.id ? { ...su, is_active: newStatus } : su));
      showMsg(newStatus ? `✓ تم تفعيل ${user.email} وجميع موظفيها` : `✓ تم تعطيل ${user.email} وجميع موظفيها`, newStatus ? "success" : "warning");
      addAuditLog(newStatus ? "تفعيل اشتراك شركة" : "إيقاف اشتراك شركة", user.email);
    } else { showMsg("حدث خطأ، حاول مرة أخرى", "error"); }
    setToggling(null);
  };

  // ── Add new company client via Supabase signup trick ──
  const addUser = async () => {
    if (!newUser.email || !newUser.password) { showMsg("أدخل الإيميل وكلمة المرور", "error"); return; }
    if (newUser.password.length < 6) { showMsg("كلمة المرور 6 أحرف على الأقل", "error"); return; }
    setAdding(true);
    try {
      const { data: { session: adminSession } } = await supabase.auth.getSession();

      const { data, error } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          data: { company_name: newUser.company || "" },
          emailRedirectTo: undefined,
        }
      });
      if (error) { showMsg(error.message, "error"); setAdding(false); return; }

      // ✅ استعد session الأدمن أولاً قبل أي كتابة
      if (adminSession?.access_token) {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });
      }

      if (data.user) {
        const createdAt = new Date().toISOString();
        const newUserSubExpires = newUser.subscriptionExpires ? new Date(newUser.subscriptionExpires + "T23:59:59").toISOString() : null;
        const { error: upsertErr } = await supabase.from("profiles").upsert({
          id: data.user.id,
          email: newUser.email,
          company_name: newUser.company || "",
          is_active: true,
          email_confirmed: true,
          first_login: newUser.firstLogin,
          temp_password: newUser.firstLogin ? newUser.password : null,
          subscription_expires_at: newUserSubExpires,
          added_at: createdAt,
        }, { onConflict: "id" });

        if (upsertErr) {
          showMsg("⚠️ تم إنشاء الحساب لكن فشل حفظ البروفايل: " + upsertErr.message, "error");
        } else {
          setUsers(prev => {
            const exists = prev.some(u => u.id === data.user.id);
            if (exists) return prev;
            return [{ id: data.user.id, email: newUser.email, company_name: newUser.company||"", is_active: true, added_at: createdAt, created_at: createdAt, first_login: newUser.firstLogin, subscription_expires_at: newUserSubExpires }, ...prev];
          });
        }
      }
      showMsg(`✓ تم إضافة ${newUser.email} بنجاح`);
      addAuditLog("إضافة شركة جديدة", `${newUser.email} — ${newUser.company || "بدون اسم"}`);
      setNewUser({ email:"", password:"", company:"", firstLogin:true, subscriptionExpires: new Date(Date.now() + 365*24*60*60*1000).toISOString().split("T")[0] });
      setShowAdd(false);
      setTimeout(loadUsers, 2000);
    } catch(e) { showMsg(e.message, "error"); }
    setAdding(false);
  };

  // ── Add sub-user (employee) ──
  const addSubUser = async () => {
    if (!subForm.username.trim() || !subForm.password) { showMsg("أدخل اسم المستخدم وكلمة المرور", "error"); return; }
    if (!selectedOwner) { showMsg("اختر حساب الشركة", "error"); return; }
    // Check username unique
    const exists = subUsers.some(su => su.username.toLowerCase() === subForm.username.trim().toLowerCase());
    if (exists) { showMsg("اسم المستخدم موجود بالفعل", "error"); return; }
    setAddingSub(true);
    const perms = ROLE_PRESETS[subForm.role] || ROLE_PRESETS["مشاهدة فقط"];
    const { error } = await supabase.from("sub_users").insert({
      owner_id: selectedOwner,
      username: subForm.username.trim().toLowerCase(),
      password_plain: subForm.password,
      display_name: subForm.display_name || subForm.username,
      role: subForm.role,
      allowed_pages: subForm.allowed_pages,
      sensitive_pages: subForm.sensitive_pages,
      role_template: subForm.role_template,
      can_add: perms.canAdd,
      can_delete: perms.canDelete,
      can_edit: perms.canEdit,
      is_active: true,
    });
    if (error) { showMsg("خطأ: " + error.message, "error"); }
    else {
      showMsg(`✓ تم إضافة الموظف "${subForm.username}" بنجاح`);
      logActivity(selectedOwner, { userName:ADMIN_EMAIL, fullName:"صاحب النظام", actionType:"إنشاء مستخدم", section:"إدارة المستخدمين", target:subForm.username, before:null, after:{ username:subForm.username, role:subForm.role, allowed_pages:subForm.allowed_pages } });
      setSubForm({ username:"", password:"", display_name:"", role:"مشاهدة فقط", role_template:null, allowed_pages: ALL_PAGES.map(p=>p.id), sensitive_pages: SENSITIVE_PAGE_IDS });
      setShowSubAdd(false);
      loadSubUsers();
    }
    setAddingSub(false);
  };

  const toggleSubUser = async (su) => {
    setTogglingSubId(su.id);
    const newStatus = !su.is_active;
    const { error } = await supabase.from("sub_users").update({ is_active: newStatus }).eq("id", su.id);
    if (!error) {
      setSubUsers(prev => prev.map(s => s.id === su.id ? { ...s, is_active: newStatus } : s));
      showMsg(newStatus ? `✓ تم تفعيل ${su.username}` : `✓ تم تعطيل ${su.username}`, newStatus ? "success" : "warning");
    } else showMsg("حدث خطأ", "error");
    setTogglingSubId(null);
  };

  const deleteSubUser = async (id) => {
    const su = subUsers.find(s=>s.id===id);
    const { error } = await supabase.from("sub_users").delete().eq("id", id);
    if (!error) {
      setSubUsers(prev => prev.filter(s => s.id !== id));
      showMsg("✓ تم الحذف");
      addAuditLog("حذف موظف", `id: ${id}`);
      if (su) logActivity(su.owner_id, { userName:ADMIN_EMAIL, fullName:"صاحب النظام", actionType:"حذف مستخدم", section:"إدارة المستخدمين", target:su.username, before:su, after:null });
    }
    else showMsg("خطأ في الحذف", "error");
  };

  const [deletingCompanyId, setDeletingCompanyId] = useState(null);
  const [confirmDeleteCompany, setConfirmDeleteCompany] = useState(null); // user object to delete

  const deleteCompany = async (user) => {
    setDeletingCompanyId(user.id);
    try {
      // 1. Delete all sub_users under this company
      await supabase.from("sub_users").delete().eq("owner_id", user.id);
      // 2. Delete all records belonging to this company
      await supabase.from("records").delete().eq("user_id", user.id);
      // 3. Delete profile (blocks login even if auth user still exists)
      const { error: profileErr } = await supabase.from("profiles").delete().eq("id", user.id);
      if (profileErr) { showMsg("خطأ في الحذف: " + profileErr.message, "error"); setDeletingCompanyId(null); setConfirmDeleteCompany(null); return; }

      setUsers(prev => prev.filter(u => u.id !== user.id));
      setSubUsers(prev => prev.filter(s => s.owner_id !== user.id));

      // 4. Delete from Supabase Auth via Edge Function (with service role)
      let authDeleted = false;
      try {
        const session = await supabase.auth.getSession();
        const token = session?.data?.session?.access_token || "";
        const resp = await fetch("https://cavzaxxfnxkzsmiratyk.supabase.co/functions/v1/delete-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({ userId: user.id }),
        });
        const result = await resp.json();
        if (result.error) {
          console.warn("Edge function error:", result.error);
        } else {
          authDeleted = true;
        }
      } catch (edgeErr) {
        console.warn("Edge function unreachable:", edgeErr.message);
      }

      showMsg(`✓ تم حذف ${user.email}${authDeleted ? " نهائياً من النظام" : " (البروفايل حُذف، Auth قد يحتاج حذف يدوي من Supabase Dashboard)"}`);
      addAuditLog("حذف شركة", `${user.email} — ${user.company_name || "بدون اسم"} — Auth: ${authDeleted ? "محذوف" : "يدوي"}`);
    } catch(e) { showMsg("خطأ: " + e.message, "error"); }
    setDeletingCompanyId(null);
    setConfirmDeleteCompany(null);
  };

  const openEditSub = (su) => {
    setEditingSub(su);
    setEditForm({
      username: su.username,
      password_plain: su.password_plain || "",
      display_name: su.display_name || "",
      role: su.role || "مشاهدة فقط",
      allowed_pages: su.allowed_pages || ALL_PAGES.map(p=>p.id),
      sensitive_pages: Array.isArray(su.sensitive_pages) ? su.sensitive_pages : SENSITIVE_PAGE_IDS,
      role_template: su.role_template || null,
      owner_id: su.owner_id,
    });
  };

  const saveEditSub = async () => {
    if (!editForm.username.trim()) { showMsg("أدخل اسم المستخدم", "error"); return; }
    const perms = ROLE_PRESETS[editForm.role] || ROLE_PRESETS["مشاهدة فقط"];
    const updates = {
      username: editForm.username.trim().toLowerCase(),
      display_name: editForm.display_name || editForm.username,
      role: editForm.role,
      allowed_pages: editForm.allowed_pages,
      sensitive_pages: editForm.sensitive_pages,
      role_template: editForm.role_template,
      can_add: perms.canAdd,
      can_delete: perms.canDelete,
      can_edit: perms.canEdit,
      owner_id: editForm.owner_id,
    };
    if (editForm.password_plain) updates.password_plain = editForm.password_plain;
    const { data: subUpdateResult, error } = await supabase.from("sub_users").update(updates).eq("id", editingSub.id).select();
    if (error) { showMsg("خطأ في الحفظ: " + error.message, "error"); return; }
    if (!subUpdateResult || subUpdateResult.length === 0) {
      showMsg("⚠️ لم يتم الحفظ — تحقق من RLS Policies في Supabase", "error"); return;
    }
    setSubUsers(prev => prev.map(s => s.id === editingSub.id ? { ...s, ...updates } : s));
    showMsg(`✓ تم تحديث بيانات "${editForm.username}" بنجاح`);
    addAuditLog("تعديل بيانات موظف", `${editForm.username} — دور: ${editForm.role}`);
    logActivity(editForm.owner_id, { userName:ADMIN_EMAIL, fullName:"صاحب النظام", actionType:"تعديل صلاحيات مستخدم", section:"إدارة المستخدمين", target:editForm.username, before:editingSub, after:updates });
    setEditingSub(null); setEditForm(null);
  };

  const clientUsers = users.filter(u => u.email !== ADMIN_EMAIL);
  const activeCount = clientUsers.filter(u => u.is_active).length;

  // Admin viewing a company's data in read-only mode
  if (adminViewingCompany) {
    return <AdminCompanyViewer company={adminViewingCompany} onBack={()=>setAdminViewingCompany(null)} />;
  }

  const tabStyle = (id) => ({
    padding:"10px 24px",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit",transition:"all 0.2s",
    background: activeTab===id ? C.accent : "transparent",
    color: activeTab===id ? "#fff" : C.textMuted,
    boxShadow: activeTab===id ? `0 4px 15px ${C.accent}40` : "none",
  });

  return (
    <div style={{ minHeight:"100vh",background:C.bg,fontFamily:"'Cairo','Segoe UI',sans-serif",direction:"rtl",padding:"24px 28px" }}>
      {/* Header */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
        <div style={{ display:"flex",alignItems:"center",gap:14 }}>
          <Logo size={42} />
          <div>
            <div style={{ fontSize:22,fontWeight:800,color:C.text }}>لوحة إدارة حسابي Pro</div>
            <div style={{ fontSize:12,color:C.textMuted,marginTop:2 }}>إدارة شاملة للعملاء والموظفين والصلاحيات</div>
          </div>
        </div>
        <div style={{ display:"flex",gap:10,alignItems:"center" }}>
          {msg.text && (
            <div style={{ background:msg.type==="success"?C.greenDim:msg.type==="warning"?C.yellowDim:C.redDim,border:`1px solid ${msg.type==="success"?C.green:msg.type==="warning"?C.yellow:C.red}33`,color:msg.type==="success"?C.green:msg.type==="warning"?C.yellow:C.red,borderRadius:10,padding:"8px 18px",fontSize:12,fontWeight:700,maxWidth:320 }}>
              {msg.text}
            </div>
          )}
          <Btn variant="cyan" onClick={exportCompaniesCSV}><Ic d={I.excel} s={14} />تصدير Excel</Btn>
          <Btn variant="yellow" onClick={()=>{ setShowAuditLog(p=>{ if(!p) loadAuditLog(); return !p; }); }}><Ic d={I.report} s={14} />سجل النشاط</Btn>
          <Btn variant="danger" onClick={()=>supabase.auth.signOut()}><Ic d={I.logout} s={14} />خروج</Btn>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24 }}>
        {[
          {label:"إجمالي الشركات",value:clientUsers.length,color:C.accent,icon:I.clients},
          {label:"اشتراكات فعالة",value:activeCount,color:C.green,icon:I.shield},
          {label:"اشتراكات معطلة",value:clientUsers.length-activeCount,color:C.red,icon:I.alert},
          {label:"إجمالي الموظفين",value:subUsers.length,color:C.purple,icon:I.people},
        ].map(s=>(
          <div key={s.label} style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:"18px 22px",borderTop:`3px solid ${s.color}`,display:"flex",alignItems:"center",gap:14 }}>
            <div style={{ background:s.color+"18",padding:10,borderRadius:12 }}><Ic d={s.icon} s={20} c={s.color} /></div>
            <div>
              <div style={{ fontSize:11,color:C.textMuted,fontWeight:600,marginBottom:4 }}>{s.label}</div>
              <div style={{ fontSize:26,fontWeight:800,color:s.color }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Expiring Soon Alerts */}
      {(() => {
        const now = new Date();
        const expiring = clientUsers.filter(u => {
          if (!u.subscription_expires_at) return false;
          const d = new Date(u.subscription_expires_at);
          const days = Math.ceil((d - now)/(1000*60*60*24));
          return days >= 0 && days <= 10;
        });
        if (!expiring.length) return null;
        return (
          <div style={{ background:C.yellowDim,border:`1px solid ${C.yellow}44`,borderRadius:14,padding:"14px 20px",marginBottom:8 }}>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
              <Ic d={I.alert} s={18} c={C.yellow} />
              <span style={{ fontWeight:700,color:C.yellow,fontSize:14 }}>⚠ تنبيه: {expiring.length} شركة اشتراكها على وشك الانتهاء</span>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
              {expiring.map(u => {
                const daysLeft = Math.ceil((new Date(u.subscription_expires_at) - now)/(1000*60*60*24));
                return (
                  <div key={u.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",background:C.surface,border:`1px solid ${C.yellow}22`,borderRadius:10,padding:"8px 14px" }}>
                    <span style={{ fontWeight:600,color:C.text,fontSize:13 }}>{u.company_name||u.email}</span>
                    <span style={{ color:C.yellow,fontWeight:700,fontSize:12 }}>ينتهي خلال {daysLeft} يوم — {new Date(u.subscription_expires_at).toLocaleDateString("ar-EG")}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Audit Log Panel */}
      {showAuditLog && (
        <div style={{ background:C.surface,border:`1px solid ${C.yellow}33`,borderRadius:16,padding:"20px 22px",marginBottom:8 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ display:"flex",alignItems:"center",gap:10 }}>
              <div style={{ fontSize:15,fontWeight:700,color:C.text }}>📋 سجل نشاط الادمن</div>
              <button onClick={loadAuditLog} style={{ background:C.accentDim,color:C.accent,border:`1px solid ${C.accent}33`,borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>
                {auditLoading ? "جاري التحميل..." : "🔄 تحديث"}
              </button>
            </div>
            <button onClick={()=>setShowAuditLog(false)} style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,cursor:"pointer",color:C.textMuted,padding:"5px 8px",display:"flex" }}><Ic d={I.close} s={14} /></button>
          </div>
          {auditLoading ? (
            <div style={{ textAlign:"center",color:C.textMuted,padding:24,fontSize:13 }}>جاري تحميل السجل...</div>
          ) : auditLog.length === 0 ? (
            <div style={{ textAlign:"center",color:C.textMuted,padding:24,fontSize:13 }}>لا توجد عمليات مسجلة بعد</div>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:8,maxHeight:340,overflowY:"auto" }}>
              {auditLog.map(entry => (
                <div key={entry.id} style={{ display:"flex",gap:14,alignItems:"flex-start",background:C.surface2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px" }}>
                  <div style={{ background:C.yellowDim,border:`1px solid ${C.yellow}33`,borderRadius:8,padding:"4px 8px",flexShrink:0 }}>
                    <Ic d={I.shield} s={13} c={C.yellow} />
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13,fontWeight:700,color:C.text }}>{entry.action}</div>
                    <div style={{ fontSize:11,color:C.textMuted,marginTop:2 }}>{entry.details}</div>
                  </div>
                  <div style={{ fontSize:10,color:C.textMuted,whiteSpace:"nowrap",flexShrink:0 }}>{fmtDateTime(entry.timestamp)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex",gap:6,marginBottom:20,background:C.surface2,padding:4,borderRadius:14,border:`1px solid ${C.border}`,width:"fit-content" }}>
        <button style={tabStyle("clients")} onClick={()=>setActiveTab("clients")}>🏢 إدارة الشركات العملاء</button>
        <button style={tabStyle("subusers")} onClick={()=>setActiveTab("subusers")}>👥 إدارة موظفي الشركات</button>
      </div>

      {/* ── Clients Tab ── */}
      {activeTab === "clients" && (
        <div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ fontSize:16,fontWeight:700,color:C.text }}>قائمة الشركات العملاء</div>
            <Btn onClick={()=>setShowAdd(true)}><Ic d={I.userPlus} s={14} />إضافة شركة جديدة</Btn>
          </div>
          <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden" }}>
            {loading ? <div style={{ padding:40,textAlign:"center",color:C.textMuted }}>جاري التحميل...</div> : (
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <THead cols={["البريد الإلكتروني","اسم الشركة","تاريخ الإنشاء","انتهاء الاشتراك","الموظفون","الحالة","التحكم"]} />
                <tbody>
                  {clientUsers.map((u,i)=>{
                    const empCount = subUsers.filter(su=>su.owner_id===u.id).length;
                    const expDate = u.subscription_expires_at ? new Date(u.subscription_expires_at) : null;
                    const now = new Date();
                    const daysLeft = expDate ? Math.ceil((expDate - now)/(1000*60*60*24)) : null;
                    const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
                    const isExpired = daysLeft !== null && daysLeft < 0;
                    return (
                      <TRow key={u.id} alt={i%2}>
                        <TD><span style={{ fontWeight:600 }}>{u.email}</span></TD>
                        <TD color={C.textDim}>{u.company_name||"—"}</TD>
                        <TD color={C.textMuted}>{(u.added_at||u.created_at||u.inserted_at) ? new Date(u.added_at||u.created_at||u.inserted_at).toLocaleDateString("ar-EG", {year:"numeric",month:"2-digit",day:"2-digit"}) : "—"}</TD>
                        <td style={{ padding:"11px 14px" }}>
                          {expDate ? (
                            <div style={{ display:"flex",flexDirection:"column",gap:3 }}>
                              <span style={{ fontSize:12,color:isExpired?C.red:isExpiringSoon?C.yellow:C.textDim,fontWeight:700 }}>
                                {expDate.toLocaleDateString("ar-EG",{year:"numeric",month:"2-digit",day:"2-digit"})}
                              </span>
                              {isExpiringSoon && !isExpired && <span style={{ background:C.yellowDim,color:C.yellow,border:`1px solid ${C.yellow}33`,padding:"1px 7px",borderRadius:20,fontSize:10,fontWeight:700 }}>⚠ {daysLeft} يوم متبقي</span>}
                              {isExpired && <span style={{ background:C.redDim,color:C.red,border:`1px solid ${C.red}33`,padding:"1px 7px",borderRadius:20,fontSize:10,fontWeight:700 }}>منتهي</span>}
                            </div>
                          ) : <span style={{ color:C.textMuted,fontSize:12 }}>—</span>}
                        </td>
                        <TD><span style={{ background:C.purpleDim,color:C.purple,padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700 }}>{empCount} موظف</span></TD>
                        <td style={{ padding:"11px 14px" }}>
                          <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
                            <Badge label={u.is_active?"مدفوعة":"غير مدفوعة"} />
                            {u.first_login && <span style={{ background:C.accentDim,color:C.accent,border:`1px solid ${C.accent}33`,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,whiteSpace:"nowrap" }}>🔑 لم يُعيّن باسورد</span>}
                          </div>
                        </td>
                        <td style={{ padding:"11px 14px" }}>
                          <div style={{ display:"flex",gap:6,alignItems:"center",flexWrap:"wrap" }}>
                            <button onClick={()=>setAdminViewingCompany(u)}
                              style={{ background:C.accentDim,color:C.accent,border:`1px solid ${C.accent}33`,borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5 }}>
                              <Ic d={I.report} s={12} />عرض
                            </button>
                            <button onClick={()=>openEditCompany(u)}
                              style={{ background:C.blueDim,color:C.blue,border:`1px solid ${C.blue}33`,borderRadius:8,padding:"6px 10px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5 }} title="تعديل">
                              <Ic d={I.edit} s={12} />
                            </button>
                            <button onClick={()=>toggleUser(u)} disabled={toggling===u.id}
                              style={{ background:u.is_active?C.redDim:C.greenDim,color:u.is_active?C.red:C.green,border:`1px solid ${u.is_active?C.red:C.green}33`,borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>
                              {toggling===u.id?"...":(u.is_active?"إيقاف":"تفعيل")}
                            </button>
                            <button onClick={()=>setConfirmDeleteCompany(u)} disabled={deletingCompanyId===u.id}
                              style={{ background:C.redDim,color:C.red,border:`1px solid ${C.red}33`,borderRadius:8,padding:"6px 10px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5 }} title="حذف الشركة">
                              <Ic d={I.trash} s={12} />
                            </button>
                          </div>
                        </td>
                      </TRow>
                    );
                  })}
                </tbody>
              </table>
            )}
            {!loading && clientUsers.length===0 && (
              <div style={{ padding:"40px 20px",textAlign:"center",color:C.textMuted,fontSize:13 }}>
                لا توجد شركات مضافة بعد — اضغط "إضافة شركة جديدة" للبدء
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Sub-Users Tab ── */}
      {activeTab === "subusers" && (
        <div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ fontSize:16,fontWeight:700,color:C.text }}>موظفو الشركات (Sub-Users)</div>
            <Btn onClick={()=>setShowSubAdd(true)}><Ic d={I.userPlus} s={14} />إضافة موظف</Btn>
          </div>
          <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden" }}>
            {subLoading ? <div style={{ padding:40,textAlign:"center",color:C.textMuted }}>جاري التحميل...</div> : (
              <table style={{ width:"100%",borderCollapse:"collapse" }}>
                <THead cols={["اسم المستخدم","الاسم","الشركة","الدور","الصلاحيات","الصفحات","تاريخ الإضافة","الحالة","التحكم"]} />
                <tbody>
                  {subUsers.map((su,i)=>{
                    const ownerProfile = users.find(u=>u.id===su.owner_id);
                    const pagesCount = (su.allowed_pages||[]).length;
                    return (
                      <TRow key={su.id} alt={i%2}>
                        <TD><span style={{ fontFamily:"monospace",fontWeight:700,color:C.accent }}>{su.username}</span></TD>
                        <TD>{su.display_name||"—"}</TD>
                        <TD color={C.textDim}>{ownerProfile?.company_name||ownerProfile?.email||"—"}</TD>
                        <TD><span style={{ background:C.purpleDim,color:C.purple,padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700 }}>{su.role}</span></TD>
                        <td style={{ padding:"11px 14px" }}>
                          <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>
                            {su.can_add && <span style={{ background:C.greenDim,color:C.green,fontSize:10,padding:"2px 7px",borderRadius:20,fontWeight:700 }}>إضافة</span>}
                            {su.can_edit && <span style={{ background:C.blueDim,color:C.blue,fontSize:10,padding:"2px 7px",borderRadius:20,fontWeight:700 }}>تعديل</span>}
                            {su.can_delete && <span style={{ background:C.redDim,color:C.red,fontSize:10,padding:"2px 7px",borderRadius:20,fontWeight:700 }}>حذف</span>}
                            {!su.can_add&&!su.can_edit&&!su.can_delete && <span style={{ background:C.surface2,color:C.textMuted,fontSize:10,padding:"2px 7px",borderRadius:20,fontWeight:700 }}>مشاهدة فقط</span>}
                          </div>
                        </td>
                        <TD color={C.textMuted}><span style={{ fontSize:11 }}>{pagesCount} صفحة</span></TD>
                        <TD color={C.textMuted}><span style={{ fontSize:11 }}>{su.created_at ? new Date(su.created_at).toLocaleDateString("ar-EG",{year:"numeric",month:"2-digit",day:"2-digit"}) : "—"}</span></TD>
                        <td style={{ padding:"11px 14px" }}><Badge label={su.is_active?"مدفوعة":"غير مدفوعة"} /></td>
                        <td style={{ padding:"11px 14px" }}>
                          <div style={{ display:"flex",gap:6 }}>
                            <button onClick={()=>toggleSubUser(su)} disabled={togglingSubId===su.id}
                              style={{ background:su.is_active?C.yellowDim:C.greenDim,color:su.is_active?C.yellow:C.green,border:`1px solid ${su.is_active?C.yellow:C.green}33`,borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>
                              {togglingSubId===su.id?"...":(su.is_active?"تعطيل":"تفعيل")}
                            </button>
                            <button onClick={()=>openEditSub(su)} style={{ background:C.blueDim,color:C.blue,border:`1px solid ${C.blue}33`,borderRadius:8,padding:"5px 10px",fontSize:11,cursor:"pointer" }} title="تعديل">
                              <Ic d={I.edit} s={13} />
                            </button>
                            <button onClick={()=>deleteSubUser(su.id)} style={{ background:C.redDim,color:C.red,border:`1px solid ${C.red}33`,borderRadius:8,padding:"5px 10px",fontSize:11,cursor:"pointer" }} title="حذف">
                              <Ic d={I.trash} s={13} />
                            </button>
                          </div>
                        </td>
                      </TRow>
                    );
                  })}
                </tbody>
              </table>
            )}
            {!subLoading && subUsers.length===0 && <div style={{ padding:40,textAlign:"center",color:C.textMuted }}>لا يوجد موظفون مضافون بعد</div>}
          </div>
        </div>
      )}

      {editingCompany && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16 }}>
          <div style={{ background:C.surface,border:`1px solid ${C.blue}33`,borderRadius:22,padding:32,width:"min(580px,95vw)",maxHeight:"90vh",overflowY:"auto",scrollbarWidth:"thin",scrollbarColor:`${C.border} transparent`,display:"flex",flexDirection:"column",gap:18,boxShadow:`0 0 60px ${C.blue}22` }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <h2 style={{ margin:0,fontSize:17,fontWeight:700,color:C.text }}>✏️ تعديل بيانات الشركة</h2>
              <button onClick={()=>setEditingCompany(null)} style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,cursor:"pointer",color:C.textMuted,padding:6,display:"flex" }}><Ic d={I.close} s={16} /></button>
            </div>
            {msg.text && <div style={{ background:msg.type==="success"?C.greenDim:C.redDim,border:`1px solid ${msg.type==="success"?C.green:C.red}33`,color:msg.type==="success"?C.green:C.red,borderRadius:10,padding:"10px 16px",fontSize:13,fontWeight:700 }}>{msg.text}</div>}
            <div style={{ background:C.blueDim,border:`1px solid ${C.blue}22`,borderRadius:12,padding:"12px 16px",fontSize:12,color:C.blue }}>
              🔵 تعديل: <strong>{editingCompany.email}</strong>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
              {/* Email — locked, never editable */}
              <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
                <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>البريد الإلكتروني</label>
                <div style={{ display:"flex",alignItems:"center",gap:8,background:C.surface3,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 13px" }}>
                  <Ic d={I.shield} s={14} c={C.textMuted} />
                  <span style={{ fontSize:13,color:C.textMuted,flex:1 }}>{editingCompany.email}</span>
                  <span style={{ fontSize:10,color:C.textMuted,background:C.surface2,borderRadius:6,padding:"2px 8px",border:`1px solid ${C.border}` }}>ثابت</span>
                </div>
                <div style={{ fontSize:11,color:C.textMuted }}>البريد الإلكتروني لا يمكن تغييره</div>
              </div>
              <Inp label="اسم الشركة" value={editCompanyForm.company_name} onChange={v=>setEditCompanyForm({...editCompanyForm,company_name:v})} placeholder="شركة النور للتجارة" />
              <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
                <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>تاريخ انتهاء الاشتراك</label>
                <DatePicker value={editCompanyForm.subscription_expires_at} onChange={v=>setEditCompanyForm({...editCompanyForm,subscription_expires_at:v})} />
                {editCompanyForm.subscription_expires_at && (() => {
                  const days = Math.ceil((new Date(editCompanyForm.subscription_expires_at) - new Date())/(1000*60*60*24));
                  return <div style={{ fontSize:11,color:days<=7?C.yellow:C.green,fontWeight:600 }}>{days > 0 ? `متبقي ${days} يوم` : "منتهي الصلاحية"}</div>;
                })()}
              </div>
              {/* السماح لصاحب الشركة بتعديل بيانات المستخدمين (بيانات أساسية فقط) */}
              <div style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:14,padding:16,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:13,fontWeight:700,color:C.text }}>السماح لصاحب الشركة بتعديل بيانات المستخدمين</div>
                  <div style={{ fontSize:11,color:C.textMuted,marginTop:4,maxWidth:420 }}>لو مفعّل: يقدر يعدّل اليوزرنيم/الاسم/كلمة المرور بس لموظفيه (من غير صلاحيات/أدوار). لو مطفي: يشوف القائمة بس من غير تعديل.</div>
                </div>
                <button onClick={()=>setEditCompanyForm(p=>({...p,owner_can_edit_users:!p.owner_can_edit_users}))}
                  style={{ width:44,height:24,borderRadius:20,border:"none",cursor:"pointer",background:editCompanyForm.owner_can_edit_users?C.green:C.surface3,position:"relative",flexShrink:0 }}>
                  <span style={{ position:"absolute",top:3,right:editCompanyForm.owner_can_edit_users?23:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"right 0.2s" }} />
                </button>
              </div>
              {/* Allowed pages for this company */}
              <div style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:14,padding:16 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
                  <span style={{ fontSize:13,fontWeight:700,color:C.text }}>الصفحات المسموح بها ({editCompanyForm.allowed_pages.length} من {ALL_PAGES.length})</span>
                  <div style={{ display:"flex",gap:8 }}>
                    <button onClick={()=>setEditCompanyForm(p=>({...p,allowed_pages:ALL_PAGES.map(pg=>pg.id)}))} style={{ background:C.greenDim,color:C.green,border:`1px solid ${C.green}33`,borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>تحديد الكل</button>
                    <button onClick={()=>setEditCompanyForm(p=>({...p,allowed_pages:[]}))} style={{ background:C.redDim,color:C.red,border:`1px solid ${C.red}33`,borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>إلغاء الكل</button>
                  </div>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8 }}>
                  {ALL_PAGES.map(pg=>{
                    const checked = editCompanyForm.allowed_pages.includes(pg.id);
                    return (
                      <label key={pg.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:10,background:checked?C.accentDim:C.surface3,border:`1px solid ${checked?C.accent+"44":C.border}`,cursor:"pointer",transition:"all 0.15s" }}>
                        <input type="checkbox" checked={checked} onChange={e=>setEditCompanyForm(prev=>({
                          ...prev,
                          allowed_pages: e.target.checked ? [...prev.allowed_pages,pg.id] : prev.allowed_pages.filter(x=>x!==pg.id)
                        }))} style={{ accentColor:C.accent,width:14,height:14 }} />
                        <span style={{ fontSize:12,fontWeight:600,color:checked?C.accent:C.textMuted }}>{pg.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setEditingCompany(null)}>إلغاء</Btn>
              <Btn variant="cyan" onClick={saveEditCompany}><Ic d={I.edit} s={14} />حفظ التعديلات</Btn>
            </div>
          </div>
        </div>
      )}
      {showAdd && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }}>
          <div style={{ background:C.surface,border:`1px solid ${C.borderLight}`,borderRadius:22,padding:32,width:"min(460px,92vw)",display:"flex",flexDirection:"column",gap:16 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
              <h2 style={{ margin:0,fontSize:17,fontWeight:700,color:C.text }}>🏢 إضافة شركة عميل جديدة</h2>
              <button onClick={()=>setShowAdd(false)} style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,cursor:"pointer",color:C.textMuted,padding:6,display:"flex" }}><Ic d={I.close} s={16} /></button>
            </div>
            <Inp label="البريد الإلكتروني *" value={newUser.email} onChange={v=>setNewUser({...newUser,email:v})} type="email" placeholder="company@example.com" />
            <Inp label="كلمة المرور المؤقتة * (6 أحرف على الأقل)" value={newUser.password} onChange={v=>setNewUser({...newUser,password:v})} placeholder="احفظها جيداً" />
            <Inp label="اسم الشركة" value={newUser.company} onChange={v=>setNewUser({...newUser,company:v})} placeholder="شركة النور للتجارة" />

            {/* First Login Toggle */}
            <div style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px" }}>
              <label style={{ display:"flex",alignItems:"center",gap:12,cursor:"pointer" }}>
                <div onClick={()=>setNewUser(p=>({...p,firstLogin:!p.firstLogin}))}
                  style={{ width:44,height:24,borderRadius:12,background:newUser.firstLogin?C.accent:C.surface3,border:`1px solid ${newUser.firstLogin?C.accent:C.border}`,position:"relative",transition:"all 0.2s",flexShrink:0 }}>
                  <div style={{ position:"absolute",top:3,right:newUser.firstLogin?3:undefined,left:newUser.firstLogin?undefined:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"all 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)" }} />
                </div>
                <div>
                  <div style={{ fontSize:13,fontWeight:700,color:C.text }}>دخول أول مرة بدون باسورد</div>
                  <div style={{ fontSize:11,color:C.textMuted,marginTop:2 }}>العميل يدخل بأي كلمة مرور أول مرة ثم يُجبر على تعيين باسورد جديد</div>
                </div>
              </label>
            </div>

            <div style={{ background:newUser.firstLogin?C.accentDim:C.greenDim,border:`1px solid ${newUser.firstLogin?C.accent:C.green}33`,borderRadius:10,padding:"11px 14px",fontSize:12,color:newUser.firstLogin?C.accent:C.green,lineHeight:1.7 }}>
              {newUser.firstLogin
                ? "🔑 العميل سيدخل أول مرة بأي كلمة مرور، ثم سيُطلب منه تعيين باسورد خاص به"
                : "✅ الحساب جاهز للدخول فوراً — العميل يستخدم كلمة المرور المؤقتة المكتوبة أعلاه"
              }<br/>⚠️ احفظ كلمة المرور لأنك لن تراها مرة أخرى
            </div>
            <div style={{ display:"flex",gap:10,justifyContent:"flex-end",marginTop:4 }}>
              <Btn variant="ghost" onClick={()=>setShowAdd(false)}>إلغاء</Btn>
              <Btn onClick={addUser}>{adding?"جاري الإضافة...":"إضافة الشركة"}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Sub-User Modal ── */}
      {showSubAdd && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16 }}>
          <div style={{ background:C.surface,border:`1px solid ${C.borderLight}`,borderRadius:22,padding:32,width:"min(640px,95vw)",maxHeight:"90vh",overflowY:"auto",scrollbarWidth:"thin",scrollbarColor:`${C.border} transparent`,display:"flex",flexDirection:"column",gap:18 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <h2 style={{ margin:0,fontSize:17,fontWeight:700,color:C.text }}>👤 إضافة موظف جديد</h2>
              <button onClick={()=>setShowSubAdd(false)} style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,cursor:"pointer",color:C.textMuted,padding:6,display:"flex" }}><Ic d={I.close} s={16} /></button>
            </div>

            {/* Owner select */}
            <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
              <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>الشركة التابع لها الموظف *</label>
              <select value={selectedOwner} onChange={e=>setSelectedOwner(e.target.value)}
                style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none" }}>
                <option value="">-- اختر الشركة --</option>
                {clientUsers.map(u=><option key={u.id} value={u.id}>{u.company_name||u.email}</option>)}
              </select>
            </div>

            <div style={{ background:C.accentDim,border:`1px solid ${C.accent}33`,borderRadius:12,padding:"14px 18px" }}>
              <label style={{ fontSize:12,color:C.accent,fontWeight:700,display:"block",marginBottom:8 }}>⚡ قالب صلاحيات جاهز (اختياري)</label>
              <select onChange={e=>{
                const tName = e.target.value;
                if (!tName) return;
                const tmpl = ROLE_TEMPLATES[tName];
                if (!tmpl) return;
                setSubForm(prev=>({ ...prev, role: tmpl.role, role_template: tName, allowed_pages:["dash",...tmpl.pages], sensitive_pages: tmpl.pages.filter(p=>SENSITIVE_PAGE_IDS.includes(p)) }));
              }} defaultValue="" style={{ width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none" }}>
                <option value="">-- اختر قالب (أو حدد الصفحات يدوياً تحت) --</option>
                {Object.keys(ROLE_TEMPLATES).map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <div style={{ fontSize:11,color:C.accent,marginTop:6 }}>اختيار القالب نقطة بداية بس — تقدر تعدّل الصفحات يدوياً بعد كده.</div>
            </div>

            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <Inp label="اسم المستخدم (Username) *" value={subForm.username} onChange={v=>setSubForm({...subForm,username:v.replace(/\s/g,"_")})} placeholder="ahmed_sales" />
              <Inp label="الاسم الظاهر" value={subForm.display_name} onChange={v=>setSubForm({...subForm,display_name:v})} placeholder="أحمد محمود" />
              <Inp label="كلمة المرور *" value={subForm.password} onChange={v=>setSubForm({...subForm,password:v})} placeholder="123456" />
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>الدور</label>
                <select value={subForm.role} onChange={e=>{
                  const role = e.target.value;
                  const perms = ROLE_PRESETS[role];
                  setSubForm(prev=>({...prev, role, can_add:perms.canAdd, can_delete:perms.canDelete, can_edit:perms.canEdit}));
                }} style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none" }}>
                  {Object.keys(ROLE_PRESETS).map(r=><option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            {/* Role permissions preview */}
            <div style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 18px" }}>
              <div style={{ fontSize:12,fontWeight:700,color:C.textDim,marginBottom:10 }}>الصلاحيات المحددة للدور:</div>
              <div style={{ display:"flex",gap:10 }}>
                {[
                  {label:"إضافة",active:ROLE_PRESETS[subForm.role]?.canAdd,color:C.green},
                  {label:"تعديل",active:ROLE_PRESETS[subForm.role]?.canEdit,color:C.blue},
                  {label:"حذف",active:ROLE_PRESETS[subForm.role]?.canDelete,color:C.red},
                ].map(p=>(
                  <div key={p.label} style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:20,background:p.active?p.color+"18":C.surface3,border:`1px solid ${p.active?p.color+"44":C.border}` }}>
                    <div style={{ width:6,height:6,borderRadius:"50%",background:p.active?p.color:C.textMuted }} />
                    <span style={{ fontSize:12,fontWeight:700,color:p.active?p.color:C.textMuted }}>{p.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Allowed pages */}
            <div>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>الصفحات المسموح بها ({subForm.allowed_pages.length} من {ALL_PAGES.length})</label>
                <div style={{ display:"flex",gap:8 }}>
                  <button onClick={()=>setSubForm(p=>({...p,allowed_pages:ALL_PAGES.map(x=>x.id)}))} style={{ background:C.greenDim,color:C.green,border:`1px solid ${C.green}33`,borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>تحديد الكل</button>
                  <button onClick={()=>setSubForm(p=>({...p,allowed_pages:[]}))} style={{ background:C.redDim,color:C.red,border:`1px solid ${C.red}33`,borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>إلغاء الكل</button>
                </div>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8 }}>
                {ALL_PAGES.map(pg=>{
                  const checked = subForm.allowed_pages.includes(pg.id);
                  return (
                    <label key={pg.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:10,background:checked?C.accentDim:C.surface2,border:`1px solid ${checked?C.accent+"44":C.border}`,cursor:"pointer",transition:"all 0.15s" }}>
                      <input type="checkbox" checked={checked} onChange={e=>setSubForm(prev=>({
                        ...prev,
                        allowed_pages: e.target.checked ? [...prev.allowed_pages,pg.id] : prev.allowed_pages.filter(x=>x!==pg.id)
                      }))} style={{ accentColor:C.accent,width:14,height:14 }} />
                      <span style={{ fontSize:12,fontWeight:600,color:checked?C.accent:C.textMuted }}>{pg.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ background:C.yellowDim,border:`1px solid ${C.yellow}33`,borderRadius:10,padding:"11px 14px",fontSize:12,color:C.yellow,lineHeight:1.7 }}>
              💡 الموظف سيدخل من شاشة تسجيل الدخول باختيار "دخول موظف" ثم يدخل اليوزرنيم والباسورد
            </div>

            {/* Sensitive pages (Passcode-gated actions) */}
            <div>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>الصفحات المسموح بالتعديل/الحذف الحساس فيها ({subForm.sensitive_pages.length} من {SENSITIVE_PAGE_IDS.length})</label>
                <div style={{ display:"flex",gap:8 }}>
                  <button onClick={()=>setSubForm(p=>({...p,sensitive_pages:SENSITIVE_PAGE_IDS}))} style={{ background:C.greenDim,color:C.green,border:`1px solid ${C.green}33`,borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>تحديد الكل</button>
                  <button onClick={()=>setSubForm(p=>({...p,sensitive_pages:[]}))} style={{ background:C.redDim,color:C.red,border:`1px solid ${C.red}33`,borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>إلغاء الكل</button>
                </div>
              </div>
              <div style={{ background:C.accentDim,border:`1px solid ${C.accent}22`,borderRadius:8,padding:"8px 12px",fontSize:11,color:C.accent,marginBottom:8 }}>
                🔐 حتى لو الصفحة دي متفعلة هنا، الموظف لازم يعرف الـ Passcode برضو عشان ينفذ أي تعديل أو حذف فيها.
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8 }}>
                {ALL_PAGES.filter(pg=>SENSITIVE_PAGE_IDS.includes(pg.id)).map(pg=>{
                  const checked = subForm.sensitive_pages.includes(pg.id);
                  return (
                    <label key={pg.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:10,background:checked?C.accentDim:C.surface2,border:`1px solid ${checked?C.accent+"44":C.border}`,cursor:"pointer",transition:"all 0.15s" }}>
                      <input type="checkbox" checked={checked} onChange={e=>setSubForm(prev=>({
                        ...prev,
                        sensitive_pages: e.target.checked ? [...prev.sensitive_pages,pg.id] : prev.sensitive_pages.filter(x=>x!==pg.id)
                      }))} style={{ accentColor:C.accent,width:14,height:14 }} />
                      <span style={{ fontSize:12,fontWeight:600,color:checked?C.accent:C.textMuted }}>{pg.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>setShowSubAdd(false)}>إلغاء</Btn>
              <Btn onClick={addSubUser}>{addingSub?"جاري الإضافة...":"إضافة الموظف"}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Company ── */}
      {confirmDeleteCompany && (
        <ConfirmDialog
          message={`هل تريد حذف شركة "${confirmDeleteCompany.company_name || confirmDeleteCompany.email}" نهائياً؟ سيتم حذف جميع موظفيها وبياناتها ولا يمكن التراجع.`}
          onConfirm={()=>deleteCompany(confirmDeleteCompany)}
          onCancel={()=>setConfirmDeleteCompany(null)}
        />
      )}

      {/* ── Edit Sub-User Modal ── */}

      {editingSub && editForm && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16 }}>
          <div style={{ background:C.surface,border:`1px solid ${C.blue}33`,borderRadius:22,padding:32,width:"min(640px,95vw)",maxHeight:"90vh",overflowY:"auto",scrollbarWidth:"thin",scrollbarColor:`${C.border} transparent`,display:"flex",flexDirection:"column",gap:18,boxShadow:`0 0 60px ${C.blue}22` }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <h2 style={{ margin:0,fontSize:17,fontWeight:700,color:C.text }}>✏️ تعديل بيانات الموظف</h2>
              <button onClick={()=>{setEditingSub(null);setEditForm(null);}} style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,cursor:"pointer",color:C.textMuted,padding:6,display:"flex" }}><Ic d={I.close} s={16} /></button>
            </div>

            <div style={{ background:C.blueDim,border:`1px solid ${C.blue}22`,borderRadius:12,padding:"12px 16px",fontSize:12,color:C.blue }}>
              🔵 تعديل بيانات: <strong>{editingSub.username}</strong>
            </div>

            <div style={{ background:C.accentDim,border:`1px solid ${C.accent}33`,borderRadius:12,padding:"14px 18px" }}>
              <label style={{ fontSize:12,color:C.accent,fontWeight:700,display:"block",marginBottom:8 }}>⚡ تطبيق قالب صلاحيات جاهز (اختياري)</label>
              <select onChange={e=>{
                const tName = e.target.value;
                if (!tName) return;
                const tmpl = ROLE_TEMPLATES[tName];
                if (!tmpl) return;
                setEditForm(prev=>({ ...prev, role: tmpl.role, role_template: tName, allowed_pages:["dash",...tmpl.pages], sensitive_pages: tmpl.pages.filter(p=>SENSITIVE_PAGE_IDS.includes(p)) }));
              }} defaultValue="" style={{ width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none" }}>
                <option value="">-- اختر قالب (هيغيّر الصفحات المسموحة تحت) --</option>
                {Object.keys(ROLE_TEMPLATES).map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <div style={{ fontSize:11,color:C.accent,marginTop:6 }}>القالب نقطة بداية بس — الصفحات تحت تفضل قابلة للتعديل يدوياً.</div>
            </div>

            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
              <Inp label="اسم المستخدم (يوزرنيم) *" value={editForm.username} onChange={v=>setEditForm({...editForm,username:v})} placeholder="ahmed123" />
              <Inp label="كلمة مرور جديدة (اتركه فارغ للإبقاء)" value={editForm.password_plain} onChange={v=>setEditForm({...editForm,password_plain:v})} placeholder="••••••••" />
              <Inp label="الاسم المعروض" value={editForm.display_name} onChange={v=>setEditForm({...editForm,display_name:v})} placeholder="أحمد محمد" />
              <Sel label="الدور الوظيفي" value={editForm.role} onChange={v=>setEditForm({...editForm,role:v})} options={Object.keys(ROLE_PRESETS).map(r=>({value:r,label:r}))} />
              <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
                <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>الشركة المرتبطة</label>
                <div style={{ display:"flex",alignItems:"center",gap:8,background:C.surface3,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 13px" }}>
                  <Ic d={I.shield} s={14} c={C.textMuted} />
                  <span style={{ fontSize:13,color:C.textMuted,flex:1 }}>{users.find(u=>u.id===editForm.owner_id)?.company_name || users.find(u=>u.id===editForm.owner_id)?.email || "—"}</span>
                  <span style={{ fontSize:10,color:C.textMuted,background:C.surface2,borderRadius:6,padding:"2px 8px",border:`1px solid ${C.border}` }}>ثابت</span>
                </div>
                <div style={{ fontSize:11,color:C.textMuted }}>لا يمكن تغيير الشركة المرتبطة بالموظف</div>
              </div>
            </div>

            <div style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:14,padding:16 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
                <span style={{ fontSize:13,fontWeight:700,color:C.text }}>الصفحات المسموح بها</span>
                <div style={{ display:"flex",gap:8 }}>
                  <button onClick={()=>setEditForm(p=>({...p,allowed_pages:ALL_PAGES.map(pg=>pg.id)}))} style={{ background:C.accentDim,color:C.accent,border:`1px solid ${C.accent}33`,borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>تحديد الكل</button>
                  <button onClick={()=>setEditForm(p=>({...p,allowed_pages:[]}))} style={{ background:C.redDim,color:C.red,border:`1px solid ${C.red}33`,borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>إلغاء الكل</button>
                </div>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8 }}>
                {ALL_PAGES.map(pg=>{
                  const checked = editForm.allowed_pages.includes(pg.id);
                  return (
                    <label key={pg.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:10,background:checked?C.accentDim:C.surface3,border:`1px solid ${checked?C.accent+"44":C.border}`,cursor:"pointer",transition:"all 0.15s" }}>
                      <input type="checkbox" checked={checked} onChange={e=>setEditForm(prev=>({
                        ...prev,
                        allowed_pages: e.target.checked ? [...prev.allowed_pages,pg.id] : prev.allowed_pages.filter(x=>x!==pg.id)
                      }))} style={{ accentColor:C.accent,width:14,height:14 }} />
                      <span style={{ fontSize:12,fontWeight:600,color:checked?C.accent:C.textMuted }}>{pg.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ background:C.surface2,border:`1px solid ${C.border}`,borderRadius:14,padding:16 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
                <span style={{ fontSize:13,fontWeight:700,color:C.text }}>الصفحات المسموح بالتعديل/الحذف الحساس فيها (تتطلب Passcode)</span>
                <div style={{ display:"flex",gap:8 }}>
                  <button onClick={()=>setEditForm(p=>({...p,sensitive_pages:SENSITIVE_PAGE_IDS}))} style={{ background:C.accentDim,color:C.accent,border:`1px solid ${C.accent}33`,borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>تحديد الكل</button>
                  <button onClick={()=>setEditForm(p=>({...p,sensitive_pages:[]}))} style={{ background:C.redDim,color:C.red,border:`1px solid ${C.red}33`,borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>إلغاء الكل</button>
                </div>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8 }}>
                {ALL_PAGES.filter(pg=>SENSITIVE_PAGE_IDS.includes(pg.id)).map(pg=>{
                  const checked = editForm.sensitive_pages.includes(pg.id);
                  return (
                    <label key={pg.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:10,background:checked?C.accentDim:C.surface3,border:`1px solid ${checked?C.accent+"44":C.border}`,cursor:"pointer",transition:"all 0.15s" }}>
                      <input type="checkbox" checked={checked} onChange={e=>setEditForm(prev=>({
                        ...prev,
                        sensitive_pages: e.target.checked ? [...prev.sensitive_pages,pg.id] : prev.sensitive_pages.filter(x=>x!==pg.id)
                      }))} style={{ accentColor:C.accent,width:14,height:14 }} />
                      <span style={{ fontSize:12,fontWeight:600,color:checked?C.accent:C.textMuted }}>{pg.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
              <Btn variant="ghost" onClick={()=>{setEditingSub(null);setEditForm(null);}}>إلغاء</Btn>
              <Btn variant="cyan" onClick={saveEditSub}><Ic d={I.edit} s={14} />حفظ التعديلات</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
export { AdminCompanyViewer };
