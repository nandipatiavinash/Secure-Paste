// storage.ts
import {
  users,
  pastes,
  accessLogs,
  passwordResets,
  userSettings,
  shareableLinks,
  type User,
  type InsertUser,
  type Paste,
  type InsertPaste,
  type AccessLog,
  type InsertAccessLog,
  type PasswordReset,
  type InsertPasswordReset,
  type UserSettings,
  type InsertUserSettings,
  type ShareableLink,
  type InsertShareableLink,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, lt, gt, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

// Session store (connect-pg-simple)
const PostgresSessionStore = connectPg(session);

type ExpiryTime = "1h" | "1d" | "1w" | "1m" | "never";

// Utility to compute a Date from an ExpiryTime string
function computeExpiry(ex: ExpiryTime | undefined): Date | undefined {
  if (!ex || ex === "never") return undefined;
  const now = new Date();
  const msMap: Record<Exclude<ExpiryTime, "never">, number> = {
    "1h": 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
    "1w": 7 * 24 * 60 * 60 * 1000,
    "1m": 30 * 24 * 60 * 60 * 1000,
  };
  return new Date(now.getTime() + msMap[ex as Exclude<ExpiryTime, "never">]);
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  // Pastes
  getPaste(id: string): Promise<Paste | undefined>;
  createPaste(paste: InsertPaste): Promise<Paste>;
  updatePaste(id: string, updates: Partial<Paste>): Promise<Paste | undefined>;
  deletePaste(id: string): Promise<boolean>;
  deletePasteCascade(pasteId: string): Promise<void>;
  getUserPastes(userId: string): Promise<Paste[]>;
  incrementPasteViews(id: string): Promise<void>;

  // Access Logs
  createAccessLog(log: InsertAccessLog): Promise<AccessLog>;
  getPasteAccessLogs(pasteId: string): Promise<AccessLog[]>;

  // Password Resets
  createPasswordReset(reset: InsertPasswordReset): Promise<PasswordReset>;
  getPasswordReset(token: string): Promise<PasswordReset | undefined>;
  markPasswordResetUsed(id: string): Promise<void>;
  cleanupExpiredResets(): Promise<void>;

  // Settings
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  createUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings | undefined>;

  // Shareable Links
  createShareableLink(link: InsertShareableLink): Promise<ShareableLink>;
  getShareableLink(token: string): Promise<ShareableLink | undefined>;
  incrementLinkUsage(token: string): Promise<void>;

  // Session
  sessionStore: InstanceType<typeof PostgresSessionStore>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: InstanceType<typeof PostgresSessionStore>;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  // -------- Users --------
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  // -------- Pastes --------
  async getPaste(id: string): Promise<Paste | undefined> {
    const [paste] = await db.select().from(pastes).where(eq(pastes.id, id));
    return paste || undefined;
  }

  async createPaste(insertPaste: InsertPaste): Promise<Paste> {
    const { expiryTime, ...pasteData } = insertPaste as InsertPaste & { expiryTime?: ExpiryTime };
    const expiresAt = computeExpiry(expiryTime);

    const [paste] = await db
      .insert(pastes)
      .values({
        ...pasteData,
        expiresAt,
        // If selfDestruct, cap to one view if not explicitly provided
        maxViews: pasteData.selfDestruct ? 1 : pasteData.maxViews,
      })
      .returning();

    return paste;
  }

  async updatePaste(id: string, updates: Partial<Paste>): Promise<Paste | undefined> {
    const [paste] = await db.update(pastes).set(updates).where(eq(pastes.id, id)).returning();
    return paste || undefined;
  }

  async deletePaste(id: string): Promise<boolean> {
    const result = await db.delete(pastes).where(eq(pastes.id, id));
    return (result.rowCount || 0) > 0;
  }

  /**
   * Deletes a paste and its related rows in a transaction.
   * Order: accessLogs -> shareableLinks -> pastes (to satisfy FKs)
   */
  async deletePasteCascade(pasteId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(accessLogs).where(eq(accessLogs.pasteId, pasteId));
      await tx.delete(shareableLinks).where(eq(shareableLinks.pasteId, pasteId));
      await tx.delete(pastes).where(eq(pastes.id, pasteId));
    });
  }

  async getUserPastes(userId: string): Promise<Paste[]> {
    return await db
      .select()
      .from(pastes)
      .where(eq(pastes.ownerId, userId))
      .orderBy(desc(pastes.createdAt));
  }

  async incrementPasteViews(id: string): Promise<void> {
    await db
      .update(pastes)
      .set({ viewCount: sql`${pastes.viewCount} + 1` })
      .where(eq(pastes.id, id));
  }

  // -------- Access Logs --------
  async createAccessLog(insertLog: InsertAccessLog): Promise<AccessLog> {
    const [log] = await db.insert(accessLogs).values(insertLog).returning();
    return log;
  }

  async getPasteAccessLogs(pasteId: string): Promise<AccessLog[]> {
    return await db
      .select()
      .from(accessLogs)
      .where(eq(accessLogs.pasteId, pasteId))
      .orderBy(desc(accessLogs.accessedAt));
  }

  // -------- Password Resets --------
  async createPasswordReset(insertReset: InsertPasswordReset): Promise<PasswordReset> {
    const [reset] = await db.insert(passwordResets).values(insertReset).returning();
    return reset;
  }

  /**
   * Fetch a *valid* (not used & not expired) reset by token.
   * Fix: use `gt(expiresAt, now)` instead of `lt` to ensure it's still valid.
   */
  async getPasswordReset(token: string): Promise<PasswordReset | undefined> {
    const [reset] = await db
      .select()
      .from(passwordResets)
      .where(
        and(
          eq(passwordResets.token, token),
          eq(passwordResets.used, false),
          gt(passwordResets.expiresAt, new Date())
        )
      );

    return reset || undefined;
  }

  async markPasswordResetUsed(id: string): Promise<void> {
    await db.update(passwordResets).set({ used: true }).where(eq(passwordResets.id, id));
  }

  /**
   * Remove expired or used resets for hygiene.
   * (If you want to keep used resets for audit, remove the `used` condition.)
   */
  async cleanupExpiredResets(): Promise<void> {
    await db
      .delete(passwordResets)
      .where(or(lt(passwordResets.expiresAt, new Date()), eq(passwordResets.used, true)));
  }

  // -------- Settings --------
  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return settings || undefined;
  }

  async createUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    const [created] = await db.insert(userSettings).values(settings).returning();
    return created;
  }

  async updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings | undefined> {
    const [updated] = await db
      .update(userSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId))
      .returning();
    return updated || undefined;
  }

  // -------- Shareable Links --------
  async createShareableLink(link: InsertShareableLink): Promise<ShareableLink> {
    const [created] = await db.insert(shareableLinks).values(link).returning();
    return created;
  }

  async getShareableLink(token: string): Promise<ShareableLink | undefined> {
    const [link] = await db.select().from(shareableLinks).where(eq(shareableLinks.token, token));
    return link || undefined;
  }

  async incrementLinkUsage(token: string): Promise<void> {
    await db
      .update(shareableLinks)
      .set({ usageCount: sql`${shareableLinks.usageCount} + 1` })
      .where(eq(shareableLinks.token, token));
  }
}

export const storage = new DatabaseStorage();