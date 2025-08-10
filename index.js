const { Server } = require("socket.io");
const http = require("http");
require("dotenv").config();

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: "*",
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket'],
  allowEIO3: true,
});



io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Listen for "ping" and reply with "broadcast"
  socket.on("ping", (msg) => {
    io.emit("broadcast", `Server says: ${msg}`);
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log("Socket.IO server running on port " + (process.env.PORT || 3000));
});
