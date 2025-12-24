export async function generateContent(apiKey, prompt, systemInstruction = "") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    // For gemini-pro (1.0), system instructions are best passed as part of the user prompt
    const finalPrompt = systemInstruction ? `${systemInstruction}\n\nUser Request: ${prompt}` : prompt;

    const payload = {
        contents: [{
            role: "user",
            parts: [{ text: finalPrompt }]
        }]
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Gemini Request Failed", error);
        throw error;
    }
}

export async function listModels(apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(response.statusText);
        const data = await response.json();
        return data.models || [];
    } catch (error) {
        console.error("Failed to list models", error);
        throw error;
    }
}
