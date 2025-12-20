export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured on server' });
    }

    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Try multiple Gemini models
        const models = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-flash-latest', 'gemini-2.0-flash'];
        let data = null;
        let success = false;
        let lastError = null;

        for (const model of models) {
            try {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }]
                        })
                    }
                );

                data = await response.json();

                if (data.error) {
                    if (data.error.code === 429 || data.error.status === 'RESOURCE_EXHAUSTED') {
                        throw new Error('Rate limit exceeded. Please wait a moment.');
                    }
                    throw new Error(data.error.message);
                }

                success = true;
                break;
            } catch (err) {
                if (err.message.includes('Rate limit')) throw err;
                console.warn(`Model ${model} failed:`, err.message);
                lastError = err;
            }
        }

        if (!success) {
            throw lastError || new Error('All models failed');
        }

        const generatedText = data.candidates[0].content.parts[0].text;
        return res.status(200).json({ text: generatedText });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: error.message || 'Failed to generate content' });
    }
}
