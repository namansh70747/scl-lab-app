mod commands;

use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "init_schema",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "seed_data",
            sql: include_str!("../migrations/0002_seed.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "panel_bundles_and_orphan_cleanup",
            sql: include_str!("../migrations/0003_panels_fix.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "sms_channel_and_settings",
            sql: include_str!("../migrations/0004_sms.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "cbc_analyzer",
            sql: include_str!("../migrations/0005_analyzer.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "cbc_analyzer_network",
            sql: include_str!("../migrations/0006_analyzer_network.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "whatsapp_cloud_api",
            sql: include_str!("../migrations/0007_whatsapp_cloud.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:scl.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::save_pdf,
            commands::reveal_in_folder,
            commands::send_email,
            commands::backup_now,
            commands::restore_backup,
            commands::save_pdf_bytes,
            commands::send_sms,
            commands::serial_list_ports,
            commands::serial_read,
            commands::tcp_capture,
            commands::whatsapp_send_document,
            commands::copy_file_to_clipboard,
            commands::app_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
