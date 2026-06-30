import { useState, FormEvent } from "react";
import { motion } from "motion/react";
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Chrome, AlertCircle, ArrowLeft, Sparkles } from "lucide-react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import SamayLogo from "./SamayLogo";

interface RegisterPageProps {
  onNavigate: (view: string) => void;
  onGoogleLogin: () => Promise<void>;
  onDemoLogin: () => void;
  error?: string | null;
  setError: (err: string | null) => void;
}

export default function RegisterPage({ onNavigate, onGoogleLogin, onDemoLogin, error, setError }: RegisterPageProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Full name check
    if (!fullName.trim()) {
      setError("Full Name is required.");
      return;
    }

    // Email check
    if (!email.trim()) {
      setError("Email address is required.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address format (e.g., name@company.com).");
      return;
    }

    // Password checks
    if (!password) {
      setError("Password is required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least one uppercase letter (A-Z).");
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError("Password must contain at least one lowercase letter (a-z).");
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError("Password must contain at least one number (0-9).");
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      setError("Password must contain at least one special character (e.g., !, @, #, $, %, ^, &, *).");
      return;
    }

    // Confirm password check
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify.");
      return;
    }

    setLoading(true);
    try {
      // Create user
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const currentUser = result.user;

      // Update profile display name
      await updateProfile(currentUser, { displayName: fullName.trim() });

      // Explicitly write user profile data to Firestore
      const userDocRef = doc(db, "users", currentUser.uid);
      
      const defaultSettings: any = {
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
        googleAccountEmail: currentUser.email || "",
      };

      const profileData = {
        uid: currentUser.uid,
        displayName: fullName.trim(),
        email: email.trim(),
        photoURL: "",
        streak: 12,
        streakLevel: 4,
        completedDays: ["Mon", "Tue"],
        createdAt: serverTimestamp(),
        provider: "email",
        lastLogin: serverTimestamp(),
        role: "Student",
        settings: defaultSettings,
      };
      
      await setDoc(userDocRef, profileData);

      // Also ensure settings document is initialized under settings collection
      const settingsDocRef = doc(db, "settings", currentUser.uid);
      await setDoc(settingsDocRef, defaultSettings);

      // App.tsx onAuthStateChanged will handle routing to dashboard
    } catch (err: any) {
      console.error("Email registration error:", err);
      let errMsg = "Failed to create account. Please check your network and try again.";
      if (err.code === "auth/email-already-in-use") {
        errMsg = "An account with this email address already exists.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "Please enter a valid email address.";
      } else if (err.code === "auth/weak-password") {
        errMsg = "Password is too weak. Please choose a stronger password.";
      } else {
        errMsg = err.message || errMsg;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="register-page" className="min-h-screen bg-[#0F0F0F] text-white flex flex-col justify-center items-center p-4 selection:bg-[#4F46E5]/40 relative overflow-hidden">
      {/* Background ambient element */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-[#4F46E5]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[420px] bg-[#1A1A1A] border border-[#2E2E2E] rounded-2xl p-6 md:p-8 shadow-2xl relative z-10 flex flex-col gap-5"
      >
        {/* Back navigation and header */}
        <div className="flex flex-col gap-3">
          <button 
            onClick={() => {
              setError(null);
              onNavigate("login");
            }}
            className="self-start inline-flex items-center gap-1.5 text-xs font-mono text-gray-500 hover:text-white transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            BACK TO SIGN IN
          </button>
          
          <div className="flex flex-col items-center gap-1.5 mt-1">
            <SamayLogo size={42} showText={false} />
            <h1 className="font-sans font-black text-2xl tracking-tight text-center mt-1">
              Create Account
            </h1>
            <p className="font-sans text-xs text-gray-400 text-center">
              Register securely to start optimizing your focus loops
            </p>
          </div>
        </div>

        {/* Global Error Display */}
        {error && (
          <div className="flex items-start gap-2 text-xs font-mono text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Main form */}
        <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-3.5">
          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reg-name" className="font-mono text-[10px] text-gray-400 uppercase tracking-wider">Full Name</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input 
                id="reg-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Rahul Kumar"
                className="w-full bg-[#121212] border border-[#2E2E2E] focus:border-[#4F46E5] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#4F46E5] transition-colors"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reg-email" className="font-mono text-[10px] text-gray-400 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input 
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full bg-[#121212] border border-[#2E2E2E] focus:border-[#4F46E5] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#4F46E5] transition-colors"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-password" className="font-mono text-[10px] text-gray-400 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                <input 
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#121212] border border-[#2E2E2E] focus:border-[#4F46E5] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#4F46E5] transition-colors"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-confirm" className="font-mono text-[10px] text-gray-400 uppercase tracking-wider">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                <input 
                  id="reg-confirm"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#121212] border border-[#2E2E2E] focus:border-[#4F46E5] rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#4F46E5] transition-colors"
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-[#4F46E5] hover:bg-[#4338ca] text-white py-3 rounded-xl font-sans font-bold text-sm shadow-lg shadow-[#4F46E5]/20 hover:scale-[1.01] transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer mt-1.5 disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? "Registering Credentials..." : "Create Account"}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        {/* Separator */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-[1px] bg-[#2E2E2E]"></div>
          <span className="font-mono text-[10px] text-gray-500 uppercase tracking-widest">OR</span>
          <div className="flex-1 h-[1px] bg-[#2E2E2E]"></div>
        </div>

        {/* Social & Sandbox Buttons */}
        <div className="flex flex-col gap-2">
          <button 
            type="button"
            onClick={onGoogleLogin}
            className="w-full bg-[#121212] hover:bg-[#242424] border border-[#2E2E2E] hover:border-gray-500 text-white py-2.5 px-4 rounded-xl font-sans font-medium text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-95"
          >
            <Chrome className="w-4 h-4 text-red-400" />
            Continue with Google
          </button>

          <button 
            type="button"
            onClick={onDemoLogin}
            className="w-full bg-gradient-to-r from-[#4F46E5]/15 to-[#312E81]/15 hover:from-[#4F46E5]/25 hover:to-[#312E81]/25 border border-[#4F46E5]/30 hover:border-[#4F46E5]/60 text-[#c3c0ff] hover:text-white py-2.5 px-4 rounded-xl font-sans font-medium text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-[#818CF8]" />
            Launch Sandbox Mode (No Setup Required)
          </button>
        </div>

        {/* Navigation link */}
        <div className="text-center font-sans text-xs text-gray-400 mt-1">
          Already have an account?{" "}
          <button 
            onClick={() => {
              setError(null);
              onNavigate("login");
            }}
            className="font-semibold text-[#4F46E5] hover:text-[#c3c0ff] hover:underline cursor-pointer transition-colors"
          >
            Login here
          </button>
        </div>
      </motion.div>
    </div>
  );
}
