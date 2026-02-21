import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import clsx from "clsx";
import { LayoutDashboard, Bell, Users, Building2, Shield, Settings, LogOut, Menu, X, Zap, Moon, Sun, ChevronLeft, ChevronRight, Search } from "lucide-react";
// import { useAuth, useLogout } from "../../../features/auth/hooks";
import { useTheme } from "../../../context/ThemeContext";
import { useBFF } from "../../../features/bff_auth/context";
import { useLogout } from "../../../features/bff_auth/hooks";

export function DashboardLayout() {
  // const { user } = useAuth();
  // const { mutate: logout } = useLogout();
  const { user } = useBFF();
  const { mutate: logout } = useLogout();
  const { theme, setTheme } = useTheme();
  const location = useLocation();

  // State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile state
  const [isCollapsed, setIsCollapsed] = useState(false); // Desktop state

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  // Theme toggle function - toggles between light and dark only
  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Alerts", href: "/alerts", icon: Bell, badge: "3" },
    { name: "Citizens", href: "/citizens", icon: Users },
    { name: "Agencies", href: "/agencies", icon: Building2 },
    { name: "Users", href: "/users", icon: Shield },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex transition-colors duration-300">
      {/* --- Mobile Sidebar Overlay --- */}
      {isSidebarOpen && <div className="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm lg:hidden transition-opacity" onClick={() => setIsSidebarOpen(false)} />}

      {/* --- Sidebar Navigation --- */}
      <aside
        className={clsx("fixed lg:sticky top-0 z-50 h-screen bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 flex flex-col", {
          "w-64": !isCollapsed && !isSidebarOpen, // Standard Desktop
          "w-20": isCollapsed && !isSidebarOpen, // Collapsed Desktop
          "translate-x-0 w-64": isSidebarOpen, // Mobile Open
          "-translate-x-full lg:translate-x-0": !isSidebarOpen, // Mobile Closed / Desktop Reset
        })}
      >
        {/* Logo Area */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100 dark:border-gray-800">
          <div className={clsx("flex items-center gap-3 overflow-hidden transition-all", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900 dark:text-white tracking-tight">
              GEO<span className="text-emerald-600 dark:text-emerald-400">ALERT</span>
            </span>
          </div>

          {/* Mobile Close Button */}
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>

          {/* Desktop Collapse Toggle - Only show when not on mobile */}
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden lg:flex p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-gray-800 transition-colors">
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          {navigation.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                title={isCollapsed ? item.name : undefined}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
                  active ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200",
                )}
              >
                <item.icon className={clsx("w-5 h-5 flex-shrink-0 transition-colors", active ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 group-hover:text-gray-600 dark:text-gray-500")} />

                <span className={clsx("whitespace-nowrap transition-all duration-300 origin-left", isCollapsed ? "scale-0 w-0 opacity-0" : "scale-100 w-auto opacity-100")}>{item.name}</span>

                {/* Badge */}
                {item.badge && !isCollapsed && <span className="ml-auto bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 py-0.5 px-2 rounded-full text-xs font-semibold">{item.badge}</span>}
                {item.badge && isCollapsed && <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full" />}
              </Link>
            );
          })}
        </div>

        {/* Footer / User Profile */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          {/* Theme Toggle (Collapsed Mode) */}
          {isCollapsed && (
            <button onClick={cycleTheme} className="w-full flex justify-center p-2 mb-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          )}

          <div className={clsx("flex items-center gap-3", isCollapsed ? "justify-center" : "")}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 flex items-center justify-center text-white font-medium text-sm shadow-md ring-2 ring-white dark:ring-gray-800">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>

            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
              </div>
            )}

            {!isCollapsed && (
              <button onClick={() => logout()} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Logout">
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* --- Main Content Area --- */}
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">
              <Menu className="w-6 h-6" />
            </button>

            {/* Search Bar */}
            <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-900 rounded-xl w-64 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
              <Search className="w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search alerts, users..." className="bg-transparent border-none text-sm w-full focus:outline-none text-gray-700 dark:text-gray-200 placeholder:text-gray-400" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle (Desktop Header) */}
            <button onClick={cycleTheme} className="hidden sm:flex p-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Notifications */}
            <button className="relative p-2.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-950 animate-pulse" />
            </button>

            {/* Broadcast Button */}
            <button className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white font-medium text-sm hover:shadow-lg hover:shadow-emerald-500/20 active:scale-95 transition-all">
              <Zap className="w-4 h-4" />
              Broadcast
            </button>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto w-full animate-in fade-in duration-500 slide-in-from-bottom-2">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
