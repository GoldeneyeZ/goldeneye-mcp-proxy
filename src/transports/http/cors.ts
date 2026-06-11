import type http from "node:http";

export function applyCorsHeaders(res: http.ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function handleCorsPreflight(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  if (req.method !== "OPTIONS") return false;
  applyCorsHeaders(res);
  res.writeHead(204);
  res.end();
  return true;
}
