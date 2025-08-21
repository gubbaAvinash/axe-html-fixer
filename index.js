import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { runAccessibilityCheck } from "./fixer.js";

const toolDefinition = {
    name: "check_accessibility",
    description: "Check PageHTML (mandatory) and optionally HeaderHTML, LeftNavHTML, FooterHTML against Axe JSON report. Returns updated HTML with fixes.",
    inputSchema: {
        type: "object",
        properties: {
            pageHTML: { type: "string", description: "Actual Page HTML content (mandatory)" },
            headerHTML: { type: "string", description: "Header HTML content (optional)" },
            leftNavHTML: { type: "string", description: "Left navigation HTML content (optional)" },
            footerHTML: { type: "string", description: "Footer HTML content (optional)" },
            axeJson: { type: "string", description: "Accessibility JSON report from axe" }
        },
        required: ["pageHTML", "axeJson"]
    }
};

const server = new Server(
    { name: "axe-html-fixer-mcp", version: "2.0.0" },
    { capabilities: { tools: {} } }
);

// Handle "List Tools"
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: [toolDefinition] };
});

// Handle "Call Tool"
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "check_accessibility") {
        try {
            const { pageHTML, headerHTML, leftNavHTML, footerHTML, axeJson } = request.params.arguments;

            if (!pageHTML) {
                return { content: [{ type: "text", text: "Error: pageHTML is required." }] };
            }
            if (!axeJson) {
                return { content: [{ type: "text", text: "Error: axeJson is required." }] };
            }

            let results = {};

            const filesToCheck = [
                { label: "PageHTML", content: pageHTML, mandatory: true },
                { label: "HeaderHTML", content: headerHTML, mandatory: false },
                { label: "LeftNavHTML", content: leftNavHTML, mandatory: false },
                { label: "FooterHTML", content: footerHTML, mandatory: false }
            ];

            const aggregateCssIssues = {};

            for (const { label, content, mandatory } of filesToCheck) {
                if (content) {
                    const result = runAccessibilityCheck(content, axeJson, label + ".html");
                    results[label] = {
                        updatedContent: result.updatedContent,
                        issues: result.changesRequired,
                        notFound: result.notFound
                    };

                    // Collect css fixes into aggregate object (keyed by label)
                    if (result && result.finalResult && result.finalResult.result && result.finalResult.result.fixes) {
                        aggregateCssIssues[label] = result.finalResult.result.fixes;
                    }
                } else if (mandatory) {
                    return { content: [{ type: "text", text: `Error: Mandatory HTML (${label}) not provided.` }] };
                } else {
                    results[label] = { skipped: true, reason: "Not provided" };
                }
            }

            // Attach the combined cssIssues object at the end of results
            results.cssIssues = aggregateCssIssues;

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(results, null, 2)
                    }
                ]
            };

        } catch (err) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }] };
        }
    }

    return { content: [{ type: "text", text: "Unknown tool" }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
