const form = document.getElementById("chatForm");
const promptInput = document.getElementById("prompt");
const messagesEl = document.getElementById("messages");
const micBtn = document.getElementById("micBtn");
const listenState = document.getElementById("listenState");
const statusText = document.getElementById("statusText");
const voiceSelect = document.getElementById("voiceSelect");

let history = [];
let recognition = null;
let busy = false;

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

function speak(text) {
  if (!("speechSynthesis" in window) || voiceSelect?.value === "off") return;

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
  else if (ptVoices[0]) utterance.voice = ptVoices[0];

  synth.speak(utterance);
}

async function sendMessage(text) {
  const clean = String(text || "").trim();
  if (!clean || busy) return;

  busy = true;
  promptInput.value = "";
  addMessage("user", clean);
  history.push({ role: "user", content: clean });

  listenState.textContent = "PROCESSANDO";
  statusText.textContent = "CONECTANDO";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Erro ao conversar.");
    }

    const answer = data.answer || "Não consegui responder.";

    history.push({ role: "assistant", content: answer });
    addMessage("assistant", answer);
    speak(answer);

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
  sendMessage(promptInput.value);
});

document.getElementById("clearBtn")?.addEventListener("click", () => {
  history = [];
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
  recognition = new SpeechRecognition();
  recognition.lang = "pt-BR";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    micBtn.classList.add("active");
    micBtn.innerHTML = "<span>●</span> OUVINDO";
    listenState.textContent = "ESTOU OUVINDO";
  };

  recognition.onend = () => {
    micBtn.classList.remove("active");
    micBtn.innerHTML = "<span>🎙</span> FALAR";

    if (listenState.textContent === "ESTOU OUVINDO") {
      listenState.textContent = "AGUARDANDO COMANDO";
    }
  };

  recognition.onerror = event => {
    listenState.textContent =
      event.error === "not-allowed"
        ? "PERMITA O MICROFONE"
        : "FALHA NO MICROFONE";
  };

  recognition.onresult = event => {
    sendMessage(event.results[0][0].transcript);
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
