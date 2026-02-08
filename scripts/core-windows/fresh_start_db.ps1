Write-Host "Supabase stopping"
supabase stop
Write-Host "Kill possible docker containers residuals"
docker ps -a --filter "name=supabase_.*_CRM_template" -q | ForEach-Object { docker rm -f $_ }
Write-Host "Restarting supabase"
supabase start
pause