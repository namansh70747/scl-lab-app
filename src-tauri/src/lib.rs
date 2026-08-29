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
        Migration {
            version: 8,
            description: "no_balance_due",
            sql: include_str!("../migrations/0008_no_balance_due.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "more_tests",
            sql: include_str!("../migrations/0009_more_tests.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "fix_ocb_choices",
            sql: include_str!("../migrations/0010_fix_ocb_choices.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "eag_decimals",
            sql: include_str!("../migrations/0011_eag_decimals.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "more_auto_calc",
            sql: include_str!("../migrations/0012_more_auto_calc.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "grandfather_setup",
            sql: include_str!("../migrations/0013_grandfather_setup.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "sharma_admin",
            sql: include_str!("../migrations/0014_sharma_admin.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "sharma_doctors",
            sql: include_str!("../migrations/0015_sharma_doctors.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 16,
            description: "fix_setup_and_sharma_text",
            sql: include_str!("../migrations/0016_fix_setup_and_sharma_text.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 17,
            description: "lipid_auto_and_interpretation",
            sql: include_str!("../migrations/0017_lipid_auto_and_interpretation.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 18,
            description: "exact_lipid_hba1c_text",
            sql: include_str!("../migrations/0018_exact_lipid_hba1c_text.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 19,
            description: "bun_auto",
            sql: include_str!("../migrations/0019_bun_auto.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 20,
            description: "glucose_interpretations",
            sql: include_str!("../migrations/0020_glucose_interpretations.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 21,
            description: "more_interpretations",
            sql: include_str!("../migrations/0021_more_interpretations.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 22,
            description: "soften_interpretations",
            sql: include_str!("../migrations/0022_soften_interpretations.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 23,
            description: "age_group_ranges",
            sql: include_str!("../migrations/0023_age_group_ranges.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 24,
            description: "complete_ranges",
            sql: include_str!("../migrations/0024_complete_ranges.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 25,
            description: "range_unit",
            sql: include_str!("../migrations/0025_range_unit.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 26,
            description: "typhidot",
            sql: include_str!("../migrations/0026_typhidot.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 27,
            description: "report_override",
            sql: include_str!("../migrations/0027_report_override.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 28,
            description: "urine_quantity",
            sql: include_str!("../migrations/0028_urine_quantity.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 29,
            description: "iggm_split",
            sql: include_str!("../migrations/0029_iggm_split.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 30,
            description: "widal_split",
            sql: include_str!("../migrations/0030_widal_split.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 31,
            description: "alp_ranges",
            sql: include_str!("../migrations/0031_alp_ranges.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 32,
            description: "rft_restructure",
            sql: include_str!("../migrations/0032_rft_restructure.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 33,
            description: "footer_settings",
            sql: include_str!("../migrations/0033_footer_settings.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 34,
            description: "elec_revert",
            sql: include_str!("../migrations/0034_elec_revert.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 35,
            description: "dlc_panel",
            sql: include_str!("../migrations/0035_dlc_panel.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 36,
            description: "cbc_units_order",
            sql: include_str!("../migrations/0036_cbc_units_order.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 37,
            description: "dlc_auto_calc",
            sql: include_str!("../migrations/0037_dlc_auto_calc.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 38,
            description: "dlc_remove_auto_calc",
            sql: include_str!("../migrations/0038_dlc_remove_auto_calc.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 39,
            description: "dlcp_bundle_test",
            sql: include_str!("../migrations/0039_dlcp_bundle_test.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 40,
            description: "order_unit_override",
            sql: include_str!("../migrations/0040_order_unit_override.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 41,
            description: "order_range_override",
            sql: include_str!("../migrations/0041_order_range_override.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 42,
            description: "urine_colour_range",
            sql: include_str!("../migrations/0042_urine_colour_range.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 43,
            description: "urine_hpf_ranges",
            sql: include_str!("../migrations/0043_urine_hpf_ranges.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 44,
            description: "haematology_spelling",
            sql: include_str!("../migrations/0044_haematology_spelling.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 45,
            description: "urine_plus_grading",
            sql: include_str!("../migrations/0045_urine_plus_grading.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 46,
            description: "paid_once_backfill",
            sql: include_str!("../migrations/0046_paid_once_backfill.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 47,
            description: "hba1c_profile",
            sql: include_str!("../migrations/0047_hba1c_profile.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 48,
            description: "haematology_spelling_fix",
            sql: include_str!("../migrations/0048_haematology_spelling_fix.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 49,
            description: "biochemistry_dup_tests",
            sql: include_str!("../migrations/0049_biochemistry_dup_tests.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 50,
            description: "patient_baby_flag",
            sql: include_str!("../migrations/0050_patient_baby_flag.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 51,
            description: "salmonella_profile",
            sql: include_str!("../migrations/0051_salmonella_profile.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 52,
            description: "stool_semen_panels",
            sql: include_str!("../migrations/0052_stool_semen_panels.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 53,
            description: "ptinr_bilirubin_widal_dengue_panels",
            sql: include_str!("../migrations/0053_ptinr_bilirubin_widal_dengue_panels.sql"),
            kind: MigrationKind::Up,
        },
    ];

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init());

    // Auto-update + self-relaunch are desktop-only (the plugins aren't built for mobile).
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    // Debug builds talk to a SEPARATE database file (see commands::db_file_name) so that
    // running `tauri dev` never migrates the production `scl.db` the packaged app uses —
    // which would leave an older installed build unable to open the now-newer DB.
    let db_url = format!("sqlite:{}", commands::db_file_name());
    builder
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(&db_url, migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::save_pdf,
            commands::reveal_in_folder,
            commands::open_path,
            commands::send_email,
            commands::backup_now,
            commands::restore_backup,
            commands::save_pdf_bytes,
            commands::send_sms,
            commands::serial_list_ports,
            commands::serial_read,
            commands::serial_read_b64,
            commands::tcp_capture,
            commands::tcp_capture_b64,
            commands::local_ips,
            commands::device_id,
            commands::trial_store_read,
            commands::trial_store_write,
            commands::whatsapp_send_document,
            commands::copy_file_to_clipboard,
            commands::copy_image_to_clipboard,
            commands::save_text_file,
            commands::app_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
