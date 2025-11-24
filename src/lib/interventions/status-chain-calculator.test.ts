import { calculateIntermediateStatuses } from './status-chain-calculator';
import { INTERVENTION_STATUS_CHAINS } from '@/config/intervention-status-chains';

// Mock simple pour exécuter ce fichier avec ts-node si besoin
// ou juste pour référence visuelle de la logique

const runTests = () => {
    console.log('Running tests for calculateIntermediateStatuses...');

    const chain = INTERVENTION_STATUS_CHAINS.MAIN_PROGRESSION;
    // ['DEMANDE', 'DEVIS_ENVOYE', 'VISITE_TECHNIQUE', 'ACCEPTE', 'EN_COURS', 'TERMINE']

    // Test 1: Transition directe (adjacente)
    const t1 = calculateIntermediateStatuses('DEMANDE', 'DEVIS_ENVOYE', chain);
    console.assert(t1.intermediateStatuses.length === 0, 'Test 1 Failed: Should have 0 intermediates');
    console.log('Test 1 (Direct):', t1.intermediateStatuses.length === 0 ? 'PASS' : 'FAIL');

    // Test 2: Transition avec intermédiaires (DEMANDE -> ACCEPTE)
    // Intermédiaires attendus: DEVIS_ENVOYE, VISITE_TECHNIQUE
    const t2 = calculateIntermediateStatuses('DEMANDE', 'ACCEPTE', chain);
    console.assert(t2.intermediateStatuses.length === 2, 'Test 2 Failed: Should have 2 intermediates');
    console.assert(t2.intermediateStatuses[0] === 'DEVIS_ENVOYE', 'Test 2 Failed: First should be DEVIS_ENVOYE');
    console.assert(t2.intermediateStatuses[1] === 'VISITE_TECHNIQUE', 'Test 2 Failed: Second should be VISITE_TECHNIQUE');
    console.log('Test 2 (Intermediates):', t2.intermediateStatuses.length === 2 ? 'PASS' : 'FAIL');

    // Test 3: Transition complète (DEMANDE -> TERMINE)
    // Intermédiaires: DEVIS_ENVOYE, VISITE_TECHNIQUE, ACCEPTE, EN_COURS
    const t3 = calculateIntermediateStatuses('DEMANDE', 'TERMINE', chain);
    console.assert(t3.intermediateStatuses.length === 4, 'Test 3 Failed: Should have 4 intermediates');
    console.log('Test 3 (Full):', t3.intermediateStatuses.length === 4 ? 'PASS' : 'FAIL');

    // Test 4: Régression (ACCEPTE -> DEMANDE)
    const t4 = calculateIntermediateStatuses('ACCEPTE', 'DEMANDE', chain);
    console.assert(t4.intermediateStatuses.length === 0, 'Test 4 Failed: Should have 0 intermediates');
    console.assert(t4.isValid === true, 'Test 4 Failed: Should be valid (but empty)');
    console.log('Test 4 (Regression):', t4.intermediateStatuses.length === 0 ? 'PASS' : 'FAIL');

    // Test 5: Statut hors chaîne (DEMANDE -> REFUSE)
    const t5 = calculateIntermediateStatuses('DEMANDE', 'REFUSE', chain);
    console.assert(t5.intermediateStatuses.length === 0, 'Test 5 Failed: Should have 0 intermediates');
    console.assert(t5.isValid === true, 'Test 5 Failed: Should be valid');
    console.log('Test 5 (Out of chain target):', t5.intermediateStatuses.length === 0 ? 'PASS' : 'FAIL');
};

// Uncomment to run if executing directly
// runTests();
