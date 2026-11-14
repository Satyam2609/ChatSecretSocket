import cookie from "cookie";
import jwt from "jsonwebtoken";
import {User} from "../../socket/models/user.model.js"

io.use(async (socket, next) => {
    try {
        const cookies = cookie.parse(socket.handshake.headers.cookie || "");
        console.log("COOKIE =>", socket.handshake.headers.cookie);

        const token = cookies.accesstoken; // cookie ka naam

        if (!token) return next(new Error("Unauthorized"));

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id);

        if (!user) return next(new Error("User not found"));

        socket.user = user;

        next();
    } catch (err) {
        next(new Error("Unauthorized"));
    }
});