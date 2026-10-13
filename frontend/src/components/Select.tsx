import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export function Select({
  ariaLabel,
  ariaDescribedBy,
  className = '',
  value,
  options,
  onChange,
}: {
  ariaLabel: string;
  ariaDescribedBy?: string;
  className?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === selectedOption?.value),
  );
  const [highlightedIndex, setHighlightedIndex] = useState(selectedIndex);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        !(event.target instanceof Node) ||
        !buttonRef.current?.parentElement?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  const openMenu = () => {
    setHighlightedIndex(selectedIndex);
    setOpen(true);
  };

  const selectOption = (option: SelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-controls={`${id}-listbox`}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center justify-between rounded-[8px] border border-solid border-[#dbe3d6] bg-white px-[12px] py-[9px] pr-[36px] text-left text-[11px] text-[#315f46]"
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) {
              openMenu();
              return;
            }
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            setHighlightedIndex(
              (current) => (current + direction + options.length) % options.length,
            );
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!open) openMenu();
            else if (options[highlightedIndex]) selectOption(options[highlightedIndex]);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
      >
        <span>{selectedOption?.label}</span>
        <span className="pointer-events-none absolute top-1/2 right-[12px] -translate-y-1/2 rotate-90 text-[#315f46]">
          <Icon name="chevron" size={14} />
        </span>
      </button>
      {open && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-10 mt-[4px] max-h-[220px] w-full overflow-auto rounded-[8px] bg-white p-[4px] shadow-[0_8px_20px_rgba(38,54,47,0.12)]"
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              disabled={option.disabled}
              className={`w-full rounded-[5px] border-none bg-white px-[8px] py-[7px] text-left text-[11px] hover:bg-[#e9f0e1] active:bg-[#c4ccbc] ${
                option.value === value ? 'bg-[#ced2ca] text-[#315f46]' : 'text-[#5c6e54]'
              } ${index === highlightedIndex ? 'bg-[#b4bbad]' : ''}`}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => selectOption(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
