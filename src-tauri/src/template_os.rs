//! Legacy OS template values from libuv, without a JavaScript native runtime.
use libuv_sys2 as uv;
use serde_json::{json, Value};
use std::{ffi::CStr, mem::MaybeUninit, os::raw::c_char};

fn check(code: i32) -> Result<(), String> {
    if code == 0 {
        return Ok(());
    }
    // libuv returns a static, nul-terminated string for every error code.
    let message = unsafe { CStr::from_ptr(uv::uv_strerror(code)) };
    Err(format!(
        "Could not read OS template information: {}",
        message.to_string_lossy()
    ))
}

/// Caller guarantees a live, nul-terminated libuv string when non-null.
unsafe fn text(pointer: *const c_char) -> Option<String> {
    if pointer.is_null() {
        None
    } else {
        Some(CStr::from_ptr(pointer).to_string_lossy().into_owned())
    }
}

struct CpuInfo(*mut uv::uv_cpu_info_t, i32);
impl Drop for CpuInfo {
    fn drop(&mut self) {
        unsafe { uv::uv_free_cpu_info(self.0, self.1) };
    }
}

fn cpus() -> Result<Value, String> {
    let mut pointer = std::ptr::null_mut();
    let mut count = 0;
    // On failure libuv has already cleaned up. Match legacy os.cpus(): empty list.
    if unsafe { uv::uv_cpu_info(&mut pointer, &mut count) } != 0 {
        return Ok(json!([]));
    }
    let owned = CpuInfo(pointer, count);
    if !(0..=10000).contains(&count) {
        return Err("OS CPU count exceeds template limit".into());
    }
    if count == 0 {
        return Ok(json!([]));
    }
    if owned.0.is_null() {
        return Err("OS returned an invalid CPU list".into());
    }
    // Successful libuv allocation owns exactly count initialized records until Drop.
    let entries = unsafe { std::slice::from_raw_parts(owned.0, count as usize) };
    let values: Vec<Value> = entries
        .iter()
        .map(|cpu| {
            json!({
                "model": unsafe { text(cpu.model) }.unwrap_or_default(),
                "speed": cpu.speed,
                "times": {
                    "user": cpu.cpu_times.user, "nice": cpu.cpu_times.nice,
                    "sys": cpu.cpu_times.sys, "idle": cpu.cpu_times.idle,
                    "irq": cpu.cpu_times.irq
                }
            })
        })
        .collect();
    Ok(Value::Array(values))
}

struct UserInfo(uv::uv_passwd_t);
impl Drop for UserInfo {
    fn drop(&mut self) {
        unsafe { uv::uv_os_free_passwd(&mut self.0) };
    }
}

fn user_info() -> Result<Value, String> {
    let mut value = MaybeUninit::<uv::uv_passwd_t>::uninit();
    // Read fields and free allocated strings only after a successful initialization.
    check(unsafe { uv::uv_os_get_passwd(value.as_mut_ptr()) })?;
    let owned = UserInfo(unsafe { value.assume_init() });
    let pwd = &owned.0;
    Ok(json!({
        "uid": if cfg!(windows) { -1 } else { pwd.uid as i64 },
        "gid": if cfg!(windows) { -1 } else { pwd.gid as i64 },
        "username": unsafe { text(pwd.username) },
        "homedir": unsafe { text(pwd.homedir) },
        "shell": unsafe { text(pwd.shell) }
    }))
}

pub fn read_os(function: &str) -> Result<Value, String> {
    match function {
        "arch" => Ok(json!(match std::env::consts::ARCH {
            "x86_64" => "x64",
            "x86" => "ia32",
            "aarch64" => "arm64",
            "powerpc" => "ppc",
            "powerpc64" => "ppc64",
            "loongarch64" => "loong64",
            other => other,
        })),
        "platform" => Ok(json!(match std::env::consts::OS {
            "windows" => "win32",
            "macos" => "darwin",
            "solaris" => "sunos",
            other => other,
        })),
        "freemem" => Ok(json!(unsafe { uv::uv_get_free_memory() })),
        "hostname" => {
            let mut buffer = vec![0 as c_char; uv::UV_MAXHOSTNAMESIZE as usize];
            let mut length = buffer.len();
            check(unsafe { uv::uv_os_gethostname(buffer.as_mut_ptr(), &mut length) })?;
            Ok(json!(unsafe { text(buffer.as_ptr()) }.unwrap_or_default()))
        }
        "release" => {
            let mut value = MaybeUninit::<uv::uv_utsname_t>::uninit();
            check(unsafe { uv::uv_os_uname(value.as_mut_ptr()) })?;
            let value = unsafe { value.assume_init() };
            Ok(json!(
                unsafe { text(value.release.as_ptr()) }.unwrap_or_default()
            ))
        }
        "cpus" => cpus(),
        "userInfo" => user_info(),
        _ => Err("Unknown OS template function".into()),
    }
}
