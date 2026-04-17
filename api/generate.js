export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, currentCode } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Chiave API Groq non configurata correttamente su Vercel' });
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
            content: `Sei un esperto programmatore di musica generativa usando Tone.js. 
            Il tuo compito è modificare o generare codice JavaScript per creare musica.
            
            REGOLE RIGOROSE:
            1. Rispondi SOLO con il codice JavaScript. 
            2. NON aggiungere spiegazioni, commenti esterni o blocchi di testo.
            3. NON usare i backtick del markdown (\`\`\`javascript).
            4. Assicurati che il codice includa sempre l'avvio del trasporto (Tone.getTransport().start()) se necessario.
            5. Il codice deve essere pronto per essere eseguito via 'new Function()'.
            6. Usa variabili e sintassi moderne (ES6+).`
          },
          {
            role: "user",
            content: `Codice attuale:\n${currentCode}\n\nIstruzione di modifica:\n${prompt}`
          }
        ],
        model: "llama3-8b-8192",
        temperature: 0.7,
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq API Error:", data);
      return res.status(response.status).json({ 
        error: data.error?.message || "Errore nella comunicazione con Groq" 
      });
    }

    let generatedCode = data.choices[0]?.message?.content || "";
    
    // Pulizia di emergenza se l'IA ignora le istruzioni sui backtick
    generatedCode = generatedCode.replace(/```javascript/g, "").replace(/```/g, "").trim();

    res.status(200).json({ code: generatedCode });
  } catch (error) {
    console.error("Fetch Error:", error);
    res.status(500).json({ error: "Errore di rete o timeout nella chiamata all'IA" });
  }
}
