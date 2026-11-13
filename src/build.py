import sys
mode = sys.argv[1] if len(sys.argv)>1 else ''
pages = mode=='pages'
student_url = 'https://servanchy1308.github.io/demo-exam/' if pages else (mode or '__STUDENT_URL__')
r=lambda p: open(p,encoding='utf-8').read()
css, shared = r('style.css'), r('shared.js')
wiki = r('wiki.css')
site = r('site.css')
fonts='''<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap">
'''
zip='<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>\n'
reset=':root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font-size:14px}img{max-width:100%}[hidden]{display:none!important}\n'
def page(title, body, js, extra=''):
    head = f'<title>{title}</title>\n{fonts}<style>\n{reset if pages else ""}{css}{site}{extra}</style>\n'
    tail = f'{body}\n{zip}<script>\n(function(){{\n{shared}\n{js}\n}})();\n</script>\n'
    if not pages: return head+tail
    return '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'+head+'</head>\n<body>\n'+tail+'</body>\n</html>\n'
out_t, out_s, out_v = ('../teacher.html','../index.html','../solve.html') if pages else ('../de-generator.html','../de-student.html','../de-solve.html')
open(out_t,'w',encoding='utf-8').write(page('Генератор вариантов ДЭ', r('teacher.body.html'), (r('teacher.logic.js')+r('teacher.ui.js')).replace('__STUDENT_URL__',student_url)))
open(out_s,'w',encoding='utf-8').write(page('Задания ДЭ 09.02.06', r('student.body.html'), r('m23.js')+r('student.js')))
open(out_v,'w',encoding='utf-8').write(page('Всё об линуксе и точка', r('solve.body.html'), (r('m23.js')+r('teacher.logic.js')+r('m23.solve.js')+r('linux.js')+r('wiki.js')+r('quick.js')+r('solve.js')).replace('__STUDENT_URL__',student_url), wiki+r('quick.css')))
out_q = '../quick.html' if pages else '../de-quick.html'
open(out_q,'w',encoding='utf-8').write('''<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=solve.html#m1">
<title>Быстрое решение</title>
</head>
<body>
<p>Быстрое решение теперь в блоке «Решение» модуля 1: <a href="solve.html#m1">открыть</a>.</p>
</body>
</html>
''')
print('built')
