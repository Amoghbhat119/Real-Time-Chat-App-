import express from "express";
import http from "http";
import { Server } from "socket.io";
import user from "../models/user.model.js";
export const app = express();
export const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});

const onlineUsers = new Map();

io.on("connection", async(socket) => {
  const userId = socket.handshake.query?.userId;

  if (userId) {
    const stringUserId = String(userId);
    onlineUsers.set(stringUserId, socket.id);
    socket.join(stringUserId);
      await user.findByIdAndUpdate(stringUserId, { lastSeen: new Date() });
    io.emit("users:online", Array.from(onlineUsers.keys()));
  }

  socket.on("disconnect",  async() => {
    for (const [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(uid);
        await user.findByIdAndUpdate(uid, { lastSeen: new Date() });
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