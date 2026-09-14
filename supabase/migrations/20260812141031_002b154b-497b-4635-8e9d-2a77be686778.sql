DELETE FROM public.quotas WHERE rep_id <> 'f5fcd258-f916-4799-b1fa-1cf764730a41';
DELETE FROM public.team_members WHERE user_id <> 'f5fcd258-f916-4799-b1fa-1cf764730a41';
UPDATE public.teams SET manager_id = NULL WHERE manager_id <> 'f5fcd258-f916-4799-b1fa-1cf764730a41';
DELETE FROM public.user_roles WHERE user_id <> 'f5fcd258-f916-4799-b1fa-1cf764730a41';
DELETE FROM public.profiles WHERE user_id <> 'f5fcd258-f916-4799-b1fa-1cf764730a41';
DELETE FROM auth.users WHERE id <> 'f5fcd258-f916-4799-b1fa-1cf764730a41';