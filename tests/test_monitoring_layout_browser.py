"""Viewport real en Edge, CSS Bootstrap real y servicios AWS simulados."""
import base64
import hashlib
import json
import pathlib
import tempfile
import urllib.request
from test_last_movement_browser import fixture
from test_history_browser import emit
from test_navigation_browser import ROOT, sync_playwright, expect

SIZES=[(1920,1080),(1366,768),(1280,720),(390,844),(360,640),(844,390),(640,360)]
MARKER='/* MONITOREO ocupa el viewport;'


def content(role, bootstrap, baseline=False):
    html=fixture(role)
    if baseline:
        css=(ROOT/'assets/css/styles.css').read_text(encoding='utf-8')
        html=html.replace(css,css.split(MARKER)[0])
    html=html.replace('<style>','<style>'+bootstrap+'</style><style>',1)
    image=base64.b64encode((ROOT/'assets/img/scarlette-terreneitor.png').read_bytes()).decode()
    return html.replace('<div class="vehicle-art">','<div class="vehicle-art"><img src="data:image/png;base64,'+image+'" width="1672" height="941" alt="Terreneitor">')


def no_document_scroll(page):
    metrics=page.evaluate('''()=>({width:innerWidth,height:innerHeight,
      html:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],
      body:[document.body.scrollWidth,document.body.scrollHeight],
      shell:[document.querySelector('.app-shell').scrollWidth,document.querySelector('.app-shell').clientWidth,
             document.querySelector('.app-shell').scrollHeight,document.querySelector('.app-shell').clientHeight]})''')
    assert metrics['html'][0]<=metrics['width']+1 and metrics['html'][1]<=metrics['height']+1,metrics
    assert metrics['body'][0]<=metrics['width']+1 and metrics['body'][1]<=metrics['height']+1,metrics
    assert metrics['shell'][0]<=metrics['shell'][1]+1 and metrics['shell'][2]<=metrics['shell'][3]+1,metrics
    return metrics


def geometry(page):
    return [page.locator(s).bounding_box() for s in ['.topbar','.connections','.control-layout','.joystick','.movement-grid','.demo-card','.stop-band','.page-footer']]


def load(page,html):
    page.goto('https://scarlette.test')
    page.set_content(html)
    page.wait_for_function('window.SCARLETTE_USUARIO && stateActive===0')


def main():
    data=urllib.request.urlopen('https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',timeout=20).read()
    assert base64.b64encode(hashlib.sha384(data).digest()).decode()=='QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH'
    bootstrap=data.decode()
    screenshots=pathlib.Path(tempfile.gettempdir())/'scarlette-monitoring-layout'
    screenshots.mkdir(exist_ok=True)
    with sync_playwright() as runtime:
        browser=runtime.chromium.launch(channel='msedge',headless=True)
        try:
            for width,height in SIZES:
                page=browser.new_page(viewport={'width':width,'height':height},has_touch=True)
                page.route('**/*',lambda route:route.fulfill(status=200,body='<html></html>') if route.request.is_navigation_request() else route.abort())
                load(page,content('usuario',bootstrap,baseline=True))
                before=geometry(page)
                load(page,content('usuario',bootstrap))
                assert before==geometry(page),('CONTROL',width,height)
                control=page.get_by_role('tab',name='CONTROL',exact=True)
                monitor=page.get_by_role('tab',name='MONITOREO',exact=True)
                monitor.click()
                rows=page.locator('.history-table tbody tr')
                expect(rows).to_have_count(10)
                emit(page,'movimiento_individual',45)
                page.wait_for_function("calls.filter(c=>c.path.endsWith('/historial')).length===2 && document.querySelector('.history-table-scroll').getAttribute('aria-busy')==='false'")
                no_document_scroll(page)
                scroll=page.locator('.history-table-scroll')
                scroll.focus()
                if scroll.evaluate('(e)=>e.scrollHeight>e.clientHeight'):
                    page.keyboard.press('Control+End')
                    page.wait_for_function("document.querySelector('.history-table-scroll').scrollTop>0")
                    page.wait_for_function("(()=>{const e=document.querySelector('.history-table-scroll');return e.scrollTop+e.clientHeight>=e.scrollHeight-2})()")
                    # Desplazamiento tactil real de la misma region.
                    scroll.evaluate('(e)=>{e.scrollTop=0;e.scrollLeft=0}')
                    rect=scroll.bounding_box()
                    session=page.context.new_cdp_session(page)
                    x=rect['x']+rect['width']/2
                    y=rect['y']+rect['height']-8
                    distance=min(rect['height']-16,120)
                    session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
                    for step in range(1,7):
                        session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y-distance*step/6}]})
                        page.wait_for_timeout(25)
                    session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
                    page.wait_for_function("document.querySelector('.history-table-scroll').scrollTop>0")
                # Todas las filas siguen siendo alcanzables, sin mover el documento.
                for i in range(10):
                    rows.nth(i).scroll_into_view_if_needed()
                no_document_scroll(page)
                summary=page.locator('.events-toggle')
                summary.focus();page.keyboard.press('Enter')
                assert page.locator('.events-disclosure').get_attribute('open') is not None
                no_document_scroll(page)
                assert page.locator('.scarlette-events > div').count()==40
                if height<=500 and width>=576:
                    region=page.locator('.monitoring-summary-region')
                    region.focus();page.keyboard.press('Control+Home')
                    for value in page.locator('#last-movement dd').all():
                        value.scroll_into_view_if_needed()
                        box=value.bounding_box();bounds=region.bounding_box()
                        assert box['y']>=bounds['y']-1 and box['y']+box['height']<=bounds['y']+bounds['height']+1
                    summary.focus()
                    region.focus();page.keyboard.press('Control+End')
                    page.wait_for_function("(()=>{const e=document.querySelector('.monitoring-summary-region');return e.scrollTop+e.clientHeight>=e.scrollHeight-2})()")
                    no_document_scroll(page)
                    summary.scroll_into_view_if_needed()
                for selector in ['.connections','.user-panel-tabs','.movement-history','.events-toggle','.page-footer']:
                    box=page.locator(selector).bounding_box()
                    assert box and box['y']>=-1 and box['y']+box['height']<=height+1,(selector,box)
                table_rect=scroll.bounding_box();footer_rect=page.locator('.page-footer').bounding_box()
                assert table_rect['y']+table_rect['height']<=footer_rect['y']+1
                page.screenshot(path=str(screenshots/f'{width}x{height}.png'))
                control.click();expect(control).to_have_attribute('aria-selected','true')
                # Esperar la actualización del contenido nativo de <details> al mostrar CONTROL.
                for _ in range(20):
                    if before==geometry(page):break
                    page.wait_for_timeout(25)
                assert before==geometry(page),('CONTROL restored',width,height)
                load(page,content('administradora',bootstrap,baseline=True))
                admin=geometry(page)
                load(page,content('administradora',bootstrap))
                assert admin==geometry(page),('ADMINISTRADOR',width,height)
                assert page.evaluate('errors')==[]
                print(json.dumps({'ok':True,'viewport':[width,height],'document_scroll':False,'internal_keyboard_touch':True,'unchanged_control_admin':True}),flush=True)
                page.close()
        finally:
            browser.close()
    print('Screenshots: '+str(screenshots))


if __name__=='__main__':
    main()
