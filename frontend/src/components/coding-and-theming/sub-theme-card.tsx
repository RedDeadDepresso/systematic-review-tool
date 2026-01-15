import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Plus, Minus } from 'lucide-react';
import type { SubTheme } from '@/types/sub-theme';
import type { Code } from '@/types/code';

interface SubThemeCardProps {
  subTheme: SubTheme;
  allCodes: Code[]; // all available codes
  onAddCode: (themeId: number, codeId: string) => void;
  onRemoveCode: (themeId: number, codeId: string) => void;
}

export function SubThemeCard({
  subTheme,
  allCodes,
  onAddCode,
  onRemoveCode,
}: SubThemeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');

  const filteredCodes = allCodes.filter(
    (code) =>
      !subTheme.codes.some((c) => c.id === code.id) &&
      (search === '' ||
        code.comment.text.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader
        className="flex flex-row items-center justify-between cursor-pointer"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <h3 className="text-base font-semibold">{subTheme.name}</h3>
        {expanded ? <ChevronDown /> : <ChevronRight />}
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* Existing codes */}
          <div className="space-y-2">
            {subTheme.codes.length === 0 && (
              <p className="text-sm text-muted-foreground">No codes yet</p>
            )}
            {subTheme.codes.map((code) => (
              <div
                key={code.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
              >
                <span className="text-sm">{code.comment.text}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    onRemoveCode(subTheme.id, code.id);
                    setSearch('');
                  }}
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Search + add */}
          <div className="space-y-2">
            <Input
              placeholder="Search codes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-40 overflow-y-auto rounded-lg border">
              {filteredCodes.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">
                  No matching codes
                </p>
              )}
              {filteredCodes.map((code) => (
                <div
                  key={code.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-accent"
                >
                  <span className="text-sm">{code.comment.text}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      onAddCode(subTheme.id, code.id);
                      setSearch('');
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
