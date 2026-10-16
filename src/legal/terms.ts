// Términos y Condiciones de Uso de La Marchanta, como datos tipados.
// Lo que dicen del servicio sale de lo que el sistema hace hoy (doc/legal/inventario-datos.md);
// las decisiones de negocio y los supuestos están en doc/legal/preguntas-para-abogado.md.
// Datos del responsable y jurisdicción: legal-config.ts. Si cambia el texto, sube
// LEGAL_VERSION en versions.ts.

import { LEGAL_CONTACT_EMAIL, LEGAL_JURISDICTION, LEGAL_RESPONSIBLE } from './legal-config'
import type { LegalDocumentData } from './types'

const email = LEGAL_CONTACT_EMAIL

export const TERMS: LegalDocumentData = {
  id: 'terminos',
  title: 'Términos y Condiciones de Uso',
  summary: [
    'La Marchanta es un sistema en piloto para llevar las ventas, los productos y las deudas de tu negocio.',
    'Cada registro pasa por una aprobación manual. Podemos rechazar solicitudes.',
    'Cuidas tu cuenta y tu contraseña, y usas el sistema de forma legal.',
    'Los datos de tu negocio son de tu negocio. Tú respondes por los datos de tus clientes.',
    'No garantizamos un servicio sin fallas, y nuestra responsabilidad tiene límites.',
  ],
  sections: [
    {
      id: 'que-es-el-servicio',
      title: '¿Qué es el servicio?',
      blocks: [
        { kind: 'p', text: `La Marchanta es un sistema web que ofrece ${LEGAL_RESPONSIBLE.name}, ${LEGAL_RESPONSIBLE.kind}.` },
        {
          kind: 'p',
          text: 'Sirve para llevar el catálogo, las ventas, los fiados y apartados, los gastos y los reportes de un negocio.',
        },
        { kind: 'p', text: 'Está en piloto. Eso quiere decir que lo probamos con pocos negocios.' },
        { kind: 'p', text: 'Puede cambiar, tener errores o dejar de ofrecerse.' },
        { kind: 'p', text: 'No procesa pagos ni cobra por ti. Solo registra lo que tú cobras.' },
        { kind: 'p', text: 'Es un apoyo para tu negocio. No sustituye una asesoría contable, fiscal ni legal.' },
      ],
    },
    {
      id: 'quien-puede-registrarse',
      title: '¿Quién puede registrarse?',
      blocks: [
        { kind: 'p', text: 'Puede registrarse una persona mayor de edad que dirija un negocio o tenga permiso de quien lo dirige.' },
        { kind: 'p', text: 'Los datos que das deben ser veraces y estar al día. Si cambian, avísanos.' },
        { kind: 'p', text: 'Tu correo debe ser tuyo y poder recibir mensajes.' },
      ],
    },
    {
      id: 'aprobacion-manual',
      title: 'Aprobación manual',
      blocks: [
        { kind: 'p', text: 'Revisamos cada solicitud a mano. Eso puede tardar.' },
        { kind: 'p', text: 'Podemos rechazar una solicitud, por ejemplo si faltan datos o no son veraces.' },
        { kind: 'p', text: 'Mientras no aprobemos tu solicitud, no tienes cuenta.' },
        { kind: 'p', text: 'Al aprobarla, te enviamos por correo tu usuario y una contraseña temporal.' },
        { kind: 'p', text: 'Aceptar estos términos y el Aviso de Privacidad es parte del registro.' },
      ],
    },
    {
      id: 'cuentas-y-contrasenas',
      title: 'Cuentas y contraseñas',
      blocks: [
        { kind: 'p', text: 'La contraseña temporal es solo para entrar la primera vez. Debes cambiarla.' },
        { kind: 'p', text: 'No la compartas. Cada persona debe tener su propio acceso.' },
        { kind: 'p', text: 'Tú respondes de lo que se haga con tu cuenta.' },
        { kind: 'p', text: 'Si crees que alguien entró sin permiso, cambia tu contraseña y avísanos.' },
        { kind: 'p', text: 'Cada dispositivo tiene un código de activación de un solo uso. Guárdalo bien.' },
      ],
    },
    {
      id: 'uso-aceptable',
      title: 'Uso aceptable',
      blocks: [
        { kind: 'p', text: 'Usa el sistema solo para tu negocio y de forma legal.' },
        { kind: 'p', text: 'No puedes:' },
        {
          kind: 'list',
          items: [
            'Capturar datos falsos.',
            'Entrar a cuentas o datos de otros negocios.',
            'Intentar dañar el sistema, saturarlo o saltarte su seguridad.',
            'Copiar, revender u ofrecer el sistema a otras personas.',
            'Escribir datos sensibles en las notas.',
            'Usarlo para actividades ilegales.',
          ],
        },
      ],
    },
    {
      id: 'tus-datos',
      title: 'Tus datos',
      blocks: [
        { kind: 'p', text: 'Los datos de tu negocio son de tu negocio. Tú decides qué capturas.' },
        { kind: 'p', text: 'Nosotros los usamos solo para darte el servicio, como dice el Aviso de Privacidad.' },
        { kind: 'p', text: 'Puedes pedir la eliminación de tus datos personales. El Aviso de Privacidad explica cómo.' },
      ],
    },
    {
      id: 'datos-de-tus-clientes',
      title: 'Datos de tus clientes',
      blocks: [
        { kind: 'p', text: 'Si capturas datos de tus clientes, como tus deudores, tu negocio es el responsable de ellos.' },
        { kind: 'p', text: 'Debes tener derecho a usarlos y avisar a tus clientes cómo los usas.' },
        { kind: 'p', text: 'Respondes ante ellos y ante la ley por ese uso.' },
        { kind: 'p', text: 'La Marchanta solo los procesa por tu cuenta. Lee Datos de tus clientes en el Aviso de Privacidad.' },
      ],
    },
    {
      id: 'disponibilidad-y-respaldos',
      title: 'Disponibilidad y respaldos',
      blocks: [
        { kind: 'p', text: 'No garantizamos un servicio continuo ni sin errores.' },
        { kind: 'p', text: 'Puede haber cortes, fallas o mantenimiento sin aviso.' },
        { kind: 'p', text: 'No garantizamos respaldos de tus datos. Descarga tus reportes con frecuencia.' },
      ],
    },
    {
      id: 'limitacion-de-responsabilidad',
      title: 'Limitación de responsabilidad',
      blocks: [
        { kind: 'p', text: 'Usas el sistema bajo tu propio riesgo, porque está en piloto.' },
        { kind: 'p', text: 'No somos responsables de ventas, ganancias o datos perdidos por fallas del sistema o de internet.' },
        { kind: 'p', text: 'Tampoco de las decisiones que tomes con los datos del sistema.' },
        { kind: 'p', text: 'Esto aplica hasta donde la ley lo permita.' },
        { kind: 'p', text: 'Nada de esto limita los derechos que la ley no te deja renunciar.' },
      ],
    },
    {
      id: 'propiedad-del-software-y-la-marca',
      title: 'Propiedad del software y la marca',
      blocks: [
        { kind: 'p', text: 'El software, el diseño y la marca La Marchanta son del responsable.' },
        { kind: 'p', text: 'Te damos permiso de usarlos mientras tengas cuenta, solo para tu negocio.' },
        { kind: 'p', text: 'Ese permiso no te da su propiedad.' },
      ],
    },
    {
      id: 'suspension-y-cierre-de-cuenta',
      title: 'Suspensión y cierre de cuenta',
      blocks: [
        { kind: 'p', text: 'Podemos suspender o cerrar tu cuenta si incumples estos términos o pones en riesgo el sistema.' },
        { kind: 'p', text: 'También si dejamos de ofrecer el piloto.' },
        { kind: 'p', text: `Puedes pedir el cierre de tu cuenta cuando quieras. Escribe a ${email}.` },
        { kind: 'p', text: 'Al cerrarla dejamos de usar tus datos. Si lo pides, los eliminamos o los anonimizamos.' },
        { kind: 'p', text: 'Conservamos solo lo que la ley nos obligue a conservar.' },
        { kind: 'p', text: 'Antes de cerrar, te recomendamos descargar tus reportes.' },
      ],
    },
    {
      id: 'cambios-a-estos-terminos',
      title: 'Cambios a estos términos',
      blocks: [
        { kind: 'p', text: 'Podemos cambiar estos términos. Publicamos la nueva versión aquí, con su fecha.' },
        { kind: 'p', text: 'Si sigues usando el sistema después del cambio, lo aceptas.' },
        { kind: 'p', text: 'Si no estás de acuerdo, puedes pedir el cierre de tu cuenta.' },
      ],
    },
    {
      id: 'ley-aplicable-y-jurisdiccion',
      title: 'Ley aplicable y jurisdicción',
      blocks: [
        { kind: 'p', text: 'Estos términos se rigen por las leyes de México.' },
        { kind: 'p', text: `Para cualquier conflicto, las partes se someten a ${LEGAL_JURISDICTION}.` },
        { kind: 'p', text: 'Elegimos esos tribunales por el domicilio del responsable.' },
      ],
    },
    {
      id: 'contacto',
      title: 'Contacto',
      blocks: [
        { kind: 'p', text: `Para cualquier duda escribe a ${email}.` },
        { kind: 'p', text: `Responsable: ${LEGAL_RESPONSIBLE.name}, ${LEGAL_RESPONSIBLE.address}.` },
        { kind: 'p', text: 'Lee también el Aviso de Privacidad.' },
      ],
    },
  ],
}
