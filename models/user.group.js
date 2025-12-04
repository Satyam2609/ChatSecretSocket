import mongoose from "mongoose";


const userGroupSchema = new mongoose.Schema({
  groupName:{
    type:String,
    required:true
  },
  members:{
    type:[String],
    required:true
  },
  creator:{
    type:String,
    required:true
  },
  messages:{
    type:[{
        sender:String,
        message:String,
        timestamp:{type:Date, default:Date.now}
    }],
    required:true,
    default:[]
  },
  userRequest:{
    type:[{
      roomId:String,
      username:String
    }]
  }
  
  

});

const UserGroup = mongoose.model("UserGroup", userGroupSchema);
export default UserGroup;