# Plant Identifier

Plant Identifier is a mobile-first Astro application that identifies plants from one to three photos. It processes and compresses images in the browser, sends them through a server-side Cloudflare endpoint, and returns normalized Pl@ntNet species matches with confidence scores.

The V1 product is intentionally simple: it has no accounts, subscriptions, database, saved garden, permanent image library, or native app requirement.

## What is included

- Upload, drag-and-drop, paste, and mobile camera input
- Up to three photos of the same plant
- Browser-side image validation, conversion, resizing, and JPEG compression
- Support for common web images plus HEIC/HEIF and TIFF conversion
- Server-side Pl@ntNet API key protection
- Top-three species matches with confidence, family, and genus data
- Low-confidence guidance and user-friendly error states
- Per-IP request pacing and validation-phase quota guards
- SEO landing pages for leaf, flower, tree, houseplant, and succulent identification
- Canonical metadata, Open Graph metadata, JSON-LD, `robots.txt`, and `sitemap.xml`
- Privacy, terms, contact, about, disclaimer, and custom 404 pages
- Cloudflare adapter and server output
- Responsive, keyboard-accessible interface

The complete product and business plan is in [`plant-identifier-project-plan.md`](./plant-identifier-project-plan.md).

## Technology

- [Astro](https://astro.build/) 7
- TypeScript
- Astro components and minimal client-side JavaScript
- Native CSS
- [Astro Cloudflare adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Pl@ntNet API](https://my.plantnet.org/)
- `heic-to` for HEIC/HEIF conversion
- `utif` for TIFF conversion

Node.js 22.12 or newer and pnpm are required.

## Getting started

1. Install dependencies:

   ```sh
   pnpm install
   ```

2. Create the local environment file:

   ```sh
   cp .env.example .env
   ```

3. Add a valid Pl@ntNet API key to `.env`:

   ```dotenv
   PLANTNET_API_KEY=your_key_here
   ```

4. Start Astro in background mode:

   ```sh
   pnpm astro dev --background
   ```

5. Open <http://localhost:4321>.

The site renders without an API key, but identification requests return a configuration error until `PLANTNET_API_KEY` is set.

### Background server commands

```sh
pnpm astro dev status
pnpm astro dev logs
pnpm astro dev stop
```

Use these commands instead of starting a second development server.

## Environment variables

| Variable | Required now | Purpose |
| --- | --- | --- |
| `PLANTNET_API_KEY` | Yes | Server-side credential used by `/api/identify`. Never prefix this with `PUBLIC_`. |
| `TURNSTILE_SECRET_KEY` | No | Reserved for server-side Cloudflare Turnstile verification. Turnstile is not wired into V1 yet. |
| `PUBLIC_TURNSTILE_SITE_KEY` | No | Reserved for the future browser-side Turnstile widget. |

Do not commit `.env` or production secrets. The repository ignores `.env` and `.env.production`; configure production secrets in Cloudflare instead.

## Available commands

| Command | Action |
| --- | --- |
| `pnpm install` | Install project dependencies |
| `pnpm astro dev --background` | Start the managed background development server |
| `pnpm astro dev status` | Check the background server |
| `pnpm astro dev logs` | Read background server logs |
| `pnpm astro dev stop` | Stop the background server |
| `pnpm build` | Create the production Cloudflare build in `dist/` |
| `pnpm preview` | Preview a completed production build |
| `pnpm astro -- --help` | Show Astro CLI help |

## How identification works

```text
Browser
  ├─ validates 1–3 image files, up to 10 MB each
  ├─ converts HEIC/HEIF or TIFF when needed
  ├─ resizes the longest edge to at most 1600 px
  └─ compresses each upload to JPEG
          │
          ▼
POST /api/identify
  ├─ accepts multipart form data under the `images` field
  ├─ validates 1–3 JPEG/PNG/WebP files, up to 3 MB each
  ├─ applies request and quota guards
  ├─ calls Pl@ntNet with the private API key
  └─ returns only the fields used by the interface
          │
          ▼
Top three normalized plant matches
```

Example successful response:

```json
{
  "success": true,
  "message": "Identification complete.",
  "matches": [
    {
      "scientificName": "Epipremnum aureum",
      "commonNames": ["Golden pothos"],
      "confidence": 0.91,
      "family": "Araceae",
      "genus": "Epipremnum"
    }
  ]
}
```

Provider-specific data is normalized in [`src/pages/api/identify.ts`](./src/pages/api/identify.ts). The browser does not receive the Pl@ntNet key or the complete upstream response.

## API guards and current limitations

The endpoint currently enforces:

- `POST` and `multipart/form-data` only
- One to three processed images per request
- JPEG, PNG, or WebP server input
- Maximum processed size of 3 MB per image
- At least six seconds between successful identifications per IP
- Eight successful identifications per IP per UTC day
- An internal target of 450 successful identifications per UTC day
- A 20-second upstream timeout
- Sanitized errors with no stack traces returned to the browser

The request counters are held in the Cloudflare isolate's memory. They are useful validation-phase safeguards but are not globally durable and can reset when an isolate restarts. Before meaningful public traffic, replace or supplement them with a Cloudflare-native distributed rate limiter, durable storage, and Turnstile when abuse justifies it. The application never silently switches to paid API usage.

## Analytics events

The uploader creates a `window.dataLayer`-compatible queue and pushes these events into it:

- `plant_upload_started`
- `plant_identification_submitted`
- `plant_identification_success`
- `plant_identification_failed`
- `low_confidence_result`

No analytics provider is installed by default. Image content and image files must never be added to analytics payloads.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Main plant identification experience |
| `/plant-identifier-by-photo/` | General photo-identification landing page |
| `/leaf-identifier/` | Leaf-focused identification guidance |
| `/flower-identifier/` | Flower-focused identification guidance |
| `/tree-identifier/` | Tree-focused identification guidance |
| `/houseplant-identifier/` | Indoor plant identification guidance |
| `/succulent-identifier/` | Succulent identification guidance |
| `/about/` | Product purpose and approach |
| `/contact/` | Contact details |
| `/privacy-policy/` | Image and technical-data handling |
| `/terms/` | Terms of use |
| `/disclaimer/` | Accuracy and safety limitations |
| `/api/identify` | Server-only identification endpoint |

## Project structure

```text
public/
├── brand/                  Brand assets
├── images/                 Site imagery
├── og.png                  Social preview image
├── robots.txt
└── sitemap.xml

src/
├── components/
│   ├── Header.astro
│   ├── Footer.astro
│   ├── PlantUploader.astro Browser interaction and result rendering
│   └── IdentifierLanding.astro
├── layouts/
│   └── Layout.astro        Shared metadata and document shell
├── pages/
│   ├── api/identify.ts     Protected Pl@ntNet proxy
│   ├── index.astro
│   └── ...                 SEO and legal routes
├── styles/global.css
└── types/utif.d.ts
```

## Privacy and safety requirements

- Uploaded photos are processed in memory and are not intentionally stored or published by this application.
- Photos are forwarded to Pl@ntNet for identification and are subject to the provider's applicable terms and privacy practices.
- Do not add permanent image storage without updating the product behavior and privacy policy.
- Identification is probabilistic and can be wrong.
- Never present a result as proof that a plant, berry, mushroom, or other material is edible, medicinal, poisonous, or safe for pets.
- High-stakes decisions require verification by a qualified local expert or appropriate medical, veterinary, or poison-control service.

## Production deployment

The Astro configuration uses server output with the Cloudflare adapter. Before deployment:

1. Run `pnpm build` and fix any build errors.
2. Configure `PLANTNET_API_KEY` as a Cloudflare secret or runtime environment binding.
3. Confirm `/api/identify` can reach Pl@ntNet from the deployed environment.
4. Test camera input and uploads on current iPhone Safari and Android Chrome.
5. Test invalid formats, oversized files, low-confidence results, quota responses, and timeouts.
6. Confirm canonical URLs use the final `https://plantidentifier.online` domain.
7. Review the privacy policy, terms, and contact address for the production operator.
8. Add Turnstile and durable rate limiting before scaling beyond validation traffic if abuse or API economics require them.

After deployment, submit `https://plantidentifier.online/sitemap.xml` to Google Search Console and Bing Webmaster Tools.

## Design direction

The visual system takes its primary cues from Evergreen's optimistic environmental design: generous space, rounded typography, confident forest green, bright lime actions, and restrained botanical motifs. The interaction remains upload-first so users can answer their plant-identification question immediately.

## Contributing

Keep V1 focused on identification quality, mobile usability, safety, performance, and search intent. Do not introduce accounts, subscriptions, saved gardens, permanent image storage, disease diagnosis, or a chatbot without a validated product reason and an explicit scope decision.

Before submitting a change:

```sh
pnpm build
```

Then manually test the affected route and, for uploader changes, test at least one desktop file upload and one mobile camera flow.
