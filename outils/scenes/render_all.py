import asyncio, base64, json, sys
from playwright.async_api import async_playwright
TYPES = ['Salle de bain','Cuisine','Séjour / chambre','Hall / escalier','Chaufferie','Cave / sous-sol','Local technique / électrique','Combles','Façade','Toiture','Autre']
SLUG = {'Salle de bain':'salle-de-bain','Cuisine':'cuisine','Séjour / chambre':'sejour','Hall / escalier':'hall','Chaufferie':'chaufferie','Cave / sous-sol':'cave','Local technique / électrique':'local-technique','Combles':'combles','Façade':'facade','Toiture':'toiture','Autre':'autre'}
only = [t for t in TYPES if SLUG[t] in sys.argv[2:]] or TYPES
masks = sys.argv[1] == 'masks'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await (await b.new_context(viewport={'width':1080,'height':1040})).new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8766/scenes.html'); await pg.wait_for_function('window.ready===true', timeout=60000)
        meta = {}
        for t in only:
            s = SLUG[t]
            info = await pg.evaluate('t => window.build(t)', t)
            u = await pg.evaluate('window.beauty()'); open(f'out/{s}.png','wb').write(base64.b64decode(u.split(',')[1]))
            if masks:
                for tag in info['tags']:
                    u = await pg.evaluate('t => window.mask(t)', tag); open(f'out/{s}__{tag}.png','wb').write(base64.b64decode(u.split(',')[1]))
            meta[s] = info; print(s, info['tags'], flush=True)
        old = {}
        try: old = json.load(open('out/meta.json'))
        except Exception: pass
        old.update(meta); json.dump(old, open('out/meta.json','w'), ensure_ascii=False)
        print('errors', errs[:5]); await b.close()
asyncio.run(main())
