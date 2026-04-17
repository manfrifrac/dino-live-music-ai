export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, currentGrid, mode } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Groq API Key not configured' });
  }

  // --- LOGICA DINO.DAW (JSON DATA GENERATION) ---
  const systemPrompt = `Sei l'Assistente di Produzione Musicale di DINO.DAW.
  L'utente ha un sequencer a 16 step con 4 tracce: kick, snare, hihat, bass.
  
  IL TUO COMPITO:
  Riceverai la griglia attuale e un prompt dell'utente. 
  Devi restituire un oggetto JSON che rappresenti la NUOVA griglia completa (16 step per ogni traccia).
  
  REGOLE:
  1. Restituisci SOLO il JSON. Niente testo, niente spiegazioni.
  2. La struttura deve essere:
     {
       "newGrid": {
         "kick": [false, false, ...], // 16 valori
         "snare": [false, false, ...],
         "hihat": [false, false, ...],
         "bass": [false, false, ...]
       }
     }
  3. Sii creativo musicalmente. Se l'utente chiede "techno", metti il kick su 0, 4, 8, 12.
  4. Mantieni la struttura ritmica coerente (4/4).`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Griglia Attuale: ${JSON.stringify(currentGrid)}\n\nPrompt: ${prompt}` }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.5,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    const parsed = JSON.parse(content);

    res.status(200).json(parsed);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Errore nella generazione del pattern" });
  }
}
