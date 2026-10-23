import React from 'react';

export interface FilterChipOption {
  value: string;
  label: string;
}

export interface UserFilterChipsProps {
  options: FilterChipOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  style?: React.CSSProperties;
}

export const UserFilterChips: React.FC<UserFilterChipsProps> = ({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
  style = {},
}) => {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`user-filter-chips ${className}`.trim()}
      style={style}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(option.value)}
            className={`user-filter-chip user-pressable ${isSelected ? 'user-filter-chip--active' : ''}`.trim()}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};
