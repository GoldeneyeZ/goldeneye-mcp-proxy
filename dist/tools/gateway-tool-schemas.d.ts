export interface ToolSchema {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}
export declare const GATEWAY_TOOL_SCHEMAS: ToolSchema[];
