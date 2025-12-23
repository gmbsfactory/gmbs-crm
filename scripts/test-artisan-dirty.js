// Script pour tester le comportement de isDirty avec reset()
// selon la documentation de react-hook-form

// Test 1: reset() avec des valeurs devrait mettre isDirty à false
console.log("=== Test 1: Comportement de reset() ===")
console.log("Selon la doc react-hook-form:")
console.log("- reset(values) met à jour les defaultValues ET remet isDirty à false")
console.log("- reset(values, { keepDefaultValues: true }) garde les anciens defaultValues")
console.log("")

// Test 2: Vérifier si les tableaux vides sont comparés par référence
console.log("=== Test 2: Comparaison de tableaux ===")
const arr1 = []
const arr2 = []
console.log("arr1 === arr2 ?", arr1 === arr2) // false
console.log("JSON.stringify(arr1) === JSON.stringify(arr2) ?", JSON.stringify(arr1) === JSON.stringify(arr2)) // true
console.log("")

console.log("CONCLUSION:")
console.log("Si reset() est appelé correctement, isDirty DEVRAIT être false.")
console.log("Le problème est probablement ailleurs.")
console.log("")
console.log("HYPOTHÈSE À VÉRIFIER:")
console.log("1. Est-ce que reset() est appelé PLUSIEURS FOIS ?")
console.log("2. Est-ce que l'objet 'artisan' change de référence même sans modification ?")
console.log("3. Est-ce qu'un composant enfant modifie les valeurs du formulaire ?")
