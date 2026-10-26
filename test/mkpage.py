import pathlib
root = pathlib.Path(__file__).parent.parent
def mk():
    body = (root / 'dist' / 'entropy.html').read_text()
    f = root / 'test' / 'fonts'
    ff = ('<style>@font-face{font-family:VT323;src:url(file://%s/vt323-latin-400-normal.woff2)}'
          '@font-face{font-family:Silkscreen;font-weight:400;src:url(file://%s/silkscreen-latin-400-normal.woff2)}'
          '@font-face{font-family:Silkscreen;font-weight:700;src:url(file://%s/silkscreen-latin-700-normal.woff2)}</style>') % (f, f, f)
    html = ('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<style>:root{color-scheme:light}body{margin:0;font:14px system-ui}</style>' + ff +
            '</head><body>' + body + '</body></html>')
    out = root / 'test' / 'out'; out.mkdir(exist_ok=True)
    (out / 'page.html').write_text(html)
if __name__ == '__main__': mk()
