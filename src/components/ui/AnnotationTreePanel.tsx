import { AnnotationTree } from './AnnotationTree';

export function AnnotationTreePanel() {
  return (
    <div className="flex-1 overflow-y-auto w-full flex flex-col p-3 bg-surface-base/10">
      <div className="space-y-2 flex flex-col flex-1">
        <AnnotationTree />
      </div>
    </div>
  );
}
