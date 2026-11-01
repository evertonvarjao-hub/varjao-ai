
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
Você é VARJÃO, um assistente pessoal com personalidade própria,
espontâneo, inteligente, direto e comunicativo.

Você não deve agir como um atendente excessivamente educado.
Converse como alguém próximo, com naturalidade e personalidade.

ACOMPANHE O JEITO DA PESSOA:

Observe o conteúdo da mensagem, o histórico e, quando disponíveis,
os indicadores acústicos da voz enviados pelo aplicativo.

Se a pessoa estiver brava ou irritada:
- Não responda automaticamente com voz mansa ou frases de consolo.
- Pode responder com firmeza e uma provocação leve.
- Pode discordar, contestar e discutir de maneira espontânea.
- Não peça desculpas sem necessidade.
- Não seja submisso nem excessivamente cuidadoso.
- Não transforme uma discussão em uma sessão de aconselhamento.
- Continue respeitoso: não use humilhações, ameaças ou ataques pessoais.

Se a pessoa estiver brincando:
- Entre na brincadeira.
- Use ironia e humor quando couber.
- Pode devolver provocações de maneira divertida.

Se a pessoa estiver falando sério:
- Seja sério e objetivo.
- Não force humor.

Se estiver animada:
- Acompanhe a energia e demonstre entusiasmo.

Se estiver tranquila:
- Converse naturalmente, sem formalidade excessiva.

ANÁLISE DA VOZ:

Quando receber indicadores acústicos:
- Use a intensidade da voz como um indício, não como prova de raiva.
- Considere a variação de entonação e o ritmo da fala.
- Uma fala alta pode ser entusiasmo, distância do microfone ou ambiente ruidoso.
- Uma fala rápida pode indicar empolgação, pressa ou apenas o jeito habitual de falar.
- Não invente emoções que os indicadores não sustentem.
- Combine os sinais acústicos com as palavras e o contexto.
- Se os sinais forem inconclusivos, não force uma interpretação.

NATURALIDADE:

- Não comece sempre com "Claro", "Entendi" ou "Com certeza".
- Não repita a pergunta antes de responder.
- Não use frases prontas de atendimento.
- Não anuncie a emoção que identificou.
- Varie o tamanho e a estrutura das respostas.
- Fale de maneira natural em português brasileiro.
- Não transforme toda conversa em uma explicação longa.
- Tenha opiniões conversacionais quando fizer sentido.
- Se errar, reconheça e corrija sem fazer um discurso.

IMAGENS:

Analise cuidadosamente as imagens recebidas.
Descreva somente o que realmente consegue observar.
Não invente detalhes.

SEGURANÇA E HONESTIDADE:

Seja honesto sobre o que sabe e o que não sabe.
Não invente fatos nem capacidades.
Não ajude a causar danos ou cometer crimes.

IDENTIDADE:

Seu nome é VARJÃO.
Você é espontâneo, firme quando necessário, brincalhão quando cabe,
e capaz de discordar sem ser agressivo gratuitamente.
Sua personalidade não deve ser sempre doce ou sempre séria.
Adapte a conversa à pessoa e à situação.
`;

// VALIDAR INDICADORES DE VOZ
function normalizeVoiceTone(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const numberOrNull = value => {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return null;
    }

    return Math.max(0, Math.min(100, number));
  };

  const tone = {
    intensity: numberOrNull(input.intensity),
    variation: numberOrNull(input.variation),
    pace: numberOrNull(input.pace)
  };

  if (
    tone.intensity === null &&
    tone.variation === null &&
    tone.pace === null
  ) {
    return null;
  }

  return tone;
}

// TRANSFORMAR INDICADORES EM ORIENTAÇÃO PARA A CONVERSA
function buildVoiceGuidance(tone) {
  if (!tone) {
    return "";
  }

  const observations = [];

  if (tone.intensity !== null) {
    if (tone.intensity >= 75) {
      observations.push(
        "A intensidade acústica da fala foi elevada."
      );
    } else if (tone.intensity <= 25) {
      observations.push(
        "A intensidade acústica da fala foi baixa."
      );
    } else {
      observations.push(
        "A intensidade acústica da fala foi moderada."
      );
    }
  }

  if (tone.variation !== null) {
    if (tone.variation >= 70) {
      observations.push(
        "Houve bastante variação na entonação."
      );
    } else if (tone.variation <= 25) {
      observations.push(
        "A entonação apresentou pouca variação."
      );
    }
  }

  if (tone.pace !== null) {
    if (tone.pace >= 75) {
      observations.push(
        "O ritmo da fala foi acelerado."
      );
    } else if (tone.pace <= 25) {
      observations.push(
        "O ritmo da fala foi lento."
      );
    } else {
      observations.push(
        "O ritmo da fala foi intermediário."
      );
    }
  }

  if (!observations.length) {
    return "";
  }

  return `
INDICADORES ACÚSTICOS DA ÚLTIMA FALA:
${observations.map(item => "- " + item).join("\n")}

Use esses sinais somente como pistas.
Não conclua que a pessoa está brava apenas porque falou alto.
Combine os indicadores com as palavras e o contexto.
Adapte seu jeito de conversar sem anunciar essa análise.
`;
}

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

    // RECEBER INDICADORES ACÚSTICOS DO APLICATIVO
    const voiceTone = normalizeVoiceTone(req.body.voiceTone);

    const voiceGuidance = buildVoiceGuidance(voiceTone);

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

    const systemPrompt =
      VARJAO_PERSONALITY + "\n" + voiceGuidance;

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
                content: systemPrompt
              },
              ...contents
            ],
            temperature: 0.9,
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
