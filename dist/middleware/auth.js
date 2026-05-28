import { AppError } from "../lib/errors.js";
import { verifyToken } from "../lib/jwt.js";
export function authenticate(req, _res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        next(new AppError("Unauthorized", 401));
        return;
    }
    const token = header.slice("Bearer ".length);
    try {
        const payload = verifyToken(token);
        req.userId = payload.userId;
        next();
    }
    catch {
        next(new AppError("Invalid or expired token", 401));
    }
}
