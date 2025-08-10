// index.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config(); // Load environment variables

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for testing
  },
  transports: ["websocket"], // Force WebSocket (no polling)
  pingInterval: 25000,       // Keepalive settings
  pingTimeout: 60000,
  maxHttpBufferSize: 1e6,    // 1MB max per message
});

// Handle socket connections
io.on("connection", (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  socket.on("ping", (data) => {
    // Echo back to client
    socket.emit("pong", `Server got: ${data}`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`❌ Client disconnected: ${socket.id} (${reason})`);
  });
});

app.get("/", (req, res) => {
  res.send("Socket.IO load test server is running 🚀");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
