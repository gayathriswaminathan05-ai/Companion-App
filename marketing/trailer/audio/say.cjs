// The plant's real voice (Kokoro, same model/voice as the app) to a WAV file.
// Usage: node marketing/trailer/audio/say.cjs "Stretch with me?" out.wav [voice] [speed]
const path = require("path");
const { createRequire } = require("module");
const ROOT = path.resolve(__dirname, "..", "..", "..");
const entry = require.resolve("kokoro-js", { paths: [ROOT] });
const { env } = createRequire(entry)("@huggingface/transformers");
env.localModelPath = path.join(ROOT, "models");
env.allowLocalModels = true;
env.allowRemoteModels = true; // voice embeddings download once
const { KokoroTTS } = require(entry);

(async () => {
  const [text, out, voice = "af_heart", speed = "1"] = process.argv.slice(2);
  const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });
  const audio = await tts.generate(text, { voice, speed: Number(speed) });
  await audio.save(out);
  console.log("WROTE", out, audio.sampling_rate, audio.audio.length);
})();
