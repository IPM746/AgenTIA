import { JsonSchema } from '../types';

export interface ArgumentValidationResult {
  valid: boolean;
  errors: string[];
}

const matchesType = (value: unknown, type: string): boolean => {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
  return typeof value === type;
};

const validateValue = (
  value: unknown,
  schema: JsonSchema,
  path: string,
  errors: string[],
): void => {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (!types.some((type) => matchesType(value, type))) {
    errors.push(`${path} debe ser de tipo ${types.join(' o ')}.`);
    return;
  }

  if (schema.enum && !schema.enum.includes(value as never)) {
    errors.push(`${path} debe ser uno de los valores permitidos.`);
  }

  if (schema.properties && typeof value === 'object' && value !== null) {
    const objectValue = value as Record<string, unknown>;
    for (const required of schema.required ?? []) {
      if (!(required in objectValue)) {
        errors.push(`${path}.${required} es obligatorio.`);
      }
    }
    for (const [key, childValue] of Object.entries(objectValue)) {
      const childSchema = schema.properties[key];
      if (!childSchema) {
        if (schema.additionalProperties === false) {
          errors.push(`${path}.${key} no está permitido.`);
        }
        continue;
      }
      validateValue(childValue, childSchema, `${path}.${key}`, errors);
    }
  }

  if (schema.items && Array.isArray(value)) {
    value.forEach((item, index) =>
      validateValue(item, schema.items!, `${path}[${index}]`, errors),
    );
  }
};

export const validateArguments = (
  args: Record<string, unknown>,
  schema: JsonSchema,
): ArgumentValidationResult => {
  const errors: string[] = [];
  validateValue(args, schema, 'args', errors);
  return { valid: errors.length === 0, errors };
};
