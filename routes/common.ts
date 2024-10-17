export function validateParameter(parameter: string) {
  const pattern = /^[A-Za-z.0-9=/_$+\-]+$/;
  if (!parameter.match(pattern)) {
    throw new Error(`Invalid parameter: ${parameter}`);
  }
  return parameter;
}