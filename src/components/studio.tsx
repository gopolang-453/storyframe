import { useEffect, useState } from "react";
import { Check, Clapperboard, Film, RotateCcw } from "lucide-react";
import {
  clipStatus,
  planStory,
  renderFrame,
  startClip,
  type FilmPlan,
} from "@/lib/film.functions";
import { localPlan, SketchFilm } from "@/components/sketch-film";

const DRAFT_KEY = "storyframe-draft";
const STORY_MAX = 1800;

const SAMPLES = [
  {
    id: "letter",
    label: "The unopened letter",
    text: "On a cold highveld night a boy stands on an empty station platform. A train passes without stopping. In his coat is a letter from his brother. He almost opens it, then puts it back, and watches the red tail light shrink into the dark.",
  },
  {
    id: "robot",
    label: "First step",
    text: "In a small workshop a knee-high robot tries to stand. Its first step knocks a tin of screws across the floor. It freezes, looks at the mess, then takes a second, slower step and stays upright.",
  },
  {
    id: "runners",
    label: "Two at dawn",
    text: "Two runners share a dirt road at dawn. One starts to fade. The other shortens his stride until they are side by side again. They finish together as the sun clears the grass.",
  },
] as const;

type Phase = "idle" | "planning" | "drawing" | "filming" | "ready" | "error";

const STEPS: { id: Phase; label: string }[] = [
  { id: "planning", label: "Reading the story" },
  { id: "drawing", label: "Drawing the frame" },
  { id: "filming", label: "Filming the clip" },
];

function stepState(phase: Phase, step: Phase): "wait" | "now" | "done" {
  const order: Phase[] = ["planning", "drawing", "filming", "ready"];
  const phaseIndex = order.indexOf(phase);
  const stepIndex = order.indexOf(step);
  if (phase === "error") return "wait";
  if (phaseIndex > stepIndex) return "done";
  if (phaseIndex === stepIndex) return "now";
  return "wait";
}

function messageFrom(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Try again.";
}

export function Studio() {
  const [story, setStory] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [plan, setPlan] = useState<FilmPlan | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [requestId, setRequestId] = useState("");
  const [error, setError] = useState("");
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) setStory(saved);
    } catch {
      /* draft is optional */
    }
  }, []);

  useEffect(() => {
    if (!plan || plan.lines.length < 2) return;
    const timer = window.setInterval(() => {
      setLineIndex((index) => (index + 1) % plan.lines.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [plan]);

  const busy = phase === "planning" || phase === "drawing" || phase === "filming";

  function remember(next: string) {
    setStory(next);
    try {
      localStorage.setItem(DRAFT_KEY, next);
    } catch {
      /* ignore quota */
    }
  }

  async function pollUntilDone(id: string) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 4000));
      const status = await clipStatus({ data: { requestId: id } });
      if (status.status === "done" && status.videoUrl) {
        setVideoUrl(status.videoUrl);
        setPhase("ready");
        return;
      }
    }
    throw new Error("The clip is taking too long. The still is ready — check again in a moment.");
  }

  async function filmStill(nextPlan: FilmPlan, stillUrl: string) {
    setPhase("filming");
    const started = await startClip({
      data: { motionPrompt: nextPlan.motionPrompt, imageUrl: stillUrl },
    });
    setRequestId(started.requestId);
    await pollUntilDone(started.requestId);
  }

  async function makeFilm() {
    setError("");
    setPlan(null);
    setImageUrl("");
    setVideoUrl("");
    setRequestId("");
    setLineIndex(0);
    setPhase("planning");
    let nextPlan: FilmPlan;
    try {
      nextPlan = await planStory({ data: { story } });
    } catch (err) {
      const msg = messageFrom(err);
      if (/write at least|keep the story|write a story/i.test(msg)) {
        setError(msg);
        setPhase("error");
        return;
      }
      nextPlan = localPlan(story);
      setError(`${msg} The sketch uses your sentences instead.`);
    }
    setPlan(nextPlan);
    setPhase("drawing");
    try {
      const frame = await renderFrame({ data: { imagePrompt: nextPlan.imagePrompt } });
      setImageUrl(frame.imageUrl);
      await filmStill(nextPlan, frame.imageUrl);
    } catch (err) {
      const msg = messageFrom(err);
      setError(
        /credits/i.test(msg)
          ? `${msg} The sketch from your story is playing instead. Add image credits in Grok if you want the photographic clip.`
          : msg,
      );
      setPhase("error");
    }
  }

  async function checkAgain() {
    if (!requestId) return;
    setError("");
    setPhase("filming");
    try {
      await pollUntilDone(requestId);
    } catch (err) {
      setError(messageFrom(err));
      setPhase("error");
    }
  }

  async function filmAgain() {
    if (!plan || !imageUrl) return;
    setError("");
    setVideoUrl("");
    try {
      await filmStill(plan, imageUrl);
    } catch (err) {
      setError(messageFrom(err));
      setPhase("error");
    }
  }

  const caption = plan?.lines[lineIndex] ?? "";
  const tooShort = story.trim().length < 20;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-sage uppercase">Short film</p>
          <h1 className="font-serif text-4xl leading-tight text-balance text-fg sm:text-5xl">
            Storyframe
          </h1>
          <p className="mt-2 max-w-md text-pretty text-muted">
            Write a story. A sketch plays at once. A 6-second photographic clip follows when image
            credits are available.
          </p>
        </div>
        <Film className="mt-1 size-6 shrink-0 text-sage" aria-hidden="true" />
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <section className="order-2 flex flex-col gap-4 lg:order-1">
          <label className="flex flex-col gap-2" htmlFor="story">
            <span className="text-sm font-medium text-fg">Your story</span>
            <textarea
              id="story"
              value={story}
              maxLength={STORY_MAX}
              onChange={(event) => remember(event.target.value)}
              placeholder="A boy waits on a dark platform with a letter he is afraid to open."
              className="min-h-44 resize-y rounded-2xl border border-line bg-surface px-4 py-3 text-base leading-relaxed text-fg outline-none placeholder:text-muted focus:border-sage"
            />
          </label>
          <div className="flex items-center justify-between text-sm text-muted">
            <span>At least a few sentences.</span>
            <span className="tabular-nums">
              {story.length}/{STORY_MAX}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((sample) => (
              <button
                key={sample.id}
                type="button"
                disabled={busy}
                onClick={() => remember(sample.text)}
                className="min-h-11 rounded-full border border-line bg-surface px-3 text-sm text-fg hover:border-sage disabled:opacity-50"
              >
                {sample.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={busy || tooShort}
            onClick={() => void makeFilm()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-sage px-5 text-base font-medium text-ink disabled:opacity-50"
          >
            <Clapperboard className="size-4" aria-hidden="true" />
            {busy ? "Working…" : "Make the film"}
          </button>
          <p className="text-sm leading-relaxed text-pretty text-muted">
            The sketch is drawn on this device and does not use credits. The photographic clip does:
            one picture and one 6-second video. Your story is sent only when you press the button.
            It is not stored on a server here.
          </p>
          {phase !== "idle" ? (
            <ol className="flex flex-col gap-2">
              {STEPS.map((step) => {
                const state = stepState(phase === "error" && imageUrl && step.id !== "filming" ? "filming" : phase, step.id);
                const doneOverride =
                  phase === "error" &&
                  ((step.id === "planning" && plan) || (step.id === "drawing" && imageUrl));
                const mark = doneOverride ? "done" : state;
                return (
                  <li key={step.id} className="flex items-center gap-3 text-sm">
                    <span
                      className={
                        "grid size-6 place-items-center rounded-full border text-xs tabular-nums " +
                        (mark === "done"
                          ? "border-sage bg-sage text-ink"
                          : mark === "now"
                            ? "border-sage text-sage"
                            : "border-line text-muted")
                      }
                      aria-hidden="true"
                    >
                    {mark === "done" ? (
                      <Check className="size-3.5" aria-hidden="true" />
                    ) : (
                      STEPS.findIndex((item) => item.id === step.id) + 1
                    )}
                    </span>
                    <span className={mark === "wait" ? "text-muted" : "text-fg"}>{step.label}</span>
                  </li>
                );
              })}
            </ol>
          ) : null}
          {error ? (
            <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-pretty text-fg" role="alert">
              {error}
            </p>
          ) : null}
          {phase === "error" && requestId ? (
            <button
              type="button"
              onClick={() => void checkAgain()}
              className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full border border-line px-4 text-sm text-fg"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Check the clip again
            </button>
          ) : null}
          {imageUrl && !videoUrl && phase !== "filming" && phase !== "drawing" && phase !== "planning" ? (
            <button
              type="button"
              onClick={() => void filmAgain()}
              className="inline-flex min-h-11 items-center justify-center self-start rounded-full border border-line px-4 text-sm text-fg"
            >
              Film this still again
            </button>
          ) : null}
        </section>

        <section className="order-1 flex flex-col gap-4 lg:order-2" aria-live="polite">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="relative aspect-video bg-ink">
              {videoUrl ? (
                <video
                  key={videoUrl}
                  className="size-full object-cover"
                  src={videoUrl}
                  poster={imageUrl || undefined}
                  controls
                  autoPlay
                  playsInline
                  aria-label={plan?.title ?? "Story film"}
                />
              ) : imageUrl ? (
                <img
                  src={imageUrl}
                  alt={plan?.shot ?? "Film still"}
                  className="frame-drift size-full object-cover"
                />
              ) : plan ? (
                <SketchFilm plan={plan} story={story} />
              ) : (
                <div className="flex size-full flex-col items-start justify-end gap-2 p-5">
                  <p className="font-serif text-3xl text-fg">The frame is dark</p>
                  <p className="max-w-xs text-sm text-pretty text-muted">
                    Write a story, then make the film. The sketch starts immediately.
                  </p>
                </div>
              )}
            </div>
          </div>
          {caption && (imageUrl || videoUrl) ? (
            <p className="text-center text-sm text-pretty text-fg">{caption}</p>
          ) : null}
          {plan ? (
            <div className="flex flex-col gap-2">
              <h2 className="font-serif text-2xl text-balance text-fg">{plan.title}</h2>
              <p className="text-sm text-pretty text-muted">{plan.shot}</p>
              {videoUrl ? (
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="self-start text-sm text-sage underline-offset-4 hover:underline"
                >
                  Open the film file
                </a>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
