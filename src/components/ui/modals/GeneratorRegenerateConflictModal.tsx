import { Modal, ModalHeader, ModalContent, ModalFooter } from "../common/Modal";
import { Button } from "../common/Button";
import { AlertBox } from "../common/AlertBox";
import { AlertTriangle, Undo2, Trash2, ArrowRight, ShieldCheck } from "lucide-react";
import { GeneratorModificationSummary } from "../../../types/store";

export interface GeneratorRegenerateConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: GeneratorModificationSummary;
  generatorName?: string;
  onDiscardAndRegenerate: () => void;
  onStashAndRegenerate: () => void;
}

export function GeneratorRegenerateConflictModal({
  isOpen,
  onClose,
  summary,
  generatorName,
  onDiscardAndRegenerate,
  onStashAndRegenerate,
}: GeneratorRegenerateConflictModalProps) {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader
        title="手動変更の検知 - 再生成の確認"
        icon={<AlertTriangle size={20} className="text-status-warning" />}
        onClose={onClose}
      />

      <ModalContent className="space-y-4">
        <AlertBox variant="warning" title="手動で編集されたウェイポイントが存在します">
          ジェネレーター「{generatorName || "Waypoint Generator"}」で生成されたウェイポイントのうち、
          <strong className="text-text-base mx-1">{summary.modifiedCount} 箇所</strong>
          で手動変更（位置、向き、オプション等）が検知されました。
          {summary.hasCountChanged && (
            <span className="block mt-1 text-xs text-status-warning/90">
              ※ 生成直後から子ウェイポイントの総数（現在 {summary.totalCurrent} 点 / 生成時 {summary.totalBaseline} 点）も変更されています。
            </span>
          )}
        </AlertBox>

        <p className="text-xs text-text-muted">
          再生成を実行する際の処理方法を選択してください。手動変更を差分として保持したい場合は「スタッシュして適用」を選択してください。
        </p>

        {/* 差分テーブル */}
        <div className="border border-border-base rounded-lg overflow-hidden bg-surface-base/40 max-h-52 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-hover/80 text-text-muted sticky top-0 border-b border-border-base select-none">
              <tr>
                <th className="py-2 px-3 font-semibold w-14">#</th>
                <th className="py-2 px-3 font-semibold">位置移動 (ΔX, ΔY)</th>
                <th className="py-2 px-3 font-semibold">向き変化 (ΔYaw)</th>
                <th className="py-2 px-3 font-semibold">その他 (Options / 名前)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-base/50 font-mono text-[11px]">
              {summary.diffs.map((diff) => {
                const deltaYawDeg = (diff.deltaYaw * 180) / Math.PI;
                const hasPosDiff =
                  Math.abs(diff.deltaX) > 1e-4 || Math.abs(diff.deltaY) > 1e-4;
                const hasYawDiff = Math.abs(diff.deltaYaw) > 1e-3;

                return (
                  <tr key={diff.index} className="hover:bg-surface-hover/40">
                    <td className="py-1.5 px-3 font-bold text-accent-generator">
                      #{diff.index + 1}
                    </td>
                    <td className="py-1.5 px-3">
                      {hasPosDiff ? (
                        <span className="text-text-base">
                          {diff.deltaX >= 0 ? "+" : ""}
                          {diff.deltaX.toFixed(3)}m, {diff.deltaY >= 0 ? "+" : ""}
                          {diff.deltaY.toFixed(3)}m
                        </span>
                      ) : (
                        <span className="text-text-muted/60">-</span>
                      )}
                    </td>
                    <td className="py-1.5 px-3">
                      {hasYawDiff ? (
                        <span className="text-text-base">
                          {deltaYawDeg >= 0 ? "+" : ""}
                          {deltaYawDeg.toFixed(1)}°
                        </span>
                      ) : (
                        <span className="text-text-muted/60">-</span>
                      )}
                    </td>
                    <td className="py-1.5 px-3">
                      {diff.customName ? (
                        <span className="text-accent-anchor mr-2">
                          名前: {diff.customName}
                        </span>
                      ) : null}
                      {diff.modifiedOptions &&
                      Object.keys(diff.modifiedOptions).length > 0 ? (
                        <span className="text-accent-automation">
                          Options ({Object.keys(diff.modifiedOptions).length}件)
                        </span>
                      ) : null}
                      {!diff.customName &&
                        (!diff.modifiedOptions ||
                          Object.keys(diff.modifiedOptions).length === 0) && (
                          <span className="text-text-muted/60">-</span>
                        )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ModalContent>

      <ModalFooter className="flex-col sm:flex-row gap-2 sm:gap-3 justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="order-3 sm:order-1 text-text-muted hover:text-text-base"
        >
          <Undo2 size={14} className="mr-1.5" />
          再生成を中断 (キャンセル)
        </Button>

        <div className="flex items-center gap-2 order-1 sm:order-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onDiscardAndRegenerate}
            className="text-danger-base hover:bg-danger-base/10 hover:text-danger-base border-danger-base/30"
          >
            <Trash2 size={14} className="mr-1.5" />
            編集を破棄して再生成
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onStashAndRegenerate}
            className="gap-1.5"
          >
            <ShieldCheck size={14} />
            スタッシュして適用
            <ArrowRight size={14} />
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
