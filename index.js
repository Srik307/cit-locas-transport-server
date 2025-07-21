// server.js
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const webPush = require("web-push");
const WebSocket = require("ws");
const http = require("http");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// --- DEV-ONLY in-memory subscription store ---
// In prod: persist to DB keyed by userId, deviceId, or endpoint.
let subscriptions = [];

/* -------------------- Web Push Setup -------------------- */
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.error("❌ Missing VAPID keys in env. Push will fail.");
}
webPush.setVapidDetails(
  `mailto:${process.env.EMAIL || "example@example.com"}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/* -------------------- Routes -------------------- */

// Health check (Render uses this sometimes)
app.get("/", (_req, res) => {
  res.send("OK");
});

// Save push subscription from client
app.post("/subscribe", (req, res) => {
  const newSub = req.body;
  if (!newSub || !newSub.endpoint) {
    return res.status(400).json({ error: "Invalid subscription" });
  }

  const exists = subscriptions.find((s) => s.endpoint === newSub.endpoint);
  if (!exists) {
    subscriptions.push(newSub);
    console.log("✅ Subscription added:", newSub.endpoint, "Total:", subscriptions.length);
  } else {
    console.log("ℹ️ Subscription already exists:", newSub.endpoint);
  }
  res.status(201).json({});
});

// Manual test endpoint: send a push to all current subs
app.get("/send", (_req, res) => {
  sendPushNotification("Hello!", "This should show even when the app is closed.")
    .then((stats) => res.status(200).json(stats))
    .catch((err) => {
      console.error("Failed to send push:", err);
      res.status(500).json({ error: "Push failed" });
    });
});

/* -------------------- Push Fan-out -------------------- */
/**
 * Send a Web Push Notification to all current subscriptions.
 * Automatically prunes expired (410 Gone) subscriptions.
 * Returns summary stats.
 */
async function sendPushNotification(title, body) {
  const payload = JSON.stringify({ title, body });

  const results = await Promise.allSettled(
    subscriptions.map((sub) => webPush.sendNotification(sub, payload))
  );

  const stillValid = [];
  let success = 0;
  let removed = 0;

  results.forEach((result, i) => {
    const sub = subscriptions[i];

    if (result.status === "fulfilled") {
      success++;
      stillValid.push(sub);
      return;
    }

    // rejected
    const err = result.reason;
    const statusCode = err?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      // subscription expired or no longer valid
      removed++;
      console.log("🗑 Removing expired subscription:", sub.endpoint, "(status", statusCode, ")");
    } else {
      // transient error — keep subscription
      stillValid.push(sub);
      console.warn("⚠️ Push error (kept sub):", statusCode, sub.endpoint, err.body || err);
    }
  });

  subscriptions = stillValid;
  console.log(`🔔 Push done. Sent: ${success}, Removed: ${removed}, Remaining subs: ${subscriptions.length}`);

  return { sent: success, removed, remaining: subscriptions.length };
}

/* -------------------- HTTP + WebSocket on Same Port -------------------- */
const server = http.createServer(app);

// Attach WebSocket to the same server (required on Render)
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws, req) => {
  console.log("🔌 WebSocket connected from", req.socket.remoteAddress);

  ws.on("message", (raw) => {
    let title = "Socket Event";
    let body = "";

    // Try parse JSON, else treat raw text as body
    try {
      const data = JSON.parse(raw.toString());
      title = data.title || title;
      body = data.body || JSON.stringify(data);
    } catch {
      body = raw.toString();
    }

    // Broadcast to all connected WS clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(body);
    });

    // Fire push notification to all subs
    sendPushNotification(title, body).catch((e) => console.error("Push from WS failed:", e));
  });

  ws.on("close", () => console.log("❎ WebSocket closed"));
});

// Optional: keep connections alive (helps behind proxies)
function heartbeat() {
  this.isAlive = true;
}
wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", heartbeat);
});
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

/* -------------------- Start -------------------- */
server.listen(PORT, () => {
  console.log(`🚀 HTTP + WS server running on http://localhost:${PORT}`);
});
