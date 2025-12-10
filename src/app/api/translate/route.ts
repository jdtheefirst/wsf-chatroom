import { NextResponse } from "next/server";

const MAX_CHARS = 2000;

export async function POST(req: Request) {
  try {
    const { text, target } = (await req.json()) as {
      text?: string;
      target?: string;
    };

    if (!text || !target) {
      return NextResponse.json(
        { error: "text and target are required" },
        { status: 400 }
      );
    }

    if (text.length > MAX_CHARS) {
      return NextResponse.json(
        { error: "Text too long for translation" },
        { status: 400 }
      );
    }

    const apiKey = process.env.DEEPL_API_KEY;
    const apiUrl = process.env.DEEPL_API_URL ?? "https://api-free.deepl.com/v2/translate";

    if (!apiKey) {
      // Graceful fallback: echo text when key is missing.
      return NextResponse.json({ translated: text, note: "DEEPL_API_KEY missing; echoed text." });
    }

    const params = new URLSearchParams();
    params.append("text", text);
    params.append("target_lang", target.toUpperCase());

    const deeplRes = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!deeplRes.ok) {
      const errText = await deeplRes.text();
      console.error("DeepL error", deeplRes.status, errText);
      return NextResponse.json(
        { error: "Translation provider error" },
        { status: 502 }
      );
    }

    const payload = (await deeplRes.json()) as any;
    const translated = payload?.translations?.[0]?.text ?? text;

    return NextResponse.json({ translated });
  } catch (err: any) {
    console.error("Translate route error", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}

