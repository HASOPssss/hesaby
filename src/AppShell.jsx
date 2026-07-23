import { C, Ic, I, Logo, useTheme, PermissionToastProvider } from "./shared";
import { Dashboard, AccountStatement, InventoryPage, InventoryItemsPage, CategoriesPage, CompanySettingsPage, ReceiptsPage, ExpensesPage } from "./Pages";
import InvoicesPage from "./InvoicesPage";
import UnifiedReportsPage from "./UnifiedReportsPage";
import TaxReportsPage from "./TaxReportsPage";
import ProductionCostPage from "./ProductionCostPage";
import EmployeesPage from "./EmployeesPage";
import ActivityLogPage from "./ActivityLogPage";
import ReturnsPage from "./ReturnsPage";
import RevenuePage from "./RevenuePage";
import TaxInvoicesPage from "./TaxInvoicesPage";

// ══════════════════════════════════════════════════════════════════════════════
// AppShell.jsx — الهيكل العام: السايدبار + التنقل بين الصفحات + رندر الصفحة
// الحالية. ملف منفصل (مش جوه App.jsx) عشان AdminPanel.jsx يقدر يستخدمه برضو
// من غير ما يعمل دائرة استيراد (circular import) مع App.jsx.
// ══════════════════════════════════════════════════════════════════════════════

// ─── APP SHELL (Sidebar + Content) ────────────────────────────────────────────
function AppShell({ page, setPage, navGroups, data, actions, loading, userEmail, userId, onLogout, roleBadge, sidebarCollapsed, setSidebarCollapsed, daysUntilExpiry, security }) {
  const W = sidebarCollapsed ? 68 : 230;
  const [theme, setThemeState] = useTheme();
  // Get company name for sidebar display
  const sidebarCompanyName = (() => { try { return sessionStorage.getItem("company_display_name") || "حسابي Pro"; } catch { return "حسابي Pro"; } })();

  // Guard: if current page not in navGroups, redirect to first allowed page
  const allAllowedIds = navGroups.flatMap(g=>g.items.map(it=>it.id));
  const effectivePage = allAllowedIds.length > 0 && !allAllowedIds.includes(page)
    ? allAllowedIds[0]
    : page;

  const renderPage = () => {
    switch (effectivePage) {
      case "dash": return <Dashboard data={data} daysUntilExpiry={daysUntilExpiry} inventory={data.inventory} />;
      case "sales": return <InvoicesPage title="فواتير المبيعات" invoices={data.salesInvoices} type="sales" clients={data.clients} suppliers={data.suppliers} categories={data.categories} onAdd={actions.addSale} onUpdate={actions.updateSale} onDelete={actions.deleteSale} onAddClient={actions.addClient} userEmail={userEmail} inventory={data.inventory} onAddInventoryItem={actions.addInventoryItem} onUpdateInventoryItem={actions.updateInventoryItem} security={security} pageId="sales" />;
      case "purchases": return <InvoicesPage title="فواتير المشتريات" invoices={data.purchaseInvoices} type="purchases" clients={data.clients} suppliers={data.suppliers} categories={data.categories} onAdd={actions.addPurchase} onUpdate={actions.updatePurchase} onDelete={actions.deletePurchase} onAddSupplier={actions.addSupplier} userEmail={userEmail} inventory={data.inventory} onAddInventoryItem={actions.addInventoryItem} onUpdateInventoryItem={actions.updateInventoryItem} security={security} pageId="purchases" />;
      case "clients": return <AccountStatement parties={data.clients} invoices={data.salesInvoices} type="client" onAddParty={actions.addClient} onDeleteParty={actions.deleteClient} security={security} pageId="clients" userEmail={userEmail} />;
      case "suppliers": return <AccountStatement parties={data.suppliers} invoices={data.purchaseInvoices} type="supplier" onAddParty={actions.addSupplier} onDeleteParty={actions.deleteSupplier} security={security} pageId="suppliers" userEmail={userEmail} />;
      case "returns": return <ReturnsPage returns={data.returns} salesInvoices={data.salesInvoices} purchaseInvoices={data.purchaseInvoices} clients={data.clients} suppliers={data.suppliers} onAdd={actions.addReturn} onDelete={actions.deleteReturn} theme={theme} />;
      case "revenue": return <RevenuePage data={data} onDeleteMonth={actions.deleteMonth} userEmail={userEmail} theme={theme} />;
      case "reports": return <UnifiedReportsPage data={data} userEmail={userEmail} security={security} pageId="reports" />;
      case "taxreports": return <TaxReportsPage data={data} />;
      case "taxinvoices": return <TaxInvoicesPage salesInvoices={data.salesInvoices} purchaseInvoices={data.purchaseInvoices} theme={theme} />;
      case "expenses": return <ExpensesPage userId={userId||""} security={security} pageId="expenses" userEmail={userEmail} />;
      case "receipts": return <ReceiptsPage userId={userId||""} security={security} pageId="receipts" userEmail={userEmail} />;
      case "production": return <ProductionCostPage data={data} actions={actions} />;
      case "employees": return <EmployeesPage userId={userId||""} security={security} pageId="employees" userEmail={userEmail} />;
      case "inventory": return <InventoryPage inventory={data.inventory} categories={data.categories} onAdd={actions.addInventoryItem} onEdit={actions.updateInventoryItem} onDelete={actions.deleteInventoryItem} onBulkAdd={actions.bulkAddInventory} userEmail={userEmail} userId={userId} security={security} pageId="inventory" />;
      case "inventoryitems": return <InventoryItemsPage inventory={data.inventory} categories={data.categories} />;
      case "categories": return <CategoriesPage categories={data.categories} onAdd={actions.addCategory} onDelete={actions.deleteCategory} />;
      case "settings": return <CompanySettingsPage userId={userId} userEmail={userEmail} companyName={(() => { try { return localStorage.getItem("company_name_persist_"+(userId||"")) || sessionStorage.getItem("company_display_name") || ""; } catch { return ""; } })()} isSubUser={security?.isSubUser} />;
      case "activitylog": return <ActivityLogPage userId={userId} security={security} />;
      default: return <Dashboard data={data} daysUntilExpiry={daysUntilExpiry} inventory={data.inventory} />;
    }
  };

  return (
    <div style={{ minHeight:"100vh",background:C.bg,fontFamily:"'Cairo','Segoe UI',sans-serif",display:"flex",direction:"rtl" }}>
      <PermissionToastProvider />
      {/* ── Sidebar ── */}
      <div style={{
        width:W, background:C.surface, borderLeft:`1px solid ${C.border}`,
        display:"flex", flexDirection:"column", position:"fixed", top:0, right:0,
        height:"100vh", zIndex:100, transition:"width 0.25s cubic-bezier(0.4,0,0.2,1)",
        overflow:"hidden",
      }}>
        {/* Logo area */}
        <div style={{ padding:"16px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10,minHeight:70,flexShrink:0 }}>
          <div style={{ flexShrink:0 }}><Logo size={36} /></div>
          {!sidebarCollapsed && (
            <div style={{ overflow:"hidden",flex:1 }}>
              <div style={{ fontSize:15,fontWeight:800,color:C.text,letterSpacing:-0.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{sidebarCompanyName}</div>
              <div style={{ fontSize:10,color:C.textMuted,marginTop:1,whiteSpace:"nowrap" }}>حسابي Pro</div>
            </div>
          )}
          <button onClick={()=>setSidebarCollapsed(p=>!p)} style={{
            background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,cursor:"pointer",
            color:C.textMuted,padding:5,display:"flex",flexShrink:0,marginRight:"auto",transition:"all 0.2s",
          }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {sidebarCollapsed ? <path d="M9 18l6-6-6-6"/> : <path d="M15 18l-6-6 6-6"/>}
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex:1,overflowY:"auto",overflowX:"hidden",padding:"10px 6px",scrollbarWidth:"thin",scrollbarColor:`${C.border} transparent` }}>
          <style>{`
            nav::-webkit-scrollbar{width:4px}
            nav::-webkit-scrollbar-track{background:transparent}
            nav::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}
            nav::-webkit-scrollbar-thumb:hover{background:${C.borderLight}}
          `}</style>
          {navGroups.map(group=>(
            <div key={group.label} style={{ marginBottom:sidebarCollapsed?8:14 }}>
              {!sidebarCollapsed && (
                <div style={{ padding:"0 10px",fontSize:9,fontWeight:800,color:C.textMuted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:5,whiteSpace:"nowrap",opacity:0.7 }}>{group.label}</div>
              )}
              {sidebarCollapsed && <div style={{ height:1,background:C.border,margin:"4px 6px 6px" }} />}
              {group.items.map(item=>{
                const active = effectivePage===item.id;
                return (
                  <button key={item.id} onClick={()=>setPage(item.id)} title={sidebarCollapsed?item.label:""} style={{
                    width:"100%",display:"flex",alignItems:"center",gap:sidebarCollapsed?0:10,
                    padding:sidebarCollapsed?"10px 0":"9px 12px",borderRadius:11,border:"none",cursor:"pointer",
                    fontFamily:"inherit",fontSize:12.5,fontWeight:600,textAlign:"right",marginBottom:2,
                    transition:"all 0.15s",justifyContent:sidebarCollapsed?"center":"flex-start",
                    background:active?C.accentDim:"transparent",
                    color:active?C.accent:C.textMuted,
                    borderRight:active?`3px solid ${C.accent}`:"3px solid transparent",
                    position:"relative",
                  }}>
                    <Ic d={item.icon} s={15} c={active?C.accent:C.textMuted} />
                    {!sidebarCollapsed && <span style={{ whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{item.label}</span>}
                    {active && !sidebarCollapsed && (
                      <div style={{ position:"absolute",left:8,width:6,height:6,borderRadius:"50%",background:C.accent,boxShadow:`0 0 6px ${C.accent}` }} />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding:"10px 6px",borderTop:`1px solid ${C.border}`,flexShrink:0 }}>
          {loading && !sidebarCollapsed && (
            <div style={{ fontSize:10,color:C.textMuted,textAlign:"center",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:5 }}>
              <div style={{ width:5,height:5,borderRadius:"50%",background:C.accent }} />
              مزامنة...
            </div>
          )}
          {/* User card */}
          <div style={{ padding:sidebarCollapsed?"8px 0":"8px 10px",marginBottom:6,borderRadius:10,background:C.surface2,display:"flex",alignItems:"center",gap:8,justifyContent:sidebarCollapsed?"center":"flex-start" }}>
            <div style={{ width:30,height:30,borderRadius:"50%",background:C.accentDim,border:`2px solid ${C.accent}33`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
              <span style={{ fontSize:12,fontWeight:800,color:C.accent }}>{userEmail?.[0]?.toUpperCase()}</span>
            </div>
            {!sidebarCollapsed && (
              <div style={{ overflow:"hidden",flex:1 }}>
                <div style={{ fontSize:11,color:C.text,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{userEmail}</div>
                {roleBadge && <div style={{ marginTop:3 }}>{roleBadge}</div>}
              </div>
            )}
          </div>
          <button onClick={onLogout} title={sidebarCollapsed?"تسجيل الخروج":""} style={{
            width:"100%",display:"flex",alignItems:"center",gap:sidebarCollapsed?0:8,
            padding:sidebarCollapsed?"9px 0":"9px 12px",borderRadius:10,border:`1px solid ${C.red}33`,
            cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:600,
            background:C.redDim,color:C.red,transition:"all 0.2s",justifyContent:sidebarCollapsed?"center":"flex-start",
          }}>
            <Ic d={I.logout} s={14} c={C.red} />
            {!sidebarCollapsed && "تسجيل الخروج"}
          </button>
          {/* Theme toggle */}
          <button onClick={()=>{ const t = theme==="dark"?"light":"dark"; setThemeState(t); }}
            title={sidebarCollapsed?(theme==="dark"?"وضع النهار":"الوضع الليلي"):""}
            style={{ marginTop:6, width:"100%",display:"flex",alignItems:"center",gap:sidebarCollapsed?0:8, padding:sidebarCollapsed?"9px 0":"9px 12px",borderRadius:10,border:`1px solid ${C.border}`, cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:600, background:C.surface2,color:C.textDim,transition:"all 0.2s",justifyContent:sidebarCollapsed?"center":"flex-start" }}>
            <span style={{ fontSize:14 }}>{theme==="dark"?"☀️":"🌙"}</span>
            {!sidebarCollapsed && (theme==="dark" ? "وضع النهار" : "الوضع الليلي")}
          </button>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex:1,marginRight:W,padding:"28px 30px",minHeight:"100vh",overflowY:"auto",transition:"margin-right 0.25s cubic-bezier(0.4,0,0.2,1)",scrollbarWidth:"thin",scrollbarColor:`${C.border} transparent` }}>
        <style>{`
          *::-webkit-scrollbar{width:4px;height:4px}
          *::-webkit-scrollbar-track{background:transparent}
          *::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}
          *::-webkit-scrollbar-thumb:hover{background:${C.borderLight}}
          *{scrollbar-width:thin;scrollbar-color:${C.border} transparent}
        `}</style>
        {renderPage()}
      </div>
    </div>
  );
}

export default AppShell;
