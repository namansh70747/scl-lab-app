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

/// Return the app's package version.
#[tauri::command]
pub fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
