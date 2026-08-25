# ◈ PriceSense AI

> **AI-powered Indian market price intelligence.**

PriceSense AI turns product specifications into an estimated Indian market price, an expected range, confidence score and transparent AI reasoning.

## ✨ Features

- 🤖 Gemini-powered price estimation
- 🇮🇳 Indian-market INR estimates
- 📊 Estimated price range + confidence
- 🔎 Extracted product specifications
- 💡 AI reasoning and anomaly flags
- 📱 Responsive glassmorphism interface
- ⚡ Netlify Functions backend
- 🔐 API key kept server-side

## 🧠 How it works

```text
Product specifications
        ↓
Netlify Function
        ↓
Gemini
        ↓
Structured JSON validation
        ↓
Price + range + confidence + explanation
        ↓
Premium dashboard
```

## 🛠️ Tech Stack

- HTML / CSS / JavaScript
- Google Gemini via `@google/genai`
- Netlify Functions
- Modern ES Modules

## 🚀 Local development

Install dependencies:

```bash
npm install
```

Create `.env`:

```env
GEMINI_API_KEY=your_api_key_here
```

Serve the project with Netlify Dev or your preferred static server. The prediction endpoint is:

```text
/.netlify/functions/predict
```

## ☁️ Netlify deployment

1. Connect this repository to Netlify.
2. Set the environment variable `GEMINI_API_KEY`.
3. Use `netlify/functions` as the Functions directory.
4. Deploy.

## 🔐 Security

The Gemini API key is accessed only by the server-side Netlify Function. It is never embedded in frontend JavaScript.

Never commit `.env` or real API keys.

## ⚠️ Important limitation

PriceSense AI provides an **AI-based market estimate**. It does not claim to fetch or verify live Amazon/Flipkart prices unless a real live-data integration is added.

## 📁 Structure

```text
.
├── frontend/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── netlify/
│   └── functions/
│       └── predict.js
├── netlify.toml
├── package.json
├── .env.example
└── README.md
```

## 🔭 Future improvements

- Real marketplace price feeds
- Historical price charts
- Saved prediction history
- Product comparison
- More robust ML calibration using historical datasets

## 👤 Author

**Kavya Rajput**  
AI & Data Science · Generative AI · Full-Stack Development
