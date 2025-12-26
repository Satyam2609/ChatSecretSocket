import mongoose from "mongoose";


const recommendSchema = new mongoose.Schema({
    key:{
        type:String,
        required:true,
        unique:true
    },  
    recommendedMessages:[
        {
            type:String
        }
    ],    
},{timestamps:true})

export const Recommend = mongoose.model("Recommend" , recommendSchema)