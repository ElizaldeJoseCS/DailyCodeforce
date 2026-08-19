import OpenAI from "openai";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const VISUALS_DIR = resolve(process.cwd(), "public/visuals");

export async function generateProblemVisual(
  problemName: string,
  tags: string[],
  rating: number
): Promise<{ url: string; prompt: string }> {
  const tagStr = tags.join(", ");
  const prompt = `Educational algorithm diagram for a competitive programming problem called "${problemName}" with tags: ${tagStr}, difficulty rating: ${rating}.

Create a clear step-by-step visual explanation of how this algorithm or data structure works. Use labeled boxes, arrows, and numbered steps. Show input → processing → output flow. Use a clean white/light background with dark text for readability. Include visual elements like arrays, trees, graphs, or stacks as appropriate for the algorithm type. Make it look like a textbook illustration that teaches the concept. No decorative elements — everything should serve an educational purpose.`;

  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    n: 1,
    size: "1024x1024",
  });

  const imageData = response.data?.[0];
  if (!imageData) throw new Error("No image data returned from OpenAI");

  if (imageData.url) {
    return { url: imageData.url, prompt };
  }

  if (imageData.b64_json) {
    mkdirSync(VISUALS_DIR, { recursive: true });
    const filename = `${problemName.replace(/[^a-zA-Z0-9]/g, "_")}.png`;
    const filePath = resolve(VISUALS_DIR, filename);
    writeFileSync(filePath, Buffer.from(imageData.b64_json, "base64"));
    return { url: `/visuals/${filename}`, prompt };
  }

  throw new Error("No image data in response");
}
