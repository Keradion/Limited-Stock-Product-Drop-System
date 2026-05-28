import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { signToken } from "../lib/jwt.js";
import { validateBody } from "../middleware/validate.js";
import { loginLimiter, registerLimiter } from "../middleware/rateLimit.js";
import { loginSchema, registerSchema } from "../schemas/auth.schema.js";

export const authRouter = Router();

authRouter.post("/register", registerLimiter, validateBody(registerSchema), async (req, res) => {
  const { email, password } = req.body;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, password: hashedPassword },
  });

  const token = signToken({ userId: user.userId });
  res.status(201).json({ token });
});

authRouter.post("/login", loginLimiter, validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken({ userId: user.userId });
  res.status(200).json({ token });
});
