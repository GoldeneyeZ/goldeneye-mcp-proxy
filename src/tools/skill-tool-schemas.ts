import type { ToolSchema } from "./gateway-tool-schemas.js";

export const SKILL_TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: "skills.search",
    description: "Search global deferred skills. Returns compact metadata only, never full SKILL.md content.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results to return (default 10, max 50)" },
      },
    },
  },
  {
    name: "skills.pull",
    description: "Return one full SKILL.md by id, plus metadata and a bounded resource map.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Skill ID from skills.search" },
      },
      required: ["id"],
    },
  },
  {
    name: "skills.read_resource",
    description: "Read one support file for a pulled skill by relative path.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Skill ID from skills.search" },
        path: { type: "string", description: "Relative resource path from skills.pull resources" },
      },
      required: ["id", "path"],
    },
  },
  {
    name: "skills.status",
    description: "Report indexed skill roots, skill counts, invalid skills, and Codex skill migration status.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];
