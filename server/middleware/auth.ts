// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthPayload { sub: string; email?: string; iat?: number; exp?: number; }

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
if (!JWT_SECRET) console.warn("SUPABASE_JWT_SECRET not set; tokens won't be verified");

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return next();
  const token = auth.split(" ")[1];
  if (!JWT_SECRET) return next();

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    // attach minimal user info
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch (err) {
    // Treat invalid/expired tokens as unauthorized instead of silently anonymous.
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
