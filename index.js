import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import mongoose from "mongoose";
import dotenv from "dotenv";
import UserGroup from "./models/user.group.js";

dotenv.config();

mongoose.connect(process.env.MONGODB_URL, {})
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("MongoDB connection error:", err));

const app = express();
app.use(express.json());

app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST"],
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
  }
});

const userSockets = new Map();

io.on("connection", (socket) => {
  socket.on("userna", async (userna) => {
    if (!userna) return;
    socket.username = userna;
    userSockets.set(userna, socket.id);
    const groups = await UserGroup.find({ members: userna }, { groupName: 1, _id: 0 }).lean();
    const roomNames = (groups || []).map(g => g.groupName);
    io.to(socket.id).emit("roomlist", roomNames);
  });

  socket.on("createRoom", async ({ roomId, username }) => {
    if (!roomId || !username) return socket.emit("error", "Missing roomId or username");
    let group = await UserGroup.findOne({ groupName: roomId });
    if (!group) {
      group = await UserGroup.create({ groupName: roomId, members: [username], creator: username, messages: [] });
    } else if (!group.members.includes(username)) {
      group.members.push(username);
      await group.save();
    }
    socket.join(roomId);
    const userGroups = await UserGroup.find({ members: username }, { groupName: 1, _id: 0 }).lean();
    io.to(socket.id).emit("roomlist", (userGroups || []).map(g => g.groupName));
  });

  socket.on("typing", ({ roomId, username }) => {
    if (!roomId || !username) return;
    socket.to(roomId).emit("typing", { username });
  });
  socket.on("stopTyping", ({ roomId, username }) => {
    if (!roomId || !username) return;
    socket.to(roomId).emit("hidetyping", { username });
  });

  socket.on("delete", async (roomId) => {
    if (!roomId) return;
    const group = await UserGroup.findOneAndDelete({ groupName: roomId });
    if (!group) return socket.emit("error", `Room ${roomId} does not exist`);
    io.to(roomId).emit("roomDeleted", { roomId });
  });

  socket.on("deletemember", async ({ roomId, username }) => {
    if (!roomId || !username) return;
    const group = await UserGroup.findOne({ groupName: roomId });
    if (!group) return;
    group.members = group.members.filter(member => member !== username);
    await group.save();
    io.to(roomId).emit("members", { members: group.members, adminUserName: group.creator });
  });

  socket.on("joinRoom", async ({ roomId, username }) => {
    if (!roomId || !username) return;
    const group = await UserGroup.findOne({ groupName: roomId }).lean();
    if (!group) return socket.emit("error", "Room does not exist");
    const creatorSocketId = userSockets.get(group.creator);
    if (creatorSocketId) io.to(creatorSocketId).emit("RequerstjoinRoom", { roomId, request: username });
    const msgs = group.messages || [];
    const messagesWithRoom = msgs.map(msg => ({ username: msg.sender, message: msg.message, timestamp: msg.timestamp, roomId }));
    io.to(socket.id).emit("previousMessages", messagesWithRoom);
    io.to(socket.id).emit("members", { members: group.members || [], adminUserName: group.creator });
  });

  socket.on("acceptResponse", async ({ access, roomId, username }) => {
    if (!roomId || !username || !access) return;
    const group = await UserGroup.findOne({ groupName: roomId });
    if (!group) return socket.emit("error", "Room not found");
    if (access === "yes") {
      if (!group.members.includes(username)) {
        group.members.push(username);
        await group.save();
      }
      const acceptedSocketId = userSockets.get(username);
      if (acceptedSocketId) {
        const msgs = group.messages || [];
        const messagesWithRoom = msgs.map(msg => ({ username: msg.sender, message: msg.message, timestamp: msg.timestamp, roomId }));
        io.to(acceptedSocketId).emit("joinAccepted", { roomId, username });
        io.to(acceptedSocketId).emit("previousMessages", messagesWithRoom);
        io.to(acceptedSocketId).emit("members", { members: group.members, adminUserName: group.creator });
      }
      io.to(roomId).emit("members", { members: group.members, adminUserName: group.creator });
      const creatorSocketId = userSockets.get(group.creator);
      if (creatorSocketId) {
        const creatorGroups = await UserGroup.find({ members: group.creator }, { groupName: 1, _id: 0 }).lean();
        io.to(creatorSocketId).emit("roomlist", (creatorGroups || []).map(g => g.groupName));
      }
    } else {
      const creatorSocketId = userSockets.get(group.creator);
      if (creatorSocketId) io.to(creatorSocketId).emit("requestHandled", { roomId, username, access });
    }
  });

  socket.on("roomMessage", async ({ roomId, username, message }) => {
    if (!roomId || !username || !message) return;
    const group = await UserGroup.findOne({ groupName: roomId });
    if (!group) return socket.emit("error", `Room ${roomId} does not exist`);
    group.messages = group.messages || [];
    group.messages.push({ sender: username, message, timestamp: new Date() });
    await group.save();
    io.to(roomId).emit("getRoomMessage", { roomId, username, message });
  });

  socket.on("disconnect", () => {
    if (socket.username) userSockets.delete(socket.username);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
