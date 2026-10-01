/** 取り込み画面（種類ごとのパネル）が `ImportHubModal` から受け取る props。 */
export interface ImportPanelProps {
  /** モーダルごと閉じる。取り込みが済んだとき、またはキャンセルされたときに呼ぶ。 */
  onClose: () => void;
}
