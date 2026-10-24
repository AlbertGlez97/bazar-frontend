// Aviso de Privacidad integral de La Marchanta, como datos tipados.
//
// Cada afirmación se rastrea a doc/legal/inventario-datos.md (esquema y código) o a una
// decisión del responsable; lo que no se pudo comprobar está en
// doc/legal/preguntas-para-abogado.md. Nombres, correo, domicilio y plazos salen de
// legal-config.ts. Frases de 20 palabras o menos (lo vigila legal-documents.test.ts).
// Si cambia el texto, sube LEGAL_VERSION en versions.ts.

import { h3, list, section } from './blocks'
import { ARCO, LEGAL_CONTACT_EMAIL, LEGAL_RESPONSIBLE, RETENTION } from './legal-config'
import type { LegalDocumentData } from './types'

const days = (count: number) => `${count} días`
const email = LEGAL_CONTACT_EMAIL

export const PRIVACY_NOTICE: LegalDocumentData = {
  id: 'privacidad',
  title: 'Aviso de Privacidad',
  summary: [
    `${LEGAL_RESPONSIBLE.name} es la persona responsable de tus datos personales en La Marchanta.`,
    'Pedimos datos para registrar tu negocio, crear tu cuenta y darte el servicio. No pedimos datos sensibles.',
    'No vendemos tus datos. Solo los ven los proveedores técnicos que hacen funcionar el sistema.',
    `Puedes pedir acceso, rectificación, cancelación u oposición escribiendo a ${email}.`,
    'Guardamos tus datos solo el tiempo que explica este aviso. Si lo cambiamos, lo publicamos con fecha y versión.',
  ],
  sections: [
    section(
      'quien-es-el-responsable',
      '¿Quién es el responsable?',
      `${LEGAL_RESPONSIBLE.name}, ${LEGAL_RESPONSIBLE.kind}, es responsable de tus datos personales.`,
      `Su domicilio es ${LEGAL_RESPONSIBLE.address}.`,
      `Para cualquier tema de privacidad escribe a ${email}.`,
      'En este aviso, La Marchanta es el sistema que ofrece el responsable.',
    ),
    section(
      'que-datos-recabamos',
      '¿Qué datos recabamos?',
      h3('Cuando pides el registro de tu negocio'),
      list([
        'El nombre del negocio, el tipo de negocio, qué vende y dónde vende. Este último dato es opcional.',
        'Tu nombre y apellidos.',
        'Tu correo. Lo confirmas con un enlace que te enviamos.',
        'Tu teléfono o WhatsApp.',
        'Quién te recomendó el sistema. Es opcional.',
        'Que aceptaste este aviso y los términos, con la fecha y la versión en que los aceptaste.',
        'Datos técnicos de la verificación de seguridad de esa página: tu dirección IP y señales de tu navegador.',
      ]),
      h3('Cuando usas el sistema'),
      list([
        'El nombre, el usuario de acceso y el rol (socio o colaborador) de cada persona del negocio.',
        'Los identificadores de tus dispositivos: su nombre y un código de activación de un solo uso.',
        'Tu actividad de venta: quién vendió qué y cuándo, con qué método de pago y por cuánto.',
        'Los datos de tu negocio: productos, costos, ventas y deudas.',
        'Si los registras, también tus gastos, aportaciones, jornadas de trabajo y acuerdos de reparto.',
        'Datos técnicos de la conexión, como tu dirección IP, que el servidor recibe para responderte.',
      ]),
      h3('Datos de otras personas'),
      'Si registras fiados o apartados, guardas el nombre, teléfono y notas de tus deudores. Mira la sección Datos de tus clientes.',
      h3('Datos sensibles y patrimoniales'),
      'No pedimos datos sensibles. Son los que tocan tu vida íntima, como salud, origen étnico, creencias, opiniones políticas o preferencia sexual.',
      'Las notas son texto libre. No los escribas ahí, ni los tuyos ni los de tus clientes.',
      'Tus aportaciones, gastos y acuerdos son datos patrimoniales. Al capturarlos nos das tu consentimiento expreso para guardarlos.',
    ),
    section(
      'para-que-usamos-tus-datos',
      '¿Para qué usamos tus datos?',
      h3('Finalidades necesarias'),
      list([
        'Revisar tu solicitud de registro y decidir si la aprobamos.',
        'Confirmar tu correo y enviarte tu usuario y tu contraseña temporal.',
        'Crear y mantener tu cuenta, tus dispositivos y tu negocio dentro del sistema.',
        'Darte el servicio: registrar ventas, productos, deudas, gastos y reportes.',
        'Saber quién hizo cada operación, para que tu negocio pueda revisarla.',
        'Cuidar la seguridad del sistema y evitar usos indebidos.',
        'Comprobar que quien se registra es una persona y no un programa automático.',
        'Atender tus dudas y el ejercicio de tus derechos.',
        'Cumplir obligaciones legales.',
      ]),
      'Sin estas finalidades no podemos darte el servicio.',
      h3('Finalidades voluntarias'),
      list([
        'Escribirte para pedirte tu opinión sobre el piloto.',
        'Avisarte de mejoras y cambios del sistema.',
        'Saber quién te recomendó el sistema y cómo lo conociste.',
      ]),
      'Puedes negarte a estas finalidades cuando quieras. Tu cuenta funciona igual.',
    ),
    section(
      'con-quien-compartimos-tus-datos',
      '¿Con quién compartimos tus datos?',
      'No vendemos tus datos. No los usamos para publicidad.',
      'Para que el sistema funcione, intervienen estos proveedores técnicos.',
      list([
        'Resend envía por correo tu usuario y tu contraseña temporal. Recibe tu correo y esos datos solo para entregarlos.',
        'Cloudflare entrega el sitio y protege la conexión. Por su red pasa el tráfico y ve tu dirección IP.',
        'Cloudflare Turnstile hace la verificación de seguridad de la página de registro. Se carga desde Cloudflare y recibe tu dirección IP y señales técnicas de tu navegador.',
        'Google Fonts da las letras del sitio. Tu navegador se las pide y Google recibe tu dirección IP.',
        'El servidor donde vive el sistema, que administra el responsable.',
      ]),
      'Los usamos solo para hacer funcionar el sistema. Pueden estar en otros países.',
      'También podemos dar datos a una autoridad si una ley o una orden legal lo exige.',
    ),
    section(
      'limitar-el-uso',
      '¿Cómo limitar el uso de tus datos?',
      `Escribe a ${email} y dinos qué finalidades voluntarias no quieres.`,
      'Dejaremos de usar tus datos para eso. Tu cuenta seguirá funcionando.',
      'Si ya no quieres recibir mensajes de nosotros, dilo en el mismo correo.',
    ),
    section(
      'derechos-arco',
      'Tus derechos ARCO',
      'Puedes acceder a tus datos, rectificarlos, cancelarlos u oponerte a su uso. Son los derechos ARCO.',
      list([
        'Acceso: saber qué datos tuyos tenemos y cómo los usamos.',
        'Rectificación: corregir datos incorrectos o incompletos.',
        'Cancelación: pedir que borremos tus datos.',
        'Oposición: pedir que dejemos de usarlos para un fin.',
      ]),
      h3('Cómo ejercerlos'),
      `Escribe a ${email}.`,
      'Ejercer tus derechos es gratis. Solo podríamos cobrarte copias o el envío.',
      h3('Qué incluir en tu mensaje'),
      list([
        'Tu nombre completo y el correo con el que te registraste.',
        'Qué derecho quieres ejercer.',
        'Una descripción clara de los datos de los que hablas.',
        'Un documento que pruebe quién eres, si te lo pedimos.',
        'Si actúas por otra persona, un documento que lo pruebe.',
      ]),
      h3('Plazos'),
      `Te respondemos en un máximo de ${days(ARCO.responseDays)}.`,
      `Si tu solicitud procede, la hacemos efectiva en los ${days(ARCO.effectDays)} siguientes.`,
      'Podemos ampliar cada plazo una sola vez, por el mismo tiempo. Si lo hacemos, te avisamos.',
      'Algunos datos debemos conservarlos por ley. En ese caso te explicamos por qué.',
    ),
    section(
      'revocar-tu-consentimiento',
      'Revocar tu consentimiento',
      'Puedes revocar tu consentimiento cuando quieras. No afecta lo que hicimos antes.',
      `Escribe a ${email}.`,
      'Si revocas lo necesario para el servicio, no podremos seguir dándotelo.',
      'Te diremos qué datos eliminamos y cuáles debemos conservar por ley.',
    ),
    section(
      'cuanto-tiempo-guardamos-tus-datos',
      '¿Cuánto tiempo guardamos tus datos?',
      list([
        `Solicitudes de registro sin confirmar el correo: ${days(RETENTION.unconfirmedRegistrationDays)}.`,
        `Solicitudes rechazadas o vencidas: ${days(RETENTION.rejectedOrExpiredRegistrationDays)}.`,
        'Cuentas activas: mientras la cuenta esté activa.',
        'Si lo pides: eliminamos o anonimizamos tus datos personales.',
      ]),
      'Conservamos lo que la ley nos obligue a conservar, aunque pidas borrarlo.',
      'A veces anonimizamos en lugar de borrar, para no perder los registros del negocio.',
    ),
    section(
      'como-cuidamos-tus-datos',
      '¿Cómo cuidamos tus datos?',
      'Esto es lo que hacemos hoy.',
      list([
        'No guardamos tu contraseña. Guardamos solo una huella (argon2id) que no permite recuperarla.',
        'El sitio usa HTTPS, que cifra la conexión de tu navegador.',
        'Cada negocio ve solo sus datos. Los separamos en el programa y también en la base de datos.',
        'El enlace para aprobar un registro es de un solo uso y tiene fecha de vencimiento.',
        'Del código secreto de cada dispositivo guardamos solo una huella, no el código.',
        'La contraseña temporal que te enviamos por correo debes cambiarla al entrar.',
      ]),
      'No podemos prometer que nunca habrá un fallo ni un acceso indebido.',
      'Si una vulneración afecta tus derechos, te lo avisaremos.',
    ),
    section(
      'almacenamiento-del-navegador',
      '¿Qué guarda tu navegador?',
      'La Marchanta guarda información en tu dispositivo para funcionar, también sin conexión.',
      list([
        'localStorage: tu sesión, tu usuario, el dispositivo registrado y tus preferencias de pantalla.',
        'IndexedDB: las ventas y otros registros hechos sin conexión que aún no se envían, y una copia del catálogo.',
        'Caché de la app: archivos del sistema y respuestas recientes de unos minutos, para cargar más rápido.',
      ]),
      'La app no crea cookies propias. Cloudflare podría usar cookies técnicas suyas para proteger el sitio.',
      'Al cerrar sesión se borra tu sesión. Lo demás lo puedes borrar desde los ajustes de tu navegador.',
    ),
    section(
      'datos-de-tus-clientes',
      'Datos de tus clientes',
      'Si registras un fiado o un apartado, guardas los datos de tus deudores: el nombre, el teléfono y las notas.',
      'Tu negocio es el responsable de esos datos. Tú decides para qué los usas.',
      'La Marchanta solo los procesa por su cuenta: los guarda y se los muestra a tu negocio.',
      'No los usamos para otros fines. Solo los ven los proveedores técnicos de este aviso.',
      'Tu negocio debe avisar a sus clientes cómo usa sus datos. La ayuda del sistema trae un ejemplo breve.',
      'Pide solo los datos que necesitas. No escribas datos sensibles de tus clientes.',
      'Si un cliente tuyo quiere ejercer sus derechos, primero debe pedírtelo a ti.',
      'Si nos escribe a nosotros, le diremos que se dirija a tu negocio.',
    ),
    section(
      'cambios-al-aviso',
      'Cambios al aviso',
      'Si cambiamos este aviso, lo publicamos aquí con su nueva fecha y versión.',
      'Arriba siempre ves la versión y la fecha que están vigentes.',
      'Si cambian las finalidades, te pediremos tu consentimiento otra vez.',
    ),
    section(
      'autoridad-competente',
      'Autoridad competente',
      'La autoridad que protege los datos personales en México es la Secretaría Anticorrupción y Buen Gobierno.',
      'Si crees que no respetamos tus derechos, puedes acudir a ella.',
      'Conviene que antes nos escribas a nosotros.',
    ),
  ],
}
