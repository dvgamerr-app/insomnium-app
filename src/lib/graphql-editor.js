import {
  parse,
  getOperationAST,
  typeFromAST,
  isInputType,
  getNamedType,
  isType,
  astFromValue,
  print,
} from "graphql";

/** @param {import('graphql').GraphQLSchema|null} schema @param {string} query @param {string} [operationName] */
export function graphqlVariableTypes(schema, query, operationName) {
  if (!schema || query.length >= 1000000) return undefined;
  try {
    const operation = getOperationAST(parse(query), operationName || undefined);
    if (!operation) return undefined;
    /** @type {Record<string, import('graphql').GraphQLInputType>} */
    const types = Object.create(null);
    for (const definition of operation.variableDefinitions || []) {
      const type = typeFromAST(schema, definition.type);
      if (type && isInputType(type))
        types[definition.variable.name.value] = type;
    }
    return types;
  } catch {
    return undefined;
  }
}

/** @param {any} reference */
export function graphqlReferenceType(reference) {
  const type =
    reference?.type || reference?.argument?.type || reference?.field?.type;
  return isType(type) ? getNamedType(type).name : "";
}

/** @param {import('graphql').GraphQLDirective} directive */
export function graphqlDirectiveText(directive) {
  const args = directive.args.map((arg) => {
    const value =
      arg.defaultValue === undefined
        ? null
        : astFromValue(arg.defaultValue, arg.type);
    return `${arg.name}: ${arg.type}${value ? ` = ${print(value)}` : ""}`;
  });
  return `${directive.description ? directive.description + "\n\n" : ""}directive @${directive.name}${args.length ? `(${args.join(", ")})` : ""}${directive.isRepeatable ? " repeatable" : ""} on ${directive.locations.join(" | ")}`;
}
