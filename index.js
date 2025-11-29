import express from "express"
import http from 'http'
import cors from "cors"
import {Server} from "socket.io"
import mongoose from "mongoose"
import connectDB from "../backend/DB/index.js"
import UserGroup from "../backend/models/user.group.js"
import dotenv from "dotenv"
import { User } from "../backend/models/user.model.js"


dotenv.config({
    path:"../backend/.env"
})

const app = express()
connectDB()


app.use(express.json())
app.use(cors())

const server = http.createServer(app)
const io = new Server(server , {
    cors:{
    origin:"*",
    }
})


const onlineUser = {}


io.on("connection" , async(socket) => {
    console.log(`user connected:${socket.id}`)


    
    
    const roomName = await UserGroup.find().distinct("groupName")
    console.log(roomName)
    socket.emit("roomlist" , roomName)


    

    

    socket.on("createRoom" , async ({roomId , username}) => {
        let group = await UserGroup.findOne({groupName:roomId})

        if(!group){
            await UserGroup.create({
                groupName:roomId,
                members:[username],
                creator:username,
            })
        }
        else{
            if(!group.members.includes(username)){
                group.members.push(username)
                await group.save()
            }
        }
        

        socket.join(roomId)
        console.log(`user with id:${socket.id} joined room:${roomId} , username: ${username}`)
        io.emit("roomlist", await UserGroup.find().distinct("groupName")) 
    })
    

    socket.on("typing", ({ roomId, username }) => {
        console.log("typing" , roomId , username)
  socket.to(roomId).emit("typing", { username });
});
    socket.on("stopTyping", ({ roomId, username }) => {
  socket.to(roomId).emit("hidetyping", { username });
});

socket.on("delete" , async(roomId) => {
    const group = await UserGroup.findOneAndDelete({groupName:roomId})
    if(!group){
        socket.emit("error" , `room with id:${roomId} does not exist`)
        return
    }
})

socket.on("deletemember" , async({roomId,username}) => {
    const group = await UserGroup.findOne({groupName:roomId})
    const members = group.members.filter(member => member === username)
    group.members.pop[members]
    await group.save()

    
})


  socket.on("joinRoom", async ({ roomId, username }) => {
    const group = await UserGroup.findOne({ groupName: roomId });


    if (!group) {
      socket.emit("error", "Room does not exist");
      return;
    }

    if (!group.members.includes(username)) {
      group.members.push(username);
      await group.save();
    }

   const groupmessage = await UserGroup.findOne({groupName:roomId});
const messagesWithRoom = groupmessage.messages.map(msg => ({
  username: msg.sender,
  message: msg.message,
  timestamp: msg.timestamp,
  roomId
}));
io.to(socket.id).emit("previousMessages", messagesWithRoom); // sirf join karne wale ko


    const members = await UserGroup.findOne({ groupName: roomId }).select("members");
    const admin = members.members
    const adminUser = await admin.filter(creator => creator === group.creator)
    console.log("Admin of the room", adminUser);
    console.log("Members in room", members);
    const adminUserName = adminUser[0];
    io.emit("members", {members: members.members, adminUserName});
    console.log(adminUserName)
   

    socket.join(roomId);

  });

    

   

    socket.on("roomMessage" , async({roomId ,username, message}) => {
        const group = await UserGroup.findOne({groupName:roomId})
        if(!group){             
            socket.emit("error" , `room with id:${roomId} does not exist`)
            return
        }
        group.messages.push({sender:username , message})
        await group.save()
        io.to(roomId).emit("getRoomMessage" , {roomId ,username, message})
        console.log(`message to room ${roomId}: ${message} , username: ${username}`)
    })

    socket.on("disconnect" , () => {
        
        console.log(`user disconnected: ${socket.id}`);
    })
})
server.listen(5000 ,() => {
    console.log("server is running on port 5000");
})