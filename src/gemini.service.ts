
import { Injectable } from '@angular/core';
import { GoogleGenAI } from '@google/genai';

// IMPORTANT: This service assumes that process.env.API_KEY is available in the execution environment.
const API_KEY = process.env.API_KEY;

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    if (!API_KEY) {
      console.error('API_KEY is not set. AI features will be disabled.');
      // Use a mock key to prevent crashing the app if the key is missing.
      this.ai = new GoogleGenAI({apiKey: 'mock-key-for-initialization'});
    } else {
       this.ai = new GoogleGenAI({ apiKey: API_KEY });
    }
  }

  async generateImage(prompt: string): Promise<string> {
     if (!API_KEY) {
      // Return a placeholder if API key is missing to prevent errors.
      return `https://picsum.photos/800/600?random=${Math.random()}`;
    }
    
    const MAX_RETRIES = 3;
    let delay = 5000; // Initial delay of 5 seconds for retry

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await this.ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: `Professional real estate photograph of the interior of ${prompt}. Ultra-realistic, 8k resolution, with abundant natural light. The style is bright and airy, emphasizing clean lines, luxurious materials, and modern, minimalist decor. Captured with a wide-angle lens to create a sense of spaciousness. No people or clutter.`,
                config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '4:3',
                },
            });
    
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64ImageBytes}`;

        } catch (error: any) {
            const isRateLimitError = error.toString().includes('RESOURCE_EXHAUSTED') || (error.error && error.error.code === 429);

            if (isRateLimitError && attempt < MAX_RETRIES) {
                console.warn(`Rate limit hit (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${delay / 1000}s...`);
                await new Promise(res => setTimeout(res, delay));
                delay *= 2; // Exponential backoff for subsequent retries (5s, 10s)
            } else {
                console.error(`Failed to generate image after ${attempt} attempts or due to a non-retriable error:`, error);
                return `https://picsum.photos/800/600?random=${Math.random()}`;
            }
        }
    }
    
    // Fallback if loop completes without returning (e.g., all retries fail)
    return `https://picsum.photos/800/600?random=${Math.random()}`;
  }
}
