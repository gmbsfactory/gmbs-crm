/** CSS styles for dynamic accordion border radius and spacing */
export const accordionStyles = `
  .accordion-item-dynamic {
    border-radius: 0.5rem;
    transition: all 0.3s ease-in-out;
  }

  /* Accordeon ouvert - entite distincte avec separation complete */
  .accordion-item-dynamic[data-state="open"] {
    border-radius: 0.5rem !important;
    margin-bottom: 1rem;
    margin-top: 1rem;
  }

  .accordion-item-dynamic[data-state="open"]:first-child {
    margin-top: 0;
  }

  .accordion-item-dynamic[data-state="open"]:last-child {
    margin-bottom: 0;
  }

  /* Fusion des accordeons fermes adjacents */
  /* Quand ferme et suivi d'un ferme, enlever arrondi inferieur */
  .accordion-item-dynamic[data-state="closed"]:has(+ .accordion-item-dynamic[data-state="closed"]) {
    border-bottom-left-radius: 0 !important;
    border-bottom-right-radius: 0 !important;
    margin-bottom: 0;
  }

  /* Quand ferme et precede d'un ferme, enlever arrondi superieur */
  .accordion-item-dynamic[data-state="closed"] + .accordion-item-dynamic[data-state="closed"] {
    border-top-left-radius: 0 !important;
    border-top-right-radius: 0 !important;
    margin-top: 0;
  }

  /* Premier element ferme - garder arrondi superieur */
  .accordion-item-dynamic[data-state="closed"]:first-child {
    border-top-left-radius: 0.5rem !important;
    border-top-right-radius: 0.5rem !important;
  }

  /* Dernier element ferme - garder arrondi inferieur */
  .accordion-item-dynamic[data-state="closed"]:last-child {
    border-bottom-left-radius: 0.5rem !important;
    border-bottom-right-radius: 0.5rem !important;
  }

  /* Separation entre groupes : ferme suivi d'ouvert ou ouvert suivi de ferme */
  .accordion-item-dynamic[data-state="closed"]:has(+ .accordion-item-dynamic[data-state="open"]) {
    border-bottom-left-radius: 0.5rem !important;
    border-bottom-right-radius: 0.5rem !important;
    margin-bottom: 1rem;
  }

  .accordion-item-dynamic[data-state="open"]:has(+ .accordion-item-dynamic[data-state="closed"]) {
    margin-bottom: 1rem;
  }
`
