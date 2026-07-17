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
    let mut read_buf = [0u8; 64 * 1024];
    let mut chunk_hashes = Vec::new();

    loop {
        let mut chunk_bytes_read = 0;
        let mut hasher = Md4::new();
        let mut chunk_has_data = false;

        while chunk_bytes_read < ED2K_CHUNK_SIZE {
            let limit = std::cmp::min(read_buf.len(), ED2K_CHUNK_SIZE - chunk_bytes_read);
            let n = file
                .read(&mut read_buf[..limit])
                .map_err(|e| format!("failed to read file: {e}"))?;
            if n == 0 {
                break;
            }
            hasher.update(&read_buf[..n]);
            chunk_bytes_read += n;
            chunk_has_data = true;
        }

        if !chunk_has_data {
            break;
        }

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

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_ed2k_hashing() {
        let path = "test_ed2k_hashing.tmp";
        {
            let mut f = File::create(path).unwrap();
            f.write_all(b"Hello World").unwrap();
        }
        
        let hash = compute_ed2k_hash(path).unwrap();
        std::fs::remove_file(path).ok();
        
        // Let's compute MD4 of "Hello World" directly to compare
        let mut hasher = Md4::new();
        hasher.update(b"Hello World");
        let expected = hex_encode(&hasher.finalize());
        
        assert_eq!(hash, expected);
    }
}
