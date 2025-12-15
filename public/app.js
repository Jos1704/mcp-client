// Elementos del DOM
const messagesContainer = document.getElementById("messagesContainer");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const aiModelSelect = document.getElementById("aiModel");
const typingIndicator = document.getElementById("typingIndicator");
const statusIndicator = document.getElementById("statusIndicator");
const toolsUsedSpan = document.getElementById("toolsUsed");

// Estado
let isLoading = false;

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
    addMessage(message, "user-message");
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
                ? "gpt-4"
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

            addMessage(assistantContent, "assistant-message");
            toolsUsedSpan.textContent = `Herramientas usadas: ${data.toolsUsed || 0}`;
        } else {
            addMessage(`❌ Error: ${data.error}`, "assistant-message");
        }
    } catch (error) {
        addMessage(`❌ Error de conexión: ${error.message}`, "assistant-message");
    } finally {
        isLoading = false;
        sendBtn.disabled = false;
        typingIndicator.style.display = "none";
        messageInput.focus();
        scrollToBottom();
    }
}

// Agregar mensaje a la interfaz
function addMessage(content, className) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${className}`;

    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";
    
    // Procesar saltos de línea y hacer URLs clicables
    const processedContent = content
        .split("\n")
        .map((line) => {
            // Hacer URLs clicables
            return line.replace(
                /https?:\/\/[^\s]+/g,
                (url) => `<a href="${url}" target="_blank" style="color: inherit; text-decoration: underline;">${url}</a>`
            );
        })
        .join("<br>");

    contentDiv.innerHTML = processedContent;
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
