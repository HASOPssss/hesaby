import { useState } from "react";
import { supabase, C, Ic, I, Logo, Card, useTheme, claimSession } from "./shared";

// ══════════════════════════════════════════════════════════════════════════════
// LoginScreen.jsx — شاشات الدخول: تسجيل الدخول، تعيين كلمة مرور أول مرة، وشاشة
// انتهاء الاشتراك.
// ══════════════════════════════════════════════════════════════════════════════

function SubscriptionExpired() {
  return (
    <div style={{ minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Cairo','Segoe UI',sans-serif",direction:"rtl" }}>
      <div style={{ background:C.surface,border:`2px solid ${C.red}33`,borderRadius:24,padding:"48px 52px",width:"min(440px,90vw)",display:"flex",flexDirection:"column",alignItems:"center",gap:22,textAlign:"center",boxShadow:`0 0 60px ${C.red}11` }}>
        <div style={{ width:80,height:80,borderRadius:"50%",background:C.redDim,border:`2px solid ${C.red}44`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 0 30px ${C.red}22` }}>
          <Ic d={I.alert} s={36} c={C.red} />
        </div>
        <div>
          <div style={{ fontSize:24,fontWeight:800,color:C.text,marginBottom:12,letterSpacing:-0.5 }}>انتهت مدة الاشتراك</div>
          <div style={{ fontSize:13,color:C.textMuted,lineHeight:2 }}>عذراً، انتهت صلاحية حسابك<br/>يرجى التواصل مع الإدارة لتجديد الاشتراك</div>
        </div>
        <button onClick={()=>supabase.auth.signOut()} style={{ background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:10,padding:"10px 28px",fontSize:13,fontWeight:700,color:C.red,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s" }}>تسجيل الخروج</button>
      </div>
    </div>
  );
}

// ─── SET PASSWORD SCREEN (first login) ───────────────────────────────────────
function SetPasswordScreen({ userId, userEmail, onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4 : 3;
  const strengthLabel = ["","ضعيفة جداً","ضعيفة","متوسطة","قوية"];
  const strengthColor = [C.border, C.red, C.yellow, C.blue, C.green];

  const handleSet = async () => {
    if (password.length < 6) { setErr("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
    if (password !== confirm) { setErr("كلمتا المرور غير متطابقتين"); return; }
    setLoading(true); setErr("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { setErr(error.message); setLoading(false); return; }
      // Clear first_login flag
      await supabase.from("profiles").update({ first_login: false, temp_password: null }).eq("id", userId);
      onDone();
    } catch(e) { setErr(e.message); }
    setLoading(false);
  };

  const inp = { background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 14px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box" };

  return (
    <div style={{ minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Cairo','Segoe UI',sans-serif",direction:"rtl" }}>
      <div style={{ background:C.surface,border:`2px solid ${C.accent}33`,borderRadius:24,padding:"44px 48px",width:"min(440px,90vw)",display:"flex",flexDirection:"column",gap:22,boxShadow:`0 0 80px ${C.accent}11` }}>
        {/* Header */}
        <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:14,textAlign:"center" }}>
          <div style={{ width:72,height:72,borderRadius:"50%",background:C.accentDim,border:`2px solid ${C.accent}44`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 0 30px ${C.accent}22` }}>
            <Ic d={I.shield} s={34} c={C.accent} />
          </div>
          <div>
            <div style={{ fontSize:22,fontWeight:800,color:C.text,marginBottom:8,letterSpacing:-0.5 }}>مرحباً بك في حسابي Pro 👋</div>
            <div style={{ fontSize:13,color:C.textMuted,lineHeight:1.9 }}>
              هذه أول مرة تدخل فيها على حسابك<br/>
              <span style={{ color:C.accent,fontWeight:700 }}>{userEmail}</span><br/>
              يرجى تعيين كلمة مرور خاصة بك للمتابعة
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height:1,background:C.border }} />

        {/* Form */}
        <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>كلمة المرور الجديدة *</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={inp} />
            {/* Strength bar */}
            {password.length > 0 && (
              <div style={{ display:"flex",alignItems:"center",gap:10,marginTop:4 }}>
                <div style={{ flex:1,height:4,borderRadius:4,background:C.surface3,overflow:"hidden" }}>
                  <div style={{ width:`${(strength/4)*100}%`,height:"100%",background:strengthColor[strength],borderRadius:4,transition:"all 0.3s" }} />
                </div>
                <span style={{ fontSize:11,color:strengthColor[strength],fontWeight:700,minWidth:70 }}>{strengthLabel[strength]}</span>
              </div>
            )}
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            <label style={{ fontSize:12,color:C.textDim,fontWeight:600 }}>تأكيد كلمة المرور *</label>
            <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&handleSet()}
              style={{ ...inp, borderColor: confirm && confirm !== password ? C.red : confirm && confirm === password ? C.green : C.border }} />
            {confirm && confirm !== password && <div style={{ fontSize:11,color:C.red,marginTop:2 }}>كلمتا المرور غير متطابقتين</div>}
            {confirm && confirm === password && password.length >= 6 && <div style={{ fontSize:11,color:C.green,marginTop:2 }}>✓ متطابقتان</div>}
          </div>

          {err && <div style={{ background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:10,padding:"10px 14px",fontSize:12,color:C.red }}>{err}</div>}

          <button onClick={handleSet} disabled={loading||!password||!confirm||password!==confirm}
            style={{ background:loading||!password||!confirm||password!==confirm?C.surface2:C.accent,color:loading||!password||!confirm||password!==confirm?C.textMuted:"#fff",border:"none",borderRadius:12,padding:"13px 0",fontSize:14,fontWeight:800,cursor:loading||!password||!confirm||password!==confirm?"not-allowed":"pointer",fontFamily:"inherit",transition:"all 0.2s",boxShadow:!loading&&password&&confirm&&password===password?`0 4px 20px ${C.accent}33`:"none" }}>
            {loading ? "جاري الحفظ..." : "تعيين كلمة المرور والدخول →"}
          </button>
        </div>

        <div style={{ textAlign:"center",fontSize:11,color:C.textMuted }}>
          🔒 كلمة المرور مشفرة ولن يستطيع أحد رؤيتها
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({ onSubUserLogin }) {
  const [theme, setThemeState] = useTheme();
  const [mode, setMode] = useState("company");
  const lastEmail = (() => { try { return localStorage.getItem("last_login_email")||""; } catch { return ""; } })();
  const [form, setForm] = useState({ email: lastEmail, password:"" });
  const [empForm, setEmpForm] = useState({ username:"", password:"" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!form.email || !form.password) { setErr("أدخل البريد الإلكتروني وكلمة المرور"); return; }
    setErr(""); setLoading(true);
    try {
      // Save last email
      try { localStorage.setItem("last_login_email", form.email); } catch {}
      // First attempt: normal login with entered password
      const { data, error } = await supabase.auth.signInWithPassword({ email:form.email.toLowerCase().trim(), password:form.password });
      if (!error) {
        const uid = data?.user?.id;
        if (uid) {
          const claim = await claimSession("profiles", uid);
          if (!claim.allowed) {
            await supabase.auth.signOut();
            setErr("هذا الحساب قيد الاستخدام على جهاز آخر.");
            setLoading(false);
            return;
          }
          try { sessionStorage.setItem("my_session_id", claim.sessionId); } catch {}
        }
        setLoading(false); return;
      }

      // If failed, check if this is a first-login account (use temp_password)
      if (error.message.includes("Invalid login credentials")) {
        const { data: profileData } = await supabase
          .from("profiles").select("first_login, temp_password").eq("email", form.email.toLowerCase().trim()).single();
        if (profileData?.first_login && profileData?.temp_password) {
          // Try with temp password (admin-set password)
          const { data: data2, error: err2 } = await supabase.auth.signInWithPassword({ email:form.email.toLowerCase().trim(), password:profileData.temp_password });
          if (!err2) {
            const uid2 = data2?.user?.id;
            if (uid2) {
              const claim2 = await claimSession("profiles", uid2);
              if (!claim2.allowed) {
                await supabase.auth.signOut();
                setErr("هذا الحساب قيد الاستخدام على جهاز آخر.");
                setLoading(false);
                return;
              }
              try { sessionStorage.setItem("my_session_id", claim2.sessionId); } catch {}
            }
            setLoading(false); return;
          } // success — App will detect first_login and show SetPasswordScreen
        }
        setErr("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      } else if (error.message.includes("Email not confirmed")) {
        setErr("الحساب لم يتم تفعيله — تواصل مع المسؤول");
      } else {
        setErr(error.message);
      }
    } catch(e){ setErr(e.message); }
    setLoading(false);
  };

  const handleEmployeeLogin = async () => {
    if (!empForm.username || !empForm.password) { setErr("أدخل اسم المستخدم وكلمة المرور"); return; }
    setErr(""); setLoading(true);
    try {
      const { data: subUsers, error } = await supabase
        .from("sub_users").select("*").ilike("username", empForm.username.trim());
      if (error) { setErr("حدث خطأ في الاتصال"); setLoading(false); return; }
      if (!subUsers || subUsers.length === 0) { setErr("اسم المستخدم غير موجود"); setLoading(false); return; }
      const su = subUsers[0];
      if (su.password_plain !== empForm.password) { setErr("كلمة المرور غير صحيحة"); setLoading(false); return; }
      if (!su.is_active) { setErr("هذا الحساب معطّل، تواصل مع المسؤول"); setLoading(false); return; }
      const claim = await claimSession("sub_users", su.id, (() => { try { return sessionStorage.getItem("my_session_id"); } catch { return null; } })());
      if (!claim.allowed) { setErr("هذا الحساب قيد الاستخدام على جهاز آخر."); setLoading(false); return; }
      try { sessionStorage.setItem("my_session_id", claim.sessionId); } catch {}
      onSubUserLogin(su);
    } catch(e){ setErr(e.message); }
    setLoading(false);
  };

  const inp = {
    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10,
    padding: "11px 14px", color: C.text, fontSize: 13, fontFamily: "inherit",
    outline: "none", width: "100%", boxSizing: "border-box", transition: "border-color 0.2s",
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"'Cairo','Segoe UI',sans-serif", direction:"rtl", position:"relative", overflow:"hidden" }}>

      {/* ── Theme Toggle ── */}
      <div style={{ position:"fixed", top:18, left:18, zIndex:200 }}>
        <button onClick={()=>{ const t = theme==="dark"?"light":"dark"; setThemeState(t); }}
          style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"8px 14px", cursor:"pointer", color:C.textDim, fontSize:12, fontWeight:700, fontFamily:"inherit", display:"flex", alignItems:"center", gap:6 }}>
          {theme==="dark" ? "☀️ وضع النهار" : "🌙 الوضع الليلي"}
        </button>
      </div>

      {/* ── Glows ── */}
      <div style={{ position:"absolute",top:-100,right:-60,width:480,height:480,borderRadius:"50%",background:`radial-gradient(circle, ${C.accentGlow} 0%, transparent 65%)`,pointerEvents:"none" }} />
      <div style={{ position:"absolute",bottom:-60,left:-60,width:320,height:320,borderRadius:"50%",background:`radial-gradient(circle, ${C.greenDim} 0%, transparent 70%)`,pointerEvents:"none" }} />
      <div style={{ position:"absolute",top:"35%",left:"15%",width:180,height:180,borderRadius:"50%",background:`radial-gradient(circle, ${C.purpleDim} 0%, transparent 70%)`,pointerEvents:"none" }} />

      {/* ── Card ── */}
      <div style={{ background:C.surface, border:`1px solid ${C.borderLight}`, borderRadius:28, padding:"44px 48px", width:"min(440px,92vw)", display:"flex", flexDirection:"column", position:"relative", zIndex:1, boxShadow:`0 40px 100px rgba(0,0,0,0.4), 0 0 0 1px ${C.accent}0a` }}>

        {/* Logo & title */}
        <div style={{ textAlign:"center", marginBottom:30 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", marginBottom:16 }}>
            <Logo size={100} />
          </div>
          <div style={{ fontSize:26, fontWeight:800, color:C.text, letterSpacing:-0.5, marginBottom:6 }}>حسابي Pro</div>
          <div style={{ fontSize:12, color:C.textMuted, lineHeight:1.7 }}>نظام محاسبة متكامل للشركات والمصانع</div>
        </div>

        {/* ── Mode selector ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:26 }}>
          {[
            { id:"company",  icon:"🏢", title:"حساب الشركة",  sub:"دخول بالإيميل" },
            { id:"employee", icon:"👤", title:"دخول موظف",    sub:"باليوزرنيم" },
          ].map(m => {
            const active = mode === m.id;
            return (
              <button key={m.id} onClick={()=>{ setMode(m.id); setErr(""); }} style={{
                display:"flex", flexDirection:"column", alignItems:"center", gap:6,
                padding:"16px 12px", borderRadius:16,
                border:`1.5px solid ${active ? C.accent : C.border}`,
                background: active ? C.accentDim : C.surface2,
                boxShadow: active ? `0 0 0 1px ${C.accent}33, 0 6px 24px ${C.accent}14` : "none",
                cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s",
              }}>
                <span style={{ fontSize:22, lineHeight:1 }}>{m.icon}</span>
                <span style={{ fontSize:13, fontWeight:700, color: active ? C.accent : C.textDim, marginTop:2 }}>{m.title}</span>
                <span style={{ fontSize:10, color: active ? `${C.accent}88` : C.textMuted, fontWeight:500 }}>{m.sub}</span>
              </button>
            );
          })}
        </div>

        {/* Error */}
        {err && (
          <div style={{ background:C.redDim, border:`1px solid ${C.red}33`, borderRadius:10, padding:"10px 14px", fontSize:12, color:C.red, textAlign:"center", marginBottom:14 }}>
            {err}
          </div>
        )}

        {/* ── Company form ── */}
        {mode === "company" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              <label style={{ fontSize:11, color:C.textMuted, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase" }}>البريد الإلكتروني</label>
              <input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} type="email"
                placeholder="example@company.com" style={inp}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border} />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              <label style={{ fontSize:11, color:C.textMuted, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase" }}>كلمة المرور</label>
              <input type="password" placeholder="••••••••" value={form.password}
                onChange={e=>setForm({...form,password:e.target.value})}
                onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                style={{...inp, direction:"ltr", textAlign:"right"}}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border} />
            </div>
            <button onClick={handleLogin} disabled={loading} style={{
              marginTop:4, padding:"13px", border:"none", borderRadius:12,
              background: loading ? C.surface2 : `linear-gradient(135deg, ${C.accent}, #818cf8)`,
              color: loading ? C.textMuted : "#fff",
              fontSize:14, fontWeight:700, cursor: loading ? "not-allowed" : "pointer",
              fontFamily:"inherit", boxShadow: loading ? "none" : `0 8px 28px ${C.accent}44`,
              transition:"all 0.2s",
            }}>
              {loading ? "جاري تسجيل الدخول..." : "دخول"}
            </button>
          </div>
        )}

        {/* ── Employee form ── */}
        {mode === "employee" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              <label style={{ fontSize:11, color:C.textMuted, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase" }}>اسم المستخدم</label>
              <input value={empForm.username} onChange={e=>setEmpForm({...empForm,username:e.target.value})}
                placeholder="ahmed_sales"
                style={{...inp, direction:"ltr", textAlign:"right"}}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border} />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              <label style={{ fontSize:11, color:C.textMuted, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase" }}>كلمة المرور</label>
              <input type="password" placeholder="••••••••" value={empForm.password}
                onChange={e=>setEmpForm({...empForm,password:e.target.value})}
                onKeyDown={e=>e.key==="Enter"&&handleEmployeeLogin()}
                style={{...inp, direction:"ltr", textAlign:"right"}}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border} />
            </div>
            <button onClick={handleEmployeeLogin} disabled={loading} style={{
              marginTop:4, padding:"13px", border:"none", borderRadius:12,
              background: loading ? C.surface2 : `linear-gradient(135deg, ${C.green}, #10b981)`,
              color: loading ? C.textMuted : "#fff",
              fontSize:14, fontWeight:700, cursor: loading ? "not-allowed" : "pointer",
              fontFamily:"inherit", boxShadow: loading ? "none" : `0 8px 28px rgba(52,211,153,0.4)`,
              transition:"all 0.2s",
            }}>
              {loading ? "جاري التحقق..." : "دخول كموظف"}
            </button>
          </div>
        )}

        <div style={{ textAlign:"center", fontSize:11, color:C.textMuted, borderTop:`1px solid ${C.border}`, paddingTop:16, marginTop:24 }}>
          للحصول على حساب، تواصل مع الإدارة
        </div>
      </div>
    </div>
  );
}

export { SubscriptionExpired, SetPasswordScreen, LoginScreen };
