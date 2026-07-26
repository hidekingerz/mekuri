use std::sync::atomic::Ordering;

use tauri::State;

use crate::launch::LaunchState;

/// Finder のファイルオープン経由で起動されたかどうかを返す。
/// フロントはこれが true のときメインウィンドウの show() を抑制する。
#[tauri::command]
pub fn was_opened_via_file(state: State<'_, LaunchState>) -> bool {
    state.opened_via_file.load(Ordering::Relaxed)
}
