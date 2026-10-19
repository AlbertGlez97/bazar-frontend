// Aviso de Privacidad integral de La Marchanta, como datos tipados.
//
// Cada afirmación se rastrea a doc/legal/inventario-datos.md (esquema y código) o a una
// decisión del responsable; lo que no se pudo comprobar está en
// doc/legal/preguntas-para-abogado.md. Nombres, correo, domicilio y plazos salen de
// legal-config.ts. Frases de 20 palabras o menos (lo vigila legal-documents.test.ts).
// Si cambia el texto, sube LEGAL_VERSION en versions.ts.

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
    {
      id: 'quien-es-el-responsable',
      title: '¿Quién es el responsable?',
      blocks: [
        { kind: 'p', text: `${LEGAL_RESPONSIBLE.name}, ${LEGAL_RESPONSIBLE.kind}, es responsable de tus datos personales.` },
        { kind: 'p', text: `Su domicilio es ${LEGAL_RESPONSIBLE.address}.` },
        { kind: 'p', text: `Para cualquier tema de privacidad escribe a ${email}.` },
        { kind: 'p', text: 'En este aviso, La Marchanta es el sistema que ofrece el responsable.' },
      ],
    },
    {
      id: 'que-datos-recabamos',
      title: '¿Qué datos recabamos?',
      blocks: [
        { kind: 'h3', text: 'Cuando pides el registro de tu negocio' },
        {
          kind: 'list',
          items: [
            'El nombre del negocio, el tipo de negocio, qué vende y dónde vende. Este último dato es opcional.',
            'Tu nombre y apellidos.',
            'Tu correo. Lo confirmas con un enlace que te enviamos.',
            'Tu teléfono o WhatsApp.',
            'Quién te recomendó el sistema. Es opcional.',
            'Que aceptaste este aviso y los términos, con la fecha y la versión en que los aceptaste.',
            'Datos técnicos de la verificación de seguridad de esa página: tu dirección IP y señales de tu navegador.',
          ],
        },
        { kind: 'h3', text: 'Cuando usas el sistema' },
        {
          kind: 'list',
          items: [
            'El nombre, el usuario de acceso y el rol (socio o colaborador) de cada persona del negocio.',
            'Los identificadores de tus dispositivos: su nombre y un código de activación de un solo uso.',
            'Tu actividad de venta: quién vendió qué y cuándo, con qué método de pago y por cuánto.',
            'Los datos de tu negocio: productos, costos, ventas y deudas.',
            'Si los registras, también tus gastos, aportaciones, jornadas de trabajo y acuerdos de reparto.',
            'Datos técnicos de la conexión, como tu dirección IP, que el servidor recibe para responderte.',
          ],
        },
        { kind: 'h3', text: 'Datos de otras personas' },
        {
          kind: 'p',
          text: 'Si registras fiados o apartados, guardas el nombre, teléfono y notas de tus deudores. Mira la sección Datos de tus clientes.',
        },
        { kind: 'h3', text: 'Datos sensibles y patrimoniales' },
        {
          kind: 'p',
          text: 'No pedimos datos sensibles. Son los que tocan tu vida íntima, como salud, origen étnico, creencias, opiniones políticas o preferencia sexual.',
        },
        {
          kind: 'p',
          text: 'Las notas son texto libre. No los escribas ahí, ni los tuyos ni los de tus clientes.',
        },
        {
          kind: 'p',
          text: 'Tus aportaciones, gastos y acuerdos son datos patrimoniales. Al capturarlos nos das tu consentimiento expreso para guardarlos.',
        },
      ],
    },
    {
      id: 'para-que-usamos-tus-datos',
      title: '¿Para qué usamos tus datos?',
      blocks: [
        { kind: 'h3', text: 'Finalidades necesarias' },
        {
          kind: 'list',
          items: [
            'Revisar tu solicitud de registro y decidir si la aprobamos.',
            'Confirmar tu correo y enviarte tu usuario y tu contraseña temporal.',
            'Crear y mantener tu cuenta, tus dispositivos y tu negocio dentro del sistema.',
            'Darte el servicio: registrar ventas, productos, deudas, gastos y reportes.',
            'Saber quién hizo cada operación, para que tu negocio pueda revisarla.',
            'Cuidar la seguridad del sistema y evitar usos indebidos.',
            'Comprobar que quien se registra es una persona y no un programa automático.',
            'Atender tus dudas y el ejercicio de tus derechos.',
            'Cumplir obligaciones legales.',
          ],
        },
        { kind: 'p', text: 'Sin estas finalidades no podemos darte el servicio.' },
        { kind: 'h3', text: 'Finalidades voluntarias' },
        {
          kind: 'list',
          items: [
            'Escribirte para pedirte tu opinión sobre el piloto.',
            'Avisarte de mejoras y cambios del sistema.',
            'Saber quién te recomendó el sistema y cómo lo conociste.',
          ],
        },
        { kind: 'p', text: 'Puedes negarte a estas finalidades cuando quieras. Tu cuenta funciona igual.' },
      ],
    },
    {
      id: 'con-quien-compartimos-tus-datos',
      title: '¿Con quién compartimos tus datos?',
      blocks: [
        { kind: 'p', text: 'No vendemos tus datos. No los usamos para publicidad.' },
        { kind: 'p', text: 'Para que el sistema funcione, intervienen estos proveedores técnicos.' },
        {
          kind: 'list',
          items: [
            'Resend envía por correo tu usuario y tu contraseña temporal. Recibe tu correo y esos datos solo para entregarlos.',
            'Cloudflare entrega el sitio y protege la conexión. Por su red pasa el tráfico y ve tu dirección IP.',
            'Cloudflare Turnstile hace la verificación de seguridad de la página de registro. Se carga desde Cloudflare y recibe tu dirección IP y señales técnicas de tu navegador.',
            'Google Fonts da las letras del sitio. Tu navegador se las pide y Google recibe tu dirección IP.',
            'El servidor donde vive el sistema, que administra el responsable.',
          ],
        },
        { kind: 'p', text: 'Los usamos solo para hacer funcionar el sistema. Pueden estar en otros países.' },
        { kind: 'p', text: 'También podemos dar datos a una autoridad si una ley o una orden legal lo exige.' },
      ],
    },
    {
      id: 'limitar-el-uso',
      title: '¿Cómo limitar el uso de tus datos?',
      blocks: [
        { kind: 'p', text: `Escribe a ${email} y dinos qué finalidades voluntarias no quieres.` },
        { kind: 'p', text: 'Dejaremos de usar tus datos para eso. Tu cuenta seguirá funcionando.' },
        { kind: 'p', text: 'Si ya no quieres recibir mensajes de nosotros, dilo en el mismo correo.' },
      ],
    },
    {
      id: 'derechos-arco',
      title: 'Tus derechos ARCO',
      blocks: [
        {
          kind: 'p',
          text: 'Puedes acceder a tus datos, rectificarlos, cancelarlos u oponerte a su uso. Son los derechos ARCO.',
        },
        {
          kind: 'list',
          items: [
            'Acceso: saber qué datos tuyos tenemos y cómo los usamos.',
            'Rectificación: corregir datos incorrectos o incompletos.',
            'Cancelación: pedir que borremos tus datos.',
            'Oposición: pedir que dejemos de usarlos para un fin.',
          ],
        },
        { kind: 'h3', text: 'Cómo ejercerlos' },
        { kind: 'p', text: `Escribe a ${email}.` },
        { kind: 'p', text: 'Ejercer tus derechos es gratis. Solo podríamos cobrarte copias o el envío.' },
        { kind: 'h3', text: 'Qué incluir en tu mensaje' },
        {
          kind: 'list',
          items: [
            'Tu nombre completo y el correo con el que te registraste.',
            'Qué derecho quieres ejercer.',
            'Una descripción clara de los datos de los que hablas.',
            'Un documento que pruebe quién eres, si te lo pedimos.',
            'Si actúas por otra persona, un documento que lo pruebe.',
          ],
        },
        { kind: 'h3', text: 'Plazos' },
        { kind: 'p', text: `Te respondemos en un máximo de ${days(ARCO.responseDays)}.` },
        { kind: 'p', text: `Si tu solicitud procede, la hacemos efectiva en los ${days(ARCO.effectDays)} siguientes.` },
        { kind: 'p', text: 'Podemos ampliar cada plazo una sola vez, por el mismo tiempo. Si lo hacemos, te avisamos.' },
        { kind: 'p', text: 'Algunos datos debemos conservarlos por ley. En ese caso te explicamos por qué.' },
      ],
    },
    {
      id: 'revocar-tu-consentimiento',
      title: 'Revocar tu consentimiento',
      blocks: [
        { kind: 'p', text: 'Puedes revocar tu consentimiento cuando quieras. No afecta lo que hicimos antes.' },
        { kind: 'p', text: `Escribe a ${email}.` },
        { kind: 'p', text: 'Si revocas lo necesario para el servicio, no podremos seguir dándotelo.' },
        { kind: 'p', text: 'Te diremos qué datos eliminamos y cuáles debemos conservar por ley.' },
      ],
    },
    {
      id: 'cuanto-tiempo-guardamos-tus-datos',
      title: '¿Cuánto tiempo guardamos tus datos?',
      blocks: [
        {
          kind: 'list',
          items: [
            `Solicitudes de registro sin confirmar el correo: ${days(RETENTION.unconfirmedRegistrationDays)}.`,
            `Solicitudes rechazadas o vencidas: ${days(RETENTION.rejectedOrExpiredRegistrationDays)}.`,
            'Cuentas activas: mientras la cuenta esté activa.',
            'Si lo pides: eliminamos o anonimizamos tus datos personales.',
          ],
        },
        { kind: 'p', text: 'Conservamos lo que la ley nos obligue a conservar, aunque pidas borrarlo.' },
        { kind: 'p', text: 'A veces anonimizamos en lugar de borrar, para no perder los registros del negocio.' },
      ],
    },
    {
      id: 'como-cuidamos-tus-datos',
      title: '¿Cómo cuidamos tus datos?',
      blocks: [
        { kind: 'p', text: 'Esto es lo que hacemos hoy.' },
        {
          kind: 'list',
          items: [
            'No guardamos tu contraseña. Guardamos solo una huella (argon2id) que no permite recuperarla.',
            'El sitio usa HTTPS, que cifra la conexión de tu navegador.',
            'Cada negocio ve solo sus datos. Los separamos en el programa y también en la base de datos.',
            'El enlace para aprobar un registro es de un solo uso y tiene fecha de vencimiento.',
            'Del código secreto de cada dispositivo guardamos solo una huella, no el código.',
            'La contraseña temporal que te enviamos por correo debes cambiarla al entrar.',
          ],
        },
        { kind: 'p', text: 'No podemos prometer que nunca habrá un fallo ni un acceso indebido.' },
        { kind: 'p', text: 'Si una vulneración afecta tus derechos, te lo avisaremos.' },
      ],
    },
    {
      id: 'almacenamiento-del-navegador',
      title: '¿Qué guarda tu navegador?',
      blocks: [
        { kind: 'p', text: 'La Marchanta guarda información en tu dispositivo para funcionar, también sin conexión.' },
        {
          kind: 'list',
          items: [
            'localStorage: tu sesión, tu usuario, el dispositivo registrado y tus preferencias de pantalla.',
            'sessionStorage: la persona que atiende en ese equipo, hasta que cierras la pestaña.',
            'IndexedDB: las ventas y otros registros hechos sin conexión que aún no se envían, y una copia del catálogo.',
            'Caché de la app: archivos del sistema y respuestas recientes de unos minutos, para cargar más rápido.',
          ],
        },
        {
          kind: 'p',
          text: 'La app no crea cookies propias. Cloudflare podría usar cookies técnicas suyas para proteger el sitio.',
        },
        { kind: 'p', text: 'Al cerrar sesión se borra tu sesión. Lo demás lo puedes borrar desde los ajustes de tu navegador.' },
      ],
    },
    {
      id: 'datos-de-tus-clientes',
      title: 'Datos de tus clientes',
      blocks: [
        {
          kind: 'p',
          text: 'Si registras un fiado o un apartado, guardas los datos de tus deudores: el nombre, el teléfono y las notas.',
        },
        { kind: 'p', text: 'Tu negocio es el responsable de esos datos. Tú decides para qué los usas.' },
        { kind: 'p', text: 'La Marchanta solo los procesa por su cuenta: los guarda y se los muestra a tu negocio.' },
        { kind: 'p', text: 'No los usamos para otros fines. Solo los ven los proveedores técnicos de este aviso.' },
        { kind: 'p', text: 'Tu negocio debe avisar a sus clientes cómo usa sus datos. La ayuda del sistema trae un ejemplo breve.' },
        { kind: 'p', text: 'Pide solo los datos que necesitas. No escribas datos sensibles de tus clientes.' },
        { kind: 'p', text: 'Si un cliente tuyo quiere ejercer sus derechos, primero debe pedírtelo a ti.' },
        { kind: 'p', text: 'Si nos escribe a nosotros, le diremos que se dirija a tu negocio.' },
      ],
    },
    {
      id: 'cambios-al-aviso',
      title: 'Cambios al aviso',
      blocks: [
        { kind: 'p', text: 'Si cambiamos este aviso, lo publicamos aquí con su nueva fecha y versión.' },
        { kind: 'p', text: 'Arriba siempre ves la versión y la fecha que están vigentes.' },
        { kind: 'p', text: 'Si cambian las finalidades, te pediremos tu consentimiento otra vez.' },
      ],
    },
    {
      id: 'autoridad-competente',
      title: 'Autoridad competente',
      blocks: [
        {
          kind: 'p',
          text: 'La autoridad que protege los datos personales en México es la Secretaría Anticorrupción y Buen Gobierno.',
        },
        { kind: 'p', text: 'Si crees que no respetamos tus derechos, puedes acudir a ella.' },
        { kind: 'p', text: 'Conviene que antes nos escribas a nosotros.' },
      ],
    },
  ],
}
