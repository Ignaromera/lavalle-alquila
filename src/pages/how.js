import { PLANS, formatArs, planFeatures } from "../plans.js";
import { esc } from "../format.js";

const CONTACT = "jirfcarp@gmail.com";

function planRow(id) {
  const p = PLANS[id];
  const price = p.monthly ? `${formatArs(p.monthly)} por mes${p.yearly ? ` o ${formatArs(p.yearly)} por año` : ""}` : "Gratis";
  return `<li class="how-plan" data-testid="how-plan-${id}"><strong>${esc(p.name)}</strong> · ${esc(price)}<br><span class="muted">${planFeatures(id).map(esc).join(" · ")}</span></li>`;
}

const FAQ = [
  ["¿Lavalle Alquila es una inmobiliaria?", "No. Es un tablón de avisos: no intermediamos, no cobramos comisión por los alquileres y no participamos del contrato ni de los pagos entre las partes. El contacto es directo con quien publica, por WhatsApp."],
  ["¿Tengo que crear una cuenta para buscar?", "No. Mirar avisos, usar los filtros, ver el mapa y escribir por WhatsApp es libre. La cuenta solo hace falta para publicar."],
  ["¿Cuánto cuesta publicar?", "Con el plan Gratis tenés 1 aviso activo sin pagar nada. Si necesitás más avisos, destacados o el turnero, están los planes Plus y Pro."],
  ["¿Verifican los avisos o a los dueños?", "No verificamos identidad ni propiedades. Por eso te recomendamos ver el lugar antes de pagar cualquier seña y denunciar lo que te parezca raro."],
  ["¿Qué pasa cuando vence un aviso?", "Los avisos duran 60 días. Antes de que venzan los podés renovar desde «Yo». Si vence, deja de mostrarse pero no se borra: lo renovás cuando quieras."],
  ["¿Cómo cancelo un plan pago?", "Desde «Mi suscripción», cuando quieras. El plan sigue hasta el final del período que pagaste y después pasás al plan Gratis. Si contrataste hace menos de 10 días, podés usar el Botón de arrepentimiento y te devolvemos todo."],
  ["¿Qué hago si veo un aviso sospechoso?", "Tocá «Denunciar» en el aviso. No hace falta tener cuenta. El equipo revisa cada denuncia y puede ocultar o quitar el aviso."],
  ["¿Cómo me contacto con ustedes?", `Escribinos a <a href="mailto:${CONTACT}">${CONTACT}</a>.`],
];

export function howHtml() {
  const base = import.meta.env?.BASE_URL || "./";
  return `
    <section class="page-head">
      <h1 tabindex="-1">Cómo funciona</h1>
      <p class="lede">Lavalle Alquila junta en un solo lugar los alquileres de Lavalle, Mendoza: casas, departamentos, locales, terrenos, quinchos y salones. Buscás gratis y hablás directo con el dueño por WhatsApp.</p>
    </section>

    <section class="how-block" data-testid="how-busca">
      <h2>Si buscás alquiler</h2>
      <ol class="how-steps">
        <li><strong>Entrá y mirá, sin cuenta.</strong> En Inicio están todos los avisos activos. Filtrá por tipo, distrito y precio, o usá el <a href="#/mapa">mapa</a>.</li>
        <li><strong>Abrí el aviso que te guste.</strong> Vas a ver fotos, precio, requisitos, la ubicación aproximada y cómo llegar.</li>
        <li><strong>Escribile por WhatsApp.</strong> El botón abre un chat directo con quien publicó. Nosotros no intervenimos en la charla ni en el acuerdo.</li>
        <li><strong>¿Quincho o salón?</strong> Algunos tienen turnero: elegís el día o el turno libre y mandás el pedido de reserva.</li>
        <li><strong>¿No encontrás lo que buscás?</strong> Publicá un <a href="#/busco">«Busco alquiler»</a> y que te escriban los dueños.</li>
      </ol>
      <aside class="how-safety">
        <h3>Para alquilar seguro</h3>
        <ul>
          <li>No transfieras señas ni adelantos sin haber visto la propiedad.</li>
          <li>Encontrate en el lugar y pedí ver un documento de quien alquila.</li>
          <li>Desconfiá si te apuran o si el precio es demasiado bueno.</li>
          <li>Si algo no cierra, tocá «Denunciar» en el aviso. No hace falta cuenta.</li>
        </ul>
      </aside>
    </section>

    <section class="how-block" data-testid="how-publica">
      <h2>Si querés publicar</h2>
      <ol class="how-steps">
        <li><strong>Creá tu cuenta.</strong> Con tu mail y una contraseña, o con Google. Te mandamos un mail para confirmarla. Tu mail nunca se muestra en el sitio.</li>
        <li><strong>Completá tu nombre y WhatsApp.</strong> Es el número al que te van a escribir.</li>
        <li><strong>Cargá el aviso.</strong> Tipo, precio, dirección, el punto en el mapa (dentro de Lavalle) y buenas fotos.</li>
        <li><strong>Listo, ya está publicado.</strong> Dura 60 días y lo renovás desde «Yo» con un toque. Cuando lo alquilás, marcalo como alquilado.</li>
      </ol>
      <h3>Planes</h3>
      <ul class="how-plans">
        ${["free", "plus", "pro"].map(planRow).join("")}
      </ul>
      <p class="fine">Los precios están en pesos argentinos. Los planes pagos se cobran por Mercado Pago y se renuevan solos hasta que los cancelás. <a href="#/planes">Ver los planes</a>.</p>
      <h3>El turnero (plan Pro)</h3>
      <p>Para quinchos y salones: marcás qué días o turnos tenés libres, la gente elige uno y te llega el pedido. Vos lo confirmás o lo rechazás desde «Yo», y el calendario se actualiza solo.</p>
    </section>

    <section class="how-block" data-testid="how-faq">
      <h2>Preguntas frecuentes</h2>
      <div class="how-faq">
        ${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${a}</p></details>`).join("")}
      </div>
    </section>

    <section class="how-block how-about" id="quienes-somos" data-testid="how-about">
      <h2>Quiénes somos</h2>
      <p>Lavalle Alquila es un proyecto lavallino de Ignacio Romera, para que alquilar en Lavalle sea simple: que quien busca encuentre todo en un lugar y que quien alquila llegue a más gente sin intermediarios.</p>
      <p>¿Tenés una idea o encontraste un error? Escribinos a <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>
      <p class="fine"><a href="${base}terminos.html">Términos y condiciones</a> · <a href="${base}privacidad.html">Política de privacidad</a></p>
    </section>`;
}

export async function renderHow(view) {
  view.innerHTML = howHtml();
}
