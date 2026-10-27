//! Bun must pass OS containment before it can replace the isolated guest VM.
#[cfg(not(windows))]
pub(crate) struct Sandbox;

#[cfg(windows)]
pub(crate) use windows_container::Sandbox;

#[cfg(windows)]
mod windows_container {
    use std::{
        fs,
        path::{Path, PathBuf},
    };
    use windows::{
        core::{w, PCWSTR, PWSTR},
        Win32::{
            Foundation::{LocalFree, ERROR_FILE_NOT_FOUND, ERROR_NO_MORE_ITEMS, HANDLE, HLOCAL},
            Security::{
                Authorization::{
                    BuildTrusteeWithSidW, ConvertSidToStringSidW,
                    ConvertStringSecurityDescriptorToSecurityDescriptorW, ConvertStringSidToSidW,
                    GetNamedSecurityInfoW, GetSecurityInfo, SetEntriesInAclW,
                    SetNamedSecurityInfoW, SetSecurityInfo, EXPLICIT_ACCESS_W, GRANT_ACCESS,
                    SET_ACCESS, SE_FILE_OBJECT, SE_REGISTRY_KEY,
                },
                FreeSid, GetSecurityDescriptorSacl, ImpersonateLoggedOnUser,
                Isolation::{
                    CreateAppContainerProfile, DeleteAppContainerProfile,
                    GetAppContainerFolderPath, GetAppContainerRegistryLocation,
                },
                RevertToSelf, ACE_FLAGS, ACL, CONTAINER_INHERIT_ACE, DACL_SECURITY_INFORMATION,
                LABEL_SECURITY_INFORMATION, OBJECT_INHERIT_ACE, PSECURITY_DESCRIPTOR, PSID,
                SECURITY_CAPABILITIES,
            },
            Storage::FileSystem::{
                FILE_GENERIC_EXECUTE, FILE_GENERIC_READ, READ_CONTROL, WRITE_DAC,
            },
            System::{
                Com::CoTaskMemFree,
                Registry::{
                    RegCloseKey, RegEnumKeyExW, RegOpenKeyExW, RegQueryValueExW, HKEY, KEY_READ,
                    REG_LINK, REG_OPTION_OPEN_LINK, REG_SAM_FLAGS, REG_VALUE_TYPE,
                },
            },
        },
    };

    pub(crate) struct Sandbox {
        name: Vec<u16>,
        pub(crate) capabilities: SECURITY_CAPABILITIES,
        pub(crate) directory: PathBuf,
        pub(crate) executable: PathBuf,
    }
    struct RegistryKey(HKEY);
    impl Drop for RegistryKey {
        fn drop(&mut self) {
            unsafe {
                if let Err(error) = RegCloseKey(self.0).ok() {
                    eprintln!("sandbox_registry_close: {error}");
                }
            }
        }
    }

    impl Sandbox {
        pub(crate) fn new(source: &Path) -> Result<Self, String> {
            crate::git::reject_link(source).map_err(|_| "sandbox_executable")?;
            if !fs::metadata(source).is_ok_and(|info| info.is_file()) {
                return Err("sandbox_executable".into());
            }
            let name: Vec<u16> = format!("Insomnium.Plugin.{}", uuid::Uuid::new_v4())
                .encode_utf16()
                .chain(Some(0))
                .collect();
            unsafe {
                let sid = CreateAppContainerProfile(
                    PCWSTR(name.as_ptr()),
                    PCWSTR(name.as_ptr()),
                    PCWSTR(name.as_ptr()),
                    None,
                )
                .map_err(|error| format!("sandbox_profile: {error}"))?;
                let mut container = Self {
                    name,
                    capabilities: SECURITY_CAPABILITIES {
                        AppContainerSid: sid,
                        ..Default::default()
                    },
                    directory: PathBuf::new(),
                    executable: PathBuf::new(),
                };
                let mut text = PWSTR::null();
                ConvertSidToStringSidW(sid, &mut text)
                    .map_err(|error| format!("sandbox_sid: {error}"))?;
                let directory = GetAppContainerFolderPath(PCWSTR(text.0));
                let _ = LocalFree(Some(HLOCAL(text.0.cast())));
                let directory = directory.map_err(|error| format!("sandbox_directory: {error}"))?;
                let path = directory.to_string();
                CoTaskMemFree(Some(directory.0.cast()));
                container.directory = PathBuf::from(path.map_err(|_| "sandbox_directory")?);
                crate::git::reject_link(&container.directory).map_err(|_| "sandbox_directory")?;
                container.executable = container.directory.join("runtime.exe");
                fs::copy(source, &container.executable)
                    .map_err(|error| format!("sandbox_copy: {error}"))?;
                Ok(container)
            }
        }

        pub(crate) fn seal(&self, check: &dyn Fn() -> Result<(), String>) -> Result<(), String> {
            use std::os::windows::ffi::OsStrExt;
            use windows::{core::BOOL, Win32::Security::ACL};
            let mut descriptor = PSECURITY_DESCRIPTOR::default();
            let mut owner_rights = PSID::default();
            unsafe {
                ConvertStringSidToSidW(w!("S-1-3-4"), &mut owner_rights)
                    .map_err(|error| error.to_string())?;
                let converted = ConvertStringSecurityDescriptorToSecurityDescriptorW(
                    w!("S:(ML;OICI;NW;;;LW)"),
                    1,
                    &mut descriptor,
                    None,
                );
                if let Err(error) = converted {
                    let _ = LocalFree(Some(HLOCAL(owner_rights.0)));
                    return Err(format!("sandbox_label: {error}"));
                }
                let result: Result<(), String> = (|| {
                    let (mut present, mut defaulted) = (BOOL(0), BOOL(0));
                    let mut acl = std::ptr::null_mut::<ACL>();
                    GetSecurityDescriptorSacl(descriptor, &mut present, &mut acl, &mut defaulted)
                        .map_err(|error| error.to_string())?;
                    if !present.as_bool() || acl.is_null() {
                        return Err("sandbox_label_missing".into());
                    }
                    let root = self.directory.parent().ok_or("sandbox_profile_root")?;
                    let name = String::from_utf16(&self.name[..self.name.len() - 1])
                        .map_err(|_| "sandbox_profile_name")?;
                    if self.directory.file_name().and_then(|v| v.to_str()) != Some("AC")
                        || !root
                            .file_name()
                            .and_then(|v| v.to_str())
                            .is_some_and(|v| v.eq_ignore_ascii_case(&name))
                    {
                        return Err("sandbox_profile_root_identity".into());
                    }
                    let mut pending = vec![root.to_path_buf()];
                    let mut count = 0;
                    while let Some(path) = pending.pop() {
                        check()?;
                        count += 1;
                        if count > 4096 {
                            return Err("sandbox_storage_limit".into());
                        }
                        crate::git::reject_link(&path)?;
                        let metadata =
                            fs::symlink_metadata(&path).map_err(|error| error.to_string())?;
                        if metadata.is_dir() {
                            for item in fs::read_dir(&path).map_err(|error| error.to_string())? {
                                pending.push(item.map_err(|error| error.to_string())?.path());
                            }
                        } else if !metadata.is_file() {
                            return Err("sandbox_storage_type".into());
                        }
                        let name: Vec<u16> =
                            path.as_os_str().encode_wide().chain(Some(0)).collect();
                        SetNamedSecurityInfoW(
                            PCWSTR(name.as_ptr()),
                            SE_FILE_OBJECT,
                            LABEL_SECURITY_INFORMATION,
                            None,
                            None,
                            None,
                            Some(acl),
                        )
                        .ok()
                        .map_err(|error| format!("sandbox_storage_label: {error}"))?;
                        let mut old_descriptor = PSECURITY_DESCRIPTOR::default();
                        let mut old_acl = std::ptr::null_mut::<ACL>();
                        GetNamedSecurityInfoW(
                            PCWSTR(name.as_ptr()),
                            SE_FILE_OBJECT,
                            DACL_SECURITY_INFORMATION,
                            None,
                            None,
                            Some(&mut old_acl),
                            None,
                            &mut old_descriptor,
                        )
                        .ok()
                        .map_err(|error| error.to_string())?;
                        let mut new_acl = std::ptr::null_mut::<ACL>();
                        let protected: Result<(), String> = (|| {
                            new_acl = self.read_only_acl(
                                old_acl,
                                owner_rights,
                                (FILE_GENERIC_READ | FILE_GENERIC_EXECUTE).0,
                                CONTAINER_INHERIT_ACE | OBJECT_INHERIT_ACE,
                            )?;
                            SetNamedSecurityInfoW(
                                PCWSTR(name.as_ptr()),
                                SE_FILE_OBJECT,
                                DACL_SECURITY_INFORMATION,
                                None,
                                None,
                                Some(new_acl),
                                None,
                            )
                            .ok()
                            .map_err(|error| format!("sandbox_storage_dacl: {error}"))
                        })();
                        if !new_acl.is_null() {
                            let _ = LocalFree(Some(HLOCAL(new_acl.cast())));
                        }
                        let _ = LocalFree(Some(HLOCAL(old_descriptor.0)));
                        protected?;
                    }
                    Ok(())
                })();
                let _ = LocalFree(Some(HLOCAL(descriptor.0)));
                let _ = LocalFree(Some(HLOCAL(owner_rights.0)));
                result?;
            }
            Ok(())
        }

        unsafe fn read_only_acl(
            &self,
            old: *const ACL,
            owner: PSID,
            access: u32,
            inherit: ACE_FLAGS,
        ) -> Result<*mut ACL, String> {
            if old.is_null() {
                return Err("sandbox_storage_dacl_missing".into());
            }
            let mut entries = [EXPLICIT_ACCESS_W::default(); 2];
            entries[0].grfAccessPermissions = access;
            entries[0].grfAccessMode = SET_ACCESS;
            entries[1].grfAccessPermissions = READ_CONTROL.0;
            entries[1].grfAccessMode = GRANT_ACCESS;
            for entry in &mut entries {
                entry.grfInheritance = inherit;
            }
            BuildTrusteeWithSidW(
                &mut entries[0].Trustee,
                Some(self.capabilities.AppContainerSid),
            );
            // OWNER RIGHTS suppresses implicit owner WRITE_DAC without removing broker grants.
            BuildTrusteeWithSidW(&mut entries[1].Trustee, Some(owner));
            let mut acl = std::ptr::null_mut();
            SetEntriesInAclW(Some(&entries), Some(old), &mut acl)
                .ok()
                .map_err(|error| error.to_string())?;
            Ok(acl)
        }

        pub(crate) fn seal_registry(&self, token: HANDLE) -> Result<(), String> {
            let raw = token.0 as usize;
            // Thread exit contains impersonation even if RevertToSelf fails.
            let key = std::thread::Builder::new()
                .name("plugin-registry".into())
                .spawn(move || unsafe {
                    ImpersonateLoggedOnUser(HANDLE(raw as *mut _))
                        .map_err(|error| format!("sandbox_registry_impersonation: {error}"))?;
                    let opened = GetAppContainerRegistryLocation(KEY_READ.0 | WRITE_DAC.0);
                    let reverted = RevertToSelf();
                    if let Err(error) = reverted {
                        if let Ok(key) = opened {
                            let _ = RegCloseKey(key);
                        }
                        return Err(format!("sandbox_registry_revert: {error}"));
                    }
                    opened
                        .map(|key| key.0 as usize)
                        .map_err(|error| format!("sandbox_registry_open: {error}"))
                })
                .map_err(|error| error.to_string())?
                .join()
                .map_err(|_| "Sandbox registry worker failed")??;
            let mut pending = vec![RegistryKey(HKEY(key as *mut _))];
            let mut count = 0;
            unsafe {
                let mut owner = PSID::default();
                let result: Result<(), String> = (|| {
                    ConvertStringSidToSidW(w!("S-1-3-4"), &mut owner)
                        .map_err(|error| error.to_string())?;
                    while let Some(key) = pending.pop() {
                        count += 1;
                        if count > 4096 {
                            return Err("sandbox_registry_limit".into());
                        }
                        let mut kind = REG_VALUE_TYPE(0);
                        let mut bytes = 0;
                        let queried = RegQueryValueExW(
                            key.0,
                            w!("SymbolicLinkValue"),
                            None,
                            Some(&mut kind),
                            None,
                            Some(&mut bytes),
                        );
                        if queried != ERROR_FILE_NOT_FOUND {
                            queried.ok().map_err(|error| error.to_string())?;
                            if kind == REG_LINK {
                                return Err("sandbox_registry_link".into());
                            }
                        }
                        let mut index = 0;
                        loop {
                            let mut name = [0u16; 256];
                            let mut length = name.len() as u32;
                            let enumerated = RegEnumKeyExW(
                                key.0,
                                index,
                                Some(PWSTR(name.as_mut_ptr())),
                                &mut length,
                                None,
                                None,
                                None,
                                None,
                            );
                            if enumerated == ERROR_NO_MORE_ITEMS {
                                break;
                            }
                            enumerated.ok().map_err(|error| error.to_string())?;
                            if length == 0
                                || length >= name.len() as u32
                                || pending.len() + count >= 4096
                            {
                                return Err("sandbox_registry_name_or_limit".into());
                            }
                            let mut child = HKEY::default();
                            RegOpenKeyExW(
                                key.0,
                                PCWSTR(name.as_ptr()),
                                Some(REG_OPTION_OPEN_LINK.0),
                                REG_SAM_FLAGS(KEY_READ.0 | WRITE_DAC.0),
                                &mut child,
                            )
                            .ok()
                            .map_err(|error| error.to_string())?;
                            pending.push(RegistryKey(child));
                            index += 1;
                        }
                        let mut descriptor = PSECURITY_DESCRIPTOR::default();
                        let mut old = std::ptr::null_mut::<ACL>();
                        let mut acl = std::ptr::null_mut::<ACL>();
                        let protected: Result<(), String> = (|| {
                            GetSecurityInfo(
                                HANDLE(key.0 .0),
                                SE_REGISTRY_KEY,
                                DACL_SECURITY_INFORMATION,
                                None,
                                None,
                                Some(&mut old),
                                None,
                                Some(&mut descriptor),
                            )
                            .ok()
                            .map_err(|error| error.to_string())?;
                            acl =
                                self.read_only_acl(old, owner, KEY_READ.0, CONTAINER_INHERIT_ACE)?;
                            SetSecurityInfo(
                                HANDLE(key.0 .0),
                                SE_REGISTRY_KEY,
                                DACL_SECURITY_INFORMATION,
                                None,
                                None,
                                Some(acl),
                                None,
                            )
                            .ok()
                            .map_err(|error| format!("sandbox_registry_dacl: {error}"))
                        })();
                        if !descriptor.0.is_null() {
                            let _ = LocalFree(Some(HLOCAL(descriptor.0)));
                        }
                        if !acl.is_null() {
                            let _ = LocalFree(Some(HLOCAL(acl.cast())));
                        }
                        protected?;
                    }
                    Ok(())
                })();
                if !owner.0.is_null() {
                    let _ = LocalFree(Some(HLOCAL(owner.0)));
                }
                result
            }
        }

        pub(crate) fn remove(&mut self) -> Result<(), String> {
            if self.name.is_empty() {
                return Ok(());
            }
            unsafe {
                DeleteAppContainerProfile(PCWSTR(self.name.as_ptr()))
                    .map_err(|error| format!("sandbox_cleanup: {error}"))?;
            }
            self.name.clear();
            Ok(())
        }
    }

    impl Drop for Sandbox {
        fn drop(&mut self) {
            if let Err(error) = self.remove() {
                eprintln!("{error}");
            }
            unsafe {
                FreeSid(self.capabilities.AppContainerSid);
            }
        }
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::Sandbox;
    use std::{
        fs,
        io::{Read, Write},
        net::TcpListener,
        path::PathBuf,
        time::{Duration, Instant},
    };

    fn run(
        executable: &std::path::Path,
        sandbox: Option<&Sandbox>,
        input: &serde_json::Value,
    ) -> serde_json::Value {
        let mut process =
            crate::spectral_process::Process::spawn(executable, &|| Ok(()), sandbox).unwrap();
        assert_eq!(process.is_app_container().unwrap(), sandbox.is_some());
        let (mut stdin, stdout, stderr) = process.take_pipes();
        stdin.write_all(input.to_string().as_bytes()).unwrap();
        drop(stdin);
        let out = std::thread::spawn(move || {
            let mut bytes = Vec::new();
            stdout.take(65537).read_to_end(&mut bytes).unwrap();
            bytes
        });
        let err = std::thread::spawn(move || {
            let mut bytes = Vec::new();
            stderr.take(65537).read_to_end(&mut bytes).unwrap();
            bytes
        });
        let deadline = Instant::now() + Duration::from_secs(10);
        let code = loop {
            if let Some(code) = process.exited().unwrap() {
                break Some(code);
            }
            if Instant::now() >= deadline {
                break None;
            }
            std::thread::sleep(Duration::from_millis(10));
        };
        process.kill_and_reap().unwrap();
        let output = out.join().unwrap();
        let errors = err.join().unwrap();
        assert_eq!(
            code,
            Some(0),
            "Bun failed: {} {}",
            String::from_utf8_lossy(&output),
            String::from_utf8_lossy(&errors)
        );
        assert!(output.len() <= 65536 && errors.len() <= 65536);
        let result: serde_json::Value = serde_json::from_slice(&output).unwrap();
        result
    }
    #[test]
    #[ignore = "Requires an explicitly compiled owned Bun sandbox candidate"]
    fn bun_package_cannot_access_host_resources() {
        let executable = PathBuf::from(
            std::env::var_os("INSOMNIUM_BUN_SANDBOX_EXE")
                .expect("Explicit owned Bun candidate required"),
        );
        let canary = executable.with_extension("private-canary");
        let write_target = executable.with_extension("forbidden-write");
        assert!(!canary.exists() && !write_target.exists());
        fs::write(&canary, b"sandbox-canary").unwrap();
        let peer = TcpListener::bind("127.0.0.1:0").unwrap();
        peer.set_nonblocking(true).unwrap();
        let mut sandbox = Sandbox::new(&executable).unwrap();
        fs::write(
            sandbox.directory.join("plugin.cjs"),
            "exports.templateTags=[{name:'bun',run(){return Buffer.from('bun-cjs').toString();}}];",
        )
        .unwrap();
        fs::write(sandbox.directory.join("plugin.mjs"), "await Promise.resolve();export const templateTags=[{name:'bun',async run(){await new Promise(resolve=>setTimeout(resolve,5));return 'bun-esm';}}];").unwrap();
        let directory = sandbox.directory.clone();
        let port = peer.local_addr().unwrap().port();
        let control = run(
            &executable,
            None,
            &serde_json::json!({"port":port,"networkOnly":true}),
        );
        assert_eq!(
            control["connected"], true,
            "Unsandboxed peer control must succeed: {control}"
        );
        drop(peer.accept().unwrap());
        let input = serde_json::json!({"canary":canary,"writeTarget":write_target,"port":port});
        let result = run(&sandbox.executable, Some(&sandbox), &input);
        sandbox.remove().unwrap();
        fs::remove_file(&canary).unwrap();
        assert_eq!(result["cjs"], "bun-cjs");
        assert_eq!(result["esm"], "bun-esm");
        for key in [
            "readDenied",
            "writeDenied",
            "networkDenied",
            "environmentEmpty",
        ] {
            assert_eq!(result[key], true, "{key}: {result}");
        }
        assert!(!write_target.exists());
        assert_eq!(
            peer.accept().unwrap_err().kind(),
            std::io::ErrorKind::WouldBlock
        );
        assert!(
            !directory.exists(),
            "AppContainer directory was not removed: {}",
            directory.display()
        );
    }
}
