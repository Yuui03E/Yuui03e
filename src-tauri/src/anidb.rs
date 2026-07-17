use std::net::UdpSocket;
use std::time::Duration;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AniDBMatch {
    pub aid: i64,
    pub eid: i64,
    pub gid: i64,
    pub episode: Option<u32>,
    pub group_name: Option<String>,
    pub anime_title: Option<String>,
}

pub struct AniDBClient {
    socket: UdpSocket,
    server: String,
    session: Option<String>,
    last_request: std::time::Instant,
}

impl AniDBClient {
    pub fn new() -> Result<Self, String> {
        let socket = UdpSocket::bind("0.0.0.0:0")
            .map_err(|e| format!("failed to bind UDP socket: {e}"))?;
        socket.set_read_timeout(Some(Duration::from_secs(4)))
            .map_err(|e| format!("failed to set read timeout: {e}"))?;
        
        Ok(Self {
            socket,
            server: "api.anidb.net:9000".to_string(),
            session: None,
            last_request: std::time::Instant::now() - Duration::from_secs(5),
        })
    }

    fn wait_rate_limit(&mut self) {
        let elapsed = self.last_request.elapsed();
        if elapsed < Duration::from_secs(2) {
            std::thread::sleep(Duration::from_secs(2) - elapsed);
        }
        self.last_request = std::time::Instant::now();
    }

    fn send_raw(&mut self, cmd: &str) -> Result<String, String> {
        self.wait_rate_limit();
        
        self.socket.send_to(cmd.as_bytes(), &self.server)
            .map_err(|e| format!("failed to send UDP packet: {e}"))?;
        
        let mut buf = [0u8; 2048];
        let (amt, _) = self.socket.recv_from(&mut buf)
            .map_err(|e| format!("failed to receive UDP packet (timeout?): {e}"))?;
        
        let resp = String::from_utf8_lossy(&buf[..amt]).to_string();
        Ok(resp)
    }

    pub fn login(&mut self, user: &str, pass: &str) -> Result<(), String> {
        if user.trim().is_empty() || pass.trim().is_empty() {
            return Err("AniDB credentials are empty".to_string());
        }
        
        let cmd = format!("AUTH user={user}&pass={pass}&protover=4&client=yuui&clientver=1");
        let resp = self.send_raw(&cmd)?;
        
        let parts: Vec<&str> = resp.split_whitespace().collect();
        if parts.is_empty() {
            return Err("AniDB auth returned empty response".to_string());
        }
        
        if parts[0] == "200" || parts[0] == "201" {
            if parts.len() > 1 {
                self.session = Some(parts[1].to_string());
                return Ok(());
            }
        }
        
        Err(format!("AniDB login failed: {}", resp.trim()))
    }

    pub fn lookup_file(&mut self, size: u64, ed2k: &str) -> Result<Option<AniDBMatch>, String> {
        let session = match &self.session {
            Some(s) => s,
            None => return Err("not logged in".to_string()),
        };

        // Query with fmask (fid, aid, eid, gid, state, size, ed2k, md5, sha1, crc32, color, group_name, group_short, epno)
        // and amask (english title, romaji title)
        let cmd = format!(
            "FILE size={size}&ed2k={ed2k}&s={session}&fmask=7ff0c800&amask=f0000000"
        );
        let resp = self.send_raw(&cmd)?;
        
        if resp.starts_with("320") {
            return Ok(None); // 320 NO SUCH FILE
        }
        
        if !resp.starts_with("220") {
            return Err(format!("AniDB query failed: {}", resp.trim()));
        }

        let lines: Vec<&str> = resp.split('\n').collect();
        if lines.len() < 2 {
            return Err("malformed FILE INFO response (no data line)".to_string());
        }
        
        let data_line = lines[1].trim();
        let fields: Vec<&str> = data_line.split('|').collect();
        
        if fields.len() < 4 {
            return Err(format!("malformed data line: {data_line}"));
        }

        let aid = fields.get(1).and_then(|s| s.parse::<i64>().ok()).unwrap_or(0);
        let eid = fields.get(2).and_then(|s| s.parse::<i64>().ok()).unwrap_or(0);
        let gid = fields.get(3).and_then(|s| s.parse::<i64>().ok()).unwrap_or(0);
        
        let group_name = fields.get(11).map(|s| s.to_string());
        let epno = fields.get(13).map(|s| s.to_string());
        let english_title = fields.get(14).map(|s| s.to_string());
        let romaji_title = fields.get(15).map(|s| s.to_string());
        
        let anime_title = english_title.or(romaji_title).filter(|s| !s.is_empty());
        let episode = epno.and_then(|s| s.parse::<u32>().ok());

        Ok(Some(AniDBMatch {
            aid,
            eid,
            gid,
            episode,
            group_name: group_name.filter(|s| !s.is_empty()),
            anime_title,
        }))
    }

    pub fn logout(&mut self) -> Result<(), String> {
        let session = match &self.session {
            Some(s) => s,
            None => return Ok(()),
        };
        let cmd = format!("LOGOUT s={session}");
        let _ = self.send_raw(&cmd);
        self.session = None;
        Ok(())
    }
}
