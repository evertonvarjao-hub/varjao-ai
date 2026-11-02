
/* =========================================
   VARJÃO AI — SISTEMA DE HISTÓRICO
   ========================================= */

(function () {
  "use strict";

  const STORAGE_KEY = "varjao_conversations_v1";
  const LEGACY_KEY = "varjao_history_v2";
  const ACTIVE_KEY = "varjao_active_conversation_v1";
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
      titleEdited: false,
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
      conversations.sort(
        (a, b) => b.updatedAt - a.updatedAt
      );

      conversations = conversations.slice(0, MAX_CONVERSATIONS);

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(conversations)
      );

      if (activeConversationId) {
        localStorage.setItem(
          ACTIVE_KEY,
          activeConversationId
        );
      }

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

      conversations.forEach(item => {
        if (typeof item.titleEdited !== "boolean") {
          item.titleEdited = false;
        }

        if (!item.title) {
          item.title = getConversationTitle(item.messages);
        }

        if (!item.updatedAt) {
          item.updatedAt = Date.now();
        }
      });

      if (!conversations.length) {
        conversations.push(createConversation());
      }

      const savedActiveId = localStorage.getItem(ACTIVE_KEY);

      const savedActive = conversations.find(item =>
        item.id === savedActiveId
      );

      const current = savedActive ||
        conversations.find(item => item.messages.length > 0) ||
        conversations[0];

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

    if (!current.titleEdited) {
      current.title = getConversationTitle(current.messages);
    }

    current.updatedAt = Date.now();

    persistConversations();
    renderHistory();
  }

  // SALVAMENTO
  window.saveHistory = function () {
    if (typeof originalSaveHistory === "function") {
      originalSaveHistory();
    }

    saveCurrentConversation();
  };

  // ABRIR E FECHAR HISTÓRICO
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

  // RENOMEAR CONVERSA
  function renameConversation(conversation) {
    const newName = window.prompt(
      "Digite o novo nome desta conversa:",
      conversation.title || "Nova conversa"
    );

    if (newName === null) return;

    const cleanName = newName.trim();

    if (!cleanName) {
      window.alert("Digite um nome válido.");
      return;
    }

    conversation.title = cleanName.slice(0, 60);
    conversation.titleEdited = true;
    conversation.updatedAt = Date.now();

    persistConversations();
    renderHistory();
  }

  // EXCLUIR CONVERSA
  function deleteConversation(conversation) {
    const confirmed = window.confirm(
      'Deseja realmente excluir a conversa "' +
      conversation.title +
      '"? Esta ação não poderá ser desfeita.'
    );

    if (!confirmed) return;

    const wasActive = conversation.id === activeConversationId;

    conversations = conversations.filter(item =>
      item.id !== conversation.id
    );

    if (wasActive) {
      history = [];

      if (!conversations.length) {
        conversations.push(createConversation());
      }

      const next = conversations[0];
      activeConversationId = next.id;

      history = next.messages.map(item => ({
        role: item.role,
        content: item.content
      }));

      if (typeof originalRestoreConversation === "function") {
        originalRestoreConversation();
      }
    }

    persistConversations();
    renderHistory();
  }

  // MOSTRAR CONVERSAS
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
      const item = document.createElement("div");

      item.className = "history-item";

      if (conversation.id === activeConversationId) {
        item.classList.add("active");
      }

      item.style.display = "flex";
      item.style.flexDirection = "column";
      item.style.gap = "8px";
      item.style.padding = "12px";
      item.style.marginBottom = "8px";

      // ABRIR CONVERSA
      const openButton = document.createElement("button");

      openButton.type = "button";
      openButton.style.width = "100%";
      openButton.style.background = "transparent";
      openButton.style.border = "none";
      openButton.style.color = "inherit";
      openButton.style.textAlign = "left";
      openButton.style.padding = "0";
      openButton.style.cursor = "pointer";

      const title = document.createElement("strong");
      title.textContent = conversation.title || "Nova conversa";
      title.style.display = "block";
      title.style.overflowWrap = "anywhere";

      const date = document.createElement("small");
      date.textContent = formatDate(conversation.updatedAt);
      date.style.display = "block";
      date.style.marginTop = "5px";
      date.style.opacity = "0.7";

      openButton.append(title, date);

      openButton.addEventListener("click", () => {
        openConversation(conversation.id);
      });

      // AÇÕES
      const actions = document.createElement("div");

      actions.style.display = "flex";
      actions.style.gap = "8px";
      actions.style.flexWrap = "wrap";

      // BOTÃO RENOMEAR
      const renameButton = document.createElement("button");

      renameButton.type = "button";
      renameButton.textContent = "✏️ Renomear";
      renameButton.style.padding = "7px 10px";
      renameButton.style.borderRadius = "8px";
      renameButton.style.border = "1px solid #d9ad55";
      renameButton.style.background = "transparent";
      renameButton.style.color = "#d9ad55";
      renameButton.style.fontSize = "12px";
      renameButton.style.cursor = "pointer";

      renameButton.addEventListener("click", event => {
        event.stopPropagation();
        renameConversation(conversation);
      });

      // BOTÃO EXCLUIR
      const deleteButton = document.createElement("button");

      deleteButton.type = "button";
      deleteButton.textContent = "🗑️ Excluir";
      deleteButton.style.padding = "7px 10px";
      deleteButton.style.borderRadius = "8px";
      deleteButton.style.border = "1px solid #e84b42";
      deleteButton.style.background = "transparent";
      deleteButton.style.color = "#e84b42";
      deleteButton.style.fontSize = "12px";
      deleteButton.style.cursor = "pointer";

      deleteButton.addEventListener("click", event => {
        event.stopPropagation();
        deleteConversation(conversation);
      });

      actions.append(renameButton, deleteButton);
      item.append(openButton, actions);

      historyList.appendChild(item);
    });
  }

  // DATA DA CONVERSA
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

  // ABRIR UMA CONVERSA
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

    persistConversations();
    closeHistory();
    renderHistory();
  }

  // NOVA CONVERSA
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

  if (historyClose) {
    historyClose.addEventListener("click", closeHistory);
  }

  newConversationBtn.addEventListener(
    "click",
    startNewConversation
  );

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

  // LIMPAR INICIA UMA NOVA CONVERSA
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
