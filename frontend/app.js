class PriceSenseAI {
  constructor() {
    this.form = document.getElementById("inputForm");
    this.input = document.getElementById("specsInput");
    this.button = document.getElementById("predictBtn");
    this.loading = document.getElementById("loadingSection");
    this.loadingText = document.getElementById("loadingText");
    this.error = document.getElementById("errorSection");
    this.errorMessage = document.getElementById("errorMessage");
    this.empty = document.getElementById("emptyState");
    this.results = document.getElementById("resultsSection");
    this.charCount = document.getElementById("charCount");
    this.messages = ["Extracting specifications", "Analyzing product signals", "Estimating Indian market range", "Preparing transparent reasoning"];
    this.timer = null;
    this.bind();
  }

  bind() {
    this.form.addEventListener("submit", (e) => { e.preventDefault(); this.predict(); });
    this.input.addEventListener("input", () => { this.charCount.textContent = this.input.value.length; });
    document.querySelectorAll("[data-example]").forEach((button) => {
      button.addEventListener("click", () => { this.input.value = button.dataset.example; this.input.dispatchEvent(new Event("input")); this.input.focus(); });
    });
    document.getElementById("retryBtn").addEventListener("click", () => this.predict());
  }

  setLoading(active) {
    this.button.disabled = active;
    this.button.innerHTML = active ? "<span>Analyzing...</span>" : "✦ Analyze price <span>→</span>";
    this.loading.classList.toggle("hidden", !active);
    if (active) {
      let i = 0;
      this.loadingText.textContent = this.messages[0];
      this.timer = setInterval(() => { i = (i + 1) % this.messages.length; this.loadingText.textContent = this.messages[i]; }, 900);
    } else if (this.timer) {
      clearInterval(this.timer); this.timer = null;
    }
  }

  showError(message) {
    this.errorMessage.textContent = message;
    this.error.classList.remove("hidden");
    this.empty.classList.add("hidden");
  }

  async predict() {
    const specs = this.input.value.trim();
    this.error.classList.add("hidden");
    if (!specs) return this.showError("Enter product specifications first.");

    this.empty.classList.add("hidden");
    this.results.classList.add("hidden");
    this.setLoading(true);

    try {
      const response = await fetch("/.netlify/functions/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ specs })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      this.render(data);
    } catch (error) {
      this.showError(error.message || "Unable to generate a prediction.");
    } finally {
      this.setLoading(false);
    }
  }

  money(value) { return `₹${Number(value || 0).toLocaleString("en-IN")}`; }
  esc(value) { const el = document.createElement("span"); el.textContent = String(value ?? ""); return el.innerHTML; }

  render(data) {
    const confidence = Math.round(Number(data.confidence || 0) * 100);
    const rangeWidth = Math.max(8, Math.min(100, ((data.range_inr.max - data.range_inr.min) / Math.max(data.predicted_price_inr, 1)) * 100));
    const bullets = (data.explanation_bullets || []).map((x) => `<li>${this.esc(x)}</li>`).join("");
    const anomalies = (data.anomalies || []).map((x) => `<span class="tag warning">${this.esc(x)}</span>`).join("");
    const specs = Object.entries(data.specs_extracted || {}).map(([key, value]) => `<div><span>${this.esc(key.replaceAll("_", " "))}</span><strong>${this.esc(Array.isArray(value) ? value.join(", ") : value)}</strong></div>`).join("");

    this.results.innerHTML = `
      <div class="price-hero">
        <div><span class="eyebrow">ESTIMATED MARKET PRICE</span><div class="price">${this.money(data.predicted_price_inr)}</div><p>${this.esc(data.product)} · ${this.esc(data.category)}</p></div>
        <div class="confidence"><div class="ring" style="--value:${confidence * 3.6}deg"><span>${confidence}%</span></div><small>confidence</small></div>
      </div>
      <div class="range-box"><div class="range-label"><span>Estimated range</span><strong>${this.money(data.range_inr.min)} — ${this.money(data.range_inr.max)}</strong></div><div class="range-track"><i style="width:${rangeWidth}%"></i></div></div>
      <div class="insight-grid">
        <article><span class="eyebrow">AI REASONING</span><ul>${bullets || "<li>No explanation returned.</li>"}</ul></article>
        <article><span class="eyebrow">SPECIFICATIONS</span><div class="specs">${specs || "<div><span>Input</span><strong>See your description</strong></div>"}</div></article>
      </div>
      <div class="bottom-row"><div><span class="eyebrow">FLAGS</span><div class="tags">${anomalies || '<span class="tag good">No major anomalies</span>'}</div></div><small>Updated ${this.esc(new Date(data.last_updated || Date.now()).toLocaleString("en-IN"))}</small></div>
    `;
    this.results.classList.remove("hidden");
  }
}

document.addEventListener("DOMContentLoaded", () => new PriceSenseAI());
