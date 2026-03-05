-- Reload PostgREST schema cache after email_logs changes
NOTIFY pgrst, 'reload schema';
