import sys
mode = sys.argv[1] if len(sys.argv)>1 else ''
pages = mode=='pages'
student_url = 'https://servanchy1308.github.io/demo-exam/' if pages else (mode or '__STUDENT_URL__')
r=lambda p: open(p,encoding='utf-8').read()
css, shared = r('style.css'), r('shared.js')
fonts='''<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700&family=Golos+Text:wght@400;500;600;700&family=PT+Serif:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400;600&display=swap">
'''
zip='<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>\n'
reset=':root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font-size:14px}img{max-width:100%}[hidden]{display:none!important}\n'
def page(title, body, js):
    head = f'<title>{title}</title>\n{fonts}<style>\n{reset if pages else ""}{css}</style>\n'
    tail = f'{body}\n{zip}<script>\n(function(){{\n{shared}\n{js}\n}})();\n</script>\n'
    if not pages: return head+tail
    return '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'+head+'</head>\n<body>\n'+tail+'</body>\n</html>\n'
out_t, out_s = ('../teacher.html','../index.html') if pages else ('../de-generator.html','../de-student.html')
open(out_t,'w',encoding='utf-8').write(page('Генератор вариантов ДЭ', r('teacher.body.html'), (r('teacher.logic.js')+r('teacher.ui.js')).replace('__STUDENT_URL__',student_url)))
open(out_s,'w',encoding='utf-8').write(page('Задание Модуля 1', r('student.body.html'), r('student.js')))
print('built')
