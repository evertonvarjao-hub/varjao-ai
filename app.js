
const form = document.getElementById("chatForm");
const promptInput = document.getElementById("prompt");
const messagesEl = document.getElementById("messages");
const micBtn = document.getElementById("micBtn");
const listenState = document.getElementById("listenState");
const statusText = document.getElementById("statusText");
const imageInput = document.getElementById("imageInput");

// ELEMENTOS DA PRESENÇA E PERSONALIDADE
const presenceCore = document.getElementById("presenceCore");
const presencePanel = document.getElementById("presencePanel");
const heroGreeting = document.getElementById("heroGreeting");
const heroDescription = document.getElementById("heroDescription");
const personalityStatus = document.getElementById("personalityStatus");
const personalityText = document.getElementById("personalityText");
const presenceCaption = document.getElementById("presenceCaption");
const presenceIndicator = document.getElementById("presenceIndicator");
const voiceVisualizer = document.getElementById("voiceVisualizer");
const systemStatus = document.getElementById("systemStatus");

let currentPresence = "idle";

// PERSONALIDADE VISUAL
const presenceMessages = {
  idle: {
    greeting: "À sua disposição.",
    description: "Sua presença digital. Sua inteligência pessoal.",
    status: "PRESENTE",
    personality: "Estou por aqui. Pode falar comigo.",
    caption: "Aguardando você.",
    listen: "AGUARDANDO COMANDO"
  },

  listening: {
    greeting: "Estou ouvindo.",
    description: "Pode falar. Estou prestando atenção.",
    status: "OUVINDO",
    personality: "Sua voz está chegando até mim.",
    caption: "Estou acompanhando sua fala.",
    listen: "ESTOU OUVINDO"
  },

  thinking: {
    greeting: "Deixe comigo.",
    description: "Estou organizando as ideias.",
    status: "PROCESSANDO",
    personality: "Estou pensando na melhor resposta.",
    caption: "Analisando sua mensagem.",
    listen: "PROCESSANDO"
  },

  speaking: {
    greeting: "Vamos conversar.",
    description: "Estou falando com você.",
    status: "FALANDO",
    personality: "Minha voz está ativa. Pode me interromper.",
    caption: "Estou conversando com você.",
    listen: "VARJÃO FALANDO"
  },

  error: {
    greeting: "Tive um problema.",
    description: "Estou verificando a conexão.",
    status: "ATENÇÃO",
    personality: "Algo não saiu como esperado. Vamos tentar novamente.",
    caption: "Verifique a conexão.",
    listen: "VERIFIQUE A CONEXÃO"
  }
};

function setPresenceState(state, customText = "") {
  const validStates = [
    "idle",
    "listening",
    "thinking",
    "speaking",
    "error"
  ];

  if (!validStates.includes(state)) {
    state = "idle";
  }

  currentPresence = state;

  const data = presenceMessages[state];

  if (presenceCore) {
    presenceCore.classList.remove(
      "idle",
      "listening",
      "thinking",
      "speaking",
      "error"
    );

    presenceCore.classList.add(state);
  }

  if (presencePanel) {
    presencePanel.classList.remove(
      "idle",
      "listening",
      "thinking",
      "speaking",
      "error"
    );

    presencePanel.classList.add(state);
  }

  if (heroGreeting) {
    heroGreeting.textContent = data.greeting;
  }

  if (heroDescription) {
    heroDescription.textContent = data.description;
  }

  if (personalityStatus) {
    personalityStatus.textContent = data.status;
  }

  if (personalityText) {
    personalityText.textContent = customText || data.personality;
  }

  if (presenceCaption) {
    presenceCaption.textContent = data.caption;
  }

  if (presenceIndicator) {
    presenceIndicator.textContent = data.status;
  }

  if (listenState) {
    listenState.textContent = data.listen;
  }

  if (voiceVisualizer) {
    voiceVisualizer.classList.toggle(
      "active",
      state === "speaking"
    );

    voiceVisualizer.classList.toggle(
      "listening",
      state === "listening"
    );

    voiceVisualizer.classList.toggle(
      "thinking",
      state === "thinking"
    );
  }

  if (systemStatus && state !== "error") {
    systemStatus.textContent =
      state === "idle" ? "SISTEMA PRONTO" :
      state === "listening" ? "MICROFONE ATIVO" :
      state === "thinking" ? "INTELIGÊNCIA ATIVA" :
      "VOZ ATIVA";
  }
}

// MEMÓRIA LOCAL
const HISTORY_KEY = "varjao_history_v2";
const MEMORY_KEY = "varjao_memory_v1";

let history = [];
let memories = [];

let busy = false;
let pendingImage = null;

let voiceMode = false;
let recognitionActive = false;
let speaking = false;
let restartTimer = null;
let interruptedSpeech = false;

let audioContext = null;
let currentSource = null;
let currentAudio = null;
let currentAudioUrl = null;
let playbackSequence = 0;
let currentPlaybackResolve = null;

let microphoneStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let pendingTranscript = "";
let recordingMimeType = "";

let recognition = null;

// CARREGAR MEMÓRIA E HISTÓRICO
function loadLocalData() {
  try {
    const savedHistory = localStorage.getItem(HISTORY_KEY);
    const savedMemories = localStorage.getItem(MEMORY_KEY);

    history = savedHistory ? JSON.parse(savedHistory) : [];
    memories = savedMemories ? JSON.parse(savedMemories) : [];

    if (!Array.isArray(history)) history = [];
    if (!Array.isArray(memories)) memories = [];

    history = history.filter(item =>
      item &&
      (item.role === "user" || item.role === "assistant") &&
      typeof item.content === "string"
    ).slice(-40);

    memories = memories.filter(item =>
      typeof item === "string"
    ).slice(-30);

  } catch (error) {
    console.error("ERRO AO CARREGAR MEMÓRIA:", error);
    history = [];
    memories = [];
  }
}

function saveHistory() {
  try {
    history = history.slice(-40);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error("ERRO AO SALVAR HISTÓRICO:", error);
  }
}

function saveMemories() {
  try {
    memories = memories.slice(-30);
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memories));
  } catch (error) {
    console.error("ERRO AO SALVAR MEMÓRIA:", error);
  }
}

// MEMÓRIA AUTOMÁTICA: EVITAR DADOS SENSÍVEIS
function containsSensitiveInformation(text) {
  const sensitivePatterns = [
    /\bsenha\b/i,
    /\bpassword\b/i,
    /\bcpf\b/i,
    /\bcnpj\b/i,
    /\bcartão de crédito\b/i,
    /\bcartao de credito\b/i,
    /\bdados bancários\b/i,
    /\bdados bancarios\b/i,
    /\bconta bancária\b/i,
    /\bconta bancaria\b/i,
    /\bpix\b/i,
    /\bendereço completo\b/i,
    /\bdiagnóstico\b/i,
    /\bdiagnostico\b/i,
    /\bdoença\b/i,
    /\bdoenca\b/i,
    /\bmedicamento\b/i,
    /\bremédio\b/i,
    /\bremedio\b/i,
    /\btratamento médico\b/i,
    /\btratamento medico\b/i,
    /\bansiedade\b/i,
    /\bdepressão\b/i,
    /\bdepressao\b/i,
    /\bterapia\b/i,
    /\breligião\b/i,
    /\breligiao\b/i,
    /\bigreja\b/i,
    /\bpolítica\b/i,
    /\bpolitica\b/i,
    /\borientação sexual\b/i,
    /\borientacao sexual\b/i,
    /\bvida sexual\b/i,
    /\braça\b/i,
    /\braca\b/i,
    /\betnia\b/i
  ];

  return sensitivePatterns.some(pattern => pattern.test(text));
}

// MEMÓRIA AUTOMÁTICA: IDENTIFICAR INFORMAÇÕES ÚTEIS
function autoRememberInformation(text) {
  const value = String(text || "").trim();

  if (value.length < 12 || value.length > 220) return;
  if (containsSensitiveInformation(value)) return;

  const lower = value.toLowerCase();

  const categories = [
    {
      name: "Estudo",
      triggers: [
        "estou estudando",
        "estudo",
        "faço curso de",
        "estou fazendo curso de",
        "estou cursando"
      ]
    },
    {
      name: "Projeto",
      triggers: [
        "meu projeto é",
        "meu projeto e",
        "estou desenvolvendo",
        "estou criando",
        "estou trabalhando no projeto"
      ]
    },
    {
      name: "Profissão",
      triggers: [
        "eu trabalho como",
        "trabalho como",
        "minha profissão é",
        "minha profissao e",
        "sou técnico de enfermagem",
        "sou tecnica de enfermagem"
      ]
    },
    {
      name: "Preferência",
      triggers: [
        "eu prefiro",
        "prefiro",
        "gosto de",
        "não gosto de",
        "nao gosto de",
        "não quero",
        "nao quero"
      ]
    },
    {
      name: "Objetivo",
      triggers: [
        "meu objetivo é",
        "meu objetivo e",
        "quero aprender",
        "estou tentando aprender",
        "pretendo aprender"
      ]
    },
    {
      name: "Preferência de conversa",
      triggers: [
        "quero que você sempre",
        "quero que voce sempre",
        "prefiro que você",
        "prefiro que voce",
        "gostaria que você",
        "gostaria que voce"
      ]
    }
  ];

  const category = categories.find(item =>
    item.triggers.some(trigger => lower.includes(trigger))
  );

  if (!category) return;

  const exists = memories.some(item =>
    item.toLowerCase() === value.toLowerCase()
  );

  if (exists) return;

  if (["Estudo", "Projeto", "Profissão"].includes(category.name)) {
    memories = memories.filter(item => {
      const old = item.toLowerCase();

      if (category.name === "Estudo") {
        return !old.includes("estou estudando") &&
          !old.includes("estou cursando") &&
          !old.includes("faço curso de") &&
          !old.includes("estudo ");
      }

      if (category.name === "Projeto") {
        return !old.includes("meu projeto é") &&
          !old.includes("estou desenvolvendo") &&
          !old.includes("estou criando");
      }

      if (category.name === "Profissão") {
        return !old.includes("trabalho como") &&
          !old.includes("minha profissão é") &&
          !old.includes("sou técnico de enfermagem") &&
          !old.includes("sou tecnica de enfermagem");
      }

      return true;
    });
  }

  memories.push(value);
  saveMemories();
}

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

// RESTAURAR CONVERSA
function restoreConversation() {
  messagesEl.replaceChildren();

  if (!history.length) {
    addMessage(
      "assistant",
      "Olá! Sou o VARJÃO. Nossa memória está pronta. Vamos continuar?"
    );
    return;
  }

  history.forEach(item => {
    addMessage(item.role, item.content);
  });
}

// PREPARAR ÁUDIO
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

// INICIAR GRAVAÇÃO
async function startVoiceRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    return true;
  }

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Captura de áudio indisponível.");
    }

    microphoneStream =
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

    recordedChunks = [];

    const mimeOptions = [
      "audio/mp4",
      "audio/webm;codecs=opus",
      "audio/webm"
    ];

    recordingMimeType = "";

    if (window.MediaRecorder?.isTypeSupported) {
      recordingMimeType = mimeOptions.find(type =>
        MediaRecorder.isTypeSupported(type)
      ) || "";
    }

    if (!window.MediaRecorder) {
      throw new Error("Gravação não suportada.");
    }

    mediaRecorder = recordingMimeType
      ? new MediaRecorder(microphoneStream, {
          mimeType: recordingMimeType
        })
      : new MediaRecorder(microphoneStream);

    recordingMimeType =
      mediaRecorder.mimeType ||
      recordingMimeType ||
      "audio/webm";

    mediaRecorder.ondataavailable = event => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.start();

    return true;

  } catch (error) {
    console.error("CAPTURA DE VOZ:", error);
    stopMicrophoneTracks();

    listenState.textContent =
      "OUVINDO SEM ANÁLISE DE ENTONAÇÃO";

    return false;
  }
}

// ENCERRAR MICROFONE
function stopMicrophoneTracks() {
  if (microphoneStream) {
    microphoneStream.getTracks().forEach(track => {
      track.stop();
    });

    microphoneStream = null;
  }
}

// FINALIZAR GRAVAÇÃO
async function stopVoiceRecording() {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    stopMicrophoneTracks();
    return null;
  }

  const recorder = mediaRecorder;

  const audioBlob = await new Promise(resolve => {
    recorder.addEventListener("stop", () => {
      const blob = new Blob(recordedChunks, {
        type: recordingMimeType || recorder.mimeType
      });

      resolve(blob);
    }, { once: true });

    try {
      recorder.stop();
    } catch (error) {
      console.error("Erro ao finalizar gravação:", error);
      resolve(null);
    }
  });

  mediaRecorder = null;
  stopMicrophoneTracks();

  if (!audioBlob || !audioBlob.size) {
    recordedChunks = [];
    return null;
  }

  if (audioBlob.size > 5 * 1024 * 1024) {
    console.warn("Áudio muito grande.");
    recordedChunks = [];
    return null;
  }

  const audioData = await new Promise(resolve => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",")
        ? result.split(",")[1]
        : "";

      resolve(base64 ? {
        data: base64,
        mimeType: audioBlob.type || recordingMimeType
      } : null);
    };

    reader.onerror = () => resolve(null);
    reader.readAsDataURL(audioBlob);
  });

  recordedChunks = [];
  return audioData;
}

// ANALISAR VOZ
async function analyzeVoiceAudio(voiceAudio) {
  if (!voiceAudio?.data) return null;

  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return null;

    if (!audioContext) {
      audioContext = new AudioContextClass();
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const binary = atob(voiceAudio.data);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const audioBuffer = await audioContext.decodeAudioData(
      bytes.buffer.slice(0)
    );

    if (!audioBuffer || audioBuffer.length === 0) {
      return null;
    }

    const channel = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    const frameSize = Math.max(
      1,
      Math.floor(sampleRate * 0.02)
    );

    const levels = [];

    for (let start = 0; start < channel.length; start += frameSize) {
      const end = Math.min(
        start + frameSize,
        channel.length
      );

      let sum = 0;

      for (let i = start; i < end; i++) {
        sum += channel[i] * channel[i];
      }

      levels.push(Math.sqrt(sum / (end - start)));
    }

    if (!levels.length) return null;

    const maximum = Math.max(...levels);

    const threshold = Math.max(
      0.008,
      maximum * 0.12
    );

    const activeLevels = levels.filter(
      value => value > threshold
    );

    if (!activeLevels.length) return null;

    const activeAverage =
      activeLevels.reduce((sum, value) => sum + value, 0) /
      activeLevels.length;

    const intensity = Math.max(
      0,
      Math.min(100, Math.round(activeAverage * 350))
    );

    const variance =
      activeLevels.reduce((sum, value) => {
        return sum + Math.pow(value - activeAverage, 2);
      }, 0) / activeLevels.length;

    const deviation = Math.sqrt(variance);

    const variation = Math.max(
      0,
      Math.min(
        100,
        Math.round((deviation / Math.max(activeAverage, 0.001)) * 65)
      )
    );

    let transitions = 0;
    let wasActive = false;

    for (const level of levels) {
      const isActive = level > threshold;

      if (isActive && !wasActive) {
        transitions++;
      }

      wasActive = isActive;
    }

    const durationSeconds = channel.length / sampleRate;

    const transitionsPerSecond =
      transitions / Math.max(durationSeconds, 0.1);

    const pace = Math.max(
      0,
      Math.min(100, Math.round(transitionsPerSecond * 18))
    );

    return { intensity, variation, pace };

  } catch (error) {
    console.warn("Erro na análise da voz:", error);
    return null;
  }
}

// MEMÓRIA: SALVAR INFORMAÇÃO
function rememberInformation(text) {
  const value = String(text || "").trim();

  if (!value || value.length < 3) {
    return "Preciso que você me diga qual informação devo guardar.";
  }

  const exists = memories.some(item =>
    item.toLowerCase() === value.toLowerCase()
  );

  if (exists) {
    return "Essa informação já está guardada na minha memória.";
  }

  memories.push(value);
  saveMemories();

  return "Pode deixar! Guardei essa informação na minha memória deste iPhone.";
}

// MEMÓRIA: CONSULTAR
function showMemories() {
  if (!memories.length) {
    return "Ainda não tenho informações guardadas na memória. Você pode me dizer: VARJÃO, lembre que...";
  }

  return "Estas são as informações que tenho guardadas:\n\n" +
    memories.map((item, index) =>
      `${index + 1}. ${item}`
    ).join("\n");
}

// MEMÓRIA: APAGAR
function forgetInformation(text) {
  const value = String(text || "").trim().toLowerCase();

  if (!value) return null;

  const before = memories.length;

  memories = memories.filter(item =>
    !item.toLowerCase().includes(value)
  );

  saveMemories();

  if (memories.length === before) {
    return "Não encontrei essa informação na memória.";
  }

  return "Pronto. Apaguei essa informação da minha memória.";
}

// IDENTIFICAR COMANDOS DE MEMÓRIA
function handleMemoryCommand(text) {
  const value = String(text || "").trim();
  const lower = value.toLowerCase();

  if (
    /\b(apague|apaga|limpe|limpa|delete|deleta)\b/.test(lower) &&
    /\b(todas|tudo|minhas|memórias|memoria|memória)\b/.test(lower)
  ) {
    memories = [];
    saveMemories();

    return "Apaguei todas as informações da memória deste iPhone.";
  }

  if (
    /\b(o que você lembra|o que voce lembra|minhas memórias|minhas memorias|consultar memória|consultar memoria)\b/.test(lower)
  ) {
    return showMemories();
  }

  const rememberMatch = value.match(
    /(?:varjão[, ]*)?(?:lembre(?:-se)? que|lembra que|guarde que|memorize que|salve na memória que|salve na memoria que)\s+(.+)/i
  );

  if (rememberMatch) {
    return rememberInformation(rememberMatch[1]);
  }

  const forgetMatch = value.match(
    /(?:varjão[, ]*)?(?:esqueça que|esquece que|apague da memória que|apague da memoria que)\s+(.+)/i
  );

  if (forgetMatch) {
    return forgetInformation(forgetMatch[1]);
  }

  return null;
}

// CONTEXTO DE MEMÓRIA PARA A IA
function buildMemoryContext() {
  if (!memories.length) return "";

  return `
INFORMAÇÕES DA MEMÓRIA AUTORIZADAS PELO USUÁRIO:
${memories.map((item, index) =>
  `${index + 1}. ${item}`
).join("\n")}

Use essas informações somente quando forem relevantes.
Não invente informações adicionais.
Não diga que lembra de algo que não esteja nesta lista ou no histórico disponível.
`;
}

// PARAR ÁUDIO IMEDIATAMENTE
function stopAudio() {
  playbackSequence++;

  if (currentPlaybackResolve) {
    const resolve = currentPlaybackResolve;
    currentPlaybackResolve = null;
    resolve();
  }

  if (currentSource) {
    const source = currentSource;
    currentSource = null;

    try {
      source.stop();
    } catch (_) {}
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

// LIMPAR TEXTO PARA FALA
function cleanSpeechText(text) {
  let result = String(text || "");

  result = result.replace(/```[\s\S]*?```/g, " ");
  result = result.replace(/^#{1,6}\s+.*$/gm, " ");
  result = result.replace(/^\s*[-*•]\s+/gm, ". ");
  result = result.replace(/^\s*\d+[.)]\s+/gm, ". ");
  result = result.replace(/^\s*>\s?/gm, "");
  result = result.replace(/^\s*[-_]{3,}\s*$/gm, " ");
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  result = result.replace(/https?:\/\/\S+/gi, "");
  result = result.replace(/:[a-z0-9_+-]{2,}:/gi, " ");

  try {
    result = result.replace(
      /[\p{Extended_Pictographic}\uFE0E\uFE0F\u200D\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}]/gu,
      " "
    );
  } catch (_) {}

  result = result.replace(/[*_~`#]/g, "");
  result = result.replace(/\|/g, ", ");
  result = result.replace(/\s+/g, " ");
  result = result.replace(/\s+([,.!?;:])/g, "$1");
  result = result.replace(/([,.!?;:])([^\s])/g, "$1 $2");
  result = result.replace(/([,.!?])\1+/g, "$1");

  return result.trim();
}

// VOZ NEURAL COM PROTEÇÃO CONTRA INTERRUPÇÕES
async function speak(text) {
  stopAudio();

  const playbackId = playbackSequence;
  const speechText = cleanSpeechText(text);

  if (!speechText) return;

  speaking = true;
  interruptedSpeech = false;

  setPresenceState(
    "speaking",
    "Estou falando com você. Pode me interromper quando quiser."
  );

  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: speechText.slice(0, 2500)
      })
    });

    if (playbackId !== playbackSequence) return;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      throw new Error(
        errorData.error || "Falha ao gerar voz neural."
      );
    }

    const audioData = await response.arrayBuffer();

    if (playbackId !== playbackSequence) return;

    if (!audioData.byteLength) {
      throw new Error("O áudio recebido está vazio.");
    }

    if (audioContext) {
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      if (playbackId !== playbackSequence) return;

      const audioBuffer = await audioContext.decodeAudioData(
        audioData.slice(0)
      );

      if (playbackId !== playbackSequence) return;

      const source = audioContext.createBufferSource();

      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      currentSource = source;

      await new Promise((resolve, reject) => {
        currentPlaybackResolve = resolve;

        source.onended = () => {
          if (currentSource === source) {
            currentSource = null;
          }

          if (currentPlaybackResolve === resolve) {
            currentPlaybackResolve = null;
          }

          resolve();
        };

        try {
          if (playbackId !== playbackSequence) {
            resolve();
            return;
          }

          source.start(0);

          if (voiceMode) {
            startListening(true);
          }

        } catch (error) {
          reject(error);
        }
      });

    } else {
      const blob = new Blob(
        [audioData],
        { type: "audio/mpeg" }
      );

      if (playbackId !== playbackSequence) return;

      currentAudioUrl = URL.createObjectURL(blob);
      currentAudio = new Audio(currentAudioUrl);

      currentAudio.volume = 1;

      await new Promise((resolve, reject) => {
        const audio = currentAudio;

        currentPlaybackResolve = resolve;

        audio.onended = () => {
          if (currentAudio === audio) {
            currentAudio = null;
          }

          if (currentPlaybackResolve === resolve) {
            currentPlaybackResolve = null;
          }

          resolve();
        };

        audio.onerror = () => {
          reject(new Error("Erro na reprodução do áudio."));
        };

        audio.play().then(() => {
          if (playbackId !== playbackSequence) {
            resolve();
            return;
          }

          if (voiceMode) {
            startListening(true);
          }

        }).catch(reject);
      });
    }

  } catch (error) {
    if (playbackId === playbackSequence) {
      console.error("ERRO NA REPRODUÇÃO:", error);

      setPresenceState(
        "error",
        "Não consegui reproduzir minha voz. O texto da resposta continua disponível."
      );
    }

  } finally {
    if (playbackId === playbackSequence) {
      if (currentSource) {
        try {
          currentSource.stop();
        } catch (_) {}

        currentSource = null;
      }

      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }

      if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
        currentAudioUrl = null;
      }

      speaking = false;

      if (voiceMode) {
        setPresenceState(
          "listening",
          "Terminei de falar. Estou esperando você continuar."
        );
      } else {
        setPresenceState("idle");
      }
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
  speakResponse = false,
  voiceAudio = null
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

  saveHistory();

  // COMANDOS LOCAIS DE MEMÓRIA
  if (!imageData) {
    const memoryResponse = handleMemoryCommand(messageText);

    if (memoryResponse !== null) {
      history.push({
        role: "assistant",
        content: memoryResponse
      });

      saveHistory();
      addMessage("assistant", memoryResponse);

      busy = false;

      if (speakResponse && voiceMode) {
        await speak(memoryResponse);
      } else if (voiceMode) {
        setPresenceState("listening");
      } else {
        setPresenceState("idle");
      }

      return;
    }

    // APRENDIZADO AUTOMÁTICO SELETIVO
    autoRememberInformation(messageText);
  }

  setPresenceState(
    "thinking",
    imageData
      ? "Estou observando a imagem e organizando o que consigo identificar."
      : voiceAudio
        ? "Estou considerando sua fala, suas palavras e o contexto."
        : "Estou analisando sua mensagem para formular uma resposta."
  );

  statusText.textContent = "CONECTANDO";

  try {
    let voiceTone = null;

    if (voiceAudio) {
      voiceTone = await analyzeVoiceAudio(voiceAudio);
    }

    const memoryContext = buildMemoryContext();
    const messagesForAI = history.slice(-6);

    if (memoryContext && messagesForAI.length) {
      messagesForAI.splice(
        Math.max(0, messagesForAI.length - 1),
        0,
        {
          role: "assistant",
          content: memoryContext
        }
      );
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: messagesForAI,
        image: imageData || undefined,
        voiceTone: voiceTone || undefined
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

    saveHistory();
    addMessage("assistant", answer);

    if (imageData) {
      pendingImage = null;
      imageInput.value = "";
      promptInput.placeholder = "Fale comigo ou digite...";
    }

    statusText.textContent = "SISTEMA PRONTO";

    busy = false;

    if (speakResponse && voiceMode) {
      await speak(answer);
    } else if (voiceMode) {
      setPresenceState("listening");
    } else {
      setPresenceState("idle");
    }

  } catch (error) {
    addMessage("assistant", "Aviso: " + error.message);

    history.push({
      role: "assistant",
      content: "Aviso: " + error.message
    });

    saveHistory();

    statusText.textContent = "ATENÇÃO";

    setPresenceState(
      "error",
      error.message || "Não consegui concluir sua solicitação."
    );

  } finally {
    busy = false;

    if (voiceMode && !recognitionActive && !speaking) {
      setPresenceState("listening");
      startListening();
    }
  }
}

// INICIAR ESCUTA
function startListening(force = false) {
  if (
    !voiceMode ||
    busy ||
    recognitionActive ||
    (!force && speaking)
  ) {
    return;
  }

  if (!recognition) return;

  clearTimeout(restartTimer);

  restartTimer = setTimeout(async () => {
    if (
      !voiceMode ||
      busy ||
      recognitionActive ||
      (!force && speaking)
    ) {
      return;
    }

    try {
      await startVoiceRecording();

      if (!voiceMode || busy || recognitionActive) {
        await stopVoiceRecording();
        return;
      }

      recognition.start();

    } catch (error) {
      console.log("Aguardando microfone:", error.message);
    }
  }, 250);
}

// ENCERRAR CONVERSA
function stopListening() {
  voiceMode = false;

  clearTimeout(restartTimer);

  if (recognitionActive && recognition) {
    try {
      recognition.stop();
    } catch (_) {}
  }

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    try {
      mediaRecorder.stop();
    } catch (_) {}
  }

  stopMicrophoneTracks();
  stopAudio();

  micBtn?.classList.remove("active");

  setPresenceState("idle");
  listenState.textContent = "CONVERSA POR VOZ ENCERRADA";
}

// ENVIO PELO CAMPO DE TEXTO
form?.addEventListener("submit", event => {
  event.preventDefault();

  if (speaking) {
    interruptedSpeech = true;
    stopAudio();
  }

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
    setPresenceState(
      "thinking",
      "Estou preparando sua imagem para analisar."
    );

    pendingImage = await prepareImage(file);

    promptInput.placeholder =
      "O que deseja saber sobre esta foto?";

    promptInput.focus();

    setPresenceState(
      "idle",
      "Sua foto está pronta. Agora me diga o que deseja descobrir."
    );

    listenState.textContent = "FOTO PRONTA PARA ENVIAR";

  } catch (error) {
    pendingImage = null;
    imageInput.value = "";

    addMessage("assistant", error.message);

    setPresenceState("error", error.message);
  }
});

// BOTÃO LIMPAR CONVERSA
document.getElementById("clearBtn")?.addEventListener("click", () => {
  history = [];
  pendingImage = null;

  saveHistory();

  if (imageInput) {
    imageInput.value = "";
  }

  promptInput.placeholder = "Fale comigo ou digite...";

  stopListening();

  messagesEl.replaceChildren();

  addMessage(
    "assistant",
    "Conversa limpa. Minhas memórias continuam guardadas. Estou pronto para começar novamente."
  );

  setPresenceState(
    "idle",
    "Tudo organizado. Podemos começar uma nova conversa."
  );
});

// RECONHECIMENTO DE VOZ
const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

if (SpeechRecognition && micBtn) {
  recognition = new SpeechRecognition();

  recognition.lang = "pt-BR";
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  recognition.onstart = () => {
    recognitionActive = true;

    micBtn.classList.add("active");

    if (!speaking) {
      setPresenceState(
        "listening",
        "Estou ouvindo sua voz. Pode falar naturalmente."
      );
    } else {
      listenState.textContent = "PODE ME INTERROMPER";
    }
  };

  recognition.onend = async () => {
    recognitionActive = false;

    micBtn.classList.remove("active");

    const transcript = pendingTranscript;
    pendingTranscript = "";

    const voiceAudio = await stopVoiceRecording();

    if (transcript && voiceMode) {
      sendMessage(
        transcript,
        pendingImage,
        true,
        voiceAudio
      );

      return;
    }

    if (voiceMode && !busy) {
      startListening(speaking);
    } else if (!voiceMode && !speaking && !busy) {
      setPresenceState("idle");
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
      stopMicrophoneTracks();

      setPresenceState(
        "error",
        "Preciso de autorização para acessar o microfone."
      );

      return;
    }

    if (voiceMode && !busy) {
      setPresenceState(
        "listening",
        "Estou tentando reconectar o microfone."
      );

      startListening(speaking);
    }
  };

  recognition.onresult = event => {
    let transcript = "";
    let finalResult = false;

    for (
      let i = event.resultIndex;
      i < event.results.length;
      i++
    ) {
      const result = event.results[i];

      if (result[0]?.transcript) {
        transcript += result[0].transcript + " ";
      }

      if (result.isFinal) {
        finalResult = true;
      }
    }

    transcript = transcript.trim();

    if (!transcript) return;

    if (speaking && transcript.length >= 3) {
      interruptedSpeech = true;

      stopAudio();

      setPresenceState(
        "listening",
        "Você me interrompeu. Estou prestando atenção no que está dizendo."
      );
    }

    pendingTranscript = transcript;

    if (finalResult) {
      setPresenceState(
        "thinking",
        "Entendi o que você disse. Estou preparando minha resposta."
      );
    }
  };

  micBtn.addEventListener("click", async () => {
    if (voiceMode) {
      stopListening();
      return;
    }

    voiceMode = true;

    setPresenceState(
      "listening",
      "Conversa por voz ativada. Estou pronto para ouvir você."
    );

    await unlockAudio();

    startListening();
  });

} else if (micBtn) {
  micBtn.addEventListener("click", () => {
    setPresenceState(
      "error",
      "O reconhecimento de voz não está disponível neste navegador. Você pode digitar sua mensagem."
    );

    promptInput.focus();
  });
}

// VERIFICAR SERVIDOR
fetch("/api/status")
  .then(response => response.json())
  .then(status => {
    if (!status.configured) {
      statusText.textContent = "CONFIGURAÇÃO PENDENTE";

      setPresenceState(
        "error",
        "A conexão com a inteligência precisa ser configurada no servidor."
      );

      return;
    }

    statusText.textContent = "SISTEMA PRONTO";

    if (systemStatus) {
      systemStatus.textContent = "GROQ CONECTADA";
    }
  })
  .catch(() => {
    statusText.textContent = "OFFLINE";

    setPresenceState(
      "error",
      "Não consegui alcançar o servidor. Verifique sua conexão."
    );
  });

// INICIALIZAÇÃO
loadLocalData();
restoreConversation();
setPresenceState("idle");

// SERVICE WORKER
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch(() => {});
  });
}
