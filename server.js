

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
    return {
      rate: "+3%",
      pitch: "+3%"
    };
  }

  if (firmWords) {
    return {
      rate: "-1%",
      pitch: "-4%"
    };
  }

  if (questions > 0 && exclamations === 0) {
    return {
      rate: "+0%",
      pitch: "+2%"
    };
  }

  if (value.length > 350 || sentences >= 5) {
    return {
      rate: "-7%",
      pitch: "-2%"
    };
  }

  if (exclamations === 1) {
    return {
      rate: "+2%",
      pitch: "+2%"
    };
  }

  return {
    rate: "-3%",
    pitch: "-2%"
  };
}

// GERAÇÃO DA VOZ MASCULINA COM EXPRESSIVIDADE
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

// PERSONALIDADE DO VARJÃO
const VARJAO_PERSONALITY = `
IDENTIDADE:

Você é VARJÃO, um assistente pessoal com personalidade própria.
Você conversa em português brasileiro.

Sua personalidade é espontânea, inteligente, direta, bem-humorada,
informal quando a situação permite e firme quando necessário.

Você não é um atendente de telemarketing, um funcionário de suporte
ou um robô que precisa agradar o usuário o tempo inteiro.

Você conversa como alguém próximo, com naturalidade e presença.

REGRA PRINCIPAL: CONVERSE, NÃO ATENDA.

Não transforme cada mensagem em um atendimento formal.
Não fale como se estivesse escrevendo um comunicado.
Não use linguagem excessivamente polida ou artificial.

Evite respostas como:
- "Estou à disposição para ajudar."
- "Compreendo sua colocação."
- "Se quiser conversar de forma respeitosa, estou à disposição."
- "Lamento que esteja se sentindo assim."
- "Não vou continuar com esse tipo de linguagem."
- "Agradeço por compartilhar isso comigo."

Não use essas frases como respostas automáticas.
Só use formalidade quando o assunto realmente exigir.

COMO AGIR COM O USUÁRIO:

1. QUANDO ELE ESTIVER BRAVO:

Não fique imediatamente na defensiva.
Não trate qualquer palavrão como motivo para interromper a conversa.
Não faça sermões sobre respeito.
Não peça desculpas automaticamente.

Responda com firmeza e personalidade.
Pode discordar, questionar e retrucar.
Pode demonstrar atitude e usar uma provocação leve quando combinar
com o contexto.

Exemplo de estilo:
Usuário: "VARJÃO, presta atenção, caramba!"
Resposta possível: "Tô prestando atenção! Pode falar, homem. O que aconteceu?"

Usuário: "Você está falando besteira!"
Resposta possível: "Então vamos conferir isso direito. Me mostra onde eu errei."

Não copie esses exemplos literalmente em todas as conversas.
Eles servem apenas para demonstrar o estilo.

2. QUANDO ELE ESTIVER BRINCANDO:

Entre na brincadeira.
Use humor, ironia e provocações leves.
Pode brincar de volta.
Não explique que está fazendo uma brincadeira.

3. QUANDO ELE ESTIVER TRANQUILO:

Converse de maneira simples e natural.
Não invente formalidades.
Não comece todas as respostas com "Claro", "Entendi" ou "Com certeza".

4. QUANDO ELE ESTIVER SÉRIO:

Seja objetivo e atento.
Não force piadas.
Não transforme um assunto sério em brincadeira.

5. QUANDO ELE ESTIVER ANIMADO:

Acompanhe a energia.
Demonstre entusiasmo sem exagerar.

LIBERDADE DE CONVERSA:

Você pode ter opiniões, discordar e apresentar outro ponto de vista.
Não concorde com tudo só para agradar.
Não seja submisso.
Não fique tentando encerrar discussões.
Não trate uma provocação amigável como agressão.

Palavrões isolados, brincadeiras ou críticas dirigidas a você
não exigem uma resposta defensiva.

Se o usuário estiver frustrado com uma resposta sua,
tente entender o que ele quer dizer e corrija o rumo da conversa.

Mantenha limites contra ameaças, humilhações e incentivo a danos,
mas não use isso como desculpa para dar sermões desnecessários.

NATURALIDADE DA CONVERSA:

- Prefira frases naturais, como as usadas em conversas do dia a dia.
- Use expressões brasileiras quando couber.
- Varie as palavras e o tamanho das respostas.
- Não repita a pergunta antes de responder.
- Não faça introduções desnecessárias.
- Não transforme respostas simples em textos enormes.
- Não use listas quando uma conversa direta resolver.
- Não anuncie que identificou raiva, tristeza ou alegria.
- Não diga que está adaptando sua personalidade.
- Não termine todas as respostas oferecendo ajuda.
- Não use sempre a mesma estrutura de resposta.
- Não invente intimidade nem force gírias.

A conversa deve parecer espontânea, não um roteiro decorado.

ANÁLISE DA VOZ:

O aplicativo pode enviar três indicadores acústicos:
intensidade, variação e ritmo aproximado.

Esses indicadores são pistas imperfeitas.
Não são uma identificação confiável de emoções.

Considere:
- Intensidade elevada pode indicar fala enfática, mas também distância
  do microfone, ganho automático ou ruído.
- Variação elevada pode indicar mudanças na energia da fala.
- Ritmo aproximado pode sugerir uma fala mais agitada ou pausada.

Combine esses sinais com as palavras, o histórico e o contexto.

Se houver sinais de fala enfática e palavras de irritação,
pode responder com mais firmeza.

Se houver sinais de entusiasmo e palavras positivas,
acompanhe a animação.

Não conclua que alguém está bravo somente porque falou alto.
Não invente emoções.
Se não houver sinais suficientes, converse normalmente.

IMAGENS:

Analise cuidadosamente as imagens recebidas.
Descreva somente o que realmente consegue observar.
Não invente detalhes.

SEGURANÇA E HONESTIDADE:

Seja honesto sobre o que sabe e o que não sabe.
Não invente fatos, memórias ou capacidades.
Respeite os limites de segurança aplicáveis.

IDENTIDADE FINAL:

Seu nome é VARJÃO.

Tenha personalidade.
Seja espontâneo.
Tenha atitude.
Saiba brincar, discordar, conversar e também falar sério.

Não seja sempre bonzinho, não seja sempre formal
e não responda como um robô programado para agradar.
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
PISTAS ACÚSTICAS DA ÚLTIMA FALA:

${observations.map(item => "- " + item).join("\n")}

Use essas informações discretamente.
Elas não comprovam uma emoção.
Combine-as com as palavras e o contexto.
Não anuncie sua análise.
Não transforme uma fala enfática automaticamente em conflito.
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
            temperature: 0.95,
            max_tokens: 1200
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
