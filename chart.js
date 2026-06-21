/**
 * ============================================================
 *  CHART (Pie Chart natif Canvas)
 *  Pas de dépendance externe : un canvas suffit pour ce besoin
 *  et reste totalement fonctionnel en PWA hors-ligne.
 * ============================================================
 */

const PieChart = (() => {

  const COLORS = {
    epargne: "#30D158",
    av: "#0A84FF",
    pea: "#FF9F0A",
    crypto: "#BF5AF2",
  };

  const LABELS = {
    epargne: "Épargne sécurisée",
    av: "Assurance vie",
    pea: "PEA",
    crypto: "Crypto",
  };

  /**
   * @param {string} canvasId
   * @param {Object} valuesByEnveloppe - ex: { epargne: 1200, av: 5000, pea: 3000, crypto: 800 }
   * @param {string} legendContainerId
   */
  function render(canvasId, valuesByEnveloppe, legendContainerId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const size = 240;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const entries = Object.entries(valuesByEnveloppe).filter(([, v]) => v > 0);
    const total = entries.reduce((sum, [, v]) => sum + v, 0);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 6;
    const innerRadius = radius * 0.62; // effet "donut" plus iOS

    if (total <= 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = "#2C2C2E";
      ctx.fill();
      renderLegend(legendContainerId, []);
      renderCenterLabel(ctx, cx, cy, "0,00 €");
      return;
    }

    let startAngle = -Math.PI / 2;
    entries.forEach(([key, value]) => {
      const sliceAngle = (value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = COLORS[key] || "#8E8E93";
      ctx.fill();
      startAngle += sliceAngle;
    });

    // Trou central (effet donut)
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#1C1C1E";
    ctx.fill();

    renderCenterLabel(ctx, cx, cy, FinanceUtils.formatEUR(total));

    renderLegend(
      legendContainerId,
      entries.map(([key, value]) => ({
        key,
        label: LABELS[key] || key,
        value,
        pct: (value / total) * 100,
        color: COLORS[key] || "#8E8E93",
      }))
    );
  }

  function renderCenterLabel(ctx, cx, cy, text) {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "600 15px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, cy);
  }

  function renderLegend(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (items.length === 0) {
      container.innerHTML = `<span class="legend-item">Aucune donnée pour le moment</span>`;
      return;
    }
    container.innerHTML = items
      .map(
        (item) => `
        <div class="legend-item">
          <span class="legend-dot" style="background:${item.color}"></span>
          <span>${item.label} · ${item.pct.toFixed(0)}%</span>
        </div>`
      )
      .join("");
  }

  return { render };
})();
