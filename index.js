import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import mongoose from "mongoose";
import dotenv from "dotenv";
import UserGroup from "./models/user.group.js"; // backend folder structure ke hisab se
import { timeStamp } from "console";
import uploadCloudinary from "./utils/cloudinary.js";

dotenv.config(); // Render me relative path ka tension nahi

// Connect MongoDB
mongoose.connect(process.env.MONGODB_URL, {
})
.then(() => console.log("MongoDB connected"))
.catch(err => console.log("MongoDB connection error:", err));

const app = express();
app.use(express.json());

// CORS setup
app.use(cors({
    origin: process.env.FRONTEND_URL || "*",
     credentials: true,
}));

// HTTP + Socket.io setup
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "*",
        methods: ["GET", "POST"],
    }
});

const userSocket = new Map()

io.on("connection", async (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on("userna" , async(userna) => {
        socket.username = userna
        userSocket.set(userna, socket.id);
        const group = await UserGroup.find({members:userna} , {groupName:1,_id:0})
        console.log(group)
        if(!group){
            socket.emit("group not found")
        }
        socket.emit("roomlist" , group.map(g => g.groupName))
    })



    // Create Room
    socket.on("createRoom", async ({ roomId, username }) => {
        let group = await UserGroup.findOne({ groupName: roomId });
        if (!group) {
            await UserGroup.create({
                groupName: roomId,
                members: [username],
                creator: username,
            });
        } 
        socket.join(roomId);
       const userGroups = await UserGroup.find({ members: username }, { groupName: 1, _id: 0 }).lean();
    io.to(socket.id).emit("roomlist", (userGroups || []).map(g => g.groupName));
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
    socket.on("joinRoom", async ({ roomId, username}) => {
        const group = await UserGroup.findOne({ groupName: roomId });
        if (!group) return socket.emit("error", "Room does not exist");
        
        const creatorSocketId = userSocket.get(group.creator);
if (creatorSocketId && group.creator !== username) {
    const alreadyExsist = group.userRequest.some(req => req.roomId === roomId && req.username === username)
    if(!alreadyExsist && !group.members.includes(username)){
   group.userRequest.push({roomId, username})
   await group.save()
   const userRequest = group.userRequest
    io.to(creatorSocketId).emit("RequerstjoinRoom", { request:userRequest });
    }
}
else{
    socket.emit("you are a creator & Have a problem")
}
    });
    socket.on("selectRoom" , async({roomId}) => {
        const group = await UserGroup.findOne({groupName:roomId})
        if(!group){
            socket.emit("group does not found")
        }
    
         const messagesWithRoom = group.messages.map(msg => {
            const timesender = new Date(msg.timestamp)
            const time = timesender.toLocaleTimeString("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
})
           return{
             username: msg.sender,
            message: msg.message,
            replyto:msg.replyMsg ,
            timestamp: time,
            imageto: msg.ImageSend || null,
            roomId
           }
        });
        console.log(messagesWithRoom)
        io.to(socket.id).emit("previousMessages", messagesWithRoom);
        const adminUser = group.creator;
        io.emit("members", { members: group.members, adminUserName: adminUser });

        socket.join(roomId);

    })

    socket.on("acceptResponse" , async({access , roomId , username}) => {
        const group = await UserGroup.findOne({ groupName: roomId });
        if(access == "yes" && !group.members.includes(username)){
            group.members.push(username)
            await group.save()
            await UserGroup.updateOne(
                {groupName:roomId},
                {$pull:{userRequest:{username:username}}}
            )
            await group.save()
            
        }
    })


    // Room messages
    socket.on("roomMessage", async ({ roomId, username, message , replyto , image }) => {
        const group = await UserGroup.findOne({ groupName: roomId });
        if (!group) return socket.emit("error", `Room ${roomId} does not exist`);
        console.log(group.messages)
        
    const now = new Date();
    const timeset = now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit"
    });

            group.messages.push({ sender: username, message , replyMsg:replyto ? {username:replyto.username , message:replyto.message} : null , ImageSend:image});
            await group.save();
            console.log(group.messages)
        
        io.to(roomId).emit("getRoomMessage", { roomId, username, message  , timestamp:timeset , replyto , imageto:image });
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
