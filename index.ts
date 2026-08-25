import { streamText } from "ai";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error(
      "AI_GATEWAY_API_KEY is missing. Add it to .env.local before running this script.",
    );
  }

  const result = streamText({
    model: "poolside/laguna-s-2.1-free",
    prompt: "In two sentences, explain how an interactive map can help a city.",
  });

  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }

  const usage = await result.usage;
  process.stdout.write("\n\n");
  console.log("Token usage:", usage);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
