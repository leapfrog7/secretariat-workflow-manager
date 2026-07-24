SELECT pg_notify('pgrst', 'reload schema');
--> statement-breakpoint

SELECT pg_notify('pgrst', 'reload config');
