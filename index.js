const { Server } = require("socket.io");
const http = require("http");

const server = http.createServer();
const io = new Server(server, {
  cors: { origin: "*" }
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Listen for "ping" and reply with "broadcast"
  socket.on("ping", (msg) => {
    io.emit("broadcast", `Server says: ${msg}`);
  });
});

server.listen(3000, () => {
  console.log("Socket.IO server running on port 3000");
});
