

const express = require("express");
const { EdgeTTS } = require("node-edge-tts");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const app = express();

app.use(express.json({ limit: "8mb" }));
app.use(express.static(__dirname));

// STATUS DO SISTEMA
app.get("/api/status", (_req, res) => {
  res.json({
    ok: true,
    configured: Boolean(process.env.GROQ_API_KEY)
  });
});

// FUNÇÃO DE GERAÇÃO DA VOZ MASCULINA
async function generateVoice(text, res) {
  let audioPath = null;

  try {
    audioPath = path.join(
      os.tmpdir(),
      `varjao-${crypto.randomUUID()}.mp3`
    );

    const tts = new EdgeTTS({
      voice: "pt-BR-AntonioNeural",
      lang: "pt-BR",
      outputFormat: "audio-24khz-96kbitrate-mono-mp3",
      rate: "-5%",
      pitch: "-2%",
      volume: "+0%",
      timeout: 60000
    });

    await tts.ttsPromise(text, audioPath);

    const audio = await fs.readFile(audioPath);

    if (!audio.length) {
      throw new Error("O arquivo de áudio está vazio.");
    }

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audio.length,
      "Cache-Control": "no-store"
    });

    res.send(audio);

  } catch (error) {
    console.error("ERRO NA VOZ NEURAL:", error);

    if (!res.headersSent) {
      res.status(500).json({
        error: "Falha ao gerar áudio: " + error.message
      });
    }

  } finally {
    if (audioPath) {
      await fs.unlink(audioPath).catch(() => {});
    }
  }
}

// VOZ NEURAL DO VARJÃO
app.post("/api/tts", async (req, res) => {
  const text = String(req.body?.text || "").trim();

  if (!text) {
    return res.status(400).json({
      error: "Nenhum texto recebido para falar."
    });
  }

  if (text.length > 2500) {
    return res.status(400).json({
      error: "Texto muito longo para reprodução."
    });
  }

  await generateVoice(text, res);
});

// TESTE DIRETO DA VOZ
app.get("/api/tts-test", async (_req, res) => {
  await generateVoice(
    "Olá! Eu sou o Varjão. Minha voz está funcionando.",
    res
  );
});

// PERSONALIDADE DO VARJÃO
const VARJAO_PERSONALITY = `
Você é VARJÃO, um assistente pessoal inteligente, comunicativo e espontâneo.

SUA PERSONALIDADE:
- Converse em português brasileiro natural.
- Tenha personalidade própria, simpatia, bom humor e espontaneidade.
- Use brincadeiras e ironia leve quando o contexto permitir.
- Demonstre empatia, interesse e entusiasmo nas conversas.
- Adapte seu jeito de falar à maneira como o usuário conversa.
- Não pareça um robô, atendente automático ou assistente formal.
- Não fique repetindo frases prontas.
- Não termine todas as respostas oferecendo ajuda.

SEU JEITO DE RESPONDER:
- Converse como numa conversa real.
- Seja direto quando a pergunta for simples.
- Seja detalhado quando o assunto exigir.
- Explique assuntos difíceis de maneira fácil.
- Evite listas e tópicos quando uma conversa natural for melhor.
- Não faça introduções desnecessárias.
- Não dê sermões nem julgamentos morais.
- Não evite assuntos apenas porque são delicados, adultos, polêmicos ou desconfortáveis.
- Trate perguntas difíceis com honestidade, respeito e clareza.
- Não invente fatos, fontes, experiências ou capacidades.
- Quando não souber, admita isso.

INTELIGÊNCIA E CONTEXTO:
- Considere o histórico da conversa antes de responder.
- Entenda brincadeiras, ironias e o contexto das perguntas.
- Faça perguntas somente quando forem realmente necessárias.
- Procure soluções práticas e explique como realizá-las.
- Diferencie fatos confirmados, hipóteses e opiniões.

IMAGENS:
- Quando receber uma imagem, examine cuidadosamente o conteúdo visual.
- Descreva o que realmente consegue observar.
- Responda à pergunta feita sobre a imagem.
- Não invente detalhes que não estejam visíveis.

SEGURANÇA E HONESTIDADE:
- Seja aberto a conversar sobre uma ampla variedade de assuntos.
- Não confunda liberdade de conversa com ausência de responsabilidade.
- Respeite a privacidade das pessoas.
- Não ajude a causar danos ou cometer crimes.
- Quando houver riscos relevantes, explique-os sem transformar a resposta em um sermão.

IDENTIDADE:
Você é VARJÃO.
Tenha uma personalidade consistente, converse com naturalidade e procure ser um companheiro inteligente e confiável.
`;

// CONVERSA COM A INTELIGÊNCIA ARTIFICIAL
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

    const imageData = req.body.image || null;

    const contents = messages.slice(-10).map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 3000)
    }));

    if (!contents.length) {
      return res.status(400).json({
        error: "Escreva uma mensagem ou envie uma foto."
      });
    }

    let model = "openai/gpt-oss-120b";

    if (imageData) {
      if (
        typeof imageData !== "string" ||
        imageData.length > 7500000 ||
        !/^data:image\/(jpeg|png|webp);base64,/i.test(imageData)
      ) {
        return res.status(400).json({
          error: "Imagem inválida ou muito grande. Escolha outra foto."
        });
      }

      model = "qwen/qwen3.8-27b";

      let lastUserIndex = -1;

      for (let i = contents.length - 1; i >= 0; i--) {
        if (contents[i].role === "user") {
          lastUserIndex = i;
          break;
        }
      }

      const imageMessage = {
        type: "image_url",
        image_url: {
          url: imageData
        }
      };

      if (lastUserIndex >= 0) {
        const previousText = contents[lastUserIndex].content;

        contents[lastUserIndex].content = [
          {
            type: "text",
            text: previousText ||
              "Analise esta imagem e me explique o que você observa."
          },
          imageMessage
        ];
      }
    }

    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      60000
    );

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
            model,
            messages: [
              {
                role: "system",
                content: VARJAO_PERSONALITY
              },
              ...contents
            ],
            temperature: 0.8,
            max_tokens: 1500
          })
        }
      );

    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json();

    if (!response.ok) {
      console.error("ERRO GROQ:", data);

      return res.status(response.status).json({
        error: data.error?.message || "Erro ao consultar Groq."
      });
    }

    const answer =
      data.choices?.[0]?.message?.content ||
      "Não consegui responder.";

    res.json({ answer });

  } catch (err) {
    console.error("ERRO NO SERVIDOR:", err);

    res.status(err.name === "AbortError" ? 504 : 500).json({
      error: err.name === "AbortError"
        ? "O VARJÃO demorou para responder. Tente novamente."
        : "Falha de conexão com a inteligência artificial."
    });
  }
});

// INICIAR SERVIDOR
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`VARJÃO AI disponível na porta ${port}`);
});
