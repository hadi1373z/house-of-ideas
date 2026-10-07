import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
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
