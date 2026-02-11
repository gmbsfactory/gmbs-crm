// Test de l'API searchByPlainNom
// Ce script permet de tester directement la méthode qui pose problème

const { artisansApi } = require("../../../src/lib/api/v2");

async function testSearchByPlainNom() {
  console.log("🧪 Test de l'API searchByPlainNom");
  
  try {
    // Test 1: Recherche avec un nom simple
    console.log("\n📋 Test 1: Recherche 'mehdy'");
    const result1 = await artisansApi.searchByPlainNom("mehdy", { limit: 5 });
    console.log("Résultat:", JSON.stringify(result1, null, 2));
    
    // Test 2: Recherche avec un nom complet
    console.log("\n📋 Test 2: Recherche 'mehdy pedron'");
    const result2 = await artisansApi.searchByPlainNom("mehdy pedron", { limit: 5 });
    console.log("Résultat:", JSON.stringify(result2, null, 2));
    
    // Test 3: Recherche avec un nom qui n'existe pas
    console.log("\n📋 Test 3: Recherche 'inexistant'");
    const result3 = await artisansApi.searchByPlainNom("inexistant", { limit: 5 });
    console.log("Résultat:", JSON.stringify(result3, null, 2));
    
    // Test 4: Recherche avec une chaîne vide
    console.log("\n📋 Test 4: Recherche chaîne vide");
    try {
      const result4 = await artisansApi.searchByPlainNom("", { limit: 5 });
      console.log("Résultat:", JSON.stringify(result4, null, 2));
    } catch (error) {
      console.log("Erreur attendue:", error.message);
    }
    
    // Test 5: Vérifier la structure de la réponse
    console.log("\n📋 Test 5: Structure de la réponse");
    const result5 = await artisansApi.searchByPlainNom("a", { limit: 1 });
    console.log("Structure:", {
      hasData: !!result5.data,
      dataLength: result5.data?.length,
      hasPagination: !!result5.pagination,
      paginationKeys: result5.pagination ? Object.keys(result5.pagination) : null
    });
    
  } catch (error) {
    console.error("❌ Erreur lors du test:", error);
    console.error("Stack:", error.stack);
  }
}

// Exécuter le test
testSearchByPlainNom()
  .then(() => {
    console.log("\n✅ Test terminé");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test échoué:", error);
    process.exit(1);
  });
