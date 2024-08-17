const API_URL = `https://api.elevenlabs.io/v1/text-to-speech/${import.meta.env.VITE_VOICE_ID}/stream`;

export async function streamTTS(text: string): Promise<ReadableStream<Uint8Array>> {
  const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Accept: "audio/mpeg",
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: text,
      model_id: "eleven_monolingual_v1",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.body as ReadableStream<Uint8Array>;
}

export async function playTTS(
  text: string,
  {
    onStartPlaying,
    onFinishPlaying,
    onMouthUpdate,
  }: {
    onStartPlaying?: () => void;
    onFinishPlaying?: () => void;
    onMouthUpdate?: (isOpen: boolean) => void;
  } = {}
): Promise<void> {
  try {
    const audioStream = await streamTTS(text);
    const audioContext = new AudioContext();
    const source = audioContext.createBufferSource();

    const streamPromise = new Response(audioStream).arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(await streamPromise);

    source.buffer = audioBuffer;

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    source.connect(analyser);
    analyser.connect(audioContext.destination);

    onStartPlaying?.();

    let ended = false;
    source.onended = () => {
      ended = true;
      onFinishPlaying?.();
    };

    const startTime = audioContext.currentTime;
    source.start(startTime);

    let isOpen = false;
    let lastChangeTime = 0;
    const energyThreshold = 30;
    const minChangeDuration = 100;
    const maxOpenDuration = 300;
    const maxClosedDuration = 200;

    const updateMouthState = () => {
      if (ended) {
        return;
      }

      analyser.getByteFrequencyData(dataArray);

      const speechRange = dataArray.slice(2, 30);
      const currentEnergy = speechRange.reduce((sum, value) => sum + value, 0) / speechRange.length;

      const currentTime = audioContext.currentTime * 1000;
      const timeSinceLastChange = currentTime - lastChangeTime;

      if (
        (isOpen && timeSinceLastChange > maxOpenDuration) ||
        (!isOpen && timeSinceLastChange > maxClosedDuration) ||
        (timeSinceLastChange > minChangeDuration &&
          ((isOpen && currentEnergy < energyThreshold) || (!isOpen && currentEnergy > energyThreshold)))
      ) {
        isOpen = !isOpen;
        onMouthUpdate?.(isOpen);
        lastChangeTime = currentTime;
      }

      if (audioContext.currentTime < startTime + audioBuffer.duration) {
        requestAnimationFrame(updateMouthState);
      } else {
        onMouthUpdate?.(false);
      }
    };

    updateMouthState();
  } catch (error) {
    console.error("Error playing TTS:", error);
    throw error;
  }
}
