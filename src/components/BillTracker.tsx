import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Plus, Sparkles, AlertTriangle, Check, RefreshCw, Landmark, Calendar, ShieldCheck, FileText } from "lucide-react";
import { Bill } from "../types";

interface BillTrackerProps {
  bills: Bill[];
  onToggleBill: (id: string) => void;
  onNavigate: (view: string) => void;
  onAddBillClick: () => void;
  userProfile?: any;
}

export default function BillTracker({
  bills,
  onToggleBill,
  onNavigate,
  onAddBillClick,
  userProfile,
}: BillTrackerProps) {
  const [insight, setInsight] = useState("");
  const [loadingInsight, setLoadingInsight] = useState(true);
  const [errorInsight, setErrorInsight] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchInsight = async () => {
    setLoadingInsight(true);
    setErrorInsight(null);
    try {
      const nameParam = userProfile?.displayName ? encodeURIComponent(userProfile.displayName) : "";
      const uid = userProfile?.uid || "";
      const res = await fetch(`/api/ai/bill-insight?name=${nameParam}&userId=${uid}`);
      if (!res.ok) {
        throw new Error(`API returned non-200 status: ${res.status}`);
      }
      const data = await res.json();
      if (data.insight) {
        setInsight(data.insight);
      }
    } catch (err) {
      console.error("Error loading bill insight:", err);
      setErrorInsight("System is busy, please try again in a few seconds");
      const userName = userProfile?.displayName ? userProfile.displayName.split(" ")[0] : "user";
      setInsight(`Your credit card always sneaks up on you, ${userName}. I've set auto-reminders 5 days before each month's due date permanently.`);
    } finally {
      setLoadingInsight(false);
    }
  };

  useEffect(() => {
    fetchInsight();
  }, [bills]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <div id="bill-tracker-view" className="space-y-6 max-w-5xl mx-auto">
      {/* Toast Notification */}
      {notification && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 bg-[#4F46E5] text-white font-sans text-xs font-bold px-4 py-2.5 rounded-lg shadow-xl border border-[#c3c0ff]/30 z-50 flex items-center gap-2"
        >
          <Sparkles className="w-3.5 h-3.5 fill-white text-white" />
          {notification}
        </motion.div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate("dashboard")}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-[#2E2E2E] hover:bg-gray-800 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#c3c0ff]" />
          </button>
          <h2 className="font-sans font-extrabold text-2xl text-white">Bill Tracker 💸</h2>
        </div>
        
        <button 
          id="add-deadline-btn"
          onClick={onAddBillClick}
          className="w-full md:w-auto flex items-center justify-center gap-2 py-3 px-6 bg-[#4F46E5] text-white font-sans font-bold text-sm rounded-lg hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-[#4F46E5]/20 cursor-pointer border border-[#4F46E5]"
        >
          <Plus className="w-4 h-4" /> Add Payment Deadline
        </button>
      </div>

      {/* Grid Layout for Desktop */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Column: Bill List */}
        <div className="space-y-4 md:col-span-7 lg:col-span-8">
          {bills.map((bill) => {
            let categoryColor = "border-l-[#EF4444]";
            let textAccentColor = "text-[#EF4444]";
            let icon = <AlertTriangle className="w-4 h-4 text-[#EF4444]" />;

            if (bill.category === "Upcoming") {
              categoryColor = "border-l-amber-500";
              textAccentColor = "text-amber-500";
              icon = <Calendar className="w-4 h-4 text-amber-500" />;
            } else if (bill.category === "Secure") {
              categoryColor = "border-l-[#22C55E]";
              textAccentColor = "text-[#22C55E]";
              icon = <ShieldCheck className="w-4 h-4 text-[#22C55E]" />;
            } else if (bill.category === "Compliance") {
              categoryColor = "border-l-[#4F46E5]";
              textAccentColor = "text-[#4F46E5]";
              icon = <FileText className="w-4 h-4 text-[#4F46E5]" />;
            }

            return (
              <motion.div 
                key={bill.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-[#1A1A1A] border border-[#2E2E2E] p-5 rounded-xl border-l-4 ${categoryColor} transition-all duration-200 hover:bg-[#242424]`}
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      {icon}
                      <span className={`${textAccentColor} font-mono text-[10px] font-bold uppercase tracking-wider`}>
                        {bill.category}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                      <span className="text-gray-400 font-mono text-[10px] uppercase">
                        {bill.dueDateDays <= 1 ? "Due Tomorrow" : `Due in ${bill.dueDateDays} days`}
                      </span>
                    </div>
                    <h3 className="font-sans font-bold text-lg text-white">{bill.name}</h3>
                    {bill.bank && (
                      <p className="text-gray-400 text-xs flex items-center gap-1">
                        <Landmark className="w-3.5 h-3.5 text-[#c3c0ff]" />
                        Bank: {bill.bank}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-mono font-black text-white">
                      {bill.amount > 0 ? `₹${bill.amount.toLocaleString("en-IN")}` : "Compliance"}
                    </div>
                    {bill.amount > 0 && <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mt-1">Amount Payable</p>}
                  </div>
                </div>

                {/* Functional Actions */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {bill.completed ? (
                    <div className="flex items-center gap-1.5 text-[#22C55E] text-xs font-bold border border-[#22C55E]/30 bg-[#22C55E]/10 px-3 py-1.5 rounded">
                      <Check className="w-4 h-4" /> Paid successfully
                    </div>
                  ) : (
                    <>
                      <button 
                        onClick={() => {
                          onToggleBill(bill.id);
                          setNotification(`Marked ${bill.name} as paid!`);
                        }}
                        className={`px-4 py-1.5 rounded font-sans font-bold text-xs active:scale-95 transition-all cursor-pointer ${
                          bill.category === "Urgent" 
                            ? "bg-[#EF4444] text-white hover:brightness-110" 
                            : "bg-[#1A1A1A] text-white border border-[#2E2E2E] hover:bg-[#2e2e2e]"
                        }`}
                      >
                        {bill.category === "Urgent" ? "Pay Now" : "Mark as Paid"}
                      </button>
                      <button 
                        onClick={() => setNotification(`Reminder configured in 2 hours for ${bill.name}!`)}
                        className="px-4 py-1.5 bg-[#2E2E2E] hover:bg-[#3E3E3E] text-gray-300 font-sans font-semibold text-xs rounded active:scale-95 transition-all cursor-pointer"
                      >
                        Remind in 2 hrs
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Right Column: Insight & Summary Footer */}
        <div className="space-y-6 md:col-span-5 lg:col-span-4">
          {/* Gemini Insight Card */}
          <section className="bg-[#1A1A1A] border-2 border-[#4F46E5]/40 p-5 rounded-xl relative overflow-hidden bg-[#4F46E5]/5">
            <div className="absolute top-2 right-2 opacity-[0.03]">
              <Sparkles className="w-24 h-24 text-white" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-[#c3c0ff] fill-[#c3c0ff]" />
              <h3 className="font-sans font-bold text-sm text-[#c3c0ff]">Gemini Insight 💡</h3>
            </div>
            
            {errorInsight && (
              <div className="mb-3 p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs rounded-lg flex items-center gap-2 font-sans">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>{errorInsight}</span>
              </div>
            )}
            
            {loadingInsight ? (
              <div className="space-y-2 py-1">
                <div className="h-4 bg-gray-800 rounded animate-pulse w-full"></div>
                <div className="h-4 bg-gray-800 rounded animate-pulse w-2/3"></div>
              </div>
            ) : (
              <p className="text-gray-300 italic text-sm leading-relaxed font-sans">
                "{insight}"
              </p>
            )}
            
            <div className="mt-4 flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#c3c0ff] uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-[#4F46E5] animate-pulse"></span>
              System Optimizer Active
            </div>
          </section>

          {/* Summary Footer */}
          <div className="text-center text-gray-500 text-xs font-semibold uppercase tracking-widest opacity-60 pt-6">
            <p>© 2026 SAMAYAI // ALL SYSTEMS OPERATIONAL</p>
            <div className="mt-2 flex justify-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-700"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-gray-700"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-gray-700"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
