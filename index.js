import fs from "fs";
import path from "path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { runAccessibilityCheck } from "./fixer.js";

const toolDefinition = {
    name: "check_accessibility",
    description: "Check HTML against Axe accessibility JSON and return suggested changes (file path input)",
    inputSchema: {
        type: "object",
        properties: {
            htmlPath: { type: "string", description: "Path to the HTML file" },
            jsonPath: { type: "string", description: "Path to the Axe JSON file" },
            fileName: { type: "string", description: "File name for reporting", default: "input.html" }
        },
        required: ["htmlPath", "jsonPath"]
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
            const { htmlPath, jsonPath, fileName } = request.params.arguments;
            //  const {  fileName } = request.params.arguments;

            const resolvedHtmlPath = path.resolve(htmlPath);
            const resolvedJsonPath = path.resolve(jsonPath);

            // Check if HTML file exists
            if (!fs.existsSync(resolvedHtmlPath)) {
                return { content: [{ type: "text", text: `Error: HTML file not found at ${resolvedHtmlPath}` }] };
            }

            // Check if JSON file exists
            if (!fs.existsSync(resolvedJsonPath)) {
                return { content: [{ type: "text", text: `Error: JSON file not found at ${resolvedJsonPath}` }] };
            }

            const htmlContent = fs.readFileSync(resolvedHtmlPath, "utf8");
            const axeJsonContent = fs.readFileSync(resolvedJsonPath, "utf8");
            // const htmlContent = fs.readFileSync("/Users/avinashg/Desktop/WM/Projects/FinanceAI/src/main/webapp/pages/Dashboard/Dashboard.html", "utf8");
            // const axeJsonContent = fs.readFileSync("/Users/avinashg/Desktop/WM/Projects/report1.json", "utf8");

            const result = runAccessibilityCheck(htmlContent, axeJsonContent, fileName || path.basename(resolvedHtmlPath));
            // const result = runAccessibilityCheck( "input123.json");
            return { content: [{ type: "json", value: result }] };

        } catch (err) {
            return { content: [{ type: "text", text: `Error: ${err.message}` }] };
        }
    }

    return { content: [{ type: "text", text: "Unknown tool" }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);