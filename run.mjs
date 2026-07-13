// test-gpt4all.mjs
import { loadModel, createCompletion } from "gpt4all";

async function run() {
  // 1. Carga (y descarga si hace falta) el modelo:
  const model = await loadModel("models/gpt4all-nano.bin", {
    verbose: true,    // salida de logs
    device: "cpu",    // fuerza CPU
    nCtx: 512         // contexto de 512 tokens
  });

  // 2. Haz una llamada de completion:
  const prompt = `
Fragmento (t=30–35s): "Calculamos la matriz A=[[1,2],[3,4]] y luego su determinante."
Extrae JSON con:

start, end

equations

steps
`;

const res = await createCompletion(model, prompt, {
temperature: 0.2, // determinista
maxTokens: 256 // límite de tokens de salida
});

// 3. Muestra la salida:
console.log("→", res.choices[0].message.content);

// 4. Libera recursos:
model.dispose();
}

run().catch(err => {
console.error(err);
process.exit(1);
});