import { db, getUser, saveUser } from "./firebaseServer";


/**
 * Reusable backend function to send Telegram notifications.
 * Supports standard Markdown formatting, handles retries, and logs API responses.
 * 
 * @param userId - The Firestore authenticated user ID
 * @param title - The title/subject of the notification (e.g., "📌 Task Reminder")
 * @param message - The body message content
 * @returns Promise<boolean> indicating success or failure
 */
export async function sendTelegramNotification(
  userId: string,
  title: string,
  message: string
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === "") {
    console.warn(`[Telegram Service] Cannot send notification. TELEGRAM_BOT_TOKEN environment variable is not configured.`);
    return false;
  }

  let chatId: string | number | null = null;
  try {
    const userData = await getUser(userId);
    if (!userData) {
      console.warn(`[Telegram Service] User "${userId}" not found. Skipping Telegram notification.`);
      return false;
    }
    // Explicit check: skip if the user has not connected Telegram
    if (userData.telegramConnected === false) {
      console.warn(`[Telegram Service] User "${userId}" has Telegram disconnected. Skipping notification.`);
      return false;
    }
    if (!userData.telegramChatId) {
      console.warn(`[Telegram Service] User "${userId}" has no telegramChatId. Skipping notification.`);
      return false;
    }
    chatId = userData.telegramChatId;
  } catch (err: any) {
    console.error(`[Telegram Service] Error fetching user's telegramChatId:`, err.message || err);
    return false;
  }

  if (!chatId) return false;

  // Format the notification text professionally with markdown
  const formattedText = `🤖 *Samay AI*

━━━━━━━━━━━━━━

${title}

${message}

━━━━━━━━━━━━━━`;

  return sendDirectTelegramMessage(chatId, formattedText);
}

/**
 * Direct message helper with robust retry logic, logging, and error handling.
 */
export async function sendDirectTelegramMessage(
  chatId: string | number,
  text: string,
  parseMode: "Markdown" | "HTML" = "Markdown"
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === "") {
    return false;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const bodyPayload = {
    chat_id: chatId,
    text: text,
    parse_mode: parseMode
  };

  const maxAttempts = 3;
  let attempt = 0;
  let delayMs = 1000;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      console.log(`[Telegram Service] Attempting to send message to Chat ID ${chatId} (Attempt ${attempt}/${maxAttempts})...`);
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload)
      });

      const responseData = await response.json();

      if (response.ok && responseData.ok) {
        return true;
      }

      // 403 = bot was blocked by the user — auto-disconnect to avoid future noise
      if (response.status === 403 || responseData.error_code === 403) {
        console.error(
          `[Telegram Service] Bot blocked by chat_id ${chatId} (403 Forbidden). Auto-disconnecting user if possible.`
        );
        // Best-effort: find the user with this chatId and mark as disconnected
        try {
          const { getAllUsers } = await import("./firebaseServer");
          const allUsers = await getAllUsers();
          for (const u of allUsers) {
            if (String(u.telegramChatId) === String(chatId)) {
              await saveUser(u.id, {
                telegramConnected: false,
                telegramChatId: null,
                telegramUsername: null,
                telegramFirstName: null,
                telegramConnectedAt: null,
              });
              console.warn(`[Telegram Service] Auto-disconnected user ${u.id} due to bot-blocked error.`);
            }
          }
        } catch (autoErr: any) {
          console.warn(`[Telegram Service] Auto-disconnect failed:`, autoErr.message || autoErr);
        }
        return false;
      }

      // If rate limited (429) or server error (5xx), we should retry
      if (response.status === 429 || response.status >= 500) {
        console.warn(`[Telegram Service] Temporary API issue (HTTP ${response.status}). Retrying...`);
      } else {
        // Direct API failure (e.g., chat not found, invalid token)
        console.error(`[Telegram Service] Permanent Telegram API error:`, responseData.description || "Unknown failure");
        return false;
      }
    } catch (err: any) {
      console.error(`[Telegram Service] Fetch error on attempt ${attempt}:`, err.message || err);
      if (attempt === maxAttempts) {
        return false;
      }
    }

    if (attempt < maxAttempts) {
      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, attempt - 1)));
    }
  }

  return false;
}
