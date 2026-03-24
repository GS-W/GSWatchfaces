const gplayRaw = require('google-play-scraper');
const gplay = gplayRaw.default || gplayRaw;
const fs = require('fs');

// Configuration
const targetPackages = [
    'com.watchfacestudio.fw'
];

// Compliance Settings
const REQUIRED_LINK_OR_TEXT = 'wear os toolset'; // Text or package name to look for
const MAX_STRIKES = 3;
const STRIKES_FILE = './strikes.json';
const OUTPUT_FILE = './watchfaces.json';

// 1. Load existing strike history
let strikeState = {};
if (fs.existsSync(STRIKES_FILE)) {
    try {
        strikeState = JSON.parse(fs.readFileSync(STRIKES_FILE, 'utf8'));
    } catch (e) {
        console.error("Could not read strikes.json, starting fresh.");
    }
}

// 2. Load previous successful run data (for fallback on errors)
let previousData = [];
if (fs.existsSync(OUTPUT_FILE)) {
    try {
        previousData = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    } catch (e) {
        console.error("Could not read watchfaces.json, starting fresh.");
    }
}

function inferWatchFaceType(title, description) {
    const textToSearch = `${title} ${description}`.toLowerCase();
    
    if (textToSearch.includes('hybrid')) return 'Hybrid';
    if (textToSearch.includes('analog')) return 'Analog';
    if (textToSearch.includes('digital')) return 'Digital';
    if (textToSearch.includes('dashboard') || textToSearch.includes('lcd')) return 'Dashboard';
    
    return 'Standard';
}

async function generateShowcaseData() {
    console.log(`Starting scrape for ${targetPackages.length} packages...`);
    const results = [];

    for (const pkg of targetPackages) {
        // Initialize strike counter if this is a newly tracked package
        if (typeof strikeState[pkg] === 'undefined') {
            strikeState[pkg] = 0;
        }

        try {
            const appData = await gplay.app({ 
                appId: pkg,
                lang: 'en',
                country: 'us' 
            });

            // 3. Check for compliance
            const description = (appData.description || "").toLowerCase();
            const isCompliant = description.includes(REQUIRED_LINK_OR_TEXT.toLowerCase());

            if (isCompliant) {
                strikeState[pkg] = 0; // Reset strikes to 0
                console.log(`✅ Compliant: ${appData.title}`);
            } else {
                strikeState[pkg] += 1; // Increment strike
                console.log(`⚠️ Missing Link: ${appData.title} (Strike ${strikeState[pkg]}/${MAX_STRIKES})`);
            }

            // 4. Determine if we should include this app
            if (strikeState[pkg] < MAX_STRIKES) {
                const showcaseItem = {
                    packageName: appData.appId,
                    appName: appData.title,
                    developer: appData.developer,
                    rating: appData.scoreText,
                    rawRating: appData.score,
                    downloads: appData.installs,
                    rawDownloads: appData.maxInstalls,
                    price: appData.free ? (appData.offersIAP ? "Free (IAP)" : "Free") : appData.priceText,
                    featureHighlight: appData.summary,
                    iconUrl: appData.icon,
                    heroImageUrl: appData.headerImage,
                    watchFaceType: inferWatchFaceType(appData.title, appData.description)
                };
                results.push(showcaseItem);
            } else {
                console.log(`❌ Dropped: ${appData.title} has reached max strikes.`);
            }

        } catch (error) {
            // 5. Handle Scraper Failures Safely
            console.error(`🚨 Scrape Failed for ${pkg}:`, error.message);
            console.log(`   -> Skipping strike increment. Falling back to cached data.`);
            
            // Find the last known good data for this package
            const cachedApp = previousData.find(item => item.packageName === pkg);
            
            // Only push the cached version if it wasn't previously struck out
            if (cachedApp && strikeState[pkg] < MAX_STRIKES) {
                results.push(cachedApp);
                console.log(`   -> ♻️ Restored ${pkg} from previous run.`);
            }
        }

        // Wait 2 seconds between requests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 6. Save new states
    fs.writeFileSync(STRIKES_FILE, JSON.stringify(strikeState, null, 2));
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    
    console.log('🎉 Successfully saved to watchfaces.json and updated strikes.json');
}

generateShowcaseData();
