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
  parseType,
  Kind,
} from "graphql";

/** @param {import('graphql').GraphQLSchema|null} schema @param {string} query @param {string} [operationName] */
export function graphqlVariableTypes(schema, query, operationName) {
  if (!schema || query.length >= 1000000) return undefined;
  try {
    const operation = getOperationAST(
      parse(query, { maxTokens: 10000 }),
      operationName || undefined,
    );
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

/** Keep navigation history independent from cyclic GraphQL schema objects.
 * @param {any} reference */
export function graphqlReferenceMember(reference){
  const field=reference?.field?.name||'',argument=reference?.argument?.name||'';
  const enumValue=reference?.kind==='EnumValue'?reference.value?.name||'':'';
  if(!field&&!argument&&!enumValue)return null;
  const owner=reference?.directive
    ? 'directive:'+reference.directive.name : 'type:'+graphqlReferenceType(reference);
  return {owner,field,argument,enumValue};
}

/** Locate a referenced member in the displayed SDL using AST positions, so
 * descriptions and repeated names cannot select the wrong occurrence.
 * @param {string} definition @param {ReturnType<typeof graphqlReferenceMember>} member
 * @param {number} [prefix] */
export function graphqlSchemaMemberRange(definition,member,prefix=0){
  if(!member)return null;
  try{
    const node=/** @type {any} */(parse(definition.slice(prefix),{maxTokens:10000}).definitions[0]);
    const field=member.field?node.fields?.find((/** @type {any} */item)=>item.name.value===member.field):undefined;
    const target=member.argument
      ? (field?.arguments||node.arguments)?.find((/** @type {any} */item)=>item.name.value===member.argument)
      : member.enumValue
        ? node.values?.find((/** @type {any} */item)=>item.name.value===member.enumValue)
        : field;
    const location=target?.name?.loc;
    return location?{start:prefix+location.start,end:prefix+location.end}:null;
  }catch{return null;}
}

/** Direct schema links, unwrapping lists/non-null and deduplicating names.
 * @param {import('graphql').GraphQLNamedType|import('graphql').GraphQLDirective|undefined} owner
 * @param {import('graphql').GraphQLSchema|null} [schema] */
export function graphqlReferencedTypes(owner, schema = null) {
  const names = new Set();
  const introspectionOwner=isType(owner)&&owner.name.startsWith('__');
  /** @param {import('graphql').GraphQLType} type */
  const add = (type) => {
    const name = getNamedType(type).name;
    if ((!name.startsWith("__")||introspectionOwner) && (!isType(owner) || name !== owner.name))
      names.add(name);
  };
  if (isDirective(owner)) {
    for (const argument of owner.args) add(argument.type);
  } else if (isObjectType(owner) || isInterfaceType(owner)) {
    for (const parent of owner.getInterfaces()) add(parent);
    if (isInterfaceType(owner) && schema)
      for (const implementation of schema.getPossibleTypes(owner)) add(implementation);
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
  /** @type {import('graphql').DirectiveDefinitionNode} */
  const definition = {
    kind: Kind.DIRECTIVE_DEFINITION,
    name: { kind: Kind.NAME, value: directive.name },
    repeatable: directive.isRepeatable,
    locations: directive.locations.map(value => ({ kind: Kind.NAME, value })),
    arguments: directive.args.map(arg => ({
      kind: Kind.INPUT_VALUE_DEFINITION,
      name: { kind: Kind.NAME, value: arg.name },
      description: arg.description == null ? undefined : {
        kind: Kind.STRING, value: arg.description, block: true,
      },
      type: parseType(String(arg.type)),
      defaultValue: arg.defaultValue === undefined ? undefined
        // Runtime defaults contain values, never executable variable references.
        : /** @type {import('graphql').ConstValueNode|undefined} */ (
          astFromValue(arg.defaultValue, arg.type) ?? undefined),
      directives: arg.deprecationReason == null ? [] : [{
        kind: Kind.DIRECTIVE,
        name: { kind: Kind.NAME, value: 'deprecated' },
        arguments: [{
          kind: Kind.ARGUMENT,
          name: { kind: Kind.NAME, value: 'reason' },
          value: { kind: Kind.STRING, value: arg.deprecationReason },
        }],
      }],
    })),
  };
  // Keep the existing prose prefix and member-location offset contract.
  return `${directive.description ? directive.description + "\n\n" : ""}${print(definition)}`;
}
