#!/usr/bin/env node
/**
 * Generate testimonial headshots via Gemini Nano Banana Pro
 * (gemini-3-pro-image-preview).
 *
 * Usage:
 *   GEMINI_API_KEY=xxx node scripts/generate-testimonial-headshots.mjs [slug]
 *
 * Pass a slug to regenerate a single subject; omit to generate all.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(REPO_ROOT, 'packages/web/public/testimonials');

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('GEMINI_API_KEY not set');
  process.exit(1);
}

const MODEL = 'gemini-3-pro-image-preview';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

const BASE_STYLE =
  'Editorial portrait headshot, shoulders-up, direct eye contact, soft natural window light, shallow depth of field, modern blurred studio background, warm film tones, candid friendly expression, photoreal, 85mm lens, shot on Leica, ultra sharp, 4k, no text, no watermark, no logos.';

/** @type {{ slug: string; prompt: string }[]} */
const subjects = [
  {
    slug: 'mira-chen',
    prompt:
      'A 29-year-old East Asian woman, UX designer, shoulder-length dark brown hair with soft waves, minimal tasteful makeup, small silver earrings, wearing a cream knit sweater. Confident creative-professional vibe. Soft indigo-tinted bokeh background.',
  },
  {
    slug: 'james-osei',
    prompt:
      'A 26-year-old Black man, Ghanaian heritage, PhD student, short curly hair, neat short beard, wearing a navy crewneck sweatshirt over a white t-shirt. Intelligent, approachable smile. Warm amber-tinted academic background bokeh.',
  },
  {
    slug: 'sarah-okonkwo',
    prompt:
      'A 34-year-old Black woman, Nigerian heritage, productivity coach, natural dark curly hair in a low puff, warm brown skin, subtle gold hoop earrings, wearing a sage-green linen blazer over a white top. Calm confident expression. Soft emerald bokeh background.',
  },
  {
    slug: 'lea-rossi',
    prompt:
      'A 28-year-old Italian woman, freelance illustrator, messy auburn shoulder-length hair with a loose bun, freckles, small nose stud, wearing a mustard corduroy shirt with a paint smudge on the sleeve. Creative playful expression. Soft warm rose bokeh background.',
  },
  {
    slug: 'noah-park',
    prompt:
      'A 31-year-old Korean-American man, software engineering lead, short well-groomed black hair, clean-shaven, subtle round glasses, wearing a charcoal zip-up fleece over a graphite t-shirt. Focused friendly expression. Soft sky-blue tech-office bokeh background.',
  },
  {
    slug: 'maria-santos',
    prompt:
      'A 40-year-old Latina woman, high school teacher, shoulder-length wavy dark brown hair with subtle highlights, warm olive skin, minimal makeup, wearing a burgundy cardigan over a pale pink blouse. Warm welcoming smile. Soft violet classroom bokeh background.',
  },
  {
    slug: 'sarah-chen',
    prompt:
      'A 24-year-old Chinese-American woman, graduate student, long straight black hair, round wire-rim glasses, wearing a heather-gray sweatshirt. Bright studious expression. Soft indigo library-bokeh background.',
  },
  {
    slug: 'marcus-rivera',
    prompt:
      'A 33-year-old Latino man, product designer, medium-length wavy dark brown hair, trimmed short beard, golden-brown skin, wearing a beige overshirt over a white tee. Relaxed confident expression. Soft warm amber studio bokeh background.',
  },
  {
    slug: 'aiko-tanaka',
    prompt:
      'A 38-year-old Japanese woman, music teacher, medium-length straight black hair with side-swept bangs, small pearl earrings, wearing a camel turtleneck. Gentle kind smile. Soft leather-brown toned bokeh background.',
  },
];

async function generateOne(subject) {
  const fullPrompt = `${subject.prompt} ${BASE_STYLE}`;
  const body = {
    contents: [{ parts: [{ text: fullPrompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: '1:1' },
    },
  };

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API ${res.status} for ${subject.slug}: ${errText}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p) => p.inlineData?.data);
  if (!imgPart) {
    throw new Error(`No image returned for ${subject.slug}: ${JSON.stringify(data).slice(0, 500)}`);
  }

  const buffer = Buffer.from(imgPart.inlineData.data, 'base64');
  const outPath = resolve(OUT_DIR, `${subject.slug}.png`);
  await writeFile(outPath, buffer);
  const kb = (buffer.length / 1024).toFixed(1);
  console.log(`✓ ${subject.slug}.png (${kb} KB)`);
  return outPath;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const filterSlug = process.argv[2];
  const queue = filterSlug ? subjects.filter((s) => s.slug === filterSlug) : subjects;
  if (!queue.length) {
    console.error(`No subject matches "${filterSlug}"`);
    process.exit(1);
  }

  console.log(`Generating ${queue.length} headshot${queue.length === 1 ? '' : 's'} via ${MODEL}...`);
  const results = await Promise.allSettled(queue.map(generateOne));

  const failed = results
    .map((r, i) => (r.status === 'rejected' ? { subject: queue[i], error: r.reason } : null))
    .filter(Boolean);

  if (failed.length) {
    console.error(`\n${failed.length} failure(s):`);
    for (const f of failed) {
      console.error(`  ${f.subject.slug}:`, f.error.message ?? f.error);
    }
    process.exit(1);
  }

  console.log(`\nAll ${queue.length} headshot${queue.length === 1 ? '' : 's'} written to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
