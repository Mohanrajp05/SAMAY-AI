import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Terminal, AlertTriangle, Play, RefreshCw, Cpu, VolumeX, Flame, Trash2 } from "lucide-react";
import { Task, AIScheduleItem } from "../types";

interface PanicModeProps {
  tasks: Task[];
  onToggleTask: (id: string) => void;
  onSnoozeTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onReoptimize: () => void;
  onNavigate: (view: string) => void;
  activeSessionTask?: string | null;
  onClearActiveSession?: () => void;
}

export default function PanicMode({
  tasks,
  onToggleTask,
  onSnoozeTask,
  onDeleteTask,
  onReoptimize,
  onNavigate,
  activeSessionTask,
  onClearActiveSession,
}: PanicModeProps) {
  const [deepFocusActive, setDeepFocusActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(1800); // 30 minutes
  const [loadingReoptimize, setLoadingReoptimize] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Filter overdue tasks
  const overdueTasks = tasks.filter((t) => !t.completed);

  useEffect(() => {
    if (activeSessionTask) {
      setDeepFocusActive(true);
      setTimerSeconds(1800);
    }
  }, [activeSessionTask]);

  // Focus Countdown logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (deepFocusActive && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      setDeepFocusActive(false);
      setNotification("Deep Focus Session Completed! Systems returned to optimal load.");
      setTimerSeconds(1800);
      if (onClearActiveSession) onClearActiveSession();
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [deepFocusActive, timerSeconds]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleReoptimize = async () => {
    setLoadingReoptimize(true);
    // Simulate smart recalculation API call
    setTimeout(() => {
      onReoptimize();
      setLoadingReoptimize(false);
      setNotification("AI Neural Engine: Re-scheduled active penalties into optimized study windows.");
    }, 1200);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div id="panic-mode-view" className="space-y-6 max-w-5xl mx-auto selection:bg-red-500/30">
      {/* Toast Notification */}
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 bg-[#EF4444] text-white font-sans text-xs font-bold px-4 py-2.5 rounded-lg shadow-xl border border-red-500/30 z-50 flex items-center gap-2"
        >
          <Cpu className="w-3.5 h-3.5 text-white animate-spin" />
          {notification}
        </motion.div>
      )}

      {/* Custom Title Header */}
      <section className="flex justify-between items-center px-1">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (onClearActiveSession) onClearActiveSession();
              onNavigate("dashboard");
            }}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-[#2E2E2E] hover:bg-gray-800 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-red-500" />
          </button>
          <div className="flex items-center gap-1.5">
            <Terminal className="w-5 h-5 text-[#EF4444]" />
            <h1 className="font-sans font-black text-xl text-[#EF4444] tracking-tighter uppercase">PANIC MODE</h1>
          </div>
        </div>
      </section>

      {/* Critical Overload Banner */}
      <motion.div
        animate={{ backgroundColor: ["#EF4444", "#93000a", "#EF4444"] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="p-3 rounded-lg flex items-center justify-center gap-2 border-b border-[#690005]"
      >
        <AlertTriangle className="text-white w-4 h-4 animate-bounce" />
        <span className="font-mono text-xs font-black text-white uppercase tracking-widest">
          CRITICAL OVERLOAD: {overdueTasks.length} OVERDUE TASKS
        </span>
      </motion.div>

      {/* Responsive Grid Layout for Desktop */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Column: System Penalties & Active focus session */}
        <div className="space-y-6 md:col-span-7 lg:col-span-8">
          {/* Deep Focus Timer Panel */}
          {deepFocusActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#EF4444]/10 border border-[#EF4444]/40 p-6 rounded-xl text-center space-y-4 shadow-lg shadow-red-900/20"
            >
              <Flame className="w-8 h-8 text-red-500 mx-auto animate-bounce fill-red-500" />
              <h3 className="font-sans font-bold text-xl text-white">DEEP FOCUS ACTIVE</h3>
              <p className="text-gray-400 text-xs uppercase tracking-widest font-mono">DND Active • Socials Locked • System Muted</p>
              <div className="text-4xl font-mono font-black text-white tracking-widest py-2 bg-black/40 rounded-lg max-w-[180px] mx-auto">
                {formatTime(timerSeconds)}
              </div>
              <button
                onClick={() => {
                  setDeepFocusActive(false);
                  setTimerSeconds(1800);
                  setNotification("Deep Focus Session Aborted.");
                  if (onClearActiveSession) onClearActiveSession();
                }}
                className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500/10 text-xs font-mono uppercase font-bold rounded cursor-pointer"
              >
                Abort Session
              </button>
            </motion.div>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-sans font-bold text-base uppercase tracking-widest text-[#EF4444]">System Penalties</h2>
              <span className="font-mono text-[10px] text-gray-400 border border-gray-800 px-2 py-0.5 uppercase">Urgency: Critical</span>
            </div>

            <div className="space-y-3">
              {overdueTasks.length === 0 ? (
                <div className="text-center p-8 bg-[#1A1A1A] border border-[#2E2E2E] rounded-xl text-gray-400 font-sans">
                  🎉 No active system penalties! All tasks completed.
                </div>
              ) : (
                overdueTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-gradient-to-r from-red-500/10 to-[#1A1A1A] border border-[#2E2E2E] border-l-4 border-l-[#EF4444] p-5 rounded-xl flex flex-col gap-4 group hover:bg-gray-800/20 transition-all duration-300"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-mono text-[10px] text-red-500 uppercase font-bold tracking-tight">
                          {task.hoursLate ?? 0} {task.hoursLate === 1 ? "hour" : "hours"} late
                        </span>
                        <h3 className="font-sans font-bold text-lg text-white group-hover:text-red-400 transition-colors truncate">{task.name}</h3>
                      </div>
                      <button
                        onClick={() => {
                          onDeleteTask(task.id);
                          setNotification(`Successfully deleted task: ${task.name}`);
                        }}
                        className="p-1.5 rounded text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                        title="Delete task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex gap-2 w-full">
                      <button
                        onClick={() => {
                          onToggleTask(task.id);
                          setNotification(`Successfully triaged task: ${task.name}!`);
                        }}
                        className="flex-1 bg-[#4F46E5] hover:bg-[#4338ca] text-white font-mono text-[10px] font-bold py-2.5 uppercase tracking-wider active:scale-95 transition-transform rounded cursor-pointer"
                      >
                        Triage Now
                      </button>
                      <button
                        onClick={() => {
                          onSnoozeTask(task.id);
                          setNotification(`Snoozed ${task.name} for 1 hour.`);
                        }}
                        className="flex-1 border border-gray-800 hover:bg-[#1A1A1A] text-gray-400 font-mono text-[10px] font-bold py-2.5 uppercase tracking-wider active:scale-95 transition-transform rounded cursor-pointer"
                      >
                        Snooze 1hr
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Protocol Assets & widgets */}
        <div className="space-y-6 md:col-span-5 lg:col-span-4">
          <section className="space-y-4">
            <h2 className="font-sans font-bold text-base uppercase tracking-widest text-[#4F46E5] px-1">Protocol Assets</h2>

            <div className="flex flex-col gap-4">
              {/* Tool 1 */}
              <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-5 rounded-xl space-y-4">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-[#4F46E5]/10 border border-[#4F46E5]/20 rounded-lg text-[#4F46E5]">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-sans font-bold text-sm text-white uppercase tracking-tight">The Neural Engine</h4>
                    <p className="text-gray-400 text-xs mt-1 leading-normal">
                      Auto-reschedules everything to find a gap. Uses predictive load balancing.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleReoptimize}
                  disabled={loadingReoptimize}
                  className="w-full bg-[#4F46E5] text-white font-mono text-xs font-bold py-3 uppercase tracking-wider rounded active:scale-95 hover:brightness-110 transition-transform cursor-pointer flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingReoptimize ? 'animate-spin' : ''}`} />
                  Re-optimize Schedule
                </button>
              </div>

              {/* Tool 2 */}
              <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-5 rounded-xl space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-red-600 text-white text-[8px] font-black uppercase tracking-widest py-1 px-3 rotate-45 translate-x-3 translate-y-1 shadow">
                  Nuclear
                </div>
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
                    <VolumeX className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-sans font-bold text-sm text-white uppercase tracking-tight">Silence the World</h4>
                    <p className="text-gray-400 text-xs mt-1 leading-normal">
                      Toggles DND, blocks socials, and activates hardware-level focus locking.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setDeepFocusActive(true);
                    setTimerSeconds(1800);
                    setNotification("Deep Focus Protocol Activated! 30-minute lockdown begins.");
                  }}
                  disabled={deepFocusActive}
                  className="w-full bg-[#EF4444] text-white font-mono text-xs font-bold py-3 uppercase tracking-wider rounded active:scale-95 hover:brightness-110 transition-transform cursor-pointer"
                >
                  {deepFocusActive ? "Deep Focus Running..." : "Activate Deep Focus"}
                </button>
              </div>

              {/* Status Micro-Widget */}
              <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-4 rounded-xl flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] uppercase text-gray-500">Core Temp</span>
                  <span className="font-mono text-[10px] text-red-500 font-bold uppercase tracking-wider">CRITICAL</span>
                </div>
                <div className="w-full bg-[#0F0F0F] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#EF4444] h-full" style={{ width: "94%" }}></div>
                </div>
              </div>

              {/* Atmospheric Widget */}
              <div className="relative h-44 border border-[#2E2E2E] bg-black rounded-xl overflow-hidden flex flex-col items-center justify-center text-center p-5">
                <AlertTriangle className="text-red-500 w-8 h-8 mb-2 animate-pulse" />
                <p className="font-mono text-xs text-red-500 uppercase tracking-widest font-black">System Load: 98%</p>
                <p className="font-mono text-[10px] text-gray-600 uppercase tracking-wider mt-1">Powered by SamayAI</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
