export function validatePareter(parameter: string) {
  const onlyLettersPattern = /^[A-Z a-z.0-9=/_$-]+$/;
  if (!parameter.match(onlyLettersPattern)) {
    throw new Error(`Invalid parameter: ${parameter}`);
  }
  return parameter;
}