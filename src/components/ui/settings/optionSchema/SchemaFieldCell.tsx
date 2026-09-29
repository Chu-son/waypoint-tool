import { FieldLabel } from '../../common/FieldLabel';
import { cn } from '../../../../utils/cn';

/** ラベル付きの1セル。スキーマエディタ内の各行で共通して使う。 */
export function SchemaFieldCell({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <FieldLabel className="ml-1">{label}</FieldLabel>
      {children}
    </div>
  );
}
