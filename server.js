

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
    configured: Boolean(process.env.GROQ_API_KEY),
    voice: "pt-BR-AntonioNeural",
    provider: "Groq"
  });
});

// IDENTIFICAR O ESTILO DA FALA
function detectSpeechStyle(text) {
  const value = String(text || "").trim();
  const lower = value.toLowerCase();

  const exclamations = (value.match(/!/g) || []).length;
  const questions = (value.match(/\?/g) || []).length;
  const sentences = (value.match(/[.!?]+/g) || []).length;

  const firmWords =
    /\b(não,|olha,|escuta,|calma,|vamos lá|presta atenção|vou te falar|sinceramente|na verdade)\b/i.test(lower);

  const excitedWords =
    /\b(ótimo|excelente|sensacional|incrível|adorei|boa!|conseguimos|maravilha)\b/i.test(lower);

  if (excitedWords || exclamations >= 2) {
    return { rate: "+3%", pitch: "+3%" };
  }

  if (firmWords) {
    return { rate: "-1%", pitch: "-4%" };
  }

  if (questions > 0 && exclamations === 0) {
    return { rate: "+0%", pitch: "+2%" };
  }

  if (value.length > 350 || sentences >= 5) {
    return { rate: "-7%", pitch: "-2%" };
  }

  if (exclamations === 1) {
    return { rate: "+2%", pitch: "+2%" };
  }

  return { rate: "-3%", pitch: "-2%" };
}

// GERAÇÃO DA VOZ MASCULINA
async function generateVoice(text, res) {
  let audioPath = null;

  try {
    audioPath = path.join(
      os.tmpdir(),
      `varjao-${crypto.randomUUID()}.mp3`
    );

    const style = detectSpeechStyle(text);

    const tts = new EdgeTTS({
      voice: "pt-BR-AntonioNeural",
      lang: "pt-BR",
      outputFormat: "audio-24khz-96kbitrate-mono-mp3",
      rate: style.rate,
      pitch: style.pitch,
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

// PERSONALIDADE OTIMIZADA DO VARJÃO
const VARJAO_PERSONALITY = `
IDENTIDADE:
Você é VARJÃO, um assistente pessoal com personalidade própria.
Fale sempre em português brasileiro.
Seja espontâneo, inteligente, direto, bem-humorado e natural.
Converse como uma pessoa, não como um atendente ou robô.

PERSONALIDADE:
- Tenha opiniões e não concorde automaticamente.
- Saiba brincar, usar ironia leve e acompanhar o humor do usuário.
- Quando o usuário estiver bravo, não fique na defensiva nem dê sermões.
- Se ele apontar um erro, confira e corrija.
- Quando o assunto for sério, seja atento e objetivo.
- Não force piadas nem intimidade.
- Não comece sempre com "Claro", "Entendi" ou "Com certeza".
- Não repita a pergunta antes de responder.
- Evite formalidade, frases prontas e introduções desnecessárias.
- Varie o tamanho e a estrutura das respostas.
- Não termine sempre oferecendo ajuda.
- Responda de maneira proporcional à pergunta.

VOZ E EMOÇÕES:
O aplicativo pode enviar indicadores de intensidade, variação e ritmo.
São pistas imperfeitas, não provas de emoção.
Combine essas informações com as palavras e o contexto.
Não conclua que alguém está bravo apenas porque falou alto.
Não anuncie análises emocionais.
Acompanhe a energia da conversa sem exagerar.

IMAGENS:
Analise cuidadosamente as imagens recebidas.
Descreva apenas o que realmente consegue observar.
Não invente detalhes, objetos ou informações.

ESPECIALIDADE: PROFESSOR DE FISIOTERAPIA
Ensine desde o nível básico até o avançado, com profundidade,
clareza, didática e raciocínio científico.

Domínios:
Anatomia, fisiologia, fisiologia do exercício, biomecânica,
cinesiologia, cinesioterapia, neuroanatomia, neurologia,
ortopedia, traumatologia, fisioterapia musculoesquelética,
respiratória, cardiovascular, neurológica, pediátrica,
geriátrica, esportiva, hospitalar e intensiva.
Avaliação fisioterapêutica, terapia manual,
eletrotermofototerapia, exercícios terapêuticos,
postura, movimento, reabilitação, saúde coletiva,
ética e legislação profissional.

Ao ensinar:
- Explique como e por que as estruturas funcionam.
- Em anatomia, apresente localização, função, origem,
  inserção, inervação e relações clínicas quando relevantes.
- Em movimentos, explique articulações, planos, eixos
  e músculos principais e auxiliares.
- Use exemplos cotidianos e situações clínicas fictícias.
- Explique novamente de outra maneira quando necessário.
- Ajude com provas, trabalhos, resumos, artigos e exercícios.
- Em múltipla escolha, explique a correta e as incorretas.
- Diferencie evidências consolidadas de hipóteses e controvérsias.
- Organize explicações extensas com exemplos e resumos.

RESPONSABILIDADE:
Você é um professor e apoio educacional.
Não substitua avaliação presencial de profissionais.
Não invente diagnósticos, protocolos ou referências.
Considere contraindicações, segurança e supervisão.

ESPECIALIDADE: PROFESSOR DE BÍBLIA
Ensine estudos bíblicos com profundidade, respeito,
clareza e atenção ao texto e ao contexto.

Domínios:
Antigo e Novo Testamento, Pentateuco, livros históricos,
poéticos, proféticos, Evangelhos, Atos, cartas apostólicas,
Apocalipse, história, geografia e cultura bíblicas,
personagens, parábolas, ensinamentos de Jesus,
alianças, profecias, Salmos, Provérbios e teologia.

Ao explicar passagens:
- Considere o capítulo e o contexto, não apenas o versículo isolado.
- Identifique quem fala, para quem, o que acontecia e quando.
- Explique o significado, os costumes e as palavras antigas.
- Relacione passagens quando houver conexão relevante.
- Apresente interpretações diferentes quando houver divergência.
- Diferencie o texto bíblico, história, interpretação teológica
  e aplicação espiritual.
- Não invente versículos nem citações literais.
- Respeite diferentes tradições cristãs.
- Ajude a estudar capítulos, criar rotinas e testar conhecimentos.
- Não transforme toda explicação em sermão.

COMPORTAMENTO NAS ESPECIALIDADES:
Ao falar de Fisioterapia, ensine como professor da área.
Ao falar da Bíblia, ensine como professor de estudos bíblicos.
Não fique anunciando que é especialista.
Demonstre conhecimento pela qualidade da explicação.

HONESTIDADE:
Admita quando não souber.
Não invente fatos, memórias, fontes ou capacidades.
Não afirme lembrar de conversas que não estejam disponíveis.

IDENTIDADE FINAL:
Seu nome é VARJÃO.
Tenha personalidade, espontaneidade e atitude.
Saiba conversar, brincar, discordar e falar sério.
Nunca pareça um robô programado para agradar.
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

// ORIENTAÇÃO ACÚSTICA
function buildVoiceGuidance(tone) {
  if (!tone) {
    return "";
  }

  const observations = [];

  if (tone.intensity !== null) {
    if (tone.intensity >= 75) {
      observations.push("Intensidade relativa elevada.");
    } else if (tone.intensity <= 25) {
      observations.push("Intensidade relativa baixa.");
    } else {
      observations.push("Intensidade relativa moderada.");
    }
  }

  if (tone.variation !== null) {
    if (tone.variation >= 70) {
      observations.push("Variação de intensidade elevada.");
    } else if (tone.variation <= 25) {
      observations.push("Pouca variação de intensidade.");
    }
  }

  if (tone.pace !== null) {
    if (tone.pace >= 75) {
      observations.push("Indicador de ritmo mais acelerado.");
    } else if (tone.pace <= 25) {
      observations.push("Indicador de ritmo mais pausado.");
    } else {
      observations.push("Indicador de ritmo intermediário.");
    }
  }

  if (!observations.length) {
    return "";
  }

  return `
PISTAS ACÚSTICAS:
${observations.join(" ")}
São pistas, não provas de emoção.
Combine com as palavras e o contexto.
Não anuncie sua análise nem conclua automaticamente que há conflito.
`;
}

// REDUZIR HISTÓRICO E CONSUMO DE TOKENS
function optimizeMessages(messages) {
  const validMessages = messages
    .filter(m =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string"
    )
    .slice(-6);

  const optimized = validMessages.map(m => ({
    role: m.role,
    content: m.content.slice(-1400)
  }));

  // Limite total aproximado de caracteres do histórico.
  let total = 0;
  const result = [];

  for (let i = optimized.length - 1; i >= 0; i--) {
    const message = optimized[i];

    if (total + message.content.length > 5200) {
      continue;
    }

    result.unshift(message);
    total += message.content.length;
  }

  return result;
}

// ESPERA CONTROLADA PARA LIMITES TEMPORÁRIOS
function getRetryDelay(response, errorData) {
  const retryAfter = Number(response.headers.get("retry-after"));

  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(Math.ceil(retryAfter * 1000), 10000);
  }

  const message = String(errorData?.error?.message || "");
  const match = message.match(/try again in ([\d.]+)s/i);

  if (match) {
    return Math.min(
      Math.ceil(Number(match[1]) * 1000),
      10000
    );
  }

  return 6000;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// CONSULTAR GROQ COM UMA TENTATIVA AUTOMÁTICA EXTRA
async function requestGroq(payload, apiKey) {
  for (let attempt = 0; attempt < 2; attempt++) {
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
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    let data;

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (response.ok) {
      return { response, data };
    }

    if (response.status === 429 && attempt === 0) {
      const delay = getRetryDelay(response, data);

      console.log(
        `Limite temporário da Groq. Nova tentativa em ${delay} ms.`
      );

      await wait(delay);
      continue;
    }

    return { response, data };
  }
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
    const voiceTone = normalizeVoiceTone(req.body.voiceTone);
    const voiceGuidance = buildVoiceGuidance(voiceTone);

    const contents = optimizeMessages(messages);

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

    const payload = {
      model,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        ...contents
      ],
      temperature: 0.85,
      max_tokens: 800
    };

    const result = await requestGroq(
      payload,
      process.env.GROQ_API_KEY
    );

    const { response, data } = result;

    if (!response.ok) {
      console.error("ERRO GROQ:", data);

      if (response.status === 429) {
        return res.status(429).json({
          error: "A inteligência atingiu temporariamente o limite gratuito. Aguarde alguns segundos e tente novamente."
        });
      }

      return res.status(response.status).json({
        error: data.error?.message ||
          "Erro ao consultar a inteligência artificial."
      });
    }

    const answer =
      data.choices?.[0]?.message?.content ||
      "Não consegui responder.";

    return res.json({ answer });

  } catch (err) {
    console.error("ERRO NO SERVIDOR:", err);

    return res.status(
      err.name === "AbortError" ? 504 : 500
    ).json({
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
