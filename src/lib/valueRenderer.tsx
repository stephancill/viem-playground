import React from "react";

export type SerializedTagged = {
  __type: "bigint" | "function" | "symbol" | "Error" | "Date";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export interface RenderOptions {
  shortenHex?: boolean;
  hexHead?: number;
  hexTail?: number;
  maxString?: number;
}

const DEFAULT_OPTIONS: Required<
  Pick<RenderOptions, "shortenHex" | "hexHead" | "hexTail" | "maxString">
> = {
  shortenHex: true,
  hexHead: 6,
  hexTail: 4,
  maxString: 10_000,
};

export function isTagged(value: unknown): value is SerializedTagged {
  return (
    !!value &&
    typeof value === "object" &&
    Object.prototype.hasOwnProperty.call(value as SerializedTagged, "__type")
  );
}

export function isHexString(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]*$/.test(value);
}

export function shortenHex(hex: string, head = 6, tail = 4): string {
  if (!isHexString(hex)) return String(hex);
  if (hex.length <= 2 + head + tail) return hex;
  return `${hex.slice(0, 2 + head)}…${hex.slice(-tail)}`;
}

export function coerceDisplayValue(value: unknown): unknown {
  if (isTagged(value)) {
    switch (value.__type) {
      case "bigint":
        return `${value.value}n`;
      case "Date":
        return value.value || value.toString || value;
      case "Error":
        return `${value.name || "Error"}: ${value.message || ""}`.trim();
      case "function":
        return `ƒ ${value.name || "anonymous"}()`;
      case "symbol":
        return String(value.value ?? value);
    }
  }
  return value;
}

export function describeType(value: unknown): string {
  if (isTagged(value)) return value.__type;
  if (isHexString(value)) return `hex(${(value.length - 2) / 2} bytes)`;
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

export function formatBrief(value: unknown, opts?: RenderOptions): string {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  const v = coerceDisplayValue(value);
  try {
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    if (typeof v === "string") {
      if (options.shortenHex && isHexString(v))
        return shortenHex(v, options.hexHead, options.hexTail);
      return v.length > 120 ? v.slice(0, 117) + "…" : v;
    }
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (Array.isArray(v)) return `Array(${v.length})`;
    if (typeof v === "object") {
      const json = JSON.stringify(v);
      return json.length > 120 ? json.slice(0, 117) + "…" : json;
    }
    return String(v);
  } catch {
    return "[value]";
  }
}

export function formatFull(value: unknown, opts?: RenderOptions): string {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  const v = coerceDisplayValue(value);
  try {
    if (typeof v === "string") {
      if (options.shortenHex && isHexString(v))
        return shortenHex(v, options.hexHead, options.hexTail);
      return v.length > options.maxString
        ? v.slice(0, options.maxString) + "…"
        : v;
    }
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    return JSON.stringify(v, null, 2);
  } catch {
    try {
      return String(v);
    } catch {
      return "[Unserializable]";
    }
  }
}

export function escapeMarkdownCode(text: string): string {
  // Prevent accidental closing of code fences inside content
  return String(text).replace(/```/g, "``\u200B`");
}

export function formatHoverMarkdown(
  value: unknown,
  opts?: RenderOptions
): string {
  const body = formatFull(value, opts);
  return "```json\n" + escapeMarkdownCode(body) + "\n```";
}

export const ValueRenderer: React.FC<{
  value: unknown;
  variant?: "brief" | "full";
  options?: RenderOptions;
}> = ({ value, variant = "full", options }) => {
  const v = coerceDisplayValue(value);
  const text =
    variant === "brief" ? formatBrief(v, options) : formatFull(v, options);
  // Keep it simple for now; can expand to rich UI later (copy, decode, etc.)
  return (
    <pre className="whitespace-pre-wrap break-words text-green-300">{text}</pre>
  );
};

export default ValueRenderer;
