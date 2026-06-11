export function extractArray(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;

    for (const key of ["content", "items", "data", "results", "entries", "tools"]) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }

    if (Array.isArray(obj.content)) {
      for (const item of obj.content as Array<Record<string, unknown>>) {
        if (item.type === "text" && typeof item.text === "string") {
          const parsedArray = extractArrayFromJsonText(item.text);
          if (parsedArray) return parsedArray;
        }
      }
    }
  }

  return null;
}

function extractArrayFromJsonText(text: string): unknown[] | null {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;

    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      for (const key of ["content", "items", "data", "results"]) {
        if (Array.isArray(obj[key])) return obj[key] as unknown[];
      }
    }
  } catch {
    return null;
  }

  return null;
}
