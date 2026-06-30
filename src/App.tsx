import { useState, useEffect } from "react";
import { Plus, Flame, Sparkles } from "lucide-react";
import LandingPage from "./components/LandingPage";
import SamayLogo from "./components/SamayLogo";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import Dashboard from "./components/Dashboard";
import Briefing from "./components/Briefing";
import BillTracker from "./components/BillTracker";
import PanicMode from "./components/PanicMode";
import AddTask from "./components/AddTask";
import Settings from "./components/Settings";
import AIChat from "./components/AIChat";
import ContactUs from "./components/ContactUs";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { Task, Bill, AIScheduleItem, UserSettings } from "./types";
import { auth, db, googleProvider } from "./lib/firebase";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, updateDoc, deleteDoc } from "firebase/firestore";

// Helper to wrap Firestore operations in a fast timeout to prevent page-load freeze in sandboxed iframes
function withTimeout<T>(promise: Promise<T>, ms: number = 1200): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Failed to get document because the client is offline.")), ms)
    ),
  ]);
}

export default function App() {
  const [view, setView] = useState<string>("landing");
  const [activeSessionTask, setActiveSessionTask] = useState<string | null>(null);

  // Core synchronized server-side state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState<boolean>(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [schedule, setSchedule] = useState<AIScheduleItem[]>([]);
  const [settings, setSettings] = useState<UserSettings>({
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
  });

  // Fetch all initial data from our custom APIs
  const loadData = async () => {
    try {
      const uid = auth.currentUser?.uid || user?.uid || "";
      const [tasksRes, billsRes, scheduleRes, settingsRes] = await Promise.all([
        fetch(`/api/tasks?userId=${uid}`),
        fetch(`/api/bills?userId=${uid}`),
        fetch(`/api/schedule?userId=${uid}`),
        fetch(`/api/settings?userId=${uid}`),
      ]);

      const tasksJson = tasksRes.ok && tasksRes.headers.get("content-type")?.includes("application/json") ? await tasksRes.json() : null;
      const billsJson = billsRes.ok && billsRes.headers.get("content-type")?.includes("application/json") ? await billsRes.json() : null;
      const scheduleJson = scheduleRes.ok && scheduleRes.headers.get("content-type")?.includes("application/json") ? await scheduleRes.json() : null;
      const settingsJson = settingsRes.ok && settingsRes.headers.get("content-type")?.includes("application/json") ? await settingsRes.json() : null;

      if (tasksJson) setTasks(tasksJson);
      if (billsJson) setBills(billsJson);
      if (scheduleJson) setSchedule(scheduleJson);
      if (settingsJson) setSettings(settingsJson);
    } catch (err) {
      console.warn("API Fetch Error: falling back to standalone state.", err);
    }
  };

  // Auth states
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Global in-app toast (replaces browser alert())
  const [appToast, setAppToast] = useState<{ message: string; type: 'success' | 'info' | 'warning' | 'error' } | null>(null);
  useEffect(() => {
    if (!appToast) return;
    const t = setTimeout(() => setAppToast(null), 4000);
    return () => clearTimeout(t);
  }, [appToast]);

  const seedDefaultTasksForUser = async (uid: string) => {
    const initialTasks = [
      {
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

    const seeded: Task[] = [];
    for (const t of initialTasks) {
      const docId = `task-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const taskData = {
        id: docId,
        ...t,
        title: t.name,
        deadline: t.dueDate,
        status: t.completed ? "completed" : "pending",
        createdAt: serverTimestamp(),
        userId: uid,
      };
      await setDoc(doc(db, "tasks", docId), taskData);
      // Construct a mapped task for local state
      seeded.push({
        id: docId,
        ...t,
        title: t.name,
        deadline: t.dueDate,
        status: t.completed ? "completed" : "pending",
        userId: uid,
      } as unknown as Task);
    }
    return seeded;
  };

  const loadTasksFromFirestore = async (uid: string) => {
    setTasksLoading(true);
    setTasksError(null);
    try {
      const q = query(
        collection(db, "tasks"),
        where("userId", "==", uid)
      );
      const querySnapshot = await withTimeout(getDocs(q), 1200);
      let list = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const name = data.title || data.name || "";
        const dueDate = data.deadline || data.dueDate || new Date().toISOString().split("T")[0];
        const completed = data.status === "completed" || data.completed === true;
        return {
          id: doc.id,
          ...data,
          name,
          dueDate,
          completed,
        } as Task;
      });

      if (list.length === 0) {
        list = await seedDefaultTasksForUser(uid);
      }

      list.sort((a, b) => {
        const dateA = a.dueDate + "T" + (a.time || "00:00");
        const dateB = b.dueDate + "T" + (b.time || "00:00");
        return dateA.localeCompare(dateB);
      });

      setTasks(list);
    } catch (err: any) {
      const isOffline = err && err.message && (err.message.includes("offline") || err.message.includes("Failed to get document"));
      if (isOffline) {
        console.warn("Firestore offline during task load, falling back to server API:", err.message);
      } else {
        console.error("Error loading tasks from Firestore:", err);
      }
      
      // Fallback to Express backend tasks API in case client Firestore is offline
      try {
        const res = await fetch(`/api/tasks?userId=${uid}`);
        if (res.ok) {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const list = await res.json();
            list.sort((a: Task, b: Task) => {
              const dateA = a.dueDate + "T" + (a.time || "00:00");
              const dateB = b.dueDate + "T" + (b.time || "00:00");
              return dateA.localeCompare(dateB);
            });
            setTasks(list);
            return;
          }
        }
      } catch (apiErr) {
        console.warn("API task load fallback failed:", apiErr);
      }
      
      // Only report tasksError if both fail
      setTasksError(err.message || "Failed to load tasks from Firestore.");
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        let profileData = null;
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDoc = await withTimeout(getDoc(userDocRef), 1200);
          if (!userDoc.exists()) {
            profileData = {
              uid: currentUser.uid,
              displayName: currentUser.displayName || "Anonymous User",
              email: currentUser.email || "",
              photoURL: currentUser.photoURL || "",
              streak: 12,
              streakLevel: 4,
              completedDays: ["Mon", "Tue"],
              createdAt: serverTimestamp(),
            };
            await setDoc(userDocRef, profileData);
          } else {
            profileData = userDoc.data();
          }
          setUserProfile(profileData);
        } catch (err: any) {
          const isOffline = err && err.message && (err.message.includes("offline") || err.message.includes("Failed to get document"));
          if (isOffline) {
            console.warn("Firestore offline during user check, using fallback:", err.message);
          } else {
            console.error("Error creating/checking user doc:", err);
          }
          // Safe fallback in-memory so login is never blocked
          profileData = {
            uid: currentUser.uid,
            displayName: currentUser.displayName || "Anonymous User",
            email: currentUser.email || "",
            photoURL: currentUser.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
            streak: 12,
            streakLevel: 4,
            completedDays: ["Mon", "Tue"],
            createdAt: new Date().toISOString(),
          };
          setUserProfile(profileData);
        }
        
        // Load settings from Firestore on login
        try {
          const settingsDocRef = doc(db, "settings", currentUser.uid);
          const settingsDoc = await withTimeout(getDoc(settingsDocRef), 1200);
          if (settingsDoc.exists()) {
            const loadedSettings = settingsDoc.data() as UserSettings;
            if (!loadedSettings.googleAccountEmail || loadedSettings.googleAccountEmail === "rahul@gmail.com") {
              loadedSettings.googleAccountEmail = currentUser.email || "";
            }
            setSettings(prev => ({ ...prev, ...loadedSettings }));
            await fetch("/api/settings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...loadedSettings, userId: currentUser.uid }),
            });
          } else {
            // No settings doc, fetch from server API
            const res = await fetch(`/api/settings?userId=${currentUser.uid}`);
            if (res.ok) {
              const loadedSettings = await res.json();
              if (!loadedSettings.googleAccountEmail || loadedSettings.googleAccountEmail === "rahul@gmail.com") {
                loadedSettings.googleAccountEmail = currentUser.email || "";
              }
              setSettings(prev => ({ ...prev, ...loadedSettings }));
            }
          }
        } catch (settingsErr: any) {
          const isOffline = settingsErr && settingsErr.message && (settingsErr.message.includes("offline") || settingsErr.message.includes("Failed to get document"));
          if (isOffline) {
            console.warn("Firestore offline during settings load, falling back to server API:", settingsErr.message);
          } else {
            console.error("Error loading settings during auth change, falling back to server API:", settingsErr);
          }
          try {
            const res = await fetch(`/api/settings?userId=${currentUser.uid}`);
            if (res.ok) {
              const loadedSettings = await res.json();
              setSettings(prev => ({ ...prev, ...loadedSettings }));
            }
          } catch (apiErr) {
            console.error("Server settings API fallback failed:", apiErr);
          }
        }

        loadData();
        await loadTasksFromFirestore(currentUser.uid);
        setView((prev) => (prev === "landing" || prev === "login" || prev === "register" ? "dashboard" : prev));
      } else {
        setUser(prevUser => {
          // If the previous user is a sandbox demo user, do not clear the user!
          if (prevUser && (prevUser.isSandbox || prevUser.uid === "sandbox-demo-user-123")) {
            return prevUser;
          }
          setUserProfile(null);
          setView("landing");
          return null;
        });
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDemoLogin = async () => {
    setAuthError(null);
    setAuthLoading(true);
    
    const demoUser = {
      uid: "sandbox-demo-user-123",
      displayName: "Demo User",
      email: "demo@samay.ai",
      photoURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
      isSandbox: true,
    };

    setUser(demoUser);
    setUserProfile({
      uid: demoUser.uid,
      displayName: demoUser.displayName,
      email: demoUser.email,
      photoURL: demoUser.photoURL,
      streak: 15,
      streakLevel: 5,
      completedDays: ["Mon", "Tue", "Wed"],
      createdAt: new Date().toISOString(),
    });

    try {
      const settingsRes = await fetch("/api/settings");
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings(prev => ({ ...prev, ...settingsData }));
      }
    } catch (e) {
      console.warn("Could not fetch settings for demo mode:", e);
    }

    try {
      const tasksRes = await fetch(`/api/tasks?userId=${demoUser.uid}`);
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData);
      }
    } catch (e) {
      console.warn("Could not fetch tasks for demo mode:", e);
    }

    setView("dashboard");
    setAuthLoading(false);
  };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const currentUser = result.user;
      
      let profileData = null;
      try {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await withTimeout(getDoc(userDocRef), 1200);
        if (!userDoc.exists()) {
          profileData = {
            uid: currentUser.uid,
            displayName: currentUser.displayName || "Anonymous User",
            email: currentUser.email || "",
            photoURL: currentUser.photoURL || "",
            streak: 12,
            streakLevel: 4,
            completedDays: ["Mon", "Tue"],
            createdAt: serverTimestamp(),
          };
          await setDoc(userDocRef, profileData);
        } else {
          profileData = userDoc.data();
        }
      } catch (dbErr) {
        console.warn("Firestore user check failed on Google login, using memory fallback:", dbErr);
        profileData = {
          uid: currentUser.uid,
          displayName: currentUser.displayName || "Anonymous User",
          email: currentUser.email || "",
          photoURL: currentUser.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
          streak: 12,
          streakLevel: 4,
          completedDays: ["Mon", "Tue"],
          createdAt: new Date().toISOString(),
        };
      }
      
      setUser(currentUser);
      setUserProfile(profileData);
      setView("dashboard");

      // Load settings from Firestore on Google Login
      try {
        const settingsDocRef = doc(db, "settings", currentUser.uid);
        const settingsDoc = await withTimeout(getDoc(settingsDocRef), 1200);
        if (settingsDoc.exists()) {
          const loadedSettings = settingsDoc.data() as UserSettings;
          setSettings(prev => ({ ...prev, ...loadedSettings }));
          await fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...loadedSettings, userId: currentUser.uid }),
          });
        } else {
          // Fallback settings load from REST API
          const res = await fetch(`/api/settings?userId=${currentUser.uid}`);
          if (res.ok) {
            const loadedSettings = await res.json();
            setSettings(prev => ({ ...prev, ...loadedSettings }));
          }
        }
      } catch (settingsErr: any) {
        const isOffline = settingsErr && settingsErr.message && (settingsErr.message.includes("offline") || settingsErr.message.includes("Failed to get document"));
        if (isOffline) {
          console.warn("Firestore offline during Google login settings load, falling back to server API:", settingsErr.message);
        } else {
          console.error("Error loading settings during Google login, falling back to server API:", settingsErr);
        }
        try {
          const res = await fetch(`/api/settings?userId=${currentUser.uid}`);
          if (res.ok) {
            const loadedSettings = await res.json();
            setSettings(prev => ({ ...prev, ...loadedSettings }));
          }
        } catch (apiErr) {
          console.error("Server settings API fallback failed:", apiErr);
        }
      }

      loadData();
      await loadTasksFromFirestore(currentUser.uid);
    } catch (err: any) {
      console.error("Google Authentication Error:", err);
      if (err.code === "auth/popup-closed-by-user" || (err.message && err.message.includes("popup-closed-by-user"))) {
        setAuthError("Sign-in was cancelled. Please keep the sign-in window open to connect your account.");
      } else if (err.code === "auth/cancelled-popup-request" || (err.message && err.message.includes("cancelled-popup-request"))) {
        setAuthError("Sign-in is already in progress. Please focus on the opened window.");
      } else if (err.code === "auth/configuration-not-found" || (err.message && err.message.includes("configuration-not-found"))) {
        setAuthError("Google Sign-In is not enabled on this Firebase project. To fix this, please enable Google Auth in your Firebase Console under 'Authentication > Sign-in method'. Or, use Sandbox Mode below to test the website instantly!");
      } else if (err.code === "auth/unauthorized-domain" || (err.message && err.message.includes("unauthorized-domain"))) {
        setAuthError("This domain is not authorized for Google Sign-In. To fix this, please add 'ais-dev-5wgcvk2lrucpmeryzckdyg-199027362609.asia-east1.run.app' and 'ais-pre-5wgcvk2lrucpmeryzckdyg-199027362609.asia-east1.run.app' to your 'Authorized domains' list in the Firebase Console (under Authentication > Settings). Alternatively, click 'Launch Sandbox Mode' below to test the complete website instantly!");
      } else {
        setAuthError(err.message || "Authentication failed. Please try again.");
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setView("landing");
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  const handleNavigate = async (newView: string) => {
    if (newView === "landing") {
      await handleLogout();
    } else {
      const protectedViews = ["dashboard", "add-task", "briefing", "bills", "settings", "panic", "chat"];
      if (!user && protectedViews.includes(newView)) {
        setView("login");
      } else {
        setView(newView);
      }
    }
  };

  // Synchronized Event Handlers
  const handleToggleTask = async (id: string) => {
    const target = tasks.find(t => t.id === id);
    if (!target) return;
    const nextCompleted = !target.completed;

    if (user && !user.isSandbox) {
      try {
        const taskRef = doc(db, "tasks", id);
        await updateDoc(taskRef, {
          completed: nextCompleted,
          status: nextCompleted ? "completed" : "pending",
          overdue: nextCompleted ? false : target.overdue,
        });
      } catch (dbErr) {
        console.warn("Client-side Firestore toggle task failed:", dbErr);
      }
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed: nextCompleted, status: nextCompleted ? "completed" : "pending", overdue: nextCompleted ? false : t.overdue } : t))
      );
      try {
        await fetch("/api/tasks/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, userId: user?.uid || "rahul-uid" }),
        });
      } catch (apiErr) {
        console.warn("Failed to sync toggle task with backend:", apiErr);
      }
      return;
    }

    try {
      const res = await fetch("/api/tasks/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, userId: user?.uid || "rahul-uid" }),
      });
      const data = await res.json();
      if (data.tasks) {
        const list = data.tasks.map((t: any) => {
          const name = t.name || t.title || "";
          const dueDate = t.dueDate || t.deadline || new Date().toISOString().split("T")[0];
          return { ...t, name, dueDate };
        });
        setTasks(list);
        return;
      }
    } catch (apiErr) {
      console.error("Failed to sync toggle task with backend REST API:", apiErr);
    }

    // Local fallback state update
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: nextCompleted, status: nextCompleted ? "completed" : "pending", overdue: nextCompleted ? false : t.overdue } : t))
    );
  };

  const handleSnoozeTask = async (id: string) => {
    const target = tasks.find(t => t.id === id);
    if (!target) return;
    const nextHours = Math.max(0, (target.hoursLate ?? 0) - 1);

    if (user && !user.isSandbox) {
      try {
        const taskRef = doc(db, "tasks", id);
        await updateDoc(taskRef, {
          hoursLate: nextHours,
        });
      } catch (dbErr) {
        console.warn("Client-side Firestore snooze task failed:", dbErr);
      }
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, hoursLate: nextHours } : t))
      );
      try {
        await fetch("/api/tasks/snooze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, userId: user?.uid || "rahul-uid" }),
        });
      } catch (apiErr) {
        console.warn("Failed to sync snooze task with backend:", apiErr);
      }
      return;
    }

    try {
      const res = await fetch("/api/tasks/snooze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, userId: user?.uid || "rahul-uid" }),
      });
      const data = await res.json();
      if (data.tasks) {
        const list = data.tasks.map((t: any) => {
          const name = t.name || t.title || "";
          const dueDate = t.dueDate || t.deadline || new Date().toISOString().split("T")[0];
          return { ...t, name, dueDate };
        });
        setTasks(list);
        return;
      }
    } catch (apiErr) {
      console.error("Failed to sync snooze task with backend REST API:", apiErr);
    }

    // Local fallback state update
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, hoursLate: nextHours } : t))
    );
  };

  const handleDeleteTask = async (id: string) => {
    const target = tasks.find(t => t.id === id);
    if (!target) return;

    if (user && !user.isSandbox) {
      try {
        const taskRef = doc(db, "tasks", id);
        await deleteDoc(taskRef);
      } catch (dbErr) {
        console.warn("Client-side Firestore delete task failed:", dbErr);
      }
      setTasks((prev) => prev.filter((t) => t.id !== id));
      try {
        await fetch("/api/tasks/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, userId: user?.uid || "rahul-uid" }),
        });
      } catch (apiErr) {
        console.warn("Failed to sync delete task with backend:", apiErr);
      }
      return;
    }

    try {
      const res = await fetch("/api/tasks/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, userId: user?.uid || "rahul-uid" }),
      });
      const data = await res.json();
      if (data.tasks) {
        const list = data.tasks.map((t: any) => {
          const name = t.name || t.title || "";
          const dueDate = t.dueDate || t.deadline || new Date().toISOString().split("T")[0];
          return { ...t, name, dueDate };
        });
        setTasks(list);
        return;
      }
    } catch (apiErr) {
      console.error("Failed to sync delete task with backend REST API:", apiErr);
    }

    // Local fallback state update
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleToggleBill = async (id: string) => {
    try {
      const res = await fetch("/api/bills/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.bills) {
        setBills(data.bills);
      }
    } catch (err) {
      console.error("Failed to toggle bill on backend:", err);
      setBills((prev) =>
        prev.map((b) => (b.id === id ? { ...b, completed: !b.completed } : b))
      );
    }
  };

  const handleAddTask = async (newTask: Omit<Task, "id" | "completed" | "overdue">) => {
    if (!user) return;
    const docId = `task-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const taskData = {
      id: docId,
      title: newTask.name,
      name: newTask.name,
      category: newTask.category,
      deadline: newTask.dueDate,
      dueDate: newTask.dueDate,
      time: newTask.time || "12:00",
      difficulty: newTask.difficulty,
      notes: newTask.notes || "",
      status: "pending",
      completed: false,
      overdue: false,
      createdAt: serverTimestamp(),
      userId: user.uid,
    };

    if (!user.isSandbox) {
      try {
        await setDoc(doc(db, "tasks", docId), taskData);
      } catch (dbErr) {
        console.warn("Client-side Firestore task save failed, syncing with backend:", dbErr);
      }
    }

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: docId,
          name: newTask.name,
          dueDate: newTask.dueDate,
          time: newTask.time,
          category: newTask.category,
          difficulty: newTask.difficulty,
          notes: newTask.notes,
          userId: user.uid
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        const mappedSaved = {
          ...saved,
          id: saved.id || docId,
          name: saved.name || saved.title || newTask.name,
          dueDate: saved.dueDate || saved.deadline || newTask.dueDate,
          userId: user.uid,
        };
        setTasks((prev) => {
          const list = [...prev.filter(t => t.id !== docId && t.id !== saved.id), mappedSaved];
          list.sort((a, b) => {
            const dateA = a.dueDate + "T" + (a.time || "00:00");
            const dateB = b.dueDate + "T" + (b.time || "00:00");
            return dateA.localeCompare(dateB);
          });
          return list;
        });
        return;
      }
    } catch (apiErr) {
      console.error("Failed to sync new task with backend REST API:", apiErr);
    }

    // Local fallback state update
    setTasks((prev) => {
      const list = [...prev, {
        id: docId,
        ...newTask,
        title: newTask.name,
        deadline: newTask.dueDate,
        status: "pending",
        completed: false,
        overdue: false,
        userId: user.uid,
      } as Task];
      list.sort((a, b) => {
        const dateA = a.dueDate + "T" + (a.time || "00:00");
        const dateB = b.dueDate + "T" + (b.time || "00:00");
        return dateA.localeCompare(dateB);
      });
      return list;
    });
  };

  const handleAddMultipleTasks = async (newTasks: Omit<Task, "id" | "completed" | "overdue">[]) => {
    for (const task of newTasks) {
      await handleAddTask(task);
    }
    if (user) {
      await loadTasksFromFirestore(user.uid);
    }
  };

  const handleUpdateSettings = async (newSettings: Partial<UserSettings>) => {
    if (user && !user.isSandbox) {
      try {
        const settingsDocRef = doc(db, "settings", user.uid);
        await setDoc(settingsDocRef, newSettings, { merge: true });
        
        // Also update the main user profile/preferences for safety
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, { settings: newSettings }, { merge: true });
      } catch (dbErr) {
        console.warn("Client-side Firestore settings save failed, syncing with backend:", dbErr);
      }
    }

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newSettings, userId: user?.uid }),
      });
      const updated = await res.json();
      setSettings(updated);
    } catch (err) {
      console.error("Failed to update settings via REST API:", err);
      setSettings((prev) => ({ ...prev, ...newSettings }));
    }
  };

  const handleReoptimizeSchedule = async () => {
    try {
      const res = await fetch("/api/schedule/reoptimize", { method: "POST" });
      const data = await res.json();
      if (data.schedule) {
        setSchedule(data.schedule);
      }
    } catch (err) {
      console.error("Failed to reoptimize schedule:", err);
    }
  };

  const handleStartActiveSession = (taskName: string) => {
    setAppToast({
      type: 'success',
      message: `🎯 Focus System Initialized! Target: "${taskName}" — Locked in for 30 minutes. Let's make this count.`,
    });
    setActiveSessionTask(taskName);
    setView("panic");
  };

  // Compute number of overdue tasks
  const overdueCount = tasks.filter((t) => !t.completed).length;

  // View Routing
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex flex-col items-center justify-center gap-4 text-white">
        <div className="w-12 h-12 rounded-full border-t-2 border-[#4F46E5] animate-spin"></div>
        <p className="font-mono text-xs text-gray-500 uppercase tracking-widest">Initializing Secure Connection...</p>
      </div>
    );
  }

  if (view === "landing") {
    return (
      <LandingPage 
        onStart={() => {
          setAuthError(null);
          setView("login");
        }} 
        onNavigate={handleNavigate}
        error={authError}
      />
    );
  }

  if (view === "contact" && !user) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] text-white selection:bg-[#4F46E5]/30">
        <header className="sticky top-0 w-full z-50 bg-[#0F0F0F]/80 backdrop-blur-md border-b border-[#2E2E2E] px-6 py-4">
          <div className="flex items-center justify-between max-w-5xl mx-auto">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView("landing")}>
              <SamayLogo size={32} showText={true} textColor="text-[#2172CD]" textSize="text-sm font-extrabold tracking-tight" disableZoom={true} />
            </div>
            <button 
              onClick={() => setView("login")}
              className="bg-[#1A1A1A] border border-[#2E2E2E] px-4 py-2 rounded-lg font-mono text-xs hover:bg-[#242424] transition-colors duration-200 active:scale-95 cursor-pointer"
            >
              Login
            </button>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 pt-12">
          <ContactUs 
            onNavigate={(v) => setView(v === "dashboard" ? "landing" : v)} 
            user={null} 
            userProfile={null} 
          />
        </main>
      </div>
    );
  }

  if (view === "login") {
    return (
      <LoginPage
        onNavigate={setView}
        onGoogleLogin={handleGoogleLogin}
        onDemoLogin={handleDemoLogin}
        error={authError}
        setError={setAuthError}
      />
    );
  }

  if (view === "register") {
    return (
      <RegisterPage
        onNavigate={setView}
        onGoogleLogin={handleGoogleLogin}
        onDemoLogin={handleDemoLogin}
        error={authError}
        setError={setAuthError}
      />
    );
  }

  return (
    <ProtectedRoute user={user} authLoading={authLoading} onRedirect={setView}>
      <Layout 
        activeView={view} 
        onNavigate={handleNavigate} 
        overdueCount={overdueCount}
        user={user}
        userProfile={userProfile}
      >
        {view === "dashboard" && (
          <Dashboard
            tasks={tasks}
            bills={bills}
            schedule={schedule}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
            onNavigate={handleNavigate}
            onStartSession={handleStartActiveSession}
            userProfile={userProfile}
            tasksLoading={tasksLoading}
            tasksError={tasksError}
          />
        )}

        {view === "briefing" && (
          <Briefing 
            tasks={tasks}
            onStartSession={handleStartActiveSession}
            onNavigate={handleNavigate}
            userProfile={userProfile}
          />
        )}

        {view === "bills" && (
          <BillTracker
            bills={bills}
            onToggleBill={handleToggleBill}
            onNavigate={handleNavigate}
            onAddBillClick={() => handleNavigate("add-task")}
            userProfile={userProfile}
          />
        )}

        {view === "panic" && (
          <PanicMode
            tasks={tasks}
            onToggleTask={handleToggleTask}
            onSnoozeTask={handleSnoozeTask}
            onDeleteTask={handleDeleteTask}
            onReoptimize={handleReoptimizeSchedule}
            onNavigate={handleNavigate}
            activeSessionTask={activeSessionTask}
            onClearActiveSession={() => setActiveSessionTask(null)}
          />
        )}

        {view === "add-task" && (
          <AddTask
            onAddTask={handleAddTask}
            onAddMultipleTasks={handleAddMultipleTasks}
            onNavigate={handleNavigate}
          />
        )}

        {view === "settings" && (
          <Settings
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onNavigate={handleNavigate}
          />
        )}

        {view === "chat" && (
          <AIChat 
            onNavigate={handleNavigate}
            userProfile={userProfile}
            tasks={tasks}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
          />
        )}

        {view === "contact" && (
          <ContactUs
            onNavigate={handleNavigate}
            user={user}
            userProfile={userProfile}
          />
        )}

        {/* Floating Action Button (Only on Dashboard and Briefing Views) */}
        {(view === "dashboard" || view === "briefing" || view === "bills") && (
          <button
            id="global-fab-add"
            onClick={() => handleNavigate("add-task")}
            className="fixed bottom-24 right-6 w-14 h-14 bg-[#4F46E5] hover:scale-105 active:scale-95 text-white rounded-full flex items-center justify-center shadow-xl shadow-[#4F46E5]/30 hover:shadow-[#4F46E5]/50 transition-all z-40 cursor-pointer border border-[#c3c0ff]/10"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>
        )}
      </Layout>

      {/* ── Global App Toast ─────────────────────────────────────────────── */}
      {appToast && (
        <div
          style={{
            position: 'fixed',
            top: '5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            minWidth: '280px',
            maxWidth: '480px',
            padding: '12px 18px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            animation: 'slideDownFade 0.28s ease',
            background: appToast.type === 'error' ? '#1f0808'
              : appToast.type === 'warning' ? '#1f1500'
              : appToast.type === 'success' ? '#081f11'
              : '#0d0d1f',
            border: `1px solid ${
              appToast.type === 'error' ? '#ef444430'
              : appToast.type === 'warning' ? '#f59e0b30'
              : appToast.type === 'success' ? '#22c55e30'
              : '#4F46E530'
            }`,
          }}
        >
          <span style={{ fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>
            {appToast.type === 'error' ? '❌'
              : appToast.type === 'warning' ? '⚠️'
              : appToast.type === 'success' ? '✅'
              : 'ℹ️'}
          </span>
          <p style={{
            margin: 0,
            fontSize: '12px',
            lineHeight: '1.55',
            fontFamily: 'sans-serif',
            color: appToast.type === 'error' ? '#fca5a5'
              : appToast.type === 'warning' ? '#fcd34d'
              : appToast.type === 'success' ? '#86efac'
              : '#c3c0ff',
          }}>
            {appToast.message}
          </p>
          <button
            onClick={() => setAppToast(null)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: '#6b7280',
              cursor: 'pointer',
              fontSize: '14px',
              lineHeight: 1,
              flexShrink: 0,
              padding: '0 2px',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </ProtectedRoute>
  );
}
