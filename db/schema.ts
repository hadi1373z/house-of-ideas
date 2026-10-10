import { sqliteTable, text, integer, primaryKey, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
export const houses = sqliteTable('houses', {
 userId: text('user_id').primaryKey(),
 document: text('document').notNull(),
 revision: integer('revision').notNull().default(1),
 updatedAt: text('updated_at').notNull(),
});

// Pending snapshots are independent of editable house revisions. User decisions
// are stored in the authenticated house document and take precedence on reads.
export const reviewProposals = sqliteTable('review_proposals', {
 userId: text('user_id').notNull(),
 reviewDate: text('review_date').notNull(),
 proposal: text('proposal').notNull(),
 createdAt: text('created_at').notNull(),
}, table => [primaryKey({columns: [table.userId, table.reviewDate]})]);

// Operational receipts contain only the last successful aggregate result for
// a review date, never user IDs, room names, notes, proposals or house content.
export const reviewRuns = sqliteTable('review_runs', {
 reviewDate: text('review_date').primaryKey(),
 summary: text('summary').notNull(),
 completedAt: text('completed_at').notNull(),
});

// The private online edition is separate from the retained legacy Site. Every
// API lookup is scoped to the authenticated Sites visitor, never an input ID.
export const onlineNeighborhoods = sqliteTable('online_neighborhoods', {
 userId: text('user_id').primaryKey(),
 document: text('document').notNull(),
 revision: integer('revision').notNull(),
 revisionToken: text('revision_token').notNull(),
 updatedAt: text('updated_at').notNull(),
});
export const onlineConversationMessages = sqliteTable('online_conversation_messages', {
 sequence: integer('sequence').primaryKey({autoIncrement: true}),
 userId: text('user_id').notNull(),
 id: text('id').notNull(),
 homeId: text('home_id'),
 actor: text('actor').notNull(),
 document: text('document').notNull(),
 createdAt: text('created_at').notNull(),
}, table => [uniqueIndex('online_message_identity').on(table.userId, table.id), index('online_message_page').on(table.userId, table.sequence)]);
export const onlineImprovementBriefs = sqliteTable('online_improvement_briefs', {
 userId: text('user_id').notNull(),
 id: text('id').notNull(),
 document: text('document').notNull(),
 status: text('status').notNull(),
 createdAt: text('created_at').notNull(),
 approvedAt: text('approved_at'),
}, table => [primaryKey({columns: [table.userId, table.id]})]);
