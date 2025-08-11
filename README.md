## Runway Video-to-Video

A minimal, clean Next.js 14 app for video-to-video generation using Runway’s AI API. Paste a video URL, describe the transformation, and download the result.

## Highlights
- **URL-only input**: paste a direct HTTPS MP4 link
- **AI generation**: powered by Runway Gen4 Aleph
- **Live status**: realtime progress polling with cancellation
- **Multiple aspect ratios**: landscape, portrait, square, and more
- **One-click download**: save the output immediately

## Quick Start

### Install
```bash
npm install
```

### Configure environment
Create `.env.local` and add your Runway key:
```env
# Required
RUNWAY_API_KEY=your_actual_runway_api_key

# Optional (defaults shown)
# X_RUNWAY_VERSION=2024-12-01
# NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Run
```bash
npm run dev
```
Open http://localhost:3000.

## How to use
- Paste a direct HTTPS MP4 URL
- Enter a prompt describing the transformation
- Choose model and aspect ratio
- Click Generate and wait ~2–3 minutes
- Download the resulting video

## API
- POST `/api/generate` (JSON only)
  - body: `{ videoUrl, promptText, model, ratio, seed? }`
  - returns: `{ taskId }`
- GET `/api/task/[id]` → normalized task status with optional output URLs

## Configuration
- **Current model**: `gen4_aleph`
  - Focused for now; more models can be added in the future as needed.
- **Aspect ratios**: `1280:720`, `720:1280`, `960:960`, `1104:832`, `832:1104`, `1584:672`
- **API version**: defaults to `2024-12-01` via `X-Runway-Version`

## Production notes
- Inputs must be HTTPS URLs. If you need file uploads, implement secure storage in `lib/file-upload.ts` and extend `POST /api/generate` to accept multipart uploads.
- Generated videos are temporary; download them immediately.
- Each generation consumes Runway credits.

## Tech
- Next.js 14 (App Router), TypeScript, Tailwind CSS, Zod
- Runway public API via `fetch` (no SDK required)

## Structure
```
app/
  api/
    generate/route.ts   # generation endpoint (URL-only)
    task/[id]/route.ts  # status + cancel
  layout.tsx            # metadata + header
  page.tsx              # URL input + UI
components/toast.tsx    # toast notifications
lib/
  runway.ts             # Runway API wrapper
  validation.ts         # zod schemas + constants
```

## Roadmap
- Add more Runway models alongside `gen4_aleph`
- Optional file upload path with cloud storage (S3/R2)
- Persisted history of generations

## License
MIT