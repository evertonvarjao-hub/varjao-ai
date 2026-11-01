
const form = document.getElementById("chatForm");
const promptInput = document.getElementById("prompt");
const messagesEl = document.getElementById("messages");
const micBtn = document.getElementById("micBtn");
const listenState = document.getElementById("listenState");
const statusText = document.getElementById("statusText");
const imageInput = document.getElementById("imageInput");

let history = [];
let busy = false;
let pendingImage = null;

let voiceMode = false;
let recognitionActive = false;
let speaking = false;
let restartTimer = null;

let audioContext = null;
let currentSource = null;
let currentAudio = null;
let currentAudioUrl = null;

// EXIBIR MENSAGENS
function addMessage(role, content) {
  const el = document.createElement("div");
  el.className = `message ${role}`;

  if (role === "assistant") {
    const avatar = document.createElement("img");
    avatar.className = "message-avatar";
    avatar.src = "/avatar.jpg";
    avatar.alt = "";
    el.appendChild(avatar);
  }

  const body = document.createElement("div");
  body.className = "message-body";

  const who = document.createElement("span");
  who.className = "speaker";
  who.textContent = role === "user" ? "VOCÊ" : "VARJÃO";

  const p = document.createElement("p");
  p.textContent = content;

  body.append(who, p);
  el.appendChild(body);
  messagesEl.appendChild(el);

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// EXIBIR FOTOS
function addImageMessage(imageData, content) {
  const el = document.createElement("div");
  el.className = "message user";

  const body = document.createElement("div");
  body.className = "message-body";

  const who = document.createElement("span");
  who.className = "speaker";
  who.textContent = "VOCÊ";

  const img = document.createElement("img");
  img.src = imageData;
  img.alt = "Imagem enviada";

  const p = document.createElement("p");
  p.textContent = content;

  body.append(who, img, p);
  el.appendChild(body);
  messagesEl.appendChild(el);

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// PREPARAR ÁUDIO DO IPHONE
async function unlockAudio() {
  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (AudioContextClass) {
      if (!audioContext) {
        audioContext = new AudioContextClass();
      }

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
    }
  } catch (error) {
    console.error("Erro ao preparar áudio:", error);
  }
}

// PARAR ÁUDIO
function stopAudio() {
  if (currentSource) {
    try {
      currentSource.stop();
    } catch (_) {}

    currentSource = null;
  }

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }

  speaking = false;
}

// VOZ NEURAL MASCULINA
async function speak(text) {
  stopAudio();

  speaking = true;
  listenState.textContent = "PREPARANDO VOZ NATURAL";

  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: String(text || "").slice(0, 2500)
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || "Falha ao gerar voz neural."
      );
    }

    const audioData = await response.arrayBuffer();

    if (!audioData.byteLength) {
      throw new Error("O áudio recebido está vazio.");
    }

    // REPRODUÇÃO PELO AUDIOCONTEXT
    if (audioContext) {
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const audioBuffer = await audioContext.decodeAudioData(
        audioData.slice(0)
      );

      const source = audioContext.createBufferSource();

      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      currentSource = source;

      await new Promise((resolve, reject) => {
        source.onended = () => {
          if (currentSource === source) {
            currentSource = null;
          }
          resolve();
        };

        try {
          source.start(0);
          listenState.textContent = "VARJÃO FALANDO";
        } catch (error) {
          reject(error);
        }
      });

    } else {
      // ALTERNATIVA PARA NAVEGADORES SEM AUDIOCONTEXT
      const blob = new Blob(
        [audioData],
        { type: "audio/mpeg" }
      );

      currentAudioUrl = URL.createObjectURL(blob);
      currentAudio = new Audio(currentAudioUrl);

      currentAudio.volume = 1;

      await new Promise((resolve, reject) => {
        currentAudio.onended = resolve;

        currentAudio.onerror = () => {
          reject(new Error("Erro na reprodução do áudio."));
        };

        currentAudio.play().then(() => {
          listenState.textContent = "VARJÃO FALANDO";
        }).catch(reject);
      });
    }

  } catch (error) {
    console.error("ERRO NA REPRODUÇÃO:", error);

    listenState.textContent = "FALHA NA REPRODUÇÃO DA VOZ";

  } finally {
    stopAudio();

    if (voiceMode) {
      listenState.textContent = "PREPARANDO PARA OUVIR";
    } else {
      listenState.textContent = "AGUARDANDO COMANDO";
    }
  }
}

// PREPARAR IMAGEM
function prepareImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Selecione uma imagem válida."));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("Não foi possível ler a foto."));
    };

    reader.onload = () => {
      const img = new Image();

      img.onerror = () => {
        reject(new Error("Não foi possível abrir esta imagem."));
      };

      img.onload = () => {
        const maxSize = 1440;

        const scale = Math.min(
          1,
          maxSize / Math.max(img.width, img.height)
        );

        const canvas = document.createElement("canvas");

        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Não foi possível preparar a imagem."));
          return;
        }

        context.drawImage(
          img,
          0,
          0,
          canvas.width,
          canvas.height
        );

        const imageData = canvas.toDataURL(
          "image/jpeg",
          0.78
        );

        if (imageData.length > 7500000) {
          reject(new Error("A foto ficou muito grande."));
          return;
        }

        resolve(imageData);
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

// ENVIAR MENSAGEM
async function sendMessage(
  text,
  imageData = null,
  speakResponse = false
) {
  const clean = String(text || "").trim();

  if ((!clean && !imageData) || busy) return;

  const messageText = clean ||
    "Analise esta imagem e me explique o que você observa.";

  busy = true;
  promptInput.value = "";

  if (imageData) {
    addImageMessage(imageData, messageText);
  } else {
    addMessage("user", messageText);
  }

  history.push({
    role: "user",
    content: messageText
  });

  listenState.textContent = imageData
    ? "ANALISANDO IMAGEM"
    : "PROCESSANDO";

  statusText.textContent = "CONECTANDO";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: history,
        image: imageData || undefined
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Erro ao conversar."
      );
    }

    const answer = data.answer || "Não consegui responder.";

    history.push({
      role: "assistant",
      content: answer
    });

    addMessage("assistant", answer);

    // FALAR QUANDO A PERGUNTA VEIO DO MICROFONE
    if (speakResponse && voiceMode) {
      await speak(answer);
    }

    if (imageData) {
      pendingImage = null;
      imageInput.value = "";
      promptInput.placeholder = "Fale comigo ou digite...";
    }

    statusText.textContent = "SISTEMA PRONTO";

  } catch (error) {
    addMessage("assistant", "Aviso: " + error.message);

    listenState.textContent = "VERIFIQUE A CONEXÃO";
    statusText.textContent = "ATENÇÃO";

  } finally {
    busy = false;

    // VOLTAR A OUVIR AUTOMATICAMENTE
    if (voiceMode) {
      listenState.textContent = "VOU OUVIR VOCÊ NOVAMENTE";
      startListening();
    }
  }
}

// INICIAR ESCUTA
function startListening() {
  if (!voiceMode || busy || speaking || recognitionActive) {
    return;
  }

  if (!recognition) return;

  clearTimeout(restartTimer);

  restartTimer = setTimeout(() => {
    if (!voiceMode || busy || speaking || recognitionActive) {
      return;
    }

    try {
      recognition.start();
    } catch (error) {
      console.log("Aguardando microfone:", error.message);
    }
  }, 500);
}

// ENCERRAR CONVERSA POR VOZ
function stopListening() {
  voiceMode = false;

  clearTimeout(restartTimer);

  if (recognitionActive && recognition) {
    try {
      recognition.stop();
    } catch (_) {}
  }

  stopAudio();

  micBtn?.classList.remove("active");

  listenState.textContent = "CONVERSA POR VOZ ENCERRADA";
}

// ENVIO PELO CAMPO DE TEXTO
form?.addEventListener("submit", event => {
  event.preventDefault();

  sendMessage(
    promptInput.value,
    pendingImage,
    false
  );
});

// SELEÇÃO DE IMAGEM
imageInput?.addEventListener("change", async () => {
  const file = imageInput.files?.[0];

  if (!file) return;

  try {
    listenState.textContent = "PREPARANDO FOTO";

    pendingImage = await prepareImage(file);

    promptInput.placeholder =
      "O que deseja saber sobre esta foto?";

    promptInput.focus();

    listenState.textContent = "FOTO PRONTA PARA ENVIAR";

  } catch (error) {
    pendingImage = null;
    imageInput.value = "";

    addMessage("assistant", error.message);

    listenState.textContent = "AGUARDANDO COMANDO";
  }
});

// BOTÃO LIMPAR CONVERSA
document.getElementById("clearBtn")?.addEventListener("click", () => {
  history = [];
  pendingImage = null;

  if (imageInput) {
    imageInput.value = "";
  }

  promptInput.placeholder = "Fale comigo ou digite...";

  stopListening();

  messagesEl.replaceChildren();

  addMessage(
    "assistant",
    "Conversa limpa. Estou pronto para começar novamente."
  );

  listenState.textContent = "AGUARDANDO COMANDO";
});

// RECONHECIMENTO DE VOZ
const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

let recognition = null;

if (SpeechRecognition && micBtn) {
  recognition = new SpeechRecognition();

  recognition.lang = "pt-BR";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  recognition.onstart = () => {
    recognitionActive = true;

    micBtn.classList.add("active");

    listenState.textContent = "ESTOU OUVINDO";
  };

  recognition.onend = () => {
    recognitionActive = false;

    micBtn.classList.remove("active");

    // CONTINUAR OUVINDO APÓS CADA RESPOSTA
    if (voiceMode && !busy && !speaking) {
      startListening();
    }
  };

  recognition.onerror = event => {
    recognitionActive = false;

    micBtn.classList.remove("active");

    console.error("ERRO DO MICROFONE:", event.error);

    if (
      event.error === "not-allowed" ||
      event.error === "service-not-allowed"
    ) {
      voiceMode = false;
      listenState.textContent = "PERMITA O MICROFONE";
      return;
    }

    if (voiceMode) {
      listenState.textContent = "RECONECTANDO MICROFONE";
    } else {
      listenState.textContent = "FALHA NO MICROFONE";
    }
  };

  recognition.onresult = event => {
    const transcript =
      event.results[0][0].transcript.trim();

    if (transcript) {
      sendMessage(
        transcript,
        pendingImage,
        true
      );
    }
  };

  // UM TOQUE INICIA, OUTRO TOQUE ENCERRA
  micBtn.addEventListener("click", async () => {
    if (voiceMode) {
      stopListening();
      return;
    }

    voiceMode = true;

    listenState.textContent = "ATIVANDO CONVERSA POR VOZ";

    // PREPARAR ÁUDIO NO TOQUE DO USUÁRIO
    await unlockAudio();

    startListening();
  });

} else if (micBtn) {
  micBtn.addEventListener("click", () => {
    listenState.textContent =
      "DITADO NÃO DISPONÍVEL NESTE NAVEGADOR";

    promptInput.focus();
  });
}

// VERIFICAR SERVIDOR
fetch("/api/status")
  .then(response => response.json())
  .then(status => {
    if (!status.configured) {
      statusText.textContent = "CONFIGURAÇÃO PENDENTE";
      listenState.textContent = "CONECTE A IA NO SERVIDOR";
    }
  })
  .catch(() => {
    statusText.textContent = "OFFLINE";
  });

// SERVICE WORKER
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch(() => {});
  });
}
