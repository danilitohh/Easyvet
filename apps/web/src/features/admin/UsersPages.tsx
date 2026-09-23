import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { MembershipResponse } from '@veterinary-saas/contracts';
import type { CreateStaffRequest, UpdateMembershipRequest } from '@veterinary-saas/contracts';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { TextInput } from '../../components/ui/TextInput';
import { useCan } from '../../auth/useCan';
import { PERMISSION } from '../../auth/permissions';
import { useAuth } from '../../contexts/useAuth';
import { ApiError } from '../../services/apiClient';
import { adminApi } from './adminApi';
import './admin.css';

const ROLE_OPTIONS = [
  ['OWNER', 'Propietario'],
  ['ADMIN', 'Administrador'],
  ['VETERINARIAN', 'Veterinario'],
  ['ASSISTANT', 'Asistente'],
  ['RECEPTION', 'Recepción'],
  ['GROOMER', 'Peluquero'],
  ['CASHIER', 'Caja'],
] as const;

const CLINICAL_ROLE_OPTIONS = [
  ['', 'Sin rol clínico'],
  ['PRACTITIONER', 'Profesional clínico'],
  ['CLINICAL_ASSISTANT', 'Asistente clínico'],
] as const;

function roleLabel(role: string) {
  return ROLE_OPTIONS.find(([value]) => value === role)?.[1] ?? role;
}

function clinicalRoleLabel(role: string | null) {
  return CLINICAL_ROLE_OPTIONS.find(([value]) => value === (role ?? ''))?.[1] ?? '—';
}

function memberError(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback;
  if (error.code === 'MEMBERSHIP_ALREADY_EXISTS')
    return 'Esta persona ya pertenece a la organización.';
  if (error.code === 'USER_GLOBAL_SUSPENDED')
    return 'La cuenta no puede añadirse porque no está habilitada para iniciar sesión.';
  if (error.code === 'LAST_ACTIVE_OWNER_REQUIRED')
    return 'Debe permanecer al menos un propietario activo en la organización.';
  if (error.code === 'OWNER_PERMISSION_REQUIRED')
    return 'Solo un propietario puede gestionar otra Membership de propietario.';
  return fallback;
}

const memberColumns: DataTableColumn<MembershipResponse>[] = [
  {
    key: 'person',
    header: 'Persona',
    render: (member) => (
      <span className="table-identity">
        <strong>{member.user.displayName || member.user.email}</strong>
        {member.user.displayName ? <small>{member.user.email}</small> : null}
      </span>
    ),
  },
  { key: 'role', header: 'Rol', render: (member) => roleLabel(member.role) },
  {
    key: 'clinical',
    header: 'Rol clínico',
    render: (member) => clinicalRoleLabel(member.clinicalRole),
  },
  {
    key: 'status',
    header: 'Acceso',
    render: (member) => (
      <Badge
        tone={
          member.status === 'ACTIVE'
            ? 'success'
            : member.status === 'SUSPENDED'
              ? 'warning'
              : 'neutral'
        }
      >
        {member.status === 'ACTIVE'
          ? 'Activo'
          : member.status === 'SUSPENDED'
            ? 'Suspendido'
            : 'Invitado'}
      </Badge>
    ),
  },
  {
    key: 'actions',
    header: 'Detalle',
    render: (member) => (
      <Link className="text-link" to={`/usuarios/${member.id}`}>
        Ver perfil
      </Link>
    ),
  },
];

// The staff directory filters at the tenant API and discards stale responses when scope changes.
export function UsersListPage() {
  const { activeMembership } = useAuth();
  const organizationId = activeMembership?.organization.id ?? '';
  const canCreate = useCan(PERMISSION.MEMBERS_CREATE);
  const [filterOrganizationId, setFilterOrganizationId] = useState(organizationId);
  const [data, setData] = useState<MembershipResponse[]>([]);
  const [dataOrganizationId, setDataOrganizationId] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('');
  const [clinicalRole, setClinicalRole] = useState('');
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pageSize = 25;
  const filtersBelongToTenant = filterOrganizationId === organizationId;
  const selectedRole = filtersBelongToTenant ? role : '';
  const selectedClinicalRole = filtersBelongToTenant ? clinicalRole : '';
  const selectedStatus = filtersBelongToTenant ? status : '';
  const selectedSearch = filtersBelongToTenant ? search : '';
  const selectedPage = filtersBelongToTenant ? page : 1;

  useEffect(() => {
    setFilterOrganizationId(organizationId);
    setPage(1);
    setRole('');
    setClinicalRole('');
    setStatus('');
    setSearchInput('');
    setSearch('');
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) return undefined;
    const controller = new AbortController();
    setData([]);
    setDataOrganizationId('');
    setTotal(0);
    setLoading(true);
    setError('');
    adminApi
      .listMembers(
        {
          page: selectedPage,
          pageSize,
          ...(selectedRole ? { role: selectedRole } : {}),
          ...(selectedClinicalRole ? { clinicalRole: selectedClinicalRole } : {}),
          ...(selectedStatus ? { status: selectedStatus } : {}),
          ...(selectedSearch ? { search: selectedSearch } : {}),
        },
        controller.signal,
      )
      .then((result) => {
        setData(result.data);
        setDataOrganizationId(organizationId);
        setTotal(result.total);
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted)
          setError(memberError(caught, 'No fue posible cargar el equipo.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [
    organizationId,
    pageSize,
    selectedClinicalRole,
    selectedPage,
    selectedRole,
    selectedSearch,
    selectedStatus,
  ]);

  const currentTenantData = dataOrganizationId === organizationId;
  const visibleData = currentTenantData ? data : [];
  const visibleTotal = currentTenantData ? total : 0;
  const pageCount = Math.max(1, Math.ceil(visibleTotal / pageSize));
  const empty = useMemo(
    () => !loading && !error && visibleData.length === 0,
    [error, loading, visibleData.length],
  );

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <div className="page-stack admin-page">
      <PageHeader
        eyebrow="Equipo de la organización"
        title="Usuarios"
        description="Administra el acceso y los roles del personal de esta organización. Las cuentas personales pertenecen a Easyvet, no a una sede."
        action={
          canCreate ? (
            <Button as={Link} to="/usuarios/nuevo">
              Agregar persona
            </Button>
          ) : undefined
        }
      />
      {error && currentTenantData ? <Alert tone="error">{error}</Alert> : null}
      <Card className="admin-filter-card">
        <form className="admin-filter-grid" onSubmit={applySearch}>
          <FormField
            label="Buscar persona"
            htmlFor="staff-search"
            hint="Correo o nombre profesional configurado"
          >
            <TextInput
              id="staff-search"
              value={filtersBelongToTenant ? searchInput : ''}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </FormField>
          <FormField label="Rol organizacional" htmlFor="staff-role-filter">
            <Select
              id="staff-role-filter"
              value={selectedRole}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              {ROLE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Rol clínico" htmlFor="staff-clinical-role-filter">
            <Select
              id="staff-clinical-role-filter"
              value={selectedClinicalRole}
              onChange={(event) => {
                setClinicalRole(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              {CLINICAL_ROLE_OPTIONS.slice(1).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Estado" htmlFor="staff-status-filter">
            <Select
              id="staff-status-filter"
              value={selectedStatus}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              <option value="ACTIVE">Activo</option>
              <option value="INVITED">Invitado</option>
              <option value="SUSPENDED">Suspendido</option>
            </Select>
          </FormField>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
      </Card>
      <Card className="admin-list-card">
        {loading || !currentTenantData ? <LoadingState label="Cargando equipo…" /> : null}
        {empty && currentTenantData ? (
          <EmptyState
            title="Aún no hay personas con estos filtros"
            description="Agrega a tu equipo o ajusta los filtros de búsqueda."
            action={
              canCreate ? (
                <Button as={Link} to="/usuarios/nuevo">
                  Agregar persona
                </Button>
              ) : undefined
            }
          />
        ) : null}
        {!loading && currentTenantData && visibleData.length ? (
          <>
            <DataTable
              columns={memberColumns}
              rows={visibleData}
              getRowKey={(member) => member.id}
              emptyTitle="Sin resultados"
            />
            <div className="admin-pagination" aria-label="Paginación del equipo">
              <span>
                {visibleTotal} personas · Página {page} de {pageCount}
              </span>
              <div className="admin-actions">
                <Button
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="secondary"
                  disabled={page >= pageCount}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </Card>
    </div>
  );
}

// New staff receive the temporary credential in memory and in one closable, one-time modal only.
export function MemberCreatePage() {
  const navigate = useNavigate();
  const { activeMembership } = useAuth();
  const organizationId = activeMembership?.organization.id ?? '';
  const actorIsOwner = activeMembership?.role === 'OWNER';
  const assignableRoles = ROLE_OPTIONS.filter(([value]) => actorIsOwner || value !== 'OWNER');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('RECEPTION');
  const [clinicalRole, setClinicalRole] = useState('');
  const [result, setResult] = useState<Awaited<ReturnType<typeof adminApi.createMember>> | null>(
    null,
  );
  const [resultOrganizationId, setResultOrganizationId] = useState('');
  const [copyState, setCopyState] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const mutationController = useRef<AbortController | null>(null);

  useEffect(() => {
    setResult(null);
    setResultOrganizationId('');
    setCopyState('');
    return () => mutationController.current?.abort();
  }, [organizationId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    mutationController.current?.abort();
    const controller = new AbortController();
    mutationController.current = controller;
    try {
      const created = await adminApi.createMember(
        {
          email,
          membershipRole: role as CreateStaffRequest['membershipRole'],
          clinicalRole: clinicalRole
            ? (clinicalRole as NonNullable<CreateStaffRequest['clinicalRole']>)
            : null,
        },
        controller.signal,
      );
      setResult(created);
      setResultOrganizationId(organizationId);
    } catch (caught) {
      if (!controller.signal.aborted)
        setError(memberError(caught, 'No fue posible agregar a esta persona.'));
    } finally {
      if (!controller.signal.aborted) setSaving(false);
      if (mutationController.current === controller) mutationController.current = null;
    }
  }

  async function copyPassword() {
    const visibleResult = resultOrganizationId === organizationId ? result : null;
    if (!visibleResult?.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(visibleResult.temporaryPassword);
      setCopyState('Contraseña copiada. Compártela de forma segura.');
    } catch {
      setCopyState('No fue posible copiarla; selecciona el texto para copiarlo.');
    }
  }

  const visibleResult = resultOrganizationId === organizationId ? result : null;

  return (
    <div className="page-stack admin-page">
      <PageHeader
        eyebrow="Usuarios"
        title="Agregar persona al equipo"
        description="La persona tendrá acceso a esta organización con los roles que asignes. No se modifican otras organizaciones."
        action={
          <Button as={Link} to="/usuarios" variant="ghost">
            Volver al equipo
          </Button>
        }
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Card className="admin-form-card">
        <form className="page-stack" onSubmit={submit}>
          <FormField
            label="Correo electrónico"
            htmlFor="member-email"
            hint="Se normaliza a minúsculas. No cambia el correo de una cuenta existente."
          >
            <TextInput
              id="member-email"
              type="email"
              autoComplete="email"
              maxLength={320}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </FormField>
          <div className="admin-form-grid">
            <FormField label="Rol organizacional" htmlFor="member-role">
              <Select
                id="member-role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                {assignableRoles.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Rol clínico"
              htmlFor="member-clinical-role"
              hint="Es independiente del rol organizacional."
            >
              <Select
                id="member-clinical-role"
                value={clinicalRole}
                onChange={(event) => setClinicalRole(event.target.value)}
              >
                {CLINICAL_ROLE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="admin-actions">
            <Button type="submit" disabled={saving || !organizationId}>
              {saving ? 'Agregando…' : 'Agregar a la organización'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate('/usuarios')}>
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
      <Modal
        open={visibleResult !== null}
        title={visibleResult?.temporaryPassword ? 'Cuenta creada' : 'Persona agregada'}
        description={
          visibleResult?.temporaryPassword
            ? 'Esta contraseña se muestra una sola vez. Compártela de forma segura.'
            : ''
        }
        onClose={() => {
          const memberId = visibleResult?.membership.id;
          setResult(null);
          setResultOrganizationId('');
          if (memberId) navigate(`/usuarios/${memberId}`);
        }}
      >
        {visibleResult?.temporaryPassword ? (
          <div className="page-stack">
            <p>La cuenta necesita cambiar esta contraseña al iniciar sesión por primera vez.</p>
            <output className="temporary-password" aria-label="Contraseña temporal">
              {visibleResult.temporaryPassword}
            </output>
            <Button type="button" variant="secondary" onClick={() => void copyPassword()}>
              Copiar contraseña
            </Button>
            {copyState ? <p role="status">{copyState}</p> : null}
          </div>
        ) : (
          <Alert tone="success">
            La persona ya tenía una cuenta de Easyvet y fue agregada a esta organización.
          </Alert>
        )}
        <div className="admin-actions admin-modal-actions">
          <Button
            type="button"
            onClick={() => {
              const memberId = visibleResult?.membership.id;
              setResult(null);
              setResultOrganizationId('');
              if (memberId) navigate(`/usuarios/${memberId}`);
            }}
          >
            Ver perfil
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setResult(null);
              setResultOrganizationId('');
              navigate('/usuarios');
            }}
          >
            Cerrar
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// Membership detail exposes only this tenant's access profile and never offers a global password reset.
export function MemberDetailPage() {
  const { membershipId = '' } = useParams<{ membershipId: string }>();
  const { activeMembership } = useAuth();
  const organizationId = activeMembership?.organization.id ?? '';
  const actorIsOwner = activeMembership?.role === 'OWNER';
  const canUpdate = useCan(PERMISSION.MEMBERS_UPDATE);
  const canSuspend = useCan(PERMISSION.MEMBERS_SUSPEND);
  const [member, setMember] = useState<MembershipResponse | null>(null);
  const [memberOrganizationId, setMemberOrganizationId] = useState('');
  const [role, setRole] = useState('RECEPTION');
  const [clinicalRole, setClinicalRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmRoleChange, setConfirmRoleChange] = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const mutationController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!organizationId || !membershipId) return undefined;
    const controller = new AbortController();
    setMember(null);
    setMemberOrganizationId(organizationId);
    setLoading(true);
    setError('');
    adminApi
      .getMember(membershipId, controller.signal)
      .then((record) => {
        setMember(record);
        setMemberOrganizationId(organizationId);
        setRole(record.role);
        setClinicalRole(record.clinicalRole ?? '');
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted)
          setError(memberError(caught, 'No fue posible cargar esta persona.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      mutationController.current?.abort();
    };
  }, [membershipId, organizationId]);

  const roleChanged = member !== null && role !== member.role;
  const clinicalChanged = member !== null && clinicalRole !== (member.clinicalRole ?? '');
  const sensitiveChange =
    (roleChanged &&
      (['OWNER', 'ADMIN'].includes(role) || ['OWNER', 'ADMIN'].includes(member?.role ?? ''))) ||
    clinicalChanged;
  const canManageTarget = member !== null && (actorIsOwner || member.role !== 'OWNER');
  const canEditMember = canUpdate && canManageTarget;
  const canChangeMemberStatus = canSuspend && canManageTarget;

  async function saveRoles() {
    if (!member || (!roleChanged && !clinicalChanged)) return;
    setSaving(true);
    setError('');
    setNotice('');
    mutationController.current?.abort();
    const controller = new AbortController();
    mutationController.current = controller;
    try {
      const update: UpdateMembershipRequest = {
        ...(roleChanged
          ? { membershipRole: role as UpdateMembershipRequest['membershipRole'] }
          : {}),
        ...(clinicalChanged
          ? {
              clinicalRole: clinicalRole
                ? (clinicalRole as NonNullable<UpdateMembershipRequest['clinicalRole']>)
                : null,
            }
          : {}),
      };
      const updated = await adminApi.updateMember(member.id, update, controller.signal);
      setMember(updated);
      setRole(updated.role);
      setClinicalRole(updated.clinicalRole ?? '');
      setNotice(
        'Los roles se actualizaron. Los permisos efectivos se renovarán en la siguiente solicitud.',
      );
    } catch (caught) {
      if (!controller.signal.aborted)
        setError(memberError(caught, 'No fue posible actualizar los roles.'));
    } finally {
      if (!controller.signal.aborted) {
        setSaving(false);
        setConfirmRoleChange(false);
      }
      if (mutationController.current === controller) mutationController.current = null;
    }
  }

  async function changeStatus(action: 'suspend' | 'reactivate') {
    if (!member) return;
    setSaving(true);
    setError('');
    mutationController.current?.abort();
    const controller = new AbortController();
    mutationController.current = controller;
    try {
      setMember(await adminApi.setMemberStatus(member.id, action, controller.signal));
      setNotice(
        action === 'suspend'
          ? 'El acceso a esta organización fue suspendido.'
          : 'El acceso a esta organización fue reactivado.',
      );
    } catch (caught) {
      if (!controller.signal.aborted)
        setError(memberError(caught, 'No fue posible cambiar el acceso.'));
    } finally {
      if (!controller.signal.aborted) {
        setSaving(false);
        setConfirmSuspend(false);
      }
      if (mutationController.current === controller) mutationController.current = null;
    }
  }

  if (loading || memberOrganizationId !== organizationId)
    return <LoadingState label="Cargando perfil del equipo…" />;
  if (!member)
    return (
      <div className="page-stack admin-page">
        <PageHeader
          eyebrow="Usuarios"
          title="Perfil no disponible"
          description="No se encontró esta Membership en la organización activa."
        />
        <Button as={Link} to="/usuarios">
          Volver al equipo
        </Button>
      </div>
    );

  return (
    <div className="page-stack admin-page">
      <PageHeader
        eyebrow="Usuarios"
        title={member.user.displayName || member.user.email}
        description="Acceso y permisos de esta persona dentro de la organización activa."
        action={
          <Button as={Link} to="/usuarios" variant="ghost">
            Volver al equipo
          </Button>
        }
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      <Card className="admin-detail-card">
        <dl className="admin-detail-grid">
          <div>
            <dt>Correo</dt>
            <dd>{member.user.email}</dd>
          </div>
          <div>
            <dt>Acceso a esta organización</dt>
            <dd>
              {member.status === 'ACTIVE'
                ? 'Activo'
                : member.status === 'SUSPENDED'
                  ? 'Suspendido'
                  : 'Invitado'}
            </dd>
          </div>
          <div>
            <dt>Perfil profesional</dt>
            <dd>
              {member.professionalProfileConfigured
                ? 'Configurado por la persona'
                : 'Aún no configurado'}
            </dd>
          </div>
        </dl>
      </Card>
      <Card className="admin-form-card">
        <form
          className="page-stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (sensitiveChange) setConfirmRoleChange(true);
            else void saveRoles();
          }}
        >
          <div className="admin-form-grid">
            <FormField label="Rol organizacional" htmlFor="detail-role">
              <Select
                id="detail-role"
                value={role}
                disabled={!canEditMember}
                onChange={(event) => setRole(event.target.value)}
              >
                {ROLE_OPTIONS.filter(
                  ([value]) => actorIsOwner || (value !== 'OWNER' && member.role !== 'OWNER'),
                ).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Rol clínico"
              htmlFor="detail-clinical-role"
              hint="Puede retirarse aunque haya borradores asignados; la reasignación se exige al finalizar."
            >
              <Select
                id="detail-clinical-role"
                value={clinicalRole}
                disabled={!canEditMember}
                onChange={(event) => setClinicalRole(event.target.value)}
              >
                {CLINICAL_ROLE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          {sensitiveChange ? (
            <Alert tone="warning">
              El cambio afecta autoridad de administración o acceso clínico. Revisa que la nueva
              combinación sea adecuada.
            </Alert>
          ) : null}
          <div className="admin-actions">
            {canEditMember ? (
              <Button type="submit" disabled={saving || (!roleChanged && !clinicalChanged)}>
                {saving ? 'Guardando…' : 'Guardar roles'}
              </Button>
            ) : null}
            {canChangeMemberStatus && member.status === 'ACTIVE' ? (
              <Button
                type="button"
                variant="danger"
                disabled={saving}
                onClick={() => setConfirmSuspend(true)}
              >
                Suspender acceso
              </Button>
            ) : null}
            {canChangeMemberStatus && member.status === 'SUSPENDED' ? (
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => void changeStatus('reactivate')}
              >
                Reactivar acceso
              </Button>
            ) : null}
          </div>
          {!canManageTarget ? (
            <p className="admin-note">
              Solo un OWNER puede gestionar una Membership de propietario.
            </p>
          ) : null}
        </form>
      </Card>
      <Modal
        open={confirmRoleChange}
        title="Confirmar cambio de roles"
        description="El acceso efectivo cambiará en las siguientes solicitudes."
        onClose={() => setConfirmRoleChange(false)}
      >
        <div className="admin-actions">
          <Button type="button" onClick={() => void saveRoles()} disabled={saving}>
            Confirmar cambio
          </Button>
          <Button type="button" variant="ghost" onClick={() => setConfirmRoleChange(false)}>
            Volver
          </Button>
        </div>
      </Modal>
      <Modal
        open={confirmSuspend}
        title="Suspender acceso"
        description="Este usuario perderá acceso a esta organización. Su cuenta personal y otras organizaciones no se eliminarán ni se modificarán."
        onClose={() => setConfirmSuspend(false)}
      >
        <div className="admin-actions">
          <Button
            type="button"
            variant="danger"
            onClick={() => void changeStatus('suspend')}
            disabled={saving}
          >
            Confirmar suspensión
          </Button>
          <Button type="button" variant="ghost" onClick={() => setConfirmSuspend(false)}>
            Cancelar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
