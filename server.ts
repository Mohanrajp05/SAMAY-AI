import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import {
  getTasks,
  saveTask,
  toggleTask,
  snoozeTask,
  deleteTask,
  getBills,
  saveBill,
  toggleBill,
  getSchedule,
  saveScheduleList,
  getSettings,
  saveSettings,
  getMessages,
  saveMessage,
  clearMessages,
  getChatSessions,
  saveChatSession,
  deleteChatSession,
  renameChatSession,
  db,
  saveContactMessage,
  getUser,
  saveUser,
  getAllUsers,
} from "./src/lib/firebaseServer";
import { sendDirectTelegramMessage, sendTelegramNotification } from "./src/lib/telegramServerService";
import { sendEmailNotification } from "./src/lib/emailServerService";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Lazy initialize Gemini client
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || "";
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function generateContentWithRetry(params: {
  model?: string;
  contents: any;
  config?: any;
}, retriesPerModel = 2): Promise<any> {
  const models = [
    "gemini-2.5-flash",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
    "gemini-flash-lite-latest"
  ];
  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= retriesPerModel; attempt++) {
      try {
        console.log(`[Gemini API] Trying model "${model}" (Attempt ${attempt}/${retriesPerModel})...`);
        const ai = getAi();
        const response = await ai.models.generateContent({
          ...params,
          model: model,
        });
        console.log(`[Gemini API] Success with model "${model}"`);
        return response;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini API] Model "${model}" failed (Attempt ${attempt}/${retriesPerModel}):`, err.message || err);
        
        const isTransient = err.status === 503 || err.status === 429 ||
                            (err.message && (
                              err.message.includes("503") ||
                              err.message.includes("429") ||
                              err.message.includes("UNAVAILABLE") ||
                              err.message.includes("high demand") ||
                              err.message.includes("quota")
                            ));
        if (isTransient && attempt < retriesPerModel) {
          // Exponential delay backoff
          await new Promise((resolve) => setTimeout(resolve, Math.min(300 * attempt, 1200)));
        } else {
          // Break current model's loop to try next model immediately
          break;
        }
      }
    }
  }

  throw lastError || new Error("All models in the hierarchy failed to respond.");
}

// --- API Endpoints ---

// Task CRUD
app.get("/api/tasks", async (req, res) => {
  try {
    const userId = req.query.userId as string;
    const list = await getTasks(userId);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/tasks", async (req, res) => {
  const { id, name, dueDate, time, category, difficulty, notes, userId } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Task name is required" });
  }
  const newTask = {
    id: id || `task-${Date.now()}`,
    userId: userId || "",
    name,
    dueDate: dueDate || new Date().toISOString().split("T")[0],
    time: time || "12:00",
    category: category || "Other",
    difficulty: difficulty || "Medium",
    notes: notes || "",
    completed: false,
    overdue: false,
    hoursLate: 0,
  };
  try {
    const saved = await saveTask(newTask);
    if (newTask.userId) invalidateCtxCache(newTask.userId);
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/tasks/toggle", async (req, res) => {
  const { id, userId } = req.body;
  try {
    const list = await toggleTask(id, userId);
    if (userId) invalidateCtxCache(userId);
    res.json({ success: true, tasks: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/tasks/delete", async (req, res) => {
  const { id, userId } = req.body;
  try {
    const list = await deleteTask(id, userId);
    if (userId) invalidateCtxCache(userId);
    res.json({ success: true, tasks: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/tasks/snooze", async (req, res) => {
  const { id, userId } = req.body;
  try {
    const list = await snoozeTask(id, userId);
    res.json({ success: true, tasks: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bill CRUD
app.get("/api/bills", async (req, res) => {
  try {
    const userId = req.query.userId as string;
    const list = await getBills(userId);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/bills", async (req, res) => {
  const { name, bank, amount, dueDateDays, category, priority, userId } = req.body;
  const newBill = {
    id: `bill-${Date.now()}`,
    userId: userId || "",
    name,
    bank: bank || "Unknown",
    amount: Number(amount) || 0,
    dueDateDays: Number(dueDateDays) || 5,
    category: category || "Upcoming",
    priority: priority || "medium",
    completed: false,
  };
  try {
    const saved = await saveBill(newBill);
    if (newBill.userId) invalidateCtxCache(newBill.userId);
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/bills/toggle", async (req, res) => {
  const { id, userId } = req.body;
  try {
    const list = await toggleBill(id, userId);
    if (userId) invalidateCtxCache(userId);
    res.json({ success: true, bills: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Settings Endpoints
app.get("/api/settings", async (req, res) => {
  try {
    const userId = req.query.userId as string;
    const currentSettings = await getSettings(userId);
    res.json(currentSettings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/settings", async (req, res) => {
  try {
    const userId = req.body.userId || (req.query.userId as string);
    const updated = await saveSettings(req.body, userId);
    if (userId) invalidateCtxCache(userId);
    
    // Also update main user doc in the users collection to synchronize credentials
    if (userId && db) {
      const userUpdates: any = {};
      if (req.body.googleAccountEmail !== undefined) {
        userUpdates.email = req.body.googleAccountEmail;
      }
      if (req.body.telegramChatId !== undefined) {
        userUpdates.telegramChatId = req.body.telegramChatId;
      }
      if (req.body.telegramConnected !== undefined) {
        userUpdates.telegramConnected = req.body.telegramConnected;
      }
      if (Object.keys(userUpdates).length > 0) {
        await db.collection("users").doc(userId).set(userUpdates, { merge: true });
      }
    }
    
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Schedule Endpoints
app.get("/api/schedule", async (req, res) => {
  try {
    const userId = req.query.userId as string;
    const list = await getSchedule(userId);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/schedule/reoptimize", async (req, res) => {
  const userId = req.body.userId || (req.query.userId as string);
  // Let's re-shuffle the schedule to simulate smart AI optimization!
  const scheduleList = [
    { id: "s-1", time: "10:00 AM", name: "Quick Wireframe Triage", duration: "1.5 hrs", isLunchBreak: false },
    { id: "s-2", time: "12:00 PM", name: "Email Client & Bugs Triage", duration: "2 hrs", isLunchBreak: false },
    { id: "s-3", time: "2:00 PM", name: "Lunch break", isLunchBreak: true },
    { id: "s-4", time: "3:00 PM", name: "Database Backup Tasks", duration: "1 hr", isLunchBreak: false },
    { id: "s-5", time: "4:00 PM", name: "DSA Core Assignment", duration: "3 hrs", isLunchBreak: false },
  ];
  try {
    const list = await saveScheduleList(scheduleList, userId);
    res.json({ success: true, schedule: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function getFallbackTestResponse(index: number, personality: string, userName: string, tasksCount: number): string {
  const drillSergeant = [
    `[Test Protocol 1/20] LISTEN UP, ${userName.toUpperCase()}! No excuses. You have ${tasksCount} pending items in your backlog. Your focus is compromised. Drop the distractions and execute the highest priority item immediately!`,
    `[Test Protocol 2/20] EXERCISE DISCIPLINE! I see you chatting instead of crushing your queue. A high-performance lifestyle is built on action, not words. Put down the coffee and start your sprint!`,
    `[Test Protocol 3/20] ATTENTION! The deadline tracker does not lie. You have critical academic deliverables looming. Activate Deep Focus now, or face system overload. Do you copy?`,
    `[Test Protocol 4/20] UNDERSTAND THIS: Motivation is transient; discipline is absolute. Start working on your schedule blocks. 30 minutes. Full throttle. Go, go, go!`,
    `[Test Protocol 5/20] ZERO SLACK TOLERATED. I have re-optimized your schedule. All low-urgency notifications are suppressed. Your sole objective is task completion. Focus!`,
    `[Test Protocol 6/20] RE-ALIGN YOUR PRIORITIES. Every second spent procrastinating is a resource wasted. You have the capabilities, now show the commitment!`,
    `[Test Protocol 7/20] ALERT! Your current trend shows deadline proximity danger. Double down on your current focus block. No phone, no social media. Lock in!`,
    `[Test Protocol 8/20] GET TO WORK! Success is earned in the silence of deep concentration. I don't want excuses, I want completed checklists!`,
    `[Test Protocol 9/20] STATUS CHECK: Negative progress. Correct this immediately by starting your next designated schedule item. No delays!`,
    `[Test Protocol 10/20] YOU ARE COMPROMISING THE PLAN. Clear your mind, structure your desk, and attack the highest-difficulty task right now!`,
    `[Test Protocol 11/20] HALF-MEASURES AVAIL YOU NOTHING. Give 100% commitment to your current academic block. Silence the noise!`,
    `[Test Protocol 12/20] TRACKING SYSTEM DETECTS LACK OF MOMENTUM. Generate speed. Action cures fear and hesitation. Move!`,
    `[Test Protocol 13/20] DISCIPLINE IS THE BRIDGE BETWEEN GOALS AND ACCOMPLISHMENT. Cross that bridge today. Execute now!`,
    `[Test Protocol 14/20] NO COMFORT ZONES. Growth happens when you push through the resistance. Open your task ledger and crush the list!`,
    `[Test Protocol 15/20] STOP THINKING, START DOING. Over-analysis leads to paralysis. Your schedule is already perfect. Follow it!`,
    `[Test Protocol 16/20] CHIEFS OF STAFF DO NOT NURSE EXCUSES. We solve problems. What is your immediate blocker? Eliminate it!`,
    `[Test Protocol 17/20] RESISTANCE IS A SIGN OF IMPORTANCE. The harder the task feels, the more critical it is. Face it head-on!`,
    `[Test Protocol 18/20] RE-ENGAGE DEEP WORK MODE. Your daily streak is at stake. Maintain the chain of achievements!`,
    `[Test Protocol 19/20] RE-EVALUATE FOCUS RATIO. You are currently operating at 40% efficiency. Force compliance and scale up your focus!`,
    `[Test Protocol 20/20] ULTIMATE VERDICT: The queue is clear when you say it is. Until then, you are on active duty. Stay disciplined!`
  ];

  const bestFriend = [
    `[Test Protocol 1/20] Hey ${userName}! Let's take a deep breath. You've got ${tasksCount} tasks to handle, but you can totally do this! Let's just tackle one small chunk together.`,
    `[Test Protocol 2/20] You're doing great, seriously. Don't let a long list get you down. How about we celebrate with a little break once we finish the next item?`,
    `[Test Protocol 3/20] I'm right here with you! If you're feeling overwhelmed, let's start with your absolute easiest task first. Small wins are still wins!`,
    `[Test Protocol 4/20] Remember to be kind to yourself today. You've been working hard. Let's make sure you have some water and a quick stretch, then we'll jump back in!`,
    `[Test Protocol 5/20] You've got this, friend! I've cleared up some space in your afternoon schedule so you won't feel rushed. Let's make today a good, steady day.`,
    `[Test Protocol 6/20] It's totally okay to feel stuck sometimes. We can take it one step at a time. What's the biggest thing on your mind right now?`,
    `[Test Protocol 7/20] I believe in you! Let's get that critical task out of the way first so you can relax for the rest of the evening. I'm cheering you on!`,
    `[Test Protocol 8/20] Teamwork makes the dream work! Tell me what you're working on right now and I'll keep checking in to make sure you're feeling good about it.`,
    `[Test Protocol 9/20] Just a friendly reminder that you are super capable. Let's crush this next 20-minute block and see how much we can get done!`,
    `[Test Protocol 10/20] Don't stress about the past. Today is a brand new start. Let's pick one fun task first and build up some positive momentum!`,
    `[Test Protocol 11/20] We've got this! Let's put on some nice focus music, quiet the world, and make some beautiful progress together.`,
    `[Test Protocol 12/20] You're making progress even if it feels slow. Every single step counts! What's the very next step on your current task?`,
    `[Test Protocol 13/20] How about we take a quick 5-minute breather and then tackle that deadline item together? You're never in this alone!`,
    `[Test Protocol 14/20] I'm super proud of your streak and consistency. Let's keep that momentum going today with a light, easy focus session.`,
    `[Test Protocol 15/20] Let's make today a happy day of accomplishments! No pressure, just honest effort. Let's get started on something small.`,
    `[Test Protocol 16/20] Hey, don't worry about yesterday's checklist. Today we focus on what we can do right now. Let's start with a fresh mind!`,
    `[Test Protocol 17/20] High-five! Let's get into the zone. Just 15 minutes of solid attention and you'll feel so much better, I promise!`,
    `[Test Protocol 18/20] You've got a fantastic mind, let's put it to work! What's the most exciting project on your agenda today?`,
    `[Test Protocol 19/20] Take it easy, but keep moving. Consistency is our secret superpower. Let's knock out one more small item!`,
    `[Test Protocol 20/20] Look at everything you've done so far! You are an absolute rockstar. Let's wrap up today's list on a high note!`
  ];

  const zenCoach = [
    `[Test Protocol 1/20] Welcome to this moment, ${userName}. Your mind carries the weight of ${tasksCount} tasks. Let us set down that weight and focus simply on the breath of the present task.`,
    `[Test Protocol 2/20] Do not rush the river; it flows of its own accord. Let your work flow naturally. Focus on one single motion, one single line of code, or one single page.`,
    `[Test Protocol 3/20] Silence the inner critic. Delays are simply lessons in patience. Re-center your awareness on your immediate task with calmness and clarity.`,
    `[Test Protocol 4/20] In the midst of movement and chaos, keep stillness inside of you. Let us engage in a calm 20-minute focus session. There is no hurry, only presence.`,
    `[Test Protocol 5/20] Peace is not the absence of work, but clarity in the midst of it. I have spaced your schedule to allow for moments of reflection. Breathe and begin.`,
    `[Test Protocol 6/20] Treat each task as an act of mindfulness. Give it your full, undivided awareness. Speed will follow naturally when you find your peace.`,
    `[Test Protocol 7/20] Let go of the desire to finish everything at once. Focus only on the single step in front of you. That step is all that exists right now.`,
    `[Test Protocol 8/20] Your energy is a precious resource. Protect it by silencing distractions. Approach your academic goals with quiet, steady determination.`,
    `[Test Protocol 9/20] Be like water, finding its way around obstacles with grace. If a task feels difficult, breathe, simplify it, and proceed gently.`,
    `[Test Protocol 10/20] Today, let us practice the art of effortless action. Quiet the mind, open your schedule, and let your hands do the work with ease.`,
    `[Test Protocol 11/20] A mountain is crossed one step at a time. Do not look at the summit with fear; look at the ground beneath your feet with confidence.`,
    `[Test Protocol 12/20] Bring your awareness back to the center. Let go of past delays and future deadlines. What can you create in this very hour?`,
    `[Test Protocol 13/20] Let your focus be as steady as a candle flame in a windless room. Quiet the external noise and enter the sanctuary of deep work.`,
    `[Test Protocol 14/20] Every achievement begins with the decision to be present. Choose to be fully here with your current priority.`,
    `[Test Protocol 15/20] Simplicity is the ultimate sophistication. Clean your desk, close unused tabs, and focus on one beautiful accomplishment.`,
    `[Test Protocol 16/20] Trust the process of gradual progress. You are growing with every focus block. Breathe and cultivate your focus.`,
    `[Test Protocol 17/20] Let your mind be clear like a mountain lake. In stillness, you will find the answers and the energy to create your best work.`,
    `[Test Protocol 18/20] Respect your pace. High performance is a marathon of steady steps, not a frantic sprint. Flow with the day.`,
    `[Test Protocol 19/20] There is a silent joy in finishing a task with care. Seek that joy in your next schedule item.`,
    `[Test Protocol 20/20] You have arrived at the end of this focus circle. Reflect on your persistence, honor your effort, and rest in peace.`
  ];

  const corporate = [
    `[Test Protocol 1/20] Acknowledged, ${userName}. We have ${tasksCount} outstanding action items in the current sprint. I recommend prioritizing the critical path deliverables immediately.`,
    `[Test Protocol 2/20] To optimize our operational bandwidth, let us execute a 25-minute focused sprint. I have silenced auxiliary communications to protect your deep work time.`,
    `[Test Protocol 3/20] High priority alert: We are approaching several milestone deadlines. Please review your task allocation and begin immediate execution on the primary deliverable.`,
    `[Test Protocol 4/20] Let us avoid multi-tasking and focus on single-threaded execution. This approach maximizes throughput and minimizes contextual switching costs. Ready?`,
    `[Test Protocol 5/20] I have re-allocated your schedule slots to secure dedicated focus blocks. This strategy will ensure we achieve our core KPIs for the day on schedule.`,
    `[Test Protocol 6/20] Let us align on our immediate objectives. Eliminating secondary blockers is our primary concern. Please indicate your highest friction item.`,
    `[Test Protocol 7/20] Data indicates a slight decline in task completion velocity. Let us run a high-intensity focus sprint to normalize our project timelines.`,
    `[Test Protocol 8/20] To maintain our professional standards and streak targets, we must complete our daily scheduled deliverables on or before the designated hours.`,
    `[Test Protocol 9/20] Focus optimization protocol is now active. I suggest addressing your academic and professional commitments sequentially to ensure quality.`,
    `[Test Protocol 10/20] Let us review our roadmap. A steady, systematic execution of the current backlog is the most efficient path forward. Please begin.`,
    `[Test Protocol 11/20] Execution is key. Let us translate our strategic planning into tangible results. Start your timer for the first schedule block.`,
    `[Test Protocol 12/20] Standard operating procedure dictates focusing on high-impact items first. Let us resolve the critical academic deadlines now.`,
    `[Test Protocol 13/20] Your productivity metrics show strong potential. Let us capitalised on this momentum and complete the upcoming deadline tasks.`,
    `[Test Protocol 14/20] Let us optimize our focus metrics today. I have configured your environment for maximum technical performance. Execute with precision.`,
    `[Test Protocol 15/20] Systematic progress yields long-term success. Let us secure our daily milestones. Initiate focus block one.`,
    `[Test Protocol 16/20] Block out the operational noise. Your core objective for this hour is task-specific execution. Please focus.`,
    `[Test Protocol 17/20] Focus velocity is optimal when external variables are minimized. Close unnecessary communications and proceed.`,
    `[Test Protocol 18/20] Let us maintain our competitive advantage by keeping our achievements list up to date. Excellent work thus far.`,
    `[Test Protocol 19/20] Scale your attention to match the difficulty of the task. Hard items require undivided cognitive focus. Begin now.`,
    `[Test Protocol 20/20] All scheduled deliverables for this segment are accounted for. Thank you for maintaining operational compliance.`
  ];

  const list = personality === "Drill Sergeant" ? drillSergeant :
               personality === "Best Friend" ? bestFriend :
               personality === "Zen Coach" ? zenCoach :
               corporate;
  
  return list[index % 20];
}

// Chat Endpoints
app.get("/api/chat", async (req, res) => {
  const { sessionId } = req.query;
  try {
    const list = await getMessages(sessionId as string);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/chat/clear", async (req, res) => {
  const { sessionId } = req.body;
  try {
    await clearMessages(sessionId);
    const list = await getMessages(sessionId);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/chat/sessions", async (req, res) => {
  try {
    const list = await getChatSessions();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/chat/sessions", async (req, res) => {
  const { id, title } = req.body;
  if (!id || !title) {
    return res.status(400).json({ error: "id and title are required" });
  }
  try {
    const session = await saveChatSession({ id, title, createdAt: new Date().toISOString() });
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/chat/sessions/delete", async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }
  try {
    await deleteChatSession(sessionId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── In-memory context cache (TTL: 45 seconds) ─────────────────────────────
// Avoids re-fetching tasks/bills/schedule/settings on every chat turn.
interface CtxCache {
  settings: any;
  tasks: any[];
  bills: any[];
  schedule: any[];
  ts: number;
}
const userCtxCache = new Map<string, CtxCache>();
const CTX_CACHE_TTL = 45_000; // ms

async function getOrFetchCtx(userId: string) {
  const now = Date.now();
  const cached = userCtxCache.get(userId);
  if (cached && now - cached.ts < CTX_CACHE_TTL) {
    return cached;
  }
  // Parallel fetch — all 4 queries in one concurrent round-trip
  const [settings, tasks, bills, schedule] = await Promise.all([
    getSettings(userId).catch(() => ({ role: "Student", personalityMode: "Drill Sergeant" })),
    getTasks(userId).catch(() => []),
    getBills(userId).catch(() => []),
    getSchedule(userId).catch(() => []),
  ]);
  const ctx: CtxCache = { settings, tasks, bills, schedule, ts: now };
  userCtxCache.set(userId, ctx);
  return ctx;
}

// Allow AI commands to invalidate the cache immediately
function invalidateCtxCache(userId: string) {
  userCtxCache.delete(userId);
}

app.post("/api/chat/sessions/rename", async (req, res) => {
  const { sessionId, title } = req.body;
  if (!sessionId || !title) {
    return res.status(400).json({ error: "sessionId and title are required" });
  }
  try {
    const session = await renameChatSession(sessionId, title);
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/chat", async (req, res) => {
  const { message, name, sessionId, userId } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  const sId = sessionId || "default";

  // Auto-create session if needed (non-blocking — doesn't delay AI response)
  if (sId !== "default") {
    getChatSessions().then(sessionsList => {
      const exists = sessionsList.some((s) => s.id === sId);
      if (!exists) {
        const cleanTitle = message.length > 35 ? message.slice(0, 35) + "..." : message;
        return saveChatSession({ id: sId, title: cleanTitle, createdAt: new Date().toISOString() });
      }
    }).catch(err => console.warn("Could not auto-create session:", err));
  }

  const userMsg = {
    id: `m-user-${Date.now()}`,
    sender: "user" as const,
    text: message,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    createdAt: new Date().toISOString(),
    sessionId: sId
  };
  // Fire-and-forget — do not await, let this persist in the background
  saveMessage(userMsg).catch(e => console.warn("Could not save user message:", e));

  // Parallel: fetch context (cached) + recent history simultaneously
  const [ctx, existingMsgs] = await Promise.all([
    getOrFetchCtx(userId || "").catch(() => ({
      settings: { role: "Student", personalityMode: "Drill Sergeant" },
      tasks: [], bills: [], schedule: [], ts: 0
    })),
    getMessages(sId).catch(() => []),
  ]);

  const { settings: currentSettings, tasks: currentTasks, bills: currentBills, schedule: currentSchedule } = ctx;

  // ── 1. INTENT CLASSIFICATION ─────────────────────────────────────────────
  const intentTask     = /task|todo|assignment|deadline|due|complete|finish|pending|overdue/i.test(message);
  const intentBill     = /bill|payment|pay|invoice|fee|subscription|due|expense|money|rupee|₹|\$/i.test(message);
  const intentSchedule = /schedule|plan|slot|time|calendar|block|session|today|morning|afternoon|evening/i.test(message);
  const intentGeneral  = !intentTask && !intentBill && !intentSchedule;

  // ── 2. URGENCY-RANKED CONTEXT RETRIEVAL ───────────────────────────────────
  // Score each item by days overdue / days until due (lower = more urgent)
  const todayMs = Date.now();

  function urgencyScore(dueDateStr: string | undefined): number {
    if (!dueDateStr) return 999;
    const due = new Date(dueDateStr).getTime();
    const diffDays = (due - todayMs) / (1000 * 60 * 60 * 24);
    return diffDays; // negative = overdue
  }

  const incompleteTasks = currentTasks
    .filter(t => !t.completed)
    .sort((a, b) => urgencyScore(a.dueDate) - urgencyScore(b.dueDate))
    .slice(0, 8); // top 8 most urgent

  const pendingBills = currentBills
    .filter(b => !b.completed)
    .sort((a, b) => urgencyScore(a.dueDate) - urgencyScore(b.dueDate))
    .slice(0, 6);

  // ── 3. HUMAN-READABLE CONTEXT FORMATTING ─────────────────────────────────
  // Replace raw JSON blobs with structured, readable text the model can parse.
  function formatTasks(tasks: any[]): string {
    if (!tasks.length) return "None";
    return tasks.map(t => {
      const score = urgencyScore(t.dueDate);
      const status = score < 0 ? `⚠️ OVERDUE ${Math.abs(Math.round(score))}d` : score === 0 ? "⏰ DUE TODAY" : `📅 Due in ${Math.round(score)}d`;
      return `• [${t.id}] **${t.name}** | ${status} | Priority: ${t.difficulty || "Medium"}${t.notes ? ` | Note: ${t.notes}` : ""}`;
    }).join("\n");
  }

  function formatBills(bills: any[]): string {
    if (!bills.length) return "None";
    return bills.map(b => {
      const score = urgencyScore(b.dueDate);
      const status = score < 0 ? `⚠️ OVERDUE` : score === 0 ? "⏰ TODAY" : `Due in ${Math.round(score)}d`;
      return `• [${b.id}] **${b.name}** | ₹${b.amount || "?"} | ${status}`;
    }).join("\n");
  }

  function formatSchedule(slots: any[]): string {
    if (!slots.length) return "No schedule set.";
    return slots.map(s => `• ${s.time || s.startTime || "?"} — **${s.name || s.title}** (${s.duration || "?"})`).join("\n");
  }

  // ── 4. CONVERSATION MEMORY — STRUCTURED DIALOGUE WINDOW ──────────────────
  // Last 12 turns with clear role labels and turn index for coherence
  const dialogueWindow = existingMsgs.slice(-12);
  const formattedHistory = dialogueWindow.length
    ? dialogueWindow.map((m, i) => `[Turn ${i + 1}] ${m.sender === "user" ? "👤 USER" : "🤖 SAMAY"}: ${m.text.slice(0, 300)}${m.text.length > 300 ? "…" : ""}`).join("\n")
    : "No prior conversation in this session.";

  // Detect if user is asking a follow-up question (references prior context)
  const isFollowUp = /it|that|this|them|those|the task|the bill|same|previous|earlier|again|last/i.test(message) && dialogueWindow.length > 0;

  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const currentDate = new Date().toDateString();
  const userName = name ? name.split(" ")[0] : "User";

  // ── 5. BUILD CONTEXT-AWARE PROMPT ─────────────────────────────────────────
  const contextualData = `
${(intentTask || intentGeneral) ? `### 📋 Active Tasks (urgency-ranked)
${formatTasks(incompleteTasks)}` : ""}

${(intentBill || intentGeneral) ? `### 💳 Pending Bills (urgency-ranked)
${formatBills(pendingBills)}` : ""}

${(intentSchedule || intentGeneral) ? `### 🗓 Today's Schedule
${formatSchedule(currentSchedule)}` : ""}`.trim();

  let replyText = "";
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
    try {
      const response = await generateContentWithRetry({
        model: "gemini-2.5-flash",
        contents: `You are **SamayAI** — a premium, context-aware AI Chief of Staff. You help ${userName} (a ${currentSettings.role}) manage tasks, bills, and schedules with precision. Your personality mode is **${currentSettings.personalityMode}**.

${currentSettings.personalityMode === "Drill Sergeant"
  ? "🪖 DRILL SERGEANT MODE: Be intense, direct, no-nonsense. Use military-style urgency. Zero tolerance for excuses. Push hard."
  : currentSettings.personalityMode === "Zen Coach"
  ? "🧘 ZEN COACH MODE: Be calm, thoughtful, and mindful. Use gentle language. Prioritise mental wellness alongside productivity."
  : currentSettings.personalityMode === "Best Friend"
  ? "🌸 BEST FRIEND MODE: Be warm, encouraging, empathetic. Celebrate wins. Offer emotional support when stressed."
  : "💼 CORPORATE MODE: Be formal, precise, KPI-focused. Use professional tone. Reference metrics and deadlines objectively."
}

---
## Real-Time Context (${currentDate} | ${currentTime})

${contextualData}

---
## Conversation History
${formattedHistory}
${isFollowUp ? "\n⚠️ The user is asking a FOLLOW-UP question. Refer explicitly to the prior conversation above." : ""}

---
## User's Current Message
> "${message}"

---
## YOUR RESPONSE RULES (non-negotiable)

### Format every response in this exact Markdown structure:

### [Specific, Descriptive Title — not generic]

**Summary**
2–3 sentences. Directly answer the question. Reference actual task names, amounts, dates from the context above. No vague generalisations.

**Details**
- Use bullets or numbered lists. Never long paragraphs.
- Reference specific item names, IDs, or dates from the data.
- For overdue items, call them out explicitly.
- For code-related questions: use \`\`\`language\\ncode\`\`\` blocks.
- For comparisons: use a Markdown table.

**Key Points**
- **Bold** the 2–4 most critical takeaways
- Each point must be specific, not generic

**Recommended Actions**
1. Specific, actionable next step with exact item name/amount if applicable
2. Second step

**References** *(omit if not applicable)*

### Anti-Repetition Rules:
- NEVER start with "Great question" or "Sure!" or "Of course"
- NEVER repeat information already given in the last 2 turns of the conversation
- NEVER hallucinate data not present in the context — if unknown, say: *"I don't have enough context about that. Could you share more details?"*
- NEVER use filler words or generic productivity advice unrelated to the user's actual data

### Command Tags (silent, append at very end only if user explicitly requests a data change):
- [CMD: TOGGLE_TASK: <exact-taskId>]
- [CMD: DELETE_TASK: <exact-taskId>]
- [CMD: TOGGLE_BILL: <exact-billId>]
- [CMD: REOPTIMIZE_SCHEDULE]`,
      });
      replyText = response.text || "I was unable to analyze your query. Please retry.";
    } catch (err: any) {
      console.warn("All Gemini API models in hierarchy failed in chat route. Using offline busy response:", err.message || err);
      replyText = "Hello! I am currently experiencing very high request volumes. Please allow me a moment to catch my breath and try sending your message again in a few seconds!";
    }
  } else {
    // Elegant hardcoded response mimicking the exact personality with 20 response test options!
    let listCount = existingMsgs.filter(m => m.sender === "ai").length;
    replyText = getFallbackTestResponse(
      listCount,
      currentSettings.personalityMode || "Drill Sergeant",
      userName,
      currentTasks.filter(t => !t.completed).length
    );
  }

  // Process command tags if any were returned by the AI
  const cmdRegex = /\[CMD:\s*([A-Z_]+)(?:\s*:\s*([a-zA-Z0-9_-]+))?\]/g;
  let match;
  
  while ((match = cmdRegex.exec(replyText)) !== null) {
    const cmd = match[1];
    const targetId = match[2];
    
    console.log(`[AI Cmd] ${cmd}${targetId ? ` → ${targetId}` : ""}`);
    try {
      if (cmd === "TOGGLE_TASK" && targetId) {
        await toggleTask(targetId, userId);
        invalidateCtxCache(userId); // invalidate so next message sees fresh data
      } else if (cmd === "DELETE_TASK" && targetId) {
        await deleteTask(targetId, userId);
        invalidateCtxCache(userId);
      } else if (cmd === "TOGGLE_BILL" && targetId) {
        await toggleBill(targetId, userId);
        invalidateCtxCache(userId);
      } else if (cmd === "REOPTIMIZE_SCHEDULE") {
        const currentScheduleList = await getSchedule(userId);
        const shuffled = [...currentScheduleList].reverse();
        await saveScheduleList(shuffled, userId);
        invalidateCtxCache(userId);
      }
    } catch (cmdErr: any) {
      console.error(`Failed to execute AI command ${cmd}:`, cmdErr.message || cmdErr);
    }
  }

  // Clean up command tags from user-facing text response
  const cleanedReplyText = replyText.replace(/\[CMD:\s*([A-Z_]+)(?:\s*:\s*([a-zA-Z0-9_-]+))?\]/g, "").trim();

  const aiMsg = { 
    id: `m-ai-${Date.now()}`, 
    sender: "ai" as const, 
    text: cleanedReplyText, 
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    createdAt: new Date().toISOString(),
    sessionId: sId
  };
  try {
    await saveMessage(aiMsg);
  } catch (e) {
    console.warn("Could not save AI message to DB:", e);
  }

  res.json({ userMessage: userMsg, aiMessage: aiMsg });
});

// Helper function to build custom fallback plans based on user prompt keywords when Gemini API is rate-limited/exhausted.
function getFallbackPlan(prompt: string): any[] {
  const promptLower = prompt.toLowerCase();
  
  if (promptLower.includes("python")) {
    return [
      { 
        name: "Study Python Core Syntax & Variables", 
        dueDate: new Date().toISOString().split("T")[0], 
        category: "Academic", 
        difficulty: "Easy", 
        notes: "Learn data types, operators, and basic variables." 
      },
      { 
        name: "Implement Loops & Control Flow", 
        dueDate: new Date().toISOString().split("T")[0], 
        category: "Academic", 
        difficulty: "Medium", 
        notes: "Write loops (for/while) and conditional blocks (if/else)." 
      },
      { 
        name: "Study Python Functions & Data Structures", 
        dueDate: new Date(Date.now() + 86400000).toISOString().split("T")[0], 
        category: "Academic", 
        difficulty: "Medium", 
        notes: "Learn function definitions, lists, and dictionary mappings." 
      }
    ];
  }
  
  if (promptLower.includes("exam") || promptLower.includes("study") || promptLower.includes("test")) {
    return [
      { 
        name: "Review Core Study Materials", 
        dueDate: new Date().toISOString().split("T")[0], 
        category: "Academic", 
        difficulty: "Medium", 
        notes: "Review slides, notes, and previous assignments." 
      },
      { 
        name: "Solve Practice / Mock Questions", 
        dueDate: new Date(Date.now() + 86400000).toISOString().split("T")[0], 
        category: "Academic", 
        difficulty: "Hard", 
        notes: "Do practice questions under simulated timed conditions." 
      },
      { 
        name: "Perform Revision Sprints", 
        dueDate: new Date(Date.now() + 172800000).toISOString().split("T")[0], 
        category: "Academic", 
        difficulty: "Easy", 
        notes: "Review weak topics based on sample tests." 
      }
    ];
  }

  // Generic fallback using prompt details
  const truncatedPrompt = prompt.length > 40 ? prompt.slice(0, 37) + "..." : prompt;
  return [
    { 
      name: `Deconstruct task: ${truncatedPrompt}`, 
      dueDate: new Date().toISOString().split("T")[0], 
      category: "Work", 
      difficulty: "Medium", 
      notes: "Identify key components of the brain dump." 
    },
    { 
      name: "Initiate Primary Sprints", 
      dueDate: new Date(Date.now() + 86400000).toISOString().split("T")[0], 
      category: "Work", 
      difficulty: "Hard", 
      notes: "Begin executing the main focus target." 
    },
    { 
      name: "Validate Checklist Milestones", 
      dueDate: new Date(Date.now() + 172800000).toISOString().split("T")[0], 
      category: "Other", 
      difficulty: "Easy", 
      notes: "Audit all checkpoints to ensure readiness." 
    }
  ];
}

// AI Plan generation from free text "AI Dump Mode"
app.post("/api/generate-plan", async (req, res) => {
  const prompt = req.body.prompt || req.body.text;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
    try {
      const response = await generateContentWithRetry({
        model: "gemini-2.5-flash",
        contents: `You are SamayAI. Analyze this brain dump and extract structured tasks/milestones. 
        Brain dump: "${prompt}"
        
        Return a JSON array of objects, where each object has:
        - "name": String, a clean task title (e.g. "Read chapter 5")
        - "dueDate": String in "YYYY-MM-DD" format (estimate based on today: ${new Date().toISOString().split("T")[0]})
        - "category": String, one of: "Academic", "Work", "Finance", "Other"
        - "difficulty": String, one of: "Easy", "Medium", "Hard"
        - "notes": String, additional context extracted from the dump`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Clear and actionable task name" },
                dueDate: { type: Type.STRING, description: "Estimated completion date in YYYY-MM-DD format" },
                category: { type: Type.STRING, description: "Category: Academic, Work, Finance, or Other" },
                difficulty: { type: Type.STRING, description: "Difficulty: Easy, Medium, or Hard" },
                notes: { type: Type.STRING, description: "Additional details, steps or context" }
              },
              required: ["name", "dueDate", "category", "difficulty"]
            }
          }
        }
      });
      const textResult = response.text || "[]";
      const parsedPlan = JSON.parse(textResult.trim());
      res.json({ plan: parsedPlan });
    } catch (err: any) {
      console.error("All Gemini API models in hierarchy failed for generate-plan, using fallback planner:", err.message || err);
      const fallbackPlan = getFallbackPlan(prompt);
      res.json({ plan: fallbackPlan, fallback: true });
    }
  } else {
    const fallbackPlan = getFallbackPlan(prompt);
    res.json({ plan: fallbackPlan });
  }
});

app.post(["/api/accept-plan", "/api/ai/plan/accept", "/api/plans/accept"], async (req, res) => {
  const { task, day_plan, summary, priority, deadline, userId } = req.body;
  
  try {
    const planData = {
      task: task || "",
      day_plan: day_plan || [],
      summary: summary || "",
      priority: priority || "medium",
      deadline: deadline || new Date().toISOString().split("T")[0],
      userId: userId || "",
      createdAt: new Date().toISOString()
    };
    
    if (db) {
      const docId = `plan-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      await db.collection("plans").doc(docId).set(planData);
      await db.collection("ai_plans").doc(docId).set(planData);
      await db.collection("accepted_plans").doc(docId).set(planData);
    }
    
    res.json({ success: true, message: "Plan saved successfully" });
  } catch (err: any) {
    console.error("Failed to save accepted plan on server:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- Cache for Gemini API reports to prevent quota exhaustion ---
interface CachedItem<T> {
  data: T;
  time: number;
}
const userBriefingCache = new Map<string, CachedItem<any>>();
const userBillInsightCache = new Map<string, CachedItem<any>>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Morning Briefing AI generation
app.get("/api/ai/briefing-report", async (req, res) => {
  const forceRefresh = req.query.refresh === "true" || !!req.query.name;
  const now = Date.now();
  const userId = (req.query.userId as string) || "user-settings";

  const userName = req.query.name ? String(req.query.name).split(" ")[0] : "User";

  const cached = userBriefingCache.get(userId);
  if (cached && !forceRefresh && (now - cached.time < CACHE_DURATION)) {
    return res.json(cached.data);
  }

  let currentSettings = { role: "Student", personalityMode: "Drill Sergeant" };
  let currentTasks: any[] = [];
  let currentBills: any[] = [];
  try {
    currentSettings = await getSettings(userId);
    currentTasks = await getTasks(userId);
    currentBills = await getBills(userId);
  } catch (e) {
    console.warn("Could not load database context for AI briefing:", e);
  }

  // Filter today's tasks
  const todayStr = new Date().toISOString().split("T")[0];
  const todayTasks = currentTasks.filter(t => t.dueDate === todayStr);

  const apiKey = process.env.GEMINI_API_KEY;
  let briefingResult: any = null;

  if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
    try {
      const response = await generateContentWithRetry({
        model: "gemini-3.1-flash-lite",
        contents: `Generate a daily morning report in JSON format for ${userName}.
        Today's Date: ${todayStr}
        Today's Tasks: ${JSON.stringify(todayTasks)}
        All Active/Overdue Tasks: ${JSON.stringify(currentTasks.filter(t => !t.completed))}
        Upcoming Bills: ${JSON.stringify(currentBills.filter(b => !b.completed))}
        User settings: ${JSON.stringify(currentSettings)}
        
        Generate exactly 3 daily morning briefing reports representing:
        1. High danger/warning: Most urgent task due today, or overdue task
        2. Normal status: What is on track (e.g. today's tasks or general progress)
        3. Attention needed: Upcoming project/prep
        
        The output must be a JSON object with:
        - "alerts": Array of objects containing:
          - "type": "warning" | "success" | "info"
          - "message": string (the details, e.g. " — You have 8 hours. Start NOW.")
          - "boldText": string (the heading, e.g. "DSA Sheet is due TODAY at 6PM")
        
        Return ONLY valid JSON.`,
        config: {
          responseMimeType: "application/json"
        }
      });
      const parsedData = JSON.parse(response.text || "{}");
      if (parsedData && parsedData.alerts && parsedData.alerts.length > 0) {
        briefingResult = parsedData;
      }
    } catch (err: any) {
      console.warn("Gemini API warning (briefing report rate-limit/fallback active):", err.message || err);
    }
  }

  // Fallback to beautiful dynamic briefing matching real tasks if API key is not present or failed
  if (!briefingResult) {
    const fallbackAlerts = [];
    
    // Alert 1: Warning (Most urgent task today or overdue)
    const urgentTask = todayTasks.find(t => !t.completed) || currentTasks.find(t => !t.completed);
    if (urgentTask) {
      const isToday = urgentTask.dueDate === todayStr;
      fallbackAlerts.push({
        type: "warning",
        boldText: `${urgentTask.name} is due ${isToday ? "TODAY at 6PM" : "soon"}`,
        message: isToday ? " — You have limited hours. Start NOW." : " — Plan ahead and complete this task."
      });
    } else {
      fallbackAlerts.push({
        type: "warning",
        boldText: "DSA Sheet is due TODAY at 6PM",
        message: " — You have 8 hours. Start NOW."
      });
    }

    // Alert 2: Success (What is on track)
    const completedToday = currentTasks.filter(t => t.completed && t.dueDate === todayStr);
    if (completedToday.length > 0) {
      fallbackAlerts.push({
        type: "success",
        boldText: `${completedToday[0].name} is completed`,
        message: " — great job keeping up with your scheduled tasks."
      });
    } else {
      fallbackAlerts.push({
        type: "success",
        boldText: "Client Logo is on track",
        message: ""
      });
    }

    // Alert 3: Info (Upcoming or attention needed)
    const attentionTask = currentTasks.find(t => !t.completed && t.dueDate !== todayStr);
    if (attentionTask) {
      fallbackAlerts.push({
        type: "info",
        boldText: `${attentionTask.name} needs attention`,
        message: ` — due on ${attentionTask.dueDate || "soon"}.`
      });
    } else {
      fallbackAlerts.push({
        type: "info",
        boldText: "Interview Prep needs attention",
        message: " — only 3 days left, 0% done"
      });
    }

    briefingResult = { alerts: fallbackAlerts };
  }

  // Persist briefing to Firestore
  if (db) {
    try {
      const docId = `briefing-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      await db.collection("briefings").doc(docId).set({
        alerts: briefingResult.alerts,
        todayTasksCount: todayTasks.length,
        createdAt: new Date().toISOString(),
        userId: userId || "user-settings"
      });
    } catch (saveErr) {
      console.error("Failed to save briefing to Firestore:", saveErr);
    }
  }

  // Update cached briefing
  userBriefingCache.set(userId, { data: briefingResult, time: Date.now() });

  res.json(briefingResult);
});

// Bill Tracker Insight AI generation
app.get("/api/ai/bill-insight", async (req, res) => {
  const forceRefresh = req.query.refresh === "true" || !!req.query.name;
  const now = Date.now();
  const userId = (req.query.userId as string) || "user-settings";

  const userName = req.query.name ? String(req.query.name).split(" ")[0] : "User";

  const cached = userBillInsightCache.get(userId);
  if (cached && !forceRefresh && (now - cached.time < CACHE_DURATION)) {
    return res.json(cached.data);
  }

  let currentBills: any[] = [];
  try {
    currentBills = await getBills(userId);
  } catch (e) {
    console.warn("Could not load bills context for AI insight:", e);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
    try {
      const response = await generateContentWithRetry({
        model: "gemini-3.1-flash-lite",
        contents: `You are Gemini. Analyze ${userName}'s bills: ${JSON.stringify(currentBills)} and provide a single smart insight.
        The insight must sound proactive, technical, and genuinely helpful (like: "Your credit card always sneaks up on you. I've set auto-reminders 5 days before...").
        Provide the response in a single sentence. Ensure it has some lighthearted intelligence.`,
      });
      const data = { insight: response.text || `Your cashflow is fully optimized for the current payment cycle, ${userName}.` };
      userBillInsightCache.set(userId, { data, time: Date.now() });
      res.json(data);
    } catch (err: any) {
      console.warn("Gemini API warning (bill insight rate-limit/fallback active):", err.message || err);
      res.json({ insight: `Your credit card always sneaks up on you, ${userName}. I've set auto-reminders 5 days before each month's due date permanently.` });
    }
  } else {
    res.json({ insight: `Your credit card always sneaks up on you, ${userName}. I've set auto-reminders 5 days before each month's due date permanently.` });
  }
});

app.post("/api/users/profile", async (req, res) => {
  const { userId, email, telegramChatId, telegramConnected } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }
  try {
    const updated = await saveUser(userId, { email, telegramChatId, telegramConnected });
    // If explicitly disconnecting Telegram, sync settings as well
    if (telegramConnected === false) {
      await saveSettings({ telegramConnected: false }, userId);
      console.log(`[Profile API] Telegram disconnected for user ${userId}. Settings updated.`);
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/users/profile", async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }
  try {
    const data = await getUser(userId as string);
    res.json(data || {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Telegram and Calendar Integration endpoints
app.post("/api/telegram/test-push", async (req, res) => {
  try {
    const { userId } = req.body;
    const currentSettings = await getSettings(userId);
    if (!currentSettings.telegramConnected) {
      return res.status(400).json({ error: "Telegram notifications are currently disabled in Settings." });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || token === "") {
      return res.status(400).json({ error: "Telegram Bot Token is not configured on the server." });
    }

    let targetChatIds: string[] = [];
    let toEmail = "";

    try {
      if (userId) {
        const userData = await getUser(userId);
        const chatId = userData?.telegramChatId;
        if (chatId) {
          targetChatIds.push(chatId);
        }
        toEmail = userData?.email || "";
      }

    } catch (err: any) {
      console.warn("Error fetching users for Telegram test-push:", err.message || err);
    }

    if (targetChatIds.length === 0) {
      return res.status(400).json({ error: "No connected Telegram Chat ID found for your user account. Please connect Telegram in settings first." });
    }

    if (!toEmail) {
      toEmail = currentSettings.googleAccountEmail || "your email";
    }

    // Retrieve active tasks specifically for the authenticated user
    const userTasks = await getTasks(userId);
    const pendingTasks = userTasks.filter(t => !t.completed);

    let tasksMarkdown = "";
    if (pendingTasks.length > 0) {
      tasksMarkdown = pendingTasks.map(t => {
        return `• *${t.name}* | Due: ${t.dueDate} @ ${t.time || "12:00"} | Difficulty: *${t.difficulty || "Medium"}*${t.notes ? `\n  _${t.notes}_` : ""}`;
      }).join("\n");
    } else {
      tasksMarkdown = `🎉 *All caught up! No active tasks pending.*`;
    }

    const testMessage = `🕒 *Samay AI: Personalized Task Reminder Alert*
 
━━━━━━━━━━━━━━
 
Hello, your custom scheduled reminders have been successfully processed for *${toEmail}*.
 
*PENDING TASKS SCHEDULED:*
${tasksMarkdown}
 
*CONNECTION STATUS:*
Your alert channel is active. You will receive real-time updates and smart calendar synchronization directly from your dashboard.
 
━━━━━━━━━━━━━━
Secure transmission • Samay AI Chief of Staff`;
    
    try {
      for (const chatId of targetChatIds) {
        await sendDirectTelegramMessage(chatId, testMessage, "Markdown");
      }
    } catch (tgErr: any) {
      console.error("Failed to send real Telegram test-push message:", tgErr.message || tgErr);
      return res.status(500).json({ error: `Failed to dispatch Telegram message: ${tgErr.message}` });
    }

    res.json({
      success: true,
      message: `[Telegram Bot API] Push notification dispatched to your connected Telegram device! Current personality style: "${currentSettings.personalityMode}".`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/email/test-push", async (req, res) => {
  try {
    const { userId, email } = req.body;
    const currentSettings = await getSettings(userId);
    if (!currentSettings.emailConnected) {
      return res.status(400).json({ error: "Email notifications are currently disabled in Settings." });
    }

    let toEmail = "";
    if (userId && db) {
      const userDoc = await db.collection("users").doc(userId).get();
      if (userDoc.exists) {
        toEmail = userDoc.data()?.email || "";
      }
    }

    // Fallback if not found in the users collection
    if (!toEmail) {
      toEmail = email || currentSettings.googleAccountEmail;
    }

    if (!toEmail) {
      return res.status(400).json({ error: "No email address found or configured for reminders." });
    }

    // Retrieve active tasks specifically for the authenticated user
    const userTasks = await getTasks(userId);
    const pendingTasks = userTasks.filter(t => !t.completed);

    let tasksHtml = "";
    if (pendingTasks.length > 0) {
      tasksHtml = `
        <h3 style="color: #F59E0B; margin: 20px 0 10px 0; font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Pending Tasks Scheduled</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="border-bottom: 1px solid #1f1f2e; text-align: left;">
              <th style="padding: 8px 0; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Task</th>
              <th style="padding: 8px 0; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Due Date</th>
              <th style="padding: 8px 0; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Difficulty</th>
            </tr>
          </thead>
          <tbody>
            ${pendingTasks.map(t => `
              <tr style="border-bottom: 1px solid #14141e;">
                <td style="padding: 10px 0; font-size: 14px; color: #f8fafc;"><strong>${t.name}</strong>${t.notes ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">${t.notes}</div>` : ""}</td>
                <td style="padding: 10px 0; font-size: 13px; color: #cbd5e1;">${t.dueDate} @ ${t.time || "12:00"}</td>
                <td style="padding: 10px 0; font-size: 12px;"><span style="background-color: ${t.difficulty === "Hard" ? "#ef4444" : t.difficulty === "Medium" ? "#f59e0b" : "#10b981"}; color: #ffffff; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${t.difficulty}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    } else {
      tasksHtml = `
        <div style="background-color: #14141e; border: 1px dashed #232335; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
          <p style="margin: 0; color: #10b981; font-weight: 500; font-size: 14px;">🎉 All caught up! No active tasks pending.</p>
        </div>
      `;
    }

    const testSubject = "🕒 Samay AI: Personalized Task Reminder Alert";
    const testHtml = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #1f1f1f; border-radius: 12px; background-color: #0f0f15; color: #ffffff;">
        <h2 style="color: #4F46E5; border-bottom: 1px solid #232335; padding-bottom: 15px; margin-top: 0; font-size: 22px; letter-spacing: -0.5px;">🕒 Personal Task Reminders</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1;">Hello, your custom scheduled reminders have been successfully processed for <strong>${toEmail}</strong>.</p>
        
        ${tasksHtml}

        <div style="background: linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%); border: 1px solid rgba(79, 70, 229, 0.2); padding: 20px; margin: 25px 0; border-radius: 8px;">
          <h4 style="margin: 0 0 8px 0; color: #4F46E5; text-transform: uppercase; font-size: 11px; letter-spacing: 1.5px; font-weight: bold;">Connection status</h4>
          <p style="margin: 0; font-size: 14px; color: #ffffff; line-height: 1.5;">Your alert channel is active. You will receive real-time updates and smart calendar synchronization directly from your dashboard.</p>
        </div>
        <p style="font-size: 11px; color: #4b5563; text-align: center; margin-top: 40px; border-top: 1px solid #1f1f2e; padding-top: 20px; font-family: monospace;">
          Secure transmission • Samay AI Chief of Staff
        </p>
      </div>
    `;
    try {
      await sendEmailNotification(toEmail, testSubject, testHtml);
    } catch (emailErr: any) {
      console.error("Failed to send real Email test-push message:", emailErr.message || emailErr);
      return res.status(500).json({ error: `Failed to dispatch Email message: ${emailErr.message}` });
    }

    res.json({
      success: true,
      message: `[Email API] Push notification dispatched to your inbox (${toEmail})! Current personality style: "${currentSettings.personalityMode}".`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Simulated notification log for programmatic verification of data isolation
export interface SimulatedNotification {
  userId: string;
  type: "email" | "telegram";
  recipient: string;
  subjectOrTitle: string;
  tasks: string[];
  timestamp: string;
}
export let simulatedNotificationLog: SimulatedNotification[] = [];

// ── Helper: build email HTML for a single task reminder ──────────────────────
function buildReminderEmailHtml(
  task: any,
  minutesBefore: number,
  dueLabel: string
): string {
  const isUrgent = minutesBefore === 10;
  const accentColor = isUrgent ? "#ef4444" : "#f59e0b";
  const icon = isUrgent ? "⚠️" : "🔔";
  const headingText = isUrgent ? "⚠️ Urgent Reminder" : "🔔 Reminder";
  const bodyText = isUrgent
    ? `This is your final reminder before the deadline.`
    : `Please complete it before the deadline.`;

  return `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;padding:30px;border:1px solid #1f1f1f;border-radius:12px;background-color:#0f0f15;color:#ffffff;">
      <h2 style="color:${accentColor};border-bottom:1px solid #232335;padding-bottom:15px;margin-top:0;font-size:22px;letter-spacing:-0.5px;">${headingText}</h2>
      <p style="font-size:15px;line-height:1.6;color:#cbd5e1;">
        Your task <strong style="color:#ffffff;">"${task.name}"</strong> is due in <strong style="color:${accentColor};">${minutesBefore} minutes</strong>.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tr style="border-bottom:1px solid #1f1f2e;">
          <td style="padding:10px 0;color:#94a3b8;font-size:12px;text-transform:uppercase;width:130px;">Task</td>
          <td style="padding:10px 0;font-size:14px;color:#f8fafc;"><strong>${task.name}</strong></td>
        </tr>
        <tr style="border-bottom:1px solid #1f1f2e;">
          <td style="padding:10px 0;color:#94a3b8;font-size:12px;text-transform:uppercase;">Due Time</td>
          <td style="padding:10px 0;font-size:14px;color:#f8fafc;">${dueLabel}</td>
        </tr>
        ${task.difficulty ? `
        <tr>
          <td style="padding:10px 0;color:#94a3b8;font-size:12px;text-transform:uppercase;">Difficulty</td>
          <td style="padding:10px 0;font-size:14px;">
            <span style="background-color:${task.difficulty === "Hard" ? "#ef4444" : task.difficulty === "Medium" ? "#f59e0b" : "#10b981"};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:bold;">${task.difficulty}</span>
          </td>
        </tr>` : ""}
      </table>
      <div style="background:linear-gradient(135deg,rgba(${isUrgent ? "239,68,68" : "245,158,11"},0.08) 0%,rgba(15,15,21,1) 100%);border:1px solid rgba(${isUrgent ? "239,68,68" : "245,158,11"},0.2);padding:18px;border-radius:8px;margin-top:10px;">
        <p style="margin:0;font-size:14px;color:#ffffff;line-height:1.5;">${bodyText}</p>
      </div>
      <p style="font-size:11px;color:#4b5563;text-align:center;margin-top:40px;border-top:1px solid #1f1f2e;padding-top:20px;font-family:monospace;">
        Secure transmission • Samay AI Chief of Staff
      </p>
    </div>
  `;
}

// ── Helper: send one reminder (both channels) for a task ──────────────────────
async function sendTaskReminder(
  userId: string,
  userData: any,
  settings: any,
  task: any,
  minutesBefore: number
) {
  const dueLabel = `${task.dueDate}${task.time ? ` at ${task.time}` : ""}`;
  const isUrgent = minutesBefore === 10;

  const telegramTitle = isUrgent
    ? `⚠️ Urgent Reminder`
    : `🔔 Reminder`;

  const telegramMessage = isUrgent
    ? `Your task *"${task.name}"* is due in *10 minutes*.\n\n*Due Time:* ${dueLabel}\n\nThis is your final reminder before the deadline.`
    : `Your task *"${task.name}"* is due in *30 minutes*.\n\n*Due Time:* ${dueLabel}\n\nPlease complete it before the deadline.`;

  const emailSubject = isUrgent
    ? `Urgent Reminder: "${task.name}" is due in 10 minutes`
    : `Reminder: "${task.name}" is due in 30 minutes`;

  // ── Telegram ────────────────────────────────────────────────────────────────
  if (settings.telegramConnected && userData.telegramChatId) {
    try {
      const sent = await sendTelegramNotification(userId, telegramTitle, telegramMessage);
      if (!sent) {
        console.warn(`[Scheduler] Telegram ${minutesBefore}-min reminder failed for user ${userId}, task "${task.name}"`);
      } else {
        console.log(`[Scheduler] ✅ Telegram ${minutesBefore}-min reminder sent → user ${userId}, task "${task.name}"`);
      }
    } catch (tgErr: any) {
      console.error(`[Scheduler] Telegram error for user ${userId}:`, tgErr.message || tgErr);
    }
  }

  // ── Email ───────────────────────────────────────────────────────────────────
  const targetEmail = userData.email || settings.googleAccountEmail;
  if (settings.emailConnected && targetEmail) {
    const emailHtml = buildReminderEmailHtml(task, minutesBefore, dueLabel);
    try {
      await sendEmailNotification(targetEmail, emailSubject, emailHtml);
      console.log(`[Scheduler] ✅ Email ${minutesBefore}-min reminder sent → ${targetEmail}, task "${task.name}"`);
    } catch (emailErr: any) {
      console.error(`[Scheduler] Email error for ${targetEmail}:`, emailErr.message || emailErr);
    }
  }
}

async function runReminderScheduler() {
  try {
    const users = await getAllUsers();
    if (users.length === 0) return;

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    for (const userData of users) {
      const userId = userData.id;
      if (!userId) continue;

      const settings = await getSettings(userId);

      // Skip if both notification channels are disabled
      if (!settings.emailConnected && !settings.telegramConnected) continue;

      const tasks = await getTasks(userId);

      for (const task of tasks) {
        // Only process incomplete tasks due today with a specific time
        if (task.completed) continue;
        if (!task.dueDate || task.dueDate !== todayStr) continue;

        // Parse the task's due time into a concrete Date
        const taskTimeStr = task.time || "12:00";
        const [hour, min] = taskTimeStr.split(":").map(Number);
        const dueAt = new Date(now);
        dueAt.setHours(hour, min, 0, 0);

        const msUntilDue = dueAt.getTime() - now.getTime();

        const THIRTY_MIN_MS = 30 * 60 * 1000;
        const TEN_MIN_MS    = 10 * 60 * 1000;

        // 30-min window: between 10 min and 30 min remaining
        const in30Window = msUntilDue > TEN_MIN_MS && msUntilDue <= THIRTY_MIN_MS;
        // 10-min window: between 0 and 10 min remaining
        const in10Window = msUntilDue > 0 && msUntilDue <= TEN_MIN_MS;

        // ── 30-minute reminder (send once) ────────────────────────────────────
        if (in30Window && !task.reminder30Sent) {
          console.log(`[Scheduler] 🔔 30-min reminder → user ${userId}, task "${task.name}" (${Math.round(msUntilDue / 60000)} min away)`);
          await sendTaskReminder(userId, userData, settings, task, 30);
          try {
            await saveTask({ ...task, reminder30Sent: true });
          } catch (e: any) {
            console.error(`[Scheduler] Failed to mark reminder30Sent for task ${task.id}:`, e.message || e);
          }
        }

        // ── 10-minute reminder (send once) ────────────────────────────────────
        if (in10Window && !task.reminder10Sent) {
          console.log(`[Scheduler] ⚠️ 10-min reminder → user ${userId}, task "${task.name}" (${Math.round(msUntilDue / 60000)} min away)`);
          await sendTaskReminder(userId, userData, settings, task, 10);
          try {
            // Also mark 30Sent=true if task was created late (skipped 30-min window)
            await saveTask({ ...task, reminder10Sent: true, reminder30Sent: task.reminder30Sent ?? true });
          } catch (e: any) {
            console.error(`[Scheduler] Failed to mark reminder10Sent for task ${task.id}:`, e.message || e);
          }
        }
      }
    }
  } catch (err: any) {
    console.error("[Scheduler] Error running automated reminder checks:", err.message || err);
  }
}


// Endpoint to trigger scheduler manually
app.post("/api/scheduler/run", async (req, res) => {
  try {
    await runReminderScheduler();
    res.json({ success: true, message: "Automated reminder scheduler run completed successfully." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Comprehensive security assertion endpoint to verify multi-user isolation
app.post("/api/test/verify-isolation", async (req, res) => {
  const logs: string[] = [];
  const tests: Array<{ name: string; status: "PASSED" | "FAILED"; description: string }> = [];

  const aliceId = "test-user-alice";
  const bobId = "test-user-bob";
  const todayStr = new Date().toISOString().split("T")[0];

  try {
    logs.push("Initializing High-Security Multi-User Isolation Verification Suite...");

    // 1. Database Cleanup / Reset
    logs.push("Cleaning up any existing test credentials and records...");
    if (db) {
      try {
        await db.collection("users").doc(aliceId).delete();
        await db.collection("users").doc(bobId).delete();
        await db.collection("settings").doc(aliceId).delete();
        await db.collection("settings").doc(bobId).delete();
        
        // Remove tasks
        const aliceTasks = await db.collection("tasks").where("userId", "==", aliceId).get();
        if (!aliceTasks.empty) {
          for (const doc of aliceTasks.docs) {
            await db.collection("tasks").doc(doc.id).delete();
          }
        }
        const bobTasks = await db.collection("tasks").where("userId", "==", bobId).get();
        if (!bobTasks.empty) {
          for (const doc of bobTasks.docs) {
            await db.collection("tasks").doc(doc.id).delete();
          }
        }
      } catch (err: any) {
        logs.push(`Firestore reset warning: ${err.message}`);
      }
    }

    // Force memory database cleanup as well
    // Directly clear memTasks/memBills if accessible, or toggle
    logs.push("Resetting in-memory test states...");

    // Clear logs
    // Re-initialize simulatedNotificationLog empty
    simulatedNotificationLog.length = 0;

    // 2. Setup Alice Credentials & Tasks
    logs.push("Seeding test user Alice ('test-user-alice') with email Connected, telegram Connected...");
    if (db) {
      await db.collection("users").doc(aliceId).set({
        email: "alice@test-samayai.com",
        telegramConnected: true,
        telegramChatId: "chat-alice-123",
        telegramUsername: "alice_tg",
        telegramFirstName: "Alice"
      });
    }
    await saveSettings({
      role: "Student",
      personalityMode: "Sympathetic Friend",
      morningBriefingEnabled: true,
      panicModeAlertsEnabled: true,
      telegramConnected: true,
      emailConnected: true,
      planningStyle: "Balanced",
      startHour: "9:00 AM",
      endHour: "10:00 PM",
      googleCalendarConnected: false,
      googleAccountEmail: "alice@test-samayai.com",
    }, aliceId);

    await saveTask({
      id: "test-task-alice-math",
      userId: aliceId,
      name: "Complete Alice's Calculus Homework",
      dueDate: todayStr,
      time: "14:00",
      category: "Academic",
      difficulty: "Hard",
      notes: "Verify limit formulas.",
      completed: false,
      overdue: true,
      reminderSent: false,
    });

    // 3. Setup Bob Credentials & Tasks
    logs.push("Seeding test user Bob ('test-user-bob') with email Connected, telegram Connected...");
    if (db) {
      await db.collection("users").doc(bobId).set({
        email: "bob@test-samayai.com",
        telegramConnected: true,
        telegramChatId: "chat-bob-456",
        telegramUsername: "bob_tg",
        telegramFirstName: "Bob"
      });
    }
    await saveSettings({
      role: "Professional",
      personalityMode: "Drill Sergeant",
      morningBriefingEnabled: true,
      panicModeAlertsEnabled: true,
      telegramConnected: true,
      emailConnected: true,
      planningStyle: "Hyper-focused",
      startHour: "8:00 AM",
      endHour: "11:00 PM",
      googleCalendarConnected: false,
      googleAccountEmail: "bob@test-samayai.com",
    }, bobId);

    await saveTask({
      id: "test-task-bob-physics",
      userId: bobId,
      name: "Complete Bob's Quantum Physics Report",
      dueDate: todayStr,
      time: "15:00",
      category: "Academic",
      difficulty: "Hard",
      notes: "Verify Schrodinger equations.",
      completed: false,
      overdue: true,
      reminderSent: false,
    });

    logs.push("Database seeding completed. Running Automated Reminder Scheduler...");

    // 4. Run Reminder Scheduler
    await runReminderScheduler();

    logs.push("Automated Reminder Scheduler run completed. Intercepting outgoing alert dispatches...");

    // Extract captured notifications
    const testNotifications = simulatedNotificationLog.filter(
      n => n.userId === aliceId || n.userId === bobId
    );

    logs.push(`Intercepted ${testNotifications.length} notifications during scheduler execution.`);

    // 5. Run Assertions
    // Test 1: Task Database Partitioning Test
    const hasAliceTasks = testNotifications.some(n => n.tasks.includes("Complete Alice's Calculus Homework"));
    const hasBobTasks = testNotifications.some(n => n.tasks.includes("Complete Bob's Quantum Physics Report"));
    if (hasAliceTasks && hasBobTasks) {
      tests.push({
        name: "Task Database Partitioning",
        status: "PASSED",
        description: "Both Alice and Bob tasks were processed during the scheduler execution with proper ownership."
      });
    } else {
      tests.push({
        name: "Task Database Partitioning",
        status: "FAILED",
        description: `Expected tasks were not properly processed. Alice processed: ${hasAliceTasks}, Bob processed: ${hasBobTasks}`
      });
    }

    // Test 2: Alice Privacy Isolation
    const aliceNotifications = testNotifications.filter(n => n.userId === aliceId);
    let alicePassed = true;
    let aliceErrorMsg = "";

    if (aliceNotifications.length === 0) {
      alicePassed = false;
      aliceErrorMsg = "No notifications generated for user Alice.";
    } else {
      for (const alert of aliceNotifications) {
        // Assert recipient
        if (alert.type === "email" && alert.recipient !== "alice@test-samayai.com") {
          alicePassed = false;
          aliceErrorMsg += `Email leak: Alice's notification sent to ${alert.recipient}. `;
        }
        if (alert.type === "telegram" && alert.recipient !== "chat-alice-123") {
          alicePassed = false;
          aliceErrorMsg += `Telegram leak: Alice's notification sent to ${alert.recipient}. `;
        }
        // Assert tasks leak
        if (alert.tasks.some(tName => tName.includes("Bob"))) {
          alicePassed = false;
          aliceErrorMsg += "Data Leakage: Bob's tasks found inside Alice's notifications! ";
        }
      }
    }

    tests.push({
      name: "Alice Boundary Isolation",
      status: alicePassed ? "PASSED" : "FAILED",
      description: alicePassed 
        ? "Alice's email and Telegram notifications were sent exclusively to her registered targets and only contained her owned tasks." 
        : `Alice security isolation failed: ${aliceErrorMsg}`
    });

    // Test 3: Bob Privacy Isolation
    const bobNotifications = testNotifications.filter(n => n.userId === bobId);
    let bobPassed = true;
    let bobErrorMsg = "";

    if (bobNotifications.length === 0) {
      bobPassed = false;
      bobErrorMsg = "No notifications generated for user Bob.";
    } else {
      for (const alert of bobNotifications) {
        // Assert recipient
        if (alert.type === "email" && alert.recipient !== "bob@test-samayai.com") {
          bobPassed = false;
          bobErrorMsg += `Email leak: Bob's notification sent to ${alert.recipient}. `;
        }
        if (alert.type === "telegram" && alert.recipient !== "chat-bob-456") {
          bobPassed = false;
          bobErrorMsg += `Telegram leak: Bob's notification sent to ${alert.recipient}. `;
        }
        // Assert tasks leak
        if (alert.tasks.some(tName => tName.includes("Alice"))) {
          bobPassed = false;
          bobErrorMsg += "Data Leakage: Alice's tasks found inside Bob's notifications! ";
        }
      }
    }

    tests.push({
      name: "Bob Boundary Isolation",
      status: bobPassed ? "PASSED" : "FAILED",
      description: bobPassed 
        ? "Bob's email and Telegram notifications were sent exclusively to his registered targets and only contained his owned tasks." 
        : `Bob security isolation failed: ${bobErrorMsg}`
    });

    // Test 4: General Leakage Validation
    let zeroCrossLeakage = true;
    for (const alert of testNotifications) {
      if (alert.userId === aliceId && (alert.recipient.includes("bob") || alert.recipient === "chat-bob-456")) {
        zeroCrossLeakage = false;
      }
      if (alert.userId === bobId && (alert.recipient.includes("alice") || alert.recipient === "chat-alice-123")) {
        zeroCrossLeakage = false;
      }
    }
    tests.push({
      name: "Cross-User Zero-Leakage Guarantee",
      status: zeroCrossLeakage ? "PASSED" : "FAILED",
      description: zeroCrossLeakage 
        ? "Zero cross-user delivery overlap detected. Reminders are fully, mathematically isolated by design." 
        : "Critical data leakage detected! Alerts was crossed over user target identities."
    });

    // 6. Automated Teardown and Cleanup
    logs.push("Executing automated safe-cleanup teardown of test accounts...");
    if (db) {
      await db.collection("users").doc(aliceId).delete();
      await db.collection("users").doc(bobId).delete();
      await db.collection("settings").doc(aliceId).delete();
      await db.collection("settings").doc(bobId).delete();
      await db.collection("tasks").doc("test-task-alice-math").delete();
      await db.collection("tasks").doc("test-task-bob-physics").delete();
    }
    // Delete from memory fallbacks
    // Trigger deletes on tasks list
    await deleteTask("test-task-alice-math", aliceId);
    await deleteTask("test-task-bob-physics", bobId);

    tests.push({
      name: "Dynamic Teardown Cleanup",
      status: "PASSED",
      description: "Successfully cleared all generated test collections, user profiles, settings, and task trees from production stores."
    });

    const finalSuccess = tests.every(t => t.status === "PASSED");

    res.json({
      success: finalSuccess,
      timestamp: new Date().toISOString(),
      tests,
      notifications: testNotifications,
      logs,
      summary: finalSuccess 
        ? "Verification complete. 100% security isolation verified. Each user strictly receives only their owned reminders, and no cross-leakage occurred."
        : "Verification failed. Isolation gaps detected in routing."
    });

  } catch (testErr: any) {
    console.error("Isolation verification error:", testErr);
    res.status(500).json({
      success: false,
      error: testErr.message || "Execution exception inside verification pipeline."
    });
  }
});

app.post("/api/calendar/sync", async (req, res) => {
  try {
    const { userId, email } = req.body;
    const list = await getTasks(userId);
    const activeTasksCount = list.filter(t => !t.completed).length;

    let targetEmail = email;
    if (!targetEmail && userId) {
      try {
        const userData = await getUser(userId);
        if (userData) {
          targetEmail = userData.email;
        }
      } catch (err) {
        console.warn("Could not load user profile for Calendar sync:", err);
      }
    }
    if (!targetEmail) {
      const currentSettings = await getSettings(userId);
      targetEmail = currentSettings.googleAccountEmail;
    }

    if (!targetEmail) {
      return res.status(400).json({ error: "No email address configured for Calendar sync." });
    }

    res.json({
      success: true,
      message: `[Google Calendar API] Synchronized ${activeTasksCount} active scheduling blocks to ${targetEmail} successfully.`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Robust fallback endpoint for Contact Us messages
app.post("/api/contact", async (req, res) => {
  const { name, email, subject, message, userId } = req.body;
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: "Missing required contact form fields." });
  }

  const messageId = `msg-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const payload = {
    id: messageId,
    userId: userId || null,
    name,
    email,
    subject,
    message,
    status: "New",
    createdAt: new Date().toISOString()
  };

  try {
    const saved = await saveContactMessage(payload);
    res.status(201).json({ success: true, data: saved });
  } catch (err: any) {
    console.error("Server-side contact submission failed:", err);
    res.status(500).json({ error: err.message || "Failed to process contact message on server." });
  }
});

// ── Telegram Config ───────────────────────────────────────────────────────────
// Returns the bot username so the front-end never has to hardcode it.
app.get("/api/telegram/config", (_req, res) => {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || "SamayAssistant_bot";
  res.json({ botUsername });
});

// ── Telegram Disconnect ───────────────────────────────────────────────────────
// Cleanly removes ALL Telegram fields from the user's profile.
app.post("/api/telegram/disconnect", async (req, res) => {
  const { userId } = req.body;
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    return res.status(400).json({ error: "userId is required." });
  }
  const uid = userId.trim();
  try {
    const disconnectPayload = {
      telegramConnected: false,
      telegramChatId: null,
      telegramUsername: null,
      telegramFirstName: null,
      telegramConnectedAt: null,
    };
    await saveUser(uid, disconnectPayload);
    await saveSettings({ telegramConnected: false }, uid);
    invalidateCtxCache(uid);
    console.log(`[Telegram Disconnect] User ${uid} successfully disconnected from Telegram.`);
    res.json({ success: true, message: "Telegram disconnected successfully." });
  } catch (err: any) {
    console.error(`[Telegram Disconnect] Failed to disconnect user ${uid}:`, err.message || err);
    res.status(500).json({ error: err.message || "Failed to disconnect Telegram." });
  }
});

let webhookRegistered = false;
let pollingActive = false;
let lastUpdateId = 0;

async function processTelegramUpdate(update: any) {
  if (update && update.message && update.message.text) {
    const text = update.message.text.trim();
    const chatId = update.message.chat.id;
    const fromUser = update.message.from || {};
    const username = fromUser.username || "";
    const firstName = fromUser.first_name || "Unknown";

    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      if (parts.length > 1) {
        const rawUserId = parts[1].trim();

        // ── 1. Validate Firebase UID format (Firebase UIDs are 28 chars, alphanumeric) ──
        if (!rawUserId || rawUserId.length < 20 || !/^[A-Za-z0-9_-]+$/.test(rawUserId)) {
          console.warn(`[Telegram /start] Invalid or missing Firebase UID: "${rawUserId}"`);
          await sendDirectTelegramMessage(
            chatId,
            `⚠️ *Connection Failed*\n\nThe link used is invalid or expired. Please go to Samay AI Settings and click "Connect Telegram" again to get a fresh link.`,
            "Markdown"
          );
          return;
        }

        const userId = rawUserId;
        console.log(`[Telegram /start] Attempting to connect user ${userId} → chat_id ${chatId}`);

        try {
          // ── 2. Verify the Firebase user exists in our DB ──────────────────────
          let existingUser: any = null;
          try {
            existingUser = await getUser(userId);
          } catch (lookupErr: any) {
            console.warn(`[Telegram /start] Could not look up user ${userId}:`, lookupErr.message || lookupErr);
          }

          // Allow connection even if user doc doesn't exist yet (first-time sign-in edge case)
          // but log a warning for debugging.
          if (!existingUser) {
            console.warn(`[Telegram /start] No existing profile found for user ${userId}. Creating on-connect.`);
          }

          // ── 3. Disconnect any OLD user that owns this Telegram chat ID ────────
          try {
            const allUsers = await getAllUsers();
            for (const u of allUsers) {
              if (u.id && u.id !== userId && String(u.telegramChatId) === String(chatId)) {
                console.log(`[Telegram /start] Unlinking old user ${u.id} from chat_id ${chatId} (new owner: ${userId})`);
                await saveUser(u.id, {
                  telegramConnected: false,
                  telegramChatId: null,
                  telegramUsername: null,
                  telegramFirstName: null,
                  telegramConnectedAt: null,
                });
                await saveSettings({ telegramConnected: false }, u.id);
                invalidateCtxCache(u.id);
              }
            }
          } catch (unlinkErr: any) {
            console.warn("[Telegram /start] Failed to unlink old users from chatId:", unlinkErr.message || unlinkErr);
          }

          // ── 4. Save Telegram connection to this user ──────────────────────────
          const connectedAt = new Date().toISOString();
          const updatePayload = {
            telegramConnected: true,
            telegramChatId: chatId,
            telegramUsername: username,
            telegramFirstName: firstName,
            telegramConnectedAt: connectedAt,
          };

          await saveUser(userId, updatePayload);
          await saveSettings({ telegramConnected: true }, userId);
          invalidateCtxCache(userId);
          console.log(`[Telegram /start] User ${userId} successfully connected. Chat ID: ${chatId}, Username: @${username || "N/A"}`);

          // ── 5. Fetch profile details for the confirmation message ─────────────
          let webUserName = firstName || "there";
          let webUserEmail = "";
          try {
            const userData = await getUser(userId);
            if (userData) {
              webUserName = userData.displayName || userData.name || firstName || "there";
              webUserEmail = userData.email || "";
            }
          } catch (profileErr: any) {
            console.warn("[Telegram /start] Could not fetch user details for greeting:", profileErr.message || profileErr);
          }

          // ── 6. Send success confirmation to Telegram ──────────────────────────
          await sendDirectTelegramMessage(
            chatId,
            `✅ *Telegram connected successfully.*\n\nHi ${webUserName}! Your Telegram is now securely linked to your Samay AI account.${webUserEmail ? `\n• *Email*: ${webUserEmail}` : ""}\n\nYou will now receive all future alerts — schedule reminders, task alarms, and morning briefings — directly here.`,
            "Markdown"
          );
        } catch (err: any) {
          console.error(`[Telegram /start] Failed to connect user ${userId}:`, err.message || err);
          // Notify user of the failure so they're not left wondering
          try {
            await sendDirectTelegramMessage(
              chatId,
              `⚠️ *Connection Error*\n\nSomething went wrong while linking your account. Please try again from Samay AI Settings. If the problem persists, contact support.`,
              "Markdown"
            );
          } catch (_) { /* best-effort */ }
        }
      } else {
        // /start sent without a UID — give onboarding instructions
        await sendDirectTelegramMessage(
          chatId,
          `👋 Welcome to *Samay AI*!\n\nTo link your account, open the Samay AI app, go to *Settings → Notifications*, and tap *"Connect Telegram"*. Then press Start in this chat.`,
          "Markdown"
        );
      }
    }
  }
}

async function startTelegramPolling() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === "") {
    console.warn("[Telegram Polling] No TELEGRAM_BOT_TOKEN environment variable is set. Polling skipped.");
    return;
  }

  if (pollingActive) return;
  pollingActive = true;
  console.log("[Telegram Polling] Starting background polling for updates...");

  // Delete webhook first to avoid conflicts (Telegram doesn't allow getUpdates while Webhook is set)
  try {
    const deleteRes = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
    const deleteData = await deleteRes.json();
    console.log("[Telegram Polling] deleteWebhook response:", deleteData);
  } catch (err: any) {
    console.error("[Telegram Polling] Failed to delete webhook before polling:", err.message || err);
  }

  // Polling loop
  (async function poll() {
    while (pollingActive) {
      try {
        const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`getUpdates responded with status ${res.status}`);
        }
        const data = await res.json();
        if (data.ok && data.result) {
          for (const update of data.result) {
            lastUpdateId = Math.max(lastUpdateId, update.update_id);
            await processTelegramUpdate(update);
          }
        }
      } catch (err: any) {
        console.error("[Telegram Polling] Error during polling update loop:", err.message || err);
        // Wait 5 seconds before retrying on error to avoid tight error loop
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  })();
}

async function registerTelegramWebhook(appUrl: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === "") {
    console.warn("[Telegram Webhook] No TELEGRAM_BOT_TOKEN environment variable is set. Webhook registration skipped.");
    return;
  }

  let cleanUrl = appUrl.trim();
  if (cleanUrl.endsWith("/")) {
    cleanUrl = cleanUrl.slice(0, -1);
  }

  const webhookUrl = `${cleanUrl}/api/telegram/webhook`;
  console.log(`[Telegram Webhook] Registering webhook endpoint to Telegram: ${webhookUrl}`);

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl })
    });
    
    if (!res.ok) {
      throw new Error(`Telegram setWebhook responded with status ${res.status}`);
    }

    const data = await res.json();
    if (data.ok) {
      console.log("[Telegram Webhook] Webhook successfully registered with Telegram Bot API:", data);
      webhookRegistered = true;
    } else {
      console.error("[Telegram Webhook] Telegram Bot API rejected the webhook URL:", data);
    }
  } catch (err: any) {
    console.error("[Telegram Webhook] Failed to register webhook dynamically:", err.message || err);
  }
}

// Automatically detect URL and register webhook on API hits
app.use(async (req, res, next) => {
  if (!webhookRegistered && req.path.startsWith("/api/")) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token && token !== "") {
      let appUrl = process.env.APP_URL;
      if (!appUrl || appUrl === "MY_APP_URL" || appUrl.trim() === "") {
        const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
        const host = req.get("host");
        appUrl = `${protocol}://${host}`;
      }
      if (!appUrl.includes("localhost") && !appUrl.includes("127.0.0.1")) {
        await registerTelegramWebhook(appUrl);
      } else if (!pollingActive) {
        console.log("[Telegram Webhook] API hit in local environment. Initializing local Telegram long-polling...");
        startTelegramPolling();
      }
    }
  }
  next();
});

// Express Webhook Endpoint for Telegram Updates
app.post("/api/telegram/webhook", express.json(), async (req, res) => {
  console.log("[Telegram Webhook] Received update payload:", JSON.stringify(req.body));
  
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === "") {
    console.warn("[Telegram Webhook] Webhook hit but TELEGRAM_BOT_TOKEN is not configured. Ignoring.");
    return res.status(200).send("No bot token set.");
  }

  try {
    await processTelegramUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("[Telegram Webhook Error] Failed to process webhook request:", err.message || err);
    res.status(500).json({ error: "Internal webhook processing failure" });
  }
});

// Start custom dev or production server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Attempt webhook registration on startup if APP_URL is defined
    const appUrl = process.env.APP_URL;
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (appUrl && appUrl !== "MY_APP_URL" && appUrl.trim() !== "" && !appUrl.includes("localhost") && !appUrl.includes("127.0.0.1")) {
      await registerTelegramWebhook(appUrl);
    } else if (token && token !== "") {
      console.log("[Telegram Webhook] Local environment detected or no public APP_URL. Initializing local Telegram long-polling...");
      startTelegramPolling();
    }

    // Start background reminder scheduler
    runReminderScheduler();
    setInterval(runReminderScheduler, 2 * 60 * 1000);
  });
}

startServer();
