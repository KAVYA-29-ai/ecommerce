import { GoogleGenAI } from "@google/genai";

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

const json = (statusCode, body) => ({
  statusCode,
  headers,
  body: JSON.stringify(body)
});

const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);

export default async (event) => {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." });

  try {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "Invalid JSON request body." });
    }

    const specs = typeof body.specs === "string" ? body.specs.trim() : "";
    if (!specs) return json(400, { error: "Product specifications are required." });
    if (specs.length > 2000) return json(400, { error: "Specifications must be 2000 characters or fewer." });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return json(500, { error: "Server is missing GEMINI_API_KEY." });

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are an expert Indian market price analyst. Estimate the current Indian market price for this product based only on the supplied specifications. Do not claim live browsing or real-time marketplace access.

Product specifications:
${specs}

Return ONLY valid JSON with this shape:
{
  "product": "clean product name",
  "category": "category",
  "predicted_price_inr": 0,
  "range_inr": { "min": 0, "max": 0 },
  "confidence": 0.0,
  "specs_extracted": { "brand": "", "model": "", "key_specs": [] },
  "explanation_bullets": [],
  "anomalies": [],
  "market_sources": [],
  "last_updated": ""
}

Rules:
- All prices must be positive INR numbers.
- confidence must be between 0 and 1.
- min <= predicted_price_inr <= max.
- market_sources must describe reference categories only; never invent a checked live price.
- last_updated must be an ISO timestamp.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        maxOutputTokens: 1800
      }
    });

    const text = response.text?.trim();
    if (!text) return json(502, { error: "The AI model returned no prediction." });

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      return json(502, { error: "The AI returned an invalid prediction format." });
    }

    const predicted = Number(result.predicted_price_inr);
    const min = Number(result.range_inr?.min);
    const max = Number(result.range_inr?.max);
    const confidence = clamp(result.confidence, 0, 1);

    if (!result.product || !Number.isFinite(predicted) || predicted <= 0 || !Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min || predicted < min || predicted > max) {
      return json(502, { error: "The AI returned an invalid price estimate." });
    }

    return json(200, {
      product: String(result.product).slice(0, 160),
      category: String(result.category || "Uncategorized").slice(0, 100),
      predicted_price_inr: Math.round(predicted),
      range_inr: { min: Math.round(min), max: Math.round(max) },
      confidence,
      specs_extracted: result.specs_extracted || {},
      explanation_bullets: Array.isArray(result.explanation_bullets) ? result.explanation_bullets.slice(0, 6) : [],
      anomalies: Array.isArray(result.anomalies) ? result.anomalies.slice(0, 6) : [],
      market_sources: Array.isArray(result.market_sources) ? result.market_sources.slice(0, 5) : [],
      last_updated: result.last_updated || new Date().toISOString()
    });
  } catch (error) {
    console.error("Prediction function failed:", error?.message || error);
    const status = error?.status === 429 ? 429 : 500;
    return json(status, {
      error: status === 429 ? "Too many AI requests. Please try again shortly." : "Unable to generate a prediction right now."
    });
  }
};
