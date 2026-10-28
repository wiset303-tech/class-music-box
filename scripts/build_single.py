#!/usr/bin/env python3
"""index.html + lib/three.min.js + app.js → 파일 하나(우리반오르골.html). 사용: python3 scripts/build_single.py [출력경로]"""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else root / "dist" / "우리반오르골.html")
html = (root / "index.html").read_text(encoding="utf-8")
for src in ("lib/three.min.js", "app.js"):
    js = (root / src).read_text(encoding="utf-8")
    assert "</script" not in js.lower(), src + " 안에 </script 가 있다"
    tag = '<script src="%s"></script>' % src
    assert tag in html, tag + " 없음"
    html = html.replace(tag, "<script>\n" + js + "\n</script>")
head = html[:600].lower()
assert head.lstrip().startswith("<!doctype html>"), "맨 위가 <!DOCTYPE html>이 아니다"
assert re.search(r'<meta charset="utf-8"', head), "앞 600자 안에 <meta charset=\"UTF-8\">가 없다(캔바에서 글자가 깨진다)"
data = html.encode("utf-8")
assert len(data) < 1_000_000, "1MB 넘음: %d" % len(data)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_bytes(data)
print("OK", out, len(data), "bytes")
