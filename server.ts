import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { ProxyAgent, setGlobalDispatcher } from "undici";

dotenv.config();

// Configure global fetch proxy if HTTPS_PROXY or HTTP_PROXY is defined
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
if (proxyUrl) {
  console.log(`[Proxy] Detected proxy environment variable: ${proxyUrl}. Configuring global fetch dispatcher.`);
  try {
    const dispatcher = new ProxyAgent({ uri: proxyUrl });
    setGlobalDispatcher(dispatcher);
    console.log(`[Proxy] Global fetch proxy configured successfully.`);
  } catch (err) {
    console.error(`[Proxy] Failed to configure global fetch proxy:`, err);
  }
}

const app = express();
const PORT = 3000;

// Use JSON parsing middleware with a larger limit to handle document uploads
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

// Helper to initialize GoogleGenAI instance with request API key
const getAiInstance = (req: express.Request) => {
  const customKeyHeader = req.headers["x-gemini-api-key"] as string;
  const customKeyBody = req.body?.apiKey as string;
  let apiKey = customKeyHeader || customKeyBody || process.env.GEMINI_API_KEY;

  if (apiKey === "MY_GEMINI_API_KEY") {
    apiKey = undefined;
  }

  if (!apiKey) {
    throw new Error("Kunci API Gemini (API Key) belum dikonfigurasi. Demi kestabilan dan kemandirian kuota, Anda diwajibkan untuk memasukkan Kunci API Gemini Anda sendiri di menu 'Dashboard Guru' atau 'Pengaturan' terlebih dahulu.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

// Helper to perform content generation with retry, backoff, and model fallbacks
const generateWithRetry = async (
  ai: any,
  params: { contents: any; config?: any },
  preferredModel: string = "gemini-3.5-flash",
  retries = 3,
  delay = 1000
) => {
  // Only use valid, non-deprecated models from the gemini-api skill list.
  const modelsToTry = [preferredModel, "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash"];
  const uniqueModels = Array.from(new Set(modelsToTry));
  let lastError: any = null;

  for (const model of uniqueModels) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[AI] Attempting generation with model: ${model} (Attempt ${attempt}/${retries})`);
        const result = await ai.models.generateContent({
          model: model,
          contents: params.contents,
          config: params.config,
        });
        console.log(`[AI] Generation successful using model: ${model}`);
        return result;
      } catch (error: any) {
        lastError = error;
        const status = error.status || error.statusCode || error.code || 500;
        const errorMsg = error.message || String(error);
        console.log(`[AI] Model ${model} failed on attempt ${attempt}:`, errorMsg);

        // If it's an auth error (401, 403), do not retry as it is a permanent auth failure across all models
        if (status === 401 || status === 403 || errorMsg.includes("API key not valid") || errorMsg.includes("api_key_invalid")) {
          throw error;
        }

        // If it's a configuration error (400), rate limit (429), or service unavailable (503), do not retry on this model. Break the inner loop to try the next candidate model immediately.
        const isRateLimitOrUnavailable = 
          status === 429 || 
          status === 503 || 
          errorMsg.includes("RESOURCE_EXHAUSTED") || 
          errorMsg.includes("quota") || 
          errorMsg.includes("limit exceeded") || 
          errorMsg.includes("Quota exceeded") || 
          errorMsg.includes("UNAVAILABLE") || 
          errorMsg.includes("high demand") || 
          errorMsg.includes("temporary");

        if (status === 400 || isRateLimitOrUnavailable) {
          console.log(`[AI] Model ${model} failed with status ${status} / error. Skipping to next model immediately.`);
          break; 
        }

        if (attempt < retries) {
          const sleepTime = delay * Math.pow(2, attempt - 1);
          console.log(`[AI] Model ${model} failed with code ${status} (Attempt ${attempt}/${retries}). Retrying in ${sleepTime}ms...`);
          await new Promise((resolve) => setTimeout(resolve, sleepTime));
        } else {
          console.log(`[AI] Model ${model} failed all ${retries} attempts. Trying the next model candidate.`);
        }
      }
    }
  }
  throw lastError || new Error("AI Generation failed across all models and retries.");
};

// API Route to validate Gemini API Key
app.post("/api/check-api-key", async (req, res) => {
  try {
    const { apiKey } = req.body;
    let keyToTest = apiKey || process.env.GEMINI_API_KEY;
    if (keyToTest === "MY_GEMINI_API_KEY") {
      keyToTest = undefined;
    }
    
    if (!keyToTest) {
      res.json({ valid: false, message: "Kunci API Gemini (API Key) belum dimasukkan." });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey: keyToTest,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    // Run a lightweight call to check validity with retry wrapper
    const response = await generateWithRetry(
      ai,
      { contents: "Hello, confirm this API works with 'OK' response" },
      "gemini-3.5-flash",
      2,
      500
    );

    if (response && response.text) {
      res.json({ valid: true });
    } else {
      res.json({ valid: false, message: "Response was empty" });
    }
  } catch (error: any) {
    console.error("API Key Check Error:", error);
    res.json({ valid: false, message: error.message || "Invalid API key" });
  }
});

// API Route for AI Generation
app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, systemInstruction, responseSchema, temperature, file } = req.body;
    
    if (!prompt) {
      res.status(400).json({ error: "Prompt is required" });
      return;
    }

    const ai = getAiInstance(req);
    
    // Configure generation options
    const config: any = {};
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }
    if (temperature !== undefined) {
      config.temperature = temperature;
    }
    if (responseSchema) {
      config.responseMimeType = "application/json";
      config.responseSchema = responseSchema;
    }

    let contents: any = prompt;
    if (file && file.data && file.mimeType) {
      contents = [
        {
          inlineData: {
            data: file.data,
            mimeType: file.mimeType
          }
        },
        prompt
      ];
    }

    const result = await generateWithRetry(
      ai,
      { contents, config },
      "gemini-3.5-flash",
      3,
      1000
    );

    res.json({ text: result.text });
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    let errMsg = error.message || "Terjadi kesalahan saat berkomunikasi dengan AI.";
    
    const errorStr = String(errMsg).toLowerCase();
    if (
      errorStr.includes("resource_exhausted") ||
      errorStr.includes("quota") ||
      errorStr.includes("limit exceeded") ||
      errorStr.includes("429")
    ) {
      errMsg = "Batas kuota penggunaan AI (Free Tier) telah habis atau terlalu cepat mengirim permintaan. Demi kelancaran tanpa hambatan batas kuota, silakan masukkan Kunci API Gemini Anda sendiri di menu 'Dashboard Guru' atau 'Pengaturan' di bagian kanan atas.";
    }
    
    res.status(500).json({ error: errMsg });
  }
});

async function startServer() {
  // Serve static files in production / Vite in development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`E12WIN Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
  });
}

export default app;
