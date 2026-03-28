CREATE TABLE `portfolio_items` (
	`id` text PRIMARY KEY NOT NULL,
	`coin_id` text NOT NULL,
	`symbol` text NOT NULL,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`buy_price` real NOT NULL,
	`added_at` integer NOT NULL
);
