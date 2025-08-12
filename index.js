import fs from "fs";
import path from "path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { runAccessibilityCheck } from "./fixer.js";

// Hardcoded file paths
const HARDCODED_HTML = "/Users/avinashg/Desktop/WM/Projects/FinanceAI/src/main/webapp/pages/Dashboard/Dashboard.html";
const HARDCODED_JSON = "/Users/avinashg/Desktop/WM/Projects/report1.json";

const toolDefinition = {
    name: "check_accessibility",
    description: "Check the hardcoded Dashboard.html against the hardcoded Axe report",
    inputSchema: {
        type: "object",
        properties: {},
        required: []
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
            if (!fs.existsSync(HARDCODED_HTML)) {
                return { content: [{ type: "text", text: `Error: HTML file not found at ${HARDCODED_HTML}` }] };
            }
            if (!fs.existsSync(HARDCODED_JSON)) {
                return { content: [{ type: "text", text: `Error: JSON file not found at ${HARDCODED_JSON}` }] };
            }

            const htmlContent = fs.readFileSync(path.resolve(HARDCODED_HTML), "utf8");
            const axeJsonContent = fs.readFileSync(path.resolve(HARDCODED_JSON), "utf8");

            const result = runAccessibilityCheck(htmlContent, axeJsonContent, path.basename(HARDCODED_HTML));

            // ✅ Return as MCP-compliant text
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };

        } catch (err) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }] };
        }
    }

    return { content: [{ type: "text", text: "Unknown tool" }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);