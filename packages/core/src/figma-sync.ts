import { promises as fs } from 'fs';
import path from 'path';
import type { DesignTokens } from '@qa/checkers';

/**
 * Figma sync: snapshots design tokens (and optionally frame images as visual baselines)
 * to local files so test runs never depend on the live Figma API.
 */

const FIGMA_API = 'https://api.figma.com/v1';

interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}
interface FigmaAlias {
  type: 'VARIABLE_ALIAS';
  id: string;
}
type FigmaValue = FigmaColor | FigmaAlias | number | string | boolean;

export interface FigmaVariablesResponse {
  meta: {
    variables: Record<
      string,
      {
        id: string;
        name: string;
        resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
        variableCollectionId: string;
        valuesByMode: Record<string, FigmaValue>;
      }
    >;
    variableCollections: Record<string, { id: string; defaultModeId: string }>;
  };
}

function isAlias(v: FigmaValue): v is FigmaAlias {
  return typeof v === 'object' && v !== null && (v as FigmaAlias).type === 'VARIABLE_ALIAS';
}

function toCssColor({ r, g, b, a }: FigmaColor): string {
  const [R, G, B] = [r, g, b].map((c) => Math.round(c * 255));
  if (a < 1) return `rgba(${R}, ${G}, ${B}, ${Number(a.toFixed(3))})`;
  return '#' + [R, G, B].map((c) => c.toString(16).padStart(2, '0')).join('');
}

/** "Color/Brand/Primary" -> "primary" */
function tokenKey(name: string): string {
  return name.split('/').pop()!.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * Maps Figma local variables (default mode, aliases resolved) to the DesignTokens shape.
 * COLOR -> colors; FLOAT named like radius/corner -> borderRadius; FLOAT named like font size -> fontSize.
 */
export function figmaVariablesToTokens(response: FigmaVariablesResponse): DesignTokens {
  const { variables, variableCollections } = response.meta;
  const tokens: Required<DesignTokens> = { colors: {}, borderRadius: {}, fontSize: {} };

  const resolve = (variableId: string, depth = 0): FigmaValue | undefined => {
    const variable = variables[variableId];
    if (!variable || depth > 10) return undefined;
    const modeId = variableCollections[variable.variableCollectionId]?.defaultModeId;
    const value = modeId !== undefined ? variable.valuesByMode[modeId] : Object.values(variable.valuesByMode)[0];
    return value !== undefined && isAlias(value) ? resolve(value.id, depth + 1) : value;
  };

  for (const variable of Object.values(variables)) {
    const value = resolve(variable.id);
    if (value === undefined) continue;
    const key = tokenKey(variable.name);

    if (variable.resolvedType === 'COLOR' && typeof value === 'object') {
      tokens.colors[key] = toCssColor(value as FigmaColor);
    } else if (variable.resolvedType === 'FLOAT' && typeof value === 'number') {
      if (/radius|corner|rounded/i.test(variable.name)) tokens.borderRadius[key] = `${value}px`;
      else if (/font.?size|text.?size/i.test(variable.name)) tokens.fontSize[key] = `${value}px`;
    }
  }
  return tokens;
}

export interface FigmaSyncOptions {
  fileKey: string;
  token: string;
  tokensOut: string;
  /** Frame node id -> baseline name, e.g. { "12:34": "TC-001-1440px" }. */
  frames?: Record<string, string>;
  baselineDir?: string;
  fetchImpl?: typeof fetch;
}

export interface FigmaSyncResult {
  tokensPath: string;
  tokenCounts: { colors: number; borderRadius: number; fontSize: number };
  baselines: string[];
}

export async function syncFigma(options: FigmaSyncOptions): Promise<FigmaSyncResult> {
  const doFetch = options.fetchImpl ?? fetch;
  const headers = { 'X-Figma-Token': options.token };

  const res = await doFetch(`${FIGMA_API}/files/${encodeURIComponent(options.fileKey)}/variables/local`, { headers });
  if (res.status === 403) {
    throw new Error(
      'Figma returned 403 for the Variables API. It needs a token with the file_variables:read scope and an Enterprise-plan file.'
    );
  }
  if (!res.ok) throw new Error(`Figma variables request failed: HTTP ${res.status}`);

  const tokens = figmaVariablesToTokens((await res.json()) as FigmaVariablesResponse);
  const tokensPath = path.resolve(options.tokensOut);
  await fs.mkdir(path.dirname(tokensPath), { recursive: true });
  await fs.writeFile(tokensPath, JSON.stringify(tokens, null, 2) + '\n', 'utf8');

  const baselines: string[] = [];
  const frameIds = Object.keys(options.frames ?? {});
  if (frameIds.length > 0) {
    const baselineDir = path.resolve(options.baselineDir ?? '.qa-baselines');
    const imgRes = await doFetch(
      `${FIGMA_API}/images/${encodeURIComponent(options.fileKey)}?ids=${encodeURIComponent(frameIds.join(','))}&format=png&scale=1`,
      { headers }
    );
    if (!imgRes.ok) throw new Error(`Figma image export failed: HTTP ${imgRes.status}`);
    const { images } = (await imgRes.json()) as { images: Record<string, string | null> };

    await fs.mkdir(baselineDir, { recursive: true });
    for (const id of frameIds) {
      const url = images[id];
      if (!url) throw new Error(`Figma could not render frame ${id}`);
      const png = await doFetch(url);
      if (!png.ok) throw new Error(`Downloading frame ${id} failed: HTTP ${png.status}`);
      const out = path.join(baselineDir, `${options.frames![id]}.png`);
      await fs.writeFile(out, Buffer.from(await png.arrayBuffer()));
      baselines.push(out);
    }
  }

  return {
    tokensPath,
    tokenCounts: {
      colors: Object.keys(tokens.colors ?? {}).length,
      borderRadius: Object.keys(tokens.borderRadius ?? {}).length,
      fontSize: Object.keys(tokens.fontSize ?? {}).length,
    },
    baselines,
  };
}
