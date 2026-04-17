export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, currentCode, history = [] } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Chiave API Groq non configurata' });
  }

  const messages = [
    {
      role: "system",
      content: `Sei un Senior Sound Designer. Genera codice Tone.js di alta qualità.
      
      NUOVA REGOLA CRITICA PER IL MIXER:
      1. Registra OGNI strumento/synth creato nell'oggetto 'Tone.channels' usando un nome breve.
         Esempio: 
         const bass = new Tone.MonoSynth().toDestination();
         Tone.channels.bass = bass; // REGISTRAZIONE OBBLIGATORIA
         
      2. Usa nomi chiari per le tracce: 'kick', 'bass', 'lead', 'pads', 'perc'.
      3. Mantieni la catena di effetti ma registra l'ultimo nodo prima della destinazione se possibile, o lo strumento stesso.
      4. Quando modifichi il codice, mantieni la struttura dei canali esistenti se l'utente non chiede di rimuoverli.
      
      REGOLE DI CODICE:
      - SOLO codice JS, NO markdown, NO commenti.
      - Termina sempre con Tone.getTransport().start().`
    },
    ...history,
    {
      role: "user",
      content: `Codice attuale:\n${currentCode}\n\nIstruzione:\n${prompt}`
    }
  ];

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: messages,
        model: "llama-3.3-70b-versatile",
        temperature: 0.6,
      })
    });

    const data = await response.json();
    let generatedCode = data.choices[0]?.message?.content || "";
    generatedCode = generatedCode.replace(/```javascript/g, "").replace(/```/g, "").trim();
    res.status(200).json({ code: generatedCode });
  } catch (error) {
    res.status(500).json({ error: "Errore di rete" });
  }
}
