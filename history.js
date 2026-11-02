
/* =========================================
   VARJÃO AI — SISTEMA DE HISTÓRICO
   ========================================= */

(function () {
  "use strict";

  const STORAGE_KEY = "varjao_conversations_v1";
  const LEGACY_KEY = "varjao_history_v2";
  const MAX_CONVERSATIONS = 100;

  let conversations = [];
  let activeConversationId = null;

  const historyBtn = document.getElementById("historyBtn");
  const historyOverlay = document.getElementById("historyOverlay");
  const historyClose = document.getElementById("historyClose");
  const historyList = document.getElementById("historyList");
  const newConversationBtn = document.getElementById("newConversationBtn");
  const clearBtn = document.getElementById("clearBtn");
  const messagesEl = document.getElementById("messages");

  if (
    !historyBtn ||
    !historyOverlay ||
    !historyList ||
    !newConversationBtn ||
    !messagesEl
  ) {
    console.error("Elementos do histórico não encontrados.");
    return;
  }

  const originalSaveHistory = window.saveHistory;
  const originalRestoreConversation = window.restoreConversation;

  function createId() {
    if (window.crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return "conv_" + Date.now() + "_" +
      Math.random().toString(36).slice(2, 10);
  }

  function createConversation(messages = []) {
    return {
      id: createId(),
      title: "Nova conversa",
      messages: Array.isArray(messages)
        ? messages.map(item => ({
            role: item.role,
            content: item.content
          }))
        : [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  function getConversationTitle(messages) {
    const firstUserMessage = messages.find(item =>
      item.role === "user" &&
      typeof item.content === "string" &&
      item.content.trim()
    );

    if (!firstUserMessage) {
      return "Nova conversa";
    }

    let title = firstUserMessage.content
      .replace(/\s+/g, " ")
      .trim();

    if (title.length > 42) {
      title = title.slice(0, 42).trim() + "...";
    }

    return title;
  }

  function persistConversations() {
    try {
      conversations = conversations
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_CONVERSATIONS);

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(conversations)
      );
    } catch (error) {
      console.error("Erro ao salvar histórico:", error);
    }
  }

  function loadConversations() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          conversations = parsed.filter(item =>
            item &&
            typeof item.id === "string" &&
            Array.isArray(item.messages)
          );
        }
      }

      if (!conversations.length) {
        let oldMessages = [];

        try {
          const legacy = localStorage.getItem(LEGACY_KEY);
          const parsedLegacy = legacy ? JSON.parse(legacy) : [];

          if (Array.isArray(parsedLegacy)) {
            oldMessages = parsedLegacy;
          }
        } catch (_) {}

        if (oldMessages.length) {
          const migrated = createConversation(oldMessages);
          migrated.title = getConversationTitle(oldMessages);
          conversations.push(migrated);
        }
      }

      if (!conversations.length) {
        conversations.push(createConversation());
      }

      const current = conversations.find(item =>
        item.messages.length > 0
      ) || conversations[0];

      activeConversationId = current.id;

      window.historySystemReady = true;
      persistConversations();

    } catch (error) {
      console.error("Erro ao carregar histórico:", error);

      conversations = [createConversation()];
      activeConversationId = conversations[0].id;
    }
  }

  function getActiveConversation() {
    return conversations.find(item =>
      item.id === activeConversationId
    );
  }

  function saveCurrentConversation() {
    const current = getActiveConversation();

    if (!current) return;

    current.messages = history.map(item => ({
      role: item.role,
      content: item.content
    }));

    current.title = getConversationTitle(current.messages);
    current.updatedAt = Date.now();

    persistConversations();
    renderHistory();
  }

  // SUBSTITUI O SALVAMENTO ANTIGO
  window.saveHistory = function () {
    if (typeof originalSaveHistory === "function") {
      originalSaveHistory();
    }

    saveCurrentConversation();
  };

  function openHistory() {
    renderHistory();

    historyOverlay.classList.add("active");
    historyOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("history-open");
  }

  function closeHistory() {
    historyOverlay.classList.remove("active");
    historyOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("history-open");
  }

  function renderHistory() {
    historyList.replaceChildren();

    if (!conversations.length) {
      const empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent = "Suas conversas aparecerão aqui.";
      historyList.appendChild(empty);
      return;
    }

    const ordered = [...conversations].sort(
      (a, b) => b.updatedAt - a.updatedAt
    );

    ordered.forEach(conversation => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "history-item";

      if (conversation.id === activeConversationId) {
        button.classList.add("active");
      }

      const title = document.createElement("strong");
      title.textContent = conversation.title || "Nova conversa";

      const date = document.createElement("small");
      date.textContent = formatDate(conversation.updatedAt);

      button.append(title, date);

      button.addEventListener("click", () => {
        openConversation(conversation.id);
      });

      historyList.appendChild(button);
    });
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Hoje, " + date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      });
    }

    if (date.toDateString() === yesterday.toDateString()) {
      return "Ontem, " + date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      });
    }

    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  function openConversation(id) {
    const selected = conversations.find(item => item.id === id);

    if (!selected) return;

    if (typeof stopListening === "function") {
      stopListening();
    }

    activeConversationId = selected.id;

    history = selected.messages.map(item => ({
      role: item.role,
      content: item.content
    }));

    if (typeof originalRestoreConversation === "function") {
      originalRestoreConversation();
    }

    closeHistory();
    renderHistory();
  }

  function startNewConversation() {
    if (typeof stopListening === "function") {
      stopListening();
    }

    const current = getActiveConversation();

    if (current && history.length) {
      saveCurrentConversation();
    }

    const conversation = createConversation();

    conversations.unshift(conversation);
    activeConversationId = conversation.id;

    history = [];

    if (typeof originalRestoreConversation === "function") {
      originalRestoreConversation();
    } else {
      messagesEl.replaceChildren();
    }

    if (typeof addMessage === "function") {
      addMessage(
        "assistant",
        "Olá! Sou o VARJÃO. Vamos começar uma nova conversa?"
      );
    }

    if (typeof saveHistory === "function") {
      saveHistory();
    }

    if (typeof setPresenceState === "function") {
      setPresenceState("idle");
    }

    if (typeof pendingImage !== "undefined") {
      pendingImage = null;
    }

    const imageInput = document.getElementById("imageInput");

    if (imageInput) {
      imageInput.value = "";
    }

    const prompt = document.getElementById("prompt");

    if (prompt) {
      prompt.value = "";
      prompt.placeholder = "Fale comigo ou digite...";
    }

    persistConversations();
    renderHistory();
    closeHistory();
  }

  // BOTÕES
  historyBtn.addEventListener("click", openHistory);
  historyClose.addEventListener("click", closeHistory);
  newConversationBtn.addEventListener("click", startNewConversation);

  historyOverlay.addEventListener("click", event => {
    if (event.target === historyOverlay) {
      closeHistory();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeHistory();
    }
  });

  // LIMPAR AGORA INICIA UMA NOVA CONVERSA,
  // SEM APAGAR AS CONVERSAS ANTERIORES.
  if (clearBtn) {
    clearBtn.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      startNewConversation();
    }, true);
  }

  // INICIALIZAÇÃO
  loadConversations();

  const active = getActiveConversation();

  if (active && active.messages.length) {
    history = active.messages.map(item => ({
      role: item.role,
      content: item.content
    }));

    if (typeof originalRestoreConversation === "function") {
      originalRestoreConversation();
    }
  } else {
    history = [];

    if (typeof originalRestoreConversation === "function") {
      originalRestoreConversation();
    }
  }

  renderHistory();

  console.log("Histórico do VARJÃO iniciado.");
})();
