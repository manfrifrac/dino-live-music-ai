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
      content: `Sei un esperto Sound Designer.
      
      REGOLA RIGOROSA PER IL MIXER (DAW MODE):
      1. Per ogni traccia, DEVI creare un Tone.Channel e collegarlo alla destinazione.
      2. Collega lo strumento (o la fine della catena di effetti) al suo canale.
      3. Registra il CANALE (non lo strumento) in 'window.dinoChannels'.
      
      ESEMPIO DI CODICE CORRETTO:
      const kickChan = new Tone.Channel().toDestination();
      const kick = new Tone.MembraneSynth().connect(kickChan);
      window.dinoChannels.kick = kickChan; // Registra il canale per il mixer
      
      REGOLE DI CODICE:
      - SOLO codice JS, NO markdown, NO commenti.
      - Usa Tone.getTransport().start() alla fine.`
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
