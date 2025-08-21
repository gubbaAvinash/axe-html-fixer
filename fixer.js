import { load } from "cheerio";

const wmMap = {
    'wm-button': 'button',
    'wm-label': 'p',
    'wm-text': 'input',
    'wm-textarea': 'textarea',
    'wm-select': 'select',
    'wm-link': 'a',
    'wm-icon': 'img',
    'wm-container': 'div',
    'wm-anchor': 'a',
    'wm-number': 'input',
    'wm-page': 'div',
    'wm-content': 'div',
    'wm-page-content': 'div',
    'wm-composite': 'div'
};

function extractNameAttr(source) {
    const match = source.match(/name\s*=\s*["']([^"']+)["']/i);
    return match ? match[1] : null;
}

function extractTagName(source) {
    const match = source.match(/^<\s*([a-zA-Z0-9\-_]+)/);
    return match ? match[1].toLowerCase() : null;
}

// --- Helpers ---
function hexToRgb(hexColor) {
    let hex = hexColor.replace("#", "");
    if (hex.length === 3) {
        hex = hex.split("").map(c => c + c).join("");
    }
    const num = parseInt(hex, 16);
    return [
        (num >> 16) & 255,
        (num >> 8) & 255,
        num & 255
    ];
}

function luminance(r, g, b) {
    const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928
            ? v / 12.92
            : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function contrastRatio(fg, bg) {
    const [r1, g1, b1] = hexToRgb(fg);
    const [r2, g2, b2] = hexToRgb(bg);
    const L1 = luminance(r1, g1, b1);
    const L2 = luminance(r2, g2, b2);
    const brightest = Math.max(L1, L2);
    const darkest = Math.min(L1, L2);
    return (brightest + 0.05) / (darkest + 0.05);
}

function rgbToHex(r, g, b) {
    return (
        "#" +
        [r, g, b]
            .map(x => {
                const h = x.toString(16);
                return h.length === 1 ? "0" + h : h;
            })
            .join("")
    );
}

// --- Adjust until ratio ≥ target ---
function adjustColorToMeetContrast(fg, bg, target = 4.5) {
    let [r, g, b] = hexToRgb(fg);
    let step = 5;
    let tries = 0;

    // Try brightening first
    while (contrastRatio(rgbToHex(r, g, b), bg) < target && tries < 100) {
        r = Math.min(255, r + step);
        g = Math.min(255, g + step);
        b = Math.min(255, b + step);
        tries++;
    }

    // If still not good, try darkening instead
    if (contrastRatio(rgbToHex(r, g, b), bg) < target) {
        [r, g, b] = hexToRgb(fg);
        tries = 0;
        while (contrastRatio(rgbToHex(r, g, b), bg) < target && tries < 100) {
            r = Math.max(0, r - step);
            g = Math.max(0, g - step);
            b = Math.max(0, b - step);
            tries++;
        }
    }

    return rgbToHex(r, g, b);
}


export function runAccessibilityCheck(htmlContent, axeJsonContent, fileName = "input.html") {
    const $ = load(htmlContent, { xmlMode: false, decodeEntities: false });
    const axeReport = JSON.parse(axeJsonContent);

    let changesRequired = [];
    let notFound = [];

    // ✅ Final JSON collector for css
    let finalResult = {
        jsonrpc: "2.0",
        id: Date.now(),
        result: {
            fixes: {}
        }
    };

    axeReport.allIssues.forEach(issue => {
        const nameAttr = extractNameAttr(issue.source);
        const tagName = extractTagName(issue.source);

        // --- Special handling for meta-viewport ---
        if (issue.ruleId === "meta-viewport") {
            const viewportMeta = $('meta[name="viewport"]');
            if (viewportMeta.length) {
                const oldSnippet = $.html(viewportMeta);
                let updated = viewportMeta.clone();

                let content = updated.attr("content") || "";
                content = content.replace(/user-scalable\s*=\s*no/i, "user-scalable=yes");
                updated.attr("content", content);

                viewportMeta.replaceWith(updated);
                const newSnippet = $.html(updated);

                changesRequired.push({
                    fileName,
                    ruleId: issue.ruleId,
                    tag: "meta",
                    description: issue.description,
                    oldSnippet,
                    newSnippet,
                    originalSourceFromAxe: issue.source
                });
                return;
            }
        }

        if (!nameAttr || !tagName) return;

        let selectorsToTry = [];
        selectorsToTry.push(`${tagName}[name="${nameAttr}"]`);
        for (const [wmTag, stdTag] of Object.entries(wmMap)) {
            if (stdTag === tagName) {
                selectorsToTry.push(`${wmTag}[name="${nameAttr}"]`);
            }
        }

        let foundElement = null;
        for (const sel of selectorsToTry) {
            if ($(sel).length) {
                foundElement = $(sel).first();
                break;
            }
        }

        if (foundElement) {
            const oldSnippet = $.html(foundElement);
            let updatedElement = foundElement.clone();

            switch (issue.ruleId) {
                case 'label':
                    {
                        // Check if element is wm-number (special handling)
                        if (updatedElement.is('wm-number') || updatedElement.prop("tagName")?.toLowerCase() === "wm-number") {
                            if (!updatedElement.attr('arialabel') && !updatedElement.attr('aria-label')) {
                                const fallback = nameAttr || "Number field";
                                updatedElement.attr('arialabel', fallback);
                            }
                        } else {
                            // Generic input/text/other cases
                            let aria = updatedElement.attr('arialabel') || updatedElement.attr('aria-label');
                            if (!aria) {
                                const fallback =
                                    nameAttr ||
                                    updatedElement.attr("placeholder")?.trim() ||
                                    "Input field";
                                updatedElement.attr('arialabel', fallback);
                            }

                            // If placeholder exists but empty, set aria-label
                            if (updatedElement.attr("placeholder") !== undefined &&
                                updatedElement.attr("placeholder").trim() === "") {
                                updatedElement.attr('arialabel', nameAttr || "Input field");
                            }
                        }
                    }
                    break;

                case 'color-contrast':
                    const match = issue.summary.match(
                        /contrast of ([\d.]+).*foreground color: (#[0-9a-fA-F]{6}).*background color: (#[0-9a-fA-F]{6})/
                    );

                    if (match) {
                        const ratio = parseFloat(match[1]);
                        const color = match[2];
                        const background = match[3];

                        const fixedFg = adjustColorToMeetContrast(color, background, 4.5);
                        const newRatio = contrastRatio(fixedFg, background).toFixed(2);

                        let classes = "";
                        if (issue && issue.source) {
                            const classMatch = issue.source.match(/class="([^"]+)"/);
                            if (classMatch) {
                                classes = "." + classMatch[1].trim().split(/\s+/).join(".");
                            }
                        }

                        // add to finalResult
                        finalResult.result.fixes[classes] = {
                            // original: {
                            //     ratio,
                            //     color,
                            //     background,
                            //     classes
                            // },
                            // fixed: {
                            color: fixedFg,
                            // background,
                            // newRatio
                            // }
                        };
                    }
                    break;

                // --- Other rules remain same ---
                case 'button-name':
                    if (!updatedElement.attr('arialabel')) {
                        updatedElement.attr('arialabel', nameAttr);
                    }
                    break;

                case 'link-in-text-block':
                    {
                        const currentStyle = updatedElement.attr('style') || '';
                        if (!/text-decoration/i.test(currentStyle)) {
                            updatedElement.attr('style', currentStyle + ';text-decoration:underline;');
                        }
                    }
                    break;

                case 'link-name':
                    if (!updatedElement.attr('arialabel')) {
                        updatedElement.attr('arialabel', nameAttr || 'Link');
                    }
                    break;

                case 'role-img-alt':
                    if (updatedElement.is('img') && !updatedElement.attr('alt')) {
                        updatedElement.attr('alt', nameAttr || 'Image');
                    }
                    break;

                case 'select-name':
                    if (!updatedElement.attr('arialabel') && !updatedElement.attr('title')) {
                        updatedElement.attr('arialabel', nameAttr || 'Select an option');
                    }
                    break;

                default:
                    break;
            }

            foundElement.replaceWith(updatedElement);
            const newSnippet = $.html(updatedElement);

            changesRequired.push({
                fileName,
                ruleId: issue.ruleId,
                name: nameAttr,
                tag: tagName,
                description: issue.description,
                oldSnippet,
                newSnippet,
                originalSourceFromAxe: issue.source
            });
        } else {
            notFound.push({
                fileName,
                name: nameAttr,
                tag: tagName,
                mappedTag: Object.keys(wmMap).find(k => wmMap[k] === tagName) || null,
                ruleId: issue.ruleId,
                description: issue.description
            });
        }
    });

    const updatedContent = $("body").length ? $("body").html() : $.root().html();

    // ✅ Pretty print full JSON for CSS
    console.error(JSON.stringify(finalResult, null, 2));

    return {
        fileScanned: fileName,
        updatedContent,
        changesRequired,
        notFound,
        finalResult
    };
}

