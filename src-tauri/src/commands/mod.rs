use std::path::{Path, PathBuf};

/// Write the given full HTML document next to `out_path` (with the extension
/// swapped to `.html`), creating parent directories as needed, and return the
/// path of the written `.html` file.
///
/// NOTE: The visual PDF for this app is produced by the FRONTEND via the
/// webview's print-to-PDF facility. This command intentionally does not
/// rasterize HTML in Rust (which would require a headless browser); it only
/// persists the HTML document that the frontend then prints.
#[tauri::command]
pub fn save_pdf(html: String, out_path: String) -> Result<String, String> {
    let out = PathBuf::from(&out_path);

    if let Some(parent) = out.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory {}: {e}", parent.display()))?;
        }
    }

    let html_path = out.with_extension("html");
    std::fs::write(&html_path, html)
        .map_err(|e| format!("Failed to write HTML file {}: {e}", html_path.display()))?;

    Ok(html_path.to_string_lossy().into_owned())
}

/// Reveal a file in the OS file manager.
#[tauri::command]
pub fn reveal_in_folder(path: String) -> Result<(), String> {
    use std::process::Command;

    #[cfg(target_os = "macos")]
    let result = Command::new("open").arg("-R").arg(&path).spawn();

    #[cfg(target_os = "windows")]
    let result = Command::new("explorer")
        .arg(format!("/select,{}", path))
        .spawn();

    #[cfg(target_os = "linux")]
    let result = {
        let parent = Path::new(&path)
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| PathBuf::from("."));
        Command::new("xdg-open").arg(parent).spawn()
    };

    result
        .map(|_| ())
        .map_err(|e| format!("Failed to reveal {path} in file manager: {e}"))
}

/// Send an email over SMTP (STARTTLS) with an optional PDF attachment.
#[tauri::command]
pub fn send_email(
    host: String,
    port: u16,
    username: String,
    password: String,
    to: String,
    subject: String,
    body_html: String,
    pdf_path: Option<String>,
) -> Result<(), String> {
    use lettre::message::{header, Attachment, MultiPart, SinglePart};
    use lettre::transport::smtp::authentication::Credentials;
    use lettre::transport::smtp::client::Tls;
    use lettre::transport::smtp::client::TlsParameters;
    use lettre::{Message, SmtpTransport, Transport};
    use std::time::Duration;

    let from_mbox = username
        .parse::<lettre::message::Mailbox>()
        .map_err(|e| format!("Invalid sender address '{username}': {e}"))?;
    let to_mbox = to
        .parse::<lettre::message::Mailbox>()
        .map_err(|e| format!("Invalid recipient address '{to}': {e}"))?;

    let html_part = SinglePart::builder()
        .header(header::ContentType::TEXT_HTML)
        .body(body_html);

    let builder = Message::builder()
        .from(from_mbox)
        .to(to_mbox)
        .subject(subject);

    let email = if let Some(ref p) = pdf_path {
        let bytes = std::fs::read(p)
            .map_err(|e| format!("Failed to read attachment {p}: {e}"))?;
        let filename = Path::new(p)
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| "attachment.pdf".to_string());
        let content_type = header::ContentType::parse("application/pdf")
            .map_err(|e| format!("Invalid content type: {e}"))?;
        let attachment = Attachment::new(filename).body(bytes, content_type);

        builder
            .multipart(MultiPart::mixed().singlepart(html_part).singlepart(attachment))
            .map_err(|e| format!("Failed to build email: {e}"))?
    } else {
        builder
            .singlepart(html_part)
            .map_err(|e| format!("Failed to build email: {e}"))?
    };

    let tls_parameters = TlsParameters::new(host.clone())
        .map_err(|e| format!("Failed to build TLS parameters: {e}"))?;

    let mailer = SmtpTransport::builder_dangerous(host.as_str())
        .port(port)
        .credentials(Credentials::new(username, password))
        .tls(Tls::Required(tls_parameters))
        .timeout(Some(Duration::from_secs(10)))
        .build();

    mailer
        .send(&email)
        .map(|_| ())
        .map_err(|e| format!("Failed to send email: {e}"))
}

/// Copy the sqlite db at `db_path` into one or two destination directories as
/// `scl-backup-YYYY-MM-DD.db`, pruning backups older than 30 days. Returns the
/// list of written backup paths.
#[tauri::command]
pub fn backup_now(
    db_path: String,
    dest1: String,
    dest2: Option<String>,
) -> Result<Vec<String>, String> {
    use chrono::Local;

    let src = Path::new(&db_path);
    if !src.exists() {
        return Err(format!("Database file not found: {db_path}"));
    }

    let date = Local::now().format("%Y-%m-%d").to_string();
    let file_name = format!("scl-backup-{date}.db");

    let mut written = Vec::new();

    let mut dests: Vec<String> = vec![dest1];
    if let Some(d2) = dest2 {
        dests.push(d2);
    }

    for dest in dests {
        let dest_dir = PathBuf::from(&dest);
        std::fs::create_dir_all(&dest_dir)
            .map_err(|e| format!("Failed to create backup directory {dest}: {e}"))?;

        let target = dest_dir.join(&file_name);
        std::fs::copy(src, &target)
            .map_err(|e| format!("Failed to copy backup to {}: {e}", target.display()))?;

        prune_old_backups(&dest_dir)
            .map_err(|e| format!("Failed to prune old backups in {dest}: {e}"))?;

        written.push(target.to_string_lossy().into_owned());
    }

    Ok(written)
}

/// Remove `scl-backup-*.db` files older than 30 days in `dir`.
fn prune_old_backups(dir: &Path) -> std::io::Result<()> {
    let cutoff = std::time::SystemTime::now()
        .checked_sub(std::time::Duration::from_secs(30 * 24 * 60 * 60))
        .unwrap_or(std::time::UNIX_EPOCH);

    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n,
            None => continue,
        };
        if !(name.starts_with("scl-backup-") && name.ends_with(".db")) {
            continue;
        }
        let modified = match entry.metadata().and_then(|m| m.modified()) {
            Ok(m) => m,
            Err(_) => continue,
        };
        if modified < cutoff {
            let _ = std::fs::remove_file(&path);
        }
    }
    Ok(())
}

/// Restore the live database from a chosen backup file. The current db is renamed
/// to `<db>.pre-restore` (kept as a safety net) and the backup is copied into place.
/// The app must be restarted afterwards so the SQL plugin reopens the swapped file.
#[tauri::command]
pub fn restore_backup(backup_path: String, db_path: String) -> Result<String, String> {
    let backup = Path::new(&backup_path);
    if !backup.exists() {
        return Err(format!("Backup file not found: {backup_path}"));
    }
    // Sanity check: a non-empty file beginning with the SQLite header magic.
    let header = std::fs::read(backup)
        .map_err(|e| format!("Cannot read backup {backup_path}: {e}"))?;
    if header.len() < 16 || &header[0..15] != b"SQLite format 3" {
        return Err("Selected file is not a valid SQLite database.".into());
    }

    let live = PathBuf::from(&db_path);
    if live.exists() {
        let safety = live.with_extension("db.pre-restore");
        std::fs::rename(&live, &safety)
            .map_err(|e| format!("Failed to set aside current database: {e}"))?;
    }
    std::fs::copy(backup, &live)
        .map_err(|e| format!("Failed to restore backup into place: {e}"))?;

    Ok("Restore complete. Please restart the app to load the restored data.".into())
}

/// Write a base64-encoded PDF (rendered in the webview) to disk, creating parent
/// directories. Returns the absolute path. Used for Save-PDF, the WhatsApp-semi
/// drag-attach flow, and as the email attachment source.
#[tauri::command]
pub fn save_pdf_bytes(base64_data: String, out_path: String) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let bytes = STANDARD
        .decode(base64_data.as_bytes())
        .map_err(|e| format!("Failed to decode PDF data: {e}"))?;
    let out = PathBuf::from(&out_path);
    if let Some(parent) = out.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create folder {}: {e}", parent.display()))?;
        }
    }
    std::fs::write(&out, bytes)
        .map_err(|e| format!("Failed to write PDF {}: {e}", out.display()))?;
    Ok(out.to_string_lossy().into_owned())
}

/// Send a transactional SMS through an Indian DLT gateway (Fast2SMS or MSG91).
/// `vars` are the ordered values for the DLT-approved template variables.
/// Returns the gateway's raw response on success so the UI can surface delivery ids.
#[tauri::command]
pub fn send_sms(
    provider: String,
    api_key: String,
    sender_id: String,
    dlt_template_id: String,
    phone: String,
    message: String,
    vars: Vec<String>,
) -> Result<String, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Could not start HTTP client: {e}"))?;

    let resp = match provider.as_str() {
        "fast2sms" => {
            // Fast2SMS DLT route: positional template variables joined by '|'.
            let variables_values = vars.join("|");
            client
                .get("https://www.fast2sms.com/dev/bulkV2")
                .header("authorization", api_key)
                .query(&[
                    ("route", "dlt"),
                    ("sender_id", sender_id.as_str()),
                    ("message", dlt_template_id.as_str()),
                    ("variables_values", variables_values.as_str()),
                    ("flash", "0"),
                    ("numbers", phone.as_str()),
                ])
                .send()
        }
        "msg91" => {
            // MSG91 v5 flow API: template variables sent as var1, var2, … on the recipient.
            let mut recipient = serde_json::Map::new();
            recipient.insert("mobiles".into(), serde_json::Value::String(format!("91{phone}")));
            for (i, v) in vars.iter().enumerate() {
                recipient.insert(format!("var{}", i + 1), serde_json::Value::String(v.clone()));
            }
            let body = serde_json::json!({
                "template_id": dlt_template_id,
                "sender": sender_id,
                "recipients": [serde_json::Value::Object(recipient)],
            });
            client
                .post("https://control.msg91.com/api/v5/flow/")
                .header("authkey", api_key)
                .header("Content-Type", "application/json")
                .json(&body)
                .send()
        }
        other => return Err(format!("Unknown SMS provider '{other}'. Use 'fast2sms' or 'msg91'.")),
    }
    .map_err(|e| format!("SMS request failed: {e}"))?;

    let status = resp.status();
    let text = resp.text().unwrap_or_default();
    let _ = &message; // included in the call for the delivery log; gateways echo status in `text`
    if !status.is_success() {
        return Err(format!("SMS gateway returned {status}: {text}"));
    }
    // Both gateways return HTTP 200 even for some logical errors — detect the common ones.
    let low = text.to_lowercase();
    if low.contains("\"return\":false") || low.contains("\"type\":\"error\"") {
        return Err(format!("SMS gateway rejected the request: {text}"));
    }
    Ok(text)
}

/// List the serial ports the OS can see, so staff can pick the one the CBC
/// analyzer (ERBA H360) is wired to.
#[tauri::command]
pub fn serial_list_ports() -> Result<Vec<String>, String> {
    let ports = serialport::available_ports().map_err(|e| format!("Could not list serial ports: {e}"))?;
    Ok(ports.into_iter().map(|p| p.port_name).collect())
}

/// Open the analyzer's serial port and read whatever it transmits within `window_ms`,
/// returning the raw text. The frontend parses it (ASTM) and shows the values for the
/// technician to confirm before they touch the patient's result — nothing is auto-saved.
#[tauri::command]
pub fn serial_read(port: String, baud: u32, window_ms: u64) -> Result<String, String> {
    use std::io::Read;
    let mut sp = serialport::new(&port, baud)
        .timeout(std::time::Duration::from_millis(400))
        .open()
        .map_err(|e| format!("Could not open {port} at {baud} baud: {e}"))?;

    let start = std::time::Instant::now();
    let window = std::time::Duration::from_millis(window_ms.clamp(500, 30_000));
    let mut acc: Vec<u8> = Vec::new();
    let mut buf = [0u8; 4096];
    let mut idle_after_data = 0u32;

    while start.elapsed() < window {
        match sp.read(&mut buf) {
            Ok(0) => {}
            Ok(n) => {
                acc.extend_from_slice(&buf[..n]);
                idle_after_data = 0;
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                // Once we've captured a message, a couple of idle reads means it's complete.
                if !acc.is_empty() {
                    idle_after_data += 1;
                    if idle_after_data >= 3 {
                        break;
                    }
                }
            }
            Err(e) => return Err(format!("Serial read error on {port}: {e}")),
        }
    }

    if acc.is_empty() {
        return Err("No data received from the analyzer. Check the cable, port and baud rate, then re-transmit the result from the machine.".into());
    }
    Ok(String::from_utf8_lossy(&acc).into_owned())
}

/// Read CBC results from the analyzer over the network (TCP/IP).
///
/// `mode = "listen"`: this PC acts as the host server — it binds `port` and waits for the
/// ERBA H360 to connect and push its result (the usual ERBA "Host Communication" setup,
/// where the analyzer is configured with this PC's IP + port).
/// `mode = "connect"`: this PC connects out to the analyzer at `host:port` and reads.
///
/// Returns the raw text; the frontend parses it (ASTM) and the technician confirms the
/// values before they are applied — nothing is auto-saved.
#[tauri::command]
pub fn tcp_capture(mode: String, host: String, port: u16, window_ms: u64) -> Result<String, String> {
    use std::io::Read;
    use std::net::{TcpListener, TcpStream, ToSocketAddrs};
    use std::time::{Duration, Instant};

    let window = Duration::from_millis(window_ms.clamp(1000, 60_000));
    let start = Instant::now();

    // Obtain a connected stream, honouring the overall window.
    let mut stream: TcpStream = if mode == "connect" {
        let addr = format!("{host}:{port}");
        let sock = addr
            .to_socket_addrs()
            .ok()
            .and_then(|mut it| it.next())
            .ok_or_else(|| format!("Invalid analyzer address '{addr}'"))?;
        TcpStream::connect_timeout(&sock, Duration::from_secs(5))
            .map_err(|e| format!("Could not connect to analyzer at {addr}: {e}"))?
    } else {
        let listener = TcpListener::bind(("0.0.0.0", port))
            .map_err(|e| format!("Could not listen on port {port}: {e}. Is another program using it?"))?;
        listener
            .set_nonblocking(true)
            .map_err(|e| format!("Socket setup failed: {e}"))?;
        loop {
            match listener.accept() {
                Ok((s, _addr)) => break s,
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    if start.elapsed() >= window {
                        return Err("No connection from the analyzer. On the H360, set Host Communication to this PC's IP and the same port, then re-transmit the result.".into());
                    }
                    std::thread::sleep(Duration::from_millis(150));
                }
                Err(e) => return Err(format!("Network accept error: {e}")),
            }
        }
    };

    stream
        .set_read_timeout(Some(Duration::from_millis(500)))
        .map_err(|e| format!("Socket setup failed: {e}"))?;

    let mut acc: Vec<u8> = Vec::new();
    let mut buf = [0u8; 8192];
    let mut idle_after_data = 0u32;
    while start.elapsed() < window {
        match stream.read(&mut buf) {
            Ok(0) => break, // peer closed — transmission complete
            Ok(n) => {
                acc.extend_from_slice(&buf[..n]);
                idle_after_data = 0;
            }
            Err(ref e)
                if e.kind() == std::io::ErrorKind::WouldBlock
                    || e.kind() == std::io::ErrorKind::TimedOut =>
            {
                if !acc.is_empty() {
                    idle_after_data += 1;
                    if idle_after_data >= 4 {
                        break;
                    }
                }
            }
            Err(e) => return Err(format!("Network read error: {e}")),
        }
    }

    if acc.is_empty() {
        return Err("Connected, but the analyzer sent no data. Re-transmit the result from the H360.".into());
    }
    Ok(String::from_utf8_lossy(&acc).into_owned())
}

/// Send the report PDF to a patient over the WhatsApp Business Cloud API.
/// Uploads the PDF as media, then sends it as a document message with a caption.
/// `to` must be the recipient in international format without '+' (e.g. 919876543210).
#[tauri::command]
pub fn whatsapp_send_document(
    token: String,
    phone_number_id: String,
    to: String,
    pdf_path: String,
    filename: String,
    caption: String,
    api_version: Option<String>,
) -> Result<String, String> {
    use reqwest::blocking::multipart;
    let ver = api_version.unwrap_or_else(|| "v21.0".to_string());
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Could not start HTTP client: {e}"))?;

    // 1) Upload the PDF as WhatsApp media.
    let part = multipart::Part::file(&pdf_path)
        .map_err(|e| format!("Cannot read PDF {pdf_path}: {e}"))?
        .mime_str("application/pdf")
        .map_err(|e| format!("Bad attachment type: {e}"))?;
    let form = multipart::Form::new()
        .text("messaging_product", "whatsapp")
        .part("file", part);
    let up = client
        .post(format!("https://graph.facebook.com/{ver}/{phone_number_id}/media"))
        .bearer_auth(&token)
        .multipart(form)
        .send()
        .map_err(|e| format!("WhatsApp media upload failed: {e}"))?;
    let up_status = up.status();
    let up_text = up.text().unwrap_or_default();
    if !up_status.is_success() {
        return Err(format!("WhatsApp media upload error {up_status}: {up_text}"));
    }
    let media_id = serde_json::from_str::<serde_json::Value>(&up_text)
        .ok()
        .and_then(|v| v.get("id").and_then(|x| x.as_str().map(|s| s.to_string())))
        .ok_or_else(|| format!("No media id returned by WhatsApp: {up_text}"))?;

    // 2) Send the document message.
    let body = serde_json::json!({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "document",
        "document": { "id": media_id, "filename": filename, "caption": caption }
    });
    let msg = client
        .post(format!("https://graph.facebook.com/{ver}/{phone_number_id}/messages"))
        .bearer_auth(&token)
        .json(&body)
        .send()
        .map_err(|e| format!("WhatsApp send failed: {e}"))?;
    let st = msg.status();
    let txt = msg.text().unwrap_or_default();
    if !st.is_success() {
        return Err(format!("WhatsApp send error {st}: {txt}"));
    }
    Ok(txt)
}

/// Put a FILE on the system clipboard (not its text) so the user can paste it straight
/// into WhatsApp Web/Desktop as an attachment. Used by the WhatsApp "paste & send" flow.
#[tauri::command]
pub fn copy_file_to_clipboard(path: String) -> Result<(), String> {
    use std::process::Command;

    #[cfg(target_os = "macos")]
    {
        let escaped = path.replace('\\', "\\\\").replace('"', "\\\"");
        let script = format!("set the clipboard to (POSIX file \"{escaped}\")");
        let out = Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .output()
            .map_err(|e| format!("Clipboard copy failed: {e}"))?;
        if !out.status.success() {
            return Err(format!("Clipboard copy failed: {}", String::from_utf8_lossy(&out.stderr)));
        }
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        let safe = path.replace('\'', "''");
        let out = Command::new("powershell")
            .args(["-NoProfile", "-Command", &format!("Set-Clipboard -LiteralPath '{safe}'")])
            .output()
            .map_err(|e| format!("Clipboard copy failed: {e}"))?;
        if !out.status.success() {
            return Err(format!("Clipboard copy failed: {}", String::from_utf8_lossy(&out.stderr)));
        }
        return Ok(());
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = path;
        Err("Copying a file to the clipboard is not supported on this OS.".into())
    }
}

/// Write a UTF-8 text file (e.g. a CSV export), creating parent directories. Returns the
/// absolute path. Used because the webview blocks the browser's anchor-download trick.
#[tauri::command]
pub fn save_text_file(content: String, out_path: String) -> Result<String, String> {
    let out = PathBuf::from(&out_path);
    if let Some(parent) = out.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create folder {}: {e}", parent.display()))?;
        }
    }
    std::fs::write(&out, content)
        .map_err(|e| format!("Failed to write {}: {e}", out.display()))?;
    Ok(out.to_string_lossy().into_owned())
}

/// Return the app's package version.
#[tauri::command]
pub fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
