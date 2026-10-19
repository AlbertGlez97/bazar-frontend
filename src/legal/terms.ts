// Términos y Condiciones de Uso de La Marchanta, como datos tipados.
// Lo que dicen del servicio sale de lo que el sistema hace hoy (doc/legal/inventario-datos.md);
// las decisiones de negocio y los supuestos están en doc/legal/preguntas-para-abogado.md.
// Datos del responsable y jurisdicción: legal-config.ts. Si cambia el texto, sube
// LEGAL_VERSION en versions.ts.

import { list, section } from './blocks'
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
    section(
      'que-es-el-servicio',
      '¿Qué es el servicio?',
      `La Marchanta es un sistema web que ofrece ${LEGAL_RESPONSIBLE.name}, ${LEGAL_RESPONSIBLE.kind}.`,
      'Sirve para llevar el catálogo, las ventas, los fiados y apartados, los gastos y los reportes de un negocio.',
      'Está en piloto. Eso quiere decir que lo probamos con pocos negocios.',
      'Puede cambiar, tener errores o dejar de ofrecerse.',
      'No procesa pagos ni cobra por ti. Solo registra lo que tú cobras.',
      'Es un apoyo para tu negocio. No sustituye una asesoría contable, fiscal ni legal.',
    ),
    section(
      'quien-puede-registrarse',
      '¿Quién puede registrarse?',
      'Puede registrarse una persona mayor de edad que dirija un negocio o tenga permiso de quien lo dirige.',
      'Los datos que das deben ser veraces y estar al día. Si cambian, avísanos.',
      'Tu correo debe ser tuyo y poder recibir mensajes.',
    ),
    section(
      'aprobacion-manual',
      'Aprobación manual',
      'Revisamos cada solicitud a mano. Eso puede tardar.',
      'Podemos rechazar una solicitud, por ejemplo si faltan datos o no son veraces.',
      'Mientras no aprobemos tu solicitud, no tienes cuenta.',
      'Al aprobarla, te enviamos por correo tu usuario y una contraseña temporal.',
      'Aceptar estos términos y el Aviso de Privacidad es parte del registro.',
    ),
    section(
      'cuentas-y-contrasenas',
      'Cuentas y contraseñas',
      'La contraseña temporal es solo para entrar la primera vez. Debes cambiarla.',
      'No la compartas. Cada persona debe tener su propio acceso.',
      'Tú respondes de lo que se haga con tu cuenta.',
      'Si crees que alguien entró sin permiso, cambia tu contraseña y avísanos.',
      'Cada dispositivo tiene un código de activación de un solo uso. Guárdalo bien.',
    ),
    section(
      'uso-aceptable',
      'Uso aceptable',
      'Usa el sistema solo para tu negocio y de forma legal.',
      'No puedes:',
      list([
        'Capturar datos falsos.',
        'Entrar a cuentas o datos de otros negocios.',
        'Intentar dañar el sistema, saturarlo o saltarte su seguridad.',
        'Copiar, revender u ofrecer el sistema a otras personas.',
        'Escribir datos sensibles en las notas.',
        'Usarlo para actividades ilegales.',
      ]),
    ),
    section(
      'tus-datos',
      'Tus datos',
      'Los datos de tu negocio son de tu negocio. Tú decides qué capturas.',
      'Nosotros los usamos solo para darte el servicio, como dice el Aviso de Privacidad.',
      'Puedes pedir la eliminación de tus datos personales. El Aviso de Privacidad explica cómo.',
    ),
    section(
      'datos-de-tus-clientes',
      'Datos de tus clientes',
      'Si capturas datos de tus clientes, como tus deudores, tu negocio es el responsable de ellos.',
      'Debes tener derecho a usarlos y avisar a tus clientes cómo los usas.',
      'Respondes ante ellos y ante la ley por ese uso.',
      'La Marchanta solo los procesa por tu cuenta. Lee Datos de tus clientes en el Aviso de Privacidad.',
    ),
    section(
      'disponibilidad-y-respaldos',
      'Disponibilidad y respaldos',
      'No garantizamos un servicio continuo ni sin errores.',
      'Puede haber cortes, fallas o mantenimiento sin aviso.',
      'No garantizamos respaldos de tus datos. Descarga tus reportes con frecuencia.',
    ),
    section(
      'limitacion-de-responsabilidad',
      'Limitación de responsabilidad',
      'Usas el sistema bajo tu propio riesgo, porque está en piloto.',
      'No somos responsables de ventas, ganancias o datos perdidos por fallas del sistema o de internet.',
      'Tampoco de las decisiones que tomes con los datos del sistema.',
      'Esto aplica hasta donde la ley lo permita.',
      'Nada de esto limita los derechos que la ley no te deja renunciar.',
    ),
    section(
      'propiedad-del-software-y-la-marca',
      'Propiedad del software y la marca',
      'El software, el diseño y la marca La Marchanta son del responsable.',
      'Te damos permiso de usarlos mientras tengas cuenta, solo para tu negocio.',
      'Ese permiso no te da su propiedad.',
    ),
    section(
      'suspension-y-cierre-de-cuenta',
      'Suspensión y cierre de cuenta',
      'Podemos suspender o cerrar tu cuenta si incumples estos términos o pones en riesgo el sistema.',
      'También si dejamos de ofrecer el piloto.',
      `Puedes pedir el cierre de tu cuenta cuando quieras. Escribe a ${email}.`,
      'Al cerrarla dejamos de usar tus datos. Si lo pides, los eliminamos o los anonimizamos.',
      'Conservamos solo lo que la ley nos obligue a conservar.',
      'Antes de cerrar, te recomendamos descargar tus reportes.',
    ),
    section(
      'cambios-a-estos-terminos',
      'Cambios a estos términos',
      'Podemos cambiar estos términos. Publicamos la nueva versión aquí, con su fecha.',
      'Si sigues usando el sistema después del cambio, lo aceptas.',
      'Si no estás de acuerdo, puedes pedir el cierre de tu cuenta.',
    ),
    section(
      'ley-aplicable-y-jurisdiccion',
      'Ley aplicable y jurisdicción',
      'Estos términos se rigen por las leyes de México.',
      `Para cualquier conflicto, las partes se someten a ${LEGAL_JURISDICTION}.`,
      'Elegimos esos tribunales por el domicilio del responsable.',
    ),
    section(
      'contacto',
      'Contacto',
      `Para cualquier duda escribe a ${email}.`,
      `Responsable: ${LEGAL_RESPONSIBLE.name}, ${LEGAL_RESPONSIBLE.address}.`,
      'Lee también el Aviso de Privacidad.',
    ),
  ],
}
