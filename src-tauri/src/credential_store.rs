// Wrapper direto do Gerenciador de Credenciais do Windows.
//
// Não usamos a crate `keyring` aqui: sua implementação para Windows grava
// credenciais com `CRED_PERSIST_ENTERPRISE`, que exige perfil de roaming/
// domínio para persistir de fato. Numa máquina pessoal sem domínio (o caso
// comum), o `CredWriteW` retorna sucesso mas a credencial nunca é
// efetivamente salva — confirmado lendo o Gerenciador de Credenciais
// diretamente após um "salvamento" que a própria crate reportava como OK.
// `CRED_PERSIST_LOCAL_MACHINE` não tem essa exigência e funciona de forma
// confiável tanto em máquinas de domínio quanto pessoais.
use std::iter::once;
use std::mem::MaybeUninit;
use windows_sys::Win32::Foundation::{GetLastError, ERROR_NOT_FOUND, FILETIME};
use windows_sys::Win32::Security::Credentials::{
    CredDeleteW, CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_FLAGS,
    CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
};

fn to_wstr(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(once(0)).collect()
}

fn nome_alvo(servico: &str, usuario: &str) -> String {
    format!("{usuario}.{servico}")
}

pub fn salvar(servico: &str, usuario: &str, segredo: &str) -> Result<(), String> {
    let alvo = nome_alvo(servico, usuario);
    let mut alvo_w = to_wstr(&alvo);
    let mut usuario_w = to_wstr(usuario);
    let mut blob = segredo.as_bytes().to_vec();

    let mut credencial = CREDENTIALW {
        Flags: CRED_FLAGS::default(),
        Type: CRED_TYPE_GENERIC,
        TargetName: alvo_w.as_mut_ptr(),
        Comment: std::ptr::null_mut(),
        LastWritten: FILETIME {
            dwLowDateTime: 0,
            dwHighDateTime: 0,
        },
        CredentialBlobSize: blob.len() as u32,
        CredentialBlob: blob.as_mut_ptr(),
        Persist: CRED_PERSIST_LOCAL_MACHINE,
        AttributeCount: 0,
        Attributes: std::ptr::null_mut(),
        TargetAlias: std::ptr::null_mut(),
        UserName: usuario_w.as_mut_ptr(),
    };

    let ok = unsafe { CredWriteW(&mut credencial, 0) };
    if ok == 0 {
        return Err(format!(
            "CredWriteW falhou (código {})",
            unsafe { GetLastError() }
        ));
    }
    Ok(())
}

pub fn ler(servico: &str, usuario: &str) -> Result<String, String> {
    let alvo = nome_alvo(servico, usuario);
    let alvo_w = to_wstr(&alvo);
    let mut p_credencial: MaybeUninit<*mut CREDENTIALW> = MaybeUninit::uninit();

    let ok = unsafe {
        CredReadW(
            alvo_w.as_ptr(),
            CRED_TYPE_GENERIC,
            0,
            p_credencial.as_mut_ptr(),
        )
    };

    if ok == 0 {
        let erro = unsafe { GetLastError() };
        if erro == ERROR_NOT_FOUND {
            return Err("Nenhuma credencial encontrada".to_string());
        }
        return Err(format!("CredReadW falhou (código {erro})"));
    }

    let p_credencial = unsafe { p_credencial.assume_init() };
    let credencial = unsafe { *p_credencial };
    let bytes = unsafe {
        std::slice::from_raw_parts(credencial.CredentialBlob, credencial.CredentialBlobSize as usize)
    };
    let resultado = String::from_utf8(bytes.to_vec()).map_err(|e| e.to_string());
    unsafe { CredFree(p_credencial as *const _) };
    resultado
}

pub fn excluir(servico: &str, usuario: &str) -> Result<(), String> {
    let alvo = nome_alvo(servico, usuario);
    let alvo_w = to_wstr(&alvo);
    let ok = unsafe { CredDeleteW(alvo_w.as_ptr(), CRED_TYPE_GENERIC, 0) };
    if ok == 0 {
        let erro = unsafe { GetLastError() };
        if erro == ERROR_NOT_FOUND {
            return Ok(());
        }
        return Err(format!("CredDeleteW falhou (código {erro})"));
    }
    Ok(())
}
