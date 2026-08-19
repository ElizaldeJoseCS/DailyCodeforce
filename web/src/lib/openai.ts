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
  const prompt = `Clean minimal technical diagram illustrating algorithm concepts: ${tagStr}. Problem: "${problemName}" (difficulty ${rating}). Show abstract data structures and flow, professional educational style, dark navy background, no text or letters, geometric shapes, glowing accent colors cyan and magenta.`;

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
