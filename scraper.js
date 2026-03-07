const gplayRaw = require('google-play-scraper');
const gplay = gplayRaw.default || gplayRaw; // Unwraps it safely
const fs = require('fs');

// Add the package names you want to showcase here
const targetPackages = [
    'com.gs.watchface.weather11',
];

// Helper to infer the watch face type from text
function inferWatchFaceType(title, description) {
    const textToSearch = `${title} ${description}`.toLowerCase();
    
    if (textToSearch.includes('hybrid')) return 'Hybrid';
    if (textToSearch.includes('analog')) return 'Analog';
    if (textToSearch.includes('digital')) return 'Digital';
    if (textToSearch.includes('dashboard') || textToSearch.includes('lcd')) return 'Dashboard';
    
    return 'Standard'; // Fallback
}

async function generateShowcaseData() {
    console.log(`Starting scrape for ${targetPackages.length} packages...`);
    const results = [];

    for (const pkg of targetPackages) {
        try {
            // Fetch data from the Play Store
            // const appData = await gplay.app({ appId: pkg });
            const appData = await gplay.app({ 
                appId: pkg,
                lang: 'en',
                country: 'us' // Change this if your apps are region-locked to Europe, etc.
            });

            // Structure the data to match your Kotlin model
            const showcaseItem = {
                packageName: appData.appId,
                appName: appData.title,
                developer: appData.developer,
                rating: appData.scoreText, // e.g., "4.5"
                rawRating: appData.score,  // e.g., 4.5123 (for sorting)
                downloads: appData.installs, // e.g., "1,000,000+"
                rawDownloads: appData.maxInstalls, // Exact number for sorting
                price: appData.free ? (appData.offersIAP ? "Free (IAP)" : "Free") : appData.priceText,
                featureHighlight: appData.summary, // The short description
                iconUrl: appData.icon,
                heroImageUrl: appData.headerImage,
                watchFaceType: inferWatchFaceType(appData.title, appData.description)
            };

            results.push(showcaseItem);
            console.log(`✅ Scraped: ${appData.title} (${showcaseItem.watchFaceType})`);
            
            // Wait 2 seconds between requests to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            console.error(`❌ Failed to scrape ${pkg}:`, error.message);
        }
    }

    // Save to JSON file
    fs.writeFileSync('watchfaces.json', JSON.stringify(results, null, 2));
    console.log('🎉 Successfully saved to watchfaces.json');
}

generateShowcaseData();
