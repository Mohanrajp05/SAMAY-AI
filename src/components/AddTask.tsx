import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, MoreVertical, Sparkles, Mic, Calendar, Check, RefreshCw, Cpu } from "lucide-react";
import { TaskCategory, TaskDifficulty, Task } from "../types";
import { auth, db } from "../lib/firebase";
import { setDoc, doc } from "firebase/firestore";

interface AddTaskProps {
  onAddTask: (task: Omit<Task, "id" | "completed" | "overdue">) => void;
  onAddMultipleTasks: (tasks: Omit<Task, "id" | "completed" | "overdue">[]) => void;
  onNavigate: (view: string) => void;
}

export default function AddTask({ onAddTask, onAddMultipleTasks, onNavigate }: AddTaskProps) {
  const [mode, setMode] = useState<"form" | "ai">("form");

  // Form Mode States
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [category, setCategory] = useState<TaskCategory>("Academic");
  const [difficulty, setDifficulty] = useState<TaskDifficulty>("Medium");
  const [notes, setNotes] = useState("");
  const [bank, setBank] = useState("");
  const [amount, setAmount] = useState("");

  // AI Dump Mode States
  const [dumpText, setDumpText] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiPlan, setAiPlan] = useState<any[]>([]);
  const [errorAi, setErrorAi] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleSaveForm = () => {
    if (!name.trim()) {
      setNotification("Task name is required!");
      return;
    }
    
    // Save as Task normally
    onAddTask({
      name,
      dueDate: date || new Date().toISOString().split("T")[0],
      time: time || "12:00",
      category,
      difficulty,
      notes,
    });

    // If Category is Finance, ALSO save as a Bill
    if (category === "Finance") {
      const dueDateVal = date || new Date().toISOString().split("T")[0];
      const dueDateMs = new Date(dueDateVal).getTime();
      const diffMs = dueDateMs - Date.now();
      const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      let billCategory: "Urgent" | "Upcoming" | "Secure" | "Compliance" = "Upcoming";
      if (diffDays <= 2) billCategory = "Urgent";
      else if (diffDays <= 7) billCategory = "Upcoming";
      else if (diffDays <= 15) billCategory = "Secure";
      else billCategory = "Compliance";

      const priorityVal = difficulty === "Hard" ? "high" : difficulty === "Medium" ? "medium" : "low";

      fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name,
          bank: bank || "Unknown",
          amount: Number(amount) || 0,
          dueDateDays: diffDays,
          category: billCategory,
          priority: priorityVal,
          userId: auth.currentUser?.uid || "user-settings"
        })
      }).then(res => {
        if (!res.ok) console.warn("Failed to auto-save Bill via API");
      }).catch(err => {
        console.error("Error auto-saving Bill:", err);
      });
    }

    setNotification(`Task "${name}" successfully saved and synced!`);
    setTimeout(() => {
      onNavigate("dashboard");
    }, 1200);
  };

  const handleAiPlanGenerate = async () => {
    if (!dumpText.trim()) {
      setNotification("Please enter some thoughts in the text field first!");
      return;
    }
    setLoadingAi(true);
    setErrorAi(null);
    setAiPlan([]);
    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: dumpText }),
      });
      if (!res.ok) {
        throw new Error(`Server returned status code ${res.status}`);
      }
      const data = await res.json();
      if (data.plan) {
        setAiPlan(data.plan);
        setNotification("AI Plan generated successfully!");
      } else {
        throw new Error(data.error || "Failed to generate plan. Please try again.");
      }
    } catch (err: any) {
      console.error("AI plan generation failed:", err);
      setErrorAi("System is busy, please try again in a few seconds");
      setNotification("Error generating AI Plan!");
    } finally {
      setLoadingAi(false);
    }
  };

  const handleAcceptAiPlan = async () => {
    if (aiPlan.length === 0) return;

    const uid = auth.currentUser?.uid || "rahul-uid";
    const deadlineVal = aiPlan[aiPlan.length - 1]?.dueDate || new Date().toISOString().split("T")[0];
    const summaryVal = aiPlan.map(p => p.name).join(", ");
    
    let priorityVal = "medium";
    if (aiPlan.some(p => p.difficulty?.toLowerCase() === "hard")) {
      priorityVal = "high";
    } else if (aiPlan.every(p => p.difficulty?.toLowerCase() === "easy")) {
      priorityVal = "low";
    }

    const planPayload = {
      task: dumpText || aiPlan[0]?.name || "AI Generated Plan",
      day_plan: aiPlan,
      summary: summaryVal,
      priority: priorityVal,
      deadline: deadlineVal,
      userId: uid,
    };

    // Save directly using Web SDK to multiple possible collections (plans, ai_plans, accepted_plans)
    try {
      const docId = `plan-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      await setDoc(doc(db, "plans", docId), planPayload);
      await setDoc(doc(db, "ai_plans", docId), planPayload);
      await setDoc(doc(db, "accepted_plans", docId), planPayload);
    } catch (err) {
      console.error("Client-side plan save error:", err);
    }

    // Call server API endpoints for complete backend-authoritative coverage
    try {
      await fetch("/api/accept-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planPayload),
      });
    } catch (err) {
      console.error("API-side plan save error:", err);
    }

    onAddMultipleTasks(aiPlan.map(p => ({
      name: p.name,
      dueDate: p.dueDate || new Date().toISOString().split("T")[0],
      time: "12:00",
      category: p.category as TaskCategory || "Academic",
      difficulty: p.difficulty as TaskDifficulty || "Medium",
      notes: p.notes || "",
    })));

    // Auto-create corresponding bills for plan items with Finance category
    aiPlan.forEach(p => {
      const cat = p.category as TaskCategory || "Academic";
      if (cat === "Finance") {
        const dueDateVal = p.dueDate || new Date().toISOString().split("T")[0];
        const dueDateMs = new Date(dueDateVal).getTime();
        const diffMs = dueDateMs - Date.now();
        const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

        let billCategory: "Urgent" | "Upcoming" | "Secure" | "Compliance" = "Upcoming";
        if (diffDays <= 2) billCategory = "Urgent";
        else if (diffDays <= 7) billCategory = "Upcoming";
        else if (diffDays <= 15) billCategory = "Secure";
        else billCategory = "Compliance";

        const priorityVal = p.difficulty === "Hard" ? "high" : p.difficulty === "Medium" ? "medium" : "low";

        fetch("/api/bills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: p.name,
            bank: "Unknown",
            amount: 0,
            dueDateDays: diffDays,
            category: billCategory,
            priority: priorityVal,
            userId: auth.currentUser?.uid || "user-settings"
          })
        }).catch(err => console.warn("Failed to auto-create bill from plan:", err));
      }
    });

    setNotification(`Successfully imported ${aiPlan.length} optimized AI tasks!`);
    setTimeout(() => {
      onNavigate("dashboard");
    }, 1200);
  };

  return (
    <div id="add-task-view" className="space-y-6 max-w-3xl mx-auto pb-24 relative">
      {/* Toast Notification */}
      {notification && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 bg-[#4F46E5] text-white font-sans text-xs font-bold px-4 py-2.5 rounded-lg shadow-xl border border-[#c3c0ff]/30 z-50 flex items-center gap-2"
        >
          <Cpu className="w-3.5 h-3.5 text-white animate-pulse" />
          {notification}
        </motion.div>
      )}
      {/* Top Bar */}
      <header className="flex justify-between items-center px-1">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate("dashboard")}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-[#2E2E2E] hover:bg-gray-800 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#c3c0ff]" />
          </button>
          <h1 className="font-sans font-bold text-xl text-white">Add New Task</h1>
        </div>
        <button className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-800 transition-colors">
          <MoreVertical className="w-5 h-5" />
        </button>
      </header>

      {/* Mode Toggle Button */}
      <div className="flex p-1 bg-[#1C1B1B] border border-[#2E2E2E] rounded-full">
        <button 
          onClick={() => setMode("form")}
          className={`flex-1 py-2 rounded-full font-mono text-xs font-bold transition-all duration-300 cursor-pointer ${
            mode === "form" 
              ? "bg-[#4F46E5] text-white shadow-lg shadow-[#4F46E5]/20" 
              : "text-gray-400 hover:text-white"
          }`}
        >
          Form Mode
        </button>
        <button 
          onClick={() => setMode("ai")}
          className={`flex-1 py-2 rounded-full font-mono text-xs font-bold transition-all duration-300 cursor-pointer ${
            mode === "ai" 
              ? "bg-[#4F46E5] text-white shadow-lg shadow-[#4F46E5]/20" 
              : "text-gray-400 hover:text-white"
          }`}
        >
          AI Dump Mode
        </button>
      </div>

      <AnimatePresence mode="wait">
        {mode === "form" ? (
          <motion.section 
            key="form"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-6"
          >
            {/* Task Name */}
            <div className="space-y-1.5">
              <label className="font-mono text-xs text-gray-400 ml-1">Task Name</label>
              <input 
                id="task-name-input"
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Study for Exams"
                className="w-full bg-[#0F0F0F] border border-[#2E2E2E] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] rounded-xl px-4 py-3 placeholder:text-gray-600 text-white transition-all text-sm outline-none"
              />
            </div>

            {/* Date and Time Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-mono text-xs text-gray-400 ml-1">Date</label>
                <input 
                  id="task-date-input"
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-[#0F0F0F] border border-[#2E2E2E] focus:border-[#4F46E5] rounded-xl px-4 py-3 text-white transition-all text-sm outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-mono text-xs text-gray-400 ml-1">Time</label>
                <input 
                  id="task-time-input"
                  type="time" 
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-[#0F0F0F] border border-[#2E2E2E] focus:border-[#4F46E5] rounded-xl px-4 py-3 text-white transition-all text-sm outline-none"
                />
              </div>
            </div>

            {/* Category selection */}
            <div className="space-y-2">
              <label className="font-mono text-xs text-gray-400 ml-1">Category</label>
              <div className="flex flex-wrap gap-2">
                {(["Academic", "Work", "Finance", "Other"] as TaskCategory[]).map((cat) => (
                  <button 
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-4 py-2 rounded-full border text-xs font-mono font-semibold transition-all cursor-pointer ${
                      category === cat 
                        ? "bg-[#4F46E5]/20 border-[#4F46E5] text-[#c3c0ff]" 
                        : "border-[#2E2E2E] text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Conditional Bill Fields if Category is Finance */}
            {category === "Finance" && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-2 gap-4 border-2 border-[#4F46E5]/20 p-4 rounded-xl bg-[#4F46E5]/5"
              >
                <div className="space-y-1.5">
                  <label className="font-mono text-xs text-[#c3c0ff] ml-1">Bank Name / Method</label>
                  <input 
                    type="text" 
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                    placeholder="e.g., HDFC, Auto Debit, GPay"
                    className="w-full bg-[#0F0F0F] border border-[#2E2E2E] focus:border-[#4F46E5] rounded-xl px-4 py-3 placeholder:text-gray-600 text-white transition-all text-sm outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-mono text-xs text-[#c3c0ff] ml-1">Amount Payable (₹)</label>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g., 8500"
                    className="w-full bg-[#0F0F0F] border border-[#2E2E2E] focus:border-[#4F46E5] rounded-xl px-4 py-3 placeholder:text-gray-600 text-white transition-all text-sm outline-none"
                  />
                </div>
              </motion.div>
            )}

            {/* Difficulty selection */}
            <div className="space-y-2">
              <label className="font-mono text-xs text-gray-400 ml-1">Difficulty</label>
              <div className="flex gap-2">
                {(["Easy", "Medium", "Hard"] as TaskDifficulty[]).map((diff) => (
                  <button 
                    key={diff}
                    onClick={() => setDifficulty(diff)}
                    className={`flex-1 py-2.5 rounded-xl border text-xs font-mono font-semibold transition-all cursor-pointer ${
                      difficulty === diff 
                        ? "bg-[#4F46E5] text-white border-[#4F46E5]" 
                        : "border-[#2E2E2E] text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="font-mono text-xs text-gray-400 ml-1">Notes (optional)</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Break down steps or add context..."
                rows={4}
                className="w-full bg-[#0F0F0F] border border-[#2E2E2E] focus:border-[#4F46E5] rounded-xl px-4 py-3 placeholder:text-gray-600 text-white transition-all resize-none text-sm outline-none"
              ></textarea>
            </div>


          </motion.section>
        ) : (
          <motion.section 
            key="ai"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-6"
          >
            <div className="space-y-1.5">
              <label className="font-mono text-xs text-gray-400 ml-1">Tell me everything on your mind...</label>
              <textarea 
                id="ai-dump-textarea"
                value={dumpText}
                onChange={(e) => setDumpText(e.target.value)}
                placeholder="I have a huge math exam on Friday. I need to finish chapters 5 and 6 by Wednesday, then do practice problems on Thursday. I'm feeling overwhelmed and need a schedule."
                rows={7}
                className="w-full bg-[#0F0F0F] border border-[#2E2E2E] focus:border-[#4F46E5] rounded-xl px-4 py-4 placeholder:text-gray-600 text-white transition-all resize-none text-sm outline-none leading-relaxed"
              ></textarea>
              <p className="font-sans text-[10px] text-gray-500 uppercase tracking-widest font-semibold px-1">SamayAI will extract dates, difficulty, and plan it all for you.</p>
            </div>

            {errorAi && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-200 rounded-xl font-sans text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
                <span className="text-sm">⚠️</span>
                <span className="font-medium">{errorAi}</span>
              </div>
            )}

            <button 
              onClick={handleAiPlanGenerate}
              disabled={loadingAi}
              className="w-full py-4 bg-[#4F46E5] text-white rounded-xl font-sans font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Sparkles className={`w-4 h-4 ${loadingAi ? 'animate-spin' : ''}`} />
              {loadingAi ? "Analyzing schedule options..." : "Generate My Plan with SamayAI"}
            </button>

            {/* AI Generated Checklist */}
            {aiPlan.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1A1A1A] border-2 border-[#4F46E5]/40 rounded-xl p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-5 h-5 text-[#c3c0ff]" />
                    <h3 className="font-sans font-bold text-base text-white">Your AI Plan</h3>
                  </div>
                  <span className="px-2 py-0.5 bg-[#4F46E5]/10 text-[#c3c0ff] border border-[#4F46E5]/20 rounded-full font-mono text-[9px] uppercase tracking-wider font-bold">Optimized</span>
                </div>

                <div className="space-y-4 border-l-2 border-[#2E2E2E] pl-5 ml-2 py-1">
                  {aiPlan.map((p, idx) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-[27px] top-1 w-2.5 h-2.5 rounded-full bg-[#4F46E5] ring-4 ring-[#1A1A1A]"></div>
                      <p className="text-gray-500 font-mono text-[9px] uppercase font-bold mb-0.5">Day {idx + 1}</p>
                      <p className="font-sans text-sm text-white font-semibold">{p.name}</p>
                      <p className="font-sans text-xs text-gray-400 mt-0.5">{p.notes}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2.5 pt-4 border-t border-[#2E2E2E]">
                  <button 
                    onClick={handleAcceptAiPlan}
                    className="flex-1 py-3 bg-[#22C55E] text-white rounded-lg font-sans font-bold text-xs hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" /> Accept Plan
                  </button>
                  <button 
                    onClick={handleAiPlanGenerate}
                    className="flex-1 py-3 bg-[#2E2E2E] hover:bg-gray-800 text-gray-300 rounded-lg font-sans font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" /> Regenerate
                  </button>
                </div>
              </motion.div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* Save Button for Form Mode */}
      {mode === "form" && (
        <div className="fixed bottom-0 left-0 w-full p-4 bg-[#0F0F0F] border-t border-[#2E2E2E] z-30">
          <div className="max-w-3xl mx-auto">
            <button 
              id="save-add-btn"
              onClick={handleSaveForm}
              className="w-full h-14 bg-[#4F46E5] text-white rounded-xl font-sans font-bold text-base shadow-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Calendar className="w-5 h-5 fill-white/10" /> Save + Add to Google Calendar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
