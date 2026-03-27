// Coloured badge displaying a reference label.
import type { Label } from '@/features/references/types/labels';
import { Badge } from '@/components/ui/badge';

export function LabelBadge({ label }: { label: Label }) {
  return (
    <Badge
      key={label.id}
      variant="outline"
      className="text-xs"
      style={{
        borderColor: label.color,
        color: label.color,
        backgroundColor: `${label.color}10`,
      }}
    >
      {label.name}
    </Badge>
  );
}
