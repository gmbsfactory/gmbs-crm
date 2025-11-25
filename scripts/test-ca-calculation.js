/**
 * Script de test pour vérifier le calcul du CA depuis intervention_costs
 * Usage: node scripts/test-ca-calculation.js
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables d\'environnement SUPABASE manquantes')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testCACalculation() {
    console.log('🔍 Test du calcul du CA depuis intervention_costs\n')

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

    const startOfMonthISO = startOfMonth.toISOString()
    const endOfMonthISO = endOfMonth.toISOString()
    const startOfYearISO = startOfYear.toISOString()
    const endOfYearISO = endOfYear.toISOString()
    const startOfPreviousMonthISO = startOfPreviousMonth.toISOString()
    const endOfPreviousMonthISO = endOfPreviousMonth.toISOString()

    console.log('📅 Périodes:')
    console.log(`   Mois en cours: ${startOfMonthISO} → ${endOfMonthISO}`)
    console.log(`   Année en cours: ${startOfYearISO} → ${endOfYearISO}`)
    console.log(`   Mois précédent: ${startOfPreviousMonthISO} → ${endOfPreviousMonthISO}\n`)

    try {
        // CA du mois en cours
        console.log('📊 Calcul du CA du mois en cours...')
        const { data: caMonthData, error: caMonthError } = await supabase
            .from('intervention_costs')
            .select('amount, intervention_id, interventions!inner(date)')
            .eq('cost_type', 'intervention')
            .gte('interventions.date', startOfMonthISO)
            .lte('interventions.date', endOfMonthISO)

        if (caMonthError) {
            console.error('❌ Erreur:', caMonthError)
        } else {
            const caMonth = caMonthData?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0
            console.log(`   ✅ CA du mois: ${caMonth.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`)
            console.log(`   📝 Nombre de coûts: ${caMonthData?.length || 0}`)
        }

        // CA de l'année en cours
        console.log('\n📊 Calcul du CA de l\'année en cours...')
        const { data: caYearData, error: caYearError } = await supabase
            .from('intervention_costs')
            .select('amount, intervention_id, interventions!inner(date)')
            .eq('cost_type', 'intervention')
            .gte('interventions.date', startOfYearISO)
            .lte('interventions.date', endOfYearISO)

        if (caYearError) {
            console.error('❌ Erreur:', caYearError)
        } else {
            const caYear = caYearData?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0
            console.log(`   ✅ CA de l'année: ${caYear.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`)
            console.log(`   📝 Nombre de coûts: ${caYearData?.length || 0}`)
        }

        // CA du mois précédent
        console.log('\n📊 Calcul du CA du mois précédent...')
        const { data: caPreviousMonthData, error: caPreviousMonthError } = await supabase
            .from('intervention_costs')
            .select('amount, intervention_id, interventions!inner(date)')
            .eq('cost_type', 'intervention')
            .gte('interventions.date', startOfPreviousMonthISO)
            .lte('interventions.date', endOfPreviousMonthISO)

        if (caPreviousMonthError) {
            console.error('❌ Erreur:', caPreviousMonthError)
        } else {
            const caPreviousMonth = caPreviousMonthData?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0
            console.log(`   ✅ CA du mois précédent: ${caPreviousMonth.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`)
            console.log(`   📝 Nombre de coûts: ${caPreviousMonthData?.length || 0}`)
        }

        // Calcul de la croissance
        const caMonth = caMonthData?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0
        const caPreviousMonth = caPreviousMonthData?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0
        const revenueGrowth = caPreviousMonth > 0 
            ? ((caMonth - caPreviousMonth) / caPreviousMonth) * 100 
            : 0

        console.log('\n📈 Résumé:')
        console.log(`   CA du mois: ${caMonth.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`)
        console.log(`   CA du mois précédent: ${caPreviousMonth.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`)
        console.log(`   Croissance: ${revenueGrowth.toFixed(2)}%`)

        // Vérification des données brutes
        console.log('\n🔍 Vérification des données brutes (5 premiers coûts du mois):')
        if (caMonthData && caMonthData.length > 0) {
            caMonthData.slice(0, 5).forEach((item, index) => {
                console.log(`   ${index + 1}. Intervention ${item.intervention_id}: ${Number(item.amount).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`)
            })
        } else {
            console.log('   ⚠️  Aucune donnée trouvée pour le mois en cours')
        }

    } catch (error) {
        console.error('❌ Erreur générale:', error)
    }
}

testCACalculation().then(() => {
    console.log('\n✅ Test terminé')
    process.exit(0)
}).catch((error) => {
    console.error('❌ Erreur fatale:', error)
    process.exit(1)
})

