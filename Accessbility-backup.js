//  The below commented code is for a script that processes an HTML file and a JSON report from Axe accessibility testing.
//  It identifies accessibility issues based on the report and attempts to fix them in the HTML file.
//  The script uses Cheerio for parsing and manipulating the HTML content, and it maps custom tags to standard HTML tags.
//  The fixed HTML is saved to a new file, and any elements that could not be found are logged.

const fs = require('fs');
const cheerio = require('cheerio');
const path = require('path');

if (process.argv.length < 4) {
    console.error('Usage: node fixAccessibility.js <path-to-html> <path-to-json>');
    process.exit(1);
}

const htmlPath = process.argv[2];
const jsonPath = process.argv[3];

const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const axeReport = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Map of custom tags to standard HTML tags
const wmMap = {
    'wm-button': 'button',
    'wm-label': 'label',
    'wm-input': 'input',
    'wm-textarea': 'textarea',
    'wm-select': 'select',
    'wm-link': 'a',
    'wm-icon': 'img',
    'wm-container': 'div'
};

// Load HTML preserving custom tags
const $ = cheerio.load(htmlContent, { xmlMode: false, decodeEntities: false });

let notFound = [];

// Utility: extract name="..." from source
function extractNameAttr(source) {
    const match = source.match(/name\s*=\s*["']([^"']+)["']/i);
    return match ? match[1] : null;
}

// Utility: extract tag name from source (<button ...> => "button")
function extractTagName(source) {
    const match = source.match(/^<\s*([a-zA-Z0-9\-_]+)/);
    return match ? match[1].toLowerCase() : null;
}

axeReport.allIssues.forEach(issue => {
    const nameAttr = extractNameAttr(issue.source);
    const tagName = extractTagName(issue.source);

    if (!nameAttr || !tagName) return;

    // Try matching the tag from HTML directly and its wm-mapped equivalent
    let selectorsToTry = [];

    // Standard tag selector
    selectorsToTry.push(`${tagName}[name="${nameAttr}"]`);

    // If tag is in wmMap values, try the wm-* key
    for (const [wmTag, stdTag] of Object.entries(wmMap)) {
        if (stdTag === tagName) {
            selectorsToTry.push(`${wmTag}[name="${nameAttr}"]`);
        }
    }

    // Check for element in HTML
    let foundElement = null;
    for (const sel of selectorsToTry) {
        if ($(sel).length) {
            foundElement = $(sel).first();
            break;
        }
    }

    if (foundElement) {
        // Apply fixes based on ruleId
        if (issue.ruleId === 'button-name') {
            if (!foundElement.attr('arialabel')) {
                foundElement.attr('arialabel', nameAttr);
            }
        } else if (issue.ruleId === 'link-in-text-block') {
            const currentStyle = foundElement.attr('style') || '';
            if (!/text-decoration/i.test(currentStyle)) {
                foundElement.attr('style', currentStyle + ';text-decoration:underline;');
            }
        } else if (issue.ruleId === 'meta-viewport') {
            $('meta[name="viewport"]').attr('content', 'width=device-width, initial-scale=1.0');
        }
    } else {
        notFound.push({
            name: nameAttr,
            tag: tagName,
            mappedTag: Object.keys(wmMap).find(k => wmMap[k] === tagName) || null,
            ruleId: issue.ruleId,
            description: issue.description
        });
    }
});

// Output new HTML file
const fixedPath = path.join(path.dirname(htmlPath), path.basename(htmlPath, '.html') + '_fixed.html');
fs.writeFileSync(fixedPath, $.html(), 'utf8');

// Print not found elements
console.log('Elements not found in HTML:', JSON.stringify(notFound, null, 2));
console.log('Fixed HTML saved to:', fixedPath);
