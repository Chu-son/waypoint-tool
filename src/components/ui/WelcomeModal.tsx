import { useState, useEffect } from "react";
import { Modal, ModalHeader, ModalContent } from "./common/Modal";
import { Button } from "./common/Button";
import { EmptyState } from "./common/EmptyState";
import { useAppStore } from "../../stores/appStore";
import { DialogAPI } from "../../api";
import { MousePointer2, Plus, FolderOpen, Clock, FileText } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { cn } from "../../utils/cn";

export interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const isInitialLaunch = useAppStore((state) => state.isInitialLaunch);
  const setIsInitialLaunch = useAppStore((state) => state.setIsInitialLaunch);
  const setWelcomeModalOpen = useAppStore((state) => state.setWelcomeModalOpen);
  const recentProjects = useAppStore((state) => state.recentProjects) || [];
  const resetProject = useAppStore((state) => state.resetProject);
  const loadProject = useAppStore((state) => state.loadProject);
  const loadProjectFromPath = useAppStore((state) => state.loadProjectFromPath);
  const isDirty = useAppStore((state) => state.isDirty);

  const [version, setVersion] = useState<string>("");

  useEffect(() => {
    getVersion()
      .then((v) => setVersion(v))
      .catch(() => setVersion(""));
  }, []);

  const confirmDiscardChanges = async (): Promise<boolean> => {
    if (!isDirty) return true;
    return await DialogAPI.ask(
      "未保存の変更があります。破棄して続行しますか？",
      {
        title: "未保存の変更の確認",
        kind: "warning",
      }
    );
  };

  const handleClose = () => {
    if (isInitialLaunch) return;
    setWelcomeModalOpen(false);
    onClose();
  };

  const handleNewProject = async () => {
    const ok = await confirmDiscardChanges();
    if (!ok) return;
    resetProject();
    setIsInitialLaunch(false);
    setWelcomeModalOpen(false);
  };

  const handleOpenProject = async () => {
    const ok = await confirmDiscardChanges();
    if (!ok) return;
    const loaded = await loadProject();
    if (loaded) {
      setIsInitialLaunch(false);
      setWelcomeModalOpen(false);
    }
  };

  const handleOpenRecent = async (path: string) => {
    const ok = await confirmDiscardChanges();
    if (!ok) return;
    const loaded = await loadProjectFromPath(path);
    if (loaded) {
      setIsInitialLaunch(false);
      setWelcomeModalOpen(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="2xl"
      className="max-h-[85vh] h-[520px] shadow-2xl border border-border-base"
    >
      <ModalHeader onClose={isInitialLaunch ? undefined : handleClose}>
        <div className="flex items-center gap-2">
          <MousePointer2
            size={18}
            className="text-primary-base rotate-45 transform fill-primary-base"
          />
          <span className="font-bold text-text-base">Waypoint Tool</span>
          {version && (
            <span className="text-xs text-text-muted font-mono font-normal ml-1">
              v{version}
            </span>
          )}
        </div>
      </ModalHeader>

      <ModalContent className="p-0 flex flex-1 overflow-hidden">
        {/* Left Pane: Actions */}
        <div className="w-64 bg-surface-panel/50 border-r border-border-base flex flex-col justify-between p-6 shrink-0">
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-text-base">ようこそ</h2>
              <p className="text-xs text-text-muted leading-relaxed">
                プロジェクトを新規作成するか、既存のプロジェクトを開いて作業を開始してください。
              </p>
            </div>

            <div className="space-y-2.5">
              <Button
                variant="primary"
                onClick={handleNewProject}
                className="w-full justify-start gap-2.5 h-11 px-4 text-sm font-semibold shadow-md shadow-primary-base/10"
              >
                <Plus size={18} />
                <span>新規プロジェクト</span>
              </Button>

              <Button
                variant="secondary"
                onClick={handleOpenProject}
                className="w-full justify-start gap-2.5 h-11 px-4 text-sm font-medium"
              >
                <FolderOpen size={18} />
                <span>プロジェクトを開く...</span>
              </Button>
            </div>
          </div>

          <div className="text-[11px] text-text-muted/60 text-center font-mono">
            ROS 2 Waypoint & Path Planning
          </div>
        </div>

        {/* Right Pane: Recent Projects */}
        <div className="flex-1 flex flex-col bg-surface-base/40 overflow-hidden">
          <div className="px-6 py-4 border-b border-border-base/50 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-text-base">
              <Clock size={15} className="text-text-muted" />
              <span>最近開いたプロジェクト</span>
            </div>
            {recentProjects.length > 0 && (
              <span className="text-xs text-text-muted">
                {recentProjects.length} 件
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {recentProjects.length === 0 ? (
              <div className="h-full flex items-center justify-center py-12">
                <EmptyState message="最近開いたプロジェクトの履歴はありません" />
              </div>
            ) : (
              recentProjects.map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleOpenRecent(item.path)}
                  className={cn(
                    "w-full text-left p-3.5 rounded-lg border border-border-base/40 bg-surface-panel/40 hover:bg-surface-hover hover:border-primary-base/40 transition-all flex items-start gap-3 group shadow-sm"
                  )}
                >
                  <div className="p-2 rounded bg-surface-base/60 text-text-muted group-hover:text-primary-base transition-colors shrink-0 mt-0.5">
                    <FileText size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-text-base group-hover:text-primary-base transition-colors truncate">
                      {item.name}
                    </div>
                    <div
                      className="text-xs text-text-muted truncate mt-0.5"
                      title={item.path}
                    >
                      {item.path}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
