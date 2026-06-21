/**
 * ============================================================
 *  APP.JS — Logique applicative principale
 * ============================================================
 */

// ---------------------------------------------------------
// ÉTAT GLOBAL (en mémoire, synchronisé avec Firestore)
// ---------------------------------------------------------
const State = {
  lignes: [],      // toutes les lignes d'actifs (epargne, av, pea, crypto)
  credits: [],     // crédits en cours
  pin: DEFAULT_PIN,
  quotes: {},      // ticker -> prix unitaire en EUR (cache de rendu)
  lastUpdate: null,
};

let pendingPin = "";
let pinMode = "unlock"; // "unlock" | "setup-old" | "setup-new" | "setup-confirm"
let newPinTemp = "";

// ============================================================
// 1. ÉCRAN DE VERROUILLAGE
// ============================================================

function initLockScreen() {
  updateClock();
  setInterval(updateClock, 1000 * 30);

  document.getElementById("keypad").addEventListener("click", (e) => {
    const keyBtn = e.target.closest(".key");
    if (!keyBtn) return;
    if (keyBtn.id === "key-delete") {
      handlePinDelete();
    } else if (keyBtn.dataset.key !== undefined) {
      handlePinDigit(keyBtn.dataset.key);
    }
  });
}

function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  document.getElementById("lock-time").textContent = `${h}:${m}`;
  const dateStr = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  document.getElementById("lock-date").textContent = dateStr;
}

function handlePinDigit(digit) {
  if (pendingPin.length >= 4) return;
  pendingPin += digit;
  renderPinDots();
  if (pendingPin.length === 4) {
    setTimeout(() => validatePinEntry(), 120);
  }
}

function handlePinDelete() {
  pendingPin = pendingPin.slice(0, -1);
  renderPinDots();
}

function renderPinDots() {
  const dots = document.querySelectorAll(".pin-dot");
  dots.forEach((dot, i) => {
    dot.classList.toggle("filled", i < pendingPin.length);
  });
}

function showPinError(message) {
  const errEl = document.getElementById("pin-error");
  errEl.textContent = message;
  errEl.classList.add("visible");
  document.querySelectorAll(".pin-dot").forEach((dot) => dot.classList.add("shake-error"));
  setTimeout(() => {
    document.querySelectorAll(".pin-dot").forEach((dot) => dot.classList.remove("shake-error"));
  }, 450);
}

function clearPinError() {
  document.getElementById("pin-error").classList.remove("visible");
}

function resetPinEntry() {
  pendingPin = "";
  renderPinDots();
}

function validatePinEntry() {
  if (pinMode === "unlock") {
    if (pendingPin === State.pin) {
      clearPinError();
      unlockApp();
    } else {
      showPinError("Code incorrect");
      setTimeout(resetPinEntry, 400);
    }
  } else if (pinMode === "setup-old") {
    if (pendingPin === State.pin) {
      clearPinError();
      pinMode = "setup-new";
      document.getElementById("lock-label").textContent = "Saisissez le nouveau code";
      resetPinEntry();
    } else {
      showPinError("Code actuel incorrect");
      setTimeout(resetPinEntry, 400);
    }
  } else if (pinMode === "setup-new") {
    newPinTemp = pendingPin;
    pinMode = "setup-confirm";
    document.getElementById("lock-label").textContent = "Confirmez le nouveau code";
    resetPinEntry();
  } else if (pinMode === "setup-confirm") {
    if (pendingPin === newPinTemp) {
      State.pin = newPinTemp;
      saveStateToFirebase();
      clearPinError();
      showToast("Code PIN mis à jour");
      pinMode = "unlock";
      unlockApp();
    } else {
      showPinError("Les codes ne correspondent pas");
      pinMode = "setup-new";
      document.getElementById("lock-label").textContent = "Saisissez le nouveau code";
      setTimeout(resetPinEntry, 500);
    }
  }
}

function unlockApp() {
  document.getElementById("lock-screen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  resetPinEntry();
  setGreeting();
}

function lockApp() {
  pinMode = "unlock";
  document.getElementById("lock-label").textContent = "Saisissez votre code";
  document.getElementById("app").classList.add("hidden");
  document.getElementById("lock-screen").classList.remove("hidden");
  resetPinEntry();
}

function startChangePin() {
  pinMode = "setup-old";
  document.getElementById("lock-label").textContent = "Saisissez le code actuel";
  document.getElementById("app").classList.add("hidden");
  document.getElementById("lock-screen").classList.remove("hidden");
  resetPinEntry();
}

function setGreeting() {
  const hour = new Date().getHours();
  let greeting = "Bonsoir";
  if (hour >= 5 && hour < 12) greeting = "Bonjour";
  else if (hour >= 12 && hour < 18) greeting = "Bon après-midi";
  document.getElementById("header-greeting").textContent = greeting;
}

// ============================================================
// 2. NAVIGATION PAR ONGLETS
// ============================================================

function initTabNavigation() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tabId) {
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("hidden", panel.id !== tabId);
  });
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
  document.getElementById("app-main").scrollTop = 0;

  if (tabId === "tab-add") populateAddForm();
  if (tabId === "tab-credits") renderCreditsDetailList();
  if (tabId === "tab-settings") renderManageLines();
}

// ============================================================
// 3. RENDU DU TABLEAU DE BORD
// ============================================================

function computeLineValuation(ligne) {
  // epargne / av : solde direct (pas de marché)
  if (ligne.enveloppe === "epargne" || ligne.enveloppe === "av") {
    const solde = ligne.solde || 0;
    const investi = ligne.montantInvesti ?? solde;
    return {
      valeur: solde,
      investi: investi,
      gainEur: solde - investi,
      gainPct: investi > 0 ? ((solde - investi) / investi) * 100 : 0,
      coursActuel: null,
    };
  }

  // pea / crypto : quantite * cours actuel
  const cours = State.quotes[ligne.ticker] ?? null;
  const quantite = ligne.quantite || 0;
  const investi = ligne.montantInvesti || 0;
  const valeur = cours !== null ? cours * quantite : investi;
  const perf = FinanceUtils.performance(investi, valeur);
  return {
    valeur,
    investi,
    gainEur: perf.gainEur,
    gainPct: perf.gainPct,
    coursActuel: cours,
  };
}

function renderDashboard() {
  const lignesByEnv = {
    epargne: State.lignes.filter((l) => l.enveloppe === "epargne"),
    av: State.lignes.filter((l) => l.enveloppe === "av"),
    pea: State.lignes.filter((l) => l.enveloppe === "pea"),
    crypto: State.lignes.filter((l) => l.enveloppe === "crypto"),
  };

  const totalsByEnv = {};
  let totalActifs = 0;
  let totalInvesti = 0;

  Object.entries(lignesByEnv).forEach(([env, lignes]) => {
    let sousTotal = 0;
    lignes.forEach((l) => {
      const v = computeLineValuation(l);
      sousTotal += v.valeur;
      totalInvesti += v.investi;
    });
    totalsByEnv[env] = sousTotal;
    totalActifs += sousTotal;
  });

  // Passifs : capital restant dû de chaque crédit
  let totalPassifs = 0;
  State.credits.forEach((c) => {
    const r = FinanceUtils.calculAmortissement(c.montant, c.taux, c.dureeMois, c.dateDebut);
    totalPassifs += r.capitalRestant;
  });

  const patrimoineNet = totalActifs - totalPassifs;
  const perfGlobaleEur = totalActifs - totalInvesti;
  const perfGlobalePct = totalInvesti > 0 ? (perfGlobaleEur / totalInvesti) * 100 : 0;

  document.getElementById("val-brut").textContent = FinanceUtils.formatEUR(totalActifs);
  document.getElementById("val-net").textContent = FinanceUtils.formatEUR(patrimoineNet);
  document.getElementById("val-actifs").textContent = FinanceUtils.formatEUR(totalActifs);
  document.getElementById("val-passifs").textContent = FinanceUtils.formatEUR(totalPassifs);
  const perfEl = document.getElementById("val-perf");
  perfEl.textContent = FinanceUtils.formatPct(perfGlobalePct);
  perfEl.className = "hero-value-sm " + perfClass(perfGlobaleEur);

  PieChart.render("chart-repartition", totalsByEnv, "chart-legend");

  renderAssetList("list-epargne", lignesByEnv.epargne, "epargne");
  renderAssetList("list-av", lignesByEnv.av, "av");
  renderAssetList("list-pea", lignesByEnv.pea, "pea");
  renderAssetList("list-crypto", lignesByEnv.crypto, "crypto");
  renderCreditsList();

  if (State.lastUpdate) {
    document.getElementById("last-update").textContent =
      "Dernière mise à jour : " + State.lastUpdate.toLocaleTimeString("fr-FR");
  }
}

function perfClass(value) {
  if (value > 0) return "perf-positive";
  if (value < 0) return "perf-negative";
  return "perf-neutral";
}

function renderAssetList(containerId, lignes, enveloppe) {
  const container = document.getElementById(containerId);
  if (!lignes || lignes.length === 0) {
    container.innerHTML = `<div class="empty-row">Aucune ligne pour le moment</div>`;
    return;
  }

  container.innerHTML = lignes
    .map((l) => {
      const v = computeLineValuation(l);
      const isMarket = enveloppe === "pea" || enveloppe === "crypto";
      const sub = isMarket
        ? `${FinanceUtils.formatQty(l.quantite)} ${l.ticker} · PRU ${FinanceUtils.formatEUR(
            l.quantite > 0 ? l.montantInvesti / l.quantite : 0
          )}`
        : `Investi : ${FinanceUtils.formatEUR(l.montantInvesti ?? l.solde)}`;

      return `
        <div class="asset-row">
          <div class="asset-info">
            <span class="asset-name">${escapeHtml(l.nom)}</span>
            <span class="asset-sub">${sub}</span>
          </div>
          <div class="asset-values">
            <div class="asset-value">${FinanceUtils.formatEUR(v.valeur)}</div>
            <div class="asset-perf ${perfClass(v.gainEur)}">
              ${FinanceUtils.formatPct(v.gainPct)} · ${v.gainEur >= 0 ? "+" : ""}${FinanceUtils.formatEUR(v.gainEur)}
            </div>
          </div>
        </div>`;
    })
    .join("");
}

function renderCreditsList() {
  const container = document.getElementById("list-credits");
  if (!State.credits || State.credits.length === 0) {
    container.innerHTML = `<div class="empty-row">Aucun crédit en cours</div>`;
    return;
  }
  container.innerHTML = State.credits
    .map((c) => {
      const r = FinanceUtils.calculAmortissement(c.montant, c.taux, c.dureeMois, c.dateDebut);
      return `
        <div class="asset-row">
          <div class="asset-info">
            <span class="asset-name">${escapeHtml(c.nom)}</span>
            <span class="asset-sub">Taux ${c.taux}% · ${c.dureeMois} mois</span>
          </div>
          <div class="asset-values">
            <div class="asset-value perf-negative">- ${FinanceUtils.formatEUR(r.capitalRestant)}</div>
            <div class="asset-perf perf-neutral">Mensualité ${FinanceUtils.formatEUR(r.mensualite)}</div>
          </div>
        </div>`;
    })
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ============================================================
// 4. MODULE DE SAISIE (versements / retraits)
// ============================================================

function initAddForm() {
  document.querySelectorAll("#op-type-segmented .segmented-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#op-type-segmented .segmented-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  document.getElementById("select-enveloppe").addEventListener("change", populateAddForm);
  document.getElementById("select-simple-line").addEventListener("change", onSimpleLineChange);
  document.getElementById("select-market-ticker").addEventListener("change", onMarketTickerChange);
  document.getElementById("btn-valider-operation").addEventListener("click", validerOperation);
}

function currentEnveloppe() {
  return document.getElementById("select-enveloppe").value;
}

function isMarketEnveloppe(env) {
  return env === "pea" || env === "crypto";
}

function populateAddForm() {
  const env = currentEnveloppe();
  const isMarket = isMarketEnveloppe(env);

  document.getElementById("group-simple-line").classList.toggle("hidden", isMarket);
  document.getElementById("group-market-line").classList.toggle("hidden", !isMarket);
  document.getElementById("group-montant-simple").classList.toggle("hidden", isMarket);

  if (isMarket) {
    populateMarketTickerSelect(env);
  } else {
    populateSimpleLineSelect(env);
  }
}

function populateSimpleLineSelect(env) {
  const select = document.getElementById("select-simple-line");
  const lignes = State.lignes.filter((l) => l.enveloppe === env);
  const options = lignes
    .map((l) => `<option value="${l.id}">${escapeHtml(l.nom)}</option>`)
    .join("");
  select.innerHTML = options + `<option value="__new__">+ Nouveau support…</option>`;
}

function populateMarketTickerSelect(env) {
  const select = document.getElementById("select-market-ticker");
  const lignes = State.lignes.filter((l) => l.enveloppe === env);
  const options = lignes
    .map((l) => `<option value="${l.id}">${escapeHtml(l.nom)} (${l.ticker})</option>`)
    .join("");
  select.innerHTML = options + `<option value="__new__">+ Nouvel actif…</option>`;
}

function onSimpleLineChange() {
  const value = document.getElementById("select-simple-line").value;
  if (value === "__new__") {
    promptNewSimpleLine();
  }
}

function onMarketTickerChange() {
  const value = document.getElementById("select-market-ticker").value;
  if (value === "__new__") {
    promptNewMarketLine();
  }
}

function promptNewSimpleLine() {
  const env = currentEnveloppe();
  const envLabel = env === "epargne" ? "Épargne sécurisée" : "Assurance vie";
  openModal(
    `Nouveau support — ${envLabel}`,
    `<div class="form-group">
       <label class="form-label">Nom (ex : Livret A, Fonds en euros…)</label>
       <input type="text" id="modal-input-nom" class="form-input" placeholder="Nom du support">
     </div>`,
    () => {
      const nom = document.getElementById("modal-input-nom").value.trim();
      if (!nom) { showToast("Merci de saisir un nom"); return false; }
      const newLine = {
        id: generateId(),
        enveloppe: env,
        nom,
        solde: 0,
        montantInvesti: 0,
      };
      State.lignes.push(newLine);
      saveStateToFirebase();
      populateSimpleLineSelect(env);
      document.getElementById("select-simple-line").value = newLine.id;
      return true;
    }
  );
}

function promptNewMarketLine() {
  const env = currentEnveloppe();
  const isCrypto = env === "crypto";
  const cryptoOptions = MarketAPI.SUPPORTED_CRYPTO.map(
    (sym) => `<option value="${sym}">${sym}</option>`
  ).join("");

  const bodyHtml = isCrypto
    ? `<div class="form-group">
         <label class="form-label">Cryptomonnaie</label>
         <select id="modal-input-ticker" class="form-input">${cryptoOptions}</select>
       </div>`
    : `<div class="form-group">
         <label class="form-label">Nom</label>
         <input type="text" id="modal-input-nom" class="form-input" placeholder="Ex : ETF World">
       </div>
       <div class="form-group">
         <label class="form-label">Ticker (symbole Finnhub)</label>
         <input type="text" id="modal-input-ticker" class="form-input" placeholder="Ex : CW8.PA">
       </div>`;

  openModal(
    isCrypto ? "Nouvelle cryptomonnaie" : "Nouvel actif PEA",
    bodyHtml,
    () => {
      const tickerInput = document.getElementById("modal-input-ticker");
      const ticker = (isCrypto ? tickerInput.value : tickerInput.value.trim()).toUpperCase();
      if (!ticker) { showToast("Merci de renseigner le ticker"); return false; }
      const nom = isCrypto
        ? ticker
        : (document.getElementById("modal-input-nom").value.trim() || ticker);

      // Empêche les doublons de ticker dans la même enveloppe
      const exists = State.lignes.some((l) => l.enveloppe === env && l.ticker === ticker);
      if (exists) { showToast("Cet actif existe déjà"); return false; }

      const newLine = {
        id: generateId(),
        enveloppe: env,
        nom,
        ticker,
        quantite: 0,
        montantInvesti: 0,
      };
      State.lignes.push(newLine);
      saveStateToFirebase();
      populateMarketTickerSelect(env);
      document.getElementById("select-market-ticker").value = newLine.id;
      refreshQuotesForState();
      return true;
    }
  );
}

function validerOperation() {
  const env = currentEnveloppe();
  const opType = document.querySelector("#op-type-segmented .segmented-btn.active").dataset.op;
  const isMarket = isMarketEnveloppe(env);

  if (isMarket) {
    const ligneId = document.getElementById("select-market-ticker").value;
    if (!ligneId || ligneId === "__new__") { showToast("Choisissez un actif"); return; }
    const prixAchat = parseFloat(document.getElementById("input-prix-achat").value);
    const quantite = parseFloat(document.getElementById("input-quantite").value);

    if (!prixAchat || !quantite || prixAchat <= 0 || quantite <= 0) {
      showToast("Renseignez un prix et une quantité valides");
      return;
    }

    const ligne = State.lignes.find((l) => l.id === ligneId);
    if (!ligne) return;

    if (opType === "depot") {
      const pruActuel = ligne.quantite > 0 ? ligne.montantInvesti / ligne.quantite : 0;
      const nouveauPru = FinanceUtils.nouveauPRU(ligne.quantite, pruActuel, quantite, prixAchat);
      ligne.quantite += quantite;
      ligne.montantInvesti = nouveauPru * ligne.quantite;
    } else {
      // retrait : on diminue la quantité, le PRU reste inchangé
      if (quantite > ligne.quantite) { showToast("Quantité supérieure à la position détenue"); return; }
      const pruActuel = ligne.quantite > 0 ? ligne.montantInvesti / ligne.quantite : 0;
      ligne.quantite -= quantite;
      ligne.montantInvesti = pruActuel * ligne.quantite;
    }

    saveStateToFirebase();
    showToast(opType === "depot" ? "Achat enregistré" : "Vente enregistrée");
    clearAddFormInputs();
    renderDashboard();
  } else {
    const ligneId = document.getElementById("select-simple-line").value;
    if (!ligneId || ligneId === "__new__") { showToast("Choisissez un support"); return; }
    const montant = parseFloat(document.getElementById("input-montant").value);
    if (!montant || montant <= 0) { showToast("Renseignez un montant valide"); return; }

    const ligne = State.lignes.find((l) => l.id === ligneId);
    if (!ligne) return;

    if (opType === "depot") {
      ligne.solde = (ligne.solde || 0) + montant;
      ligne.montantInvesti = (ligne.montantInvesti || 0) + montant;
    } else {
      if (montant > (ligne.solde || 0)) { showToast("Solde insuffisant"); return; }
      const ancienSolde = ligne.solde || 0;
      ligne.solde = ancienSolde - montant;
      // Au retrait, on réduit proportionnellement le montant investi (base de calcul perf simplifiée)
      const ratio = ancienSolde > 0 ? ligne.solde / ancienSolde : 0;
      ligne.montantInvesti = (ligne.montantInvesti || 0) * ratio;
    }

    saveStateToFirebase();
    showToast(opType === "depot" ? "Versement enregistré" : "Retrait enregistré");
    clearAddFormInputs();
    renderDashboard();
  }
}

function clearAddFormInputs() {
  document.getElementById("input-montant").value = "";
  document.getElementById("input-prix-achat").value = "";
  document.getElementById("input-quantite").value = "";
}

// ============================================================
// 5. GESTION DES CRÉDITS
// ============================================================

function initCreditsForm() {
  document.querySelectorAll("#credit-duree-unite .segmented-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#credit-duree-unite .segmented-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
  document.getElementById("btn-ajouter-credit").addEventListener("click", ajouterCredit);

  // Date par défaut : aujourd'hui
  const dateInput = document.getElementById("credit-date-debut");
  dateInput.value = new Date().toISOString().slice(0, 10);
}

function ajouterCredit() {
  const nom = document.getElementById("credit-nom").value.trim();
  const montant = parseFloat(document.getElementById("credit-montant").value);
  const taux = parseFloat(document.getElementById("credit-taux").value);
  const duree = parseFloat(document.getElementById("credit-duree").value);
  const uniteBtn = document.querySelector("#credit-duree-unite .segmented-btn.active");
  const unite = uniteBtn ? uniteBtn.dataset.unite : "mois";
  const dateDebut = document.getElementById("credit-date-debut").value;

  if (!nom || !montant || montant <= 0 || isNaN(taux) || taux < 0 || !duree || duree <= 0 || !dateDebut) {
    showToast("Merci de remplir tous les champs correctement");
    return;
  }

  const dureeMois = unite === "annees" ? Math.round(duree * 12) : Math.round(duree);

  const credit = {
    id: generateId(),
    nom,
    montant,
    taux,
    dureeMois,
    dateDebut,
  };

  State.credits.push(credit);
  saveStateToFirebase();
  showToast("Crédit ajouté");

  document.getElementById("credit-nom").value = "";
  document.getElementById("credit-montant").value = "";
  document.getElementById("credit-taux").value = "";
  document.getElementById("credit-duree").value = "";

  renderCreditsDetailList();
  renderDashboard();
}

function renderCreditsDetailList() {
  const container = document.getElementById("list-credits-detail");
  if (!State.credits || State.credits.length === 0) {
    container.innerHTML = `<div class="empty-row">Aucun crédit ajouté</div>`;
    return;
  }
  container.innerHTML = State.credits
    .map((c) => {
      const r = FinanceUtils.calculAmortissement(c.montant, c.taux, c.dureeMois, c.dateDebut);
      const moisRestants = c.dureeMois - r.moisEcoules;
      return `
        <div class="asset-row">
          <div class="asset-info">
            <span class="asset-name">${escapeHtml(c.nom)}</span>
            <span class="asset-sub">Emprunté ${FinanceUtils.formatEUR(c.montant)} · ${moisRestants} mois restants</span>
          </div>
          <div class="asset-values">
            <div class="asset-value perf-negative">${FinanceUtils.formatEUR(r.capitalRestant)}</div>
            <button class="btn-secondary btn-danger" style="padding:6px 10px;font-size:12px;width:auto;margin-top:4px;" data-delete-credit="${c.id}">Supprimer</button>
          </div>
        </div>`;
    })
    .join("");

  container.querySelectorAll("[data-delete-credit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      State.credits = State.credits.filter((c) => c.id !== btn.dataset.deleteCredit);
      saveStateToFirebase();
      renderCreditsDetailList();
      renderDashboard();
    });
  });
}

// ============================================================
// 6. RÉGLAGES — gestion des lignes existantes
// ============================================================

function renderManageLines() {
  const container = document.getElementById("list-manage-lines");
  if (State.lignes.length === 0) {
    container.innerHTML = `<div class="empty-row">Aucune ligne enregistrée</div>`;
    return;
  }
  container.innerHTML = State.lignes
    .map((l) => {
      const label = l.ticker ? `${l.nom} (${l.ticker})` : l.nom;
      return `
        <div class="asset-row">
          <div class="asset-info">
            <span class="asset-name">${escapeHtml(label)}</span>
            <span class="asset-sub">${envLabelOf(l.enveloppe)}</span>
          </div>
          <button class="btn-secondary btn-danger" style="padding:8px 12px;font-size:13px;width:auto;" data-delete-line="${l.id}">Supprimer</button>
        </div>`;
    })
    .join("");

  container.querySelectorAll("[data-delete-line]").forEach((btn) => {
    btn.addEventListener("click", () => {
      State.lignes = State.lignes.filter((l) => l.id !== btn.dataset.deleteLine);
      saveStateToFirebase();
      renderManageLines();
      renderDashboard();
    });
  });
}

function envLabelOf(env) {
  return { epargne: "Épargne sécurisée", av: "Assurance vie", pea: "PEA", crypto: "Crypto" }[env] || env;
}

// ============================================================
// 7. MODALE GÉNÉRIQUE
// ============================================================

let modalConfirmHandler = null;

function openModal(title, bodyHtml, onConfirm) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-body").innerHTML = bodyHtml;
  document.getElementById("modal-overlay").classList.remove("hidden");
  modalConfirmHandler = onConfirm;
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
  modalConfirmHandler = null;
}

function initModal() {
  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  document.getElementById("modal-confirm").addEventListener("click", () => {
    if (modalConfirmHandler) {
      const success = modalConfirmHandler();
      if (success !== false) closeModal();
    } else {
      closeModal();
    }
  });
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") closeModal();
  });
}

// ============================================================
// 8. TOAST
// ============================================================

let toastTimeout = null;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  requestAnimationFrame(() => toast.classList.add("visible"));
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.classList.add("hidden"), 250);
  }, 2400);
}

// ============================================================
// 9. SYNCHRONISATION FIREBASE
// ============================================================

function saveStateToFirebase() {
  if (!FirebaseService.isReady()) {
    showToast("Hors-ligne : modifications enregistrées localement");
    return;
  }
  FirebaseService.saveFullState({
    lignes: State.lignes,
    credits: State.credits,
    pin: State.pin,
  }).catch((e) => {
    console.error("Erreur de sauvegarde Firebase :", e);
    showToast("Erreur de synchronisation");
  });
}

function startFirebaseSync() {
  const success = FirebaseService.init();
  const statusEl = document.getElementById("sync-status");

  if (!success) {
    statusEl.textContent = "Firebase non configuré — vérifiez config.js";
    return;
  }

  FirebaseService.listen(
    (data) => {
      State.lignes = data.lignes || [];
      State.credits = data.credits || [];
      State.pin = data.pin || DEFAULT_PIN;
      statusEl.textContent = "Connecté — synchronisation active";
      renderDashboard();
    },
    () => {
      statusEl.textContent = "Erreur de connexion à Firebase";
    }
  );
}

// ============================================================
// 10. RAFRAÎCHISSEMENT DES COURS (API)
// ============================================================

async function refreshQuotesForState() {
  const peaLignes = State.lignes.filter((l) => l.enveloppe === "pea" && l.ticker);
  const cryptoLignes = State.lignes.filter((l) => l.enveloppe === "crypto" && l.ticker);

  // Cryptos en un seul appel groupé
  if (cryptoLignes.length > 0) {
    const symbols = [...new Set(cryptoLignes.map((l) => l.ticker))];
    const prices = await MarketAPI.getCryptoQuotesEUR(symbols);
    Object.entries(prices).forEach(([sym, price]) => {
      if (price !== null) State.quotes[sym] = price;
    });
  }

  // Actions/ETF : un appel par ticker (limite Finnhub gratuite : 60/min)
  for (const ligne of peaLignes) {
    const price = await MarketAPI.getStockQuoteEUR(ligne.ticker);
    if (price !== null) State.quotes[ligne.ticker] = price;
  }

  State.lastUpdate = new Date();
  renderDashboard();
}

function startQuoteRefreshLoop() {
  refreshQuotesForState();
  setInterval(refreshQuotesForState, REFRESH_INTERVAL_MS);
}

// ============================================================
// 11. UTILITAIRES
// ============================================================

function generateId() {
  return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

// ============================================================
// 12. INITIALISATION GÉNÉRALE
// ============================================================

function initSettingsTab() {
  document.getElementById("btn-change-pin").addEventListener("click", startChangePin);
  document.getElementById("btn-force-refresh").addEventListener("click", () => {
    showToast("Actualisation des cours…");
    refreshQuotesForState();
  });
  document.getElementById("btn-settings").addEventListener("click", () => switchTab("tab-settings"));
}

document.addEventListener("DOMContentLoaded", () => {
  initLockScreen();
  initTabNavigation();
  initAddForm();
  initCreditsForm();
  initModal();
  initSettingsTab();

  startFirebaseSync();
  startQuoteRefreshLoop();
});
