import { load } from "cheerio";

const wmMap = {
    'wm-button': 'button',
    'wm-label': 'label',
    'wm-input': 'input',
    'wm-textarea': 'textarea',
    'wm-select': 'select',
    'wm-link': 'a',
    'wm-icon': 'img',
    'wm-container': 'div',
    'wm-anchor': 'a'
};

function extractNameAttr(source) {
    const match = source.match(/name\s*=\s*["']([^"']+)["']/i);
    return match ? match[1] : null;
}

function extractTagName(source) {
    const match = source.match(/^<\s*([a-zA-Z0-9\-_]+)/);
    return match ? match[1].toLowerCase() : null;
}

export function runAccessibilityCheck(htmlContent, axeJsonContent, fileName = "input.html") {
    const $ = load(htmlContent, { xmlMode: false, decodeEntities: false });
    const axeReport = JSON.parse(axeJsonContent);

    let changesRequired = [];
    let notFound = [];

    axeReport.allIssues.forEach(issue => {
        const nameAttr = extractNameAttr(issue.source);
        const tagName = extractTagName(issue.source);

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

            // 🔄 Replaced if/else with switch
            switch (issue.ruleId) {
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

                // case 'meta-viewport':
                //     $('meta[name="viewport"]').attr('content', 'width=device-width, initial-scale=1.0');
                //     break;

                case 'color-contrast':
                    {
                        const currentStyle = updatedElement.attr('style') || '';
                        if (!/color:/i.test(currentStyle)) {
                            updatedElement.attr('style', currentStyle + ';color:#000000;');
                        }
                        if (!/background-color:/i.test(currentStyle)) {
                            updatedElement.attr('style', updatedElement.attr('style') + ';background-color:#FFFFFF;');
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

            // Replace in DOM
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

    // Return final updated HTML as a single string without head and body tags.
    const updatedContent = $("body").length ? $("body").html() : $.root().html();


    return {
        fileScanned: fileName,
        updatedContent
        // changesRequired,
        // notFound
    };
}
