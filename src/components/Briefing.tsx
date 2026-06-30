import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Sparkles, AlertTriangle, CheckCircle, RefreshCw, Play, Calendar, HelpCircle } from "lucide-react";
import { BriefingAlert, Task } from "../types";

interface BriefingProps {
  tasks: Task[];
  onStartSession: (taskName: string) => void;
  onNavigate: (view: string) => void;
  userProfile?: any;
}

export default function Briefing({ tasks, onStartSession, onNavigate, userProfile }: BriefingProps) {
  const [alerts, setAlerts] = useState<BriefingAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const incompleteTasks = (tasks || [])
    .filter((t) => !t.completed)
    .sort((a, b) => {
      const dateA = a.dueDate + "T" + (a.time || "00:00");
      const dateB = b.dueDate + "T" + (b.time || "00:00");
      return dateA.localeCompare(dateB);
    });

  function formatTime(t: string | undefined): string {
    if (!t) return "12:00 PM";
    const [hourStr, minStr] = t.split(":");
    const hour = parseInt(hourStr);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minStr} ${ampm}`;
  }

  const priorityColors = [
    { border: "border-[#EF4444] bg-[#EF4444]/10", dot: "bg-[#EF4444]" },
    { border: "border-[#F59E0B] bg-[#F59E0B]/10", dot: "bg-[#F59E0B]" },
    { border: "border-[#22C55E] bg-[#22C55E]/10", dot: "bg-[#22C55E]" },
  ];

  const atRiskTask = incompleteTasks[0];
  let riskText = "";
  if (atRiskTask) {
    const dueMs = new Date(atRiskTask.dueDate).getTime();
    const diffMs = dueMs - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      riskText = `${atRiskTask.name} — OVERDUE by ${Math.abs(diffDays)} day(s)!`;
    } else if (diffDays === 0) {
      riskText = `${atRiskTask.name} — DUE TODAY!`;
    } else {
      riskText = `${atRiskTask.name} — ${diffDays} day(s) left, not started`;
    }
  }

  const fetchBriefing = async () => {
    setLoading(true);
    setError(null);
    try {
      const nameParam = userProfile?.displayName ? encodeURIComponent(userProfile.displayName) : "";
      const uid = userProfile?.uid || "";
      const res = await fetch(`/api/ai/briefing-report?name=${nameParam}&userId=${uid}`);
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          if (data && data.alerts) {
            setAlerts(data.alerts);
            return;
          }
        }
      }
      throw new Error(`Invalid response content or status code: ${res.status}`);
    } catch (err) {
      console.warn("Could not fetch daily briefing from server, using built-in fallback alerts:", err);
      setError("System is busy, please try again in a few seconds");
      
      const defaultAlerts = [];
      if (incompleteTasks.length > 0) {
        defaultAlerts.push({
          id: "1",
          type: "warning" as const,
          boldText: `${incompleteTasks[0].name} needs action`,
          message: ` — Due by ${incompleteTasks[0].dueDate}. Start it soon.`
        });
      } else {
        defaultAlerts.push({
          id: "1",
          type: "success" as const,
          boldText: "All tasks are complete!",
          message: " You are fully caught up today."
        });
      }

      if (incompleteTasks.length > 1) {
        defaultAlerts.push({
          id: "2",
          type: "info" as const,
          boldText: `${incompleteTasks[1].name} is on track`,
          message: ` — Scheduled for ${incompleteTasks[1].dueDate}`
        });
      }

      setAlerts(defaultAlerts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
  }, [tasks]);

  return (
    <div id="briefing-view" className="space-y-6 max-w-5xl mx-auto">
      <section className="flex justify-between items-center px-1">
        <div>
          <h2 className="font-sans font-extrabold text-2xl text-[#c3c0ff] tracking-tight">Today's Briefing 🧠</h2>
          <p className="font-mono text-[10px] text-gray-500 font-semibold uppercase tracking-wider mt-1">Wednesday, June 25 • SamayAI</p>
        </div>
        <button 
          onClick={fetchBriefing}
          disabled={loading}
          className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-800 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#4F46E5]' : ''}`} />
        </button>
      </section>

      {/* Grid Layout for Desktop */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Column: Morning Report & Patterns */}
        <div className="space-y-6 md:col-span-6">
          {/* Gemini Morning Report Card */}
          <section className="bg-[#1A1A1A] border border-[#2E2E2E] border-l-4 border-l-[#4F46E5] p-5 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#c3c0ff] fill-[#c3c0ff]" />
                Gemini Morning Report
              </h2>
            </div>

            {error && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs rounded-lg flex items-center gap-2.5 font-sans">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="space-y-3 py-2">
                <div className="h-10 bg-gray-800 rounded animate-pulse w-full"></div>
                <div className="h-10 bg-gray-800 rounded animate-pulse w-5/6"></div>
                <div className="h-10 bg-gray-800 rounded animate-pulse w-11/12"></div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {alerts.map((alert, idx) => (
                  <div 
                    key={alert.id || idx}
                    className="flex items-start gap-2.5 p-3 bg-[#0F0F0F] rounded border border-[#2E2E2E]/30"
                  >
                    {alert.type === "warning" && <AlertTriangle className="text-[#EF4444] w-4 h-4 mt-0.5 shrink-0" />}
                    {alert.type === "success" && <CheckCircle className="text-[#22C55E] w-4 h-4 mt-0.5 shrink-0" />}
                    {alert.type === "info" && <AlertTriangle className="text-[#F59E0B] w-4 h-4 mt-0.5 shrink-0" />}
                    
                    <p className="text-xs text-white leading-relaxed">
                      <span className={`font-bold ${
                        alert.type === "warning" ? "text-[#EF4444]" : 
                        alert.type === "success" ? "text-[#22C55E]" : "text-[#F59E0B]"
                      }`}>
                        {alert.boldText}
                      </span>
                      {alert.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Weekly Pattern Card */}
          <section className="bg-[#1A1A1A] border border-[#2E2E2E] p-5 rounded-xl space-y-4">
            <h2 className="font-mono text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <span className="text-xs">🧠</span>
              This Week's Pattern
            </h2>
            <div className="relative p-4 bg-[#1C1B1B] rounded italic border-l-2 border-[#2E2E2E]">
              <span className="font-serif absolute -top-2 left-1.5 text-gray-600/40 text-4xl font-black">“</span>
              <p className="text-gray-400 text-sm leading-relaxed pl-3 relative z-10 font-sans">
                "Your SamayAI insights show you work best Tuesday 3PM. Avoid Monday mornings for coding tasks."
              </p>
            </div>
          </section>
        </div>

        {/* Right Column: Priority Order & At Risk */}
        <div className="space-y-6 md:col-span-6">
          {/* Today's Priority Order */}
          <section className="bg-[#1A1A1A] border border-[#2E2E2E] p-5 rounded-xl space-y-4">
            <h2 className="font-mono text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <span className="text-xs">🔢</span>
              Today's Priority Order
            </h2>

            <div className="flex flex-col gap-1.5">
              {incompleteTasks.length === 0 ? (
                <div className="p-4 bg-[#1C1B1B]/40 border border-[#2E2E2E]/40 rounded text-center">
                  <p className="text-gray-500 font-sans text-sm">🎉 No pending tasks for today!</p>
                </div>
              ) : (
                incompleteTasks.slice(0, 3).map((task, idx) => {
                  const colors = priorityColors[idx % priorityColors.length];
                  return (
                    <div key={task.id} className="flex gap-4 group">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full border-2 ${colors.border} flex items-center justify-center text-xs font-mono font-bold text-white`}>
                          {idx + 1}
                        </div>
                        {idx < Math.min(incompleteTasks.length, 3) - 1 && (
                          <div className="w-[1.5px] h-6 bg-[#2E2E2E]"></div>
                        )}
                      </div>
                      <div className="flex-1 p-3 bg-[#1C1B1B] border border-[#2E2E2E] rounded flex justify-between items-center group-hover:border-[#4F46E5] transition-colors">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${colors.dot}`}></span>
                          <span className="text-white font-sans text-sm font-semibold">{task.name}</span>
                        </div>
                        <span className="text-gray-500 font-mono text-[10px]">{formatTime(task.time)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* At Risk Card */}
          {atRiskTask ? (
            <motion.section 
              animate={{ scale: [1, 1.01, 1] }}
              transition={{ repeat: Infinity, duration: 3 }}
              className="bg-[#1A1A1A] border border-[#2E2E2E] border-l-4 border-l-[#F59E0B] p-5 rounded-xl space-y-4"
            >
              <h2 className="font-mono text-xs font-bold text-[#F59E0B] uppercase tracking-widest flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                At Risk
              </h2>
              <div className="space-y-4">
                <p className="text-white text-sm font-semibold leading-tight">
                  {riskText}
                </p>
                <div className="flex flex-col gap-2.5">
                  <button 
                    onClick={() => onStartSession(atRiskTask.name)}
                    className="w-full py-3 bg-[#4F46E5] text-white font-mono text-xs font-bold uppercase tracking-wider rounded border border-[#4F46E5] active:scale-95 hover:brightness-110 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white text-white" />
                    Start 30-min Session
                  </button>
                  <button 
                    onClick={() => onNavigate("dashboard")}
                    className="w-full py-3 bg-transparent text-[#F59E0B] font-mono text-xs font-bold uppercase tracking-wider rounded border border-[#F59E0B] active:scale-95 hover:bg-[#F59E0B]/10 transition-all cursor-pointer"
                  >
                    Reschedule Now
                  </button>
                </div>
              </div>
            </motion.section>
          ) : (
            <section className="bg-[#1A1A1A] border border-[#2E2E2E] border-l-4 border-l-[#22C55E] p-5 rounded-xl space-y-4">
              <h2 className="font-mono text-xs font-bold text-[#22C55E] uppercase tracking-widest flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-[#22C55E]" />
                At Risk
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                🎉 All tasks are complete! No scheduling conflicts or overdue alerts detected.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
