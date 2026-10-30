
const express = require("express");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

app.get("/api/status", (_req, res) => {
  res.json({
    ok: true,
    configured: Boolean(process.env.GEMINI_API_KEY)
  });
});

app.post("/api/chat", async (req, res) => {
  console.log("Mensagem recebida");

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: "Chave Gemini não configurada."
      });
    }

    const messages = Array.isArray(req.body.messages)
      ? req.body.messages
      : [];

    const contents = messages.slice(-6).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{
        text: String(m.content || "").slice(0, 2000)
      }]
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
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "x-goog-api-key": process.env.GEMINI_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{
                text: "Você é VARJÃO, um assistente pessoal inteligente. Fale em português do Brasil, com clareza e naturalidade."
              }]
            },
            contents
          })
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json();

    if (!response.ok) {
      const message = data.error?.message || "";

      console.error("Gemini API:", data);

      if (
        response.status === 429 ||
        message.toLowerCase().includes("quota")
      ) {
        return res.status(429).json({
          error: "A cota gratuita do Gemini acabou. Aguarde a renovação para conversar novamente."
        });
      }

      if (response.status === 503) {
        return res.status(503).json({
          error: "O Gemini está temporariamente ocupado. Tente novamente mais tarde."
        });
      }

      return res.status(response.status).json({
        error: message || "Erro ao consultar Gemini."
      });
    }

    const answer = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "")
      .join("\n");

    res.json({
      answer: answer || "Não consegui responder."
    });

  } catch (err) {
    console.error("Erro no servidor:", err);

    if (err.name === "AbortError") {
      return res.status(504).json({
        error: "O Gemini demorou demais para responder. Tente novamente."
      });
    }

    res.status(500).json({
      error: "Falha de conexão com o serviço de inteligência artificial."
    });
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`VARJÃO AI disponível na porta ${port}`);
});
