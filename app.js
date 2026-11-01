
const form = document.getElementById("chatForm");
const promptInput = document.getElementById("prompt");
const messagesEl = document.getElementById("messages");
const micBtn = document.getElementById("micBtn");
const listenState = document.getElementById("listenState");
const statusText = document.getElementById("statusText");
const voiceSelect = document.getElementById("voiceSelect");
const imageInput = document.getElementById("imageInput");

let history = [];
let busy = false;
let pendingImage = null;

function addMessage(role, content) {
  const el = document.createElement("div");
  el.className = `message ${role}`;

  const who = document.createElement("span");
  who.className = "speaker";
  who.textContent = role === "user" ? "VOCÊ" : "VARJÃO";

  const p = document.createElement("p");
  p.textContent = content;

  el.append(who, p);
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addImageMessage(imageData, content) {
  const el = document.createElement("div");
  el.className = "message user";

  const who = document.createElement("span");
  who.className = "speaker";
  who.textContent = "VOCÊ";

  const img = document.createElement("img");
  img.src = imageData;
  img.alt = "Imagem enviada";
  img.style.maxWidth = "220px";
  img.style.width = "100%";
  img.style.height = "auto";
  img.style.borderRadius = "12px";
  img.style.display = "block";
  img.style.marginTop = "8px";

  const p = document.createElement("p");
  p.textContent = content;

  el.append(who, img, p);
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function speak(text) {
  if (!window.speechSynthesis || voiceSelect?.value === "off") return;

  const synth = window.speechSynthesis;
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pt-BR";
  utterance.rate = 0.95;
  utterance.pitch = 0.9;

  const voices = synth.getVoices();
  const ptVoices = voices.filter(v =>
    v.lang?.toLowerCase().startsWith("pt")
  );

  const maleVoice = ptVoices.find(v =>
    /male|daniel|jorge|ricardo|mascul/i.test(v.name)
  );

  if (maleVoice) utterance.voice = maleVoice;
  else if (ptVoices.length) utterance.voice = ptVoices[0];

  synth.speak(utterance);
}

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

        context.drawImage(img, 0, 0, canvas.width, canvas.height);

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

async function sendMessage(text, imageData = null) {
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
    speak(answer);

    if (imageData) {
      pendingImage = null;
      imageInput.value = "";
      promptInput.placeholder = "Fale comigo ou digite...";
    }

    listenState.textContent = "AGUARDANDO COMANDO";
    statusText.textContent = "SISTEMA PRONTO";

  } catch (error) {
    addMessage("assistant", "Aviso: " + error.message);
    listenState.textContent = "VERIFIQUE A CONEXÃO";
    statusText.textContent = "ATENÇÃO";

  } finally {
    busy = false;
  }
}

form?.addEventListener("submit", event => {
  event.preventDefault();
  sendMessage(promptInput.value, pendingImage);
});

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

document.getElementById("clearBtn")?.addEventListener("click", () => {
  history = [];
  pendingImage = null;

  if (imageInput) imageInput.value = "";

  promptInput.placeholder = "Fale comigo ou digite...";

  messagesEl.replaceChildren();

  addMessage(
    "assistant",
    "Conversa limpa. Estou pronto para começar novamente."
  );

  window.speechSynthesis?.cancel();
});

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

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
    listenState.textContent = "AGUARDANDO COMANDO";
  };

  recognition.onerror = event => {
    listenState.textContent =
      event.error === "not-allowed"
        ? "PERMITA O MICROFONE"
        : "FALHA NO MICROFONE";
  };

  recognition.onresult = event => {
    sendMessage(event.results[0][0].transcript, pendingImage);
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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch(() => {});
  });
}
