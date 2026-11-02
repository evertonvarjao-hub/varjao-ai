
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

  function setBusy(value) {
    busy = value;

    documentEdit.disabled = value;
    documentExport.disabled = value;
    documentInput.disabled = value;
    documentBtn.disabled = value;

    if (value) {
      documentPanel.classList.add("active");
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

  // ABRIR SELEÇÃO DE ARQUIVOS
  documentBtn.addEventListener("click", () => {
    if (busy) return;

    showPanel();
    documentInput.click();
  });

  // FECHAR ÁREA DE DOCUMENTOS
  documentClose.addEventListener("click", () => {
    if (busy) return;

    documentPanel.classList.remove("active");
  });

  // ENVIAR DOCUMENTO AO SERVIDOR
  documentInput.addEventListener("change", async () => {
    const file = documentInput.files?.[0];

    if (!file) return;

    showPanel();

    if (file.size > 12 * 1024 * 1024) {
      setStatus("O arquivo ultrapassa o limite de 12 MB.");
      documentInput.value = "";
      return;
    }

    const allowedExtensions = [".pdf", ".docx", ".txt", ".xlsx"];
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

      if (data.truncated) {
        setStatus(
          "Documento lido. Atenção: o conteúdo é extenso e foi limitado a 100.000 caracteres."
        );
      } else {
        setStatus("Documento carregado e pronto para edição.");
      }

    } catch (error) {
      console.error("ERRO AO CARREGAR DOCUMENTO:", error);
      setStatus(error.message || "Falha ao ler o documento.");
    } finally {
      setBusy(false);
      documentInput.value = "";
    }
  });

  // PEDIR EDIÇÃO À INTELIGÊNCIA ARTIFICIAL
  documentEdit.addEventListener("click", async () => {
    if (busy) return;

    const text = documentContent.value.trim();
    const instruction = documentInstruction.value.trim();

    if (!text) {
      setStatus("Carregue um documento antes de editar.");
      return;
    }

    if (!instruction) {
      setStatus("Escreva o que deseja alterar no documento.");
      documentInstruction.focus();
      return;
    }

    setBusy(true);
    setStatus("O VARJÃO está analisando e editando o documento...");

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

      const data = await readJsonResponse(response);

      if (!data.editedText) {
        throw new Error("A inteligência não retornou o documento editado.");
      }

      documentContent.value = data.editedText;

      setStatus(
        "Edição concluída! O original continua preservado. Confira o resultado antes de gerar o PDF."
      );

    } catch (error) {
      console.error("ERRO NA EDIÇÃO:", error);
      setStatus(error.message || "Não foi possível editar o documento.");
    } finally {
      setBusy(false);
    }
  });

  // GERAR E SALVAR PDF
  documentExport.addEventListener("click", async () => {
    if (busy) return;

    const text = documentContent.value.trim();

    if (!text) {
      setStatus("Não há conteúdo para gerar o PDF.");
      return;
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

      // NO IPHONE, ABRIR A FOLHA DE COMPARTILHAMENTO
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
          return;
        } catch (shareError) {
          if (shareError.name === "AbortError") {
            setStatus("Compartilhamento cancelado.");
            return;
          }
        }
      }

      // ALTERNATIVA PARA NAVEGADORES SEM COMPARTILHAMENTO
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "varjao-documento.pdf";
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 60000);

      setStatus("PDF gerado. Verifique os downloads do navegador.");

    } catch (error) {
      console.error("ERRO AO EXPORTAR PDF:", error);
      setStatus(error.message || "Falha ao gerar o PDF.");
    } finally {
      setBusy(false);
    }
  });

  console.log("Módulo de documentos do VARJÃO carregado.");
})();

