-- Prueba el schema contra un Postgres local con scripts/supabase-stubs.sql.
-- No lo corras en el proyecto de Supabase.

do $$
declare
  uid uuid := '11111111-1111-4111-8111-111111111111';
  other uuid := '22222222-2222-4222-8222-222222222222';
  house uuid := '33333333-3333-4333-8333-333333333333';
  quincho uuid := '44444444-4444-4444-8444-444444444444';
  slot uuid := '55555555-5555-4555-8555-555555555555';
  req uuid;
  failed boolean;
begin
  if not public.point_in_lavalle(-32.7215, -68.5958) then
    raise exception 'Tulumaya debería estar adentro';
  end if;
  if public.point_in_lavalle(-32.8895, -68.8458) then
    raise exception 'Mendoza capital debería estar afuera';
  end if;
  if not public.point_in_lavalle(-32.70825, -68.67405) then
    raise exception 'Jocolí Viejo debería estar adentro';
  end if;

  insert into auth.users (id, email) values (uid, 'vecino@test.com');
  update public.profiles
  set full_name = 'Vecino Test', whatsapp = '5492615551234', max_listings = 1
  where id = uid;

  failed := false;
  begin
    insert into public.listings (
      owner_id, type, title, description, price_ars, district, address, requirements, lat, lng
    ) values (
      uid, 'casa', 'Casa de prueba en el centro',
      'Descripción de prueba con más de veinte caracteres.',
      400000, 'Villa Tulumaya', 'San Martín 1', 'Garantía.', -32.8895, -68.8458
    );
  exception when others then
    failed := true;
    if position('Lavalle' in sqlerrm) = 0 then
      raise exception 'El punto de afuera falló con otro mensaje: %', sqlerrm;
    end if;
  end;
  if not failed then
    raise exception 'Aceptó una ubicación fuera de Lavalle';
  end if;

  insert into public.listings (
    id, owner_id, type, title, description, price_ars, district, address, requirements, lat, lng, photo_urls
  ) values (
    house, uid, 'casa', 'Casa de prueba en el centro',
    'Descripción de prueba con más de veinte caracteres.',
    400000, 'Villa Tulumaya', 'San Martín 450', 'Garantía.', -32.7215, -68.5958, '{}'
  );

  failed := false;
  begin
    insert into public.listings (
      owner_id, type, title, description, price_ars, district, address, requirements, lat, lng
    ) values (
      uid, 'local', 'Local de prueba sobre calle',
      'Descripción de prueba con más de veinte caracteres.',
      300000, 'Villa Tulumaya', 'San Martín 210', 'Contrato.', -32.7200, -68.5900
    );
  exception when others then
    failed := true;
    if position('aviso' in sqlerrm) = 0 then
      raise exception 'El límite falló con otro mensaje: %', sqlerrm;
    end if;
  end;
  if not failed then
    raise exception 'Permitió un segundo aviso en el plan gratis';
  end if;

  insert into public.reports (listing_id, visitor_id, reason, details)
  values
    (house, 'visitante-1', 'estafa', 'Pide seña por transferencia'),
    (house, 'visitante-2', 'estafa', 'No muestra la casa'),
    (house, 'visitante-3', 'falso', 'Las fotos son de otro lado');

  if (select status from public.listings where id = house) <> 'hidden' then
    raise exception 'Tres denuncias no ocultaron el aviso';
  end if;

  failed := false;
  begin
    insert into public.reports (listing_id, visitor_id, reason)
    values (house, 'visitante-1', 'otro');
  exception when unique_violation then
    failed := true;
  end;
  if not failed then
    raise exception 'Aceptó dos denuncias del mismo visitante';
  end if;

  insert into auth.users (id, email) values (other, 'duena@test.com');
  update public.profiles
  set full_name = 'Dueña Test', whatsapp = '5492615559999', plan = 'pro', booking_enabled = true, max_listings = 3
  where id = other;

  insert into public.listings (
    id, owner_id, type, title, description, price_ars, price_unit, district, address, requirements,
    capacity, amenities, lat, lng, booking_enabled
  ) values (
    quincho, other, 'quincho', 'Quincho de prueba con pileta',
    'Descripción de prueba con más de veinte caracteres.',
    150000, 'turno', 'Villa Tulumaya', 'Belgrano 75', 'Sin seña previa.',
    40, array['pileta', 'parrilla'], -32.7185, -68.5890, false
  );

  insert into public.listing_offers (id, listing_id, name, starts_at, ends_at, price_ars, sort_order)
  values
    ('66666666-6666-4666-8666-666666666661', quincho, 'Mediodía', '11:00', '16:00', 150000, 0),
    ('66666666-6666-4666-8666-666666666662', quincho, 'Noche', '20:00', '00:30', 180000, 1);

  failed := false;
  begin
    insert into public.booking_slots (listing_id, offer_id, slot_date)
    values (quincho, '66666666-6666-4666-8666-666666666662', current_date + 3);
  exception when others then
    failed := true;
    if position('turnero' in sqlerrm) = 0 then
      raise exception 'El turnero apagado falló con otro mensaje: %', sqlerrm;
    end if;
  end;
  if not failed then
    raise exception 'Dejó cargar un turno con el turnero apagado';
  end if;

  update public.listings set booking_enabled = true where id = quincho;

  insert into public.booking_slots (id, listing_id, offer_id, slot_date)
  values (slot, quincho, '66666666-6666-4666-8666-666666666662', current_date + 4);

  failed := false;
  begin
    insert into public.booking_slots (listing_id, offer_id, slot_date)
    values (quincho, '66666666-6666-4666-8666-666666666662', current_date + 4);
  exception when unique_violation then
    failed := true;
  end;
  if not failed then
    raise exception 'Permitió dos turnos iguales';
  end if;

  req := public.create_booking_request(slot, 'Ana Pérez', '5492615557777', 20, 'Cumpleaños');

  failed := false;
  begin
    perform public.create_booking_request(slot, 'Otra Persona', '5492615557778', 10, 'Otra fiesta');
  exception when others then
    failed := true;
  end;
  if not failed then
    raise exception 'Aceptó dos pedidos para el mismo turno';
  end if;

  perform set_config('request.jwt.claim.sub', other::text, false);
  perform set_config('request.jwt.claim.email', 'duena@test.com', false);
  perform public.set_booking_status(req, 'confirmed');

  if (select status from public.booking_slots where id = slot) <> 'confirmed' then
    raise exception 'Confirmar no marcó el turno como tomado';
  end if;

  -- Segundo confirmado sobre el mismo turno no puede existir.
  update public.booking_slots set status = 'open' where id = slot;
  update public.booking_requests set status = 'pending' where id = req;
  -- El índice único de confirmados sigue teniendo esta fila si el update de arriba
  -- la dejó confirmed. La volvemos a pending a propósito y confirmamos de nuevo.
  perform public.set_booking_status(req, 'confirmed');

  insert into public.booking_slots (listing_id, offer_id, slot_date)
  values (quincho, '66666666-6666-4666-8666-666666666661', current_date + 5);

  raise notice 'schema ok';
end
$$;
