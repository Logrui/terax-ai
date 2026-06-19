#![cfg(target_os = "windows")]

use std::{os::windows::ffi::OsStringExt, path::PathBuf};

use windows::{
    Win32::{
        Foundation::{
            CLASS_E_CLASSNOTAVAILABLE, E_FAIL, E_INVALIDARG, E_NOTIMPL, E_POINTER,
            ERROR_INSUFFICIENT_BUFFER, HINSTANCE, HMODULE, MAX_PATH,
        },
        System::{
            Com::{IBindCtx, IClassFactory, IClassFactory_Impl},
            LibraryLoader::GetModuleFileNameW,
            SystemServices::DLL_PROCESS_ATTACH,
        },
        UI::Shell::{
            ECF_DEFAULT, ECS_ENABLED, IEnumExplorerCommand, IExplorerCommand,
            IExplorerCommand_Impl, IShellItemArray, SHStrDupW, SIGDN_FILESYSPATH,
        },
    },
    core::{BOOL, GUID, HRESULT, HSTRING, Interface, Ref, Result, implement},
};

// Safety: written once in DllMain before any other exports are called.
static mut DLL_INSTANCE: HINSTANCE = HINSTANCE(std::ptr::null_mut());

#[unsafe(no_mangle)]
extern "system" fn DllMain(
    hinstdll: HINSTANCE,
    fdwreason: u32,
    _lpvreserved: *mut core::ffi::c_void,
) -> bool {
    if fdwreason == DLL_PROCESS_ATTACH {
        unsafe { DLL_INSTANCE = hinstdll };
    }
    true
}

// --- IExplorerCommand implementation ---

#[implement(IExplorerCommand)]
struct TeraxContextMenu;

#[allow(non_snake_case)]
impl IExplorerCommand_Impl for TeraxContextMenu_Impl {
    fn GetTitle(&self, _: Ref<IShellItemArray>) -> Result<windows_core::PWSTR> {
        unsafe { SHStrDupW(&HSTRING::from("Open in Terax")) }
    }

    fn GetIcon(&self, _: Ref<IShellItemArray>) -> Result<windows_core::PWSTR> {
        let Some(exe) = terax_exe_path() else {
            return Err(E_FAIL.into());
        };
        unsafe { SHStrDupW(&HSTRING::from(exe)) }
    }

    fn GetToolTip(&self, _: Ref<IShellItemArray>) -> Result<windows_core::PWSTR> {
        Err(E_NOTIMPL.into())
    }

    fn GetCanonicalName(&self) -> Result<windows_core::GUID> {
        Ok(GUID::zeroed())
    }

    fn GetState(&self, _: Ref<IShellItemArray>, _: BOOL) -> Result<u32> {
        Ok(ECS_ENABLED.0 as _)
    }

    fn Invoke(&self, psiitemarray: Ref<IShellItemArray>, _: Ref<IBindCtx>) -> Result<()> {
        let items = psiitemarray.ok()?;
        let Some(exe) = terax_exe_path() else {
            return Ok(());
        };
        let count = unsafe { items.GetCount()? };
        for idx in 0..count {
            let item = unsafe { items.GetItemAt(idx)? };
            let path = unsafe { item.GetDisplayName(SIGDN_FILESYSPATH)?.to_string()? };
            std::process::Command::new(&exe)
                .arg(&path)
                .spawn()
                .map_err(|_| E_INVALIDARG)?;
        }
        Ok(())
    }

    fn GetFlags(&self) -> Result<u32> {
        Ok(ECF_DEFAULT.0 as _)
    }

    fn EnumSubCommands(&self) -> Result<IEnumExplorerCommand> {
        Err(E_NOTIMPL.into())
    }
}

// --- IClassFactory implementation ---

#[implement(IClassFactory)]
struct TeraxContextMenuFactory;

impl IClassFactory_Impl for TeraxContextMenuFactory_Impl {
    fn CreateInstance(
        &self,
        punkouter: Ref<windows_core::IUnknown>,
        riid: *const windows_core::GUID,
        ppvobject: *mut *mut core::ffi::c_void,
    ) -> Result<()> {
        if ppvobject.is_null() || riid.is_null() {
            return Err(E_POINTER.into());
        }
        unsafe { *ppvobject = std::ptr::null_mut() };
        if punkouter.is_none() {
            let obj: IExplorerCommand = TeraxContextMenu {}.into();
            unsafe { obj.query(riid, ppvobject).ok() }
        } else {
            Err(E_INVALIDARG.into())
        }
    }

    fn LockServer(&self, _: BOOL) -> Result<()> {
        Ok(())
    }
}

// GUID generated for this COM class — must match AppxManifest.xml.
const MODULE_ID: GUID = GUID::from_u128(0x8b6e4c2a_1f3d_4e7b_9a5c_0d2e4f6a8b0c);

#[unsafe(no_mangle)]
extern "system" fn DllGetClassObject(
    class_id: *const GUID,
    iid: *const GUID,
    out: *mut *mut std::ffi::c_void,
) -> HRESULT {
    if out.is_null() || class_id.is_null() || iid.is_null() {
        return E_INVALIDARG;
    }
    unsafe { *out = std::ptr::null_mut() };

    let class_id = unsafe { *class_id };
    if class_id == MODULE_ID {
        let factory: IClassFactory = TeraxContextMenuFactory {}.into();
        unsafe { factory.query(iid, out) }
    } else {
        CLASS_E_CLASSNOTAVAILABLE
    }
}

// --- Path helpers ---

fn dll_dir() -> Option<PathBuf> {
    let mut buf = vec![0u16; MAX_PATH as usize];
    // Cast HINSTANCE to HMODULE — identical struct layout, both wrap *mut c_void.
    let hmod = HMODULE(unsafe { DLL_INSTANCE }.0);
    unsafe { GetModuleFileNameW(Some(hmod), &mut buf) };

    // Grow buffer if the path was truncated.
    while unsafe { windows::Win32::Foundation::GetLastError() } == ERROR_INSUFFICIENT_BUFFER {
        buf = vec![0u16; buf.len() * 2];
        unsafe { GetModuleFileNameW(Some(hmod), &mut buf) };
    }

    let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    let path = PathBuf::from(std::ffi::OsString::from_wide(&buf[..len]));
    // DLL is at $INSTDIR\terax_shell_ext.dll; one parent up is the install dir.
    path.parent().map(|p| p.to_path_buf())
}

fn terax_exe_path() -> Option<String> {
    dll_dir().map(|dir| dir.join("terax.exe").to_string_lossy().into_owned())
}
