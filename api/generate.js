import Groq from "groq-sdk";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, currentCode } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Groq API Key not configured on server' });
  }

  const groq = new Groq({ apiKey });

  try {
    const completion = await groq.chat.completions.create({
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
          6. Usa variabili e sintassi moderne (ES6+).
          7. Se ti viene fornito del codice esistente, modificalo secondo le istruzioni mantenendo la struttura funzionale.`
        },
        {
          role: "user",
          content: `Codice attuale:
          ${currentCode}
          
          Istruzione di modifica:
          ${prompt}`
        }
      ],
      model: "llama3-8b-8192",
      temperature: 0.7,
    });

    let generatedCode = completion.choices[0]?.message?.content || "";
    
    // Pulizia di emergenza se l'IA ignora le istruzioni sui backtick
    generatedCode = generatedCode.replace(/```javascript/g, "").replace(/```/g, "").trim();

    res.status(200).json({ code: generatedCode });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error calling Groq API' });
  }
}
