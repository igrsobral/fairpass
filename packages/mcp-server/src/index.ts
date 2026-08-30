import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { verifyBarcode } from "./barcode.js";

const server = new McpServer({
  name: "fairpass-ticket-verification",
  version: "0.0.1",
});

server.tool(
  "verify_barcode",
  "Validate a ticket barcode format and checksum. Never persists raw input; " +
    "returns only normalized fields and validity state.",
  {
    barcode: z.string().min(1).describe("Raw barcode value (numeric or encoded)"),
  },
  async ({ barcode }) => {
    const verification = verifyBarcode(barcode);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(verification),
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);