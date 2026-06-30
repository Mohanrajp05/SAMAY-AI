import { ReactNode, useState, useEffect } from "react";
import { motion } from "motion/react";
import { Home, Sparkles, CreditCard, ShieldAlert, MessageSquare, Settings as SettingsIcon, AlertCircle, Sun, Moon, LogOut, User as UserIcon, Mail } from "lucide-react";
import SamayLogo from "./SamayLogo";

interface LayoutProps {
  children: ReactNode;
  activeView: string;
  onNavigate: (view: string) => void;
  overdueCount: number;
  user?: any;
  userProfile?: any;
}

export default function Layout({
  children,
  activeView,
  onNavigate,
  overdueCount,
  user,
  userProfile,
}: LayoutProps) {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") return saved;
    }
    return "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
    } else {
      root.classList.remove("light");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileProfileMenu, setShowMobileProfileMenu] = useState(false);

  const getInitial = () => {
    const name = userProfile?.displayName || user?.displayName || userProfile?.email || user?.email || "";
    if (name) {
      const firstChar = name.trim().charAt(0);
      if (firstChar) return firstChar.toUpperCase();
    }
    return "U";
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white selection:bg-[#4F46E5]/30 pb-12">
      {/* Sticky Top Header with Integrated Navigation */}
      <header className="sticky top-0 w-full z-40 bg-[#0F0F0F]/90 backdrop-blur-md border-b border-[#2E2E2E] px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Logo & Mobile controls */}
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate("landing")}>
              <SamayLogo size={32} showText={true} textColor="text-[#2172CD]" textSize="text-sm font-extrabold tracking-tight" disableZoom={true} />
            </div>

            {/* Profile Avatar / Mock logout & Panic warning for Mobile */}
            <div className="flex items-center gap-2 md:hidden">
              {overdueCount > 0 && (
                <motion.div 
                  animate={{ scale: [1, 1.05, 1], opacity: [0.9, 1, 0.9] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  onClick={() => onNavigate("panic")}
                  className="bg-red-500/10 border border-red-500/30 text-red-500 font-mono text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded flex items-center gap-1 cursor-pointer"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  PANIC STATE
                </motion.div>
              )}
              {/* Theme Toggle Button for Mobile */}
              <button 
                onClick={toggleTheme}
                className="w-8 h-8 rounded-full bg-[#1A1A1A] border border-[#2E2E2E] flex items-center justify-center text-gray-300 hover:border-gray-500 active:scale-95 transition-all cursor-pointer"
                title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {theme === "dark" ? (
                  <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 hover:rotate-12" />
                ) : (
                  <Moon className="w-4 h-4 text-[#4F46E5] transition-transform duration-300 hover:rotate-12" />
                )}
              </button>
              <div className="relative">
                <button 
                  onClick={() => setShowMobileProfileMenu(!showMobileProfileMenu)}
                  className="w-8 h-8 rounded-full bg-[#1A1A1A] border border-[#2E2E2E] flex items-center justify-center font-mono text-xs text-gray-300 hover:border-gray-500 hover:bg-[#252525] active:scale-95 transition-all cursor-pointer overflow-hidden"
                >
                  {userProfile?.photoURL || user?.photoURL ? (
                    <img src={userProfile?.photoURL || user?.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    getInitial()
                  )}
                </button>
                
                {showMobileProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMobileProfileMenu(false)} />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      className="absolute right-0 mt-2 w-64 bg-[#161616] border border-[#2E2E2E] rounded-xl shadow-2xl p-4 z-50 text-left"
                    >
                      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-[#2E2E2E]">
                        <div className="w-10 h-10 rounded-full bg-[#1A1A1A] border border-[#2E2E2E] flex items-center justify-center font-mono text-sm text-gray-300 overflow-hidden shrink-0">
                          {userProfile?.photoURL || user?.photoURL ? (
                            <img src={userProfile?.photoURL || user?.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            getInitial()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {userProfile?.displayName || user?.displayName || "User"}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {userProfile?.email || user?.email || ""}
                          </p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          setShowMobileProfileMenu(false);
                          onNavigate("settings");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:text-white hover:bg-[#252525] rounded-lg transition-all text-left mb-1 cursor-pointer"
                      >
                        <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                        Configure Profile
                      </button>

                      <button
                        onClick={() => {
                          setShowMobileProfileMenu(false);
                          onNavigate("contact");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:text-white hover:bg-[#252525] rounded-lg transition-all text-left mb-1 cursor-pointer"
                      >
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        Contact Us
                      </button>
                      
                      <button
                        onClick={() => {
                          setShowMobileProfileMenu(false);
                          onNavigate("landing");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all text-left cursor-pointer font-medium"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Log Out
                      </button>
                    </motion.div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Bar */}
          <nav className="flex items-center justify-around md:justify-center md:gap-1 bg-[#1A1A1A]/90 md:bg-transparent border border-[#2E2E2E] md:border-0 p-1 md:p-0 rounded-xl w-full md:w-auto">
            {/* Dashboard */}
            <button 
              onClick={() => onNavigate("dashboard")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeView === "dashboard" ? "text-[#c3c0ff] bg-[#4F46E5]/15 font-bold" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Home className="w-4 h-4" />
              <span className="font-sans text-xs">Home</span>
            </button>

            {/* Briefing */}
            <button 
              onClick={() => onNavigate("briefing")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeView === "briefing" ? "text-[#c3c0ff] bg-[#4F46E5]/15 font-bold" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span className="font-sans text-xs">Briefing</span>
            </button>

            {/* Bills */}
            <button 
              onClick={() => onNavigate("bills")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeView === "bills" ? "text-[#c3c0ff] bg-[#4F46E5]/15 font-bold" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span className="font-sans text-xs">Bills</span>
            </button>

            {/* Panic Mode Button */}
            <button 
              onClick={() => onNavigate("panic")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all relative cursor-pointer ${
                activeView === "panic" ? "text-red-500 bg-red-500/10 font-bold" : "text-gray-400 hover:text-red-400"
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span className="font-sans text-xs">Panic</span>
              {overdueCount > 0 && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
              )}
            </button>

            {/* AI Chat */}
            <button 
              onClick={() => onNavigate("chat")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeView === "chat" ? "text-[#c3c0ff] bg-[#4F46E5]/15 font-bold" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span className="font-sans text-xs">Chat</span>
            </button>

            {/* Settings */}
            <button 
              onClick={() => onNavigate("settings")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeView === "settings" ? "text-[#c3c0ff] bg-[#4F46E5]/15 font-bold" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              <span className="font-sans text-xs">Config</span>
            </button>

            {/* Contact Us */}
            <button 
              onClick={() => onNavigate("contact")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeView === "contact" ? "text-[#c3c0ff] bg-[#4F46E5]/15 font-bold" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Mail className="w-4 h-4" />
              <span className="font-sans text-xs">Contact</span>
            </button>
          </nav>

          {/* Profile Avatar & Panic State for Desktop */}
          <div className="hidden md:flex items-center gap-2">
            {overdueCount > 0 && (
              <motion.div 
                animate={{ scale: [1, 1.05, 1], opacity: [0.9, 1, 0.9] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                onClick={() => onNavigate("panic")}
                className="bg-red-500/10 border border-red-500/30 text-red-500 font-mono text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded flex items-center gap-1 cursor-pointer"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                PANIC STATE
              </motion.div>
            )}

            {/* Theme Toggle Button for Desktop */}
            <button 
              onClick={toggleTheme}
              className="w-8 h-8 rounded-full bg-[#1A1A1A] border border-[#2E2E2E] flex items-center justify-center text-gray-300 hover:border-gray-500 active:scale-95 transition-all cursor-pointer"
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 hover:rotate-12" />
              ) : (
                <Moon className="w-4 h-4 text-[#4F46E5] transition-transform duration-300 hover:rotate-12" />
              )}
            </button>

            <div className="relative">
              <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-8 h-8 rounded-full bg-[#1A1A1A] border border-[#2E2E2E] flex items-center justify-center font-mono text-xs text-gray-300 hover:border-gray-500 hover:bg-[#252525] active:scale-95 transition-all cursor-pointer overflow-hidden"
              >
                {userProfile?.photoURL || user?.photoURL ? (
                  <img src={userProfile?.photoURL || user?.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  getInitial()
                )}
              </button>
              
              {showProfileMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="absolute right-0 mt-2 w-64 bg-[#161616] border border-[#2E2E2E] rounded-xl shadow-2xl p-4 z-50 text-left"
                  >
                    <div className="flex items-center gap-3 mb-3 pb-3 border-b border-[#2E2E2E]">
                      <div className="w-10 h-10 rounded-full bg-[#1A1A1A] border border-[#2E2E2E] flex items-center justify-center font-mono text-sm text-gray-300 overflow-hidden shrink-0">
                        {userProfile?.photoURL || user?.photoURL ? (
                          <img src={userProfile?.photoURL || user?.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          getInitial()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {userProfile?.displayName || user?.displayName || "User"}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {userProfile?.email || user?.email || ""}
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onNavigate("settings");
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:text-white hover:bg-[#252525] rounded-lg transition-all text-left mb-1 cursor-pointer"
                    >
                      <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                      Configure Profile
                    </button>

                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onNavigate("contact");
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:text-white hover:bg-[#252525] rounded-lg transition-all text-left mb-1 cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                      Contact Us
                    </button>
                    
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onNavigate("landing");
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all text-left cursor-pointer font-medium"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Log Out
                    </button>
                  </motion.div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Inner Screen Slot */}
      <main className="max-w-5xl mx-auto px-4 pt-6">
        {children}
      </main>
    </div>
  );
}
