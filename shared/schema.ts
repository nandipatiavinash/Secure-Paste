import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pastes = pgTable("pastes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(),
  title: text("title"),
  language: text("language").default("plaintext"),
  ownerId: varchar("owner_id").references(() => users.id),
  expiresAt: timestamp("expires_at"),
  selfDestruct: boolean("self_destruct").default(false),
  encrypted: boolean("encrypted").default(false),
  password: text("password"), // for encrypted pastes
  viewCount: integer("view_count").default(0),
  maxViews: integer("max_views"), // for self-destruct
  scanStatus: text("scan_status").default("pending"), // pending, clean, flagged
  scanResults: text("scan_results"), // JSON string of scan results
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const accessLogs = pgTable("access_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pasteId: varchar("paste_id").references(() => pastes.id, { onDelete: "cascade" })
  .notNull(),
  viewerIp: text("viewer_ip").notNull(),
  userAgent: text("user_agent"),
  accessedAt: timestamp("accessed_at").defaultNow().notNull(),
});

export const passwordResets = pgTable("password_resets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  virusTotalApiKey: text("virustotal_api_key"), // encrypted
  googleSafeBrowsingApiKey: text("google_safe_browsing_api_key"), // encrypted
  emailNotifications: boolean("email_notifications").default(true),
  defaultExpiry: text("default_expiry").default("1day"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const shareableLinks = pgTable("shareable_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pasteId: varchar("paste_id")
  .references(() => pastes.id, { onDelete: "cascade" })
  .notNull(),
  token: text("token").notNull().unique(),
  createdBy: varchar("created_by").references(() => users.id),
  expiresAt: timestamp("expires_at"),
  usageCount: integer("usage_count").default(0),
  maxUsage: integer("max_usage"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  pastes: many(pastes),
  passwordResets: many(passwordResets),
  settings: one(userSettings, {
    fields: [users.id],
    references: [userSettings.userId],
  }),
  shareableLinks: many(shareableLinks),
}));

export const pastesRelations = relations(pastes, ({ one, many }) => ({
  owner: one(users, {
    fields: [pastes.ownerId],
    references: [users.id],
  }),
  accessLogs: many(accessLogs),
  shareableLinks: many(shareableLinks),
}));

export const accessLogsRelations = relations(accessLogs, ({ one }) => ({
  paste: one(pastes, {
    fields: [accessLogs.pasteId],
    references: [pastes.id],
  }),
}));

export const passwordResetsRelations = relations(passwordResets, ({ one }) => ({
  user: one(users, {
    fields: [passwordResets.userId],
    references: [users.id],
  }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));

export const shareableLinksRelations = relations(shareableLinks, ({ one }) => ({
  paste: one(pastes, {
    fields: [shareableLinks.pasteId],
    references: [pastes.id],
  }),
  creator: one(users, {
    fields: [shareableLinks.createdBy],
    references: [users.id],
  }),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertPasteSchema = createInsertSchema(pastes).omit({
  id: true,
  createdAt: true,
  viewCount: true,
}).extend({
  expiryTime: z.string().optional(), // for frontend convenience
});

export const insertAccessLogSchema = createInsertSchema(accessLogs).omit({
  id: true,
  accessedAt: true,
});

export const insertPasswordResetSchema = createInsertSchema(passwordResets).omit({
  id: true,
  createdAt: true,
  used: true,
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShareableLinkSchema = createInsertSchema(shareableLinks).omit({
  id: true,
  createdAt: true,
  usageCount: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Paste = typeof pastes.$inferSelect;
export type InsertPaste = z.infer<typeof insertPasteSchema>;
export type AccessLog = typeof accessLogs.$inferSelect;
export type InsertAccessLog = z.infer<typeof insertAccessLogSchema>;
export type PasswordReset = typeof passwordResets.$inferSelect;
export type InsertPasswordReset = z.infer<typeof insertPasswordResetSchema>;
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type ShareableLink = typeof shareableLinks.$inferSelect;
export type InsertShareableLink = z.infer<typeof insertShareableLinkSchema>;
