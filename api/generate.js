export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, currentCode } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Chiave API Groq non configurata su Vercel' });
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: `Sei un programmatore esperto di musica generativa con Tone.js. 
            Il tuo compito è restituire ESCLUSIVAMENTE codice JavaScript che verrà eseguito via new Function('Tone', code).
            
            REGOLE CRITICHE:
            1. Rispondi SOLO con il codice JS grezzo. 
            2. NON usare mai i backtick (es. \`\`\`javascript). Se li usi, il codice fallirà.
            3. NON aggiungere commenti discorsivi o spiegazioni.
            4. NON usare 'import', 'require' o 'const Tone = ...'. Usa direttamente l'oggetto 'Tone' globale fornito.
            5. Includi Tone.getTransport().start() per avviare la riproduzione.
            6. Mantieni il codice pulito e compatibile con Tone.js r14+.`
          },
          {
            role: "user",
            content: `Codice attuale:\n${currentCode}\n\nIstruzione:\n${prompt}`
          }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.5,
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq API Error Details:", data);
      return res.status(response.status).json({ 
        error: data.error?.message || "Errore nella comunicazione con Groq" 
      });
    }

    let generatedCode = data.choices[0]?.message?.content || "";
    
    // Pulizia aggressiva post-generazione (fallback)
    generatedCode = generatedCode.replace(/```javascript/g, "");
    generatedCode = generatedCode.replace(/```/g, "");
    generatedCode = generatedCode.trim();

    res.status(200).json({ code: generatedCode });
  } catch (error) {
    console.error("Fetch Error:", error);
    res.status(500).json({ error: "Errore di rete nell'integrazione IA" });
  }
}
