import { useState, useEffect, useRef } from "react";
import { supabase, useAppData, C, I, Logo, ADMIN_EMAIL, ALL_PAGES, SUPERVISOR_TEMPLATE, showPermissionToast, setCachedPasscode, heartbeatSession, releaseSession } from "./shared";
import { LoginScreen, SetPasswordScreen, SubscriptionExpired } from "./LoginScreen";
import AdminPanel from "./AdminPanel";
import AppShell from "./AppShell";

// ══════════════════════════════════════════════════════════════════════════════
// App.jsx — نقطة الدخول: الاشتراك في Supabase Auth، فحص الاشتراك والصلاحيات،
// وتوجيه المستخدم لشاشة الدخول / لوحة الأدمن / التطبيق نفسه عبر AppShell.
// ══════════════════════════════════════════════════════════════════════════════

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("dash");
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [daysUntilExpiry, setDaysUntilExpiry] = useState(null); // null = no expiry set
  const [subUser, setSubUser] = useState(() => {
    // استرجاع جلسة الموظف بعد Refresh (سيسيون ستوريدج تتمسح لوحدها لو التاب اتقفل)
    try {
      const raw = sessionStorage.getItem("sub_user_session");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const lastAuthRef = useRef({ uid: null, email: null });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mustSetPassword, setMustSetPassword] = useState(false); // first-login password setup
  const [companyAllowedPages, setCompanyAllowedPages] = useState(null); // null = all pages allowed
  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = useState(5); // مدة الخروج التلقائي عند عدم النشاط (افتراضي 5 دقائق)

  // ── Auto-logout when tab is closed (not just hidden) ──
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Mark a timestamp when hidden, then on show check if it came back quickly
        sessionStorage.setItem("_tab_hidden_at", Date.now().toString());
      }
    };
    const handlePageHide = (e) => {
      // لا نعمل signOut لو الـ page مش بتتقفل فعلاً (مثلاً لما بنفتح popup للطباعة)
      // نتأكد إن الـ document فعلاً بيتحمل برا (visibilityState = hidden ومش persisted)
      if (!e.persisted && document.visibilityState !== "visible") {
        supabase.auth.signOut();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  // ── تسجيل خروج تلقائي عند عدم النشاط (بدون تحريك ماوس/تفاعل) لمدة محددة ──
  useEffect(() => {
    if (!userId && !subUser) return; // مفيش جلسة نشطة أصلاً
    let lastActivity = Date.now();
    const markActivity = () => { lastActivity = Date.now(); };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach(ev => window.addEventListener(ev, markActivity, { passive: true }));

    const intervalId = setInterval(() => {
      const idleMs = (idleTimeoutMinutes || 5) * 60 * 1000;
      if (Date.now() - lastActivity >= idleMs) {
        if (subUser) { setSubUser(null); setPage("dash"); }
        else if (userId) { supabase.auth.signOut(); }
      }
    }, 20000); // بنفحص كل 20 ثانية

    return () => {
      events.forEach(ev => window.removeEventListener(ev, markActivity));
      clearInterval(intervalId);
    };
  }, [userId, subUser, idleTimeoutMinutes]);

  // ── نبضة الجلسة الواحدة: تتأكد إن الجهاز ده لسه صاحب الجلسة النشطة، وتبلغ لو حد حاول يدخل من جهاز تاني ──
  const lastAttemptSeenRef = useRef(null);
  useEffect(() => {
    if (!userId && !subUser) return;
    const table = subUser ? "sub_users" : "profiles";
    const id = subUser ? subUser.id : userId;
    let mySessionId = null;
    try { mySessionId = localStorage.getItem("my_session_id"); } catch {}
    if (!mySessionId) return; // ملهوش جلسة متسجلة (مثلاً كان مسجل قبل ما الميزة دي تتفعّل)

    const intervalId = setInterval(async () => {
      const result = await heartbeatSession(table, id, mySessionId);
      if (!result.stillValid) {
        showPermissionToast("تم تسجيل الدخول لهذا الحساب من جهاز آخر، فتم إنهاء هذه الجلسة.", "error");
        if (subUser) { setSubUser(null); setPage("dash"); }
        else { supabase.auth.signOut(); }
        return;
      }
      if (result.loginAttemptAt && result.loginAttemptAt !== lastAttemptSeenRef.current) {
        lastAttemptSeenRef.current = result.loginAttemptAt;
        showPermissionToast("تمت محاولة تسجيل الدخول إلى هذا الحساب من جهاز آخر.", "error");
      }
    }, 10000);

    return () => clearInterval(intervalId);
  }, [userId, subUser]);

  // ─── Realtime: لو صلاحيات الموظف اتغيرت من لوحة التحكم، تتطبق فورًا من غير ما يحتاج يسجل دخول تاني ───
  useEffect(() => {
    if (!subUser) return;
    const channel = supabase
      .channel(`sub-user-${subUser.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sub_users", filter: `id=eq.${subUser.id}` }, (payload) => {
        if (payload.eventType === "DELETE" || payload.new?.is_active === false) {
          showPermissionToast("تم إلغاء تفعيل حسابك من قبل الإدارة.", "error");
          setSubUser(null); setPage("dash");
          try { sessionStorage.removeItem("sub_user_session"); } catch {}
          return;
        }
        if (payload.new) {
          setSubUser(payload.new);
          try { sessionStorage.setItem("sub_user_session", JSON.stringify(payload.new)); } catch {}
          showPermissionToast("تم تحديث صلاحياتك.", "success");
        }
      })
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch {} };
  }, [subUser?.id]);

  const checkSubscription = async (uid, retries = 2) => {
    if (!uid) return;
    try {
      const { data: profile, error } = await supabase.from("profiles").select("is_active, first_login, subscription_expires_at, allowed_pages, company_name, company_logo, idle_timeout_minutes, security_passcode").eq("id", uid).single();
      if (error) {
        // لو network error (offline)، نفضل على حالنا ومتعملش retry كتير
        if (error.message?.includes("Failed to fetch") || error.message?.includes("NetworkError") || error.message?.includes("DISCONNECTED")) {
          return; // نسيب الـ app يشتغل بدون قطع
        }
        if (retries > 0) {
          await new Promise(r => setTimeout(r, 1500));
          return checkSubscription(uid, retries - 1);
        }
        return;
      }
      if (!profile) return;
      let active = profile.is_active !== false;
      if (active && profile?.subscription_expires_at) {
        const expDate = new Date(profile.subscription_expires_at);
        if (expDate < new Date()) { active = false; setDaysUntilExpiry(0); }
        else {
          const days = Math.ceil((expDate - new Date()) / (1000*60*60*24));
          setDaysUntilExpiry(days);
        }
      } else { setDaysUntilExpiry(null); }
      setIsActive(active);
      if (profile?.first_login === true) setMustSetPassword(true);
      // Store company_name for sidebar & PDFs
      if (profile?.company_name) {
        try {
          sessionStorage.setItem("company_display_name", profile.company_name);
          localStorage.setItem("company_name_persist_" + uid, profile.company_name);
        } catch {}
      }
      // Store company_logo (from DB — works across any device/browser)
      try {
        if (profile?.company_logo) localStorage.setItem("company_logo_" + uid, profile.company_logo);
        else localStorage.removeItem("company_logo_" + uid);
      } catch {}
      // Store idle_timeout_minutes for auto-logout on inactivity (default 15 دقيقة)
      setIdleTimeoutMinutes(Number(profile?.idle_timeout_minutes) > 0 ? Number(profile.idle_timeout_minutes) : 15);
      // Store security passcode للتحقق منه قبل العمليات الحساسة (تعديل/حذف)
      setCachedPasscode(profile?.security_passcode || "");
      // Store uid for logo
      try {
        sessionStorage.setItem("company_uid", uid);
        localStorage.setItem("company_uid_persist", uid);
      } catch {}
      // Store allowed_pages for company in state (not sessionStorage)
      // اعتبر إن عندنا قيود لو الصفحات محددة وأقل من الكل
      if (Array.isArray(profile?.allowed_pages) && profile.allowed_pages.length < ALL_PAGES.length) {
        setCompanyAllowedPages(profile.allowed_pages);
        try { sessionStorage.setItem("company_allowed_pages", JSON.stringify(profile.allowed_pages)); } catch {}
        // إذا الصفحة الحالية مش ضمن الصفحات المسموحة، انتقل للأولى المتاحة
        setPage(prev => profile.allowed_pages.includes(prev) ? prev : (profile.allowed_pages[0] || "dash"));
      } else {
        // null أو كل الصفحات محددة = لا قيود
        setCompanyAllowedPages(null);
        try { sessionStorage.removeItem("company_allowed_pages"); } catch {}
      }
    } catch { /* network error - keep app running */ }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      const email = session?.user?.email ?? null;
      setUserId(uid); setUserEmail(email);
      if (uid) checkSubscription(uid);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      const email = session?.user?.email ?? null;
      lastAuthRef.current = { uid, email };
      setUserId(uid); setUserEmail(email);
      if (uid) {
        checkSubscription(uid);
        try { sessionStorage.setItem("company_uid", uid); } catch {}
      }
      if (!uid) { setSubUser(null); try { sessionStorage.removeItem("company_uid"); } catch {} }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(()=>{ document.title = 'حسابي Pro'; }, []);

  // For sub-users: we need to load data using the owner's userId
  const effectiveUserId = subUser ? subUser.owner_id : userId;
  const { data, loading, actions } = useAppData(effectiveUserId);

  // Sub-user login: sign in with owner account silently isn't possible,
  // so we load data from sub_users table directly using owner_id
  // But we need auth session for supabase RLS — so sub-users use the owner's data via owner_id
  // The sub_users table has owner_id; after sub-user validates, we need to load that owner's records
  // Solution: after sub-user login, sign in with owner's credentials isn't possible client-side
  // Instead: allow sub_users to access records with owner_id via RLS policy allowing select where owner_id = sub_user.owner_id
  // For now, we store owner_id and use it, but RLS may block — we bypass with anon key policy
  // The simplest working approach: keep the sub-user in state, use owner_id as userId for data hooks

  // Sub-users ماكانوش بيجيبوا بيانات الشركة (الاسم/الشعار/مدة الخروج التلقائي) لأنهم
  // مش بيعدوا على checkSubscription (مفيهمش Supabase Auth session). نجيبها يدوياً هنا.
  const fetchOwnerExtrasForSubUser = async (ownerId) => {
    try {
      const { data: profile } = await supabase.from("profiles").select("company_name, company_logo, idle_timeout_minutes, security_passcode").eq("id", ownerId).single();
      if (profile?.company_name) {
        try { sessionStorage.setItem("company_display_name", profile.company_name); localStorage.setItem("company_name_persist_" + ownerId, profile.company_name); } catch {}
      }
      try {
        if (profile?.company_logo) localStorage.setItem("company_logo_" + ownerId, profile.company_logo);
        else localStorage.removeItem("company_logo_" + ownerId);
      } catch {}
      setIdleTimeoutMinutes(Number(profile?.idle_timeout_minutes) > 0 ? Number(profile.idle_timeout_minutes) : 5);
      setCachedPasscode(profile?.security_passcode || "");
    } catch { /* keep defaults */ }
  };

  // لو الموظف كان مسجل دخول قبل الـ Refresh، نجيب بيانات الشركة تاني (بدل ما نستنى دخول جديد)
  useEffect(() => {
    if (subUser) fetchOwnerExtrasForSubUser(subUser.owner_id);
  }, []);

  // Handle sub-user login (called from LoginScreen)
  const handleSubUserLogin = (su) => {
    setSubUser(su);
    fetchOwnerExtrasForSubUser(su.owner_id);
    // Navigate to first allowed page
    const firstPage = su.allowed_pages?.[0] || "dash";
    setPage(firstPage);
  };

  const handleSubUserLogout = () => {
    try {
      const mySessionId = localStorage.getItem("my_session_id");
      if (subUser && mySessionId) releaseSession("sub_users", subUser.id, mySessionId);
      localStorage.removeItem("my_session_id");
      sessionStorage.removeItem("sub_user_session");
    } catch {}
    setSubUser(null);
    setPage("dash");
  };

  if (authLoading) {
    return (
      <div style={{ minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",color:C.text,fontFamily:"'Cairo','Segoe UI',sans-serif",flexDirection:"column",gap:16 }}>
        <Logo size={52} />
        <div style={{ fontSize:14,color:C.textMuted }}>جاري التحميل...</div>
      </div>
    );
  }

  // Sub-user is logged in (no supabase auth needed for display)
  if (subUser) {
    const allowedPages = subUser.allowed_pages || [];
    const perms = { canAdd: subUser.can_add, canDelete: subUser.can_delete, canEdit: subUser.can_edit };

    const navGroups = [
      { label:"الرئيسية", items:[{ id:"dash", label:"الرئيسية", icon:I.dash }] },
      { label:"المالية", items:[
        { id:"sales", label:"المبيعات", icon:I.sales },
        { id:"purchases", label:"المشتريات", icon:I.purchase },
        { id:"returns", label:"المرتجعات", icon:I.returns },
        { id:"revenue", label:"الإيرادات", icon:I.revenue },
        { id:"expenses", label:"المصروفات", icon:I.money },
        { id:"receipts", label:"المقبوضات", icon:I.money },
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
    ].map(g=>({...g, items: g.items.filter(it=>allowedPages.includes(it.id))})).filter(g=>g.items.length>0);

    // سجل المخزون متاح تلقائياً لأي مستخدم معاه صلاحية "إدارة المخزون"
    const invGroup = navGroups.find(g => g.items.some(it => it.id === "inventory"));
    if (invGroup && !invGroup.items.some(it => it.id === "inventorylog")) {
      invGroup.items.push({ id:"inventorylog", label:"سجل المخزون", icon:I.stocktake });
    }

    // سجل النشاط متاح للمشرف (Supervisor) بس — مش جزء من نظام allowed_pages العادي
    if (subUser.role_template === SUPERVISOR_TEMPLATE) {
      navGroups.push({ label:"الإدارة", items:[{ id:"activitylog", label:"سجل النشاط", icon:I.shield }] });
    }

    // Restrict actions based on permissions
    const restrictedActions = {
      ...actions,
      addSale: perms.canAdd ? actions.addSale : ()=>showPermissionToast("ليس لديك صلاحية الإضافة"),
      deleteSale: perms.canDelete ? actions.deleteSale : ()=>showPermissionToast("ليس لديك صلاحية الحذف", "error"),
      addPurchase: perms.canAdd ? actions.addPurchase : ()=>showPermissionToast("ليس لديك صلاحية الإضافة"),
      deletePurchase: perms.canDelete ? actions.deletePurchase : ()=>showPermissionToast("ليس لديك صلاحية الحذف", "error"),
      addReturn: perms.canAdd ? actions.addReturn : ()=>showPermissionToast("ليس لديك صلاحية الإضافة"),
      deleteReturn: perms.canDelete ? actions.deleteReturn : ()=>showPermissionToast("ليس لديك صلاحية الحذف", "error"),
      addClient: perms.canAdd ? actions.addClient : ()=>showPermissionToast("ليس لديك صلاحية الإضافة"),
      deleteClient: perms.canDelete ? actions.deleteClient : ()=>showPermissionToast("ليس لديك صلاحية الحذف", "error"),
      addSupplier: perms.canAdd ? actions.addSupplier : ()=>showPermissionToast("ليس لديك صلاحية الإضافة"),
      deleteSupplier: perms.canDelete ? actions.deleteSupplier : ()=>showPermissionToast("ليس لديك صلاحية الحذف", "error"),
      addInventoryItem: perms.canAdd ? actions.addInventoryItem : ()=>showPermissionToast("ليس لديك صلاحية الإضافة"),
      updateInventoryItem: perms.canEdit ? actions.updateInventoryItem : ()=>showPermissionToast("ليس لديك صلاحية التعديل"),
      deleteInventoryItem: perms.canDelete ? actions.deleteInventoryItem : ()=>showPermissionToast("ليس لديك صلاحية الحذف", "error"),
      addEmployee: perms.canAdd ? actions.addEmployee : ()=>showPermissionToast("ليس لديك صلاحية الإضافة"),
      updateEmployee: perms.canEdit ? actions.updateEmployee : ()=>showPermissionToast("ليس لديك صلاحية التعديل"),
      deleteEmployee: perms.canDelete ? actions.deleteEmployee : ()=>showPermissionToast("ليس لديك صلاحية الحذف", "error"),
      addSalary: perms.canAdd ? actions.addSalary : ()=>showPermissionToast("ليس لديك صلاحية الإضافة"),
      deleteSalary: perms.canDelete ? actions.deleteSalary : ()=>showPermissionToast("ليس لديك صلاحية الحذف", "error"),
      addAttendance: perms.canAdd ? actions.addAttendance : ()=>showPermissionToast("ليس لديك صلاحية الإضافة"),
      updateAttendance: perms.canEdit ? actions.updateAttendance : ()=>showPermissionToast("ليس لديك صلاحية التعديل"),
      deleteAttendance: perms.canDelete ? actions.deleteAttendance : ()=>showPermissionToast("ليس لديك صلاحية الحذف", "error"),
      addAdvance: perms.canAdd ? actions.addAdvance : ()=>showPermissionToast("ليس لديك صلاحية الإضافة"),
      updateAdvance: perms.canEdit ? actions.updateAdvance : ()=>showPermissionToast("ليس لديك صلاحية التعديل"),
      deleteAdvance: perms.canDelete ? actions.deleteAdvance : ()=>showPermissionToast("ليس لديك صلاحية الحذف", "error"),
      archiveSalaryMonth: perms.canAdd ? actions.archiveSalaryMonth : ()=>showPermissionToast("ليس لديك صلاحية الإضافة"),
      deleteSalaryArchive: perms.canDelete ? actions.deleteSalaryArchive : ()=>showPermissionToast("ليس لديك صلاحية الحذف", "error"),
      restoreSalaryArchive: perms.canEdit ? actions.restoreSalaryArchive : ()=>showPermissionToast("ليس لديك صلاحية التعديل"),
    };

    // سياق الصلاحيات الحساسة (Passcode): هل مسموح للموظف يحاول العملية دي أصلاً
    // على الصفحة دي (بعد الموافقة هيتطلب منه برضو إدخال الـ Passcode)
    const security = {
      isSubUser: true,
      canDoSensitive: (pageId, kind) => {
        if (kind === "edit" && !perms.canEdit) return false;
        if (kind === "delete" && !perms.canDelete) return false;
        if (Array.isArray(subUser.sensitive_pages) && !subUser.sensitive_pages.includes(pageId)) return false;
        return true;
      },
      userLabel: subUser.display_name || subUser.username,
      ownerId: subUser.owner_id,
      canViewAuditLog: subUser.role_template === SUPERVISOR_TEMPLATE,
      canViewInventoryLog: subUser.role_template === SUPERVISOR_TEMPLATE || (subUser.allowed_pages||[]).includes("inventory"),
    };

    return <AppShell page={page} setPage={setPage} navGroups={navGroups} data={data} actions={restrictedActions} loading={loading}
      userEmail={subUser.display_name||subUser.username} onLogout={handleSubUserLogout}
      roleBadge={<span style={{ background:C.purpleDim,color:C.purple,border:`1px solid ${C.purple}33`,borderRadius:20,padding:"2px 10px",fontSize:10,fontWeight:700 }}>{subUser.role}</span>}
      sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed}
      security={security}
    />;
  }

  if (!userId) return <LoginScreen onSubUserLogin={handleSubUserLogin} />;
  if (userEmail === ADMIN_EMAIL) return <AdminPanel />;
  if (mustSetPassword) return <SetPasswordScreen userId={userId} userEmail={userEmail} onDone={()=>{ setMustSetPassword(false); }} />;
  if (!isActive) return <SubscriptionExpired />;

  const ALL_NAV_GROUPS = [
    { label:"الرئيسية", items:[{ id:"dash", label:"الرئيسية", icon:I.dash }] },
    { label:"المالية", items:[
      { id:"sales", label:"المبيعات", icon:I.sales },
      { id:"purchases", label:"المشتريات", icon:I.purchase },
      { id:"returns", label:"المرتجعات", icon:I.returns },
      { id:"revenue", label:"الإيرادات", icon:I.revenue },
      { id:"expenses", label:"المصروفات", icon:I.money },
      { id:"receipts", label:"المقبوضات", icon:I.money },
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
    { label:"الإنتاج والموارد", items:[
      { id:"production", label:"تكلفة الإنتاج", icon:I.chartBar },
      { id:"employees", label:"الموظفين", icon:I.clients },
    ]},
    { label:"المخزون", items:[
      { id:"inventory", label:"إدارة المخزون", icon:I.inventory },
      { id:"inventorylog", label:"سجل المخزون", icon:I.stocktake },
      { id:"inventoryitems", label:"الأصناف", icon:I.box },
      { id:"categories", label:"الفئات", icon:I.categories },
    ]},
    { label:"الإعدادات", items:[
      { id:"settings", label:"إعدادات الشركة", icon:I.settings },
      { id:"activitylog", label:"سجل النشاط", icon:I.shield },
    ]},
  ];

  const navGroups = companyAllowedPages
    ? ALL_NAV_GROUPS.map(g=>({...g, items: g.items.filter(it=>it.id==="activitylog"||companyAllowedPages.includes(it.id))})).filter(g=>g.items.length>0)
    : ALL_NAV_GROUPS;

  // صاحب الحساب الأساسي: مسموح له بأي عملية حساسة طالما عارف الـ Passcode
  const ownerSecurity = { isSubUser: false, canDoSensitive: () => true, userLabel: userEmail, ownerId: userId, canViewAuditLog: true, canViewInventoryLog: true };

  return <AppShell page={page} setPage={setPage} navGroups={navGroups} data={data} actions={actions} loading={loading}
    userEmail={userEmail} userId={userId} onLogout={()=>{
      try {
        const mySessionId = localStorage.getItem("my_session_id");
        if (userId && mySessionId) releaseSession("profiles", userId, mySessionId);
        localStorage.removeItem("my_session_id");
      } catch {}
      supabase.auth.signOut();
    }}
    sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed}
    daysUntilExpiry={daysUntilExpiry}
    security={ownerSecurity}
  />;
}

// ─── APP SHELL (Sidebar + Content) ────────────────────────────────────────────
