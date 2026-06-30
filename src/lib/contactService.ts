import { db } from "./firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export interface ContactSubmission {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "New";
  createdAt: any;
}

export async function submitContactMessage(data: {
  name: string;
  email: string;
  subject: string;
  message: string;
  userId: string | null;
}): Promise<void> {
  // 1. Submit via our ultra-reliable backend proxy endpoint (saves to local_db.json on server)
  const response = await fetch("/api/contact", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: data.name,
      email: data.email,
      subject: data.subject,
      message: data.message,
      userId: data.userId,
    }),
  });

  if (!response.ok) {
    let errorMsg = "Failed to submit message to server.";
    try {
      const errJson = await response.json();
      if (errJson && errJson.error) {
        errorMsg = errJson.error;
      }
    } catch (_) {}
    throw new Error(errorMsg);
  }

  let serverMessageId = `msg-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  try {
    const responseData = await response.json();
    if (responseData && responseData.data && responseData.data.id) {
      serverMessageId = responseData.data.id;
    }
  } catch (_) {}

  // 2. Also save directly to Firestore via Client SDK (with user session) in background
  // This is non-blocking so Firestore connectivity or permission issues never freeze the UI
  setDoc(doc(db, "contact_messages", serverMessageId), {
    id: serverMessageId,
    userId: data.userId,
    name: data.name,
    email: data.email,
    subject: data.subject,
    message: data.message,
    status: "New",
    createdAt: serverTimestamp(), // Matches the firestore.rules requirement: createdAt == request.time
  }).then(() => {
    console.log("Successfully saved contact message to Firestore directly from client!");
  }).catch((clientErr) => {
    console.warn("Client-side direct Firestore save failed:", clientErr);
  });
}

