// src/types/express.d.ts
import { AppUser } from "../shared/types"; // optional: point to a user type you define

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        // add other fields if you set them
      } & Partial<AppUser>;
    }
  }
}
