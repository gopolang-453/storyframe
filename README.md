# Storyframe

Write a story. Storyframe turns it into a short film.

1. A director step (`grok-4.5`) reads the story and writes one shot: title, picture prompt, motion prompt, and three captions.
2. A sketch film is drawn in the browser from that shot, so there is always something to watch.
3. If image credits are available, `grok-imagine-image` makes a 16:9 still and `grok-imagine-video-1.5-lite` films it for 6 seconds.

The sketch does not call the image or video models. The photographic clip spends xAI credits and only runs when you press **Make the film**.

This repository is the Storyframe source. The live app runs on the Grok app builder, which injects `XAI_API_KEY` on the server. Do not commit a key.

## Source

- `src/lib/film.functions.ts` — plan, still, and clip calls
- `src/components/sketch-film.tsx` — on-device sketch
- `src/components/studio.tsx` — the page
