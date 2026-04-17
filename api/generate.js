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
      content: `Sei un esperto Sound Designer e Live Performer. 
      
      ARCHITETTURA LIVE PERFORMANCE:
      1. LOOP (Tracce continue):
         - Crea un Tone.Channel e registralo in 'window.dinoChannels.nomeTraccia'.
         - Usa Tone.getTransport().scheduleRepeat per farli girare.
      
      2. TRIGGER (Suoni singoli da lanciare):
         - Crea una funzione che esegue un triggerAttackRelease.
         - Registra la funzione in 'window.dinoTriggers.nomeSuono'.
         - Esempio: window.dinoTriggers.snare = () => snare.triggerAttackRelease("16n");

      REGOLE DI CODICE:
      - Dividi sempre bene i Loop dai Trigger.
      - Rispondi SOLO con codice JS, NO markdown.`
    },
    ...history,
    {
      role: "user",
      content: `Codice attuale:\n${currentCode}\n\nRichiesta utente:\n${prompt}`
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
    res.status(500).json({ error: "Errore" });
  }
}
