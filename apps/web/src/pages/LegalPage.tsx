import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../components/brand/BrandMark';
import { EasyvetIcon } from '../components/icons/EasyvetIcon';
import '../styles/legal.css';

type LegalDocument = 'privacy' | 'terms' | 'cookies' | 'refunds';

const documents = {
  privacy: {
    label: 'Privacidad',
    title: 'Política de privacidad',
    intro:
      'Información sobre los datos que Easyvet puede tratar para crear cuentas, administrar clínicas y operar la plataforma.',
    sections: [
      {
        title: 'Estado de este documento',
        paragraphs: [
          'Borrador informativo para Colombia. Antes de comercializar el servicio se deben completar los datos legales y realizar una revisión profesional específica para el tratamiento de datos personales.',
          'Responsable, razón social, NIT y dirección: pendientes de completar. Correo de soporte informado: danilitohhh@gmail.com.',
        ],
      },
      {
        title: 'Datos que podemos tratar',
        paragraphs: [
          'Datos de cuenta y contacto, como nombre, correo y credenciales protegidas. Datos de la clínica, usuarios autorizados y configuración operativa. Cuando una clínica usa módulos clínicos, también puede ingresar información de propietarios, pacientes, consultas, documentos y seguimientos.',
          'La clínica y sus usuarios autorizados son responsables de ingresar información adecuada y de definir quién puede acceder a ella dentro de su organización.',
        ],
      },
      {
        title: 'Finalidades y acceso',
        paragraphs: [
          'Usamos los datos para crear y proteger cuentas, prestar las funciones solicitadas, mantener la seguridad, enviar comunicaciones operativas y atender solicitudes de soporte. El acceso debe limitarse a la operación autorizada de cada clínica y a las obligaciones técnicas necesarias para prestar el servicio.',
          'La versión actual no activa analítica no esencial ni publicidad comportamental. Si se incorporan tecnologías no esenciales, se informarán y se solicitará el consentimiento correspondiente cuando aplique.',
          'Si la persona acepta la analítica opcional, Easyvet puede recibir métricas agregadas de rutas y navegación mediante Vercel Web Analytics. No se envían identificadores de pacientes, tokens, datos clínicos ni parámetros de consulta.',
        ],
      },
      {
        title: 'Derechos, conservación y solicitudes',
        paragraphs: [
          'Las personas pueden solicitar información, actualización, corrección, revocatoria u otros derechos aplicables mediante danilitohhh@gmail.com. El canal y los plazos formales deberán revisarse antes del lanzamiento comercial.',
          'El plazo exacto de conservación, eliminación y atención de solicitudes está pendiente de definición documentada. Se conservarán los datos solo durante el tiempo necesario para la finalidad aplicable, obligaciones legales y defensa de derechos.',
        ],
      },
    ],
  },
  terms: {
    label: 'Términos',
    title: 'Términos y condiciones',
    intro: 'Reglas generales para el uso de Easyvet por personas y clínicas veterinarias.',
    sections: [
      {
        title: 'Estado y datos del proveedor',
        paragraphs: [
          'Borrador informativo para Colombia. La identidad legal, razón social, NIT y dirección están pendientes de completar. El correo de soporte informado es danilitohhh@gmail.com. Todo requiere revisión profesional antes de publicar una versión comercial.',
        ],
      },
      {
        title: 'Cuenta y uso autorizado',
        paragraphs: [
          'Cada persona debe proteger sus credenciales y usar la plataforma únicamente para fines legítimos relacionados con la operación de su clínica. La clínica debe administrar sus usuarios, permisos, información y responsables de forma diligente.',
          'No está permitido acceder sin autorización, intentar evadir controles, introducir código malicioso, abusar de los límites del servicio ni usar Easyvet para actividades ilegales.',
        ],
      },
      {
        title: 'Servicio y disponibilidad',
        paragraphs: [
          'Easyvet puede evolucionar, corregir errores o requerir mantenimiento. La disponibilidad, respaldos, integraciones y tiempos de respuesta concretos deberán definirse en una versión comercial o acuerdo aplicable; este borrador no promete niveles de servicio específicos.',
          'La información clínica y operativa no sustituye el criterio profesional veterinario ni las obligaciones de la clínica frente a sus clientes y pacientes.',
        ],
      },
      {
        title: 'Planes y pagos',
        paragraphs: [
          'El plan gratuito está previsto para operar sin pago. Los precios, impuestos, descuento anual y flujo de checkout de los planes pagos están por definir y deberán publicarse antes de cobrar.',
          'La regla comercial actual es sin reembolsos, sujeta a la ley colombiana aplicable y a los derechos irrenunciables que correspondan. Los detalles finales deben ser revisados profesionalmente antes de activar pagos.',
        ],
      },
    ],
  },
  cookies: {
    label: 'Cookies',
    title: 'Política de cookies',
    intro: 'Qué tecnologías de almacenamiento usa la versión actual de Easyvet.',
    sections: [
      {
        title: 'Tecnología esencial activa',
        paragraphs: [
          'La autenticación usa una cookie de sesión esencial para mantener el acceso seguro. En producción se configura para no exponerse a JavaScript, viajar por HTTPS y limitar el envío entre sitios. Esta cookie es necesaria para prestar la función solicitada.',
        ],
      },
      {
        title: 'Tecnologías no esenciales',
        paragraphs: [
          'La versión actual no activa cookies de publicidad ni analítica no esencial sin consentimiento. Cuando se acepta la analítica opcional, Vercel Web Analytics registra métricas agregadas sin cookies de terceros; la preferencia se guarda localmente en el navegador.',
          'Si en el futuro se habilitan tecnologías no esenciales, Easyvet deberá informar su finalidad y ofrecer aceptar, rechazar y gestionar preferencias antes de activarlas cuando corresponda.',
        ],
      },
      {
        title: 'Configuración pendiente',
        paragraphs: [
          'El responsable, la identidad legal, la dirección y el inventario final de cookies deberán completarse antes del lanzamiento comercial. Para soporte se informó danilitohhh@gmail.com. Este documento no pretende sustituir una revisión legal de la jurisdicción aplicable.',
        ],
      },
    ],
  },
  refunds: {
    label: 'Reembolsos',
    title: 'Política de reembolsos',
    intro: 'Regla comercial informativa para los planes de Easyvet.',
    sections: [
      {
        title: 'Estado actual',
        paragraphs: [
          'Easyvet todavía no tiene precios pagos ni un checkout comercial activo en esta versión. Los valores en COP, el descuento anual y el proceso de facturación se definirán antes de cobrar.',
        ],
      },
      {
        title: 'Regla prevista',
        paragraphs: [
          'La regla comercial definida para los planes pagos es sin reembolsos, sujeta a la ley colombiana aplicable y a los derechos que no puedan excluirse. Esta regla no autoriza a desconocer obligaciones legales ni compromisos específicos que se publiquen en una orden o contrato.',
        ],
      },
      {
        title: 'Datos pendientes',
        paragraphs: [
          'La identidad legal, razón social, NIT, dirección, precios, impuestos y canal formal de solicitudes están pendientes de completar. El correo informado para soporte es danilitohhh@gmail.com. Se requiere revisión profesional antes de activar suscripciones pagas.',
        ],
      },
    ],
  },
} satisfies Record<
  LegalDocument,
  {
    label: string;
    title: string;
    intro: string;
    sections: Array<{ title: string; paragraphs: string[] }>;
  }
>;

export function LegalPage({ document }: { document: LegalDocument }) {
  const content = documents[document];

  useEffect(() => {
    const previousTitle = window.document.title;
    window.document.title = `${content.title} | Easyvet`;
    return () => {
      window.document.title = previousTitle;
    };
  }, [content.title]);

  return (
    <main className="legal-page">
      <header className="legal-page__header">
        <Link className="legal-page__brand" to="/" aria-label="Easyvet, inicio">
          <BrandMark />
          <span>
            <strong>Easyvet</strong>
            <small>Gestión veterinaria</small>
          </span>
        </Link>
        <Link className="legal-page__back" to="/">
          <EasyvetIcon name="arrow-down" size={15} />
          Volver al inicio
        </Link>
      </header>

      <article className="legal-page__content" aria-labelledby="legal-page-title">
        <p className="legal-page__eyebrow">Información legal · {content.label}</p>
        <h1 id="legal-page-title">{content.title}</h1>
        <p className="legal-page__intro">{content.intro}</p>
        <p className="legal-page__notice">
          Documento informativo pendiente de completar con los datos legales reales y de revisión
          profesional.
        </p>
        <div className="legal-page__sections">
          {content.sections.map((section) => (
            <section key={section.title} aria-labelledby={`legal-${section.title}`}>
              <h2 id={`legal-${section.title}`}>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
        <nav className="legal-page__related" aria-label="Más información legal">
          <Link to="/privacidad">Privacidad</Link>
          <Link to="/terminos">Términos</Link>
          <Link to="/cookies">Cookies</Link>
          <Link to="/reembolsos">Reembolsos</Link>
        </nav>
      </article>
    </main>
  );
}
