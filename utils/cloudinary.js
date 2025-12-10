import {v2 as cloudinary} from 'cloudinary'
import fs from 'fs'

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

const uploadCloudinary = async(filePath) => {
    try{
        const res = await cloudinary.uploader.upload(filePath,{
            resource_type:"auto",
        })
        console.log("Cloudinary upload result:", res);
        return res.secure_url
    }
    catch(err){
        console.log("Cloudinary upload error:", err);
        fs.unlinkSync(filePath);
    }
}
export default uploadCloudinary