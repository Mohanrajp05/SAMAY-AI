import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  writeBatch,
  memoryLocalCache
} from "firebase/firestore";
import fs from "fs";
import path from "path";

let db: any = null;

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  
  const app = getApps().length === 0 ? initializeApp(config) : getApp();
  const clientDb = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    localCache: memoryLocalCache(),
  }, config.firestoreDatabaseId || undefined);

  class ClientFirestoreWrapper {
    collection(collectionName: string) {
      return {
        doc: (docId: string) => {
          const docRef = doc(clientDb, collectionName, docId);
          return {
            ref: docRef,
            get: async () => {
              const d = await getDoc(docRef);
              return {
                exists: d.exists(),
                data: () => d.data(),
                id: d.id,
                ref: docRef
              };
            },
            set: async (data: any, options?: { merge?: boolean }) => {
              await setDoc(docRef, data, options || {});
            },
            delete: async () => {
              await deleteDoc(docRef);
            }
          };
        },
        get: async () => {
          const collRef = collection(clientDb, collectionName);
          const snapshot = await getDocs(collRef);
          return {
            empty: snapshot.empty,
            docs: snapshot.docs.map(d => ({
              exists: d.exists(),
              data: () => d.data(),
              id: d.id,
              ref: d.ref
            })),
            forEach: (callback: (doc: any) => void) => {
              snapshot.docs.forEach(d => {
                callback({
                  exists: d.exists(),
                  data: () => d.data(),
                  id: d.id,
                  ref: d.ref
                });
              });
            }
          };
        },
        where: (field: string, op: string, value: any) => {
          return {
            get: async () => {
              const collRef = collection(clientDb, collectionName);
              const q = query(collRef, where(field, op as any, value));
              const snapshot = await getDocs(q);
              return {
                empty: snapshot.empty,
                docs: snapshot.docs.map(d => ({
                  exists: d.exists(),
                  data: () => d.data(),
                  id: d.id,
                  ref: d.ref
                })),
                forEach: (callback: (doc: any) => void) => {
                  snapshot.docs.forEach(d => {
                    callback({
                      exists: d.exists(),
                      data: () => d.data(),
                      id: d.id,
                      ref: d.ref
                    });
                  });
                }
              };
            }
          };
        }
      };
    }

    batch() {
      const batch = writeBatch(clientDb);
      return {
        set: (docRefWrapper: any, data: any, options?: { merge?: boolean }) => {
          batch.set(docRefWrapper.ref || docRefWrapper, data, options || {});
        },
        delete: (docRefWrapper: any) => {
          batch.delete(docRefWrapper.ref || docRefWrapper);
        },
        commit: async () => {
          await batch.commit();
        }
      };
    }
  }

  db = new ClientFirestoreWrapper();
  console.log("Firebase Client-Side Firestore successfully initialized for Server use on:", config.firestoreDatabaseId);
} catch (err) {
  console.warn("Firebase Client-Side Server initialization failed. Fallback in place.", err);
}

export { db };

const DEFAULT_TASKS = [
  {
    id: "task-1",
    name: "DSA Assignment",
    dueDate: new Date().toISOString().split("T")[0],
    time: "18:00",
    category: "Academic",
    difficulty: "Hard",
    notes: "Make sure to solve standard sorting and tree questions first.",
    completed: false,
    overdue: true,
    hoursLate: 0,
  },
];

const DEFAULT_BILLS = [
  {
    id: "bill-1",
    name: "Credit Card Bill",
    bank: "HDFC",
    amount: 8500,
    dueDateDays: 1,
    category: "Urgent",
    priority: "high",
    completed: false,
  },
  {
    id: "bill-2",
    name: "College Semester Fee",
    bank: "Google Pay / Bank Transfer",
    amount: 45000,
    dueDateDays: 5,
    category: "Upcoming",
    priority: "medium",
    completed: false,
  },
  {
    id: "bill-3",
    name: "Netflix Subscription",
    bank: "Auto Debit",
    amount: 649,
    dueDateDays: 12,
    category: "Secure",
    priority: "low",
    completed: false,
  },
  {
    id: "bill-4",
    name: "GST Filing",
    bank: "Gov Portal",
    amount: 0,
    dueDateDays: 18,
    category: "Compliance",
    priority: "high",
    completed: false,
  },
];

const DEFAULT_SCHEDULE = [
  { id: "s-1", time: "9:00 AM", name: "Study DSA", duration: "3 hrs", isLunchBreak: false },
  { id: "s-2", time: "12:00 PM", name: "Lunch break", isLunchBreak: true },
  { id: "s-3", time: "2:00 PM", name: "Mini Project", isLunchBreak: false },
  { id: "s-4", time: "5:00 PM", name: "Resume update", isLunchBreak: false },
];

const DEFAULT_SETTINGS = {
  role: "Student",
  personalityMode: "Drill Sergeant",
  morningBriefingEnabled: true,
  panicModeAlertsEnabled: true,
  telegramConnected: true,
  emailConnected: true,
  planningStyle: "Balanced",
  startHour: "9:00 AM",
  endHour: "10:00 PM",
  googleCalendarConnected: true,
  googleAccountEmail: "",
};

const DEFAULT_MESSAGES = [
  { id: "m-1", sender: "ai" as const, text: "Hello! I am your Samay AI Chief of Staff. How can I help you optimize your schedule?", timestamp: "9:00 AM", createdAt: "2026-01-01T00:00:00.000Z" }
];

// In-Memory Storage Fallbacks
let memTasks: any[] = [...DEFAULT_TASKS];
let memBills: any[] = [...DEFAULT_BILLS];
let memSchedule: any[] = [...DEFAULT_SCHEDULE];
let memSettings: any = { "user-settings": { ...DEFAULT_SETTINGS } };
let memContactMessages: any[] = [];
let memUsers: any = {};

interface DBMessage {
  id: string;
  sender: "ai" | "user";
  text: string;
  timestamp: string;
  sessionId?: string;
  createdAt?: string;
}

let memMessages: DBMessage[] = [...DEFAULT_MESSAGES.map(m => ({ ...m, sessionId: "default" }))];
let memSessions = [
  { id: "default", title: "General Discussion", createdAt: new Date().toISOString() }
];

const LOCAL_DB_PATH = path.join(process.cwd(), "local_db.json");

export function saveLocalDb() {
  try {
    const data = {
      tasks: memTasks,
      bills: memBills,
      schedule: memSchedule,
      settings: memSettings,
      messages: memMessages,
      sessions: memSessions,
      contact_messages: memContactMessages,
      users: memUsers,
    };
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.warn("Could not save to local JSON database:", err);
  }
}

export function loadLocalDb() {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const raw = fs.readFileSync(LOCAL_DB_PATH, "utf8");
      const data = JSON.parse(raw);
      if (data.tasks) memTasks = data.tasks;
      if (data.bills) memBills = data.bills;
      if (data.schedule) memSchedule = data.schedule;
      if (data.settings) {
        if (typeof data.settings.role === "string") {
          memSettings = { "user-settings": data.settings };
        } else {
          memSettings = data.settings;
        }
      }
      if (data.messages) memMessages = data.messages;
      if (data.contact_messages) memContactMessages = data.contact_messages;
      if (data.users) memUsers = data.users;
      if (data.sessions) {
        memSessions = data.sessions;
      } else {
        memSessions = [
          { id: "default", title: "General Discussion", createdAt: new Date().toISOString() }
        ];
      }
      console.log("Durable local JSON DB loaded successfully.");
    } else {
      saveLocalDb();
    }
  } catch (err) {
    console.warn("Could not load local JSON database, starting with defaults:", err);
  }
}

// Load database immediately on startup
loadLocalDb();

// Firestore Access Layer
export async function getTasks(userId?: string): Promise<any[]> {
  if (!db) {
    if (userId && userId !== "rahul-uid" && userId !== "user-settings") {
      return memTasks.filter(t => t.userId === userId || !t.userId);
    }
    return memTasks;
  }
  try {
    let snapshot;
    if (userId && userId !== "" && userId !== "rahul-uid" && userId !== "user-settings") {
      snapshot = await db.collection("tasks").where("userId", "==", userId).get();
    } else {
      snapshot = await db.collection("tasks").get();
    }
    if (snapshot.empty) {
      // Seed tasks if empty and we have a specific user
      const listToSeed = memTasks.map(t => ({ ...t, userId: userId || "rahul-uid" }));
      for (const t of listToSeed) {
        await db.collection("tasks").doc(t.id).set(t);
      }
      return listToSeed;
    }
    const items: any[] = [];
    snapshot.forEach((doc) => items.push({ ...doc.data(), id: doc.id }));
    return items;
  } catch (err: any) {
    console.warn("Firestore getTasks warning, using fallback.", err.message || err);
    if (userId && userId !== "rahul-uid" && userId !== "user-settings") {
      return memTasks.filter(t => t.userId === userId || !t.userId);
    }
    return memTasks;
  }
}

export async function saveTask(task: any): Promise<any> {
  // Always update the local state first to guarantee cache consistency
  memTasks = [...memTasks.filter(t => t.id !== task.id), task];
  saveLocalDb();

  if (!db) {
    return task;
  }
  try {
    await db.collection("tasks").doc(task.id).set(task);
    return task;
  } catch (err: any) {
    console.warn("Firestore saveTask warning. Fallback active.", err.message || err);
    return task;
  }
}

export async function toggleTask(id: string, userId?: string): Promise<any[]> {
  // Always update the local state first to guarantee cache consistency
  memTasks = memTasks.map(t => t.id === id ? { ...t, completed: !t.completed, overdue: !t.completed ? false : t.overdue } : t);
  saveLocalDb();

  if (!db) {
    if (userId && userId !== "rahul-uid" && userId !== "user-settings") {
      return memTasks.filter(t => t.userId === userId || !t.userId);
    }
    return memTasks;
  }
  try {
    const docRef = db.collection("tasks").doc(id);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const data = docSnap.data();
      const nextCompleted = !data?.completed;
      await docRef.update({
        completed: nextCompleted,
        overdue: nextCompleted ? false : (data?.overdue ?? false),
      });
    }
    return getTasks(userId);
  } catch (err: any) {
    console.warn("Firestore toggleTask warning. Fallback active.", err.message || err);
    if (userId && userId !== "rahul-uid" && userId !== "user-settings") {
      return memTasks.filter(t => t.userId === userId || !t.userId);
    }
    return memTasks;
  }
}

export async function snoozeTask(id: string, userId?: string): Promise<any[]> {
  // Always update the local state first to guarantee cache consistency
  memTasks = memTasks.map(t => {
    if (t.id === id) {
      const currentHours = t.hoursLate || 0;
      return { ...t, hoursLate: Math.max(0, currentHours - 1) };
    }
    return t;
  });
  saveLocalDb();

  if (!db) {
    if (userId && userId !== "rahul-uid" && userId !== "user-settings") {
      return memTasks.filter(t => t.userId === userId || !t.userId);
    }
    return memTasks;
  }
  try {
    const docRef = db.collection("tasks").doc(id);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const currentHours = docSnap.data()?.hoursLate || 0;
      await docRef.update({
        hoursLate: Math.max(0, currentHours - 1)
      });
    }
    return getTasks(userId);
  } catch (err: any) {
    console.warn("Firestore snoozeTask warning. Fallback active.", err.message || err);
    if (userId && userId !== "rahul-uid" && userId !== "user-settings") {
      return memTasks.filter(t => t.userId === userId || !t.userId);
    }
    return memTasks;
  }
}

export async function deleteTask(id: string, userId?: string): Promise<any[]> {
  // Always update the local state first to guarantee cache consistency
  memTasks = memTasks.filter(t => t.id !== id);
  saveLocalDb();

  if (!db) {
    if (userId && userId !== "rahul-uid" && userId !== "user-settings") {
      return memTasks.filter(t => t.userId === userId || !t.userId);
    }
    return memTasks;
  }
  try {
    await db.collection("tasks").doc(id).delete();
    return getTasks(userId);
  } catch (err: any) {
    console.warn("Firestore deleteTask warning. Fallback active.", err.message || err);
    if (userId && userId !== "rahul-uid" && userId !== "user-settings") {
      return memTasks.filter(t => t.userId === userId || !t.userId);
    }
    return memTasks;
  }
}

export async function getBills(userId?: string): Promise<any[]> {
  if (!db) {
    if (userId && userId !== "rahul-uid" && userId !== "user-settings") {
      return memBills.filter(b => b.userId === userId || !b.userId);
    }
    return memBills;
  }
  try {
    let snapshot;
    if (userId && userId !== "" && userId !== "rahul-uid" && userId !== "user-settings") {
      snapshot = await db.collection("bills").where("userId", "==", userId).get();
    } else {
      snapshot = await db.collection("bills").get();
    }
    if (snapshot.empty) {
      const userBills = memBills.map(b => ({ ...b, userId: userId || "rahul-uid" }));
      for (const b of userBills) {
        await db.collection("bills").doc(b.id).set(b);
      }
      return userBills;
    }
    const items: any[] = [];
    snapshot.forEach((doc) => items.push({ ...doc.data(), id: doc.id }));
    return items;
  } catch (err: any) {
    console.warn("Firestore getBills warning. Fallback active.", err.message || err);
    if (userId && userId !== "rahul-uid" && userId !== "user-settings") {
      return memBills.filter(b => b.userId === userId || !b.userId);
    }
    return memBills;
  }
}

export async function saveBill(bill: any): Promise<any> {
  if (!db) {
    memBills = [...memBills.filter(b => b.id !== bill.id), bill];
    saveLocalDb();
    return bill;
  }
  try {
    await db.collection("bills").doc(bill.id).set(bill);
    return bill;
  } catch (err: any) {
    console.warn("Firestore saveBill warning. Fallback active.", err.message || err);
    memBills = [...memBills.filter(b => b.id !== bill.id), bill];
    saveLocalDb();
    return bill;
  }
}

export async function toggleBill(id: string, userId?: string): Promise<any[]> {
  if (!db) {
    memBills = memBills.map(b => b.id === id ? { ...b, completed: !b.completed } : b);
    saveLocalDb();
    if (userId && userId !== "rahul-uid" && userId !== "user-settings") {
      return memBills.filter(b => b.userId === userId || !b.userId);
    }
    return memBills;
  }
  try {
    const docRef = db.collection("bills").doc(id);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      await docRef.update({
        completed: !docSnap.data()?.completed,
      });
    }
    return getBills(userId);
  } catch (err: any) {
    console.warn("Firestore toggleBill warning. Fallback active.", err.message || err);
    memBills = memBills.map(b => b.id === id ? { ...b, completed: !b.completed } : b);
    saveLocalDb();
    if (userId && userId !== "rahul-uid" && userId !== "user-settings") {
      return memBills.filter(b => b.userId === userId || !b.userId);
    }
    return memBills;
  }
}

export async function getSchedule(userId?: string): Promise<any[]> {
  if (!db) {
    if (userId && userId !== "rahul-uid" && userId !== "user-settings") {
      return memSchedule.filter(s => s.userId === userId || !s.userId);
    }
    return memSchedule;
  }
  try {
    let snapshot;
    if (userId && userId !== "" && userId !== "rahul-uid" && userId !== "user-settings") {
      snapshot = await db.collection("schedule").where("userId", "==", userId).get();
    } else {
      snapshot = await db.collection("schedule").get();
    }
    if (snapshot.empty) {
      const userSchedule = memSchedule.map(s => ({ ...s, userId: userId || "rahul-uid" }));
      for (const s of userSchedule) {
        await db.collection("schedule").doc(s.id).set(s);
      }
      return userSchedule;
    }
    const items: any[] = [];
    snapshot.forEach((doc) => items.push({ ...doc.data(), id: doc.id }));
    return items;
  } catch (err: any) {
    console.warn("Firestore getSchedule warning. Fallback active.", err.message || err);
    if (userId && userId !== "rahul-uid" && userId !== "user-settings") {
      return memSchedule.filter(s => s.userId === userId || !s.userId);
    }
    return memSchedule;
  }
}

export async function saveScheduleList(list: any[], userId?: string): Promise<any[]> {
  const targetUserId = userId || "rahul-uid";
  const listWithUser = list.map(item => ({ ...item, userId: targetUserId }));
  if (!db) {
    memSchedule = [...memSchedule.filter(s => s.userId !== targetUserId), ...listWithUser];
    saveLocalDb();
    return listWithUser;
  }
  try {
    // Clear only this user's schedule, then batch set
    const coll = db.collection("schedule");
    const snapshot = await coll.where("userId", "==", targetUserId).get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    listWithUser.forEach((item) => {
      const docRef = coll.doc(item.id);
      batch.set(docRef, item);
    });
    await batch.commit();
    return listWithUser;
  } catch (err: any) {
    console.warn("Firestore saveScheduleList warning. Fallback active.", err.message || err);
    memSchedule = [...memSchedule.filter(s => s.userId !== targetUserId), ...listWithUser];
    saveLocalDb();
    return listWithUser;
  }
}

export async function getSettings(userId?: string): Promise<any> {
  const targetDocId = userId && userId !== "" && userId !== "rahul-uid" ? userId : "user-settings";
  if (!db) {
    if (typeof memSettings[targetDocId] === "object") {
      return memSettings[targetDocId];
    }
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const doc = await db.collection("settings").doc(targetDocId).get();
    if (!doc.exists) {
      const initialSettings = { ...DEFAULT_SETTINGS, googleAccountEmail: "" };
      await db.collection("settings").doc(targetDocId).set(initialSettings);
      return initialSettings;
    }
    return doc.data();
  } catch (err: any) {
    console.warn(`Firestore getSettings warning for ${targetDocId}. Fallback active.`, err.message || err);
    return typeof memSettings[targetDocId] === "object" ? memSettings[targetDocId] : DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: any, userId?: string): Promise<any> {
  const targetDocId = userId && userId !== "" && userId !== "rahul-uid" ? userId : (settings.userId || "user-settings");
  if (!db) {
    memSettings[targetDocId] = { ...DEFAULT_SETTINGS, ...memSettings[targetDocId], ...settings };
    saveLocalDb();
    return memSettings[targetDocId];
  }
  try {
    await db.collection("settings").doc(targetDocId).set(settings, { merge: true });
    return getSettings(targetDocId);
  } catch (err: any) {
    console.warn(`Firestore saveSettings warning for ${targetDocId}. Fallback active.`, err.message || err);
    memSettings[targetDocId] = { ...DEFAULT_SETTINGS, ...memSettings[targetDocId], ...settings };
    saveLocalDb();
    return memSettings[targetDocId];
  }
}

export async function getMessages(sessionId?: string): Promise<any[]> {
  const targetSessionId = sessionId || "default";
  
  const sortFn = (a: any, b: any) => {
    const getTimestamp = (msg: any) => {
      if (msg.createdAt) return new Date(msg.createdAt).getTime();
      if (msg.id === "m-1") return 0;
      if (msg.id) {
        const parts = msg.id.split("-");
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum) && lastNum > 100000000000) return lastNum;
      }
      return 9999999999999;
    };
    return getTimestamp(a) - getTimestamp(b);
  };

  const sanitizeAndSyncMsg = (m: any) => {
    if (m.id === "m-1") {
      m.text = "Hello! I am your Samay AI Chief of Staff. How can I help you optimize your schedule?";
      m.createdAt = "2026-01-01T00:00:00.000Z";
    }
    return m;
  };

  if (!db) {
    const list = memMessages.filter(m => (m.sessionId || "default") === targetSessionId).map(sanitizeAndSyncMsg);
    list.sort(sortFn);
    return list;
  }
  try {
    const snapshot = await db.collection("messages").get();
    const items: any[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const sId = data.sessionId || "default";
      if (sId === targetSessionId) {
        items.push(sanitizeAndSyncMsg({ ...data, id: doc.id }));
      }
    });

    // If empty and default session, seed DEFAULT_MESSAGES
    if (items.length === 0 && targetSessionId === "default") {
      for (const m of memMessages) {
        const msgWithSession = { ...m, sessionId: "default" };
        await db.collection("messages").doc(m.id).set(msgWithSession);
        items.push(msgWithSession);
      }
    }

    items.sort(sortFn);
    return items;
  } catch (err: any) {
    console.warn("Firestore getMessages warning. Fallback active.", err.message || err);
    const list = memMessages.filter(m => (m.sessionId || "default") === targetSessionId).map(sanitizeAndSyncMsg);
    list.sort(sortFn);
    return list;
  }
}

export async function saveMessage(msg: any): Promise<any> {
  const msgWithSession = { ...msg, sessionId: msg.sessionId || "default" };
  if (!db) {
    memMessages.push(msgWithSession);
    saveLocalDb();
    return msgWithSession;
  }
  try {
    await db.collection("messages").doc(msgWithSession.id).set(msgWithSession);
    return msgWithSession;
  } catch (err: any) {
    console.warn("Firestore saveMessage warning. Fallback active.", err.message || err);
    memMessages.push(msgWithSession);
    saveLocalDb();
    return msgWithSession;
  }
}

export async function clearMessages(sessionId?: string): Promise<void> {
  const targetSessionId = sessionId || "default";
  
  // Remove in-memory
  memMessages = memMessages.filter(m => (m.sessionId || "default") !== targetSessionId);
  
  // If we are clearing the default session, seed the default message
  if (targetSessionId === "default") {
    memMessages = [...memMessages, ...DEFAULT_MESSAGES.map(m => ({ ...m, sessionId: "default" }))];
  }
  saveLocalDb();

  if (!db) return;
  try {
    const snapshot = await db.collection("messages").get();
    const batch = db.batch();
    let count = 0;
    
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const sId = data.sessionId || "default";
      if (sId === targetSessionId) {
        batch.delete(doc.ref);
        count++;
      }
    });
    
    if (count > 0) {
      await batch.commit();
    }

    if (targetSessionId === "default") {
      for (const m of DEFAULT_MESSAGES) {
        await db.collection("messages").doc(m.id).set({ ...m, sessionId: "default" });
      }
    }
  } catch (err: any) {
    console.warn("Firestore clearMessages warning:", err.message || err);
  }
}

export async function getChatSessions(): Promise<any[]> {
  if (!db) return memSessions;
  try {
    const snapshot = await db.collection("chat_sessions").get();
    if (snapshot.empty) {
      // Seed default session in Firestore
      for (const s of memSessions) {
        await db.collection("chat_sessions").doc(s.id).set(s);
      }
      return memSessions;
    }
    const items: any[] = [];
    snapshot.forEach((doc) => items.push({ ...doc.data(), id: doc.id }));
    
    // Sort by createdAt desc
    items.sort((a, b) => {
      const dateA = a.createdAt || "";
      const dateB = b.createdAt || "";
      return dateB.localeCompare(dateA);
    });
    return items;
  } catch (err: any) {
    console.warn("Firestore getChatSessions warning. Fallback active.", err.message || err);
    return memSessions;
  }
}

export async function saveChatSession(session: any): Promise<any> {
  if (!db) {
    const idx = memSessions.findIndex(s => s.id === session.id);
    if (idx !== -1) {
      memSessions[idx] = { ...memSessions[idx], ...session };
    } else {
      memSessions.unshift(session);
    }
    saveLocalDb();
    return session;
  }
  try {
    await db.collection("chat_sessions").doc(session.id).set(session, { merge: true });
    return session;
  } catch (err: any) {
    console.warn("Firestore saveChatSession warning. Fallback active.", err.message || err);
    const idx = memSessions.findIndex(s => s.id === session.id);
    if (idx !== -1) {
      memSessions[idx] = { ...memSessions[idx], ...session };
    } else {
      memSessions.unshift(session);
    }
    saveLocalDb();
    return session;
  }
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  // 1. Remove session from list
  memSessions = memSessions.filter(s => s.id !== sessionId);
  
  // 2. Remove messages associated with session
  memMessages = memMessages.filter(m => (m.sessionId || "default") !== sessionId);
  
  // 3. Ensure at least "default" session exists
  if (memSessions.length === 0) {
    memSessions = [{ id: "default", title: "General Discussion", createdAt: new Date().toISOString() }];
  }
  saveLocalDb();

  if (!db) return;
  try {
    // Delete session doc
    await db.collection("chat_sessions").doc(sessionId).delete();
    
    // Delete messages associated
    const snapshot = await db.collection("messages").get();
    const batch = db.batch();
    let count = 0;
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const sId = data.sessionId || "default";
      if (sId === sessionId) {
        batch.delete(doc.ref);
        count++;
      }
    });
    if (count > 0) {
      await batch.commit();
    }
  } catch (err: any) {
    console.warn("Firestore deleteChatSession warning:", err.message || err);
  }
}

export async function renameChatSession(sessionId: string, title: string): Promise<any> {
  const session = { id: sessionId, title, createdAt: new Date().toISOString() };
  return saveChatSession(session);
}

export async function saveContactMessage(msg: any): Promise<any> {
  memContactMessages.push(msg);
  saveLocalDb();

  if (!db) {
    return msg;
  }
  try {
    await db.collection("contact_messages").doc(msg.id).set(msg);
    return msg;
  } catch (err: any) {
    console.warn("Firestore saveContactMessage warning.", err.message || err);
    return msg;
  }
}

export async function getUser(userId: string): Promise<any> {
  const targetId = userId || "default-user";
  if (!db) {
    return memUsers[targetId] || null;
  }
  try {
    const docRef = db.collection("users").doc(targetId);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      return docSnap.data();
    }
    return memUsers[targetId] || null;
  } catch (err: any) {
    console.warn(`Firestore getUser warning for ${targetId}. Fallback active.`, err.message || err);
    return memUsers[targetId] || null;
  }
}

export async function saveUser(userId: string, data: any): Promise<any> {
  const targetId = userId || "default-user";
  const existing = memUsers[targetId] || {};
  memUsers[targetId] = { ...existing, ...data };
  saveLocalDb();
  if (!db) {
    return memUsers[targetId];
  }
  try {
    await db.collection("users").doc(targetId).set(data, { merge: true });
    return memUsers[targetId];
  } catch (err: any) {
    console.warn(`Firestore saveUser warning for ${targetId}. Fallback active.`, err.message || err);
    return memUsers[targetId];
  }
}

export async function getAllUsers(): Promise<any[]> {
  if (!db) {
    return Object.keys(memUsers).map(id => ({ id, ...memUsers[id] }));
  }
  try {
    const snapshot = await db.collection("users").get();
    if (snapshot.empty) {
      return Object.keys(memUsers).map(id => ({ id, ...memUsers[id] }));
    }
    const items: any[] = [];
    snapshot.forEach((doc: any) => items.push({ id: doc.id, ...doc.data() }));
    return items;
  } catch (err: any) {
    console.warn("Firestore getAllUsers warning. Fallback active.", err.message || err);
    return Object.keys(memUsers).map(id => ({ id, ...memUsers[id] }));
  }
}

