import React from "react";
import { Button } from "../common/Button";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../../../utils/cn";

interface PropertySectionHeaderProps {
  title: React.ReactNode;
  isVisible?: boolean;
  onToggleVisible?: () => void;
  toggleTitle?: string;
  className?: string;
}

export function PropertySectionHeader({
  title,
  isVisible,
  onToggleVisible,
  toggleTitle,
  className,
}: PropertySectionHeaderProps) {
  const hasToggle = isVisible !== undefined && onToggleVisible !== undefined;

  return (
    <div className={cn("flex justify-between items-center", className)}>
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5 w-full">
        {title}
      </h3>
      {hasToggle && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-text-muted hover:text-text-base shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisible();
          }}
          title={toggleTitle}
        >
          {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
        </Button>
      )}
    </div>
  );
}
