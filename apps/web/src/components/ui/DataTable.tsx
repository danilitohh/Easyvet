import type { ReactNode } from 'react';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';

export type DataTableColumn<Row> = {
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
};

type DataTableProps<Row> = {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
};

// DataTable is a deliberately small table base: columns, rows, loading and empty states.
export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  loading = false,
  emptyTitle = 'Sin resultados',
  emptyDescription = 'No hay registros para mostrar.',
  emptyAction,
}: DataTableProps<Row>) {
  if (loading) {
    return <LoadingState label="Cargando tabla" />;
  }

  if (rows.length === 0) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} icon="⌁" action={emptyAction} />
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
