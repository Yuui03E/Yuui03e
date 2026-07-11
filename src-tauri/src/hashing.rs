use std::fs::File;
use std::io::Read;
use std::path::Path;
use md4::{Md4, Digest};

const ED2K_CHUNK_SIZE: usize = 9_728_000; // 9500 KB

/// Computes the eDonkey2000 (ed2k) hash of a file.
/// If the file is smaller than or equal to ED2K_CHUNK_SIZE, the ed2k hash is the MD4 hash of the file.
/// If the file is larger, it is the MD4 hash of the concatenated MD4 hashes of all 9.728MB blocks.
pub fn compute_ed2k_hash<P: AsRef<Path>>(path: P) -> Result<String, String> {
    let mut file = File::open(path).map_err(|e| format!("failed to open file: {e}"))?;
    let mut buffer = vec![0u8; ED2K_CHUNK_SIZE];
    let mut chunk_hashes = Vec::new();

    loop {
        let n = file
            .read(&mut buffer)
            .map_err(|e| format!("failed to read file: {e}"))?;
        if n == 0 {
            break;
        }
        let mut hasher = Md4::new();
        hasher.update(&buffer[..n]);
        chunk_hashes.extend_from_slice(&hasher.finalize());
    }

    if chunk_hashes.is_empty() {
        // MD4 of empty string
        let hasher = Md4::new();
        let hash = hasher.finalize();
        Ok(hex_encode(&hash))
    } else if chunk_hashes.len() == 16 {
        // Exactly one chunk (each MD4 hash is 16 bytes)
        Ok(hex_encode(&chunk_hashes))
    } else {
        let mut hasher = Md4::new();
        hasher.update(&chunk_hashes);
        let hash = hasher.finalize();
        Ok(hex_encode(&hash))
    }
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}
