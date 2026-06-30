import { useState, FormEvent } from "react";
import { motion } from "motion/react";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Chrome, AlertCircle, ArrowLeft, CheckCircle, Sparkles } from "lucide-react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../lib/firebase";
import SamayLogo from "./SamayLogo";

interface LoginPageProps {
  onNavigate: (view: string) => void;
  onGoogleLogin: () => Promise<void>;
  onDemoLogin: () => void;
  error?: string | null;
  setError: (err: string | null) => void;
}

export default function LoginPage({ onNavigate, onGoogleLogin, onDemoLogin, error, setError }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const handleEmailLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate email
    if (!email.trim()) {
      setError("Email address is required.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address (e.g., name@company.com).");
      return;
    }

    // Validate password
    if (!password) {
      setError("Password is required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // App.tsx onAuthStateChanged handles routing to dashboard
    } catch (err: any) {
      console.error("Email login error:", err);
      let errMsg = "Invalid email or password. Please try again.";
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        errMsg = "Invalid email or password. Please try again.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "Please enter a valid email address.";
      } else if (err.code === "auth/too-many-requests") {
        errMsg = "Too many failed login attempts. Please try again later or reset your password.";
      } else {
        errMsg = err.message || errMsg;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      setResetError("Please enter your email address.");
      return;
    }
    setResetError(null);
    setResetSuccess(null);
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSuccess("Password reset email sent! Check your inbox for instructions.");
      setResetEmail("");
    } catch (err: any) {
      console.error("Password reset error:", err);
      let errMsg = "Failed to send password reset email. Please verify the email is correct.";
      if (err.code === "auth/user-not-found") {
        errMsg = "No account found with this email address.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "Please enter a valid email address.";
      } else {
        errMsg = err.message || errMsg;
      }
      setResetError(errMsg);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div id="login-page" className="min-h-screen bg-[#0F0F0F] text-white flex flex-col justify-center items-center p-4 selection:bg-[#4F46E5]/40 relative overflow-hidden">
      {/* Background ambient elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-[#4F46E5]/5 blur-[120px] rounded-full pointer-events-none"></div>

      {/* Main card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[420px] bg-[#1A1A1A] border border-[#2E2E2E] rounded-2xl p-6 md:p-8 shadow-2xl relative z-10 flex flex-col gap-6"
      >
        {/* Back navigation and logo */}
        <div className="flex flex-col gap-4">
          <button 
            onClick={() => {
              setError(null);
              onNavigate("landing");
            }}
            className="self-start inline-flex items-center gap-1.5 text-xs font-mono text-gray-500 hover:text-white transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            BACK TO HOME
          </button>
          
          <div className="flex flex-col items-center gap-2 mt-2">
            <SamayLogo size={42} showText={false} />
            <h1 className="font-sans font-black text-2xl tracking-tight text-center mt-1">
              {isForgotMode ? "Reset Password" : "Welcome Back"}
            </h1>
            <p className="font-sans text-xs text-gray-400 text-center">
              {isForgotMode 
                ? "Enter your credentials to restore secure system access" 
                : "Initialize your AI Chief of Staff to resume focus loops"}
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

        {/* Password Reset Module */}
        {isForgotMode ? (
          <form onSubmit={handlePasswordResetSubmit} className="flex flex-col gap-4">
            {resetSuccess && (
              <div className="flex items-start gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{resetSuccess}</span>
              </div>
            )}
            {resetError && (
              <div className="flex items-start gap-2 text-xs font-mono text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{resetError}</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="reset-email" className="font-mono text-[10px] text-gray-400 uppercase tracking-wider">Registered Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                <input 
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-[#121212] border border-[#2E2E2E] focus:border-[#4F46E5] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#4F46E5] transition-colors"
                  required
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={resetLoading}
              className="w-full bg-[#4F46E5] hover:bg-[#4338ca] text-white py-3 rounded-xl font-sans font-bold text-sm shadow-lg shadow-[#4F46E5]/20 hover:scale-[1.01] transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              {resetLoading ? "Sending Instructions..." : "Send Reset Link"}
              {!resetLoading && <ArrowRight className="w-4 h-4" />}
            </button>

            <button 
              type="button"
              onClick={() => {
                setIsForgotMode(false);
                setResetSuccess(null);
                setResetError(null);
                setError(null);
              }}
              className="font-mono text-[11px] text-[#4F46E5] hover:text-[#c3c0ff] hover:underline self-center transition-colors cursor-pointer"
            >
              Back to Sign In
            </button>
          </form>
        ) : (
          /* Normal Sign In Module */
          <>
            <form onSubmit={handleEmailLoginSubmit} className="flex flex-col gap-4">
              {/* Email Address */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="login-email" className="font-mono text-[10px] text-gray-400 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                  <input 
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full bg-[#121212] border border-[#2E2E2E] focus:border-[#4F46E5] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#4F46E5] transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className="font-mono text-[10px] text-gray-400 uppercase tracking-wider">Password</label>
                  <button 
                    type="button"
                    onClick={() => {
                      setError(null);
                      setIsForgotMode(true);
                    }}
                    className="font-mono text-[10px] text-[#4F46E5] hover:text-[#c3c0ff] uppercase tracking-wider hover:underline cursor-pointer"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                  <input 
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#121212] border border-[#2E2E2E] focus:border-[#4F46E5] rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#4F46E5] transition-colors"
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-2 mt-1">
                <input 
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-[#2E2E2E] bg-[#121212] text-[#4F46E5] focus:ring-[#4F46E5] accent-[#4F46E5] cursor-pointer"
                />
                <label htmlFor="remember-me" className="font-mono text-[11px] text-gray-400 select-none cursor-pointer hover:text-gray-200 transition-colors">
                  Remember secure session
                </label>
              </div>

              {/* Login Button */}
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-[#4F46E5] hover:bg-[#4338ca] text-white py-3 rounded-xl font-sans font-bold text-sm shadow-lg shadow-[#4F46E5]/20 hover:scale-[1.01] transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? "Initializing Session..." : "Secure Login"}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            {/* Separator */}
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-[1px] bg-[#2E2E2E]"></div>
              <span className="font-mono text-[10px] text-gray-500 uppercase tracking-widest">OR</span>
              <div className="flex-1 h-[1px] bg-[#2E2E2E]"></div>
            </div>

            {/* Social & Sandbox Buttons */}
            <div className="flex flex-col gap-2.5">
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
            <div className="text-center font-sans text-xs text-gray-400 mt-2">
              New to Samay AI?{" "}
              <button 
                onClick={() => {
                  setError(null);
                  onNavigate("register");
                }}
                className="font-semibold text-[#4F46E5] hover:text-[#c3c0ff] hover:underline cursor-pointer transition-colors"
              >
                Sign up here
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
