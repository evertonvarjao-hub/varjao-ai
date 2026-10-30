
const express = require("express");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

app.get("/api/status", (_req, res) => {
  res.json({
    ok: true,
    configured: Boolean(process.env.GROQ_API_KEY)
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({
        error: "Chave do Groq não configurada."
      });
    }

    const messages = Array.isArray(req.body.messages)
      ? req.body.messages
      : [];

    const contents = messages.slice(-10).map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 3000)
    }));

    if (!contents.length) {
      return res.status(400).json({
        error: "Escreva uma mensagem."
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let response;

    try {
      response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content: "Você é VARJÃO, um assistente pessoal inteligente. Fale em português do Brasil, com clareza, naturalidade e atenção ao contexto."
              },
              ...contents
            ],
            temperature: 0.7,
            max_tokens: 1500
          })
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro Groq:", data);
      return res.status(response.status).json({
        error: data.error?.message || "Erro ao consultar Groq."
      });
    }

    const answer =
      data.choices?.[0]?.message?.content || "Não consegui responder.";

    res.json({ answer });

  } catch (err) {
    console.error("Erro no servidor:", err);

    res.status(err.name === "AbortError" ? 504 : 500).json({
      error: err.name === "AbortError"
        ? "O VARJÃO demorou para responder. Tente novamente."
        : "Falha de conexão com a inteligência artificial."
    });
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`VARJÃO AI disponível na porta ${port}`);
});
