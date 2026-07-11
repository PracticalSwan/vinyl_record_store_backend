function booleanFeature(value, defaultValue) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return defaultValue;
  }
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

export function personalizationIdentityStrictEnabled(environment = process.env) {
  return booleanFeature(environment.PERS_IDENTITY_STRICT, true);
}

export function personalizationMeEndpointEnabled(environment = process.env) {
  return booleanFeature(environment.PERS_ME_ENDPOINT, true);
}
