import type { ParsedSkillMarkdown, SkillFrontmatter } from "./types.js";

export function parseSkillMarkdown(markdown: string): ParsedSkillMarkdown {
  if (!markdown.startsWith("---\n")) {
    throw new Error("Missing SKILL.md frontmatter");
  }

  const end = markdown.indexOf("\n---", 4);
  if (end === -1) {
    throw new Error("Unclosed SKILL.md frontmatter");
  }

  const yaml = markdown.slice(4, end);
  const body = markdown.slice(end + 4).replace(/^\r?\n/, "");
  const frontmatter = parseSimpleYaml(yaml);

  if (!frontmatter.name) throw new Error("Missing required skill frontmatter field: name");
  if (!frontmatter.description) throw new Error("Missing required skill frontmatter field: description");

  return { frontmatter, body };
}

export function extractMarkdownHeadings(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.match(/^#{1,2}\s+(.+)$/)?.[1]?.trim())
    .filter((heading): heading is string => Boolean(heading));
}

function parseSimpleYaml(yaml: string): SkillFrontmatter {
  const result: Partial<SkillFrontmatter> = {};
  const lines = yaml.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2].trim();

    if (value === ">") {
      const folded: string[] = [];
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) {
        folded.push(lines[++i].trim());
      }
      value = folded.join(" ").replace(/\s+/g, " ").trim();
    } else {
      value = value.replace(/^["']|["']$/g, "");
    }

    if (key === "name" || key === "description") {
      result[key] = value;
    }
  }

  return result as SkillFrontmatter;
}
