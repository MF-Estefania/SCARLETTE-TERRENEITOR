"""Navegación con scripts reales, /auth/me, REST y WebSocket simulados."""
import json
import pathlib
import re
import sys
import tempfile
from test_lights_browser import ROOT
sys.path.insert(0, str(pathlib.Path(tempfile.gettempdir()) / 'scarlette-browser-tools'))
from playwright.sync_api import sync_playwright, expect


def fixture(role, navigation=True):
    html = (ROOT / 'panel.html').read_text(encoding='utf-8')
    def script(match):
        path = match[1].split('?')[0]
        if not navigation and path.endswith('panel-navigation.js'):
            return ''
        return '<script>' + (ROOT / path).read_text(encoding='utf-8') + '</script>'
    html = re.sub(r'<script src="([^"]+)"></script>', script, html)
    html = re.sub(r'<link\b[^>]*>', '', html)
    html = re.sub(r'<img\b[^>]*>', '', html)
    mock = r'''
    sessionStorage.setItem('scarlette_access_token', 'test');
    window.calls=[]; window.sockets=0; window.errors=[]; window.stopMode='ok';
    addEventListener('error', e=>errors.push(e.message));
    addEventListener('unhandledrejection', e=>errors.push(String(e.reason)));
    window.alert=()=>{};
    window.fetch=async (url, options)=>{
      const path=new URL(url).pathname; calls.push({path, method:options.method});
      if(path.endsWith('/detener') && stopMode==='pending') await new Promise(r=>window.finishStop=r);
      const fail=path.endsWith('/detener') && stopMode==='fail';
      const data=path==='/auth/me'?{rol:ROLE}:path.endsWith('/ws-ticket')?{ticket:'fake'}:
        path.endsWith('/demos')?[{activo:true,id_demo:9,nombre:'Demo'}]:path.endsWith('/historial')?[]:{};
      return {ok:!fail,status:fail?503:200,text:async()=>JSON.stringify(fail?{detail:'STOP simulado'}:data)};
    };
    window.WebSocket=class extends EventTarget {
      static OPEN=1; static CONNECTING=0;
      constructor(){super();window.testSocket=this;sockets++;this.readyState=1;queueMicrotask(()=>this.dispatchEvent(new Event('open')));}
      close(){this.readyState=3;this.dispatchEvent(new Event('close'));}
    };
    '''.replace('ROLE', json.dumps(role))
    css = (ROOT / 'assets/css/styles.css').read_text(encoding='utf-8')
    return html.replace('</head>', '<style>'+css+'</style><script>'+mock+'</script></head>')


def main():
    with sync_playwright() as runtime:
        browser=runtime.chromium.launch(channel='msedge',headless=True)
        try:
            for width,height in [(1366,900),(390,844),(844,390)]:
                for role in ['usuario','administradora']:
                    page=browser.new_page(viewport={'width':width,'height':height},has_touch=True)
                    page.route('**/*',lambda route:route.fulfill(status=200,body='<html></html>') if route.request.is_navigation_request() else route.abort())
                    page.goto('https://scarlette.test')
                    page.set_content(fixture(role))
                    page.wait_for_function("window.SCARLETTE_USUARIO && sockets===1 && calls.length===4")
                    assert page.locator('.connection').count()==3
                    if role=='administradora':
                        assert page.locator('[role=tab]').count()==0
                        assert page.locator('.app-shell > .control-layout').count()==1
                        assert page.locator('.app-shell > .events-disclosure').count()==1
                        assert page.get_by_text('Actividad en tiempo real',exact=True).count()==0
                        # Compare geometry against the same fixture without navigation script.
                        selectors=['.control-layout','.stop-band','.events-disclosure','.connections']
                        geometry=[page.locator(s).bounding_box() for s in selectors]
                        page.set_content(fixture(role,False))
                        page.wait_for_function('window.SCARLETTE_USUARIO && calls.length===4')
                        assert geometry==[page.locator(s).bounding_box() for s in selectors]
                    else:
                        control=page.get_by_role('tab',name='CONTROL',exact=True)
                        monitor=page.get_by_role('tab',name='MONITOREO',exact=True)
                        expect(control).to_have_attribute('aria-selected','true')
                        page.evaluate("window.originalJoystick=document.querySelector('.joystick');window.originalEvents=document.querySelector('.events-disclosure')")
                        count=page.evaluate('calls.length')
                        assert page.locator('#user-control-panel .events-disclosure').count()==0
                        assert page.locator('#user-monitoring-panel .events-disclosure').count()==1
                        assert not page.locator('.events-disclosure').is_visible()
                        page.evaluate("testSocket.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({tipo:'movimiento_individual',comando:'ANTES'})}))")
                        assert page.locator('.scarlette-events').inner_text().count('ANTES')==1
                        page.evaluate("window.originalList=document.querySelector('.scarlette-events');window.originalEvent=originalList.firstElementChild")
                        monitor.click()
                        assert page.get_by_role('heading',name='Actividad en tiempo real',exact=True).is_visible()
                        assert page.locator('.events-disclosure').is_visible()
                        assert page.locator('.scarlette-events').inner_text().count('ANTES')==1
                        page.evaluate("testSocket.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({tipo:'movimiento_individual',comando:'DURANTE'})}))")
                        assert page.locator('.scarlette-events').inner_text().count('DURANTE')==1
                        assert page.evaluate("originalList===document.querySelector('.scarlette-events') && originalList.children[1]===originalEvent")
                        assert all(page.locator('.connection').nth(i).is_visible() for i in range(3))
                        control.tap()
                        expect(control).to_have_attribute('aria-selected','true')
                        control.focus(); page.keyboard.press('ArrowRight')
                        assert monitor.evaluate('(e)=>e===document.activeElement')
                        page.keyboard.press('Enter')
                        expect(monitor).to_have_attribute('aria-selected','true')
                        page.keyboard.press('Home')
                        expect(control).to_be_focused()
                        page.keyboard.press('Space')
                        expect(control).to_have_attribute('aria-selected','true')
                        assert page.evaluate("calls.filter(c=>!c.path.endsWith('/historial')).length")==count and page.evaluate('sockets')==1
                        assert page.locator('.scarlette-events').inner_text().count('ANTES')==1
                        assert page.locator('.scarlette-events').inner_text().count('DURANTE')==1
                        page.evaluate("for(let i=0;i<45;i++) testSocket.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({tipo:'movimiento_individual',comando:'EVENTO-'+i})}))")
                        assert page.locator('.scarlette-events > div').count()==40
                        assert 'EVENTO-44' in page.locator('.scarlette-events > div').first.inner_text()
                        assert 'EVENTO-5' in page.locator('.scarlette-events > div').last.inner_text()
                        assert page.evaluate("calls.filter(c=>!c.path.endsWith('/historial')).length")==count and page.evaluate('sockets')==1
                        assert page.evaluate("originalJoystick===document.querySelector('.joystick') && originalEvents===document.querySelector('.events-disclosure')")
                        # Keyboard movement remains active after blur: navigation must stop it.
                        center=page.locator('.joystick-center'); center.focus();page.keyboard.press('ArrowUp')
                        page.wait_for_function("calls.at(-1).path.endsWith('/movimientos')")
                        page.evaluate("stopMode='pending'")
                        monitor.click()
                        page.wait_for_function("typeof finishStop==='function'")
                        expect(control).to_have_attribute('aria-selected','true')
                        stops=page.evaluate("calls.filter(c=>c.path.endsWith('/detener')).length")
                        monitor.click()
                        assert page.evaluate("calls.filter(c=>c.path.endsWith('/detener')).length")==stops
                        page.evaluate('finishStop()')
                        page.wait_for_function("document.getElementById('user-monitoring-tab').getAttribute('aria-selected')==='true'")
                        control.click();page.evaluate("stopMode='fail'")
                        center.focus();page.keyboard.press('ArrowDown');monitor.click()
                        page.wait_for_function("document.activeElement.id==='user-control-tab'")
                        expect(control).to_have_attribute('aria-selected','true')
                        page.evaluate("stopMode='ok'");monitor.click()
                        page.wait_for_function("document.getElementById('user-monitoring-tab').getAttribute('aria-selected')==='true'")
                        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                        control.click()
                        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                    assert page.evaluate('errors')==[]
                    print(json.dumps({'ok':True,'role':role,'viewport':[width,height]}))
                    page.close()
            # Ejecutar también las regresiones originales dentro de la nueva vista USUARIO.
            from test_joystick_browser import CHECKS as joystick_checks
            from test_lights_browser import CHECKS as lights_checks, fixture as controls_fixture
            navigation_script=(ROOT / 'assets/js/panel-navigation.js').read_text(encoding='utf-8')
            for width,height in [(1366,900),(390,844)]:
                for name,checks in [('joystick-demo',joystick_checks),('lights',lights_checks)]:
                    page=browser.new_page(viewport={'width':width,'height':height})
                    page.route('**/*',lambda route:route.abort())
                    page.set_content(controls_fixture(include_checks=False))
                    page.add_script_tag(content=navigation_script)
                    page.evaluate("document.dispatchEvent(new CustomEvent('scarlette:sesion-verificada',{detail:{usuario:{rol:'usuario'}}}))")
                    if name=='lights':
                        page.add_script_tag(content=checks)
                        page.wait_for_selector('#scarlette-test-results',state='attached')
                        result=json.loads(page.locator('#scarlette-test-results').text_content())
                    else:
                        result=page.evaluate(checks)
                    assert result['ok'],result
                    print(json.dumps({'ok':True,'regression_with_tabs':name,'viewport':width,'assertions':result['assertions']}))
                    page.close()
        finally:
            browser.close()

if __name__=='__main__':
    main()

