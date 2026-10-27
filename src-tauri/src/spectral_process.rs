//! Private pipe transport. Successful output never outlives its physical tree.
use crate::spectral::{OUTPUT_LIMIT, STDERR_LIMIT};
use crate::spectral_jobs::Token;
use std::{
    io::{Read, Write},
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};

fn read_bounded(
    mut reader: impl Read,
    limit: usize,
    exceeded: Arc<AtomicBool>,
    failed: Arc<AtomicBool>,
) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    let mut chunk = [0u8; 8192];
    loop {
        let n = reader.read(&mut chunk).map_err(|_| {
            failed.store(true, Ordering::SeqCst);
            "process"
        })?;
        if n == 0 {
            break;
        }
        if bytes.len().saturating_add(n) > limit {
            exceeded.store(true, Ordering::SeqCst);
        } else if !exceeded.load(Ordering::SeqCst) {
            bytes.extend_from_slice(&chunk[..n]);
        }
    }
    Ok(bytes)
}
pub(crate) fn execute(executable: &Path, input: Vec<u8>, token: &Token) -> Result<Vec<u8>, String> {
    token.check()?;
    let mut process = platform::Process::spawn(executable, &|| token.check(), None)?;
    let (stdin, stdout, stderr) = process.take_pipes();
    let exceeded = Arc::new(AtomicBool::new(false));
    let failed = Arc::new(AtomicBool::new(false));
    let writer_flag = failed.clone();
    // Pipe workers own no job state. Killing/reaping the tree closes all ends;
    // joining them is mandatory even when input, output, or deadline fails.
    let writer = std::thread::Builder::new()
        .name("spectral-stdin".into())
        .spawn(move || {
            let mut stdin = stdin;
            stdin.write_all(&input).map_err(|_| {
                writer_flag.store(true, Ordering::SeqCst);
                "process".to_string()
            })
        })
        .map_err(|_| "process".to_string())?;
    let output_flag = exceeded.clone();
    let output_failed = failed.clone();
    let output = match std::thread::Builder::new()
        .name("spectral-stdout".into())
        .spawn(move || read_bounded(stdout, OUTPUT_LIMIT, output_flag, output_failed))
    {
        Ok(worker) => worker,
        Err(_) => {
            process.kill_and_reap()?;
            let _ = writer.join();
            return Err("process".into());
        }
    };
    let stderr_flag = exceeded.clone();
    let stderr_failed = failed.clone();
    let errors = match std::thread::Builder::new()
        .name("spectral-stderr".into())
        .spawn(move || read_bounded(stderr, STDERR_LIMIT, stderr_flag, stderr_failed))
    {
        Ok(worker) => worker,
        Err(_) => {
            process.kill_and_reap()?;
            let _ = writer.join();
            let _ = output.join();
            return Err("process".into());
        }
    };
    let mut failure = None;
    loop {
        if let Err(code) = token.check() {
            failure = Some(code);
            break;
        }
        if exceeded.load(Ordering::SeqCst) {
            failure = Some("output_limit".into());
            break;
        }
        if failed.load(Ordering::SeqCst) {
            failure = Some("process".into());
            break;
        }
        match process.exited() {
            Ok(Some(code)) => {
                if code != 0 {
                    failure = Some("process".into());
                }
                break;
            }
            Ok(None) => {}
            Err(_) => {
                failure = Some("process".into());
                break;
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(5));
    }
    // Also retire custom-function descendants on ordinary root exit.
    while process.kill_and_reap().is_err() {
        // An OS cleanup failure is not permission to publish/retire this job.
        // Keep the owner and pipe workers until physical reaping succeeds.
        failure = Some("process".into());
        std::thread::sleep(std::time::Duration::from_millis(5));
    }
    let written = writer
        .join()
        .map_err(|_| "process".to_string())
        .and_then(|r| r);
    let output = output
        .join()
        .map_err(|_| "process".to_string())
        .and_then(|r| r);
    let stderr = errors
        .join()
        .map_err(|_| "process".to_string())
        .and_then(|r| r);
    token.check()?;
    if exceeded.load(Ordering::SeqCst) {
        return Err("output_limit".into());
    }
    if let Some(code) = failure {
        return Err(code);
    }
    written?;
    stderr?;
    output
}

#[cfg(windows)]
mod platform {
    use std::{
        fs::File,
        mem::{size_of, zeroed},
        os::windows::{ffi::OsStrExt, io::FromRawHandle},
        path::Path,
    };
    use windows::{
        core::{PCWSTR, PWSTR},
        Win32::{
            Foundation::*,
            Security::SECURITY_ATTRIBUTES,
            System::{JobObjects::*, Pipes::CreatePipe, Threading::*},
        },
    };
    struct Handle(HANDLE);
    impl Drop for Handle {
        fn drop(&mut self) {
            unsafe {
                let _ = CloseHandle(self.0);
            }
        }
    }
    struct Attributes {
        storage: Vec<usize>,
        list: LPPROC_THREAD_ATTRIBUTE_LIST,
    }
    impl Attributes {
        fn new(
            handles: &mut [HANDLE],
            sandbox: Option<&crate::plugin_sandbox::Sandbox>,
        ) -> Result<Self, String> {
            unsafe {
                let mut bytes = 0;
                let _ = InitializeProcThreadAttributeList(
                    None,
                    if sandbox.is_some() { 2 } else { 1 },
                    None,
                    &mut bytes,
                );
                if bytes == 0 {
                    return Err("process".into());
                }
                let mut storage = vec![0usize; bytes.div_ceil(size_of::<usize>())];
                let list = LPPROC_THREAD_ATTRIBUTE_LIST(storage.as_mut_ptr().cast());
                InitializeProcThreadAttributeList(
                    Some(list),
                    if sandbox.is_some() { 2 } else { 1 },
                    None,
                    &mut bytes,
                )
                .map_err(|_| "process")?;
                let result = Self { storage, list };
                UpdateProcThreadAttribute(
                    list,
                    0,
                    PROC_THREAD_ATTRIBUTE_HANDLE_LIST as usize,
                    Some(handles.as_ptr().cast()),
                    std::mem::size_of_val(handles),
                    None,
                    None,
                )
                .map_err(|_| "process")?;
                if let Some(sandbox) = sandbox {
                    UpdateProcThreadAttribute(
                        list,
                        0,
                        PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES as usize,
                        Some(
                            (&sandbox.capabilities
                                as *const windows::Win32::Security::SECURITY_CAPABILITIES)
                                .cast(),
                        ),
                        size_of::<windows::Win32::Security::SECURITY_CAPABILITIES>(),
                        None,
                        None,
                    )
                    .map_err(|_| "sandbox_attributes")?;
                }
                Ok(result)
            }
        }
    }
    impl Drop for Attributes {
        fn drop(&mut self) {
            unsafe {
                DeleteProcThreadAttributeList(self.list);
            }
            let _ = &self.storage;
        }
    }
    fn pipe() -> Result<(Handle, Handle), String> {
        unsafe {
            let attributes = SECURITY_ATTRIBUTES {
                nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
                lpSecurityDescriptor: std::ptr::null_mut(),
                bInheritHandle: true.into(),
            };
            let mut read = HANDLE::default();
            let mut write = HANDLE::default();
            CreatePipe(&mut read, &mut write, Some(&attributes), 0).map_err(|_| "process")?;
            Ok((Handle(read), Handle(write)))
        }
    }
    fn file(handle: Handle) -> File {
        let raw = handle.0 .0;
        std::mem::forget(handle);
        unsafe { File::from_raw_handle(raw) }
    }
    pub(crate) struct Process {
        root: Handle,
        job: Handle,
        pipes: Option<(File, File, File)>,
        sync_pipe: Option<(File, usize)>,
        reaped: bool,
        members: Vec<Member>,
        started: std::time::Instant,
    }
    struct Member {
        handle: Handle,
        pid: u32,
        created: u64,
    }
    #[repr(C)]
    struct ProcessIds {
        assigned: u32,
        listed: u32,
        // Limit-rejected associations can temporarily exceed the active limit.
        // This observation buffer does not alter ActiveProcessLimit (eight).
        ids: [usize; 16],
    }
    impl Process {
        pub(crate) fn spawn(
            path: &Path,
            check: &dyn Fn() -> Result<(), String>,
            sandbox: Option<&crate::plugin_sandbox::Sandbox>,
        ) -> Result<Self, String> {
            Self::spawn_inner(path, check, sandbox, false)
        }
        pub(crate) fn spawn_session(
            path: &Path,
            check: &dyn Fn() -> Result<(), String>,
            sandbox: &crate::plugin_sandbox::Sandbox,
        ) -> Result<Self, String> {
            Self::spawn_inner(path, check, Some(sandbox), true)
        }
        fn spawn_inner(
            path: &Path,
            check: &dyn Fn() -> Result<(), String>,
            sandbox: Option<&crate::plugin_sandbox::Sandbox>,
            synchronous: bool,
        ) -> Result<Self, String> {
            unsafe {
                let job = Handle(CreateJobObjectW(None, PCWSTR::null()).map_err(|_| "process")?);
                let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = zeroed();
                limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
                    | JOB_OBJECT_LIMIT_ACTIVE_PROCESS
                    | JOB_OBJECT_LIMIT_JOB_MEMORY;
                limits.BasicLimitInformation.ActiveProcessLimit =
                    if sandbox.is_some() { 1 } else { 8 };
                limits.JobMemoryLimit = if sandbox.is_some() { 128 } else { 512 } * 1024 * 1024;
                SetInformationJobObject(
                    job.0,
                    JobObjectExtendedLimitInformation,
                    (&limits as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
                    size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                )
                .map_err(|_| "process")?;
                let (child_in, parent_in) = pipe()?;
                let (parent_out, child_out) = pipe()?;
                let (parent_err, child_err) = pipe()?;
                let sync_pipe = if synchronous {
                    let (read, write) = pipe()?;
                    SetHandleInformation(write.0, HANDLE_FLAG_INHERIT.0, HANDLE_FLAGS(0))
                        .map_err(|_| "process")?;
                    Some((read, write))
                } else {
                    None
                };
                for handle in [&parent_in, &parent_out, &parent_err] {
                    SetHandleInformation(handle.0, HANDLE_FLAG_INHERIT.0, HANDLE_FLAGS(0))
                        .map_err(|_| "process")?;
                }
                let mut inherited = vec![child_in.0, child_out.0, child_err.0];
                if let Some((read, _)) = &sync_pipe {
                    inherited.push(read.0);
                }
                let attributes = Attributes::new(&mut inherited, sandbox)?;
                let mut startup: STARTUPINFOEXW = zeroed();
                startup.StartupInfo.cb = size_of::<STARTUPINFOEXW>() as u32;
                startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
                startup.StartupInfo.hStdInput = child_in.0;
                startup.StartupInfo.hStdOutput = child_out.0;
                startup.StartupInfo.hStdError = child_err.0;
                startup.lpAttributeList = attributes.list;
                let application: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
                let mut command: Vec<u16> = format!("\"{}\"", path.display())
                    .encode_utf16()
                    .chain(Some(0))
                    .collect();
                let cwd: Vec<u16> = path
                    .parent()
                    .ok_or("process")?
                    .as_os_str()
                    .encode_wide()
                    .chain(Some(0))
                    .collect();
                // Compiled Bun executables still honor ambient runtime options.
                // Keep OS/proxy settings, but never let them reinterpret this fixed
                // producer as Bun itself or inject an alternative module loader.
                let mut environment = Vec::<u16>::new();
                let mut variables = std::env::vars_os()
                    .filter(|(key, _)| {
                        if sandbox.is_some() {
                            return [
                                "SystemRoot",
                                "WINDIR",
                                "USERPROFILE",
                                "LOCALAPPDATA",
                                "APPDATA",
                                "ALLUSERSPROFILE",
                                "PROGRAMDATA",
                                "TEMP",
                                "TMP",
                            ]
                            .iter()
                            .any(|allowed| key.to_string_lossy().eq_ignore_ascii_case(allowed));
                        }
                        !["BUN_OPTIONS", "BUN_BE_BUN", "NODE_OPTIONS", "NODE_PATH"]
                            .iter()
                            .any(|blocked| key.to_string_lossy().eq_ignore_ascii_case(blocked))
                    })
                    .collect::<Vec<_>>();
                if sandbox.is_some() {
                    // Bun otherwise sizes I/O pools from host cores, exhausting the 128 MiB job on cold async I/O.
                    variables.push(("UV_THREADPOOL_SIZE".into(), "2".into()));
                    // Commit sparse pages as used and purge freed pages within the job budget.
                    variables.push(("MIMALLOC_PAGE_COMMIT_ON_DEMAND".into(), "1".into()));
                    variables.push(("MIMALLOC_PURGE_DELAY".into(), "0".into()));
                }
                variables.sort_by_key(|a| a.0.to_ascii_lowercase());
                for (key, value) in variables {
                    environment.extend(key.encode_wide());
                    environment.push(b'=' as u16);
                    environment.extend(value.encode_wide());
                    environment.push(0);
                }
                environment.push(0);
                check()?;
                let mut info: PROCESS_INFORMATION = zeroed();
                CreateProcessW(
                    PCWSTR(application.as_ptr()),
                    Some(PWSTR(command.as_mut_ptr())),
                    None,
                    None,
                    true,
                    CREATE_SUSPENDED
                        | CREATE_NO_WINDOW
                        | EXTENDED_STARTUPINFO_PRESENT
                        | CREATE_UNICODE_ENVIRONMENT,
                    Some(environment.as_ptr().cast()),
                    PCWSTR(cwd.as_ptr()),
                    &startup.StartupInfo,
                    &mut info,
                )
                .map_err(|error| {
                    if sandbox.is_some() {
                        format!("sandbox_create_process: {error}")
                    } else {
                        "process".into()
                    }
                })?;
                let root = Handle(info.hProcess);
                let thread = Handle(info.hThread);
                if AssignProcessToJobObject(job.0, root.0).is_err() {
                    let _ = TerminateProcess(root.0, 1);
                    let _ = WaitForSingleObject(root.0, INFINITE);
                    return Err("process".into());
                }
                let mut process = Self {
                    root,
                    job,
                    pipes: Some((file(parent_in), file(parent_out), file(parent_err))),
                    sync_pipe: sync_pipe.map(|(read, write)| (file(write), read.0 .0 as usize)),
                    reaped: false,
                    members: Vec::new(),
                    started: std::time::Instant::now(),
                };
                // No child code can execute before successful job assignment.
                if let Some(sandbox) = sandbox {
                    process.restrict_writes(sandbox)?;
                    sandbox.seal(check)?;
                }
                check()?;
                process.started = std::time::Instant::now();
                if ResumeThread(thread.0) == u32::MAX {
                    process.kill_and_reap()?;
                    return Err("process".into());
                }
                drop((child_in, child_out, child_err));
                Ok(process)
            }
        }
        pub(crate) fn started(&self) -> std::time::Instant {
            self.started
        }
        pub(crate) fn take_sync_pipe(&mut self) -> Result<(File, usize), String> {
            self.sync_pipe
                .take()
                .ok_or_else(|| "Bun synchronous pipe is unavailable".into())
        }
        fn restrict_writes(&self, sandbox: &crate::plugin_sandbox::Sandbox) -> Result<(), String> {
            use windows::Win32::Security::{
                CreateWellKnownSid, EqualSid, GetTokenInformation, SetTokenInformation,
                TokenIntegrityLevel, TokenMandatoryPolicy, WinUntrustedLabelSid, PSID,
                TOKEN_ADJUST_DEFAULT, TOKEN_DUPLICATE, TOKEN_MANDATORY_LABEL,
                TOKEN_MANDATORY_POLICY, TOKEN_MANDATORY_POLICY_NO_WRITE_UP, TOKEN_QUERY,
            };
            #[repr(C)]
            struct Integrity {
                label: TOKEN_MANDATORY_LABEL,
                sid: [u32; 17],
            }
            unsafe {
                let mut token = HANDLE::default();
                OpenProcessToken(
                    self.root.0,
                    TOKEN_QUERY | TOKEN_ADJUST_DEFAULT | TOKEN_DUPLICATE,
                    &mut token,
                )
                .map_err(|error| format!("sandbox_token: {error}"))?;
                let token = Handle(token);
                sandbox.seal_registry(token.0)?;
                let mut expected: Integrity = zeroed();
                let mut sid_bytes = std::mem::size_of_val(&expected.sid) as u32;
                let sid = PSID(expected.sid.as_mut_ptr().cast());
                CreateWellKnownSid(WinUntrustedLabelSid, None, Some(sid), &mut sid_bytes)
                    .map_err(|error| format!("sandbox_integrity_sid: {error}"))?;
                expected.label.Label.Sid = sid;
                const SE_GROUP_INTEGRITY: u32 = 0x20;
                expected.label.Label.Attributes = SE_GROUP_INTEGRITY;
                SetTokenInformation(
                    token.0,
                    TokenIntegrityLevel,
                    (&expected as *const Integrity).cast(),
                    size_of::<TOKEN_MANDATORY_LABEL>() as u32 + sid_bytes,
                )
                .map_err(|error| format!("sandbox_integrity: {error}"))?;
                let mut actual: Integrity = zeroed();
                let mut returned = 0;
                GetTokenInformation(
                    token.0,
                    TokenIntegrityLevel,
                    Some((&mut actual as *mut Integrity).cast()),
                    size_of::<Integrity>() as u32,
                    &mut returned,
                )
                .map_err(|error| format!("sandbox_integrity_query: {error}"))?;
                if returned < size_of::<TOKEN_MANDATORY_LABEL>() as u32
                    || returned > size_of::<Integrity>() as u32
                    || actual.label.Label.Sid.0.is_null()
                    || EqualSid(actual.label.Label.Sid, sid).is_err()
                {
                    return Err("sandbox_integrity_mismatch".into());
                }
                let mut policy = TOKEN_MANDATORY_POLICY::default();
                GetTokenInformation(
                    token.0,
                    TokenMandatoryPolicy,
                    Some((&mut policy as *mut TOKEN_MANDATORY_POLICY).cast()),
                    size_of::<TOKEN_MANDATORY_POLICY>() as u32,
                    &mut returned,
                )
                .map_err(|error| format!("sandbox_integrity_policy: {error}"))?;
                if returned != size_of::<TOKEN_MANDATORY_POLICY>() as u32
                    || policy.Policy.0 & TOKEN_MANDATORY_POLICY_NO_WRITE_UP.0 == 0
                {
                    return Err("sandbox_write_up_policy_missing".into());
                }
                Ok(())
            }
        }
        #[cfg(test)]
        pub(crate) fn is_app_container(&self) -> Result<bool, String> {
            use windows::Win32::Security::{GetTokenInformation, TokenIsAppContainer, TOKEN_QUERY};
            unsafe {
                let mut token = HANDLE::default();
                OpenProcessToken(self.root.0, TOKEN_QUERY, &mut token)
                    .map_err(|error| error.to_string())?;
                let token = Handle(token);
                let mut value = 0u32;
                let mut returned = 0;
                GetTokenInformation(
                    token.0,
                    TokenIsAppContainer,
                    Some((&mut value as *mut u32).cast()),
                    size_of::<u32>() as u32,
                    &mut returned,
                )
                .map_err(|error| error.to_string())?;
                if returned != size_of::<u32>() as u32 {
                    return Err("sandbox_token".into());
                }
                Ok(value == 1)
            }
        }
        #[cfg(any(test, debug_assertions))]
        pub(crate) fn peak_job_memory(&self) -> Result<usize, String> {
            unsafe {
                let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = zeroed();
                QueryInformationJobObject(
                    Some(self.job.0),
                    JobObjectExtendedLimitInformation,
                    (&mut info as *mut JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
                    size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                    None,
                )
                .map_err(|error| error.to_string())?;
                Ok(info.PeakJobMemoryUsed)
            }
        }
        pub(crate) fn take_pipes(&mut self) -> (File, File, File) {
            self.pipes.take().expect("owned pipe transfer")
        }
        pub(crate) fn cpu_time(&self) -> Result<std::time::Duration, String> {
            unsafe {
                let (mut created, mut exited, mut kernel, mut user) = (
                    FILETIME::default(),
                    FILETIME::default(),
                    FILETIME::default(),
                    FILETIME::default(),
                );
                GetProcessTimes(
                    self.root.0,
                    &mut created,
                    &mut exited,
                    &mut kernel,
                    &mut user,
                )
                .map_err(|error| error.to_string())?;
                let ticks = |value: FILETIME| {
                    ((value.dwHighDateTime as u64) << 32) | value.dwLowDateTime as u64
                };
                Ok(std::time::Duration::from_nanos(
                    ticks(kernel)
                        .saturating_add(ticks(user))
                        .saturating_mul(100),
                ))
            }
        }
        pub(crate) fn exited(&mut self) -> Result<Option<u32>, String> {
            self.capture_members()?;
            unsafe {
                match WaitForSingleObject(self.root.0, 0) {
                    WAIT_TIMEOUT => Ok(None),
                    WAIT_OBJECT_0 => {
                        let mut code = 0;
                        GetExitCodeProcess(self.root.0, &mut code).map_err(|_| "process")?;
                        Ok(Some(code))
                    }
                    _ => Err("process".into()),
                }
            }
        }
        pub(crate) fn kill_and_reap(&mut self) -> Result<(), String> {
            unsafe {
                if self.reaped {
                    return Ok(());
                }
                // Accounting can reach zero before a descendant process object
                // is signaled. Keep verified objects, never reopen a PID later.
                let captured = self.capture_members();
                TerminateJobObject(self.job.0, 1).map_err(|_| "process")?;
                if WaitForSingleObject(self.root.0, INFINITE) != WAIT_OBJECT_0 {
                    return Err("process".into());
                }
                loop {
                    let mut accounting: JOBOBJECT_BASIC_ACCOUNTING_INFORMATION = zeroed();
                    QueryInformationJobObject(
                        Some(self.job.0),
                        JobObjectBasicAccountingInformation,
                        (&mut accounting as *mut JOBOBJECT_BASIC_ACCOUNTING_INFORMATION).cast(),
                        size_of::<JOBOBJECT_BASIC_ACCOUNTING_INFORMATION>() as u32,
                        None,
                    )
                    .map_err(|_| "process")?;
                    if accounting.ActiveProcesses == 0 {
                        break;
                    }
                    std::thread::sleep(std::time::Duration::from_millis(5));
                }
                for member in &self.members {
                    if WaitForSingleObject(member.handle.0, INFINITE) != WAIT_OBJECT_0 {
                        return Err("process".into());
                    }
                }
                self.members.clear();
                self.reaped = true;
                captured
            }
        }
        fn capture_members(&mut self) -> Result<(), String> {
            unsafe {
                self.members
                    .retain(|member| WaitForSingleObject(member.handle.0, 0) != WAIT_OBJECT_0);
                let mut ids = ProcessIds {
                    assigned: 0,
                    listed: 0,
                    ids: [0; 16],
                };
                QueryInformationJobObject(
                    Some(self.job.0),
                    JobObjectBasicProcessIdList,
                    (&mut ids as *mut ProcessIds).cast(),
                    size_of::<ProcessIds>() as u32,
                    None,
                )
                .map_err(|_| "process")?;
                if ids.assigned > 16 || ids.listed > 16 {
                    return Err("process".into());
                }
                for pid in &ids.ids[..ids.listed as usize] {
                    let pid = u32::try_from(*pid).map_err(|_| "process")?;
                    if pid == GetProcessId(self.root.0) {
                        continue;
                    }
                    let opened = OpenProcess(
                        PROCESS_SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION,
                        false,
                        pid,
                    );
                    let handle = match opened {
                        Ok(handle) => Handle(handle),
                        Err(error)
                            if error.code()
                                == windows::core::HRESULT::from_win32(
                                    ERROR_INVALID_PARAMETER.0,
                                ) =>
                        {
                            continue
                        }
                        Err(_) => return Err("process".into()),
                    };
                    let mut member = windows::core::BOOL(0);
                    IsProcessInJob(handle.0, Some(self.job.0), &mut member)
                        .map_err(|_| "process")?;
                    if !member.as_bool() {
                        continue;
                    }
                    let (mut created, mut exited, mut kernel, mut user) = (
                        FILETIME::default(),
                        FILETIME::default(),
                        FILETIME::default(),
                        FILETIME::default(),
                    );
                    GetProcessTimes(handle.0, &mut created, &mut exited, &mut kernel, &mut user)
                        .map_err(|_| "process")?;
                    let created = (u64::from(created.dwHighDateTime) << 32)
                        | u64::from(created.dwLowDateTime);
                    if self
                        .members
                        .iter()
                        .any(|entry| entry.pid == pid && entry.created == created)
                    {
                        continue;
                    }
                    if WaitForSingleObject(handle.0, 0) == WAIT_OBJECT_0 {
                        continue;
                    }
                    // Retain up to sixteen observed objects (including briefly
                    // terminating/refused associations), without changing the
                    // eight-active-process limit. On overflow fail this run;
                    // unobserved fleeting births remain an explicit open gate.
                    if self.members.len() >= 16 {
                        return Err("process".into());
                    }
                    self.members.push(Member {
                        handle,
                        pid,
                        created,
                    });
                }
                Ok(())
            }
        }
    }
    impl Drop for Process {
        fn drop(&mut self) {
            while self.kill_and_reap().is_err() {
                std::thread::sleep(std::time::Duration::from_millis(5));
            }
        }
    }
}

// Unix process-group containment cannot contain a custom function that calls
// setsid. Refuse execution until stronger containment and physical descendant
// reaping are verified; never label root-only Child::wait as tree cleanup.
#[cfg(not(windows))]
mod platform {
    use std::{fs::File, path::Path};
    pub(crate) struct Process;
    impl Process {
        pub(crate) fn spawn(
            _: &Path,
            _: &dyn Fn() -> Result<(), String>,
            _: Option<&crate::plugin_sandbox::Sandbox>,
        ) -> Result<Self, String> {
            Err("process".into())
        }
        pub(crate) fn take_pipes(&mut self) -> (File, File, File) {
            unreachable!()
        }
        pub(crate) fn exited(&mut self) -> Result<Option<u32>, String> {
            Err("process".into())
        }
        pub(crate) fn kill_and_reap(&mut self) -> Result<(), String> {
            Ok(())
        }
    }
}

#[cfg(windows)]
pub(crate) use platform::Process;
