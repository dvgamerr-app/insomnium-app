//! The reflection-object lookup used by protobuf.js's Any wrapper.
//! Built from original descriptors, never the private wire-storage view.
use prost_reflect::DescriptorPool;
use std::collections::{HashMap, HashSet};

#[derive(Clone)]
pub(crate) enum Target {
    Message(String),
    RawContext,
    NonMessage,
    Unknown,
}

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
