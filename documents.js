
(() => {
  "use strict";

  const documentBtn = document.getElementById("documentBtn");
  const documentInput = document.getElementById("documentInput");
  const documentPanel = document.getElementById("documentPanel");
  const documentClose = document.getElementById("documentClose");
  const documentFilename = document.getElementById("documentFilename");
  const documentContent = document.getElementById("documentContent");
  const documentInstruction = document.getElementById("documentInstruction");
  const documentEdit = document.getElementById("documentEdit");
  const documentExport = document.getElementById("documentExport");
  const documentStatus = document.getElementById("documentStatus");

  if (
    !documentBtn ||
    !documentInput ||
    !documentPanel ||
    !documentContent
  ) {
    console.error("Elementos da área de documentos não encontrados.");
    return;
  }

  let currentFilename = "";
  let originalContent = "";
  let busy = false;

  function showPanel() {
    documentPanel.classList.add("active");
  }

  function setStatus(message) {
    documentStatus.textContent = message;
  }

  function chatMessage(role, message) {
    if (typeof window.addMessage === "function") {
      window.addMessage(role, message);
    }
  }

  async function speakIfNeeded(message, speakResponse) {
    if (
      speakResponse &&
      typeof window.speak === "function"
    ) {
      await window.speak(message);
    }
  }

  function setBusy(value) {
    busy = value;

    documentEdit.disabled = value;
    documentExport.disabled = value;
    documentInput.disabled = value;
    documentBtn.disabled = value;

    if (value) {
      showPanel();
    }
  }

  async function readJsonResponse(response) {
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error || "Não foi possível concluir a operação."
      );
    }

    return data;
  }

  function hasDocument() {
    return Boolean(
      currentFilename &&
      documentContent.value.trim()
    );
  }

  // ABRIR SELEÇÃO DE ARQUIVOS
  documentBtn.addEventListener("click", () => {
    if (busy) return;

    showPanel();
    documentInput.click();
  });

  // FECHAR PAINEL SEM DESCARTAR O DOCUMENTO
  documentClose.addEventListener("click", () => {
    if (busy) return;

    documentPanel.classList.remove("active");
  });

  // CARREGAR DOCUMENTO
  documentInput.addEventListener("change", async () => {
    const file = documentInput.files?.[0];

    if (!file) return;

    showPanel();

    if (file.size > 12 * 1024 * 1024) {
      setStatus("O arquivo ultrapassa o limite de 12 MB.");
      documentInput.value = "";
      return;
    }

    const allowedExtensions = [
      ".pdf",
      ".docx",
      ".txt",
      ".xlsx"
    ];

    const extension = file.name
      .slice(file.name.lastIndexOf("."))
      .toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      setStatus("Formato não suportado.");
      documentInput.value = "";
      return;
    }

    setBusy(true);
    setStatus("Enviando e lendo documento...");

    documentFilename.textContent = file.name;
    documentContent.value = "";
    documentInstruction.value = "";

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/document", {
        method: "POST",
        body: formData
      });

      const data = await readJsonResponse(response);

      currentFilename = data.filename || file.name;
      originalContent = data.text || "";

      documentContent.value = originalContent;

      if (!originalContent.trim()) {
        throw new Error(
          "Não consegui encontrar texto legível nesse documento."
        );
      }

      setStatus(
        "Documento carregado. Você já pode conversar comigo sobre ele."
      );

      chatMessage(
        "user",
        "Anexei o documento: " + currentFilename
      );

      chatMessage(
        "assistant",
        "Recebi e consegui ler o documento. Pode me dizer por aqui, digitando ou falando, o que deseja alterar. Vou atualizar o conteúdo e preservar o original."
      );

    } catch (error) {
      console.error("ERRO AO CARREGAR DOCUMENTO:", error);
      setStatus(error.message || "Falha ao ler o documento.");

      currentFilename = "";
      originalContent = "";
      documentContent.value = "";

    } finally {
      setBusy(false);
      documentInput.value = "";
    }
  });

  // EDITAR DOCUMENTO
  async function applyDocumentInstruction(instruction) {
    const text = documentContent.value.trim();

    if (!text) {
      throw new Error("Carregue um documento antes de editar.");
    }

    if (!instruction.trim()) {
      throw new Error("Diga o que deseja alterar.");
    }

    setBusy(true);
    setStatus("O VARJÃO está trabalhando no documento...");

    try {
      const response = await fetch("/api/document/edit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          filename: currentFilename || "Documento",
          documentText: text,
          instruction: instruction
        })
      });

      const data = await readJsonResponse(response);

      if (!data.editedText) {
        throw new Error(
          "A inteligência não retornou o documento editado."
        );
      }

      documentContent.value = data.editedText;
      documentInstruction.value = "";

      setStatus(
        "Alteração concluída. O documento foi atualizado."
      );

      return "Pronto! Fiz a alteração no documento. O resultado já está atualizado na visualização. Pode me pedir outras mudanças.";

    } finally {
      setBusy(false);
    }
  }

  // GERAR PDF
  async function exportCurrentDocument() {
    const text = documentContent.value.trim();

    if (!text) {
      throw new Error("Não há conteúdo para gerar o PDF.");
    }

    setBusy(true);
    setStatus("Gerando o PDF...");

    try {
      const title = (currentFilename || "Documento")
        .replace(/\.[^.]+$/, "")
        .slice(0, 150);

      const response = await fetch("/api/document/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          text
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        throw new Error(
          data.error || "Não foi possível gerar o PDF."
        );
      }

      const pdfBlob = await response.blob();

      if (!pdfBlob.size) {
        throw new Error("O PDF gerado está vazio.");
      }

      const pdfFile = new File(
        [pdfBlob],
        "varjao-documento.pdf",
        { type: "application/pdf" }
      );

      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [pdfFile] })
      ) {
        try {
          await navigator.share({
            files: [pdfFile],
            title: title
          });

          setStatus("PDF preparado para salvar ou compartilhar.");

          return "O PDF está pronto. Você pode salvá-lo no aplicativo Arquivos ou compartilhá-lo.";
        } catch (shareError) {
          if (shareError.name === "AbortError") {
            setStatus("Compartilhamento cancelado.");

            return "O compartilhamento foi cancelado. O documento continua disponível para gerar novamente.";
          }

          throw shareError;
        }
      }

      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "varjao-documento.pdf";
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 60000);

      setStatus("PDF gerado. Verifique os downloads.");

      return "PDF gerado. Verifique os downloads do navegador.";

    } finally {
      setBusy(false);
    }
  }

  // BOTÃO DE EDIÇÃO MANUAL
  documentEdit.addEventListener("click", async () => {
    if (busy) return;

    const instruction = documentInstruction.value.trim();

    if (!instruction) {
      setStatus("Escreva o que deseja alterar.");
      documentInstruction.focus();
      return;
    }

    try {
      const result = await applyDocumentInstruction(instruction);
      chatMessage("assistant", result);

    } catch (error) {
      console.error("ERRO NA EDIÇÃO:", error);
      setStatus(error.message || "Não foi possível editar.");
    }
  });

  // BOTÃO DE EXPORTAÇÃO
  documentExport.addEventListener("click", async () => {
    if (busy) return;

    try {
      const result = await exportCurrentDocument();
      chatMessage("assistant", result);

    } catch (error) {
      console.error("ERRO AO EXPORTAR:", error);
      setStatus(error.message || "Falha ao gerar o PDF.");
    }
  });

  // IDENTIFICAR PEDIDOS DE ALTERAÇÃO
  function isDocumentEditRequest(text) {
    return /\b(corrij\w*|revis\w*|melhor\w*|acrescent\w*|adicione\w*|inclu\w*|retir\w*|remov\w*|exclu\w*|substitu\w*|alter\w*|mud\w*|reorganiz\w*|reformul\w*|reescrev\w*|atualiz\w*|transform\w*|format\w*|ajust\w*|arrum\w*|traduz\w*|resum\w*|reduz\w*|aument\w*|insir\w*|coloc\w*|tir\w*|deix\w*|faç\w*|fac\w*|crie\w*|complete\w*|preench\w*|padroniz\w*|simplifi\w*|detalh\w*|organiz\w*)\b/i.test(text);
  }

  function isExportRequest(text) {
    return /\b(gerar|gere|gera|exportar|exporte|exporta|baixar|baixe|salvar|salve)\b/i.test(text) &&
      /\b(pdf|arquivo|documento)\b/i.test(text);
  }

  function isCloseDocumentRequest(text) {
    return /\b(encerrar|desanexar|remover|descartar|finalizar)\b/i.test(text) &&
      /\b(documento|arquivo)\b/i.test(text);
  }

  // CONECTAR OS PEDIDOS À CONVERSA E AO MICROFONE
  const originalSendMessage = window.sendMessage;

  if (typeof originalSendMessage === "function") {
    window.sendMessage = async function(
      text,
      imageData = null,
      speakResponse = false,
      voiceAudio = null
    ) {
      const clean = String(text || "").trim();

      if (
        !clean ||
        imageData ||
        !hasDocument() ||
        busy
      ) {
        return originalSendMessage.call(
          this,
          text,
          imageData,
          speakResponse,
          voiceAudio
        );
      }

      if (isCloseDocumentRequest(clean)) {
        chatMessage("user", clean);

        currentFilename = "";
        originalContent = "";
        documentContent.value = "";
        documentInstruction.value = "";
        documentFilename.textContent = "Nenhum documento selecionado.";

        documentPanel.classList.remove("active");
        setStatus("Documento encerrado.");

        const answer =
          "Certo. Encerrei o trabalho com esse documento. Podemos continuar nossa conversa normalmente.";

        chatMessage("assistant", answer);
        await speakIfNeeded(answer, speakResponse);
        return;
      }

      if (isExportRequest(clean)) {
        chatMessage("user", clean);

        try {
          const answer = await exportCurrentDocument();

          chatMessage("assistant", answer);
          await speakIfNeeded(answer, speakResponse);

        } catch (error) {
          const answer = "Não consegui gerar o PDF: " + error.message;

          setStatus(answer);
          chatMessage("assistant", answer);
          await speakIfNeeded(answer, speakResponse);
        }

        return;
      }

      if (!isDocumentEditRequest(clean)) {
        return originalSendMessage.call(
          this,
          text,
          imageData,
          speakResponse,
          voiceAudio
        );
      }

      chatMessage("user", clean);

      try {
        const answer = await applyDocumentInstruction(clean);

        chatMessage("assistant", answer);
        await speakIfNeeded(answer, speakResponse);

      } catch (error) {
        const answer =
          "Tive um problema ao alterar o documento: " + error.message;

        setStatus(answer);
        chatMessage("assistant", answer);
        await speakIfNeeded(answer, speakResponse);
      }
    };
  } else {
    console.error(
      "Não foi possível conectar a edição à conversa do VARJÃO."
    );
  }

  // ACESSO AO ESTADO DO DOCUMENTO
  window.VARJAO_DOCUMENTS = {
    hasDocument,
    getFilename: () => currentFilename,
    getContent: () => documentContent.value
  };

  console.log(
    "Módulo de documentos e edição por conversa carregado."
  );
})();
