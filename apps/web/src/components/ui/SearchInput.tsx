import { TextInput } from './TextInput';

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
};

// SearchInput is intentionally controlled so route modules can own filtering state.
export function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar',
  id,
  ariaLabel,
}: SearchInputProps) {
  return (
    <div className="search-input">
      <span className="search-input__icon" aria-hidden="true" />
      <TextInput
        id={id}
        type="search"
        value={value}
        aria-label={ariaLabel ?? placeholder}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
