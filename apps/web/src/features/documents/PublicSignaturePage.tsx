import { useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { TextInput } from '../../components/ui/TextInput';
import { ApiError } from '../../services/apiClient';
import { errorMessage } from '../shared/resourceUtils';
import { documentsApi } from './documentsApi';
import './documents.css';

// SignatureCanvas records pointer strokes in a responsive bitmap while the typed alternative remains available.
function SignatureCanvas({
  canvas,
  setCanvas,
  onInkChange,
}: {
  canvas: HTMLCanvasElement | null;
  setCanvas: (node: HTMLCanvasElement | null) => void;
  onInkChange: (value: boolean) => void;
}) {
  const drawing = useRef(false);
  const hasInk = useRef(false);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const scaleX = event.currentTarget.width / bounds.width;
    const scaleY = event.currentTarget.height / bounds.height;
    return { x: (event.clientX - bounds.left) * scaleX, y: (event.clientY - bounds.top) * scaleY };
  }

  function start(event: PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    drawing.current = true;
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const current = point(event);
    context.beginPath();
    context.moveTo(current.x, current.y);
    context.lineWidth = Math.max(2, (window.devicePixelRatio || 1) * 2);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#174534';
    context.lineTo(current.x + 0.1, current.y + 0.1);
    context.stroke();
    hasInk.current = true;
    onInkChange(true);
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    event.preventDefault();
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    const current = point(event);
    context.lineTo(current.x, current.y);
    context.stroke();
  }

  function stop() {
    drawing.current = false;
  }

  function clear() {
    if (!canvas) return;
    const context = canvas.getContext('2d');
    context?.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    onInkChange(false);
  }

  return (
    <div className="signature-canvas-wrap">
      <canvas
        ref={setCanvas}
        className="signature-canvas"
        width={Math.round(720 * (window.devicePixelRatio || 1))}
        height={Math.round(220 * (window.devicePixelRatio || 1))}
        role="img"
        aria-label="Área de firma manuscrita. Usa mouse, pantalla táctil o lápiz óptico. También puedes elegir firma por nombre escrito."
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
      />
      <div className="signature-canvas__actions">
        <span>Firma dentro del recuadro</span>
        <Button type="button" variant="secondary" onClick={clear}>
          Limpiar firma
        </Button>
      </div>
    </div>
  );
}

// Public page uses an uncredentialed API client and exposes only generic failures and required consent fields.
export function PublicSignaturePage() {
  const { token = '' } = useParams<{ token: string }>();
  const [consent, setConsent] = useState<Awaited<
    ReturnType<typeof documentsApi.publicConsent>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signatureMethod, setSignatureMethod] = useState<'TYPED' | 'DRAWN'>('TYPED');
  const [accepted, setAccepted] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<unknown>(null);
  const [signed, setSigned] = useState<{ signerName: string; signedAt: string } | null>(null);
  const setCanvasRef = useCallback((node: HTMLCanvasElement | null) => setCanvas(node), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void documentsApi
      .publicConsent(token)
      .then((result) => {
        if (active) setConsent(result);
      })
      .catch(() => {
        if (active) setUnavailable(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accepted || !consent) return;
    setSending(true);
    setSendError(null);
    try {
      let signature: Blob | undefined;
      if (signatureMethod === 'DRAWN') {
        if (!canvas || !hasInk)
          throw new ApiError('Agrega tu firma o cambia a nombre escrito.', 400);
        signature = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo preparar la firma.'))),
            'image/png',
          ),
        );
      }
      const result = await documentsApi.signPublic(token, {
        verificationCode,
        signerName: signerName.trim(),
        signatureMethod,
        signature,
      });
      setSigned({ signerName: result.signerName, signedAt: result.signedAt });
    } catch (requestError: unknown) {
      setSendError(requestError);
    } finally {
      setSending(false);
    }
  }

  if (loading)
    return (
      <main className="public-signing">
        <LoadingState label="Validando solicitud de firma" />
      </main>
    );
  if (signed) {
    return (
      <main className="public-signing">
        <Card className="public-signing__card">
          <div className="public-signing__brand">Easyvet</div>
          <Badge tone="success">Completado</Badge>
          <h1>Consentimiento firmado correctamente.</h1>
          <p>
            Firma registrada a nombre de <strong>{signed.signerName}</strong>.
          </p>
          <p className="clinical-muted">{new Date(signed.signedAt).toLocaleString('es-CO')}</p>
          <p>Puedes cerrar esta ventana. No es necesario iniciar sesión.</p>
        </Card>
      </main>
    );
  }
  if (unavailable || !consent) {
    return (
      <main className="public-signing">
        <Card className="public-signing__card">
          <div className="public-signing__brand">Easyvet</div>
          <h1>Enlace de firma no disponible</h1>
          <p role="status">
            Esta solicitud no está disponible. Verifica el enlace con la clínica que te lo
            compartió.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="public-signing">
      <Card className="public-signing__card">
        <div className="public-signing__brand">
          Easyvet <span>{consent.organizationDisplayName}</span>
        </div>
        <p className="section-kicker">Consentimiento informado</p>
        <h1>{consent.title}</h1>
        <div className="public-signing__summary">
          <p>
            <strong>Paciente</strong>
            <span>{consent.patientName}</span>
          </p>
          <p>
            <strong>Responsable</strong>
            <span>
              {consent.ownerDisplayName}
              {consent.ownerDocumentMasked ? ` · ${consent.ownerDocumentMasked}` : ''}
            </span>
          </p>
          <p>
            <strong>Profesional</strong>
            <span>
              {consent.professionalDisplayName}
              {consent.professionalLicense ? ` · ${consent.professionalLicense}` : ''}
            </span>
          </p>
        </div>
        <section className="public-consent-copy" aria-label="Texto del consentimiento">
          {[
            ['Propósito', consent.purposeText],
            ['Riesgos', consent.risksText],
            ['Beneficios', consent.benefitsText],
            ['Alternativas', consent.alternativesText],
            ['Costo estimado', consent.estimatedCostText],
            ['Declaración', consent.declarationText],
          ].map(([label, value]) =>
            value ? (
              <div key={String(label)}>
                <h2>{label}</h2>
                <p>{value}</p>
              </div>
            ) : null,
          )}
        </section>
        <p className="public-signing__expiry">
          Este enlace vence {new Date(consent.expiresAt).toLocaleString('es-CO')}.
        </p>
        <form className="domain-form public-signing__form" onSubmit={(event) => void submit(event)}>
          <h2>Confirmar aceptación</h2>
          <FormField
            label="Código de verificación de 6 dígitos *"
            htmlFor="signature-verification-code"
          >
            <TextInput
              id="signature-verification-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={verificationCode}
              onChange={(event) =>
                setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))
              }
              required
            />
          </FormField>
          <FormField label="Nombre completo de quien acepta *" htmlFor="signature-name">
            <TextInput
              id="signature-name"
              autoComplete="name"
              maxLength={300}
              value={signerName}
              onChange={(event) => setSignerName(event.target.value)}
              required
            />
          </FormField>
          <fieldset className="signature-method">
            <legend>Forma de firma</legend>
            <label>
              <input
                type="radio"
                name="signature-method"
                value="TYPED"
                checked={signatureMethod === 'TYPED'}
                onChange={() => setSignatureMethod('TYPED')}
              />{' '}
              Nombre escrito (accesible)
            </label>
            <label>
              <input
                type="radio"
                name="signature-method"
                value="DRAWN"
                checked={signatureMethod === 'DRAWN'}
                onChange={() => setSignatureMethod('DRAWN')}
              />{' '}
              Firma manuscrita
            </label>
          </fieldset>
          {signatureMethod === 'DRAWN' ? (
            <SignatureCanvas canvas={canvas} setCanvas={setCanvasRef} onInkChange={setHasInk} />
          ) : (
            <p className="clinical-muted">
              Tu nombre y la aceptación quedarán registrados como evidencia electrónica.
            </p>
          )}
          <label className="signature-acceptance">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              required
            />
            <span>He leído el consentimiento y acepto su contenido.</span>
          </label>
          {sendError ? (
            <Alert tone="error" role="alert">
              {sendError instanceof ApiError
                ? 'No fue posible validar la solicitud o el código. Comprueba los datos y vuelve a intentarlo.'
                : errorMessage(sendError, 'No fue posible completar la firma.')}
            </Alert>
          ) : null}
          <Button
            type="submit"
            disabled={
              sending ||
              !accepted ||
              verificationCode.length !== 6 ||
              !signerName.trim() ||
              (signatureMethod === 'DRAWN' && !hasInk)
            }
          >
            {sending ? 'Enviando firma…' : 'Firmar y aceptar'}
          </Button>
        </form>
        <p className="public-signing__privacy">
          El enlace es de un solo uso. Si tienes dudas, contacta directamente a la clínica.
        </p>
      </Card>
    </main>
  );
}
