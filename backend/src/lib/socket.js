import express from "express";
import http from "http";
import { Server } from "socket.io";

export const app = express();
export const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});

const onlineUsers = new Map();

io.on("connection", (socket) => {
  const userId = socket.handshake.query?.userId;

  if (userId) {
    const stringUserId = String(userId);
    onlineUsers.set(stringUserId, socket.id);
    socket.join(stringUserId);

    io.emit("users:online", Array.from(onlineUsers.keys()));
  }

  socket.on("disconnect", () => {
    for (const [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(uid);
        break;
      }
    }

    io.emit("users:online", Array.from(onlineUsers.keys()));
  });
});

// ✅ Export this helper so message.controller.js can use it
export const getReceiverSocketId = (receiverId) => {
  return onlineUsers.get(String(receiverId));
};
