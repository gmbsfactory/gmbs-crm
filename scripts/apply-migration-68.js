// Script to apply migration 00068 to remote Supabase
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://wneiuatqjfhvczvycuqw.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduZWl1YXRxamZodmN6dnljdXF3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjMwNDAwMSwiZXhwIjoyMDcxODgwMDAxfQ.O_Jw5Itg-csG23Mf9E_Avvc69VeV-YymFxNC3142YyU'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function applyMigration() {
  console.log('Applying migration 00068...')
  
  // Check if table already exists
  const { data: existing } = await supabase
    .from('artisan_reports')
    .select('id')
    .limit(1)
  
  if (existing !== null) {
    console.log('Table artisan_reports already exists, skipping...')
    return
  }

  console.log('Tables do not exist, please run the SQL manually in Supabase Dashboard')
  console.log('Go to: https://supabase.com/dashboard/project/wneiuatqjfhvczvycuqw/sql')
}

applyMigration().catch(console.error)
