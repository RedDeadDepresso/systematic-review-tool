// Multi-email chip input for the invitation form.
import React, { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Props {
  value: string[];
  onChange: (emails: string[]) => void;
}

const EmailChipsInput: React.FC<Props> = ({ value, onChange }) => {
  const [input, setInput] = useState('');

  const addEmail = (email: string) => {
    const clean = email.trim().toLowerCase();

    if (!clean) return;
    if (!/^[\w.-]+@([\w-]+\.)+[\w-]{2,}$/.test(clean)) return; // simple validation
    if (value.includes(clean)) return;

    onChange([...value, clean]);
    setInput('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEmail(input);
    }

    if (e.key === 'Backspace' && input === '') {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="border rounded-xl px-3 py-2 flex flex-wrap gap-2 cursor-text">
      {value.map((email) => (
        <span
          key={email}
          className="bg-muted text-muted-foregroundpx-3 py-1 rounded-full text-sm flex items-center"
        >
          {email}
          <button
            className="ml-2"
            onClick={() => onChange(value.filter((e) => e !== email))}
          >
            <X className="h-4 w-4" />
          </button>
        </span>
      ))}

      <Input
        className={cn('border-0 shadow-none p-0 m-0 h-auto flex-1')}
        placeholder="Type an email and press Enter"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
};

export default EmailChipsInput;
