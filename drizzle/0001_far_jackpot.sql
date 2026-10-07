CREATE TABLE `review_proposals` (
	`user_id` text NOT NULL,
	`review_date` text NOT NULL,
	`proposal` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `review_date`)
);
