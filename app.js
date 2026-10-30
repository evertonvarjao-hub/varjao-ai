const form = document.getElementById("chatForm");
const promptInput = document.getElementById("prompt");
const messagesEl = document.getElementById("messages");
const micBtn = document.getElementById("micBtn");
const listenState = document.getElementById("listenState");
const statusText = document.getElementById("statusText");
const testVoiceBtn = document.getElementById("testVoiceBtn");
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
  if (!("speechSynthesis" in window)) {
    console.error("Síntese de voz não disponível.");
    return;
  }

  if (voiceSelect.value === "off") return;

  const synth = window.speechSynthesis;

  synth.cancel();

  function falar() {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 1;
    utterance.pitch = 1;

    const voices = synth.getVoices();
    const portugues = voices.filter(v =>
      v.lang && v.lang.toLowerCase().startsWith("pt")
    );

    const preferida = portugues.find(v =>
      voiceSelect.value === "female"
        ? /female|luciana|joana|maria/i.test(v.name)
        : /male|daniel|jorge|ricardo/i.test(v.name)
    );

    if (preferida || portugues[0]) {
      utterance.voice = preferida || portugues[0];
    }

    utterance.onerror = (event) => {
      console.error("Erro na reprodução de voz:", event.error);
    };

    synth.speak(utterance);
  }

  if (synth.getVoices().length > 0) {
    falar();
  } else {
    synth.onvoiceschanged = () => {
      synth.onvoiceschanged = null;
      falar();
    };

    setTimeout(() => {
      if (!synth.speaking && !synth.pending) {
        falar();
      }
    }, 1000);
  }
}

async function sendMessage(text) {
  const clean = text.trim();
  if (!clean || busy) return;
  busy = true;
  promptInput.value = "";
  addMessage("user", clean);
  history.push({ role: "user", content: clean });
  listenState.textContent = "PROCESSANDO";
  statusText.textContent = "CONECTANDO";
  try {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Erro ao conversar.");
    const answer = data.answer || "Não consegui responder.";
    history.push({ role: "assistant", content: answer });
    addMessage("assistant", answer);
    speak(answer);
    listenState.textContent = "AGUARDANDO COMANDO";
    statusText.textContent = "SISTEMA PRONTO";
  } catch (err) {
    addMessage("assistant", `Aviso: ${err.message}`);
    listenState.textContent = "VERIFIQUE A CONEXÃO";
    statusText.textContent = "ATENÇÃO";
  } finally {
    busy = false;
  }
}

form.addEventListener("submit", e => {
  e.preventDefault();
  sendMessage(promptInput.value);
});

document.getElementById("clearBtn").addEventListener("click", () => {
  history = [];
  messagesEl.replaceChildren();
  addMessage("assistant", "Conversa limpa. Estou pronto para começar novamente.");
  window.speechSynthesis?.cancel();
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
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
    if (listenState.textContent === "ESTOU OUVINDO") listenState.textContent = "AGUARDANDO COMANDO";
  };
  recognition.onerror = e => {
    listenState.textContent = e.error === "not-allowed" ? "PERMITA O MICROFONE" : "FALHA NO MICROFONE";
  };
  recognition.onresult = e => sendMessage(e.results[0][0].transcript);
  micBtn.addEventListener("click", () => {
    try { recognition.start(); } catch (_) { recognition.stop(); }
  });
} else {
  micBtn.addEventListener("click", () => {
    listenState.textContent = "DITADO NÃO DISPONÍVEL NESTE NAVEGADOR";
    promptInput.focus();
  });
  micBtn.title = "Use o ditado do teclado do iPhone se o reconhecimento não estiver disponível.";
}

fetch("/api/status").then(r => r.json()).then(s => {
  if (!s.configured) {
    statusText.textContent = "CONFIGURAÇÃO PENDENTE";
    listenState.textContent = "CONECTE A IA NO SERVIDOR";
  }
}).catch(() => { statusText.textContent = "OFFLINE"; });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
testVoiceBtn.addEventListener("click", () => {
  const synth = window.speechSynthesis;

  function listarVozes() {
    const vozes = synth.getVoices();

    const portugues = vozes.filter(v =>
      v.lang && v.lang.toLowerCase().startsWith("pt")
    );

    alert(
      portugues.length
        ? portugues.map((v, i) =>
            `${i + 1}. ${v.name} — ${v.lang}`
          ).join("\n")
        : "Nenhuma voz em português encontrada."
    );
  }

  if (synth.getVoices().length > 0) {
    listarVozes();
  } else {
    synth.onvoiceschanged = listarVozes;
  }
});
  const synth = window.speechSynthesis;

  if (!synth) {
    alert("Este navegador não oferece reprodução de voz.");
    return;
  }

  

  const teste = new SpeechSynthesisUtterance(
    "Olá! Eu sou o VARJÃO. Minha voz está funcionando."
  );

  teste.lang = "pt-BR";
  teste.rate = 1;
  teste.volume = 1;

  const vozes = synth.getVoices();
  const portugues = vozes.filter(v =>
    v.lang && v.lang.toLowerCase().startsWith("pt")
  );

  if (portugues.length > 0) {
    teste.voice = portugues[0];
  }

  teste.onerror = (e) => {
    alert("Erro ao reproduzir voz: " + e.error);
  };

  synth.speak(teste);
});
