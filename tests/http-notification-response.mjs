const url = process.env.MCP_URL || "http://127.0.0.1:8767/mcp";

const response = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    method: "notifications/initialized",
  }),
});

const body = await response.text();

if (response.status !== 202) {
  throw new Error(`Expected notification response status 202, got ${response.status} with body: ${body}`);
}

if (body.length !== 0) {
  throw new Error(`Expected notification response body to be empty, got: ${body}`);
}

console.log("notification response is 202 with empty body");
