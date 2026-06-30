export type TaskCategory = "Academic" | "Work" | "Finance" | "Other";
export type TaskDifficulty = "Easy" | "Medium" | "Hard";

export interface Task {
  id: string;
  name: string;
  dueDate: string; // YYYY-MM-DD
  time?: string; // HH:MM
  category: TaskCategory;
  difficulty: TaskDifficulty;
  notes?: string;
  completed: boolean;
  overdue: boolean;
  hoursLate?: number;
}

export interface Bill {
  id: string;
  name: string;
  bank?: string;
  amount: number;
  dueDateDays: number;
  category: "Urgent" | "Upcoming" | "Secure" | "Compliance";
  priority: "high" | "medium" | "low";
  completed: boolean;
}

export interface AIScheduleItem {
  id: string;
  time: string;
  name: string;
  duration?: string;
  isLunchBreak?: boolean;
}

export interface BriefingAlert {
  id: string;
  type: "warning" | "success" | "info";
  message: string;
  boldText: string;
}

export interface UserSettings {
  role: "Student" | "Professional" | "Founder" | "Hybrid";
  personalityMode: "Drill Sergeant" | "Best Friend" | "Zen Coach" | "Corporate";
  morningBriefingEnabled: boolean;
  panicModeAlertsEnabled: boolean;
  telegramConnected: boolean;
  emailConnected: boolean;
  planningStyle: "Aggressive" | "Balanced" | "Relaxed";
  startHour: string;
  endHour: string;
  googleCalendarConnected: boolean;
  googleAccountEmail: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  sessionId?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
}
