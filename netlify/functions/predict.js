// ==============================
// Netlify Function - Enhanced Indian Price Predictor
// ==============================

import fetch from "node-fetch";

export async function handler(event) {
    // CORS headers for all responses
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

        // Only allow POST requests
        if (event.httpMethod !== "POST") {
            return {
                statusCode: 405,
                headers,
                body: JSON.stringify({ 
                    error: "Method Not Allowed. Only POST requests are supported.",
                    allowedMethods: ["POST"]
                })
            };
        }

        // Parse and validate request body
        let requestBody;
        try {
            requestBody = JSON.parse(event.body || "{}");
        } catch (parseError) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: "Invalid JSON in request body.",
                    details: parseError.message 
                })
            };
        }

        const { specs } = requestBody;

        // Validate input
        if (!specs || typeof specs !== 'string' || specs.trim() === "") {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: "Product specifications are required and must be a non-empty string.",
                    example: "iPhone 15 Pro 256GB used condition"
                })
            };
        }

        // Check specs length (reasonable limits)
        if (specs.trim().length > 2000) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: "Product specifications are too long. Please limit to 2000 characters."
                })
            };
        }

        // Get Gemini API key from environment
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("GEMINI_API_KEY not found in environment variables");
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: "Server configuration error. API key not available.",
                    code: "MISSING_API_KEY"
                })
            };
        }

        // Gemini API endpoint
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

        // Enhanced system instruction for Indian market
        const systemInstruction = {
            parts: [{
                text: `You are an expert Indian market analyst and price prediction specialist. Your job is to:

1. Analyze product specifications for Indian market pricing
2. Research current prices from major Indian e-commerce platforms (Amazon India, Flipkart, Myntra, etc.)
3. Consider factors like:
   - Product condition (new, used, refurbished)
   - Brand reputation in India
   - Local demand and supply
   - Seasonal pricing variations
   - Import duties and taxes (GST)
   - Currency fluctuations (USD to INR)
   - Regional pricing differences

IMPORTANT INSTRUCTIONS:
- Always respond with ONLY valid JSON
- Prices must be in Indian Rupees (INR)
- Consider Indian market conditions specifically
- If the product seems unusual or specs are unclear, mention it in anomalies
- Provide realistic price ranges based on actual Indian market data
- Include confidence score based on data availability

Use Google Search tool to find current Indian market prices when possible.`
            }]
        };

        // User query with enhanced context
        const userQuery = {
            parts: [{
                text: `Predict the current market price in India for this product: "${specs.trim()}"

Please analyze:
- Current Indian market prices
- Product availability in India
- Brand positioning and demand
- Condition-based pricing variations
- Seasonal factors if applicable

Provide a comprehensive price prediction with detailed analysis.`
            }]
        };

        // Enhanced payload with tools
        const payload = {
            contents: [userQuery],
            tools: [{ 
                googleSearchRetrieval: {
                    dynamicRetrievalConfig: {
                        mode: "DYNAMIC",
                        dynamicThreshold: 0.7
                    }
                }
            }],
            systemInstruction: systemInstruction,
            generationConfig: {
                temperature: 0.3,
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 2048,
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        predicted_price_inr: { 
                            type: "NUMBER",
                            description: "Main predicted price in Indian Rupees"
                        },
                        range_inr: {
                            type: "OBJECT",
                            properties: {
                                min: { type: "NUMBER", description: "Minimum expected price" },
                                max: { type: "NUMBER", description: "Maximum expected price" }
                            },
                            required: ["min", "max"]
                        },
                        confidence: { 
                            type: "NUMBER",
                            description: "Confidence score between 0 and 1",
                            minimum: 0,
                            maximum: 1
                        },
                        product: { 
                            type: "STRING",
                            description: "Clean product name" 
                        },
                        category: { 
                            type: "STRING",
                            description: "Product category" 
                        },
                        specs_extracted: {
                            type: "OBJECT",
                            description: "Key specifications extracted",
                            additionalProperties: { type: "STRING" }
                        },
                        explanation_bullets: {
                            type: "ARRAY",
                            items: { type: "STRING" },
                            description: "Detailed explanation points",
                            minItems: 3,
                            maxItems: 8
                        },
                        anomalies: {
                            type: "ARRAY",
                            items: { type: "STRING" },
                            description: "Potential issues or unusual factors"
                        },
                        market_sources: {
                            type: "ARRAY",
                            items: { type: "STRING" },
                            description: "Indian market sources used for analysis"
                        },
                        last_updated: {
                            type: "STRING",
                            description: "Timestamp of analysis"
                        }
                    },
                    required: [
                        "predicted_price_inr",
                        "range_inr", 
                        "confidence",
                        "product",
                        "category",
                        "specs_extracted",
                        "explanation_bullets",
                        "anomalies",
                        "market_sources",
                        "last_updated"
                    ]
                }
            }
        };

        // Make request to Gemini API
        console.log(`Making prediction request for: ${specs.substring(0, 100)}...`);
        
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "User-Agent": "PriceSense-AI/1.0"
            },
            body: JSON.stringify(payload)
        });

        // Handle API response
        if (!response.ok) {
            let errorDetails;
            try {
                errorDetails = await response.json();
            } catch {
                errorDetails = { message: response.statusText };
            }

            console.error("Gemini API error:", {
                status: response.status,
                statusText: response.statusText,
                details: errorDetails
            });

            // Return user-friendly error messages
            let userMessage = "AI service temporarily unavailable. Please try again.";
            if (response.status === 429) {
                userMessage = "Too many requests. Please wait a moment and try again.";
            } else if (response.status === 403) {
                userMessage = "API access restricted. Please contact support.";
            }

            return {
                statusCode: response.status,
                headers,
                body: JSON.stringify({ 
                    error: userMessage,
                    code: `GEMINI_${response.status}`,
                    details: errorDetails?.error?.message || response.statusText
                })
            };
        }

        // Parse AI response
        const aiData = await response.json();
        const generatedText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            console.error("No generated text from Gemini:", aiData);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: "AI model did not generate a response. Please try with different product specifications.",
                    code: "NO_AI_RESPONSE"
                })
            };
        }

        // Parse JSON response
        let result;
        try {
            result = JSON.parse(generatedText);
            
            // Add timestamp if not present
            if (!result.last_updated) {
                result.last_updated = new Date().toISOString();
            }

            // Validate critical fields
            if (!result.predicted_price_inr || !result.range_inr || !result.product) {
                throw new Error("Missing required fields in AI response");
            }

            // Ensure reasonable price ranges
            if (result.predicted_price_inr < 0 || result.range_inr.min < 0 || result.range_inr.max < 0) {
                throw new Error("Invalid negative prices in AI response");
            }

            console.log(`Successful prediction for: ${result.product} - ₹${result.predicted_price_inr}`);

        } catch (parseError) {
            console.error("JSON parsing error:", parseError, "Raw response:", generatedText);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: "AI response format error. Please try again with clearer product specifications.",
                    code: "INVALID_AI_JSON",
                    details: parseError.message
                })
            };
        }

        // Return successful prediction
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };

    } catch (error) {
        // Log error for debugging
        console.error("Predict function error:", {
            message: error.message,
            stack: error.stack,
            event: {
                httpMethod: event.httpMethod,
                headers: event.headers,
                body: event.body?.substring(0, 200) + "..." // Don't log full body
            }
        });

        // Return generic error to user
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: "Internal server error. Please try again later.",
                code: "SERVER_ERROR",
                timestamp: new Date().toISOString()
            })
        };
    }
}
