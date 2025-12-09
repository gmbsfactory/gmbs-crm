/**
 * Script de test rapide pour valider parseNumber
 */

const { DataMapper } = require('./data-mapper');

const mapper = new DataMapper();

// Tests à valider
const testCases = [
  { input: "600 + 125", expected: 725, description: "Addition simple" },
  { input: "200 ou 320", expected: null, description: "Rejet: contient lettres" },
  { input: "120,00", expected: 120, description: "Virgule décimale" },
  { input: "jusqu 300", expected: null, description: "Rejet: contient lettres" },
  { input: "nego a 1500 // 930+600 parquet +50 plinthes =1580€ ", expected: null, description: "Rejet: contient lettres" },
  { input: "182*2+ 50* 30", expected: 1864, description: "Multiplications et additions" },
];

console.log("🧪 Tests de parseNumber\n");

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const result = mapper.parseNumber(testCase.input);
  const success = result === testCase.expected;
  
  if (success) {
    console.log(`✅ ${testCase.description}`);
    console.log(`   Input: "${testCase.input}"`);
    console.log(`   Result: ${result}\n`);
    passed++;
  } else {
    console.log(`❌ ${testCase.description}`);
    console.log(`   Input: "${testCase.input}"`);
    console.log(`   Expected: ${testCase.expected}`);
    console.log(`   Got: ${result}\n`);
    failed++;
  }
}

console.log(`\n📊 Résultats: ${passed} passés, ${failed} échoués`);

if (failed === 0) {
  console.log("🎉 Tous les tests sont passés !");
  process.exit(0);
} else {
  console.log("⚠️ Certains tests ont échoué");
  process.exit(1);
}





