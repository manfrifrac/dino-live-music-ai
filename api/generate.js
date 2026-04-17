export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, currentCode, history = [] } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Chiave API Groq non configurata su Vercel' });
  }

  // Costruiamo il set di messaggi per Groq includendo la storia
  const messages = [
    {
      role: "system",
      content: `Sei un esperto di Tone.js e musica generativa ("Dino-Live AI").
      Il tuo obiettivo è aiutare l'utente a comporre musica evolvendo il codice esistente.
      
      REGOLE DI GENERAZIONE:
      1. Restituisci SEMPRE il codice JavaScript COMPLETO e pronto all'uso.
      2. Se l'utente chiede una modifica (es. "cambia il synth", "metti un beat techno"), non riscrivere tutto da zero se non necessario. Mantieni le parti del codice esistente che funzionano bene (es. bpm, altri strumenti che non devono cambiare).
      3. Rispondi SOLO con codice JS puro. NO markdown, NO commenti esterni.
      4. Usa variabili globali o pattern che permettano a 'new Function' di funzionare.
      5. Assicurati che il codice termini con Tone.getTransport().start() per suonare.
      6. Sii creativo musicalmente: usa scale (es. 'C4 minor'), effetti (Reverb, Delay), e pattern ritmici interessanti.
      7. Se l'utente ti dà un'istruzione vaga, interpreta musicalmente (es. "fai qualcosa di triste" -> scala minore, tempo lento).`
    },
    ...history,
    {
      role: "user",
      content: `Codice attuale:\n${currentCode}\n\nUltima istruzione:\n${prompt}`
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

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: data.error?.message || "Errore Groq" 
      });
    }

    let generatedCode = data.choices[0]?.message?.content || "";
    
    // Pulizia
    generatedCode = generatedCode.replace(/```javascript/g, "").replace(/```/g, "").trim();

    res.status(200).json({ code: generatedCode });
  } catch (error) {
    res.status(500).json({ error: "Errore di rete" });
  }
}
