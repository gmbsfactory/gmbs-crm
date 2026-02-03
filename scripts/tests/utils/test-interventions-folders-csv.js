/**
 * Standalone test script for interventions-folders.csv
 * 
 * Run with: node scripts/test-interventions-folders-csv.js
 * 
 * Validates CSV structure, data integrity, and consistency
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('papaparse');

const CSV_PATH = path.join(__dirname, '../data/docs_imports/interventions-folders.csv');
const MATCHES_CSV_PATH = path.join(__dirname, '../data/docs_imports/intervention-folder-matches.csv');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function logHeader(message) {
  console.log('\n' + '='.repeat(60));
  log(message, 'blue');
  console.log('='.repeat(60) + '\n');
}

class TestResults {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.warnings = 0;
    this.errors = [];
  }

  pass(testName) {
    this.passed++;
    logSuccess(`PASS: ${testName}`);
  }

  fail(testName, error) {
    this.failed++;
    this.errors.push({ test: testName, error });
    logError(`FAIL: ${testName}`);
    if (error) {
      logError(`   ${error}`, 'red');
    }
  }

  warn(testName, message) {
    this.warnings++;
    logWarning(`WARN: ${testName}: ${message}`);
  }

  summary() {
    logHeader('TEST SUMMARY');
    logSuccess(`Passed: ${this.passed}`);
    if (this.failed > 0) {
      logError(`Failed: ${this.failed}`);
    }
    if (this.warnings > 0) {
      logWarning(`Warnings: ${this.warnings}`);
    }

    if (this.errors.length > 0) {
      console.log('\n');
      logHeader('FAILED TESTS');
      this.errors.forEach(({ test, error }) => {
        logError(`${test}: ${error}`);
      });
    }

    const total = this.passed + this.failed;
    const successRate = total > 0 ? ((this.passed / total) * 100).toFixed(1) : 0;
    
    console.log('\n');
    log(`Success Rate: ${successRate}%`, successRate === 100 ? 'green' : 'yellow');
  }
}

function testFileExists(results) {
  if (!fs.existsSync(CSV_PATH)) {
    results.fail('File exists', `CSV file not found at: ${CSV_PATH}`);
    return false;
  }
  results.pass('File exists');
  return true;
}

function testFileNotEmpty(results, content) {
  if (content.length === 0) {
    results.fail('File not empty', 'File is empty');
    return false;
  }
  results.pass('File not empty');
  return true;
}

function testHeaders(results, content) {
  const expectedHeaders = [
    'Mois',
    'Nom dossier',
    'ID intervention',
    'Numéro facture',
    'Nombre documents',
    'Format',
    'Folder ID'
  ];

  const firstLine = content.split('\n')[0];
  const missingHeaders = expectedHeaders.filter(header => !firstLine.includes(header));

  if (missingHeaders.length > 0) {
    results.fail('Headers', `Missing headers: ${missingHeaders.join(', ')}`);
    return false;
  }
  results.pass('Headers');
  return true;
}

function testRowCount(results, data) {
  const expectedCount = 541;
  if (data.length !== expectedCount) {
    results.fail('Row count', `Expected ${expectedCount} rows, got ${data.length}`);
    return false;
  }
  results.pass(`Row count (${data.length} rows)`);
  return true;
}

function testRequiredColumns(results, data) {
  const requiredColumns = [
    'Mois',
    'Nom dossier',
    'ID intervention',
    'Numéro facture',
    'Nombre documents',
    'Format',
    'Folder ID'
  ];

  let allValid = true;
  data.forEach((row, index) => {
    requiredColumns.forEach(column => {
      if (!(column in row) || row[column] === undefined) {
        results.fail(`Required columns (row ${index + 1})`, `Missing column: ${column}`);
        allValid = false;
      }
    });
  });

  if (allValid) {
    results.pass('Required columns');
  }
  return allValid;
}

function testMonthValues(results, data) {
  const validMonths = [
    '9-SEPTEMBRE 2025',
    '10-Octobre 2025'
  ];

  const invalidMonths = data.filter(row => !validMonths.includes(row.Mois));
  
  if (invalidMonths.length > 0) {
    results.fail('Month values', `${invalidMonths.length} rows have invalid month values`);
    invalidMonths.slice(0, 5).forEach(row => {
      logError(`   Invalid month: "${row.Mois}"`);
    });
    return false;
  }
  results.pass('Month values');
  return true;
}

function testFolderIds(results, data) {
  const folderIdPattern = /^[a-zA-Z0-9_-]+$/;
  const invalidIds = data.filter(row => !folderIdPattern.test(row['Folder ID'].trim()));

  if (invalidIds.length > 0) {
    results.fail('Folder IDs', `${invalidIds.length} rows have invalid Folder IDs`);
    return false;
  }
  results.pass('Folder IDs format');
  return true;
}

function testUniqueFolderIds(results, data) {
  const folderIds = data.map(row => row['Folder ID'].trim());
  const uniqueIds = new Set(folderIds);

  if (uniqueIds.size !== folderIds.length) {
    const duplicates = folderIds.length - uniqueIds.size;
    results.fail('Unique Folder IDs', `${duplicates} duplicate Folder IDs found`);
    return false;
  }
  results.pass('Unique Folder IDs');
  return true;
}

function testDocumentCounts(results, data) {
  const invalidCounts = data.filter(row => {
    const count = parseInt(row['Nombre documents'].trim(), 10);
    return isNaN(count) || count < 0;
  });

  if (invalidCounts.length > 0) {
    results.fail('Document counts', `${invalidCounts.length} rows have invalid document counts`);
    return false;
  }
  results.pass('Document counts');
  return true;
}

function testFormats(results, data) {
  const validFormats = [
    'INTER_ID_FACTURE',
    'INTER_SIMPLE',
    'INTER_ID_EXPLICITE',
    'UNKNOWN'
  ];

  const invalidFormats = data.filter(row => !validFormats.includes(row.Format));

  if (invalidFormats.length > 0) {
    results.fail('Format values', `${invalidFormats.length} rows have invalid format values`);
    return false;
  }
  results.pass('Format values');
  return true;
}

function testFormatConsistency(results, data) {
  let allValid = true;

  // INTER_ID_FACTURE should have both ID and invoice number
  const interIdFacture = data.filter(row => row.Format === 'INTER_ID_FACTURE');
  const invalidInterIdFacture = interIdFacture.filter(row => {
    const hasId = row['ID intervention'].trim() !== '';
    const hasFacture = row['Numéro facture'].trim() !== '';
    return !hasId || !hasFacture;
  });

  if (invalidInterIdFacture.length > 0) {
    results.fail('INTER_ID_FACTURE consistency', 
      `${invalidInterIdFacture.length} INTER_ID_FACTURE rows missing ID or invoice number`);
    allValid = false;
  }

  // UNKNOWN should have missing ID
  const unknown = data.filter(row => row.Format === 'UNKNOWN');
  const invalidUnknown = unknown.filter(row => {
    const id = row['ID intervention'].trim();
    return id !== '' && !isNaN(parseInt(id, 10));
  });

  if (invalidUnknown.length > 0) {
    results.fail('UNKNOWN format consistency', 
      `${invalidUnknown.length} UNKNOWN rows have valid IDs`);
    allValid = false;
  }

  if (allValid) {
    results.pass('Format consistency');
  }
  return allValid;
}

function testInterventionIds(results, data) {
  const rowsWithId = data.filter(row => row['ID intervention'].trim() !== '');
  const invalidIds = rowsWithId.filter(row => {
    const id = parseInt(row['ID intervention'].trim(), 10);
    return isNaN(id) || id <= 0;
  });

  if (invalidIds.length > 0) {
    results.fail('Intervention IDs', `${invalidIds.length} rows have invalid intervention IDs`);
    return false;
  }
  results.pass(`Intervention IDs (${rowsWithId.length} rows with IDs)`);
  return true;
}

function testStatistics(results, data) {
  logHeader('STATISTICS');

  // Month distribution
  const monthCounts = data.reduce((acc, row) => {
    acc[row.Mois] = (acc[row.Mois] || 0) + 1;
    return acc;
  }, {});
  logInfo('Month distribution:');
  Object.entries(monthCounts).forEach(([month, count]) => {
    console.log(`   ${month}: ${count} rows`);
  });

  // Format distribution
  const formatCounts = data.reduce((acc, row) => {
    acc[row.Format] = (acc[row.Format] || 0) + 1;
    return acc;
  }, {});
  logInfo('Format distribution:');
  Object.entries(formatCounts).forEach(([format, count]) => {
    console.log(`   ${format}: ${count} rows`);
  });

  // Document count stats
  const docCounts = data.map(row => parseInt(row['Nombre documents'].trim(), 10));
  const minDocs = Math.min(...docCounts);
  const maxDocs = Math.max(...docCounts);
  const avgDocs = docCounts.reduce((a, b) => a + b, 0) / docCounts.length;
  logInfo('Document count statistics:');
  console.log(`   Min: ${minDocs}`);
  console.log(`   Max: ${maxDocs}`);
  console.log(`   Average: ${avgDocs.toFixed(2)}`);

  // Rows with/without IDs
  const rowsWithId = data.filter(row => row['ID intervention'].trim() !== '').length;
  const rowsWithoutId = data.length - rowsWithId;
  logInfo('ID distribution:');
  console.log(`   With ID: ${rowsWithId}`);
  console.log(`   Without ID: ${rowsWithoutId}`);

  results.pass('Statistics generated');
}

function testMatchesComparison(results, foldersData) {
  logHeader('MATCHES COMPARISON');

  // Check if matches file exists
  if (!fs.existsSync(MATCHES_CSV_PATH)) {
    results.warn('Matches file', `Matches CSV file not found at: ${MATCHES_CSV_PATH}`);
    logWarning('Skipping matches comparison');
    return;
  }

  try {
    // Load matches CSV
    const matchesContent = fs.readFileSync(MATCHES_CSV_PATH, 'utf-8');
    const matchesParseResult = parse(matchesContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (matchesParseResult.errors.length > 0) {
      results.warn('Matches parsing', `Matches CSV parsing had ${matchesParseResult.errors.length} errors`);
    }

    const matchesData = matchesParseResult.data;

    // Statistics from folders CSV
    const totalFolders = foldersData.length;
    const foldersWithId = foldersData.filter(row => row['ID intervention'].trim() !== '').length;

    // Statistics from matches CSV
    const totalMatches = matchesData.length;
    const exactMatches = matchesData.filter(row => row['Match type'] === 'exact').length;
    const noMatches = matchesData.filter(row => row['Match type'] === 'none').length;

    // Create maps for comparison
    const foldersMap = new Map();
    foldersData.forEach(row => {
      const folderId = row['Folder ID'].trim();
      const interventionId = row['ID intervention'].trim();
      if (folderId) {
        foldersMap.set(folderId, {
          interventionId: interventionId,
          folderName: row['Nom dossier'],
          month: row.Mois
        });
      }
    });

    const matchesMap = new Map();
    matchesData.forEach(row => {
      const folderName = row.Dossier;
      if (folderName) {
        matchesMap.set(folderName, {
          interventionId: row['ID intervention'],
          matchType: row['Match type'],
          interventionUuid: row['Intervention ID']
        });
      }
    });

    // Compare by folder name
    let foundInMatches = 0;
    let notFoundInMatches = 0;
    const missingInMatches = [];

    foldersData.forEach(row => {
      const folderName = row['Nom dossier'];
      if (matchesMap.has(folderName)) {
        foundInMatches++;
      } else {
        notFoundInMatches++;
        missingInMatches.push(folderName);
      }
    });

    // Display comparison statistics
    logInfo('Comparison Statistics:');
    console.log(`\n📊 From interventions-folders.csv:`);
    console.log(`   Total folders: ${totalFolders}`);
    console.log(`   Folders with intervention ID: ${foldersWithId}`);
    console.log(`   Folders without intervention ID: ${totalFolders - foldersWithId}`);

    console.log(`\n📊 From intervention-folder-matches.csv:`);
    console.log(`   Total matches processed: ${totalMatches}`);
    console.log(`   Exact matches: ${exactMatches} (${((exactMatches / totalMatches) * 100).toFixed(1)}%)`);
    console.log(`   No matches: ${noMatches} (${((noMatches / totalMatches) * 100).toFixed(1)}%)`);

    console.log(`\n🔗 Cross-file comparison:`);
    console.log(`   Folders found in matches file: ${foundInMatches} (${((foundInMatches / totalFolders) * 100).toFixed(1)}%)`);
    console.log(`   Folders NOT found in matches file: ${notFoundInMatches} (${((notFoundInMatches / totalFolders) * 100).toFixed(1)}%)`);

    // Match rate calculation
    const matchRate = totalFolders > 0 ? ((exactMatches / foldersWithId) * 100).toFixed(1) : 0;
    console.log(`\n✅ Overall match rate:`);
    console.log(`   ${exactMatches} exact matches out of ${foldersWithId} folders with IDs`);
    console.log(`   Match rate: ${matchRate}%`);

    // Show some examples of unmatched folders
    if (noMatches > 0) {
      console.log(`\n⚠️  Examples of unmatched folders (first 10):`);
      const unmatchedExamples = matchesData
        .filter(row => row['Match type'] === 'none')
        .slice(0, 10);
      unmatchedExamples.forEach((row, idx) => {
        console.log(`   ${idx + 1}. "${row.Dossier}" (ID: ${row['ID intervention'] || 'N/A'})`);
      });
      if (noMatches > 10) {
        console.log(`   ... and ${noMatches - 10} more`);
      }
    }

    // Show missing folders if any
    if (missingInMatches.length > 0 && missingInMatches.length <= 20) {
      console.log(`\n⚠️  Folders in interventions-folders.csv but NOT in matches file (first 10):`);
      missingInMatches.slice(0, 10).forEach((name, idx) => {
        console.log(`   ${idx + 1}. "${name}"`);
      });
      if (missingInMatches.length > 10) {
        console.log(`   ... and ${missingInMatches.length - 10} more`);
      }
    }

    results.pass('Matches comparison completed');
  } catch (error) {
    results.fail('Matches comparison', `Error comparing files: ${error.message}`);
  }
}

async function main() {
  logHeader('INTERVENTIONS-FOLDERS.CSV VALIDATION');

  const results = new TestResults();

  // Load CSV file
  if (!testFileExists(results)) {
    results.summary();
    process.exit(1);
  }

  const content = fs.readFileSync(CSV_PATH, 'utf-8');

  if (!testFileNotEmpty(results, content)) {
    results.summary();
    process.exit(1);
  }

  // Parse CSV
  const parseResult = parse(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (parseResult.errors.length > 0) {
    logWarning(`CSV parsing had ${parseResult.errors.length} errors`);
    parseResult.errors.slice(0, 5).forEach(error => {
      logWarning(`   ${error.message} (row ${error.row})`);
    });
  }

  const data = parseResult.data;

  // Run tests
  testHeaders(results, content);
  testRowCount(results, data);
  testRequiredColumns(results, data);
  testMonthValues(results, data);
  testFolderIds(results, data);
  testUniqueFolderIds(results, data);
  testDocumentCounts(results, data);
  testFormats(results, data);
  testFormatConsistency(results, data);
  testInterventionIds(results, data);

  // Generate statistics
  testStatistics(results, data);

  // Compare with matches file
  testMatchesComparison(results, data);

  // Summary
  results.summary();

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

if (require.main === module) {
  main().catch(error => {
    logError(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}

module.exports = { main };

