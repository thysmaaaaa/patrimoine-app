/**
 * ============================================================
 *  MARKET API SERVICE
 *  - Finnhub : cours actions / ETF (PEA)
 *  - CoinGecko : cours cryptomonnaies (BTC, SOL, ETH)
 *  - exchangerate.host : taux de change USD -> EUR
 *
 *  Tous les cours exposés par ce module sont retournés en EUR.
 *  Un cache mémoire évite les appels redondants entre deux
 *  rafraîchissements.
 * ============================================================
 */

const MarketAPI = (() => {
  const cache = {
    usdToEur: null,
    usdToEurFetchedAt: 0,
    quotes: {}, // ticker -> { price, currency, fetchedAt }
  };

  const COINGECKO_IDS = {
    BTC: "bitcoin",
    SOL: "solana",
    ETH: "ethereum",
  };

  // ---------------------------------------------------------
  // Taux de change USD -> EUR
  // ---------------------------------------------------------
  async function getUsdToEurRate() {
    const now = Date.now();
    // On ne rafraîchit le taux qu'une fois par heure max
    if (cache.usdToEur && now - cache.usdToEurFetchedAt < 60 * 60 * 1000) {
      return cache.usdToEur;
    }
    try {
      const res = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=EUR");
      const json = await res.json();
      const rate = json?.rates?.EUR;
      if (typeof rate === "number" && rate > 0) {
        cache.usdToEur = rate;
        cache.usdToEurFetchedAt = now;
        return rate;
      }
      throw new Error("Réponse de taux de change invalide");
    } catch (e) {
      console.warn("Taux de change indisponible, utilisation du fallback :", e);
      return FALLBACK_USD_EUR_RATE;
    }
  }

  // ---------------------------------------------------------
  // Finnhub — actions / ETF (PEA)
  // ---------------------------------------------------------
  async function getStockQuoteEUR(ticker) {
    try {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${FINNHUB_API_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      // Finnhub renvoie "c" = current price, en USD pour la plupart des tickers US.
      // Pour les tickers européens en EUR natif (ex: suffixe .PA), Finnhub renvoie
      // déjà la devise locale — on ne reconvertit donc que si nécessaire.
      if (typeof json.c !== "number" || json.c === 0) {
        throw new Error("Cours introuvable pour " + ticker);
      }
      const isEuropean = /\.(PA|AS|DE|MI|BR|MC|L)$/i.test(ticker);
      let priceEUR = json.c;
      if (!isEuropean) {
        const rate = await getUsdToEurRate();
        priceEUR = json.c * rate;
      }
      cache.quotes[ticker] = { price: priceEUR, fetchedAt: Date.now() };
      return priceEUR;
    } catch (e) {
      console.error(`Erreur Finnhub pour ${ticker} :`, e);
      return cache.quotes[ticker]?.price ?? null;
    }
  }

  // ---------------------------------------------------------
  // CoinGecko — cryptomonnaies
  // ---------------------------------------------------------
  async function getCryptoQuotesEUR(symbols) {
    // symbols ex: ["BTC", "SOL", "ETH"]
    const ids = symbols
      .map((s) => COINGECKO_IDS[s.toUpperCase()])
      .filter(Boolean);
    if (ids.length === 0) return {};

    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(
        ","
      )}&vs_currencies=eur`;
      const res = await fetch(url);
      const json = await res.json();

      const result = {};
      for (const symbol of symbols) {
        const id = COINGECKO_IDS[symbol.toUpperCase()];
        const price = json[id]?.eur;
        if (typeof price === "number") {
          result[symbol.toUpperCase()] = price;
          cache.quotes[symbol.toUpperCase()] = { price, fetchedAt: Date.now() };
        } else {
          result[symbol.toUpperCase()] = cache.quotes[symbol.toUpperCase()]?.price ?? null;
        }
      }
      return result;
    } catch (e) {
      console.error("Erreur CoinGecko :", e);
      // fallback sur cache
      const result = {};
      for (const symbol of symbols) {
        result[symbol.toUpperCase()] = cache.quotes[symbol.toUpperCase()]?.price ?? null;
      }
      return result;
    }
  }

  function getCachedPrice(ticker) {
    return cache.quotes[ticker]?.price ?? null;
  }

  return {
    getUsdToEurRate,
    getStockQuoteEUR,
    getCryptoQuotesEUR,
    getCachedPrice,
    SUPPORTED_CRYPTO: Object.keys(COINGECKO_IDS),
  };
})();
