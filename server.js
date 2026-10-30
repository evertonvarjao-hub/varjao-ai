const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/status", (_req, res) => {
  res.json({ ok: true, configured: Boolean(process.env.OPENAI_API_KEY) });
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: "A inteligência artificial ainda não foi configurada. Adicione OPENAI_API_KEY nas variáveis de ambiente do servidor."
      });
    }

    const messages = Array.isArray(req.body.messages) ? req.body.messages : [];
    const safeMessages = messages.slice(-16).map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 5000)
    }));

    if (!safeMessages.length) {
      return res.status(400).json({ error: "Escreva ou fale uma mensagem primeiro." });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        instructions: "Você é VARJÃO, um assistente pessoal inteligente, educado, direto e prestativo. Fale sempre em português do Brasil, a menos que o usuário peça outro idioma. Seja claro e natural. Não diga que executou ações fora do chat se não tiver ferramentas para isso. Peça confirmação antes de orientar ações sensíveis.",
        input: safeMessages
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("OpenAI API:", data);
      return res.status(response.status).json({
        error: data.error?.message || "Não foi possível obter resposta da inteligência artificial."
      });
    }

    const answer = data.output_text ||
      (data.output || []).flatMap(item => item.content || [])
        .filter(part => part.type === "output_text")
        .map(part => part.text).join("\n");

    res.json({ answer: answer || "Não consegui formular uma resposta desta vez." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha de conexão. Tente novamente." });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`VARJÃO AI disponível na porta ${port}`));
