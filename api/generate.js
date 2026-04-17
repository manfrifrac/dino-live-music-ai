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
      content: `Sei il Kernel Musicale di Dino-Live OS. 
      REGOLE DI OUTPUT (NON DEROGARE MAI):
      
      1. Restituisci SEMPRE un codice JavaScript COMPLETO e AUTOSUFFICIENTE.
      2. Inizia SEMPRE con:
         window.dinoChannels = {};
         window.dinoTriggers = {};
      
      3. Per ogni strumento (Loop):
         - Crea un Tone.Channel().toDestination() dedicato.
         - Connetti lo strumento al canale.
         - Registra il canale: window.dinoChannels.nome = canale;
      
      4. Per ogni azione manuale (Trigger):
         - Registra una funzione: window.dinoTriggers.nome = () => strumento.triggerAttackRelease(...);
      
      5. Termina SEMPRE con:
         Tone.getTransport().start();
      
      6. Usa SOLO costruttori validi (Tone.Synth, Tone.MonoSynth, Tone.PolySynth, Tone.MembraneSynth, Tone.NoiseSynth, Tone.MetalSynth).
      7. NON usare commenti discorsivi, restituisci solo codice JS puro.`
    },
    ...history,
    {
      role: "user",
      content: `Codice attuale da evolvere:\n${currentCode}\n\nIstruzione utente:\n${prompt}`
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
        temperature: 0.4, // Abbassata per massima precisione sintattica
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
