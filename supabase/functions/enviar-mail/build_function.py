#!/usr/bin/env python3
"""Genera index.ts (una sola pieza, pegable en el dashboard) con los HTML 03, 04 y 07 a 14 embebidos."""
import json, pathlib, sys
here = pathlib.Path(__file__).parent
html = here.parent.parent / "emails"
tpl = (here / "index.ts.tpl").read_text()
tpl = tpl.replace("__HTML_WELCOME__", json.dumps((html / "03-bienvenida.html").read_text(), ensure_ascii=False))
tpl = tpl.replace("__HTML_PUBLISHED__", json.dumps((html / "04-aviso-publicado.html").read_text(), ensure_ascii=False))
for key, name in [("__HTML_SUB_STARTED__", "07-suscripcion-activa.html"), ("__HTML_SUB_FAILED__", "08-pago-fallido.html"),
                  ("__HTML_SUB_CANCELLED__", "09-suscripcion-cancelada.html"), ("__HTML_SUB_ENDED__", "10-plan-terminado.html"),
                  ("__HTML_REPORT__", "11-denuncia.html"),
                  ("__HTML_REGRET_TEAM__", "12-arrepentimiento-equipo.html"), ("__HTML_REGRET_REQUESTER__", "13-arrepentimiento-recibido.html"),
                  ("__HTML_PROMO__", "14-pro-de-regalo.html")]:
    tpl = tpl.replace(key, json.dumps((html / name).read_text(), ensure_ascii=False))
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else here / "index.ts"
out.write_text(tpl)
print("escrito", out)
