// Client-side helper that calls the Next.js translate API route.
export async function translateText(text: string, targetLanguage: string) {
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, target: targetLanguage }),
  });
  if (!res.ok) {
    throw new Error("Translation failed");
  }
  const data = await res.json();
  return data.translated as string;
}

