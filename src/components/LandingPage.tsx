import { useState } from "react";
import { motion } from "motion/react";
import { Terminal, Bolt, ArrowRight, Sparkles, AlertTriangle, Brain, CreditCard, Laugh, ListTodo, School, Briefcase, Rocket } from "lucide-react";
import SamayLogo from "./SamayLogo";

interface LandingPageProps {
  onStart: () => void;
  onNavigate: (view: string) => void;
  error?: string | null;
}

export default function LandingPage({ onStart, onNavigate, error }: LandingPageProps) {
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  return (
    <div id="landing-page" className="min-h-screen bg-[#0F0F0F] text-white selection:bg-[#4F46E5]/40 overflow-x-hidden">
      {/* Navbar */}
      <header className="sticky top-0 w-full z-50 bg-[#0F0F0F]/80 backdrop-blur-md border-b border-[#2E2E2E] px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-2">
            <SamayLogo size={36} showText={true} textColor="text-[#2172CD]" textSize="text-xl font-extrabold tracking-tight" disableZoom={true} />
          </div>
          <button
            id="login-btn"
            onClick={onStart}
            className="bg-[#1A1A1A] border border-[#2E2E2E] px-4 py-2 rounded-lg font-mono text-xs hover:bg-[#242424] transition-colors duration-200 active:scale-95 cursor-pointer"
          >
            Login
          </button>
        </div>
      </header>

      <main className="flex flex-col gap-16 pb-24 max-w-2xl mx-auto px-4 pt-8">
        {/* Hero Section */}
        <section className="relative text-center">
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-72 h-72 bg-[#4F46E5]/10 blur-[80px] rounded-full pointer-events-none"></div>
          <div className="relative z-10 flex flex-col items-center gap-6">


            <h1 className="font-sans font-black text-4xl sm:text-5xl leading-[1.1] tracking-tighter text-white">
              Never Miss a <span className="text-[#4F46E5]">Deadline</span> Again
            </h1>

            <p className="font-sans text-gray-400 text-lg max-w-sm mx-auto">
              Your AI Chief of Staff. Engineered for high-performance productivity and focus.
            </p>

            <div className="mt-4 w-full max-w-[280px] flex flex-col gap-3">
              {error && (
                <div className="text-xs font-mono text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg text-center">
                  {error}
                </div>
              )}
              <button
                id="get-started-btn"
                onClick={onStart}
                className="w-full bg-[#4F46E5] text-white px-6 py-4 rounded-xl font-sans font-bold text-base shadow-lg shadow-[#4F46E5]/20 hover:scale-[1.02] transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                Get Started Free <ArrowRight className="w-5 h-5" />
              </button>
              <p className="font-mono text-[10px] text-gray-500 uppercase tracking-widest">No credit card required.</p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="flex flex-col gap-6">
          <h2 className="font-sans font-bold text-2xl tracking-tight text-center">Precision Workflow</h2>

          <div className="flex flex-col items-center gap-4">
            {/* Step 1 */}
            <div className="w-full bg-[#1A1A1A] border border-[#2E2E2E] p-6 rounded-xl relative">
              <div className="absolute -top-3 -left-2 bg-[#4F46E5] text-white w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold shadow-lg">1</div>
              <h3 className="font-sans font-bold text-lg text-white mb-1">Dump Your Tasks</h3>
              <p className="text-gray-400 text-sm">Text and Screenshots. Throw everything at your OS. No sorting needed.</p>
            </div>

            <div className="w-0.5 h-6 bg-[#2E2E2E]"></div>

            {/* Step 2 */}
            <div className="w-full bg-[#1A1A1A] border border-[#2E2E2E] p-6 rounded-xl relative">
              <div className="absolute -top-3 -left-2 bg-[#4F46E5] text-white w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold shadow-lg">2</div>
              <h3 className="font-sans font-bold text-lg text-white mb-1">AI Plans It</h3>
              <p className="text-gray-400 text-sm">Our Neural Engine builds your daily schedule based on priority, energy, and real-time urgency.</p>
            </div>

            <div className="w-0.5 h-6 bg-[#2E2E2E]"></div>

            {/* Step 3 */}
            <div className="w-full bg-[#1A1A1A] border border-[#2E2E2E] p-6 rounded-xl relative">
              <div className="absolute -top-3 -left-2 bg-[#4F46E5] text-white w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold shadow-lg">3</div>
              <h3 className="font-sans font-bold text-lg text-white mb-1">Auto-Reminders Run</h3>
              <p className="text-gray-400 text-sm">Smart Notifications across all devices ensure you stay ahead without the cognitive load.</p>
            </div>
          </div>
        </section>

        {/* Core Modules */}
        <section className="flex flex-col gap-6">
          <h2 className="font-sans font-bold text-2xl tracking-tight text-center">Core Modules</h2>
          <div className="grid grid-cols-2 gap-4">
            {/* Feature 1 */}
            <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-4 rounded-xl flex flex-col gap-2 hover:border-[#4F46E5] transition-colors duration-300">
              <Sparkles className="text-[#4F46E5] w-5 h-5" />
              <h4 className="font-sans font-semibold text-sm text-white">Life Detector</h4>
              <p className="text-gray-400 text-xs leading-normal">Detects burnout risk before it hits.</p>
            </div>

            {/* Feature 2 */}
            <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-4 rounded-xl flex flex-col gap-2 hover:border-[#EF4444] transition-colors duration-300">
              <AlertTriangle className="text-[#EF4444] w-5 h-5" />
              <h4 className="font-sans font-semibold text-sm text-white">Panic Mode</h4>
              <p className="text-gray-400 text-xs leading-normal">Instant triage for overdue items.</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-4 rounded-xl flex flex-col gap-2 hover:border-[#4F46E5] transition-colors duration-300">
              <Brain className="text-[#4F46E5] w-5 h-5" />
              <h4 className="font-sans font-semibold text-sm text-white">Procrastination</h4>
              <p className="text-gray-400 text-xs leading-normal">AI nudges designed to kill delay.</p>
            </div>

            {/* Feature 4 */}
            <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-4 rounded-xl flex flex-col gap-2 hover:border-[#22C55E] transition-colors duration-300">
              <CreditCard className="text-[#22C55E] w-5 h-5" />
              <h4 className="font-sans font-semibold text-sm text-white">Bill Tracker</h4>
              <p className="text-gray-400 text-xs leading-normal">Automated financial deadlines.</p>
            </div>

            {/* Feature 5 */}
            <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-4 rounded-xl flex flex-col gap-2 hover:border-[#4F46E5] transition-colors duration-300">
              <Laugh className="text-[#4F46E5] w-5 h-5" />
              <h4 className="font-sans font-semibold text-sm text-white">Personality</h4>
              <p className="text-gray-400 text-xs leading-normal">From 'Best Friend' to 'Drill Sergeant'.</p>
            </div>

            {/* Feature 6 */}
            <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-4 rounded-xl flex flex-col gap-2 hover:border-[#4F46E5] transition-colors duration-300">
              <ListTodo className="text-[#4F46E5] w-5 h-5" />
              <h4 className="font-sans font-semibold text-sm text-white">Future You</h4>
              <p className="text-gray-400 text-xs leading-normal">Visualizes your success path.</p>
            </div>
          </div>
        </section>

        {/* Built for Power Users */}
        <section className="flex flex-col gap-6">
          <h2 className="font-sans font-bold text-2xl tracking-tight text-center">Built for Power Users</h2>
          <div className="flex flex-col gap-4">
            {/* Student */}
            <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-6 rounded-xl flex gap-4 items-start">
              <div className="w-12 h-12 bg-[#4F46E5]/10 border border-[#4F46E5]/20 rounded-full flex items-center justify-center shrink-0">
                <School className="text-[#4F46E5] w-6 h-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-sans font-bold text-lg text-white">👨‍🎓 Student</h3>
                <p className="text-gray-400 text-sm">Stay ahead of exams and assignments without the stress. Auto-syllabi parsing included.</p>
              </div>
            </div>

            {/* Professional */}
            <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-6 rounded-xl flex gap-4 items-start">
              <div className="w-12 h-12 bg-[#4F46E5]/10 border border-[#4F46E5]/20 rounded-full flex items-center justify-center shrink-0">
                <Briefcase className="text-[#4F46E5] w-6 h-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-sans font-bold text-lg text-white">👨‍💼 Professional</h3>
                <p className="text-gray-400 text-sm">Manage complex projects and client meetings with ease. Seamless integration with enterprise tools.</p>
              </div>
            </div>

            {/* Founder */}
            <div className="bg-[#1A1A1A] border border-[#2E2E2E] p-6 rounded-xl flex gap-4 items-start">
              <div className="w-12 h-12 bg-[#4F46E5]/10 border border-[#4F46E5]/20 rounded-full flex items-center justify-center shrink-0">
                <Rocket className="text-[#4F46E5] w-6 h-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-sans font-bold text-lg text-white"> Founder</h3>
                <p className="text-gray-400 text-sm">Balance growth, operations, and sanity in one place. Your digital second-in-command.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center pt-8">
          <div className="bg-[#4F46E5]/10 border border-[#4F46E5]/20 rounded-3xl p-8 flex flex-col gap-4">
            <h2 className="font-sans font-black text-2xl text-white">Ready to upgrade your life?</h2>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">Join 50,000+ power users mastering their time with Samay AI.</p>
            <button
              id="cta-init-btn"
              onClick={onStart}
              className="bg-[#4F46E5] hover:bg-[#4338ca] text-white px-8 py-4 rounded-xl font-sans font-bold text-base active:scale-95 transition-all w-full max-w-xs mx-auto shadow-lg shadow-[#4F46E5]/20 cursor-pointer"
            >
              Initialize System
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-12 bg-[#1A1A1A] border-t border-[#2E2E2E] text-center flex flex-col items-center justify-center gap-4">
        <div className="mb-2">
          <SamayLogo size={48} showText={true} layout="vertical" textSize="text-xs font-bold tracking-widest text-[#2172CD]" />
        </div>
        <div className="flex gap-6 mt-2">
          <button
            onClick={() => setShowPrivacyModal(true)}
            className="font-sans text-xs text-gray-500 hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0 outline-none"
          >
            Privacy
          </button>
          <button
            onClick={() => setShowTermsModal(true)}
            className="font-sans text-xs text-gray-500 hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0 outline-none"
          >
            Terms
          </button>
          <button
            onClick={() => onNavigate("contact")}
            className="font-sans text-xs text-gray-500 hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0"
          >
            Contact Us
          </button>
        </div>
        <p className="font-mono text-[10px] text-gray-600 mt-4 uppercase">© 2026 Samay AI Inc. All systems go.</p>
      </footer>

      {/* Privacy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1A1A1A] border border-[#2E2E2E] rounded-2xl max-w-md w-full p-6 space-y-4 text-left shadow-2xl"
          >
            <h3 className="font-sans font-bold text-lg text-white">Privacy Policy</h3>
            <div className="space-y-3 font-sans text-xs text-gray-400 leading-relaxed">
              <p>
                Your privacy is our core priority. Samay AI secures your personal tasks, calendar entries, and Telegram integrations using industry-standard encryption protocols.
              </p>
              <p>
                We do not share, lease, or sell your data to any third-party entities. Your task descriptions and settings data are strictly processed to optimize your productivity schedule and trigger context-aware schedule warnings or alarms.
              </p>
              <p>
                By linking your email or Telegram accounts, you authorize Samay AI to dispatch notification reminders for upcoming deadlines. You can modify your connection preferences or delete your connection parameters at any time from your settings panel.
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="px-4 py-2 bg-[#4F46E5] hover:bg-[#4338ca] text-white text-xs font-semibold rounded-xl active:scale-95 transition-transform cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Terms Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1A1A1A] border border-[#2E2E2E] rounded-2xl max-w-md w-full p-6 space-y-4 text-left shadow-2xl"
          >
            <h3 className="font-sans font-bold text-lg text-white">Terms of Service</h3>
            <div className="space-y-3 font-sans text-xs text-gray-400 leading-relaxed">
              <p>
                Welcome to Samay AI. By accessing or utilizing our scheduling assistant, you agree to comply with and be bound by these Terms of Service.
              </p>
              <p>
                You grant Samay AI the permission to analyze your tasks and send notifications to your configured endpoints. You are responsible for keeping your linked account parameters secure.
              </p>
              <p>
                We reserve the right to optimize scheduling layouts and notification delivery schedules based on system performance algorithms. Usage of sandbox mock environments is limited to evaluation purposes.
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowTermsModal(false)}
                className="px-4 py-2 bg-[#4F46E5] hover:bg-[#4338ca] text-white text-xs font-semibold rounded-xl active:scale-95 transition-transform cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
