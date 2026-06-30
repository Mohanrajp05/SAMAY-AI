import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ArrowLeft, User, Bell, Shield, Sliders, Calendar, Send, Mail, CheckCircle, Copy } from "lucide-react";
import { UserSettings } from "../types";
import { auth, db } from "../lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

interface SettingsProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onNavigate: (view: string) => void;
}

export default function Settings({
  settings,
  onUpdateSettings,
  onNavigate,
}: SettingsProps) {
  const [role, setRole] = useState(settings.role);
  const [personalityMode, setPersonalityMode] = useState(settings.personalityMode);
  const [morningBriefingEnabled, setMorningBriefingEnabled] = useState(settings.morningBriefingEnabled);
  const [panicModeAlertsEnabled, setPanicModeAlertsEnabled] = useState(settings.panicModeAlertsEnabled);
  const [telegramConnected, setTelegramConnected] = useState(settings.telegramConnected);
  const [emailConnected, setEmailConnected] = useState(settings.emailConnected);
  const [planningStyle, setPlanningStyle] = useState(settings.planningStyle);
  const [startHour, setStartHour] = useState(settings.startHour);
  const [endHour, setEndHour] = useState(settings.endHour);
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(settings.googleCalendarConnected);
  const [googleAccountEmail, setGoogleAccountEmail] = useState(settings.googleAccountEmail);
  const [telegramChatId, setTelegramChatId] = useState("");
  const [notification, setNotification] = useState<string | null>(null);

  // Telegram connection state machine: 'idle' | 'waiting' | 'success' | 'error'
  type TgFlowState = 'idle' | 'waiting' | 'success' | 'error';
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [tgFlowState, setTgFlowState] = useState<TgFlowState>('idle');
  const [tgErrorMsg, setTgErrorMsg] = useState<string>("");
  // Always use the real Firebase UID; never fall back to a test/seed UID
  const userId = auth.currentUser?.uid ?? "";
  // Bot username loaded dynamically from server so it's never hardcoded
  const [botUsername, setBotUsername] = useState<string>("SamayAssistant_bot");

  // States for high-security multi-user data isolation test suite
  const [copied, setCopied] = useState(false);
  const [isVerifyingIsolation, setIsVerifyingIsolation] = useState(false);
  const [isolationTestResults, setIsolationTestResults] = useState<any | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Load the bot username from the server (avoids hardcoding in the front-end)
  useEffect(() => {
    fetch("/api/telegram/config")
      .then((r) => r.json())
      .then((data) => { if (data.botUsername) setBotUsername(data.botUsername); })
      .catch(() => { /* keep default */ });
  }, []);

  // Synchronize custom email and Telegram Chat ID from the user document
  useEffect(() => {
    if (!auth.currentUser) return;

    // Load from server fallback immediately
    const loadProfile = async () => {
      try {
        const res = await fetch(`/api/users/profile?userId=${auth.currentUser?.uid}`);
        if (res.ok) {
          const data = await res.json();
          if (data.telegramChatId) {
            setTelegramChatId(data.telegramChatId);
          }
          if (data.email && !googleAccountEmail) {
            setGoogleAccountEmail(data.email);
          }
        }
      } catch (err) {
        console.error("Error fetching user profile from server fallback:", err);
      }
    };
    loadProfile();

    const userDocRef = doc(db, "users", auth.currentUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.telegramChatId) {
          setTelegramChatId(data.telegramChatId);
        }
        if (data.email && !googleAccountEmail) {
          setGoogleAccountEmail(data.email);
        }
      }
    }, (error) => {
      console.error("Error loading user credentials in Settings:", error);
    });
    return () => unsubscribe();
  }, []);

  // ── Telegram connection polling ──────────────────────────────────────────────
  useEffect(() => {
    // Only poll when the modal is open AND the user has clicked "Open Telegram"
    if (!showTelegramModal || tgFlowState !== 'waiting' || !auth.currentUser) return;

    let isActive = true;

    // ── 90-second hard timeout ────────────────────────────────────────────────
    const timeoutId = setTimeout(() => {
      if (!isActive) return;
      isActive = false;
      setTgFlowState('error');
      setTgErrorMsg(
        "No response received after 90 seconds. Please check that you pressed Start in the bot, then try again."
      );
    }, 90_000);

    // ── Server-poll every 2 s ─────────────────────────────────────────────────
    const pollInterval = setInterval(async () => {
      if (!isActive) return;
      try {
        const res = await fetch(`/api/users/profile?userId=${auth.currentUser?.uid}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.telegramConnected) {
          isActive = false;
          clearTimeout(timeoutId);
          clearInterval(pollInterval);
          if (data.telegramChatId) setTelegramChatId(data.telegramChatId);
          setTgFlowState('success');
          setTelegramConnected(true);
          onUpdateSettings({ telegramConnected: true });
          // Auto-close modal after 2.5 s so the user can see the success state
          setTimeout(() => {
            setShowTelegramModal(false);
            setTgFlowState('idle');
            setNotification("Telegram connected successfully. You will now receive all future alerts.");
          }, 2500);
        }
      } catch {
        // network hiccup – keep polling
      }
    }, 2000);

    // ── Firestore live listener (fires immediately if already connected) ───────
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    const unsubscribeFirestore = onSnapshot(
      userDocRef,
      (snapshot) => {
        if (!isActive) return;
        if (snapshot.exists() && snapshot.data()?.telegramConnected) {
          isActive = false;
          clearTimeout(timeoutId);
          clearInterval(pollInterval);
          const d = snapshot.data()!;
          if (d.telegramChatId) setTelegramChatId(d.telegramChatId);
          setTgFlowState('success');
          setTelegramConnected(true);
          onUpdateSettings({ telegramConnected: true });
          setTimeout(() => {
            setShowTelegramModal(false);
            setTgFlowState('idle');
            setNotification("Telegram connected successfully. You will now receive all future alerts.");
          }, 2500);
        }
      },
      () => { /* Firestore unavailable – the server poll covers us */ }
    );

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
      clearInterval(pollInterval);
      unsubscribeFirestore();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTelegramModal, tgFlowState]);


  const handleSave = async () => {
    const updated = {
      role,
      personalityMode,
      morningBriefingEnabled,
      panicModeAlertsEnabled,
      telegramConnected: telegramConnected || (telegramChatId ? true : false),
      emailConnected,
      planningStyle,
      startHour,
      endHour,
      googleCalendarConnected,
      googleAccountEmail,
    };
    onUpdateSettings(updated);

    // Save customized email and Telegram Chat ID to Firestore users collection
    if (auth.currentUser) {
      try {
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        await setDoc(userDocRef, {
          email: googleAccountEmail,
          telegramChatId: telegramChatId,
          telegramConnected: telegramConnected || (telegramChatId ? true : false),
        }, { merge: true });
      } catch (err) {
        console.error("Failed to save user credentials directly to Firestore:", err);
      }

      // Sync user profile to backend local DB fallback
      try {
        await fetch("/api/users/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: auth.currentUser.uid,
            email: googleAccountEmail,
            telegramChatId: telegramChatId,
            telegramConnected: telegramConnected || (telegramChatId ? true : false),
          }),
        });
      } catch (serverErr) {
        console.error("Failed to sync user credentials with server fallback:", serverErr);
      }
    }

    setNotification("System Overrides Saved! Personality matrices updated successfully.");
    setTimeout(() => {
      onNavigate("dashboard");
    }, 1200);
  };

  const handleTestTelegram = async () => {
    try {
      const res = await fetch("/api/telegram/test-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: auth.currentUser?.uid || "" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(data.message);
      } else {
        setNotification(data.error || "Failed to trigger Telegram alert.");
      }
    } catch (err) {
      setNotification("Failed to connect to Telegram push API.");
    }
  };

  const handleTestEmail = async () => {
    try {
      const res = await fetch("/api/email/test-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: auth.currentUser?.uid || "",
          email: googleAccountEmail || auth.currentUser?.email || ""
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(data.message);
      } else {
        setNotification(data.error || "Failed to trigger Email alert.");
      }
    } catch (err) {
      setNotification("Failed to connect to Email push API.");
    }
  };

  const handleSyncCalendar = async () => {
    try {
      const res = await fetch("/api/calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: googleAccountEmail || auth.currentUser?.email || "",
          userId: auth.currentUser?.uid || ""
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification(data.message);
      } else {
        setNotification(data.error || "Google Calendar sync failed.");
      }
    } catch (err) {
      setNotification("Failed to connect to Google Calendar API.");
    }
  };

  const handleVerifyIsolation = async () => {
    setIsVerifyingIsolation(true);
    setIsolationTestResults(null);
    try {
      const res = await fetch("/api/test/verify-isolation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok) {
        setIsolationTestResults(data);
        setNotification("✓ Security Isolation Verification Complete!");
      } else {
        setNotification(data.error || "Isolation verification failed.");
      }
    } catch (err) {
      setNotification("Verification service connection error.");
    } finally {
      setIsVerifyingIsolation(false);
    }
  };

  return (
    <div id="settings-view" className="space-y-6 max-w-3xl mx-auto pb-24 relative">
      {/* Toast Notification */}
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 bg-[#4F46E5] text-white font-sans text-xs font-bold px-4 py-2.5 rounded-lg shadow-xl border border-[#c3c0ff]/30 z-50 flex items-center gap-2"
        >
          <Sliders className="w-3.5 h-3.5 text-white animate-pulse" />
          {notification}
        </motion.div>
      )}
      {/* Settings Title Header */}
      <section className="flex items-center gap-3 px-1">
        <button
          onClick={() => onNavigate("dashboard")}
          className="w-10 h-10 flex items-center justify-center rounded-full border border-[#2E2E2E] hover:bg-gray-800 active:scale-95 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#c3c0ff]" />
        </button>
        <div>
          <h2 className="font-sans font-extrabold text-2xl text-white tracking-tight">Settings</h2>
          <p className="font-mono text-[10px] text-gray-500 uppercase font-semibold mt-1">Settings - SamayAI</p>
        </div>
      </section>

      {/* Your Role Section */}
      <section className="bg-[#1A1A1A] border border-[#2E2E2E] p-5 rounded-xl space-y-3">
        <h3 className="font-mono text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
          <User className="w-4 h-4 text-[#4F46E5]" /> Your Role
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {(["Student", "Professional", "Founder", "Hybrid"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`py-3 rounded-lg border text-xs font-sans font-bold transition-all cursor-pointer ${role === r
                ? "bg-[#4F46E5]/10 border-[#4F46E5] text-[#c3c0ff]"
                : "bg-transparent border-[#2E2E2E] text-gray-400 hover:border-gray-600"
                }`}
            >
              {r}
            </button>
          ))}
        </div>
      </section>

      {/* AI Personality Mode Section */}
      <section className="bg-[#1A1A1A] border border-[#2E2E2E] p-5 rounded-xl space-y-4">
        <h3 className="font-mono text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
          <Sliders className="w-4 h-4 text-[#4F46E5]" /> AI Personality Mode
        </h3>

        <div className="flex flex-col gap-2">
          {/* Drill Sergeant */}
          <button
            onClick={() => setPersonalityMode("Drill Sergeant")}
            className={`w-full p-4 rounded-xl border text-left flex justify-between items-center transition-all cursor-pointer ${personalityMode === "Drill Sergeant"
              ? "bg-[#EF4444]/10 border-[#EF4444] text-[#EF4444]"
              : "bg-transparent border-[#2E2E2E] text-gray-400 hover:border-gray-600"
              }`}
          >
            <div>
              <p className="font-sans font-bold text-sm">🪖 Drill Sergeant</p>
              <p className="font-sans text-[11px] text-gray-400 mt-0.5 leading-normal">Hard, aggressive nudges. Absolute zero excuses tolerated.</p>
            </div>
            {personalityMode === "Drill Sergeant" && <CheckCircle className="w-5 h-5 text-[#EF4444] shrink-0" />}
          </button>

          {/* Best Friend */}
          <button
            onClick={() => setPersonalityMode("Best Friend")}
            className={`w-full p-4 rounded-xl border text-left flex justify-between items-center transition-all cursor-pointer ${personalityMode === "Best Friend"
              ? "bg-[#22C55E]/10 border-[#22C55E] text-[#22C55E]"
              : "bg-transparent border-[#2E2E2E] text-gray-400 hover:border-gray-600"
              }`}
          >
            <div>
              <p className="font-sans font-bold text-sm">🌸 Best Friend</p>
              <p className="font-sans text-[11px] text-gray-400 mt-0.5 leading-normal">Soft, highly supportive, highly compassionate nudging.</p>
            </div>
            {personalityMode === "Best Friend" && <CheckCircle className="w-5 h-5 text-[#22C55E] shrink-0" />}
          </button>

          {/* Zen Coach */}
          <button
            onClick={() => setPersonalityMode("Zen Coach")}
            className={`w-full p-4 rounded-xl border text-left flex justify-between items-center transition-all cursor-pointer ${personalityMode === "Zen Coach"
              ? "bg-[#c3c0ff]/10 border-[#c3c0ff] text-[#c3c0ff]"
              : "bg-transparent border-[#2E2E2E] text-gray-400 hover:border-gray-600"
              }`}
          >
            <div>
              <p className="font-sans font-bold text-sm">🧘 Zen Coach</p>
              <p className="font-sans text-[11px] text-gray-400 mt-0.5 leading-normal">Peaceful reminders. Focuses heavily on mental breathing cycles.</p>
            </div>
            {personalityMode === "Zen Coach" && <CheckCircle className="w-5 h-5 text-[#c3c0ff] shrink-0" />}
          </button>

          {/* Corporate */}
          <button
            onClick={() => setPersonalityMode("Corporate")}
            className={`w-full p-4 rounded-xl border text-left flex justify-between items-center transition-all cursor-pointer ${personalityMode === "Corporate"
              ? "bg-gray-800 border-gray-500 text-white"
              : "bg-transparent border-[#2E2E2E] text-gray-400 hover:border-gray-600"
              }`}
          >
            <div>
              <p className="font-sans font-bold text-sm">💼 Corporate Chief</p>
              <p className="font-sans text-[11px] text-gray-400 mt-0.5 leading-normal">Objective metrics, progress milestones, and daily tracking KPIs.</p>
            </div>
            {personalityMode === "Corporate" && <CheckCircle className="w-5 h-5 text-white shrink-0" />}
          </button>
        </div>
      </section>

      {/* Notifications Channels */}
      <section className="bg-[#1A1A1A] border border-[#2E2E2E] p-5 rounded-xl space-y-4">
        <h3 className="font-mono text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
          <Bell className="w-4 h-4 text-[#4F46E5]" /> Notifications & Channels
        </h3>

        <div className="space-y-4">
          {/* Telegram Channel */}
          <div className="space-y-2">
            <div className="flex justify-between items-center p-3 bg-[#0F0F0F] rounded-lg border border-[#2E2E2E]/40">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#0088cc]/10 text-[#0088cc] rounded">
                  <Send className="w-4 h-4 fill-[#0088cc]/10" />
                </div>
                <div>
                  <p className="font-sans font-semibold text-xs text-white">Telegram Alerts</p>
                  <p className="font-sans text-[10px] text-gray-500">Receive morning briefings and panic mode alerts</p>
                </div>
              </div>
              {telegramConnected ? (
                <div className="flex items-center gap-2">
                  <span className="text-[#22C55E] text-xs font-semibold shrink-0">
                    ✓ Connected
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      // Clear local state immediately for snappy UX
                      setTelegramConnected(false);
                      setTelegramChatId("");
                      const uid = auth.currentUser?.uid;
                      if (!uid) {
                        setNotification("You must be logged in to disconnect Telegram.");
                        return;
                      }
                      try {
                        // Use the dedicated disconnect endpoint which clears ALL Telegram fields
                        const res = await fetch("/api/telegram/disconnect", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ userId: uid }),
                        });
                        if (res.ok) {
                          onUpdateSettings({ telegramConnected: false });
                          setNotification("Telegram disconnected successfully.");
                        } else {
                          const err = await res.json();
                          setNotification(err.error || "Failed to disconnect Telegram.");
                        }
                      } catch (e) {
                        console.error("Failed to disconnect Telegram:", e);
                        setNotification("Network error. Could not disconnect Telegram.");
                      }
                    }}
                    className="text-[10px] font-mono text-red-400 hover:underline cursor-pointer"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTelegramModal(true)}
                  className="px-3 py-1.5 bg-[#0088cc] hover:brightness-110 text-white font-sans text-[11px] font-bold rounded-lg transition-all active:scale-95 cursor-pointer shrink-0"
                >
                  Connect Telegram
                </button>
              )}
            </div>

            {/* Connected badge shows the auto-detected Chat ID */}
            {telegramConnected && telegramChatId && (
              <div className="p-2.5 bg-[#0F0F0F] rounded-lg border border-[#22C55E]/20 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse shrink-0" />
                <span className="font-mono text-[10px] text-gray-400">Linked Chat ID: </span>
                <span className="font-mono text-[10px] text-white">{telegramChatId}</span>
              </div>
            )}
            {telegramConnected && (
              <button
                type="button"
                onClick={handleTestTelegram}
                className="w-full py-2 bg-[#0088cc]/10 hover:bg-[#0088cc]/20 text-[#0088cc] border border-[#0088cc]/20 rounded-lg text-[10px] font-mono font-bold tracking-tight transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Send Telegram Test Alert
              </button>
            )}
          </div>

          {/* Email Channel */}
          <div className="space-y-2 bg-[#0F0F0F] p-3 rounded-lg border border-[#2E2E2E]/40">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#EF4444]/10 text-[#EF4444] rounded">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-sans font-semibold text-xs text-white">Email Reminders</p>
                  <p className="font-sans text-[10px] text-gray-500">Every morning at 8:00 AM</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={emailConnected}
                onChange={(e) => setEmailConnected(e.target.checked)}
                className="w-4 h-4 text-[#4F46E5] border-gray-300 rounded focus:ring-[#4F46E5] cursor-pointer"
              />
            </div>

            {/* Custom Email Address Input */}
            <div className="space-y-1.5 pt-2 border-t border-[#2E2E2E]/20">
              <label className="font-mono text-[9px] uppercase text-gray-400 block">Custom Reminder Email Address</label>
              <input
                type="email"
                value={googleAccountEmail}
                onChange={(e) => setGoogleAccountEmail(e.target.value)}
                placeholder="yourname@example.com"
                className="w-full bg-[#141414] border border-[#2E2E2E] focus:border-[#EF4444] rounded px-3 py-1.5 text-white font-mono text-xs outline-none"
              />
              <p className="font-sans text-[9px] text-gray-500">
                Type the custom email where outstanding reminders and daily schedule briefs will be delivered.
              </p>
            </div>

            {emailConnected && (
              <button
                type="button"
                onClick={handleTestEmail}
                className="w-full py-2 bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/20 rounded-lg text-[10px] font-mono font-bold tracking-tight transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" /> Send Email Test Alert
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Google Accounts integration */}
      <section className="bg-[#1A1A1A] border border-[#2E2E2E] p-5 rounded-xl space-y-3">
        <h3 className="font-mono text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-[#4F46E5]" /> Connected Accounts
        </h3>

        <div className="p-4 bg-[#0F0F0F] rounded-xl border border-[#2E2E2E] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-lg">📅</span>
            <div>
              <p className="font-sans font-semibold text-xs text-white">Google Calendar</p>
              <p className="font-sans text-[10px] text-gray-400">{googleAccountEmail}</p>
            </div>
          </div>
          <span className="px-2 py-0.5 bg-[#22C55E]/10 text-[#22C55E] rounded font-mono text-[9px] uppercase tracking-wider font-bold">Connected</span>
        </div>

        {googleCalendarConnected && (
          <button
            type="button"
            onClick={handleSyncCalendar}
            className="w-full py-2.5 bg-[#4F46E5]/10 hover:bg-[#4F46E5]/20 text-[#c3c0ff] border border-[#4F46E5]/20 rounded-lg text-[10px] font-mono font-bold tracking-tight transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" /> Synchronize Schedules to Calendar
          </button>
        )}
      </section>

      {/* AI Preferences */}
      <section className="bg-[#1A1A1A] border border-[#2E2E2E] p-5 rounded-xl space-y-4">
        <h3 className="font-mono text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-[#4F46E5]" /> AI Planning Preferences
        </h3>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase text-gray-400">Planning Style</label>
            <div className="flex p-1 bg-[#0F0F0F] rounded-lg border border-[#2E2E2E]">
              {(["Aggressive", "Balanced", "Relaxed"] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => setPlanningStyle(style)}
                  className={`flex-1 py-1.5 rounded text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${planningStyle === style
                    ? "bg-[#4F46E5] text-white"
                    : "text-gray-400 hover:text-white"
                    }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Productive Hours */}
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase text-gray-400">Productive Hours Window</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="font-mono text-[9px] text-gray-500 block mb-1">Window Starts</span>
                <input
                  type="text"
                  value={startHour}
                  onChange={(e) => setStartHour(e.target.value)}
                  className="w-full bg-[#0F0F0F] border border-[#2E2E2E] focus:border-[#4F46E5] rounded px-3 py-2 text-white font-mono text-xs outline-none"
                />
              </div>
              <div>
                <span className="font-mono text-[9px] text-gray-500 block mb-1">Window Closes</span>
                <input
                  type="text"
                  value={endHour}
                  onChange={(e) => setEndHour(e.target.value)}
                  className="w-full bg-[#0F0F0F] border border-[#2E2E2E] focus:border-[#4F46E5] rounded px-3 py-2 text-white font-mono text-xs outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-User Data Isolation Verification Panel */}
      <section className="bg-[#1A1A1A] border border-[#2E2E2E] p-5 rounded-xl space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-mono text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-[#10B981]" /> Isolation Guard Verification
            </h3>
            <p className="font-sans text-[11px] text-gray-400 max-w-xl leading-normal">
              Programmatically deploy two distinct user profiles (<strong>Alice</strong> and <strong>Bob</strong>) inside the production notification engine to verify absolute database partition, custom channel routing, and zero data leakage.
            </p>
          </div>
          <span className="px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] rounded font-mono text-[9px] uppercase tracking-wider font-bold shrink-0">
            Active Guard
          </span>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleVerifyIsolation}
            disabled={isVerifyingIsolation}
            className={`w-full py-3 px-4 rounded-xl font-mono text-xs font-bold tracking-tight border transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${isVerifyingIsolation
              ? "bg-[#2E2E2E] text-gray-400 border-[#3E3E3E]"
              : "bg-gradient-to-r from-[#10B981]/10 to-[#4F46E5]/10 hover:from-[#10B981]/20 hover:to-[#4F46E5]/20 text-white border-[#10B981]/20"
              }`}
          >
            {isVerifyingIsolation ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                RUNNING DYNAMIC ISOLATION TESTING...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 text-[#10B981]" /> Run Isolation & Leakage Verification Suite
              </>
            )}
          </button>
        </div>

        {isolationTestResults && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 pt-3 border-t border-[#2E2E2E]/50"
          >
            {/* Master Summary Badge */}
            <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-3 ${isolationTestResults.success
              ? "bg-gradient-to-r from-[#10B981]/10 to-[#0F0F0F] border-[#10B981]/30"
              : "bg-gradient-to-r from-red-500/10 to-[#0F0F0F] border-red-500/30"
              }`}>
              <div>
                <p className="font-sans font-bold text-xs text-white">Verification Status Summary</p>
                <p className="font-sans text-[10px] text-gray-400 mt-0.5 leading-normal">
                  {isolationTestResults.summary}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-1.5 px-3 py-1 bg-black/40 rounded-lg border border-white/5">
                <span className={`w-2 h-2 rounded-full animate-pulse ${isolationTestResults.success ? "bg-[#10B981]" : "bg-red-500"}`}></span>
                <span className="font-mono text-[10px] font-bold text-white uppercase tracking-wider">
                  {isolationTestResults.success ? "100% Isolated" : "Leakage Alert"}
                </span>
              </div>
            </div>

            {/* Test Matrix list */}
            <div className="space-y-2">
              <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500">Security Assertion Matrix</p>
              <div className="grid grid-cols-1 gap-2">
                {isolationTestResults.tests.map((test: any, idx: number) => (
                  <div key={idx} className="p-3 bg-[#0F0F0F] rounded-lg border border-[#2E2E2E]/40 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-sans font-bold text-xs text-white">{test.name}</p>
                      <p className="font-sans text-[10px] text-gray-400 leading-normal">{test.description}</p>
                    </div>
                    <span className={`font-mono text-[9px] font-bold uppercase px-2 py-0.5 rounded ${test.status === "PASSED"
                      ? "bg-[#10B981]/10 text-[#10B981]"
                      : "bg-red-500/10 text-red-500"
                      }`}>
                      {test.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Intercepted Reminders Logs */}
            <div className="space-y-2">
              <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500">Intercepted Dispatches (Audit Trail)</p>
              <div className="p-3 bg-[#0F0F0F] rounded-lg border border-[#2E2E2E]/40 space-y-3 max-h-60 overflow-y-auto">
                {isolationTestResults.notifications && isolationTestResults.notifications.length > 0 ? (
                  isolationTestResults.notifications.map((alert: any, idx: number) => (
                    <div key={idx} className="p-2.5 bg-[#141414] rounded border border-[#222]/80 space-y-2 font-mono text-[10px]">
                      <div className="flex justify-between items-center border-b border-[#222] pb-1.5">
                        <span className="font-bold text-[#4F46E5] uppercase">{alert.type === "email" ? "📧 Simulated Email" : "🤖 Simulated Telegram"}</span>
                        <span className="text-gray-500 text-[9px]">{alert.timestamp.split("T")[1].slice(0, 8)}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-gray-400 text-[9px]">
                        <div>User ID: <span className="text-white font-bold">{alert.userId}</span></div>
                        <div className="col-span-2 text-right">Recipient: <span className="text-[#10B981] font-bold">{alert.recipient}</span></div>
                      </div>
                      <div className="p-1.5 bg-black/40 rounded border border-[#222] text-[9px] text-gray-300">
                        <span className="text-yellow-500 block font-bold mb-0.5">Payload Content:</span>
                        {alert.type === "email" ? "Subject: " : "Title: "}{alert.subjectOrTitle}
                        <div className="mt-1">
                          Tasks: {alert.tasks.map((t: string) => `"${t}"`).join(", ")}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="font-sans text-[10px] text-gray-500 italic text-center py-4">No notifications generated in isolation test.</p>
                )}
              </div>
            </div>

            {/* Verification Steps logs */}
            <div className="space-y-2">
              <p className="font-mono text-[9px] uppercase tracking-wider text-gray-500">Suite Diagnostic Telemetry</p>
              <div className="p-3 bg-[#050505] rounded-lg border border-[#2E2E2E]/40 font-mono text-[9px] text-gray-400 space-y-1 h-32 overflow-y-auto">
                {isolationTestResults.logs && isolationTestResults.logs.map((logLine: string, idx: number) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-[#10B981] select-none">&gt;</span>
                    <span>{logLine}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </section>

      {/* Save Button */}
      <div className="fixed bottom-0 left-0 w-full p-4 bg-[#0F0F0F] border-t border-[#2E2E2E] z-30">
        <div className="max-w-3xl mx-auto">
          <button
            id="save-preferences-btn"
            onClick={handleSave}
            className="w-full h-14 bg-[#4F46E5] text-white rounded-xl font-sans font-bold text-base shadow-lg hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
          >
            Save Preferences
          </button>
        </div>
      </div>

      {/* ── Telegram Connection Modal ───────────────────────────────────────── */}
      {showTelegramModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="w-full max-w-md bg-[#1A1A1A] border border-[#2E2E2E] rounded-2xl p-6 shadow-2xl space-y-5"
          >
            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex justify-between items-center pb-2 border-b border-[#2E2E2E]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#0088cc]/10 flex items-center justify-center">
                  <Send className="w-4 h-4 text-[#0088cc]" />
                </div>
                <h3 className="font-sans font-extrabold text-base text-white">Connect Telegram</h3>
              </div>
              <button
                type="button"
                onClick={() => { setShowTelegramModal(false); setTgFlowState('idle'); setTgErrorMsg(""); }}
                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* ── SUCCESS state ───────────────────────────────────────────── */}
            {tgFlowState === 'success' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-4 py-6"
              >
                <div className="w-16 h-16 rounded-full bg-[#22C55E]/10 border-2 border-[#22C55E]/40 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-[#22C55E]" />
                </div>
                <div className="text-center space-y-1">
                  <p className="font-sans font-bold text-white text-sm">Telegram Connected!</p>
                  <p className="font-sans text-[11px] text-gray-400">Your account is now linked. Closing automatically…</p>
                </div>
              </motion.div>
            )}

            {/* ── ERROR state ─────────────────────────────────────────────── */}
            {tgFlowState === 'error' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl flex gap-3">
                  <span className="text-red-400 text-lg shrink-0">⚠️</span>
                  <div className="space-y-1">
                    <p className="font-sans font-bold text-xs text-red-400">Connection Failed</p>
                    <p className="font-sans text-[11px] text-gray-400 leading-relaxed">{tgErrorMsg}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowTelegramModal(false); setTgFlowState('idle'); setTgErrorMsg(""); }}
                    className="py-2.5 rounded-xl border border-[#2E2E2E] text-gray-400 hover:text-white font-sans text-xs font-semibold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <a
                    href={`https://t.me/${botUsername}?start=${userId}`}
                    target="_blank"
                    referrerPolicy="no-referrer"
                    onClick={() => { setTgFlowState('waiting'); setTgErrorMsg(""); }}
                    className="py-2.5 rounded-xl bg-[#0088cc] hover:brightness-110 text-white font-sans text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" /> Retry
                  </a>
                </div>
              </motion.div>
            )}

            {/* ── IDLE / WAITING state ─────────────────────────────────────── */}
            {(tgFlowState === 'idle' || tgFlowState === 'waiting') && (
              <>
                {/* Bot info card */}
                <div className="flex items-center gap-3 p-3 bg-[#0F0F0F] rounded-xl border border-[#2E2E2E]/50">
                  <div className="w-10 h-10 rounded-full bg-[#0088cc]/10 flex items-center justify-center shrink-0">
                    <span className="text-lg">🤖</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans font-bold text-sm text-white">Samay AI Assistant</p>
                    <p className="font-mono text-[10px] text-[#0088cc]">@{botUsername}</p>
                  </div>
                </div>


                {/* Shared device notice */}
                <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-1">
                  <p className="font-sans font-bold text-[11px] text-indigo-300">💡 Testing or on a Shared Device?</p>
                  <p className="font-sans text-[10px] text-gray-400 leading-relaxed">
                    The bot links the Telegram client that opens it. If this is not your personal computer,
                    <strong> scan the QR code below with your phone's camera </strong> or copy the link to open it on your own device.
                  </p>
                </div>

                {/* QR Code and Actions container */}
                <div className="flex flex-col items-center gap-4 py-2">
                  <div className="bg-white p-3 rounded-2xl shadow-lg border border-white/10 shrink-0">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`https://t.me/${botUsername}?start=${userId}`)}`}
                      alt="Telegram Bot QR Code"
                      className="w-[140px] h-[140px] block select-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(`https://t.me/${botUsername}?start=${userId}`);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      } catch (err) {
                        console.error("Failed to copy link:", err);
                      }
                    }}
                    className="h-9 px-4 rounded-xl border border-[#2E2E2E] hover:border-gray-500 text-gray-300 hover:text-white font-sans text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer bg-transparent active:scale-[0.98]"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied ? "Link Copied!" : "Copy Bot Link"}
                  </button>
                </div>

                {/* Steps */}
                <div className="space-y-3 pt-1 border-t border-[#2E2E2E]">
                  {[
                    { n: 1, title: "Scan QR or click below", desc: "Scan the QR with your phone or tap the button to launch Telegram." },
                    { n: 2, title: "Press Start", desc: "Tap 'Start' inside the chat on your personal Telegram account." },
                    { n: 3, title: "Done", desc: "Your account links automatically. This modal will auto-close." },
                  ].map(({ n, title, desc }) => (
                    <div key={n} className="flex gap-3 items-start">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[9px] font-bold shrink-0 transition-colors ${tgFlowState === 'waiting' && n === 1
                        ? 'bg-[#0088cc] text-white'
                        : 'bg-[#4F46E5]/10 text-[#c3c0ff]'
                        }`}>{n}</div>
                      <div>
                        <p className="font-sans font-bold text-xs text-white">{title}</p>
                        <p className="font-sans text-[10px] text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA + waiting indicator */}
                <div className="space-y-3 pt-1">
                  <a
                    href={`https://t.me/${botUsername}?start=${userId}`}
                    target="_blank"
                    referrerPolicy="no-referrer"
                    onClick={() => setTgFlowState('waiting')}
                    className="w-full h-12 bg-[#0088cc] hover:brightness-110 text-white rounded-xl font-sans font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    Open Telegram Bot
                  </a>

                  {tgFlowState === 'waiting' && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center gap-2 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-[#0088cc] border-t-transparent rounded-full animate-spin" />
                        <span className="font-mono text-[11px] text-gray-400">Waiting for Telegram confirmation…</span>
                      </div>
                      <p className="font-sans text-[10px] text-gray-600 font-medium">Please ensure you tapped "Start" on your Telegram app.</p>
                      <button
                        type="button"
                        onClick={() => { setShowTelegramModal(false); setTgFlowState('idle'); }}
                        className="mt-1 font-mono text-[10px] text-gray-500 hover:text-red-400 underline cursor-pointer transition-colors"
                      >
                        Cancel
                      </button>
                    </motion.div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
