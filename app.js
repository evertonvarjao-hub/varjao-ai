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

// CAPTURA DA VOZ ORIGINAL
let microphoneStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let pendingTranscript = "";
let recordingMimeType = "";

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

// INICIAR CAPTURA DO ÁUDIO ORIGINAL
async function startVoiceRecording() {
  if (
    mediaRecorder &&
    mediaRecorder.state === "recording"
  ) {
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
          noiseSuppression: false,
          autoGainControl: false
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
      throw new Error("Gravação de áudio não suportada.");
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
  if (
    !mediaRecorder ||
    mediaRecorder.state === "inactive"
  ) {
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

  // EVITAR GRAVAÇÕES EXCESSIVAMENTE GRANDES
  if (audioBlob.size > 5 * 1024 * 1024) {
    console.warn("Áudio muito grande para análise.");
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

// ANALISAR CARACTERÍSTICAS ACÚSTICAS DA VOZ NO IPHONE
async function analyzeVoiceAudio(voiceAudio) {
  if (!voiceAudio?.data) {
    return null;
  }

  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      return null;
    }

    if (!audioContext) {
      audioContext = new AudioContextClass();
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    // CONVERTER BASE64 EM ÁUDIO
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

    // ANALISAR O ÁUDIO EM PEQUENOS INTERVALOS
    const frameSize = Math.max(
      1,
      Math.floor(sampleRate * 0.02)
    );

    const levels = [];

    for (
      let start = 0;
      start < channel.length;
      start += frameSize
    ) {
      const end = Math.min(
        start + frameSize,
        channel.length
      );

      let sum = 0;

      for (let i = start; i < end; i++) {
        sum += channel[i] * channel[i];
      }

      const rms = Math.sqrt(sum / (end - start));

      levels.push(rms);
    }

    if (!levels.length) {
      return null;
    }

    const maximum = Math.max(...levels);
    const average =
      levels.reduce((sum, value) => sum + value, 0) /
      levels.length;

    // IGNORAR PEQUENOS RUÍDOS DE FUNDO
    const threshold = Math.max(
      0.008,
      maximum * 0.12
    );

    const activeLevels = levels.filter(
      value => value > threshold
    );

    if (!activeLevels.length) {
      return null;
    }

    // 1. INTENSIDADE RELATIVA
    // É uma estimativa dependente do microfone e da distância.
    const activeAverage =
      activeLevels.reduce((sum, value) => sum + value, 0) /
      activeLevels.length;

    const intensity = Math.max(
      0,
      Math.min(100, Math.round(activeAverage * 350))
    );

    // 2. VARIAÇÃO DA INTENSIDADE
    // Mede mudanças no volume ao longo da fala.
    const activeMean = activeAverage;

    const variance =
      activeLevels.reduce((sum, value) => {
        return sum + Math.pow(value - activeMean, 2);
      }, 0) / activeLevels.length;

    const deviation = Math.sqrt(variance);

    const variation = Math.max(
      0,
      Math.min(
        100,
        Math.round((deviation / Math.max(activeMean, 0.001)) * 65)
      )
    );

    // 3. RITMO APROXIMADO
    // Conta mudanças entre silêncio e atividade sonora.
    // Não representa palavras por minuto.
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
      Math.min(
        100,
        Math.round(transitionsPerSecond * 18)
      )
    );

    return {
      intensity,
      variation,
      pace
    };

  } catch (error) {
    console.warn(
      "Não foi possível analisar a entonação:",
      error
    );

    return null;
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

// LIMPAR TEXTO PARA FALA NATURAL
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
  result = result.replace(/(?:[#*0-9]\uFE0F?\u20E3)/g, " ");

  try {
    result = result.replace(
      /[\p{Extended_Pictographic}\uFE0E\uFE0F\u200D\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}]/gu,
      " "
    );
  } catch (error) {
    console.log("Limpeza avançada de emojis indisponível.");
  }

  result = result.replace(/[*_~`#]/g, "");
  result = result.replace(/\|/g, ", ");
  result = result.replace(/\s+/g, " ");
  result = result.replace(/\s+([,.!?;:])/g, "$1");
  result = result.replace(/([,.!?;:])([^\s])/g, "$1 $2");
  result = result.replace(/([,.!?])\1+/g, "$1");

  return result.trim();
}

// VOZ NEURAL MASCULINA
async function speak(text) {
  stopAudio();

  const speechText = cleanSpeechText(text);

  if (!speechText) return;

  speaking = true;
  listenState.textContent = "PREPARANDO VOZ NATURAL";

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

  listenState.textContent = imageData
    ? "ANALISANDO IMAGEM"
    : voiceAudio
      ? "ANALISANDO SUA VOZ"
      : "PROCESSANDO";

  statusText.textContent = "CONECTANDO";

  try {
    // ANALISAR A VOZ LOCALMENTE NO IPHONE
    let voiceTone = null;

    if (voiceAudio) {
      voiceTone = await analyzeVoiceAudio(voiceAudio);
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: history,
        image: imageData || undefined,

        // ENVIAR SOMENTE OS INDICADORES NUMÉRICOS
        // A GRAVAÇÃO ORIGINAL NÃO É ENVIADA AO SERVIDOR
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

    addMessage("assistant", answer);

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

  restartTimer = setTimeout(async () => {
    if (!voiceMode || busy || speaking || recognitionActive) {
      return;
    }

    try {
      // COMEÇAR A GRAVAR A VOZ ANTES DO RECONHECIMENTO
      await startVoiceRecording();

      if (!voiceMode || busy || recognitionActive) {
        await stopVoiceRecording();
        return;
      }

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

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    try {
      mediaRecorder.stop();
    } catch (_) {}
  }

  stopMicrophoneTracks();
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

  recognition.onend = async () => {
    recognitionActive = false;

    micBtn.classList.remove("active");

    // FINALIZAR A GRAVAÇÃO DA FALA
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
      stopMicrophoneTracks();

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
      pendingTranscript = transcript;
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
