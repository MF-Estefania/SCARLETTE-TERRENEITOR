"""Historial REST con Edge, scripts reales y servicios completamente simulados."""
import json
from test_navigation_browser import fixture, sync_playwright, expect


def history_fixture(role):
    mock = r'''
    window.historyRows=Array.from({length:10},(_,i)=>({
      id_historial:100-i,id_vehiculo:7,comando:i===0?'<img src=x onerror=alert(1)>':'Movimiento '+i,
      codigo:'C'+i,fecha_hora:'2026-11-12T12:30:00',origen:'scarlette_web'
    }));
    window.historyMode='ok';window.historyActive=0;window.historyMax=0;
    const originalFetch=window.fetch;
    window.fetch=async (url,options)=>{
      if(!new URL(url).pathname.endsWith('/historial')) return originalFetch(url,options);
      calls.push({path:new URL(url).pathname,method:options.method});
      if(options.method!=='GET' || !options.headers.get('Authorization')) throw Error('Solicitud no autenticada');
      historyActive++;historyMax=Math.max(historyMax,historyActive);
      if(historyMode==='pending') await new Promise(resolve=>window.releaseHistory=resolve);
      const fail=historyMode==='error';historyActive--;
      return {ok:!fail,status:fail?403:200,text:async()=>JSON.stringify(fail?{detail:'No autorizado'}:historyRows)};
    };
    '''
    return fixture(role).replace('window.WebSocket=class', mock+'window.WebSocket=class')


def emit(page, kind, count=1):
    page.evaluate("([kind,count])=>{for(let i=0;i<count;i++)testSocket.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({tipo:kind,comando:'SOLO WS'})}))}", [kind,count])


def count(page):
    return page.evaluate("calls.filter(c=>c.path.endsWith('/historial')).length")


def main():
    with sync_playwright() as runtime:
        browser=runtime.chromium.launch(channel='msedge',headless=True)
        try:
            for width,height in [(1366,900),(390,844),(844,390)]:
                page=browser.new_page(viewport={'width':width,'height':height},has_touch=True)
                page.route('**/*',lambda route:route.fulfill(status=200,body='<html></html>') if route.request.is_navigation_request() else route.abort())
                page.goto('https://scarlette.test')
                page.set_content(history_fixture('usuario'))
                page.wait_for_function('window.SCARLETTE_USUARIO && sockets===1')
                assert count(page)==0
                emit(page,'movimiento_individual',5)
                assert count(page)==0
                monitor=page.get_by_role('tab',name='MONITOREO',exact=True)
                control=page.get_by_role('tab',name='CONTROL',exact=True)
                monitor.click()
                rows=page.locator('.history-table tbody tr')
                expect(rows).to_have_count(10)
                assert count(page)==1
                assert rows.all_text_contents()==page.evaluate("historyRows.map(r=>r.comando+r.codigo+r.fecha_hora.replace('T',' ')+r.origen)")
                assert page.locator('.history-table img').count()==0
                assert page.locator('.history-table td').nth(2).inner_text()=='2026-11-12 12:30:00'
                for _ in range(3):
                    control.click();expect(control).to_have_attribute('aria-selected','true')
                    monitor.tap();expect(monitor).to_have_attribute('aria-selected','true')
                assert count(page)==1
                emit(page,'demo_movimiento',20)
                page.wait_for_timeout(650)
                assert count(page)==1
                page.evaluate("historyMode='pending'")
                emit(page,'movimiento_individual',20)
                page.wait_for_function('historyActive===1')
                expect(page.locator('.history-status')).to_have_text('Consultando historial…')
                emit(page,'movimiento_individual',20)
                page.wait_for_timeout(650)
                assert count(page)==2
                page.evaluate("historyRows=[{id_historial:101,id_vehiculo:7,comando:'REST actualizado',codigo:'Z',fecha_hora:'2026-11-12T12:45:00-06:00',origen:'otra_sesion'}];historyMode='ok';releaseHistory()")
                expect(rows).to_have_count(1)
                expect(rows.first).to_contain_text('REST actualizado')
                page.wait_for_function("calls.filter(c=>c.path.endsWith('/historial')).length===3 && historyActive===0")
                assert page.evaluate('historyMax')==1
                expect(rows.first).to_contain_text('2026-11-12 12:45:00-06:00')
                # Una actualización también funciona con MONITOREO oculto.
                control.click();expect(control).to_have_attribute('aria-selected','true')
                page.evaluate('historyRows=[]')
                emit(page,'movimiento_individual')
                expect(rows).to_have_count(0)
                monitor.click()
                expect(page.locator('.history-status')).to_have_text('No hay movimientos individuales registrados.')
                page.evaluate("historyMode='error'")
                emit(page,'movimiento_individual')
                retry=page.get_by_role('button',name='Reintentar consulta')
                expect(retry).to_be_visible()
                expect(page.locator('.history-status')).to_contain_text('HTTP 403')
                page.evaluate("historyMode='ok';historyRows=[{comando:'Reintento correcto',codigo:25,fecha_hora:'2026-11-12T13:00:00',origen:'scarlette_web'}]")
                retry.click()
                expect(rows).to_have_count(1)
                expect(rows.first).to_contain_text('Reintento correcto')
                expect(retry).to_be_hidden()
                assert page.evaluate('sockets')==1
                assert all(page.locator('.connection').nth(i).is_visible() for i in range(3))
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                scroll=page.locator('.history-table-scroll')
                scroll.focus();expect(scroll).to_be_focused()
                assert page.evaluate('errors')==[]
                print(json.dumps({'ok':True,'history_viewport':[width,height],'max_concurrent':1}))
                page.close()
            page=browser.new_page()
            page.route('**/*',lambda route:route.fulfill(status=200,body='<html></html>'))
            page.goto('https://scarlette.test')
            page.set_content(history_fixture('administradora'))
            page.wait_for_function('window.SCARLETTE_USUARIO && sockets===1')
            emit(page,'movimiento_individual')
            assert count(page)==0
            assert page.locator('#movement-history').count()==0
            assert page.locator('[role=tab]').count()==0
            assert page.locator('.app-shell > .events-disclosure').count()==1
            print(json.dumps({'ok':True,'admin_unchanged':True}))
            page.close()
        finally:
            browser.close()


if __name__=='__main__':
    main()
