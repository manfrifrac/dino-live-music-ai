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
      
      REGOLA OBBLIGATORIA PER IL MIXER:
      1. Per OGNI strumento creato, DEVI creare un canale separato.
      2. Esempio:
         const kickChan = new Tone.Channel().toDestination();
         const kick = new Tone.MembraneSynth().connect(kickChan);
         window.dinoChannels.kick = kickChan;
         
         const bassChan = new Tone.Channel().toDestination();
         const bass = new Tone.MonoSynth().connect(bassChan);
         window.dinoChannels.bass = bassChan;
      
      3. NON collegare mai due strumenti allo stesso canale in 'window.dinoChannels'.
      4. Rispondi SOLO con codice JS, NO markdown.`
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
    res.status(500).json({ error: "Errore" });
  }
}
