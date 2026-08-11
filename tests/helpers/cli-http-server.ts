import http from "node:http";

export async function createJsonServer(handler: (body: unknown) => unknown | Promise<unknown>) {
  let lastBody: unknown;
  const server = http.createServer((req, res) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", chunk => { raw += chunk; });
    req.on("end", async () => {
      try {
        lastBody = JSON.parse(raw);
        const response = await handler(lastBody);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(response));
      } catch (error) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: String(error) }));
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server has no TCP address");

  return {
    url: `http://127.0.0.1:${address.port}/mcp`,
    get lastBody() { return lastBody; },
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    }),
  };
}
