import mongoose from "mongoose";



  const userSchema = new mongoose.Schema({
    username:{
        type:String,
        required:true,
        unique:true,
        
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true
    },
    name:{
        type:String,
        required:true
    },
    phonenumber:{
        type:Number,
        required:true
    },
    avatar:{
        type:String,
        required:true
    },
    refreshtoken:{
        type:String,
    }
})

export const User = mongoose.model("User" , userSchema)

