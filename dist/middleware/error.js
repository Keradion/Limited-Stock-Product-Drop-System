import { logger } from "../lib/logger.js";
export function handleInvalidJson(err, req, res, next) {
    if (err instanceof SyntaxError && "body" in err) {
        logger.warn("Invalid JSON body", {
            method: req.method,
            path: req.originalUrl,
        });
        res.status(400).json({ error: "Invalid JSON body" });
        return;
    }
    next(err);
}
