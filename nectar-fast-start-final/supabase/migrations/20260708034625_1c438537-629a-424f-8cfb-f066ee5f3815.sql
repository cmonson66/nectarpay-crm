BEGIN;
DELETE FROM public.terminals WHERE store_id = '43e7ea21-c415-4d40-afa4-641d69e38780';
DELETE FROM public.stores WHERE id = '43e7ea21-c415-4d40-afa4-641d69e38780';
DELETE FROM public.subscriptions WHERE user_id = 'a473c90c-73a3-41db-9cb1-9c55ecfe6ef6';
DELETE FROM public.user_roles WHERE user_id = 'a473c90c-73a3-41db-9cb1-9c55ecfe6ef6';
DELETE FROM public.profiles WHERE user_id = 'a473c90c-73a3-41db-9cb1-9c55ecfe6ef6';
DELETE FROM auth.users WHERE id = 'a473c90c-73a3-41db-9cb1-9c55ecfe6ef6';
COMMIT;