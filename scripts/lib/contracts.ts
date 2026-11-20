// Compares the site's response schemas with core-api's OpenAPI spec. The site may read fewer
// fields than core-api sends; each field it reads must exist, have a compatible type, and be
// nullable or optional wherever core-api says it can be.

type Json = Record<string, unknown>;

interface Shape {
  type: string;
  nullable: boolean;
  enum?: unknown[];
  items?: Shape;
  properties?: Record<string, Shape>;
  required: string[];
}

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A JSON Schema node (ours or the spec's) reduced to what the comparison needs. */
function shapeOf(node: unknown, resolve: (ref: string) => unknown): Shape {
  if (!isObject(node)) return { type: 'unknown', nullable: false, required: [] };
  if (typeof node.$ref === 'string') return shapeOf(resolve(node.$ref), resolve);
  const options = Array.isArray(node.anyOf) ? node.anyOf : Array.isArray(node.oneOf) ? node.oneOf : undefined;
  if (options) {
    const others = options.filter((option) => !(isObject(option) && option.type === 'null'));
    const nullable = others.length < options.length;
    if (others.length === 1) return { ...shapeOf(others[0], resolve), nullable };
    return { type: 'union', nullable, required: [] };
  }
  // A type list, e.g. `"type": ["string", "null"]` (how Zod writes a nullable string).
  if (Array.isArray(node.type)) {
    const others = node.type.filter((type) => type !== 'null');
    const nullable = others.length < node.type.length;
    if (others.length === 1) return { ...shapeOf({ ...node, type: others[0] }, resolve), nullable };
    return { type: 'union', nullable, required: [] };
  }
  const properties = isObject(node.properties)
    ? Object.fromEntries(Object.entries(node.properties).map(([key, value]) => [key, shapeOf(value, resolve)]))
    : undefined;
  return {
    type: typeof node.type === 'string' ? node.type : 'unknown',
    nullable: false,
    enum: Array.isArray(node.enum) ? node.enum : undefined,
    items: node.items === undefined ? undefined : shapeOf(node.items, resolve),
    properties,
    required: Array.isArray(node.required) ? node.required.filter((key) => typeof key === 'string') : [],
  };
}

function compatibleType(ours: string, theirs: string): boolean {
  return ours === theirs || (ours === 'number' && theirs === 'integer');
}

function compare(ours: Shape, theirs: Shape, path: string, problems: string[]): void {
  if (theirs.nullable && !ours.nullable) problems.push(`${path}: core-api can send null`);
  if (!compatibleType(ours.type, theirs.type)) {
    problems.push(`${path}: the site reads ${ours.type}, core-api sends ${theirs.type}`);
    return;
  }
  if (ours.enum && !(theirs.enum ?? [undefined]).every((value) => ours.enum?.includes(value))) {
    problems.push(`${path}: core-api can send a value the site doesn't accept`);
  }
  if (ours.items && theirs.items) compare(ours.items, theirs.items, `${path}[]`, problems);
  for (const [key, shape] of Object.entries(ours.properties ?? {})) {
    const field = `${path}.${key}`;
    const theirsField = theirs.properties?.[key];
    if (!theirsField) {
      problems.push(`${field}: not in core-api's contract`);
      continue;
    }
    if (ours.required.includes(key) && !theirs.required.includes(key)) {
      problems.push(`${field}: optional in core-api`);
    }
    compare(shape, theirsField, field, problems);
  }
}

/** The 200 response schema name of a GET route in the spec, or undefined. */
function responseName(spec: Json, path: string): string | undefined {
  const paths = isObject(spec.paths) ? spec.paths : {};
  const route = isObject(paths[path]) ? paths[path] : undefined;
  const get = route && isObject(route.get) ? route.get : undefined;
  const ok = get && isObject(get.responses) ? get.responses['200'] : undefined;
  const content = isObject(ok) && isObject(ok.content) ? ok.content['application/json'] : undefined;
  const ref = isObject(content) && isObject(content.schema) ? content.schema.$ref : undefined;
  return typeof ref === 'string' ? ref.split('/').pop() : undefined;
}

interface ContractRoute {
  /** The route as written in the spec, e.g. `/api/v2/public/ladders/{edition}`. */
  path: string;
  /** Our schema, as JSON Schema. */
  schema: unknown;
}

/** Every way the site's reads would break against this spec. Empty when they match. */
export function contractProblems(spec: Json, routes: ContractRoute[]): string[] {
  const resolve = (ref: string): unknown => {
    const schemas = isObject(spec.components) && isObject(spec.components.schemas) ? spec.components.schemas : {};
    return schemas[ref.split('/').pop() ?? ''];
  };
  const problems: string[] = [];
  for (const route of routes) {
    const name = responseName(spec, route.path);
    if (!name) {
      problems.push(`${route.path}: no GET route with a JSON answer in core-api's contract`);
      continue;
    }
    compare(shapeOf(route.schema, resolve), shapeOf(resolve(name), resolve), name, problems);
  }
  return problems;
}
