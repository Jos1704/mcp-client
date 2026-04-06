const messagesContainer = document.getElementById("messagesContainer");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const aiModelSelect = document.getElementById("aiModel");
const typingIndicator = document.getElementById("typingIndicator");
const toolsUsedSpan = document.getElementById("toolsUsed");

// Estado
let isLoading = false;

function escapeHtml(text = "") {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function renderMarkdown(content = "") {
    if (window.marked && window.DOMPurify) {
        marked.setOptions({
            gfm: true,
            breaks: true
        });

        const rawHtml = marked.parse(content);
        return DOMPurify.sanitize(rawHtml, {
            USE_PROFILES: { html: true }
        });
    }

    return escapeHtml(content)
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/\n/g, "<br>");
}

// Event Listeners
sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Enviar mensaje
async function sendMessage() {
    const message = messageInput.value.trim();

    if (!message || isLoading) return;

    // Agregar mensaje del usuario
    addMessage(message, "user-message", { renderMarkdown: false });
    messageInput.value = "";
    isLoading = true;
    sendBtn.disabled = true;
    typingIndicator.style.display = "flex";

    try {
        const aiModel = aiModelSelect.value;
        const endpoint =
            aiModel === "openai"
                ? "/api/chat/openai"
                : aiModel === "gemini"
                ? "/api/chat/gemini"
                : aiModel === "bedrock"
                ? "/api/chat/bedrock"
                : "/api/chat/local";

        const modelId =
            aiModel === "openai"
                ? "gpt-4.1-mini"
                : aiModel === "gemini"
                ? "gemini-pro"
                : aiModel === "bedrock"
                ? "anthropic.claude-3-5-sonnet-20240620-v1:0"
                : undefined;

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message,
                model: modelId
            })
        });

        const data = await response.json();

        if (data.success) {
            // Agregar mensaje del asistente
            let assistantContent = data.message;
            if (data.toolsUsed && data.toolsUsed > 0) {
                assistantContent += `\n\n🔧 Herramientas usadas: ${data.toolsUsed}`;
            }

            addMessage(assistantContent, "assistant-message", { renderMarkdown: true });
            toolsUsedSpan.textContent = `Herramientas usadas: ${data.toolsUsed || 0}`;
        } else {
            addMessage(`❌ Error: ${data.error}`, "assistant-message", { renderMarkdown: false });
        }
    } catch (error) {
        addMessage(`❌ Error de conexión: ${error.message}`, "assistant-message", { renderMarkdown: false });
    } finally {
        isLoading = false;
        sendBtn.disabled = false;
        typingIndicator.style.display = "none";
        messageInput.focus();
        scrollToBottom();
    }
}

// Agregar mensaje a la interfaz
function addMessage(content, className, options = {}) {
    const { renderMarkdown: shouldRenderMarkdown = false } = options;
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${className}`;

    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";

    if (shouldRenderMarkdown) {
        contentDiv.classList.add("markdown-content");
        contentDiv.innerHTML = renderMarkdown(content);
    } else {
        contentDiv.textContent = content;
    }

    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);

    scrollToBottom();
}

// Scroll al final
function scrollToBottom() {
    const container = document.querySelector(".chat-main");
    container.scrollTop = container.scrollHeight;
}

// Inicializar
document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ Chat aplicación cargada");
    messageInput.focus();
});
