export interface SkillSourceConfig {
  label: string;
  path: string;
  enabled: boolean;
}

export interface SkillGatewayConfig {
  sources?: Array<{ label: string; path: string; enabled?: boolean }>;
  maxResourceBytes?: number;
  maxResourceEntries?: number;
}

export interface ResolvedSkillConfig {
  sources: SkillSourceConfig[];
  maxResourceBytes: number;
  maxResourceEntries: number;
}

export interface SkillFrontmatter {
  name: string;
  description: string;
}

export interface ParsedSkillMarkdown {
  frontmatter: SkillFrontmatter;
  body: string;
}

export interface SkillRecord {
  id: string;
  name: string;
  description: string;
  source: string;
  rootPath: string;
  skillDir: string;
  skillPath: string;
  relativePath: string;
  hash: string;
  lastModified: string;
  headings: string[];
}

export interface SkillSearchResult {
  id: string;
  name: string;
  description: string;
  source: string;
  path: string;
  hash: string;
  lastModified: string;
  score: number;
}

export interface SkillResourceEntry {
  path: string;
  type: "file" | "directory";
  size?: number;
  reason?: string;
}

export interface SkillStatus {
  roots: Array<{ label: string; path: string; indexed: boolean; reason?: string }>;
  skillCount: number;
  invalidSkillCount: number;
  invalidSkills: Array<{ path: string; reason: string }>;
  migration: {
    codexSkillsPath: string;
    deferredPath: string;
    codexSkillsExists: boolean;
    deferredExists: boolean;
  };
}
