# Project Knowledge Base: SamayAI

This document serves as a persistent context ledger for developers and AI agents continuing work on the **SamayAI** codebase.

---

## 🚀 Project Overview
- **Name**: SamayAI
- **Description**: An AI-powered high-performance productivity dashboard, bill insight analyzer, schedule planner, and deadline tracker with real-time Telegram companion integration.
- **Architecture**: Full-stack React (Vite + TypeScript) with a custom Express backend (`server.ts`) proxying Firestore & Gemini services.

---

## 🛠️ Tech Stack & Key Files
- **Frontend**: React, Tailwind CSS, Lucide Icons, Recharts (`src/components/`, `src/App.tsx`).
- **Backend**: Express on Node.js (`server.ts`).
- **Database**: Firebase Firestore (`ai-studio-samayai-2cc10770-6bc3-4503-9bb9-1c7a35350c8e`).
- **AI Engine**: Google Gemini API via server-side endpoints.
- **State & Notifications**: Telegram Companion Service (`src/lib/telegramServerService.ts`).

---

## ⚠️ CRITICAL ARCHITECTURAL WORKAROUND (Do Not Revert!)

### The Permission Denied Bug (Resolved)
Initially, server-side code in `/server.ts` and `/src/lib/telegramServerService.ts` used `firebase-admin` to access Firestore. On Cloud Run, this resulted in:
`Failed to send real Telegram test-push message: 7 PERMISSION_DENIED: Missing or insufficient permissions`
because the runtime default Service Account lacked the administrative IAM privileges to query the user's provisioned Firestore database.

### The Solution: Web SDK Server Wrapper
In `/src/lib/firebaseServer.ts`, we created a **ClientFirestoreWrapper** using the standard client-side Web Firestore SDK, initialized using the credentials inside `/firebase-applet-config.json` (which is fully authorized to query the DB). 

This wrapper exposes an identical interface to `firebase-admin`'s Firestore instance:
- `db.collection(name)`
- `.doc(id).get()` / `.doc(id).set(data, { merge })` / `.doc(id).delete()`
- `.where(field, op, val).get()`
- `.batch()` supporting `.set()`, `.delete()`, and `.commit()`

**Do NOT replace this client-side wrapper in `/src/lib/firebaseServer.ts` with standard `firebase-admin`**, as doing so will immediately trigger the `PERMISSION_DENIED` error in production.

---

## 📁 Key Feature Map

1. **AI Chat & Companion** (`src/components/AIChat.tsx`)
   - Interactive scheduling companion providing direct layout optimizations.

2. **Daily Briefings & Bill Insights** (`server.ts`)
   - Auto-generated briefings and utility bill insights delivered through server proxy pathways.

3. **Telegram Push Channels** (`src/lib/telegramServerService.ts`, `server.ts`)
   - Integration with Telegram bots to send direct task push updates and notifications to connected users.
