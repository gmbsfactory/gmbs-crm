@echo off
REM Batch file to launch a console command with predefined environment variables

REM Set your environment variables here
set SUPABASE_ACCESS_TOKEN=sbp_da34ec2f82673f9b903ea9a72e18855305271a16

REM Add more environment variables as needed
REM set MY_VAR=my_value

REM Launch your console command here
REM Replace the command below with your actual command
echo SUPABASE_ACCESS_TOKEN=%SUPABASE_ACCESS_TOKEN%

REM Example: Run a Node.js command
REM node your-script.js

REM Example: Run a Python command
REM python your-script.py

REM Example: Run any other command
REM your-command-here

REM If you want to keep the window open after the command completes, uncomment the next line
REM pause

cd ../..
supabase db reset && npm run import:artisans && npm run import:interventions -- --date-start=01/08/2025 --date-end=27/02/2026
pause