import type { PrescriptionDetail, PrescriptionItem } from '@veterinary-saas/contracts';

export type PrescriptionItemDraft = {
  id?: string;
  medicationName: string;
  presentation: string;
  quantity: string;
  dosage: string;
  frequency: string;
  duration: string;
  observations: string;
};

export type PrescriptionEditorState = {
  prescribedByMembershipId: string;
  items: PrescriptionItemDraft[];
  version: number | null;
};

export const EMPTY_PRESCRIPTION_ITEM: PrescriptionItemDraft = {
  medicationName: '',
  presentation: '',
  quantity: '',
  dosage: '',
  frequency: '',
  duration: '',
  observations: '',
};

function valueOrEmpty(value: string | null | undefined): string {
  return value ?? '';
}

// Draft state intentionally keeps optional clinical text as editable strings until submit.
export function itemDraftFromApi(item: PrescriptionItem): PrescriptionItemDraft {
  return {
    id: item.id,
    medicationName: item.medicationName,
    presentation: valueOrEmpty(item.presentation),
    quantity: valueOrEmpty(item.quantity),
    dosage: valueOrEmpty(item.dosage),
    frequency: valueOrEmpty(item.frequency),
    duration: valueOrEmpty(item.duration),
    observations: valueOrEmpty(item.observations),
  };
}

export function editorFromPrescription(prescription: PrescriptionDetail): PrescriptionEditorState {
  return {
    prescribedByMembershipId: prescription.prescribedByMembershipId ?? '',
    items: [...prescription.items]
      .sort((left, right) => left.position - right.position)
      .map(itemDraftFromApi),
    version: prescription.version,
  };
}

export function normalizedItems(items: PrescriptionItemDraft[]) {
  return items.map((item, position) => ({
    ...(item.id ? { id: item.id } : {}),
    position,
    medicationName: item.medicationName.trim(),
    presentation: item.presentation.trim() || null,
    quantity: item.quantity.trim() || null,
    dosage: item.dosage.trim() || null,
    frequency: item.frequency.trim() || null,
    duration: item.duration.trim() || null,
    observations: item.observations.trim() || null,
  }));
}

export function itemValidationErrors(items: PrescriptionItemDraft[]): Record<number, string> {
  return items.reduce<Record<number, string>>((errors, item, position) => {
    if (!item.medicationName.trim()) errors[position] = 'El nombre del medicamento es obligatorio.';
    return errors;
  }, {});
}

export function sameEditorState(left: PrescriptionEditorState, right: PrescriptionEditorState) {
  return JSON.stringify(left) === JSON.stringify(right);
}
