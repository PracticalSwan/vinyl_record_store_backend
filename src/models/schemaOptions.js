export const schemaOptions = {
  strict: "throw",
  timestamps: true,
  versionKey: false,
};

export const publicIdField = {
  type: Number,
  required: true,
  immutable: true,
  min: 1,
  max: 1_000_000,
  validate: {
    validator: Number.isInteger,
    message: "Public ID must be an integer.",
  },
};

export const optionalPublicIdField = {
  ...publicIdField,
  required: false,
  default: null,
  validate: {
    validator: (value) => value === null || value === undefined || Number.isInteger(value),
    message: "Public ID must be an integer.",
  },
};

export function uniqueValues(values) {
  return Array.isArray(values) && new Set(values).size === values.length;
}
