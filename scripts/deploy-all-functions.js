const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Deployment script for GMBS CRM Supabase Edge Functions
 * 
 * Usage: node scripts/deploy-all-functions.js <project-ref>
 * Example: node scripts/deploy-all-functions.js ozdieldzplqyanmmgahq
 */

const projectRef = process.argv[2];

if (!projectRef) {
    console.error('\x1b[31mError: Project reference is required.\x1b[0m');
    console.log('Usage: node scripts/deploy-all-functions.js <project-ref>');
    process.exit(1);
}

const functionsDir = path.join(__dirname, '..', 'supabase', 'functions');

// Get all directories in supabase/functions, excluding _shared and hidden folders
const functions = fs.readdirSync(functionsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .filter(name => !name.startsWith('_') && !name.startsWith('.'));

console.log(`\x1b[36mFound ${functions.length} functions to deploy to project ${projectRef}...\x1b[0m`);
console.log(functions.map(f => ` - ${f}`).join('\n'));
console.log('\n');

let successCount = 0;
let errorCount = 0;

functions.forEach((func) => {
    console.log(`\x1b[33mDeploying ${func}...\x1b[0m`);
    try {
        // Run supabase functions deploy <func> --project-ref <projectRef>
        // We use stdio: 'inherit' to show real-time progress
        execSync(`supabase functions deploy ${func} --project-ref ${projectRef}`, { stdio: 'inherit' });
        console.log(`\x1b[32mSuccessfully deployed ${func}\x1b[0m\n`);
        successCount++;
    } catch (error) {
        console.error(`\x1b[31mFailed to deploy ${func}\x1b[0m\n`);
        errorCount++;
    }
});

console.log('-------------------------------------------');
console.log(`\x1b[36mDeployment summary:\x1b[0m`);
console.log(`\x1b[32mSuccess: ${successCount}\x1b[0m`);
console.log(`\x1b[31mErrors: ${errorCount}\x1b[0m`);
console.log('-------------------------------------------');

if (errorCount > 0) {
    process.exit(1);
}
