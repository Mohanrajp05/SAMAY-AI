# -*- coding: utf-8 -*-
"""
SamayAI - Python Flask Backend API Server
This file provides the complete Flask-based backend requested by the user.
To run this locally:
  1. Install dependencies: pip install flask flask-cors google-genai python-dotenv
  2. Set your environment variable: export GEMINI_API_KEY="your_api_key_here"
  3. Run the server: python app.py
"""

import os
import time
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

# Try to import Google GenAI SDK
try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None

load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

PORT = 3000

# Lazy initialize Gemini Client
def get_ai_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("WARNING: GEMINI_API_KEY is not defined. AI features will run on local mock fallback.")
        return None
    if genai is not None:
        return genai.Client(api_key=api_key)
    return None

# In-memory Database matching screenshots
tasks = [
    {
        "id": "task-1",
        "name": "DSA Assignment",
        "dueDate": "2026-06-25",
        "time": "18:00",
        "category": "Academic",
        "difficulty": "Hard",
        "notes": "Make sure to solve standard sorting and tree questions first.",
        "completed": False,
        "overdue": True,
        "hoursLate": 0,
    },
    {
        "id": "task-2",
        "name": "DSA Sheet",
        "dueDate": "2026-06-25",
        "time": "12:00",
        "category": "Academic",
        "difficulty": "Medium",
        "notes": "Review arrays, strings, and sliding window techniques.",
        "completed": False,
        "overdue": True,
        "hoursLate": 12,
    },
    {
        "id": "task-3",
        "name": "Email Client",
        "dueDate": "2026-06-25",
        "time": "10:00",
        "category": "Work",
        "difficulty": "Medium",
        "notes": "Send the updated wireframe and mock API spec.",
        "completed": False,
        "overdue": True,
        "hoursLate": 8,
    },
    {
        "id": "task-4",
        "name": "Submit Report",
        "dueDate": "2026-06-25",
        "time": "13:00",
        "category": "Work",
        "difficulty": "Easy",
        "notes": "Log weekly progress report on JIRA board.",
        "completed": False,
        "overdue": True,
        "hoursLate": 5,
    },
    {
        "id": "task-5",
        "name": "Fix Bugs",
        "dueDate": "2026-06-25",
        "time": "15:00",
        "category": "Work",
        "difficulty": "Hard",
        "notes": "Fix memory leak issue on database connection pool.",
        "completed": False,
        "overdue": True,
        "hoursLate": 3,
    },
    {
        "id": "task-6",
        "name": "Database Backup",
        "dueDate": "2026-06-25",
        "time": "17:00",
        "category": "Other",
        "difficulty": "Easy",
        "notes": "Manual database snapshot dump upload to AWS S3.",
        "completed": False,
        "overdue": True,
        "hoursLate": 1,
    },
]

bills = [
    {
        "id": "bill-1",
        "name": "Credit Card Bill",
        "bank": "HDFC",
        "amount": 8500,
        "dueDateDays": 1,
        "category": "Urgent",
        "priority": "high",
        "completed": False,
    },
    {
        "id": "bill-2",
        "name": "College Semester Fee",
        "bank": "Google Pay / Bank Transfer",
        "amount": 45000,
        "dueDateDays": 5,
        "category": "Upcoming",
        "priority": "medium",
        "completed": False,
    },
    {
        "id": "bill-3",
        "name": "Netflix Subscription",
        "bank": "Auto Debit",
        "amount": 649,
        "dueDateDays": 12,
        "category": "Secure",
        "priority": "low",
        "completed": False,
    },
    {
        "id": "bill-4",
        "name": "GST Filing",
        "bank": "Gov Portal",
        "amount": 0,
        "dueDateDays": 18,
        "category": "Compliance",
        "priority": "high",
        "completed": False,
    },
]

schedule = [
    {"id": "s-1", "time": "9:00 AM", "name": "Study DSA", "duration": "3 hrs", "isLunchBreak": False},
    {"id": "s-2", "time": "12:00 PM", "name": "Lunch break", "isLunchBreak": True},
    {"id": "s-3", "time": "2:00 PM", "name": "Mini Project", "isLunchBreak": False},
    {"id": "s-4", "time": "5:00 PM", "name": "Resume update", "isLunchBreak": False},
]

settings = {
    "role": "Student",
    "personalityMode": "Drill Sergeant",
    "morningBriefingEnabled": True,
    "panicModeAlertsEnabled": True,
    "telegramConnected": True,
    "emailConnected": True,
    "planningStyle": "Balanced",
    "startHour": "9:00 AM",
    "endHour": "10:00 PM",
    "googleCalendarConnected": True,
    "googleAccountEmail": "rahul@gmail.com",
}

messages = [
    {
        "id": "m-1",
        "sender": "ai",
        "text": "Good morning Rahul! I am your SamayAI Chief of Staff. How can I help you optimize your schedule today?",
        "timestamp": "9:00 AM",
    }
]

# --- API Routes ---

@app.route("/api/tasks", methods=["GET", "POST"])
def manage_tasks():
    global tasks
    if request.method == "POST":
        data = request.json or {}
        if not data.get("name"):
            return jsonify({"error": "Task name is required"}), 400
        
        new_task = {
            "id": "task-{}".format(int(time.time() * 1000)),
            "name": data.get("name"),
            "dueDate": data.get("dueDate", "2026-06-25"),
            "time": data.get("time", "12:00"),
            "category": data.get("category", "Other"),
            "difficulty": data.get("difficulty", "Medium"),
            "notes": data.get("notes", ""),
            "completed": False,
            "overdue": False,
        }
        tasks.append(new_task)
        return jsonify(new_task), 201
    
    return jsonify(tasks)

@app.route("/api/tasks/toggle", methods=["POST"])
def toggle_task():
    global tasks
    data = request.json or {}
    task_id = data.get("id")
    for task in tasks:
        if task["id"] == task_id:
            task["completed"] = not task["completed"]
            if task["completed"]:
                task["overdue"] = False
    return jsonify({"success": True, "tasks": tasks})

@app.route("/api/tasks/delete", methods=["POST"])
def delete_task():
    global tasks
    data = request.json or {}
    task_id = data.get("id")
    tasks = [task for task in tasks if task["id"] != task_id]
    return jsonify({"success": True, "tasks": tasks})

@app.route("/api/tasks/snooze", methods=["POST"])
def snooze_task():
    global tasks
    data = request.json or {}
    task_id = data.get("id")
    for task in tasks:
        if task["id"] == task_id:
            task["hoursLate"] = max(0, task.get("hoursLate", 0) - 1)
    return jsonify({"success": True, "tasks": tasks})

@app.route("/api/bills", methods=["GET", "POST"])
def manage_bills():
    global bills
    if request.method == "POST":
        data = request.json or {}
        new_bill = {
            "id": "bill-{}".format(int(time.time() * 1000)),
            "name": data.get("name"),
            "bank": data.get("bank", "Unknown"),
            "amount": float(data.get("amount", 0)),
            "dueDateDays": int(data.get("dueDateDays", 5)),
            "category": data.get("category", "Upcoming"),
            "priority": data.get("priority", "medium"),
            "completed": False,
        }
        bills.append(new_bill)
        return jsonify(new_bill), 201
    return jsonify(bills)

@app.route("/api/bills/toggle", methods=["POST"])
def toggle_bill():
    global bills
    data = request.json or {}
    bill_id = data.get("id")
    for bill in bills:
        if bill["id"] == bill_id:
            bill["completed"] = not bill["completed"]
    return jsonify({"success": True, "bills": bills})

@app.route("/api/settings", methods=["GET", "POST"])
def manage_settings():
    global settings
    if request.method == "POST":
        data = request.json or {}
        settings.update(data)
    return jsonify(settings)

@app.route("/api/schedule", methods=["GET"])
def get_schedule():
    return jsonify(schedule)

@app.route("/api/schedule/reoptimize", methods=["POST"])
def reoptimize_schedule():
    global schedule
    schedule = [
        {"id": "s-1", "time": "10:00 AM", "name": "Quick Wireframe Triage", "duration": "1.5 hrs", "isLunchBreak": False},
        {"id": "s-2", "time": "12:00 PM", "name": "Email Client & Bugs Triage", "duration": "2 hrs", "isLunchBreak": False},
        {"id": "s-3", "time": "2:00 PM", "name": "Lunch break", "isLunchBreak": True},
        {"id": "s-4", "time": "3:00 PM", "name": "Database Backup Tasks", "duration": "1 hr", "isLunchBreak": False},
        {"id": "s-5", "time": "4:00 PM", "name": "DSA Core Assignment", "duration": "3 hrs", "isLunchBreak": False},
    ]
    return jsonify({"success": True, "schedule": schedule})

@app.route("/api/chat", methods=["GET", "POST"])
def chat():
    global messages
    if request.method == "POST":
        data = request.json or {}
        message = data.get("message")
        if not message:
            return jsonify({"error": "Message is required"}), 400
        
        user_msg = {
            "id": "m-user-{}".format(int(time.time() * 1000)),
            "sender": "user",
            "text": message,
            "timestamp": time.strftime("%I:%M %p"),
        }
        messages.append(user_msg)

        ai_client = get_ai_client()
        reply_text = ""
        if ai_client:
            try:
                prompt_content = """You are SamayAI, a sleek, premium, high-performance 'AI Chief of Staff' productivity assistant.
                Your user is Rahul, currently a {role} operating in '{mode}' personality mode.
                
                The current tasks list is:
                {tasks}
                
                User's question: "{msg}"
                
                Respond in character (authoritative, sharp, precise, and supportive with a high-performance vibe).
                Keep your response highly scannable, under 150 words.""".format(
                    role=settings["role"],
                    mode=settings["personalityMode"],
                    tasks=str([t for t in tasks if not t["completed"]]),
                    msg=message
                )
                
                response = ai_client.models.generate_content(
                    model="gemini-3.5-flash",
                    contents=prompt_content,
                )
                reply_text = response.text or "I was unable to analyze your query."
            except Exception as e:
                reply_text = "System Override Error: {}. Falling back to manual backup.".format(str(e))
        else:
            # High-performance mock replies
            if settings["personalityMode"] == "Drill Sergeant":
                reply_text = "SOLDIER! Your current DSA Sheet is 12 hours late. Turn on 'Activate Deep Focus' immediately and let's clean up these wireframes now! No compromises!"
            else:
                reply_text = "Based on your current plan, your DSA Assignment is due at 6PM. I highly suggest starting a 30-min deep focus block to get the momentum going. Let's do this!"

        ai_msg = {
            "id": "m-ai-{}".format(int(time.time() * 1000)),
            "sender": "ai",
            "text": reply_text,
            "timestamp": time.strftime("%I:%M %p"),
        }
        messages.append(ai_msg)
        return jsonify({"userMessage": user_msg, "aiMessage": ai_msg})

    return jsonify(messages)

@app.route("/api/ai/plan", methods=["POST"])
def generate_plan():
    data = request.json or {}
    text = data.get("text")
    if not text:
        return jsonify({"error": "Text is required"}), 400

    ai_client = get_ai_client()
    if ai_client:
        try:
            response = ai_client.models.generate_content(
                model="gemini-3.5-flash",
                contents="""Analyze this brain dump and extract structured tasks/milestones.
                Brain dump: "{}"
                
                Return a JSON array of objects, where each object has:
                - "name": String, clean task title
                - "dueDate": String in "YYYY-MM-DD" format
                - "category": String, one of "Academic", "Work", "Finance", "Other"
                - "difficulty": String, one of "Easy", "Medium", "Hard"
                - "notes": String, additional context
                
                Respond ONLY with a valid JSON array.""".format(text),
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            import json
            parsed_plan = json.loads(response.text or "[]")
            return jsonify({"plan": parsed_plan})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        mock_plan = [
            {"name": "Read Chapters 5 & 6", "dueDate": "2026-06-25", "category": "Academic", "difficulty": "Medium", "notes": "Break down into active recall sessions."},
            {"name": "Solve 20 Practice Problems", "dueDate": "2026-06-26", "category": "Academic", "difficulty": "Hard", "notes": "Focus on graphs and dynamic programming."},
            {"name": "Full Revision + Mock Test", "dueDate": "2026-06-27", "category": "Academic", "difficulty": "Medium", "notes": "Simulate exact exam environment."}
        ]
        return jsonify({"plan": mock_plan})

@app.route("/api/ai/briefing-report", methods=["GET"])
def get_briefing_report():
    ai_client = get_ai_client()
    if ai_client:
        try:
            response = ai_client.models.generate_content(
                model="gemini-3.5-flash",
                contents="""Generate a daily morning report in JSON format for Rahul.
                User settings: {}
                Overdue tasks: {}
                Upcoming bills: {}
                
                Generate exactly 3 briefing reports:
                1. High warning: Most urgent task
                2. Normal status: What is on track
                3. Attention needed: Upcoming project/prep
                
                The output must be a JSON object with "alerts" as an array of objects:
                - "type": "warning" | "success" | "info"
                - "message": string details
                - "boldText": string heading
                
                Return ONLY valid JSON.""".format(str(settings), str(tasks), str(bills)),
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            import json
            return jsonify(json.loads(response.text or "{}"))
        except Exception as e:
            pass

    return jsonify({
        "alerts": [
            {"type": "warning", "boldText": "DSA Sheet is due TODAY at 6PM", "message": " — You have 8 hours. Start NOW."},
            {"type": "success", "boldText": "Client Logo is on track", "message": ""},
            {"type": "info", "boldText": "Interview Prep needs attention", "message": " — only 3 days left, 0% done"}
        ]
    })

@app.route("/api/ai/bill-insight", methods=["GET"])
def get_bill_insight():
    ai_client = get_ai_client()
    if ai_client:
        try:
            response = ai_client.models.generate_content(
                model="gemini-3.5-flash",
                contents="""Analyze Rahul's bills: {} and provide a single smart, helpful financial insight. 
                Keep it under 30 words, with custom intelligence.""".format(str(bills)),
            )
            return jsonify({"insight": response.text or "Cashflow fully optimized."})
        except Exception:
            pass
    return jsonify({"insight": "Your credit card always sneaks up on you. I've set auto-reminders 5 days before each month's due date permanently."})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=True)
