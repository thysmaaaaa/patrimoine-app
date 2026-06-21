/**
 * ============================================================
 *  FINANCE UTILS
 *  Calculs purs : amortissement de crédit, PRU pondéré,
 *  performance, formatage monétaire.
 * ============================================================
 */

const FinanceUtils = (() => {

  /**
   * Calcule le capital restant dû d'un crédit à amortissement
   * constant (mensualités égales), à une date donnée.
   *
   * @param {number} montant - capital emprunté
   * @param {number} tauxAnnuelPct - taux d'intérêt annuel en %
   * @param {number} dureeMois - durée totale en mois
   * @param {string} dateDebutISO - date de début (YYYY-MM-DD)
   * @param {Date} [maintenant] - date de référence (par défaut: aujourd'hui)
   * @returns {{ mensualite: number, capitalRestant: number, moisEcoules: number, solde: boolean }}
   */
  function calculAmortissement(montant, tauxAnnuelPct, dureeMois, dateDebutISO, maintenant = new Date()) {
    const tauxMensuel = (tauxAnnuelPct / 100) / 12;
    const debut = new Date(dateDebutISO);

    // Nombre de mois écoulés depuis le début du crédit
    let moisEcoules =
      (maintenant.getFullYear() - debut.getFullYear()) * 12 +
      (maintenant.getMonth() - debut.getMonth());
    moisEcoules = Math.max(0, Math.min(moisEcoules, dureeMois));

    if (moisEcoules >= dureeMois) {
      return { mensualite: 0, capitalRestant: 0, moisEcoules: dureeMois, solde: true };
    }

    let mensualite;
    if (tauxMensuel === 0) {
      mensualite = montant / dureeMois;
    } else {
      mensualite =
        (montant * tauxMensuel) /
        (1 - Math.pow(1 + tauxMensuel, -dureeMois));
    }

    let capitalRestant = montant;
    if (tauxMensuel === 0) {
      capitalRestant = montant - mensualite * moisEcoules;
    } else {
      // Formule directe du capital restant dû après n mensualités
      capitalRestant =
        montant * Math.pow(1 + tauxMensuel, moisEcoules) -
        mensualite * ((Math.pow(1 + tauxMensuel, moisEcoules) - 1) / tauxMensuel);
    }

    capitalRestant = Math.max(0, capitalRestant);

    return { mensualite, capitalRestant, moisEcoules, solde: false };
  }

  /**
   * Recalcule le PRU (prix de revient unitaire) pondéré après un
   * nouvel achat sur une ligne existante.
   */
  function nouveauPRU(quantiteActuelle, pruActuel, quantiteAjoutee, prixAchat) {
    const totalInvestiActuel = quantiteActuelle * pruActuel;
    const investiAjoute = quantiteAjoutee * prixAchat;
    const nouvelleQuantite = quantiteActuelle + quantiteAjoutee;
    if (nouvelleQuantite === 0) return 0;
    return (totalInvestiActuel + investiAjoute) / nouvelleQuantite;
  }

  /**
   * Performance en valeur et en %.
   */
  function performance(montantInvesti, valeurActuelle) {
    const gainEur = valeurActuelle - montantInvesti;
    const gainPct = montantInvesti > 0 ? (gainEur / montantInvesti) * 100 : 0;
    return { gainEur, gainPct };
  }

  function formatEUR(value) {
    if (value === null || value === undefined || isNaN(value)) return "—";
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  function formatPct(value) {
    if (value === null || value === undefined || isNaN(value)) return "—";
    const sign = value > 0 ? "+" : "";
    const formatted = new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    return `${sign}${formatted} %`;
  }

  function formatQty(value) {
    if (value === null || value === undefined || isNaN(value)) return "—";
    // Évite les décimales inutiles pour les actions, garde la précision pour la crypto
    return Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 8 });
  }

  return {
    calculAmortissement,
    nouveauPRU,
    performance,
    formatEUR,
    formatPct,
    formatQty,
  };
})();
