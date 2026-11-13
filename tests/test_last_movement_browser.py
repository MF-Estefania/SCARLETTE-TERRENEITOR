"""Estado compartido con Edge, reloj controlado y servicios simulados."""
import json
from test_history_browser import history_fixture, emit
from test_navigation_browser import sync_playwright, expect


def fixture(role):
    mock = r'''
    window.stateData={id_vehiculo:7,vehiculo:'Terreneitor',id_comando:28,
      comando:'CONTROL / LUCES',codigo:'E',conectado:false,fecha_actualizacion:'2026-11-12T21:42:53'};
    window.stateMode='ok';window.stateActive=0;window.stateMax=0;
    const previousFetch=window.fetch;
    window.fetch=async (url,options)=>{
      if(!new URL(url).pathname.endsWith('/estado')) return previousFetch(url,options);
      calls.push({path:new URL(url).pathname,method:options.method});
      stateActive++;stateMax=Math.max(stateMax,stateActive);
      if(stateMode==='pending') await new Promise(resolve=>window.releaseState=resolve);
      const fail=stateMode==='error';stateActive--;
      return {ok:!fail,status:fail?503:200,text:async()=>JSON.stringify(fail?{detail:'No disponible'}:stateData)};
    };
    '''
    return history_fixture(role).replace('window.WebSocket=class',mock+'window.WebSocket=class')


def count(page, suffix='/estado'):
    return page.evaluate('(suffix)=>calls.filter(c=>c.path.endsWith(suffix)).length', suffix)


def settle(page):
    page.evaluate('async()=>{for(let i=0;i<30;i++)await Promise.resolve()}')


def main():
    with sync_playwright() as runtime:
        browser=runtime.chromium.launch(channel='msedge',headless=True)
        try:
            for width,height in [(1366,900),(390,844),(844,390)]:
                page=browser.new_page(viewport={'width':width,'height':height},has_touch=True)
                page.route('**/*',lambda route:route.fulfill(status=200,body='<html></html>') if route.request.is_navigation_request() else route.abort())
                page.goto('https://scarlette.test')
                page.clock.install()
                page.set_content(fixture('usuario'))
                page.wait_for_function('window.SCARLETTE_USUARIO && stateActive===0 && sockets===1')
                card=page.locator('#last-movement')
                expect(card).to_be_hidden()
                assert count(page)==1
                monitor=page.get_by_role('tab',name='MONITOREO',exact=True)
                control=page.get_by_role('tab',name='CONTROL',exact=True)
                monitor.click()
                expect(card).to_be_visible()
                expect(card.locator('dd').nth(0)).to_have_text('CONTROL / LUCES')
                expect(card.locator('dd').nth(1)).to_have_text('E')
                expect(card.locator('dd').nth(2)).to_have_text('2026-11-12 21:42:53')
                expect(card).to_contain_text('Registro de la API; no confirma ejecución física')
                assert page.locator('#user-monitoring-panel > section').first.get_attribute('id')=='last-movement'
                assert count(page)==1
                assert all('Disponible' in page.locator('.connection-state').nth(i).inner_text() for i in [1,2])
                for _ in range(2):
                    control.click();expect(control).to_have_attribute('aria-selected','true')
                    monitor.tap();expect(monitor).to_have_attribute('aria-selected','true')
                assert count(page)==1
                # Un solo ciclo periódico compartido por tarjeta e indicadores.
                page.clock.fast_forward(30000);settle(page)
                assert count(page)==2
                history_count=count(page,'/historial')
                emit(page,'demo_movimiento',20)
                page.clock.fast_forward(600);settle(page)
                assert count(page)==2 and count(page,'/historial')==history_count
                # WS solo invalida; nunca se renderiza su contenido como registro.
                page.evaluate("stateMode='pending'")
                emit(page,'movimiento_individual',20)
                page.clock.fast_forward(600);settle(page)
                assert count(page)==3 and page.evaluate('stateActive')==1
                expect(card.locator('.last-movement-status')).to_have_text('Actualizando registro…')
                expect(card.locator('dd').first).to_have_text('CONTROL / LUCES')
                emit(page,'movimiento_individual',20)
                page.clock.fast_forward(600);settle(page)
                assert count(page)==3
                page.evaluate("stateMode='ok';stateData.comando='<b>REST seguro</b>';stateData.codigo='F';stateData.fecha_actualizacion='2026-11-12T22:00:00';releaseState()")
                settle(page)
                expect(card.locator('dd').first).to_have_text('<b>REST seguro</b>')
                assert card.locator('dd b').count()==0
                page.clock.fast_forward(600);settle(page)
                assert count(page)==4 and page.evaluate('stateMax')==1
                # Error conserva el dato anterior y los indicadores originales.
                page.evaluate("stateMode='error'")
                emit(page,'movimiento_individual')
                page.clock.fast_forward(600);settle(page)
                expect(card.locator('.last-movement-status')).to_contain_text('Registro no actualizado')
                expect(card.locator('dd').first).to_have_text('<b>REST seguro</b>')
                expect(page.locator('.connection-state').nth(2)).to_have_text('No disponible')
                page.evaluate("stateMode='ok';stateData.comando='RECUPERADO'")
                card.get_by_role('button',name='Reintentar estado').click()
                page.clock.fast_forward(600);settle(page)
                expect(card.locator('dd').first).to_have_text('RECUPERADO')
                expect(card.locator('.last-movement-status')).to_have_text('Último registro obtenido de la API.')
                # Una respuesta vacía es distinta de un error.
                page.evaluate("stateData.comando=null;stateData.codigo=null;stateData.fecha_actualizacion=null")
                emit(page,'movimiento_individual');page.clock.fast_forward(600);settle(page)
                expect(card.locator('.last-movement-status')).to_have_text('No hay un movimiento registrado.')
                expect(card.locator('dl')).to_be_hidden()
                assert page.evaluate('sockets')==1
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                assert all(page.locator('.connection').nth(i).is_visible() for i in range(3))
                assert page.evaluate('errors')==[]
                print(json.dumps({'ok':True,'last_movement_viewport':[width,height],'max_concurrent':1}))
                page.close()
            # Error inicial y recuperación mediante el mismo temporizador.
            for role in ['usuario','administradora']:
                page=browser.new_page()
                page.route('**/*',lambda route:route.fulfill(status=200,body='<html></html>'))
                page.goto('https://scarlette.test');page.clock.install()
                page.set_content(fixture(role).replace("window.stateMode='ok'", "window.stateMode='error'"))
                page.wait_for_function('window.SCARLETTE_USUARIO && stateActive===0 && sockets===1')
                if role=='usuario':
                    page.get_by_role('tab',name='MONITOREO',exact=True).click()
                    expect(page.locator('.last-movement-status')).to_contain_text('No se pudo obtener el estado.')
                    page.evaluate("stateMode='ok'")
                    page.clock.fast_forward(30000);settle(page)
                    expect(page.locator('#last-movement dd').first).to_have_text('CONTROL / LUCES')
                else:
                    assert page.locator('#last-movement').count()==0
                    assert page.locator('[role=tab]').count()==0
                    emit(page,'movimiento_individual');page.clock.fast_forward(600);settle(page)
                    assert count(page)==1
                    assert page.locator('.app-shell > .events-disclosure').count()==1
                print(json.dumps({'ok':True,'role':role,'initial_error_and_polling':True}))
                page.close()
        finally:
            browser.close()


if __name__=='__main__':
    main()
