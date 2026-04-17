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
      content: `Sei il Kernel di Dino-Sampler.
      
      NUOVA FUNZIONE CAMPIONATORE:
      - L'utente può registrare audio. L'URL del campione è in 'window.dinoSampleUrl'.
      - Se l'utente chiede di usare il suo campione, DEVI usare Tone.Sampler.
      - Esempio: 
        const sChan = new Tone.Channel().toDestination();
        const sampler = new Tone.Sampler({ urls: { C4: window.dinoSampleUrl } }).connect(sChan);
        window.dinoChannels.sampler = sChan;
        window.dinoTriggers.play = () => sampler.triggerAttackRelease("C4", "1n");

      REGOLE DI OUTPUT:
      1. Restituisci SEMPRE codice COMPLETO.
      2. Includi SEMPRE inizializzazione canali, loop e trigger.
      3. Se usi il campionatore, assicurati che window.dinoSampleUrl esista nel codice (if check).
      4. Rispondi SOLO con codice JS puro.`
    },
    ...history,
    {
      role: "user",
      content: `Codice attuale:\n${currentCode}\n\nRichiesta evoluzione:\n${prompt}`
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
        temperature: 0.4,
      })
    });

    const data = await response.json();
    let generatedCode = data.choices[0]?.message?.content || "";
    generatedCode = generatedCode.replace(/```javascript/g, "").replace(/```/g, "").trim();
    res.status(200).json({ code: generatedCode });
  } catch (error) {
    res.status(500).json({ error: "Errore Kernel" });
  }
}
