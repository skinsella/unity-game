"""Build one self-contained HTML file for use without Wi-Fi.

Run python3 build_offline.py after changing any page file. The file lands in offline/ and needs no network.
Run python3 build_offline.py --check to confirm the committed copy is up to date.
"""
import base64, pathlib, re, sys

here = pathlib.Path(__file__).parent
out = here / 'offline' / 'price_of_unity_offline.html'


def build():
    css = (here / 'style.css').read_text()
    css = re.sub(r'url\(fonts/([\w.-]+\.woff2)\)',
                 lambda m: 'url(data:font/woff2;base64,' + base64.b64encode((here / 'fonts' / m.group(1)).read_bytes()).decode() + ')', css)
    page = (here / 'index.html').read_text()
    page = re.sub(r'<link rel="stylesheet" href="style.css(\?v=\d+)?">', lambda m: '<style>\n' + css + '\n</style>', page)
    for name in ('engine.js', 'vendor/qrcode.js', 'livevote.js', 'paper_values.js', 'game.js'):
        page = re.sub(r'<script src="' + re.escape(name) + r'(\?v=\d+)?"></script>', lambda m: '<script>\n' + (here / name).read_text() + '\n</script>', page)
    page = re.sub(r'\s*<span class="deskonly onlineonly">.*?</span>', '', page, flags=re.S)
    return page.replace('<head>', '<head>\n<!-- Offline copy of the game console. Built by build_offline.py, do not edit by hand. -->', 1)


if __name__ == '__main__':
    html = build()
    if '--check' in sys.argv:
        if not out.exists() or out.read_text() != html:
            sys.exit('offline/price_of_unity_offline.html is out of date. Run python3 build_offline.py and commit it.')
        print('Offline copy is up to date.')
    else:
        out.parent.mkdir(exist_ok=True)
        out.write_text(html)
        print(f'Wrote {out.relative_to(here)}, {len(html) // 1024} KB')
