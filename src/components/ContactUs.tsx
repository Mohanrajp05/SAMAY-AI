import { useState, useEffect, FormEvent } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Mail, Clock, Calendar, Send, CheckCircle, AlertCircle, Info } from "lucide-react";
import { submitContactMessage } from "../lib/contactService";

interface ContactUsProps {
  onNavigate: (view: string) => void;
  user?: any;
  userProfile?: any;
}

export default function ContactUs({ onNavigate, user, userProfile }: ContactUsProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  // Validation and Submission state
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isSending, setIsSending] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Autofill if logged in
  useEffect(() => {
    if (user) {
      const prefillName = userProfile?.displayName || user?.displayName || "";
      const prefillEmail = userProfile?.email || user?.email || "";
      if (prefillName) setName(prefillName);
      if (prefillEmail) setEmail(prefillEmail);
    }
  }, [user, userProfile]);

  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    if (!name.trim()) {
      errors.name = "Full name cannot be empty.";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errors.email = "Email address cannot be empty.";
    } else if (!emailRegex.test(email.trim())) {
      errors.email = "Please enter a valid email address.";
    }

    if (!subject) {
      errors.subject = "Please select an inquiry subject category.";
    }

    if (!message.trim()) {
      errors.message = "Message cannot be empty.";
    } else if (message.trim().length < 2) {
      errors.message = `Message must be at least 2 characters (currently ${message.trim().length} characters).`;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      return;
    }

    setIsSending(true);

    try {
      await submitContactMessage({
        name: name.trim(),
        email: email.trim(),
        subject,
        message: message.trim(),
        userId: user?.uid || null,
      });

      // Clear the form (excluding autofill items if user remains logged in, but standard is clear)
      setSubmitSuccess(true);
      setSubject("");
      setMessage("");
      // Keep name and email prefilled if logged in, otherwise clear
      if (!user) {
        setName("");
        setEmail("");
      }
    } catch (err: any) {
      console.error("Firestore submission failed:", err);
      let errorMessage = "Could not submit your inquiry. Please try again.";
      try {
        const parsed = JSON.parse(err.message);
        if (parsed && parsed.error) {
          errorMessage += ` Details: ${parsed.error}`;
        } else {
          errorMessage += ` Error: ${err.message}`;
        }
      } catch (e) {
        errorMessage += ` Error: ${err.message || err}`;
      }
      setSubmitError(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div id="contact-us-view" className="space-y-6 max-w-4xl mx-auto pb-24 relative">
      {/* Page Title & Navigation Header */}
      <section className="flex items-center gap-3 px-1">
        <button
          onClick={() => onNavigate("dashboard")}
          className="w-10 h-10 flex items-center justify-center rounded-full border border-[#2E2E2E] bg-[#161616] hover:bg-gray-800 active:scale-95 transition-all cursor-pointer"
          aria-label="Back to Home"
        >
          <ArrowLeft className="w-4 h-4 text-[#c3c0ff]" />
        </button>
        <div>
          <h2 className="font-sans font-extrabold text-2xl text-white tracking-tight">Contact Us</h2>
          <p className="font-sans text-xs text-gray-400 mt-0.5">
            We're here to help. Reach out for support, feedback, or report any issues.
          </p>
        </div>
      </section>

      {submitSuccess && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-500/10 border border-emerald-500/30 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center gap-4 text-emerald-200"
        >
          <CheckCircle className="w-8 h-8 text-emerald-400 shrink-0" />
          <div className="space-y-1">
            <h4 className="font-sans font-bold text-base text-white">Message Sent Successfully!</h4>
            <p className="font-sans text-sm text-emerald-300/80">
              Thank you for contacting Samay AI. We have received your message and will get back to you soon.
            </p>
            <button
              onClick={() => setSubmitSuccess(false)}
              className="text-xs underline text-emerald-400 hover:text-emerald-300 font-medium transition-colors mt-2"
            >
              Submit another message
            </button>
          </div>
        </motion.div>
      )}

      {submitError && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex items-center gap-3 text-red-200"
        >
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="font-sans text-xs font-medium">{submitError}</p>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Information Sidebar */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-[#1A1A1A] border border-[#2E2E2E] rounded-xl p-5 space-y-4">
            <h3 className="font-mono text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Info className="w-4 h-4 text-[#4F46E5]" /> Information
            </h3>

            <div className="space-y-4 font-sans">
              {/* Support Email */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#4F46E5]/10 border border-[#4F46E5]/20 rounded-lg flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-[#c3c0ff]" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Support Email</p>
                  <a
                    href="mailto:support@samayai.com"
                    className="text-sm font-bold text-[#c3c0ff] hover:text-white hover:underline transition-colors block mt-0.5"
                  >
                    support@samayai.com
                  </a>
                </div>
              </div>

              {/* Response Time */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#4F46E5]/10 border border-[#4F46E5]/20 rounded-lg flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-[#c3c0ff]" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Response Time</p>
                  <p className="text-sm font-bold text-white mt-0.5">Soon</p>
                </div>
              </div>

              {/* Working Hours */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#4F46E5]/10 border border-[#4F46E5]/20 rounded-lg flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-[#c3c0ff]" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Working Hours</p>
                  <p className="text-sm font-bold text-white mt-0.5 leading-snug">
                    Monday – Friday <br />
                    <span className="text-gray-400 font-normal text-xs">9:00 AM – 6:00 PM (IST)</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 bg-gradient-to-br from-[#4F46E5]/5 to-transparent border border-[#2E2E2E] rounded-xl">
            <h4 className="font-sans font-bold text-sm text-white mb-1.5">Have a Quick Question?</h4>
            <p className="font-sans text-xs text-gray-400 leading-relaxed">
              If you have operational questions about setting deadlines or optimizing schedules, our live AI Chief of Staff in the <b>Chat</b> module is available 24/7 for instant assistance.
            </p>
          </div>
        </div>

        {/* Contact Form Card */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-[#1A1A1A] border border-[#2E2E2E] rounded-xl p-5 space-y-4">
            <h3 className="font-mono text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Send className="w-4 h-4 text-[#4F46E5]" /> Send Message
            </h3>

            {/* Guest restriction warning banner */}
            {!user && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs rounded-lg flex items-start gap-2.5 font-sans">
                <AlertCircle className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-1">
                  <p className="font-bold text-white">Inquiry Messaging Restricted</p>
                  <p className="text-gray-400">
                    To send support tickets or feedback messages to Samay AI, please click the <b>Login</b> button in the top header and sign in to your account.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="font-sans text-xs text-gray-400 font-medium">Full Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (formErrors.name) {
                      setFormErrors(prev => ({ ...prev, name: "" }));
                    }
                  }}
                  placeholder="Rahul Kumar"
                  className={`w-full bg-[#161616] border ${formErrors.name ? "border-red-500" : "border-[#2E2E2E]"
                    } rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#4F46E5] transition-colors disabled:opacity-50`}
                  disabled={isSending || !user}
                />
                {formErrors.name && (
                  <p className="text-[11px] text-red-400 flex items-center gap-1 font-sans">
                    <span>⚠️</span> {formErrors.name}
                  </p>
                )}
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="font-sans text-xs text-gray-400 font-medium">Email Address <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (formErrors.email) {
                      setFormErrors(prev => ({ ...prev, email: "" }));
                    }
                  }}
                  placeholder="rahul@example.com"
                  className={`w-full bg-[#161616] border ${formErrors.email ? "border-red-500" : "border-[#2E2E2E]"
                    } rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#4F46E5] transition-colors disabled:opacity-50`}
                  disabled={isSending || !user}
                />
                {formErrors.email && (
                  <p className="text-[11px] text-red-400 flex items-center gap-1 font-sans">
                    <span>⚠️</span> {formErrors.email}
                  </p>
                )}
              </div>
            </div>

            {/* Subject Dropdown */}
            <div className="space-y-1.5">
              <label className="font-sans text-xs text-gray-400 font-medium">Subject Category <span className="text-red-500">*</span></label>
              <select
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  if (formErrors.subject) {
                    setFormErrors(prev => ({ ...prev, subject: "" }));
                  }
                }}
                className={`w-full bg-[#161616] border ${formErrors.subject ? "border-red-500" : "border-[#2E2E2E]"
                  } rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#4F46E5] transition-all cursor-pointer disabled:opacity-50`}
                disabled={isSending || !user}
              >
                <option value="" className="text-gray-500">Select Subject Option...</option>
                <option value="General Inquiry">General Inquiry</option>
                <option value="Feedback">Feedback</option>
                <option value="Bug Report">Bug Report</option>
                <option value="Feature Request">Feature Request</option>
                <option value="Account Issue">Account Issue</option>
                <option value="Technical Support">Technical Support</option>
              </select>
              {formErrors.subject && (
                <p className="text-[11px] text-red-400 flex items-center gap-1 font-sans">
                  <span>⚠️</span> {formErrors.subject}
                </p>
              )}
            </div>

            {/* Message Textarea */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="font-sans text-xs text-gray-400 font-medium">Message <span className="text-red-500">*</span></label>
                <span className={`text-[10px] font-mono ${message.trim().length >= 20 ? "text-emerald-400" : "text-gray-500"}`}>
                  {message.trim().length} characters (min 20)
                </span>
              </div>
              <textarea
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (formErrors.message && e.target.value.trim().length >= 20) {
                    setFormErrors(prev => ({ ...prev, message: "" }));
                  }
                }}
                placeholder={user ? "How can we help you? Describe your question or issue with as much detail as possible (minimum 20 characters)..." : "Please log in to submit a message."}
                rows={6}
                className={`w-full bg-[#161616] border ${formErrors.message ? "border-red-500" : "border-[#2E2E2E]"
                  } rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#4F46E5] transition-colors resize-y disabled:opacity-50`}
                disabled={isSending || !user}
              />
              {formErrors.message && (
                <p className="text-[11px] text-red-400 flex items-center gap-1 font-sans">
                  <span>⚠️</span> {formErrors.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSending || !user}
                className="w-full md:w-auto md:px-8 bg-[#4F46E5] hover:bg-[#4338ca] disabled:bg-[#4F46E5]/40 disabled:cursor-not-allowed text-white font-sans font-bold text-sm py-3 rounded-lg hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isSending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Submitting Message...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Message</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
