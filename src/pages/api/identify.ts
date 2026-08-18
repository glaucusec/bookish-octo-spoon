import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const requests = new Map<
  string,
  { day: string; count: number; last: number }
>();
let quota = { day: "", count: 0 };

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const json = (status: number, message: string, extra = {}) =>
    new Response(JSON.stringify({ success: status < 400, message, ...extra }), {
      status,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  const type = request.headers.get("content-type") || "";
  if (!type.includes("multipart/form-data"))
    return json(415, "Upload plant photos as form data.");

  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const ip =
    clientAddress || request.headers.get("cf-connecting-ip") || "unknown";
  const current = requests.get(ip);
  const record = current?.day === day ? current : { day, count: 0, last: 0 };
  if (now - record.last < 6000)
    return json(429, "Please wait a few seconds before trying again.");
  if (record.count >= 8)
    return json(
      429,
      "You have reached today’s free identification limit. Please try again tomorrow.",
    );
  if (quota.day !== day) quota = { day, count: 0 };
  if (quota.count >= 450)
    return json(
      429,
      "Today’s free identification capacity has been reached. Please try again tomorrow.",
    );

  try {
    const body = await request.formData();
    const images = body
      .getAll("images")
      .filter((value): value is File => value instanceof File);
    if (!images.length || images.length > 3)
      return json(400, "Add between 1 and 3 photos of the same plant.");
    const validTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (
      images.some(
        (file) => !validTypes.has(file.type) || file.size > 3 * 1024 * 1024,
      )
    )
      return json(
        400,
        "Each processed photo must be a JPEG, PNG or WebP under 3 MB.",
      );

    const apiKey =
      (env as { PLANTNET_API_KEY?: string }).PLANTNET_API_KEY ||
      import.meta.env.PLANTNET_API_KEY;
    if (!apiKey)
      return json(
        503,
        "Plant identification is not configured yet. Add the PlantNet API key and try again.",
      );

    const upstream = new FormData();
    images.forEach((file) => {
      upstream.append("images", file, file.name);
      upstream.append("organs", "auto");
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(
      `https://my-api.plantnet.org/v2/identify/all?api-key=${encodeURIComponent(apiKey)}&lang=en&include-related-images=false&no-reject=true`,
      { method: "POST", body: upstream, signal: controller.signal },
    );
    clearTimeout(timeout);
    if (response.status === 429)
      return json(
        429,
        "Today’s free identification capacity has been reached. Please try again tomorrow.",
      );
    if (!response.ok)
      return json(
        502,
        "The plant service is temporarily unavailable. Try again in a moment.",
      );
    const data = await response.json();
    const matches = (data.results || []).slice(0, 3).map((item: any) => ({
      scientificName:
        item.species?.scientificNameWithoutAuthor ||
        item.species?.scientificName,
      commonNames: item.species?.commonNames || [],
      confidence: Number(item.score || 0),
      family:
        item.species?.family?.scientificNameWithoutAuthor ||
        item.species?.family?.scientificName ||
        null,
      genus:
        item.species?.genus?.scientificNameWithoutAuthor ||
        item.species?.genus?.scientificName ||
        null,
    }));
    if (!matches.length)
      return json(
        422,
        "We could not find a reliable match. Try a clearer leaf or flower photo.",
      );
    requests.set(ip, { day, count: record.count + 1, last: now });
    quota.count += 1;
    return json(200, "Identification complete.", { matches });
  } catch (error) {
    console.error("Plant identification failed:", error);
    if (error instanceof Error && error.name === "AbortError")
      return json(
        504,
        "The identification took too long. Try again with a smaller or clearer photo.",
      );
    return json(
      500,
      "The identification could not be completed. Check your connection and try again.",
    );
  }
};

export const ALL: APIRoute = () =>
  new Response(
    JSON.stringify({ success: false, message: "Method not allowed." }),
    {
      status: 405,
      headers: { "content-type": "application/json", allow: "POST" },
    },
  );
