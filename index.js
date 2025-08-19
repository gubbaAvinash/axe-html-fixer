import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { runAccessibilityCheck } from "./fixer.js";

const toolDefinition = {
    name: "check_accessibility",
    description: "Check an uploaded HTML content against an Axe report JSON content and return updated HTML",
    inputSchema: {
        type: "object",
        properties: {
            htmlContent: { type: "string", description: "The full HTML file contents" },
            axeJsonContent: { type: "string", description: "The full Axe JSON file contents" },
            fileName: { type: "string", description: "Optional: file name of the HTML file", default: "input.html" }
        },
        required: ["htmlContent", "axeJsonContent"]
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
            const { htmlContent, axeJsonContent, fileName } = request.params.arguments;

            const result = runAccessibilityCheck(htmlContent, axeJsonContent, fileName);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            fileName,
                            updatedContent: result.updatedContent,
                            issues: result.changesRequired,
                            notFound: result.notFound
                        }, null, 2)
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
