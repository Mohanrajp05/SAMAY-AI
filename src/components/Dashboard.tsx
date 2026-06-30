import { motion } from "motion/react";
import { Terminal, Bell, Play, Check, Flame, ChevronRight, AlertTriangle, HelpCircle, Laptop, Trash2 } from "lucide-react";
import { Task, Bill, AIScheduleItem } from "../types";

interface DashboardProps {
  tasks: Task[];
  bills: Bill[];
  schedule: AIScheduleItem[];
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onNavigate: (view: string) => void;
  onStartSession: (taskName: string) => void;
  userProfile?: any;
  tasksLoading?: boolean;
  tasksError?: string | null;
}

export default function Dashboard({
  tasks,
  bills,
  schedule,
  onToggleTask,
  onDeleteTask,
  onNavigate,
  onStartSession,
  userProfile,
  tasksLoading,
  tasksError,
}: DashboardProps) {
  if (tasksLoading) {
    return (
      <div id="dashboard-loading" className="flex flex-col items-center justify-center py-32 gap-4 text-white">
        <div className="w-10 h-10 rounded-full border-t-2 border-[#4F46E5] animate-spin"></div>
        <p className="font-mono text-xs text-gray-500 uppercase tracking-widest">Loading secure task ledger...</p>
      </div>
    );
  }

  if (tasksError) {
    return (
      <div id="dashboard-error" className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 text-center max-w-md mx-auto my-12">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
        <h4 className="font-sans font-bold text-lg text-white mb-1">Ledger Connection Failed</h4>
        <p className="font-mono text-xs text-red-500/80 mb-4">{tasksError}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-sans font-bold text-xs rounded-lg transition-all"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  // Get the urgent task if it's not completed
  const urgentTask = tasks.find((t) => !t.completed && (t.name === "DSA Assignment" || t.difficulty === "Hard" || t.overdue));

  // Date format
  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Time format helper for schedule display
  const formatTime = (time24: string) => {
    try {
      const [hoursStr, minutesStr] = time24.split(":");
      let hours = parseInt(hoursStr);
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      if (hours === 0) hours = 12;
      return `${hours}:${minutesStr} ${ampm}`;
    } catch (e) {
      return time24;
    }
  };

  // Convert "9:00 AM" or "14:30" to raw minutes for sorting
  const parseTimeToMinutes = (timeStr: string) => {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) {
      const match24 = timeStr.match(/(\d+):(\d+)/);
      if (match24) {
        return parseInt(match24[1]) * 60 + parseInt(match24[2]);
      }
      return 0;
    }
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const ampm = match[3].toUpperCase();
    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  // Merge today's user tasks into the schedule
  const todayStr = new Date().toISOString().split("T")[0];
  const todayTasks = tasks.filter((t) => t.dueDate === todayStr);

  const mergedSchedule = schedule.map(item => ({ ...item, completed: false }));
  todayTasks.forEach((task) => {
    const timeStr = task.time ? formatTime(task.time) : "12:00 PM";
    // Avoid double-inserting if already present
    const existingIndex = mergedSchedule.findIndex(item => item.name.toLowerCase().includes(task.name.toLowerCase()));
    if (existingIndex === -1) {
      mergedSchedule.push({
        id: task.id,
        time: timeStr,
        name: task.name,
        duration: task.difficulty === "Hard" ? "2 hrs" : "1 hr",
        isLunchBreak: false,
        completed: task.completed,
      });
    } else {
      mergedSchedule[existingIndex].completed = task.completed;
    }
  });

  mergedSchedule.sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));

  // Relative deadline label generator
  const getDeadlineLabel = (dueDateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);
    
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { label: "Overdue", color: "text-red-500", dot: "bg-red-500" };
    } else if (diffDays === 0) {
      return { label: "Today", color: "text-[#EF4444]", dot: "bg-[#EF4444]" };
    } else if (diffDays === 1) {
      return { label: "Tomorrow", color: "text-[#4F46E5]", dot: "bg-[#4F46E5]" };
    } else {
      return { label: `${diffDays} days`, color: "text-gray-400", dot: "bg-yellow-500" };
    }
  };

  // Get active upcoming deadlines
  const upcomingTasks = tasks.filter((t) => !t.completed).slice(0, 5);

  return (
    <div id="dashboard-view" className="space-y-6 max-w-5xl mx-auto">
      {/* Greeting Section */}
      <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h2 id="dashboard-welcome-heading" className="font-sans font-extrabold text-2xl md:text-3xl tracking-tighter text-white">
          Good Morning, {userProfile?.displayName?.split(" ")[0] || "User"}! 👋
        </h2>
        <p id="dashboard-date" className="font-sans text-xs text-gray-500 uppercase tracking-widest font-semibold mt-1">
          {formattedDate}
        </p>
      </section>

      {/* Main Grid Layout for Desktop */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left/Main Column - spans 7/12 on desktop */}
        <div className="space-y-6 md:col-span-7 lg:col-span-8">
          {/* Urgent Overdue Card */}
          {urgentTask && (
            <motion.section 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#1A1A1A] border border-[#2E2E2E] rounded-xl border-l-4 border-l-[#EF4444] p-5 shadow-lg"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse"></span>
                <span className="text-[#EF4444] font-mono text-[10px] font-bold tracking-widest uppercase">
                  URGENT — DUE TODAY
                </span>
              </div>
              <h3 className="font-sans font-bold text-xl text-white mb-4">
                {urgentTask.name} — {urgentTask.time ? formatTime(urgentTask.time) : "6:00 PM"}
              </h3>
              <div className="flex gap-3">
                <button
                  id="urgent-start-btn"
                  onClick={() => onStartSession(urgentTask.name)}
                  className="flex-1 bg-[#EF4444] text-white font-sans font-bold text-sm py-3 rounded-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer border-0"
                >
                  <Play className="w-4 h-4 fill-white text-white" /> Start Now
                </button>
                <button
                  id="urgent-done-btn"
                  onClick={() => onToggleTask(urgentTask.id)}
                  className="flex-1 bg-transparent border border-[#22C55E] text-[#22C55E] font-sans font-bold text-sm py-3 rounded-lg hover:bg-[#22C55E]/10 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" /> Mark Done
                </button>
              </div>
            </motion.section>
          )}

          {/* AI Schedule Card */}
          <section className="bg-[#1A1A1A] border border-[#2E2E2E] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-gray-400">Today's AI Schedule</h3>
              <div className="flex items-center gap-1 bg-[#4F46E5]/10 px-2 py-0.5 rounded-full border border-[#4F46E5]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5]"></span>
                <span className="text-[10px] text-[#c3c0ff] font-mono">Optimized</span>
              </div>
            </div>

            <div className="space-y-4 relative pl-4 border-l-2 border-[#2E2E2E] ml-2">
              {mergedSchedule.map((item) => (
                <div key={item.id} className="relative group">
                  {/* Bullet point indicator on the line */}
                  <div className={`absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full border-4 border-[#0F0F0F] z-10 ${
                    item.isLunchBreak 
                      ? 'bg-gray-500' 
                      : item.completed 
                        ? 'bg-[#22C55E]' 
                        : 'bg-[#EF4444]'
                  }`}></div>
                  
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-xs text-gray-500">{item.time}</span>
                    {item.duration && (
                      <span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${
                        item.completed 
                          ? 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/10' 
                          : 'text-[#c3c0ff] bg-[#4F46E5]/10 border-[#4F46E5]/10'
                      }`}>
                        {item.duration}
                      </span>
                    )}
                  </div>
                  <p className={`font-sans text-sm mt-1 ${
                    item.isLunchBreak 
                      ? 'text-gray-400 italic' 
                      : item.completed 
                        ? 'text-gray-500 line-through' 
                        : 'text-white font-semibold'
                  }`}>
                    {item.name}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Sidebar Column - spans 5/12 on desktop */}
        <div className="space-y-6 md:col-span-5 lg:col-span-4">
          {/* Streak Tracker Card */}
          <section className="bg-[#1A1A1A] border border-[#2E2E2E] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
                <h3 className="font-sans font-bold text-base text-white">Streak: {userProfile?.streak ?? 12} Days</h3>
              </div>
              <span className="font-mono text-[10px] text-[#4F46E5] font-bold uppercase tracking-wider bg-[#4F46E5]/10 px-2 py-0.5 rounded">
                Level {userProfile?.streakLevel ?? 4}
              </span>
            </div>

            <div className="flex justify-between items-center px-1">
              {/* Monday */}
              <div className="flex flex-col items-center gap-1">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border text-[#4F46E5] transition-all ${
                  userProfile?.completedDays?.includes("Mon") 
                    ? "bg-[#4F46E5]/15 border-[#4F46E5]/40" 
                    : "bg-[#1A1A1A] border-gray-800"
                }`}>
                  {userProfile?.completedDays?.includes("Mon") && <Check className="w-4 h-4 text-[#4F46E5] stroke-[3]" />}
                </div>
                <span className="font-mono text-[10px] text-gray-500">Mon</span>
              </div>

              <div className="w-4 h-[1px] bg-gray-800 -mt-4"></div>

              {/* Tuesday */}
              <div className="flex flex-col items-center gap-1">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border text-[#4F46E5] transition-all ${
                  userProfile?.completedDays?.includes("Tue") 
                    ? "bg-[#4F46E5]/15 border-[#4F46E5]/40" 
                    : "bg-[#1A1A1A] border-gray-800"
                }`}>
                  {userProfile?.completedDays?.includes("Tue") && <Check className="w-4 h-4 text-[#4F46E5] stroke-[3]" />}
                </div>
                <span className="font-mono text-[10px] text-gray-500">Tue</span>
              </div>

              <div className="w-4 h-[1px] bg-gray-800 -mt-4"></div>

              {/* Wednesday (Pulsing / Current Day) */}
              <div className="flex flex-col items-center gap-1">
                <motion.div 
                  animate={{ borderColor: ["#4F46E5", "rgba(79, 70, 229, 0.3)", "#4F46E5"] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className={`w-9 h-9 rounded-full bg-[#1A1A1A] flex items-center justify-center border-2 transition-all ${
                    userProfile?.completedDays?.includes("Wed") 
                      ? "border-[#4F46E5]" 
                      : "border-gray-800"
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${userProfile?.completedDays?.includes("Wed") ? 'bg-[#4F46E5]' : 'bg-gray-700'}`}></div>
                </motion.div>
                <span className="font-mono text-[10px] text-white font-bold">Wed</span>
              </div>

              <div className="w-4 h-[1px] bg-gray-800 -mt-4"></div>

              {/* Thursday */}
              <div className="flex flex-col items-center gap-1">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border text-[#4F46E5] transition-all ${
                  userProfile?.completedDays?.includes("Thu") 
                    ? "bg-[#4F46E5]/15 border-[#4F46E5]/40" 
                    : "bg-[#1A1A1A] border-gray-800"
                }`}>
                  {userProfile?.completedDays?.includes("Thu") && <Check className="w-4 h-4 text-[#4F46E5] stroke-[3]" />}
                </div>
                <span className="font-mono text-[10px] text-gray-500">Thu</span>
              </div>
            </div>
          </section>

          {/* Upcoming Deadlines */}
          <section className="space-y-3">
            <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-gray-400 px-1">Upcoming Deadlines</h3>
            <div className="space-y-2">
              {upcomingTasks.length === 0 ? (
                <div className="bg-[#1A1A1A] border border-[#2E2E2E] rounded-lg p-4 text-center">
                  <p className="font-sans text-xs text-gray-500">No upcoming tasks. Good job!</p>
                </div>
              ) : (
                upcomingTasks.map((t) => {
                  const { label, color, dot } = getDeadlineLabel(t.dueDate);
                  return (
                    <div 
                      key={t.id}
                      onClick={() => onNavigate("briefing")}
                      className="bg-[#1A1A1A] border border-[#2E2E2E] rounded-lg p-4 flex items-center justify-between group hover:border-[#4F46E5]/50 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${dot}`}></span>
                        <span className="font-sans text-sm text-white group-hover:text-[#c3c0ff] transition-colors">{t.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`font-mono text-xs font-bold ${color}`}>{label}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteTask(t.id);
                          }}
                          className="p-1 rounded text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                          title="Delete task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Saved Achievements / Completed Tasks */}
          <section className="space-y-3 mt-6">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-gray-400">Saved Achievements</h3>
              <span className="font-mono text-[10px] text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded border border-[#22C55E]/20">
                {tasks.filter(t => t.completed).length} Done
              </span>
            </div>
            <div className="space-y-2">
              {tasks.filter(t => t.completed).length === 0 ? (
                <div className="bg-[#1A1A1A]/40 border border-dashed border-[#2E2E2E] rounded-lg p-4 text-center">
                  <p className="font-sans text-xs text-gray-500">No completed tasks saved yet. Check a task's box to archive your success!</p>
                </div>
              ) : (
                tasks.filter(t => t.completed).map((t) => (
                  <div 
                    key={t.id}
                    className="bg-[#1A1A1A] border border-[#2E2E2E]/60 rounded-lg p-3.5 flex items-center justify-between group hover:border-[#22C55E]/30 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => onToggleTask(t.id)}
                        className="w-5 h-5 rounded-md border border-[#22C55E] bg-[#22C55E]/10 flex items-center justify-center text-[#22C55E] hover:bg-[#22C55E]/20 transition-all shrink-0 cursor-pointer"
                        title="Mark pending"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                      <span className="font-sans text-sm text-gray-400 line-through truncate">{t.name}</span>
                    </div>
                    <button
                      onClick={() => onDeleteTask(t.id)}
                      className="p-1 rounded text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                      title="Permanently delete achievement"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
