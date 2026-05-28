import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { AppError } from "../lib/errors.js";
import { signToken } from "../lib/jwt.js";
import { config } from "../config/env.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validateBody } from "../middleware/validate.js";
import { loginLimiter, registerLimiter } from "../middleware/rateLimit.js";
import { loginSchema, registerSchema } from "../schemas/auth.schema.js";
export const authRouter = Router();
authRouter.post("/register", registerLimiter, validateBody(registerSchema), asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new AppError("Email already registered", 409);
    }
    const hashedPassword = await bcrypt.hash(password, config.bcryptSaltRounds);
    const user = await prisma.user.create({
        data: { email, password: hashedPassword },
    });
    const token = signToken({ userId: user.userId });
    res.status(201).json({ token });
}));
authRouter.post("/login", loginLimiter, validateBody(loginSchema), asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        throw new AppError("Invalid email or password", 401);
    }
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        throw new AppError("Invalid email or password", 401);
    }
    const token = signToken({ userId: user.userId });
    res.status(200).json({ token });
}));
