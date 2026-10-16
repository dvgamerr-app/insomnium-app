import {
  parse,
  getOperationAST,
  typeFromAST,
  isInputType,
  getNamedType,
  isType,
  isObjectType,
  isInterfaceType,
  isInputObjectType,
  isUnionType,
  isDirective,
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

/** Direct schema links, unwrapping lists/non-null and deduplicating names.
 * @param {import('graphql').GraphQLNamedType|import('graphql').GraphQLDirective|undefined} owner */
export function graphqlReferencedTypes(owner) {
  const names = new Set();
  /** @param {import('graphql').GraphQLType} type */
  const add = (type) => {
    const name = getNamedType(type).name;
    if (!name.startsWith("__") && (!isType(owner) || name !== owner.name))
      names.add(name);
  };
  if (isDirective(owner)) {
    for (const argument of owner.args) add(argument.type);
  } else if (isObjectType(owner) || isInterfaceType(owner)) {
    for (const parent of owner.getInterfaces()) add(parent);
    for (const field of Object.values(owner.getFields())) {
      add(field.type);
      for (const argument of field.args) add(argument.type);
    }
  } else if (isInputObjectType(owner)) {
    for (const field of Object.values(owner.getFields())) add(field.type);
  } else if (isUnionType(owner)) {
    for (const member of owner.getTypes()) add(member);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
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
