"""Minimal xlsx reader: a workbook is a zip of XML, so no dependency needed."""
import re
import zipfile
import xml.etree.ElementTree as ET

NS = {
    'm': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'pr': 'http://schemas.openxmlformats.org/package/2006/relationships',
}


def _col(ref):
    letters = re.match(r'([A-Z]+)', ref).group(1)
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


class Workbook:
    def __init__(self, path):
        self.z = zipfile.ZipFile(path)
        self.shared = self._shared_strings()
        self.sheets = self._sheets()

    def _shared_strings(self):
        try:
            root = ET.fromstring(self.z.read('xl/sharedStrings.xml'))
        except KeyError:
            return []
        out = []
        for si in root.findall('m:si', NS):
            out.append(''.join(t.text or '' for t in si.iter(f'{{{NS["m"]}}}t')))
        return out

    def _sheets(self):
        rels = ET.fromstring(self.z.read('xl/_rels/workbook.xml.rels'))
        target = {r.get('Id'): r.get('Target') for r in rels.findall('pr:Relationship', NS)}
        book = ET.fromstring(self.z.read('xl/workbook.xml'))
        sheets = []
        for s in book.find('m:sheets', NS):
            path = target[s.get(f'{{{NS["r"]}}}id')]
            if not path.startswith('xl/'):
                path = 'xl/' + path.lstrip('/')
            sheets.append((s.get('name'), path, s.get('state', 'visible')))
        return sheets

    def rows(self, path):
        """Every row as a list of cell values (str/float/None), ragged-padded."""
        root = ET.fromstring(self.z.read(path))
        data = root.find('m:sheetData', NS)
        out = []
        for row in data.findall('m:row', NS):
            cells = {}
            for c in row.findall('m:c', NS):
                ref, t = c.get('r'), c.get('t')
                v = c.find('m:v', NS)
                is_el = c.find('m:is', NS)
                if t == 's' and v is not None:
                    value = self.shared[int(v.text)]
                elif t == 'inlineStr' and is_el is not None:
                    value = ''.join(x.text or '' for x in is_el.iter(f'{{{NS["m"]}}}t'))
                elif v is not None:
                    try:
                        value = float(v.text)
                        if value == int(value):
                            value = int(value)
                    except (TypeError, ValueError):
                        value = v.text
                else:
                    value = None
                cells[_col(ref)] = value
            width = (max(cells) + 1) if cells else 0
            out.append([cells.get(i) for i in range(width)])
        return out
