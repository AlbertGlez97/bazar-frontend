# Preguntas y supuestos para la revisión del abogado

Versión de los textos: `2026-10-16`. Los textos de `/privacidad` y `/terminos` **no han sido revisados por un abogado**; este documento junta lo que necesita su revisión. Nada de lo publicado afirma lo contrario. Las constantes viven en `src/legal/legal-config.ts` (los comentarios "provisional, revisar con abogado" marcan cada una); el contenido de cada afirmación está trazado en `inventario-datos.md` y las fuentes en `fuentes-consultadas.md`.

## 1. Datos del responsable

1. **Domicilio.** Se puso `Acolman, Estado de México` (provisional). ¿Basta el municipio o la ley exige domicilio completo en el aviso?
2. **Persona física responsable.** El responsable es Juan Alberto González de la Cruz, persona física. ¿Hay algo que cambiar (registro fiscal, nombre comercial, alta como responsable) si en el futuro se constituye una persona moral?
3. **Correo.** El correo de contacto y de privacidad es una cuenta personal (`albert.gonzalez0297@gmail.com`). ¿Es aceptable como medio para derechos ARCO?

## 2. Rol de responsable y encargado

4. **Datos de los clientes del negocio** (deudores de fiado y apartado: nombre, teléfono, notas). El texto dice que el negocio es el **responsable** y La Marchanta **procesa por su cuenta** (encargado). ¿Es correcto? ¿Hace falta un contrato o cláusula de encargo en los Términos (hoy la sección "Datos de tus clientes" es el único lugar)?
5. **Datos de los propios usuarios** (socios y colaboradores). Para el registro, cuenta y uso, ¿La Marchanta es responsable? Las personas que el socio agrega (colaboradores) no firman nada: ¿basta que el socio les avise? ¿Hay que darles el aviso al crear su cuenta?
6. **Datos patrimoniales.** Aportaciones, gastos, jornadas, acuerdos de reparto y pagos son datos financieros o patrimoniales de personas físicas (según la lectura de la ley: consentimiento expreso). El aviso dice que "al capturarlos nos das tu consentimiento expreso". ¿Alcanza esa fórmula o se necesita un mecanismo explícito (casilla, firma electrónica)?

## 3. Finalidades y consentimiento

7. **Finalidades voluntarias.** Se redactaron tres (pedir opinión sobre el piloto, avisar de mejoras, saber quién recomendó el sistema). **Hoy el sistema no envía ningún mensaje de ese tipo ni guarda "quién te recomendó"**: son lo que se hará. ¿Conviene dejarlas, quitarlas o recabar un consentimiento aparte?
8. **Mecanismo para negarse a las voluntarias.** El texto remite a escribir un correo. ¿La ley pide un medio más directo en el formulario (casilla separada)?
9. **Aceptación del registro.** El registro nuevo guardará la aceptación con fecha y versión (`LEGAL_VERSION`). ¿Es suficiente una casilla previa o hace falta guardar también más evidencia (IP, texto exacto)?
10. **Personas menores.** Los Términos piden mayoría de edad. El aviso no trata datos de menores. ¿Falta algo?

## 4. Plazos y conservación (decisiones de negocio, no implementadas)

11. **Plazos propuestos:** solicitudes sin confirmar el correo, **7 días**; solicitudes rechazadas o vencidas, **30 días**; cuentas activas, mientras estén activas; eliminación o anonimización a petición, salvo lo que deba conservarse por ley.
12. **IMPORTANTE: hoy el sistema NO borra nada automáticamente** (no hay tareas programadas en `bazar-api/src`). El enlace de aprobación de una solicitud vence a los **30 días** (`TOKEN_TTL_MS`), no a los 7. Hasta que se implemente la limpieza, el aviso **promete** algo que el sistema no hace por sí solo. ¿Se publica así, se cambia a "hasta" o se retrasa la publicación hasta implementarlo?
13. **Retención de registros de ventas y deudas.** Las ventas, abonos, gastos y movimientos se conservan mientras la cuenta esté activa y no se pueden borrar de verdad (las personas solo se desactivan; las llaves de la base de datos lo impiden). El texto promete "eliminamos o anonimizamos": ¿qué anonimización es aceptable para registros contables (por ejemplo, reemplazar el nombre de la persona)? ¿Hay un mínimo legal o fiscal de conservación que aplique al negocio o al responsable?
14. **Cuenta cerrada.** Los Términos dicen que al cerrar la cuenta se dejan de usar los datos y se eliminan o anonimizan **si el titular lo pide**. ¿Debe haber un plazo máximo de conservación tras el cierre aunque nadie lo pida?
15. **Plazos ARCO.** Se usan 20 días para responder y 15 para hacerlo efectivo, ampliables una vez. ¿Son **días hábiles o naturales** en el texto vigente? (La lectura de la ley no lo distingue; Clip usa hábiles.)

## 5. Proveedores y transferencias

16. **Proveedores:** Resend (correo; recibe correo, usuario y contraseña temporal), Cloudflare (entrega del sitio y de la API; ve IP y tráfico), Google Fonts (el navegador de la visitante pide las tipografías; Google ve su IP). ¿Alguno es "remisión a encargado" o "transferencia" bajo la ley? ¿Hace falta cláusula de transferencia o consentimiento para los que estén fuera de México? El aviso dice solo que "pueden estar en otros países".
17. **Contraseña temporal por correo.** Resend entrega al socio su usuario y contraseña temporal. Mientras Resend esté en modo de prueba, un respaldo se manda al **aprobador** (`APPROVAL_NOTIFICATION_EMAIL`), que ve esas credenciales. ¿Hay que informarlo en el aviso? Hoy el texto solo dice que Resend las entrega.
18. **Google Fonts.** Alternativa técnica (no legal): servir las tipografías desde el propio servidor y quitar a Google del aviso. ¿Vale la pena?
19. **Servidor propio y respaldos.** El sistema corre en un servidor del responsable. **No hay respaldos documentados** en el repositorio. Los Términos dicen que no se garantizan. ¿Es suficiente o hace falta describir medidas?
20. **Registros del servidor.** No se comprobó si nginx, Nest o Docker guardan la IP de quien consulta ni por cuánto tiempo. El aviso solo dice que el servidor "recibe" la IP. ¿Hay que declarar registros y plazo?
21. **Cookies.** La app no crea cookies propias. No se verificó si Cloudflare coloca alguna. El aviso dice que "podría" usar cookies técnicas.

## 6. Seguridad y vulneraciones

22. **Medidas.** El aviso describe lo que el código hace (contraseña con argon2id, separación por negocio con filtro y seguridad por filas, token de dispositivo cifrado, enlace de aprobación de un solo uso, HTTPS) y **dice que no se puede prometer ausencia de fallos**. ¿Algo más debe declararse? ¿Se debe mencionar el cifrado entre Cloudflare y el servidor de origen (no verificado)?
23. **Aviso de vulneraciones.** El texto promete avisar si una vulneración afecta derechos. ¿Debe indicar el medio y el plazo?

## 7. Autoridad y procedimiento

24. **Autoridad.** Se nombra a la Secretaría Anticorrupción y Buen Gobierno según la ley de 2025. No se encontró guía oficial para particulares ni lineamientos del aviso para esta ley (los de 2013 son de la ley abrogada). ¿Siguen aplicando esos lineamientos? ¿Hace falta un **aviso simplificado** o "corto" además del integral para el formulario electrónico?
25. **Datos sensibles.** Se declara que no se piden. Los campos de texto libre (notas) podrían recibirlos; el texto pide no escribirlos. ¿Basta?

## 8. Términos

26. **Jurisdicción.** `los tribunales competentes del Estado de México` (provisional, por el domicilio). ¿Corresponde una sede concreta (distrito judicial)? ¿Aplica la jurisdicción federal o PROFECO si el usuario fuera consumidor? (los usuarios son negocios, pero personas físicas.)
27. **Limitación de responsabilidad y piloto.** ¿Son válidas las cláusulas ("bajo tu propio riesgo", sin garantía de continuidad ni de respaldos, sin responsabilidad por ventas o ganancias perdidas) frente a personas físicas con negocio?
28. **Suspensión sin explicación.** Los Términos permiten rechazar solicitudes y suspender cuentas. ¿Se necesita un procedimiento o plazo de aviso?
29. **Cambios unilaterales.** "Si sigues usando el sistema después del cambio, lo aceptas." ¿Basta con publicar la versión nueva?
30. **No es pagos ni asesoría.** Se aclara que el sistema solo **registra** cobros y no procesa pagos. ¿Se debe aclarar algo más sobre obligaciones fiscales del negocio?

## 9. Cliente final

31. **Aviso al cliente final.** La ayuda trae un ejemplo breve de aviso que el negocio puede decir o imprimir a quien le fía o aparta algo. ¿Es suficiente como aviso simplificado del negocio como responsable? Ideas **no implementadas** para informar al cliente final, para decidir con el abogado:
    - Una **hoja imprimible** del aviso breve para el puesto (con el nombre del negocio).
    - Un **texto fijo en el comprobante o ticket** de fiado y apartado, si algún día se imprime uno (hoy no existe recibo).
    - Mostrar el aviso breve **en pantalla** al registrar un deudor, con un "Ya se lo expliqué" opcional.
    - Un **QR en el puesto** que abra una página pública corta con el aviso del negocio.
    - Guardar, al crear un deudor, **si se le informó** (casilla) y cuándo.
