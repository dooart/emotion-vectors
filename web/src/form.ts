import { getWeights, setSpeaking, setThinking } from "./sceneInteraction";
import { playTTS } from "./tts";

export function setupForm() {
  const chatInput = document.getElementById("chat") as HTMLInputElement;
  if (!chatInput) {
    throw new Error("Chat input element not found");
  }

  function debugSpeakingState() {
    setSpeaking(Math.random() < 0.5 ? 1 : 2);
    const randomDelay = Math.floor(Math.random() * (300 - 100 + 1) + 100);
    setTimeout(debugSpeakingState, randomDelay);
  }

  if (import.meta.env.VITE_DEBUG_SPEAKING_STATE === "true") {
    debugSpeakingState();
  }

  let messageHistory: string[] = [];
  let historyIndex = -1;

  chatInput.maxLength = 70;
  chatInput.focus();

  document.addEventListener("click", () => {
    chatInput.focus();
  });

  chatInput.addEventListener("keydown", async (event: KeyboardEvent) => {
    if (chatInput.disabled) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const message = chatInput.value.trim().slice(0, 70);
      if (message) {
        hideText();

        messageHistory.push(message);
        historyIndex = messageHistory.length;
        try {
          setThinking(true);
          chatInput.value = "";
          chatInput.disabled = true;
          chatInput.placeholder = "thinking...";

          const [x, y, z] = getWeights();
          const response = await fetch("http://localhost:8000/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompt: message,
              weights: {
                happy_sad: y,
                angry_calm: x,
                disgusted_interested: z,
              },
              task: `you are Gizmo. answer the following message from your interlocutor. start with "Gizmo says":`,
              persona: `you are roleplaying as Gizmo, a living digital cute sphere. you live inside a computer and you have your own life, desires, and goals.`,
              rules: `IMPORTANT: use maximum 20 words. use lowercase. be concise and emotive.`,
            }),
          });

          if (!response.ok) {
            chatInput.value = message;
            throw new Error("Network response was not ok");
          }
          const result = await response.text();
          const emotionDescriptions = [];
          if (Math.abs(y) > 0.3)
            emotionDescriptions.push(
              y > 0 ? `${Math.abs(y) > 0.7 ? "super " : ""}happy` : `${Math.abs(y) > 0.7 ? "super " : ""}sad`
            );
          if (Math.abs(x) > 0.3)
            emotionDescriptions.push(
              x > 0 ? `${Math.abs(x) > 0.7 ? "super " : ""}angry` : `${Math.abs(x) > 0.7 ? "super " : ""}calm`
            );
          if (Math.abs(z) > 0.3)
            emotionDescriptions.push(
              z > 0 ? `${Math.abs(z) > 0.7 ? "super " : ""}disgusted` : `${Math.abs(z) > 0.7 ? "super " : ""}interested`
            );

          const emotionString = emotionDescriptions.length > 0 ? emotionDescriptions.join(" and ") : "neutral";

          console.log(
            `Gizmo's emotional state: [${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}] (${emotionString})`
          );
          console.log(`You said: ${message}`);
          console.log(result);
          console.log("=========================================");

          let strippedResponse = result.replace(/^Gizmo says:\s*/, "");
          strippedResponse = strippedResponse.replace(/^"(.*)"$/, "$1");
          playTTS(strippedResponse, {
            onStartPlaying: () => {
              setThinking(false);
              showText(strippedResponse);
            },
            onFinishPlaying: () => {
              setSpeaking(null);
              hideText();
            },
            onMouthUpdate: (isOpen: boolean) => {
              setSpeaking(isOpen ? 1 : 2);
            },
          });
        } catch (error) {
          console.error("Error:", error);
          const message = messageHistory.pop();
          historyIndex = messageHistory.length;
          if (message) {
            chatInput.value = message;
          }
        } finally {
          chatInput.disabled = false;
          chatInput.placeholder = "";
          chatInput.focus();
        }
      }
    } else if (event.key === "Escape") {
      chatInput.blur();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        chatInput.value = messageHistory[historyIndex];
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (historyIndex < messageHistory.length - 1) {
        historyIndex++;
        chatInput.value = messageHistory[historyIndex];
      } else if (historyIndex === messageHistory.length - 1) {
        historyIndex = messageHistory.length;
        chatInput.value = "";
      }
    }
  });
}

export function showText(text: string) {
  const gizmoResponse = document.querySelector("#gizmo-response p");
  if (gizmoResponse) {
    gizmoResponse.textContent = text.toLowerCase();
    gizmoResponse.parentElement?.classList.remove("hidden");
  }
}

export function hideText() {
  const gizmoResponse = document.querySelector("#gizmo-response p");
  if (gizmoResponse) {
    gizmoResponse.textContent = "";
    gizmoResponse.parentElement?.classList.add("hidden");
  }
}
