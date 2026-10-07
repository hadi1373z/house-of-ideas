import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const houses = sqliteTable('houses', {
 userId: text('user_id').primaryKey(),
 document: text('document').notNull(),
 revision: integer('revision').notNull().default(1),
 updatedAt: text('updated_at').notNull(),
});
