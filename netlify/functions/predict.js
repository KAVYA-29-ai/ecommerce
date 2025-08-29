const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    try {
        // Handle preflight OPTIONS request
        if (event.httpMethod === "OPTIONS") {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ message: "CORS preflight" })
            };
        }

        // Only allow POST
        if (event.httpMethod !== "POST") {
            return {
                statusCode: 405,
                headers,
                body: JSON.stringify({ error: "Method Not Allowed" })
            };
        }

        // Parse request body
        let body;
        try {
            body = JSON.parse(event.body || "{}");
        } catch (e) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "Invalid JSON in request body" })
            };
        }

        const { specs } = body;

        // Validate specs
        if (!specs || typeof specs !== 'string' || specs.trim() === "") {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: "Product specifications are required and must be a non-empty string" 
                })
            };
        }

        // Get API key
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("GEMINI_API_KEY not found");
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Server configuration error" })
            };
        }

        // Gemini API call
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{
                parts: [{
                    text: `You are an Indian market price analyst. Predict the current market price in India for: "${specs.trim()}"

Respond with ONLY valid JSON in this exact format:
{
    "predicted_price_inr": 50000,
    "range_inr": {"min": 45000, "max": 55000},
    "confidence": 0.8,
    "product": "Product Name",
    "category": "Electronics",
    "specs_extracted": {"key": "value"},
    "explanation_bullets": ["Point 1", "Point 2", "Point 3"],
    "anomalies": [],
    "market_sources": ["Amazon India", "Flipkart"],
    "last_updated": "${new Date().toISOString()}"
}`
                }]
            }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 2048,
                responseMimeType: "application/json"
            }
        };

        console.log("Making Gemini API request...");
        
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error("Gemini API error:", response.status, response.statusText);
            return {
                statusCode: response.status,
                headers,
                body: JSON.stringify({ 
                    error: "AI service error",
                    details: `HTTP ${response.status}`
                })
            };
        }

        const aiData = await response.json();
        const generatedText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            console.error("No response from Gemini");
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "No AI response generated" })
            };
        }

        // Parse AI response
        let result;
        try {
            result = JSON.parse(generatedText);
        } catch (e) {
            console.error("JSON parse error:", e);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: "Invalid AI response format",
                    raw_response: generatedText.substring(0, 200)
                })
            };
        }

        console.log("Successful prediction:", result.product);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error("Function error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: "Internal server error",
                message: error.message
            })
        };
    }
};
