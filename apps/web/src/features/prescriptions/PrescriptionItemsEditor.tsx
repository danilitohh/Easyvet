import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { TextInput } from '../../components/ui/TextInput';
import type { PrescriptionItemDraft } from './prescriptionEditorUtils';

type PrescriptionItemsEditorProps = {
  items: PrescriptionItemDraft[];
  errors: Record<number, string>;
  disabled?: boolean;
  onChange: (items: PrescriptionItemDraft[]) => void;
};

const itemFields: Array<{
  key: keyof Omit<PrescriptionItemDraft, 'id' | 'medicationName'>;
  label: string;
  multiline?: boolean;
  maxLength: number;
}> = [
  { key: 'presentation', label: 'Presentación', maxLength: 500 },
  { key: 'quantity', label: 'Cantidad', maxLength: 200 },
  { key: 'dosage', label: 'Dosis', maxLength: 500 },
  { key: 'frequency', label: 'Frecuencia', maxLength: 500 },
  { key: 'duration', label: 'Duración', maxLength: 500 },
  { key: 'observations', label: 'Observaciones', maxLength: 2_000, multiline: true },
];

// This editor keeps the full item set local and normalizes positions only at submit time.
export function PrescriptionItemsEditor({
  items,
  errors,
  disabled = false,
  onChange,
}: PrescriptionItemsEditorProps) {
  function updateItem(index: number, field: keyof PrescriptionItemDraft, value: string) {
    onChange(
      items.map((item, currentIndex) =>
        currentIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  function addItem() {
    onChange([
      ...items,
      {
        medicationName: '',
        presentation: '',
        quantity: '',
        dosage: '',
        frequency: '',
        duration: '',
        observations: '',
      },
    ]);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, currentIndex) => currentIndex !== index));
  }

  function moveItem(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const next = [...items];
    const current = next[index];
    const target = next[targetIndex];
    if (!current || !target) return;
    next[index] = target;
    next[targetIndex] = current;
    onChange(next);
  }

  return (
    <div className="prescription-items-editor">
      {items.length === 0 ? (
        <div className="prescription-editor-empty" role="status">
          <strong>Aún no has agregado medicamentos.</strong>
          <p>Puedes guardar este borrador vacío y completarlo después.</p>
        </div>
      ) : null}
      {items.map((item, index) => (
        <fieldset className="prescription-editor-item" key={`${item.id ?? 'new'}-${index}`}>
          <legend>
            <span className="prescription-item__position" aria-label={`Item ${index + 1}`}>
              {index + 1}
            </span>
            Medicamento {index + 1}
          </legend>
          <div className="prescription-editor-item__actions">
            <Button
              type="button"
              variant="ghost"
              aria-label={`Mover medicamento ${index + 1} arriba`}
              disabled={disabled || index === 0}
              onClick={() => moveItem(index, -1)}
            >
              Mover arriba
            </Button>
            <Button
              type="button"
              variant="ghost"
              aria-label={`Mover medicamento ${index + 1} abajo`}
              disabled={disabled || index === items.length - 1}
              onClick={() => moveItem(index, 1)}
            >
              Mover abajo
            </Button>
            <Button
              type="button"
              variant="danger"
              aria-label={`Quitar medicamento ${index + 1}`}
              disabled={disabled}
              onClick={() => removeItem(index)}
            >
              Quitar
            </Button>
          </div>
          <FormField label="Medicamento *" htmlFor={`prescription-item-${index}-name`}>
            <TextInput
              id={`prescription-item-${index}-name`}
              value={item.medicationName}
              maxLength={500}
              required
              disabled={disabled}
              aria-invalid={Boolean(errors[index])}
              onChange={(event) => updateItem(index, 'medicationName', event.target.value)}
            />
            {errors[index] ? (
              <span className="field-error" role="alert">
                {errors[index]}
              </span>
            ) : null}
          </FormField>
          <div className="form-grid form-grid--two prescription-editor-item__fields">
            {itemFields.map((field) => (
              <FormField
                key={field.key}
                label={field.label}
                htmlFor={`prescription-item-${index}-${field.key}`}
              >
                {field.multiline ? (
                  <textarea
                    id={`prescription-item-${index}-${field.key}`}
                    className="input input--textarea"
                    value={item[field.key]}
                    maxLength={field.maxLength}
                    disabled={disabled}
                    onChange={(event) => updateItem(index, field.key, event.target.value)}
                  />
                ) : (
                  <TextInput
                    id={`prescription-item-${index}-${field.key}`}
                    value={item[field.key]}
                    maxLength={field.maxLength}
                    disabled={disabled}
                    onChange={(event) => updateItem(index, field.key, event.target.value)}
                  />
                )}
              </FormField>
            ))}
          </div>
        </fieldset>
      ))}
      <Button type="button" variant="secondary" disabled={disabled} onClick={addItem}>
        Agregar medicamento
      </Button>
    </div>
  );
}
