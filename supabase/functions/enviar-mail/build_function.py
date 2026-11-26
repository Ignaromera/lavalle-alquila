#!/usr/bin/env python3
"""Genera index.ts (una sola pieza, pegable en el dashboard) con los HTML 03 y 04 embebidos."""
import json, pathlib, sys
here = pathlib.Path(__file__).parent
html = here.parent.parent / "emails"
tpl = (here / "index.ts.tpl").read_text()
tpl = tpl.replace("__HTML_WELCOME__", json.dumps((html / "03-bienvenida.html").read_text(), ensure_ascii=False))
tpl = tpl.replace("__HTML_PUBLISHED__", json.dumps((html / "04-aviso-publicado.html").read_text(), ensure_ascii=False))
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else here / "index.ts"
out.write_text(tpl)
print("escrito", out)
