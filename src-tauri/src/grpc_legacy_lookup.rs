//! The reflection-object lookup used by protobuf.js's Any wrapper.
//! Built from original descriptors, never the private wire-storage view.
use prost_reflect::{DescriptorPool, FileDescriptor, MessageDescriptor};
use std::collections::{HashMap, HashSet, VecDeque};

#[derive(Clone)]
pub(crate) enum Target {
    Message(String),
    RawContext,
    NonMessage,
    Unknown,
}

#[derive(Clone, Copy)]
enum Kind {
    Namespace,
    Message,
    Service,
    Other,
}
struct Node {
    name: String,
    parent: Option<usize>,
    kind: Kind,
    members: HashMap<String, usize>,
    nested: Vec<usize>,
}
impl Node {
    fn namespace(&self) -> bool {
        !matches!(self.kind, Kind::Other)
    }
    fn inherited_dictionary(&self) -> bool {
        matches!(self.kind, Kind::Message | Kind::Service) || !self.nested.is_empty()
    }
}
pub(crate) struct AnyLookup {
    nodes: Vec<Node>,
    names: HashMap<String, usize>,
}
impl AnyLookup {
    pub(crate) fn new(pool: &DescriptorPool) -> Self {
        let mut result = Self {
            nodes: vec![Node {
                name: String::new(),
                parent: None,
                kind: Kind::Namespace,
                members: HashMap::new(),
                nested: Vec::new(),
            }],
            names: HashMap::from([(String::new(), 0)]),
        };
        if pool
            .files()
            .any(|file| file.file_descriptor_proto().source_code_info.is_some())
        {
            result.add_source_order(pool);
            return result;
        }
        for file in pool.files() {
            result.scope(file.package_name());
        }
        for message in pool.all_messages() {
            if message.is_map_entry() {
                continue;
            }
            let index = result.add(message.full_name(), Kind::Message, true);
            for field in message.fields() {
                result.add_member(
                    index,
                    crate::grpc_legacy::field_name(&field),
                    field.full_name(),
                );
            }
            for oneof in message.oneofs() {
                result.add_member(index, oneof.name(), oneof.full_name());
            }
        }
        for enumeration in pool.all_enums() {
            result.add(enumeration.full_name(), Kind::Other, true);
        }
        for service in pool.services() {
            let index = result.add(service.full_name(), Kind::Service, true);
            for method in service.methods() {
                result.add_member(index, method.name(), method.full_name());
            }
        }
        for extension in pool.all_extensions() {
            result.add(extension.full_name(), Kind::Other, true);
        }
        result
    }

    fn add_message(&mut self, message: MessageDescriptor) {
        let index = self.add(message.full_name(), Kind::Message, true);
        for field in message.fields() {
            self.add_member(
                index,
                crate::grpc_legacy::field_name(&field),
                field.full_name(),
            );
        }
        for group in message.oneofs() {
            self.add_member(index, group.name(), group.full_name());
        }
    }

    fn add_source_order(&mut self, pool: &DescriptorPool) {
        struct Declaration {
            name: String,
            kind: Kind,
            path: Vec<i32>,
        }
        let mut declarations: HashMap<String, Vec<Declaration>> = HashMap::new();
        let mut add = |file: FileDescriptor, name: &str, kind: Kind, path: &[i32]| {
            declarations
                .entry(file.name().to_owned())
                .or_default()
                .push(Declaration {
                    name: name.to_owned(),
                    kind,
                    path: path.to_vec(),
                });
        };
        for message in pool
            .all_messages()
            .filter(|message| !message.is_map_entry())
        {
            add(
                message.parent_file(),
                message.full_name(),
                Kind::Message,
                message.path(),
            );
        }
        for enumeration in pool.all_enums() {
            add(
                enumeration.parent_file(),
                enumeration.full_name(),
                Kind::Other,
                enumeration.path(),
            );
        }
        for service in pool.services() {
            add(
                service.parent_file(),
                service.full_name(),
                Kind::Service,
                service.path(),
            );
        }
        for extension in pool.all_extensions() {
            add(
                extension.parent_file(),
                extension.full_name(),
                Kind::Other,
                extension.path(),
            );
        }
        let files: Vec<_> = pool.files().collect();
        let imported: HashSet<_> = files
            .iter()
            .flat_map(|file| file.dependencies())
            .map(|file| file.name().to_owned())
            .collect();
        // A source loader parses the entry before scheduling imports. Sibling
        // asynchronous completion is not recoverable from descriptor metadata;
        // retain dependency declaration order as the deterministic tie-break.
        let mut queue: VecDeque<_> = files
            .iter()
            .filter(|file| !imported.contains(file.name()))
            .cloned()
            .collect();
        let mut seen = HashSet::new();
        let mut ordered = Vec::new();
        while let Some(file) = queue.pop_front() {
            if !seen.insert(file.name().to_owned()) {
                continue;
            }
            queue.extend(file.dependencies());
            ordered.push(file);
        }
        ordered.extend(files.into_iter().filter(|file| !seen.contains(file.name())));
        for file in ordered {
            self.scope(file.package_name());
            let positions: HashMap<_, _> = file
                .file_descriptor_proto()
                .source_code_info
                .as_ref()
                .into_iter()
                .flat_map(|info| &info.location)
                .filter_map(|location| {
                    Some((
                        location.path.clone(),
                        (*location.span.first()?, *location.span.get(1)?),
                    ))
                })
                .collect();
            let mut items = declarations.remove(file.name()).unwrap_or_default();
            // Stable sort preserves descriptor order when source positions are
            // absent (for example bundled WKT descriptors).
            items.sort_by_key(|item| {
                positions
                    .get(&item.path)
                    .copied()
                    .unwrap_or((i32::MAX, i32::MAX))
            });
            for item in items {
                match item.kind {
                    Kind::Message => {
                        self.add_message(pool.get_message_by_name(&item.name).unwrap())
                    }
                    Kind::Service => {
                        let service = pool.get_service_by_name(&item.name).unwrap();
                        let index = self.add(service.full_name(), Kind::Service, true);
                        for method in service.methods() {
                            self.add_member(index, method.name(), method.full_name());
                        }
                    }
                    _ => {
                        self.add(&item.name, item.kind, true);
                    }
                }
            }
        }
    }

    fn scope(&mut self, full: &str) -> usize {
        if let Some(index) = self.names.get(full) {
            return *index;
        }
        let mut index = 0;
        let mut path = String::new();
        for segment in full.split('.') {
            if !path.is_empty() {
                path.push('.');
            }
            path.push_str(segment);
            index = if let Some(index) = self.names.get(&path) {
                *index
            } else {
                self.insert(index, segment, &path, Kind::Namespace, true)
            };
        }
        index
    }
    fn add(&mut self, full: &str, kind: Kind, nested: bool) -> usize {
        if let Some(index) = self.names.get(full).copied() {
            self.nodes[index].kind = kind;
            return index;
        }
        let (parent, name) = full.rsplit_once('.').unwrap_or(("", full));
        let parent = self.scope(parent);
        self.insert(parent, name, full, kind, nested)
    }
    fn add_member(&mut self, parent: usize, name: &str, full: &str) {
        self.insert(parent, name, full, Kind::Other, false);
    }
    fn insert(&mut self, parent: usize, name: &str, full: &str, kind: Kind, nested: bool) -> usize {
        let index = self.nodes.len();
        self.nodes.push(Node {
            name: full.to_owned(),
            parent: Some(parent),
            kind,
            members: HashMap::new(),
            nested: Vec::new(),
        });
        self.names.insert(full.to_owned(), index);
        self.nodes[parent].members.insert(name.to_owned(), index);
        if nested {
            self.nodes[parent].nested.push(index);
        }
        index
    }

    fn target(&self, index: usize) -> Target {
        if matches!(self.nodes[index].kind, Kind::Message) {
            Target::Message(self.nodes[index].name.clone())
        } else {
            Target::NonMessage
        }
    }
    pub(crate) fn resolve(&self, path: &str) -> Target {
        // Empty lookup returns the wrapper's original converter context, not
        // the registered Any type whose fromObject would apply the wrapper.
        if path.is_empty() {
            return Target::RawContext;
        }
        let absolute = path.starts_with('.');
        let path = path.trim_start_matches('.');
        if path.is_empty() {
            return Target::NonMessage;
        }
        let Some(start) = self.names.get("google.protobuf.Any").copied() else {
            return Target::Unknown;
        };
        let parts: Vec<_> = path.split('.').collect();
        let mut pending = vec![(if absolute { 0 } else { start }, 0, false)];
        let mut visited = HashSet::new();
        while let Some((index, offset, parent_checked)) = pending.pop() {
            if !visited.insert((index, offset, parent_checked)) {
                continue;
            }
            if offset == parts.len() {
                return self.target(index);
            }
            let name = parts[offset];
            if name.is_empty() {
                pending.push((0, offset + 1, false));
                continue;
            }
            let node = &self.nodes[index];
            // LIFO retains protobuf.js's child traversal before parent fallback.
            if !parent_checked {
                if let Some(parent) = node.parent {
                    pending.push((parent, offset, false));
                }
            }
            if let Some(found) = node.members.get(name).copied() {
                if offset + 1 == parts.len() {
                    return self.target(found);
                }
                if self.nodes[found].namespace() {
                    pending.push((found, offset + 1, true));
                }
            } else if node.inherited_dictionary() && inherited_name(name) {
                // Model the resulting non-message safely, without prototypes.
                if offset + 1 == parts.len() {
                    return Target::NonMessage;
                }
            } else {
                for child in node.nested.iter().rev() {
                    if self.nodes[*child].namespace() {
                        pending.push((*child, offset, true));
                    }
                }
            }
        }
        Target::Unknown
    }
}

fn inherited_name(name: &str) -> bool {
    matches!(
        name,
        "constructor"
            | "toString"
            | "__proto__"
            | "hasOwnProperty"
            | "isPrototypeOf"
            | "valueOf"
            | "toLocaleString"
            | "propertyIsEnumerable"
            | "__defineGetter__"
            | "__defineSetter__"
            | "__lookupGetter__"
            | "__lookupSetter__"
    )
}
