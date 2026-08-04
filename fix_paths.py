from pathlib import Path
root = Path(r'C:\Users\datta\OneDrive\Desktop\buld')
for path in root.glob('views/**/*.ejs'):
    if len(path.parts) >= 2 and path.parts[-2] == 'partials':
        continue
    text = path.read_text(encoding='utf-8')
    if path.parent == root / 'views':
        text = text.replace("<%- include('../partials/header') %>", "<%- include('partials/header') %>")
        text = text.replace("<%- include('../partials/footer') %>", "<%- include('partials/footer') %>")
    else:
        text = text.replace("<%- include('partials/header') %>", "<%- include('../partials/header') %>")
        text = text.replace("<%- include('partials/footer') %>", "<%- include('../partials/footer') %>")
    path.write_text(text, encoding='utf-8')
css = root / 'public' / 'css' / 'styles.css'
text = css.read_text(encoding='utf-8')
text = text.replace("url('hero-bg.png')", "url('/images/hero-bg.png')")
text = text.replace("url('logo.jpg')", "url('/images/logo.jpg')")
text = text.replace('url("hero-bg.png")', 'url("/images/hero-bg.png")')
text = text.replace('url("logo.jpg")', 'url("/images/logo.jpg")')
css.write_text(text, encoding='utf-8')
