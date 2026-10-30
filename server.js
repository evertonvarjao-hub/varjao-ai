const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

app.get("/api/status", (_req, res) => {
  res.json({ ok: true, configured: Boolean(process.env.GEMINI_API_KEY) });
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: "Chave Gemini não configurada." });
    }

    const messages = Array.isArray(req.body.messages) ? req.body.messages : [];

    const contents = messages.slice(-16).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content || "").slice(0, 5000) }]
    }));

    if (!contents.length) {
      return res.status(400).json({ error: "Escreva uma mensagem." });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
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

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API:", data);
      return res.status(response.status).json({
        error: data.error?.message || "Erro ao consultar Gemini."
      });
    }

    const answer = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "")
      .join("\n");

    res.json({ answer: answer || "Não consegui responder." });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha de conexão." });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`VARJÃO AI disponível na porta ${port}`));
