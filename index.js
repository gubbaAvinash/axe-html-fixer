import fs from "fs";
import path from "path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { runAccessibilityCheck } from "./fixer.js";

const toolDefinition = {
    name: "check_accessibility",
    description: "Check an uploaded HTML file against an Axe report JSON and return full updated HTML",
    inputSchema: {
        type: "object",
        properties: {
            htmlPath: { type: "string", description: "Path to the HTML file" },
            jsonPath: { type: "string", description: "Path to the Axe JSON file" }
        },
        required: ["htmlPath", "jsonPath"]
    }
};

const server = new Server(
    { name: "axe-html-fixer-mcp", version: "1.1.0" },
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
            const { htmlPath, jsonPath } = request.params.arguments;

            if (!fs.existsSync(htmlPath)) {
                return { content: [{ type: "text", text: `Error: HTML file not found at ${htmlPath}` }] };
            }
            if (!fs.existsSync(jsonPath)) {
                return { content: [{ type: "text", text: `Error: JSON file not found at ${jsonPath}` }] };
            }

            const htmlContent = fs.readFileSync(path.resolve(htmlPath), "utf8");
            const axeJsonContent = fs.readFileSync(path.resolve(jsonPath), "utf8");

            const result = runAccessibilityCheck(htmlContent, axeJsonContent, path.basename(htmlPath));

            return {
                content: [
                    {
                        type: "text", text: JSON.stringify({
                            fileName: htmlPath,
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
