import { Input } from "./Input";
import { Button } from "./Button";
import { cn } from "../../../utils/cn";

interface BrowseInputProps {
  value: string;
  onChange?: (value: string) => void;
  onBrowseClick?: () => void;
  placeholder?: string;
  list?: string;
  dialogOptions?: {
    directory?: boolean;
    filters?: Array<{ name: string; extensions: string[] }>;
  };
  size?: "sm" | "md";
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
}

export function BrowseInput({
  value,
  onChange,
  onBrowseClick,
  placeholder,
  list,
  dialogOptions = { directory: false },
  size = "md",
  className,
  inputClassName,
  buttonClassName,
}: BrowseInputProps) {
  const handleBrowse = async () => {
    if (onBrowseClick) {
      onBrowseClick();
      return;
    }
    try {
      const { DialogAPI } = await import("../../../api");
      const selectedPath = await DialogAPI.open({
        multiple: false,
        directory: dialogOptions.directory,
        filters: dialogOptions.filters,
      });

      if (selectedPath) {
        const pathStr =
          typeof selectedPath === "string"
            ? selectedPath
            : (selectedPath as any).path;
        if (pathStr && onChange) {
          onChange(pathStr);
        }
      }
    } catch (err) {
      console.error("Browse failed:", err);
    }
  };

  const isSm = size === "sm";

  return (
    <div className={cn("flex gap-2 w-full", className)}>
      <Input
        type="text"
        list={list}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(isSm ? "h-7 text-xs" : "h-8 text-[13px]", inputClassName)}
        placeholder={placeholder}
      />
      <Button
        variant="secondary"
        onClick={handleBrowse}
        className={cn(
          isSm ? "h-7 px-2.5 text-xs" : "h-8 px-4 shrink-0 text-[13px]",
          buttonClassName
        )}
      >
        Browse
      </Button>
    </div>
  );
}
