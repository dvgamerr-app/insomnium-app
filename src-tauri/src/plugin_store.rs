//! PluginData is application-local, separate from workspace exports and Git sync.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::BTreeMap,
    fs,
    io::Read,
    path::Path,
    sync::{Arc, Mutex},
};
use tauri::Manager;

const FILE: &str = "plugin-data-v1.json";
const MAX_BYTES: usize = 8 * 1024 * 1024;
const MAX_VALUE: usize = 1024 * 1024;
const MAX_KEY: usize = 8192;
const MAX_PLUGINS: usize = 256;
const MAX_ITEMS: usize = 4096;

#[derive(Default)]
pub struct PluginStoreState(pub Arc<Mutex<()>>);

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LegacyPluginItem {
    plugin: String,
    key: String,
    value: String,
}

// User-invoked host migration only; this is not part of the guest store facade.
#[tauri::command]
pub async fn import_legacy_plugin_data(
    app: tauri::AppHandle,
    state: tauri::State<'_, PluginStoreState>,
    network: tauri::State<'_, crate::http::NetworkState>,
    records: Vec<LegacyPluginItem>,
) -> Result<Value, String> {
    let work =
        network.retain_native_work(format!("plugin-data-import:{}", uuid::Uuid::new_v4()))?;
    let directory = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let lock = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _work = work;
        let _guard = lock.lock().map_err(|e| e.to_string())?;
        let mut data = read(&directory)?;
        let mut inserted = 0usize;
        let mut skipped = 0usize;
        for record in records {
            if !crate::plugins::valid_name(&record.plugin) || record.plugin.len() > 256 {
                return Err("Invalid legacy plugin name. Store unchanged.".into());
            }
            key_valid(&record.key)?;
            if record.value.len() > MAX_VALUE {
                return Err("Legacy plugin value exceeds 1 MiB. Store unchanged.".into());
            }
            match data
                .plugins
                .entry(record.plugin)
                .or_default()
                .entry(record.key)
            {
                std::collections::btree_map::Entry::Vacant(entry) => {
                    entry.insert(record.value);
                    inserted += 1;
                }
                std::collections::btree_map::Entry::Occupied(_) => skipped += 1,
            }
        }
        validate(&data)?;
        if inserted > 0 {
            let bytes = serde_json::to_vec(&data).map_err(|e| e.to_string())?;
            if bytes.len() > MAX_BYTES {
                return Err("PluginData exceeds 8 MiB. Store unchanged.".into());
            }
            fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
            crate::storage::atomic_write(&directory.join(FILE), &bytes)?;
        }
        Ok(json!({"inserted":inserted,"skipped":skipped}))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PluginData {
    schema_version: u32,
    plugins: BTreeMap<String, BTreeMap<String, String>>,
}

impl Default for PluginData {
    fn default() -> Self {
        Self {
            schema_version: 1,
            plugins: BTreeMap::new(),
        }
    }
}

#[derive(Deserialize)]
#[serde(tag = "action", rename_all = "camelCase", deny_unknown_fields)]
pub enum PluginStoreOperation {
    HasItem { key: String },
    GetItem { key: String },
    SetItem { key: String, value: String },
    RemoveItem { key: String },
    Clear {},
    All {},
}

fn key_valid(key: &str) -> Result<(), String> {
    if key.len() > MAX_KEY {
        return Err("Plugin store key exceeds the 8192-byte limit.".into());
    }
    Ok(())
}

fn validate(data: &PluginData) -> Result<(), String> {
    if data.schema_version != 1 {
        return Err("Unsupported PluginData version. Original file retained.".into());
    }
    if data.plugins.len() > MAX_PLUGINS {
        return Err("PluginData exceeds the 256-plugin limit.".into());
    }
    for (plugin, items) in &data.plugins {
        if !crate::plugins::valid_name(plugin) {
            return Err("Invalid plugin name in PluginData. Original file retained.".into());
        }
        if items.len() > MAX_ITEMS {
            return Err("Plugin store exceeds the 4096-item limit.".into());
        }
        for (key, value) in items {
            key_valid(key)?;
            if value.len() > MAX_VALUE {
                return Err("Plugin store value exceeds the 1 MiB limit.".into());
            }
        }
    }
    Ok(())
}

fn read(directory: &Path) -> Result<PluginData, String> {
    let path = directory.join(FILE);
    match fs::symlink_metadata(&path) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(PluginData::default()),
        Err(e) => return Err(e.to_string()),
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_file() => {
            return Err(
                "PluginData must be a regular file, not a link or folder. Original path retained."
                    .into(),
            )
        }
        Ok(_) => {}
    }
    let mut bytes = vec![];
    fs::File::open(&path)
        .map_err(|e| e.to_string())?
        .take((MAX_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > MAX_BYTES {
        return Err("PluginData exceeds the 8 MiB file limit. Original file retained.".into());
    }
    let data: PluginData = serde_json::from_slice(&bytes)
        .map_err(|e| format!("PluginData is damaged: {e}. Original file retained."))?;
    validate(&data)?;
    Ok(data)
}

fn execute(
    directory: &Path,
    plugin: &str,
    operation: PluginStoreOperation,
) -> Result<Value, String> {
    if plugin.len() > 256 || !crate::plugins::valid_name(plugin) {
        return Err("Select a valid plugin name for its store.".into());
    }
    match &operation {
        PluginStoreOperation::HasItem { key }
        | PluginStoreOperation::GetItem { key }
        | PluginStoreOperation::SetItem { key, .. }
        | PluginStoreOperation::RemoveItem { key } => key_valid(key)?,
        _ => {}
    }
    if let PluginStoreOperation::SetItem { value, .. } = &operation {
        if value.len() > MAX_VALUE {
            return Err("Plugin store value exceeds the 1 MiB limit.".into());
        }
    }
    // Re-read under the application mutex; failed writes never advance a cache.
    let mut data = read(directory)?;
    let items = data.plugins.get(plugin);
    let changed = match operation {
        PluginStoreOperation::HasItem { key } => {
            return Ok(json!(items.is_some_and(|v| v.contains_key(&key))))
        }
        PluginStoreOperation::GetItem { key } => return Ok(json!(items.and_then(|v| v.get(&key)))),
        PluginStoreOperation::All {} => {
            return Ok(json!(items
                .into_iter()
                .flatten()
                .map(|(key, value)| json!({"key":key,"value":value}))
                .collect::<Vec<_>>()))
        }
        PluginStoreOperation::SetItem { key, value } => {
            if items.and_then(|v| v.get(&key)) == Some(&value) {
                false
            } else {
                data.plugins
                    .entry(plugin.into())
                    .or_default()
                    .insert(key, value);
                true
            }
        }
        PluginStoreOperation::RemoveItem { key } => data
            .plugins
            .get_mut(plugin)
            .is_some_and(|v| v.remove(&key).is_some()),
        PluginStoreOperation::Clear {} => data.plugins.remove(plugin).is_some(),
    };
    if changed {
        data.plugins.retain(|_, items| !items.is_empty());
        validate(&data)?;
        let bytes = serde_json::to_vec(&data).map_err(|e| e.to_string())?;
        if bytes.len() > MAX_BYTES {
            return Err("PluginData exceeds the 8 MiB file limit. Original file retained.".into());
        }
        fs::create_dir_all(directory).map_err(|e| e.to_string())?;
        crate::storage::atomic_write(&directory.join(FILE), &bytes)?;
    }
    Ok(Value::Null)
}

#[tauri::command]
pub async fn plugin_store(
    app: tauri::AppHandle,
    state: tauri::State<'_, PluginStoreState>,
    network: tauri::State<'_, crate::http::NetworkState>,
    plugin: String,
    operation: PluginStoreOperation,
) -> Result<Value, String> {
    let work = network.retain_native_work(format!("plugin-store:{}", uuid::Uuid::new_v4()))?;
    let directory = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let lock = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _work = work;
        let _guard = lock.lock().map_err(|e| e.to_string())?;
        execute(&directory, &plugin, operation)
    })
    .await
    .map_err(|e| e.to_string())?
}
