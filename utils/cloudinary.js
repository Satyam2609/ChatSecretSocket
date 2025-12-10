import {v2 as cloudinary} from 'cloudinary'
import fs from 'fs'

cloudinary.config({
    cloud_name:'dvogl4c7a',
    api_key:'248329574647344',
    api_secret:'2iCtnC6yiNpPDIu3QEKEqcHSvw8'
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