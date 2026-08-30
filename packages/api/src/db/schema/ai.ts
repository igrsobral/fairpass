import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth.js";

export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title"),
  state: jsonb("state"), // LangGraph thread checkpoint snapshot
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // user | assistant | tool
  content: text("content").notNull(),
  toolName: text("tool_name"),
  toolInput: jsonb("tool_input"),
  toolOutput: jsonb("tool_output"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const smartAlerts = pgTable("smart_alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  query: text("query").notNull(), // original natural language query
  filters: jsonb("filters"), // extracted structured query (SearchQuery)
  thresholdCents: integer("threshold_cents"),
  active: boolean("active").notNull().default(true),
  lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verificationResults = pgTable("verification_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  barcodeSha256: text("barcode_sha256").notNull(),
  barcodeType: text("barcode_type").notNull(),
  isValid: boolean("is_valid").notNull(),
  metadata: jsonb("metadata"), // normalized, PII-free
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sellerTrustScores = pgTable("seller_trust_scores", {
  id: uuid("id").defaultRandom().primaryKey(),
  sellerId: uuid("seller_id")
    .notNull()
    .unique()
    .references(() => users.id),
  score: real("score").notNull().default(0),
  numberOfSales: integer("number_of_sales").notNull().default(0),
  verificationRate: real("verification_rate").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type SmartAlert = typeof smartAlerts.$inferSelect;
export type VerificationResult = typeof verificationResults.$inferSelect;
export type SellerTrustScore = typeof sellerTrustScores.$inferSelect;