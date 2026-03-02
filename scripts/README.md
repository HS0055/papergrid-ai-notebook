# PaperGrid Data Pipelines

This directory contains standalone scripts for maintaining the PaperGrid AI reference datasets.

## Reference Scraper Pipeline (Phase 2)

We use Firecrawl to scrape top-performing Etsy structural planners to train our AI models.
Instead of hand-coding templates, the system searches Etsy using the queries in `links.txt`, extracts the titles, descriptions, and thumbnails of the planners, and saves them locally.

These extracted details will be sent to Gemini Vision in Phase 3 to reverse-engineer them into JSON layouts.

### Setup
Ensure you have set the `FIRECRAWL_API_KEY` in your `.env` file at the root of the project.

### Running the Scraper
From the root of the monorepo, run:
```bash
npm run scrape
```

The script will automatically populate:
- `data/reference-images/` (downloaded product thumbnails)
- `data/scraped-references.json` (the structured metadata for Vision ingestion)
