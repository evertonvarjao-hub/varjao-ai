
(() => {
  "use strict";

  const documentBtn = document.getElementById("documentBtn");
  const documentInput = document.getElementById("documentInput");
  const documentPanel = document.getElementById("documentPanel");
  const documentContent = document.getElementById("documentContent");
  const documentInstruction = document.getElementById("documentInstruction");
  const documentEdit = document.getElementById("documentEdit");
  const documentExport = document.getElementById("documentExport");

  const documentStatus =
    document.getElementById("documentStatus") ||
    document.getElementById("documentStatusText");

  let currentFilename = "";
  let originalContent = "";
  let editedContent = "";
  let busy = false;

  function setStatus(message) {
    if (documentStatus) {
      documentStatus.textContent = message || "";
    }
  }

  function setBusy(value) {
    busy = Boolean(value);

    if (documentEdit) documentEdit.disabled = busy;
    if (documentExport) documentExport.disabled = busy;
    if (documentBtn) documentBtn.disabled = busy;

    if (documentEdit) {
      documentEdit.textContent = busy ? "Aguarde..." : "Editar documento";
    }
  }

  function showPanel() {
    if (!documentPanel) return;

    documentPanel.classList.add("active");
    documentPanel.setAttribute("aria-hidden", "false");
  }

  function hidePanel() {
    if (!documentPanel) return;

    documentPanel.classList.remove("active");
    documentPanel.setAttribute("aria-hidden", "true");
  }

  function hasDocument() {
    return Boolean(
      documentContent &&
      documentContent.value.trim()
    );
  }

  function getDocumentText() {
    return documentContent ? documentContent.value.trim() : "";
  }

  function showError(message) {
    setStatus(message);

    if (typeof window.addMessage === "function") {
      window.addMessage("assistant", message);
    } else {
      alert(message);
    }
  }

  async function uploadDocument(file) {
    if (!file) return;

    const allowedExtensions = /\.(pdf|docx|txt|xlsx)$/i;

    if (!allowedExtensions.test(file.name)) {
      showError("Formato não permitido. Envie PDF, DOCX, TXT ou XLSX.");
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      showError("O arquivo ultrapassa o limite de 12 MB.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setBusy(true);
    setStatus("Lendo documento...");

    try {
      const response = await fetch("/api/document", {
        method: "POST",
        body: formData
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Não foi possível abrir o documento."
        );
      }

      currentFilename = data.filename || file.name;
      originalContent = data.text || "";
      editedContent = "";

      if (documentContent) {
        documentContent.value = originalContent;
      }

      if (documentInstruction) {
        documentInstruction.value = "";
      }

      showPanel();

      setStatus(
        data.truncated
          ? "Documento aberto. Parte do conteúdo foi limitada pelo servidor."
          : "Documento carregado. Você já pode editar."
      );
    } catch (error) {
      showError(error.message || "Erro ao carregar o documento.");
    } finally {
      setBusy(false);
    }
  }

  async function editDocument() {
    if (busy) return;

    const text = getDocumentText();
    const instruction = documentInstruction
      ? documentInstruction.value.trim()
      : "";

    if (!text) {
      showError("Primeiro, abra um documento ou escreva o conteúdo.");
      return;
    }

    if (!instruction) {
      showError("Escreva o que você quer que o VARJÃO faça no documento.");
      return;
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
          instruction
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Não foi possível editar o documento."
        );
      }

      editedContent = data.editedText || "";

      if (!editedContent) {
        throw new Error("A edição retornou um conteúdo vazio.");
      }

      if (documentContent) {
        documentContent.value = editedContent;
      }

      setStatus("Documento editado com sucesso.");
    } catch (error) {
      showError(error.message || "Erro ao editar o documento.");
    } finally {
      setBusy(false);
    }
  }

  async function exportDocument() {
    if (busy) return;

    const text = getDocumentText();

    if (!text) {
      showError("Não há conteúdo para exportar.");
      return;
    }

    setBusy(true);
    setStatus("Preparando o PDF...");

    try {
      const response = await fetch("/api/document/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: currentFilename || "Documento VARJÃO",
          text
        })
      });

      if (!response.ok) {
        let message = "Não foi possível gerar o PDF.";

        try {
          const data = await response.json();
          message = data.error || message;
        } catch (_) {}

        throw new Error(message);
      }

      const blob = await response.blob();
      const pdfFile = new File(
        [blob],
        makePdfFilename(currentFilename),
        { type: "application/pdf" }
      );

      const fileUrl = URL.createObjectURL(blob);

      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [pdfFile] })
      ) {
        await navigator.share({
          files: [pdfFile],
          title: currentFilename || "Documento VARJÃO"
        });
      } else {
        const link = document.createElement("a");
        link.href = fileUrl;
        link.download = pdfFile.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      setStatus("PDF preparado.");
      setTimeout(() => URL.revokeObjectURL(fileUrl), 60000);
    } catch (error) {
      if (error.name === "AbortError") {
        setStatus("Compartilhamento cancelado.");
      } else {
        showError(error.message || "Erro ao exportar PDF.");
      }
    } finally {
      setBusy(false);
    }
  }

  function makePdfFilename(filename) {
    let name = String(filename || "documento")
      .replace(/\.[^.]+$/, "")
      .replace(/[\\/:*?"<>|]/g, "")
      .trim();

    if (!name) name = "documento";

    return `${name}.pdf`;
  }

  function closeDocument() {
    if (busy) return;

    hidePanel();
    setStatus("");
  }

  if (documentBtn && documentInput) {
    documentBtn.addEventListener("click", () => {
      if (!busy) documentInput.click();
    });
  }

  if (documentInput) {
    documentInput.addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];

      if (file) {
        await uploadDocument(file);
      }

      event.target.value = "";
    });
  }

  if (documentEdit) {
    documentEdit.addEventListener("click", editDocument);
  }

  if (documentExport) {
    documentExport.addEventListener("click", exportDocument);
  }

  const closeButtons = [
    document.getElementById("documentClose"),
    document.getElementById("closeDocument"),
    document.getElementById("documentCloseBtn")
  ].filter(Boolean);

  closeButtons.forEach((button) => {
    button.addEventListener("click", closeDocument);
  });

  window.VARJAO_DOCUMENTS = {
    open: showPanel,
    close: closeDocument,
    upload: uploadDocument,
    edit: editDocument,
    export: exportDocument,
    hasDocument,
    getText: getDocumentText,
    getFilename: () => currentFilename
  };

  console.log("VARJÃO: módulo de documentos carregado.");
})();
