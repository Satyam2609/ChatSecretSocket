import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import mongoose from "mongoose";
import dotenv from "dotenv";
import UserGroup from "./models/user.group.js"; // backend folder structure ke hisab se

dotenv.config(); // Render me relative path ka tension nahi

// Connect MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected"))
.catch(err => console.log("MongoDB connection error:", err));

const app = express();
app.use(express.json());

// CORS setup
app.use(cors({
    origin: process.env.FRONTEND_URL || "*",
}));

// HTTP + Socket.io setup
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "*",
        methods: ["GET", "POST"],
    }
});

io.on("connection", async (socket) => {
    console.log(`User connected: ${socket.id}`);

    const roomName = await UserGroup.find().distinct("groupName");
    socket.emit("roomlist", roomName);

    // Create Room
    socket.on("createRoom", async ({ roomId, username }) => {
        let group = await UserGroup.findOne({ groupName: roomId });
        if (!group) {
            await UserGroup.create({
                groupName: roomId,
                members: [username],
                creator: username,
            });
        } else if (!group.members.includes(username)) {
            group.members.push(username);
            await group.save();
        }
        socket.join(roomId);
        io.emit("roomlist", await UserGroup.find().distinct("groupName"));
        console.log(`User ${username} joined room ${roomId}`);
    });

    // Typing events
    socket.on("typing", ({ roomId, username }) => {
        socket.to(roomId).emit("typing", { username });
    });
    socket.on("stopTyping", ({ roomId, username }) => {
        socket.to(roomId).emit("hidetyping", { username });
    });

    // Delete room
    socket.on("delete", async (roomId) => {
        const group = await UserGroup.findOneAndDelete({ groupName: roomId });
        if (!group) socket.emit("error", `Room ${roomId} does not exist`);
    });

    // Delete member
    socket.on("deletemember", async ({ roomId, username }) => {
        const group = await UserGroup.findOne({ groupName: roomId });
        if (!group) return;
        group.members = group.members.filter(member => member !== username);
        await group.save();
    });

    // Join room
    socket.on("joinRoom", async ({ roomId, username }) => {
        const group = await UserGroup.findOne({ groupName: roomId });
        if (!group) return socket.emit("error", "Room does not exist");

        if (!group.members.includes(username)) {
            group.members.push(username);
            await group.save();
        }

        // Send previous messages only to this user
        const messagesWithRoom = group.messages.map(msg => ({
            username: msg.sender,
            message: msg.message,
            timestamp: msg.timestamp,
            roomId
        }));
        io.to(socket.id).emit("previousMessages", messagesWithRoom);

        // Send members & admin info to everyone
        const adminUser = group.creator;
        io.emit("members", { members: group.members, adminUserName: adminUser });

        socket.join(roomId);
    });

    // Room messages
    socket.on("roomMessage", async ({ roomId, username, message }) => {
        const group = await UserGroup.findOne({ groupName: roomId });
        if (!group) return socket.emit("error", `Room ${roomId} does not exist`);
        group.messages.push({ sender: username, message });
        await group.save();
        io.to(roomId).emit("getRoomMessage", { roomId, username, message });
    });

    // Disconnect
    socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

// Use Render assigned PORT
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
