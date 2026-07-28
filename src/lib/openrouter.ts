export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function openRouterModel() {
  return process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4-flash";
}

function apiKey() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY is not configured. Add it in Vercel → Environment Variables.",
    );
  }
  return key;
}

export async function chatCompletion(messages: ChatMessage[]) {
  const model = openRouterModel();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "wiki-ui",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `OpenRouter error ${res.status}`;
    throw new Error(message);
  }

  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) {
    throw new Error("OpenRouter returned an empty answer");
  }

  return {
    answer: answer.trim(),
    model: String(data?.model || model),
  };
}
