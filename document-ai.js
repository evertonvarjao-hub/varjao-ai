
"use strict";

module.exports = function registerDocumentAI(
  app,
  requestGroq,
  VARJAO_PERSONALITY
) {
  if (!app || typeof app.post !== "function") {
    throw new Error("Aplicativo Express não foi informado ao document-ai.");
  }

  if (typeof requestGroq !== "function") {
    throw new Error("A função requestGroq não foi informada.");
  }

  app.post("/api/document/edit", async (req, res) => {
    try {
      const { filename, documentText, instruction } = req.body || {};

      if (
        typeof documentText !== "string" ||
        !documentText.trim()
      ) {
        return res.status(400).json({
          ok: false,
          error: "O conteúdo do documento está vazio."
        });
      }

      if (
        typeof instruction !== "string" ||
        !instruction.trim()
      ) {
        return res.status(400).json({
          ok: false,
          error: "Informe o que deseja fazer com o documento."
        });
      }

      if (documentText.length > 60000) {
        return res.status(413).json({
          ok: false,
          error:
            "O documento é muito grande para uma única edição. Divida o conteúdo em partes menores."
        });
      }

      if (instruction.length > 5000) {
        return res.status(400).json({
          ok: false,
          error: "A instrução é muito longa."
        });
      }

      const apiKey = process.env.GROQ_API_KEY;

      if (!apiKey) {
        return res.status(503).json({
          ok: false,
          error: "A chave da Groq não está configurada no servidor."
        });
      }

      const systemPrompt = `
${VARJAO_PERSONALITY || "Você é o VARJÃO, um assistente inteligente e cuidadoso."}

TAREFA ESPECIAL: EDIÇÃO DE DOCUMENTOS

Você receberá o conteúdo de um documento e uma instrução de edição.

Regras obrigatórias:
- Execute exatamente a instrução solicitada.
- Preserve nomes, datas, números, valores e informações importantes.
- Não invente fatos, referências, fontes ou informações.
- Corrija erros de português quando isso fizer parte da solicitação.
- Preserve a estrutura e a organização do documento sempre que possível.
- Se pedirem um resumo, faça um resumo fiel ao conteúdo.
- Se pedirem uma revisão, revise o texto sem alterar o sentido.
- Se pedirem uma reescrita, melhore a clareza e a organização mantendo as informações originais.
- Não inclua comentários sobre o que você fez.
- Não escreva introduções como "Aqui está o documento".
- Não use cercas de código Markdown.
- Retorne somente o conteúdo final do documento.
      `.trim();

      const userPrompt = `
NOME DO ARQUIVO:
${String(filename || "Documento").slice(0, 250)}

INSTRUÇÃO:
${instruction.trim()}

CONTEÚDO ORIGINAL:
${documentText}
      `.trim();

      const payload = {
        model: "openai/gpt-oss-120b",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        max_tokens: 8000
      };

      const result = await requestGroq(payload, apiKey);

      if (!result || !result.response) {
        return res.status(502).json({
          ok: false,
          error: "Não foi possível obter uma resposta da inteligência artificial."
        });
      }

      if (!result.response.ok) {
        const apiMessage =
          result.data?.error?.message ||
          `A Groq retornou o erro ${result.response.status}.`;

        return res.status(502).json({
          ok: false,
          error: apiMessage
        });
      }

      const messageContent =
        result.data?.choices?.[0]?.message?.content;

      let editedText = "";

      if (typeof messageContent === "string") {
        editedText = messageContent.trim();
      } else if (Array.isArray(messageContent)) {
        editedText = messageContent
          .map((part) => {
            if (typeof part === "string") return part;
            return part?.text || "";
          })
          .join("")
          .trim();
      }

      if (!editedText) {
        return res.status(502).json({
          ok: false,
          error: "A inteligência artificial não retornou o documento editado."
        });
      }

      return res.json({
        ok: true,
        filename: filename || "Documento",
        editedText
      });
    } catch (error) {
      console.error(
        "Erro na edição de documento:",
        error?.message || error
      );

      return res.status(500).json({
        ok: false,
        error: "Ocorreu um erro interno ao editar o documento."
      });
    }
  });

  console.log("VARJÃO: módulo de inteligência para documentos carregado.");
};
