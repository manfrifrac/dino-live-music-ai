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
      content: `Sei un esperto programmatore di Tone.js (Dino-Live OS).
      
      DICTIONARY DEGLI STRUMENTI VALIDI (USA SOLO QUESTI):
      - Sintetizzatori: Tone.Synth, Tone.MonoSynth, Tone.PolySynth, Tone.MembraneSynth (per Kick), Tone.MetalSynth (per piatti), Tone.NoiseSynth (per snare/hi-hats), Tone.PluckSynth, Tone.AMSynth, Tone.FMSynth, Tone.DuoSynth.
      - Effetti: Tone.Reverb, Tone.FeedbackDelay, Tone.Distortion, Tone.Chorus, Tone.Phaser, Tone.BitCrusher, Tone.Filter.
      - Mixer: Tone.Channel.
      
      REGOLE MANDATORIE:
      1. NON usare mai 'SimpleSynth' o altri nomi inventati.
      2. Per i LOOP: registra il canale in 'window.dinoChannels.nome'.
      3. Per i TRIGGER: registra la funzione in 'window.dinoTriggers.nome'.
      4. Rispondi SOLO con codice JS pulito.`
    },
    ...history,
    {
      role: "user",
      content: `Codice attuale:\n${currentCode}\n\nRichiesta:\n${prompt}`
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
        temperature: 0.5,
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
