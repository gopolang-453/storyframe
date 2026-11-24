import { createServerFn } from "@tanstack/react-start";

const CHAT_MODEL = "grok-4.5";
const IMAGE_MODEL = "grok-imagine-image";
const VIDEO_MODEL = "grok-imagine-video-1.5-lite";
const CLIP_SECONDS = 6;
const STORY_MAX = 1800;

export type FilmPlan = {
  title: string;
  shot: string;
  imagePrompt: string;
  motionPrompt: string;
  lines: string[];
};

function apiKey(): string {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("AI is not available in this environment.");
  return key;
}

async function xai(path: string, init: RequestInit & { timeoutMs: number }): Promise<unknown> {
  const { timeoutMs, ...rest } = init;
  const res = await fetch(`https://api.x.ai/v1${path}`, {
    ...rest,
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
      ...(rest.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const record = body as { error?: { message?: string } | string; message?: string } | null;
    const nested = record?.error;
    const message =
      (typeof nested === "string" ? nested : nested?.message) ||
      record?.message ||
      (text ? text.slice(0, 280) : `xAI API error ${res.status}`);
    if (res.status === 402 || /spending-limit|run out of credits/i.test(message)) {
      throw new Error("Image and video credits are used up.");
    }
    throw new Error(message);
  }
  return body;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function cleanLine(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function parsePlan(raw: string): FilmPlan {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("The director returned something I could not read. Try again.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new Error("The director returned something I could not read. Try again.");
  }
  const record = asRecord(parsed);
  if (!record) throw new Error("The director returned something I could not read. Try again.");
  const title = cleanLine(record.title, 80) || "Untitled";
  const shot = cleanLine(record.shot, 240);
  const imagePrompt = cleanLine(record.imagePrompt, 900);
  const motionPrompt = cleanLine(record.motionPrompt, 700);
  const lines = Array.isArray(record.lines)
    ? record.lines.map((line) => cleanLine(line, 140)).filter(Boolean).slice(0, 3)
    : [];
  if (!imagePrompt || !motionPrompt) {
    throw new Error("The director did not describe a shot. Try again.");
  }
  return {
    title,
    shot: shot || title,
    imagePrompt,
    motionPrompt,
    lines: lines.length > 0 ? lines : [shot || title],
  };
}

function readStory(input: unknown): string {
  const story = asRecord(input)?.story;
  if (typeof story !== "string") throw new Error("Write a story first.");
  const trimmed = story.trim();
  if (trimmed.length < 20) throw new Error("Write at least a few sentences.");
  if (trimmed.length > STORY_MAX) throw new Error("Keep the story under 1800 characters.");
  return trimmed;
}

export const planStory = createServerFn({ method: "POST" })
  .validator((input: unknown) => ({ story: readStory(input) }))
  .handler(async ({ data }): Promise<FilmPlan> => {
    const body = (await xai("/chat/completions", {
      method: "POST",
      timeoutMs: 40_000,
      body: JSON.stringify({
        model: CHAT_MODEL,
        temperature: 0.7,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a film director. Turn the user's story into one 6-second shot. " +
              "Reply with JSON only, keys: title, shot, imagePrompt, motionPrompt, lines. " +
              "title: short film title. shot: one sentence of what the camera sees. " +
              "imagePrompt: a single cinematic 16:9 still, concrete place, light, and subject. No text, letters, logos, or watermarks in the image. " +
              "motionPrompt: how that still should move for 6 seconds, including the story's action. No on-screen text or subtitles. " +
              "lines: exactly 3 short captions that tell the story in order, each under 12 words. " +
              "Do not add characters or events that are not in the story.",
          },
          { role: "user", content: data.story },
        ],
      }),
    })) as { choices?: { message?: { content?: string } }[] };
    const raw = body.choices?.[0]?.message?.content ?? "";
    return parsePlan(raw);
  });

export const renderFrame = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const imagePrompt = cleanLine(asRecord(input)?.imagePrompt, 900);
    if (!imagePrompt) throw new Error("Missing picture prompt.");
    return { imagePrompt };
  })
  .handler(async ({ data }): Promise<{ imageUrl: string }> => {
    const body = (await xai("/images/generations", {
      method: "POST",
      timeoutMs: 55_000,
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt: `${data.imagePrompt} Cinematic film still, natural light, no text, no letters, no watermark.`,
        aspect_ratio: "16:9",
        resolution: "1k",
        n: 1,
        response_format: "url",
      }),
    })) as { data?: { url?: string }[] };
    const imageUrl = body.data?.[0]?.url;
    if (!imageUrl) throw new Error("The picture came back without a link.");
    return { imageUrl };
  });

export const startClip = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const record = asRecord(input);
    const motionPrompt = cleanLine(record?.motionPrompt, 700);
    const imageUrl = cleanLine(record?.imageUrl, 2000);
    if (!motionPrompt) throw new Error("Missing motion prompt.");
    return { motionPrompt, imageUrl };
  })
  .handler(async ({ data }): Promise<{ requestId: string }> => {
    const payload: Record<string, unknown> = {
      model: VIDEO_MODEL,
      prompt: `${data.motionPrompt} Six seconds, cinematic, no on-screen text, no subtitles, no watermark.`,
      duration: CLIP_SECONDS,
      aspect_ratio: "16:9",
      resolution: "720p",
    };
    if (data.imageUrl.startsWith("https://")) {
      payload.image = { url: data.imageUrl };
    }
    const body = (await xai("/videos/generations", {
      method: "POST",
      timeoutMs: 30_000,
      body: JSON.stringify(payload),
    })) as { request_id?: string };
    if (!body.request_id) throw new Error("The film did not start.");
    return { requestId: body.request_id };
  });

export const clipStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const requestId = cleanLine(asRecord(input)?.requestId, 80);
    if (!/^[a-zA-Z0-9-]+$/.test(requestId)) throw new Error("Missing film id.");
    return { requestId };
  })
  .handler(async ({ data }): Promise<{ status: string; videoUrl: string }> => {
    const body = (await xai(`/videos/${data.requestId}`, {
      method: "GET",
      timeoutMs: 20_000,
    })) as { status?: string; video?: { url?: string }; error?: string };
    const status = body.status || "pending";
    if (status === "failed" || status === "expired") {
      throw new Error(body.error || "The clip did not finish.");
    }
    return { status, videoUrl: body.video?.url ?? "" };
  });
