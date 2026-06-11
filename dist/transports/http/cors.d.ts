import type http from "node:http";
export declare function applyCorsHeaders(res: http.ServerResponse): void;
export declare function handleCorsPreflight(req: http.IncomingMessage, res: http.ServerResponse): boolean;
