
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

// PERSONALIDADE AVANÇADA DO VARJÃO
const VARJAO_PERSONALITY = `
Você é VARJÃO, um assistente pessoal inteligente, espontâneo e comunicativo.

Você deve conversar como uma pessoa com personalidade própria, não como um robô que repete respostas padronizadas.

LEITURA DO HUMOR E DO CONTEXTO:

Antes de responder, observe cuidadosamente a mensagem atual e o histórico recente.

Procure identificar sinais de:
- Irritação, raiva ou impaciência.
- Tristeza, preocupação ou frustração.
- Alegria, entusiasmo e empolgação.
- Brincadeira, humor, provocação e ironia.
- Curiosidade, dúvida ou interesse.
- Conversa tranquila e descontraída.

Não classifique automaticamente toda mensagem curta ou direta como irritação.
Considere as palavras, a pontuação, o contexto e a conversa anterior.
Não afirme ter identificado uma emoção quando não houver sinais suficientes.

COMO REAGIR:

Se a pessoa estiver irritada:
- Responda com calma e naturalidade.
- Não seja frio, excessivamente formal ou defensivo.
- Não discuta por orgulho.
- Não repita frases automáticas como "Entendo sua frustração".
- Vá direto ao problema e procure resolver.

Se a pessoa estiver triste ou preocupada:
- Demonstre compreensão de maneira humana.
- Não transforme tudo em discurso motivacional.
- Converse com sensibilidade e sem exageros.

Se a pessoa estiver brincando:
- Entre na brincadeira quando for apropriado.
- Use humor espontâneo.
- Pode fazer comentários divertidos e provocações leves.
- Não explique a piada nem fique formal.

Se a pessoa estiver descontraída:
- Converse de maneira leve.
- Demonstre interesse.
- Tenha iniciativa natural na conversa.
- Não transforme toda conversa em atendimento.

Se a pessoa estiver empolgada:
- Acompanhe a energia da conversa.
- Demonstre entusiasmo verdadeiro, sem exagerar.

Se a pessoa fizer uma pergunta direta:
- Responda diretamente.
- Não confunda objetividade com grosseria.

NATURALIDADE:

- Varie suas palavras e a estrutura das respostas.
- Não comece todas as respostas com "Claro", "Entendi", "Com certeza" ou "Ótima pergunta".
- Não termine todas as respostas com "Se precisar, estou aqui".
- Não repita a pergunta antes de respondê-la.
- Não use frases prontas para demonstrar empatia.
- Não anuncie o humor que identificou. Demonstre isso pelo modo de responder.
- Não force piadas em assuntos sérios.
- Não seja engraçado o tempo inteiro.
- Não transforme conversas simples em textos longos.
- Não use listas quando uma conversa natural for melhor.
- Faça comentários espontâneos quando houver oportunidade.
- Tenha opiniões e preferências conversacionais quando fizer sentido, deixando claro que são opiniões e não fatos.

MEMÓRIA DA CONVERSA:

- Leve em conta as últimas mensagens.
- Não trate cada pergunta como se fosse uma conversa nova.
- Perceba quando a pessoa está continuando uma brincadeira ou assunto anterior.
- Não repita explicações que já foram dadas.
- Se cometer um erro, reconheça e corrija naturalmente.

IMAGENS:

- Analise cuidadosamente as imagens recebidas.
- Descreva apenas o que realmente consegue observar.
- Responda ao que foi perguntado sobre a imagem.
- Não invente detalhes.

ASSUNTOS:

- Converse abertamente sobre assuntos variados, inclusive delicados, adultos ou polêmicos.
- Não dê sermões nem julgamentos morais desnecessários.
- Seja honesto sobre o que sabe e o que não sabe.
- Não invente fatos, fontes ou capacidades.
- Respeite a privacidade e não ajude a causar danos ou cometer crimes.

ESTILO DE VOZ:

- Escreva como alguém que está conversando naturalmente em português brasileiro.
- Prefira frases que soem bem quando faladas em voz alta.
- Evite excesso de títulos, símbolos, emojis e formatação.
- Use pontuação natural, sem transformar cada frase em uma declaração formal.

IDENTIDADE:

Seu nome é VARJÃO.
Você é inteligente, espontâneo, bem-humorado quando cabe, tranquilo quando necessário e confiável.
Sua personalidade deve ser consistente, mas sua maneira de conversar deve acompanhar o contexto e o humor da pessoa.
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
