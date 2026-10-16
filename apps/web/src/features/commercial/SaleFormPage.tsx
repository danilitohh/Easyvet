import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type {
  InventoryBatchSummary,
  InventoryItemSummary,
  SaleDetail,
  SaleItemType,
} from '@veterinary-saas/contracts';
import { ApiError } from '../../services/apiClient';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { Select } from '../../components/ui/Select';
import { TextInput } from '../../components/ui/TextInput';
import { agendaApi } from '../agenda/agendaApi';
import { inventoryApi } from '../inventory/inventoryApi';
import { ownersApi } from '../owners/ownersApi';
import { patientsApi } from '../patients/patientsApi';
import { useActiveOrganizationId } from '../shared/hooks';
import { commercialApi } from './commercialApi';
import { CommercialHeader } from './CommercialPrimitives';
import {
  calculateTotals,
  formatMoney,
  moneyUnits,
  quantityUnits,
  unitsToDecimal,
} from './commercialUtils';
import { useCommercialResource } from './useCommercialResource';
import { PaginationControls } from '../shared/ResourceFeedback';
import './commercial.css';

type SaleLineDraft = {
  itemType: SaleItemType;
  inventoryItemId: string;
  inventoryBatchId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
};

const blankLine = (): SaleLineDraft => ({
  itemType: 'SERVICE',
  inventoryItemId: '',
  inventoryBatchId: '',
  description: '',
  quantity: '1',
  unitPrice: '',
  discountAmount: '0',
});

function draftLines(sale: SaleDetail): SaleLineDraft[] {
  return sale.items.map((item) => ({
    itemType: item.itemType,
    inventoryItemId: item.inventoryItemId ?? '',
    inventoryBatchId: item.inventoryBatchId ?? '',
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discountAmount: item.discountAmount,
  }));
}

// Sale editor keeps product, customer, quantity and money state local to the active organization.
export function SaleFormPage() {
  const { saleId } = useParams();
  const isEdit = Boolean(saleId);
  const navigate = useNavigate();
  const organizationId = useActiveOrganizationId();
  const controller = useRef(new AbortController());
  const batchControllers = useRef(new Map<string, AbortController>());
  const [locationId, setLocationId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [ownerPage, setOwnerPage] = useState(1);
  const [patientPage, setPatientPage] = useState(1);
  const [selectedOwner, setSelectedOwner] = useState<{ id: string; label: string } | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; label: string } | null>(
    null,
  );
  const [lines, setLines] = useState<SaleLineDraft[]>([blankLine()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingSale, setLoadingSale] = useState(isEdit);
  const requestedBatches = useRef(new Set<string>());
  const locationsLoader = useCallback((signal: AbortSignal) => agendaApi.listLocations(signal), []);
  const ownerLoader = useCallback(
    (signal: AbortSignal) =>
      ownersApi.list(
        {
          page: ownerPage,
          pageSize: 20,
          status: 'ACTIVE',
          search: ownerSearch,
        },
        signal,
      ),
    [ownerPage, ownerSearch],
  );
  const patientLoader = useCallback(
    (signal: AbortSignal) =>
      patientsApi.list({
        page: patientPage,
        pageSize: 20,
        status: 'ACTIVE',
        search: patientSearch,
        signal,
      }),
    [patientPage, patientSearch],
  );
  const organizationLoader = useCallback(
    (signal: AbortSignal) => agendaApi.currentOrganization(signal),
    [],
  );
  const locationResource = useCommercialResource(locationsLoader);
  const ownerResource = useCommercialResource(ownerLoader);
  const patientResource = useCommercialResource(patientLoader);
  const organizationResource = useCommercialResource(organizationLoader);
  const stockLoader = useCallback(
    (signal: AbortSignal) =>
      locationId
        ? inventoryApi.stock(
            { page: 1, pageSize: 100, clinicLocationId: locationId, includeArchived: false },
            signal,
          )
        : Promise.resolve({
            data: [],
            pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
          }),
    [locationId],
  );
  const stockResource = useCommercialResource(stockLoader, Boolean(locationId));
  const existingLoader = useCallback(
    (signal: AbortSignal) =>
      saleId ? commercialApi.getSale(saleId, signal) : Promise.resolve(null),
    [saleId],
  );
  const saleResource = useCommercialResource(existingLoader, isEdit);
  const [batches, setBatches] = useState<Record<string, InventoryBatchSummary[]>>({});
  const [batchLoading, setBatchLoading] = useState<Record<string, boolean>>({});
  const owners = ownerResource.data?.data ?? [];
  const patients = patientResource.data?.data ?? [];
  const ownerPageCount = Math.max(1, ownerResource.data?.pagination.totalPages ?? 1);
  const patientPageCount = Math.max(1, patientResource.data?.pagination.totalPages ?? 1);
  const stock = stockResource.data?.data ?? [];
  const currency =
    saleResource.data?.currencyCode ?? organizationResource.data?.currencyCode ?? '—';
  const totals = useMemo(() => calculateTotals(lines), [lines]);

  useEffect(() => {
    controller.current.abort();
    controller.current = new AbortController();
    batchControllers.current.forEach((request) => request.abort());
    batchControllers.current.clear();
    requestedBatches.current.clear();
    setLocationId('');
    setOwnerId('');
    setPatientId('');
    setOwnerSearch('');
    setPatientSearch('');
    setOwnerPage(1);
    setPatientPage(1);
    setSelectedOwner(null);
    setSelectedPatient(null);
    setLines([blankLine()]);
    setError('');
  }, [organizationId]);

  useEffect(() => {
    batchControllers.current.forEach((request) => request.abort());
    batchControllers.current.clear();
    requestedBatches.current.clear();
    setBatches({});
  }, [locationId]);

  useEffect(() => {
    const sale = saleResource.data;
    if (!sale) return;
    if (sale.status !== 'DRAFT') {
      navigate(`/ventas/${sale.id}`, { replace: true });
      return;
    }
    setLocationId(sale.clinicLocationId);
    setOwnerId(sale.ownerId ?? '');
    setPatientId(sale.patientId ?? '');
    setSelectedOwner(
      sale.ownerId
        ? { id: sale.ownerId, label: sale.customerNameSnapshot ?? 'Propietario asociado' }
        : null,
    );
    setSelectedPatient(
      sale.patientId
        ? { id: sale.patientId, label: sale.patientNameSnapshot ?? 'Paciente asociado' }
        : null,
    );
    setLines(draftLines(sale));
    setLoadingSale(false);
  }, [navigate, saleResource.data]);

  useEffect(() => {
    if (!isEdit) setLoadingSale(false);
  }, [isEdit]);

  const loadBatches = useCallback(
    async (itemId: string) => {
      if (!itemId || !locationId || requestedBatches.current.has(itemId)) return;
      requestedBatches.current.add(itemId);
      const request = new AbortController();
      batchControllers.current.set(itemId, request);
      setBatchLoading((state) => ({ ...state, [itemId]: true }));
      try {
        const detail = await inventoryApi.itemStock(itemId, request.signal);
        const available = detail.batches.filter((batch) =>
          batch.locations.some(
            (location) =>
              location.clinicLocationId === locationId &&
              quantityUnits(location.stock) > 0n &&
              location.locationStatus === 'ACTIVE',
          ),
        );
        setBatches((state) => ({ ...state, [itemId]: available }));
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setBatches((state) => ({ ...state, [itemId]: [] }));
        requestedBatches.current.delete(itemId);
      } finally {
        setBatchLoading((state) => ({ ...state, [itemId]: false }));
        if (batchControllers.current.get(itemId) === request)
          batchControllers.current.delete(itemId);
      }
    },
    [locationId],
  );

  useEffect(() => {
    if (locationId)
      lines
        .filter((line) => line.itemType === 'PRODUCT' && line.inventoryItemId)
        .forEach((line) => void loadBatches(line.inventoryItemId));
  }, [lines, loadBatches, locationId]);

  function updateLine(index: number, patch: Partial<SaleLineDraft>) {
    setLines((current) =>
      current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!locationId) return setError('Selecciona una sede para continuar.');
    if (!lines.length || lines.some((line) => !quantityUnits(line.quantity)))
      return setError('Cada producto debe tener una cantidad mayor que cero.');
    if (totals.grandTotal < 0n) return setError('El descuento no puede superar el subtotal.');
    if (
      lines.some(
        (line) =>
          moneyUnits(line.discountAmount) >
          (BigInt(line.quantity.split('.')[0] || '0') === 0n ? 0n : lineSubtotalSafe(line)),
      )
    )
      return setError('Revisa los descuentos: ninguno puede superar el valor de su línea.');
    if (lines.some((line) => line.itemType !== 'PRODUCT' && !line.description.trim()))
      return setError('Escribe una descripción para cada servicio u otro concepto.');
    if (
      lines.some(
        (line) =>
          line.itemType === 'PRODUCT' &&
          (!line.inventoryItemId ||
            (stock.find((row) => row.item.id === line.inventoryItemId)?.item.lotTracking &&
              !line.inventoryBatchId)),
      )
    )
      return setError('Elige un producto y, cuando tenga control por lote, también su lote.');
    const insufficientStock = lines.some((line) => {
      if (line.itemType !== 'PRODUCT') return false;
      const item = stock.find((row) => row.item.id === line.inventoryItemId);
      const selectedBatch = batches[line.inventoryItemId]?.find(
        (batch) => batch.id === line.inventoryBatchId,
      );
      const available = item?.item.lotTracking
        ? selectedBatch?.locations.find((row) => row.clinicLocationId === locationId)?.stock
        : item?.stock;
      return available !== undefined && quantityUnits(line.quantity) > quantityUnits(available);
    });
    if (insufficientStock)
      return setError('La cantidad supera las existencias disponibles en esta sede.');
    if (lines.some((line) => !/^\d{1,16}(?:\.\d{1,4})?$/.test(line.unitPrice)))
      return setError('El precio debe ser un importe válido con hasta cuatro decimales.');
    setSaving(true);
    try {
      const payload = {
        clinicLocationId: locationId,
        ...(patientId ? { patientId } : ownerId ? { ownerId } : {}),
        items: lines.map((line) => ({
          itemType: line.itemType,
          ...(line.itemType === 'PRODUCT'
            ? {
                inventoryItemId: line.inventoryItemId,
                inventoryBatchId: line.inventoryBatchId || null,
              }
            : {}),
          ...(line.itemType !== 'PRODUCT' ? { description: line.description.trim() } : {}),
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountAmount: line.discountAmount || '0',
        })),
      };
      const result =
        isEdit && saleResource.data
          ? await commercialApi.updateSale(
              saleResource.data.id,
              { ...payload, expectedVersion: saleResource.data.version },
              controller.current.signal,
            )
          : await commercialApi.createSale(payload, controller.current.signal);
      navigate(`/ventas/${result.id}`);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      if (caught instanceof ApiError && caught.status === 409)
        setError(
          'El borrador cambió o la sede ya no está disponible. Recarga los datos antes de guardar.',
        );
      else
        setError(
          caught instanceof ApiError ? caught.message : 'No fue posible guardar el borrador.',
        );
    } finally {
      setSaving(false);
    }
  }

  function lineSubtotalSafe(line: SaleLineDraft): bigint {
    return calculateTotals([
      { quantity: line.quantity, unitPrice: line.unitPrice || '0', discountAmount: '0' },
    ]).subtotal;
  }

  if (
    (isEdit && (loadingSale || saleResource.loading)) ||
    locationResource.loading ||
    organizationResource.loading
  )
    return (
      <div className="page-stack">
        <CommercialHeader title="Editar borrador" description="Cargando los datos de la venta." />
        <p role="status">Cargando venta…</p>
      </div>
    );
  if (saleResource.error)
    return (
      <div className="page-stack">
        <CommercialHeader title="Editar borrador" description="No se pudo abrir la venta." />
        <p role="alert">La venta no existe o no está disponible en esta organización.</p>
        <Button as={Link} variant="secondary" to="/ventas">
          Volver a ventas
        </Button>
      </div>
    );

  return (
    <div className="page-stack commercial-page">
      <CommercialHeader
        title={isEdit ? 'Editar borrador' : 'Nueva venta'}
        description="Agrega productos de inventario o conceptos de servicio. El cobro y el descuento de stock ocurren juntos al completar la venta."
      />
      <form className="commercial-form" onSubmit={(event) => void submit(event)}>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <Card className="commercial-section">
          <h2>Datos de la venta</h2>
          <div className="form-grid form-grid--two">
            <label className="commercial-field">
              <span>
                Sede <i aria-hidden="true">*</i>
              </span>
              <Select
                required
                value={locationId}
                onChange={(event) => {
                  setLocationId(event.target.value);
                  setLines((current) => current.map((line) => ({ ...line, inventoryBatchId: '' })));
                }}
              >
                <option value="">Selecciona una sede</option>
                {(locationResource.data ?? [])
                  .filter((location) => location.status === 'ACTIVE')
                  .map((location) => (
                    <option value={location.id} key={location.id}>
                      {location.name}
                    </option>
                  ))}
              </Select>
            </label>
            <div className="commercial-field">
              <label htmlFor="sale-patient-select">Paciente (opcional)</label>
              <FormField label="Buscar paciente" htmlFor="sale-patient-search">
                <TextInput
                  id="sale-patient-search"
                  type="search"
                  placeholder="Nombre del paciente"
                  value={patientSearch}
                  onChange={(event) => {
                    setPatientSearch(event.target.value);
                    setPatientPage(1);
                  }}
                />
              </FormField>
              <Select
                id="sale-patient-select"
                aria-label="Paciente (opcional)"
                value={patientId}
                onChange={(event) => {
                  const selected = patients.find((patient) => patient.id === event.target.value);
                  const label = selected
                    ? `${selected.name} · ${selected.owner.firstName} ${selected.owner.lastName ?? ''}`.trim()
                    : '';
                  setPatientId(event.target.value);
                  setSelectedPatient(selected ? { id: selected.id, label } : null);
                  setOwnerId('');
                  setSelectedOwner(null);
                }}
              >
                <option value="">Sin paciente</option>
                {selectedPatient &&
                !patients.some((patient) => patient.id === selectedPatient.id) ? (
                  <option value={selectedPatient.id}>{selectedPatient.label}</option>
                ) : null}
                {patients.map((patient) => (
                  <option value={patient.id} key={patient.id}>
                    {patient.name} · {patient.owner.firstName} {patient.owner.lastName ?? ''}
                  </option>
                ))}
              </Select>
              <PaginationControls
                page={patientPage}
                totalPages={patientPageCount}
                onChange={setPatientPage}
                ariaLabel="Paginación de pacientes"
              />
              {patientResource.loading ? (
                <p role="status" aria-live="polite">
                  Buscando pacientes…
                </p>
              ) : patientResource.data ? (
                <p role="status" aria-live="polite">
                  {patientResource.data.pagination.total} pacientes encontrados; página{' '}
                  {patientPage} de {patientPageCount}.
                </p>
              ) : null}
            </div>
            {!patientId ? (
              <div className="commercial-field">
                <label htmlFor="sale-owner-select">Propietario (opcional)</label>
                <FormField label="Buscar propietario" htmlFor="sale-owner-search">
                  <TextInput
                    id="sale-owner-search"
                    type="search"
                    placeholder="Nombre, correo o documento"
                    value={ownerSearch}
                    onChange={(event) => {
                      setOwnerSearch(event.target.value);
                      setOwnerPage(1);
                    }}
                  />
                </FormField>
                <Select
                  id="sale-owner-select"
                  aria-label="Propietario (opcional)"
                  value={ownerId}
                  onChange={(event) => {
                    const selected = owners.find((owner) => owner.id === event.target.value);
                    const label = selected
                      ? `${selected.firstName} ${selected.lastName ?? ''}`.trim()
                      : '';
                    setOwnerId(event.target.value);
                    setSelectedOwner(selected ? { id: selected.id, label } : null);
                  }}
                >
                  <option value="">Consumidor final / sin propietario</option>
                  {selectedOwner && !owners.some((owner) => owner.id === selectedOwner.id) ? (
                    <option value={selectedOwner.id}>{selectedOwner.label}</option>
                  ) : null}
                  {owners.map((owner) => (
                    <option value={owner.id} key={owner.id}>
                      {owner.firstName} {owner.lastName ?? ''}
                    </option>
                  ))}
                </Select>
                <PaginationControls
                  page={ownerPage}
                  totalPages={ownerPageCount}
                  onChange={setOwnerPage}
                  ariaLabel="Paginación de propietarios"
                />
                {ownerResource.loading ? (
                  <p role="status" aria-live="polite">
                    Buscando propietarios…
                  </p>
                ) : ownerResource.data ? (
                  <p role="status" aria-live="polite">
                    {ownerResource.data.pagination.total} propietarios encontrados; página{' '}
                    {ownerPage} de {ownerPageCount}.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="commercial-hint">
                El propietario se obtiene del paciente seleccionado.
              </p>
            )}
          </div>
        </Card>
        <section className="commercial-lines" aria-label="Conceptos de la venta">
          <div className="commercial-section-heading">
            <div>
              <h2>Conceptos</h2>
              <p>Los importes se expresan en {currency}.</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setLines((current) => [...current, blankLine()])}
            >
              Agregar concepto
            </Button>
          </div>
          {lines.map((line, index) => {
            const selectedStock = stock.find((row) => row.item.id === line.inventoryItemId);
            const availableBatches = batches[line.inventoryItemId] ?? [];
            return (
              <Card className="commercial-line" key={`sale-line-${index}`}>
                <div className="commercial-line__top">
                  <h3>Concepto {index + 1}</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={lines.length === 1}
                    onClick={() =>
                      setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))
                    }
                  >
                    Quitar
                  </Button>
                </div>
                <div className="form-grid form-grid--three">
                  <label className="commercial-field">
                    <span>Tipo</span>
                    <Select
                      value={line.itemType}
                      onChange={(event) =>
                        updateLine(index, {
                          itemType: event.target.value as SaleItemType,
                          inventoryItemId: '',
                          inventoryBatchId: '',
                          description: '',
                        })
                      }
                    >
                      <option value="PRODUCT">Producto</option>
                      <option value="SERVICE">Servicio</option>
                      <option value="OTHER">Otro</option>
                    </Select>
                  </label>
                  {line.itemType === 'PRODUCT' ? (
                    <label className="commercial-field commercial-field--wide">
                      <span>Artículo de inventario</span>
                      <Select
                        value={line.inventoryItemId}
                        onChange={(event) => {
                          const id = event.target.value;
                          updateLine(index, {
                            inventoryItemId: id,
                            inventoryBatchId: '',
                            description: '',
                          });
                          void loadBatches(id);
                        }}
                      >
                        <option value="">Selecciona un producto</option>
                        {stock
                          .filter((row) => row.item.status === 'ACTIVE')
                          .map((row: InventoryItemSummary) => (
                            <option value={row.item.id} key={row.item.id}>
                              {row.item.name} · disponible {row.stock} {row.item.baseUnit}
                            </option>
                          ))}
                      </Select>
                      {stockResource.error ? (
                        <small role="alert">No se pudo cargar el inventario de esta sede.</small>
                      ) : null}
                    </label>
                  ) : (
                    <label className="commercial-field commercial-field--wide">
                      <span>Descripción</span>
                      <input
                        className="input"
                        required
                        maxLength={500}
                        value={line.description}
                        onChange={(event) => updateLine(index, { description: event.target.value })}
                      />
                    </label>
                  )}
                  {line.itemType === 'PRODUCT' && selectedStock?.item.lotTracking ? (
                    <label className="commercial-field commercial-field--wide">
                      <span>Lote</span>
                      <Select
                        required
                        value={line.inventoryBatchId}
                        onChange={(event) =>
                          updateLine(index, { inventoryBatchId: event.target.value })
                        }
                      >
                        <option value="">Selecciona el lote</option>
                        {availableBatches.map((batch) => (
                          <option value={batch.id} key={batch.id}>
                            {batch.lotNumber} · vence {batch.expiryOn ?? 'sin fecha'} ·{' '}
                            {batch.locations.find(
                              (location) => location.clinicLocationId === locationId,
                            )?.stock ?? '0'}{' '}
                            disponible
                          </option>
                        ))}
                      </Select>
                      {batchLoading[line.inventoryItemId] ? (
                        <small role="status">Cargando lotes…</small>
                      ) : null}
                    </label>
                  ) : null}
                  <label className="commercial-field">
                    <span>Cantidad</span>
                    <input
                      className="input"
                      required
                      inputMode="decimal"
                      pattern="[0-9]+([.][0-9]{1,6})?"
                      value={line.quantity}
                      onChange={(event) => updateLine(index, { quantity: event.target.value })}
                    />
                  </label>
                  <label className="commercial-field">
                    <span>Precio unitario · {currency}</span>
                    <input
                      className="input"
                      required
                      inputMode="decimal"
                      pattern="[0-9]+([.][0-9]{1,4})?"
                      value={line.unitPrice}
                      onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
                    />
                  </label>
                  <label className="commercial-field">
                    <span>Descuento · {currency}</span>
                    <input
                      className="input"
                      required
                      inputMode="decimal"
                      pattern="[0-9]+([.][0-9]{1,4})?"
                      value={line.discountAmount}
                      onChange={(event) =>
                        updateLine(index, { discountAmount: event.target.value })
                      }
                    />
                  </label>
                </div>
                <p className="commercial-line__total">
                  Subtotal de línea:{' '}
                  <strong>
                    {formatMoney(
                      unitsToDecimal(
                        lineSubtotalSafe(line) - moneyUnits(line.discountAmount || '0'),
                        4n,
                        false,
                      ),
                      currency,
                    )}
                  </strong>
                </p>
              </Card>
            );
          })}
        </section>
        <Card className="commercial-totals">
          <div>
            <span>Subtotal</span>
            <strong>{formatMoney(unitsToDecimal(totals.subtotal, 4n, false), currency)}</strong>
          </div>
          <div>
            <span>Descuentos</span>
            <strong>
              −{formatMoney(unitsToDecimal(totals.discountTotal, 4n, false), currency)}
            </strong>
          </div>
          <div className="commercial-grand-total">
            <span>Total a cobrar</span>
            <strong>{formatMoney(unitsToDecimal(totals.grandTotal, 4n, false), currency)}</strong>
          </div>
        </Card>
        <div className="commercial-actions">
          <Button as={Link} variant="secondary" to={isEdit ? `/ventas/${saleId}` : '/ventas'}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || stockResource.loading}>
            {saving ? 'Guardando…' : 'Guardar borrador'}
          </Button>
        </div>
      </form>
    </div>
  );
}
