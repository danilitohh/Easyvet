import { TextInput } from './TextInput';

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

// SearchInput is intentionally controlled so route modules can own filtering state.
export function SearchInput({ value, onChange, placeholder = 'Buscar' }: SearchInputProps) {
  return (
    <label className="search-input">
      <span className="sr-only">Buscar</span>
      <span className="search-input__icon" aria-hidden="true" />
      <TextInput
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
