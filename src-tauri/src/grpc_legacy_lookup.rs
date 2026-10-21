//! The namespace lookup used by protobuf.js's saved sources and Any wrapper.
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
enum Found {
    Node(usize),
    Inherited,
    Missing,
}
impl AnyLookup {
    fn empty() -> Self {
        Self {
            nodes: vec![Node {
                name: String::new(),
                parent: None,
                kind: Kind::Namespace,
                members: HashMap::new(),
                nested: Vec::new(),
            }],
            names: HashMap::from([(String::new(), 0)]),
        }
    }
    pub(crate) fn new(pool: &DescriptorPool) -> Self {
        let mut result = Self::empty();
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

    /// Reflection first constructs Root.fromDescriptor, then re-emits one file
    /// per namespace with Root.toDescriptor before proto-loader reads it again.
    /// Source spans and synthetic map-entry hiding belong to the file profile.
    pub(crate) fn from_descriptor(pool: &DescriptorPool) -> Self {
        let mut loaded = Self::empty();
        for file in pool.files() {
            loaded.scope(file.package_name());
            let mut pending: Vec<_> = file.messages().collect();
            pending.reverse();
            while let Some(message) = pending.pop() {
                loaded.add_descriptor_message(message.clone());
                for enumeration in message.child_enums() {
                    loaded.add(enumeration.full_name(), Kind::Other, true);
                }
                for extension in message.child_extensions() {
                    loaded.add(extension.full_name(), Kind::Other, true);
                }
                let children: Vec<_> = message.child_messages().collect();
                pending.extend(children.into_iter().rev());
            }
            for enumeration in file.enums() {
                loaded.add(enumeration.full_name(), Kind::Other, true);
            }
            for extension in file.extensions() {
                loaded.add(extension.full_name(), Kind::Other, true);
            }
            for service in file.services() {
                let index = loaded.add(service.full_name(), Kind::Service, true);
                for method in service.methods() {
                    loaded.add_member(index, method.name(), method.full_name());
                }
            }
        }
        // Root.toDescriptor visits plain child namespaces before emitting the
        // current namespace's file. Keep this traversal iterative as well.
        let mut pending = vec![(0, false)];
        let mut packages = Vec::new();
        while let Some((index, expanded)) = pending.pop() {
            if expanded {
                packages.push(index);
            } else {
                pending.push((index, true));
                for child in loaded.nodes[index].nested.iter().rev() {
                    if matches!(loaded.nodes[*child].kind, Kind::Namespace) {
                        pending.push((*child, false));
                    }
                }
            }
        }
        let mut result = Self::empty();
        for package in packages {
            let nested = &loaded.nodes[package].nested;
            if !nested
                .iter()
                .any(|child| !matches!(loaded.nodes[*child].kind, Kind::Namespace))
            {
                continue;
            }
            result.scope(&loaded.nodes[package].name);
            let mut types: Vec<_> = nested
                .iter()
                .copied()
                .filter(|child| matches!(loaded.nodes[*child].kind, Kind::Message))
                .collect();
            types.reverse();
            while let Some(index) = types.pop() {
                result.add_descriptor_message(
                    pool.get_message_by_name(&loaded.nodes[index].name).unwrap(),
                );
                for child in &loaded.nodes[index].nested {
                    if matches!(loaded.nodes[*child].kind, Kind::Other) {
                        result.add(&loaded.nodes[*child].name, Kind::Other, true);
                    }
                }
                types.extend(
                    loaded.nodes[index]
                        .nested
                        .iter()
                        .rev()
                        .copied()
                        .filter(|child| matches!(loaded.nodes[*child].kind, Kind::Message)),
                );
            }
            for child in nested {
                let node = &loaded.nodes[*child];
                match node.kind {
                    Kind::Other => {
                        result.add(&node.name, Kind::Other, true);
                    }
                    Kind::Service => {
                        let service = pool.get_service_by_name(&node.name).unwrap();
                        let index = result.add(&node.name, Kind::Service, true);
                        for method in service.methods() {
                            result.add_member(index, method.name(), method.full_name());
                        }
                    }
                    _ => {}
                }
            }
        }
        result
    }

    fn add_descriptor_message(&mut self, message: MessageDescriptor) {
        let index = self.add(message.full_name(), Kind::Message, true);
        for field in message.fields() {
            self.add_member(index, field.name(), field.full_name());
        }
        for group in message.oneofs() {
            self.add_member(index, group.name(), group.full_name());
        }
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
        if path.trim_start_matches('.').is_empty() {
            return Target::NonMessage;
        }
        let Some(start) = self.names.get("google.protobuf.Any").copied() else {
            return Target::Unknown;
        };
        match self.find(start, path, |_| true, true) {
            Found::Node(index) => self.target(index),
            Found::Inherited => Target::NonMessage,
            Found::Missing => Target::Unknown,
        }
    }

    fn find(
        &self,
        start: usize,
        path: &str,
        accept: impl Fn(&Node) -> bool,
        inherited: bool,
    ) -> Found {
        let absolute = path.starts_with('.');
        let path = path.trim_start_matches('.');
        let parts: Vec<_> = path.split('.').collect();
        let mut pending = vec![(if absolute { 0 } else { start }, 0, false)];
        let mut visited = HashSet::new();
        while let Some((index, offset, parent_checked)) = pending.pop() {
            if !visited.insert((index, offset, parent_checked)) {
                continue;
            }
            if offset == parts.len() {
                if accept(&self.nodes[index]) {
                    return Found::Node(index);
                }
                continue;
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
                    if accept(&self.nodes[found]) {
                        return Found::Node(found);
                    }
                    continue;
                }
                if self.nodes[found].namespace() {
                    pending.push((found, offset + 1, true));
                }
            } else if node.inherited_dictionary() && inherited_name(name) {
                // Model the resulting non-message safely, without prototypes.
                if inherited && offset + 1 == parts.len() {
                    return Found::Inherited;
                }
            } else {
                for child in node.nested.iter().rev() {
                    if self.nodes[*child].namespace() {
                        pending.push((*child, offset, true));
                    }
                }
            }
        }
        Found::Missing
    }
}

enum SourceDeclaration<'a> {
    Message(&'a prost_types::DescriptorProto),
    Enumeration,
    Service(&'a prost_types::ServiceDescriptorProto),
    Extension,
}
struct SourceItem<'a> {
    name: String,
    path: Vec<i32>,
    declaration: SourceDeclaration<'a>,
}
fn qualified(scope: &str, name: &str) -> String {
    if scope.is_empty() {
        name.to_owned()
    } else {
        format!("{scope}.{name}")
    }
}
fn source_message<'a>(
    items: &mut Vec<SourceItem<'a>>,
    scope: &str,
    message: &'a prost_types::DescriptorProto,
    path: Vec<i32>,
) {
    if message
        .options
        .as_ref()
        .and_then(|options| options.map_entry)
        == Some(true)
    {
        return;
    }
    let name = qualified(scope, message.name());
    items.push(SourceItem {
        name: name.clone(),
        path: path.clone(),
        declaration: SourceDeclaration::Message(message),
    });
    for (index, child) in message.nested_type.iter().enumerate() {
        source_message(
            items,
            &name,
            child,
            [path.as_slice(), &[3, index as i32]].concat(),
        );
    }
    for (index, child) in message.enum_type.iter().enumerate() {
        items.push(SourceItem {
            name: qualified(&name, child.name()),
            path: [path.as_slice(), &[4, index as i32]].concat(),
            declaration: SourceDeclaration::Enumeration,
        });
    }
    for (index, child) in message.extension.iter().enumerate() {
        items.push(SourceItem {
            name: qualified(&name, child.name()),
            path: [path.as_slice(), &[6, index as i32]].concat(),
            declaration: SourceDeclaration::Extension,
        });
    }
}
fn json_field(name: &str) -> String {
    let mut result = String::new();
    let mut upper = false;
    for ch in name.chars() {
        if ch == '_' {
            upper = true;
        } else {
            result.push(if upper { ch.to_ascii_uppercase() } else { ch });
            upper = false;
        }
    }
    result
}

struct SourceLookup {
    graph: AnyLookup,
    enums: HashSet<String>,
    cache: HashMap<(usize, String, u8), Option<usize>>,
}
impl SourceLookup {
    fn new(files: &[prost_types::FileDescriptorProto]) -> Self {
        let mut result = Self {
            graph: AnyLookup::empty(),
            enums: HashSet::new(),
            cache: HashMap::new(),
        };
        for file in files {
            result.graph.scope(file.package());
            let mut items = Vec::new();
            for (index, message) in file.message_type.iter().enumerate() {
                source_message(&mut items, file.package(), message, vec![4, index as i32]);
            }
            for (index, enumeration) in file.enum_type.iter().enumerate() {
                items.push(SourceItem {
                    name: qualified(file.package(), enumeration.name()),
                    path: vec![5, index as i32],
                    declaration: SourceDeclaration::Enumeration,
                });
            }
            for (index, service) in file.service.iter().enumerate() {
                items.push(SourceItem {
                    name: qualified(file.package(), service.name()),
                    path: vec![6, index as i32],
                    declaration: SourceDeclaration::Service(service),
                });
            }
            for (index, extension) in file.extension.iter().enumerate() {
                items.push(SourceItem {
                    name: qualified(file.package(), extension.name()),
                    path: vec![7, index as i32],
                    declaration: SourceDeclaration::Extension,
                });
            }
            let positions: HashMap<_, _> = file
                .source_code_info
                .iter()
                .flat_map(|info| &info.location)
                .filter_map(|location| {
                    Some((
                        location.path.as_slice(),
                        (*location.span.first()?, *location.span.get(1)?),
                    ))
                })
                .collect();
            items.sort_by_key(|item| {
                positions
                    .get(item.path.as_slice())
                    .copied()
                    .unwrap_or((i32::MAX, i32::MAX))
            });
            for item in items {
                match item.declaration {
                    SourceDeclaration::Message(message) => {
                        let parent = result.graph.add(&item.name, Kind::Message, true);
                        for field in &message.field {
                            let name = if crate::grpc_legacy::common_field_names(
                                file.name(),
                                file.package(),
                            ) {
                                field
                                    .json_name
                                    .clone()
                                    .unwrap_or_else(|| json_field(field.name()))
                            } else {
                                field.name().to_owned()
                            };
                            result.graph.add_member(
                                parent,
                                &name,
                                &qualified(&item.name, field.name()),
                            );
                        }
                        for oneof in &message.oneof_decl {
                            result.graph.add_member(
                                parent,
                                oneof.name(),
                                &qualified(&item.name, oneof.name()),
                            );
                        }
                    }
                    SourceDeclaration::Enumeration => {
                        result.enums.insert(item.name.clone());
                        result.graph.add(&item.name, Kind::Other, true);
                    }
                    SourceDeclaration::Service(service) => {
                        let parent = result.graph.add(&item.name, Kind::Service, true);
                        for method in &service.method {
                            result.graph.add_member(
                                parent,
                                method.name(),
                                &qualified(&item.name, method.name()),
                            );
                        }
                    }
                    SourceDeclaration::Extension => {
                        result.graph.add(&item.name, Kind::Other, true);
                    }
                }
            }
        }
        result
    }

    // 0 is unfiltered (extension extendee); 1 is lookupType; 2 is lookupTypeOrEnum.
    fn resolve(&mut self, scope: &str, name: &str, filter: u8) -> Result<(String, bool), String> {
        let mut parent = scope;
        let start = loop {
            if let Some(index) = self.graph.names.get(parent) {
                break *index;
            }
            parent = parent
                .rsplit_once('.')
                .map(|(parent, _)| parent)
                .unwrap_or("");
        };
        let key = (start, name.to_owned(), filter);
        let found = if let Some(found) = self.cache.get(&key) {
            *found
        } else {
            let found = match self.graph.find(
                start,
                name,
                |node| {
                    filter == 0
                        || matches!(node.kind, Kind::Message)
                        || (filter == 2 && self.enums.contains(&node.name))
                },
                filter == 0,
            ) {
                Found::Node(index) => Some(index),
                _ => None,
            };
            self.cache.insert(key, found);
            found
        };
        let index =
            found.ok_or_else(|| format!("Cannot resolve protobuf type '{name}' in '{scope}'."))?;
        let node = &self.graph.nodes[index];
        if !matches!(node.kind, Kind::Message) && !(filter == 2 && self.enums.contains(&node.name))
        {
            return Err(format!(
                "Protobuf type '{name}' in '{scope}' is not a message."
            ));
        }
        Ok((format!(".{}", node.name), self.enums.contains(&node.name)))
    }

    fn field(
        &mut self,
        scope: &str,
        field: &mut prost_types::FieldDescriptorProto,
    ) -> Result<(), String> {
        // Parsed named types are unresolved. Map-entry/group references and
        // already typed standard descriptors are compiler-generated and exact.
        if field.r#type.is_none() {
            if let Some(name) = &field.type_name {
                let (name, enumeration) = self.resolve(scope, name, 2)?;
                field.type_name = Some(name);
                field.r#type = Some(if enumeration { 14 } else { 11 });
            }
        }
        if let Some(name) = &field.extendee {
            field.extendee = Some(self.resolve(scope, name, 0)?.0);
        }
        Ok(())
    }
    fn message(
        &mut self,
        parent: &str,
        message: &mut prost_types::DescriptorProto,
    ) -> Result<(), String> {
        let scope = if message
            .options
            .as_ref()
            .and_then(|options| options.map_entry)
            == Some(true)
        {
            parent.to_owned()
        } else {
            qualified(parent, message.name())
        };
        for field in message.field.iter_mut().chain(message.extension.iter_mut()) {
            self.field(&scope, field)?;
        }
        for child in &mut message.nested_type {
            self.message(&scope, child)?;
        }
        Ok(())
    }
}

pub(crate) fn resolve_source_types(
    files: &mut [prost_types::FileDescriptorProto],
) -> Result<(), String> {
    let mut lookup = SourceLookup::new(files);
    for file in files {
        let package = file.package().to_owned();
        for message in &mut file.message_type {
            lookup.message(&package, message)?;
        }
        for field in &mut file.extension {
            lookup.field(&package, field)?;
        }
        for service in &mut file.service {
            let scope = qualified(&package, service.name());
            for method in &mut service.method {
                method.input_type = Some(lookup.resolve(&scope, method.input_type(), 1)?.0);
                method.output_type = Some(lookup.resolve(&scope, method.output_type(), 1)?.0);
            }
        }
    }
    Ok(())
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
