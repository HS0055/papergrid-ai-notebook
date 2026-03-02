import FirecrawlApp from "@mendable/firecrawl-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.FIRECRAWL_API_KEY;
if (!apiKey) {
    console.error("FIRECRAWL_API_KEY is not set in the environment variables.");
    process.exit(1);
}

const app = new FirecrawlApp({ apiKey });

const LINKS_FILE = path.join(__dirname, "links.txt");
const IMAGES_DIR = path.join(__dirname, "..", "data", "reference-images");
const OUTPUT_FILE = path.join(__dirname, "..", "data", "scraped-references.json");

interface ScrapedReference {
    id: string;
    url: string;
    title: string;
    description: string;
    imagePath: string;
    source: string;
}

async function scrapeUrlForPlanners(query: string) {
    const scrapedData: ScrapedReference[] = [];
    console.log(`\n🔍 Searching: ${query}`);

    try {
        const searchResult = await app.search(query, {
            limit: 5 // Get top 5 results per search query to build our dataset
        } as any);

        // Wait, app.search() in v2 returns { success, data: Array<SearchResultWeb | Document> } or { web, news... }
        // Let's check searchResult
        let linksArray: any[] = [];
        if (searchResult && (searchResult as any).success && (searchResult as any).data) {
            linksArray = (searchResult as any).data;
        } else if (searchResult && (searchResult as any).web) {
            linksArray = (searchResult as any).web;
        } else if (Array.isArray(searchResult)) {
            linksArray = searchResult;
        } else if (searchResult && (searchResult as any).success === false) {
            console.error(`Failed to search ${query}: ${JSON.stringify(searchResult)}`);
            return [];
        } else {
            console.error(`Unknown search result format: ${JSON.stringify(searchResult).substring(0, 100)}`);
            return []; // failsafe
        }

        console.log(`Found ${linksArray.length} search results.`);

        for (const [index, linkItem] of linksArray.entries()) {
            const listingUrl = linkItem.url || linkItem;
            if (!listingUrl || typeof listingUrl !== 'string') continue;

            console.log(`\n📥 Scraping Result ${index + 1}: ${listingUrl}`);

            try {
                // v2 SDK LLM extraction is handled inside the formats array using `{ type: 'json' }`
                const scrapeResult = await app.scrape(listingUrl, {
                    formats: [{
                        type: "json",
                        prompt: "Extract the listing title, the main product image URL (the highest quality thumbnail showing the planner design), and a detailed summary of the planner features (pages included, layout style, etc).",
                        schema: {
                            type: "object",
                            properties: {
                                title: { type: "string" },
                                mainImageUrl: { type: "string" },
                                featureSummary: { type: "string" }
                            },
                            required: ["title", "mainImageUrl", "featureSummary"]
                        }
                    }]
                } as any);

                // Firecrawl scrape returns the root Document object in v2.
                let extractData = null;
                if (scrapeResult && (scrapeResult as any).json) {
                    extractData = (scrapeResult as any).json;
                } else if (scrapeResult && (scrapeResult as any).data && (scrapeResult as any).data.json) {
                    extractData = (scrapeResult as any).data.json;
                }

                if (extractData) {
                    const id = `fc-ref-${Date.now()}-${index}`;

                    let localImagePath = "";
                    if (extractData.mainImageUrl) {
                        try {
                            console.log(`   Downloading image: ${extractData.mainImageUrl}`);
                            const imageRes = await fetch(extractData.mainImageUrl);
                            if (imageRes.ok) {
                                const buffer = await imageRes.arrayBuffer();
                                const ext = path.extname(new URL(extractData.mainImageUrl).pathname) || '.jpg';
                                const filename = `${id}${ext}`;
                                localImagePath = path.join(IMAGES_DIR, filename);
                                fs.writeFileSync(localImagePath, Buffer.from(buffer));
                                console.log(`   Saved image to ${localImagePath}`);
                                localImagePath = `data/reference-images/${filename}`;
                            } else {
                                console.error(`   Failed to fetch image HTTP ${imageRes.status}`);
                            }
                        } catch (imgError) {
                            console.error(`   Failed to download image: ${(imgError as Error).message}`);
                        }
                    }

                    scrapedData.push({
                        id,
                        url: listingUrl,
                        title: extractData.title || "Unknown Title",
                        description: extractData.featureSummary || "No description provided",
                        imagePath: localImagePath,
                        source: "Firecrawl Search"
                    });
                } else {
                    console.error(`  Extraction failed or missing for ${listingUrl}. Result: ${JSON.stringify(scrapeResult).substring(0, 100)}`);
                }
            } catch (err) {
                console.error(`  Error scraping listing ${listingUrl}: ${(err as Error).message}`);
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
        }

    } catch (error) {
        console.error(`Error processing query ${query}:`, error);
    }

    return scrapedData;
}

async function main() {
    if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

    if (!fs.existsSync(LINKS_FILE)) {
        console.error(`Links file not found at ${LINKS_FILE}`);
        process.exit(1);
    }

    const links = fs.readFileSync(LINKS_FILE, 'utf-8').split('\n').filter(line => line.trim() !== '' && !line.startsWith('#'));
    console.log(`Found ${links.length} search queries to process.`);

    let allReferences: ScrapedReference[] = [];

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify([], null, 2));

    for (const link of links) {
        const results = await scrapeUrlForPlanners(link.trim());
        allReferences = [...allReferences, ...results];

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allReferences, null, 2));
        console.log(`\n💾 Saved incremental progress. Total references so far: ${allReferences.length}`);
    }

    console.log(`\n✅ Scraping complete! Scraped ${allReferences.length} total references.`);
    console.log(`Data saved to ${OUTPUT_FILE}`);
}

main().catch(console.error);
