"""Check the active static pages and their local asset references."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import re
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
pages = ['index.html', 'floor-plans.html', 'concept.html', 'gallery.html', 'calculator.html', 'contact.html', 'brochure.html']
errors = []

def exact_file(path):
    if not path.is_file():
        return False
    relative = path.relative_to(root)
    cursor = root
    for part in relative.parts:
        if part not in [entry.name for entry in cursor.iterdir()]:
            return False
        cursor /= part
    return True

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.links = []
        self.h1s = 0
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            if attrs['id'] in self.ids:
                errors.append(f'Duplicate id: {attrs["id"]}')
            self.ids.add(attrs['id'])
        if tag == 'h1':
            self.h1s += 1
        for key in ('href', 'src', 'poster', 'data-src'):
            if attrs.get(key):
                self.links.append(attrs[key])

parsed = {}
for filename in pages:
    text = (root / filename).read_text(encoding='utf-8')
    page = Page()
    page.feed(text)
    parsed[filename] = page
    if page.h1s != 1:
        errors.append(f'{filename}: expected one h1, found {page.h1s}')
    if re.search(r"Pine[’']?s|Molek|Q4 2023|Aurelle", text, re.I):
        errors.append(f'{filename}: stale identity or completion claim')
    if 'site-header' not in page.ids or 'site-footer' not in page.ids:
        errors.append(f'{filename}: shared navigation/footer host missing')

for filename, page in parsed.items():
    for link in page.links:
        url = urlsplit(link)
        if url.scheme or url.netloc:
            continue
        path = unquote(url.path)
        target = root / (path or filename)
        if not exact_file(target):
            errors.append(f'{filename}: missing/case-mismatched reference {link}')
        if url.fragment and target.name in parsed and url.fragment not in parsed[target.name].ids:
            errors.append(f'{filename}: missing anchor {link}')

for source in [root / 'js' / name for name in ['data.js', 'gallery.js', 'brochure.js', 'brochure-pdf.js']]:
    for asset in re.findall(r"['\"](img/[^'\"]+)['\"]", source.read_text(encoding='utf-8')):
        if not exact_file(root / asset):
            errors.append(f'{source.name}: missing/case-mismatched asset {asset}')
for filename in ['js/main.js', 'js/contact.js']:
    if re.search(r'Aurelle', (root / filename).read_text(encoding='utf-8'), re.I):
        errors.append(f'{filename}: stale public residence name')
for script in (root / 'js').glob('*.js'):
    result = subprocess.run(['node', '--check', str(script)], capture_output=True, text=True)
    if result.returncode:
        errors.append(result.stderr)
if errors:
    print('\n'.join(errors))
    sys.exit(1)
print(f'PASS: {len(pages)} active pages; local links, exact-case assets, anchors, headings, branding and all JavaScript syntax.')
