

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

// PARAR ÁUDIO ATUAL
function stopAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }
}

// VOZ NEURAL MASCULINA DO VARJÃO
async function speak(text) {
  stopAudio();

  try {
    listenState.textContent = "PREPARANDO VOZ NATURAL";

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
      throw new Error("Falha ao gerar voz neural.");
    }

    const audioBlob = await response.blob();

    if (!audioBlob.size) {
      throw new Error("O áudio recebido está vazio.");
    }

    currentAudioUrl = URL.createObjectURL(audioBlob);
    currentAudio = new Audio(currentAudioUrl);
    currentAudio.volume = 1;

    currentAudio.onplay = () => {
      listenState.textContent = "VARJÃO FALANDO";
    };

    currentAudio.onended = () => {
      stopAudio();
      listenState.textContent = "AGUARDANDO COMANDO";
    };

    currentAudio.onerror = () => {
      listenState.textContent = "ERRO NA REPRODUÇÃO";
    };

    await currentAudio.play();

  } catch (error) {
    console.error("Erro na voz:", error);
    listenState.textContent = "FALHA NA REPRODUÇÃO DA VOZ";
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

        const imageData = canvas.toDataURL("image/jpeg", 0.78);

        if (imageData.length > 7500000) {
          reject(new Error("A foto ficou muito grande. Escolha outra."));
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
// speakResponse define se o VARJÃO deve falar
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
      throw new Error(data.error || "Erro ao conversar.");
    }

    const answer = data.answer || "Não consegui responder.";

    history.push({
      role: "assistant",
      content: answer
    });

    addMessage("assistant", answer);

    // SÓ FALA QUANDO A MENSAGEM VEIO DO MICROFONE
    if (speakResponse) {
      speak(answer);
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
  }
}

// ENVIO PELO CAMPO DE TEXTO
// NÃO ATIVA A VOZ
form?.addEventListener("submit", event => {
  event.preventDefault();
  sendMessage(promptInput.value, pendingImage, false);
});

// SELEÇÃO DE IMAGEM
imageInput?.addEventListener("change", async () => {
  const file = imageInput.files?.[0];

  if (!file) return;

  try {
    listenState.textContent = "PREPARANDO FOTO";

    pendingImage = await prepareImage(file);

    promptInput.placeholder = "O que deseja saber sobre esta foto?";
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

  stopAudio();

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

if (SpeechRecognition && micBtn) {
  const recognition = new SpeechRecognition();

  recognition.lang = "pt-BR";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    micBtn.classList.add("active");
    listenState.textContent = "ESTOU OUVINDO";
  };

  recognition.onend = () => {
    micBtn.classList.remove("active");
  };

  recognition.onerror = event => {
    listenState.textContent =
      event.error === "not-allowed"
        ? "PERMITA O MICROFONE"
        : "FALHA NO MICROFONE";
  };

  // MICROFONE ATIVA A RESPOSTA FALADA
  recognition.onresult = event => {
    sendMessage(
      event.results[0][0].transcript,
      pendingImage,
      true
    );
  };

  micBtn.addEventListener("click", () => {
    try {
      recognition.start();
    } catch (_) {
      recognition.stop();
    }
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
