import React from 'react';
import * as LucideIcons from 'lucide-react';

interface DynamicIconProps {
  name?: string;
  size?: number;
  className?: string;
  fallback?: React.ReactNode;
}

export const DynamicIcon: React.FC<DynamicIconProps> = ({
  name,
  size = 16,
  className,
  fallback = null,
}) => {
  if (!name) return <>{fallback}</>;

  // Try exact match
  const IconComponent = (LucideIcons as Record<string, any>)[name];

  if (!IconComponent || (typeof IconComponent !== 'object' && typeof IconComponent !== 'function')) {
    return <>{fallback}</>;
  }

  const Component = IconComponent as React.ComponentType<{ size?: number; className?: string }>;
  return <Component size={size} className={className} />;
};
