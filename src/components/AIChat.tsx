import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles, ArrowLeft, Plus, MessageSquare, Trash2, Edit2, Check, X, Menu, Download } from "lucide-react";
import { ChatMessage, ChatSession, Task } from "../types";
import { jsPDF } from "jspdf";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AIChatProps {
  onNavigate: (view: string) => void;
  userProfile?: any;
  tasks?: Task[];
  onToggleTask?: (id: string) => void;
  onDeleteTask?: (id: string) => void;
}

export default function AIChat({
  onNavigate,
  userProfile,
  tasks = [],
  onToggleTask,
  onDeleteTask,
}: AIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("default");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Custom sidebar mobile toggle
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Custom renaming states
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState("");

  // Confirmation modal
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/chat/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error("Error loading chat sessions:", err);
    }
  };

  const fetchMessages = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/chat?sessionId=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Error loading messages for session:", err);
    }
  };

  const handleCreateSession = async () => {
    const newSessionId = `session-${Date.now()}`;
    try {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newSessionId, title: "New Conversation" }),
      });
      if (res.ok) {
        const newSession = await res.json();
        setSessions((prev) => [newSession, ...prev]);
        setActiveSessionId(newSessionId);
        // On mobile, close sidebar after creation
        setSidebarOpen(false);
      }
    } catch (err) {
      console.error("Error creating session:", err);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch("/api/chat/sessions/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (activeSessionId === sessionId) {
          setActiveSessionId("default");
        }
      }
    } catch (err) {
      console.error("Error deleting session:", err);
    }
  };

  const handleStartRename = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitleInput(session.title);
  };

  const handleSaveRename = async (sessionId: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editTitleInput.trim()) return;
    try {
      const res = await fetch("/api/chat/sessions/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, title: editTitleInput.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
        setEditingSessionId(null);
      }
    } catch (err) {
      console.error("Error renaming session:", err);
    }
  };

  const handleClearActiveSession = () => {
    setShowConfirmClear(true);
  };

  const confirmClearSession = async () => {
    setShowConfirmClear(false);
    try {
      const res = await fetch("/api/chat/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Error clearing chat session:", err);
    }
  };

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const activeSession = sessions.find((s) => s.id === activeSessionId);
      const sessionTitle = activeSession ? activeSession.title : "General Discussion";

      // Styles & Constants
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // Primary color: deep indigo/violet #4F46E5
      // Header Banner
      doc.setFillColor(79, 70, 229);
      doc.rect(margin, y, contentWidth, 22, "F");

      // Header Text
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("SAMAY AI - CHIEF OF STAFF", margin + 6, y + 9);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Optimized Schedule & Productivity Transcript", margin + 6, y + 15);

      y += 28;

      // Session Information
      doc.setTextColor(31, 41, 55);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`Conversation: ${sessionTitle}`, margin, y);
      y += 6;

      doc.setTextColor(107, 114, 128);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const today = new Date().toLocaleString();
      doc.text(`Exported on: ${today}`, margin, y);

      y += 10;

      // Draw horizontal dividing line
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;

      // Render messages
      if (cleanMessages.length === 0) {
        doc.setTextColor(107, 114, 128);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.text("No messages in this conversation session.", margin, y);
      } else {
        cleanMessages.forEach((msg) => {
          // Check if we need to start a new page
          if (y > pageHeight - 35) {
            doc.addPage();
            y = margin + 10;
          }

          const isAI = msg.sender === "ai";
          const senderName = isAI ? "AI CHIEF OF STAFF" : (userProfile?.displayName?.toUpperCase() || "USER");
          const timestampStr = msg.timestamp || "";

          // Draw Sender Header with subtle colored dot/text
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.5);
          if (isAI) {
            doc.setTextColor(67, 56, 202); // AI Accent
          } else {
            doc.setTextColor(31, 41, 55); // User Accent
          }

          doc.text(senderName, margin, y);

          // Timestamp right-aligned or inline
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(156, 163, 175);
          const senderWidth = doc.getTextWidth(senderName);
          doc.text(`•  ${timestampStr}`, margin + senderWidth + 4, y);

          y += 5;

          // Message Body - wrapped text
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(55, 65, 81);

          // Sanitize text by removing emojis and replacing Rupee symbol to prevent jsPDF font rendering corruption
          const sanitizedText = msg.text
            .replace(/[\u20B9]/g, 'INR')
            .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '');

          const textLines = doc.splitTextToSize(sanitizedText, contentWidth);
          const lineHeight = 5.5;

          // Before printing text lines, check space and wrap beautifully
          textLines.forEach((line: string) => {
            if (y > pageHeight - 20) {
              doc.addPage();
              y = margin + 10;
            }
            doc.text(line, margin, y);
            y += lineHeight;
          });

          y += 4; // space between messages
        });
      }

      // Add footer page numbers to all pages
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.text(
          `Page ${i} of ${pageCount}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: "center" }
        );
        doc.text(
          "Samay AI - Crafted for Ultra Productivity",
          margin,
          pageHeight - 10
        );
      }

      // Save PDF
      const sanitizedTitle = sessionTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      doc.save(`samay-ai-transcript-${sanitizedTitle}.pdf`);

    } catch (err) {
      console.error("Failed to generate PDF:", err);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    fetchMessages(activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const aiResponsesCount = messages.filter((msg) => msg.sender === "ai").length;
  const maxAIResponses = 20;
  const hasReachedLimit = aiResponsesCount >= maxAIResponses;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending || hasReachedLimit) return;

    const userText = input;
    setInput("");
    setSending(true);
    setChatError(null);

    // Optimistically update message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      sender: "user",
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sessionId: activeSessionId
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          name: userProfile?.displayName || "User",
          sessionId: activeSessionId,
          userId: userProfile?.uid || ""
        }),
      });
      if (!res.ok) {
        throw new Error(`Server returned status code ${res.status}`);
      }
      const data = await res.json();
      if (data.aiMessage) {
        // Directly append the AI reply — no second round-trip needed
        setMessages((prev) => {
          // Replace the optimistic user message with the canonical one from server
          const withoutTemp = prev.filter((m) => !m.id.startsWith("temp-"));
          return data.userMessage
            ? [...withoutTemp, data.userMessage, data.aiMessage]
            : [...withoutTemp, data.aiMessage];
        });
        // Refresh sessions lazily in the background (title update etc.)
        fetchSessions().catch(() => {});
      }
    } catch (err) {
      console.error("Error sending message to AI:", err);
      setChatError("System is busy, please try again in a few seconds");
      const errMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "ai",
        text: "System is busy, please try again in a few seconds",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sessionId: activeSessionId
      };
      setMessages((prev) => [...prev, errMessage]);
    } finally {
      setSending(false);
    }
  };

  const cleanMessages = messages.map((msg) => {
    let text = msg.text || "";
    if (userProfile?.displayName) {
      const parts = userProfile.displayName.split(" ");
      const firstName = parts[0] || userProfile.displayName;
      text = text.replace(/\bRahul\b/g, firstName);
    }
    return { ...msg, text };
  });

  return (
    <div id="ai-chat-view" className="flex flex-col md:grid md:grid-cols-4 h-[calc(100vh-140px)] max-w-6xl mx-auto gap-4 relative">

      {/* Sidebar - Sessions History list */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-[#141414] border-r border-[#2E2E2E] p-4 flex flex-col transition-transform duration-300 transform
        md:relative md:translate-x-0 md:inset-auto md:w-auto md:h-full md:bg-[#111111]/90 md:border md:rounded-2xl
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        {/* Mobile Header / Close Sidebar button */}
        <div className="flex items-center justify-between mb-4 md:hidden">
          <span className="font-sans font-bold text-white text-sm">Conversation History</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded-lg border border-[#2E2E2E] hover:bg-gray-800 text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Start New Chat Button */}
        <button
          onClick={handleCreateSession}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold shadow-md active:scale-95 transition-all cursor-pointer shrink-0 mb-4"
        >
          <Plus className="w-4 h-4" /> Start New Chat
        </button>

        {/* Sessions scrollable list */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-gray-800">
          {sessions.length === 0 ? (
            <div
              onClick={() => setActiveSessionId("default")}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer group text-left ${activeSessionId === "default"
                ? "bg-[#1A1A1A] border-l-2 border-l-[#4F46E5] text-white"
                : "text-gray-400 hover:bg-[#1A1A1A]/50 hover:text-white"
                }`}
            >
              <MessageSquare className="w-4 h-4 text-[#c3c0ff] shrink-0" />
              <span className="font-sans text-xs font-medium truncate">General Discussion</span>
            </div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => {
                  setActiveSessionId(s.id);
                  setSidebarOpen(false); // close sidebar on mobile after selection
                }}
                className={`flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer group text-left ${activeSessionId === s.id
                  ? "bg-[#1A1A1A] border-l-2 border-[#4F46E5] text-white"
                  : "text-gray-400 hover:bg-[#1A1A1A]/50 hover:text-white"
                  }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <MessageSquare className="w-3.5 h-3.5 text-[#c3c0ff] shrink-0" />
                  {editingSessionId === s.id ? (
                    <form
                      onSubmit={(e) => handleSaveRename(s.id, e)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 w-full"
                    >
                      <input
                        type="text"
                        value={editTitleInput}
                        onChange={(e) => setEditTitleInput(e.target.value)}
                        className="bg-[#2E2E2E] text-white text-xs px-1.5 py-0.5 rounded outline-none border border-[#4F46E5] w-full"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(s.id)}
                        className="text-green-500 hover:text-green-400 shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setEditingSessionId(null); }}
                        className="text-red-500 hover:text-red-400 shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <span className="font-sans text-xs font-medium truncate leading-tight">
                      {s.title}
                    </span>
                  )}
                </div>

                {editingSessionId !== s.id && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                    <button
                      onClick={(e) => handleStartRename(s, e)}
                      className="p-1 rounded text-gray-500 hover:text-[#c3c0ff] hover:bg-[#2E2E2E] transition-all"
                      title="Rename conversation"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="p-1 rounded text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-all"
                      title="Delete conversation"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="pt-4 border-t border-[#2E2E2E] mt-4 text-[10px] text-gray-500 font-mono flex items-center justify-between">
          <span>Active Session ID</span>
          <span className="text-[#c3c0ff] truncate max-w-[100px]" title={activeSessionId}>
            {activeSessionId}
          </span>
        </div>
      </div>

      {/* Main Chat Box - spans 3 columns on medium screens, 2 columns on large screens */}
      <div className="flex-1 md:col-span-3 lg:col-span-2 bg-[#111111]/90 border border-[#2E2E2E] rounded-2xl p-5 flex flex-col h-full relative overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-1 shrink-0 border-b border-[#2E2E2E] pb-3 mb-2">
          <div className="flex items-center gap-3">
            {/* Back button */}
            <button
              onClick={() => onNavigate("dashboard")}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-[#2E2E2E] hover:bg-gray-800 active:scale-95 transition-all cursor-pointer"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4 text-[#c3c0ff]" />
            </button>

            {/* Sidebar toggle for mobile */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-9 h-9 flex md:hidden items-center justify-center rounded-full border border-[#2E2E2E] hover:bg-gray-800 active:scale-95 transition-all cursor-pointer"
              title="Open Conversation History"
            >
              <Menu className="w-4 h-4 text-[#c3c0ff]" />
            </button>

            <div>
              <h2 className="font-sans font-extrabold text-lg text-white tracking-tight flex items-center gap-1.5 leading-none">
                <Sparkles className="w-4 h-4 text-[#c3c0ff] fill-[#c3c0ff]" /> AI Chief of Staff
              </h2>
              <p className="font-mono text-[9px] text-[#22C55E] uppercase tracking-wider mt-1.5">
                Active Session {aiResponsesCount > 0 && `• ${aiResponsesCount}/20 Responses`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDownloadPDF}
              disabled={cleanMessages.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2E2E2E] bg-[#1A1A1A]/80 text-xs font-medium text-gray-300 hover:bg-[#2E2E2E] hover:text-white active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Download chat as PDF"
            >
              <Download className="w-3.5 h-3.5 text-[#c3c0ff]" />
              <span className="hidden sm:inline">Download PDF</span>
            </button>
            <button
              onClick={handleClearActiveSession}
              className="px-3 py-1.5 rounded-lg border border-[#2E2E2E] text-xs font-medium text-gray-400 hover:bg-[#2E2E2E] hover:text-white active:scale-95 transition-all cursor-pointer"
            >
              Clear Chat
            </button>
          </div>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1 scrollbar-thin scrollbar-thumb-gray-800">
          {cleanMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl p-4 text-sm leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-[#4F46E5] text-white rounded-br-none"
                    : "bg-[#1A1A1A] border border-[#2E2E2E] text-gray-200 rounded-bl-none border-l-4 border-l-[#4F46E5]"
                }`}
              >
                {msg.sender === "user" ? (
                  <p className="font-sans whitespace-pre-wrap">{msg.text}</p>
                ) : (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Headings
                        h1: ({ children }) => <h1 className="text-base font-extrabold text-[#c3c0ff] mt-3 mb-1.5 border-b border-[#2E2E2E] pb-1">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-sm font-bold text-[#c3c0ff] mt-3 mb-1">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-[13px] font-bold text-[#4F46E5] mt-2 mb-1">{children}</h3>,
                        // Paragraph
                        p: ({ children }) => <p className="text-gray-300 text-[13px] leading-relaxed mb-2 last:mb-0">{children}</p>,
                        // Bold / Italic
                        strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                        em: ({ children }) => <em className="text-gray-400 italic">{children}</em>,
                        // Lists
                        ul: ({ children }) => <ul className="space-y-1 my-2 ml-3">{children}</ul>,
                        ol: ({ children }) => <ol className="space-y-1 my-2 ml-4 list-decimal">{children}</ol>,
                        li: ({ children }) => (
                          <li className="text-gray-300 text-[13px] leading-relaxed flex gap-2">
                            <span className="text-[#4F46E5] shrink-0 mt-[3px]">•</span>
                            <span>{children}</span>
                          </li>
                        ),
                        // Inline code
                        code: ({ inline, children, ...props }: any) =>
                          inline ? (
                            <code className="bg-[#0d0d1f] text-[#c3c0ff] font-mono text-[11px] px-1.5 py-0.5 rounded border border-[#2E2E2E]" {...props}>{children}</code>
                          ) : (
                            <code className="block bg-[#060610] text-[#86efac] font-mono text-[11px] p-3 rounded-lg border border-[#1e1e3a] overflow-x-auto whitespace-pre" {...props}>{children}</code>
                          ),
                        // Code block wrapper
                        pre: ({ children }) => <pre className="my-2 rounded-lg overflow-hidden border border-[#1e1e3a]">{children}</pre>,
                        // Horizontal rule
                        hr: () => <hr className="border-[#2E2E2E] my-3" />,
                        // Blockquote
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-2 border-[#4F46E5] pl-3 my-2 italic text-gray-400 text-[12px]">{children}</blockquote>
                        ),
                        // Tables
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-2">
                            <table className="w-full text-[12px] border-collapse">{children}</table>
                          </div>
                        ),
                        thead: ({ children }) => <thead className="bg-[#0d0d1f]">{children}</thead>,
                        th: ({ children }) => <th className="text-left text-[#c3c0ff] font-semibold px-3 py-1.5 border border-[#2E2E2E]">{children}</th>,
                        td: ({ children }) => <td className="text-gray-300 px-3 py-1.5 border border-[#2E2E2E]">{children}</td>,
                        tr: ({ children }) => <tr className="even:bg-[#141414]">{children}</tr>,
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                )}
                <span className="block text-[9px] text-gray-500 font-mono mt-2 text-right">
                  {msg.timestamp}
                </span>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-[#1A1A1A] border border-[#2E2E2E] rounded-2xl p-4 rounded-bl-none border-l-4 border-l-[#4F46E5] max-w-[85%]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#4F46E5] animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-[#4F46E5] animate-bounce delay-100"></span>
                  <span className="w-2 h-2 rounded-full bg-[#4F46E5] animate-bounce delay-200"></span>
                </div>
              </div>
            </div>
          )}

          {hasReachedLimit && (
            <div className="flex justify-center my-4">
              <div className="bg-[#1A1A1A] border border-red-500/20 rounded-2xl p-5 max-w-md text-center shadow-lg border-t-4 border-t-red-500">
                <p className="font-sans text-sm text-gray-200 mb-2 font-bold">
                  ⚠️ Chat Limit Reached
                </p>
                <p className="font-sans text-xs text-gray-400 mb-4">
                  You have completed the maximum of 20 chat responses for this conversation session. Please start a <strong>New Chat</strong> to continue with fresh responses.
                </p>
                <button
                  type="button"
                  onClick={handleCreateSession}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#6366F1] text-white font-sans text-xs font-semibold shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Start New Chat
                </button>
              </div>
            </div>
          )}

          <div ref={scrollRef}></div>
        </div>

        {/* Input Box */}
        <form onSubmit={handleSend} className="shrink-0 pt-3">
          {chatError && (
            <div className="mb-2.5 p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs rounded-xl flex items-center gap-2 font-sans animate-in fade-in slide-in-from-bottom-2 duration-200">
              <span className="text-sm">⚠️</span>
              <span>{chatError}</span>
            </div>
          )}
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={hasReachedLimit || sending}
              placeholder={hasReachedLimit ? "Limit reached. Start a New Chat to continue." : "Ask anything or request to re-optimize schedule..."}
              className="w-full bg-[#1A1A1A] border border-[#2E2E2E] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] rounded-xl pl-4 pr-12 py-3.5 placeholder:text-gray-600 text-white text-sm outline-none transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending || hasReachedLimit}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg bg-[#4F46E5] text-white hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
        <p className="font-sans text-[10px] text-gray-500 text-center mt-2.5 tracking-tight">
          AI Assistant can make mistakes. Please verify important information before relying on it.
        </p>
      </div>

      {/* Tasks Sidebar Panel - visible on large screens */}
      <div className="hidden lg:flex lg:col-span-1 border border-[#2E2E2E] rounded-2xl p-4 bg-[#111111]/90 backdrop-blur flex-col h-full overflow-hidden space-y-4">
        <h3 className="font-mono text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 pb-2 border-b border-[#2E2E2E]">
          📋 Active Tasks
        </h3>
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-gray-800">
          {tasks.filter(t => !t.completed).length === 0 ? (
            <p className="text-gray-500 text-xs font-sans text-center py-8">No active tasks pending.</p>
          ) : (
            tasks.filter(t => !t.completed).map(t => (
              <div key={t.id} className="p-3 bg-[#1A1A1A] border border-[#2E2E2E] rounded-xl flex items-center justify-between gap-3 group hover:border-[#4F46E5]/40 transition-all">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => onToggleTask && onToggleTask(t.id)}
                    className="w-4 h-4 rounded border border-gray-600 flex items-center justify-center text-transparent hover:border-[#4F46E5] hover:text-[#4F46E5] transition-all cursor-pointer shrink-0 animate-in fade-in"
                  >
                    <Check className="w-3 h-3 text-white" />
                  </button>
                  <span className="font-sans text-xs text-white truncate font-medium">{t.name}</span>
                </div>
                <button
                  onClick={() => onDeleteTask && onDeleteTask(t.id)}
                  className="p-1 rounded text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Background overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs md:hidden"
        ></div>
      )}

      {/* Custom Confirmation Modal for Clearing Chat */}
      {showConfirmClear && (
        <div className="absolute inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] border border-[#2E2E2E] rounded-2xl p-6 max-w-sm w-full shadow-2xl border-t-4 border-t-[#4F46E5] animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-sans font-bold text-lg text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#c3c0ff]" /> Clear Chat History?
            </h3>
            <p className="font-sans text-xs text-gray-400 mb-6 leading-relaxed">
              This will permanently delete the message history of the current conversation session.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirmClear(false)}
                className="px-4 py-2 rounded-xl border border-[#2E2E2E] text-xs font-semibold text-gray-300 hover:bg-[#2E2E2E] active:scale-95 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmClearSession}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-500 active:scale-95 transition-all cursor-pointer"
              >
                Clear Messages
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

