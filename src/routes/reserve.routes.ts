import { Router } from "express";
import { validateBody } from "../middleware/validate.js";
import { reserveSchema } from "../schemas/reserve.schema.js";

export const reserveRouter = Router();

reserveRouter.post("/", validateBody(reserveSchema), (_req, res) => {
  res.sendStatus(200);
});
