import fs from "fs";
import path from "path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { runAccessibilityCheck } from "./fixer.js";

const toolDefinition = {
    name: "check_accessibility",
    description: "Check provided HTML content against an Axe JSON report (from file path) and return updated HTML",
    inputSchema: {
        type: "object",
        properties: {
            htmlContent: { type: "string", description: "Full HTML content to check" },
            jsonPath: { type: "string", description: "Path to the Axe JSON file" }
        },
        required: ["htmlContent", "jsonPath"]
    }
};

const server = new Server(
    { name: "axe-html-fixer-mcp", version: "1.0.0" },
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
            const { htmlContent, jsonPath } = request.params.arguments;

            if (!fs.existsSync(jsonPath)) {
                return { content: [{ type: "text", text: `Error: JSON file not found at ${jsonPath}` }] };
            }

            // Read JSON file from given path
            const axeJsonContent = fs.readFileSync(path.resolve(jsonPath), "utf8");

            // Run accessibility check
            const result = runAccessibilityCheck(htmlContent, axeJsonContent, path.basename(jsonPath));

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            jsonFile: jsonPath,
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
