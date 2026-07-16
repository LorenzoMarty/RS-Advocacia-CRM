import { PETITION_STATUS_COLUMNS } from '../data';
import { normalizeText } from '../utils';

export const PETITION_DEFAULT_STATUS = PETITION_STATUS_COLUMNS[0].label;
export const PETITION_TYPE_OPTIONS = ['Petição', 'Contestação'];
export const PETITION_DEFAULT_TYPE = PETITION_TYPE_OPTIONS[0];

export function sortedUnique(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'pt-BR'));
}

export function petitionColumnKey(petition) {
  const status = normalizeText(petition.status);

  if (status.includes('protocolado')) {
    return 'protocolado';
  }

  if (status.includes('protocolar')) {
    return 'protocolar';
  }

  if (status.includes('andamento')) {
    return 'em_andamento';
  }

  return 'pendente';
}

export function petitionStatusLabel(petition) {
  return PETITION_STATUS_COLUMNS.find((column) => column.key === petitionColumnKey(petition))?.label
    || PETITION_DEFAULT_STATUS;
}
