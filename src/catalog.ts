export type CatalogCollection = 'tracks' | 'packs';

export interface CatalogItem {
  id: string;
  collection: CatalogCollection;
  fields: Record<string, unknown>;
  rawFields: Record<string, unknown>;
  warnings: string[];
}

type FirestoreValue = Record<string, unknown>;

function decodeValue(value: FirestoreValue): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) {
    const integer = String(value.integerValue);
    const numeric = Number(integer);
    return Number.isSafeInteger(numeric) ? numeric : integer;
  }
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('referenceValue' in value) return value.referenceValue;
  if ('bytesValue' in value) return value.bytesValue;
  if ('geoPointValue' in value) return value.geoPointValue;
  if ('arrayValue' in value) {
    const values = (
      value.arrayValue as { values?: FirestoreValue[] } | undefined
    )?.values;
    return Array.isArray(values) ? values.map(decodeValue) : [];
  }
  if ('mapValue' in value) {
    const fields = (
      value.mapValue as { fields?: Record<string, FirestoreValue> } | undefined
    )?.fields;
    return fields ? decodeFields(fields) : {};
  }
  return value;
}

function decodeFields(
  fields: Record<string, FirestoreValue> = {},
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]),
  );
}

function stringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'string')
  );
}

function warningsFor(
  collection: CatalogCollection,
  fields: Record<string, unknown>,
): string[] {
  const warnings: string[] = [];
  if (typeof fields.name !== 'string' || !fields.name.trim())
    warnings.push('Name is missing or is not text.');
  if (!stringArray(fields.tags))
    warnings.push('Tags must be a list of text values.');

  if (collection === 'tracks') {
    const source = fields.source;
    if (
      source !== undefined &&
      (!source || typeof source !== 'object' || Array.isArray(source))
    ) {
      warnings.push('Attribution data must be an object.');
    }
    if (source && typeof source === 'object' && !Array.isArray(source)) {
      const author = (source as Record<string, unknown>).author;
      if (author !== undefined && typeof author !== 'string')
        warnings.push('Author must be text.');
    }
    const hasFileName = 'fileName' in fields;
    const hasSamples = 'samples' in fields;
    if (hasFileName && typeof fields.fileName !== 'string')
      warnings.push('Filename must be text.');
    if (hasSamples && !stringArray(fields.samples))
      warnings.push('Samples must be a list of text values.');
    if (!hasFileName && !hasSamples)
      warnings.push('Sound has no filename or sample list.');
    if (hasFileName && hasSamples)
      warnings.push('Sound has both a filename and a sample list.');
  } else {
    if (!Array.isArray(fields.tracks)) {
      warnings.push('Pack members must be a list.');
    } else {
      fields.tracks.forEach((member, index) => {
        if (
          !member ||
          typeof member !== 'object' ||
          Array.isArray(member) ||
          typeof (member as Record<string, unknown>).id !== 'string'
        ) {
          warnings.push(`Pack member ${index + 1} has no valid Sound ID.`);
        }
      });
    }
  }

  return warnings;
}

export function catalogItemFromDocument(
  document: unknown,
  collection: CatalogCollection,
): CatalogItem {
  const entry =
    document && typeof document === 'object' && !Array.isArray(document)
      ? (document as { name?: unknown; fields?: unknown })
      : {};
  const documentName = typeof entry.name === 'string' ? entry.name : '';
  const id = documentName.split('/').at(-1) || '(missing document ID)';
  const hasFields = Boolean(
    entry.fields &&
    typeof entry.fields === 'object' &&
    !Array.isArray(entry.fields),
  );
  const rawFields = hasFields
    ? (entry.fields as Record<string, FirestoreValue>)
    : {};
  const fields = decodeFields(rawFields);
  const warnings = warningsFor(collection, fields);
  if (!hasFields) warnings.unshift('Document fields are missing or malformed.');
  return { id, collection, fields, rawFields, warnings };
}
