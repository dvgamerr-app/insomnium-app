//! Darwin's descriptor-bound path query, isolated for both macOS target checks.
use std::{
    ffi::{c_char, c_int, OsString},
    fs::{self, File},
    io,
    os::{fd::AsRawFd, unix::ffi::OsStringExt},
    path::PathBuf,
};

// Darwin bsd/sys/fcntl.h and bsd/sys/{param,syslimits}.h.
const F_GETPATH: c_int = 50;
const MAXPATHLEN: usize = 1024;

unsafe extern "C" {
    fn fcntl(fd: c_int, command: c_int, ...) -> c_int;
}

pub(super) fn opened_path(file: &File) -> io::Result<PathBuf> {
    let mut buffer = [0u8; MAXPATHLEN];
    // File keeps this descriptor alive. F_GETPATH only writes the supplied
    // MAXPATHLEN buffer; it neither transfers ownership nor changes the offset.
    if unsafe {
        fcntl(
            file.as_raw_fd(),
            F_GETPATH,
            buffer.as_mut_ptr().cast::<c_char>(),
        )
    } == -1
    {
        return Err(io::Error::last_os_error());
    }
    let length = buffer
        .iter()
        .position(|byte| *byte == 0)
        .filter(|length| *length > 0)
        .ok_or_else(|| {
            io::Error::new(io::ErrorKind::InvalidData, "Invalid macOS descriptor path")
        })?;
    let path = PathBuf::from(OsString::from_vec(buffer[..length].to_vec()));
    if !path.is_absolute() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Nonabsolute macOS descriptor path",
        ));
    }
    // Match the selected folder/expected file's canonical path representation.
    fs::canonicalize(path)
}
